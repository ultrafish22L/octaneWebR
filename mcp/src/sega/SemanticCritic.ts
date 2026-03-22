/**
 * SemanticCritic — measures semantic gap between target and rendered image.
 *
 * Replaces the old 1-5 scoring system with a meaningful gap vector:
 *   target:   { warmth: 0.7, contrast: 0.6 }
 *   measured: { warmth: 0.4, contrast: 0.7 }
 *   gap:      { warmth: -0.3, contrast: +0.1 }
 *
 * Measurement (hybrid):
 * - Pixel-computable: contrast, warmth, saturation, atmosphere (ground truth)
 * - VLM-estimated: pleasure, arousal, dominance, complexity, etc. (perceptual)
 * - Calibration: pixel measurements correct systematic VLM bias
 *
 * Convergence: gap magnitude < 0.15 = converged.
 * Stagnation: gap doesn't shrink by > 0.05 over 2 iterations.
 *
 * Self-learning hooks:
 * - Records gap history for pattern analysis
 * - VLM calibration data accumulates across sessions (future)
 */

import type { SemanticVector, BerlyneWarning } from './types';
import { analyzeImage, measurementToVector, type PixelMeasurement } from './PixelAnalyzer';
import { DIMENSIONS } from './registry';

// ── Gap Vector Computation ──────────────────────────────────────────

export interface SemanticGap {
  /** Per-dimension gap: measured - target (positive = over, negative = under) */
  gap: SemanticVector;
  /** Euclidean magnitude of the gap vector */
  magnitude: number;
  /** Is the gap below convergence threshold? */
  converged: boolean;
  /** Dimensions with largest gaps, sorted by magnitude */
  worstDimensions: Array<{ dimension: string; gap: number; direction: string }>;
}

const CONVERGENCE_THRESHOLD = 0.15;
const STAGNATION_THRESHOLD = 0.05;

/**
 * Compute the semantic gap between target and measured vectors.
 */
export function computeGap(target: SemanticVector, measured: SemanticVector): SemanticGap {
  const gap: SemanticVector = {};
  let sumSq = 0;

  // Compute gap for all target dimensions
  const allDims = new Set([...Object.keys(target), ...Object.keys(measured)]);
  for (const dim of allDims) {
    const t = target[dim] ?? 0;
    const m = measured[dim] ?? 0;
    const diff = m - t;
    if (Math.abs(diff) > 0.01) {
      // Skip negligible gaps
      gap[dim] = diff;
      sumSq += diff * diff;
    }
  }

  const magnitude = Math.sqrt(sumSq);
  const converged = magnitude < CONVERGENCE_THRESHOLD;

  // Sort worst dimensions by absolute gap
  const worstDimensions = Object.entries(gap)
    .map(([dimension, g]) => ({
      dimension,
      gap: g,
      direction: g > 0 ? 'too much' : 'not enough',
    }))
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

  return { gap, magnitude, converged, worstDimensions };
}

/**
 * Check if gap is stagnating (not improving enough between iterations).
 */
export function isGapStagnating(prevMagnitude: number, currentMagnitude: number): boolean {
  return Math.abs(prevMagnitude - currentMagnitude) < STAGNATION_THRESHOLD;
}

// ── Critique Result ─────────────────────────────────────────────────

export interface SemanticCritiqueResult {
  /** Target semantic vector */
  target: SemanticVector;
  /** Measured semantic vector (pixel + VLM) */
  measured: SemanticVector;
  /** Gap analysis */
  gap: SemanticGap;
  /** Pixel measurements (ground truth for calibration) */
  pixelMeasurement: PixelMeasurement | null;
  /** Suggested corrections (dimension deltas to apply) */
  corrections: SemanticVector;
  /** Human-readable summary */
  summary: string;
  /** Berlyne warnings on target vector */
  warnings: BerlyneWarning[];
}

/**
 * Build a VLM prompt to estimate non-pixel-computable dimensions.
 * The VLM rates each dimension on a scale, which we map to [-1, +1].
 */
export function buildVLMEstimationPrompt(targetDimensions: string[]): string {
  // Only ask about dimensions that can't be pixel-measured
  const pixelDims = new Set(['contrast', 'warmth', 'saturation', 'atmosphere']);
  const vlmDims = targetDimensions.filter(d => !pixelDims.has(d));

  if (vlmDims.length === 0) {
    return ''; // All dimensions are pixel-measurable
  }

  const dimDescriptions = vlmDims
    .map(name => {
      const dim = DIMENSIONS.find(d => d.name === name);
      if (!dim) return null;
      return `- **${name}**: Rate from -1.0 (${dim.negativeLabel}) to +1.0 (${dim.positiveLabel}). ${dim.description}`;
    })
    .filter(Boolean)
    .join('\n');

  return `You are measuring perceptual qualities of a 3D render.
Rate each dimension on a precise scale from -1.0 to +1.0.
Be specific — use the full range, not just -1/0/+1.

DIMENSIONS TO RATE:
${dimDescriptions}

IMPORTANT: Be precise. 0 = neutral/absent. Positive = present/strong. Negative = opposite quality.
Do NOT inflate scores. A typical render is mostly near 0 on most dimensions.

Respond as JSON only:
{"measurements":{"dimension_name":value_float}}`;
}

/**
 * Parse VLM estimation response into a semantic vector.
 */
export function parseVLMEstimation(response: string): SemanticVector | null {
  const candidates = [response];
  const codeBlock = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) candidates.push(codeBlock[1]);
  const braceMatch = response.match(/\{[\s\S]*\}/);
  if (braceMatch) candidates.push(braceMatch[0]);

  for (const candidate of candidates) {
    try {
      const data = JSON.parse(candidate.trim());
      const measurements = data.measurements || data;
      if (typeof measurements === 'object') {
        const result: SemanticVector = {};
        for (const [k, v] of Object.entries(measurements)) {
          if (typeof v === 'number') {
            result[k] = Math.max(-1, Math.min(1, v));
          }
        }
        if (Object.keys(result).length > 0) return result;
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Run a full semantic critique on a rendered image.
 *
 * Steps:
 * 1. Pixel analysis (contrast, warmth, saturation, atmosphere)
 * 2. Merge with VLM estimates (if provided)
 * 3. Compute gap against target
 * 4. Generate correction suggestions
 *
 * The VLM estimation must be done externally (by the AI calling the VLM tool)
 * and passed in as vlmMeasurements. This function combines everything.
 */
export function runCritique(
  target: SemanticVector,
  imagePath: string,
  vlmMeasurements?: SemanticVector
): SemanticCritiqueResult {
  // Step 1: Pixel measurements
  const pixelMeasurement = analyzeImage(imagePath);
  const pixelVector = pixelMeasurement ? measurementToVector(pixelMeasurement) : {};

  // Step 2: Merge pixel + VLM (pixel takes precedence as ground truth)
  const measured: SemanticVector = {
    ...(vlmMeasurements || {}),
    ...pixelVector, // pixel overwrites VLM for computable dimensions
  };

  // Step 3: Compute gap
  const gap = computeGap(target, measured);

  // Step 4: Generate corrections (negate the gap to get needed adjustment)
  const corrections: SemanticVector = {};
  for (const worst of gap.worstDimensions.slice(0, 5)) {
    // Only suggest corrections for dimensions with significant gap
    if (Math.abs(worst.gap) > 0.1) {
      corrections[worst.dimension] = -worst.gap;
    }
  }

  // Step 5: Berlyne warnings on target
  const warnings: BerlyneWarning[] = [];
  for (const [dim, val] of Object.entries(target)) {
    if (Math.abs(val) > 0.85) {
      warnings.push({
        dimension: dim,
        value: val,
        message: `${dim} = ${val.toFixed(2)} — extreme value (Berlyne inverted-U warning).`,
      });
    }
  }

  // Summary
  const worstDesc = gap.worstDimensions
    .slice(0, 3)
    .map(w => `${w.dimension}: ${w.gap > 0 ? '+' : ''}${w.gap.toFixed(2)} (${w.direction})`)
    .join(', ');

  const summary = gap.converged
    ? `Converged (gap magnitude ${gap.magnitude.toFixed(3)} < ${CONVERGENCE_THRESHOLD}). Scene matches target intent.`
    : `Gap magnitude: ${gap.magnitude.toFixed(3)}. Worst dimensions: ${worstDesc}. Apply corrections and re-render.`;

  return {
    target,
    measured,
    gap,
    pixelMeasurement,
    corrections,
    summary,
    warnings,
  };
}
