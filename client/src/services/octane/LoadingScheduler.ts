/**
 * LoadingScheduler - Priority-based loading queue for V2 progressive loading
 * 
 * Features:
 * - Priority queue for visible items (load first)
 * - Background queue for non-visible items  
 * - Pause/resume for scroll handling
 * - Deduplication of pending items
 * - Concurrency limiting
 * 
 * Created: 2025-02-11
 */

import { Logger } from '../../utils/Logger';
import { LoadItem } from './types';

export class LoadingScheduler {
  // Priority queue (visible items - load first)
  private priorityQueue: LoadItem[] = [];
  
  // Background queue (non-visible items)
  private backgroundQueue: LoadItem[] = [];
  
  // Currently loading handles (for deduplication)
  private loadingSet: Set<number> = new Set();
  
  // Already loaded handles (for deduplication)
  private loadedSet: Set<number> = new Set();
  
  // Paused state
  private _isPaused: boolean = false;
  
  // Resume promise resolver
  private resumeResolver: (() => void) | null = null;
  
  // Stats
  private stats = {
    priorityProcessed: 0,
    backgroundProcessed: 0,
    duplicatesSkipped: 0,
  };

  constructor() {
    Logger.debug('📋 LoadingScheduler initialized');
  }

  /**
   * Add items to priority queue (visible items)
   * These are loaded before background items
   */
  prioritize(handles: number[], type: LoadItem['type'] = 'details'): void {
    const now = Date.now();
    let added = 0;
    
    for (const handle of handles) {
      if (this.shouldSkip(handle)) {
        this.stats.duplicatesSkipped++;
        continue;
      }
      
      // Check if already in priority queue
      const existsInPriority = this.priorityQueue.some(item => item.handle === handle && item.type === type);
      if (existsInPriority) {
        continue;
      }
      
      // Remove from background queue if present (promote to priority)
      const bgIndex = this.backgroundQueue.findIndex(item => item.handle === handle && item.type === type);
      if (bgIndex !== -1) {
        this.backgroundQueue.splice(bgIndex, 1);
      }
      
      this.priorityQueue.push({
        handle,
        priority: 'high',
        type,
        addedAt: now,
      });
      added++;
    }
    
    if (added > 0) {
      Logger.debug(`📋 Prioritized ${added} items for ${type} loading`);
    }
  }

  /**
   * Add items to background queue (non-visible items)
   * These are loaded after priority items
   */
  enqueue(handles: number[], type: LoadItem['type'] = 'details', priority: 'normal' | 'low' = 'normal'): void {
    const now = Date.now();
    let added = 0;
    
    for (const handle of handles) {
      if (this.shouldSkip(handle)) {
        this.stats.duplicatesSkipped++;
        continue;
      }
      
      // Skip if already in any queue
      const existsInPriority = this.priorityQueue.some(item => item.handle === handle && item.type === type);
      const existsInBackground = this.backgroundQueue.some(item => item.handle === handle && item.type === type);
      
      if (existsInPriority || existsInBackground) {
        continue;
      }
      
      this.backgroundQueue.push({
        handle,
        priority,
        type,
        addedAt: now,
      });
      added++;
    }
    
    if (added > 0) {
      Logger.debug(`📋 Enqueued ${added} items for background ${type} loading`);
    }
  }

  /**
   * Check if handle should be skipped (already loading or loaded)
   */
  private shouldSkip(handle: number): boolean {
    return this.loadingSet.has(handle) || this.loadedSet.has(handle);
  }

  /**
   * Get next item to load
   * Priority queue items take precedence
   */
  next(): LoadItem | null {
    // Priority queue first
    if (this.priorityQueue.length > 0) {
      const item = this.priorityQueue.shift()!;
      this.loadingSet.add(item.handle);
      this.stats.priorityProcessed++;
      return item;
    }
    
    // Background queue (if not paused)
    if (!this._isPaused && this.backgroundQueue.length > 0) {
      const item = this.backgroundQueue.shift()!;
      this.loadingSet.add(item.handle);
      this.stats.backgroundProcessed++;
      return item;
    }
    
    return null;
  }

  /**
   * Mark item as loaded
   */
  markLoaded(handle: number): void {
    this.loadingSet.delete(handle);
    this.loadedSet.add(handle);
  }

  /**
   * Mark item as failed (allow retry)
   */
  markFailed(handle: number): void {
    this.loadingSet.delete(handle);
    // Don't add to loadedSet - can be retried
  }

  /**
   * Pause background loading (on scroll)
   */
  pause(): void {
    if (!this._isPaused) {
      this._isPaused = true;
      Logger.debug('⏸️ LoadingScheduler paused');
    }
  }

  /**
   * Resume background loading
   */
  resume(): void {
    if (this._isPaused) {
      this._isPaused = false;
      Logger.debug('▶️ LoadingScheduler resumed');
      
      // Resolve any pending wait
      if (this.resumeResolver) {
        this.resumeResolver();
        this.resumeResolver = null;
      }
    }
  }

  /**
   * Wait for resume (async)
   */
  async waitForResume(): Promise<void> {
    if (!this._isPaused) return;
    
    return new Promise(resolve => {
      this.resumeResolver = resolve;
    });
  }

  /**
   * Clear all queues
   */
  clear(): void {
    this.priorityQueue = [];
    this.backgroundQueue = [];
    this.loadingSet.clear();
    this.loadedSet.clear();
    this._isPaused = false;
    this.resumeResolver = null;
    Logger.debug('🗑️ LoadingScheduler cleared');
  }

  /**
   * Get current state
   */
  get state() {
    return {
      priorityCount: this.priorityQueue.length,
      backgroundCount: this.backgroundQueue.length,
      loadingCount: this.loadingSet.size,
      loadedCount: this.loadedSet.size,
      isPaused: this._isPaused,
      stats: { ...this.stats },
    };
  }

  /**
   * Check if there's more work to do
   */
  get hasWork(): boolean {
    return this.priorityQueue.length > 0 || (!this._isPaused && this.backgroundQueue.length > 0);
  }

  /**
   * Check if priority queue has items
   */
  get hasPriorityWork(): boolean {
    return this.priorityQueue.length > 0;
  }

  /**
   * Check if paused
   */
  get isPaused(): boolean {
    return this._isPaused;
  }

  /**
   * Check if handle is already loaded
   */
  isLoaded(handle: number): boolean {
    return this.loadedSet.has(handle);
  }

  /**
   * Check if handle is currently loading
   */
  isLoading(handle: number): boolean {
    return this.loadingSet.has(handle);
  }

  /**
   * Get all pending handles (for debugging)
   */
  getPendingHandles(): number[] {
    return [
      ...this.priorityQueue.map(i => i.handle),
      ...this.backgroundQueue.map(i => i.handle),
    ];
  }
}
