/**
 * Shared utilities for MCP tool modules.
 */

// ── Result helpers ───────────────────────────────────────────────────

export function jsonResult(data: any) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(error: any) {
  return {
    content: [
      { type: 'text' as const, text: JSON.stringify({ error: String(error?.message || error) }) },
    ],
    isError: true as const,
  };
}

// ── gRPC response extractors ─────────────────────────────────────────

/** Extract handle from gRPC response — tries result.handle, list.handle, handle, value.handle */
export function extractHandle(result: any): number | undefined {
  const h =
    result?.result?.handle ?? result?.list?.handle ?? result?.handle ?? result?.value?.handle;
  if (h === undefined || h === null || h === 0 || h === '0') return undefined;
  return Number(h);
}

/** Extract scalar value from gRPC response — tries result, value */
export function extractValue(result: any): any {
  return result?.result ?? result?.value ?? result;
}

// ── Octane ObjectType constants ──────────────────────────────────────
// These match the ObjectType enum in OctaneTypes.ts. Used in objectPtr
// params for gRPC calls. Named constants prevent magic-number bugs.

export const OBJ_API_ITEM = 16;
export const OBJ_API_NODE = 17;
export const OBJ_API_NODE_GRAPH = 20;
export const OBJ_API_ITEM_ARRAY = 31;
