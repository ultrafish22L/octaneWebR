/**
 * useTreeExpansion - Tree expansion state management for virtual scrolling
 * Handles expansion/collapse of tree nodes with optimized rendering
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  flattenTree,
  initializeExpansionMap,
  toggleExpansion,
  expandAll,
  collapseAll,
} from '../../../utils/TreeFlattener';
import { SceneNode } from '../../../services/OctaneClient';
import { useOctane } from '../../../hooks/useOctane';
import { FEATURES } from '../../../config/features';
import { VirtualTreeRowProps } from '../VirtualTreeRow';

interface UseTreeExpansionProps {
  sceneTree: SceneNode[];
  selectedNode?: SceneNode | null;
  onNodeSelect?: (node: SceneNode | null) => void;
  onNodeContextMenu: (node: SceneNode, event: React.MouseEvent) => void;
}

export function useTreeExpansion({
  sceneTree,
  selectedNode,
  onNodeSelect,
  onNodeContextMenu,
}: UseTreeExpansionProps) {
  const { client } = useOctane();
  const [expansionMap, setExpansionMap] = useState<Map<string, boolean>>(new Map());

  // Auto-initialize expansion when sceneTree first loads (traditional loading only).
  // For V3 progressive loading, expansion is initialized explicitly via
  // initializeExpansion() called from handleLevel0Complete, which has the full
  // set of level-0 nodes including PT_RENDERTARGET. The auto-init useEffect
  // must NOT run for V3 because it fires too early (on the first node added),
  // before the RenderTarget has arrived in the tree.
  const hasInitializedRef = React.useRef(false);
  React.useEffect(() => {
    if (FEATURES.PROGRESSIVE_LOADING_V3) return; // V3 uses explicit initializeExpansion
    if (sceneTree.length === 0 || hasInitializedRef.current) return;

    hasInitializedRef.current = true;
    const syntheticRoot: SceneNode[] = [
      { handle: -1, name: 'Scene', type: 'SceneRoot', typeEnum: 0, children: sceneTree },
    ];
    setExpansionMap(initializeExpansionMap(syntheticRoot));
  }, [sceneTree]);

  // Toggle node expansion.
  // When expanding, promote the node in the V3 deep-load queue so its children
  // load sooner if they haven't been fetched yet (Pass 2).
  const handleToggleExpansion = useCallback((nodeKey: string) => {
    setExpansionMap(prevMap => {
      const wasExpanded = prevMap.get(nodeKey) || false;
      if (!wasExpanded && FEATURES.PROGRESSIVE_LOADING_V3 && client) {
        const handle = Number(nodeKey);
        if (!isNaN(handle) && handle > 0) {
          client.promoteNode(handle);
        }
      }
      return toggleExpansion(prevMap, nodeKey);
    });
  }, [client]);

  // Expand all nodes
  const handleExpandAll = useCallback(() => {
    if (!sceneTree || sceneTree.length === 0) return;

    const syntheticRoot: SceneNode[] = [
      {
        handle: -1,
        name: 'Scene',
        type: 'SceneRoot',
        typeEnum: 0,
        children: sceneTree,
      },
    ];

    setExpansionMap(expandAll(syntheticRoot));
  }, [sceneTree]);

  // Collapse all nodes
  const handleCollapseAll = useCallback(() => {
    if (!sceneTree || sceneTree.length === 0) return;

    const syntheticRoot: SceneNode[] = [
      {
        handle: -1,
        name: 'Scene',
        type: 'SceneRoot',
        typeEnum: 0,
        children: sceneTree,
      },
    ];

    setExpansionMap(collapseAll(syntheticRoot));
  }, [sceneTree]);

  // 🎯 NEW: Expand specific nodes by handle (for progressive loading)
  const expandNodes = useCallback((handles: number[]) => {
    setExpansionMap(prevMap => {
      const newMap = new Map(prevMap);
      handles.forEach(handle => {
        const key = `${handle}`;
        newMap.set(key, true);
      });
      return newMap;
    });
  }, []);

  // Initialize expansion map when scene tree changes
  const initializeExpansion = useCallback((tree: SceneNode[]) => {
    const syntheticRoot: SceneNode[] = [
      {
        handle: -1,
        name: 'Scene',
        type: 'SceneRoot',
        typeEnum: 0,
        children: tree,
      },
    ];
    setExpansionMap(initializeExpansionMap(syntheticRoot));
  }, []);

  // Flatten tree for virtual scrolling
  const flattenedNodes = useMemo(() => {
    if (!sceneTree || sceneTree.length === 0) return [];

    const syntheticRoot: SceneNode[] = [
      {
        handle: -1,
        name: 'Scene',
        type: 'SceneRoot',
        typeEnum: 0,
        children: sceneTree,
      },
    ];

    return flattenTree(syntheticRoot, expansionMap);
  }, [sceneTree, expansionMap]);

  // Create rowProps for react-window List
  const rowProps = useMemo<VirtualTreeRowProps>(
    () => ({
      flattenedNodes,
      selectedHandle: selectedNode?.handle || null,
      onSelect: onNodeSelect || (() => {}),
      onContextMenu: onNodeContextMenu,
      onToggle: handleToggleExpansion,
    }),
    [flattenedNodes, selectedNode, onNodeSelect, onNodeContextMenu, handleToggleExpansion]
  );

  return {
    expansionMap,
    flattenedNodes,
    rowProps,
    handleToggleExpansion,
    handleExpandAll,
    handleCollapseAll,
    initializeExpansion,
    expandNodes,
  };
}
