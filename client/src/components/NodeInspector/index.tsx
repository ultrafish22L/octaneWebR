/**
 * Node Inspector Component (React TypeScript)
 * Professional parameter editing interface matching Octane Render Studio exactly
 *
 * This component replicates the exact layout and styling from the reference screenshot:
 * - Compact parameter rows with proper spacing
 * - Blue parameter icons on the left
 * - Parameter names in the center
 * - Input controls on the right (numbers with spinners, checkboxes, color bars)
 * - Proper grouping with collapsible sections
 * - Professional dark theme matching Octane Studio
 */

import { Logger } from '../../utils/Logger';
import React, { useState, useMemo } from 'react';
import { SceneNode } from '../../services/OctaneClient';
import { useOctane } from '../../hooks/useOctane';
import { getIconForType, getCompatibleNodeTypes } from '../../constants/PinTypes';
import { getNodeTypeInfo } from '../../constants/NodeTypes';
import { formatNodeColor } from '../../utils/ColorUtils';
import { NodeInspectorContextMenu } from './NodeInspectorContextMenu';
import { EditCommands } from '../../commands/EditCommands';
import { getPinTypeInfo } from '../../constants/PinTypes';
import { useParameterValue } from './hooks/useParameterValue';
import { ParameterControl } from './ParameterControl';
import { GeometryToolbar } from './GeometryToolbar';

interface NodeInspectorProps {
  node: SceneNode | null;
}

// Parameter group display component
function ParameterGroup({
  groupName,
  children,
  defaultExpanded = true,
}: {
  groupName: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleClick = () => setExpanded(!expanded);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpanded(!expanded);
    }
  };

  return (
    <div className="inspector-group-indent">
      <div
        className={`inspector-group-header ${expanded ? 'expanded' : 'collapsed'}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
      >
        <span className="inspector-group-icon">{expanded ? '▼' : '▶'}</span>
        <span className="inspector-group-label">{groupName}</span>
      </div>
      <div className="inspector-group-content" style={{ display: expanded ? 'block' : 'none' }}>
        {children}
      </div>
    </div>
  );
}

// Node parameter item component
function NodeParameter({
  node,
  level,
  onToggle,
  hasGroupMap,
}: {
  node: SceneNode;
  level: number;
  onToggle: (_: string) => void;
  hasGroupMap: Map<number, boolean>;
}) {
  const { client } = useOctane();
  const [expanded, setExpanded] = useState(level < 2);

  const hasChildren = node.children && node.children.length > 0;
  const isEndNode = !hasChildren && !!node.attrInfo;

  // Use parameter value management hook
  const { paramValue, handleValueChange } = useParameterValue(node, client, isEndNode);
  const nodeId = `node-${node.handle}`;
  const typeStr = String(node.type || node.outType || 'unknown');
  const icon = node.icon || getIconForType(typeStr, node.name);
  const name = node.pinInfo?.staticLabel || node.name;
  let color = node.nodeInfo?.nodeColor ? formatNodeColor(node.nodeInfo.nodeColor) : '#666';
  if (node.pinInfo) {
    const info = getPinTypeInfo(node.pinInfo.type as string);
    if (info) {
      color = info.color;
    }
  }
  // Determine if we should show dropdown (non-end nodes with a valid pin type)
  // Show dropdown for any non-end node (nodes with children, not value attributes)
  const pinType = typeStr.startsWith('PT_') ? typeStr : null;
  const compatibleNodeTypes = pinType ? getCompatibleNodeTypes(pinType) : [];
  const showDropdown = !isEndNode && compatibleNodeTypes.length > 0;

  // Get current node type (for nodes, not pins)
  const currentNodeType = node.nodeInfo?.type || '';

  // Handler for node type change
  const handleNodeTypeChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newNodeType = event.target.value;
    if (!node.handle || !newNodeType || newNodeType === currentNodeType) {
      return;
    }

    Logger.debug(`🔄 Replacing node ${node.handle} (${currentNodeType}) with ${newNodeType}`);

    try {
      // Call API to replace node
      await client.replaceNode(node.handle, newNodeType);
      Logger.debug(`✅ Node replaced successfully`);
    } catch (error) {
      Logger.error('❌ Failed to replace node:', error);
      // Note: Consider implementing a proper toast/notification system

      console.error('Node replacement failed:', error);
    }
  };

  const handleToggle = () => {
    setExpanded(!expanded);
    onToggle(nodeId);
  };

  const handleToggleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  // Determine the indent class (matching GenericNodeRenderer logic exactly)
  // octaneWeb logic: if ANY group exists at this level, ALL items at this level use node-indent-done
  // This is the hasGroup[level] logic from octaneWeb
  const hasGroupAtLevel = hasGroupMap.get(level) || false;
  const indentClass =
    level === 0 ? 'node-indent-0' : hasGroupAtLevel ? 'node-indent-done' : 'node-indent';

  // Determine collapse/expand icon
  const collapseIcon = hasChildren && level > 0 ? (expanded ? '▼' : '▶') : '';

  // Build tooltip with detailed description
  const buildTooltip = () => {
    // Priority: pinInfo.description > attrInfo.description > nodeInfo.description
    const description =
      node.pinInfo?.description || node.attrInfo?.description || node.nodeInfo?.description;
    return description || name;
  };

  // Render as parameter node (end node with attrInfo)
  if (node.attrInfo) {
    return (
      <div className={indentClass} style={{ display: 'block' }}>
        <div className="node-box-parameter" data-node-handle={node.handle} data-node-id={nodeId}>
          <div className="node-icon-box" style={{ backgroundColor: color }}>
            <img
              src={icon}
              alt=""
              className="node-icon"
              width={20}
              height={20}
              onError={e => {
                (e.target as HTMLImageElement).src = '/icons/EMPTY.png';
              }}
            />
          </div>
          <div className="node-content">
            <div
              className="node-label"
              onClick={hasChildren ? handleToggle : undefined}
              onKeyDown={hasChildren ? handleToggleKeyDown : undefined}
              role={hasChildren ? 'button' : undefined}
              tabIndex={hasChildren ? 0 : undefined}
            >
              <div className="node-label-text">
                {collapseIcon && <span className="collapse-icon">{collapseIcon}</span>}
                <span className="node-title" title={buildTooltip()}>{name}:</span>
              </div>
              <ParameterControl
                node={node}
                paramValue={paramValue}
                onValueChange={handleValueChange}
              />
            </div>
          </div>
        </div>
        {hasChildren && (
          <div
            className="node-toggle-content"
            data-toggle-content={nodeId}
            style={{ display: expanded ? 'block' : 'none' }}
          >
            {node.children!.map((child, childIdx) => (
              <NodeParameter
                key={`${child.handle}-${childIdx}`}
                node={child}
                level={level + 1}
                onToggle={onToggle}
                hasGroupMap={hasGroupMap}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Check if this is a geometry node that should show the geometry toolbar
  const isGeometryNode = currentNodeType.startsWith('NT_GEO_MESH') || 
                         currentNodeType.startsWith('NT_GEO_OBJECT') ||
                         currentNodeType.startsWith('NT_GEO_PLANE') ||
                         currentNodeType.startsWith('NT_GEO_SCATTER') ||
                         currentNodeType === 'NT_GEO_MESH';

  // Render as node group (non-parameter nodes)
  return (
    <div className={indentClass} style={{ display: 'block' }}>
      <div className="node-box" data-node-handle={node.handle} data-node-id={nodeId}>
        <div className="node-icon-box" style={{ backgroundColor: color }}>
          <img
            src={icon}
            alt=""
            className="node-icon"
            width={20}
            height={20}
            onError={e => {
              (e.target as HTMLImageElement).src = '/icons/EMPTY.png';
            }}
          />
        </div>
        <div className="node-content">
          <div
            className="node-label"
            onClick={hasChildren ? handleToggle : undefined}
            onKeyDown={hasChildren ? handleToggleKeyDown : undefined}
            role={hasChildren ? 'button' : undefined}
            tabIndex={hasChildren ? 0 : undefined}
          >
            <div className="node-label-text">
              {collapseIcon && <span className="collapse-icon">{collapseIcon}</span>}
              <span className="node-title" title={buildTooltip()}>
                {name}:
              </span>
            </div>
            {showDropdown && (
              <div
                className="inspector-dropdown-inline"
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                  }
                }}
                role="presentation"
              >
                <select
                  className="inspector-target-select"
                  name="inspector-target-select"
                  autoComplete="off"
                  value={currentNodeType}
                  onChange={handleNodeTypeChange}
                  onClick={e => e.stopPropagation()}
                >
                  {compatibleNodeTypes.map(nodeType => {
                    const nodeTypeInfo = getNodeTypeInfo(nodeType);
                    const displayName =
                      nodeTypeInfo?.name || nodeType.replace('NT_', '').replace(/_/g, ' ');
                    return (
                      <option key={nodeType} value={nodeType}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Geometry Toolbar - Show for mesh/geometry nodes */}
      {isGeometryNode && <GeometryToolbar node={node} />}
      
      {hasChildren && (
        <div
          className="node-toggle-content"
          data-toggle-content={nodeId}
          style={{ display: expanded ? 'block' : 'none' }}
        >
          {groupChildren(node.children!).map(({ groupName, children }, idx, arr) => {
            // Check if ANY child at this level has a group (matching octaneWeb's hasGroup[level] logic)
            const hasGroups = hasGroupMap.get(level + 1) || false;
            // Check if previous item had a groupName (octaneWeb's lgroup logic)
            const prevGroupName = idx > 0 ? arr[idx - 1].groupName : null;

            if (groupName) {
              return (
                <ParameterGroup key={`group-${groupName}-${idx}`} groupName={groupName}>
                  {children.map((child, childIdx) => (
                    <NodeParameter
                      key={`${child.handle}-${childIdx}`}
                      node={child}
                      level={level + 1}
                      onToggle={onToggle}
                      hasGroupMap={hasGroupMap}
                    />
                  ))}
                </ParameterGroup>
              );
            } else {
              // octaneWeb logic: ALL non-grouped items need .inspector-group-indent wrapper when hasGroups is true
              // - Items BEFORE first group: wrap WITHOUT empty header (no gap, but still indented)
              // - Items AFTER a group: wrap WITH empty header (maintains alignment after group)
              if (hasGroups) {
                if (prevGroupName) {
                  // After a group ended - include empty header for proper spacing
                  return (
                    <div key={`nogroup-${idx}`} className="inspector-group-indent">
                      <div className="inspector-group-header">
                        <span className="inspector-group-label"> </span>
                      </div>
                      <div>
                        {children.map((child, childIdx) => (
                          <NodeParameter
                            key={`${child.handle}-${childIdx}`}
                            node={child}
                            level={level + 1}
                            onToggle={onToggle}
                            hasGroupMap={hasGroupMap}
                          />
                        ))}
                      </div>
                    </div>
                  );
                } else {
                  // Before first group - just wrapper for indentation, NO header (no gap)
                  return (
                    <div key={`nogroup-${idx}`} className="inspector-group-indent">
                      {children.map((child, childIdx) => (
                        <NodeParameter
                          key={`${child.handle}-${childIdx}`}
                          node={child}
                          level={level + 1}
                          onToggle={onToggle}
                          hasGroupMap={hasGroupMap}
                        />
                      ))}
                    </div>
                  );
                }
              } else {
                // No groups at this level - no wrapper needed
                return (
                  <React.Fragment key={`nogroup-${idx}`}>
                    {children.map((child, childIdx) => (
                      <NodeParameter
                        key={`${child.handle}-${childIdx}`}
                        node={child}
                        level={level + 1}
                        onToggle={onToggle}
                        hasGroupMap={hasGroupMap}
                      />
                    ))}
                  </React.Fragment>
                );
              }
            }
          })}
        </div>
      )}
    </div>
  );
}

// Helper: Build a map of which levels have groups (matches octaneWeb's hasGroup[] array)
// This is used to determine indentation for all nodes at each level globally
function buildHasGroupMap(node: SceneNode, level: number, map: Map<number, boolean>): void {
  if (node.children && node.children.length > 0) {
    // Check if any child at the next level has a group
    const hasGroups = node.children.some(child => child.pinInfo?.groupName != null);
    if (hasGroups) {
      map.set(level + 1, true);
    }

    // Recursively process children
    for (const child of node.children) {
      buildHasGroupMap(child, level + 1, map);
    }
  }
}

// Helper: Group children by pinInfo.groupName
function groupChildren(
  children: SceneNode[]
): Array<{ groupName: string | null; children: SceneNode[] }> {
  const groups: Array<{ groupName: string | null; children: SceneNode[] }> = [];
  let currentGroup: { groupName: string | null; children: SceneNode[] } | null = null;

  for (const child of children) {
    const groupName = child.pinInfo?.groupName || null;

    if (!currentGroup || currentGroup.groupName !== groupName) {
      currentGroup = { groupName, children: [] };
      groups.push(currentGroup);
    }

    currentGroup.children.push(child);
  }

  return groups;
}

export const NodeInspector = React.memo(function NodeInspector({ node }: NodeInspectorProps) {
  const { client } = useOctane();

  // Context menu state
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  // NOTE: Node expansion state is managed internally by NodeParameter component

  const handleToggle = (_nodeId: string) => {
    // Placeholder for future centralized expansion state management
  };

  // Context menu handler
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContextMenuVisible(true);
  };

  // Context menu action handlers
  const handleContextMenuClose = () => {
    setContextMenuVisible(false);
  };

  const handleSave = () => {
    Logger.debug('💾 Save action for node:', node?.name);
    // TODO: Implement save action
  };

  const handleCut = () => {
    Logger.debug('✂️ Cut action for node:', node?.name);
    // TODO: Implement cut action
  };

  const handleCopy = () => {
    Logger.debug('📋 Copy action for node:', node?.name);
    // TODO: Implement copy action
  };

  const handlePaste = () => {
    Logger.debug('📌 Paste action for node:', node?.name);
    // TODO: Implement paste action
  };

  const handleFillEmptyPins = () => {
    Logger.debug('📌 Fill empty pins for node:', node?.name);
    // TODO: Implement fill empty pins action
  };

  const handleDelete = async () => {
    if (!node || !client) return;

    Logger.debug('🗑️ Delete action for node:', node.name);

    // Use unified EditCommands for consistent delete behavior
    // Note: App.tsx listens to 'nodeDeleted' event and clears selection
    await EditCommands.deleteNodes({
      client,
      selectedNodes: [node],
      onComplete: () => {
        Logger.debug('✅ Delete operation completed from NodeInspector');
      },
    });
  };

  const handleExpand = () => {
    Logger.debug('📂 Expand action for node:', node?.name);
    // TODO: Implement expand all children action
  };

  const handleShowInOutliner = () => {
    Logger.debug('🔍 Show in Outliner:', node?.name);
    // TODO: Implement outliner navigation
  };

  const handleShowInGraphEditor = () => {
    Logger.debug('🔍 Show in Graph Editor:', node?.name);
    // TODO: Implement graph editor navigation
  };

  const handleShowInLuaBrowser = () => {
    Logger.debug('🔍 Show in Lua Browser:', node?.name);
    // TODO: Implement Lua browser navigation
  };

  // Build hasGroup map for all levels (matches octaneWeb's hasGroup[] array logic)
  // This ensures that all siblings at the same level have consistent indentation
  // Memoized to avoid rebuilding on every render
  // NOTE: Must be called before early return to comply with Rules of Hooks
  const hasGroupMap = useMemo(() => {
    if (!node) return new Map<number, boolean>();
    const map = new Map<number, boolean>();
    buildHasGroupMap(node, 0, map);
    return map;
  }, [node]);

  if (!node) {
    return (
      <div className="node-inspector">
        <div className="inspector-content">
          <div className="scene-loading">Click refresh to load scene</div>
        </div>
      </div>
    );
  }

  return (
    <div className="node-inspector" onContextMenu={handleContextMenu}>
      {/* Content */}
      <div className="inspector-content">
        <NodeParameter node={node} level={0} onToggle={handleToggle} hasGroupMap={hasGroupMap} />
      </div>

      {/* Context Menu */}
      {contextMenuVisible && (
        <NodeInspectorContextMenu
          x={contextMenuPosition.x}
          y={contextMenuPosition.y}
          onSave={handleSave}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onFillEmptyPins={handleFillEmptyPins}
          onDelete={handleDelete}
          onExpand={handleExpand}
          onShowInOutliner={handleShowInOutliner}
          onShowInGraphEditor={handleShowInGraphEditor}
          onShowInLuaBrowser={handleShowInLuaBrowser}
          onClose={handleContextMenuClose}
        />
      )}
    </div>
  );
});
