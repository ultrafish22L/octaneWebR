/**
 * Request Queue - Limits concurrent API requests to prevent browser resource exhaustion
 * 
 * Browsers limit concurrent connections per domain to 6-10 connections.
 * When many React components mount simultaneously (e.g., 100+ NodeInspector parameters),
 * each tries to fetch data concurrently, causing ERR_INSUFFICIENT_RESOURCES errors.
 * 
 * This queue ensures we never exceed the browser's connection pool limit.
 */

export class RequestQueue {
  private queue: Array<() => Promise<void>> = [];
  private activeCount = 0;
  private readonly maxConcurrent: number;

  constructor(maxConcurrent = 6) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Add a request to the queue and execute when a slot is available
   * @param fn - Async function to execute
   * @returns Promise that resolves with the function's result
   */
  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task = async () => {
        try {
          this.activeCount++;
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeCount--;
          this.processQueue();
        }
      };

      this.queue.push(task);
      this.processQueue();
    });
  }

  private processQueue() {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        task();
      }
    }
  }

  /**
   * Get current queue stats for debugging
   */
  getStats() {
    return {
      active: this.activeCount,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent
    };
  }
}
