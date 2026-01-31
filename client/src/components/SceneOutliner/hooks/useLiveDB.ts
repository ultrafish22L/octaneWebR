/**
 * useLiveDB - LiveDB management
 * Handles loading and management of online material database
 */

import { useState, useEffect, useCallback } from 'react';
import { Logger } from '../../../utils/Logger';
import { useOctane } from '../../../hooks/useOctane';

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
  const [liveDBCategories, setLiveDBCategories] = useState<LiveDBCategory[]>([]);
  const [liveDBLoading, setLiveDBLoading] = useState(false);

  // Load LiveDB categories
  const loadLiveDB = useCallback(async () => {
    if (!client) return;

    setLiveDBLoading(true);
    try {
      const rawCategories = await client.getLiveDBCategories();
      if (!rawCategories || rawCategories.length === 0) {
        Logger.warn('⚠️ LiveDB not available or empty');
        setLiveDBCategories([]);
        return;
      }

      // Convert to LiveDBCategory format
      const categories: LiveDBCategory[] = rawCategories.map(cat => ({
        id: cat.id,
        name: cat.name,
        parentID: cat.parentID,
        typeID: cat.typeID,
        expanded: false,
        materials: [],
        loaded: false,
      }));

      setLiveDBCategories(categories);
      Logger.debug(`✅ LiveDB loaded with ${categories.length} categories`);
    } catch (error) {
      Logger.error('❌ Failed to load LiveDB:', error);
      setLiveDBCategories([]);
    } finally {
      setLiveDBLoading(false);
    }
  }, [client]);

  // Toggle LiveDB category expansion and load materials if needed
  const handleLiveDBCategoryToggle = useCallback(
    async (category: LiveDBCategory) => {
      if (!client) return;

      // If not loaded yet, load materials for this category
      if (!category.loaded && !category.expanded) {
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

          // Update the category
          category.materials = [...materialsWithPreviews, ...materials.slice(10)];
          category.loaded = true;
        } catch (error) {
          Logger.error(`❌ Failed to load materials for category ${category.name}:`, error);
        }
      }

      // Toggle expanded state
      category.expanded = !category.expanded;
      setLiveDBCategories([...liveDBCategories]); // Force re-render
    },
    [client, liveDBCategories]
  );

  // Handle LiveDB material download
  const handleLiveDBMaterialDownload = useCallback(
    async (material: LiveDBMaterial) => {
      if (!client) return;

      try {
        Logger.debug(`Downloading material: ${material.name}`);
        const materialHandle = await client.downloadLiveDBMaterial(material.id);
        if (materialHandle) {
          alert(
            `✅ Material "${material.name}" downloaded successfully!\n\nCheck the Node Graph to see the material nodes.`
          );
        } else {
          alert(`❌ Failed to download material "${material.name}"`);
        }
      } catch (error) {
        Logger.error('❌ Failed to download material:', error);
        alert(`❌ Error downloading material: ${error}`);
      }
    },
    [client]
  );

  // Load LiveDB when Live DB tab becomes active
  useEffect(() => {
    if (activeTab === 'livedb' && liveDBCategories.length === 0 && !liveDBLoading && client) {
      loadLiveDB();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, client]);

  return {
    liveDBCategories,
    liveDBLoading,
    loadLiveDB,
    handleLiveDBCategoryToggle,
    handleLiveDBMaterialDownload,
  };
}
