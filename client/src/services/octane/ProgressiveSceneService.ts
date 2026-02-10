/**
 * Progressive Scene Service - Progressive scene loading with incremental UI updates
 * 
 * Based on proven SceneService.ts implementation but with strategic emitters
 * for progressive UI updates. Maintains EXACT same data structure as SceneService.
 * 
 * Strategy:
 * 1. Load level 0 nodes → emit after each → show top-level nodes immediately
 * 2. Load level 1 children (pins) → emit after each → show node connections
 * 3. Load deeper children → emit progressively → fill in parameters
 * 
 * Created: 2025-02-03
 */

import { Logger } from '../../utils/Logger';
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';
import { Scene, SceneNode } from './types';
import { getIconForType } from '../../constants/PinTypes';
import { AttributeId } from '../../constants/OctaneTypes';

export class ProgressiveSceneService extends BaseService {
  private apiService: ApiService;
  private scene: Scene;
  private abortController: AbortController | null = null;

  constructor(emitter: any, serverUrl: string, apiService: ApiService) {
    super(emitter, serverUrl);
    this.apiService = apiService;
    this.scene = {
      tree: [],
      map: new Map(),
      connections: new Map()
    };
  }

  /**
   * Progressive scene building - Same logic as SceneService but with incremental emitters
   */
  async buildSceneProgressive(): Promise<SceneNode[]> {
    // Abort any previous build
    if (this.abortController) {
      Logger.info('🚫 Cancelling previous progressive scene build');
      this.abortController.abort();
    }

    this.abortController = new AbortController();
    const startTime = Date.now();

    try {
      Logger.info('🚀 Starting PROGRESSIVE scene build (based on working SceneService)');

      // Reset scene
      this.scene = {
        tree: [],
        map: new Map(),
        connections: new Map()
      };

      this.emit('scene:buildProgress', { stage: 'starting', progress: 0 });

      // Get root node graph
      const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
      if (!rootResponse?.result?.handle) {
        throw new Error('Failed to get root node graph');
      }

      const rootHandle = rootResponse.result.handle;
      const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', rootHandle);
      const isGraph = isGraphResponse?.result || false;

      if (!isGraph) {
        Logger.warn('Root node is not a graph!');
        return [];
      }

      // === STAGE 1: Load level 0 nodes (owned items of root graph) ===
      Logger.info('📦 STAGE 1: Loading level 0 nodes...');
      this.emit('scene:buildProgress', { stage: 'level0', progress: 10 });

      const ownedResponse = await this.apiService.callApi('ApiNodeGraph', 'getOwnedItems', rootHandle);
      if (!ownedResponse?.list?.handle) {
        throw new Error('Failed to get owned items');
      }

      const ownedItemsHandle = ownedResponse.list.handle;
      const sizeResponse = await this.apiService.callApi('ApiItemArray', 'size', ownedItemsHandle);
      const size = sizeResponse?.result || 0;

      Logger.info(`📦 Found ${size} level 0 nodes`);

      // Load each level 0 node and emit immediately
      for (let i = 0; i < size; i++) {
        const itemResponse = await this.apiService.callApi('ApiItemArray', 'get', ownedItemsHandle, { index: i });
        
        if (itemResponse?.result?.handle) {
          // Create the node entry (same as SceneService)
          const node = await this.addSceneItem(this.scene.tree, itemResponse.result, null, 1);
          
          if (node) {
            // 🎯 PROGRESSIVE EMIT: Node added to tree
            this.emit('scene:nodeAdded', { node, level: 0 });
            Logger.info(`✅ Level 0 node added: ${node.name} (${i + 1}/${size})`);
          }
        }

        // Update progress
        const progress = 10 + (i / size) * 20; // 10-30%
        this.emit('scene:buildProgress', { 
          stage: 'level0', 
          progress, 
          message: `Loaded ${i + 1}/${size} top-level nodes` 
        });
      }

      Logger.info(`✅ STAGE 1 complete: ${this.scene.tree.length} level 0 nodes loaded`);
      this.emit('scene:level0Complete', { count: this.scene.tree.length });

      // === STAGE 2: Load children (pins) for each level 0 node ===
      Logger.info('📌 STAGE 2: Loading children for level 0 nodes...');
      this.emit('scene:buildProgress', { stage: 'children', progress: 30 });

      const level0Nodes = [...this.scene.tree]; // Snapshot to avoid mutation issues
      const totalNodes = level0Nodes.length;

      for (let i = 0; i < totalNodes; i++) {
        const node = level0Nodes[i];
        
        Logger.info(`🔄 Loading children for "${node.name}" (${i + 1}/${totalNodes})...`);
        
        // Load children (same logic as SceneService.addItemChildren)
        await this.addItemChildren(node);
        
        // 🎯 PROGRESSIVE EMIT: Children loaded for this node
        this.emit('scene:childrenLoaded', { 
          parent: node, 
          children: node.children || [] 
        });
        
        Logger.info(`✅ Children loaded for "${node.name}": ${node.children?.length || 0} children`);

        // Update progress
        const progress = 30 + ((i + 1) / totalNodes) * 60; // 30-90%
        this.emit('scene:buildProgress', { 
          stage: 'children', 
          progress,
          message: `Loaded children for ${i + 1}/${totalNodes} nodes` 
        });

        // Small delay to allow UI to update
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      Logger.info('✅ STAGE 2 complete: All children loaded');
      this.emit('scene:childrenComplete', { count: totalNodes });

      // === STAGE 3: Final validation ===
      Logger.info('🔍 STAGE 3: Final validation...');
      this.emit('scene:buildProgress', { stage: 'finalizing', progress: 95 });

      const elapsedTime = Date.now() - startTime;
      Logger.info(`✅ Progressive scene build complete in ${elapsedTime}ms`);
      Logger.info(`📊 Final tree: ${this.scene.tree.length} nodes, ${this.scene.map.size} in map`);

      // Emit final tree update (compatible with existing code)
      this.emit('scene:loaded', {
        tree: this.scene.tree,
        nodeCount: this.scene.map.size,
        topLevelCount: this.scene.tree.length,
        elapsedTime
      });
      this.emit('sceneTreeUpdated', this.scene);

      this.emit('scene:buildProgress', { stage: 'complete', progress: 100 });

      return this.scene.tree;

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      
      if (message.includes('cancelled') || message.includes('abort')) {
        Logger.info('🚫 Progressive scene build cancelled');
      } else {
        Logger.error('❌ Progressive scene build failed:', message);
        if (error instanceof Error && error.stack) {
          Logger.error('Stack:', error.stack);
        }
      }
      throw error;
    }
  }

  /**
   * Abort ongoing progressive load
   */
  abort(): void {
    if (this.abortController) {
      Logger.info('🛑 Aborting progressive scene load');
      this.abortController.abort();
      this.abortController = null;
    }
  }

  getScene(): Scene {
    return this.scene;
  }

  /**
   * Add scene item - EXACT COPY from SceneService.addSceneItem
   * (Keeping all the working logic intact!)
   */
  private async addSceneItem(
    sceneItems: SceneNode[],
    item: any,
    pinInfo: any,
    level: number
  ): Promise<SceneNode | null> {
    const itemName = item?.handle ? 
      (await this.apiService.callApi('ApiItem', 'name', item.handle))?.result || `Item ${item.handle}` :
      'NO_ITEM';

    let outType: string | number = '';
    let graphInfo = null;
    let nodeInfo = null;
    let isGraph = false;
    let position = undefined;

    if (item != null && item.handle != 0) {
      try {
        const outTypeResponse = await this.apiService.callApi('ApiItem', 'outType', item.handle);
        outType = outTypeResponse?.result || '';
        
        const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', item.handle);
        isGraph = isGraphResponse?.result || false;
        
        // Fetch position for top-level nodes (level 1)
        if (level === 1) {
          try {
            const posResponse = await this.apiService.callApi('ApiItem', 'position', item.handle);
            if (posResponse?.result) {
              position = {
                x: posResponse.result.x || 0,
                y: posResponse.result.y || 0
              };
            }
          } catch (posError: any) {
            Logger.warn(`⚠️ Failed to get position for ${itemName}:`, posError.message);
          }
        }
        
        if (isGraph) {
          const infoResponse = await this.apiService.callApi('ApiNodeGraph', 'info1', item.handle);
          graphInfo = infoResponse?.result || null;
        } else {
          const infoResponse = await this.apiService.callApi('ApiNode', 'info', item.handle);
          nodeInfo = infoResponse?.result || null;
        }
        
      } catch (error: any) {
        Logger.error('❌ addSceneItem failed to fetch item data:', error.message);
      }
    }
    
    const displayName = pinInfo?.staticLabel || itemName;
    const icon = this.getNodeIcon(outType, displayName);
    
    const entry: SceneNode = {
      level,
      name: displayName,
      handle: item?.handle,
      type: String(outType),
      typeEnum: typeof outType === 'number' ? outType : 0,
      outType: String(outType),
      icon,
      visible: true,
      graphInfo,
      nodeInfo,
      pinInfo,
      children: [],
      position
    };
    
    sceneItems.push(entry);
    
    if (item != null && item.handle != 0) {
      const handleNum = Number(item.handle);
      this.scene.map.set(handleNum, entry);
      Logger.debug(`📄 Added item: ${itemName} (type: "${outType}", icon: ${icon}, level: ${level})`);

      // Don't load children here - we do it separately for progressive updates
      // (SceneService does it here for level > 1, we handle it in stage 2)
    }
    
    return entry;
  }

  /**
   * Add item children - EXACT COPY from SceneService.addItemChildren
   */
  private async addItemChildren(item: SceneNode): Promise<void> {
    if (!item || !item.handle) {
      return;
    }
    
    const isGraph = item.graphInfo !== null && item.graphInfo !== undefined;
    
    try {
      // Recursively load children (same as SceneService)
      const children = await this.syncSceneSequential(item.handle, null, isGraph, item.level || 1);
      item.children = children;
      
      // Load attribute info
      const attrInfoResponse = await this.apiService.callApi(
        'ApiItem',
        'attrInfo',
        item.handle,
        { id: AttributeId.A_VALUE }
      );
      
      if (attrInfoResponse?.result && attrInfoResponse.result.type != "AT_UNKNOWN") {
        item.attrInfo = attrInfoResponse.result;
      }
      
    } catch (error: any) {
      Logger.error(`❌ Failed to load children for ${item.name}:`, error.message);
    }
  }

  /**
   * Recursive scene traversal - EXACT COPY from SceneService.syncSceneSequential
   */
  private async syncSceneSequential(
    itemHandle: number | null,
    sceneItems: SceneNode[] | null,
    isGraph: boolean,
    level: number
  ): Promise<SceneNode[]> {
    if (sceneItems === null) {
      sceneItems = [];
    }
    
    level = level + 1;
    
    try {
      if (itemHandle === null) {
        const response = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
        if (!response || !response.result || !response.result.handle) {
          throw new Error('Failed ApiProjectManager/rootNodeGraph');
        }
        itemHandle = response.result.handle;
        
        const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', itemHandle);
        isGraph = isGraphResponse?.result || false;
      }
      
      // NodeGraph: iterate owned items
      if (isGraph) {
        const ownedResponse = await this.apiService.callApi('ApiNodeGraph', 'getOwnedItems', itemHandle);
        if (!ownedResponse || !ownedResponse.list || !ownedResponse.list.handle) {
          throw new Error('Failed ApiNodeGraph/getOwnedItems');
        }
        const ownedItemsHandle = ownedResponse.list.handle;
        
        const sizeResponse = await this.apiService.callApi('ApiItemArray', 'size', ownedItemsHandle);
        const size = sizeResponse?.result || 0;
        
        Logger.debug(`📦 Level ${level}: Found ${size} owned items`);
        
        for (let i = 0; i < size; i++) {
          const itemResponse = await this.apiService.callApi('ApiItemArray', 'get', ownedItemsHandle, { index: i });
          if (itemResponse && itemResponse.result && itemResponse.result.handle) {
            await this.addSceneItem(sceneItems, itemResponse.result, null, level);
          }
        }
        
        // Recursively load children for level > 1
        if (level === 1) {
          for (const item of sceneItems) {
            await this.addItemChildren(item);
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      } 
      // Regular Node: iterate pins
      else if (itemHandle != 0) {
        try {
          const pinCountResponse = await this.apiService.callApi('ApiNode', 'pinCount', itemHandle);
          const pinCount = pinCountResponse?.result || 0;
          
          for (let i = 0; i < pinCount; i++) {
            try {
              const connectedResponse = await this.apiService.callApi(
                'ApiNode',
                'connectedNodeIx',
                itemHandle,
                { pinIx: i, enterWrapperNode: true }
              );
              
              const connectedNode = connectedResponse?.result || null;
              
              const pinInfoHandleResponse = await this.apiService.callApi(
                'ApiNode',
                'pinInfoIx',
                itemHandle,
                { index: i }
              );
              
              if (pinInfoHandleResponse && pinInfoHandleResponse.result && pinInfoHandleResponse.result.handle) {
                const pinInfoResponse = await this.apiService.callApi(
                  'ApiNodePinInfoEx',
                  'getApiNodePinInfo',
                  pinInfoHandleResponse.result.handle
                );
                
                const pinInfo = pinInfoResponse?.nodePinInfo || null;
                if (pinInfo) {
                  pinInfo.ix = i;
                  await this.addSceneItem(sceneItems, connectedNode, pinInfo, level);
                }
              }
            } catch (pinError: any) {
              Logger.warn(`⚠️ Failed to load pin ${i}:`, pinError.message);
            }
          }
        } catch (pinCountError: any) {
          Logger.error(`❌ Failed to get pin count:`, pinCountError.message);
        }
      }
      
    } catch (error: any) {
      Logger.error('❌ syncSceneSequential failed:', error.message);
    }
    
    return sceneItems;
  }

  /**
   * Get node icon - copied from SceneService
   */
  private getNodeIcon(outType: string | number, displayName: string): string {
    return getIconForType(String(outType), displayName);
  }

  lookupItem(handle: number): SceneNode | null {
    return this.scene.map.get(handle) || null;
  }

  removeFromScene(handle: number): void {
    this.scene.map.delete(handle);
    
    const removeFromArray = (arr: SceneNode[]): boolean => {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].handle === handle) {
          arr.splice(i, 1);
          return true;
        }
        if (arr[i].children && arr[i].children!.length > 0) {
          if (removeFromArray(arr[i].children!)) {
            return true;
          }
        }
      }
      return false;
    };
    
    removeFromArray(this.scene.tree);
  }

  getNodeByHandle(handle: number): SceneNode | undefined {
    return this.scene.map.get(handle);
  }
}
