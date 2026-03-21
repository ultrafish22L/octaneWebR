/**
 * OTOY Studio vision client — upload images + call vision models via the OTOY Studio MCP proxy.
 *
 * Architecture: The OTOY Studio MCP worker proxies to fal.ai. We use the
 * worker's upload endpoint for images, then call chat_completion with the
 * image URL embedded in the prompt. Since chat_completion is text-only,
 * this serves as a "describe what's at this URL" approach.
 *
 * When OTOY Studio adds native vision support to chat_completion (image_url param),
 * this module can switch to that with zero architecture changes.
 *
 * For now, the primary value is the upload pipeline — the actual vision analysis
 * can be done by direct API calls (Anthropic/OpenAI) or Claude self-critique.
 */

import fs from 'fs';
import path from 'path';
import { mcpLog } from '../OctaneMcpClient';

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
    } catch {
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
