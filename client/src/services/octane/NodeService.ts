/**
 * Node Service - Node creation, deletion, and connection management
 * Handles node lifecycle and pin connections
 */

import { BaseService } from './BaseService';
import { ApiService } from './ApiService';
import { SceneNode } from './types';
import { SceneService } from './SceneService';
import { ObjectType } from '../../constants/OctaneTypes';
import { Logger } from '../../utils/Logger';

export class NodeService extends BaseService {
  private apiService: ApiService;
  private sceneService: SceneService;

  constructor(emitter: any, serverUrl: string, apiService: ApiService, sceneService: SceneService) {
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
      
      if (!createResponse?.result) {
        Logger.error('❌ Failed to create node');
        return null;
      }
      
      const createdNodeHandle = Number(createResponse.result.handle);
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
    } catch (error: any) {
      Logger.error('❌ Error creating node:', error.message);
      return null;
    }
  }

  async deleteNodeOptimized(nodeHandle: number): Promise<boolean> {
    Logger.debug('🗑️ Deleting node (optimized):', nodeHandle);
    
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
    } catch (error: any) {
      Logger.error('❌ Error deleting node:', error.message);
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
    Logger.debug(`🔌 Connecting pin: target=${targetNodeHandle}, pin=${pinIdx}, source=${sourceNodeHandle}`);
    
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
  async disconnectPin(
    nodeHandle: number,
    pinIdx: number,
    evaluate: boolean = true
  ): Promise<void> {
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
      if (!rootResponse?.result) {
        Logger.error('❌ Failed to get root node graph');
        return null;
      }
      
      const graphHandle = rootResponse.result;
      
      const copyResponse = await this.apiService.callApi('ApiNodeGraph', 'copyItemTree', graphHandle, {
        rootItem: { handle: nodeHandle }
      });
      
      if (!copyResponse?.result) {
        Logger.error('❌ Failed to copy node');
        return null;
      }
      
      const copiedNodeHandle = Number(copyResponse.result.handle);
      Logger.debug('✅ Node copied with handle:', copiedNodeHandle);
      
      await this.sceneService.buildSceneTree(copiedNodeHandle);
      
      const newNode = this.sceneService.getNodeByHandle(copiedNodeHandle);
      if (newNode) {
        Logger.debug('✅ Copied node added - emitting nodeAdded event');
        this.emit('nodeAdded', { node: newNode, handle: copiedNodeHandle });
      }
      
      return copiedNodeHandle;
    } catch (error: any) {
      Logger.error('❌ Error copying node:', error.message);
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
      if (!rootResponse?.result) {
        Logger.error('❌ Failed to get root node graph');
        return [];
      }
      
      const graphHandle = rootResponse.result;
      
      const sourceItems = nodeHandles.map(h => ({ handle: h }));
      
      const copyResponse = await this.apiService.callApi('ApiNodeGraph', 'copyFrom2', graphHandle, {
        sourceItems: sourceItems,
        sourceItemsCount: sourceItems.length,
        origItems: sourceItems,
        origItemsCount: sourceItems.length
      });
      
      if (!copyResponse?.copiedItems) {
        Logger.error('❌ Failed to copy nodes');
        return [];
      }
      
      Logger.debug('📋 Copy response:', copyResponse);
      
      const copiedHandles: number[] = [];
      
      if (Array.isArray(copyResponse.copiedItems)) {
        for (const item of copyResponse.copiedItems) {
          if (item?.handle) {
            copiedHandles.push(Number(item.handle));
          }
        }
      } else if (copyResponse.copiedItems?.items) {
        for (const item of copyResponse.copiedItems.items) {
          if (item?.handle) {
            copiedHandles.push(Number(item.handle));
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
    } catch (error: any) {
      Logger.error('❌ Error copying nodes:', error.message);
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
      if (!rootResponse?.result) {
        Logger.error('❌ Failed to get root node graph');
        return null;
      }
      
      const graphHandle = rootResponse.result;
      
      const items = nodeHandles.map(h => ({ handle: h }));
      
      const groupResponse = await this.apiService.callApi('ApiNodeGraph', 'groupItems', graphHandle, {
        items: items,
        itemsCount: items.length
      });
      
      if (!groupResponse?.result) {
        Logger.error('❌ Failed to group nodes');
        return null;
      }
      
      const groupNodeHandle = Number(groupResponse.result.handle);
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
    } catch (error: any) {
      Logger.error('❌ Error grouping nodes:', error.message);
      return null;
    }
  }

  /**
   * Ungroup a group node
   */
  async ungroupNode(groupNodeHandle: number): Promise<number[]> {
    Logger.debug('📦 Ungrouping node:', groupNodeHandle);
    
    try {
      const ungroupResponse = await this.apiService.callApi('ApiNodeGraph', 'ungroup', groupNodeHandle, {});
      
      if (!ungroupResponse?.ungroupedItems) {
        Logger.error('❌ Failed to ungroup node');
        return [];
      }
      
      Logger.debug('📋 Ungroup response:', ungroupResponse);
      
      const ungroupedHandles: number[] = [];
      
      if (Array.isArray(ungroupResponse.ungroupedItems)) {
        for (const item of ungroupResponse.ungroupedItems) {
          if (item?.handle) {
            ungroupedHandles.push(Number(item.handle));
          }
        }
      } else if (ungroupResponse.ungroupedItems?.items) {
        for (const item of ungroupResponse.ungroupedItems.items) {
          if (item?.handle) {
            ungroupedHandles.push(Number(item.handle));
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
    } catch (error: any) {
      Logger.error('❌ Error ungrouping node:', error.message);
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
    } catch (error: any) {
      Logger.error('❌ Error expanding node:', error.message);
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
      const collapsed = response?.result || false;
      Logger.debug('✅ Node collapse result:', collapsed);
      return collapsed;
    } catch (error: any) {
      Logger.error('❌ Error collapsing node:', error.message);
      return false;
    }
  }

  /**
   * Get the position of a node in the graph
   */
  async getNodePosition(nodeHandle: number): Promise<{ x: number; y: number } | null> {
    try {
      const response = await this.apiService.callApi('ApiItem', 'position', nodeHandle, {});
      if (response?.result) {
        return {
          x: response.result.x || 0,
          y: response.result.y || 0
        };
      }
      return null;
    } catch (error: any) {
      Logger.error('❌ Error getting node position:', error.message);
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
        newPos: { x, y }
      });
      Logger.debug('✅ Node position updated');
      return true;
    } catch (error: any) {
      Logger.error('❌ Error setting node position:', error.message);
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
   * Get the numeric ID for a node type string
   */
  private async getNodeTypeId(_nodeType: string): Promise<number | null> {
    // For now, we'll use 1 as a placeholder
    // The API should handle the nodeType string directly
    return 1;
  }

}
