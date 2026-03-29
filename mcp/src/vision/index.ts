/**
 * VisionCritic — orchestrates vision calls for render critique via OTOY Studio.
 *
 * Architecture:
 * - calibrateReference(): Run once on concept art → cached calibration (C)
 * - critiqueRender(): 1 VLM call per render → description compared against calibration
 * - Server-side scoring via scoring.ts (keyword overlap + composition match)
 * - VLM just describes. AD reasons. Server scores.
 */

import { mcpLog } from '../OctaneMcpClient';
import { extractOtoyStudioToken, analyseImageFromFile } from './otoy-studio';
import { parseCritiqueResponse, buildCalibrationPrompt } from './prompts';
import { PASS_THRESHOLD, MIN_DIMENSION_SCORE } from '../ArtDirectionState';
import type { CachedCalibration } from '../ArtDirectionState';
import { computeServerScore, type ServerScore } from './scoring';

export type VisionBackend = 'otoy-studio' | 'self';

/**
 * Recompute overall score and passed flag server-side.
 * Enforces framing-gated weighted scoring regardless of VLM output.
 */
function enforceFramingGate(scores: VisionCritiqueResult['scores']): {
  overall: number;
  passed: boolean;
} {
  const weighted =
    (scores.framing * 2 +
      scores.placement * 1.5 +
      scores.composition * 1.5 +
      scores.depth * 1 +
      scores.lighting * 1) /
    7;
  const overall = scores.framing < 3 ? Math.min(weighted, 2.5) : weighted;
  const allAboveMin = Object.values(scores).every(s => s >= MIN_DIMENSION_SCORE);
  const passed = overall >= PASS_THRESHOLD && scores.framing >= 3 && allAboveMin;
  return { overall: Math.round(overall * 10) / 10, passed };
}

export interface VisionCritiqueResult {
  backend: VisionBackend;
  scores: {
    framing: number;
    depth: number;
    composition: number;
    lighting: number;
    placement: number;
  };
  overall: number;
  passed: boolean;
  corrections: Array<{
    target: string;
    objectId?: string;
    description: string;
    priority: number;
  }>;
  raw: string;
  model?: string;
  /** VLM's natural language description of the render */
  description?: string;
  /** Cached calibration description (for AD comparison) */
  calibrationDescription?: string;
  /** Server-side match score */
  serverScore?: ServerScore;
  /** Single most important fix */
  topFix?: string;
  /** The full prompt sent to the VLM (for debugging) */
  promptSent?: string;
  /** The raw unprocessed VLM response text (for debugging) */
  vlmRawResponse?: string;
}

export interface VisionAnalysisResult {
  backend: VisionBackend;
  data: any;
  raw: string;
  model?: string;
  promptSent?: string;
  vlmRawResponse?: string;
}

/**
 * Determine if the otoy-studio vision backend is available.
 */
export function detectBackend(): VisionBackend {
  return extractOtoyStudioToken() ? 'otoy-studio' : 'self';
}

/**
 * Call analyse_image on a single image with a prompt.
 */
async function callVisionSingle(
  imagePath: string,
  prompt: string
): Promise<{
  text: string;
  backend: VisionBackend;
  model?: string;
  promptSent: string;
  vlmRawResponse: string;
}> {
  const token = extractOtoyStudioToken();
  if (!token) {
    return { text: '', backend: 'self', promptSent: prompt, vlmRawResponse: '' };
  }

  try {
    const result = await analyseImageFromFile(imagePath, 'ask', prompt, { token });
    return {
      text: result.text,
      backend: 'otoy-studio',
      model: result.model,
      promptSent: prompt,
      vlmRawResponse: result.text,
    };
  } catch (error: any) {
    mcpLog(`VISION: otoy-studio failed: ${error.message}`, 'warn');
    return { text: '', backend: 'self', promptSent: prompt, vlmRawResponse: '' };
  }
}

// ── Calibration ───────────────────────────────────────────────────────

/**
 * Calibrate concept art — run VLM composition questions on the reference image
 * and return a CachedCalibration for future comparisons.
 * Run once per scene, cache the result.
 */
export async function calibrateReference(
  imagePath: string
): Promise<{ calibration: CachedCalibration | null; promptSent: string; vlmRawResponse: string }> {
  const prompt = buildCalibrationPrompt();
  const { text, backend, model, promptSent, vlmRawResponse } = await callVisionSingle(
    imagePath,
    prompt
  );

  if (backend === 'self' || !text) {
    return { calibration: null, promptSent, vlmRawResponse };
  }

  // Extract keywords from the composition description
  const keywords = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .filter((w, i, arr) => arr.indexOf(w) === i); // dedupe

  const calibration: CachedCalibration = {
    composition: text,
    keywords,
    vlmModel: model || 'unknown',
    timestamp: Date.now(),
  };

  return { calibration, promptSent, vlmRawResponse };
}

// ── Critique ──────────────────────────────────────────────────────────

/**
 * Critique a render — 1 VLM call. Compares render description against
 * cached calibration server-side (keyword overlap + composition match).
 */
export async function critiqueRender(
  renderPath: string,
  critiquePrompt: string,
  calibration?: CachedCalibration
): Promise<VisionCritiqueResult | null> {
  const { text, backend, model, promptSent, vlmRawResponse } = await callVisionSingle(
    renderPath,
    critiquePrompt
  );

  if (backend === 'self' || !text) {
    return null;
  }

  // Parse VLM response for any structured data (scores, corrections)
  const parsed = parseCritiqueResponse(text);
  const description = parsed?.description || text;

  // Server-side scoring: compare render description against calibration
  let serverScore: ServerScore | undefined;
  if (calibration?.composition) {
    serverScore = computeServerScore(description, calibration.composition);
  }

  // Use parsed scores if available, otherwise default to 3
  const scores = parsed?.scores || {
    framing: 3,
    depth: 3,
    composition: 3,
    lighting: 3,
    placement: 3,
  };
  const enforced = enforceFramingGate(scores);

  return {
    backend,
    scores,
    overall: enforced.overall,
    passed: enforced.passed,
    corrections: parsed?.corrections || [],
    raw: parsed?.raw || text,
    model,
    description,
    calibrationDescription: calibration?.composition,
    serverScore,
    topFix: parsed?.topFix,
    promptSent,
    vlmRawResponse,
  };
}

// ── Reference Analysis ────────────────────────────────────────────────

/**
 * Analyze a reference image — extract structured scene data.
 * Separate from calibration: this extracts JSON for scene building,
 * calibration extracts natural language for comparison.
 */
export async function analyzeReference(
  imagePath: string,
  analysisPrompt: string
): Promise<VisionAnalysisResult | null> {
  const { text, backend, model, promptSent, vlmRawResponse } = await callVisionSingle(
    imagePath,
    analysisPrompt
  );

  if (backend === 'self' || !text) {
    return null;
  }

  // Try to parse as JSON
  let data: any = null;
  const candidates = [text];

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) candidates.push(jsonMatch[1]);

  const braceMatch = text.match(/\{[\s\S]*/);
  if (braceMatch) candidates.push(braceMatch[0]);

  for (const candidate of candidates) {
    if (data) break;
    try {
      data = JSON.parse(candidate);
    } catch {
      let repaired = candidate.trim().replace(/,\s*$/, '');
      const opens = (repaired.match(/\[/g) || []).length;
      const closes = (repaired.match(/\]/g) || []).length;
      const openBraces = (repaired.match(/\{/g) || []).length;
      const closeBraces = (repaired.match(/\}/g) || []).length;
      for (let i = 0; i < opens - closes; i++) repaired += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
      try {
        data = JSON.parse(repaired);
        mcpLog(`VISION: repaired truncated JSON`, 'info');
      } catch {
        /* truly unparseable */
      }
    }
  }

  return { backend, data, raw: text, model, promptSent, vlmRawResponse };
}
