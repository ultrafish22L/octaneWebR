/**
 * React Query hooks for Material Database operations
 * Replaces useState/useEffect patterns with declarative data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOctane } from './useOctane';
import { queryKeys, queryOptions } from '../lib/queryClient';
import { Logger } from '../utils/Logger';

// Type definitions
export interface MaterialCategory {
  id: number;
  name: string;
  description?: string;
}

export interface Material {
  id: number;
  name: string;
  preview?: string;
  description?: string;
}

export type DBType = 'livedb' | 'localdb';

/**
 * Fetch material categories from LiveDB or LocalDB
 *
 * @param dbType - Database type ('livedb' or 'localdb')
 * @param enabled - Whether the query should run (default: true)
 * @returns Query result with categories array
 *
 * @example
 * const { data: categories, isLoading, error } = useMaterialCategories('livedb');
 */
export function useMaterialCategories(dbType: DBType, enabled = true) {
  const { client, connected } = useOctane();

  return useQuery({
    queryKey:
      dbType === 'livedb'
        ? queryKeys.materials.livedb.categories()
        : queryKeys.materials.localdb.categories(),

    queryFn: async (): Promise<MaterialCategory[]> => {
      if (!client) {
        throw new Error('Octane client not initialized');
      }

      Logger.debug(`🗂️ Fetching ${dbType} categories via React Query...`);

      const response = await client.callApi('ApiDBMaterialManager', 'getCategories', {
        dbType: dbType === 'livedb' ? 0 : 1, // 0 = LiveDB, 1 = LocalDB
      });

      if (response?.categories) {
        Logger.debug(`✅ Fetched ${response.categories.length} ${dbType} categories`);
        return response.categories;
      }

      Logger.warn(`⚠️ No categories returned from ${dbType} API`);
      return [];
    },

    enabled: enabled && connected && !!client,
    ...queryOptions.stable, // Use stable query options (long cache time)

    // Error handling
    throwOnError: false,
    retry: 2, // Only retry twice for categories
  });
}

/**
 * Fetch materials for a specific category
 *
 * @param categoryId - Category ID to fetch materials from
 * @param dbType - Database type ('livedb' or 'localdb')
 * @param enabled - Whether the query should run (default: true)
 * @returns Query result with materials array
 *
 * @example
 * const { data: materials, isLoading } = useMaterialsForCategory(42, 'livedb');
 */
export function useMaterialsForCategory(categoryId: number | null, dbType: DBType, enabled = true) {
  const { client, connected } = useOctane();

  return useQuery({
    queryKey:
      dbType === 'livedb'
        ? queryKeys.materials.livedb.category(categoryId!)
        : queryKeys.materials.localdb.category(categoryId?.toString() || ''),

    queryFn: async (): Promise<Material[]> => {
      if (!client) {
        throw new Error('Octane client not initialized');
      }

      if (categoryId === null) {
        return [];
      }

      Logger.debug(`📦 Fetching materials for category ${categoryId} (${dbType})...`);

      const response = await client.callApi('ApiDBMaterialManager', 'getMaterials', {
        categoryId,
        dbType: dbType === 'livedb' ? 0 : 1,
      });

      if (response?.materials) {
        Logger.debug(`✅ Fetched ${response.materials.length} materials`);
        return response.materials;
      }

      Logger.warn('⚠️ No materials returned from API');
      return [];
    },

    enabled: enabled && connected && !!client && categoryId !== null,
    ...queryOptions.stable,

    throwOnError: false,
    retry: 2,
  });
}

/**
 * Download a material from the database (mutation)
 *
 * @returns Mutation object with downloadMaterial function
 *
 * @example
 * const downloadMaterial = useDownloadMaterial();
 * downloadMaterial.mutate({ materialId: 42, materialName: 'Chrome', dbType: 'livedb' });
 */
export function useDownloadMaterial() {
  const { client, connected } = useOctane();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      materialId,
      materialName,
      dbType,
    }: {
      materialId: number;
      materialName: string;
      dbType: DBType;
    }) => {
      if (!client) {
        throw new Error('Octane client not initialized');
      }

      if (!connected) {
        throw new Error('Not connected to Octane');
      }

      Logger.debug(`⬇️ Downloading material: ${materialName} (ID: ${materialId})`);

      await client.callApi('ApiDBMaterialManager', 'downloadMaterial', {
        materialId,
        dbType: dbType === 'livedb' ? 0 : 1,
      });

      Logger.debug(`✅ Material downloaded: ${materialName}`);

      return { materialId, materialName };
    },

    onSuccess: (_data, variables) => {
      Logger.debug(`✅ Download mutation success: ${variables.materialName}`);

      // Invalidate scene queries since a new material was added
      queryClient.invalidateQueries({ queryKey: queryKeys.scene.all });
    },

    onError: (error: any, variables) => {
      Logger.error(`❌ Failed to download material ${variables.materialName}:`, error);
    },
  });
}
