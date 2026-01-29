/**
 * Scene Service - Scene tree building and management
 * Handles building and maintaining the scene hierarchy
 */

import { Logger } from '../../utils/Logger';
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';
import { 
  Scene, 
  SceneNode, 
  SceneNodeAddedEvent, 
  SceneNodeUpdatedEvent,
  SceneLoadingProgressEvent 
} from './types';
import { getIconForType } from '../../constants/PinTypes';
import { AttributeId } from '../../constants/OctaneTypes';
import { parallelLimitSettled } from '../../utils/parallelAsync';

/**
 * Configuration for parallel scene loading and progressive updates
 */
const PARALLEL_CONFIG = {
  /** Maximum concurrent API calls for localhost gRPC */
  MAX_CONCURRENT_REQUESTS: 220,
  /** Maximum concurrent owned items to fetch in parallel */
  MAX_CONCURRENT_ITEMS: 150,
  /** Maximum concurrent pins to fetch in parallel */
  MAX_CONCURRENT_PINS: 150,
  
  /**
   * 🔧 Phase 2: Enable Progressive Loading
   * - true: Emit events as nodes load (better perceived performance)
   * - false: Only emit final sceneTreeUpdated event (simpler, less overhead)
   */
  ENABLE_PROGRESSIVE_LOADING: true,
  
  /**
   * 🔧 Phase 4: Enable Smart Prioritized Loading (Breadth-First)
   * - true: Load top-level nodes FIRST, then children (user sees roots immediately)
   * - false: Use depth-first recursion (loads deep nodes first, original behavior)
   * 
   * Recommended: true (much better perceived performance)
   * When enabled, loads scene in this order:
   *   1. Level 0 (root nodes) - visible in ~0.3-0.5s
   *   2. Level 1 (direct children) - visible in ~0.6-1.0s
   *   3. Level 2, 3, etc. (progressively)
   */
  ENABLE_PRIORITIZED_LOADING: true,
} as const;

export class SceneService extends BaseService {
  private apiService: ApiService;
  private scene: Scene;
  
  // Progressive loading tracking (Phase 2)
  private loadingProgress = {
    totalNodes: 0,
    nodesLoaded: 0,
    phase: 'metadata' as 'metadata' | 'children' | 'complete'
  };

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
      } catch (error: any) {
        Logger.error('❌ Failed to build new node metadata:', error.message);
        throw error;
      }
    }
    
    /**
     * Full rebuild: Clears scene state and reconstructs entire tree from root.
     * Used on initial connection or when incremental updates aren't sufficient.
     */
    const startTime = performance.now();
    const mode = PARALLEL_CONFIG.ENABLE_PROGRESSIVE_LOADING ? 'PARALLEL + PROGRESSIVE' : 'PARALLEL';
    Logger.info(`🌳 Building scene tree (${mode} MODE)...`);
    
    // Reset progress tracking (Phase 2 - optional)
    if (PARALLEL_CONFIG.ENABLE_PROGRESSIVE_LOADING) {
      this.loadingProgress = {
        totalNodes: 0,
        nodesLoaded: 0,
        phase: 'metadata'
      };
    }
    
    this.scene = {
      tree: [],
      map: new Map(),
      connections: new Map()
    };
    
    // Emit initial loading state (Phase 2 - optional)
    if (PARALLEL_CONFIG.ENABLE_PROGRESSIVE_LOADING) {
      this.emitProgress();
    }
    
    try {
      Logger.debug('🔍 Step 1: Getting root node graph...');
      const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
      if (!rootResponse || !rootResponse.result || !rootResponse.result.handle) {
        throw new Error('Failed to get root node graph');
      }
      
      const rootHandle = rootResponse.result.handle;
      Logger.debug('📍 Root handle:', rootHandle);
      
      Logger.debug('🔍 Step 2: Checking if root is graph...');
      const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', rootHandle);
      const isGraph = isGraphResponse?.result || false;
      Logger.debug('📍 Is graph:', isGraph);
      
      Logger.debug('🔍 Step 3: Building tree with parallel fetching...');
      
      // Phase 4: Smart Prioritized Loading (Breadth-First)
      // When enabled, loads all nodes at level N before ANY nodes at level N+1
      // This ensures top-level nodes appear immediately!
      if (PARALLEL_CONFIG.ENABLE_PRIORITIZED_LOADING) {
        Logger.debug('   Using BREADTH-FIRST loading: Level 0 → Level 1 → Level 2...');
        Logger.debug('   Watch for ⚡ TOP-LEVEL markers showing when roots are visible');
      } else {
        Logger.debug('   Using DEPTH-FIRST loading: Original order');
      }
      this.scene.tree = await this.syncSceneRecurse(rootHandle, null, isGraph, 0);
      
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      Logger.success(`✅ Scene tree built in ${duration}s:`);
      Logger.success(`   - ${this.scene.tree.length} top-level items`);
      Logger.success(`   - ${this.scene.map.size} total nodes`);
      Logger.success(`   - Concurrency: ${PARALLEL_CONFIG.MAX_CONCURRENT_REQUESTS} max parallel requests`);
      if (PARALLEL_CONFIG.ENABLE_PROGRESSIVE_LOADING) {
        Logger.success(`   - Progressive loading: ENABLED ⚡`);
      }
      if (PARALLEL_CONFIG.ENABLE_PRIORITIZED_LOADING) {
        Logger.success(`   - Smart prioritized (breadth-first): ENABLED 🎯`);
      }
      
      // Emit final progress event (Phase 2 - optional)
      if (PARALLEL_CONFIG.ENABLE_PROGRESSIVE_LOADING) {
        this.loadingProgress.phase = 'complete';
        this.emitProgress();
      }
      
      Logger.debug('🔍 Step 4: Emitting sceneTreeUpdated event...');
      this.emit('sceneTreeUpdated', this.scene);
      Logger.debug('✅ SceneTreeUpdated event emitted');
      
      return this.scene.tree;
    } catch (error: any) {
      Logger.error('❌ Failed to build scene tree:', error.message);
      Logger.error('❌ Error stack:', error.stack);
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
   * Emit progress event for progressive loading (Phase 2)
   */
  private emitProgress(): void {
    if (!PARALLEL_CONFIG.ENABLE_PROGRESSIVE_LOADING) return;
    
    const progress = this.loadingProgress.totalNodes > 0
      ? Math.round((this.loadingProgress.nodesLoaded / this.loadingProgress.totalNodes) * 100)
      : 0;
    
    const event: SceneLoadingProgressEvent = {
      phase: this.loadingProgress.phase,
      progress,
      nodesLoaded: this.loadingProgress.nodesLoaded,
      totalNodes: this.loadingProgress.totalNodes
    };
    
    this.emit('sceneLoadingProgress', event);
    
    Logger.debug(`📊 Progress: ${progress}% (${this.loadingProgress.nodesLoaded}/${this.loadingProgress.totalNodes} nodes, phase: ${this.loadingProgress.phase})`);
  }

  /**
   * Recursively builds scene tree by traversing node graphs and their pins
   * @param itemHandle - Current item to process (null = start from root)
   * @param sceneItems - Accumulator array for nodes at this level
   * @param isGraph - Whether current item is a NodeGraph (contains owned items vs pins)
   * @param level - Current recursion depth (limited to 5 to prevent infinite loops)
   */
  private async syncSceneRecurse(
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
    if (level > 5) {
      Logger.warn(`⚠️ Recursion depth limit reached at level ${level}`);
      return sceneItems;
    }
    
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
        
        Logger.debug(`📦 Level ${level}: Found ${size} owned items - fetching in parallel...`);
        
        // ⚡ PARALLEL OPTIMIZATION: Fetch all owned items concurrently
        const itemResults = await parallelLimitSettled(
          Array.from({ length: size }, (_, i) => i),
          PARALLEL_CONFIG.MAX_CONCURRENT_ITEMS,
          async (index) => {
            const itemResponse = await this.apiService.callApi('ApiItemArray', 'get', ownedItemsHandle, { index });
            if (itemResponse && itemResponse.result && itemResponse.result.handle) {
              return { index, item: itemResponse.result };
            }
            return null;
          }
        );
        
        // Process items maintaining order
        const validItems = itemResults
          .map((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
              return result.value;
            } else if (result.status === 'rejected') {
              Logger.warn(`  ⚠️ Failed to fetch owned item ${index}:`, result.reason);
            }
            return null;
          })
          .filter((item): item is { index: number; item: any } => item !== null)
          .sort((a, b) => a.index - b.index);
        
        // Add scene items (addSceneItem itself is now parallel)
        for (const { item } of validItems) {
          await this.addSceneItem(sceneItems, item, null, level);
        }
        
        Logger.debug(`✅ Level ${level}: Added ${validItems.length}/${size} owned items`);
        
        // Phase 4: Build children after all siblings when prioritized loading enabled
        // Phase 1-3: Only build children for level 1 (original behavior)
        const shouldBuildChildren = PARALLEL_CONFIG.ENABLE_PRIORITIZED_LOADING || level === 1;
        
        if (shouldBuildChildren && sceneItems.length > 0) {
          Logger.debug(`🔄 Building children for ${sceneItems.length} level ${level} items in parallel...`);
          
          // ⚡ PARALLEL OPTIMIZATION: Build all children concurrently
          const childResults = await parallelLimitSettled(
            sceneItems,
            PARALLEL_CONFIG.MAX_CONCURRENT_ITEMS,
            async (item) => {
              Logger.debug(`📍 Building children for ${item.name} (handle: ${item.handle})`);
              await this.addItemChildren(item);
              Logger.debug(`📍 Finished ${item.name}, children: ${item.children?.length || 0}`);
              return item;
            }
          );
          
          const successCount = childResults.filter(r => r.status === 'fulfilled').length;
          Logger.debug(`✅ Finished building children: ${successCount}/${sceneItems.length} successful`);
        }
      } else if (itemHandle != 0) {
        // Regular nodes: iterate through pins to find connected nodes
        Logger.debug(`📌 Level ${level}: Processing node pins for handle ${itemHandle}`);
        
        try {
          const pinCountResponse = await this.apiService.callApi('ApiNode', 'pinCount', itemHandle);
          const pinCount = pinCountResponse?.result || 0;
          
          Logger.debug(`  Found ${pinCount} pins - fetching in parallel...`);
          
          // ⚡ PARALLEL OPTIMIZATION: Fetch all pin data concurrently
          const pinResults = await parallelLimitSettled(
            Array.from({ length: pinCount }, (_, i) => i),
            PARALLEL_CONFIG.MAX_CONCURRENT_PINS,
            async (pinIndex) => {
              // Fetch connected node and pin info in parallel
              const [connectedResponse, pinInfoHandleResponse] = await Promise.all([
                this.apiService.callApi(
                  'ApiNode',
                  'connectedNodeIx',
                  itemHandle,
                  { pinIx: pinIndex, enterWrapperNode: true }
                ),
                this.apiService.callApi(
                  'ApiNode',
                  'pinInfoIx',
                  itemHandle,
                  { index: pinIndex }
                )
              ]);
              
              const connectedNode = connectedResponse?.result || null;
              
              if (pinInfoHandleResponse && pinInfoHandleResponse.result && pinInfoHandleResponse.result.handle) {
                const pinInfoResponse = await this.apiService.callApi(
                  'ApiNodePinInfoEx',
                  'getApiNodePinInfo',
                  pinInfoHandleResponse.result.handle
                );
                
                const pinInfo = pinInfoResponse?.nodePinInfo || null;
                if (pinInfo) {
                  pinInfo.ix = pinIndex;
                  return { connectedNode, pinInfo };
                }
              }
              
              return null;
            }
          );
          
          // Process pins maintaining order
          for (let i = 0; i < pinResults.length; i++) {
            const result = pinResults[i];
            if (result.status === 'fulfilled' && result.value) {
              const { connectedNode, pinInfo } = result.value;
              await this.addSceneItem(sceneItems, connectedNode, pinInfo, level);
            } else if (result.status === 'rejected') {
              Logger.warn(`  ⚠️ Failed to load pin ${i}:`, result.reason);
            }
          }
          
          Logger.debug(`✅ Processed ${pinCount} pins`);
          
        } catch (pinCountError: any) {
          Logger.error(`  ❌ Failed to get pin count:`, pinCountError.message);
        }
      }
      
    } catch (error: any) {
      Logger.error('❌ syncSceneRecurse failed:', error.message);
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
        // ⚡ PARALLEL OPTIMIZATION: Fetch all metadata concurrently
        const metadataPromises = [
          this.apiService.callApi('ApiItem', 'name', item.handle),
          this.apiService.callApi('ApiItem', 'outType', item.handle),
          this.apiService.callApi('ApiItem', 'isGraph', item.handle),
          level === 1 ? this.apiService.callApi('ApiItem', 'position', item.handle) : Promise.resolve(null),
        ];
        
        const [nameResponse, outTypeResponse, isGraphResponse, posResponse] = 
          await Promise.all(metadataPromises);
        
        itemName = nameResponse?.result || 'Unnamed';
        outType = outTypeResponse?.result || '';
        isGraph = isGraphResponse?.result || false;
        
        Logger.debug(`  🔍 API returned outType: "${outType}" (type: ${typeof outType}) for ${itemName}`);
        
        // Parse position for level 1 nodes
        if (level === 1 && posResponse?.result) {
          position = {
            x: posResponse.result.x || 0,
            y: posResponse.result.y || 0
          };
          Logger.debug(`  📍 Position for ${itemName}: (${position.x}, ${position.y})`);
        }
        
        // Fetch graph or node info based on type
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
      position,
      // Progressive loading state (Phase 2)
      loading: false,
      childrenLoaded: false,
      childrenLoading: false
    };
    
    sceneItems.push(entry);
    
    if (item != null && item.handle != 0) {
      const handleNum = Number(item.handle);
      this.scene.map.set(handleNum, entry);
      Logger.debug(`  📄 Added item: ${itemName} (type: "${outType}", icon: ${icon}, level: ${level})`);
      
      // Emit progressive event for this node (Phase 2 - optional)
      if (PARALLEL_CONFIG.ENABLE_PROGRESSIVE_LOADING) {
        this.loadingProgress.nodesLoaded++;
        const nodeAddedEvent: SceneNodeAddedEvent = {
          node: entry,
          level: level
        };
        this.emit('sceneNodeAdded', nodeAddedEvent);
        
        // Log when TOP-LEVEL nodes are added (Phase 4 - visual confirmation)
        if (level === 1) {
          Logger.success(`⚡ TOP-LEVEL node visible: "${entry.name}" (level ${level})`);
        }
        
        // Throttled progress update (every 10 nodes or at key milestones)
        if (this.loadingProgress.nodesLoaded % 10 === 0 || level === 1) {
          this.emitProgress();
        }
      }
      
      // Phase 4: DEFER children building when prioritized loading is enabled
      // Children will be built in batch after all siblings (breadth-first)
      if (level > 1 && !PARALLEL_CONFIG.ENABLE_PRIORITIZED_LOADING) {
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
      const children = await this.syncSceneRecurse(item.handle, null, isGraph, item.level || 1);
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
