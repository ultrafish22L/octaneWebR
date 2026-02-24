/**
 * Material Database Service - Local and Live material database access
 *
 * Two material database systems:
 * - LocalDB: Offline library of pre-built materials stored on disk (categories, materials)
 * - LiveDB: Online Octane material marketplace with downloadable/purchasable materials
 *
 * Both use similar hierarchical APIs (categories → subcategories → materials)
 * but different service endpoints (ApiLocalDB vs ApiLiveDB)
 */

import { Logger } from '../../utils/Logger';
import { EventEmitter } from '../../utils/EventEmitter';
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';
import { SceneService } from './SceneService';
import { MaterialCategory, Material } from './types';

/** Helper to safely extract a handle from a nested response result */
function extractHandle(value: unknown): number | undefined {
  if (value !== null && typeof value === 'object' && 'handle' in value) {
    return (value as { handle: number }).handle;
  }
  return undefined;
}

export class MaterialDatabaseService extends BaseService {
  private apiService: ApiService;
  private sceneService: SceneService;

  constructor(
    emitter: EventEmitter,
    serverUrl: string,
    apiService: ApiService,
    sceneService: SceneService
  ) {
    super(emitter, serverUrl);
    this.apiService = apiService;
    this.sceneService = sceneService;
  }

  // ==================== LocalDB Methods (Offline Material Library) ====================

  async getLocalDBRoot(): Promise<number | null> {
    try {
      const response = await this.apiService.callApi('ApiLocalDB', 'root', null, {});
      const handle = extractHandle(response?.result);
      if (handle !== undefined) {
        Logger.debug(`✅ LocalDB root category handle: ${handle}`);
        return handle;
      }
      return null;
    } catch (error) {
      Logger.error('❌ Failed to get LocalDB root:', error);
      return null;
    }
  }

  async getCategoryName(categoryHandle: number): Promise<string> {
    try {
      const response = await this.apiService.callApi(
        'ApiLocalDB_Category',
        'name',
        categoryHandle,
        {}
      );
      return (response?.result as string | undefined) || 'Unknown Category';
    } catch (error) {
      Logger.error(`❌ Failed to get category name for handle ${categoryHandle}:`, error);
      return 'Error';
    }
  }

  async getSubCategoryCount(categoryHandle: number): Promise<number> {
    try {
      const response = await this.apiService.callApi(
        'ApiLocalDB_Category',
        'subCategoryCount',
        categoryHandle,
        {}
      );
      return (response?.result as number | undefined) || 0;
    } catch (error) {
      Logger.error(`❌ Failed to get subcategory count:`, error);
      return 0;
    }
  }

  async getSubCategory(categoryHandle: number, index: number): Promise<number | null> {
    try {
      const response = await this.apiService.callApi(
        'ApiLocalDB_Category',
        'subCategory',
        categoryHandle,
        { index }
      );
      const handle = extractHandle(response?.result);
      return handle ?? null;
    } catch (error) {
      Logger.error(`❌ Failed to get subcategory at index ${index}:`, error);
      return null;
    }
  }

  async getPackageCount(categoryHandle: number): Promise<number> {
    try {
      const response = await this.apiService.callApi(
        'ApiLocalDB_Category',
        'packageCount',
        categoryHandle,
        {}
      );
      return (response?.result as number | undefined) || 0;
    } catch (error) {
      Logger.error(`❌ Failed to get package count:`, error);
      return 0;
    }
  }

  async getPackage(categoryHandle: number, index: number): Promise<number | null> {
    try {
      const response = await this.apiService.callApi(
        'ApiLocalDB_Category',
        'package',
        categoryHandle,
        { index }
      );
      const handle = extractHandle(response?.result);
      return handle ?? null;
    } catch (error) {
      Logger.error(`❌ Failed to get package at index ${index}:`, error);
      return null;
    }
  }

  async getPackageName(packageHandle: number): Promise<string> {
    try {
      const response = await this.apiService.callApi(
        'ApiLocalDB_Package',
        'name1',
        packageHandle,
        {}
      );
      return (response?.result as string | undefined) || 'Unknown Package';
    } catch (error) {
      Logger.error(`❌ Failed to get package name:`, error);
      return 'Error';
    }
  }

  async packageHasThumbnail(packageHandle: number): Promise<boolean> {
    try {
      const response = await this.apiService.callApi(
        'ApiLocalDB_Package',
        'hasThumbnail',
        packageHandle,
        {}
      );
      return (response?.result as boolean | undefined) || false;
    } catch (error) {
      Logger.error(`❌ Failed to check package thumbnail:`, error);
      return false;
    }
  }

  async loadPackage(packageHandle: number, destinationGraphHandle?: number): Promise<boolean> {
    try {
      let graphHandle = destinationGraphHandle;
      if (!graphHandle) {
        // Get the render target from the render engine
        const renderTargetResponse = await this.apiService.callApi(
          'ApiRenderEngine',
          'getRenderTargetNode',
          {}
        );
        const renderTargetHandle = extractHandle(renderTargetResponse?.result);
        if (renderTargetHandle !== undefined) {
          // Get the node graph connected to the render target (pin 0 is the graph input)
          const graphResponse = await this.apiService.callApi(
            'ApiNode',
            'connectedNodeIx',
            renderTargetHandle,
            { pinIx: 0 }
          );
          graphHandle = extractHandle(graphResponse?.result);
        }
      }

      if (!graphHandle) {
        Logger.error('❌ No graph found to load package into');
        return false;
      }

      const response = await this.apiService.callApi(
        'ApiLocalDB_Package',
        'loadPackage',
        packageHandle,
        {
          destinationGraph: { handle: graphHandle },
        }
      );

      if (response?.result) {
        Logger.debug(`✅ Package loaded into graph (handle: ${graphHandle})`);
        await this.sceneService.buildSceneTree();
        this.emit('sceneTreeUpdated', this.sceneService.getScene());
        return true;
      }
      return false;
    } catch (error) {
      Logger.error(`❌ Failed to load package:`, error);
      return false;
    }
  }

  // ==================== LiveDB Methods (Online Material Marketplace) ====================

  async getLiveDBCategories(): Promise<MaterialCategory[]> {
    try {
      Logger.debug('📂 Fetching LiveDB categories...');
      const response = await this.apiService.callApi(
        'ApiDBMaterialManager',
        'getCategories',
        null,
        {}
      );

      const listHandle = extractHandle(response?.list);
      if (response?.result && listHandle !== undefined) {
        const arrayHandle = listHandle;

        // getCategory returns ALL categories at once (no index parameter)
        const catResponse = await this.apiService.callApi(
          'ApiDBMaterialManager_DBCategoryArray',
          'getCategory',
          arrayHandle,
          {}
        );
        const catResult = catResponse?.result as
          | { categories?: { id?: number; name?: string; parentID?: number; typeID?: number }[] }
          | undefined;
        const rawCats = catResult?.categories || [];

        const categories: MaterialCategory[] = rawCats.map(cat => ({
          id: cat.id || 0,
          name: cat.name || 'Unknown',
          parentID: cat.parentID || 0,
          typeID: cat.typeID || 0,
        }));

        Logger.debug(`✅ Loaded ${categories.length} LiveDB categories`);
        return categories;
      }

      Logger.warn('⚠️ No LiveDB categories returned');
      return [];
    } catch (error) {
      Logger.error('❌ Failed to get LiveDB categories:', error);
      return [];
    }
  }

  async getLiveDBMaterials(categoryId: number): Promise<Material[]> {
    try {
      Logger.debug(`📦 Fetching LiveDB materials for category ${categoryId}...`);
      const response = await this.apiService.callApi('ApiDBMaterialManager', 'getMaterials', null, {
        categoryId,
      });

      const listHandle = extractHandle(response?.list);
      if (response?.result && listHandle !== undefined) {
        const arrayHandle = listHandle;

        // getMaterial returns ALL materials at once (no index parameter)
        const matResponse = await this.apiService.callApi(
          'ApiDBMaterialManager_DBMaterialArray',
          'getMaterial',
          arrayHandle,
          {}
        );
        const matResult = matResponse?.result as
          | { materials?: { id?: number; name?: string; nickname?: string; copyright?: string }[] }
          | undefined;
        const rawMats = matResult?.materials || [];

        const materials: Material[] = rawMats.map(mat => ({
          id: mat.id || 0,
          name: mat.name || 'Unknown',
          nickname: mat.nickname || '',
          copyright: mat.copyright || '',
        }));

        Logger.debug(`✅ Loaded ${materials.length} materials`);
        return materials;
      }

      Logger.warn('⚠️ No materials returned for category');
      return [];
    } catch (error) {
      Logger.error(`❌ Failed to get LiveDB materials:`, error);
      return [];
    }
  }

  async getLiveDBMaterialPreview(
    materialId: number,
    requestedSize: number = 256,
    view: number = 0
  ): Promise<string | null> {
    try {
      Logger.debug(`🖼️ Fetching preview for material ${materialId}...`);
      const response = await this.apiService.callApi(
        'ApiDBMaterialManager',
        'getMaterialPreview',
        null,
        {
          materialId,
          requestedSize,
          view,
        }
      );

      const resultData = (response?.result as { data?: unknown } | undefined)?.data;
      if (resultData) {
        // Node.js Buffer JSON-serializes as {type:"Buffer", data:[...]} — unwrap it
        const bufferObj = resultData as { data?: number[] } | number[];
        const byteArray: number[] = Array.isArray(bufferObj)
          ? bufferObj
          : ((bufferObj as { data?: number[] })?.data ?? []);
        const uint8 = new Uint8Array(byteArray);

        // Detect image format from magic bytes (PNG: 0x89 0x50, JPEG: 0xFF 0xD8)
        const mimeType =
          uint8[0] === 0x89 && uint8[1] === 0x50
            ? 'image/png'
            : uint8[0] === 0xff && uint8[1] === 0xd8
              ? 'image/jpeg'
              : 'image/png';

        // Chunked base64 encoding to avoid stack overflow on large images
        let binary = '';
        const CHUNK = 0x8000;
        for (let i = 0; i < uint8.length; i += CHUNK) {
          binary += String.fromCharCode(...uint8.subarray(i, i + CHUNK));
        }
        return `data:${mimeType};base64,${btoa(binary)}`;
      }

      return null;
    } catch (error) {
      Logger.error(`❌ Failed to get material preview:`, error);
      return null;
    }
  }

  async downloadLiveDBMaterial(
    materialId: number,
    destinationGraphHandle?: number
  ): Promise<number | null> {
    try {
      Logger.debug(`⬇️ Downloading LiveDB material ${materialId}...`);

      let graphHandle = destinationGraphHandle;
      if (!graphHandle) {
        // Get the render target from the render engine
        const renderTargetResponse = await this.apiService.callApi(
          'ApiRenderEngine',
          'getRenderTargetNode',
          {}
        );
        const renderTargetHandle = extractHandle(renderTargetResponse?.result);
        if (renderTargetHandle !== undefined) {
          // Get the node graph connected to the render target (pin 0 is the graph input)
          const graphResponse = await this.apiService.callApi(
            'ApiNode',
            'connectedNodeIx',
            renderTargetHandle,
            { pinIx: 0 }
          );
          graphHandle = extractHandle(graphResponse?.result);
        }
      }

      if (!graphHandle) {
        Logger.error('❌ No graph found to download material into');
        return null;
      }

      const response = await this.apiService.callApi(
        'ApiDBMaterialManager',
        'downloadMaterial',
        null,
        {
          materialId,
          destinationGraph: { handle: graphHandle },
        }
      );

      const outputHandle = extractHandle(response?.outputNode);
      if (response?.result && outputHandle !== undefined) {
        Logger.debug(`✅ Material downloaded (handle: ${outputHandle})`);

        await this.sceneService.buildSceneTree();
        this.emit('sceneTreeUpdated', this.sceneService.getScene());

        return outputHandle;
      }

      Logger.warn('⚠️ Material download succeeded but no output node returned');
      return null;
    } catch (error) {
      Logger.error(`❌ Failed to download LiveDB material:`, error);
      return null;
    }
  }
}
