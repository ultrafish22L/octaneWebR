/**
 * React Query Client Configuration
 * Optimized for Octane gRPC LiveLink API
 */

import { QueryClient } from '@tanstack/react-query';
import { Logger } from '../utils/Logger';

/**
 * Query Client with optimized defaults for Octane
 *
 * Configuration rationale:
 * - Longer stale times: Octane scene data doesn't change frequently
 * - Aggressive retries: gRPC connections can be flaky
 * - Background refetching: Keep data fresh during long render sessions
 * - Optimistic updates: Better perceived performance for parameter changes
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache configuration
      staleTime: 5 * 60 * 1000, // 5 minutes - Scene data is relatively stable
      gcTime: 10 * 60 * 1000, // 10 minutes - Keep unused data for this long (formerly cacheTime)

      // Retry configuration
      retry: 3, // Retry failed requests 3 times
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff

      // Refetch configuration
      refetchOnWindowFocus: true, // Refetch when user returns to window
      refetchOnReconnect: true, // Refetch when network reconnects
      refetchOnMount: true, // Refetch on component mount

      // Error handling
      throwOnError: false, // Don't throw errors, let ErrorBoundary catch them

      // Network mode
      networkMode: 'online', // Only run queries when online
    },
    mutations: {
      // Retry configuration for mutations (more conservative)
      retry: 1, // Only retry once for mutations
      retryDelay: 1000, // 1 second delay

      // Error handling
      throwOnError: false,

      // Network mode
      networkMode: 'online',

      // Callbacks
      onError: error => {
        Logger.error('Mutation failed:', error);
      },
    },
  },
});

/**
 * Query Keys
 * Centralized query key factory for type safety and consistency
 */
export const queryKeys = {
  // Scene queries
  scene: {
    all: ['scene'] as const,
    tree: () => [...queryKeys.scene.all, 'tree'] as const,
    node: (nodeId: string) => [...queryKeys.scene.all, 'node', nodeId] as const,
    parameters: (nodeId: string) => [...queryKeys.scene.node(nodeId), 'parameters'] as const,
  },

  // Material database queries
  materials: {
    all: ['materials'] as const,
    livedb: {
      all: () => [...queryKeys.materials.all, 'livedb'] as const,
      categories: () => [...queryKeys.materials.livedb.all(), 'categories'] as const,
      category: (categoryId: number) =>
        [...queryKeys.materials.livedb.all(), 'category', categoryId] as const,
    },
    localdb: {
      all: () => [...queryKeys.materials.all, 'localdb'] as const,
      categories: () => [...queryKeys.materials.localdb.all(), 'categories'] as const,
      category: (path: string) => [...queryKeys.materials.localdb.all(), 'category', path] as const,
    },
  },

  // Viewport queries
  viewport: {
    all: ['viewport'] as const,
    render: () => [...queryKeys.viewport.all, 'render'] as const,
    image: (timestamp: number) => [...queryKeys.viewport.render(), timestamp] as const,
  },

  // Connection status
  connection: {
    status: ['connection', 'status'] as const,
  },
};

/**
 * Query Options Presets
 * Common configurations for different query types
 */
export const queryOptions = {
  // Fast-changing data (viewport renders)
  realtime: {
    staleTime: 0,
    gcTime: 30 * 1000, // 30 seconds
    refetchInterval: 1000, // Poll every second
  },

  // Slow-changing data (scene tree)
  stable: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  },

  // User-initiated fetches (material downloads)
  onDemand: {
    staleTime: Infinity, // Never auto-refetch
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  },
};
