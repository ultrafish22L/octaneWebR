/**
 * Unified Edit Commands
 * 
 * Centralized command handlers for all edit operations (cut, copy, paste, delete, etc.)
 * Ensures consistent behavior across all entry points:
 * - Main menu (MenuBar)
 * - Context menus (NodeGraph, SceneOutliner, NodeInspector)
 * - Keyboard shortcuts
 * 
 * These commands integrate with the existing event system:
 * - Commands call OctaneClient API methods
 * - API methods emit events (nodeDeleted, nodeAdded, etc.)
 * - Components listen to events and update their state
 * 
 * This module provides the command layer that coordinates everything.
 */

import { Logger } from '../utils/Logger';
import { OctaneClient, SceneNode } from '../services/OctaneClient';

export interface EditCommandContext {
  client: OctaneClient;
  selectedNodes: SceneNode[];
  onSelectionClear?: () => void;
  onComplete?: () => void;
}

/**
 * Unified Edit Commands
 * All commands follow the same pattern:
 * 1. Validate input
 * 2. Call OctaneClient API (which emits events)
 * 3. Clear selection if appropriate
 * 4. Call onComplete callback
 */
export class EditCommands {
  /**
   * Delete selected nodes
   * 
   * Flow:
   * 1. Delete each node via client.deleteNode()
   * 2. client.deleteNode → nodeService.deleteNodeOptimized
   * 3. deleteNodeOptimized emits 'nodeDeleted' event
   * 4. SceneOutliner listens and removes from tree
   * 5. NodeGraph syncs via sceneTree prop update
   * 6. Clear selection
   */
  static async deleteNodes(context: EditCommandContext): Promise<boolean> {
    const { client, selectedNodes, onSelectionClear, onComplete } = context;
    
    if (!selectedNodes || selectedNodes.length === 0) {
      Logger.warn('⚠️ Delete: No nodes selected');
      return false;
    }

    Logger.debug(`🗑️ EditCommands.delete: Deleting ${selectedNodes.length} node(s)...`);
    
    let successCount = 0;
    let failCount = 0;
    
    // Delete all selected nodes
    // Each deleteNode call will emit 'nodeDeleted' event
    for (const node of selectedNodes) {
      try {
        Logger.debug(`🗑️ EditCommands: Deleting node handle=${node.handle} name="${node.name || node.label || 'unknown'}" type="${node.type || 'unknown'}"`);
        const success = await client.deleteNode(String(node.handle));
        
        if (success) {
          successCount++;
          Logger.debug(`✅ EditCommands: Deleted node ${node.handle} - 'nodeDeleted' event should have been emitted`);
        } else {
          failCount++;
          Logger.error(`❌ EditCommands: Failed to delete node: ${node.handle}`);
        }
      } catch (error) {
        failCount++;
        Logger.error(`❌ EditCommands: Error deleting node ${node.handle}:`, error);
      }
    }
    
    Logger.debug(`🗑️ Delete complete: ${successCount} succeeded, ${failCount} failed`);
    
    // Clear selection after successful deletion
    if (successCount > 0) {
      if (onSelectionClear) {
        Logger.debug('🔲 Clearing selection after delete');
        onSelectionClear();
      }
      
      if (onComplete) {
        Logger.debug('✅ Delete operation complete - calling onComplete');
        onComplete();
      }
    }
    
    return successCount > 0;
  }

  /**
   * Cut selected nodes to clipboard
   * 
   * Simplified: Just maps to delete for now
   * TODO: Implement full cut/paste when clipboard serialization is ready
   */
  static async cutNodes(context: EditCommandContext): Promise<boolean> {
    const { selectedNodes } = context;
    
    if (!selectedNodes || selectedNodes.length === 0) {
      Logger.warn('⚠️ Cut: No nodes selected');
      return false;
    }

    Logger.debug(`✂️ EditCommands.cut: ${selectedNodes.length} node(s) - mapping to delete`);
    
    // For now, just delete (no clipboard)
    // TODO: Add clipboard serialization before delete
    const deleted = await this.deleteNodes(context);
    if (!deleted) {
      Logger.error('❌ Cut: Failed to delete nodes');
      return false;
    }
    
    Logger.debug('✅ Cut complete (deleted)');
    return true;
  }

  /**
   * Copy selected nodes to clipboard
   * 
   * Flow:
   * 1. Store node handles in localStorage
   * 2. Octane will handle duplication on paste using copyFrom2 API
   */
  static async copyNodes(context: EditCommandContext): Promise<boolean> {
    const { selectedNodes } = context;
    
    if (!selectedNodes || selectedNodes.length === 0) {
      Logger.warn('⚠️ Copy: No nodes selected');
      alert('Copy\n\nNo nodes selected.\n\nSelect one or more nodes first.');
      return false;
    }

    Logger.debug(`📋 EditCommands.copy: ${selectedNodes.length} node(s)`);
    
    try {
      const clipboard = {
        type: 'octane-nodes',
        handles: selectedNodes.map(n => n.handle),
        timestamp: Date.now()
      };
      
      localStorage.setItem('octane-clipboard', JSON.stringify(clipboard));
      Logger.debug('✅ Copied to clipboard (localStorage):', clipboard.handles);
      
      return true;
    } catch (error) {
      Logger.error('❌ Copy failed:', error);
      return false;
    }
  }

  /**
   * Paste nodes from clipboard
   * 
   * Flow:
   * 1. Read handles from clipboard
   * 2. Use copyNodes API to duplicate them
   * 3. Trigger scene refresh
   */
  static async pasteNodes(context: EditCommandContext): Promise<boolean> {
    const { client, onComplete } = context;
    
    Logger.debug('📋 EditCommands.paste: Reading from clipboard...');
    
    try {
      const clipboardText = localStorage.getItem('octane-clipboard');
      if (!clipboardText) {
        Logger.warn('⚠️ Paste: Clipboard is empty');
        alert('Clipboard is empty\n\nUse Copy first to add nodes to clipboard.');
        return false;
      }
      
      const clipboard = JSON.parse(clipboardText);
      
      if (clipboard.type !== 'octane-nodes') {
        Logger.warn('⚠️ Paste: Invalid clipboard data type');
        alert('Invalid clipboard data\n\nClipboard does not contain nodes.');
        return false;
      }
      
      const sourceHandles = clipboard.handles;
      if (!sourceHandles || sourceHandles.length === 0) {
        Logger.warn('⚠️ Paste: No handles in clipboard');
        alert('Clipboard is empty\n\nNo nodes to paste.');
        return false;
      }
      
      Logger.debug(`📋 Paste: ${sourceHandles.length} node(s) from clipboard`);
      
      const copiedHandles = await client.copyNodes(sourceHandles);
      
      if (copiedHandles.length === 0) {
        Logger.error('❌ Paste: Failed to copy nodes');
        alert('Paste Failed\n\nFailed to copy nodes from clipboard.');
        return false;
      }
      
      Logger.debug(`✅ Pasted ${copiedHandles.length} node(s)`);
      
      client.emit('forceSceneRefresh');
      
      if (onComplete) {
        onComplete();
      }
      
      return true;
    } catch (error) {
      Logger.error('❌ Paste failed:', error);
      alert(`Paste Failed\n\n${error}`);
      return false;
    }
  }

  /**
   * Duplicate selected nodes
   * 
   * Flow:
   * 1. Use copyNodes API directly (no clipboard)
   * 2. Trigger scene refresh
   */
  static async duplicateNodes(context: EditCommandContext): Promise<boolean> {
    const { client, selectedNodes, onComplete } = context;
    
    if (!selectedNodes || selectedNodes.length === 0) {
      Logger.warn('⚠️ Duplicate: No nodes selected');
      alert('Duplicate\n\nNo nodes selected.\n\nSelect one or more nodes first.');
      return false;
    }

    Logger.debug(`📑 EditCommands.duplicate: ${selectedNodes.length} node(s)`);
    
    try {
      const sourceHandles = selectedNodes.map(n => n.handle).filter((h): h is number => h !== undefined);
      const copiedHandles = await client.copyNodes(sourceHandles);
      
      if (copiedHandles.length === 0) {
        Logger.error('❌ Duplicate: Failed to duplicate nodes');
        alert('Duplicate Failed\n\nFailed to duplicate selected nodes.');
        return false;
      }
      
      Logger.debug(`✅ Duplicated ${copiedHandles.length} node(s)`);
      
      client.emit('forceSceneRefresh');
      
      if (onComplete) {
        onComplete();
      }
      
      return true;
    } catch (error) {
      Logger.error('❌ Duplicate failed:', error);
      alert(`Duplicate Failed\n\n${error}`);
      return false;
    }
  }

  /**
   * Group selected nodes
   * 
   * Flow:
   * 1. Validate selection (need 2+ nodes)
   * 2. Call groupNodes API with list of selected nodes
   * 3. Trigger scene refresh
   */
  static async groupNodes(context: EditCommandContext): Promise<boolean> {
    const { client, selectedNodes, onComplete } = context;
    
    if (!selectedNodes || selectedNodes.length < 2) {
      Logger.warn('⚠️ Group: Need at least 2 nodes selected');
      alert('Group Nodes\n\nSelect at least 2 nodes to create a group.');
      return false;
    }

    Logger.debug(`📦 EditCommands.group: ${selectedNodes.length} node(s)`);
    
    try {
      const nodeHandles = selectedNodes.map(n => n.handle).filter((h): h is number => h !== undefined);
      const groupHandle = await client.groupNodes(nodeHandles);
      
      if (!groupHandle) {
        Logger.error('❌ Group: Failed to create group node');
        alert('Group Failed\n\nFailed to create group node.');
        return false;
      }
      
      Logger.debug('✅ Group created:', groupHandle);
      
      client.emit('forceSceneRefresh');
      
      if (onComplete) {
        onComplete();
      }
      
      return true;
    } catch (error: any) {
      Logger.error('❌ Group failed:', error);
      alert(`Group Failed\n\n${error}`);
      return false;
    }
  }

  /**
   * Ungroup selected group nodes
   * 
   * Flow:
   * 1. Call ungroup on EACH selected node
   * 2. Trigger scene refresh
   */
  static async ungroupNodes(context: EditCommandContext): Promise<boolean> {
    const { client, selectedNodes, onComplete } = context;
    
    if (!selectedNodes || selectedNodes.length === 0) {
      Logger.warn('⚠️ Ungroup: No nodes selected');
      alert('Ungroup\n\nSelect one or more group nodes to ungroup.');
      return false;
    }

    Logger.debug(`🔓 EditCommands.ungroup: ${selectedNodes.length} node(s)`);
    
    try {
      let totalUngrouped = 0;
      
      for (const node of selectedNodes) {
        if (node.handle === undefined) continue;
        
        Logger.debug(`🔓 Ungrouping node: ${node.label || node.handle}`);
        const ungroupedHandles = await client.ungroupNode(node.handle);
        
        if (ungroupedHandles.length > 0) {
          totalUngrouped += ungroupedHandles.length;
          Logger.debug(`✅ Ungrouped ${ungroupedHandles.length} nodes from ${node.label || node.handle}`);
        } else {
          Logger.warn(`⚠️ Failed to ungroup ${node.label || node.handle} (might not be a group)`);
        }
      }
      
      if (totalUngrouped === 0) {
        Logger.warn('⚠️ Ungroup: No nodes were ungrouped');
        alert('Ungroup Failed\n\nNo nodes were ungrouped.\n\nMake sure selected nodes are groups.');
        return false;
      }
      
      Logger.debug(`✅ Total ungrouped: ${totalUngrouped} nodes from ${selectedNodes.length} groups`);
      
      client.emit('forceSceneRefresh');
      
      if (onComplete) {
        onComplete();
      }
      
      return true;
    } catch (error: any) {
      Logger.error('❌ Ungroup failed:', error);
      alert(`Ungroup Failed\n\n${error}`);
      return false;
    }
  }

  /**
   * Collapse selected nodes (minimize/fold view)
   * 
   * Flow:
   * 1. Call collapse on each selected node
   * 2. Trigger scene refresh
   */
  static async collapseNodes(context: EditCommandContext): Promise<boolean> {
    const { client, selectedNodes, onComplete } = context;
    
    if (!selectedNodes || selectedNodes.length === 0) {
      Logger.warn('⚠️ Collapse: No nodes selected');
      return false;
    }

    Logger.debug(`📉 EditCommands.collapse: ${selectedNodes.length} node(s)`);
    
    try {
      let successCount = 0;
      
      for (const node of selectedNodes) {
        if (node.handle === undefined) continue;
        
        const collapsed = await client.collapseNode(node.handle);
        if (collapsed) {
          successCount++;
          Logger.debug(`✅ Collapsed node: ${node.label || node.handle}`);
        }
      }
      
      Logger.debug(`✅ Collapsed ${successCount}/${selectedNodes.length} nodes`);
      
      client.emit('forceSceneRefresh');
      
      if (onComplete) {
        onComplete();
      }
      
      return successCount > 0;
    } catch (error: any) {
      Logger.error('❌ Collapse failed:', error);
      return false;
    }
  }

  /**
   * Expand selected nodes (show all pins/parameters)
   * 
   * Flow:
   * 1. Call expand on each selected node
   * 2. Trigger scene refresh
   */
  static async expandNodes(context: EditCommandContext): Promise<boolean> {
    const { client, selectedNodes, onComplete } = context;
    
    if (!selectedNodes || selectedNodes.length === 0) {
      Logger.warn('⚠️ Expand: No nodes selected');
      return false;
    }

    Logger.debug(`📈 EditCommands.expand: ${selectedNodes.length} node(s)`);
    
    try {
      let successCount = 0;
      
      for (const node of selectedNodes) {
        if (node.handle === undefined) continue;
        
        const expanded = await client.expandNode(node.handle);
        if (expanded) {
          successCount++;
          Logger.debug(`✅ Expanded node: ${node.label || node.handle}`);
        }
      }
      
      Logger.debug(`✅ Expanded ${successCount}/${selectedNodes.length} nodes`);
      
      client.emit('forceSceneRefresh');
      
      if (onComplete) {
        onComplete();
      }
      
      return successCount > 0;
    } catch (error: any) {
      Logger.error('❌ Expand failed:', error);
      return false;
    }
  }

  /**
   * Select all nodes in the scene
   * 
   * This is a UI-only operation, doesn't touch Octane API
   */
  static async selectAll(
    allNodes: SceneNode[], 
    onSelectionChange: (nodes: SceneNode[]) => void
  ): Promise<boolean> {
    Logger.debug(`🔲 EditCommands.selectAll: ${allNodes.length} node(s)`);
    
    if (!allNodes || allNodes.length === 0) {
      Logger.warn('⚠️ Select All: No nodes in scene');
      return false;
    }
    
    // Get all root-level nodes (nodes that are displayed in graph)
    onSelectionChange(allNodes);
    Logger.debug(`✅ Selected ${allNodes.length} node(s)`);
    
    return true;
  }

  /**
   * Find/Search nodes
   * Opens search dialog - implementation depends on component
   */
  static async findNodes(onOpenSearchDialog: () => void): Promise<boolean> {
    Logger.debug('🔍 EditCommands.find: Opening search dialog');
    onOpenSearchDialog();
    return true;
  }
}
