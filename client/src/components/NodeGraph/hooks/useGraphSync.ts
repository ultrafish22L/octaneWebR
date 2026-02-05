/**
 * useGraphSync Hook
 * Manages synchronization between Octane scene tree and ReactFlow graph
 *
 * Responsibilities:
 * - Convert scene tree to ReactFlow nodes/edges
 * - Handle incremental node additions/deletions
 * - Sync node selection from external sources (SceneOutliner)
 * - Manage initial fitView behavior
 */

import { useCallback, useEffect, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';
import { SceneNode, NodeAddedEvent, NodeDeletedEvent } from '../../../services/OctaneClient';
import { useOctane } from '../../../hooks/useOctane';
import { OctaneNodeData } from '../OctaneNode';
import { getPinColor } from '../../../utils/PinColorUtils';
import { Logger } from '../../../utils/Logger';

interface UseGraphSyncProps {
  sceneTree: SceneNode[];
  selectedNode?: SceneNode | null;
  setNodes: React.Dispatch<React.SetStateAction<Node<OctaneNodeData>[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  nodes: Node<OctaneNodeData>[];
  fitView: (options?: any) => void;
  handleNodeContextMenu: (event: React.MouseEvent, nodeId: string) => void;
}

export function useGraphSync({
  sceneTree,
  selectedNode,
  setNodes,
  setEdges,
  nodes,
  fitView,
  handleNodeContextMenu,
}: UseGraphSyncProps) {
  const { client, connected } = useOctane();
  const hasInitialFitView = useRef(false);

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
            onContextMenu: (event: React.MouseEvent, nodeId: string) =>
              handleNodeContextMenu(event, nodeId),
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
  );

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
    setNodes(currentNodes => {
      Logger.debug(
        `📊 NodeGraphEditor: currentNodes=${currentNodes.length}, sceneTree=${sceneTree.length}`
      );

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
      Logger.debug(
        `📊 NodeGraphEditor: Rebuilt graph with ${graphNodes.length} nodes, ${graphEdges.length} edges`
      );
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
          output: {
            id: 'output-0',
            label: event.node.name,
            pinInfo: event.node.pinInfo,
          },
          onContextMenu: (evt: React.MouseEvent, nId: string) => handleNodeContextMenu(evt, nId),
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
  }, [client, connected, sceneTree, setNodes, handleNodeContextMenu]);

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
}
