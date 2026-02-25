/**
 * Node Service - Node creation, deletion, and connection management
 * Handles node lifecycle and pin connections
 */

import { EventEmitter } from '../../utils/EventEmitter';
import { BaseService } from './BaseService';
import { ApiService, asObject, asNumber, asBool, getHandle } from './ApiService';
import { SceneNode } from './types';
import { SceneService } from './SceneService';
import { ObjectType } from '../../constants/OctaneTypes';
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
    Logger.debug('🔧 Creating node:', nodeType, 'ID:', nodeTypeId);

    try {
      const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
      if (!rootResponse?.result) {
        Logger.error('❌ Failed to get root node graph');
        return null;
      }

      const owner = rootResponse.result;
      Logger.debug('📦 Root node graph:', owner);

      const createResponse = await this.apiService.callApi('ApiNode', 'create', null, {
        type: nodeTypeId,
        ownerGraph: owner,
        configurePins: true,
      });

      const createdNodeHandle = getHandle(createResponse?.result);
      if (!createdNodeHandle) {
        Logger.error('❌ Failed to create node');
        return null;
      }
      Logger.debug('✅ Node created with handle:', createdNodeHandle);

      Logger.debug('➕ Adding node to scene tree...');
      await this.sceneService.buildSceneTree(createdNodeHandle);

      const newNode = this.sceneService.getNodeByHandle(createdNodeHandle);
      if (newNode) {
        Logger.debug('✅ Node added incrementally - emitting nodeAdded event');
        this.emit('nodeAdded', { node: newNode, handle: createdNodeHandle });
      } else {
        Logger.error('❌ Failed to find newly created node in scene map');
      }

      return createdNodeHandle;
    } catch (error) {
      Logger.error(
        '❌ Error creating node:',
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  /**
   * Delete a node and clean up any collapsed children still held in scene.map.
   * "Optimized" means we avoid a full scene reload by patching scene.map/tree directly.
   */
  async deleteNodeOptimized(nodeHandle: number): Promise<boolean> {
    Logger.debug('🗑️ Deleting node:', nodeHandle);

    try {
      const scene = this.sceneService.getScene();
      const node = scene.map.get(nodeHandle);

      const collapsedChildren = this.findCollapsedChildren(node);
      Logger.debug(`🔍 Found ${collapsedChildren.length} collapsed children to remove`);

      await this.apiService.callApi('ApiItem', 'destroy', nodeHandle, {});
      Logger.debug('✅ Node deleted from Octane');

      scene.map.delete(nodeHandle);
      collapsedChildren.forEach(h => scene.map.delete(h));

      scene.tree = scene.tree.filter(n => n.handle !== nodeHandle);

      Logger.debug('✅ Scene map and tree updated (optimized)');

      this.emit('nodeDeleted', { handle: nodeHandle, collapsedChildren });

      return true;
    } catch (error) {
      Logger.error(
        '❌ Error deleting node:',
        error instanceof Error ? error.message : String(error)
      );
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
      `🔌 Connecting pin: target=${targetNodeHandle}, pin=${pinIdx}, source=${sourceNodeHandle}`
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

    Logger.debug('✅ Pin connected in Octane');
  }

  /**
   * Disconnects a pin by connecting handle 0 (Octane's null node)
   */
  async disconnectPin(nodeHandle: number, pinIdx: number, evaluate: boolean = true): Promise<void> {
    Logger.debug(`🔌 Disconnecting pin: node=${nodeHandle}, pin=${pinIdx}`);

    await this.apiService.callApi('ApiNode', 'connectToIx', nodeHandle, {
      pinIdx,
      sourceNode: {
        handle: 0, // 0 = disconnect
        type: ObjectType.ApiNode,
      },
      evaluate,
      doCycleCheck: true,
    });

    Logger.debug('✅ Pin disconnected in Octane');
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

    Logger.debug('🔍 Checking if old source node is collapsed:', oldSourceHandle);

    const scene = this.sceneService.getScene();

    if (!this.isNodeExpanded(oldSourceHandle)) {
      Logger.debug('🗑️ Removing orphaned collapsed node from map:', oldSourceHandle);

      const oldSourceNode = scene.map.get(oldSourceHandle);
      const collapsedChildren = this.findCollapsedChildren(oldSourceNode);

      scene.map.delete(oldSourceHandle);
      collapsedChildren.forEach(h => scene.map.delete(h));

      Logger.debug(`✅ Removed ${1 + collapsedChildren.length} collapsed nodes from map`);
    } else {
      Logger.debug('✅ Old source is expanded, keeping in scene tree');
    }

    this.emit('sceneUpdated', scene);
  }

  private isNodeExpanded(handle: number): boolean {
    const scene = this.sceneService.getScene();
    return scene.tree.some(node => node.handle === handle);
  }

  private findCollapsedChildren(node: SceneNode | undefined): number[] {
    if (!node?.children) return [];

    const collapsed: number[] = [];
    const scene = this.sceneService.getScene();

    for (const child of node.children) {
      if (!child.handle) continue;

      if (!this.isNodeExpanded(child.handle)) {
        collapsed.push(child.handle);
        const grandNode = scene.map.get(child.handle);
        collapsed.push(...this.findCollapsedChildren(grandNode));
      }
    }

    return collapsed;
  }

  /**
   * Copy a single node (creates a duplicate)
   */
  async copyNode(nodeHandle: number): Promise<number | null> {
    Logger.debug('📋 Copying node:', nodeHandle);

    try {
      const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
      const graphHandle = getHandle(rootResponse?.result);
      if (!graphHandle) {
        Logger.error('❌ Failed to get root node graph');
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
        Logger.error('❌ Failed to copy node');
        return null;
      }
      Logger.debug('✅ Node copied with handle:', copiedNodeHandle);

      await this.sceneService.buildSceneTree(copiedNodeHandle);

      const newNode = this.sceneService.getNodeByHandle(copiedNodeHandle);
      if (newNode) {
        Logger.debug('✅ Copied node added - emitting nodeAdded event');
        this.emit('nodeAdded', { node: newNode, handle: copiedNodeHandle });
      }

      return copiedNodeHandle;
    } catch (error) {
      Logger.error(
        '❌ Error copying node:',
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  /**
   * Copy multiple nodes
   */
  async copyNodes(nodeHandles: number[]): Promise<number[]> {
    Logger.debug('📋 Copying multiple nodes:', nodeHandles);

    try {
      const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
      const graphHandle = getHandle(rootResponse?.result);
      if (!graphHandle) {
        Logger.error('❌ Failed to get root node graph');
        return [];
      }

      const sourceItems = nodeHandles.map(h => ({ handle: h }));

      const copyResponse = await this.apiService.callApi('ApiNodeGraph', 'copyFrom2', graphHandle, {
        sourceItems: sourceItems,
        sourceItemsCount: sourceItems.length,
        origItems: sourceItems,
        origItemsCount: sourceItems.length,
      });

      if (!copyResponse?.copiedItems) {
        Logger.error('❌ Failed to copy nodes');
        return [];
      }

      Logger.debug('📋 Copy response:', copyResponse);

      const copiedHandles: number[] = [];
      const copiedItems = copyResponse.copiedItems;

      if (Array.isArray(copiedItems)) {
        for (const item of copiedItems) {
          const h = getHandle(item);
          if (h) copiedHandles.push(h);
        }
      } else {
        const copiedItemsObj = asObject(copiedItems);
        if (copiedItemsObj && Array.isArray(copiedItemsObj.items)) {
          for (const item of copiedItemsObj.items) {
            const h = getHandle(item);
            if (h) copiedHandles.push(h);
          }
        }
      }

      Logger.debug('📋 Extracted copied handles:', copiedHandles);

      for (const handle of copiedHandles) {
        await this.sceneService.buildSceneTree(handle);
        const newNode = this.sceneService.getNodeByHandle(handle);
        if (newNode) {
          this.emit('nodeAdded', { node: newNode, handle });
        }
      }

      Logger.debug('✅ Copied nodes:', copiedHandles);
      return copiedHandles;
    } catch (error) {
      Logger.error(
        '❌ Error copying nodes:',
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  /**
   * Group selected nodes into a group node
   */
  async groupNodes(nodeHandles: number[]): Promise<number | null> {
    Logger.debug('📦 Grouping nodes:', nodeHandles);

    try {
      const rootResponse = await this.apiService.callApi('ApiProjectManager', 'rootNodeGraph', {});
      const graphHandle = getHandle(rootResponse?.result);
      if (!graphHandle) {
        Logger.error('❌ Failed to get root node graph');
        return null;
      }

      const items = nodeHandles.map(h => ({ handle: h }));

      const groupResponse = await this.apiService.callApi(
        'ApiNodeGraph',
        'groupItems',
        graphHandle,
        {
          items: items,
          itemsCount: items.length,
        }
      );

      const groupNodeHandle = getHandle(groupResponse?.result);
      if (!groupNodeHandle) {
        Logger.error('❌ Failed to group nodes');
        return null;
      }
      Logger.debug('✅ Group created with handle:', groupNodeHandle);

      const scene = this.sceneService.getScene();
      nodeHandles.forEach(h => {
        scene.map.delete(h);
        scene.tree = scene.tree.filter(n => n.handle !== h);
      });

      await this.sceneService.buildSceneTree(groupNodeHandle);

      const groupNode = this.sceneService.getNodeByHandle(groupNodeHandle);
      if (groupNode) {
        this.emit('nodeAdded', { node: groupNode, handle: groupNodeHandle });
      }

      nodeHandles.forEach(h => {
        this.emit('nodeDeleted', { handle: h, collapsedChildren: [] });
      });

      return groupNodeHandle;
    } catch (error) {
      Logger.error(
        '❌ Error grouping nodes:',
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  /**
   * Ungroup a group node
   */
  async ungroupNode(groupNodeHandle: number): Promise<number[]> {
    Logger.debug('📦 Ungrouping node:', groupNodeHandle);

    try {
      const ungroupResponse = await this.apiService.callApi(
        'ApiNodeGraph',
        'ungroup',
        groupNodeHandle,
        {}
      );

      if (!ungroupResponse?.ungroupedItems) {
        Logger.error('❌ Failed to ungroup node');
        return [];
      }

      Logger.debug('📋 Ungroup response:', ungroupResponse);

      const ungroupedHandles: number[] = [];
      const ungroupedItems = ungroupResponse.ungroupedItems;

      if (Array.isArray(ungroupedItems)) {
        for (const item of ungroupedItems) {
          const h = getHandle(item);
          if (h) ungroupedHandles.push(h);
        }
      } else {
        const ungroupedObj = asObject(ungroupedItems);
        if (ungroupedObj && Array.isArray(ungroupedObj.items)) {
          for (const item of ungroupedObj.items) {
            const h = getHandle(item);
            if (h) ungroupedHandles.push(h);
          }
        }
      }

      Logger.debug('📋 Extracted ungrouped handles:', ungroupedHandles);

      const scene = this.sceneService.getScene();
      scene.map.delete(groupNodeHandle);
      scene.tree = scene.tree.filter(n => n.handle !== groupNodeHandle);
      this.emit('nodeDeleted', { handle: groupNodeHandle, collapsedChildren: [] });

      for (const handle of ungroupedHandles) {
        await this.sceneService.buildSceneTree(handle);
        const newNode = this.sceneService.getNodeByHandle(handle);
        if (newNode) {
          this.emit('nodeAdded', { node: newNode, handle });
        }
      }

      Logger.debug('✅ Ungrouped into nodes:', ungroupedHandles);
      return ungroupedHandles;
    } catch (error) {
      Logger.error(
        '❌ Error ungrouping node:',
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  /**
   * Expand a node (show all children/pins)
   */
  async expandNode(nodeHandle: number): Promise<boolean> {
    Logger.debug('📈 Expanding node:', nodeHandle);

    try {
      await this.apiService.callApi('ApiItem', 'expand', nodeHandle, {});
      Logger.debug('✅ Node expanded:', nodeHandle);
      return true;
    } catch (error) {
      Logger.error(
        '❌ Error expanding node:',
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  /**
   * Collapse a node (hide children/pins)
   */
  async collapseNode(nodeHandle: number): Promise<boolean> {
    Logger.debug('📉 Collapsing node:', nodeHandle);

    try {
      const response = await this.apiService.callApi('ApiItem', 'collapse', nodeHandle, {});
      const collapsed = asBool(response?.result, false);
      Logger.debug('✅ Node collapse result:', collapsed);
      return collapsed;
    } catch (error) {
      Logger.error(
        '❌ Error collapsing node:',
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
        '❌ Error getting node position:',
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  /**
   * Set the position of a node in the graph
   */
  async setNodePosition(nodeHandle: number, x: number, y: number): Promise<boolean> {
    Logger.debug(`📍 Setting node position: handle=${nodeHandle}, x=${x}, y=${y}`);

    try {
      await this.apiService.callApi('ApiItem', 'setPosition', nodeHandle, {
        newPos: { x, y },
      });
      Logger.debug('✅ Node position updated');
      return true;
    } catch (error) {
      Logger.error(
        '❌ Error setting node position:',
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  /**
   * Replace a node with a new node of a different type
   * This maintains the connection to the parent pin
   */
  async replaceNode(oldNodeHandle: number, newNodeType: string): Promise<number | null> {
    Logger.debug(`🔄 Replacing node ${oldNodeHandle} with ${newNodeType}`);

    try {
      const scene = this.sceneService.getScene();
      const oldNode = scene.map.get(oldNodeHandle);

      if (!oldNode) {
        Logger.error('❌ Old node not found in scene');
        return null;
      }

      const pinInfo = oldNode.pinInfo;
      const parentHandle = pinInfo?.pinOwner?.handle;
      const pinIdx = pinInfo?.pinId;

      if (!parentHandle || pinIdx === undefined) {
        Logger.error('❌ Could not find parent or pin index for node');
        return null;
      }

      Logger.debug(`  Parent: ${parentHandle}, Pin: ${pinIdx}`);

      const nodeTypeId = await this.getNodeTypeId(newNodeType);
      if (!nodeTypeId) {
        Logger.error('❌ Could not get node type ID for', newNodeType);
        return null;
      }

      const newNodeHandle = await this.createNode(newNodeType, nodeTypeId);
      if (!newNodeHandle) {
        Logger.error('❌ Failed to create new node');
        return null;
      }

      Logger.debug(`✅ Created new node: ${newNodeHandle}`);

      await this.connectPinByIndex(parentHandle, pinIdx, newNodeHandle, true);
      Logger.debug(`✅ Connected new node to parent pin`);

      await this.deleteNodeOptimized(oldNodeHandle);
      Logger.debug(`✅ Deleted old node`);

      await this.sceneService.buildSceneTree();

      return newNodeHandle;
    } catch (error) {
      Logger.error('❌ Failed to replace node:', error);
      return null;
    }
  }

  /**
   * Create a new node and connect it to an empty pin slot
   */
  async createNodeForPin(
    parentHandle: number,
    pinIdx: number,
    nodeType: string
  ): Promise<number | null> {
    Logger.debug(`➕ Creating ${nodeType} for pin ${pinIdx} on parent ${parentHandle}`);

    try {
      const nodeTypeId = await this.getNodeTypeId(nodeType);
      if (!nodeTypeId) {
        Logger.error('❌ Could not get node type ID for', nodeType);
        return null;
      }

      const newNodeHandle = await this.createNode(nodeType, nodeTypeId);
      if (!newNodeHandle) {
        Logger.error('❌ Failed to create new node');
        return null;
      }

      await this.connectPinByIndex(parentHandle, pinIdx, newNodeHandle, true);
      Logger.debug(`✅ Created and connected ${nodeType} to pin`);

      await this.sceneService.buildSceneTree();

      return newNodeHandle;
    } catch (error) {
      Logger.error('❌ Failed to create node for pin:', error);
      return null;
    }
  }

  /**
   * Placeholder for getNodeTypeId — not currently used.
   * The API accepts the node type string (e.g., "NT_MAT_DIFFUSE") directly;
   * a numeric type ID is not required for the current createNode/replaceNode calls.
   */
  private async getNodeTypeId(_nodeType: string): Promise<number | null> {
    return 1;
  }
}
