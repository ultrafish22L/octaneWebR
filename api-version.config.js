/**
 * Centralized API Version Configuration
 *
 * This file is the SINGLE SOURCE OF TRUTH for API version settings.
 * Both client and server import from this file to ensure consistency.
 *
 * ⚠️  IMPORTANT: Only change API_VERSION below - DO NOT modify individual files!
 *
 * Uses CommonJS exports so both the Vite plugin and the Node.js server
 * (compiled to CJS by tsc) can require/import it without ESM/CJS conflicts.
 */

// ============================================================================
// API VERSION SELECTION
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
const API_VERSION = '2026.2';  // ⭐ CHANGE ONLY THIS LINE: '2026.2' | 'beta2' | 'alpha5'

// ============================================================================
// DERIVED FLAGS (Do not modify below)
// ============================================================================

const USE_ALPHA5_API = API_VERSION === 'alpha5';
const USE_BETA2_API = API_VERSION === 'beta2';
const IS_PASSTHROUGH = API_VERSION === '2026.2';

const getApiVersionName = () => {
  switch (API_VERSION) {
    case '2026.2': return '2026.2 (octaneServGrpc)';
    case 'beta2':  return 'Beta 2 (2026.1)';
    case 'alpha5': return 'Alpha 5 (2026.1)';
    default:       return API_VERSION;
  }
};

const getProtoDir = () => USE_ALPHA5_API ? 'proto_old' : 'proto';

module.exports = {
  API_VERSION,
  USE_ALPHA5_API,
  USE_BETA2_API,
  IS_PASSTHROUGH,
  getApiVersionName,
  getProtoDir,
};
