/**
 * Feature Flags Configuration
 * 
 * Controls rollout of new features with progressive deployment strategy.
 * Set via environment variables in .env files.
 * 
 * Sprint 1: Progressive Scene Loading feature flag
 * Created: 2025-02-03
 * Updated: 2025-02-11 - Added V2 progressive loading flags
 */

/**
 * Feature flags for progressive rollout
 */
export const FEATURES = {
  /**
   * Progressive Scene Loading V1 (original implementation)
   * Loads scene in stages (level 0 → pins → connections → deep nodes)
   * Uses fixed delays for visual feedback
   * Status: Deprecated - use V2 instead
   */
  PROGRESSIVE_LOADING: import.meta.env.VITE_PROGRESSIVE_LOADING === 'true' || false,

  /**
   * Progressive Scene Loading V2 (visibility-aware) - BROKEN, DO NOT USE
   * Status: Deprecated - breaks tree structure
   */
  PROGRESSIVE_LOADING_V2: import.meta.env.VITE_PROGRESSIVE_LOADING_V2 === 'true' || false,

  /**
   * Progressive Scene Loading V3 (correct tree structure)
   * Uses identical logic to SceneService, adds progressive events
   * Features:
   * - Correct parent-child tree structure (same as sync)
   * - Events emitted as nodes load for UI updates
   * - Yields to browser between nodes for responsive UI
   * Status: Active development
   */
  PROGRESSIVE_LOADING_V3: import.meta.env.VITE_PROGRESSIVE_LOADING_V3 === 'true' || false,

  /**
   * Lazy attrInfo Loading
   * Only loads attribute info when node is selected
   * Reduces initial load time, loads on-demand
   * Works with both sync and progressive loading
   */
  LAZY_ATTR_INFO: import.meta.env.VITE_LAZY_ATTR_INFO === 'true' || false,
};

/**
 * Check if any optimization features are enabled
 */
export function hasAnyOptimizations(): boolean {
  return Object.values(FEATURES).some(enabled => enabled === true);
}

/**
 * Get list of enabled features
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(FEATURES)
    .filter(([_, enabled]) => enabled === true)
    .map(([name]) => name);
}

/**
 * Log enabled features to console (for debugging)
 */
export function logFeatureFlags(): void {
  const enabled = getEnabledFeatures();
  if (enabled.length > 0) {
    console.log('🚩 Feature Flags Enabled:', enabled.join(', '));
  } else {
    console.log('🚩 All optimization features disabled (using baseline implementation)');
  }
}
