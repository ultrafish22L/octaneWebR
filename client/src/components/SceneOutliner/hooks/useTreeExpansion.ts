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
  // For progressive loading, pre-seed the expansion map with the Scene root
  // expanded so level-1 nodes are visible as soon as they arrive via
  // scene:nodeAdded events. The full expansion (including PT_RENDERTARGET)
  // is initialized later by handleLevel0Complete → initializeExpansion().
  const [expansionMap, setExpansionMap] = useState<Map<string, boolean>>(() => {
    if (FEATURES.PROGRESSIVE_LOADING_P) {
      const map = new Map<string, boolean>();
      map.set('-1', true); // Scene root (synthetic handle)
      return map;
    }
    return new Map();
  });

  // Auto-initialize expansion when sceneTree first loads (traditional loading only).
  // For progressive loading P, the Scene root is already expanded via initial state
  // above, and full expansion is set explicitly via initializeExpansion() called from
  // handleLevel0Complete, which has the full set of level-0 nodes including
  // PT_RENDERTARGET.
  const hasInitializedRef = React.useRef(false);
  React.useEffect(() => {
    if (FEATURES.PROGRESSIVE_LOADING_P) return;
    if (sceneTree.length === 0 || hasInitializedRef.current) return;

    hasInitializedRef.current = true;
    const syntheticRoot: SceneNode[] = [
      { handle: -1, name: 'Scene', type: 'SceneRoot', typeEnum: 0, children: sceneTree },
    ];
    setExpansionMap(initializeExpansionMap(syntheticRoot));
  }, [sceneTree]);

  // Toggle node expansion.
  const handleToggleExpansion = useCallback((nodeKey: string) => {
    setExpansionMap(prevMap => toggleExpansion(prevMap, nodeKey));
  }, []);

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
