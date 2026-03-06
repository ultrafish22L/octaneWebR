/**
 * Request Queue - Limits concurrent API calls to prevent browser connection pool exhaustion
 *
 * Browser limits: ~6 concurrent connections per domain
 * Large scenes can trigger hundreds of simultaneous API calls, causing ERR_INSUFFICIENT_RESOURCES
 *
 * This queue ensures we never exceed the safe concurrent limit
 */

import { Logger } from './Logger';

type QueuedRequest = {
  fn: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

class RequestQueue {
  private queue: QueuedRequest[] = [];
  private activeCount = 0;
  private readonly maxConcurrent: number;

  constructor(maxConcurrent: number = 4) {
    // Use 4 instead of 6 to leave room for other UI requests
    this.maxConcurrent = maxConcurrent;
    Logger.debug(`RequestQueue initialized with max ${maxConcurrent} concurrent requests`);
  }

  /**
   * Add a request to the queue
   * Returns a promise that resolves when the request completes
   */
  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    // 0 = no queuing, execute immediately
    if (this.maxConcurrent === 0) return fn();

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    // If we're at max capacity or queue is empty, do nothing
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // Take next request from queue
    const request = this.queue.shift();
    if (!request) return;

    this.activeCount++;

    try {
      const result = await request.fn();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeCount--;
      // Process next request after this one completes
      this.processNext();
    }
  }

  /**
   * Get current queue stats
   */
  getStats() {
    return {
      active: this.activeCount,
      queued: this.queue.length,
      total: this.activeCount + this.queue.length,
    };
  }

  /**
   * Clear all pending requests
   */
  clear() {
    const cleared = this.queue.length;
    this.queue.forEach(req => req.reject(new Error('Queue cleared')));
    this.queue = [];
    Logger.debug(`Cleared ${cleared} pending requests from queue`);
  }
}

/** Max concurrent API requests. 0 = no queuing (unlimited).
 * Set to 4 to stay within browser's ~6 connection limit per domain,
 * leaving headroom for other UI requests (callbacks, scene tree, etc.). */
const MAX_CONCURRENT_REQUESTS = 4;

// Global singleton instance
export const requestQueue = new RequestQueue(MAX_CONCURRENT_REQUESTS);
