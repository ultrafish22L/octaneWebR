/**
 * Scene Service - Scene tree building and management
 * Handles building and maintaining the scene hierarchy
 */

import { Logger } from '../../utils/Logger';
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';
import { Scene, SceneNode, SceneSyncProgress } from './types';
import { getIconForType } from '../../constants/PinTypes';
import { AttributeId } from '../../constants/OctaneTypes';

/**
 * Progressive loading configuration
 * BATCH_SIZE = 1: Update UI after each node (maximum feedback, per-node updates)
 * BATCH_SIZE = 10: Update every 10 nodes (balanced)
 * BATCH_SIZE = 30: Update every 30 nodes (minimal overhead)
 */
const PROGRESSIVE_LOAD_BATCH_SIZE = 1;

export class SceneService extends BaseService {
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
   * Builds or updates the scene tree
   * @param newNodeHandle - If provided, only builds metadata for this specific node (incremental update)
   *                        If omitted, performs full scene tree rebuild
   */
  async buildSceneTree(newNodeHandle?: number): Promise<SceneNode[]> {
    // Abort any previous build operation
    if (this.abortController) {
      Logger.debug('🚫 Cancelling previous scene tree build');
      this.abortController.abort();
    }
    
    // Create new abort controller for this operation
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    
    if (newNodeHandle !== undefined) {
      Logger.debug('➕ Building new node metadata:', newNodeHandle);
      
      try {
        const tempArray: SceneNode[] = [];
        const newNode = await this.addSceneItem(
          tempArray, 
          { handle: newNodeHandle }, 
          null, 
          1
        );
        
        if (newNode) {
          Logger.debug(`🔄 Building children for new node: ${newNode.name}`);
          await this.addItemChildren(newNode);
          Logger.debug('✅ Node metadata built:', newNode.name);
        } else {
          Logger.error('❌ Failed to create new scene node');
        }
        
        return this.scene.tree;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        Logger.error('❌ Failed to build new node metadata:', message);
        throw error;
      }
    }
    
    /**
     * Full rebuild: Clears scene state and reconstructs entire tree from root.
     * Used on initial connection or when incremental updates aren't sufficient.
     */
    Logger.info('🌳 Building scene tree...');
    
    this.scene = {
      tree: [],
      map: new Map(),
      connections: new Map()
    };
    
    try {
      // Check for cancellation
      if (signal.aborted) {
        throw new Error('Scene tree build was cancelled');
      }
      
      Logger.debug('🔍 Step 1: Getting root node graph...');
      const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
      if (!rootResponse || !rootResponse.result || !rootResponse.result.handle) {
        throw new Error('Failed to get root node graph');
      }
      
      const rootHandle = rootResponse.result.handle;
      Logger.debug('📍 Root handle:', rootHandle);
      
      // Check for cancellation
      if (signal.aborted) {
        throw new Error('Scene tree build was cancelled');
      }
      
      Logger.debug('🔍 Step 2: Checking if root is graph...');
      const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', rootHandle);
      const isGraph = isGraphResponse?.result || false;
      Logger.debug('📍 Is graph:', isGraph);
      
      // Check for cancellation
      if (signal.aborted) {
        throw new Error('Scene tree build was cancelled');
      }
      
      // Choose sync strategy based on configuration
      const startTime = performance.now();

      Logger.debug('🔍 Step 3: Building tree synchronously...');
      this.scene.tree = await this.syncSceneSequential(rootHandle, null, isGraph, 0);
      const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(2);
      
      Logger.info(`✅ Scene tree built in ${elapsedTime}s:`);
      Logger.info(`   - ${this.scene.tree.length} top-level items`);
      Logger.info(`   - ${this.scene.map.size} total nodes`);


      Logger.debug('🔍 Step 4: Emitting sceneTreeUpdated event...');
      this.emit('sceneTreeUpdated', this.scene);
      Logger.info('✅ SceneTreeUpdated event emitted');
      
      return this.scene.tree;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      
      // Don't log cancellation as error
      if (message.includes('cancelled')) {
        Logger.debug('🚫 Scene tree build cancelled');
      } else {
        Logger.error('❌ Failed to build scene tree:', message);
        if (error instanceof Error && error.stack) {
          Logger.error('❌ Error stack:', error.stack);
        }
      }
      throw error;
    }
  }

  /**
   * Progressive scene tree building - loads structure first, then details in batches
   * Provides live progress updates for large scenes (200+ seconds)
   */
  async buildSceneTreeProgressive(): Promise<SceneNode[]> {
    // Abort any previous build operation
    if (this.abortController) {
      Logger.debug('🚫 Cancelling previous scene tree build');
      this.abortController.abort();
    }
    
    // Create new abort controller for this operation
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    const startTime = performance.now();
    
    Logger.info('🌳 Building scene tree progressively...');
    
    // Reset scene
    this.scene = {
      tree: [],
      map: new Map(),
      connections: new Map()
    };
    
    try {
      // ===== PHASE 1: Quick Structure Load =====
      Logger.info('📊 Phase 1: Loading scene structure (fast)...');
      this.emit('sceneSyncStarted', { phase: 'structure' });
      
      // Check for cancellation
      if (signal.aborted) {
        throw new Error('Scene tree build was cancelled');
      }
      
      // Get root and build structure without pins
      Logger.debug('🔍 Getting root node graph...');
      const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
      if (!rootResponse || !rootResponse.result || !rootResponse.result.handle) {
        throw new Error('Failed to get root node graph');
      }
      
      const rootHandle = rootResponse.result.handle;
      const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', rootHandle);
      const isGraph = isGraphResponse?.result || false;
      
      // Build structure quickly (level 1 only, no children)
      const structureNodes = await this.buildSceneStructureFast(rootHandle, isGraph, signal);
      
      // Mark all nodes as skeleton state
      structureNodes.forEach(node => {
        node.loadingState = 'skeleton';
        node.childrenLoaded = false;
      });
      
      this.scene.tree = structureNodes;
      
      const structureTime = ((performance.now() - startTime) / 1000).toFixed(2);
      Logger.info(`✅ Phase 1 complete: ${structureNodes.length} nodes in ${structureTime}s`);
      
      // Emit structure immediately so UI can display
      this.emit('sceneStructureLoaded', {
        nodes: structureNodes,
        total: structureNodes.length
      });
      
      // ===== PHASE 2: Batch Pin Loading =====
      Logger.info('📊 Phase 2: Loading node details in batches...');
      
      const progress: SceneSyncProgress = {
        phase: 'details',
        nodesStructureLoaded: structureNodes.length,
        nodesPinsLoaded: 0,
        nodesTotal: structureNodes.length,
        elapsedTime: parseFloat(structureTime)
      };
      
      this.emit('sceneSyncProgress', progress);
      
      // Get all handles to load
      const allHandles = structureNodes
        .filter(n => n.handle && n.handle !== 0)
        .map(n => n.handle!);
      
      // Process in batches
      for (let i = 0; i < allHandles.length; i += PROGRESSIVE_LOAD_BATCH_SIZE) {
        // Check for cancellation
        if (signal.aborted) {
          throw new Error('Scene sync cancelled by user');
        }
        
        const batch = allHandles.slice(i, i + PROGRESSIVE_LOAD_BATCH_SIZE);
        
        // Load pins for this batch
        await this.loadNodePinsBatch(batch);
        
        // Mark nodes as loaded
        batch.forEach(handle => {
          const node = this.scene.map.get(handle);
          if (node) {
            node.loadingState = 'loaded';
            node.childrenLoaded = true;
          }
        });
        
        // Emit progress update
        const loaded = i + batch.length;
        const elapsed = (performance.now() - startTime) / 1000;
        const updatedProgress: SceneSyncProgress = {
          phase: 'details',
          nodesStructureLoaded: structureNodes.length,
          nodesPinsLoaded: loaded,
          nodesTotal: structureNodes.length,
          currentBatch: Math.floor(i / PROGRESSIVE_LOAD_BATCH_SIZE) + 1,
          elapsedTime: elapsed,
          estimatedTimeRemaining: this.estimateTimeRemaining(loaded, structureNodes.length, startTime)
        };
        
        this.emit('nodeBatchLoaded', {
          handles: batch,
          progress: updatedProgress
        });
        
        // Small delay to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      
      // ===== PHASE 3: Complete =====
      const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
      Logger.info(`✅ Scene sync complete: ${structureNodes.length} nodes in ${totalTime}s`);
      
      const finalProgress: SceneSyncProgress = {
        phase: 'complete',
        nodesStructureLoaded: structureNodes.length,
        nodesPinsLoaded: structureNodes.length,
        nodesTotal: structureNodes.length,
        elapsedTime: parseFloat(totalTime)
      };
      
      this.emit('sceneSyncComplete', finalProgress);
      this.emit('sceneTreeUpdated', this.scene);
      
      return this.scene.tree;
      
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      
      // Don't log cancellation as error
      if (message.includes('cancelled')) {
        Logger.info('🚫 Scene sync cancelled by user');
        this.emit('sceneSyncCancelled');
      } else {
        Logger.error('❌ Scene sync failed:', message);
        if (error instanceof Error && error.stack) {
          Logger.error('❌ Error stack:', error.stack);
        }
        this.emit('sceneSyncError', { error: message });
      }
      throw error;
    }
  }

  /**
   * Build scene structure quickly without loading pins/children
   * Returns level 1 nodes with basic metadata only
   */
  private async buildSceneStructureFast(
    rootHandle: number,
    isGraph: boolean,
    signal: AbortSignal
  ): Promise<SceneNode[]> {
    const sceneItems: SceneNode[] = [];
    
    try {
      if (isGraph) {
        // Get owned items from NodeGraph
        const ownedResponse = await this.apiService.callApi('ApiNodeGraph', 'getOwnedItems', rootHandle);
        if (!ownedResponse || !ownedResponse.list || !ownedResponse.list.handle) {
          throw new Error('Failed to get owned items from root graph');
        }
        
        const ownedItemsHandle = ownedResponse.list.handle;
        const countResponse = await this.apiService.callApi('ApiItemArray', 'size', ownedItemsHandle);
        const count = countResponse?.result || 0;
        
        Logger.debug(`📍 Found ${count} top-level items in scene graph`);
        
        // Fetch basic metadata for each item (no children yet)
        for (let i = 0; i < count; i++) {
          if (signal.aborted) break;
          
          const itemResponse = await this.apiService.callApi('ApiItemArray', 'get', ownedItemsHandle, { index: i });
          if (itemResponse && itemResponse.result && itemResponse.result.handle) {
            await this.addSceneItemFast(sceneItems, itemResponse.result, null, 1);
          }
        }
      }
      
      Logger.debug(`✅ Fast structure load complete: ${sceneItems.length} nodes`);
      return sceneItems;
      
    } catch (error: any) {
      Logger.error('❌ buildSceneStructureFast failed:', error.message);
      throw error;
    }
  }

  /**
   * Add scene item with basic metadata only (no children/pins)
   */
  private async addSceneItemFast(
    sceneItems: SceneNode[],
    item: any,
    pinInfo: any,
    level: number
  ): Promise<SceneNode | undefined> {
    if (!item || !item.handle || item.handle === 0) {
      return undefined;
    }
    
    const handleNum = Number(item.handle);
    
    // Check if already exists
    const existing = this.scene.map.get(handleNum);
    if (existing) {
      existing.pinInfo = pinInfo;
      sceneItems.push(existing);
      return existing;
    }
    
    try {
      // Fetch basic metadata only
      const nameResponse = await this.apiService.callApi('ApiItem', 'name', item.handle);
      const itemName = nameResponse?.result || 'Unnamed';
      
      const outTypeResponse = await this.apiService.callApi('ApiItem', 'outType', item.handle);
      const outType = outTypeResponse?.result || '';
      
      const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', item.handle);
      const isGraph = isGraphResponse?.result || false;
      
      // Fetch position for top-level nodes
      let position: { x: number; y: number } | null = null;
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
          Logger.debug(`  ⚠️ Failed to get position for ${itemName}`);
        }
      }
      
      // Fetch graph/node info
      let graphInfo = null;
      let nodeInfo = null;
      if (isGraph) {
        const infoResponse = await this.apiService.callApi('ApiNodeGraph', 'info1', item.handle);
        graphInfo = infoResponse?.result || null;
      } else {
        const infoResponse = await this.apiService.callApi('ApiNode', 'info', item.handle);
        nodeInfo = infoResponse?.result || null;
      }
      
      const displayName = pinInfo?.staticLabel || itemName;
      const icon = this.getNodeIcon(outType, displayName);
      
      const entry: SceneNode = {
        level,
        name: displayName,
        handle: item.handle,
        type: outType,
        typeEnum: typeof outType === 'number' ? outType : 0,
        outType: outType,
        icon,
        visible: true,
        graphInfo,
        nodeInfo,
        pinInfo,
        children: [],  // Empty for now
        position,
        loadingState: 'skeleton',
        childrenLoaded: false
      };
      
      sceneItems.push(entry);
      this.scene.map.set(handleNum, entry);
      
      Logger.debug(`  📄 Added skeleton node: ${itemName} (type: "${outType}", level: ${level})`);
      
      return entry;
      
    } catch (error: any) {
      Logger.error('❌ addSceneItemFast failed:', error.message);
      return undefined;
    }
  }

  /**
   * Load pins/children for a batch of nodes
   */
  private async loadNodePinsBatch(handles: number[]): Promise<void> {
    await Promise.all(
      handles.map(async (handle) => {
        const node = this.scene.map.get(handle);
        if (node && !node.childrenLoaded) {
          try {
            await this.addItemChildren(node);
            node.loadingState = 'loaded';
            node.childrenLoaded = true;
          } catch (error: any) {
            Logger.warn(`⚠️ Failed to load pins for node ${handle}:`, error.message);
            node.loadingState = 'error';
            node.loadError = error.message;
          }
        }
      })
    );
  }

  /**
   * Estimate time remaining for progressive loading
   */
  private estimateTimeRemaining(loaded: number, total: number, startTime: number): number {
    if (loaded === 0) return 0;
    
    const elapsed = (performance.now() - startTime) / 1000;
    const rate = loaded / elapsed;  // nodes per second
    const remaining = total - loaded;
    return Math.ceil(remaining / rate);
  }

  /**
   * Cancel in-progress scene sync
   */
  cancelSceneSync(): void {
    if (this.abortController) {
      Logger.debug('🚫 Cancelling scene sync...');
      this.abortController.abort();
    }
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

  async setNodeVisibility(handle: number, visible: boolean): Promise<void> {
    await this.apiService.callApi('ApiSceneOutliner', 'setNodeVisibility', { handle, visible });
  }

  getScene(): Scene {
    return this.scene;
  }

  /**
   * Recursively builds scene tree by traversing node graphs and their pins
   * @param itemHandle - Current item to process (null = start from root)
   * @param sceneItems - Accumulator array for nodes at this level
   * @param isGraph - Whether current item is a NodeGraph (contains owned items vs pins)
   * @param level - Current recursion depth (limited to 5 to prevent infinite loops)
   */
  /**
   * SEQUENTIAL scene loading - Original proven implementation
   * Processes nodes one at a time in order
   * Always works correctly, used as fallback when parallel is disabled
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
      
      /**
       * NodeGraph vs Node traversal strategy:
       * - NodeGraphs contain "owned items" (child nodes) via getOwnedItems()
       * - Regular Nodes expose connections via their pins via connectedNodeIx()
       * This branch handles NodeGraphs by iterating their owned items array
       */
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
        
        // Only build deep children for top-level items (avoids exponential API calls)
        if (level === 1) {
          Logger.debug(`🔄 Building children for ${sceneItems.length} level 1 items`);
          for (const item of sceneItems) {
            Logger.debug(`📍 Before addItemChildren for ${item.name} (handle: ${item.handle})`);
            await this.addItemChildren(item);
            Logger.debug(`📍 After addItemChildren for ${item.name}, children count: ${item.children?.length || 0}`);
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          Logger.debug(`✅ Finished building children for all level 1 items`);
          
          // 🎯 PROGRESSIVE UPDATE: Emit after level 1 completes
//          Logger.debug(`📡 Sequential: Emitting progressive update after level ${level}`);
//
        }
      } else if (itemHandle != 0) {
        // Regular nodes: iterate through pins to find connected nodes
        Logger.debug(`📌 Level ${level}: Processing node pins for handle ${itemHandle}`);
        
        try {
          const pinCountResponse = await this.apiService.callApi('ApiNode', 'pinCount', itemHandle);
          const pinCount = pinCountResponse?.result || 0;
          
          Logger.debug(`  Found ${pinCount} pins`);
          
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
              Logger.warn(`  ⚠️ Failed to load pin ${i}:`, pinError.message);
            }
          }
        } catch (pinCountError: any) {
          Logger.error(`  ❌ Failed to get pin count:`, pinCountError.message);
        }
      }
      
    } catch (error: any) {
      Logger.error('❌ syncSceneSequential failed:', error.message);
    }
    
    return sceneItems;
  }

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
      
      if (level > 1) {
        await this.addItemChildren(entry);
      }
    }
    
    return entry;
  }

  private async addItemChildren(item: SceneNode): Promise<void> {
    if (!item || !item.handle) {
      return;
    }
    
    const isGraph = item.graphInfo !== null && item.graphInfo !== undefined;
    
    try {
      const children = await this.syncSceneSequential(item.handle, null, isGraph, item.level || 1);
      item.children = children;
      
      if (children.length === 0) {
        try {
          const attrInfoResponse = await this.apiService.callApi(
            'ApiItem',
            'attrInfo',
            item.handle,
            { id: AttributeId.A_VALUE }
          );
          
          if (attrInfoResponse?.result && attrInfoResponse.result.type != "AT_UNKNOWN") {
            item.attrInfo = attrInfoResponse.result;
            Logger.debug(`  📊 End node: ${item.name} (${attrInfoResponse.result.type})`);
          }
        } catch (attrError: any) {
          Logger.debug(`  ℹ️ No attrInfo for ${item.name}`);
        }
      } else {
        Logger.debug(`  👶 Added ${children.length} children to ${item.name}`);
      }
      
    } catch (error: any) {
      Logger.error('❌ addItemChildren failed:', error.message);
    }
  }

  private getNodeIcon(outType: string | number, name?: string): string {
    const typeStr = typeof outType === 'string' ? outType : String(outType);
    return getIconForType(typeStr, name);
  }
}
