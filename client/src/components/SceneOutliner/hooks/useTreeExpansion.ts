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
import { VirtualTreeRowProps } from '../VirtualTreeRow';

interface UseTreeExpansionProps {
  sceneTree: SceneNode[];
  selectedNode?: SceneNode | null;
  onNodeSelect?: (node: SceneNode | null) => void;
  onNodeContextMenu: (node: SceneNode, event: React.MouseEvent) => void;
}

/** Wraps children in the synthetic Scene root node used by tree utilities. */
const makeSyntheticRoot = (children: SceneNode[]): SceneNode[] => [
  { handle: -1, name: 'Scene', type: 'SceneRoot', typeEnum: 0, children },
];

export function useTreeExpansion({
  sceneTree,
  selectedNode,
  onNodeSelect,
  onNodeContextMenu,
}: UseTreeExpansionProps) {
  // Pre-seed the expansion map with the Scene root expanded so level-1 nodes
  // are visible as soon as they arrive via scene:nodeAdded events. The full
  // expansion (including PT_RENDERTARGET) is initialized later by
  // handleLevel0Complete → initializeExpansion().
  const [expansionMap, setExpansionMap] = useState<Map<string, boolean>>(() => {
    const map = new Map<string, boolean>();
    map.set('-1', true); // Scene root (synthetic handle)
    return map;
  });

  // Toggle node expansion.
  const handleToggleExpansion = useCallback((nodeKey: string) => {
    setExpansionMap(prevMap => toggleExpansion(prevMap, nodeKey));
  }, []);

  // Expand all nodes
  const handleExpandAll = useCallback(() => {
    if (!sceneTree || sceneTree.length === 0) return;
    setExpansionMap(expandAll(makeSyntheticRoot(sceneTree)));
  }, [sceneTree]);

  // Collapse all nodes
  const handleCollapseAll = useCallback(() => {
    if (!sceneTree || sceneTree.length === 0) return;
    setExpansionMap(collapseAll(makeSyntheticRoot(sceneTree)));
  }, [sceneTree]);

  // Expand specific nodes by handle (for progressive loading)
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
    setExpansionMap(initializeExpansionMap(makeSyntheticRoot(tree)));
  }, []);

  // Flatten tree for virtual scrolling
  const flattenedNodes = useMemo(() => {
    if (!sceneTree || sceneTree.length === 0) return [];
    return flattenTree(makeSyntheticRoot(sceneTree), expansionMap);
  }, [sceneTree, expansionMap]);

  // Create rowProps for react-window List
  const rowProps = useMemo<VirtualTreeRowProps>(
    () => ({
      flattenedNodes,
      selectedHandle: selectedNode?.handle ?? null,
      selectedNodeName: selectedNode?.handle == null ? (selectedNode?.name ?? null) : null,
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
