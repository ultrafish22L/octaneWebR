/**
 * Parallel Utilities - Helper functions for parallel/concurrent operations
 * Used to optimize scene loading by processing multiple API calls concurrently
 */

/**
 * Execute an array of tasks with a concurrency limit
 * Similar to Promise.all() but limits how many promises run simultaneously
 * 
 * @param items - Array of items to process
 * @param limit - Maximum number of concurrent operations
 * @param fn - Async function to execute for each item
 * @returns Promise that resolves to array of results (same order as input)
 * 
 * @example
 * const results = await parallelLimit(nodes, 6, async (node) => {
 *   return await fetchNodeData(node);
 * });
 */
export async function parallelLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let activeCount = 0;
  let index = 0;

  // Process items with concurrency limit
  const processNext = async (): Promise<void> => {
    if (index >= items.length) {
      return;
    }

    const currentIndex = index++;
    const item = items[currentIndex];
    
    activeCount++;
    
    try {
      results[currentIndex] = await fn(item, currentIndex);
    } catch (error) {
      // Store undefined for errors (matches original behavior where errors are caught by caller)
      results[currentIndex] = undefined as any;
    } finally {
      activeCount--;
      // Process next item after this one completes
      if (index < items.length) {
        await processNext();
      }
    }
  };

  // Start initial batch of concurrent operations
  const initialBatch = Array.from({ length: Math.min(limit, items.length) }, () => processNext());
  
  // Wait for all operations to complete
  await Promise.all(initialBatch);

  return results;
}

/**
 * Execute an array of tasks with a concurrency limit, returning settled results
 * Like parallelLimit but doesn't fail fast - all operations complete even if some fail
 * 
 * @param items - Array of items to process
 * @param limit - Maximum number of concurrent operations  
 * @param fn - Async function to execute for each item
 * @returns Promise that resolves to array of PromiseSettledResult
 * 
 * @example
 * const results = await parallelLimitSettled(nodes, 6, async (node) => {
 *   return await fetchNodeData(node);
 * });
 * const successful = results.filter(r => r.status === 'fulfilled');
 */
export async function parallelLimitSettled<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let index = 0;

  // Process items with concurrency limit
  const processNext = async (): Promise<void> => {
    if (index >= items.length) {
      return;
    }

    const currentIndex = index++;
    const item = items[currentIndex];
    
    try {
      const result = await fn(item, currentIndex);
      results[currentIndex] = { status: 'fulfilled', value: result };
    } catch (error) {
      results[currentIndex] = { status: 'rejected', reason: error };
    }
    
    // Process next item after this one completes
    if (index < items.length) {
      await processNext();
    }
  };

  // Start initial batch of concurrent operations
  const initialBatch = Array.from({ length: Math.min(limit, items.length) }, () => processNext());
  
  // Wait for all operations to complete
  await Promise.all(initialBatch);

  return results;
}
