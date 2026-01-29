/**
 * Virtual Tree Row Component
 * Renders a single row in the virtualized scene tree
 */

import React from 'react';
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
 * Virtual Tree Row Component
 * React-window v2 rowComponent receives built-in props + custom props from rowProps
 */
export function VirtualTreeRow(props: {
  ariaAttributes: {
    "aria-posinset": number;
    "aria-setsize": number;
    role: "listitem";
  };
  index: number;
  style: React.CSSProperties;
} & VirtualTreeRowProps): React.ReactElement | null {
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
      onClick={() => {
        // Don't select the synthetic Scene root
        if (node.type !== 'SceneRoot') {
          onSelect(node);
        }
      }}
      onContextMenu={(e) => {
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
            onClick={(e) => {
              e.stopPropagation();
              onToggle(uniqueKey);
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
          onError={(e) => {
            // Fallback to category icon if specific icon not found
            (e.target as HTMLImageElement).src = '/icons/EMPTY.png';
          }}
        />
        <span className="node-name">{node.name}</span>
      </div>
    </div>
  );
}
