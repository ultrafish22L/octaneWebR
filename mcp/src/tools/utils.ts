/**
 * Shared utilities for MCP tool modules.
 */

import path from 'path';

// ── File path validation ─────────────────────────────────────────────

/**
 * Default root for OCTANE_FILE_ROOTS when the env var is unset.
 * Uses the user's home directory as a reasonable cross-platform default.
 */
const DEFAULT_FILE_ROOT = process.env.HOME || process.env.USERPROFILE || '.';

/**
 * Validate a file path against OCTANE_FILE_ROOTS.
 * Returns null if valid, or an error message string if blocked.
 *
 * OCTANE_FILE_ROOTS — comma-separated list of directory paths that MCP tools
 * are allowed to read from / write to. Should include your scenes directory
 * and any folder where renders, concept art, or meshes are stored.
 *
 *   Windows:  OCTANE_FILE_ROOTS=C:\otoyla,D:\assets
 *   macOS:    OCTANE_FILE_ROOTS=/Users/you/otoyla,/Volumes/renders
 *   Linux:    OCTANE_FILE_ROOTS=/home/you/otoyla
 *
 * Set OCTANE_FILE_ROOTS=* to disable path checking entirely (unrestricted).
 * When unset, defaults to the user's home directory.
 */
export function validateFilePath(filePath: string): string | null {
  const rootsEnv = process.env.OCTANE_FILE_ROOTS || DEFAULT_FILE_ROOT;
  const roots = rootsEnv.split(',').map(r => path.resolve(r.trim()));

  // Wildcard = unrestricted
  if (roots.length === 1 && roots[0] === path.resolve('*')) return null;

  const resolved = path.resolve(filePath);
  // Windows paths are case-insensitive — normalize for comparison
  const isWin = process.platform === 'win32';
  const norm = (p: string) => (isWin ? p.toLowerCase() : p);
  const allowed = roots.some(
    root => norm(resolved).startsWith(norm(root) + path.sep) || norm(resolved) === norm(root)
  );
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
