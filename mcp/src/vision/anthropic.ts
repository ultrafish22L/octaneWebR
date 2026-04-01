/**
 * Anthropic Vision Client — calls Claude's Messages API with base64 images.
 * Uses ANTHROPIC_CLAUDE_KEY env var. Zero npm dependencies (built-in fetch).
 */

import { mcpLog } from '../OctaneMcpClient';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

export interface AnthropicVisionResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Send one or two images to Claude for vision analysis.
 * Returns the text response.
 */
export async function callAnthropicVision(
  prompt: string,
  images: Array<{ base64: string; mediaType: string }>,
  options: {
    apiKey: string;
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
  }
): Promise<AnthropicVisionResult> {
  const model = options.model || 'claude-haiku-4-5-20251001';
  const maxTokens = options.maxTokens || 1500;

  const content: any[] = [];

  // Add images first
  for (const img of images) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType,
        data: img.base64,
      },
    });
  }

  // Add text prompt
  content.push({ type: 'text', text: prompt });

  const body: any = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content }],
  };

  if (options.systemPrompt) {
    body.system = options.systemPrompt;
  }

  mcpLog(`VISION/anthropic: calling ${model} with ${images.length} image(s)`, 'info');
  const startMs = Date.now();

  const MAX_RETRIES = 3;
  const RETRYABLE_STATUSES = [500, 502, 503, 529];
  let resp: Response | undefined;
  let lastError = '';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      mcpLog(
        `VISION/anthropic: retry ${attempt}/${MAX_RETRIES} after ${delayMs}ms (last: ${lastError})`,
        'warn'
      );
      await new Promise(r => setTimeout(r, delayMs));
    }

    resp = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': options.apiKey,
        'anthropic-version': API_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (resp.ok) break;

    lastError = `${resp.status}`;
    if (!RETRYABLE_STATUSES.includes(resp.status)) {
      const errorText = await resp.text();
      throw new Error(`Anthropic API ${resp.status}: ${errorText}`);
    }

    if (attempt === MAX_RETRIES) {
      const errorText = await resp.text();
      throw new Error(`Anthropic API ${resp.status} after ${MAX_RETRIES} retries: ${errorText}`);
    }
  }

  if (!resp || !resp.ok) {
    throw new Error(`Anthropic API failed after ${MAX_RETRIES} retries: ${lastError}`);
  }

  const data = await resp.json();
  const elapsed = Date.now() - startMs;

  if (data.type === 'error') {
    throw new Error(`Anthropic API error: ${data.error?.message || JSON.stringify(data)}`);
  }

  const text = data.content?.[0]?.text || '';
  const inputTokens = data.usage?.input_tokens || 0;
  const outputTokens = data.usage?.output_tokens || 0;

  mcpLog(
    `VISION/anthropic: ${model} responded in ${elapsed}ms (${inputTokens}+${outputTokens} tokens)`,
    'info'
  );

  return { text, model: data.model || model, inputTokens, outputTokens };
}

/**
 * Check if the Anthropic API key is available and valid.
 */
export function getAnthropicKey(): string | null {
  return process.env.ANTHROPIC_CLAUDE_KEY || process.env.ANTHROPIC_API_KEY || null;
}
