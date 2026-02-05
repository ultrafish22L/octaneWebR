/**
 * useNodeOperations Hook
 *
 * Handles all node operation logic for NodeGraph:
 * - Copy/paste operations
 * - Node manipulation (collapse, expand, group)
 * - Context menu handlers
 * - Search dialog
 * - Keyboard shortcuts
 * - Edit actions registration
 *
 * Extracted from NodeGraph.tsx (Phase 3/3 refactoring)
 */

import React, { useCallback, useState, useEffect } from 'react';
import { Node, Edge } from '@xyflow/react';
import { SceneNode } from '../../../services/OctaneClient';
import type { OctaneClient } from '../../../services/OctaneClient';
import { OctaneNodeData } from '../OctaneNode';
import { NodeType } from '../../../constants/OctaneTypes';
import { EditCommands } from '../../../commands/EditCommands';
import { Logger } from '../../../utils/Logger';
import type { EditActionsContextType } from '../../../contexts/EditActionsContext';

interface UseNodeOperationsParams {
  client: OctaneClient;
  nodes: Node<OctaneNodeData>[];
  setNodes: React.Dispatch<React.SetStateAction<Node<OctaneNodeData>[]>>;
  edges: Edge[];
  sceneTree: SceneNode[];
  // eslint-disable-next-line no-unused-vars
  onNodeSelect?: (node: SceneNode | null) => void;
  editActions: EditActionsContextType;
}

export interface NodeOperationsHandlers {
  // Context menu handlers
  // eslint-disable-next-line no-unused-vars
  handlePaneContextMenu: (event: React.MouseEvent | MouseEvent) => void;
  // eslint-disable-next-line no-unused-vars
  handleNodeContextMenu: (event: React.MouseEvent, nodeId: string) => void;
  // eslint-disable-next-line no-unused-vars
  handleSelectNodeType: (nodeType: string) => Promise<void>;
  handleCloseContextMenu: () => void;

  // Edit operation handlers
  handleCopy: () => Promise<void>;
  handlePaste: () => Promise<void>;
  handleCut: () => Promise<void>;
  handleDeleteSelected: () => Promise<void>;

  // Node manipulation handlers
  handleCollapseItems: () => Promise<void>;
  handleExpandItems: () => Promise<void>;
  handleGroupItems: () => Promise<void>;

  // Context menu action handlers
  handleShowInOutliner: () => void;
  handleShowInLuaBrowser: () => void;
  handleRenderNode: () => void;
  handleSaveAsMacro: () => void;

  // Search handler
  // eslint-disable-next-line no-unused-vars
  handleSearchSelectNodes: (nodeIds: string[]) => void;

  // State
  contextMenuVisible: boolean;
  contextMenuPosition: { x: number; y: number };
  contextMenuType: 'node' | 'add';
  contextMenuNodeId: string | null;
  searchDialogVisible: boolean;
  // eslint-disable-next-line no-unused-vars
  setSearchDialogVisible: (visible: boolean) => void;
}

export function useNodeOperations({
  client,
  nodes,
  setNodes,
  edges,
  sceneTree,
  onNodeSelect,
  editActions,
}: UseNodeOperationsParams): NodeOperationsHandlers {
  // Context menu state
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuType, setContextMenuType] = useState<'node' | 'add'>('add');
  const [contextMenuNodeId, setContextMenuNodeId] = useState<string | null>(null);

  // Search dialog state
  const [searchDialogVisible, setSearchDialogVisible] = useState(false);

  // Copy/paste clipboard state
  const [copiedNodes, setCopiedNodes] = useState<Node<OctaneNodeData>[]>([]);
  const [copiedEdges, setCopiedEdges] = useState<Edge[]>([]);

  /**
   * Handle paste operation
   * Creates new nodes via API and recreates connections
   */
  const handlePasteNodes = useCallback(async () => {
    if (copiedNodes.length === 0 || !client) return;

    Logger.debug(`📋 Pasting ${copiedNodes.length} node(s)...`);

    try {
      // Map old node IDs to new node handles
      const oldToNewHandleMap = new Map<string, number>();

      // Create new nodes via API
      for (const copiedNode of copiedNodes) {
        const nodeData = copiedNode.data as OctaneNodeData;
        const nodeTypeName = nodeData.sceneNode.nodeInfo?.nodeTypeName;

        if (!nodeTypeName) {
          Logger.warn('Cannot paste node without type name:', nodeData.sceneNode.name);
          continue;
        }

        // Look up numeric node type ID
        const nodeTypeId = NodeType[nodeTypeName];
        if (!nodeTypeId) {
          Logger.warn('Unknown node type:', nodeTypeName);
          continue;
        }

        // Create node via API
        const newHandle = await client.createNode(nodeTypeName, nodeTypeId);

        if (newHandle) {
          oldToNewHandleMap.set(copiedNode.id, newHandle);
          Logger.debug(`✅ Created ${nodeTypeName} with handle ${newHandle}`);
        }
      }

      // Wait for scene to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Recreate connections between pasted nodes
      for (const copiedEdge of copiedEdges) {
        const newSourceHandle = oldToNewHandleMap.get(copiedEdge.source);
        const newTargetHandle = oldToNewHandleMap.get(copiedEdge.target);

        if (!newSourceHandle || !newTargetHandle) continue;

        // Extract target pin index from edge ID
        const targetHandleId = copiedEdge.targetHandle || 'input-0';

        // Parse pin index from handle ID (e.g., "input-0" -> 0)
        const targetPinIndex = parseInt(targetHandleId.split('-')[1], 10);

        if (isNaN(targetPinIndex)) continue;

        // Connect the pins
        await client.connectPinByIndex(newTargetHandle, targetPinIndex, newSourceHandle);
        Logger.debug(`🔗 Connected ${newSourceHandle} → ${newTargetHandle}[${targetPinIndex}]`);
      }

      Logger.debug(`✅ Pasted ${copiedNodes.length} node(s) successfully`);

      // Note: Scene will auto-refresh via sceneTree prop update from parent
    } catch (error) {
      Logger.error('Failed to paste nodes:', error);
    }
  }, [copiedNodes, copiedEdges, client]);

  /**
   * Context menu event handlers
   */
  // Handle right-click on empty pane (add node menu)
  const handlePaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    Logger.debug('🖱️ [NodeGraphEditor] Pane context menu triggered', {
      position: { x: event.clientX, y: event.clientY },
    });
    event.preventDefault();
    event.stopPropagation();
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContextMenuType('add');
    setContextMenuNodeId(null);
    setContextMenuVisible(true);
  }, []);

  // Handle right-click on a node (node actions menu)
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, nodeId: string) => {
      Logger.debug('🖱️ [NodeGraphEditor] handleNodeContextMenu fired!', {
        nodeId,
        position: { x: event.clientX, y: event.clientY },
      });
      event.preventDefault();
      event.stopPropagation();

      // Select the right-clicked node in ReactFlow
      setNodes(nds =>
        nds.map(n => ({
          ...n,
          selected: n.id === nodeId,
        }))
      );

      // Select the node app-wide (Scene Outliner, Node Inspector, etc.)
      const sceneNode = sceneTree.find(item => String(item.handle) === nodeId);
      if (sceneNode && onNodeSelect) {
        onNodeSelect(sceneNode);
        Logger.debug('Node selected app-wide:', sceneNode.name);
      }

      setContextMenuPosition({ x: event.clientX, y: event.clientY });
      setContextMenuType('node');
      setContextMenuNodeId(nodeId);
      setContextMenuVisible(true);
    },
    [sceneTree, onNodeSelect, setNodes]
  );

  const handleSelectNodeType = useCallback(
    async (nodeType: string) => {
      const nodeTypeId = NodeType[nodeType];
      if (nodeTypeId === undefined) {
        Logger.error('Unknown node type:', nodeType);
        return;
      }

      try {
        const createdHandle = await client.createNode(nodeType, nodeTypeId);
        if (createdHandle) {
          Logger.debug('Node created successfully:', createdHandle);
          // Note: createNode() already performs optimized scene tree update
        } else {
          Logger.error('Failed to create node');
        }
      } catch (error) {
        Logger.error('Error creating node:', error);
      }
    },
    [client]
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenuVisible(false);
    setContextMenuNodeId(null);
  }, []);

  /**
   * Edit operation handlers (Copy/Cut/Paste/Delete)
   */
  const handleCut = useCallback(async () => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length === 0) {
      Logger.warn('No nodes selected for cut');
      return;
    }

    // Convert ReactFlow nodes to SceneNodes
    const sceneNodes: SceneNode[] = selectedNodes.map(n => n.data.sceneNode);

    // Use unified EditCommands
    await EditCommands.cutNodes({
      client,
      selectedNodes: sceneNodes,
      onSelectionClear: () => {
        setNodes(nodes.map(n => ({ ...n, selected: false })));
        onNodeSelect?.(null);
      },
      onComplete: () => {
        Logger.debug('Cut operation completed from NodeGraph');
      },
    });
  }, [nodes, client, setNodes, onNodeSelect]);

  const handleCopy = useCallback(async () => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length === 0) {
      Logger.warn('No nodes selected for copy');
      return;
    }

    // Store selected nodes and edges between them for Ctrl+V paste
    const selectedNodeIds = selectedNodes.map(n => n.id);
    const relatedEdges = edges.filter(
      e => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
    );

    setCopiedNodes(selectedNodes);
    setCopiedEdges(relatedEdges);
    Logger.debug(`📋 Copied ${selectedNodes.length} node(s) for keyboard paste`);

    // Convert ReactFlow nodes to SceneNodes for EditCommands (Octane clipboard)
    const sceneNodes: SceneNode[] = selectedNodes.map(n => n.data.sceneNode);

    // Use unified EditCommands
    await EditCommands.copyNodes({
      client,
      selectedNodes: sceneNodes,
    });
  }, [nodes, edges, client]);

  const handlePaste = useCallback(async () => {
    Logger.debug('Paste at position:', contextMenuPosition);

    // Use unified EditCommands
    await EditCommands.pasteNodes({
      client,
      selectedNodes: [], // Not relevant for paste
      onComplete: () => {
        Logger.debug('Paste operation completed from NodeGraph');
      },
    });
  }, [client, contextMenuPosition]);

  const handleDeleteSelected = useCallback(async () => {
    const selectedNodes = nodes.filter(n => n.selected);

    if (selectedNodes.length === 0) {
      Logger.warn('No nodes selected for deletion');
      return;
    }

    // Convert ReactFlow nodes to SceneNodes for EditCommands
    const sceneNodes: SceneNode[] = selectedNodes.map(n => n.data.sceneNode);

    // Use unified EditCommands for consistent delete behavior
    await EditCommands.deleteNodes({
      client,
      selectedNodes: sceneNodes,
      onSelectionClear: () => {
        // Clear selection in ReactFlow
        setNodes(nodes.map(n => ({ ...n, selected: false })));
        // Clear selection in parent (Node Inspector)
        onNodeSelect?.(null);
      },
      onComplete: () => {
        Logger.debug('Delete operation completed from NodeGraph');
      },
    });
  }, [nodes, client, setNodes, onNodeSelect]);

  /**
   * Node manipulation handlers (Collapse/Expand/Group)
   */
  const handleCollapseItems = useCallback(async () => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length === 0) {
      Logger.warn('No nodes selected for collapse');
      return;
    }

    // Convert ReactFlow nodes to SceneNodes
    const sceneNodes: SceneNode[] = selectedNodes.map(n => n.data.sceneNode);

    // Use unified EditCommands (triggers full resync for now)
    await EditCommands.collapseNodes({
      client,
      selectedNodes: sceneNodes,
      onComplete: () => {
        Logger.debug('Collapse operation completed from NodeGraph');
      },
    });
  }, [nodes, client]);

  const handleExpandItems = useCallback(async () => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length === 0) {
      Logger.warn('No nodes selected for expand');
      return;
    }

    // Convert ReactFlow nodes to SceneNodes
    const sceneNodes: SceneNode[] = selectedNodes.map(n => n.data.sceneNode);

    // Use unified EditCommands (triggers full resync for now)
    await EditCommands.expandNodes({
      client,
      selectedNodes: sceneNodes,
      onComplete: () => {
        Logger.debug('Expand operation completed from NodeGraph');
      },
    });
  }, [nodes, client]);

  const handleGroupItems = useCallback(async () => {
    const selectedNodes = nodes.filter(n => n.selected);

    if (selectedNodes.length < 2) {
      Logger.warn('Need at least 2 nodes selected to create a group');
      return;
    }

    // Convert ReactFlow nodes to SceneNodes
    const sceneNodes: SceneNode[] = selectedNodes.map(n => n.data.sceneNode);

    // Use unified EditCommands
    await EditCommands.groupNodes({
      client,
      selectedNodes: sceneNodes,
      onComplete: () => {
        Logger.debug('Group operation completed from NodeGraph');
      },
    });
  }, [nodes, client]);

  /**
   * Context menu action handlers
   */
  const handleShowInOutliner = useCallback(() => {
    Logger.debug('🔍 Show in Outliner - Node ID:', contextMenuNodeId);

    // Find the node and its corresponding scene node
    const reactFlowNode = nodes.find(n => n.id === contextMenuNodeId);
    if (reactFlowNode) {
      // Trigger selection in Scene Outliner
      const sceneNode = sceneTree.find(item => String(item.handle) === reactFlowNode.id);
      if (sceneNode && onNodeSelect) {
        onNodeSelect(sceneNode);
        Logger.debug('Node selected in outliner:', sceneNode.name);
      }
    }
  }, [contextMenuNodeId, nodes, sceneTree, onNodeSelect]);

  const handleShowInLuaBrowser = useCallback(() => {
    Logger.debug('🔍 Show in Lua API browser - Node ID:', contextMenuNodeId);
    // TODO: Implement Lua API browser integration
    // Requires: LUA API documentation viewer/browser component
    // eslint-disable-next-line no-alert
    alert('Lua API browser integration coming soon!');
  }, [contextMenuNodeId]);

  const handleRenderNode = useCallback(() => {
    Logger.debug('🎬 Render Node - Node ID:', contextMenuNodeId);
    // TODO: Implement render target switching
    // Requires: API to set render target to specific node
    // eslint-disable-next-line no-alert
    alert('Render Node feature requires render target switching API\n\nComing soon!');
  }, [contextMenuNodeId]);

  const handleSaveAsMacro = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    Logger.debug('💾 Save as Macro - Selected nodes:', selectedNodes.length);
    // TODO: Implement save to LocalDB
    // Requires: apilocaldb.proto API integration
    // eslint-disable-next-line no-alert
    alert(
      'Save as Macro feature requires LocalDB API integration\n(apilocaldb.proto)\n\nComing soon!'
    );
  }, [nodes]);

  /**
   * Search handler
   */
  const handleSearchSelectNodes = useCallback(
    (nodeIds: string[]) => {
      setNodes(nds =>
        nds.map(node => ({
          ...node,
          selected: nodeIds.includes(node.id),
        }))
      );

      // Also notify parent component if callback provided
      if (nodeIds.length > 0 && onNodeSelect) {
        const selectedNode = nodes.find(n => n.id === nodeIds[0]);
        if (selectedNode) {
          const data = selectedNode.data as OctaneNodeData;
          onNodeSelect(data.sceneNode);
        }
      }
    },
    [setNodes, nodes, onNodeSelect]
  );

  /**
   * Keyboard shortcut handlers
   * Per Octane SE manual:
   * - "Pressing CTRL+F brings up the Search Dialog"
   * - "copy and paste operations...by simple keyboard shortcuts Ctrl+C for copy and Ctrl+V for paste"
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input field
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const modifier = event.ctrlKey || event.metaKey;

      // Ctrl+F: Search dialog
      if (modifier && event.key === 'f') {
        event.preventDefault();
        setSearchDialogVisible(true);
      }

      // Ctrl+C: Copy selected nodes
      if (modifier && event.key === 'c') {
        event.preventDefault();
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length === 0) return;

        // Store selected nodes and edges between them
        const selectedNodeIds = selectedNodes.map(n => n.id);
        const relatedEdges = edges.filter(
          e => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
        );

        setCopiedNodes(selectedNodes);
        setCopiedEdges(relatedEdges);
        Logger.debug(`📋 Copied ${selectedNodes.length} node(s)`);
      }

      // Ctrl+V: Paste nodes
      if (modifier && event.key === 'v') {
        event.preventDefault();
        if (copiedNodes.length === 0) return;

        handlePasteNodes();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [nodes, edges, copiedNodes, copiedEdges, handlePasteNodes]);

  /**
   * Register edit action handlers with global EditActionsContext
   * This allows MenuBar Edit menu to trigger NodeGraph actions
   */
  useEffect(() => {
    const handleFind = () => {
      setSearchDialogVisible(true);
    };

    editActions.registerHandlers({
      cut: handleCut,
      copy: handleCopy,
      paste: handlePaste,
      delete: handleDeleteSelected,
      group: handleGroupItems,
      find: handleFind,
    });

    return () => {
      editActions.unregisterHandlers();
    };
  }, [editActions, handleCut, handleCopy, handlePaste, handleDeleteSelected, handleGroupItems]);

  return {
    // Context menu handlers
    handlePaneContextMenu,
    handleNodeContextMenu,
    handleSelectNodeType,
    handleCloseContextMenu,

    // Edit operation handlers
    handleCopy,
    handlePaste,
    handleCut,
    handleDeleteSelected,

    // Node manipulation handlers
    handleCollapseItems,
    handleExpandItems,
    handleGroupItems,

    // Context menu action handlers
    handleShowInOutliner,
    handleShowInLuaBrowser,
    handleRenderNode,
    handleSaveAsMacro,

    // Search handler
    handleSearchSelectNodes,

    // State
    contextMenuVisible,
    contextMenuPosition,
    contextMenuType,
    contextMenuNodeId,
    searchDialogVisible,
    setSearchDialogVisible,
  };
}
