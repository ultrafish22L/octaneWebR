/**
 * OTOY Studio vision client — upload images + call analyse_image via the
 * OTOY Studio MCP worker. This is the sole vision backend for art direction.
 *
 * Flow: upload image to R2 → call analyse_image(url, task, prompt) → text response.
 * The worker proxies to fal.ai vision models (moondream3, florence-2, llava-next).
 */

import fs from 'fs';
import path from 'path';
import { mcpLog, mcpLogLazy } from '../OctaneMcpClient';

export interface UploadResult {
  uploadUrl: string;
  downloadUrl: string;
  uploadUrlFull: string;
  downloadUrlFull: string;
}

/**
 * Extract the OTOY Studio auth token from .mcp.json.
 * Returns the bearer token or null if not found.
 */
export function extractOtoyStudioToken(mcpJsonPath?: string): string | null {
  const searchPaths = mcpJsonPath
    ? [mcpJsonPath]
    : [
        path.resolve(process.cwd(), '.mcp.json'),
        path.resolve(process.cwd(), '..', '.mcp.json'),
        path.resolve(__dirname, '..', '..', '..', '.mcp.json'),
      ];

  for (const p of searchPaths) {
    try {
      if (!fs.existsSync(p)) continue;
      const content = JSON.parse(fs.readFileSync(p, 'utf-8'));
      const args: string[] = content?.mcpServers?.['otoy-studio']?.args;
      if (!args) continue;
      const headerIdx = args.indexOf('--header');
      if (headerIdx >= 0 && args[headerIdx + 1]) {
        const match = args[headerIdx + 1].match(/Bearer\s+(\S+)/);
        if (match) return match[1];
      }
    } catch (e: any) {
      mcpLogLazy('verbose', () => `[vision:otoy-studio:extractToken:${p}] ${e?.message ?? e}`);
      /* continue */
    }
  }
  return null;
}

const WORKER_BASE = 'https://otoy-studio-mcp.charlie-1e5.workers.dev';

/**
 * Upload an image file to OTOY Studio's R2 storage.
 * Returns both the proxy download URL and the full R2 signed URL.
 */
export async function uploadImage(filePath: string, token: string): Promise<UploadResult> {
  const filename = path.basename(filePath);

  // Step 1: Get upload URL via MCP proxy
  const resp = await fetch(`${WORKER_BASE}/s/upload?filename=${encodeURIComponent(filename)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    // Fallback: try the tool-style endpoint
    const resp2 = await fetch(
      `${WORKER_BASE}/upload-url?filename=${encodeURIComponent(filename)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!resp2.ok) {
      throw new Error(`Failed to get upload URL: ${resp2.status} ${await resp2.text()}`);
    }
    const data = await resp2.json();
    return parseUploadResponse(data, filePath, token);
  }

  const data = await resp.json();
  return parseUploadResponse(data, filePath, token);
}

async function parseUploadResponse(
  data: any,
  filePath: string,
  _token: string
): Promise<UploadResult> {
  const uploadUrl = data.upload_url_full || data.upload_url;
  const downloadUrl = data.download_url_full || data.download_url;

  if (!uploadUrl) {
    throw new Error(`No upload_url in response: ${JSON.stringify(data)}`);
  }

  // Step 2: PUT the file
  const imageBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : ext === '.png'
        ? 'image/png'
        : 'application/octet-stream';

  const putResp = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: imageBuffer,
  });

  if (!putResp.ok) {
    throw new Error(`Failed to upload image: PUT ${putResp.status}`);
  }

  mcpLog(`VISION: uploaded ${path.basename(filePath)} (${imageBuffer.length} bytes)`, 'info');

  return {
    uploadUrl: data.upload_url || uploadUrl,
    downloadUrl: data.download_url || downloadUrl,
    uploadUrlFull: uploadUrl,
    downloadUrlFull: downloadUrl,
  };
}

export interface AnalyseImageResult {
  text: string;
  model?: string;
}

/**
 * Call analyse_image on the OTOY Studio worker via Streamable HTTP (JSON-RPC).
 */
export async function callAnalyseImage(
  imageUrl: string,
  task: string,
  prompt?: string,
  options?: { token?: string; model?: string }
): Promise<AnalyseImageResult> {
  const token = options?.token || extractOtoyStudioToken();
  if (!token) throw new Error('No OTOY Studio token available');

  const args: Record<string, string> = { image_url: imageUrl, task };
  if (prompt) args.prompt = prompt;
  if (options?.model) args.model = options.model;

  mcpLog(
    `VISION/otoy-studio: analyse_image task=${task} url=${imageUrl.substring(0, 80)}…`,
    'info'
  );
  const startMs = Date.now();

  const resp = await fetch(`${WORKER_BASE}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'analyse_image', arguments: args },
      id: '1',
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OTOY Studio analyse_image ${resp.status}: ${errText.substring(0, 300)}`);
  }

  const contentType = resp.headers.get('content-type') || '';
  let text = '';

  if (contentType.includes('text/event-stream')) {
    // SSE response — parse event stream for the result
    const body = await resp.text();
    for (const line of body.split('\n')) {
      if (line.startsWith('data:')) {
        try {
          const evt = JSON.parse(line.slice(5).trim());
          if (evt.result?.content) {
            text = evt.result.content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('\n');
          }
        } catch {
          /* skip non-JSON lines */
        }
      }
    }
  } else {
    // JSON-RPC response
    const data = await resp.json();
    if (data.error) {
      throw new Error(
        `analyse_image RPC error: ${data.error.message || JSON.stringify(data.error)}`
      );
    }
    const content = data.result?.content;
    if (Array.isArray(content)) {
      text = content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n');
    }
  }

  const elapsed = Date.now() - startMs;
  mcpLog(
    `VISION/otoy-studio: analyse_image responded in ${elapsed}ms (${text.length} chars)`,
    'info'
  );

  return { text, model: options?.model || 'moondream3' };
}

/**
 * Upload a local file to R2 then call analyse_image.
 * Convenience wrapper for the common upload → analyse flow.
 */
export async function analyseImageFromFile(
  filePath: string,
  task: string,
  prompt?: string,
  options?: { token?: string; model?: string }
): Promise<AnalyseImageResult> {
  const token = options?.token || extractOtoyStudioToken();
  if (!token) throw new Error('No OTOY Studio token available');

  const uploaded = await uploadImage(filePath, token);
  const imageUrl = uploaded.downloadUrlFull || uploaded.downloadUrl;
  return callAnalyseImage(imageUrl, task, prompt, { ...options, token });
}
