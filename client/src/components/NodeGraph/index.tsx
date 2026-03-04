/**
 * NodeGraph Component - ReactFlow Implementation
 * Main component file for the node graph editor
 *
 * Replaces 956-line custom SVG implementation with ReactFlow
 * Maintains all functionality from octaneWeb's NodeGraphEditor.js
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  NodeChange,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  NodeTypes,
  ReactFlowProvider,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { SceneNode, NodeAddedEvent, NodeDeletedEvent } from '../../services/OctaneClient';
import { useOctane } from '../../hooks/useOctane';
import { useEditActions } from '../../contexts/EditActionsContext';
import { OctaneNode, OctaneNodeData } from './OctaneNode';
import { formatColorValue } from '../../utils/ColorUtils';
import { NodeTypeContextMenu } from './NodeTypeContextMenu';
import { NodeContextMenu } from './NodeContextMenu';
import { SearchDialog } from './SearchDialog';
import { EditCommands } from '../../commands/EditCommands';
import { Logger } from '../../utils/Logger';
import { getPinColor } from '../../utils/PinColorUtils';
import { computeDAGLayout } from '../../utils/NodeLayoutUtils';
import { useConnectionOperations } from './hooks/useConnectionOperations';
import { useNodeOperations } from './hooks/useNodeOperations';

interface NodeGraphEditorProps {
  sceneTree: SceneNode[];
  selectedNode?: SceneNode | null;

  onNodeSelect?: (node: SceneNode | null) => void;
  gridVisible: boolean;

  setGridVisible: (visible: boolean) => void;
  snapToGrid: boolean;

  setSnapToGrid: (snap: boolean) => void;

  onRecenterViewReady?: (callback: () => void) => void; // Pass fitView callback to parent
  /** Called once on mount with the auto-layout function (layout + fitView + persist positions). */
  onAutoLayoutReady?: (callback: () => void) => void;
}

// Layout constants
const NODE_SPACING_X = 250;
const NODE_CENTER_Y = 300;
const FIT_VIEW_DURATION = 300;

// Define custom node types
const nodeTypes = {
  octane: OctaneNode,
} as const satisfies NodeTypes;

/**
 * Inner component with ReactFlow context access.
 * Needs ReactFlowProvider (from the outer NodeGraphEditor wrapper) to use useReactFlow().
 */
const NodeGraphEditorInner = React.memo(function NodeGraphEditorInner({
  sceneTree,
  selectedNode,
  onNodeSelect,
  gridVisible,

  setGridVisible: _setGridVisible,
  snapToGrid,

  setSnapToGrid: _setSnapToGrid,
  onRecenterViewReady,
  onAutoLayoutReady,
}: NodeGraphEditorProps) {
  const { client, connected } = useOctane();
  const { fitView } = useReactFlow();
  const editActions = useEditActions();

  // Track whether initial fitView has been called (should only happen once after initial scene sync)
  const hasInitialFitView = useRef(false);
  const hasProvidedCallback = useRef(false);
  const hasProvidedLayoutCallback = useRef(false);
  // Track whether progressive loading is in progress (skip sceneTree effect)
  const progressiveLoadingRef = useRef(false);
  // Ref to always have latest sceneTree for event handlers (avoids stale closure)
  const sceneTreeRef = useRef(sceneTree);
  useEffect(() => {
    sceneTreeRef.current = sceneTree;
  }, [sceneTree]);

  // Provide fitView callback to parent on mount (only once)
  useEffect(() => {
    if (onRecenterViewReady && !hasProvidedCallback.current) {
      hasProvidedCallback.current = true;
      onRecenterViewReady(() => {
        fitView({ padding: 0.2, duration: FIT_VIEW_DURATION });
      });
    }
  }, [fitView, onRecenterViewReady]);

  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node<OctaneNodeData>>([]);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>([]);

  // Refs so the auto-layout callback (passed once on mount) always sees fresh values
  const nodesRef = useRef<Node<OctaneNodeData>[]>([]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  const edgesRef = useRef<Edge[]>([]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);
  const clientRef = useRef(client);
  useEffect(() => {
    clientRef.current = client;
  }, [client]);
  const connectedRef = useRef(connected);
  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

  // Provide auto-layout callback to parent on mount (only once).
  // Uses refs internally so the closure never goes stale.
  useEffect(() => {
    if (onAutoLayoutReady && !hasProvidedLayoutCallback.current) {
      hasProvidedLayoutCallback.current = true;
      onAutoLayoutReady(() => {
        const currentNodes = nodesRef.current;
        const currentEdges = edgesRef.current;
        if (currentNodes.length === 0) return;

        const layoutInput = currentNodes.map(n => ({
          id: n.id,
          inputCount: (n.data as OctaneNodeData).inputs?.length ?? 0,
        }));
        const positions = computeDAGLayout(layoutInput, currentEdges);

        setNodes(prev =>
          prev.map(n => ({
            ...n,
            position: positions.get(n.id) ?? n.position,
          }))
        );

        // Fit view after React has rendered the new positions
        setTimeout(() => fitView({ padding: 0.2, duration: FIT_VIEW_DURATION }), 50);

        // Persist positions to Octane so they survive a scene reload
        const cl = clientRef.current;
        const conn = connectedRef.current;
        if (cl && conn) {
          for (const [nodeId, pos] of positions) {
            const handle = Number(nodeId);
            if (handle) {
              cl.setNodePosition(handle, pos.x, pos.y).catch(err => {
                Logger.error('Failed to save layout position:', err);
              });
            }
          }
        }
      });
    }
  }, [onAutoLayoutReady, setNodes, fitView]);

  // Custom onNodesChange handler that saves position changes to Octane
  const onNodesChange = useCallback(
    (changes: NodeChange<Node<OctaneNodeData>>[]) => {
      // First apply changes to the local state
      onNodesChangeBase(changes);

      // Then save position changes to Octane
      changes.forEach(change => {
        if (change.type === 'position' && change.position && !change.dragging) {
          // Only save when drag is complete (dragging=false)
          const nodeId = change.id;
          const nodeHandle = Number(nodeId);
          const { x, y } = change.position;

          if (client && connected && nodeHandle) {
            Logger.debug(`Saving node position: handle=${nodeHandle}, x=${x}, y=${y}`);
            client.setNodePosition(nodeHandle, x, y).catch(error => {
              Logger.error('Failed to save node position:', error);
            });
          }
        }
      });
    },
    [onNodesChangeBase, client, connected]
  );

  // Container ref for scoping keyboard shortcuts
  const containerRef = useRef<HTMLDivElement>(null);

  // Multi-connect state (Ctrl+connect to connect multiple selected nodes)
  const isMultiConnectingRef = useRef(false);
  const multiConnectSourcesRef = useRef<string[]>([]); // Selected node IDs to connect

  // Track connection line color during drag (matches source pin color)
  const [connectionLineColor, setConnectionLineColor] = useState('#ffc107');
  const connectingEdgeRef = useRef<Edge | null>(null); // Track if creating new connection vs reconnecting

  /**
   * Node operations hook - handles copy/paste, context menus, search, keyboard shortcuts
   */
  const {
    handlePaneContextMenu,
    handleNodeContextMenu,
    handleSelectNodeType,
    handleCloseContextMenu,
    handleCopy,
    handlePaste,
    handleCut,
    handleDeleteSelected,
    handleCollapseItems,
    handleExpandItems,
    handleGroupItems,
    handleShowInOutliner,
    handleShowInLuaBrowser,
    handleRenderNode,
    handleSaveAsMacro,
    handleSearchSelectNodes,
    contextMenuVisible,
    contextMenuPosition,
    contextMenuType,
    searchDialogVisible,
    setSearchDialogVisible,
  } = useNodeOperations({
    client,
    nodes,
    setNodes,
    sceneTree,
    containerRef,
    onNodeSelect,
    editActions,
  });

  /**
   * Convert scene tree to ReactFlow nodes and edges
   * Following octaneWeb's NodeGraphEditor.js pattern:
   * - Only show TOP-LEVEL nodes from scene.tree (no recursive children)
   * - Only show direct connections between top-level nodes
   * - Use bezier curves for connection splines
   */
  const convertSceneToGraph = useCallback(
    (tree: SceneNode[]) => {
      const graphNodes: Node<OctaneNodeData>[] = [];
      const graphEdges: Edge[] = [];

      // Build handle→node map first (O(n)) so pin lookups are O(1) instead of O(n)
      const nodeMap = new Map<string, SceneNode>();
      for (const item of tree) {
        if (item.handle || item.pinInfo) {
          nodeMap.set(String(item.handle || 0), item);
        }
      }

      // Only process TOP-LEVEL nodes (matching octaneWeb behavior)
      const nodeSpacing = NODE_SPACING_X;
      const yCenter = NODE_CENTER_Y;

      tree.forEach((item, index) => {
        if (!item.handle && !item.pinInfo) {
          return;
        }

        const handleStr = String(item.handle || 0);

        // Extract input pins from item.children
        const inputs = item.children || [];

        const inputHandles = inputs.map((input: SceneNode, inputIndex: number) => {
          // O(1) lookup instead of O(n) tree.some()/tree.find()
          const connectedNode = input.handle ? nodeMap.get(String(input.handle)) || null : null;

          return {
            id: `input-${inputIndex}`,
            label: input.staticLabel || input.name,
            pinInfo: input.pinInfo,
            handle: input.handle,
            isAtTopLevel: !!connectedNode,
            connectedNodeName: connectedNode ? connectedNode.name || connectedNode.type : null,
          };
        });

        // Create output handle
        const output = {
          id: 'output-0',
          label: item.name,
          pinInfo: item.pinInfo,
        };

        // Use position from Octane if available, otherwise calculate default position
        const nodePosition = item.position
          ? { x: item.position.x, y: item.position.y }
          : { x: 100 + index * nodeSpacing, y: yCenter + index * 20 };

        const node: Node<OctaneNodeData> = {
          id: handleStr,
          type: 'octane',
          position: nodePosition,
          data: {
            sceneNode: item,
            inputs: inputHandles,
            output,
            onContextMenu: handleNodeContextMenu,
          },
        };

        graphNodes.push(node);
      });

      // Create connections between TOP-LEVEL nodes only
      tree.forEach(node => {
        // Skip if node has no handle/pinInfo or no children
        if ((!node.handle && !node.pinInfo) || !node.children || node.children.length === 0) {
          return;
        }

        const targetHandle = String(node.handle || 0);

        // Check each child (input pin) for connections
        node.children.forEach((childNode: SceneNode, inputIndex: number) => {
          // Include connections even if handle=0, as long as pinInfo exists (empty pins with data)
          if (childNode.handle !== undefined || childNode.pinInfo) {
            const sourceHandle = String(childNode.handle || 0);

            // Only create edge if BOTH nodes are in our top-level nodeMap
            if (nodeMap.has(sourceHandle) && nodeMap.has(targetHandle)) {
              // Get edge color with proper fallback (Octane → local mapping → default)
              const edgeColor = getPinColor(childNode.pinInfo);

              const edge: Edge = {
                id: `e${sourceHandle}-${targetHandle}-${inputIndex}`,
                source: sourceHandle,
                target: targetHandle,
                sourceHandle: 'output-0',
                targetHandle: `input-${inputIndex}`,
                animated: false,
                selectable: true,
                focusable: true,
                interactionWidth: 20, // ReactFlow v12: wider click area for easier selection
                style: {
                  stroke: edgeColor,
                  strokeWidth: 3,
                },
                data: {
                  source: sourceHandle,
                  target: targetHandle,
                  sourceHandle: 'output-0',
                  targetHandle: `input-${inputIndex}`,
                },
              };

              graphEdges.push(edge);
              Logger.debug(`Edge created: ${sourceHandle} → ${targetHandle} (color: ${edgeColor})`);
            }
          }
        });
      });

      Logger.debug(`Node Graph: ${graphNodes.length} nodes, ${graphEdges.length} edges`);

      return { nodes: graphNodes, edges: graphEdges };
    },
    [handleNodeContextMenu]
  ); // Add handleNodeContextMenu dependency

  /**
   * Load scene graph when sceneTree changes.
   *
   * During progressive loading, skip length-based incremental checks — the tree
   * grows via mutations and shallow copies, not via nodeAdded/nodeDeleted events.
   * Instead, event-driven rebuilds happen on scene:structureComplete and scene:complete.
   *
   * For traditional/post-load operations, use length-based skip to avoid full rebuilds
   * when nodeAdded/nodeDeleted event handlers are managing incremental updates.
   */
  useEffect(() => {
    Logger.debug('NodeGraphEditor: sceneTree changed, length =', sceneTree?.length || 0);

    if (!sceneTree || sceneTree.length === 0) {
      Logger.debug('NodeGraphEditor: Empty scene tree, clearing graph');
      setNodes([]);
      setEdges([]);
      return;
    }

    // Always rebuild the full graph when sceneTree changes.
    // This is the single source of truth for nodes and edges.
    const { nodes: graphNodes, edges: graphEdges } = convertSceneToGraph(sceneTree);
    Logger.debug(
      `NodeGraphEditor: rebuild → ${graphNodes.length} nodes, ${graphEdges.length} edges`
    );

    setNodes(graphNodes);
    setEdges(graphEdges);
  }, [sceneTree, convertSceneToGraph, setEdges, setNodes]);

  /**
   * Handle incremental node additions (no full graph rebuild)
   */
  useEffect(() => {
    if (!connected || !client) return;

    const handleNodeAdded = (event: NodeAddedEvent) => {
      Logger.debug('NodeGraphEditor: Adding node incrementally:', event.node.name);

      // Convert just the new node to a ReactFlow node
      const nodeIndex = sceneTreeRef.current.length - 1; // New node position
      const nodeSpacing = NODE_SPACING_X;
      const yCenter = NODE_CENTER_Y;
      const handleStr = String(event.node.handle || 0);

      // Extract input pins from item.children
      const inputs = event.node.children || [];

      const inputHandles = inputs.map((input: SceneNode, inputIndex: number) => {
        // O(1) lookup via scene.map instead of O(n) tree scan
        const connectedNode = input.handle ? client.lookupItem(input.handle) : null;

        return {
          id: `input-${inputIndex}`,
          label: input.staticLabel || input.name,
          pinInfo: input.pinInfo,
          handle: input.handle,
          isAtTopLevel: !!connectedNode,
          connectedNodeName: connectedNode ? connectedNode.name || connectedNode.type : null,
        };
      });

      const newReactFlowNode: Node<OctaneNodeData> = {
        id: handleStr,
        type: 'octane',
        position: event.node.position
          ? { x: event.node.position.x, y: event.node.position.y }
          : { x: nodeIndex * nodeSpacing, y: yCenter },
        data: {
          sceneNode: event.node,
          inputs: inputHandles,
          output: { id: 'output-0', label: event.node.name, pinInfo: event.node.pinInfo },
          onContextMenu: handleNodeContextMenu,
        },
        selected: false,
      };

      // Add node to graph without rebuilding everything
      setNodes(nds => [...nds, newReactFlowNode]);

      Logger.debug('NodeGraphEditor: Node added to canvas');
    };

    client.on('nodeAdded', handleNodeAdded);

    return () => {
      client.off('nodeAdded', handleNodeAdded);
    };
  }, [client, connected, setNodes, handleNodeContextMenu]);

  /**
   * Handle incremental node deletions (no full graph rebuild)
   */
  useEffect(() => {
    if (!connected || !client) return;

    const handleNodeDeleted = (event: NodeDeletedEvent) => {
      Logger.debug('NodeGraphEditor: Deleting node incrementally, handle:', event.handle);

      const handleStr = String(event.handle);

      // Remove node from graph without rebuilding everything
      setNodes(nds => {
        const filtered = nds.filter(node => node.id !== handleStr);
        Logger.debug(
          `NodeGraphEditor: Removed node ${handleStr}, ${nds.length} → ${filtered.length} nodes`
        );
        return filtered;
      });

      // Remove connected edges
      setEdges(eds => {
        const filtered = eds.filter(edge => edge.source !== handleStr && edge.target !== handleStr);
        Logger.debug(`NodeGraphEditor: Removed edges for node ${handleStr}`);
        return filtered;
      });

      Logger.debug('NodeGraphEditor: Node removed from canvas');
    };

    client.on('nodeDeleted', handleNodeDeleted);

    return () => {
      client.off('nodeDeleted', handleNodeDeleted);
    };
  }, [client, connected, setNodes, setEdges]);

  /**
   * Progressive loading: Listen for build lifecycle events.
   *
   * Level-0 nodes appear in the graph immediately as they arrive (no edges yet).
   * At structureComplete, do a full rebuild with edges.
   * At complete, do a final rebuild to pick up any remaining changes.
   *
   * Uses sceneTreeRef (not sceneTree) so event handlers always read the latest
   * tree without re-registering on every sceneTree change.
   */
  useEffect(() => {
    if (!client) return;

    const handleBuildStart = () => {
      progressiveLoadingRef.current = true;
      hasInitialFitView.current = false;
      // Clear previous graph
      setNodes([]);
      setEdges([]);
    };

    /**
     * Level-0 node added during progressive load.
     * Add it to the graph immediately (no edges yet — those come at structureComplete).
     */
    const handleProgressiveNodeAdded = ({ node }: { node: SceneNode; level: number }) => {
      const handleStr = String(node.handle || 0);
      const inputs = node.children || [];

      const inputHandles = inputs.map((input: SceneNode, inputIndex: number) => ({
        id: `input-${inputIndex}`,
        label: input.staticLabel || input.name,
        pinInfo: input.pinInfo,
        handle: input.handle,
        isAtTopLevel: false,
        connectedNodeName: null,
      }));

      const newReactFlowNode: Node<OctaneNodeData> = {
        id: handleStr,
        type: 'octane',
        position: node.position ? { x: node.position.x, y: node.position.y } : { x: 100, y: 300 },
        data: {
          sceneNode: node,
          inputs: inputHandles,
          output: { id: 'output-0', label: node.name, pinInfo: node.pinInfo },
          onContextMenu: handleNodeContextMenu,
        },
        selected: false,
      };

      setNodes(nds => {
        // Avoid duplicates
        if (nds.some(n => n.id === handleStr)) return nds;
        return [...nds, newReactFlowNode];
      });
    };

    /**
     * Structure complete — full rebuild with edges.
     * By now all level-0 nodes and their immediate children/pins are loaded.
     */
    const handleStructureComplete = () => {
      Logger.debug('NodeGraphEditor: structureComplete — rebuilding graph with edges');
      const { nodes: graphNodes, edges: graphEdges } = convertSceneToGraph(sceneTreeRef.current);
      // Preserve selection across rebuild
      setNodes(prev => {
        const selectedId = prev.find(n => n.selected)?.id;
        if (selectedId) {
          const target = graphNodes.find(n => n.id === selectedId);
          if (target) target.selected = true;
        }
        return graphNodes;
      });
      setEdges(graphEdges);
    };

    /**
     * Scene complete — final rebuild to pick up any remaining changes.
     */
    const handleComplete = () => {
      Logger.debug('NodeGraphEditor: complete — final graph rebuild');
      progressiveLoadingRef.current = false;
      const { nodes: graphNodes, edges: graphEdges } = convertSceneToGraph(sceneTreeRef.current);
      // Preserve selection across rebuild
      setNodes(prev => {
        const selectedId = prev.find(n => n.selected)?.id;
        if (selectedId) {
          const target = graphNodes.find(n => n.id === selectedId);
          if (target) target.selected = true;
        }
        return graphNodes;
      });
      setEdges(graphEdges);
    };

    client.on('scene:buildStart', handleBuildStart);
    client.on('scene:nodeAdded', handleProgressiveNodeAdded);
    client.on('scene:structureComplete', handleStructureComplete);
    client.on('scene:complete', handleComplete);

    return () => {
      client.off('scene:buildStart', handleBuildStart);
      client.off('scene:nodeAdded', handleProgressiveNodeAdded);
      client.off('scene:structureComplete', handleStructureComplete);
      client.off('scene:complete', handleComplete);
    };
  }, [client, convertSceneToGraph, setNodes, setEdges, handleNodeContextMenu]);

  /**
   * Synchronize node selection when selectedNode changes externally (e.g., from SceneOutliner)
   */
  useEffect(() => {
    const selectedHandle = selectedNode ? String(selectedNode.handle) : null;

    setNodes(nds =>
      nds.map(node => {
        const shouldBeSelected = node.id === selectedHandle;
        if (node.selected === shouldBeSelected) return node; // preserve reference
        return { ...node, selected: shouldBeSelected };
      })
    );
  }, [selectedNode, setNodes]);

  /**
   * Fit view ONCE when initial scene is loaded
   * After that, preserve user's zoom/pan position
   * (Don't auto-fit when user creates new nodes - that's annoying!)
   */
  useEffect(() => {
    if (nodes.length > 0 && !hasInitialFitView.current) {
      // Use setTimeout to ensure ReactFlow has finished rendering
      const timer = setTimeout(() => {
        fitView({
          padding: 0.2, // 20% padding around nodes
          includeHiddenNodes: false,
          minZoom: 0.5, // Don't zoom out too far
          maxZoom: 1.0, // Don't zoom in too much
          duration: FIT_VIEW_DURATION, // Smooth animation (300ms)
        });
        hasInitialFitView.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes, fitView]);

  /**
   * Connection operations hook - handles all connection-related operations
   * Extracted for better code organization (Phase 2/3 refactoring)
   */
  const {
    onConnectStart,
    onConnectEnd,
    onReconnect,
    onReconnectEnd,
    onConnect,
    isValidConnection,
    onEdgesChange,
    onEdgesDelete,
  } = useConnectionOperations({
    client,
    nodes,
    edges,
    setNodes,
    setEdges,
    onEdgesChangeBase,
    connectingEdgeRef,
    isMultiConnectingRef,
    multiConnectSourcesRef,
    connectionLineColor,
    setConnectionLineColor,
  });

  /**
   * Handle node deletion with optimized cascade
   * Called by ReactFlow when nodes are deleted (e.g., via Delete key)
   */
  const onNodesDelete = useCallback(
    async (deletedNodes: Node[]) => {
      try {
        // Convert ReactFlow nodes to SceneNodes
        const sceneNodes: SceneNode[] = (deletedNodes as Node<OctaneNodeData>[]).map(
          n => n.data.sceneNode
        );

        // Use unified EditCommands for consistent delete behavior
        await EditCommands.deleteNodes({
          client,
          selectedNodes: sceneNodes,
          onSelectionClear: () => {
            // Clear selection in parent (Node Inspector)
            onNodeSelect?.(null);
          },
          onComplete: () => {
            Logger.debug('Delete operation completed via ReactFlow');
          },
        });
      } catch (error) {
        Logger.error('Failed to delete nodes:', error);
      }
    },
    [client, onNodeSelect]
  );

  /**
   * Handle node selection - synchronize with Scene Outliner and Node Inspector
   */
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<OctaneNodeData>) => {
      const sceneNode = node.data.sceneNode;
      onNodeSelect?.(sceneNode);
      Logger.debug('Node Graph: Selected node:', sceneNode.name);
    },
    [onNodeSelect]
  );

  /**
   * Handle edge click - select edge for visual feedback
   */
  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    Logger.debug('Edge clicked:', edge.id);
    // Edge selection is handled automatically by ReactFlow
  }, []);

  // Not connected state
  if (!connected) {
    return (
      <div className="node-graph-empty">
        <p>Connect to Octane to view node graph</p>
      </div>
    );
  }

  // No nodes state
  if (nodes.length === 0) {
    return <div className="node-graph-empty"></div>;
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      style={{ width: '100%', height: '100%', position: 'relative', outline: 'none' }}
    >
      {/* Context Menus */}
      {contextMenuVisible && contextMenuType === 'add' && (
        <NodeTypeContextMenu
          x={contextMenuPosition.x}
          y={contextMenuPosition.y}
          onSelectNodeType={handleSelectNodeType}
          onClose={handleCloseContextMenu}
        />
      )}

      {contextMenuVisible && contextMenuType === 'node' && (
        <NodeContextMenu
          x={contextMenuPosition.x}
          y={contextMenuPosition.y}
          selectedNodeCount={nodes.filter(n => n.selected).length}
          onRenderNode={handleRenderNode}
          onSaveAsMacro={handleSaveAsMacro}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onDeleteSelected={handleDeleteSelected}
          onCollapseItems={handleCollapseItems}
          onExpandItems={handleExpandItems}
          onGroupItems={handleGroupItems}
          onShowInOutliner={handleShowInOutliner}
          onShowInLuaBrowser={handleShowInLuaBrowser}
          onClose={handleCloseContextMenu}
        />
      )}

      {/* Search Dialog - Ctrl+F */}
      <SearchDialog
        visible={searchDialogVisible}
        nodes={nodes}
        onClose={() => setSearchDialogVisible(false)}
        onSelectNodes={handleSearchSelectNodes}
      />

      {/* Node Graph Toolbar moved to App.tsx - always visible in node-graph-header */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onReconnect={onReconnect}
        onReconnectEnd={onReconnectEnd}
        isValidConnection={isValidConnection}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneContextMenu={handlePaneContextMenu}
        elementsSelectable={true}
        nodesConnectable={true}
        nodesDraggable={true}
        edgesFocusable={true}
        edgesReconnectable={true} // Enable edge reconnection by dragging
        reconnectRadius={50} // Allow clicking within 50px of edge to start reconnect (larger area)
        panOnDrag={[1, 2]} // Only pan with middle/right mouse button, not left button
        selectionOnDrag={true} // Enable box selection by dragging in empty space (Octane SE manual)
        selectNodesOnDrag={false} // Don't interfere with box selection - let selectionOnDrag handle it
        selectionMode={SelectionMode.Partial} // Select nodes when box overlaps them (partial or full)
        multiSelectionKeyCode="Shift" // Shift key adds to selection (Octane SE manual)
        nodeTypes={nodeTypes}
        minZoom={0.1}
        maxZoom={4}
        defaultEdgeOptions={{
          type: 'default', // Use default edges - custom component blocks reconnection
          animated: false,
          selectable: true,
          focusable: true,
          interactionWidth: 20, // ReactFlow v12: wider click area for easier selection
          style: { stroke: '#ffc107', strokeWidth: 3 },
        }}
        connectionLineStyle={{
          stroke: connectionLineColor,
          strokeWidth: 3,
        }}
        className="node-graph-reactflow"
        style={{ width: '100%', height: '100%', background: '#454545' }}
        snapToGrid={snapToGrid}
        snapGrid={[20, 20]}
      >
        {/* Grid background matching Octane style - toggleable via toolbar */}
        <Background
          variant={BackgroundVariant.Lines}
          gap={gridVisible ? 60 : 0}
          size={gridVisible ? 1 : 0}
          color="#454545"
        />

        {/* Minimap for navigation - top-left flush with yellow tint matching Octane SE */}
        <MiniMap
          position="top-left"
          nodeColor={node => {
            const data = node.data as OctaneNodeData;
            return data.sceneNode.nodeInfo?.nodeColor
              ? formatColorValue(data.sceneNode.nodeInfo.nodeColor)
              : '#666';
          }}
          style={{
            width: 160,
            height: 120,
            background: 'rgba(70, 68, 50, 0.95)',
            border: '2px solid rgba(200, 180, 80, 0.8)',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
            margin: 0,
            padding: 0,
          }}
          maskColor="rgba(70, 68, 50, 0.6)"
          maskStrokeColor="transparent"
          maskStrokeWidth={0}
          pannable={true}
          zoomable={false}
          nodeStrokeWidth={3}
          offsetScale={0}
        />
      </ReactFlow>
    </div>
  );
});

/**
 * Main component wrapped with ReactFlow provider
 * Memoized for performance
 */
export const NodeGraphEditor = React.memo(function NodeGraphEditor({
  sceneTree,
  selectedNode,
  onNodeSelect,
  gridVisible,
  setGridVisible,
  snapToGrid,
  setSnapToGrid,
  onRecenterViewReady,
  onAutoLayoutReady,
}: NodeGraphEditorProps) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlowProvider>
        <NodeGraphEditorInner
          sceneTree={sceneTree}
          selectedNode={selectedNode}
          onNodeSelect={onNodeSelect}
          gridVisible={gridVisible}
          setGridVisible={setGridVisible}
          snapToGrid={snapToGrid}
          setSnapToGrid={setSnapToGrid}
          onRecenterViewReady={onRecenterViewReady}
          onAutoLayoutReady={onAutoLayoutReady}
        />
      </ReactFlowProvider>
    </div>
  );
});

// Re-export related components for external use
export { OctaneNode } from './OctaneNode';
export type { OctaneNodeData } from './OctaneNode';
