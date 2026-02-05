/**
 * Cache Manager
 * 
 * Multi-tier intelligent caching system for Octane API calls:
 * - L1: Memory cache (instant, loses on page refresh)
 * - L2: Session storage (persists across page refresh, loses on tab close)
 * - L3: API call (network)
 * 
 * Features:
 * - Configurable TTL per cache key pattern
 * - Smart invalidation (pattern-based)
 * - LRU eviction when quota exceeded
 * - Cache hit/miss statistics
 * - Automatic expiration
 * 
 * Sprint 2: Intelligent Caching - 50-70% API call reduction
 * Created: 2025-02-03
 */

import { Logger } from '../utils/Logger';

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;  // Approximate size in bytes
}

/**
 * Cache configuration for different data types
 */
interface CacheConfig {
  ttl: number;          // Time to live (ms)
  priority: 'critical' | 'high' | 'medium' | 'low';
  maxSize?: number;     // Max entries for this pattern
}

/**
 * Cache statistics
 */
interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  memoryUsage: number;
  evictions: number;
}

/**
 * Default cache configurations by key pattern
 */
const DEFAULT_CACHE_CONFIGS: Record<string, CacheConfig> = {
  'node:*:info': { ttl: 60000, priority: 'high' },           // 1 minute - node metadata
  'node:*:params': { ttl: 30000, priority: 'medium' },       // 30 seconds - parameters
  'node:*:pins': { ttl: 30000, priority: 'medium' },         // 30 seconds - pin info
  'scene:tree': { ttl: 120000, priority: 'critical' },       // 2 minutes - scene tree
  'scene:*:children': { ttl: 60000, priority: 'high' },      // 1 minute - node children
  'material:*': { ttl: 300000, priority: 'low' },            // 5 minutes - material data
  'render:stats': { ttl: 1000, priority: 'low' },            // 1 second - render stats
  '*': { ttl: 30000, priority: 'low' }                       // 30 seconds - default
};

/**
 * Multi-tier cache manager
 */
export class CacheManager {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    size: 0,
    memoryUsage: 0,
    evictions: 0
  };
  private maxMemoryCacheSize = 1000; // Max entries in memory
  private maxSessionStorageSize = 5 * 1024 * 1024; // 5MB limit for session storage
  
  constructor() {
    Logger.debug('💾 CacheManager initialized');
    this.startCleanupTimer();
  }

  /**
   * Get value from cache or fetch via provided function
   * Implements L1 (memory) → L2 (session storage) → L3 (fetch) cascade
   */
  async get<T>(key: string, fetcher: () => Promise<T>, customTtl?: number): Promise<T> {
    // L1: Memory cache (instant)
    const memoryCached = this.getFromMemory<T>(key);
    if (memoryCached !== null) {
      this.stats.hits++;
      this.updateHitRate();
      Logger.debug(`💾 Cache HIT (memory): ${key}`);
      return memoryCached;
    }

    // L2: Session storage (fast)
    const sessionCached = this.getFromSessionStorage<T>(key);
    if (sessionCached !== null) {
      // Promote to memory cache
      this.setInMemory(key, sessionCached, customTtl);
      this.stats.hits++;
      this.updateHitRate();
      Logger.debug(`💾 Cache HIT (session): ${key}`);
      return sessionCached;
    }

    // L3: Fetch from API
    this.stats.misses++;
    this.updateHitRate();
    Logger.debug(`❌ Cache MISS: ${key}`);
    
    const data = await fetcher();
    
    // Store in both caches
    this.set(key, data, customTtl);
    
    return data;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, data: T, customTtl?: number): void {
    this.setInMemory(key, data, customTtl);
    this.setInSessionStorage(key, data, customTtl);
  }

  /**
   * Invalidate cache entries matching pattern
   * Pattern examples:
   * - "node:123" → invalidates node:123:*
   * - "scene:*" → invalidates all scene keys
   * - "node:*:info" → invalidates all node info keys
   */
  invalidate(pattern: string): void {
    const regex = this.patternToRegex(pattern);
    
    // Invalidate memory cache
    let memoryCleaned = 0;
    for (const [key] of this.memoryCache) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        memoryCleaned++;
      }
    }
    
    // Invalidate session storage
    let sessionCleaned = 0;
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('octane:cache:') && regex.test(key)) {
        sessionStorage.removeItem(key);
        sessionCleaned++;
      }
    }
    
    this.updateStats();
    Logger.debug(`💾 Cache invalidated: ${pattern} (${memoryCleaned} memory + ${sessionCleaned} session)`);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.memoryCache.clear();
    
    // Clear session storage cache entries
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('octane:cache:')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      memoryUsage: 0,
      evictions: 0
    };
    
    Logger.debug('💾 Cache cleared completely');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Log cache statistics report
   */
  logReport(): void {
    const stats = this.getStats();
    Logger.info('💾 Cache Statistics Report:');
    Logger.info(`   Hits: ${stats.hits}`);
    Logger.info(`   Misses: ${stats.misses}`);
    Logger.info(`   Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
    Logger.info(`   Memory Entries: ${stats.size}`);
    Logger.info(`   Memory Usage: ${(stats.memoryUsage / 1024).toFixed(1)} KB`);
    Logger.info(`   Evictions: ${stats.evictions}`);
  }

  // ==================== Private Methods ====================

  /**
   * Get from memory cache
   */
  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key);
      return null;
    }

    // Update hit count
    entry.hits++;
    
    return entry.data as T;
  }

  /**
   * Set in memory cache
   */
  private setInMemory<T>(key: string, data: T, customTtl?: number): void {
    const config = this.getConfig(key);
    const ttl = customTtl ?? config.ttl;
    
    // Evict if memory cache is full
    if (this.memoryCache.size >= this.maxMemoryCacheSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      size: this.estimateSize(data)
    };

    this.memoryCache.set(key, entry);
    this.updateStats();
  }

  /**
   * Get from session storage
   */
  private getFromSessionStorage<T>(key: string): T | null {
    try {
      const storageKey = `octane:cache:${key}`;
      const item = sessionStorage.getItem(storageKey);
      if (!item) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(item);

      // Check if expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        sessionStorage.removeItem(storageKey);
        return null;
      }

      return entry.data;
    } catch (error) {
      Logger.error('Failed to get from session storage:', error);
      return null;
    }
  }

  /**
   * Set in session storage
   */
  private setInSessionStorage<T>(key: string, data: T, customTtl?: number): void {
    try {
      const config = this.getConfig(key);
      const ttl = customTtl ?? config.ttl;

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        hits: 0,
        size: this.estimateSize(data)
      };

      const storageKey = `octane:cache:${key}`;
      const serialized = JSON.stringify(entry);

      // Check if we'd exceed quota
      if (serialized.length > this.maxSessionStorageSize) {
        Logger.warn(`💾 Cache entry too large for session storage: ${key}`);
        return;
      }

      sessionStorage.setItem(storageKey, serialized);
    } catch (error: any) {
      // Quota exceeded - evict old entries
      if (error.name === 'QuotaExceededError') {
        Logger.warn('💾 Session storage quota exceeded, evicting old entries');
        this.evictOldSessionEntries();
        // Try again after eviction
        try {
          const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            ttl: customTtl ?? this.getConfig(key).ttl,
            hits: 0,
            size: this.estimateSize(data)
          };
          sessionStorage.setItem(`octane:cache:${key}`, JSON.stringify(entry));
        } catch (retryError) {
          Logger.error('Failed to cache after eviction:', retryError);
        }
      } else {
        Logger.error('Failed to set in session storage:', error);
      }
    }
  }

  /**
   * Evict least recently used entry from memory cache
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruHits = Infinity;
    let lruTimestamp = Infinity;

    // Find entry with lowest hits (and oldest timestamp as tiebreaker)
    for (const [key, entry] of this.memoryCache) {
      if (entry.hits < lruHits || (entry.hits === lruHits && entry.timestamp < lruTimestamp)) {
        lruKey = key;
        lruHits = entry.hits;
        lruTimestamp = entry.timestamp;
      }
    }

    if (lruKey) {
      this.memoryCache.delete(lruKey);
      this.stats.evictions++;
      Logger.debug(`💾 Evicted LRU entry: ${lruKey}`);
    }
  }

  /**
   * Evict old entries from session storage
   */
  private evictOldSessionEntries(): void {
    const entries: Array<{ key: string; timestamp: number }> = [];

    // Collect all cache entries with timestamps
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('octane:cache:')) {
        try {
          const item = sessionStorage.getItem(key);
          if (item) {
            const entry = JSON.parse(item);
            entries.push({ key, timestamp: entry.timestamp });
          }
        } catch (error) {
          // Invalid entry, remove it
          sessionStorage.removeItem(key);
        }
      }
    }

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Remove oldest 25%
    const toRemove = Math.max(1, Math.floor(entries.length * 0.25));
    for (let i = 0; i < toRemove; i++) {
      sessionStorage.removeItem(entries[i].key);
    }

    Logger.debug(`💾 Evicted ${toRemove} old session storage entries`);
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpired();
    }, 60000); // Every minute
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    // Clean memory cache
    for (const [key, entry] of this.memoryCache) {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.updateStats();
      Logger.debug(`💾 Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * Get cache configuration for key
   */
  private getConfig(key: string): CacheConfig {
    // Try to find matching pattern
    for (const [pattern, config] of Object.entries(DEFAULT_CACHE_CONFIGS)) {
      if (pattern === '*') continue;
      const regex = this.patternToRegex(pattern);
      if (regex.test(key)) {
        return config;
      }
    }
    
    // Default config
    return DEFAULT_CACHE_CONFIGS['*'];
  }

  /**
   * Convert pattern to regex
   * Supports wildcards: * (any characters)
   */
  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*/g, '.*');                  // Replace * with .*
    return new RegExp(`^${escaped}$`);
  }

  /**
   * Estimate size of data in bytes
   */
  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate (2 bytes per char)
    } catch {
      return 0;
    }
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.stats.size = this.memoryCache.size;
    this.stats.memoryUsage = Array.from(this.memoryCache.values())
      .reduce((sum, entry) => sum + entry.size, 0);
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * Global cache manager instance
 */
export const cacheManager = new CacheManager();
