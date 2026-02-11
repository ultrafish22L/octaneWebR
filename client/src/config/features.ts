/**
 * Feature Flags Configuration
 * 
 * Controls rollout of new features with progressive deployment strategy.
 * Set via environment variables in .env files.
 * 
 * Sprint 1: Progressive Scene Loading feature flag
 * Created: 2025-02-03
 */

/**
 * Feature flags for progressive rollout
 */
export const FEATURES = {
  /**
   * Progressive Scene Loading
   * Loads scene in stages (level 0 → pins → connections → deep nodes)
   * Expected impact: 10-60x faster perceived load time
   * Status: Sprint 1 implementation
   */
  PROGRESSIVE_LOADING: import.meta.env.VITE_PROGRESSIVE_LOADING === 'true' || false,


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
