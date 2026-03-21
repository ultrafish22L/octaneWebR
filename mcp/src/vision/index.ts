/**
 * VisionCritic — orchestrates external vision API calls for render critique.
 *
 * Fallback chain:
 *   1. Anthropic (ANTHOPIC_CLAUDE_KEY) — confirmed working, primary
 *   2. Gemini (GEMINI_API_KEY) — fallback when quota resets
 *   3. Self-critique fallback — returns prompt for Claude to answer (v1 behavior)
 */

import fs from 'fs';
import path from 'path';
import { mcpLog } from '../OctaneMcpClient';
import { callAnthropicVision, getAnthropicKey } from './anthropic';
import { callGeminiVision, getGeminiKey } from './gemini';
import { parseCritiqueResponse } from './prompts';

export type VisionBackend = 'anthropic' | 'gemini' | 'self';

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
 * Load an image file as base64 with mime type detection.
 */
function loadImageBase64(filePath: string): { base64: string; mediaType: string } {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Image not found: ${resolved}`);
  }
  const buffer = fs.readFileSync(resolved);
  const ext = path.extname(resolved).toLowerCase();
  const mediaType =
    ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : 'image/png';
  return { base64: buffer.toString('base64'), mediaType };
}

/**
 * Determine the best available vision backend.
 */
export function detectBackend(): VisionBackend {
  if (getAnthropicKey()) return 'anthropic';
  if (getGeminiKey()) return 'gemini';
  return 'self';
}

/**
 * Call a vision model with images and a prompt. Tries backends in fallback order.
 */
async function callVision(
  prompt: string,
  imagePaths: string[],
  preferredBackend?: VisionBackend,
  maxTokens?: number
): Promise<{ text: string; backend: VisionBackend; model?: string }> {
  const images = imagePaths.map(loadImageBase64);

  // Try preferred backend first, then fallback chain
  const backends: VisionBackend[] = preferredBackend
    ? [preferredBackend, 'anthropic', 'gemini']
    : ['anthropic', 'gemini'];
  const tried = new Set<VisionBackend>();

  for (const backend of backends) {
    if (tried.has(backend)) continue;
    tried.add(backend);

    try {
      if (backend === 'anthropic') {
        const key = getAnthropicKey();
        if (!key) continue;
        const result = await callAnthropicVision(prompt, images, {
          apiKey: key,
          model: process.env.VISION_MODEL || 'claude-haiku-4-5-20251001',
          maxTokens: maxTokens || 4000,
        });
        return { text: result.text, backend: 'anthropic', model: result.model };
      }

      if (backend === 'gemini') {
        const key = getGeminiKey();
        if (!key) continue;
        const result = await callGeminiVision(prompt, images, { apiKey: key });
        return { text: result.text, backend: 'gemini', model: result.model };
      }
    } catch (error: any) {
      mcpLog(`VISION: ${backend} failed: ${error.message}`, 'warn');
      // Continue to next backend
    }
  }

  // All backends failed — return empty for self-critique fallback
  return { text: '', backend: 'self' };
}

/**
 * Critique a render using an external vision model.
 * Returns structured scores or null if all backends fail (caller should fall back to self-critique).
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
      `VISION: failed to parse ${backend} response as JSON: ${text.substring(0, 200)}`,
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

  return {
    backend,
    scores: parsed.scores,
    overall: parsed.overall,
    passed: parsed.passed,
    corrections: parsed.corrections || [],
    raw: parsed.raw,
    model,
    observations: (parsed as any).observations,
    differences: (parsed as any).differences,
  };
}

/**
 * Analyze a reference image using an external vision model.
 * Returns structured scene data or null if all backends fail.
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
      // Remove trailing comma
      repaired = repaired.replace(/,\s*$/, '');
      // Count unclosed brackets
      const opens = (repaired.match(/\[/g) || []).length;
      const closes = (repaired.match(/\]/g) || []).length;
      const openBraces = (repaired.match(/\{/g) || []).length;
      const closeBraces = (repaired.match(/\}/g) || []).length;
      // Close unclosed structures
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
