/**
 * Centralized API Version Configuration
 *
 * This file is the SINGLE SOURCE OF TRUTH for API version settings.
 * Both client and server import from this file to ensure consistency.
 *
 * ⚠️  IMPORTANT: Only change the version here - DO NOT modify individual files!
 *
 * Uses CommonJS exports so both the Vite plugin and the Node.js server
 * (compiled to CJS by tsc) can require/import it without ESM/CJS conflicts.
 */

// ============================================================================
// API VERSION SELECTION
// ============================================================================

/**
 * Set to true to use Alpha 5 API (proto_old directory)
 * Set to false to use Beta 2 API (proto directory)
 *
 * This setting controls:
 * - Client-side method name transformation
 * - Client-side parameter transformation
 * - Server-side proto file loading directory
 * - Server-side service instantiation
 */
const USE_ALPHA5_API = true;  // ⭐ CHANGE ONLY THIS LINE

// ============================================================================
// EXPORTS (Do not modify below)
// ============================================================================

const getApiVersionName = () => USE_ALPHA5_API ? 'Alpha 5 (2026.1)' : 'Beta 2 (2026.1)';
const getProtoDir = () => USE_ALPHA5_API ? 'proto_old' : 'proto';

module.exports = {
  USE_ALPHA5_API,
  getApiVersionName,
  getProtoDir,
};
