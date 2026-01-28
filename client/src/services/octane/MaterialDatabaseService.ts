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
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';
import { SceneService } from './SceneService';
import { MaterialCategory, Material } from './types';

export class MaterialDatabaseService extends BaseService {
  private apiService: ApiService;
  private sceneService: SceneService;

  constructor(emitter: any, serverUrl: string, apiService: ApiService, sceneService: SceneService) {
    super(emitter, serverUrl);
    this.apiService = apiService;
    this.sceneService = sceneService;
  }

  // ==================== LocalDB Methods (Offline Material Library) ====================
  
  async getLocalDBRoot(): Promise<number | null> {
    try {
      const response = await this.apiService.callApi('ApiLocalDB', 'root', null, {});
      if (response?.result?.handle) {
        Logger.debug(`✅ LocalDB root category handle: ${response.result.handle}`);
        return response.result.handle;
      }
      return null;
    } catch (error) {
      Logger.error('❌ Failed to get LocalDB root:', error);
      return null;
    }
  }

  async getCategoryName(categoryHandle: number): Promise<string> {
    try {
      const response = await this.apiService.callApi('ApiLocalDB_Category', 'name', categoryHandle, {});
      return response?.result || 'Unknown Category';
    } catch (error) {
      Logger.error(`❌ Failed to get category name for handle ${categoryHandle}:`, error);
      return 'Error';
    }
  }

  async getSubCategoryCount(categoryHandle: number): Promise<number> {
    try {
      const response = await this.apiService.callApi('ApiLocalDB_Category', 'subCategoryCount', categoryHandle, {});
      return response?.result || 0;
    } catch (error) {
      Logger.error(`❌ Failed to get subcategory count:`, error);
      return 0;
    }
  }

  async getSubCategory(categoryHandle: number, index: number): Promise<number | null> {
    try {
      const response = await this.apiService.callApi('ApiLocalDB_Category', 'subCategory', categoryHandle, { index });
      if (response?.result?.handle) {
        return response.result.handle;
      }
      return null;
    } catch (error) {
      Logger.error(`❌ Failed to get subcategory at index ${index}:`, error);
      return null;
    }
  }

  async getPackageCount(categoryHandle: number): Promise<number> {
    try {
      const response = await this.apiService.callApi('ApiLocalDB_Category', 'packageCount', categoryHandle, {});
      return response?.result || 0;
    } catch (error) {
      Logger.error(`❌ Failed to get package count:`, error);
      return 0;
    }
  }

  async getPackage(categoryHandle: number, index: number): Promise<number | null> {
    try {
      const response = await this.apiService.callApi('ApiLocalDB_Category', 'package', categoryHandle, { index });
      if (response?.result?.handle) {
        return response.result.handle;
      }
      return null;
    } catch (error) {
      Logger.error(`❌ Failed to get package at index ${index}:`, error);
      return null;
    }
  }

  async getPackageName(packageHandle: number): Promise<string> {
    try {
      const response = await this.apiService.callApi('ApiLocalDB_Package', 'name1', packageHandle, {});
      return response?.result || 'Unknown Package';
    } catch (error) {
      Logger.error(`❌ Failed to get package name:`, error);
      return 'Error';
    }
  }

  async packageHasThumbnail(packageHandle: number): Promise<boolean> {
    try {
      const response = await this.apiService.callApi('ApiLocalDB_Package', 'hasThumbnail', packageHandle, {});
      return response?.result || false;
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
        const renderTargetResponse = await this.apiService.callApi('ApiRenderEngine', 'getRenderTargetNode', {});
        if (renderTargetResponse?.result?.handle) {
          const renderTargetHandle = renderTargetResponse.result.handle;
          // Get the node graph connected to the render target (pin 0 is the graph input)
          const graphResponse = await this.apiService.callApi('ApiNode', 'connectedNodeIx', renderTargetHandle, { pinIx: 0 });
          if (graphResponse?.result?.handle) {
            graphHandle = graphResponse.result.handle;
          }
        }
      }

      if (!graphHandle) {
        Logger.error('❌ No graph found to load package into');
        return false;
      }

      const response = await this.apiService.callApi('ApiLocalDB_Package', 'loadPackage', packageHandle, {
        destinationGraph: { handle: graphHandle }
      });

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
      const response = await this.apiService.callApi('ApiDBMaterialManager', 'getCategories', null, {});
      
      if (response?.result && response?.list?.handle) {
        const arrayHandle = response.list.handle;
        
        const countResponse = await this.apiService.callApi('ApiDBMaterialManager_DBCategoryArray', 'getCount', arrayHandle, {});
        const count = countResponse?.result || 0;
        Logger.debug(`📂 Found ${count} LiveDB categories`);
        
        const categories: MaterialCategory[] = [];
        for (let i = 0; i < count; i++) {
          const catResponse = await this.apiService.callApi('ApiDBMaterialManager_DBCategoryArray', 'getCategory', arrayHandle, { index: i });
          if (catResponse?.result?.categories?.[0]) {
            const cat = catResponse.result.categories[0];
            categories.push({
              id: cat.id || 0,
              name: cat.name || 'Unknown',
              parentID: cat.parentID || 0,
              typeID: cat.typeID || 0
            });
          }
        }
        
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
      const response = await this.apiService.callApi('ApiDBMaterialManager', 'getMaterials', null, { categoryId });
      
      if (response?.result && response?.list?.handle) {
        const arrayHandle = response.list.handle;
        
        const countResponse = await this.apiService.callApi('ApiDBMaterialManager_DBMaterialArray', 'getCount1', arrayHandle, {});
        const count = countResponse?.result || 0;
        Logger.debug(`📦 Found ${count} materials in category ${categoryId}`);
        
        const materials: Material[] = [];
        for (let i = 0; i < count; i++) {
          const matResponse = await this.apiService.callApi('ApiDBMaterialManager_DBMaterialArray', 'getMaterial', arrayHandle, { index: i });
          if (matResponse?.result?.materials?.[0]) {
            const mat = matResponse.result.materials[0];
            materials.push({
              id: mat.id || 0,
              name: mat.name || 'Unknown',
              nickname: mat.nickname || '',
              copyright: mat.copyright || ''
            });
          }
        }
        
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

  async getLiveDBMaterialPreview(materialId: number, requestedSize: number = 256, view: number = 0): Promise<string | null> {
    try {
      Logger.debug(`🖼️ Fetching preview for material ${materialId}...`);
      const response = await this.apiService.callApi('ApiDBMaterialManager', 'getMaterialPreview', null, {
        materialId,
        requestedSize,
        view
      });
      
      if (response?.result?.data) {
        const buffer = response.result.data;
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        return `data:image/png;base64,${base64}`;
      }
      
      return null;
    } catch (error) {
      Logger.error(`❌ Failed to get material preview:`, error);
      return null;
    }
  }

  async downloadLiveDBMaterial(materialId: number, destinationGraphHandle?: number): Promise<number | null> {
    try {
      Logger.debug(`⬇️ Downloading LiveDB material ${materialId}...`);
      
      let graphHandle = destinationGraphHandle;
      if (!graphHandle) {
        // Get the render target from the render engine
        const renderTargetResponse = await this.apiService.callApi('ApiRenderEngine', 'getRenderTargetNode', {});
        if (renderTargetResponse?.result?.handle) {
          const renderTargetHandle = renderTargetResponse.result.handle;
          // Get the node graph connected to the render target (pin 0 is the graph input)
          const graphResponse = await this.apiService.callApi('ApiNode', 'connectedNodeIx', renderTargetHandle, { pinIx: 0 });
          if (graphResponse?.result?.handle) {
            graphHandle = graphResponse.result.handle;
          }
        }
      }

      if (!graphHandle) {
        Logger.error('❌ No graph found to download material into');
        return null;
      }

      const response = await this.apiService.callApi('ApiDBMaterialManager', 'downloadMaterial', null, {
        materialId,
        destinationGraph: { handle: graphHandle }
      });

      if (response?.result && response?.outputNode?.handle) {
        const outputHandle = response.outputNode.handle;
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
