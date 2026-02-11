/**
 * ProgressiveSceneServiceV3 - Progressive scene loading that works!
 *
 * Strategy: Copy the EXACT working logic from SceneService,
 * but add progressive UI updates via events and yields.
 *
 * Key differences from V2:
 * - Uses identical tree-building logic as SceneService (proven to work)
 * - Emits events for UI updates between nodes
 * - Yields to browser to allow React renders
 * - Maintains proper parent-child tree structure
 *
 * Created: 2025-02-11
 */

import { Logger } from '../../utils/Logger';
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';
import { Scene, SceneNode } from './types';
import { getIconForType } from '../../constants/PinTypes';
import { AttrType, AttributeId } from '../../constants/OctaneTypes';

export class ProgressiveSceneServiceV3 extends BaseService {
  private apiService: ApiService;
  private scene: Scene;
  private abortController: AbortController | null = null;
  
  // Progressive loading state
  private nodesLoaded = 0;
  private totalNodes = 0;
  private loadStartTime = 0;

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
   * Build scene tree progressively - emits events as nodes load
   */
  async buildSceneProgressive(): Promise<SceneNode[]> {
    // Abort any previous build
    if (this.abortController) {
      Logger.debug('🚫 Cancelling previous progressive build');
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    // Reset state
    this.scene = {
      tree: [],
      map: new Map(),
      connections: new Map()
    };
    this.nodesLoaded = 0;
    this.totalNodes = 0;
    this.loadStartTime = Date.now();

    Logger.info('🚀 ProgressiveSceneServiceV3: Starting progressive load');
    this.emit('scene:buildStart');

    try {
      // Step 1: Get root node graph
      const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
      if (!rootResponse?.result?.handle) {
        throw new Error('Failed to get root node graph');
      }
      const rootHandle = rootResponse.result.handle;
      this.checkAborted();

      // Step 2: Check if root is graph
      const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', rootHandle);
      const isGraph = isGraphResponse?.result || false;
      this.checkAborted();

      // Step 3: Build tree progressively (same logic as SceneService)
      this.scene.tree = await this.syncSceneProgressive(rootHandle, null, isGraph, 0);

      const elapsed = Date.now() - this.loadStartTime;
      Logger.info(`✅ Progressive load complete: ${this.scene.map.size} nodes in ${elapsed}ms`);

      this.emit('scene:buildComplete', {
        nodeCount: this.scene.map.size,
        topLevelCount: this.scene.tree.length,
        elapsedTime: (elapsed / 1000).toFixed(2)
      });
      this.emit('sceneTreeUpdated', this.scene);

      return this.scene.tree;

    } catch (error: any) {
      if (error.message?.includes('abort')) {
        Logger.info('🚫 Progressive load cancelled');
      } else {
        Logger.error('❌ Progressive load failed:', error);
      }
      throw error;
    }
  }

  /**
   * Progressive version of syncSceneSequential
   * Same logic, but emits events and yields between nodes
   */
  private async syncSceneProgressive(
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
        // NodeGraph: Get owned items
        const ownedResponse = await this.apiService.callApi('ApiNodeGraph', 'getOwnedItems', itemHandle);
        if (!ownedResponse?.list?.handle) {
          throw new Error('Failed ApiNodeGraph/getOwnedItems');
        }
        const ownedItemsHandle = ownedResponse.list.handle;

        const sizeResponse = await this.apiService.callApi('ApiItemArray', 'size', ownedItemsHandle);
        const size = sizeResponse?.result || 0;

        Logger.debug(`📦 Level ${level}: Found ${size} owned items`);

        // Track total for progress
        if (level === 1) {
          this.totalNodes = size;
        }

        // Add each owned item
        for (let i = 0; i < size; i++) {
          this.checkAborted();

          const itemResponse = await this.apiService.callApi('ApiItemArray', 'get', ownedItemsHandle, { index: i });
          if (itemResponse?.result?.handle) {
            const node = await this.addSceneItem(sceneItems, itemResponse.result, null, level);
            
            // 🎯 PROGRESSIVE: Emit event for UI update
            if (node && level === 1) {
              this.nodesLoaded++;
              this.emit('scene:nodeAdded', { node, level: 0 });
              this.emitProgress(`Loading: ${this.nodesLoaded}/${this.totalNodes}`);
              
              // Yield to browser for UI update
              await this.yieldToBrowser();
            }
          }
        }

        // Build children for level 1 items (same as SceneService)
        if (level === 1) {
          // 🎯 PROGRESSIVE: Emit level 0 complete before building children
          this.emit('scene:level0Complete', { nodes: sceneItems });
          
          Logger.debug(`🔄 Building children for ${sceneItems.length} level 1 items`);
          
          for (const item of sceneItems) {
            this.checkAborted();
            
            await this.addItemChildren(item);
            
            // 🎯 PROGRESSIVE: Emit children loaded event
            if (item.children && item.children.length > 0) {
              this.emit('scene:childrenLoaded', { parent: item, children: item.children });
            }
            
            // Yield between items
            await this.yieldToBrowser();
          }
          
          Logger.debug(`✅ Finished building children for all level 1 items`);
        }

      } else if (itemHandle !== 0) {
        // Regular node: Get pins
        Logger.debug(`📌 Level ${level}: Processing pins for handle ${itemHandle}`);

        try {
          const pinCountResponse = await this.apiService.callApi('ApiNode', 'pinCount', itemHandle);
          const pinCount = pinCountResponse?.result || 0;

          for (let i = 0; i < pinCount; i++) {
            this.checkAborted();

            try {
              const connectedResponse = await this.apiService.callApi(
                'ApiNode', 'connectedNodeIx', itemHandle,
                { pinIx: i, enterWrapperNode: true }
              );
              const connectedNode = connectedResponse?.result || null;

              const pinInfoHandleResponse = await this.apiService.callApi(
                'ApiNode', 'pinInfoIx', itemHandle, { index: i }
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
              Logger.warn(`  ⚠️ Failed to load pin ${i}:`, pinError.message);
            }
          }
        } catch (error: any) {
          Logger.error(`  ❌ Failed to get pin count:`, error.message);
        }
      }

    } catch (error: any) {
      Logger.error('❌ syncSceneProgressive failed:', error.message);
    }

    return sceneItems;
  }

  /**
   * Add a scene item - identical to SceneService.addSceneItem
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

        const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', item.handle);
        isGraph = isGraphResponse?.result || false;

        // Position for level 1 nodes
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
        Logger.error('❌ addSceneItem failed:', error.message);
      }
    }

    const displayName = pinInfo?.staticLabel || itemName;
    const icon = getIconForType(String(outType), displayName);

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

  /**
   * Add children to an item - identical to SceneService.addItemChildren
   */
  private async addItemChildren(item: SceneNode): Promise<void> {
    if (!item || !item.handle) return;

    const isGraph = item.graphInfo !== null && item.graphInfo !== undefined;

    try {
      const children = await this.syncSceneProgressive(item.handle, null, isGraph, item.level || 1);
      item.children = children;

      // Get attrInfo
      const attrInfoResponse = await this.apiService.callApi(
        'ApiItem', 'attrInfo', item.handle,
        { id: AttributeId.A_VALUE }
      );
      if (attrInfoResponse?.result && attrInfoResponse.result.type !== 'AT_UNKNOWN') {
        item.attrInfo = attrInfoResponse.result;
      }

      // Check for filename attribute
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

          // Check for poly object indices
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

      this.emitProgress(`Building: ${item.name}`);

    } catch (error: any) {
      Logger.error('❌ addItemChildren failed:', error.message);
    }
  }

  /**
   * Emit progress event
   */
  private emitProgress(message: string): void {
    const progress = this.totalNodes > 0 
      ? (this.nodesLoaded / this.totalNodes) * 100 
      : 0;
    this.emit('scene:buildProgress', { step: message, progress });
  }

  /**
   * Check if aborted
   */
  private checkAborted(): void {
    if (this.abortController?.signal.aborted) {
      throw new Error('Operation aborted');
    }
  }

  /**
   * Yield to browser for UI updates
   */
  private yieldToBrowser(): Promise<void> {
    return new Promise(resolve => {
      requestAnimationFrame(() => resolve());
    });
  }

  /**
   * Abort current load
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
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
}
