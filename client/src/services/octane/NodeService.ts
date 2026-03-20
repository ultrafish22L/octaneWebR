/**
 * Node Service - Node creation, deletion, and connection management
 * Handles node lifecycle and pin connections
 */

import { EventEmitter } from '../../utils/EventEmitter';
import { BaseService } from './BaseService';
import { ApiService, asObject, asNumber, asBool, getHandle } from './ApiService';
import { SceneNode } from './types';
import { SceneService } from './SceneService';
import { ObjectType, AttributeId, AttrType, InputAction } from '../../constants/OctaneProtocol';
import { Logger } from '../../utils/Logger';

export class NodeService extends BaseService {
  private apiService: ApiService;
  private sceneService: SceneService;

  constructor(
    emitter: EventEmitter,
    serverUrl: string,
    apiService: ApiService,
    sceneService: SceneService
  ) {
    super(emitter, serverUrl);
    this.apiService = apiService;
    this.sceneService = sceneService;
  }

  async createNode(nodeType: string, nodeTypeId: number): Promise<number | null> {
    Logger.debug('Creating node:', nodeType, 'ID:', nodeTypeId);

    try {
      const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
      if (!rootResponse?.result) {
        Logger.error('Failed to get root node graph');
        return null;
      }

      const owner = rootResponse.result;
      Logger.debug('Root node graph:', owner);

      const createResponse = await this.apiService.callApi('ApiNode', 'create', null, {
        type: nodeTypeId,
        ownerGraph: owner,
        configurePins: true,
      });

      const createdNodeHandle = getHandle(createResponse?.result);
      if (!createdNodeHandle) {
        Logger.error('Failed to create node');
        return null;
      }
      Logger.debug('Node created with handle:', createdNodeHandle);

      Logger.debug('Adding node to scene tree...');
      await this.sceneService.buildSceneTree(createdNodeHandle);

      const newNode = this.sceneService.getNodeByHandle(createdNodeHandle);
      if (newNode) {
        Logger.debug('Node added incrementally - emitting nodeAdded event');
        this.emit('nodeAdded', { node: newNode, handle: createdNodeHandle });
      } else {
        Logger.error('Failed to find newly created node in scene map');
      }

      return createdNodeHandle;
    } catch (error) {
      Logger.error('Error creating node:', error instanceof Error ? error.message : String(error));
      this.emitUserError('Failed to create node');
      return null;
    }
  }

  /**
   * Delete a node and clean up any collapsed children still held in scene.map.
   * "Optimized" means we avoid a full scene reload by patching scene.map/tree directly.
   */
  async deleteNodeOptimized(nodeHandle: number): Promise<boolean> {
    Logger.debug('Deleting node:', nodeHandle);

    try {
      // Collect collapsed children before the async delete removes them
      const scene = this.sceneService.getScene();
      const node = scene.map.get(nodeHandle);
      const expandedHandles = new Set(
        scene.tree.map(n => n.handle).filter((h): h is number => h !== undefined)
      );
      const collapsedChildren = this.findCollapsedChildren(node, expandedHandles);
      Logger.debug(`Found ${collapsedChildren.length} collapsed children to remove`);

      await this.apiService.callApi('ApiItem', 'destroy', nodeHandle, {});
      Logger.debug('Node deleted from Octane');

      // Validate the node still exists before deleting (could have been removed
      // by a concurrent operation like progressive loading or another delete)
      if (scene.map.has(nodeHandle)) {
        scene.map.delete(nodeHandle);
      }
      collapsedChildren.forEach(h => {
        if (scene.map.has(h)) scene.map.delete(h);
      });

      // Remove from top-level and from nested children arrays
      const removedSet = new Set<number>([nodeHandle, ...collapsedChildren]);
      const filterNodes = (nodes: SceneNode[]): SceneNode[] =>
        nodes
          .filter(n => n.handle === undefined || !removedSet.has(n.handle))
          .map(n => (n.children ? { ...n, children: filterNodes(n.children) } : n));
      scene.tree = filterNodes(scene.tree);

      Logger.debug('Scene map and tree updated (optimized)');

      this.emit('nodeDeleted', { handle: nodeHandle, collapsedChildren });

      return true;
    } catch (error) {
      Logger.error('Error deleting node:', error instanceof Error ? error.message : String(error));
      this.emitUserError('Failed to delete node');
      return false;
    }
  }

  async deleteNode(nodeHandle: string): Promise<boolean> {
    const handleNum = Number(nodeHandle);
    return this.deleteNodeOptimized(handleNum);
  }

  /**
   * Connects a source node to a target node's input pin
   * @param targetNodeHandle - Node receiving the connection
   * @param pinIdx - Pin index on target node (0-based)
   * @param sourceNodeHandle - Node providing the output
   * @param evaluate - Whether to trigger scene evaluation after connection
   */
  async connectPinByIndex(
    targetNodeHandle: number,
    pinIdx: number,
    sourceNodeHandle: number,
    evaluate: boolean = true
  ): Promise<void> {
    Logger.debug(
      `Connecting pin: target=${targetNodeHandle}, pin=${pinIdx}, source=${sourceNodeHandle}`
    );

    await this.apiService.callApi('ApiNode', 'connectToIx', targetNodeHandle, {
      pinIdx,
      sourceNode: {
        handle: sourceNodeHandle,
        type: ObjectType.ApiNode,
      },
      evaluate,
      doCycleCheck: true, // Prevents circular dependency crashes
    });

    Logger.debug('Pin connected in Octane');
  }

  /**
   * Disconnects a pin by connecting handle 0 (Octane's null node)
   */
  async disconnectPin(nodeHandle: number, pinIdx: number, evaluate: boolean = true): Promise<void> {
    Logger.debug(`Disconnecting pin: node=${nodeHandle}, pin=${pinIdx}`);

    await this.apiService.callApi('ApiNode', 'connectToIx', nodeHandle, {
      pinIdx,
      sourceNode: {
        handle: 0, // 0 = disconnect
        type: ObjectType.ApiNode,
      },
      evaluate,
      doCycleCheck: true,
    });

    Logger.debug('Pin disconnected in Octane');
  }

  /**
   * Cleans up collapsed nodes after pin rewiring
   *
   * When a node's parent connection changes, the old source may become orphaned.
   * If it was collapsed (not in scene.tree), remove it from scene.map to prevent
   * memory leaks and stale references in the UI.
   */
  async handlePinConnectionCleanup(oldSourceHandle: number | null): Promise<void> {
    if (!oldSourceHandle) return;

    Logger.debug('Checking if old source node is collapsed:', oldSourceHandle);

    const scene = this.sceneService.getScene();
    const expandedHandles = new Set(
      scene.tree.map(n => n.handle).filter((h): h is number => h !== undefined)
    );

    if (!expandedHandles.has(oldSourceHandle)) {
      Logger.debug('Removing orphaned collapsed node from map:', oldSourceHandle);

      const oldSourceNode = scene.map.get(oldSourceHandle);
      const collapsedChildren = this.findCollapsedChildren(oldSourceNode, expandedHandles);
      const removedHandles = new Set<number>([oldSourceHandle, ...collapsedChildren]);

      removedHandles.forEach(h => scene.map.delete(h));

      // Also remove from scene.tree and nested children arrays
      const filterTree = (nodes: SceneNode[]): SceneNode[] =>
        nodes
          .filter(n => n.handle !== undefined && !removedHandles.has(n.handle))
          .map(n => (n.children ? { ...n, children: filterTree(n.children) } : n));
      scene.tree = filterTree(scene.tree);

      Logger.debug(`Removed ${removedHandles.size} collapsed nodes from scene`);
    } else {
      Logger.debug('Old source is expanded, keeping in scene tree');
    }

    this.emit('sceneUpdated', scene);
  }

  private findCollapsedChildren(
    node: SceneNode | undefined,
    expandedHandles: Set<number>
  ): number[] {
    if (!node?.children) return [];

    const collapsed: number[] = [];
    const scene = this.sceneService.getScene();

    for (const child of node.children) {
      if (!child.handle) continue;

      if (!expandedHandles.has(child.handle)) {
        collapsed.push(child.handle);
        const grandNode = scene.map.get(child.handle);
        collapsed.push(...this.findCollapsedChildren(grandNode, expandedHandles));
      }
    }

    return collapsed;
  }

  /**
   * Copy a single node (creates a duplicate)
   */
  async copyNode(nodeHandle: number): Promise<number | null> {
    Logger.debug('Copying node:', nodeHandle);

    try {
      const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
      const graphHandle = getHandle(rootResponse?.result);
      if (!graphHandle) {
        Logger.error('Failed to get root node graph');
        return null;
      }

      const copyResponse = await this.apiService.callApi(
        'ApiNodeGraph',
        'copyItemTree',
        graphHandle,
        {
          rootItem: { handle: nodeHandle },
        }
      );

      const copiedNodeHandle = getHandle(copyResponse?.result);
      if (!copiedNodeHandle) {
        Logger.error('Failed to copy node');
        return null;
      }
      Logger.debug('Node copied with handle:', copiedNodeHandle);

      await this.sceneService.buildSceneTree(copiedNodeHandle);

      const newNode = this.sceneService.getNodeByHandle(copiedNodeHandle);
      if (newNode) {
        Logger.debug('Copied node added - emitting nodeAdded event');
        this.emit('nodeAdded', { node: newNode, handle: copiedNodeHandle });
      }

      return copiedNodeHandle;
    } catch (error) {
      Logger.error('Error copying node:', error instanceof Error ? error.message : String(error));
      this.emitUserError('Failed to copy node');
      return null;
    }
  }

  /**
   * Copy multiple nodes
   */
  /**
   * Get all owned item handles from a node graph
   */
  private async getOwnedItemHandles(graphHandle: number): Promise<number[]> {
    const ownedResponse = await this.apiService.callApi(
      'ApiNodeGraph',
      'getOwnedItems',
      graphHandle
    );
    const listHandle = getHandle(ownedResponse?.list);
    if (!listHandle) return [];

    const sizeResponse = await this.apiService.callApi('ApiItemArray', 'size', listHandle, {});
    const size = asNumber(sizeResponse?.result, 0);
    if (size <= 0) return [];
    if (size > 10000) {
      Logger.warn(`getOwnedItemHandles: item count ${size} exceeds 10,000 cap — returning empty`);
      return [];
    }

    const handles: number[] = [];
    for (let i = 0; i < size; i++) {
      const itemResponse = await this.apiService.callApi('ApiItemArray', 'get', listHandle, {
        index: i,
      });
      const h = getHandle(itemResponse?.result);
      if (h) handles.push(h);
    }
    return handles;
  }

  async copyNodes(nodeHandles: number[]): Promise<number[]> {
    Logger.debug('Copying multiple nodes:', nodeHandles);

    try {
      const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
      const graphHandle = getHandle(rootResponse?.result);
      if (!graphHandle) {
        Logger.error('Failed to get root node graph');
        return [];
      }

      // Snapshot owned items BEFORE copy
      const beforeHandles = new Set(await this.getOwnedItemHandles(graphHandle));
      Logger.debug(`Before copy: ${beforeHandles.size} owned items`);

      // Build ObjectRefArrayT: { data: [ObjectRef, ...] }
      const itemRefs = nodeHandles.map(h => ({
        handle: String(h),
        type: ObjectType.ApiItem,
      }));
      const sourceItems = { data: itemRefs };

      await this.apiService.callApi('ApiNodeGraph', 'copyFrom2', graphHandle, {
        sourceItems,
        sourceItemsCount: itemRefs.length,
        origItems: sourceItems,
        origItemsCount: itemRefs.length,
      });

      // Snapshot owned items AFTER copy — diff to find new handles
      const afterHandles = await this.getOwnedItemHandles(graphHandle);
      const copiedHandles = afterHandles.filter(h => !beforeHandles.has(h));
      Logger.debug(`After copy: ${afterHandles.length} owned items, ${copiedHandles.length} new`);

      if (copiedHandles.length === 0) {
        Logger.error('copyFrom2 succeeded but no new owned items found');
        return [];
      }

      for (const handle of copiedHandles) {
        await this.sceneService.buildSceneTree(handle);
        const newNode = this.sceneService.getNodeByHandle(handle);
        if (newNode) {
          this.emit('nodeAdded', { node: newNode, handle });
        }
      }

      Logger.debug('Copied nodes:', copiedHandles);
      return copiedHandles;
    } catch (error) {
      Logger.error('Error copying nodes:', error instanceof Error ? error.message : String(error));
      this.emitUserError('Failed to copy nodes');
      return [];
    }
  }

  /**
   * Group selected nodes into a group node
   */
  async groupNodes(nodeHandles: number[]): Promise<number | null> {
    Logger.debug('Grouping nodes:', nodeHandles);

    try {
      const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
      const graphHandle = getHandle(rootResponse?.result);
      if (!graphHandle) {
        Logger.error('Failed to get root node graph');
        return null;
      }

      // Build ObjectRefArrayT: { data: [ObjectRef, ...] }
      const itemRefs = nodeHandles.map(h => ({
        handle: String(h),
        type: ObjectType.ApiItem,
      }));
      const items = { data: itemRefs };

      const groupResponse = await this.apiService.callApi(
        'ApiNodeGraph',
        'groupItems',
        graphHandle,
        {
          items,
          itemsCount: itemRefs.length,
        }
      );

      const groupNodeHandle = getHandle(groupResponse?.result);
      if (!groupNodeHandle) {
        Logger.error('Failed to group nodes');
        return null;
      }
      Logger.debug('Group created with handle:', groupNodeHandle);

      await this.sceneService.buildSceneTree(groupNodeHandle);

      // Only remove original nodes after group is successfully built
      const scene = this.sceneService.getScene();
      nodeHandles.forEach(h => {
        scene.map.delete(h);
        scene.tree = scene.tree.filter(n => n.handle !== h);
      });

      const groupNode = this.sceneService.getNodeByHandle(groupNodeHandle);
      if (groupNode) {
        this.emit('nodeAdded', { node: groupNode, handle: groupNodeHandle });
      }

      nodeHandles.forEach(h => {
        this.emit('nodeDeleted', { handle: h, collapsedChildren: [] });
      });

      return groupNodeHandle;
    } catch (error) {
      Logger.error('Error grouping nodes:', error instanceof Error ? error.message : String(error));
      this.emitUserError('Failed to group nodes');
      return null;
    }
  }

  /**
   * Ungroup a group node
   */
  async ungroupNode(_groupNodeHandle: number): Promise<number[]> {
    // BUG-R3-9: ApiNodeGraph.ungroup crashes Octane (~5s after the call).
    // The API itself is broken — Octane's internal ungroup processing triggers
    // a fatal error. Disabled until Octane fixes the ungroup API.
    Logger.warn('Ungroup disabled: ApiNodeGraph.ungroup crashes Octane (BUG-R3-9)');
    this.emitUserError('Ungroup is not available (Octane API limitation)');
    return [];
  }

  /**
   * Expand all items owned by a node's pins back to top-level nodes.
   *
   * Calls ApiItem.expand on the given handle. This is the reverse of
   * collapse — call it on the PARENT node (e.g. Render target) to pull
   * collapsed children (e.g. teapot.obj) back out as standalone nodes.
   */
  async expandNode(nodeHandle: number): Promise<boolean> {
    Logger.debug('Expanding node:', nodeHandle);

    try {
      await this.apiService.callApi('ApiItem', 'expand', nodeHandle, {});
      Logger.debug('Node expanded:', nodeHandle);
      return true;
    } catch (error) {
      Logger.error('Error expanding node:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Collapse a node (hide children/pins)
   */
  async collapseNode(nodeHandle: number): Promise<boolean> {
    Logger.debug('Collapsing node:', nodeHandle);

    try {
      const response = await this.apiService.callApi('ApiItem', 'collapse', nodeHandle, {});
      const collapsed = asBool(response?.result, false);
      Logger.debug('Node collapse result:', collapsed);
      return collapsed;
    } catch (error) {
      Logger.error(
        'Error collapsing node:',
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  /**
   * Get the position of a node in the graph
   */
  async getNodePosition(nodeHandle: number): Promise<{ x: number; y: number } | null> {
    try {
      const response = await this.apiService.callApi('ApiItem', 'position', nodeHandle, {});
      const posObj = asObject(response?.result);
      if (posObj) {
        return {
          x: asNumber(posObj.x, 0),
          y: asNumber(posObj.y, 0),
        };
      }
      return null;
    } catch (error) {
      Logger.error(
        'Error getting node position:',
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  /**
   * Set the position of a node in the graph
   */
  async setNodePosition(nodeHandle: number, x: number, y: number): Promise<boolean> {
    Logger.debug(`Setting node position: handle=${nodeHandle}, x=${x}, y=${y}`);

    try {
      await this.apiService.callApi('ApiItem', 'setPosition', nodeHandle, {
        newPos: { x, y },
      });
      Logger.debug('Node position updated');
      return true;
    } catch (error) {
      Logger.error(
        'Error setting node position:',
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  /**
   * Replace a node with a new node of a different type
   * This maintains the connection to the parent pin
   */
  async replaceNode(
    oldNodeHandle: number,
    newNodeType: string,
    nodeTypeId: number
  ): Promise<number | null> {
    Logger.debug(`Replacing node ${oldNodeHandle} with ${newNodeType} (id=${nodeTypeId})`);

    try {
      const scene = this.sceneService.getScene();
      const oldNode = scene.map.get(oldNodeHandle);

      if (!oldNode) {
        Logger.error('Old node not found in scene');
        return null;
      }

      const pinInfo = oldNode.pinInfo;
      const parentHandle = pinInfo?.pinOwner?.handle;
      const pinIdx = pinInfo?.pinId;

      if (!parentHandle || pinIdx === undefined) {
        Logger.error('Could not find parent or pin index for node');
        return null;
      }

      const newNodeHandle = await this.createNode(newNodeType, nodeTypeId);
      if (!newNodeHandle) {
        Logger.error('Failed to create new node');
        return null;
      }

      try {
        // Connect new node to the parent pin — this automatically disconnects
        // the old node. We do NOT destroy the old node because ApiItem.destroy
        // crashes Octane for recently-disconnected nodes (BUG-R3-4).
        // The old node remains orphaned but harmless in Octane's scene graph.
        await this.connectPinByIndex(parentHandle, pinIdx, newNodeHandle, true);
      } catch (innerError) {
        // Rollback: delete the orphaned new node
        Logger.warn('replaceNode partially failed, rolling back new node:', newNodeHandle);
        try {
          await this.deleteNodeOptimized(newNodeHandle);
        } catch {
          /* best-effort */
        }
        throw innerError;
      }

      await this.sceneService.buildSceneTree();

      return newNodeHandle;
    } catch (error) {
      Logger.error('Failed to replace node:', error);
      this.emitUserError('Failed to replace node');
      return null;
    }
  }

  // ─── Movable input operations ────────────────────────────────────

  /**
   * Add a movable input pin to a node (e.g. NT_GEO_GROUP, NT_MAT_COMPOSITE).
   * Increments A_PIN_COUNT and refreshes the scene subtree.
   */
  async addMovableInput(nodeHandle: number): Promise<boolean> {
    Logger.debug('Adding movable input to node:', nodeHandle);
    try {
      const response = await this.apiService.callApi('ApiItem', 'getValueByAttrID', nodeHandle, {
        attribute_id: AttributeId.A_PIN_COUNT,
        expected_type: AttrType.AT_INT,
      });
      const currentCount = asNumber(response?.int_value, 0);

      await this.apiService.callApi('ApiItem', 'setValueByAttrID', nodeHandle, {
        attribute_id: AttributeId.A_PIN_COUNT,
        int_value: currentCount + 1,
        evaluate: true,
      });

      Logger.debug(`Movable input added (${currentCount} → ${currentCount + 1})`);

      await this.sceneService.refreshNodeChildren(nodeHandle);
      this.emit('sceneUpdated', this.sceneService.getScene());
      return true;
    } catch (error) {
      Logger.error(
        'Failed to add movable input:',
        error instanceof Error ? error.message : String(error)
      );
      this.emitUserError('Failed to add input');
      return false;
    }
  }

  /**
   * Delete a movable input pin from a node.
   * Uses A_INPUT_ACTION = DELETE after selecting the target pin index.
   * Falls back to decrementing A_PIN_COUNT if A_INPUT_ACTION fails.
   */
  async deleteMovableInput(nodeHandle: number, pinIdx: number): Promise<boolean> {
    Logger.debug(`Deleting movable input: node=${nodeHandle}, pin=${pinIdx}`);
    try {
      // Disconnect the pin first
      await this.disconnectPin(nodeHandle, pinIdx, false);

      // Try A_INPUT_ACTION = DELETE
      // The pin index is communicated by setting A_INPUT_ACTION on the pin's handle
      // If that doesn't work, fall back to decrementing A_PIN_COUNT
      try {
        await this.apiService.callApi('ApiItem', 'setValueByAttrID', nodeHandle, {
          attribute_id: AttributeId.A_INPUT_ACTION,
          int_value: (pinIdx << 16) | InputAction.DELETE,
          evaluate: true,
        });
      } catch {
        // Fallback: decrement pin count
        Logger.debug('A_INPUT_ACTION failed, falling back to A_PIN_COUNT decrement');
        const response = await this.apiService.callApi('ApiItem', 'getValueByAttrID', nodeHandle, {
          attribute_id: AttributeId.A_PIN_COUNT,
          expected_type: AttrType.AT_INT,
        });
        const currentCount = asNumber(response?.int_value, 1);
        if (currentCount > 0) {
          await this.apiService.callApi('ApiItem', 'setValueByAttrID', nodeHandle, {
            attribute_id: AttributeId.A_PIN_COUNT,
            int_value: currentCount - 1,
            evaluate: true,
          });
        }
      }

      Logger.debug('Movable input deleted');

      await this.sceneService.refreshNodeChildren(nodeHandle);
      this.emit('sceneUpdated', this.sceneService.getScene());
      return true;
    } catch (error) {
      Logger.error(
        'Failed to delete movable input:',
        error instanceof Error ? error.message : String(error)
      );
      this.emitUserError('Failed to delete input');
      return false;
    }
  }

  /**
   * Move a movable input pin up or down.
   * Uses A_INPUT_ACTION = MOVE_UP or MOVE_DOWN.
   */
  async moveMovableInput(
    nodeHandle: number,
    pinIdx: number,
    direction: 'up' | 'down'
  ): Promise<boolean> {
    Logger.debug(`Moving movable input ${direction}: node=${nodeHandle}, pin=${pinIdx}`);
    try {
      const action = direction === 'up' ? InputAction.MOVE_UP : InputAction.MOVE_DOWN;

      await this.apiService.callApi('ApiItem', 'setValueByAttrID', nodeHandle, {
        attribute_id: AttributeId.A_INPUT_ACTION,
        int_value: (pinIdx << 16) | action,
        evaluate: true,
      });

      Logger.debug(`Movable input moved ${direction}`);

      await this.sceneService.refreshNodeChildren(nodeHandle);
      this.emit('sceneUpdated', this.sceneService.getScene());
      return true;
    } catch (error) {
      Logger.error(
        'Failed to move movable input:',
        error instanceof Error ? error.message : String(error)
      );
      this.emitUserError(`Failed to move input ${direction}`);
      return false;
    }
  }

  /**
   * Create a new node and connect it to an empty pin slot
   */
  async createNodeForPin(
    parentHandle: number,
    pinIdx: number,
    nodeType: string,
    nodeTypeId: number
  ): Promise<number | null> {
    Logger.debug(
      `Creating ${nodeType} (id=${nodeTypeId}) for pin ${pinIdx} on parent ${parentHandle}`
    );

    try {
      const newNodeHandle = await this.createNode(nodeType, nodeTypeId);
      if (!newNodeHandle) {
        Logger.error('Failed to create new node');
        return null;
      }

      await this.connectPinByIndex(parentHandle, pinIdx, newNodeHandle, true);
      await this.sceneService.buildSceneTree();

      return newNodeHandle;
    } catch (error) {
      Logger.error('Failed to create node for pin:', error);
      this.emitUserError('Failed to create node for pin');
      return null;
    }
  }
}
