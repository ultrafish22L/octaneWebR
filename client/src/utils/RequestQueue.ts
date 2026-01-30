/**
 * Request Queue - Limits concurrent API calls to prevent browser connection pool exhaustion
 * 
 * Browser limits: ~6 concurrent connections per domain
 * Large scenes can trigger hundreds of simultaneous API calls, causing ERR_INSUFFICIENT_RESOURCES
 * 
 * This queue ensures we never exceed the safe concurrent limit
 */

import { Logger } from './Logger';

type QueuedRequest<T> = {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
};

class RequestQueue {
  private queue: QueuedRequest<any>[] = [];
  private activeCount = 0;
  private readonly maxConcurrent: number;

  constructor(maxConcurrent: number = 4) {
    // Use 4 instead of 6 to leave room for other UI requests
    this.maxConcurrent = maxConcurrent;
    Logger.debug(`🔄 RequestQueue initialized with max ${maxConcurrent} concurrent requests`);
  }

  /**
   * Add a request to the queue
   * Returns a promise that resolves when the request completes
   */
  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
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
      total: this.activeCount + this.queue.length
    };
  }

  /**
   * Clear all pending requests
   */
  clear() {
    const cleared = this.queue.length;
    this.queue.forEach(req => req.reject(new Error('Queue cleared')));
    this.queue = [];
    Logger.debug(`🧹 Cleared ${cleared} pending requests from queue`);
  }
}

// Global singleton instance
export const requestQueue = new RequestQueue(4);
