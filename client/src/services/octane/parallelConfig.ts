/**
 * Parallel Loading Configuration
 * Optimizes scene loading through concurrent API requests
 */

export const PARALLEL_CONFIG = {
  /**
   * Enable parallel scene loading
   * - true: Use parallel API requests for faster loading (3.7x speedup)
   * - false: Use sequential loading (slower but simpler)
   * 
   * Tested with 7424-node scenes: parallel loads in ~48s vs ~180s sequential
   */
  ENABLED: true,  // Default to faster mode (well-tested)
  
  /**
   * Maximum concurrent API requests
   * 
   * gRPC-Web uses HTTP/2 which multiplexes many requests over a single connection.
   * Unlike HTTP/1.1's 6-connection limit, HTTP/2 can handle 100+ concurrent requests.
   * 
   * Tested values:
   * - 100: 48s load time (recommended)
   * - 6: Much slower (outdated HTTP/1.1 thinking)
   * 
   * Increase for faster loading, decrease if you encounter resource errors.
   */
  MAX_CONCURRENT: 100,
  
  /**
   * Maximum recursion depth for scene tree
   * 
   * NOTE: This is a safety limit. The scene.map reservation system
   * already prevents duplicates and infinite loops, so this rarely triggers.
   * Set high to avoid artificial limits on deep scenes.
   */
  MAX_DEPTH: 65
};
