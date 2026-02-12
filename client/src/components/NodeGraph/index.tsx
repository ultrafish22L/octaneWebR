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
import { FEATURES } from '../../config/features';
import { useConnectionOperations } from './hooks/useConnectionOperations';
import { useNodeOperations } from './hooks/useNodeOperations';
import { useConnectionCutter } from './hooks/useConnectionCutter';

interface NodeGraphEditorProps {
  sceneTree: SceneNode[];
  selectedNode?: SceneNode | null;
  // eslint-disable-next-line no-unused-vars
  onNodeSelect?: (node: SceneNode | null) => void;
  gridVisible: boolean;
  // eslint-disable-next-line no-unused-vars
  setGridVisible: (visible: boolean) => void;
  snapToGrid: boolean;
  // eslint-disable-next-line no-unused-vars
  setSnapToGrid: (snap: boolean) => void;
  // eslint-disable-next-line no-unused-vars
  onRecenterViewReady?: (callback: () => void) => void; // Pass fitView callback to parent
}

// Define custom node types
const nodeTypes = {
  octane: OctaneNode,
} as const satisfies NodeTypes;

/**
 * Inner component with ReactFlow context access
 * Memoized for performance (1500+ line component)
 */
const NodeGraphEditorInner = React.memo(function NodeGraphEditorInner({
  sceneTree,
  selectedNode,
  onNodeSelect,
  gridVisible,
  // eslint-disable-next-line no-unused-vars
  setGridVisible: _setGridVisible,
  snapToGrid,
  // eslint-disable-next-line no-unused-vars
  setSnapToGrid: _setSnapToGrid,
  onRecenterViewReady,
}: NodeGraphEditorProps) {
  const { client, connected } = useOctane();
  const { fitView } = useReactFlow();
  const editActions = useEditActions();

  // Track whether initial fitView has been called (should only happen once after initial scene sync)
  const hasInitialFitView = useRef(false);
  const hasProvidedCallback = useRef(false);
  // V3: Track whether progressive loading is in progress (skip sceneTree effect)
  const progressiveLoadingRef = useRef(false);
  // Ref to always have latest sceneTree for event handlers (avoids stale closure)
  const sceneTreeRef = useRef(sceneTree);
  sceneTreeRef.current = sceneTree;

  // Provide fitView callback to parent on mount (only once)
  useEffect(() => {
    if (onRecenterViewReady && !hasProvidedCallback.current) {
      hasProvidedCallback.current = true;
      onRecenterViewReady(() => {
        fitView({ padding: 0.2, duration: 300 });
      });
    }
  }, [fitView, onRecenterViewReady]);

  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node<OctaneNodeData>>([]);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>([]);

  // Custom onNodesChange handler that saves position changes to Octane
  const onNodesChange = useCallback(
    (changes: any[]) => {
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
            Logger.debug(`💾 Saving node position: handle=${nodeHandle}, x=${x}, y=${y}`);
            client.setNodePosition(nodeHandle, x, y).catch((error: any) => {
              Logger.error('Failed to save node position:', error);
            });
          }
        }
      });
    },
    [onNodesChangeBase, client, connected]
  );

  // Multi-connect state (Ctrl+connect to connect multiple selected nodes)
  const isMultiConnectingRef = useRef(false);
  const multiConnectSourcesRef = useRef<string[]>([]); // Selected node IDs to connect

  // Track connection line color during drag (matches source pin color)
  const [connectionLineColor, setConnectionLineColor] = useState('#ffc107');
  const connectingEdgeRef = useRef<Edge | null>(null); // Track if creating new connection vs reconnecting

  /**
   * Node operations hook - handles copy/paste, context menus, search, keyboard shortcuts
   * Extracted for better code organization (Phase 3/3 refactoring)
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
    edges,
    sceneTree,
    onNodeSelect,
    editActions,
  });

  /**
   * Connection cutter hook - handles Ctrl+drag to cut multiple connections
   * Extracted for better code organization (Phase 4/4 refactoring)
   */
  const {
    state: { isCuttingConnections, cutterPath },
    handlers: { handlePaneMouseDown, handlePaneMouseMove, handlePaneMouseUp },
  } = useConnectionCutter(nodes, edges, client);

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
      const nodeMap = new Map<string, SceneNode>();

      // Only process TOP-LEVEL nodes (matching octaneWeb behavior)
      const nodeSpacing = 250;
      const yCenter = 300;

      tree.forEach((item, index) => {
        // Include nodes with handle=0 (NO_ITEM/empty pins) if they have pinInfo
        if (!item.handle && !item.pinInfo) {
          return;
        }

        const handleStr = String(item.handle || 0);
        nodeMap.set(handleStr, item);

        // Extract input pins from item.children
        const inputs = item.children || [];

        const inputHandles = inputs.map((input: any, inputIndex: number) => {
          // Check if connected node is at top level (level 1) in scene tree
          // Top-level nodes are visible in NGE, nested nodes are collapsed
          const isConnectedNodeAtTopLevel =
            input.handle && tree.some((topNode: SceneNode) => topNode.handle === input.handle);

          // Find connected node name if handle exists
          const connectedNode = input.handle
            ? tree.find((n: SceneNode) => n.handle === input.handle)
            : null;
          const connectedNodeName = connectedNode ? connectedNode.name || connectedNode.type : null;

          return {
            id: `input-${inputIndex}`,
            label: input.staticLabel || input.name,
            pinInfo: input.pinInfo,
            handle: input.handle, // Connected node handle
            isAtTopLevel: isConnectedNodeAtTopLevel, // For collapsed detection
            connectedNodeName, // Connected node name for tooltip
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

        // Position nodes using Octane's stored position or fallback to calculated spacing
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
        node.children.forEach((childNode: any, inputIndex: number) => {
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
              Logger.debug(
                `🔗 Edge created: ${sourceHandle} → ${targetHandle} (color: ${edgeColor})`
              );
            }
          }
        });
      });

      Logger.debug(`🔄 Node Graph: ${graphNodes.length} nodes, ${graphEdges.length} edges`);

      return { nodes: graphNodes, edges: graphEdges };
    },
    [handleNodeContextMenu]
  ); // Add handleNodeContextMenu dependency

  /**
   * Load scene graph when sceneTree changes.
   *
   * During progressive V3 loading, skip length-based incremental checks — the tree
   * grows via mutations and shallow copies, not via nodeAdded/nodeDeleted events.
   * Instead, event-driven rebuilds happen on scene:structureComplete and scene:complete.
   *
   * For traditional/post-load operations, use length-based skip to avoid full rebuilds
   * when nodeAdded/nodeDeleted event handlers are managing incremental updates.
   */
  useEffect(() => {
    Logger.debug('📊 NodeGraphEditor: sceneTree changed, length =', sceneTree?.length || 0);

    if (!sceneTree || sceneTree.length === 0) {
      Logger.debug('📊 NodeGraphEditor: Empty scene tree, clearing graph');
      setNodes([]);
      setEdges([]);
      return;
    }

    // During V3 progressive loading, skip this effect — we rebuild on explicit events
    if (FEATURES.PROGRESSIVE_LOADING_V3 && progressiveLoadingRef.current) {
      Logger.debug('📊 NodeGraphEditor: V3 progressive loading active, skipping sceneTree effect');
      return;
    }

    setNodes(currentNodes => {
      // Skip if nodeAdded/nodeDeleted event handlers are managing incremental updates
      if (currentNodes.length < sceneTree.length && currentNodes.length > 0) {
        return currentNodes;
      }
      if (currentNodes.length > sceneTree.length && currentNodes.length > 0) {
        return currentNodes;
      }

      Logger.debug('📊 NodeGraphEditor: Full graph rebuild triggered');
      const { nodes: graphNodes, edges: graphEdges } = convertSceneToGraph(sceneTree);
      setEdges(graphEdges);
      return graphNodes;
    });
  }, [sceneTree, convertSceneToGraph, setEdges, setNodes]);

  /**
   * Handle incremental node additions (no full graph rebuild)
   */
  useEffect(() => {
    if (!connected || !client) return;

    const handleNodeAdded = (event: NodeAddedEvent) => {
      Logger.debug('📊 NodeGraphEditor: Adding node incrementally:', event.node.name);

      // Convert just the new node to a ReactFlow node
      const nodeIndex = sceneTree.length - 1; // New node position
      const nodeSpacing = 250;
      const yCenter = 300;
      const handleStr = String(event.node.handle || 0);

      // Extract input pins from item.children
      const inputs = event.node.children || [];

      const inputHandles = inputs.map((input: any, inputIndex: number) => {
        const isConnectedNodeAtTopLevel =
          input.handle && sceneTree.some((topNode: SceneNode) => topNode.handle === input.handle);
        const connectedNode = input.handle
          ? sceneTree.find((n: SceneNode) => n.handle === input.handle)
          : null;
        const connectedNodeName = connectedNode ? connectedNode.name || connectedNode.type : null;

        return {
          id: `input-${inputIndex}`,
          label: input.staticLabel || input.name,
          pinInfo: input.pinInfo,
          handle: input.handle,
          isAtTopLevel: isConnectedNodeAtTopLevel,
          connectedNodeName,
        };
      });

      const newReactFlowNode: Node<OctaneNodeData> = {
        id: handleStr,
        type: 'octane',
        position: { x: nodeIndex * nodeSpacing, y: yCenter },
        data: {
          sceneNode: event.node,
          inputs: inputHandles,
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
  }, [client, connected, sceneTree, setNodes]);

  /**
   * Handle incremental node deletions (no full graph rebuild)
   */
  useEffect(() => {
    if (!connected || !client) return;

    const handleNodeDeleted = (event: NodeDeletedEvent) => {
      Logger.debug('📊 NodeGraphEditor: Deleting node incrementally, handle:', event.handle);

      const handleStr = String(event.handle);

      // Remove node from graph without rebuilding everything
      setNodes(nds => {
        const filtered = nds.filter(node => node.id !== handleStr);
        Logger.debug(
          `📊 NodeGraphEditor: Removed node ${handleStr}, ${nds.length} → ${filtered.length} nodes`
        );
        return filtered;
      });

      // Remove connected edges
      setEdges(eds => {
        const filtered = eds.filter(edge => edge.source !== handleStr && edge.target !== handleStr);
        Logger.debug(`📊 NodeGraphEditor: Removed edges for node ${handleStr}`);
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
   * V3 Progressive: Listen for build lifecycle events.
   *
   * Level-0 nodes appear in the graph immediately as they arrive (no edges yet).
   * At structureComplete, do a full rebuild with edges.
   * At complete, do a final rebuild to pick up any Pass 2 changes.
   *
   * Uses sceneTreeRef (not sceneTree) so event handlers always read the latest
   * tree without re-registering on every sceneTree change.
   */
  useEffect(() => {
    if (!FEATURES.PROGRESSIVE_LOADING_V3 || !client) return;

    // Track node count for positioning newly added nodes
    let nodeIndexCounter = 0;
    const nodeSpacing = 250;
    const yCenter = 300;

    const handleBuildStart = () => {
      progressiveLoadingRef.current = true;
      hasInitialFitView.current = false;
      nodeIndexCounter = 0;
      // Clear previous graph
      setNodes([]);
      setEdges([]);
    };

    /**
     * Level-0 node added — add to graph immediately (no edges yet).
     * This makes nodes appear as they stream in, before Pass 1 finishes.
     */
    const handleNodeAdded = ({ node, level }: { node: SceneNode; level: number }) => {
      if (level !== 0) return;
      if (!node.handle && !node.pinInfo) return;

      const handleStr = String(node.handle || 0);
      const idx = nodeIndexCounter++;

      // Extract input pins (may be empty at this point, will be rebuilt at structureComplete)
      const inputs = node.children || [];
      const inputHandles = inputs.map((input: any, inputIndex: number) => ({
        id: `input-${inputIndex}`,
        label: input.staticLabel || input.name,
        pinInfo: input.pinInfo,
        handle: input.handle,
        isAtTopLevel: false, // Can't resolve until all nodes are known
        connectedNodeName: null,
      }));

      const output = {
        id: 'output-0',
        label: node.name,
        pinInfo: node.pinInfo,
      };

      const nodePosition = node.position
        ? { x: node.position.x, y: node.position.y }
        : { x: 100 + idx * nodeSpacing, y: yCenter + idx * 20 };

      const newReactFlowNode: Node<OctaneNodeData> = {
        id: handleStr,
        type: 'octane',
        position: nodePosition,
        data: {
          sceneNode: node,
          inputs: inputHandles,
          output,
          onContextMenu: handleNodeContextMenu,
        },
      };

      setNodes(prev => {
        // Deduplicate
        if (prev.some(n => n.id === handleStr)) return prev;
        return [...prev, newReactFlowNode];
      });
    };

    /**
     * Structure complete (Pass 1 done) — full rebuild with edges.
     * By now all level-0 nodes and their immediate children/pins are loaded.
     */
    const handleStructureComplete = () => {
      Logger.debug('📊 NodeGraphEditor: V3 structureComplete — rebuilding graph with edges');
      const { nodes: graphNodes, edges: graphEdges } = convertSceneToGraph(sceneTreeRef.current);
      setNodes(graphNodes);
      setEdges(graphEdges);
    };

    /**
     * Scene complete — final rebuild to pick up any Pass 2 deep-load changes.
     */
    const handleComplete = () => {
      Logger.debug('📊 NodeGraphEditor: V3 complete — final graph rebuild');
      progressiveLoadingRef.current = false;
      const { nodes: graphNodes, edges: graphEdges } = convertSceneToGraph(sceneTreeRef.current);
      setNodes(graphNodes);
      setEdges(graphEdges);
    };

    client.on('scene:buildStart', handleBuildStart);
    client.on('scene:nodeAdded', handleNodeAdded);
    client.on('scene:structureComplete', handleStructureComplete);
    client.on('scene:complete', handleComplete);

    return () => {
      client.off('scene:buildStart', handleBuildStart);
      client.off('scene:nodeAdded', handleNodeAdded);
      client.off('scene:structureComplete', handleStructureComplete);
      client.off('scene:complete', handleComplete);
    };
  }, [client, convertSceneToGraph, setNodes, setEdges, handleNodeContextMenu]);

  /**
   * Synchronize node selection when selectedNode changes externally (e.g., from SceneOutliner)
   */
  useEffect(() => {
    if (!selectedNode || nodes.length === 0) {
      // Clear selection
      setNodes(nds =>
        nds.map(node => ({
          ...node,
          selected: false,
        }))
      );
      return;
    }

    const selectedHandle = String(selectedNode.handle);

    setNodes(nds =>
      nds.map(node => ({
        ...node,
        selected: node.id === selectedHandle,
      }))
    );
  }, [selectedNode, setNodes, nodes.length]);

  /**
   * Fit view ONCE when initial scene is loaded
   * After that, preserve user's zoom/pan position
   * (Don't auto-fit when user creates new nodes - that's annoying!)
   */
  useEffect(() => {
    if (nodes.length > 0 && !hasInitialFitView.current) {
      // Use setTimeout to ensure ReactFlow has finished rendering
      setTimeout(() => {
        fitView({
          padding: 0.2, // 20% padding around nodes
          includeHiddenNodes: false,
          minZoom: 0.5, // Don't zoom out too far
          maxZoom: 1.0, // Don't zoom in too much
          duration: 300, // Smooth animation (300ms)
        });
        hasInitialFitView.current = true;
      }, 100);
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
   * OLD IMPLEMENTATION REMOVED - Now handled by useConnectionOperations hook
   * Removed handlers: onConnectStart, onConnectEnd, onReconnect, onReconnectEnd,
   * onConnect, isValidConnection, onEdgesChange, onEdgesDelete (560+ lines)
   */

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

  /**
   * OLD IMPLEMENTATION REMOVED - Now handled by useNodeOperations hook
   * Removed handlers: handlePaneContextMenu, handleNodeContextMenu, handleSelectNodeType,
   * handleCloseContextMenu, handleCopy, handlePaste, handleCut, handleDeleteSelected,
   * handleCollapseItems, handleExpandItems, handleGroupItems, handleShowInOutliner,
   * handleShowInLuaBrowser, handleRenderNode, handleSaveAsMacro, handleSearchSelectNodes,
   * keyboard shortcuts useEffect, edit actions registration useEffect (~500 lines)
   */

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
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
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

      {/* Connection Cutter Visual */}
      {isCuttingConnections && cutterPath.length > 0 && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          <polyline
            points={cutterPath.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#ff0000"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
        </svg>
      )}

      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        onMouseDown={handlePaneMouseDown}
        onMouseMove={handlePaneMouseMove}
        onMouseUp={handlePaneMouseUp}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
      >
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
        />
      </ReactFlowProvider>
    </div>
  );
});

// Re-export related components for external use
export { OctaneNode } from './OctaneNode';
export type { OctaneNodeData } from './OctaneNode';
