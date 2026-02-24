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
import { EventEmitter } from '../../utils/EventEmitter';
import { BaseService } from './BaseService';
import { ApiService, asObject, asNumber, asBool, getHandle } from './ApiService';
import { Scene, SceneNode } from './types';
import { getIconForType } from '../../constants/PinTypes';
import { AttrType, AttributeId } from '../../constants/OctaneTypes';

export class SceneServiceP extends BaseService {
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
   * Build scene tree with progressive UI updates.
   * Same loading logic as SceneService but emits events at clean breakpoints.
   */
  async buildSceneTree(newNodeHandle?: number): Promise<SceneNode[]> {
    // Abort any previous build
    if (this.abortController) {
      Logger.debug('🚫 Cancelling previous scene tree build');
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Incremental: single node update (same as SceneService)
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

    // Full rebuild
    Logger.info('🌳 Building scene tree...');
    this.emit('scene:buildStart');

    this.scene = { tree: [], map: new Map(), connections: new Map() };

    const startTime = performance.now();

    try {
      this.checkAborted(signal);
      this.emit('scene:buildProgress', { step: 'Building scene tree' });
      Logger.debug('🔍 Step 1: Getting root node graph...');

      // Step 1: Get root
      const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
      const rootHandle = getHandle(rootResponse?.result);
      if (!rootHandle) {
        throw new Error('Failed to get root node graph');
      }
      Logger.debug('📍 Root handle:', rootHandle);

      this.checkAborted(signal);

      Logger.debug('🔍 Step 2: Checking if root is graph...');
      const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', rootHandle);
      const rootIsGraph = asBool(isGraphResponse?.result, false);
      Logger.debug('📍 Is graph:', rootIsGraph);

      this.checkAborted(signal);

      if (!rootIsGraph) {
        throw new Error('Root handle is not a graph');
      }

      // Step 3: Load entire tree using same single-pass approach as SceneService.
      // UI events (scene:nodeAdded, scene:childrenLoaded) are emitted via setTimeout
      // so they never block the loading loop — React processes them between API calls.
      Logger.debug('🔍 Step 3: Building tree...');
      this.scene.tree = await this.syncSceneSequential(rootHandle, null, rootIsGraph, 0);

      Logger.debug(`✅ Finished building tree`);

      const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(2);

      Logger.info(`✅ Progressive Scene tree built in ${elapsedTime}s:`);
      Logger.info(`   - ${this.scene.tree.length} top-level items`);
      Logger.info(`   - ${this.scene.map.size} total nodes`);

      // Signal structure complete (NodeGraph rebuilds edges here)
      Logger.debug('🔍 Step 5: Emitting completion events...');
      this.emit('scene:structureComplete', {
        nodeCount: this.scene.map.size,
        topLevelCount: this.scene.tree.length,
        elapsedTime,
      });

      this.emit('scene:buildComplete', {
        nodeCount: this.scene.map.size,
        topLevelCount: this.scene.tree.length,
        elapsedTime,
      });

      this.emit('scene:complete', { scene: this.scene });

      // Legacy compat for traditional event listeners
      this.emit('sceneTreeUpdated', this.scene);
      Logger.info('✅ SceneTreeUpdated event emitted');

      return this.scene.tree;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('abort') || message.includes('cancelled')) {
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

  // ─── Node creation (same logic as SceneService.addSceneItem) ──────

  private async addSceneItem(
    sceneItems: SceneNode[],
    item: Record<string, unknown> | null,
    pinInfo: Record<string, unknown> | null,
    level: number
  ): Promise<SceneNode | undefined> {
    let itemName = String(item?.name || pinInfo?.staticLabel || 'Unnamed');
    let outType: string | number = String(pinInfo?.outType || pinInfo?.type || '');
    let graphInfo: import('./types').GraphInfo | undefined;
    let nodeInfo: import('./types').NodeInfo | undefined;
    let isGraph = false;
    let position: { x: number; y: number } | undefined;

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

        // Position for level-1 nodes
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
        `  📄 Added item: ${displayName} (type: "${outType}", icon: ${icon}, level: ${level})`
      );

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

      // Load filePath
      const responseHas = await this.apiService.callApi('ApiItem', 'hasAttr', item.handle, {
        id: AttributeId.A_FILENAME,
      });
      if (responseHas?.result === true) {
        const response = await this.apiService.callApi('ApiItem', 'getValueByAttrID', item.handle, {
          attribute_id: AttributeId.A_FILENAME,
          expected_type: AttrType.AT_STRING,
        });
        if (response) {
          const valueField = Object.keys(response)[1];
          item.filePath = Object(response)[Object(response)[valueField]] as string;
          //          Logger.info(`FILE for ${item.name}: ${item.filePath}`);

          // Load vertsPerPoly
          const responseHasIndices = await this.apiService.callApi(
            'ApiItem',
            'hasAttr',
            item.handle,
            { id: AttributeId.A_POLY_OBJECT_INDICES }
          );
          if (responseHasIndices?.result === true) {
            const indicesResponse = await this.apiService.callApi(
              'ApiItem',
              'getValueByAttrID',
              item.handle,
              { attribute_id: AttributeId.A_POLY_OBJECT_INDICES, expected_type: AttrType.AT_INT }
            );
            if (indicesResponse) {
              const valField = Object.keys(indicesResponse)[1];
              const vertsPerPoly = Object(indicesResponse)[
                Object(indicesResponse)[valField]
              ] as number[];
              item.vertsPerPoly = vertsPerPoly;
              Logger.info(`vertsPerPoly for ${item.name}: ${valField} ${vertsPerPoly.length}`);
              Logger.info(
                `vertsPerPoly ${JSON.stringify(Object(indicesResponse))} ${vertsPerPoly}`
              );
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
        const resolvedHandle = getHandle(response?.result);
        if (!resolvedHandle) {
          throw new Error('Failed ApiProjectManager/rootNodeGraph');
        }
        itemHandle = resolvedHandle;
        const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', itemHandle);
        isGraph = asBool(isGraphResponse?.result, false);
      }

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
            const node = await this.addSceneItem(
              sceneItems,
              asObject(itemResponse.result) as Record<string, unknown>,
              null,
              level
            );

            // Emit level-1 node to UI without blocking the loading loop
            if (level === 1 && node) {
              this.emitAsync('scene:nodeAdded', { node, level: 0 });
            }
          }
        }

        // Build deep children for top-level items (same as SceneService)
        if (level === 1) {
          // All level-1 nodes created — notify UI for expansion init
          this.emitAsync('scene:level0Complete', { nodes: sceneItems });
          Logger.debug(`🔄 Building children for ${sceneItems.length} level 1 items`);

          for (const item of sceneItems) {
            await this.addItemChildren(item);

            // Notify UI that this subtree is complete (non-blocking)
            if (item.children && item.children.length > 0) {
              this.emitAsync('scene:childrenLoaded', { parent: item, children: item.children });
            }
          }
          Logger.debug(`✅ Finished building children for all level 1 items`);
        }
      } else if (itemHandle != 0) {
        // Pin-based traversal
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
                  pinInfo.pinId = i;
                  pinInfo.pinOwner = { handle: itemHandle };
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

  /**
   * Emit an event asynchronously via setTimeout so it never blocks the loading loop.
   * React will process the state updates in a future macrotask while the loader
   * continues making API calls uninterrupted.
   */
  private emitAsync(event: string, data?: unknown): void {
    setTimeout(() => this.emit(event, data), 0);
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
