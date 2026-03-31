/**
 * Vision — all AD vision calls go through Sonnet (Anthropic API).
 *
 * Single backend: Sonnet via callAnthropicVision(). Falls back to 'self'
 * (orchestrator reads images directly) when no API key is available.
 *
 * Functions:
 * - callVision(): single image + prompt → text (used by calibrate + analyze)
 * - callVisionPair(): two images + prompt → text (used by score)
 * - calibrateReference(): concept art → cached keywords
 * - analyzeReference(): concept art → structured JSON
 * - scoreWithReference(): concept + render → A-F grade
 */

import fs from 'fs';
import path from 'path';
import { mcpLog } from '../OctaneMcpClient';
import { buildCalibrationPrompt } from './prompts';
import type { CachedCalibration } from '../ArtDirectionState';
import { callAnthropicVision, getAnthropicKey } from './anthropic';

export type VisionBackend = 'sonnet' | 'self';

// ── Helpers ─────────────────────────────────────────────────────────

function detectMediaType(filePath: string): string {
  // Sniff actual file header — extensions lie (e.g. OTOY Studio returns JPEG as .png)
  try {
    // Read 12 bytes: enough for RIFF....WEBP signature check
    const buf = Buffer.alloc(12);
    const fd = fs.openSync(filePath, 'r');
    try {
      fs.readSync(fd, buf, 0, 12, 0);
    } finally {
      fs.closeSync(fd);
    }
    // JPEG: FF D8 FF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    // PNG: 89 50 4E 47
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
      return 'image/png';
    // WebP: RIFF....WEBP (bytes 0-3 = "RIFF", bytes 8-11 = "WEBP")
    if (
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x45 &&
      buf[10] === 0x42 &&
      buf[11] === 0x50
    )
      return 'image/webp';
  } catch {
    /* fall through to extension-based detection */
  }
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

function readImageBase64(filePath: string): { base64: string; mediaType: string } | null {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    mcpLog(`VISION: image not found: ${resolved}`, 'warn');
    return null;
  }
  return {
    base64: fs.readFileSync(resolved).toString('base64'),
    mediaType: detectMediaType(resolved),
  };
}

// ── Calibration Persistence ────────────────────────────────────────

/** Sidecar path: /path/to/concept_art.png → /path/to/concept_art.png.calibration.json */
function calibrationPath(imagePath: string): string {
  return path.resolve(imagePath) + '.calibration.json';
}

/** Save calibration as JSON sidecar next to the concept art image. */
export function saveCalibration(imagePath: string, calibration: CachedCalibration): void {
  try {
    fs.writeFileSync(calibrationPath(imagePath), JSON.stringify(calibration, null, 2), 'utf8');
    mcpLog(`VISION: saved calibration → ${calibrationPath(imagePath)}`, 'debug');
  } catch (e: any) {
    mcpLog(`VISION: failed to save calibration: ${e.message}`, 'warn');
  }
}

/** Load calibration from sidecar. Returns null if missing or corrupt. */
export function loadCalibration(imagePath: string): CachedCalibration | null {
  const p = calibrationPath(imagePath);
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (data && typeof data.composition === 'string' && typeof data.vlmModel === 'string') {
      mcpLog(`VISION: loaded cached calibration from ${p}`, 'debug');
      return data as CachedCalibration;
    }
  } catch (e: any) {
    mcpLog(`VISION: corrupt calibration file ${p}: ${e.message}`, 'warn');
  }
  return null;
}

/** Try to extract JSON from a VLM response (handles markdown blocks, truncation). */
function parseJsonResponse(raw: string): any | null {
  const candidates = [raw];
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) candidates.push(jsonMatch[1]);
  const braceMatch = raw.match(/\{[\s\S]*/);
  if (braceMatch) candidates.push(braceMatch[0]);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try repairing truncated JSON
      let repaired = candidate.trim().replace(/,\s*$/, '');
      const opens = (repaired.match(/\[/g) || []).length;
      const closes = (repaired.match(/\]/g) || []).length;
      const openBraces = (repaired.match(/\{/g) || []).length;
      const closeBraces = (repaired.match(/\}/g) || []).length;
      for (let i = 0; i < opens - closes; i++) repaired += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
      try {
        const result = JSON.parse(repaired);
        mcpLog('VISION: repaired truncated JSON', 'info');
        return result;
      } catch {
        /* truly unparseable */
      }
    }
  }
  return null;
}

// ── Core Vision Calls ───────────────────────────────────────────────

interface VisionCallResult {
  text: string;
  backend: VisionBackend;
  model?: string;
  promptSent: string;
  vlmRawResponse: string;
}

const EMPTY_RESULT = (prompt: string): VisionCallResult => ({
  text: '',
  backend: 'self',
  promptSent: prompt,
  vlmRawResponse: '',
});

/**
 * Send one image + prompt to Sonnet. Used by calibrateReference and analyzeReference.
 */
export async function callVision(imagePath: string, prompt: string): Promise<VisionCallResult> {
  const apiKey = getAnthropicKey();
  if (!apiKey) {
    throw new Error('VISION: Anthropic API key not configured — set ANTHROPIC_API_KEY env var');
  }

  const img = readImageBase64(imagePath);
  if (!img) return EMPTY_RESULT(prompt);

  try {
    const result = await callAnthropicVision(prompt, [img], {
      apiKey,
      model: 'claude-sonnet-4-20250514',
      maxTokens: 2000,
    });
    return {
      text: result.text,
      backend: 'sonnet',
      model: result.model,
      promptSent: prompt,
      vlmRawResponse: result.text,
    };
  } catch (error: any) {
    throw new Error(`VISION: Sonnet call failed: ${error.message}`);
  }
}

/**
 * Send two images + prompt to Sonnet. Used by scoreWithReference.
 */
export async function callVisionPair(
  imagePath1: string,
  imagePath2: string,
  prompt: string,
  systemPrompt?: string
): Promise<VisionCallResult> {
  const apiKey = getAnthropicKey();
  if (!apiKey) {
    throw new Error('VISION: Anthropic API key not configured — set ANTHROPIC_API_KEY env var');
  }

  const img1 = readImageBase64(imagePath1);
  const img2 = readImageBase64(imagePath2);
  if (!img1 || !img2) return EMPTY_RESULT(prompt);

  try {
    const result = await callAnthropicVision(prompt, [img1, img2], {
      apiKey,
      model: 'claude-sonnet-4-20250514',
      maxTokens: 2000,
      systemPrompt,
    });
    return {
      text: result.text,
      backend: 'sonnet',
      model: result.model,
      promptSent: prompt,
      vlmRawResponse: result.text,
    };
  } catch (error: any) {
    throw new Error(`VISION: Sonnet call failed: ${error.message}`);
  }
}

// ── Calibration ─────────────────────────────────────────────────────

/**
 * Calibrate concept art — extract composition description + keywords.
 * Run once per scene, cache the result.
 */
export async function calibrateReference(
  imagePath: string
): Promise<{ calibration: CachedCalibration | null; promptSent: string; vlmRawResponse: string }> {
  // Check for cached calibration on disk first
  const cached = loadCalibration(imagePath);
  if (cached) {
    return { calibration: cached, promptSent: '(cached from disk)', vlmRawResponse: '' };
  }

  const prompt = buildCalibrationPrompt();
  const { text, backend, model, promptSent, vlmRawResponse } = await callVision(imagePath, prompt);

  if (backend === 'self' || !text) {
    return { calibration: null, promptSent, vlmRawResponse };
  }

  const keywords = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .filter((w, i, arr) => arr.indexOf(w) === i);

  const calibration: CachedCalibration = {
    composition: text,
    keywords,
    vlmModel: model || 'unknown',
    timestamp: Date.now(),
  };

  // Persist to disk for future sessions
  saveCalibration(imagePath, calibration);

  return {
    calibration,
    promptSent,
    vlmRawResponse,
  };
}

// ── Reference Analysis ──────────────────────────────────────────────

export interface VisionAnalysisResult {
  backend: VisionBackend;
  data: any;
  raw: string;
  model?: string;
  promptSent?: string;
  vlmRawResponse?: string;
}

/**
 * Analyze a reference image — extract structured JSON for scene building.
 */
export async function analyzeReference(
  imagePath: string,
  analysisPrompt: string
): Promise<VisionAnalysisResult | null> {
  const { text, backend, model, promptSent, vlmRawResponse } = await callVision(
    imagePath,
    analysisPrompt
  );

  if (backend === 'self' || !text) return null;

  const data = parseJsonResponse(text);
  return { backend, data, raw: text, model, promptSent, vlmRawResponse };
}

// ── Concept-vs-Render Scoring ──────────────────────────────────────

export interface ComparisonScoreResult {
  grade: string;
  composition_match: number;
  lighting_match: number;
  material_match: number;
  mood_match: number;
  depth_match: number;
  missing_elements: string[];
  top_fixes: string[];
  notes: string;
  model: string;
  latency_ms: number;
  promptSent: string;
  vlmRawResponse: string;
}

/**
 * Send concept art + render to Sonnet for holistic A-F comparison.
 */
export async function scoreWithReference(
  renderPath: string,
  conceptPath: string,
  comparisonPrompt: string
): Promise<ComparisonScoreResult | null> {
  const startMs = Date.now();
  const { text, backend, model, promptSent, vlmRawResponse } = await callVisionPair(
    conceptPath,
    renderPath,
    comparisonPrompt,
    'You are a professional art director comparing a concept artwork against a 3D render. Be brutally honest. Answer as JSON only.'
  );

  if (backend === 'self' || !text) return null;

  const latencyMs = Date.now() - startMs;
  const parsed = parseJsonResponse(text);

  if (!parsed) {
    mcpLog('VISION: Sonnet score response not parseable as JSON', 'warn');
    return {
      grade: '?',
      composition_match: 0,
      lighting_match: 0,
      material_match: 0,
      mood_match: 0,
      depth_match: 0,
      missing_elements: [],
      top_fixes: [],
      notes: text,
      model: model || 'unknown',
      latency_ms: latencyMs,
      promptSent,
      vlmRawResponse,
    };
  }

  return {
    grade: String(parsed.grade || '?'),
    composition_match: Number(parsed.composition_match || 0),
    lighting_match: Number(parsed.lighting_match ?? parsed.mood_match ?? 0),
    material_match: Number(parsed.material_match ?? parsed.density_match ?? 0),
    mood_match: Number(parsed.mood_match || 0),
    depth_match: Number(parsed.depth_match ?? parsed.density_match ?? 0),
    missing_elements: Array.isArray(parsed.missing_elements) ? parsed.missing_elements : [],
    top_fixes: Array.isArray(parsed.top_fixes) ? parsed.top_fixes : [],
    notes: String(parsed.notes || ''),
    model: model || 'unknown',
    latency_ms: latencyMs,
    promptSent,
    vlmRawResponse,
  };
}
