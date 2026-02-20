/**
 * Feature Flags Configuration
 *
 * Controls rollout of new features with progressive deployment strategy.
 * Set via environment variables in .env files.
 */

export const FEATURES = {
  /**
   * Progressive Scene Loading P (single-pass with clean UI updates)
   * Uses the same simple sequential loading as SceneService but emits
   * clean incremental UI events at natural breakpoints (per level-1 node,
   * per completed subtree). No per-pin events, no two-pass, no flashing.
   * Status: Active
   */
  PROGRESSIVE_LOADING_P: import.meta.env.VITE_PROGRESSIVE_LOADING_P === 'true' || true,
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
