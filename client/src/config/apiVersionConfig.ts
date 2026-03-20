/**
 * API Version Configuration — Client-side constants
 *
 * Version-specific constants injected by Vite at build time.
 * TO SWITCH API VERSIONS: Edit api-version.config.js at project root!
 *
 * The compatibility layer (method name translation, param transforms)
 * lives in OctaneGrpcClientBase.callMethod() — shared by both web UI and MCP.
 * All callers use Beta 2 method names; the base translates automatically.
 */

declare const __USE_ALPHA5_API__: boolean;
declare const __APP_VERSION__: string;
export const USE_ALPHA5_API = __USE_ALPHA5_API__;
export const APP_VERSION = __APP_VERSION__;

export function getApiVersion(): string {
  return USE_ALPHA5_API ? 'Alpha 5 (2026.1)' : 'Beta 2 (2026.1)';
}

export function isFeatureSupported(featureName: string): boolean {
  const alpha5UnsupportedFeatures: string[] = [];
  if (USE_ALPHA5_API) {
    return !alpha5UnsupportedFeatures.includes(featureName);
  }
  return true;
}
