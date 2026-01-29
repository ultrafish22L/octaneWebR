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
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (let index = 0; index < items.length; index++) {
    const item = items[index];

    // Create promise for this item
    const promise = fn(item, index).then((result) => {
      results[index] = result;
    });

    // Add to executing pool
    executing.push(promise);

    // If we've hit the limit, wait for one to complete before continuing
    if (executing.length >= limit) {
      await Promise.race(executing);
      // Remove completed promises from executing array
      executing.splice(
        0,
        executing.findIndex((p) => p === promise) + 1
      );
    }
  }

  // Wait for all remaining promises
  await Promise.all(executing);

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
  const results: PromiseSettledResult<R>[] = [];
  const executing: Promise<void>[] = [];

  for (let index = 0; index < items.length; index++) {
    const item = items[index];

    // Create promise for this item that never rejects
    const promise = fn(item, index)
      .then((result) => {
        results[index] = { status: 'fulfilled', value: result };
      })
      .catch((error) => {
        results[index] = { status: 'rejected', reason: error };
      });

    // Add to executing pool
    executing.push(promise);

    // If we've hit the limit, wait for one to complete before continuing
    if (executing.length >= limit) {
      await Promise.race(executing);
      // Remove completed promises from executing array
      const completedIndex = executing.findIndex((p) => 
        results.some((r, i) => i < index && r !== undefined)
      );
      if (completedIndex !== -1) {
        executing.splice(0, 1);
      }
    }
  }

  // Wait for all remaining promises
  await Promise.all(executing);

  return results;
}
