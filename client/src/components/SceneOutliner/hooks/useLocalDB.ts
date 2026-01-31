/**
 * useLocalDB - LocalDB management
 * Handles loading and management of local material database
 */

import { useState, useEffect, useCallback } from 'react';
import { Logger } from '../../../utils/Logger';
import { useOctane } from '../../../hooks/useOctane';

export interface LocalDBCategory {
  handle: number;
  name: string;
  subcategories: LocalDBCategory[];
  packages: LocalDBPackage[];
  loaded: boolean;
}

export interface LocalDBPackage {
  handle: number;
  name: string;
}

interface UseLocalDBProps {
  activeTab: string;
}

export function useLocalDB({ activeTab }: UseLocalDBProps) {
  const { client } = useOctane();
  const [localDBRoot, setLocalDBRoot] = useState<LocalDBCategory | null>(null);
  const [localDBLoading, setLocalDBLoading] = useState(false);

  // Load children (subcategories and packages) for a category
  const loadCategoryChildren = useCallback(
    async (category: LocalDBCategory) => {
      if (!client || category.loaded) return;

      try {
        // Load subcategories
        const subCatCount = await client.getSubCategoryCount(category.handle);
        for (let i = 0; i < subCatCount; i++) {
          const subCatHandle = await client.getSubCategory(category.handle, i);
          if (subCatHandle) {
            const subCatName = await client.getCategoryName(subCatHandle);
            category.subcategories.push({
              handle: subCatHandle,
              name: subCatName,
              subcategories: [],
              packages: [],
              loaded: false,
            });
          }
        }

        // Load packages
        const pkgCount = await client.getPackageCount(category.handle);
        for (let i = 0; i < pkgCount; i++) {
          const pkgHandle = await client.getPackage(category.handle, i);
          if (pkgHandle) {
            const pkgName = await client.getPackageName(pkgHandle);
            category.packages.push({
              handle: pkgHandle,
              name: pkgName,
            });
          }
        }

        category.loaded = true;
      } catch (error) {
        Logger.error('❌ Failed to load category children:', error);
      }
    },
    [client]
  );

  // Load LocalDB categories and packages
  const loadLocalDB = useCallback(async () => {
    if (!client) return;

    setLocalDBLoading(true);
    try {
      const rootHandle = await client.getLocalDBRoot();
      if (!rootHandle) {
        Logger.warn('⚠️ LocalDB not available or empty');
        setLocalDBRoot(null);
        return;
      }

      const rootName = await client.getCategoryName(rootHandle);
      const root: LocalDBCategory = {
        handle: rootHandle,
        name: rootName,
        subcategories: [],
        packages: [],
        loaded: false,
      };

      // Load root level categories and packages
      await loadCategoryChildren(root);
      setLocalDBRoot(root);
      Logger.debug('✅ LocalDB loaded:', root);
    } catch (error) {
      Logger.error('❌ Failed to load LocalDB:', error);
      setLocalDBRoot(null);
    } finally {
      setLocalDBLoading(false);
    }
  }, [client, loadCategoryChildren]);

  // Handle package double-click to load into scene
  const handlePackageLoad = useCallback(
    async (pkg: LocalDBPackage) => {
      if (!client) return;

      try {
        Logger.debug(`Loading package: ${pkg.name}`);
        const success = await client.loadPackage(pkg.handle);
        if (success) {
          alert(
            `✅ Package "${pkg.name}" loaded successfully!\n\nCheck the Node Graph to see the loaded nodes.`
          );
        } else {
          alert(`❌ Failed to load package "${pkg.name}"`);
        }
      } catch (error) {
        Logger.error('❌ Failed to load package:', error);
        alert(`❌ Error loading package: ${error}`);
      }
    },
    [client]
  );

  // Load LocalDB when Local DB tab becomes active
  useEffect(() => {
    if (activeTab === 'localdb' && !localDBRoot && !localDBLoading && client) {
      loadLocalDB();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, client]);

  return {
    localDBRoot,
    localDBLoading,
    loadLocalDB,
    loadCategoryChildren,
    handlePackageLoad,
    setLocalDBRoot,
  };
}
