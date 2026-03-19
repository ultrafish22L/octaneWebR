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
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { SceneNode } from '../../services/OctaneClient';
import { useOctane } from '../../hooks/useOctane';
import { useStatusActions } from '../../contexts/StatusMessageContext';
import { getIconForType, getCompatibleNodeTypes } from '../../constants/PinTypes';
import {
  FILE_NODE_TYPES,
  MOVABLE_INPUT_TYPES,
  AttributeId,
  AttrType,
} from '../../constants/OctaneTypes';
// requestQueue imported by useParameterValue hook
import { getNodeTypeInfo } from '../../constants/NodeTypes';
import { formatNodeColor } from '../../utils/ColorUtils';
import { NodeInspectorContextMenu } from './NodeInspectorContextMenu';
import { EditCommands } from '../../commands/EditCommands';
import { getPinTypeInfo } from '../../constants/PinTypes';
import { useParameterValue } from './hooks/useParameterValue';
import { ParameterControl } from './ParameterControl';
import { FileNodeToolbar } from './FileNodeToolbar';

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

// "Add input" button for movable-input nodes
function AddInputButton({ nodeHandle }: { nodeHandle: number }) {
  const { client } = useOctane();
  const { setTemporaryStatus } = useStatusActions();

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await client.addMovableInput(nodeHandle);
      setTemporaryStatus('Input added', 2000);
    } catch {
      setTemporaryStatus('Failed to add input', 3000);
    }
  };

  return (
    <button className="movable-input-add-btn" onClick={handleAdd} title="Add input">
      Add input
    </button>
  );
}

// Per-pin action buttons (delete, move up/down) for movable input pins
function MovableInputPinActions({
  nodeHandle,
  pinIdx,
  isFirst,
  isLast,
}: {
  nodeHandle: number;
  pinIdx: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { client } = useOctane();
  const { setTemporaryStatus } = useStatusActions();
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const menuRef = useRef<HTMLSpanElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!moveMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMoveMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moveMenuOpen]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await client.deleteMovableInput(nodeHandle, pinIdx);
      setTemporaryStatus('Input deleted', 2000);
    } catch {
      setTemporaryStatus('Failed to delete input', 3000);
    }
  };

  const handleMove = async (direction: 'up' | 'down') => {
    setMoveMenuOpen(false);
    try {
      await client.moveMovableInput(nodeHandle, pinIdx, direction);
      setTemporaryStatus(`Input moved ${direction}`, 2000);
    } catch {
      setTemporaryStatus(`Failed to move input ${direction}`, 3000);
    }
  };

  return (
    <span
      className="movable-input-pin-actions"
      onClick={e => e.stopPropagation()}
      role="presentation"
    >
      <button className="movable-input-delete-btn" onClick={handleDelete} title="Delete input">
        &#x2715;
      </button>
      <span className="movable-input-move-wrapper" ref={menuRef}>
        <button
          className="movable-input-move-btn"
          onClick={e => {
            e.stopPropagation();
            setMoveMenuOpen(!moveMenuOpen);
          }}
          title="Move input"
        >
          &#x2261;
        </button>
        {moveMenuOpen && (
          <div className="movable-input-move-menu">
            <button
              className="movable-input-move-option"
              disabled={isFirst}
              onClick={() => handleMove('up')}
            >
              Move up
            </button>
            <button
              className="movable-input-move-option"
              disabled={isLast}
              onClick={() => handleMove('down')}
            >
              Move down
            </button>
          </div>
        )}
      </span>
    </span>
  );
}

// Rotation order enum labels (index → name)
const ROTATION_ORDERS = ['XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX'];

// Transform attribute definitions for building synthetic child nodes
const TRANSFORM_ATTRS = [
  {
    name: 'Rotation order',
    attrId: AttributeId.A_ROTATION_ORDER,
    type: 'AT_INT',
    attrType: AttrType.AT_INT,
    dimCount: 1,
  },
  {
    name: 'R.X',
    attrId: AttributeId.A_ROTATION,
    type: 'AT_FLOAT3',
    attrType: AttrType.AT_FLOAT3,
    dimCount: 3,
    component: 0,
  },
  {
    name: 'R.Y',
    attrId: AttributeId.A_ROTATION,
    type: 'AT_FLOAT3',
    attrType: AttrType.AT_FLOAT3,
    dimCount: 3,
    component: 1,
  },
  {
    name: 'R.Z',
    attrId: AttributeId.A_ROTATION,
    type: 'AT_FLOAT3',
    attrType: AttrType.AT_FLOAT3,
    dimCount: 3,
    component: 2,
  },
  {
    name: 'S.X',
    attrId: AttributeId.A_SCALE,
    type: 'AT_FLOAT3',
    attrType: AttrType.AT_FLOAT3,
    dimCount: 3,
    component: 0,
  },
  {
    name: 'S.Y',
    attrId: AttributeId.A_SCALE,
    type: 'AT_FLOAT3',
    attrType: AttrType.AT_FLOAT3,
    dimCount: 3,
    component: 1,
  },
  {
    name: 'S.Z',
    attrId: AttributeId.A_SCALE,
    type: 'AT_FLOAT3',
    attrType: AttrType.AT_FLOAT3,
    dimCount: 3,
    component: 2,
  },
  {
    name: 'T.X',
    attrId: AttributeId.A_TRANSLATION,
    type: 'AT_FLOAT3',
    attrType: AttrType.AT_FLOAT3,
    dimCount: 3,
    component: 0,
  },
  {
    name: 'T.Y',
    attrId: AttributeId.A_TRANSLATION,
    type: 'AT_FLOAT3',
    attrType: AttrType.AT_FLOAT3,
    dimCount: 3,
    component: 1,
  },
  {
    name: 'T.Z',
    attrId: AttributeId.A_TRANSLATION,
    type: 'AT_FLOAT3',
    attrType: AttrType.AT_FLOAT3,
    dimCount: 3,
    component: 2,
  },
] as const;

// Builds synthetic SceneNode children for NT_TRANSFORM_VALUE so they render
// through the normal NodeParameter → ParameterControl path with full styling.
function buildTransformChildren(parentHandle: number): SceneNode[] {
  return TRANSFORM_ATTRS.map((attr, idx) => {
    const isRotOrder = attr.name === 'Rotation order';
    // Synthetic node that looks like a real end-node parameter

    const node = {
      handle: parentHandle, // same handle — we override the attr ID
      name: attr.name,
      type: isRotOrder ? 'PT_ENUM' : 'PT_FLOAT',
      outType: isRotOrder ? 'PT_ENUM' : 'PT_FLOAT',
      icon: '/icons/EMPTY.png',
      children: [],
      attrInfo: {
        id: isRotOrder
          ? 'A_ROTATION_ORDER'
          : attr.name.startsWith('R.')
            ? 'A_ROTATION'
            : attr.name.startsWith('S.')
              ? 'A_SCALE'
              : 'A_TRANSLATION',
        type: isRotOrder ? 'AT_INT' : 'AT_FLOAT',
        dimCount: 1, // each row is a single value
        description: attr.name,
        // Tag with transform-specific info for the value hook to use
        _transformAttrId: attr.attrId,
        _transformAttrType: attr.attrType,
        _transformComponent: 'component' in attr ? attr.component : undefined,
      },
      // For rotation order, include enum values
      ...(isRotOrder
        ? {
            nodeInfo: {
              type: 'NT_ENUM',
              enumLabels: ROTATION_ORDERS,
            },
          }
        : {}),
      _syntheticIndex: idx,
    } as unknown as SceneNode;
    return node;
  });
}

// Single transform row — plain label on background + inline parameter control.
// Rotation Order gets a dropdown; float rows get a full NumberInput with 3D bar.
function TransformRow({ node }: { node: SceneNode }) {
  const { client } = useOctane();
  const { paramValue, handleValueChange } = useParameterValue(node, client, true);
  const isRotOrder = node.name === 'Rotation order';

  if (isRotOrder) {
    const currentIdx = typeof paramValue?.value === 'number' ? paramValue.value : 0;
    return (
      <div className="transform-row transform-row-rotorder">
        <span className="transform-label">{node.name}:</span>
        <select
          className="transform-rotorder-select"
          value={currentIdx}
          onChange={e => handleValueChange(Number(e.target.value))}
        >
          {ROTATION_ORDERS.map((label, i) => (
            <option key={label} value={i}>
              {label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Float row — render full ParameterControl for arrows, scrub, 3D bar
  return (
    <div className="transform-row">
      <span className="transform-label">{node.name}:</span>
      <div className="transform-param-bar">
        <ParameterControl node={node} paramValue={paramValue} onValueChange={handleValueChange} />
      </div>
    </div>
  );
}

// Transform Value expander — creates synthetic SceneNodes and renders them
// as plain-label rows (matching Octane's compact transform layout).
function TransformValueExpander({ nodeHandle }: { nodeHandle: number }) {
  const children = useMemo(() => buildTransformChildren(nodeHandle), [nodeHandle]);

  return (
    <>
      {children.map((child, idx) => (
        <TransformRow key={`transform-${idx}`} node={child} />
      ))}
    </>
  );
}

// Helper: detect if a child pin is a movable input pin for a given node type.
// Movable input pins have staticLabel="" and id="P_UNKNOWN" in the scene tree,
// so we can't rely on the pin name. Instead, we check if the parent is a
// movable-input node type — all children of such nodes are movable inputs.
function isMovableInputPin(child: SceneNode, nodeType: string | undefined): boolean {
  if (!nodeType) return false;
  const info = MOVABLE_INPUT_TYPES[nodeType];
  if (!info) return false;
  // All children of movable-input nodes are movable inputs.
  // Double-check via pin id string: movable pins typically have id "P_UNKNOWN".
  // pinInfo.id is typed as number but runtime returns string like "P_UNKNOWN"
  const pinId = child.pinInfo?.id;
  if (pinId != null && String(pinId) !== 'P_UNKNOWN') return false;
  return true;
}

// Renders children of a node, passing movable input context to child NodeParameters.
// Extracted to avoid IIFE-in-JSX which confuses Babel's parser.
function NodeChildrenWithMovable({
  node,
  nodeId,
  expanded,
  level,
  hasGroupMap,
}: {
  node: SceneNode;
  nodeId: string;
  expanded: boolean;
  level: number;
  hasGroupMap: Map<number, boolean>;
}) {
  const thisNodeType = node.nodeInfo?.type;
  const thisHandle = node.handle;
  const movableChildren = thisNodeType
    ? node.children!.filter(c => isMovableInputPin(c, thisNodeType))
    : [];

  const renderChild = (child: SceneNode, childIdx: number) => {
    const childIsMovable = thisNodeType ? isMovableInputPin(child, thisNodeType) : false;
    const movIdx = childIsMovable ? movableChildren.indexOf(child) : undefined;
    return (
      <NodeParameter
        key={`${child.handle}-${childIdx}`}
        node={child}
        level={level + 1}
        hasGroupMap={hasGroupMap}
        parentNodeType={thisNodeType}
        parentHandle={thisHandle}
        movablePinIndex={movIdx !== undefined && movIdx >= 0 ? movIdx : undefined}
        movablePinCount={movableChildren.length || undefined}
      />
    );
  };

  return (
    <div
      className="node-toggle-content"
      data-toggle-content={nodeId}
      data-depth={level}
      style={{ display: expanded ? 'block' : 'none' }}
    >
      {groupChildren(node.children!).map(({ groupName, children }, idx, arr) => {
        const hasGroups = hasGroupMap.get(level + 1) || false;
        const prevGroupName = idx > 0 ? arr[idx - 1].groupName : null;

        if (groupName) {
          return (
            <ParameterGroup key={`group-${groupName}-${idx}`} groupName={groupName}>
              {children.map((child, childIdx) => renderChild(child, childIdx))}
            </ParameterGroup>
          );
        } else {
          if (hasGroups) {
            if (prevGroupName) {
              return (
                <div key={`nogroup-${idx}`} className="inspector-group-indent">
                  <div className="inspector-group-header">
                    <span className="inspector-group-label"> </span>
                  </div>
                  <div>{children.map((child, childIdx) => renderChild(child, childIdx))}</div>
                </div>
              );
            } else {
              return (
                <div key={`nogroup-${idx}`} className="inspector-group-indent">
                  {children.map((child, childIdx) => renderChild(child, childIdx))}
                </div>
              );
            }
          } else {
            return (
              <React.Fragment key={`nogroup-${idx}`}>
                {children.map((child, childIdx) => renderChild(child, childIdx))}
              </React.Fragment>
            );
          }
        }
      })}
    </div>
  );
}

// Node parameter item component — memoized to avoid re-rendering entire tree
// when only a sibling's data changes
const NodeParameter = React.memo(function NodeParameter({
  node,
  level,
  hasGroupMap,
  parentNodeType,
  parentHandle,
  movablePinIndex,
  movablePinCount,
}: {
  node: SceneNode;
  level: number;
  hasGroupMap: Map<number, boolean>;
  parentNodeType?: string;
  parentHandle?: number;
  movablePinIndex?: number;
  movablePinCount?: number;
}) {
  const { client } = useOctane();
  const { setTemporaryStatus } = useStatusActions();
  const [expanded, setExpanded] = useState(level < 2);
  const [nodeTypeChanging, setNodeTypeChanging] = useState(false);

  const hasChildren = node.children && node.children.length > 0;
  const isEndNode = !hasChildren; // && !!node.attrInfo;

  // Use parameter value management hook
  const { paramValue, handleValueChange } = useParameterValue(node, client, isEndNode);
  const nodeId = `node-${node.handle}`;
  const typeStr = String(node.type || node.outType || 'unknown');
  const icon = node.icon || getIconForType(typeStr, node.name);
  let name = node.pinInfo?.staticLabel || node.name;
  let color = node.nodeInfo?.nodeColor ? formatNodeColor(node.nodeInfo.nodeColor) : '#666';
  if (node.pinInfo) {
    const info = getPinTypeInfo(node.pinInfo.type as string);
    if (info) {
      color = info.color;
    }
  }

  // Prefix movable input pins with "Input N:" (matches Octane's "Input 1: Placement" style)
  if (movablePinIndex !== undefined && parentNodeType) {
    const movInfo = MOVABLE_INPUT_TYPES[parentNodeType];
    if (movInfo) {
      const prefix = `${movInfo.inputName.charAt(0).toUpperCase()}${movInfo.inputName.slice(1)} ${movablePinIndex + 1}`;
      if (node.handle && name && name !== 'Unnamed') {
        name = `${prefix}: ${name}`;
      } else {
        name = prefix;
      }
    }
  }

  // Check if this node is a movable input pin (parent has movable inputs)
  const isMovable = parentNodeType ? isMovableInputPin(node, parentNodeType) : false;
  const pinIdx = node.pinInfo?.pinId;

  // Determine if we should show dropdown (non-end nodes with a valid pin type)
  const pinType = typeStr.startsWith('PT_') ? typeStr : null;
  const compatibleNodeTypes = pinType ? getCompatibleNodeTypes(pinType) : [];

  // Empty pin: handle === 0/undefined with a known PT_ type — no connected node yet
  const isEmptyPin = !node.handle && pinType !== null && compatibleNodeTypes.length > 0;

  // Connected leaf: has a handle + PT_ type but no children and no attrInfo
  // (e.g., NT_TRANSFORM_VALUE — connected node that isn't a simple value parameter)
  const isConnectedLeaf = isEndNode && !!node.handle && pinType !== null && !node.attrInfo;

  const showDropdown =
    (!isEndNode || isEmptyPin || isConnectedLeaf) && compatibleNodeTypes.length > 0;

  // Get current node type (for nodes, not pins)
  const currentNodeType = node.nodeInfo?.type || '';

  // Handler for node type change — value is "key:id" to carry both pieces
  // Guard prevents concurrent changes (multiple API calls can create orphaned nodes)
  const handleNodeTypeChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;

    // Handle "Delete node" action
    if (value === '__delete_node__') {
      // Reset select to current value
      event.target.value = currentNodeType;
      if (!node.handle) return;
      try {
        await client.deleteNodeOptimized(node.handle);
      } catch (error) {
        Logger.error('Failed to delete node:', error);
        setTemporaryStatus('Failed to delete node', 3000);
      }
      return;
    }

    const selected = compatibleNodeTypes.find(t => t.key === value);
    if (!selected || selected.key === currentNodeType || nodeTypeChanging) return;

    setNodeTypeChanging(true);
    try {
      if (isEmptyPin) {
        const parentHandle = node.pinInfo?.pinOwner?.handle;
        const pinIdx = node.pinInfo?.pinId;
        if (!parentHandle || pinIdx === undefined) {
          Logger.error('Could not find parent or pin index for empty pin');
          setTemporaryStatus('Failed to create node for this parameter', 3000);
          return;
        }
        await client.createNodeForPin(parentHandle, pinIdx, selected.key, selected.id);
      } else {
        if (!node.handle) return;
        await client.replaceNode(node.handle, selected.key, selected.id);
      }
    } catch (error) {
      Logger.error('Failed to change node type:', error);
      setTemporaryStatus('Failed to change node type', 3000);
    } finally {
      setNodeTypeChanging(false);
    }
  };

  const handleToggle = () => {
    setExpanded(!expanded);
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
  const isTransformValue = currentNodeType === 'NT_TRANSFORM_VALUE';
  const collapseIcon = (hasChildren || isTransformValue) && level > 0 ? (expanded ? '▼' : '▶') : '';

  // Build tooltip with detailed description
  const buildTooltip = () => {
    // Priority: pinInfo.description > attrInfo.description > nodeInfo.description
    const description =
      node.pinInfo?.description || node.attrInfo?.description || node.nodeInfo?.description;
    return description || name;
  };

  // Render as parameter node (end node) — but not empty pin slots or connected leaf nodes
  if ((!node.children || node.children.length === 0) && !isEmptyPin && !isConnectedLeaf) {
    //    if (node.attrInfo) {
    return (
      <div className={indentClass} data-depth={level} style={{ display: 'block' }}>
        <div className="node-box-parameter" data-node-handle={node.handle} data-node-id={nodeId}>
          <div
            className={`node-icon-box${hasChildren && expanded ? ' expanded-parent' : ''}`}
            style={{ backgroundColor: color }}
          >
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
              onClick={hasChildren || isTransformValue ? handleToggle : undefined}
              onKeyDown={hasChildren || isTransformValue ? handleToggleKeyDown : undefined}
              role={hasChildren || isTransformValue ? 'button' : undefined}
              tabIndex={hasChildren || isTransformValue ? 0 : undefined}
            >
              <div className="node-label-text">
                {collapseIcon && <span className="collapse-icon">{collapseIcon}</span>}
                <span className="node-title" title={buildTooltip()}>
                  {name}:
                </span>
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
            data-depth={level}
            style={{ display: expanded ? 'block' : 'none' }}
          >
            {node.children!.map((child, childIdx) => (
              <NodeParameter
                key={`${child.handle}-${childIdx}`}
                node={child}
                level={level + 1}
                hasGroupMap={hasGroupMap}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Show file toolbar for file-based nodes (even without a file loaded yet) or nodes with a file path
  const isFileNode = !!(node.nodeInfo?.type && node.nodeInfo.type in FILE_NODE_TYPES);
  const showFileToolbar = isFileNode || !!node.filePath;

  // Render as node group (non-parameter nodes)
  return (
    <div
      className={`${indentClass}${isMovable ? ' movable-input-row' : ''}`}
      data-depth={level}
      style={{ display: 'block' }}
    >
      <div className="node-box" data-node-handle={node.handle} data-node-id={nodeId}>
        <div
          className={`node-icon-box${hasChildren && expanded ? ' expanded-parent' : ''}`}
          style={{ backgroundColor: color }}
        >
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
            onClick={hasChildren || isTransformValue ? handleToggle : undefined}
            onKeyDown={hasChildren || isTransformValue ? handleToggleKeyDown : undefined}
            role={hasChildren || isTransformValue ? 'button' : undefined}
            tabIndex={hasChildren || isTransformValue ? 0 : undefined}
          >
            <div className="node-label-text">
              {collapseIcon ? (
                <span className="collapse-icon">{collapseIcon}</span>
              ) : level > 0 ? (
                <span className="collapse-icon-spacer" />
              ) : null}
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
                  className={`inspector-target-select${isEmptyPin ? ' no-node-selected' : ''}`}
                  name="inspector-target-select"
                  autoComplete="off"
                  value={currentNodeType}
                  onChange={handleNodeTypeChange}
                  onClick={e => e.stopPropagation()}
                  disabled={nodeTypeChanging}
                >
                  {isEmptyPin && (
                    <option value="" disabled>
                      No Node
                    </option>
                  )}
                  {compatibleNodeTypes.map(t => {
                    const nodeTypeInfo = getNodeTypeInfo(t.key);
                    const displayName =
                      nodeTypeInfo?.name || t.key.replace('NT_', '').replace(/_/g, ' ');
                    return (
                      <option key={t.key} value={t.key}>
                        {displayName}
                      </option>
                    );
                  })}
                  {!isEmptyPin && (
                    <>
                      <option disabled>──────────</option>
                      <option value="__delete_node__">Delete node</option>
                    </>
                  )}
                </select>
                {isMovable && parentHandle !== undefined && pinIdx !== undefined && (
                  <MovableInputPinActions
                    nodeHandle={parentHandle}
                    pinIdx={pinIdx}
                    isFirst={movablePinIndex === 0}
                    isLast={movablePinIndex === (movablePinCount ?? 1) - 1}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add input button for movable-input nodes */}
      {node.handle &&
        node.nodeInfo?.type &&
        node.nodeInfo.type in MOVABLE_INPUT_TYPES &&
        expanded && <AddInputButton nodeHandle={node.handle} />}

      {/* File Node Toolbar - inside collapsed section (matches Octane layout) */}
      {expanded && showFileToolbar && <FileNodeToolbar node={node} />}

      {hasChildren && (
        <NodeChildrenWithMovable
          node={node}
          nodeId={nodeId}
          expanded={expanded}
          level={level}
          hasGroupMap={hasGroupMap}
        />
      )}

      {/* Transform Value synthetic children */}
      {isTransformValue && expanded && node.handle && (
        <div
          className="node-toggle-content"
          data-toggle-content={nodeId}
          data-depth={level}
          style={{ display: 'block', overflow: 'hidden' }}
        >
          <TransformValueExpander nodeHandle={node.handle} />
        </div>
      )}
    </div>
  );
});

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

  // Context menu handler
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContextMenuVisible(true);
  }, []);

  // Context menu action handlers
  const handleContextMenuClose = useCallback(() => {
    setContextMenuVisible(false);
  }, []);

  const handleRender = useCallback(() => {
    Logger.debug('Render action for node:', node?.name);
    // Future: render selected node
  }, [node]);

  const handleSave = useCallback(() => {
    Logger.debug('Save action for node:', node?.name);
    // Future: save selected node
  }, [node]);

  const handleCut = useCallback(() => {
    Logger.debug('Cut action for node:', node?.name);
    // Future: cut to clipboard
  }, [node]);

  const handleCopy = useCallback(() => {
    Logger.debug('Copy action for node:', node?.name);
    // Future: copy to clipboard
  }, [node]);

  const handlePaste = useCallback(() => {
    Logger.debug('Paste action for node:', node?.name);
    // Future: paste from clipboard
  }, [node]);

  const handleDelete = useCallback(async () => {
    if (!node || !client) return;

    Logger.debug('Delete action for node:', node.name);

    // Use unified EditCommands for consistent delete behavior
    // Note: App.tsx listens to 'nodeDeleted' event and clears selection
    await EditCommands.deleteNodes({
      client,
      selectedNodes: [node],
      onComplete: () => {
        Logger.debug('Delete operation completed from NodeInspector');
      },
    });
  }, [node, client]);

  const handleExpand = useCallback(() => {
    Logger.debug('Expand action for node:', node?.name);
    // Future: expand all children in tree
  }, [node]);

  const handleShowInOutliner = useCallback(() => {
    Logger.debug('Show in Outliner:', node?.name);
    // Future: navigate to node in outliner panel
  }, [node]);

  const handleShowInGraphEditor = useCallback(() => {
    Logger.debug('Show in Graph Editor:', node?.name);
    // Future: navigate to node in graph editor
  }, [node]);

  const handleShowInLuaBrowser = useCallback(() => {
    Logger.debug('Show in Lua Browser:', node?.name);
    // Future: navigate to node in Lua browser
  }, [node]);

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
        <NodeParameter node={node} level={0} hasGroupMap={hasGroupMap} />
      </div>

      {/* Context Menu */}
      {contextMenuVisible && (
        <NodeInspectorContextMenu
          x={contextMenuPosition.x}
          y={contextMenuPosition.y}
          onRender={handleRender}
          onSave={handleSave}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={handlePaste}
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
