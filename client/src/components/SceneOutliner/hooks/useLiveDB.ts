/**
 * useLiveDB - LiveDB management
 * Handles loading and management of online material database
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Logger } from '../../../utils/Logger';
import { useOctane } from '../../../hooks/useOctane';
import { useStatusActions } from '../../../contexts/StatusMessageContext';

export interface LiveDBCategory {
  id: number;
  name: string;
  parentID: number;
  typeID: number;
  expanded: boolean;
  materials: LiveDBMaterial[];
  loaded: boolean;
}

export interface LiveDBMaterial {
  id: number;
  name: string;
  nickname: string;
  copyright: string;
  previewUrl?: string;
}

interface UseLiveDBProps {
  activeTab: string;
}

export function useLiveDB({ activeTab }: UseLiveDBProps) {
  const { client } = useOctane();
  const { setTemporaryStatus } = useStatusActions();
  const [liveDBCategories, setLiveDBCategories] = useState<LiveDBCategory[]>([]);
  const [liveDBLoading, setLiveDBLoading] = useState(false);

  // Track in-flight category fetches to prevent duplicate requests
  const loadingCategoriesRef = useRef(new Set<number>());

  // Load LiveDB categories
  const loadLiveDB = useCallback(async () => {
    if (!client) return;

    setLiveDBLoading(true);
    try {
      const rawCategories = await client.getLiveDBCategories();
      if (!rawCategories || rawCategories.length === 0) {
        Logger.warn('LiveDB not available or empty');
        setLiveDBCategories([]);
        return;
      }

      // Convert to LiveDBCategory format, showing only root-level categories (parentID === 0)
      const categories: LiveDBCategory[] = rawCategories
        .filter(cat => cat.parentID === 0)
        .map(cat => ({
          id: cat.id,
          name: cat.name,
          parentID: cat.parentID,
          typeID: cat.typeID,
          expanded: false,
          materials: [],
          loaded: false,
        }));

      setLiveDBCategories(categories);
      Logger.debug(
        `LiveDB loaded with ${categories.length} root categories (${rawCategories.length} total)`
      );
    } catch (error) {
      Logger.error('Failed to load LiveDB:', error);
      setLiveDBCategories([]);
    } finally {
      setLiveDBLoading(false);
    }
  }, [client]);

  // Toggle LiveDB category expansion and load materials if needed
  const handleLiveDBCategoryToggle = useCallback(
    async (category: LiveDBCategory) => {
      if (!client) return;

      let loadedMaterials: LiveDBMaterial[] | undefined;

      // If not loaded yet, load materials for this category
      if (!category.loaded && !category.expanded) {
        // Skip if already fetching this category (deduplication)
        if (loadingCategoriesRef.current.has(category.id)) return;
        loadingCategoriesRef.current.add(category.id);
        try {
          Logger.debug(`Loading materials for category: ${category.name}`);
          const materials = await client.getLiveDBMaterials(category.id);

          // Load preview thumbnails for first few materials (limit to avoid overwhelming the server)
          const materialsWithPreviews = await Promise.all(
            materials.slice(0, 10).map(async mat => {
              const preview = await client.getLiveDBMaterialPreview(mat.id, 128, 0);
              return { ...mat, previewUrl: preview || undefined };
            })
          );

          loadedMaterials = [...materialsWithPreviews, ...materials.slice(10)];
        } catch (error) {
          Logger.error(`Failed to load materials for category ${category.name}:`, error);
        } finally {
          loadingCategoriesRef.current.delete(category.id);
        }
      }

      // Toggle expanded state immutably
      setLiveDBCategories(prev =>
        prev.map(cat =>
          cat.id === category.id
            ? {
                ...cat,
                expanded: !cat.expanded,
                ...(loadedMaterials ? { materials: loadedMaterials, loaded: true } : {}),
              }
            : cat
        )
      );
    },
    [client]
  );

  // Handle LiveDB material download
  const handleLiveDBMaterialDownload = useCallback(
    async (material: LiveDBMaterial) => {
      if (!client) return;

      try {
        Logger.debug(`Downloading material: ${material.name}`);
        const materialHandle = await client.downloadLiveDBMaterial(material.id);
        if (materialHandle) {
          setTemporaryStatus(`Material "${material.name}" downloaded — see Node Graph`, 4000);
        } else {
          setTemporaryStatus(`Failed to download material "${material.name}"`, 4000);
        }
      } catch (error) {
        Logger.error('Failed to download material:', error);
        setTemporaryStatus(`Error downloading material: ${error}`, 4000);
      }
    },
    [client, setTemporaryStatus]
  );

  // Load LiveDB when Live DB tab becomes active
  useEffect(() => {
    if (activeTab === 'livedb' && liveDBCategories.length === 0 && !liveDBLoading && client) {
      loadLiveDB();
    }
  }, [activeTab, client, liveDBCategories.length, liveDBLoading, loadLiveDB]);

  return {
    liveDBCategories,
    liveDBLoading,
    loadLiveDB,
    handleLiveDBCategoryToggle,
    handleLiveDBMaterialDownload,
  };
}
