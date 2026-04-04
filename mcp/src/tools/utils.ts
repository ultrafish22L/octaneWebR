/**
 * Shared utilities for MCP tool modules.
 */

import path from 'path';

// ── File path validation ─────────────────────────────────────────────

/**
 * Default root for OCTANE_FILE_ROOTS when the env var is unset.
 * Resolves CWD at startup to an absolute path so it's stable even if
 * something later changes the working directory.
 */
const DEFAULT_FILE_ROOT = path.resolve(process.cwd());

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
  const data: Record<string, unknown> = { error: msg };

  // Dino offline hint for gRPC connection failures
  if (isOfflineError(msg)) {
    data.offline_hint =
      '\uD83E\uDD95 Looks like Octane is offline. No endless runner here, but try: ' +
      'tasklist | grep octaneServGrpc';
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    isError: true as const,
  };
}

/** Detect gRPC UNAVAILABLE / DEADLINE_EXCEEDED errors indicating Octane is offline. */
function isOfflineError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('unavailable') ||
    lower.includes('deadline_exceeded') ||
    lower.includes('connect econnrefused') ||
    lower.includes('no connection') ||
    lower.includes('failed to connect')
  );
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

import { OBJ_API_NODE } from '../shared/OctaneConstants';

/**
 * Find a connected node by pin NAME (not index) on any node type.
 * Uses real gRPC calls: pinCount → pinNameIx(ix) → match → connectedNodeIx(ix).
 * Works across NT_GEO_OBJECT, NT_GEO_MESH, NT_GEO_PLACEMENT, etc.
 * Returns 0 if pin not found, nothing connected, or node doesn't exist.
 */
export async function getConnectedByPinName(
  client: { callMethod: (svc: string, method: string, params: any) => Promise<any> },
  handle: number,
  pinName: string
): Promise<number> {
  try {
    // Get pin count
    const countResult = await client.callMethod('ApiNode', 'pinCount', {
      objectPtr: { handle: String(handle), type: OBJ_API_NODE },
    });
    const count = Number(countResult?.result ?? 0);
    if (!count) return 0;

    // Iterate pins by index, check name
    for (let ix = 0; ix < count; ix++) {
      const nameResult = await client.callMethod('ApiNode', 'pinNameIx', {
        objectPtr: { handle: String(handle), type: OBJ_API_NODE },
        index: ix,
      });
      const name = nameResult?.result ?? '';
      if (name === pinName) {
        const connected = await client.callMethod('ApiNode', 'connectedNodeIx', {
          objectPtr: { handle: String(handle), type: OBJ_API_NODE },
          pinIx: ix,
          enterWrapperNode: true,
        });
        return Number(connected?.result?.handle ?? 0);
      }
    }
  } catch {
    // Node doesn't exist or query failed
  }
  return 0;
}
