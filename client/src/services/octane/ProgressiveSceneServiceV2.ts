/**
 * ProgressiveSceneServiceV2 - Visibility-aware progressive scene loading
 * 
 * Key improvements over V1:
 * 1. Skeleton-first loading for instant UI feedback
 * 2. Visibility-aware prioritization (load what user sees first)
 * 3. Background loading with pause/resume on scroll
 * 4. Optional lazy attrInfo loading
 * 5. Parallel API calls with concurrency limiting
 * 
 * Loading Phases:
 * - Phase 1 (Skeleton): Load basic node structure (~200ms)
 * - Phase 2 (Visible): Load details for visible nodes (~500ms)
 * - Phase 3 (Background): Load remaining nodes (async)
 * - Phase 4 (On-demand): Load attrInfo when node selected
 * 
 * Created: 2025-02-11
 */

import { Logger } from '../../utils/Logger';
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';
import {
  Scene,
  SceneNode,
  SkeletonNode,
  LoadPhase,
  V2ProgressEvent,
  ProgressiveConfigV2,
} from './types';
import { LoadingScheduler } from './LoadingScheduler';
import { getIconForType } from '../../constants/PinTypes';
import { AttributeId } from '../../constants/OctaneTypes';
import { FEATURES } from '../../config/features';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ProgressiveConfigV2 = {
  enabled: true,
  parallelLimit: 6,
  skeletonDelay: 8,           // 8ms between skeleton emissions (subtle visual flow)
  visibleBatchSize: 10,       // Load 10 visible nodes at a time
  backgroundPauseOnScroll: true,
  lazyAttrInfo: true,
  debugMode: false,
};

export class ProgressiveSceneServiceV2 extends BaseService {
  private apiService: ApiService;
  private scene: Scene;
  private scheduler: LoadingScheduler;
  private config: ProgressiveConfigV2;
  private abortController: AbortController | null = null;
  
  // Current loading state
  private currentPhase: LoadPhase = LoadPhase.IDLE;
  private visibleHandles: Set<number> = new Set();
  private skeletonNodes: Map<number, SkeletonNode> = new Map();
  
  // Stats
  private loadStartTime: number = 0;
  private nodesLoaded: number = 0;
  private totalNodes: number = 0;

  constructor(emitter: any, serverUrl: string, apiService: ApiService) {
    super(emitter, serverUrl);
    this.apiService = apiService;
    this.scheduler = new LoadingScheduler();
    this.config = { ...DEFAULT_CONFIG };
    this.scene = this.createEmptyScene();
  }

  private createEmptyScene(): Scene {
    return {
      tree: [],
      map: new Map(),
      connections: new Map(),
    };
  }

  /**
   * Configure the service
   */
  configure(config: Partial<ProgressiveConfigV2>): void {
    this.config = { ...this.config, ...config };
    Logger.debug('🔧 ProgressiveSceneServiceV2 configured:', this.config);
  }

  /**
   * Update visible handles (called by UI on scroll)
   * Triggers priority loading for newly visible items
   */
  setVisibleHandles(handles: number[]): void {
    const newHandles = handles.filter(h => !this.visibleHandles.has(h));
    
    this.visibleHandles = new Set(handles);
    
    if (newHandles.length > 0 && this.currentPhase === LoadPhase.BACKGROUND) {
      // Prioritize newly visible items
      this.scheduler.prioritize(newHandles, 'details');
      
      if (this.config.backgroundPauseOnScroll) {
        // Pause background, load visible, then resume
        this.scheduler.pause();
        this.loadVisibleBatch().then(() => {
          this.scheduler.resume();
        });
      }
    }
  }

  /**
   * Main entry point - build scene progressively
   */
  async buildSceneProgressive(): Promise<SceneNode[]> {
    // Abort any previous load
    this.abort();
    this.abortController = new AbortController();
    
    // Reset state
    this.scene = this.createEmptyScene();
    this.scheduler.clear();
    this.skeletonNodes.clear();
    this.nodesLoaded = 0;
    this.totalNodes = 0;
    this.loadStartTime = Date.now();
    
    Logger.info('🚀 ProgressiveSceneServiceV2: Starting visibility-aware progressive load');
    this.emitProgress(LoadPhase.SKELETON, 0, 'Starting...');
    
    try {
      // Phase 1: Load skeleton structure
      await this.phase1_LoadSkeleton();
      this.checkAborted();
      
      // Phase 2: Load visible nodes first
      await this.phase2_LoadVisible();
      this.checkAborted();
      
      // Phase 3: Background loading (don't await - runs async)
      this.phase3_BackgroundLoad();
      
      return this.scene.tree;
      
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('abort')) {
        Logger.info('🚫 ProgressiveSceneServiceV2: Load cancelled');
      } else {
        Logger.error('❌ ProgressiveSceneServiceV2: Load failed:', error);
      }
      throw error;
    }
  }

  /**
   * Phase 1: Load skeleton structure
   * Goal: Show node names in UI within 200ms
   */
  private async phase1_LoadSkeleton(): Promise<void> {
    this.currentPhase = LoadPhase.SKELETON;
    Logger.info('📦 Phase 1: Loading skeleton structure...');
    
    // Get root node graph
    const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
    if (!rootResponse?.result?.handle) {
      throw new Error('Failed to get root node graph');
    }
    
    const rootHandle = rootResponse.result.handle;
    this.checkAborted();
    
    // Get owned items (level 0 nodes)
    const ownedResponse = await this.apiService.callApi('ApiNodeGraph', 'getOwnedItems', rootHandle);
    if (!ownedResponse?.list?.handle) {
      throw new Error('Failed to get owned items');
    }
    
    const ownedItemsHandle = ownedResponse.list.handle;
    const sizeResponse = await this.apiService.callApi('ApiItemArray', 'size', ownedItemsHandle);
    this.totalNodes = sizeResponse?.result || 0;
    
    Logger.info(`📦 Found ${this.totalNodes} level 0 nodes`);
    this.checkAborted();
    
    // Load skeleton for each node (just handle + name)
    for (let i = 0; i < this.totalNodes; i++) {
      this.checkAborted();
      
      const itemResponse = await this.apiService.callApi('ApiItemArray', 'get', ownedItemsHandle, { index: i });
      if (!itemResponse?.result?.handle) continue;
      
      const handle = itemResponse.result.handle;
      
      // Get just the name (fast)
      const nameResponse = await this.apiService.callApi('ApiItem', 'name', handle);
      const name = nameResponse?.result || 'Unnamed';
      
      // Create skeleton node
      const skeleton: SkeletonNode = {
        handle,
        name,
        level: 1,
        loadState: 'skeleton',
      };
      
      this.skeletonNodes.set(handle, skeleton);
      
      // Create minimal SceneNode for tree
      const sceneNode: SceneNode = {
        handle,
        name,
        type: '',           // Not loaded yet
        level: 1,
        loadState: 'skeleton',
        children: [],
        visible: true,
      };
      
      this.scene.tree.push(sceneNode);
      this.scene.map.set(handle, sceneNode);
      
      // Emit for UI update
      this.emit('scene:nodeAdded', { node: sceneNode, level: 0 });
      
      // Subtle delay for visual flow (optional)
      if (this.config.skeletonDelay > 0 && i % 5 === 0) {
        await this.yieldToBrowser();
      }
      
      // Progress update
      const progress = ((i + 1) / this.totalNodes) * 100;
      this.emitProgress(LoadPhase.SKELETON, progress, `Skeleton: ${i + 1}/${this.totalNodes}`);
    }
    
    Logger.info(`✅ Phase 1 complete: ${this.scene.tree.length} skeleton nodes`);
    this.emit('scene:level0Complete', { nodes: this.scene.tree });
    
    // Queue all handles for details loading
    const allHandles = this.scene.tree
      .map(n => n.handle)
      .filter((h): h is number => typeof h === 'number');
    this.scheduler.enqueue(allHandles, 'details');
  }

  /**
   * Phase 2: Load visible nodes first
   * Goal: Make visible content fully interactive within 500ms
   */
  private async phase2_LoadVisible(): Promise<void> {
    this.currentPhase = LoadPhase.VISIBLE_FIRST;
    Logger.info('👁️ Phase 2: Loading visible nodes...');
    
    // If we have visibility info, prioritize visible nodes
    if (this.visibleHandles.size > 0) {
      const visibleArray = Array.from(this.visibleHandles);
      this.scheduler.prioritize(visibleArray, 'details');
    } else {
      // No visibility info yet - load first batch
      const firstBatch = this.scene.tree
        .slice(0, this.config.visibleBatchSize)
        .map(n => n.handle)
        .filter((h): h is number => typeof h === 'number');
      this.scheduler.prioritize(firstBatch, 'details');
    }
    
    // Load visible batch
    await this.loadVisibleBatch();
    
    Logger.info(`✅ Phase 2 complete: ${this.nodesLoaded} nodes with details`);
  }

  /**
   * Load a batch of visible nodes with full details
   */
  private async loadVisibleBatch(): Promise<void> {
    const loadPromises: Promise<void>[] = [];
    let loaded = 0;
    
    while (this.scheduler.hasPriorityWork) {
      this.checkAborted();
      
      const item = this.scheduler.next();
      if (!item) break;
      
      // Add to parallel batch
      loadPromises.push(
        this.loadNodeDetails(item.handle)
          .then(() => {
            this.scheduler.markLoaded(item.handle);
            loaded++;
            this.nodesLoaded++;
          })
          .catch(error => {
            Logger.warn(`Failed to load details for ${item.handle}:`, error);
            this.scheduler.markFailed(item.handle);
          })
      );
      
      // Limit parallel calls
      if (loadPromises.length >= this.config.parallelLimit) {
        await Promise.all(loadPromises);
        loadPromises.length = 0;
        
        // Update progress
        const progress = (this.nodesLoaded / this.totalNodes) * 100;
        this.emitProgress(LoadPhase.VISIBLE_FIRST, progress, `Loading visible: ${this.nodesLoaded}/${this.totalNodes}`);
        
        // Yield to browser
        await this.yieldToBrowser();
      }
    }
    
    // Wait for remaining
    if (loadPromises.length > 0) {
      await Promise.all(loadPromises);
    }
    
    Logger.debug(`👁️ Loaded ${loaded} visible nodes`);
  }

  /**
   * Phase 3: Background loading
   * Continues loading non-visible nodes without blocking UI
   */
  private async phase3_BackgroundLoad(): Promise<void> {
    this.currentPhase = LoadPhase.BACKGROUND;
    Logger.info('🔄 Phase 3: Background loading...');
    
    const loadPromises: Promise<void>[] = [];
    
    while (this.scheduler.hasWork) {
      // Check for abort
      if (this.abortController?.signal.aborted) {
        Logger.debug('🚫 Background loading aborted');
        break;
      }
      
      // Wait if paused (scroll in progress)
      if (this.scheduler.isPaused) {
        await this.scheduler.waitForResume();
        continue;
      }
      
      const item = this.scheduler.next();
      if (!item) break;
      
      // Add to parallel batch
      loadPromises.push(
        this.loadNodeDetails(item.handle)
          .then(() => {
            this.scheduler.markLoaded(item.handle);
            this.nodesLoaded++;
          })
          .catch(error => {
            Logger.warn(`Background load failed for ${item.handle}:`, error);
            this.scheduler.markFailed(item.handle);
          })
      );
      
      // Limit parallel calls
      if (loadPromises.length >= this.config.parallelLimit) {
        await Promise.all(loadPromises);
        loadPromises.length = 0;
        
        // Update progress (less frequently in background)
        if (this.nodesLoaded % 10 === 0) {
          const progress = (this.nodesLoaded / this.totalNodes) * 100;
          this.emitProgress(LoadPhase.BACKGROUND, progress, `Background: ${this.nodesLoaded}/${this.totalNodes}`);
        }
        
        // Yield to browser (longer delay in background)
        await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps
      }
    }
    
    // Wait for remaining
    if (loadPromises.length > 0) {
      await Promise.all(loadPromises);
    }
    
    // Mark complete
    this.currentPhase = LoadPhase.COMPLETE;
    const elapsed = Date.now() - this.loadStartTime;
    
    Logger.info(`✅ Phase 3 complete: All ${this.nodesLoaded} nodes loaded in ${elapsed}ms`);
    
    this.emitProgress(LoadPhase.COMPLETE, 100, 'Scene loaded');
    this.emit('sceneTreeUpdated', this.scene);
    this.emit('scene:v2:complete', {
      totalNodes: this.nodesLoaded,
      elapsedMs: elapsed,
    });
  }

  /**
   * Load full details for a single node
   */
  private async loadNodeDetails(handle: number): Promise<void> {
    const existingNode = this.scene.map.get(handle);
    if (!existingNode) {
      Logger.warn(`Node ${handle} not found in scene map`);
      return;
    }
    
    // Skip if already loaded
    if (existingNode.loadState === 'loaded') {
      return;
    }
    
    existingNode.loadState = 'loading';
    
    try {
      // Load type info
      const outTypeResponse = await this.apiService.callApi('ApiItem', 'outType', handle);
      const outType = outTypeResponse?.result || '';
      
      const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', handle);
      const isGraph = isGraphResponse?.result || false;
      
      // Load node/graph info
      let graphInfo = null;
      let nodeInfo = null;
      
      if (isGraph) {
        const infoResponse = await this.apiService.callApi('ApiNodeGraph', 'info1', handle);
        graphInfo = infoResponse?.result || null;
      } else {
        const infoResponse = await this.apiService.callApi('ApiNode', 'info', handle);
        nodeInfo = infoResponse?.result || null;
      }
      
      // Load position for level 1 nodes
      let position = null;
      if (existingNode.level === 1) {
        try {
          const posResponse = await this.apiService.callApi('ApiItem', 'position', handle);
          if (posResponse?.result) {
            position = {
              x: posResponse.result.x || 0,
              y: posResponse.result.y || 0,
            };
          }
        } catch {
          // Position not available for all nodes
        }
      }
      
      // Update node with details
      existingNode.type = outType;
      existingNode.outType = outType;
      existingNode.graphInfo = graphInfo;
      existingNode.nodeInfo = nodeInfo;
      existingNode.position = position;
      existingNode.icon = getIconForType(String(outType), existingNode.name);
      existingNode.loadState = 'loaded';
      
      // Load attrInfo if not lazy
      if (!this.config.lazyAttrInfo && !FEATURES.LAZY_ATTR_INFO) {
        await this.loadAttrInfo(handle);
      }
      
      // Load children (shallow)
      await this.loadChildrenShallow(existingNode);
      
      // Emit details loaded event
      this.emit('scene:v2:detailsLoaded', {
        handle,
        node: existingNode,
        phase: this.currentPhase,
      });
      
      // Also emit V1-compatible event
      this.emit('scene:nodeAdded', { node: existingNode, level: existingNode.level || 0 });
      
    } catch (error) {
      existingNode.loadState = 'error';
      throw error;
    }
  }

  /**
   * Load children for a node (shallow - only immediate children)
   */
  private async loadChildrenShallow(node: SceneNode): Promise<void> {
    if (!node.handle) return;
    
    const isGraph = node.graphInfo !== null && node.graphInfo !== undefined;
    const children: SceneNode[] = [];
    const childLevel = (node.level || 1) + 1;
    
    try {
      if (isGraph) {
        // NodeGraph: Load owned items
        const ownedResponse = await this.apiService.callApi('ApiNodeGraph', 'getOwnedItems', node.handle);
        if (!ownedResponse?.list?.handle) {
          node.children = [];
          return;
        }
        
        const ownedItemsHandle = ownedResponse.list.handle;
        const sizeResponse = await this.apiService.callApi('ApiItemArray', 'size', ownedItemsHandle);
        const size = sizeResponse?.result || 0;
        
        for (let i = 0; i < size; i++) {
          const itemResponse = await this.apiService.callApi('ApiItemArray', 'get', ownedItemsHandle, { index: i });
          if (itemResponse?.result?.handle) {
            const child = await this.createChildNode(itemResponse.result, null, childLevel);
            if (child) children.push(child);
          }
        }
      } else {
        // Regular Node: Load pins
        const pinCountResponse = await this.apiService.callApi('ApiNode', 'pinCount', node.handle);
        const pinCount = pinCountResponse?.result || 0;
        
        for (let i = 0; i < pinCount; i++) {
          try {
            const connectedResponse = await this.apiService.callApi(
              'ApiNode', 'connectedNodeIx', node.handle, { pinIx: i, enterWrapperNode: true }
            );
            const connectedNode = connectedResponse?.result || null;
            
            const pinInfoHandleResponse = await this.apiService.callApi(
              'ApiNode', 'pinInfoIx', node.handle, { index: i }
            );
            
            if (pinInfoHandleResponse?.result?.handle) {
              const pinInfoResponse = await this.apiService.callApi(
                'ApiNodePinInfoEx', 'getApiNodePinInfo', pinInfoHandleResponse.result.handle
              );
              
              const pinInfo = pinInfoResponse?.nodePinInfo || null;
              if (pinInfo) {
                pinInfo.ix = i;
                const child = await this.createChildNode(connectedNode, pinInfo, childLevel);
                if (child) children.push(child);
              }
            }
          } catch {
            // Skip failed pins
          }
        }
      }
      
      node.children = children;
      
      // Emit children loaded event
      if (children.length > 0) {
        this.emit('scene:childrenLoaded', { parent: node, children });
        this.emit('scene:v2:childrenLoaded', {
          parentHandle: node.handle,
          children,
          isVisible: this.visibleHandles.has(node.handle!),
        });
      }
      
    } catch (error) {
      Logger.warn(`Failed to load children for ${node.name}:`, error);
      node.children = [];
    }
  }

  /**
   * Create a child node (pin or owned item)
   */
  private async createChildNode(item: any, pinInfo: any, level: number): Promise<SceneNode | undefined> {
    let name = item?.name || pinInfo?.staticLabel || 'Unnamed';
    let outType = pinInfo?.outType || '';
    let graphInfo = null;
    let nodeInfo = null;
    
    if (item?.handle && item.handle !== 0) {
      const handleNum = Number(item.handle);
      
      // Check if already exists
      const existing = this.scene.map.get(handleNum);
      if (existing) {
        existing.pinInfo = pinInfo;
        return existing;
      }
      
      // Get name and type
      try {
        const nameResponse = await this.apiService.callApi('ApiItem', 'name', item.handle);
        name = nameResponse?.result || name;
        
        const outTypeResponse = await this.apiService.callApi('ApiItem', 'outType', item.handle);
        outType = outTypeResponse?.result || outType;
        
        const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', item.handle);
        const isGraph = isGraphResponse?.result || false;
        
        if (isGraph) {
          const infoResponse = await this.apiService.callApi('ApiNodeGraph', 'info1', item.handle);
          graphInfo = infoResponse?.result || null;
        } else {
          const infoResponse = await this.apiService.callApi('ApiNode', 'info', item.handle);
          nodeInfo = infoResponse?.result || null;
        }
      } catch {
        // Use defaults
      }
    }
    
    const displayName = pinInfo?.staticLabel || name;
    const icon = getIconForType(String(outType), displayName);
    
    const entry: SceneNode = {
      level,
      name: displayName,
      handle: item?.handle,
      type: outType,
      outType,
      icon,
      visible: true,
      graphInfo,
      nodeInfo,
      pinInfo,
      children: [],
      loadState: 'loaded',
    };
    
    if (item?.handle && item.handle !== 0) {
      this.scene.map.set(Number(item.handle), entry);
    }
    
    return entry;
  }

  /**
   * Load attrInfo for a node (on-demand)
   */
  async loadAttrInfo(handle: number): Promise<any> {
    const node = this.scene.map.get(handle);
    if (!node) return null;
    
    // Return cached if available
    if (node.attrInfo) return node.attrInfo;
    
    try {
      const attrInfoResponse = await this.apiService.callApi(
        'ApiItem', 'attrInfo', handle, { id: AttributeId.A_VALUE }
      );
      
      if (attrInfoResponse?.result && attrInfoResponse.result.type !== 'AT_UNKNOWN') {
        node.attrInfo = attrInfoResponse.result;
        return node.attrInfo;
      }
    } catch {
      // Not all nodes have attrInfo
    }
    
    return null;
  }

  /**
   * Emit progress event
   */
  private emitProgress(phase: LoadPhase, progress: number, message: string): void {
    const event: V2ProgressEvent = {
      phase,
      progress,
      overallProgress: this.calculateOverallProgress(phase, progress),
      message,
      nodesLoaded: this.nodesLoaded,
      totalNodes: this.totalNodes,
      visibleNodesLoaded: Array.from(this.visibleHandles).filter(h => this.scheduler.isLoaded(h)).length,
    };
    
    this.emit('scene:v2:progress', event);
    
    // Also emit V1-compatible event
    this.emit('scene:buildProgress', {
      stage: phase,
      progress: event.overallProgress,
      message,
    });
  }

  /**
   * Calculate overall progress across all phases
   */
  private calculateOverallProgress(phase: LoadPhase, phaseProgress: number): number {
    const weights = {
      [LoadPhase.IDLE]: 0,
      [LoadPhase.SKELETON]: 0.2,      // 0-20%
      [LoadPhase.VISIBLE_FIRST]: 0.3, // 20-50%
      [LoadPhase.BACKGROUND]: 0.5,    // 50-100%
      [LoadPhase.COMPLETE]: 1.0,
    };
    
    const phases = [LoadPhase.SKELETON, LoadPhase.VISIBLE_FIRST, LoadPhase.BACKGROUND];
    const phaseIndex = phases.indexOf(phase);
    
    if (phaseIndex === -1) return phase === LoadPhase.COMPLETE ? 100 : 0;
    
    let baseProgress = 0;
    for (let i = 0; i < phaseIndex; i++) {
      baseProgress += weights[phases[i]] * 100;
    }
    
    return baseProgress + (weights[phase] * phaseProgress);
  }

  /**
   * Check if operation was aborted
   */
  private checkAborted(): void {
    if (this.abortController?.signal.aborted) {
      throw new Error('Operation aborted');
    }
  }

  /**
   * Yield to browser for UI updates
   */
  private async yieldToBrowser(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
  }

  /**
   * Abort ongoing load
   */
  abort(): void {
    if (this.abortController) {
      Logger.info('🛑 ProgressiveSceneServiceV2: Aborting');
      this.abortController.abort();
      this.abortController = null;
    }
    this.scheduler.pause();
    this.currentPhase = LoadPhase.IDLE;
  }

  /**
   * Get current scene
   */
  getScene(): Scene {
    return this.scene;
  }

  /**
   * Get node by handle
   */
  getNodeByHandle(handle: number): SceneNode | undefined {
    return this.scene.map.get(handle);
  }

  /**
   * Lookup item
   */
  lookupItem(handle: number): SceneNode | null {
    return this.scene.map.get(handle) || null;
  }

  /**
   * Remove from scene
   */
  removeFromScene(handle: number): void {
    this.scene.map.delete(handle);
    
    const removeFromArray = (arr: SceneNode[]): boolean => {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].handle === handle) {
          arr.splice(i, 1);
          return true;
        }
        if (arr[i].children?.length) {
          if (removeFromArray(arr[i].children!)) return true;
        }
      }
      return false;
    };
    
    removeFromArray(this.scene.tree);
  }

  /**
   * Get current loading phase
   */
  get phase(): LoadPhase {
    return this.currentPhase;
  }

  /**
   * Get scheduler state (for debugging)
   */
  get schedulerState() {
    return this.scheduler.state;
  }
}
