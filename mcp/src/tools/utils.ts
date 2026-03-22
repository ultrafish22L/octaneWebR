/**
 * Shared utilities for MCP tool modules.
 */

import path from 'path';

// ── File path validation ─────────────────────────────────────────────

/**
 * Validate a file path against OCTANE_FILE_ROOTS.
 * Returns null if valid, or an error message string if blocked.
 * Set OCTANE_FILE_ROOTS=* to allow all paths.
 */
export function validateFilePath(filePath: string): string | null {
  const rootsEnv = process.env.OCTANE_FILE_ROOTS || 'C:\\otoyla';
  const roots = rootsEnv.split(',').map(r => path.resolve(r.trim()));

  // Wildcard = unrestricted
  if (roots.length === 1 && roots[0] === path.resolve('*')) return null;

  const resolved = path.resolve(filePath);
  const allowed = roots.some(root => resolved.startsWith(root + path.sep) || resolved === root);
  if (!allowed) {
    return `Path "${filePath}" is outside allowed roots (${roots.join(', ')}). Set OCTANE_FILE_ROOTS env var to allow.`;
  }
  return null;
}

// ── Result helpers ───────────────────────────────────────────────────

export function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }],
    isError: true as const,
  };
}

// ── Handle validation gate ───────────────────────────────────────────

import type { SceneCache } from '../SceneCache';
import { mcpLog } from '../OctaneMcpClient';

/**
 * Validate a handle against the SceneCache before sending to Octane.
 * Returns an error result if the handle was never returned by any MCP tool,
 * or null if the handle is valid (caller should proceed).
 *
 * The error message starts with "GATED" so the AI immediately knows
 * the call was blocked before reaching Octane.
 * Logged at 'warn' level to log_mcp.log for false-positive investigation.
 */
export function gateHandle(
  toolName: string,
  handle: number,
  cache: SceneCache
): ReturnType<typeof errorResult> | null {
  const check = cache.validateHandle(handle);
  if (check.valid) return null;
  mcpLog(`GATE ${toolName} rejected handle ${handle}: ${check.reason}`, 'warn');
  return errorResult(`GATED — ${toolName} blocked before reaching Octane. ${check.reason}`);
}

// ── gRPC response extractors ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GrpcResponse = Record<string, any>;

/** Extract handle from gRPC response — tries result.handle, list.handle, handle, value.handle */
export function extractHandle(result: GrpcResponse): number | undefined {
  const h =
    result?.result?.handle ?? result?.list?.handle ?? result?.handle ?? result?.value?.handle;
  if (h === undefined || h === null || h === 0 || h === '0') return undefined;
  return Number(h);
}

/** Extract scalar value from gRPC response — tries result, value */
export function extractValue(result: GrpcResponse): unknown {
  return result?.result ?? result?.value ?? result;
}

// ── Octane ObjectType constants ──────────────────────────────────────
// Re-exported from shared constants for convenient tool-level imports.

export {
  OBJ_API_ITEM,
  OBJ_API_NODE,
  OBJ_API_NODE_GRAPH,
  OBJ_API_ITEM_ARRAY,
} from '../shared/OctaneConstants';
