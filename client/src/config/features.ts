/**
 * Feature Flags Configuration
 *
 * Controls rollout of new features with progressive deployment strategy.
 * Set via environment variables in .env files.
 */

export const FEATURES = {
  /**
   * Progressive Scene Loading V3 (two-pass with per-pin emission)
   * Pass 1: Load level-1 nodes + immediate children, emit per pin
   * Pass 2: BFS deep-load queue for remaining children
   * Status: Active
   */
  PROGRESSIVE_LOADING_V3: import.meta.env.VITE_PROGRESSIVE_LOADING_V3 === 'true' || true,

  /**
   * Lazy attrInfo Loading
   * Only loads attribute info when node is selected
   * Reduces initial load time, loads on-demand
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
    console.log('Feature Flags Enabled:', enabled.join(', '));
  } else {
    console.log('All optimization features disabled (using baseline implementation)');
  }
}
