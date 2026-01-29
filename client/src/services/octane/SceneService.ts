/**
 * Scene Service - Scene tree building and management
 * Handles building and maintaining the scene hierarchy
 */

import { Logger } from '../../utils/Logger';
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';
import { Scene, SceneNode } from './types';
import { getIconForType } from '../../constants/PinTypes';
import { AttributeId } from '../../constants/OctaneTypes';
import { PARALLEL_CONFIG } from './parallelConfig';
import { parallelLimit } from './parallelUtils';

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
    Logger.debug('🌳 Building scene tree...');
    
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
      if (PARALLEL_CONFIG.ENABLED) {
        Logger.info('🔍 Step 3: Building tree with PARALLEL loading...');
        this.scene.tree = await this.syncSceneParallel(rootHandle, null, isGraph, 0);
      } else {
        Logger.info('🔍 Step 3: Building tree with SEQUENTIAL loading...');
        this.scene.tree = await this.syncSceneSequential(rootHandle, null, isGraph, 0);
      }
      const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(2);
      
      Logger.info(`✅ Scene tree built in ${elapsedTime}s:`);
      Logger.info(`   - ${this.scene.tree.length} top-level items`);
      Logger.info(`   - ${this.scene.map.size} total nodes`);
      Logger.info(`   - Mode: ${PARALLEL_CONFIG.ENABLED ? 'PARALLEL' : 'SEQUENTIAL'}`);
      
      Logger.debug('🔍 Step 4: Emitting sceneTreeUpdated event...');
      this.emit('sceneTreeUpdated', this.scene);
      Logger.debug('✅ SceneTreeUpdated event emitted');
      
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
    
    // Safety limit: Prevent runaway recursion in circular graphs
    // NOTE: Disabled - scene.map reservation system already prevents duplicates and infinite loops
    // if (level > PARALLEL_CONFIG.MAX_DEPTH) {
    //   Logger.warn(`⚠️ Recursion depth limit reached at level ${level} (max: ${PARALLEL_CONFIG.MAX_DEPTH})`);
    //   return sceneItems;
    // }
    
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
          Logger.debug(`📡 Sequential: Emitting progressive update after level ${level}`);
          this.emit('sceneTreeUpdated', this.scene);
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
      Logger.error('❌ syncSceneRecurse failed:', error.message);
    }
    
    return sceneItems;
  }

  /**
   * PARALLEL scene loading - Optimized implementation  
   * Processes multiple nodes concurrently for faster loading
   * Uses parallelLimit to respect browser connection pool limits
   */
  private async syncSceneParallel(
    itemHandle: number | null,
    sceneItems: SceneNode[] | null,
    isGraph: boolean,
    level: number
  ): Promise<SceneNode[]> {
    if (sceneItems === null) {
      sceneItems = [];
    }
    
    level = level + 1;
    
    // Safety limit: Prevent runaway recursion in circular graphs
    // NOTE: Disabled - scene.map reservation system already prevents duplicates and infinite loops
    // if (level > PARALLEL_CONFIG.MAX_DEPTH) {
    //   Logger.warn(`⚠️ Recursion depth limit reached at level ${level} (max: ${PARALLEL_CONFIG.MAX_DEPTH})`);
    //   return sceneItems;
    // }
    
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
       * NodeGraph: Process owned items with parallelization
       */
      if (isGraph) {
        const ownedResponse = await this.apiService.callApi('ApiNodeGraph', 'getOwnedItems', itemHandle);
        if (!ownedResponse || !ownedResponse.list || !ownedResponse.list.handle) {
          throw new Error('Failed ApiNodeGraph/getOwnedItems');
        }
        const ownedItemsHandle = ownedResponse.list.handle;
        
        const sizeResponse = await this.apiService.callApi('ApiItemArray', 'size', ownedItemsHandle);
        const size = sizeResponse?.result || 0;
        
        Logger.debug(`📦 Level ${level}: Found ${size} owned items (parallel mode)`);
        
        // ⚡ PARALLEL: Fetch all items concurrently
        const itemHandles = Array.from({ length: size }, (_, i) => i);
        const itemResults = await parallelLimit(itemHandles, PARALLEL_CONFIG.MAX_CONCURRENT, async (i) => {
          const itemResponse = await this.apiService.callApi('ApiItemArray', 'get', ownedItemsHandle, { index: i });
          return itemResponse?.result || null;
        });
        
        // Add all items to scene (this is fast, doesn't need parallelization)
        for (const item of itemResults) {
          if (item && item.handle) {
            await this.addSceneItem(sceneItems, item, null, level);
          }
        }
        
        // ⚡ PARALLEL: Build children for all items at this level concurrently
        // Recursively parallelizes all levels - MAX_CONCURRENT limit prevents overload
        Logger.debug(`🔄 Building children for ${sceneItems.length} level ${level} items (parallel)`);
        await parallelLimit(sceneItems, PARALLEL_CONFIG.MAX_CONCURRENT, async (item) => {
          await this.addItemChildren(item);
        });
        Logger.debug(`✅ Finished building children for ${sceneItems.length} level ${level} items`);
        
        // 🎯 PROGRESSIVE UPDATE: Emit after each level completes (for top levels only)
        if (level <= 2) {
          Logger.debug(`📡 Parallel: Emitting progressive update after level ${level} (NodeGraph)`);
          this.emit('sceneTreeUpdated', this.scene);
        }
      } else if (itemHandle != 0) {
        // Regular nodes: iterate through pins to find connected nodes
        Logger.debug(`📌 Level ${level}: Processing node pins for handle ${itemHandle} (parallel mode)`);
        
        try {
          const pinCountResponse = await this.apiService.callApi('ApiNode', 'pinCount', itemHandle);
          const pinCount = pinCountResponse?.result || 0;
          
          Logger.debug(`  Found ${pinCount} pins`);
          
          // ⚡ PARALLEL: Fetch all pin info concurrently
          const pinIndexes = Array.from({ length: pinCount }, (_, i) => i);
          const pinResults = await parallelLimit(pinIndexes, PARALLEL_CONFIG.MAX_CONCURRENT, async (i) => {
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
                  return { connectedNode, pinInfo };
                }
              }
            } catch (pinError: any) {
              Logger.warn(`  ⚠️ Failed to load pin ${i}:`, pinError.message);
            }
            return null;
          });
          
          // Add all connected nodes to scene
          for (const result of pinResults) {
            if (result) {
              await this.addSceneItem(sceneItems, result.connectedNode, result.pinInfo, level);
            }
          }
          
          // ⚡ PARALLEL: Build children for all items at this level concurrently
          // Matches graph logic - ensures all nodes get children populated
          Logger.debug(`🔄 Building children for ${sceneItems.length} level ${level} items (parallel)`);
          await parallelLimit(sceneItems, PARALLEL_CONFIG.MAX_CONCURRENT, async (item) => {
            await this.addItemChildren(item);
          });
          Logger.debug(`✅ Finished building children for ${sceneItems.length} level ${level} items`);
          
          // 🎯 PROGRESSIVE UPDATE: Emit after each level completes (for top levels only)
          if (level <= 2) {
            Logger.debug(`📡 Parallel: Emitting progressive update after level ${level} (Regular nodes)`);
            this.emit('sceneTreeUpdated', this.scene);
          }
        } catch (pinCountError: any) {
          Logger.error(`  ❌ Failed to get pin count:`, pinCountError.message);
        }
      }
      
    } catch (error: any) {
      Logger.error('❌ syncSceneParallel failed:', error.message);
    }
    
    return sceneItems;
  }

  private async addSceneItem(
    sceneItems: SceneNode[],
    item: any,
    pinInfo: any,
    level: number
  ): Promise<SceneNode | undefined> {
    const initialName = item?.name || pinInfo?.staticLabel || 'Unnamed';
    const initialType = pinInfo?.outType || '';
    
    // Handle unconnected pins (handle = 0)
    if (item == null || item.handle == 0) {
      Logger.debug(`  ⚪ Unconnected pin: ${initialName}`);
      
      const displayName = pinInfo?.staticLabel || initialName;
      const icon = this.getNodeIcon(initialType, displayName);
      
      const entry: SceneNode = {
        level,
        name: displayName,
        handle: item?.handle,
        type: initialType,
        typeEnum: typeof initialType === 'number' ? initialType : 0,
        outType: initialType,
        icon,
        visible: true,
        graphInfo: undefined,
        nodeInfo: undefined,
        pinInfo,
        children: [],
        position: undefined
      };
      
      sceneItems.push(entry);
      return entry;
    }
    
    // Check if node already exists
    const handleNum = Number(item.handle);
    const existing = this.scene.map.get(handleNum);
    if (existing && existing.handle && !(existing as any)._reserved) {
      // Update pinInfo if needed and return existing node
      if (pinInfo) {
        existing.pinInfo = pinInfo;
      }
      if (level > 1) {
        sceneItems.push(existing);
      }
      return existing;
    }
    
    // 🔒 Reserve this handle with minimal marker to prevent race conditions
    // Other threads will see _reserved: true and know this node is being processed
    const reservationMarker = { handle: item.handle, _reserved: true } as any;
    this.scene.map.set(handleNum, reservationMarker);
    
    try {
      // ⚡ Fetch all basic data in parallel
      const [nameResponse, outTypeResponse, isGraphResponse] = await Promise.all([
        this.apiService.callApi('ApiItem', 'name', item.handle),
        this.apiService.callApi('ApiItem', 'outType', item.handle),
        this.apiService.callApi('ApiItem', 'isGraph', item.handle)
      ]);
      
      const itemName = nameResponse?.result || 'Unnamed';
      const outType = outTypeResponse?.result || '';
      const isGraph = isGraphResponse?.result || false;
      
      Logger.debug(`  🔍 API returned outType: "${outType}" (type: ${typeof outType}) for ${itemName}`);
      
      // Fetch additional data based on node type
      let position: { x: number; y: number } | undefined = undefined;
      let graphInfo = undefined;
      let nodeInfo = undefined;
      
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
        } catch (posError: unknown) {
          const message = posError instanceof Error ? posError.message : String(posError);
          Logger.warn(`  ⚠️ Failed to get position for ${itemName}:`, message);
        }
      }
      
      if (isGraph) {
        const infoResponse = await this.apiService.callApi('ApiNodeGraph', 'info1', item.handle);
        graphInfo = infoResponse?.result || null;
      } else {
        const infoResponse = await this.apiService.callApi('ApiNode', 'info', item.handle);
        nodeInfo = infoResponse?.result || null;
      }
      
      // ✅ Build complete immutable node object
      const displayName = pinInfo?.staticLabel || itemName;
      const icon = this.getNodeIcon(outType, displayName);
      
      const completeNode: SceneNode = {
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
        children: [],
        position
      };
      
      // ✅ Replace reservation with complete node (atomic operation)
      this.scene.map.set(handleNum, completeNode);
      sceneItems.push(completeNode);
      
      Logger.debug(`  📄 Added item: ${itemName} (type: "${outType}", icon: ${icon}, level: ${level})`);
      
      // Build children for level > 1 nodes (sequential mode requires this)
      // In parallel mode, syncSceneParallel handles children building for all levels
      if (level > 1 && !PARALLEL_CONFIG.ENABLED) {
        await this.addItemChildren(completeNode);
      }
      
      return completeNode;
      
    } catch (error: unknown) {
      // ✅ Cleanup: Remove failed reservation
      this.scene.map.delete(handleNum);
      const message = error instanceof Error ? error.message : String(error);
      Logger.error('❌ addSceneItem failed to fetch item data:', message);
      throw error;
    }
  }

  private async addItemChildren(item: SceneNode): Promise<void> {
    if (!item || !item.handle) {
      return;
    }
    
    const isGraph = item.graphInfo !== null && item.graphInfo !== undefined;
    
    try {
      // Call the appropriate recursive method based on configuration
      const children = PARALLEL_CONFIG.ENABLED
        ? await this.syncSceneParallel(item.handle, null, isGraph, item.level || 1)
        : await this.syncSceneSequential(item.handle, null, isGraph, item.level || 1);
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
