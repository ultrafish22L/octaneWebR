/**
 * Parallel Async Utilities
 * Utilities for controlled parallel async execution
 */

/**
 * Execute async functions in parallel with a concurrency limit
 * 
 * @param items - Array of items to process
 * @param limit - Maximum number of concurrent executions
 * @param fn - Async function to execute for each item
 * @returns Promise resolving to array of results
 * 
 * @example
 * const nodes = [1, 2, 3, 4, 5];
 * const results = await parallelLimit(nodes, 2, async (id) => {
 *   return await fetchNode(id);
 * });
 */
export async function parallelLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const executing: Promise<void>[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    const promise = fn(item, i)
      .then(result => {
        results[i] = result;
      })
      .finally(() => {
        executing.splice(executing.indexOf(promise), 1);
      });
    
    executing.push(promise);
    
    // If we've hit the concurrency limit, wait for one to finish
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  
  // Wait for all remaining promises
  await Promise.all(executing);
  
  return results;
}

/**
 * Execute async functions in parallel with error resilience
 * Uses Promise.allSettled to handle failures gracefully
 * 
 * @param items - Array of items to process
 * @param limit - Maximum number of concurrent executions
 * @param fn - Async function to execute for each item
 * @returns Promise resolving to array of settled results
 * 
 * @example
 * const results = await parallelLimitSettled(nodes, 50, async (node) => {
 *   return await fetchNode(node);
 * });
 * 
 * results.forEach((result, i) => {
 *   if (result.status === 'fulfilled') {
 *     console.log('Success:', result.value);
 *   } else {
 *     console.error('Failed:', result.reason);
 *   }
 * });
 */
export async function parallelLimitSettled<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  const executing: Promise<void>[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    const promise = Promise.resolve()
      .then(() => fn(item, i))
      .then(
        value => {
          results[i] = { status: 'fulfilled', value };
        },
        reason => {
          results[i] = { status: 'rejected', reason };
        }
      )
      .finally(() => {
        executing.splice(executing.indexOf(promise), 1);
      });
    
    executing.push(promise);
    
    // If we've hit the concurrency limit, wait for one to finish
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  
  // Wait for all remaining promises
  await Promise.all(executing);
  
  return results;
}

/**
 * Batch items into chunks and process each chunk in parallel
 * 
 * @param items - Array of items to process
 * @param batchSize - Number of items per batch
 * @param fn - Async function to execute for each batch
 * @returns Promise resolving to flattened array of results
 * 
 * @example
 * const results = await batchProcess(nodes, 10, async (batch) => {
 *   return await Promise.all(batch.map(fetchNode));
 * });
 */
export async function batchProcess<T, R>(
  items: T[],
  batchSize: number,
  fn: (batch: T[], batchIndex: number) => Promise<R[]>
): Promise<R[]> {
  const batches: T[][] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  
  const batchResults = await Promise.all(
    batches.map((batch, index) => fn(batch, index))
  );
  
  return batchResults.flat();
}

/**
 * Configuration for parallel async operations
 */
export interface ParallelConfig {
  /** Maximum concurrent operations (default: 50) */
  concurrency?: number;
  /** Whether to use error-resilient mode (default: true) */
  resilient?: boolean;
  /** Timeout for each operation in ms (default: none) */
  timeout?: number;
}

/**
 * Default parallel execution configuration
 */
export const DEFAULT_PARALLEL_CONFIG: Required<ParallelConfig> = {
  concurrency: 50,
  resilient: true,
  timeout: 0
};

/**
 * Execute array of promises with configuration
 * 
 * @param promises - Array of promise-returning functions
 * @param config - Configuration for parallel execution
 * @returns Promise resolving to array of results (or settled results if resilient)
 */
export async function executeParallel<R>(
  promises: (() => Promise<R>)[],
  config: ParallelConfig = {}
): Promise<(R | PromiseSettledResult<R>)[]> {
  const { concurrency, resilient, timeout } = { ...DEFAULT_PARALLEL_CONFIG, ...config };
  
  const wrapWithTimeout = (fn: () => Promise<R>): Promise<R> => {
    if (timeout === 0) {
      return fn();
    }
    
    return Promise.race([
      fn(),
      new Promise<R>((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
      )
    ]);
  };
  
  if (resilient) {
    return parallelLimitSettled(promises, concurrency, (fn) => wrapWithTimeout(fn));
  } else {
    return parallelLimit(promises, concurrency, (fn) => wrapWithTimeout(fn));
  }
}
