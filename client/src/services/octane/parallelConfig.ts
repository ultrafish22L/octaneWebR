/**
 * Parallel Loading Configuration
 * Simple on/off switch for parallel scene loading optimization
 */

export const PARALLEL_CONFIG = {
  /**
   * Enable parallel scene loading
   * - true: Use parallel API requests for faster loading (experimental)
   * - false: Use proven sequential loading (always works)
   * 
   * Toggle this if you encounter issues with parallel loading
   */
  ENABLED: false,  // Start with false for safety
  
  /**
   * Maximum concurrent API requests
   * Browser connection pool limit is typically 6 per domain
   * Going higher can cause ERR_INSUFFICIENT_RESOURCES
   */
  MAX_CONCURRENT: 6,
  
  /**
   * Maximum recursion depth for scene tree
   * Prevents infinite loops in circular graphs
   */
  MAX_DEPTH: 5
};
