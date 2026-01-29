/**
 * Tree Flattener Utility for Virtual Scrolling
 * 
 * Converts hierarchical tree structure to flat array for react-window
 * Only includes visible nodes (respects expand/collapse state)
 */

import { SceneNode } from '../services/OctaneClient';

export interface FlattenedNode {
  node: SceneNode;
  depth: number;
  index: number;
  hasChildren: boolean;
  isExpanded: boolean;
  uniqueKey: string;
}

/**
 * Flatten a tree structure into an array for virtualization
 * Only includes visible nodes (collapsed nodes' children are excluded)
 * 
 * @param nodes - Root nodes of the tree
 * @param expandedMap - Map of node keys to expansion state
 * @param depth - Current depth (for indentation)
 * @param result - Accumulator array
 * @param parentHandle - Parent handle for generating unique keys
 */
export function flattenTree(
  nodes: SceneNode[],
  expandedMap: Map<string, boolean>,
  depth: number = 0,
  result: FlattenedNode[] = [],
  parentHandle: number | null = null
): FlattenedNode[] {
  
  nodes.forEach((node, arrayIndex) => {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    
    // Generate unique key: use handle + pin index for NO_ITEM nodes (handle=0)
    // This matches SceneOutliner's key generation logic
    const uniqueKey = node.handle !== 0 
      ? String(node.handle)
      : `${parentHandle}_pin${node.pinInfo?.ix ?? arrayIndex}`;
    
    const isExpanded = Boolean(expandedMap.get(uniqueKey));
    
    // Add this node to the flattened list
    result.push({
      node,
      depth,
      index: result.length,
      hasChildren,
      isExpanded,
      uniqueKey
    });
    
    // Recursively add children if this node is expanded
    if (isExpanded && hasChildren) {
      flattenTree(node.children!, expandedMap, depth + 1, result, node.handle);
    }
  });
  
  return result;
}

/**
 * Generate unique key for a node (matches SceneOutliner logic)
 */
export function getNodeKey(node: SceneNode, parentHandle: number | null = null, arrayIndex: number = 0): string {
  return node.handle !== 0 
    ? String(node.handle)
    : `${parentHandle}_pin${node.pinInfo?.ix ?? arrayIndex}`;
}

/**
 * Initialize expansion map with default expanded nodes
 * Scene root and Render targets are expanded by default
 */
export function initializeExpansionMap(nodes: SceneNode[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  
  function traverse(nodes: SceneNode[], parentHandle: number | null = null) {
    nodes.forEach((node, index) => {
      const uniqueKey = getNodeKey(node, parentHandle, index);
      
      // Scene root and Render target start expanded by default
      if (node.type === 'SceneRoot' || node.type === 'PT_RENDERTARGET') {
        map.set(uniqueKey, true);
      }
      
      // Recursively initialize children
      if (node.children && node.children.length > 0) {
        traverse(node.children, node.handle);
      }
    });
  }
  
  traverse(nodes);
  return map;
}

/**
 * Toggle expansion state for a node
 */
export function toggleExpansion(
  expandedMap: Map<string, boolean>,
  nodeKey: string
): Map<string, boolean> {
  const newMap = new Map(expandedMap);
  const currentState = newMap.get(nodeKey) || false;
  newMap.set(nodeKey, !currentState);
  return newMap;
}

/**
 * Expand all nodes in the tree
 */
export function expandAll(nodes: SceneNode[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  
  function traverse(nodes: SceneNode[], parentHandle: number | null = null) {
    nodes.forEach((node, index) => {
      const uniqueKey = getNodeKey(node, parentHandle, index);
      
      if (node.children && node.children.length > 0) {
        map.set(uniqueKey, true);
        traverse(node.children, node.handle);
      }
    });
  }
  
  traverse(nodes);
  return map;
}

/**
 * Collapse all nodes except Scene root
 */
export function collapseAll(nodes: SceneNode[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  
  function traverse(nodes: SceneNode[], parentHandle: number | null = null) {
    nodes.forEach((node, index) => {
      const uniqueKey = getNodeKey(node, parentHandle, index);
      
      // Keep Scene root expanded
      if (node.type === 'SceneRoot') {
        map.set(uniqueKey, true);
      } else {
        map.set(uniqueKey, false);
      }
      
      // Recursively collapse children
      if (node.children && node.children.length > 0) {
        traverse(node.children, node.handle);
      }
    });
  }
  
  traverse(nodes);
  return map;
}
