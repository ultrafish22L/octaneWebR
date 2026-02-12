/**
 * ProgressiveSceneServiceV3 - Two-pass progressive scene loading
 *
 * Pass 1 (Visible/Structural):
 *   Load level-1 nodes, then their immediate children (pins) one at a time.
 *   Emits scene:pinAdded after each pin so UI updates progressively.
 *   Does NOT recurse into deeper levels.
 *
 * Pass 2 (Deep/Background):
 *   Processes a BFS queue of nodes that need their children loaded.
 *   Yields less frequently (every 3-5 children) since these are typically
 *   collapsed/invisible. Supports promoteNode() to prioritize user-expanded nodes.
 *
 * Events emitted:
 *   scene:buildStart         - Load begins
 *   scene:nodeAdded          - Level-1 node created          { node, level }
 *   scene:level0Complete     - All level-1 nodes done         { nodes }
 *   scene:pinAdded           - Single child added to parent   { parent, child, pinIndex }
 *   scene:childrenLoaded     - All direct children done       { parent, children }
 *   scene:nodeUpdated        - Node metadata updated          { node }
 *   scene:structureComplete  - Pass 1 done                    { nodeCount, ... }
 *   scene:buildComplete      - Both passes done               { nodeCount, ... }
 *   scene:complete           - Final signal                   { scene }
 *   scene:buildProgress      - Progress update                { step, progress }
 */

import { Logger } from '../../utils/Logger';
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';
import { Scene, SceneNode } from './types';
import { getIconForType } from '../../constants/PinTypes';
import { AttrType, AttributeId } from '../../constants/OctaneTypes';

// Yield frequency constants
const PASS1_YIELD_EVERY = 1;  // Yield after every child in Pass 1 (visible)
const PASS2_YIELD_EVERY = 5;  // Yield every N children in Pass 2 (background)

export class ProgressiveSceneServiceV3 extends BaseService {
  private apiService: ApiService;
  private scene: Scene;
  private abortController: AbortController | null = null;

  // Progressive loading state
  private nodesLoaded = 0;
  private totalNodes = 0;
  private loadStartTime = 0;

  // Pass 2: Deep-load queue (BFS order)
  private deepLoadQueue: SceneNode[] = [];

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
   * Build scene tree progressively using two-pass loading.
   */
  async buildSceneProgressive(): Promise<SceneNode[]> {
    // Abort any previous build
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    // Reset state
    this.scene = { tree: [], map: new Map(), connections: new Map() };
    this.nodesLoaded = 0;
    this.totalNodes = 0;
    this.deepLoadQueue = [];
    this.loadStartTime = Date.now();

    Logger.info('🚀 V3: Starting two-pass progressive load');
    this.emit('scene:buildStart');

    try {
      // ── Step 1: Get root node graph ──────────────────────────────
      const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
      if (!rootResponse?.result?.handle) {
        throw new Error('Failed to get root node graph');
      }
      const rootHandle = rootResponse.result.handle;
      this.checkAborted();

      const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', rootHandle);
      const rootIsGraph = isGraphResponse?.result || false;
      this.checkAborted();

      if (!rootIsGraph) {
        throw new Error('Root handle is not a graph — cannot enumerate owned items');
      }

      // ── Step 2: Load level-1 nodes (owned items) ────────────────
      await this.loadLevel1Nodes(rootHandle);

      // ── Step 3: Emit level0Complete ──────────────────────────────
      this.emit('scene:level0Complete', { nodes: this.scene.tree });

      // ── Pass 1: Load immediate children for each level-1 node ───
      Logger.info(`🔄 Pass 1: Loading immediate children for ${this.scene.tree.length} level-1 nodes`);

      for (const node of this.scene.tree) {
        this.checkAborted();
        await this.loadChildrenForNode(node, PASS1_YIELD_EVERY);
        await this.yieldToBrowser();
      }

      const pass1Elapsed = Date.now() - this.loadStartTime;
      Logger.info(`✅ Pass 1 complete: ${this.scene.map.size} nodes in ${pass1Elapsed}ms`);

      this.emit('scene:structureComplete', {
        nodeCount: this.scene.map.size,
        topLevelCount: this.scene.tree.length,
        elapsedTime: (pass1Elapsed / 1000).toFixed(2)
      });

      // ── Pass 2: Deep-load remaining children (background BFS) ──
      Logger.info(`🔄 Pass 2: Deep-loading ${this.deepLoadQueue.length} queued nodes`);
      await this.loadDeepChildren();

      const totalElapsed = Date.now() - this.loadStartTime;
      Logger.info(`✅ V3 complete: ${this.scene.map.size} nodes in ${totalElapsed}ms`);

      this.emit('scene:buildComplete', {
        nodeCount: this.scene.map.size,
        topLevelCount: this.scene.tree.length,
        elapsedTime: (totalElapsed / 1000).toFixed(2)
      });
      this.emit('scene:complete', { scene: this.scene });

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

  // ─── Level-1 Node Loading ────────────────────────────────────────

  /**
   * Load all level-1 nodes (owned items of root graph).
   * Emits scene:nodeAdded + yields after each node.
   */
  private async loadLevel1Nodes(rootHandle: number): Promise<void> {
    const ownedResponse = await this.apiService.callApi('ApiNodeGraph', 'getOwnedItems', rootHandle);
    if (!ownedResponse?.list?.handle) {
      throw new Error('Failed ApiNodeGraph/getOwnedItems');
    }
    const ownedItemsHandle = ownedResponse.list.handle;

    const sizeResponse = await this.apiService.callApi('ApiItemArray', 'size', ownedItemsHandle);
    const size = sizeResponse?.result || 0;

    this.totalNodes = size;
    Logger.debug(`📦 Found ${size} level-1 owned items`);

    for (let i = 0; i < size; i++) {
      this.checkAborted();

      const itemResponse = await this.apiService.callApi('ApiItemArray', 'get', ownedItemsHandle, { index: i });
      if (!itemResponse?.result?.handle) continue;

      const node = await this.createSceneNode(itemResponse.result, null, 1);
      if (!node) continue;

      this.scene.tree.push(node);
      this.nodesLoaded++;

      this.emit('scene:nodeAdded', { node, level: 0 });
      this.emitProgress(`Loading: ${this.nodesLoaded}/${this.totalNodes}`);

      await this.yieldToBrowser();
    }
  }

  // ─── Child Loading (shared by Pass 1 & Pass 2) ──────────────────

  /**
   * Load immediate children for a node (graph owned items or node pins).
   * Creates child SceneNodes with children: [], emits scene:pinAdded for each,
   * and queues NEW children for deep loading.
   *
   * @param parent The node to load children for
   * @param yieldEvery Yield to browser every N children (1 = every child)
   */
  private async loadChildrenForNode(parent: SceneNode, yieldEvery: number): Promise<void> {
    if (!parent.handle || parent.handle === 0) return;

    // Skip nodes that are just pin placeholders (no graph or node info).
    // These have valid-looking handles but are not real Octane node/graph objects,
    // so ANY API call (pinCount, attrInfo, etc.) returns "invalid object reference".
    // The traditional path (SceneService.ts) gates on `item.handle != 0` and never
    // makes API calls on these nodes. Real nodes always have nodeInfo or graphInfo
    // populated during createSceneNode.
    if (!parent.graphInfo && !parent.nodeInfo) {
      return;
    }

    const isGraph = parent.graphInfo != null;

    try {
      if (isGraph) {
        await this.loadGraphChildren(parent, (parent.level || 1) + 1, yieldEvery);
      } else {
        await this.loadPinChildren(parent, (parent.level || 1) + 1, yieldEvery);
      }

      // Load attrInfo for this parent node
      await this.loadAttrInfoForNode(parent);

      // Emit attrInfo update so Inspector can refresh
      if (parent.attrInfo) {
        this.emit('scene:nodeUpdated', { node: parent });
      }
    } catch (error: any) {
      Logger.error(`❌ loadChildrenForNode failed for "${parent.name}":`, error.message);
    }

    // Emit childrenLoaded (signals "all direct children done for this parent")
    if (parent.children && parent.children.length > 0) {
      this.emit('scene:childrenLoaded', { parent, children: parent.children });
    }

    this.emitProgress(`Building: ${parent.name}`);
  }

  /**
   * Load owned items for a graph node as its children.
   */
  private async loadGraphChildren(parent: SceneNode, level: number, yieldEvery: number): Promise<void> {
    const ownedResponse = await this.apiService.callApi('ApiNodeGraph', 'getOwnedItems', parent.handle);
    if (!ownedResponse?.list?.handle) return;

    const ownedItemsHandle = ownedResponse.list.handle;
    const sizeResponse = await this.apiService.callApi('ApiItemArray', 'size', ownedItemsHandle);
    const size = sizeResponse?.result || 0;

    for (let i = 0; i < size; i++) {
      this.checkAborted();

      const itemResponse = await this.apiService.callApi('ApiItemArray', 'get', ownedItemsHandle, { index: i });
      if (!itemResponse?.result?.handle) continue;

      // Check if node already exists BEFORE creating (for dedup/queue logic)
      const wasInMap = this.scene.map.has(Number(itemResponse.result.handle));

      const child = await this.createSceneNode(itemResponse.result, null, level);
      if (!child) continue;

      // Load attrInfo eagerly for each child (matches traditional path where
      // addItemChildren loads attrInfo for every node with a valid handle).
      // This ensures NodeInspector has values ready when scene:childrenLoaded fires.
      if (!wasInMap && child.handle && child.handle !== 0) {
        await this.loadAttrInfoForNode(child);
      }

      parent.children!.push(child);
      this.emit('scene:pinAdded', { parent, child, pinIndex: i });

      // Only queue for deep loading if newly created
      if (!wasInMap && child.handle && child.handle !== 0) {
        this.deepLoadQueue.push(child);
      }

      if ((i + 1) % yieldEvery === 0) {
        await this.yieldToBrowser();
      }
    }
  }

  /**
   * Load pins for a node as its children.
   */
  private async loadPinChildren(parent: SceneNode, level: number, yieldEvery: number): Promise<void> {
    try {
      const pinCountResponse = await this.apiService.callApi('ApiNode', 'pinCount', parent.handle);
      const pinCount = pinCountResponse?.result || 0;

      for (let i = 0; i < pinCount; i++) {
        this.checkAborted();

        try {
          const connectedResponse = await this.apiService.callApi(
            'ApiNode', 'connectedNodeIx', parent.handle,
            { pinIx: i, enterWrapperNode: true }
          );
          const connectedNode = connectedResponse?.result || null;

          const pinInfoHandleResponse = await this.apiService.callApi(
            'ApiNode', 'pinInfoIx', parent.handle, { index: i }
          );

          if (pinInfoHandleResponse?.result?.handle) {
            const pinInfoResponse = await this.apiService.callApi(
              'ApiNodePinInfoEx', 'getApiNodePinInfo',
              pinInfoHandleResponse.result.handle
            );

            const pinInfo = pinInfoResponse?.nodePinInfo || null;
            if (pinInfo) {
              pinInfo.ix = i;

              // Check dedup before creating
              const wasInMap = connectedNode?.handle
                && this.scene.map.has(Number(connectedNode.handle));

              const child = await this.createSceneNode(connectedNode, pinInfo, level);
              if (child) {
                // Load attrInfo eagerly for each child (matches traditional path).
                if (!wasInMap && child.handle && child.handle !== 0) {
                  await this.loadAttrInfoForNode(child);
                }

                parent.children!.push(child);
                this.emit('scene:pinAdded', { parent, child, pinIndex: i });

                // Only queue for deep loading if newly created
                if (!wasInMap && child.handle && child.handle !== 0) {
                  this.deepLoadQueue.push(child);
                }
              }
            }
          }
        } catch (pinError: any) {
          Logger.warn(`  ⚠️ Failed to load pin ${i} for "${parent.name}":`, pinError.message);
        }

        if ((i + 1) % yieldEvery === 0) {
          await this.yieldToBrowser();
        }
      }
    } catch (error: any) {
      Logger.error(`  ❌ Failed to get pin count for "${parent.name}":`, error.message);
    }
  }

  // ─── Pass 2: Deep Loading ────────────────────────────────────────

  /**
   * Process the deep-load queue breadth-first.
   * Loads children for each queued node, adding their children to the back of the queue.
   */
  private async loadDeepChildren(): Promise<void> {
    while (this.deepLoadQueue.length > 0) {
      this.checkAborted();

      const node = this.deepLoadQueue.shift()!;
      await this.loadChildrenForNode(node, PASS2_YIELD_EVERY);
    }
  }

  /**
   * Promote a node to the front of the deep-load queue.
   * Called by UI when user expands or selects a not-yet-loaded node.
   */
  promoteNode(handle: number): void {
    const index = this.deepLoadQueue.findIndex(n => n.handle === handle);
    if (index > 0) {
      const [node] = this.deepLoadQueue.splice(index, 1);
      this.deepLoadQueue.unshift(node);
      Logger.debug(`⏫ Promoted node ${handle} "${node.name}" to front of deep-load queue`);
    }
  }

  // ─── Node Creation ───────────────────────────────────────────────

  /**
   * Create a SceneNode from API data.
   * Fetches metadata (name, type, graphInfo/nodeInfo) but does NOT load children.
   * Children array is initialized to [].
   *
   * If the node already exists in the scene map (dedup), returns the existing
   * node with updated pinInfo.
   */
  private async createSceneNode(
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

      // Dedup: reuse existing node if already in scene map
      const existing = this.scene.map.get(handleNum);
      if (existing && existing.handle) {
        existing.pinInfo = pinInfo;
        return existing;
      }

      try {
        const nameResponse = await this.apiService.callApi('ApiItem', 'name', item.handle);
        itemName = nameResponse?.result || 'Unnamed';

        const outTypeResponse = await this.apiService.callApi('ApiItem', 'outType', item.handle);
        outType = outTypeResponse?.result || '';

        const isGraphResponse = await this.apiService.callApi('ApiItem', 'isGraph', item.handle);
        isGraph = isGraphResponse?.result || false;

        // Position for level 1 nodes only
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
        Logger.error('❌ createSceneNode failed:', error.message);
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

    if (item != null && item.handle != 0) {
      this.scene.map.set(Number(item.handle), entry);
    }

    return entry;
  }

  // ─── Attribute Loading ───────────────────────────────────────────

  /**
   * Load attrInfo, filePath, and vertsPerPoly for a node.
   * Separated from child loading so it can be called independently.
   */
  private async loadAttrInfoForNode(item: SceneNode): Promise<void> {
    if (!item.handle || item.handle === 0) return;

    // Belt-and-suspenders: only call API on real Octane objects.
    // The traditional path gates on `item.handle != 0` inside addSceneItem,
    // and only nodes with graphInfo or nodeInfo had successful API responses
    // during createSceneNode. Placeholders (empty pins) have neither.
    if (!item.graphInfo && !item.nodeInfo) return;

    try {
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
    } catch (error: any) {
      Logger.error(`❌ loadAttrInfoForNode failed for "${item.name}":`, error.message);
    }
  }

  // ─── Utilities ───────────────────────────────────────────────────

  private emitProgress(message: string): void {
    const progress = this.totalNodes > 0
      ? (this.nodesLoaded / this.totalNodes) * 100
      : 0;
    this.emit('scene:buildProgress', { step: message, progress });
  }

  private checkAborted(): void {
    if (this.abortController?.signal.aborted) {
      throw new Error('Operation aborted');
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

  getScene(): Scene {
    return this.scene;
  }

  getNodeByHandle(handle: number): SceneNode | undefined {
    return this.scene.map.get(handle);
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
}
