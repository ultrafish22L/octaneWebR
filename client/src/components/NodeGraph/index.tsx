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
  addEdge,
  reconnectEdge,
  Connection,
  NodeTypes,
  ReactFlowProvider,
  OnConnectStart,
  OnConnectEnd,
  EdgeChange,
  SelectionMode,
} from '@xyflow/react';
import { OnReconnectEnd } from '@xyflow/system';
import '@xyflow/react/dist/style.css';

import { SceneNode, NodeAddedEvent, NodeDeletedEvent } from '../../services/OctaneClient';
import { useOctane } from '../../hooks/useOctane';
import { useEditActions } from '../../contexts/EditActionsContext';
import { OctaneNode, OctaneNodeData } from './OctaneNode';
import { formatColorValue } from '../../utils/ColorUtils';
import { NodeTypeContextMenu } from './NodeTypeContextMenu';
import { NodeContextMenu } from './NodeContextMenu';
import { SearchDialog } from './SearchDialog';
import { NodeType } from '../../constants/OctaneTypes';
import { EditCommands } from '../../commands/EditCommands';
import { getPinTypeInfo } from '../../constants/PinTypes';
import Logger from '../../utils/Logger';

/**
 * Get pin color with proper fallback logic:
 * 1. Use pinInfo.pinColor if available (from Octane gRPC API)
 * 2. Fall back to local color mapping by pin type (from C++ source in PinTypes.ts)
 * 3. Fall back to default amber if neither is available
 */
function getPinColor(pinInfo: any): string {
  // Check for direct pin color from Octane (handles 0 as valid black color)
  if (pinInfo?.pinColor !== undefined && pinInfo?.pinColor !== null) {
    return formatColorValue(pinInfo.pinColor);
  }
  
  // Fall back to local color mapping by type (from PinTypes.ts - C++ source colors)
  if (pinInfo?.type) {
    try {
      const info = getPinTypeInfo(pinInfo.type);

      if (info) {
        return info.color;
      }
    } catch (e) {
      // Type not found in mapping, continue to default
      // Final fallback to amber
      return '#ffc107';      
    }
  }  
  // Final fallback to amber
  return '#ffc107';
}

interface NodeGraphEditorProps {
  sceneTree: SceneNode[];
  selectedNode?: SceneNode | null;
  onNodeSelect?: (node: SceneNode | null) => void;
  gridVisible: boolean;
  setGridVisible: (visible: boolean) => void;
  snapToGrid: boolean;
  setSnapToGrid: (snap: boolean) => void;
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
  setGridVisible: _setGridVisible,
  snapToGrid,
  setSnapToGrid: _setSnapToGrid,
  onRecenterViewReady
}: NodeGraphEditorProps) {
  const { client, connected } = useOctane();
  const { fitView } = useReactFlow();
  const editActions = useEditActions();

  // Track whether initial fitView has been called (should only happen once after initial scene sync)
  const hasInitialFitView = useRef(false);
  const hasProvidedCallback = useRef(false);

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
  const onNodesChange = useCallback((changes: any[]) => {
    // First apply changes to the local state
    onNodesChangeBase(changes);
    
    // Then save position changes to Octane
    changes.forEach((change) => {
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
  }, [onNodesChangeBase, client, connected]);
  
  // Context menu state
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuType, setContextMenuType] = useState<'node' | 'add'>('add'); // 'node' = right-click on node, 'add' = right-click on empty space
  const [contextMenuNodeId, setContextMenuNodeId] = useState<string | null>(null); // Track which node was right-clicked

  // Search dialog state
  const [searchDialogVisible, setSearchDialogVisible] = useState(false);

  // Copy/paste clipboard state
  const [copiedNodes, setCopiedNodes] = useState<Node<OctaneNodeData>[]>([]);
  const [copiedEdges, setCopiedEdges] = useState<Edge[]>([]);

  // Connection cutter state (Ctrl+drag to cut connections)
  const [isCuttingConnections, setIsCuttingConnections] = useState(false);
  const [cutterPath, setCutterPath] = useState<{ x: number; y: number }[]>([]);
  const cutterStartRef = useRef<{ x: number; y: number } | null>(null);

  // Multi-connect state (Ctrl+connect to connect multiple selected nodes)
  const isMultiConnectingRef = useRef(false);
  const multiConnectSourcesRef = useRef<string[]>([]); // Selected node IDs to connect

  // Track connection line color during drag (matches source pin color)
  const [connectionLineColor, setConnectionLineColor] = useState('#ffc107');
  const connectingEdgeRef = useRef<Edge | null>(null); // Track if creating new connection vs reconnecting

  /**
   * Convert scene tree to ReactFlow nodes and edges
   * Following octaneWeb's NodeGraphEditor.js pattern:
   * - Only show TOP-LEVEL nodes from scene.tree (no recursive children)
   * - Only show direct connections between top-level nodes
   * - Use bezier curves for connection splines
   */
  const convertSceneToGraph = useCallback((tree: SceneNode[]) => {
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
        const isConnectedNodeAtTopLevel = input.handle && tree.some((topNode: SceneNode) => topNode.handle === input.handle);
        
        // Find connected node name if handle exists
        const connectedNode = input.handle ? tree.find((n: SceneNode) => n.handle === input.handle) : null;
        const connectedNodeName = connectedNode ? (connectedNode.name || connectedNode.type) : null;
        
        return {
          id: `input-${inputIndex}`,
          label: input.staticLabel || input.name,
          pinInfo: input.pinInfo,
          handle: input.handle,  // Connected node handle
          isAtTopLevel: isConnectedNodeAtTopLevel,  // For collapsed detection
          connectedNodeName,  // Connected node name for tooltip
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
        : { x: 100 + (index * nodeSpacing), y: yCenter + (index * 20) };

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
    tree.forEach((node) => {
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
                strokeWidth: 3 
              },
              data: {
                source: sourceHandle,
                target: targetHandle,
                sourceHandle: 'output-0',
                targetHandle: `input-${inputIndex}`,
              },
            };

            graphEdges.push(edge);
            Logger.debug(`🔗 Edge created: ${sourceHandle} → ${targetHandle} (color: ${edgeColor})`);
          }
        }
      });
    });

    Logger.debug(`🔄 Node Graph: ${graphNodes.length} nodes, ${graphEdges.length} edges`);

    return { nodes: graphNodes, edges: graphEdges };
  }, [client]); // Add client dependency for scene map access

  /**
   * Load scene graph when sceneTree changes
   * Optimization: Skip full rebuild if incremental add/delete handlers are active
   */
  useEffect(() => {
    Logger.debug('📊 NodeGraphEditor: sceneTree changed, length =', sceneTree?.length || 0);
    
    if (!sceneTree || sceneTree.length === 0) {
      Logger.debug('📊 NodeGraphEditor: Empty scene tree, clearing graph');
      setNodes([]);
      setEdges([]);
      return;
    }

    // Check if we're handling incremental operations
    // - nodeAdded: currentNodes.length < sceneTree.length
    // - nodeDeleted: currentNodes.length > sceneTree.length
    // If so, skip full rebuild - the event handlers will update incrementally
    setNodes((currentNodes) => {
      Logger.debug(`📊 NodeGraphEditor: currentNodes=${currentNodes.length}, sceneTree=${sceneTree.length}`);
      
      // If current graph has fewer nodes, nodeAdded is handling it
      if (currentNodes.length < sceneTree.length && currentNodes.length > 0) {
        Logger.debug('📊 NodeGraphEditor: Skipping full rebuild - nodeAdded handler active');
        return currentNodes; // Don't rebuild
      }
      
      // If current graph has more nodes, nodeDeleted is handling it
      if (currentNodes.length > sceneTree.length && currentNodes.length > 0) {
        Logger.debug('📊 NodeGraphEditor: Skipping full rebuild - nodeDeleted handler active');
        return currentNodes; // Don't rebuild
      }
      
      // Full rebuild needed (initial load, sync issues, or other changes)
      Logger.debug('📊 NodeGraphEditor: Full graph rebuild triggered');
      const { nodes: graphNodes, edges: graphEdges } = convertSceneToGraph(sceneTree);
      Logger.debug(`📊 NodeGraphEditor: Rebuilt graph with ${graphNodes.length} nodes, ${graphEdges.length} edges`);
      setEdges(graphEdges);
      return graphNodes;
    });
  }, [sceneTree, convertSceneToGraph, setEdges]);

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
        const isConnectedNodeAtTopLevel = input.handle && sceneTree.some((topNode: SceneNode) => topNode.handle === input.handle);
        const connectedNode = input.handle ? sceneTree.find((n: SceneNode) => n.handle === input.handle) : null;
        const connectedNodeName = connectedNode ? (connectedNode.name || connectedNode.type) : null;
        
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
      setNodes((nds) => [...nds, newReactFlowNode]);
      
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
      setNodes((nds) => {
        const filtered = nds.filter(node => node.id !== handleStr);
        Logger.debug(`📊 NodeGraphEditor: Removed node ${handleStr}, ${nds.length} → ${filtered.length} nodes`);
        return filtered;
      });
      
      // Remove connected edges
      setEdges((eds) => {
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
   * Synchronize node selection when selectedNode changes externally (e.g., from SceneOutliner)
   */
  useEffect(() => {
    if (!selectedNode || nodes.length === 0) {
      // Clear selection
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          selected: false,
        }))
      );
      return;
    }

    const selectedHandle = String(selectedNode.handle);
    
    setNodes((nds) =>
      nds.map((node) => ({
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
          padding: 0.2,        // 20% padding around nodes
          includeHiddenNodes: false,
          minZoom: 0.5,        // Don't zoom out too far
          maxZoom: 1.0,        // Don't zoom in too much
          duration: 300,       // Smooth animation (300ms)
        });
        hasInitialFitView.current = true;
      }, 100);
    }
  }, [nodes, fitView]);

  /**
   * Connection Cutter: Mouse handlers
   * Per Octane SE manual: "Cuts off multiple connections by holding down 
   * the CTRL key and then click-dragging the mouse to form a line"
   */
  const handlePaneMouseDown = useCallback((event: React.MouseEvent) => {
    // Only activate if Ctrl/Cmd is held and left mouse button
    if ((event.ctrlKey || event.metaKey) && event.button === 0) {
      // Get mouse position in viewport coordinates
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      setIsCuttingConnections(true);
      cutterStartRef.current = { x, y };
      setCutterPath([{ x, y }]);
      
      Logger.debug('✂️ Connection cutter activated');
    }
  }, []);

  const handlePaneMouseMove = useCallback((event: React.MouseEvent) => {
    if (isCuttingConnections && cutterStartRef.current) {
      // Get mouse position in viewport coordinates
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Add to cutter path
      setCutterPath(prev => [...prev, { x, y }]);
    }
  }, [isCuttingConnections]);

  const handlePaneMouseUp = useCallback(async (event: React.MouseEvent) => {
    if (isCuttingConnections && cutterStartRef.current) {
      // Get final mouse position
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const endX = event.clientX - rect.left;
      const endY = event.clientY - rect.top;

      // Find edges that intersect with the cutter line
      const edgesToDelete: Edge[] = [];
      
      // Simple line intersection check for each edge
      // (For now, we'll just check if edge passes through the line segment)
      edges.forEach(edge => {
        // This is a simplified check - in production you'd want proper 
        // line-curve intersection detection
        // For now, delete edges if they're in the general area
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          // Check if edge crosses the cutter line
          // (simplified: check if line intersects bounding box of edge)
          const intersects = checkLineIntersectsEdge(
            cutterStartRef.current!,
            { x: endX, y: endY },
            sourceNode.position,
            targetNode.position
          );
          
          if (intersects) {
            edgesToDelete.push(edge);
          }
        }
      });

      // Delete intersected edges
      if (edgesToDelete.length > 0) {
        Logger.debug(`✂️ Cutting ${edgesToDelete.length} connection(s)`);
        
        for (const edge of edgesToDelete) {
          // Delete via API
          const targetNode = nodes.find(n => n.id === edge.target);
          if (targetNode && client) {
            const nodeData = targetNode.data as OctaneNodeData;
            const targetHandle = nodeData.sceneNode.handle;
            const targetHandleId = edge.targetHandle || 'input-0';
            const targetPinIndex = parseInt(targetHandleId.split('-')[1], 10);
            
            if (targetHandle && !isNaN(targetPinIndex)) {
              await client.disconnectPin(targetHandle, targetPinIndex);
              Logger.debug(`✂️ Disconnected pin ${targetPinIndex} on node ${targetHandle}`);
            }
          }
        }
      }

      // Reset cutter state
      setIsCuttingConnections(false);
      setCutterPath([]);
      cutterStartRef.current = null;
    }
  }, [isCuttingConnections, edges, nodes, client]);

  /**
   * Check if a line segment intersects with an edge
   * Uses simple bounding box intersection for now
   */
  const checkLineIntersectsEdge = (
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number },
    edgeStart: { x: number; y: number },
    edgeEnd: { x: number; y: number }
  ): boolean => {
    // Simple line-line intersection using cross product
    const dx1 = lineEnd.x - lineStart.x;
    const dy1 = lineEnd.y - lineStart.y;
    const dx2 = edgeEnd.x - edgeStart.x;
    const dy2 = edgeEnd.y - edgeStart.y;
    
    const det = dx1 * dy2 - dy1 * dx2;
    
    if (Math.abs(det) < 0.001) return false; // Parallel lines
    
    const dx3 = lineStart.x - edgeStart.x;
    const dy3 = lineStart.y - edgeStart.y;
    
    const t1 = (dx3 * dy2 - dy3 * dx2) / det;
    const t2 = (dx3 * dy1 - dy3 * dx1) / det;
    
    return t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1;
  };

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
        const selectedNodes = nodes.filter((n) => n.selected);
        if (selectedNodes.length === 0) return;

        // Store selected nodes and edges between them
        const selectedNodeIds = selectedNodes.map((n) => n.id);
        const relatedEdges = edges.filter(
          (e) => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
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
  }, [nodes, edges, copiedNodes, copiedEdges]);

  /**
   * Handle search dialog node selection
   */
  const handleSearchSelectNodes = useCallback((nodeIds: string[]) => {
    setNodes((nds) =>
      nds.map((node) => ({
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
  }, [setNodes, nodes, onNodeSelect]);

  /**
   * Handle connection start - capture source handle color for drag line
   */
  const onConnectStart: OnConnectStart = useCallback(
    (event, { nodeId, handleId, handleType }) => {
      Logger.debug('Connection drag started:', { nodeId, handleId, handleType });
      
      // Check if Ctrl/Cmd is held for multi-connect feature
      const isCtrlHeld = (event as MouseEvent)?.ctrlKey || (event as MouseEvent)?.metaKey;
      
      // Multi-connect: if Ctrl held and dragging from OUTPUT pin of a SELECTED node
      if (isCtrlHeld && handleType === 'source') {
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length > 1 && selectedNodes.some(n => n.id === nodeId)) {
          // Activate multi-connect mode
          isMultiConnectingRef.current = true;
          multiConnectSourcesRef.current = selectedNodes.map(n => n.id);
          Logger.debug(`🔗 Multi-connect activated: ${selectedNodes.length} selected nodes will connect`);
        }
      } else {
        isMultiConnectingRef.current = false;
        multiConnectSourcesRef.current = [];
      }
      
      // Find the source node and handle to get its color
      const sourceNode = nodes.find(n => n.id === nodeId);
      if (!sourceNode) return;

      const nodeData = sourceNode.data as OctaneNodeData;
      
      // Get handle color based on type (source = output, target = input)
      let handleColor = '#ffc107'; // Default color
      
      // Get color with proper fallback (Octane → local mapping → default)
      if (handleType === 'source' && nodeData.output?.pinInfo) {
        handleColor = getPinColor(nodeData.output.pinInfo);
      } else if (handleType === 'target' && nodeData.inputs) {
        const input = nodeData.inputs.find(i => i.id === handleId);
        if (input?.pinInfo) {
          handleColor = getPinColor(input.pinInfo);
        }
      }

      Logger.debug('🎨 Setting connection line color:', handleColor);
      setConnectionLineColor(handleColor);

      // OCTANE BEHAVIOR: Keep original connections visible during drag
      // Only remove them when a new connection succeeds
      // For input pins (target), track existing edge for replacement
      // For output pins (source), don't track - just add new connection
      if (handleType === 'target') {
        const existingEdge = edges.find(
          e => e.target === nodeId && e.targetHandle === handleId
        );
        
        if (existingEdge) {
          Logger.debug('📌 Input pin has existing connection:', existingEdge.id, '(will replace on success)');
          connectingEdgeRef.current = existingEdge;
        } else {
          connectingEdgeRef.current = null;
        }
      } else {
        // Output pin - allow multiple connections, don't track for removal
        Logger.debug('📤 Output pin - allowing multiple connections');
        connectingEdgeRef.current = null;
      }
    },
    [nodes, edges]
  );

  /**
   * Handle connection end - cleanup only
   * Original edges stay visible during drag, so nothing to restore
   */
  const onConnectEnd: OnConnectEnd = useCallback(() => {
    Logger.debug('Connection drag ended');
    
    // Reset state
    setConnectionLineColor('#ffc107'); // Reset to default
    connectingEdgeRef.current = null;
    
    // Reset multi-connect state
    isMultiConnectingRef.current = false;
    multiConnectSourcesRef.current = [];
  }, []);

  /**
   * Handle edge reconnect - ReactFlow's built-in edge reconnection
   * Triggered when user drags an edge endpoint to a new handle
   * Uses ReactFlow's reconnectEdge utility as per best practices
   */
  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    Logger.debug('🔄 RECONNECT triggered:', oldEdge.id, '→', newConnection);
    
    // Detect no-op reconnection: user dropped edge back on the same pin
    if (oldEdge.target === newConnection.target && 
        oldEdge.targetHandle === newConnection.targetHandle &&
        oldEdge.source === newConnection.source &&
        oldEdge.sourceHandle === newConnection.sourceHandle) {
      Logger.debug('⏭️ No-op reconnection detected - ignoring (same source and target)');
      return;
    }
    
    // Update UI using ReactFlow's official reconnectEdge utility
    setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));

    // Sync with Octane in background (async operations after state update)
    if (!client) {
      Logger.warn('Cannot sync edge reconnection: No Octane client');
      return;
    }

    // Sync reconnection with Octane (disconnect old, connect new)
    (async () => {
      try {
        // Disconnect old connection
        const oldTargetHandle = parseInt(oldEdge.target);
        const oldPinIdx = oldEdge.targetHandle ? 
          parseInt(oldEdge.targetHandle.split('-')[1]) : 0;
        
        Logger.debug(`🔌 Disconnecting old: node=${oldTargetHandle}, pin=${oldPinIdx}`);
        await client.disconnectPin(oldTargetHandle, oldPinIdx);
        
        // Connect new connection
        const newTargetHandle = parseInt(newConnection.target!);
        const newSourceHandle = parseInt(newConnection.source!);
        const newPinIdx = newConnection.targetHandle ? 
          parseInt(newConnection.targetHandle.split('-')[1]) : 0;
        
        Logger.debug(`🔌 Connecting new: source=${newSourceHandle} → target=${newTargetHandle}, pin=${newPinIdx}`);
        await client.connectPinByIndex(newTargetHandle, newPinIdx, newSourceHandle, true);
        Logger.debug('Octane edge reconnected');
      } catch (error) {
        Logger.error('Failed to sync edge reconnection with Octane:', error);
      }
    })();
  }, [client, setEdges]);

  /**
   * Handle edge reconnect end - detect failed reconnections
   * When user drags an edge and drops on empty space, disconnect it in Octane
   * OCTANE BEHAVIOR: Failed reconnection = disconnect the edge entirely
   * 
   * ReactFlow v12 Pattern: Use connectionState.isValid to detect success/failure
   */
  const onReconnectEnd: OnReconnectEnd = useCallback(
    (_event, edge, _handleType, connectionState) => {
      Logger.debug('🔄 RECONNECT END:', edge.id, 'isValid:', connectionState.isValid);
      
      // If reconnection succeeded (connectionState.isValid === true), onReconnect already handled it
      if (connectionState.isValid) {
        Logger.debug('Reconnection succeeded - onReconnect already handled sync');
        return;
      }

      // Failed reconnection - user dropped on empty space or invalid target
      // Disconnect the edge in Octane and remove from UI
      Logger.debug('Reconnection failed - disconnecting edge:', edge.id);

      if (!client) {
        Logger.warn('Cannot disconnect edge: No Octane client');
        return;
      }

      // Disconnect in Octane and remove from UI
      (async () => {
        try {
          // Parse edge info: target node and pin index
          const targetHandle = parseInt(edge.target);
          const pinIdx = edge.targetHandle 
            ? parseInt(edge.targetHandle.split('-')[1]) 
            : 0;

          Logger.debug(`🔌 Disconnecting in Octane: node=${targetHandle}, pin=${pinIdx}`);
          await client.disconnectPin(targetHandle, pinIdx);
          Logger.debug('Pin disconnected in Octane');

          // Remove edge from UI
          setEdges((eds) => eds.filter(e => e.id !== edge.id));
          Logger.debug('Edge removed from UI');
          
        } catch (error) {
          Logger.error('Failed to disconnect edge:', error);
        }
      })();
    }, 
    [client, setEdges]
  );

  /**
   * Handle edge click - Octane behavior: disconnect at closest pin, start drag from other end
   * This function is passed to custom edges via data.onClick
   */
  // Edge click/reconnection is now handled by ReactFlow's built-in edgesReconnectable feature
  // No custom logic needed - just drag edge ends to reconnect

  /**
   * Handle new connections
   * OCTANE BEHAVIOR:
   * - Output pins can connect to multiple inputs (one-to-many)
   * - Input pins can only connect to one output (many-to-one)
   * - Replace old input connection only when new connection succeeds
   */
  const onConnect = useCallback(
    async (connection: Connection) => {
      try {
        if (!connection.source || !connection.target) {
          Logger.warn('Invalid connection - missing source or target');
          return;
        }

        Logger.debug('Starting connection creation:', {
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
        });

        // Multi-connect: if active, connect ALL selected nodes to this target pin
        if (isMultiConnectingRef.current && multiConnectSourcesRef.current.length > 0) {
          Logger.debug(`🔗 Multi-connect: connecting ${multiConnectSourcesRef.current.length} nodes to target`);
          
          const targetHandle = parseInt(connection.target);
          const pinIdx = connection.targetHandle 
            ? parseInt(connection.targetHandle.split('-')[1]) 
            : 0;

          // Connect each selected node to the target pin
          for (const sourceNodeId of multiConnectSourcesRef.current) {
            const sourceHandle = parseInt(sourceNodeId);
            
            try {
              Logger.debug(`🔗 Multi-connecting ${sourceNodeId} → ${connection.target}[${pinIdx}]`);
              
              // For input pins, we can only connect one at a time
              // So we'll create separate target pins or skip if target already connected
              // For now, just connect the first one successfully
              await client.connectPinByIndex(targetHandle, pinIdx, sourceHandle, true);
              Logger.debug(`✅ Multi-connect succeeded for ${sourceNodeId}`);
              
              // Only connect first one to avoid overwriting same input pin
              // In real Octane, this might create multiple target nodes or handle differently
              break;
              
            } catch (error) {
              Logger.error(`❌ Failed to multi-connect ${sourceNodeId}:`, error);
            }
          }
          
          // Reset multi-connect state
          isMultiConnectingRef.current = false;
          multiConnectSourcesRef.current = [];
          
          // Let parent refresh scene to show connections
          return;
        }

        // Check if target input pin already has a connection (needs replacement)
        const existingTargetEdge = edges.find(
          e => e.target === connection.target && e.targetHandle === connection.targetHandle
        );

        // Detect no-op: reconnecting to same source (duplicate connection)
        if (existingTargetEdge && existingTargetEdge.source === connection.source && 
            existingTargetEdge.sourceHandle === connection.sourceHandle) {
          Logger.debug('⏭️ No-op connection detected - already connected to same source, ignoring');
          connectingEdgeRef.current = null;
          return;
        }

        // If we were dragging FROM an input pin (connectingEdgeRef), remove that old connection
        const edgesToRemove: string[] = [];
        const nodesToRemove: string[] = [];
        
        if (connectingEdgeRef.current) {
          Logger.debug('🔄 Removing old source connection:', connectingEdgeRef.current.id);
          edgesToRemove.push(connectingEdgeRef.current.id);
        }
        
        if (existingTargetEdge && existingTargetEdge.id !== connectingEdgeRef.current?.id) {
          Logger.debug('🔄 Removing old target connection:', existingTargetEdge.id);
          edgesToRemove.push(existingTargetEdge.id);
          
          // COLLAPSED NODE CLEANUP: Check if old connection points to a collapsed (default value) node
          // Octane automatically deletes these when replaced with a new connection
          const oldSourceHandle = parseInt(existingTargetEdge.source);
          const oldSourceNode = client.lookupItem(oldSourceHandle);
          
          if (oldSourceNode) {
            // A collapsed node is typically:
            // 1. A default value node (Float value, RGB color, Bool value, etc.)
            // 2. Has nodeInfo.takesPinDefaultValue = true OR
            // 3. Matches the pin's defaultNodeType
            const isCollapsedNode = oldSourceNode.nodeInfo?.takesPinDefaultValue === true ||
                                   oldSourceNode.name?.includes('value') ||
                                   oldSourceNode.name?.includes('color');
            
            if (isCollapsedNode) {
              Logger.debug('Detected collapsed node to remove:', oldSourceNode.name, oldSourceHandle);
              nodesToRemove.push(existingTargetEdge.source);
            }
          }
        }

        // Call Octane API to connect nodes
        const sourceHandle = parseInt(connection.source);
        const targetHandle = parseInt(connection.target);

        // Extract pin index from targetHandle (format: "input-N")
        const pinIdx = connection.targetHandle 
          ? parseInt(connection.targetHandle.split('-')[1]) 
          : 0;

        Logger.debug('📤 Calling ApiNode.connectToIx:', {
          targetHandle,
          pinIdx,
          sourceHandle,
        });

        const inputItem  = connectingEdgeRef.current ? client.lookupItem(sourceHandle) : client.lookupItem(targetHandle);
        const outputItem = connectingEdgeRef.current ? client.lookupItem(targetHandle) : client.lookupItem(sourceHandle);

        if (!inputItem || !outputItem || !inputItem.children) {
          Logger.error('Input or Output item not found');
          return;
        }
        const child = inputItem.children[pinIdx];

        if (!child || !child.pinInfo) {
          Logger.error('Input item has no pin', pinIdx);
          return;
        }
        if (child.pinInfo.type != outputItem.outType) {
          Logger.error('Input pin does not match output type', child.pinInfo.type, outputItem.outType);
          return;
        }

        // Get edge color with proper fallback (Octane → local mapping → default)
        const edgeColor = getPinColor(child.pinInfo);

        // Connect pin in Octane
        await client.connectPinByIndex(targetHandle, pinIdx, sourceHandle, true);
        Logger.debug('Pin connected in Octane');

        // Create edge ID matching the format used in scene tree building
        const edgeId = `e${sourceHandle}-${targetHandle}-${pinIdx}`;

        // Remove old edges and add new edge
        setEdges((eds) => {
          // Filter out old edges
          const filtered = edgesToRemove.length > 0 
            ? eds.filter(e => !edgesToRemove.includes(e.id))
            : eds;
          
          // Check if edge already exists (shouldn't happen, but safety check)
          const edgeExists = filtered.find(e => e.id === edgeId);
          if (edgeExists) {
            Logger.debug('Edge already exists, not adding duplicate:', edgeId);
            return eds;
          }
          
          // Add new edge with correct color from pin info
          // Safe to assert as non-null because we checked at start of function
          const newEdge: Edge = {
            id: edgeId,
            source: connection.source!,
            target: connection.target!,
            sourceHandle: connection.sourceHandle || 'output-0',
            targetHandle: connection.targetHandle || `input-${pinIdx}`,
            type: 'default',
            animated: false,
            selectable: true,
            focusable: true,
            interactionWidth: 20, // ReactFlow v12: wider click area for easier selection
            style: { 
              stroke: edgeColor, 
              strokeWidth: 3 
            },
          };
          
          Logger.debug('Adding new edge to ReactFlow:', newEdge, 'with color:', edgeColor);
          return addEdge(newEdge, filtered);
        });

        // Remove collapsed nodes from scene and ReactFlow
        if (nodesToRemove.length > 0) {
          Logger.debug('Removing', nodesToRemove.length, 'collapsed node(s)');
          
          // Remove from ReactFlow nodes
          setNodes((nds) => nds.filter(n => !nodesToRemove.includes(n.id)));
          
          // Remove from scene.map
          nodesToRemove.forEach(nodeId => {
            const handleNum = parseInt(nodeId);
            const removedNode = client.lookupItem(handleNum);
            if (removedNode) {
              Logger.debug('  🗑️ Removed from scene.map:', removedNode.name, handleNum);
              client.removeFromScene(handleNum);
            }
          });
          
          Logger.debug('Collapsed node cleanup complete');
        }

        // Clear the connecting edge ref
        connectingEdgeRef.current = null;

        // NO scene sync - connection only updates local UI state
        // Collapsed nodes removed locally, no full rebuild needed
        Logger.debug('Connection complete!');
        
      } catch (error) {
        Logger.error('Failed to create connection:', error);
        
        // If API call failed, don't add edge to state
        connectingEdgeRef.current = null;
      }
    },
    [client, setEdges, edges]
  );

  /**
   * Validate connections before allowing them
   * - Source must be an output handle (source)
   * - Target must be an input handle (target)
   */
  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      // Basic validation
      if (!connection.source || !connection.target) {
        Logger.warn('Invalid connection: Missing source or target');
        return false;
      }
      
      // Prevent self-connections
      if (connection.source === connection.target) {
        Logger.warn('Invalid connection: Self-connection not allowed');
        return false;
      }
      
      return true;
    },
    []
  );

  /**
   * Handle edge changes (delegate to base handler, reconnection handled in onConnectStart)
   */
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // DEBUG: Log edge changes
      Logger.debug('📝 EDGE CHANGES:', changes);
      // Apply changes using the base handler from useEdgesState
      onEdgesChangeBase(changes);
    },
    [onEdgesChangeBase]
  );

  /**
   * Handle node deletion with optimized cascade
   * Called by ReactFlow when nodes are deleted (e.g., via Delete key)
   */
  const onNodesDelete = useCallback(
    async (deletedNodes: Node[]) => {
      try {
        // Convert ReactFlow nodes to SceneNodes
        const sceneNodes: SceneNode[] = (deletedNodes as Node<OctaneNodeData>[]).map(n => n.data.sceneNode);
        
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
          }
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
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      Logger.debug('Edge clicked:', edge.id);
      // Edge selection is handled automatically by ReactFlow
    },
    []
  );



  /**
   * Handle edge deletion (keyboard Delete key or context menu)
   * NOTE: Currently connections are visual-only in ReactFlow and not synced to Octane backend
   * When backend sync is implemented, use connectToIx with handle=0 to disconnect pins
   */
  const onEdgesDelete = useCallback(
    async (deletedEdges: Edge[]) => {
      Logger.debug(`✂️ Deleted ${deletedEdges.length} edge(s) from graph (visual only)`);
      // TODO: When backend connection sync is implemented, add API calls here
      // For each edge: await client.callApi('ApiNode', 'connectToIx', targetHandle, {
      //   pinIdx,
      //   sourceNode: { handle: 0, type: 17 },  // handle=0 means disconnect
      //   evaluate: true,
      //   doCycleCheck: true
      // });
    },
    []
  );

  /**
   * Context menu event handlers
   */
  // Handle right-click on empty pane (add node menu)
  // Using ReactFlow v12's official onPaneContextMenu prop
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
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, nodeId: string) => {
    Logger.debug('🖱️ [NodeGraphEditor] handleNodeContextMenu fired!', {
      nodeId,
      position: { x: event.clientX, y: event.clientY }
    });
    event.preventDefault();
    event.stopPropagation();
    
    // Select the right-clicked node in ReactFlow
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: n.id === nodeId,
      }))
    );
    
    // Select the node app-wide (Scene Outliner, Node Inspector, etc.)
    const sceneNode = sceneTree.find((item) => String(item.handle) === nodeId);
    if (sceneNode && onNodeSelect) {
      onNodeSelect(sceneNode);
      Logger.debug('Node selected app-wide:', sceneNode.name);
    }
    
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContextMenuType('node');
    setContextMenuNodeId(nodeId);
    setContextMenuVisible(true);
  }, [sceneTree, onNodeSelect, setNodes]);

  const handleSelectNodeType = useCallback(async (nodeType: string) => {
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
  }, [client]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenuVisible(false);
    setContextMenuNodeId(null);
  }, []);



  /**
   * Node context menu action handlers
   */
  const handleCut = useCallback(async () => {
    const selectedNodes = nodes.filter((n) => n.selected);
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
      }
    });
  }, [nodes, client, setNodes, onNodeSelect]);

  const handleCopy = useCallback(async () => {
    const selectedNodes = nodes.filter((n) => n.selected);
    if (selectedNodes.length === 0) {
      Logger.warn('No nodes selected for copy');
      return;
    }
    
    // Convert ReactFlow nodes to SceneNodes
    const sceneNodes: SceneNode[] = selectedNodes.map(n => n.data.sceneNode);
    
    // Use unified EditCommands
    await EditCommands.copyNodes({
      client,
      selectedNodes: sceneNodes,
    });
  }, [nodes, client]);

  const handlePaste = useCallback(async () => {
    Logger.debug('Paste at position:', contextMenuPosition);
    
    // Use unified EditCommands
    await EditCommands.pasteNodes({
      client,
      selectedNodes: [], // Not relevant for paste
      onComplete: () => {
        Logger.debug('Paste operation completed from NodeGraph');
      }
    });
  }, [client, contextMenuPosition]);

  const handleCollapseItems = useCallback(async () => {
    const selectedNodes = nodes.filter((n) => n.selected);
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
      }
    });
  }, [nodes, client]);

  const handleExpandItems = useCallback(async () => {
    const selectedNodes = nodes.filter((n) => n.selected);
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
      }
    });
  }, [nodes, client]);

  const handleShowInLuaBrowser = useCallback(() => {
    Logger.debug('🔍 Show in Lua API browser - Node ID:', contextMenuNodeId);
    // TODO: Implement Lua API browser integration
    // Requires: LUA API documentation viewer/browser component
    alert('Lua API browser integration coming soon!');
  }, [contextMenuNodeId]);

  const handleDeleteSelected = useCallback(async () => {
    const selectedNodes = nodes.filter((n) => n.selected);
    
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
      }
    });
  }, [nodes, client, setNodes, onNodeSelect]);

  const handleSaveAsMacro = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected);
    Logger.debug('💾 Save as Macro - Selected nodes:', selectedNodes.length);
    // TODO: Implement save to LocalDB
    // Requires: apilocaldb.proto API integration
    alert('Save as Macro feature requires LocalDB API integration\n(apilocaldb.proto)\n\nComing soon!');
  }, [nodes]);

  const handleRenderNode = useCallback(() => {
    Logger.debug('🎬 Render Node - Node ID:', contextMenuNodeId);
    // TODO: Implement render target switching
    // Requires: API to set render target to specific node
    alert('Render Node feature requires render target switching API\n\nComing soon!');
  }, [contextMenuNodeId]);

  const handleGroupItems = useCallback(async () => {
    const selectedNodes = nodes.filter((n) => n.selected);
    
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
      }
    });
  }, [nodes, client]);

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

  const handleShowInOutliner = useCallback(() => {
    Logger.debug('🔍 Show in Outliner - Node ID:', contextMenuNodeId);
    
    // Find the node and its corresponding scene node
    const reactFlowNode = nodes.find((n) => n.id === contextMenuNodeId);
    if (reactFlowNode) {
      // Trigger selection in Scene Outliner
      const sceneNode = sceneTree.find((item) => String(item.handle) === reactFlowNode.id);
      if (sceneNode && onNodeSelect) {
        onNodeSelect(sceneNode);
        Logger.debug('Node selected in outliner:', sceneNode.name);
      }
    }
  }, [contextMenuNodeId, nodes, sceneTree, onNodeSelect]);



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
    return (
      <div className="node-graph-empty">
      </div>
    );
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
          selectedNodeCount={nodes.filter((n) => n.selected).length}
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
        style={{ background: '#454545' }}
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
          nodeColor={(node) => {
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
          maskColor='rgba(70, 68, 50, 0.6)'
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
  onRecenterViewReady
}: NodeGraphEditorProps) {
  return (
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
  );
});

// Re-export related components for external use
export { OctaneNode } from './OctaneNode';
export type { OctaneNodeData } from './OctaneNode';
