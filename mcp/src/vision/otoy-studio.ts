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
        // Resolve ${ENV_VAR} placeholders from process.env
        const resolved = args[headerIdx + 1].replace(
          /\$\{(\w+)\}/g,
          (_, name) => process.env[name] || ''
        );
        const match = resolved.match(/Bearer\s+(\S+)/);
        if (match && match[1]) return match[1];
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
 * Uses the MCP JSON-RPC protocol to call request_upload_url, then PUTs the file.
 */
export async function uploadImage(filePath: string, token: string): Promise<UploadResult> {
  const filename = path.basename(filePath);

  // Step 1: Get upload URL via MCP JSON-RPC (same protocol as callAnalyseImage)
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
      params: { name: 'request_upload_url', arguments: { filename } },
      id: '1',
    }),
  });

  if (!resp.ok) {
    throw new Error(`Failed to get upload URL: ${resp.status} ${await resp.text()}`);
  }

  // Parse JSON-RPC response (may be SSE or plain JSON)
  let data: any = null;
  const contentType = resp.headers.get('content-type') || '';

  if (contentType.includes('text/event-stream')) {
    const body = await resp.text();
    for (const line of body.split('\n')) {
      if (line.startsWith('data:')) {
        try {
          const evt = JSON.parse(line.slice(5).trim());
          if (evt.result?.content) {
            const textContent = evt.result.content.find((c: any) => c.type === 'text');
            if (textContent) data = JSON.parse(textContent.text);
          }
        } catch {
          /* skip */
        }
      }
    }
  } else {
    const rpc = await resp.json();
    if (rpc.error)
      throw new Error(
        `request_upload_url RPC error: ${rpc.error.message || JSON.stringify(rpc.error)}`
      );
    const content = rpc.result?.content;
    if (Array.isArray(content)) {
      const textContent = content.find((c: any) => c.type === 'text');
      if (textContent) data = JSON.parse(textContent.text);
    }
  }

  if (!data) throw new Error('request_upload_url returned no data');

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
 * Call an MCP tool on the OTOY Studio worker via JSON-RPC.
 * Returns the text content from the response.
 */
async function callMcpTool(
  toolName: string,
  args: Record<string, string>,
  token: string
): Promise<string> {
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
      params: { name: toolName, arguments: args },
      id: '1',
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OTOY Studio ${toolName} ${resp.status}: ${errText.substring(0, 300)}`);
  }

  const contentType = resp.headers.get('content-type') || '';
  let text = '';

  if (contentType.includes('text/event-stream')) {
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
          /* skip */
        }
      }
    }
  } else {
    const data = await resp.json();
    if (data.error) {
      throw new Error(`${toolName} RPC error: ${data.error.message || JSON.stringify(data.error)}`);
    }
    const content = data.result?.content;
    if (Array.isArray(content)) {
      text = content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n');
    }
  }

  return text;
}

/**
 * Poll check_job until completion or timeout.
 * analyse_image is async — returns a requestId that needs polling.
 */
async function pollJob(
  requestId: string,
  token: string,
  timeoutMs: number = 90_000
): Promise<string> {
  const startMs = Date.now();
  const pollIntervalMs = 3000;

  // Initial wait before first poll
  await new Promise(r => setTimeout(r, 3000));

  while (Date.now() - startMs < timeoutMs) {
    const text = await callMcpTool('check_job', { request_id: requestId }, token);
    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      // Non-JSON response — might be the final text itself
      if (text && text.length > 20) return text;
      throw new Error(`check_job returned unparseable response: ${text.substring(0, 200)}`);
    }

    mcpLog(
      `VISION: poll ${requestId} status=${result.status} keys=${Object.keys(result).join(',')}`,
      'info'
    );

    if (result.status === 'completed') {
      // Vision results are in result.vision.answer or result.vision
      if (result.vision?.answer) return result.vision.answer;
      if (result.vision?.caption) return result.vision.caption;
      if (typeof result.vision === 'string') return result.vision;
      // Fallback: check for result/output at top level (some models return differently)
      if (result.result)
        return typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
      if (result.output)
        return typeof result.output === 'string' ? result.output : JSON.stringify(result.output);
      // Fallback: return the whole vision object as JSON
      if (result.vision) return JSON.stringify(result.vision);
      return text;
    }

    if (result.status === 'failed') {
      throw new Error(`Vision job failed: ${result.error || 'unknown error'}`);
    }

    // Still pending — wait and retry
    mcpLogLazy(
      'verbose',
      () =>
        `VISION: polling ${requestId} (${result.status}, elapsed ${Math.round((Date.now() - startMs) / 1000)}s)`
    );
    await new Promise(r => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`Vision job ${requestId} timed out after ${timeoutMs}ms`);
}

/**
 * Call analyse_image on the OTOY Studio worker via JSON-RPC.
 * Handles the async flow: submit → poll check_job → return result.
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

  const text = await callMcpTool('analyse_image', args, token);

  // Check if response is an async job ticket (contains requestId)
  let resultText = text;
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Not JSON — treat as direct result text
  }
  if (parsed?.requestId) {
    mcpLog(`VISION/otoy-studio: async job ${parsed.requestId}, polling…`, 'info');
    resultText = await pollJob(parsed.requestId, token);
  }

  const elapsed = Date.now() - startMs;
  mcpLog(
    `VISION/otoy-studio: analyse_image responded in ${elapsed}ms (${resultText.length} chars)`,
    'info'
  );

  return { text: resultText, model: options?.model || 'moondream3' };
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
