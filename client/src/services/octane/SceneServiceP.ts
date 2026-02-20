/**
 * SceneServiceP - Progressive UI Scene Service
 *
 * Uses the same simple, proven loading strategy as SceneService (sequential,
 * recursive, single-pass) but emits clean UI update events at natural breakpoints
 * so the Outliner, NodeGraph, and NodeInspector update incrementally without
 * flashing.
 *
 * Key design principles:
 *   1. NO per-pin events — children are loaded fully, then signaled once
 *   2. NO two-pass loading — single recursive pass like SceneService
 *   3. NO deep-load queue — everything loads in order
 *   4. Clean breakpoints: after each level-1 node is created, after its children
 *      are fully loaded, and at the end
 *
 * Events emitted:
 *   scene:buildStart         - Load begins (clear UI)
 *   scene:buildProgress      - Status message            { step, progress? }
 *   scene:nodeAdded          - Level-1 node created       { node, level: 0 }
 *   scene:level0Complete     - All level-1 nodes created  { nodes }
 *   scene:childrenLoaded     - Children fully loaded       { parent, children }
 *   scene:structureComplete  - Entire tree built           { nodeCount, ... }
 *   scene:buildComplete      - Final stats                 { nodeCount, ... }
 *   scene:complete           - Done signal                 { scene }
 *   sceneTreeUpdated         - Legacy compat               scene
 */

import { Logger } from '../../utils/Logger';
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';
import { Scene, SceneNode } from './types';
import { getIconForType } from '../../constants/PinTypes';
import { AttrType, AttributeId } from '../../constants/OctaneTypes';

export class SceneServiceP extends BaseService {
  private apiService: ApiService;
  private scene: Scene;
  private abortController: AbortController | null = null;
  private nodesLoaded = 0;
  private totalNodes = 0;

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
   * Build scene tree with progressive UI updates.
   * Same loading logic as SceneService but emits events at clean breakpoints.
   */
  async buildSceneTree(newNodeHandle?: number): Promise<SceneNode[]> {
    // Abort any previous build
    if (this.abortController) {
      Logger.debug('SceneServiceP: Cancelling previous build');
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Incremental: single node update (same as SceneService)
    if (newNodeHandle !== undefined) {
      Logger.debug('SceneServiceP: Building new node metadata:', newNodeHandle);
      try {
        const tempArray: SceneNode[] = [];
        const newNode = await this.addSceneItem(tempArray, { handle: newNodeHandle }, null, 1);
        if (newNode) {
          await this.addItemChildren(newNode);
        }
        return this.scene.tree;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        Logger.error('SceneServiceP: Failed to build new node:', message);
        throw error;
      }
    }

    // Full rebuild
    Logger.info('SceneServiceP: Building scene tree...');
    this.emit('scene:buildStart');

    this.scene = { tree: [], map: new Map(), connections: new Map() };
    this.nodesLoaded = 0;
    this.totalNodes = 0;

    const startTime = performance.now();

    try {
      this.checkAborted(signal);
      this.emit('scene:buildProgress', { step: 'Getting root node graph...' });

      // Step 1: Get root
      const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
      if (!rootResponse?.result?.handle) {
        throw new Error('Failed to get root node graph');
      }
      const rootHandle = rootResponse.result.handle;

      this.checkAborted(signal);

      const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', rootHandle);
      const rootIsGraph = isGraphResponse?.result || false;

      this.checkAborted(signal);

      if (!rootIsGraph) {
        throw new Error('Root handle is not a graph');
      }

      // Step 2: Load level-1 nodes (owned items) one by one with UI emission
      const ownedResponse = await this.apiService.callApi('ApiNodeGraph', 'getOwnedItems', rootHandle);
      if (!ownedResponse?.list?.handle) {
        throw new Error('Failed ApiNodeGraph/getOwnedItems');
      }
      const ownedItemsHandle = ownedResponse.list.handle;

      const sizeResponse = await this.apiService.callApi('ApiItemArray', 'size', ownedItemsHandle);
      const size = sizeResponse?.result || 0;
      this.totalNodes = size;

      Logger.debug(`SceneServiceP: Found ${size} level-1 owned items`);

      // Load each level-1 node and emit immediately for UI
      for (let i = 0; i < size; i++) {
        this.checkAborted(signal);

        const itemResponse = await this.apiService.callApi('ApiItemArray', 'get', ownedItemsHandle, { index: i });
        if (!itemResponse?.result?.handle) continue;

        const node = await this.addSceneItem(this.scene.tree, itemResponse.result, null, 1);
        if (!node) continue;

        this.nodesLoaded++;
        this.emit('scene:buildProgress', { step: `Loading: ${this.nodesLoaded}/${this.totalNodes}`, progress: (this.nodesLoaded / this.totalNodes) * 100 });

        // Emit so Outliner shows this node immediately
        this.emit('scene:nodeAdded', { node, level: 0 });

        // Yield to browser so the UI can paint the new node
        await this.yieldToBrowser();
      }

      // All level-1 nodes loaded — signal for expansion initialization
      this.emit('scene:level0Complete', { nodes: this.scene.tree });
      Logger.debug(`SceneServiceP: Level-1 complete: ${this.scene.tree.length} nodes`);

      // Step 3: Load children for each level-1 node sequentially
      // After each node's children are fully loaded, emit a single clean update
      for (const item of this.scene.tree) {
        this.checkAborted(signal);

        this.emit('scene:buildProgress', { step: `Building: ${item.name}` });
        await this.addItemChildren(item);

        // Children fully loaded — signal single clean update for this subtree
        if (item.children && item.children.length > 0) {
          this.emit('scene:childrenLoaded', { parent: item, children: item.children });
        }

        // Yield so UI paints the expanded subtree before moving on
        await this.yieldToBrowser();
      }

      const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(2);

      Logger.info(`SceneServiceP: Tree built in ${elapsedTime}s:`);
      Logger.info(`  - ${this.scene.tree.length} top-level items`);
      Logger.info(`  - ${this.scene.map.size} total nodes`);

      // Signal structure complete (NodeGraph rebuilds edges here)
      this.emit('scene:structureComplete', {
        nodeCount: this.scene.map.size,
        topLevelCount: this.scene.tree.length,
        elapsedTime
      });

      this.emit('scene:buildComplete', {
        nodeCount: this.scene.map.size,
        topLevelCount: this.scene.tree.length,
        elapsedTime
      });

      this.emit('scene:complete', { scene: this.scene });

      // Legacy compat for traditional event listeners
      this.emit('sceneTreeUpdated', this.scene);

      return this.scene.tree;

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('abort') || message.includes('cancelled')) {
        Logger.debug('SceneServiceP: Build cancelled');
      } else {
        Logger.error('SceneServiceP: Build failed:', message);
      }
      throw error;
    }
  }

  // ─── Node creation (same logic as SceneService.addSceneItem) ──────

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

        const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', item.handle);
        isGraph = isGraphResponse?.result || false;

        // Position for level-1 nodes
        if (level === 1) {
          try {
            const posResponse = await this.apiService.callApi('ApiItem', 'position', item.handle);
            if (posResponse?.result) {
              position = {
                x: posResponse.result.x || 0,
                y: posResponse.result.y || 0
              };
            }
          } catch {
            // Position not available
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
        Logger.error('SceneServiceP: addSceneItem failed:', error.message);
      }
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

      if (level > 1) {
        await this.addItemChildren(entry);
      }
    }

    return entry;
  }

  // ─── Recursive child loading (same logic as SceneService) ─────────

  private async addItemChildren(item: SceneNode): Promise<void> {
    if (!item || !item.handle) return;

    const isGraph = item.graphInfo != null;

    try {
      const children = await this.syncSceneSequential(item.handle, null, isGraph, item.level || 1);
      item.children = children;

      // Load attrInfo
      const attrInfoResponse = await this.apiService.callApi(
        'ApiItem', 'attrInfo', item.handle,
        { id: AttributeId.A_VALUE }
      );
      if (attrInfoResponse?.result && attrInfoResponse.result.type !== 'AT_UNKNOWN') {
        item.attrInfo = attrInfoResponse.result;
      }

      // Load filePath
      const responseHas = await this.apiService.callApi(
        'ApiItem', 'hasAttr', item.handle,
        { id: AttributeId.A_FILENAME }
      );
      if (responseHas?.result === true) {
        const response = await this.apiService.callApi(
          'ApiItem', 'getByAttrID', item.handle,
          { attribute_id: AttributeId.A_FILENAME, expected_type: AttrType.AT_STRING }
        );
        if (response) {
          const valueField = Object.keys(response)[1];
          item.filePath = Object(response)[Object(response)[valueField]] as string;

          // Load vertsPerPoly
          const responseHasIndices = await this.apiService.callApi(
            'ApiItem', 'hasAttr', item.handle,
            { id: AttributeId.A_POLY_OBJECT_INDICES }
          );
          if (responseHasIndices?.result === true) {
            const indicesResponse = await this.apiService.callApi(
              'ApiItem', 'getByAttrID', item.handle,
              { attribute_id: AttributeId.A_POLY_OBJECT_INDICES, expected_type: AttrType.AT_INT }
            );
            if (indicesResponse) {
              const valField = Object.keys(indicesResponse)[1];
              item.vertsPerPoly = Object(indicesResponse)[Object(indicesResponse)[valField]] as number[];
            }
          }
        }
      }
    } catch (error: any) {
      Logger.error('SceneServiceP: addItemChildren failed:', error.message);
    }
  }

  // ─── Sequential recursive traversal (same as SceneService) ────────

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
        if (!response?.result?.handle) {
          throw new Error('Failed ApiProjectManager/rootNodeGraph');
        }
        itemHandle = response.result.handle;
        const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', itemHandle);
        isGraph = isGraphResponse?.result || false;
      }

      if (isGraph) {
        const ownedResponse = await this.apiService.callApi('ApiNodeGraph', 'getOwnedItems', itemHandle);
        if (!ownedResponse?.list?.handle) {
          throw new Error('Failed ApiNodeGraph/getOwnedItems');
        }
        const ownedItemsHandle = ownedResponse.list.handle;
        const sizeResponse = await this.apiService.callApi('ApiItemArray', 'size', ownedItemsHandle);
        const size = sizeResponse?.result || 0;

        for (let i = 0; i < size; i++) {
          const itemResponse = await this.apiService.callApi('ApiItemArray', 'get', ownedItemsHandle, { index: i });
          if (itemResponse?.result?.handle) {
            await this.addSceneItem(sceneItems, itemResponse.result, null, level);
          }
        }

        // Build deep children only at level 1 (direct children of level-1 nodes)
        if (level === 1) {
          for (const item of sceneItems) {
            await this.addItemChildren(item);
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      } else if (itemHandle != 0) {
        // Pin-based traversal
        try {
          const pinCountResponse = await this.apiService.callApi('ApiNode', 'pinCount', itemHandle);
          const pinCount = pinCountResponse?.result || 0;

          for (let i = 0; i < pinCount; i++) {
            try {
              const connectedResponse = await this.apiService.callApi(
                'ApiNode', 'connectedNodeIx', itemHandle,
                { pinIx: i, enterWrapperNode: true }
              );
              const connectedNode = connectedResponse?.result || null;

              const pinInfoHandleResponse = await this.apiService.callApi(
                'ApiNode', 'pinInfoIx', itemHandle,
                { index: i }
              );

              if (pinInfoHandleResponse?.result?.handle) {
                const pinInfoResponse = await this.apiService.callApi(
                  'ApiNodePinInfoEx', 'getApiNodePinInfo',
                  pinInfoHandleResponse.result.handle
                );

                const pinInfo = pinInfoResponse?.nodePinInfo || null;
                if (pinInfo) {
                  pinInfo.ix = i;
                  await this.addSceneItem(sceneItems, connectedNode, pinInfo, level);
                }
              }
            } catch (pinError: any) {
              Logger.warn(`SceneServiceP: Failed to load pin ${i}:`, pinError.message);
            }
          }
        } catch (pinCountError: any) {
          Logger.error('SceneServiceP: Failed to get pin count:', pinCountError.message);
        }
      }
    } catch (error: any) {
      Logger.error('SceneServiceP: syncSceneSequential failed:', error.message);
    }

    return sceneItems;
  }

  // ─── Utilities ────────────────────────────────────────────────────

  private getNodeIcon(outType: string | number, name?: string): string {
    const typeStr = typeof outType === 'string' ? outType : String(outType);
    return getIconForType(typeStr, name);
  }

  private checkAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new Error('Scene tree build was cancelled');
    }
  }

  private yieldToBrowser(): Promise<void> {
    return new Promise(resolve => {
      requestAnimationFrame(() => resolve());
    });
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // ─── Public accessors (same interface as SceneService) ────────────

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
        if (arr[i].children?.length) {
          if (removeFromArray(arr[i].children!)) return true;
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
}
