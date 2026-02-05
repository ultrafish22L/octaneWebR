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
  
  /**
   * Intelligent Caching Layer
   * Multi-tier cache (memory → session storage → IndexedDB)
   * Expected impact: 50-70% API call reduction
   * Status: Sprint 2 (planned)
   */
  CACHE_ENABLED: import.meta.env.VITE_CACHE_ENABLED === 'true' || false,
  
  /**
   * Optimistic Updates
   * Update UI immediately, send request in background
   * Expected impact: 10-20x faster perceived operations
   * Status: Sprint 3 (planned)
   */
  OPTIMISTIC_UPDATES: import.meta.env.VITE_OPTIMISTIC_UPDATES === 'true' || false,
  
  /**
   * Request Batching & Deduplication
   * Batch multiple requests, deduplicate identical ones
   * Expected impact: 50-70% network reduction
   * Status: Sprint 4 (planned)
   */
  REQUEST_BATCHING: import.meta.env.VITE_REQUEST_BATCHING === 'true' || false,
  
  /**
   * Delta Updates
   * Send only changes (not full scene)
   * Expected impact: 90% data reduction for updates
   * Status: Sprint 5 (planned)
   */
  DELTA_UPDATES: import.meta.env.VITE_DELTA_UPDATES === 'true' || false,
  
  /**
   * Parallel Request Pipeline
   * Fetch independent data simultaneously
   * Expected impact: 2-5x speedup
   * Status: Sprint 6 (planned)
   */
  PARALLEL_PIPELINE: import.meta.env.VITE_PARALLEL_PIPELINE === 'true' || false
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
