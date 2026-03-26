/**
 * Scene Service - Scene tree building and management
 *
 * Sequential, recursive, single-pass scene loader. When progressiveEvents is
 * enabled (default), emits incremental UI update events at natural breakpoints
 * so the Outliner, NodeGraph, and NodeInspector can update during the load
 * without flashing. When disabled, the tree loads silently and emits a single
 * burst of events at the end.
 *
 * Events emitted (always):
 *   scene:buildStart         - Load begins
 *   scene:buildProgress      - Status message            { step, progress? }
 *   scene:buildComplete      - Final stats               { nodeCount, topLevelCount, elapsedTime }
 *   sceneTreeUpdated         - Legacy compat              scene
 *
 * Events emitted (progressiveEvents only):
 *   scene:nodeAdded          - Level-1 node created       { node, level: 0 }
 *   scene:level0Complete     - All level-1 nodes created  { nodes }
 *   scene:childrenLoaded     - Children fully loaded      { parent, children }
 *   scene:structureComplete  - Entire tree built          { nodeCount, topLevelCount, elapsedTime }
 *   scene:complete           - Done signal                { scene }
 */

import { Logger } from '../../utils/Logger';
import { EventEmitter } from '../../utils/EventEmitter';
import { BaseService } from './BaseService';
import { ApiService, asObject, asNumber, asBool, getHandle } from './ApiService';
import { Scene, SceneNode } from './types';
import { getIconForType } from '../../constants/PinTypes';
import { AttrType, AttributeId } from '../../constants/OctaneProtocol';
import { cacheManager } from '../CacheManager';

export class SceneService extends BaseService {
  private apiService: ApiService;
  private scene: Scene;
  private abortController: AbortController | null = null;
  private buildPromise: Promise<SceneNode[]> | null = null;
  private buildBlocked = false;
  private readonly progressiveEvents: boolean;

  constructor(
    emitter: EventEmitter,
    serverUrl: string,
    apiService: ApiService,
    progressiveEvents: boolean = true
  ) {
    super(emitter, serverUrl);
    this.apiService = apiService;
    this.progressiveEvents = progressiveEvents;
    this.scene = {
      tree: [],
      map: new Map(),
      connections: new Map(),
    };
  }

  /**
   * Builds or updates the scene tree.
   * @param newNodeHandle - If provided, only builds metadata for this specific node (incremental).
   *                        If omitted, performs full scene tree rebuild.
   */
  async buildSceneTree(newNodeHandle?: number): Promise<SceneNode[]> {
    // If builds are blocked (loadProject in progress), return current tree immediately.
    // This prevents the useSceneTree retry loop from starting new builds.
    if (this.buildBlocked) {
      Logger.debug('Scene build blocked (project load in progress) — skipping');
      return this.scene.tree;
    }

    // Abort any previous build
    if (this.abortController) {
      Logger.debug('Cancelling previous scene tree build');
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Track this build so callers can await completion via waitForIdle()
    const promise = this._doBuildSceneTree(newNodeHandle, signal);
    this.buildPromise = promise;
    try {
      return await promise;
    } finally {
      // Only clear if this is still the active build (not replaced by a newer one)
      if (this.buildPromise === promise) {
        this.buildPromise = null;
      }
    }
  }

  private async _doBuildSceneTree(
    newNodeHandle: number | undefined,
    signal: AbortSignal
  ): Promise<SceneNode[]> {
    // Incremental: single node update
    if (newNodeHandle !== undefined) {
      Logger.debug('Building new node metadata:', newNodeHandle);
      try {
        const tempArray: SceneNode[] = [];
        const newNode = await this.addSceneItem(
          tempArray,
          { handle: newNodeHandle },
          null,
          1,
          signal
        );
        if (newNode) {
          Logger.debug(() => `Building children for new node: ${newNode.name}`);
          await this.addItemChildren(newNode, signal);
          Logger.debug('Node metadata built:', newNode.name);
        } else {
          Logger.error('Failed to create new scene node');
        }
        return this.scene.tree;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        Logger.error('Failed to build new node metadata:', message);
        return this.scene.tree;
      }
    }

    // Full rebuild
    Logger.info('Building scene tree...');
    this.emit('scene:buildStart');

    // Save reference to old scene for rollback on abort.
    // Build into a new scene object and only assign to this.scene on success,
    // so in-flight operations from a cancelled build can't pollute the new scene.
    const previousScene = this.scene;
    const newScene: Scene = { tree: [], map: new Map(), connections: new Map() };
    this.scene = newScene;

    const startTime = performance.now();

    try {
      this.checkAborted(signal);
      this.emit('scene:buildProgress', { step: 'Building scene tree' });
      Logger.debug('Step 1: Getting root node graph...');

      const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
      const rootHandle = getHandle(rootResponse?.result);
      if (!rootHandle) {
        throw new Error('Failed to get root node graph');
      }
      Logger.debug('Root handle:', rootHandle);

      this.checkAborted(signal);

      Logger.debug('Step 2: Checking if root is graph...');
      const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', rootHandle);
      const rootIsGraph = asBool(isGraphResponse?.result, false);
      Logger.debug('Is graph:', rootIsGraph);

      this.checkAborted(signal);

      if (!rootIsGraph) {
        throw new Error('Root handle is not a graph');
      }

      Logger.debug('Step 3: Building tree...');
      this.scene.tree = await this.syncSceneSequential(rootHandle, null, rootIsGraph, 0, signal);

      const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(2);

      Logger.info(`Scene tree built in ${elapsedTime}s:`);
      Logger.info(`   - ${this.scene.tree.length} top-level items`);
      Logger.info(`   - ${this.scene.map.size} total nodes`);

      const stats = {
        nodeCount: this.scene.map.size,
        topLevelCount: this.scene.tree.length,
        elapsedTime,
      };

      if (this.progressiveEvents) {
        this.emit('scene:structureComplete', stats);
      }

      this.emit('scene:buildComplete', stats);

      if (this.progressiveEvents) {
        this.emit('scene:complete', { scene: this.scene });
      }

      this.emit('sceneTreeUpdated', this.scene);
      Logger.info('SceneTreeUpdated event emitted');

      return this.scene.tree;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('abort') || message.includes('cancelled')) {
        Logger.debug('Scene tree build cancelled — restoring previous tree');
        this.scene = previousScene;
      } else {
        Logger.error('Failed to build scene tree:', message);
        if (error instanceof Error && error.stack) {
          Logger.error('Error stack:', error.stack);
        }
        this.emitUserError('Failed to load scene tree');
      }
      return this.scene.tree;
    }
  }

  // ─── Sequential recursive traversal ────────────────────────────────

  private async syncSceneSequential(
    itemHandle: number | null,
    sceneItems: SceneNode[] | null,
    isGraph: boolean,
    level: number,
    signal?: AbortSignal
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

        Logger.debug(() => `Level ${level}: Found ${size} owned items`);

        for (let i = 0; i < size; i++) {
          if (signal?.aborted) throw new Error('Scene tree build was cancelled');
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
              level,
              signal
            );

            // Progressive: notify UI about each level-1 node as it's created
            if (this.progressiveEvents && level === 1 && node) {
              this.emitAsync('scene:nodeAdded', { node, level: 0 });
              this.emitAsync('scene:buildProgress', {
                step: `Node ${i + 1}/${size} — ${node.name}`,
              });
            }
          }
        }

        // Build deep children for top-level items
        if (level === 1) {
          if (this.progressiveEvents) {
            this.emitAsync('scene:level0Complete', { nodes: sceneItems });
          }

          Logger.debug(() => `Building children for ${sceneItems.length} level 1 items`);

          for (const item of sceneItems) {
            if (signal?.aborted) throw new Error('Scene tree build was cancelled');
            await this.addItemChildren(item, signal);

            if (this.progressiveEvents) {
              // Notify UI that this subtree is complete (non-blocking)
              if (item.children && item.children.length > 0) {
                this.emitAsync('scene:childrenLoaded', { parent: item, children: item.children });
              }
            } else {
              // Non-progressive: yield between items to keep event loop responsive
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }
          Logger.debug(() => `Finished building children for all level 1 items`);
        }
      } else if (itemHandle != 0) {
        // Regular nodes: iterate through pins to find connected nodes
        Logger.debug(() => `Level ${level}: Processing node pins for handle ${itemHandle}`);
        try {
          const pinCountResponse = await this.apiService.callApi('ApiNode', 'pinCount', itemHandle);
          const pinCount = asNumber(pinCountResponse?.result, 0);

          Logger.debug(() => `  Found ${pinCount} pins`);

          for (let i = 0; i < pinCount; i++) {
            if (signal?.aborted) throw new Error('Scene tree build was cancelled');
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
                  await this.addSceneItem(sceneItems, connectedNode, pinInfo, level, signal);
                }
              }
            } catch (pinError) {
              Logger.warn(
                `Failed to load pin ${i}:`,
                pinError instanceof Error ? pinError.message : String(pinError)
              );
            }
          }
        } catch (pinCountError) {
          const msg =
            pinCountError instanceof Error ? pinCountError.message : String(pinCountError);
          if (msg.includes('abort') || msg.includes('Failed to fetch')) {
            Logger.debug(() => `pinCount cancelled (build aborted)`);
          } else {
            Logger.error(`Failed to get pin count:`, msg);
          }
        }
      }
    } catch (error) {
      Logger.error(
        'syncSceneSequential failed:',
        error instanceof Error ? error.message : String(error)
      );
    }

    return sceneItems;
  }

  // ─── Node creation ─────────────────────────────────────────────────

  private async addSceneItem(
    sceneItems: SceneNode[],
    item: Record<string, unknown> | null,
    pinInfo: Record<string, unknown> | null,
    level: number,
    signal?: AbortSignal
  ): Promise<SceneNode | undefined> {
    if (signal?.aborted) throw new Error('Scene tree build was cancelled');
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
        // Only set pinInfo if it hasn't been set yet to avoid overwriting
        // with the last-visited pin when the same node is encountered multiple times
        if (!existing.pinInfo && pinInfo) {
          existing.pinInfo = pinInfo as import('./types').PinInfo | undefined;
        }
        if (level > 1) {
          sceneItems.push(existing);
        }
        return existing;
      }

      try {
        itemName = await cacheManager.get(`node:${handleNum}:info:name`, async () => {
          const nameResponse = await this.apiService.callApi('ApiItem', 'name', handleNum);
          return String(nameResponse?.result ?? 'Unnamed');
        });

        outType = await cacheManager.get(`node:${handleNum}:info:outType`, async () => {
          const outTypeResponse = await this.apiService.callApi('ApiItem', 'outType', handleNum);
          return String(outTypeResponse?.result ?? '');
        });

        Logger.debug(
          () => `API returned outType: "${outType}" (type: ${typeof outType}) for ${itemName}`
        );

        isGraph = await cacheManager.get(`node:${handleNum}:info:isGraph`, async () => {
          const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', handleNum);
          return asBool(isGraphResponse?.result, false);
        });

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
              Logger.debug(() => `  Position for ${itemName}: (${position!.x}, ${position!.y})`);
            }
          } catch (posError) {
            Logger.warn(
              `Failed to get position for ${itemName}:`,
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
          'addSceneItem failed to fetch item data:',
          error instanceof Error ? error.message : String(error)
        );
      }
    } else {
      Logger.debug(() => `  Unconnected pin: ${itemName}`);
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
      // Re-check abort before writing to prevent stale data from cancelled builds
      if (signal?.aborted) throw new Error('Scene tree build was cancelled');
      this.scene.map.set(handleNum, entry);
      Logger.debug(
        () => `Added item: ${displayName} (type: "${outType}", icon: ${icon}, level: ${level})`
      );

      if (level > 1) {
        await this.addItemChildren(entry, signal);
      }
    }

    return entry;
  }

  // ─── Recursive child loading ───────────────────────────────────────

  private async addItemChildren(item: SceneNode, signal?: AbortSignal): Promise<void> {
    if (!item || !item.handle) return;
    if (signal?.aborted) throw new Error('Scene tree build was cancelled');

    const isGraph = item.graphInfo != null;

    try {
      const children = await this.syncSceneSequential(
        item.handle,
        null,
        isGraph,
        item.level || 1,
        signal
      );
      item.children = children;

      const attrInfoResponse = await this.apiService.callApi('ApiItem', 'attrInfo', item.handle, {
        id: AttributeId.A_VALUE,
      });
      const attrResultObj = asObject(attrInfoResponse?.result);
      const attrType = attrResultObj?.type;
      // Only set attrInfo for types that getValueByAttrID can actually serialize.
      // Exotic types (AT_BIT_MASK=32758, AT_OBJECT=565, etc.) pass the string
      // check but crash the API — guard by verifying the type exists in AttrType.
      if (
        attrResultObj &&
        typeof attrType === 'string' &&
        attrType !== 'AT_UNKNOWN' &&
        (attrType as string) in AttrType
      ) {
        item.attrInfo = attrResultObj as import('./types').AttrInfo;
        Logger.debugV(() => ` ${item.name} ${JSON.stringify(attrResultObj)}`);
      } else {
        if (attrType !== undefined && attrType !== 'AT_UNKNOWN') {
          Logger.warn(`Unsupported attrInfo type for ${item.name}: ${attrType}`);
        }
        const response = await this.apiService.callApi('ApiItem', 'getValueByAttrID', item.handle, {
          attribute_id: AttributeId.A_FILENAME,
          expected_type: AttrType.AT_STRING,
        });
        if (response) {
          const responseMap = response as Record<string, unknown>;
          // Check for known oneof field names rather than relying on Object.keys() order
          const valueField =
            (responseMap.value as string) ||
            (responseMap.string_value !== undefined ? 'string_value' : undefined) ||
            (responseMap.float_value !== undefined ? 'float_value' : undefined) ||
            (responseMap.int_value !== undefined ? 'int_value' : undefined) ||
            (responseMap.bool_value !== undefined ? 'bool_value' : undefined);
          if (valueField) {
            item.filePath = responseMap[valueField] as string;
          }
        }
        this.emit('scene:buildProgress', { step: `adding node ${item.name}` });
      }
    } catch (error) {
      Logger.error(
        'addItemChildren failed:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // ─── Utilities ─────────────────────────────────────────────────────

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
   * React processes the state updates in a future macrotask while the loader
   * continues making API calls uninterrupted.
   */
  private emitAsync(event: string, data?: unknown): void {
    setTimeout(() => this.emit(event, data), 0);
  }

  // ─── MCP incremental operations (independent of abort mechanism) ──

  /**
   * Build metadata for a single newly-created node WITHOUT going through the
   * abort mechanism.  Multiple concurrent calls are safe because each operates
   * on a different handle and writes to a different slot in the scene map.
   * Returns the built SceneNode, or null on failure.
   */
  async buildNewNode(handle: number): Promise<SceneNode | null> {
    if (this.buildBlocked) return null;
    try {
      const tempArray: SceneNode[] = [];
      const node = await this.addSceneItem(tempArray, { handle }, null, 1);
      if (node) {
        await this.addItemChildren(node);
      }
      return node ?? null;
    } catch (error) {
      Logger.error('buildNewNode failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Refresh an existing node's children (pin connections) in-place.
   * Called when MCP connect_nodes / disconnect_pin fires nodeChanged.
   * Re-fetches the node's input pins from the API and updates the SceneNode
   * so the NodeGraph editor can rebuild edges.
   * Returns true if the node was found and refreshed.
   */
  async refreshNodeChildren(handle: number): Promise<boolean> {
    const node = this.scene.map.get(handle);
    if (!node) return false;
    try {
      await this.addItemChildren(node);
      return true;
    } catch (error) {
      Logger.error(
        'refreshNodeChildren failed:',
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  // ─── Public API ────────────────────────────────────────────────────

  abort(): void {
    this.buildBlocked = true;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Wait for the current buildSceneTree to fully complete (including in-flight gRPC calls).
   * Call after abort() to ensure no gRPC calls are in-flight before sending loadProject.
   */
  async waitForIdle(): Promise<void> {
    if (this.buildPromise) {
      try {
        await this.buildPromise;
      } catch {
        // Build was cancelled or failed — that's fine, we just need it done
      }
    }
  }

  /**
   * Unblock scene builds after loadProject completes.
   */
  unblock(): void {
    this.buildBlocked = false;
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
