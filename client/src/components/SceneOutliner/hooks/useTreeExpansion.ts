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

export function useTreeExpansion({
  sceneTree,
  selectedNode,
  onNodeSelect,
  onNodeContextMenu,
}: UseTreeExpansionProps) {
  const [expansionMap, setExpansionMap] = useState<Map<string, boolean>>(new Map());

  // Toggle node expansion
  const handleToggleExpansion = useCallback((nodeKey: string) => {
    setExpansionMap(prevMap => toggleExpansion(prevMap, nodeKey));
  }, []);

  // Expand all nodes
  const handleExpandAll = useCallback(() => {
    if (sceneTree.length === 0) return;

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
    if (sceneTree.length === 0) return;

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
    if (sceneTree.length === 0) return [];

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
  };
}
