/**
 * Scene Service - Scene tree building and management
 * Handles building and maintaining the scene hierarchy
 */

import { Logger } from '../../utils/Logger';
import { EventEmitter } from '../../utils/EventEmitter';
import { BaseService } from './BaseService';
import { ApiService, asObject, asNumber, asBool, getHandle } from './ApiService';
import { Scene, SceneNode } from './types';
import { getIconForType } from '../../constants/PinTypes';
import { AttrType, AttributeId } from '../../constants/OctaneTypes';

export class SceneService extends BaseService {
  private apiService: ApiService;
  private scene: Scene;
  private abortController: AbortController | null = null;

  constructor(emitter: EventEmitter, serverUrl: string, apiService: ApiService) {
    super(emitter, serverUrl);
    this.apiService = apiService;
    this.scene = {
      tree: [],
      map: new Map(),
      connections: new Map(),
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
        const newNode = await this.addSceneItem(tempArray, { handle: newNodeHandle }, null, 1);

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
    this.emit('scene:buildStart');

    this.scene = {
      tree: [],
      map: new Map(),
      connections: new Map(),
    };

    try {
      // Check for cancellation
      if (signal.aborted) {
        throw new Error('Scene tree build was cancelled');
      }
      this.emit('scene:buildProgress', { step: 'Building scene tree' });
      Logger.debug('🔍 Step 1: Getting root node graph...');

      const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
      const rootHandle = getHandle(rootResponse?.result);
      if (!rootHandle) {
        throw new Error('Failed to get root node graph');
      }

      Logger.debug('📍 Root handle:', rootHandle);

      // Check for cancellation
      if (signal.aborted) {
        throw new Error('Scene tree build was cancelled');
      }

      Logger.debug('🔍 Step 2: Checking if root is graph...');
      const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', rootHandle);
      const isGraph = asBool(isGraphResponse?.result, false);
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

      Logger.info(`✅ Sequential Scene tree built in ${elapsedTime}s:`);
      Logger.info(`   - ${this.scene.tree.length} top-level items`);
      Logger.info(`   - ${this.scene.map.size} total nodes`);

      Logger.debug('🔍 Step 4: Emitting sceneTreeUpdated event...');
      this.emit('scene:buildComplete', {
        nodeCount: this.scene.map.size,
        topLevelCount: this.scene.tree.length,
        elapsedTime,
      });
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
        const resolvedHandle = getHandle(response?.result);
        if (!resolvedHandle) {
          throw new Error('Failed ApiProjectManager/rootNodeGraph');
        }
        itemHandle = resolvedHandle;

        const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', itemHandle);
        isGraph = asBool(isGraphResponse?.result, false);
      }

      /**
       * NodeGraph vs Node traversal strategy:
       * - NodeGraphs contain "owned items" (child nodes) via getOwnedItems()
       * - Regular Nodes expose connections via their pins via connectedNodeIx()
       * This branch handles NodeGraphs by iterating their owned items array
       */
      if (isGraph) {
        const ownedResponse = await this.apiService.callApi(
          'ApiNodeGraph',
          'getOwnedItems',
          itemHandle
        );
        const ownedItemsHandle = getHandle(ownedResponse?.list);
        if (!ownedItemsHandle) {
          throw new Error('Failed ApiNodeGraph/getOwnedItems');
        }

        const sizeResponse = await this.apiService.callApi(
          'ApiItemArray',
          'size',
          ownedItemsHandle
        );
        const size = asNumber(sizeResponse?.result, 0);

        Logger.debug(`📦 Level ${level}: Found ${size} owned items`);

        for (let i = 0; i < size; i++) {
          const itemResponse = await this.apiService.callApi(
            'ApiItemArray',
            'get',
            ownedItemsHandle,
            { index: i }
          );
          const itemResultHandle = getHandle(itemResponse?.result);
          if (itemResultHandle) {
            await this.addSceneItem(
              sceneItems,
              asObject(itemResponse.result) as Record<string, unknown>,
              null,
              level
            );
          }
        }

        // Only build deep children for top-level items (avoids exponential API calls)
        if (level === 1) {
          Logger.debug(`🔄 Building children for ${sceneItems.length} level 1 items`);
          for (const item of sceneItems) {
            await this.addItemChildren(item);
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
          const pinCount = asNumber(pinCountResponse?.result, 0);

          Logger.debug(`  Found ${pinCount} pins`);

          for (let i = 0; i < pinCount; i++) {
            try {
              const connectedResponse = await this.apiService.callApi(
                'ApiNode',
                'connectedNodeIx',
                itemHandle,
                { pinIx: i, enterWrapperNode: true }
              );

              const connectedNode =
                (asObject(connectedResponse?.result) as Record<string, unknown> | null) ?? null;

              const pinInfoHandleResponse = await this.apiService.callApi(
                'ApiNode',
                'pinInfoIx',
                itemHandle,
                { index: i }
              );

              const pinInfoHandle = getHandle(pinInfoHandleResponse?.result);
              if (pinInfoHandle) {
                const pinInfoResponse = await this.apiService.callApi(
                  'ApiNodePinInfoEx',
                  'getApiNodePinInfo',
                  pinInfoHandle
                );

                const pinInfo =
                  (asObject(pinInfoResponse?.nodePinInfo) as Record<string, unknown> | null) ??
                  null;
                if (pinInfo) {
                  pinInfo.ix = i;
                  await this.addSceneItem(sceneItems, connectedNode, pinInfo, level);
                }
              }
            } catch (pinError) {
              Logger.warn(
                `  ⚠️ Failed to load pin ${i}:`,
                pinError instanceof Error ? pinError.message : String(pinError)
              );
            }
          }
        } catch (pinCountError) {
          Logger.error(
            `  ❌ Failed to get pin count:`,
            pinCountError instanceof Error ? pinCountError.message : String(pinCountError)
          );
        }
      }
    } catch (error) {
      Logger.error(
        '❌ syncSceneSequential failed:',
        error instanceof Error ? error.message : String(error)
      );
    }

    return sceneItems;
  }

  private async addSceneItem(
    sceneItems: SceneNode[],
    item: Record<string, unknown> | null,
    pinInfo: Record<string, unknown> | null,
    level: number
  ): Promise<SceneNode | undefined> {
    let itemName = String(item?.name || pinInfo?.staticLabel || 'Unnamed');
    let outType: string | number = String(pinInfo?.outType || '');
    let graphInfo: import('./types').GraphInfo | undefined;
    let nodeInfo: import('./types').NodeInfo | undefined;
    let isGraph = false;
    let position: { x: number; y: number } | undefined;

    // Resolve handle from item
    const handleNum = item?.handle != null ? Number(item.handle) : 0;

    if (item != null && handleNum !== 0) {
      const existing = this.scene.map.get(handleNum);
      if (existing && existing.handle) {
        existing.pinInfo = pinInfo as import('./types').PinInfo | undefined;
        if (level > 1) {
          sceneItems.push(existing);
        }
        return existing;
      }

      try {
        const nameResponse = await this.apiService.callApi('ApiItem', 'name', handleNum);
        itemName = String(nameResponse?.result ?? 'Unnamed');

        const outTypeResponse = await this.apiService.callApi('ApiItem', 'outType', handleNum);
        outType = String(outTypeResponse?.result ?? '');

        Logger.debug(
          `  🔍 API returned outType: "${outType}" (type: ${typeof outType}) for ${itemName}`
        );

        const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', handleNum);
        isGraph = asBool(isGraphResponse?.result, false);

        // Fetch position for top-level nodes (level 1)
        if (level === 1) {
          try {
            const posResponse = await this.apiService.callApi('ApiItem', 'position', handleNum);
            const posObj = asObject(posResponse?.result);
            if (posObj) {
              position = {
                x: asNumber(posObj.x, 0),
                y: asNumber(posObj.y, 0),
              };
              Logger.debug(`  📍 Position for ${itemName}: (${position.x}, ${position.y})`);
            }
          } catch (posError) {
            Logger.warn(
              `  ⚠️ Failed to get position for ${itemName}:`,
              posError instanceof Error ? posError.message : String(posError)
            );
          }
        }

        if (isGraph) {
          const infoResponse = await this.apiService.callApi('ApiNodeGraph', 'info1', handleNum);
          graphInfo = asObject(infoResponse?.result) as import('./types').GraphInfo | undefined;
        } else {
          const infoResponse = await this.apiService.callApi('ApiNode', 'info', handleNum);
          nodeInfo = asObject(infoResponse?.result) as import('./types').NodeInfo | undefined;
        }
      } catch (error) {
        Logger.error(
          '❌ addSceneItem failed to fetch item data:',
          error instanceof Error ? error.message : String(error)
        );
      }
    } else {
      Logger.debug(`  ⚪ Unconnected pin: ${itemName}`);
    }

    const displayName = String(pinInfo?.staticLabel || itemName);
    const icon = this.getNodeIcon(outType, displayName);

    const entry: SceneNode = {
      level,
      name: displayName,
      handle: handleNum !== 0 ? handleNum : undefined,
      type: outType,
      typeEnum: typeof outType === 'number' ? outType : 0,
      outType: outType,
      icon,
      visible: true,
      graphInfo,
      nodeInfo,
      pinInfo: pinInfo as import('./types').PinInfo | undefined,
      children: [],
      position,
    };

    sceneItems.push(entry);

    if (item != null && handleNum !== 0) {
      this.scene.map.set(handleNum, entry);
      Logger.debug(
        `  📄 Added item: ${itemName} (type: "${outType}", icon: ${icon}, level: ${level})`
      );

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

      const attrInfoResponse = await this.apiService.callApi('ApiItem', 'attrInfo', item.handle, {
        id: AttributeId.A_VALUE,
      });
      const attrResultObj = asObject(attrInfoResponse?.result);
      if (attrResultObj && String(attrResultObj.type) !== 'AT_UNKNOWN') {
        item.attrInfo = attrResultObj as import('./types').AttrInfo;
        Logger.debugV(` ${item.name} ${JSON.stringify(attrResultObj)}`);
      } else {
        this.emit('scene:buildProgress', { step: `adding node ${item.name}` });
      }
      const responseHas = await this.apiService.callApi(
        'ApiItem',
        'hasAttr',
        item.handle, // Pass handle as string
        {
          id: AttributeId.A_FILENAME,
        }
      );
      if (responseHas && responseHas.result == true) {
        const response = await this.apiService.callApi(
          'ApiItem',
          'getByAttrID', // Use correct method name for API version
          item.handle, // Pass handle as string
          {
            attribute_id: AttributeId.A_FILENAME,
            expected_type: AttrType.AT_STRING,
          }
        );
        //    [OCTANE-SERVER] ✅ ApiItem.getByAttrID → {"string_value":"assets\\teapot.obj","value":"string_value"}
        if (response) {
          // Extract the actual value from the response
          // API returns format like: {float_value: 2, value: "float_value"}
          // We need to get the value from the field indicated by response.value
          const valueField = Object.keys(response)[1];
          item.filePath = Object(response)[Object(response)[valueField]] as string;
          //          Logger.info(`FILE for ${item.name}: ${item.filePath}`);

          const responseHasIndices = await this.apiService.callApi(
            'ApiItem',
            'hasAttr',
            item.handle, // Pass handle as string
            {
              id: AttributeId.A_POLY_OBJECT_INDICES,
            }
          );
          if (responseHasIndices && responseHasIndices.result == true) {
            const response = await this.apiService.callApi(
              'ApiItem',
              'getByAttrID', // Use correct method name for API version
              item.handle, // Pass handle as string
              {
                attribute_id: AttributeId.A_POLY_OBJECT_INDICES,
                expected_type: AttrType.AT_INT,
              }
            );
            if (response) {
              const valueField = Object.keys(response)[1];
              const vertsPerPoly = Object(response)[Object(response)[valueField]] as Array<number>;
              item.vertsPerPoly = vertsPerPoly;
              Logger.info(`vertsPerPoly for ${item.name}: ${valueField} ${vertsPerPoly.length}`);
              Logger.info(`vertsPerPoly ${JSON.stringify(Object(response))} ${vertsPerPoly}`);
            }
          }
        }
        if (!item.attrInfo) {
          if (item.filePath) {
            this.emit('scene:buildProgress', {
              step: `adding node ${item.name}: ${item.filePath}`,
            });
          } else {
            this.emit('scene:buildProgress', { step: `adding node ${item.name}` });
          }
        }
      }
    } catch (error) {
      Logger.error(
        '❌ addItemChildren failed:',
        error instanceof Error ? error.message : String(error)
      );
    }
    return;
  }

  private getNodeIcon(outType: string | number, name?: string): string {
    const typeStr = typeof outType === 'string' ? outType : String(outType);
    return getIconForType(typeStr, name);
  }
}
