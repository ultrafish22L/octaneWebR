/**
 * useLocalDB - LocalDB management
 * Handles loading and management of local material database
 */

import { useState, useEffect, useCallback } from 'react';
import { Logger } from '../../../utils/Logger';
import { useOctane } from '../../../hooks/useOctane';
import { useStatusActions } from '../../../contexts/StatusMessageContext';

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
  const { setTemporaryStatus } = useStatusActions();
  const [localDBRoot, setLocalDBRoot] = useState<LocalDBCategory | null>(null);
  const [localDBLoading, setLocalDBLoading] = useState(false);

  // Load children (subcategories and packages) for a category, returning an updated copy
  const loadCategoryChildren = useCallback(
    async (category: LocalDBCategory): Promise<LocalDBCategory> => {
      if (!client || category.loaded) return category;

      try {
        // Load subcategories
        const subcategories: LocalDBCategory[] = [];
        const subCatCount = await client.getSubCategoryCount(category.handle);
        for (let i = 0; i < subCatCount; i++) {
          const subCatHandle = await client.getSubCategory(category.handle, i);
          if (subCatHandle) {
            const subCatName = await client.getCategoryName(subCatHandle);
            subcategories.push({
              handle: subCatHandle,
              name: subCatName,
              subcategories: [],
              packages: [],
              loaded: false,
            });
          }
        }

        // Load packages
        const packages: LocalDBPackage[] = [];
        const pkgCount = await client.getPackageCount(category.handle);
        for (let i = 0; i < pkgCount; i++) {
          const pkgHandle = await client.getPackage(category.handle, i);
          if (pkgHandle) {
            const pkgName = await client.getPackageName(pkgHandle);
            packages.push({
              handle: pkgHandle,
              name: pkgName,
            });
          }
        }

        return { ...category, subcategories, packages, loaded: true };
      } catch (error) {
        Logger.error('Failed to load category children:', error);
        return category;
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
        Logger.warn('LocalDB not available or empty');
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
      const loadedRoot = await loadCategoryChildren(root);
      setLocalDBRoot(loadedRoot);
      Logger.debug('LocalDB loaded:', root);
    } catch (error) {
      Logger.error('Failed to load LocalDB:', error);
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
          setTemporaryStatus(`Package "${pkg.name}" loaded — see Node Graph`, 4000);
        } else {
          setTemporaryStatus(`Failed to load package "${pkg.name}"`, 4000);
        }
      } catch (error) {
        Logger.error('Failed to load package:', error);
        setTemporaryStatus(`Error loading package: ${error}`, 4000);
      }
    },
    [client, setTemporaryStatus]
  );

  // Load LocalDB when Local DB tab becomes active
  useEffect(() => {
    if (activeTab === 'localdb' && !localDBRoot && !localDBLoading && client) {
      loadLocalDB();
    }
  }, [activeTab, client, localDBRoot, localDBLoading, loadLocalDB]);

  return {
    localDBRoot,
    localDBLoading,
    loadLocalDB,
    loadCategoryChildren,
    handlePackageLoad,
    setLocalDBRoot,
  };
}
