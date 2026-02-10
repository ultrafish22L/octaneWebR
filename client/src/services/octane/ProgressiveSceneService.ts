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

      // === STAGE 1: Load ALL level 0 nodes (basic info only) ===
      Logger.info('📦 STAGE 1: Loading level 0 nodes (basic info)...');
      
      for (let i = 0; i < size; i++) {
        const itemResponse = await this.apiService.callApi('ApiItemArray', 'get', ownedItemsHandle, { index: i });
        
        if (itemResponse?.result?.handle) {
          // Load basic node info WITHOUT children
          const node = await this.addSceneItem(this.scene.tree, itemResponse.result, null, 1);
          
          if (node) {
            // 🎯 EMIT: Level 0 node added → NodeGraph shows it immediately
            this.emit('scene:nodeAdded', { node, level: 0 });
            Logger.info(`✅ Level 0 [${i + 1}/${size}]: "${node.name}"`);
          }
        }

        const progress = 10 + ((i + 1) / size) * 20; // 10-30%
        this.emit('scene:buildProgress', { 
          stage: 'level0', 
          progress, 
          message: `Loaded ${i + 1}/${size} level 0 nodes` 
        });

        // 🎯 Yield to browser to allow React to render level 0 nodes progressively
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      Logger.info(`✅ STAGE 1 complete: ${this.scene.tree.length} level 0 nodes`);
      this.emit('scene:level0Complete', { nodes: this.scene.tree });

      // === STAGE 2+: Load children level-by-level (breadth-first) ===
      Logger.info('📌 STAGE 2+: Loading children by level...');
      
      // Queue of nodes to process: [node, parentNode]
      let currentLevelNodes: Array<{ node: SceneNode, parent: SceneNode | null }> = 
        this.scene.tree.map(node => ({ node, parent: null }));
      
      let currentLevel = 1;
      let totalProcessed = 0;
      const estimatedTotal = size * 10; // Rough estimate for progress

      while (currentLevelNodes.length > 0) {
        Logger.info(`📌 Processing level ${currentLevel}: ${currentLevelNodes.length} nodes`);
        
        const nextLevelNodes: Array<{ node: SceneNode, parent: SceneNode | null }> = [];
        const processedHandles = new Set<number>(); // 🔑 Deduplicate by handle

        for (let i = 0; i < currentLevelNodes.length; i++) {
          const { node } = currentLevelNodes[i];
          
          // Safety check
          if (!node.handle) {
            Logger.warn(`⚠️ Node missing handle: "${node.name}"`);
            continue;
          }
          
          // 🚫 Skip if already processed this handle at this level
          if (processedHandles.has(node.handle)) {
            Logger.debug(`  ⏭️ Skipping duplicate handle ${node.handle} ("${node.name}")`);
            continue;
          }
          processedHandles.add(node.handle);
          
          // Load ONLY immediate children (shallow, non-recursive)
          await this.addItemChildrenShallow(node);
          const childrenAfter = node.children?.length || 0;
          
          // 🎯 EMIT: Children loaded → Update parent's pin list
          if (childrenAfter > 0) {
            this.emit('scene:childrenLoaded', { 
              parent: node, 
              children: node.children || [] 
            });
            Logger.info(`  ✅ Level ${currentLevel} [${i + 1}/${currentLevelNodes.length}]: "${node.name}" → ${childrenAfter} children`);
            
            // Add newly loaded children to next level queue (may contain duplicates)
            for (const child of node.children || []) {
              nextLevelNodes.push({ node: child, parent: node });
            }
          }

          totalProcessed++;
          const progress = 30 + (totalProcessed / estimatedTotal) * 60; // 30-90%
          this.emit('scene:buildProgress', { 
            stage: `level${currentLevel}`, 
            progress: Math.min(progress, 90),
            message: `Level ${currentLevel}: ${i + 1}/${currentLevelNodes.length} nodes` 
          });

          // 🎯 CRITICAL: Yield to browser event loop to allow React to render!
          // Without this, React 18 batches all setState calls and renders only once at the end.
          // setTimeout(0) queues a microtask, giving React a chance to flush updates.
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        Logger.info(`✅ Level ${currentLevel} complete: processed ${currentLevelNodes.length} nodes, found ${nextLevelNodes.length} children`);
        
        // Move to next level
        currentLevelNodes = nextLevelNodes;
        currentLevel++;
        
        // Safety limit (prevent infinite loops)
        if (currentLevel > 20) {
          Logger.warn('⚠️ Reached max level depth (20), stopping');
          break;
        }
      }

      Logger.info(`✅ PROGRESSIVE LOADING complete: ${currentLevel - 1} levels processed`);

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
  ): Promise<SceneNode | undefined> {
    let itemName = item?.name || pinInfo?.staticLabel || 'Unnamed';
    let outType = pinInfo?.outType || '';
    let graphInfo = null;
    let nodeInfo = null;
    let isGraph = false;
    let position: { x: number; y: number } | null = null;
    
    if (item != null && item.handle != 0) {
      const handleNum = Number(item.handle);
      const existing = this.scene.map.get(handleNum);
      if (existing && existing.handle) {
        existing.pinInfo = pinInfo;
        if (level > 1) {
          sceneItems.push(existing);
        }
        return existing;
      }
      
      try {
        const nameResponse = await this.apiService.callApi('ApiItem', 'name', item.handle);
        itemName = nameResponse?.result || 'Unnamed';
        
        const outTypeResponse = await this.apiService.callApi('ApiItem', 'outType', item.handle);
        outType = outTypeResponse?.result || '';
        
        Logger.debug(`  🔍 API returned outType: "${outType}" (type: ${typeof outType}) for ${itemName}`);
        
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
              Logger.debug(`  📍 Position for ${itemName}: (${position.x}, ${position.y})`);
            }
          } catch (posError: any) {
            Logger.warn(`  ⚠️ Failed to get position for ${itemName}:`, posError.message);
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
    } else {
      Logger.debug(`  ⚪ Unconnected pin: ${itemName}`);
    }
    
    const displayName = pinInfo?.staticLabel || itemName;
    const icon = this.getNodeIcon(outType, displayName);
    
    const entry: SceneNode = {
      level,
      name: displayName,
      handle: item?.handle,
      type: outType,
      typeEnum: typeof outType === 'number' ? outType : 0,
      outType: outType,
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
      Logger.debug(`  📄 Added item: ${itemName} (type: "${outType}", icon: ${icon}, level: ${level})`);

      // 🚫 PROGRESSIVE LOADING: NEVER auto-load children here
      // All children are loaded explicitly and shallowly in the breadth-first loop
      // This is the key difference from SceneService which recursively loads everything
    }
    
    return entry;
  }

  /**
   * Add item children SHALLOW - Load only immediate children, don't recurse
   * This is the key difference from SceneService.addItemChildren which loads entire subtree
   */
  private async addItemChildrenShallow(item: SceneNode): Promise<void> {
    if (!item || !item.handle) {
      return;
    }

    const isGraph = item.graphInfo !== null && item.graphInfo !== undefined;
    const sceneItems: SceneNode[] = [];
    const childLevel = (item.level || 1) + 1;

    try {
      if (isGraph) {
        // NodeGraph: Load owned items
        const ownedResponse = await this.apiService.callApi('ApiNodeGraph', 'getOwnedItems', item.handle);
        if (!ownedResponse?.list?.handle) {
          item.children = [];
          return;
        }

        const ownedItemsHandle = ownedResponse.list.handle;
        const sizeResponse = await this.apiService.callApi('ApiItemArray', 'size', ownedItemsHandle);
        const size = sizeResponse?.result || 0;

        for (let i = 0; i < size; i++) {
          const itemResponse = await this.apiService.callApi('ApiItemArray', 'get', ownedItemsHandle, { index: i });
          if (itemResponse?.result?.handle) {
            // Load child WITHOUT recursing (level check in addSceneItem prevents recursion)
            await this.addSceneItem(sceneItems, itemResponse.result, null, childLevel);
          }
        }
      } else {
        // Regular Node: Load pins - EXACT COPY of SceneService logic
        const pinCountResponse = await this.apiService.callApi('ApiNode', 'pinCount', item.handle);
        const pinCount = pinCountResponse?.result || 0;

        for (let i = 0; i < pinCount; i++) {
          try {
            // 1. Get connected node FIRST
            const connectedResponse = await this.apiService.callApi(
              'ApiNode',
              'connectedNodeIx',
              item.handle,
              { pinIx: i, enterWrapperNode: true }
            );
            
            const connectedNode = connectedResponse?.result || null;
            
            // 2. Get pin info SECOND
            const pinInfoHandleResponse = await this.apiService.callApi(
              'ApiNode',
              'pinInfoIx',
              item.handle,
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
                // Call addSceneItem with connectedNode (may be null for unconnected pins)
                await this.addSceneItem(sceneItems, connectedNode, pinInfo, childLevel);
              }
            }
          } catch (pinError: any) {
            Logger.warn(`⚠️ Failed to load pin ${i}:`, pinError.message);
          }
        }
      }

      item.children = sceneItems;

      // 🎯 Load attrInfo for this node (needed for Node Inspector to show parameter values)
      try {
        const attrInfoResponse = await this.apiService.callApi(
          'ApiItem',
          'attrInfo',
          item.handle,
          { id: AttributeId.A_VALUE }
        );
        
        if (attrInfoResponse?.result && attrInfoResponse.result.type != "AT_UNKNOWN") {
          item.attrInfo = attrInfoResponse.result;
        }
      } catch (attrError: any) {
        // Some nodes don't have A_VALUE attribute, that's OK
        Logger.debug(`No attrInfo for "${item.name}": ${attrError.message}`);
      }

      // 🎯 Also load attrInfo for each CHILD (pin) node
      for (const child of sceneItems) {
        if (child.handle && child.handle !== 0) {
          try {
            const childAttrResponse = await this.apiService.callApi(
              'ApiItem',
              'attrInfo',
              child.handle,
              { id: AttributeId.A_VALUE }
            );
            
            if (childAttrResponse?.result && childAttrResponse.result.type != "AT_UNKNOWN") {
              child.attrInfo = childAttrResponse.result;
            }
          } catch (childAttrError: any) {
            // Unconnected pins (handle 0) or nodes without values
            Logger.debug(`No attrInfo for child "${child.name}": ${childAttrError.message}`);
          }
        }
      }
    } catch (error: any) {
      Logger.error(`❌ addItemChildrenShallow failed for "${item.name}":`, error.message);
      item.children = [];
    }
  }

  /**
   * Add item children - EXACT COPY from SceneService.addItemChildren
   * (Kept for compatibility, but progressive loading uses addItemChildrenShallow)
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
