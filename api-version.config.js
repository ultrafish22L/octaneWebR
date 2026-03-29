/**
 * Centralized API Version Configuration
 *
 * Single source of truth for API version settings. Both client and server
 * import from this file to ensure consistency.
 *
 * Version is auto-detected at runtime from the octaneVersion response.
 * Default is '2026.2' (pass-through). Call setApiVersion() to switch.
 *
 * Uses CommonJS exports so both the Vite plugin and the Node.js server
 * (compiled to CJS by tsc) can require/import it without ESM/CJS conflicts.
 */

// ============================================================================
// API VERSION STATE (mutable — updated by auto-detection at runtime)
// ============================================================================

/**
 * Three compat levels:
 *
 *   '2026.2'  — Our server (octaneServGrpc). Pure pass-through. All protos use
 *               objectPtr. Zero transforms. Proto dir: proto/
 *
 *   'beta2'   — Team-provided Octane Beta 2 build. Uses combined apinodesystem.proto
 *               with item_ref in value get/set methods. Transforms: objectPtr→item_ref
 *               for 6 value methods. Proto dir: proto/
 *
 *   'alpha5'  — Team-provided Octane Alpha 5 build. Different method names, field
 *               names, proto structure. Full transform layer. Proto dir: proto_old/
 */

/** Mutable state — all consumers read from this object at call time. */
const apiVersionState = {
  API_VERSION: '2026.2',
  USE_ALPHA5_API: false,
  USE_BETA2_API: false,
  IS_PASSTHROUGH: true,
};

/**
 * Update API version at runtime. Called by auto-detection after first
 * octaneVersion query, or manually for testing.
 *
 * @param {string} version - '2026.2' | 'beta2' | 'alpha5'
 * @returns {{ changed: boolean, previousVersion: string }}
 */
function setApiVersion(version) {
  const prev = apiVersionState.API_VERSION;
  if (prev === version) return { changed: false, previousVersion: prev };

  apiVersionState.API_VERSION = version;
  apiVersionState.USE_ALPHA5_API = version === 'alpha5';
  apiVersionState.USE_BETA2_API = version === 'beta2';
  apiVersionState.IS_PASSTHROUGH = version === '2026.2';

  return { changed: true, previousVersion: prev };
}

/**
 * Detect API version from octaneVersion number.
 *
 * Known versions:
 *   15010000  → 2026.2 (octaneServGrpc)
 *   15000005  → 2026.1 Alpha 5
 *   15000001  → 2026.1 Beta 2 (estimated)
 *
 * Falls back to '2026.2' (pass-through) for unknown versions.
 *
 * @param {number} versionNumber - The numeric version from octaneVersion RPC
 * @param {string} [versionName] - Optional name string (e.g. "OctaneRender Studio+ 2026.2")
 * @returns {string} Detected API version: '2026.2' | 'beta2' | 'alpha5'
 */
function detectApiVersion(versionNumber, versionName) {
  // Name-based detection is most reliable
  if (versionName) {
    const lower = versionName.toLowerCase();
    if (lower.includes('alpha')) return 'alpha5';
    if (lower.includes('beta')) return 'beta2';
    if (lower.includes('2026.2')) return '2026.2';
  }

  // Number-based fallback
  if (versionNumber >= 15010000) return '2026.2';   // 2026.2+
  if (versionNumber >= 15000005) return 'alpha5';    // Alpha 5
  if (versionNumber >= 15000001) return 'beta2';     // Beta 1-4

  return '2026.2'; // Unknown → safest default (pass-through)
}

const getApiVersionName = () => {
  switch (apiVersionState.API_VERSION) {
    case '2026.2': return '2026.2 (octaneServGrpc)';
    case 'beta2':  return 'Beta 2 (2026.1)';
    case 'alpha5': return 'Alpha 5 (2026.1)';
    default:       return apiVersionState.API_VERSION;
  }
};

// Single source of truth: octaneServGrpc/proto/. No duplicate copies.
// OCTANE_PROTO_DIR override for packaged Electron builds where protos
// are in extraResources (e.g. resources/server/proto) not relative to repo.
const getProtoDir = () => process.env.OCTANE_PROTO_DIR || '../../octaneServGrpc/proto';

module.exports = {
  /** @deprecated Read from apiVersionState instead for runtime updates */
  get API_VERSION() { return apiVersionState.API_VERSION; },
  get USE_ALPHA5_API() { return apiVersionState.USE_ALPHA5_API; },
  get USE_BETA2_API() { return apiVersionState.USE_BETA2_API; },
  get IS_PASSTHROUGH() { return apiVersionState.IS_PASSTHROUGH; },
  getApiVersionName,
  getProtoDir,
  setApiVersion,
  detectApiVersion,
  apiVersionState,
};
