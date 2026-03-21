/**
 * Gemini Vision Client — calls Google's generateContent API with base64 images.
 * Uses GEMINI_API_KEY env var. Zero npm dependencies (built-in fetch).
 */

import { mcpLog } from '../OctaneMcpClient';

export interface GeminiVisionResult {
  text: string;
  model: string;
}

/**
 * Send one or two images to Gemini for vision analysis.
 */
export async function callGeminiVision(
  prompt: string,
  images: Array<{ base64: string; mediaType: string }>,
  options: {
    apiKey: string;
    model?: string;
  }
): Promise<GeminiVisionResult> {
  const model = options.model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${options.apiKey}`;

  const parts: any[] = [{ text: prompt }];
  for (const img of images) {
    parts.push({ inline_data: { mime_type: img.mediaType, data: img.base64 } });
  }

  mcpLog(`VISION/gemini: calling ${model} with ${images.length} image(s)`, 'info');
  const startMs = Date.now();

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`Gemini API ${resp.status}: ${errorText.substring(0, 300)}`);
  }

  const data = await resp.json();
  const elapsed = Date.now() - startMs;

  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  mcpLog(`VISION/gemini: ${model} responded in ${elapsed}ms`, 'info');

  return { text, model };
}

export function getGeminiKey(): string | null {
  return process.env.GEMINI_API_KEY || null;
}
