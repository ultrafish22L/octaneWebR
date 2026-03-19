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

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Node } from '@xyflow/react';
import { SceneNode } from '../../../services/OctaneClient';
import type { OctaneClient } from '../../../services/OctaneClient';
import { OctaneNodeData } from '../OctaneNode';
import { NodeType, FILE_NODE_TYPES, AttributeId, AttrType } from '../../../constants/OctaneTypes';
import { EditCommands } from '../../../commands/EditCommands';
import { Logger } from '../../../utils/Logger';
import { useStatusActions } from '../../../contexts/StatusMessageContext';
import type { EditActionsContextType } from '../../../contexts/EditActionsContext';
import { useFileBrowser } from '../../../hooks/useFileBrowser';
import type { FileBrowserDialogProps } from '../../../components/dialogs/FileBrowserDialog';

interface UseNodeOperationsParams {
  client: OctaneClient;
  nodes: Node<OctaneNodeData>[];
  setNodes: React.Dispatch<React.SetStateAction<Node<OctaneNodeData>[]>>;
  sceneTree: SceneNode[];
  containerRef: React.RefObject<HTMLDivElement | null>;

  onNodeSelect?: (node: SceneNode | null) => void;
  editActions: EditActionsContextType;
}

export interface NodeOperationsHandlers {
  // Context menu handlers

  handlePaneContextMenu: (event: React.MouseEvent | MouseEvent) => void;

  handleNodeContextMenu: (event: React.MouseEvent, nodeId: string) => void;

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
  handleDuplicate: () => Promise<void>;
  handleUngroup: () => Promise<void>;

  // Context menu action handlers
  handleShowInOutliner: () => void;
  handleShowInLuaBrowser: () => void;
  handleRenderNode: () => void;
  handleSaveAsMacro: () => void;

  // Search handler

  handleSearchSelectNodes: (nodeIds: string[]) => void;

  // State
  contextMenuVisible: boolean;
  contextMenuPosition: { x: number; y: number };
  contextMenuType: 'node' | 'add';
  contextMenuNodeId: string | null;
  searchDialogVisible: boolean;

  setSearchDialogVisible: (visible: boolean) => void;

  // File browser dialog props (for file-based node creation)
  fileBrowserDialogProps: FileBrowserDialogProps | null;
}

export function useNodeOperations({
  client,
  nodes,
  setNodes,
  sceneTree,
  containerRef,
  onNodeSelect,
  editActions,
}: UseNodeOperationsParams): NodeOperationsHandlers {
  const { setTemporaryStatus } = useStatusActions();

  // Stable refs for values that change frequently but shouldn't cause handler churn
  const sceneTreeRef = useRef(sceneTree);
  useEffect(() => {
    sceneTreeRef.current = sceneTree;
  }, [sceneTree]);
  const onNodeSelectRef = useRef(onNodeSelect);
  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  // Context menu state
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuType, setContextMenuType] = useState<'node' | 'add'>('add');
  const [contextMenuNodeId, setContextMenuNodeId] = useState<string | null>(null);

  // Search dialog state
  const [searchDialogVisible, setSearchDialogVisible] = useState(false);

  // File browser for file-based node creation (dialog-before-create pattern)
  // Stores the pending node type while the file browser is open
  const pendingFileNodeRef = useRef<{ nodeType: string; nodeTypeId: number } | null>(null);

  const fileBrowser = useFileBrowser(async (path: string | null) => {
    const pending = pendingFileNodeRef.current;
    pendingFileNodeRef.current = null;

    if (!path || !pending) {
      Logger.debug('File node creation cancelled');
      return;
    }

    try {
      // Create the node first
      const createdHandle = await client.createNode(pending.nodeType, pending.nodeTypeId);
      if (!createdHandle) {
        Logger.error('Failed to create file node');
        setTemporaryStatus('Failed to create node', 3000);
        return;
      }

      // Then set the file path on the created node
      await client.callApi('ApiItem', 'setValueByAttrID', createdHandle, {
        attribute_id: AttributeId.A_FILENAME,
        expected_type: AttrType.AT_STRING,
        string_value: path,
        evaluate: true,
      });

      // Force Octane to re-evaluate the node and actually import the file.
      // The evaluate flag in setValueByAttrID alone isn't sufficient for file imports.
      await client.callApi('ApiItem', 'evaluate', createdHandle);

      Logger.debug('File node created and file loaded:', pending.nodeType, path);
    } catch (error) {
      Logger.error('Error creating file node:', error);
      setTemporaryStatus('Error creating file node', 3000);
    }
  });

  /**
   * Context menu event handlers
   */
  // Handle right-click on empty pane (add node menu)
  const handlePaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    Logger.debug('[NodeGraphEditor] Pane context menu triggered', {
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
      Logger.debug('[NodeGraphEditor] handleNodeContextMenu fired!', {
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
      const sceneNode = sceneTreeRef.current.find(item => String(item.handle) === nodeId);
      if (sceneNode && onNodeSelectRef.current) {
        onNodeSelectRef.current(sceneNode);
        Logger.debug('Node selected app-wide:', sceneNode.name);
      }

      setContextMenuPosition({ x: event.clientX, y: event.clientY });
      setContextMenuType('node');
      setContextMenuNodeId(nodeId);
      setContextMenuVisible(true);
    },
    [setNodes]
  );

  const handleSelectNodeType = useCallback(
    async (nodeType: string) => {
      const nodeTypeId = NodeType[nodeType];
      if (nodeTypeId === undefined) {
        Logger.error('Unknown node type:', nodeType);
        setTemporaryStatus('Unknown node type', 3000);
        return;
      }

      // File-based nodes: open file browser BEFORE creating the node.
      // If user cancels, no node is created.
      const fileNodeConfig = FILE_NODE_TYPES[nodeType];
      if (fileNodeConfig) {
        pendingFileNodeRef.current = { nodeType, nodeTypeId };
        fileBrowser.browse({
          mode: 'open',
          title: `Select file for ${nodeType.replace('NT_', '').replace(/_/g, ' ')}`,
          filePatterns: fileNodeConfig.extensions,
        });
        return; // Node creation happens in the fileBrowser onResult callback
      }

      // Non-file nodes: create immediately (existing flow)
      try {
        const createdHandle = await client.createNode(nodeType, nodeTypeId);
        if (createdHandle) {
          Logger.debug('Node created successfully:', createdHandle);
          // Note: createNode() already performs optimized scene tree update
        } else {
          Logger.error('Failed to create node');
          setTemporaryStatus('Failed to create node', 3000);
        }
      } catch (error) {
        Logger.error('Error creating node:', error);
        setTemporaryStatus('Error creating node', 3000);
      }
    },
    [client, setTemporaryStatus, fileBrowser]
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
        setNodes(nds => nds.map(n => (n.selected ? { ...n, selected: false } : n)));
        onNodeSelectRef.current?.(null);
      },
      onComplete: () => {
        Logger.debug('Cut operation completed from NodeGraph');
      },
      onError: msg => setTemporaryStatus(msg, 3000),
    });
  }, [nodes, client, setNodes, setTemporaryStatus]);

  const handleCopy = useCallback(async () => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length === 0) {
      Logger.warn('No nodes selected for copy');
      return;
    }

    const sceneNodes: SceneNode[] = selectedNodes.map(n => n.data.sceneNode);
    await EditCommands.copyNodes({
      client,
      selectedNodes: sceneNodes,
      onError: msg => setTemporaryStatus(msg, 3000),
    });
  }, [nodes, client, setTemporaryStatus]);

  const handlePaste = useCallback(async () => {
    // Use unified EditCommands
    await EditCommands.pasteNodes({
      client,
      selectedNodes: [], // Not relevant for paste
      onComplete: () => {
        Logger.debug('Paste operation completed from NodeGraph');
      },
      onError: msg => setTemporaryStatus(msg, 3000),
    });
  }, [client, setTemporaryStatus]);

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
        // Clear selection in ReactFlow (use functional updater to avoid stale closure)
        setNodes(nds => nds.map(n => (n.selected ? { ...n, selected: false } : n)));
        // Clear selection in parent (Node Inspector)
        onNodeSelectRef.current?.(null);
      },
      onComplete: () => {
        Logger.debug('Delete operation completed from NodeGraph');
      },
      onError: msg => setTemporaryStatus(msg, 3000),
    });
  }, [nodes, client, setNodes, setTemporaryStatus]);

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
      onError: msg => setTemporaryStatus(msg, 3000),
    });
  }, [nodes, client, setTemporaryStatus]);

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
      onError: msg => setTemporaryStatus(msg, 3000),
    });
  }, [nodes, client, setTemporaryStatus]);

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
      onError: msg => setTemporaryStatus(msg, 3000),
    });
  }, [nodes, client, setTemporaryStatus]);

  const handleDuplicate = useCallback(async () => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length === 0) {
      Logger.warn('No nodes selected for duplicate');
      return;
    }

    const sceneNodes: SceneNode[] = selectedNodes.map(n => n.data.sceneNode);
    await EditCommands.duplicateNodes({
      client,
      selectedNodes: sceneNodes,
      onComplete: () => {
        Logger.debug('Duplicate operation completed from NodeGraph');
      },
      onError: msg => setTemporaryStatus(msg, 3000),
    });
  }, [nodes, client, setTemporaryStatus]);

  const handleUngroup = useCallback(async () => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length === 0) {
      Logger.warn('No nodes selected for ungroup');
      return;
    }

    const sceneNodes: SceneNode[] = selectedNodes.map(n => n.data.sceneNode);
    await EditCommands.ungroupNodes({
      client,
      selectedNodes: sceneNodes,
      onComplete: () => {
        Logger.debug('Ungroup operation completed from NodeGraph');
      },
      onError: msg => setTemporaryStatus(msg, 3000),
    });
  }, [nodes, client, setTemporaryStatus]);

  /**
   * Context menu action handlers
   */
  const handleShowInOutliner = useCallback(() => {
    Logger.debug('Show in Outliner - Node ID:', contextMenuNodeId);

    // Find the node and its corresponding scene node
    const reactFlowNode = nodes.find(n => n.id === contextMenuNodeId);
    if (reactFlowNode) {
      // Trigger selection in Scene Outliner
      const sceneNode = sceneTreeRef.current.find(item => String(item.handle) === reactFlowNode.id);
      if (sceneNode && onNodeSelectRef.current) {
        onNodeSelectRef.current(sceneNode);
        Logger.debug('Node selected in outliner:', sceneNode.name);
      }
    }
  }, [contextMenuNodeId, nodes]);

  const handleShowInLuaBrowser = useCallback(() => {
    Logger.warn('Lua API browser not yet implemented');
    setTemporaryStatus('Lua API browser not yet implemented', 3000);
  }, [setTemporaryStatus]);

  const handleRenderNode = useCallback(() => {
    Logger.warn('Render Node not yet implemented');
    setTemporaryStatus('Render Node not yet implemented', 3000);
  }, [setTemporaryStatus]);

  const handleSaveAsMacro = useCallback(() => {
    Logger.warn('Save as Macro not yet implemented');
    setTemporaryStatus('Save as Macro not yet implemented', 3000);
  }, [setTemporaryStatus]);

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
      if (nodeIds.length > 0 && onNodeSelectRef.current) {
        const selectedNode = nodes.find(n => n.id === nodeIds[0]);
        if (selectedNode?.data) {
          const data = selectedNode.data as OctaneNodeData;
          if (data.sceneNode) onNodeSelectRef.current(data.sceneNode);
        }
      }
    },
    [setNodes, nodes]
  );

  /**
   * Keyboard shortcut handlers for NodeGraph
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when focus is inside the Node Graph
      if (!containerRef.current?.contains(event.target as HTMLElement)) {
        return;
      }

      // Ignore if typing in input field
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && event.key === 'f') {
        event.preventDefault();
        setSearchDialogVisible(true);
      } else if (modifier && event.key === 'c') {
        event.preventDefault();
        handleCopy();
      } else if (modifier && event.key === 'x') {
        event.preventDefault();
        handleCut();
      } else if (modifier && event.key === 'v') {
        event.preventDefault();
        handlePaste();
      } else if (modifier && event.key === 'd') {
        event.preventDefault();
        handleDuplicate();
      } else if (modifier && event.shiftKey && (event.key === 'g' || event.key === 'G')) {
        event.preventDefault();
        handleUngroup();
      } else if (modifier && event.key === 'g') {
        event.preventDefault();
        handleGroupItems();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        handleDeleteSelected();
      } else if (event.key === 'Escape') {
        setNodes(nds => nds.map(n => (n.selected ? { ...n, selected: false } : n)));
        onNodeSelectRef.current?.(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    containerRef,
    handleCopy,
    handleCut,
    handlePaste,
    handleDuplicate,
    handleUngroup,
    handleGroupItems,
    handleDeleteSelected,
    setNodes,
  ]);

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
      ungroup: handleUngroup,
      find: handleFind,
    });

    return () => {
      editActions.unregisterHandlers();
    };
  }, [
    editActions,
    handleCut,
    handleCopy,
    handlePaste,
    handleDeleteSelected,
    handleGroupItems,
    handleUngroup,
  ]);

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
    handleDuplicate,
    handleUngroup,

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

    // File browser dialog props (for file-based node creation)
    fileBrowserDialogProps: fileBrowser.dialogProps,
  };
}
