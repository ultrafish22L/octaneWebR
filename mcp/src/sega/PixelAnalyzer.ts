/**
 * PixelAnalyzer — measure semantic dimensions from raw pixel data.
 *
 * Computes ground-truth values for pixel-computable dimensions:
 * - contrast → luminance histogram standard deviation
 * - warmth → estimated color temperature from average RGB
 * - saturation → mean chroma in approximate Lab space
 * - atmosphere → high-frequency loss (blur detection)
 *
 * Input: raw PNG buffer (Node.js only, no Canvas dependency).
 * Uses simple math on raw pixel values — no image libraries required.
 *
 * Self-learning hook: these measurements calibrate VLM estimates.
 * Future engine compares pixel ground truth vs VLM scores to compute bias.
 */

import fs from 'fs';
import type { SemanticVector } from './types';

// ── Raw PNG pixel reading (no external deps) ───────────────────────

/**
 * Extract raw RGBA pixel data from an uncompressed PNG or raw image buffer.
 * For compressed PNGs, we use a minimal zlib inflate approach.
 */
function readPngPixels(
  buffer: Buffer
): { width: number; height: number; pixels: Uint8Array } | null {
  // Validate PNG signature
  const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== PNG_SIG[i]) return null;
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);

    if (type === 'IHDR') {
      width = buffer.readUInt32BE(offset + 8);
      height = buffer.readUInt32BE(offset + 12);
      bitDepth = buffer[offset + 16];
      colorType = buffer[offset + 17];
    } else if (type === 'IDAT') {
      idatChunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length; // 4 length + 4 type + data + 4 crc
  }

  if (width === 0 || height === 0 || idatChunks.length === 0) return null;

  // Only handle 8-bit RGB or RGBA
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) return null;

  const zlib = require('zlib') as typeof import('zlib');
  const compressed = Buffer.concat(idatChunks);
  let decompressed: Buffer;
  try {
    decompressed = zlib.inflateSync(compressed);
  } catch {
    return null;
  }

  const channels = colorType === 6 ? 4 : 3;
  const rowBytes = 1 + width * channels; // 1 byte filter + pixel data
  const pixels = new Uint8Array(width * height * 4);

  // Simple PNG unfilter (handles None and Sub filters, approximates others)
  const prevRow = new Uint8Array(width * channels);
  let srcOff = 0;

  for (let y = 0; y < height; y++) {
    const filter = decompressed[srcOff++];
    const row = new Uint8Array(width * channels);

    for (let x = 0; x < width * channels; x++) {
      const raw = decompressed[srcOff++];
      const a = x >= channels ? row[x - channels] : 0; // left
      const b = prevRow[x]; // up

      switch (filter) {
        case 0:
          row[x] = raw;
          break; // None
        case 1:
          row[x] = (raw + a) & 0xff;
          break; // Sub
        case 2:
          row[x] = (raw + b) & 0xff;
          break; // Up
        case 3:
          row[x] = (raw + ((a + b) >> 1)) & 0xff;
          break; // Average
        case 4: {
          // Paeth
          const c = x >= channels ? prevRow[x - channels] : 0;
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          row[x] = (raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default:
          row[x] = raw;
      }
    }

    // Copy to RGBA output
    for (let x = 0; x < width; x++) {
      const dstIdx = (y * width + x) * 4;
      const srcIdx = x * channels;
      pixels[dstIdx] = row[srcIdx]; // R
      pixels[dstIdx + 1] = row[srcIdx + 1]; // G
      pixels[dstIdx + 2] = row[srcIdx + 2]; // B
      pixels[dstIdx + 3] = channels === 4 ? row[srcIdx + 3] : 255; // A
    }

    prevRow.set(row);
  }

  return { width, height, pixels };
}

// ── Pixel Measurements ──────────────────────────────────────────────

/**
 * Compute luminance from RGB (BT.709).
 */
function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Measure contrast as standard deviation of luminance histogram.
 * Maps to contrast dimension: low SD = flat, high SD = high contrast.
 */
function measureContrast(pixels: Uint8Array, width: number, height: number): number {
  const n = width * height;
  let sum = 0;
  let sumSq = 0;

  // Sample every 4th pixel for performance on large images
  const step = 4;
  let count = 0;
  for (let i = 0; i < n; i += step) {
    const idx = i * 4;
    const lum = luminance(pixels[idx], pixels[idx + 1], pixels[idx + 2]) / 255;
    sum += lum;
    sumSq += lum * lum;
    count++;
  }

  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  const sd = Math.sqrt(Math.max(0, variance));

  // Map SD to [-1, +1]: SD=0.05 → -1 (flat), SD=0.35 → +1 (high contrast)
  return Math.max(-1, Math.min(1, (sd - 0.2) / 0.15));
}

/**
 * Measure warmth as estimated color temperature from average RGB.
 * Uses McCamy's approximation for correlated color temperature.
 */
function measureWarmth(pixels: Uint8Array, width: number, height: number): number {
  const n = width * height;
  let sumR = 0,
    sumG = 0,
    sumB = 0;
  const step = 4;
  let count = 0;

  for (let i = 0; i < n; i += step) {
    const idx = i * 4;
    sumR += pixels[idx];
    sumG += pixels[idx + 1];
    sumB += pixels[idx + 2];
    count++;
  }

  const avgR = sumR / count / 255;
  const avgG = sumG / count / 255;
  const avgB = sumB / count / 255;

  // Simple warmth: ratio of red to blue channel
  // R/B > 1 = warm, R/B < 1 = cool
  const ratio = avgB > 0.01 ? avgR / avgB : 1;
  // Map: ratio=0.5 → -1 (very cool), ratio=1.0 → 0 (neutral), ratio=2.0 → +1 (very warm)
  return Math.max(-1, Math.min(1, (ratio - 1.0) / 1.0));
}

/**
 * Measure saturation as mean chroma.
 * Uses approximate conversion to compute chroma without full Lab transform.
 */
function measureSaturation(pixels: Uint8Array, width: number, height: number): number {
  const n = width * height;
  let sumChroma = 0;
  const step = 4;
  let count = 0;

  for (let i = 0; i < n; i += step) {
    const idx = i * 4;
    const r = pixels[idx] / 255;
    const g = pixels[idx + 1] / 255;
    const b = pixels[idx + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = (max + min) / 2;

    // HSL saturation
    if (max !== min && lum > 0.01 && lum < 0.99) {
      const sat = lum < 0.5 ? (max - min) / (max + min) : (max - min) / (2 - max - min);
      sumChroma += sat;
    }
    count++;
  }

  const meanSat = sumChroma / count;
  // Map: 0.0 → -1 (desaturated), 0.3 → 0 (moderate), 0.6 → +1 (vivid)
  return Math.max(-1, Math.min(1, (meanSat - 0.3) / 0.3));
}

/**
 * Measure atmosphere/haze as high-frequency content loss.
 * Low variance between adjacent pixels = hazy, high = crisp.
 */
function measureAtmosphere(pixels: Uint8Array, width: number, height: number): number {
  // Compute horizontal gradient magnitude (simple edge detection)
  let sumGrad = 0;
  const step = 4;
  let count = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 1; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const prevIdx = (y * width + x - 1) * 4;
      const dR = pixels[idx] - pixels[prevIdx];
      const dG = pixels[idx + 1] - pixels[prevIdx + 1];
      const dB = pixels[idx + 2] - pixels[prevIdx + 2];
      const grad = Math.sqrt(dR * dR + dG * dG + dB * dB) / 255;
      sumGrad += grad;
      count++;
    }
  }

  const meanGrad = count > 0 ? sumGrad / count : 0;
  // High gradient = crisp (low atmosphere), low gradient = hazy (high atmosphere)
  // Map: gradient=0.02 → +1 (hazy), gradient=0.12 → 0, gradient=0.25 → -1 (crisp)
  return Math.max(-1, Math.min(1, -(meanGrad - 0.12) / 0.1));
}

// ── Public API ──────────────────────────────────────────────────────

export interface PixelMeasurement {
  contrast: number; // [-1, +1]
  warmth: number;
  saturation: number;
  atmosphere: number;
  meta: {
    width: number;
    height: number;
    pixelCount: number;
  };
}

/**
 * Analyze an image file and return measured semantic dimension values.
 * Returns null if the image can't be read (not PNG, corrupted, etc).
 */
export function analyzeImage(imagePath: string): PixelMeasurement | null {
  const resolved = require('path').resolve(imagePath);
  if (!fs.existsSync(resolved)) return null;

  const buffer = fs.readFileSync(resolved);
  const image = readPngPixels(buffer);
  if (!image) return null;

  return {
    contrast: measureContrast(image.pixels, image.width, image.height),
    warmth: measureWarmth(image.pixels, image.width, image.height),
    saturation: measureSaturation(image.pixels, image.width, image.height),
    atmosphere: measureAtmosphere(image.pixels, image.width, image.height),
    meta: {
      width: image.width,
      height: image.height,
      pixelCount: image.width * image.height,
    },
  };
}

/**
 * Convert pixel measurements to a partial semantic vector.
 * Only includes dimensions that can be pixel-measured.
 */
export function measurementToVector(m: PixelMeasurement): SemanticVector {
  return {
    contrast: m.contrast,
    warmth: m.warmth,
    saturation: m.saturation,
    atmosphere: m.atmosphere,
  };
}
