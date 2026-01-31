/**
 * Virtual Tree Row Component
 * Renders a single row in the virtualized scene tree
 *
 * Performance:
 * - Memoized with React.memo to prevent unnecessary re-renders
 * - Custom comparison for index and flatNode changes only
 */

import React, { memo } from 'react';
import { SceneNode } from '../../services/OctaneClient';
import { getIconForType } from '../../constants/PinTypes';
import { FlattenedNode } from '../../utils/TreeFlattener';

/**
 * Get icon path for a scene node
 */
export const getNodeIcon = (node: SceneNode): string => {
  // Special case: Scene root
  if (node.type === 'SceneRoot' || node.name === 'Scene') {
    return '/icons/SCENE node.png';
  }

  // Use getIconForType for consistent icon mapping
  const outType = String(node.type || node.outType || 'unknown');
  return getIconForType(outType, node.name);
};

/**
 * Props passed to VirtualTreeRow via rowProps
 */
export interface VirtualTreeRowProps {
  flattenedNodes: FlattenedNode[];
  selectedHandle: number | null;
  onSelect: (node: SceneNode) => void;
  onContextMenu: (node: SceneNode, event: React.MouseEvent) => void;
  onToggle: (nodeKey: string) => void;
}

/**
 * Virtual Tree Row Component (internal)
 * React-window v2 rowComponent receives built-in props + custom props from rowProps
 */
function VirtualTreeRowComponent(
  props: {
    ariaAttributes: {
      'aria-posinset': number;
      'aria-setsize': number;
      role: 'listitem';
    };
    index: number;
    style: React.CSSProperties;
  } & VirtualTreeRowProps
): React.ReactElement | null {
  const { index, style, flattenedNodes, selectedHandle, onSelect, onContextMenu, onToggle } = props;
  const flatNode = flattenedNodes[index];

  if (!flatNode) return null;

  const { node, depth, hasChildren, isExpanded, uniqueKey } = flatNode;
  const isSelected = selectedHandle === node.handle;

  return (
    <div
      style={style}
      className={`tree-node level-${depth} ${isSelected ? 'selected' : ''}`}
      data-handle={node.handle}
      role="button"
      tabIndex={0}
      onClick={() => {
        // Don't select the synthetic Scene root
        if (node.type !== 'SceneRoot') {
          onSelect(node);
        }
      }}
      onKeyDown={e => {
        if ((e.key === 'Enter' || e.key === ' ') && node.type !== 'SceneRoot') {
          e.preventDefault();
          onSelect(node);
        }
      }}
      onContextMenu={e => {
        // Don't show context menu for synthetic Scene root
        if (node.type !== 'SceneRoot') {
          onContextMenu(node, e);
        }
      }}
    >
      <div className="node-content">
        {hasChildren ? (
          <span
            className={`node-toggle ${isExpanded ? 'expanded' : 'collapsed'}`}
            role="button"
            tabIndex={0}
            onClick={e => {
              e.stopPropagation();
              onToggle(uniqueKey);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onToggle(uniqueKey);
              }
            }}
          >
            {isExpanded ? '−' : '+'}
          </span>
        ) : (
          <span className="node-spacer"></span>
        )}

        <img
          src={getNodeIcon(node)}
          alt=""
          className="node-icon"
          width={16}
          height={16}
          onError={e => {
            // Fallback to category icon if specific icon not found
            (e.target as HTMLImageElement).src = '/icons/EMPTY.png';
          }}
        />
        <span className="node-name">{node.name}</span>
      </div>
    </div>
  );
}

/**
 * Custom comparison function for React.memo
 * VirtualTreeRow should only re-render when index or the flatNode data changes
 */
function arePropsEqual(
  prevProps: {
    index: number;
    style: React.CSSProperties;
  } & VirtualTreeRowProps,
  nextProps: {
    index: number;
    style: React.CSSProperties;
  } & VirtualTreeRowProps
): boolean {
  // If index changed, different row - must re-render
  if (prevProps.index !== nextProps.index) {
    return false;
  }

  // If style changed (position/size), must re-render
  if (prevProps.style !== nextProps.style) {
    return false;
  }

  // Compare the flatNode at this index
  const prevNode = prevProps.flattenedNodes[prevProps.index];
  const nextNode = nextProps.flattenedNodes[nextProps.index];

  // If either is missing, re-render
  if (!prevNode || !nextNode) {
    return prevNode === nextNode;
  }

  // Compare critical flatNode properties
  if (
    prevNode.node.handle !== nextNode.node.handle ||
    prevNode.depth !== nextNode.depth ||
    prevNode.hasChildren !== nextNode.hasChildren ||
    prevNode.isExpanded !== nextNode.isExpanded ||
    prevNode.node.name !== nextNode.node.name
  ) {
    return false;
  }

  // Compare selection state
  if (prevProps.selectedHandle !== nextProps.selectedHandle) {
    // Only re-render if this row is selected or was selected
    const isAffected =
      prevProps.selectedHandle === prevNode.node.handle ||
      nextProps.selectedHandle === nextNode.node.handle;
    if (isAffected) {
      return false;
    }
  }

  // Props are equal, skip re-render
  return true;
}

/**
 * Memoized VirtualTreeRow component
 * Only re-renders when index or flatNode data actually changes
 */
export const VirtualTreeRow = memo(
  VirtualTreeRowComponent,
  arePropsEqual
) as typeof VirtualTreeRowComponent;
