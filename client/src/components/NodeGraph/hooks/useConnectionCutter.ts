/**
 * Connection Cutter Hook
 *
 * Implements the connection cutting feature from Octane SE:
 * "Cuts off multiple connections by holding down the CTRL key
 * and then click-dragging the mouse to form a line"
 *
 * @see https://docs.otoy.com/standaloneSE/StandaloneManual.htm
 *
 * Extracted from NodeGraph component (Phase 4/4 refactoring)
 */

import React, { useState, useRef, useCallback } from 'react';
import { Edge, Node } from '@xyflow/react';
import { Logger } from '../../../utils/Logger';
import { OctaneNodeData } from '../../NodeGraph/OctaneNode';
import type { OctaneClient } from '../../../services/OctaneClient';

export interface ConnectionCutterState {
  isCuttingConnections: boolean;
  cutterPath: { x: number; y: number }[];
}

export interface ConnectionCutterHandlers {
  // eslint-disable-next-line no-unused-vars
  handlePaneMouseDown: (event: React.MouseEvent) => void;
  // eslint-disable-next-line no-unused-vars
  handlePaneMouseMove: (event: React.MouseEvent) => void;
  // eslint-disable-next-line no-unused-vars
  handlePaneMouseUp: (event: React.MouseEvent) => Promise<void>;
}

export interface UseConnectionCutterReturn {
  state: ConnectionCutterState;
  handlers: ConnectionCutterHandlers;
}

/**
 * Hook to manage connection cutting functionality
 * Allows users to Ctrl+drag to cut multiple connections at once
 */
export function useConnectionCutter(
  nodes: Node[],
  edges: Edge[],
  client: OctaneClient | null
): UseConnectionCutterReturn {
  // Connection cutter state (Ctrl+drag to cut connections)
  const [isCuttingConnections, setIsCuttingConnections] = useState(false);
  const [cutterPath, setCutterPath] = useState<{ x: number; y: number }[]>([]);
  const cutterStartRef = useRef<{ x: number; y: number } | null>(null);

  /**
   * Check if a line segment intersects with an edge
   * Uses simple line-line intersection with cross product
   */
  const checkLineIntersectsEdge = useCallback(
    (
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
    },
    []
  );

  /**
   * Connection Cutter: Mouse down handler
   * Activates cutter when Ctrl/Cmd + left mouse button is pressed
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

  /**
   * Connection Cutter: Mouse move handler
   * Tracks the cutting path as user drags
   */
  const handlePaneMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (isCuttingConnections && cutterStartRef.current) {
        // Get mouse position in viewport coordinates
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Add to cutter path
        setCutterPath(prev => [...prev, { x, y }]);
      }
    },
    [isCuttingConnections]
  );

  /**
   * Connection Cutter: Mouse up handler
   * Finds and deletes all edges that intersect with the cutter path
   */
  const handlePaneMouseUp = useCallback(
    async (event: React.MouseEvent) => {
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
    },
    [isCuttingConnections, edges, nodes, client, checkLineIntersectsEdge]
  );

  return {
    state: {
      isCuttingConnections,
      cutterPath,
    },
    handlers: {
      handlePaneMouseDown,
      handlePaneMouseMove,
      handlePaneMouseUp,
    },
  };
}
