/**
 * VisionCritic — orchestrates vision calls for render critique via OTOY Studio.
 *
 * Single backend: otoy-studio analyse_image (moondream3 / florence-2 / llava-next).
 * Falls back to 'self' (prompt-only) when no OTOY Studio token is available.
 */

import path from 'path';
import { mcpLog } from '../OctaneMcpClient';
import {
  extractOtoyStudioToken,
  analyseImageFromFile,
  callAnalyseImage,
  uploadImage,
} from './otoy-studio';
import { parseCritiqueResponse } from './prompts';
import { PASS_THRESHOLD, MIN_DIMENSION_SCORE } from '../ArtDirectionState';

export type VisionBackend = 'otoy-studio' | 'self';

/**
 * Recompute overall score and passed flag server-side.
 * Enforces framing-gated weighted scoring regardless of VLM output.
 * Weights: framing×2, placement×1.5, composition×1.5, depth×1, lighting×1 (÷7)
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
  // Cap overall at 2.5 if framing is below 3
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
  observations?: string;
  differences?: string;
}

export interface VisionAnalysisResult {
  backend: VisionBackend;
  data: any; // parsed JSON from the vision model
  raw: string;
  model?: string;
}

/**
 * Determine if the otoy-studio vision backend is available.
 */
export function detectBackend(): VisionBackend {
  return extractOtoyStudioToken() ? 'otoy-studio' : 'self';
}

/**
 * Call analyse_image with a prompt on one or two image files.
 * For two images (render + reference), captions the reference and embeds
 * the description in the render's ask prompt.
 */
async function callVision(
  prompt: string,
  imagePaths: string[]
): Promise<{ text: string; backend: VisionBackend; model?: string }> {
  const token = extractOtoyStudioToken();
  if (!token) {
    return { text: '', backend: 'self' };
  }

  try {
    if (imagePaths.length === 2) {
      // Two images: render (0) + reference (1).
      // Caption the reference, then ask about the render with that context.
      const [renderPath, refPath] = imagePaths;

      // Upload both in parallel
      const [renderUpload, refUpload] = await Promise.all([
        uploadImage(renderPath, token),
        uploadImage(refPath, token),
      ]);

      const refUrl = refUpload.downloadUrlFull || refUpload.downloadUrl;
      const renderUrl = renderUpload.downloadUrlFull || renderUpload.downloadUrl;

      // Caption the reference
      const refCaption = await callAnalyseImage(refUrl, 'caption', 'detailed', { token });

      // Ask about the render with reference context
      const augmentedPrompt =
        `REFERENCE IMAGE DESCRIPTION:\n${refCaption.text}\n\n` +
        `Now evaluate the RENDER image against that reference.\n\n${prompt}`;

      const result = await callAnalyseImage(renderUrl, 'ask', augmentedPrompt, { token });
      return { text: result.text, backend: 'otoy-studio', model: result.model };
    }

    // Single image
    const result = await analyseImageFromFile(imagePaths[0], 'ask', prompt, { token });
    return { text: result.text, backend: 'otoy-studio', model: result.model };
  } catch (error: any) {
    mcpLog(`VISION: otoy-studio failed: ${error.message}`, 'warn');
    return { text: '', backend: 'self' };
  }
}

/**
 * Critique a render using analyse_image.
 * Returns structured scores or null if backend unavailable (caller falls back to self-critique).
 */
export async function critiqueRender(
  renderPath: string,
  critiquePrompt: string,
  refImagePath?: string
): Promise<VisionCritiqueResult | null> {
  const imagePaths = refImagePath ? [renderPath, refImagePath] : [renderPath];
  const prompt = refImagePath
    ? `Image 1 is a 3D RENDER. Image 2 is the REFERENCE target.\n\n${critiquePrompt}`
    : critiquePrompt;

  const { text, backend, model } = await callVision(prompt, imagePaths);

  if (backend === 'self' || !text) {
    return null; // Caller falls back to self-critique
  }

  const parsed = parseCritiqueResponse(text);
  if (!parsed) {
    mcpLog(
      `VISION: failed to parse otoy-studio response as JSON: ${text.substring(0, 200)}`,
      'warn'
    );
    // Return raw text so caller can still use it
    return {
      backend,
      scores: { framing: 3, depth: 3, composition: 3, lighting: 3, placement: 3 },
      overall: 3,
      passed: false,
      corrections: [],
      raw: text,
      model,
      observations: text.substring(0, 500),
    };
  }

  // Server-side enforcement: recompute overall/passed with framing-gate
  const enforced = enforceFramingGate(parsed.scores);

  return {
    backend,
    scores: parsed.scores,
    overall: enforced.overall,
    passed: enforced.passed,
    corrections: parsed.corrections || [],
    raw: parsed.raw,
    model,
    observations: (parsed as any).observations,
    differences: (parsed as any).differences,
  };
}

/**
 * Analyze a reference image using analyse_image.
 * Returns structured scene data or null if backend unavailable.
 */
export async function analyzeReference(
  imagePath: string,
  analysisPrompt: string
): Promise<VisionAnalysisResult | null> {
  const { text, backend, model } = await callVision(analysisPrompt, [imagePath]);

  if (backend === 'self' || !text) {
    return null;
  }

  // Try to parse as JSON — handles truncated responses from token limits
  let data: any = null;
  const candidates = [text];

  // Extract from markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) candidates.push(jsonMatch[1]);

  // Extract bare JSON object
  const braceMatch = text.match(/\{[\s\S]*/);
  if (braceMatch) candidates.push(braceMatch[0]);

  for (const candidate of candidates) {
    if (data) break;
    try {
      data = JSON.parse(candidate);
    } catch {
      // Try repairing truncated JSON by closing open brackets/braces
      let repaired = candidate.trim();
      repaired = repaired.replace(/,\s*$/, '');
      const opens = (repaired.match(/\[/g) || []).length;
      const closes = (repaired.match(/\]/g) || []).length;
      const openBraces = (repaired.match(/\{/g) || []).length;
      const closeBraces = (repaired.match(/\}/g) || []).length;
      for (let i = 0; i < opens - closes; i++) repaired += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
      try {
        data = JSON.parse(repaired);
        mcpLog(
          `VISION: repaired truncated JSON (added ${opens - closes} ] and ${openBraces - closeBraces} })`,
          'info'
        );
      } catch {
        /* truly unparseable */
      }
    }
  }

  return { backend, data, raw: text, model };
}
