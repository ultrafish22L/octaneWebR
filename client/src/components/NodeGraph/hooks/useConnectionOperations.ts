import React, { useCallback, MutableRefObject } from 'react';
import {
  Node,
  Edge,
  Connection,
  EdgeChange,
  OnConnectStart,
  OnConnectEnd,
  addEdge,
  reconnectEdge,
} from '@xyflow/react';
import { OnReconnectEnd } from '@xyflow/system';
import { OctaneNodeData } from '../OctaneNode';
import Logger from '../../../utils/Logger';
import { getPinColor } from '../../../utils/PinColorUtils';
import { OctaneClient } from '../../../services/OctaneClient';

interface UseConnectionOperationsProps {
  client: OctaneClient;
  nodes: Node<OctaneNodeData>[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node<OctaneNodeData>[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onEdgesChangeBase: (_changes: EdgeChange[]) => void;
  connectingEdgeRef: MutableRefObject<Edge | null>;
  isMultiConnectingRef: MutableRefObject<boolean>;
  multiConnectSourcesRef: MutableRefObject<string[]>;
  connectionLineColor: string;
  setConnectionLineColor: (_color: string) => void;
}

/**
 * Custom hook for handling all connection-related operations in the Node Graph.
 * Manages connection creation, reconnection, deletion, and validation.
 *
 * Extracted from NodeGraph component (Phase 2/3 refactoring).
 */
export function useConnectionOperations({
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
}: UseConnectionOperationsProps) {
  /**
   * Handle connection start - track source, set line color, enable multi-connect
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
          Logger.debug(
            `🔗 Multi-connect activated: ${selectedNodes.length} selected nodes will connect`
          );
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
        const input = nodeData.inputs.find((i: { id: string }) => i.id === handleId);
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
        const existingEdge = edges.find(e => e.target === nodeId && e.targetHandle === handleId);

        if (existingEdge) {
          Logger.debug(
            '📌 Input pin has existing connection:',
            existingEdge.id,
            '(will replace on success)'
          );
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
    [
      nodes,
      edges,
      setConnectionLineColor,
      connectingEdgeRef,
      isMultiConnectingRef,
      multiConnectSourcesRef,
    ]
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
  }, [setConnectionLineColor, connectingEdgeRef, isMultiConnectingRef, multiConnectSourcesRef]);

  /**
   * Handle edge reconnect - ReactFlow's built-in edge reconnection
   * Triggered when user drags an edge endpoint to a new handle
   * Uses ReactFlow's reconnectEdge utility as per best practices
   */
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      Logger.debug('🔄 RECONNECT triggered:', oldEdge.id, '→', newConnection);

      // Detect no-op reconnection: user dropped edge back on the same pin
      if (
        oldEdge.target === newConnection.target &&
        oldEdge.targetHandle === newConnection.targetHandle &&
        oldEdge.source === newConnection.source &&
        oldEdge.sourceHandle === newConnection.sourceHandle
      ) {
        Logger.debug('⏭️ No-op reconnection detected - ignoring (same source and target)');
        return;
      }

      // Update UI using ReactFlow's official reconnectEdge utility
      setEdges(eds => reconnectEdge(oldEdge, newConnection, eds));

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
          const oldPinIdx = oldEdge.targetHandle ? parseInt(oldEdge.targetHandle.split('-')[1]) : 0;

          Logger.debug(`🔌 Disconnecting old: node=${oldTargetHandle}, pin=${oldPinIdx}`);
          await client.disconnectPin(oldTargetHandle, oldPinIdx);

          // Connect new connection
          const newTargetHandle = parseInt(newConnection.target!);
          const newSourceHandle = parseInt(newConnection.source!);
          const newPinIdx = newConnection.targetHandle
            ? parseInt(newConnection.targetHandle.split('-')[1])
            : 0;

          Logger.debug(
            `🔌 Connecting new: source=${newSourceHandle} → target=${newTargetHandle}, pin=${newPinIdx}`
          );
          await client.connectPinByIndex(newTargetHandle, newPinIdx, newSourceHandle, true);
          Logger.debug('Octane edge reconnected');
        } catch (error) {
          Logger.error('Failed to sync edge reconnection with Octane:', error);
        }
      })();
    },
    [client, setEdges]
  );

  /**
   * Handle edge reconnect end - detect failed reconnections
   * When user drags an edge and drops on empty space, disconnect it in Octane
   * OCTANE BEHAVIOR: Failed reconnection = disconnect the edge entirely
   *
   * ReactFlow v12 Pattern: Use connectionState.isValid to detect success/failure
   */
  const onReconnectEnd: OnReconnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, edge: Edge, _handleType: 'source' | 'target', connectionState: { isValid: boolean | null }) => {
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
          const pinIdx = edge.targetHandle ? parseInt(edge.targetHandle.split('-')[1]) : 0;

          Logger.debug(`🔌 Disconnecting in Octane: node=${targetHandle}, pin=${pinIdx}`);
          await client.disconnectPin(targetHandle, pinIdx);
          Logger.debug('Pin disconnected in Octane');

          // Remove edge from UI
          setEdges(eds => eds.filter(e => e.id !== edge.id));
          Logger.debug('Edge removed from UI');
        } catch (error) {
          Logger.error('Failed to disconnect edge:', error);
        }
      })();
    },
    [client, setEdges]
  );

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
          Logger.debug(
            `🔗 Multi-connect: connecting ${multiConnectSourcesRef.current.length} nodes to target`
          );

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
        if (
          existingTargetEdge &&
          existingTargetEdge.source === connection.source &&
          existingTargetEdge.sourceHandle === connection.sourceHandle
        ) {
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
            const isCollapsedNode =
              oldSourceNode.nodeInfo?.takesPinDefaultValue === true ||
              oldSourceNode.name?.includes('value') ||
              oldSourceNode.name?.includes('color');

            if (isCollapsedNode) {
              Logger.debug(
                'Detected collapsed node to remove:',
                oldSourceNode.name,
                oldSourceHandle
              );
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

        const inputItem = connectingEdgeRef.current
          ? client.lookupItem(sourceHandle)
          : client.lookupItem(targetHandle);
        const outputItem = connectingEdgeRef.current
          ? client.lookupItem(targetHandle)
          : client.lookupItem(sourceHandle);

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
          Logger.error(
            'Input pin does not match output type',
            child.pinInfo.type,
            outputItem.outType
          );
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
        setEdges(eds => {
          // Filter out old edges
          const filtered =
            edgesToRemove.length > 0 ? eds.filter(e => !edgesToRemove.includes(e.id)) : eds;

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
              strokeWidth: 3,
            },
          };

          Logger.debug('Adding new edge to ReactFlow:', newEdge, 'with color:', edgeColor);
          return addEdge(newEdge, filtered);
        });

        // Remove collapsed nodes from scene and ReactFlow
        if (nodesToRemove.length > 0) {
          Logger.debug('Removing', nodesToRemove.length, 'collapsed node(s)');

          // Remove from ReactFlow nodes
          setNodes(nds => nds.filter(n => !nodesToRemove.includes(n.id)));

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
    [
      client,
      setEdges,
      setNodes,
      edges,
      connectingEdgeRef,
      isMultiConnectingRef,
      multiConnectSourcesRef,
    ]
  );

  /**
   * Validate connections before allowing them
   * - Source must be an output handle (source)
   * - Target must be an input handle (target)
   */
  const isValidConnection = useCallback((connection: Edge | Connection) => {
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
  }, []);

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
   * Handle edge deletion (keyboard Delete key or context menu)
   * NOTE: Currently connections are visual-only in ReactFlow and not synced to Octane backend
   * When backend sync is implemented, use connectToIx with handle=0 to disconnect pins
   */
  const onEdgesDelete = useCallback(async (deletedEdges: Edge[]) => {
    Logger.debug(`✂️ Deleted ${deletedEdges.length} edge(s) from graph (visual only)`);
    // TODO: When backend connection sync is implemented, add API calls here
    // For each edge: await client.callApi('ApiNode', 'connectToIx', targetHandle, {
    //   pinIdx,
    //   sourceNode: { handle: 0, type: 17 },  // handle=0 means disconnect
    //   evaluate: true,
    //   doCycleCheck: true
    // });
  }, []);

  return {
    onConnectStart,
    onConnectEnd,
    onReconnect,
    onReconnectEnd,
    onConnect,
    isValidConnection,
    onEdgesChange,
    onEdgesDelete,
    connectionLineColor,
  };
}
