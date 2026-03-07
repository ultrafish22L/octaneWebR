/**
 * Custom Octane Node Component for ReactFlow
 * Matches the visual style and behavior of octaneWeb's NodeGraphEditor
 */

import { Logger } from '../../utils/Logger';
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { SceneNode } from '../../services/OctaneClient';
import { getIconForType } from '../../constants/PinTypes';
import { formatColorValue, saturateColor, muteNodeColor } from '../../utils/ColorUtils';
import { getPinColor } from '../../utils/PinColorUtils';
import {
  NODE_HEIGHT,
  NODE_BORDER_RADIUS,
  NODE_PADDING_RIGHT,
  NODE_PADDING_LEFT,
  NODE_ICON_BOX,
  NODE_ICON_RADIUS,
  NODE_ICON_SIZE,
  NODE_FONT_SIZE,
  NODE_PIN_SIZE,
  NODE_PIN_BORDER,
  NODE_PIN_OFFSET,
  estimateNodeWidth,
} from '../../utils/NodeLayoutUtils';

interface PinInfoData {
  pinColor?: number | string | null;
  type?: string;
  staticLabel?: string;
  staticName?: string;
  [key: string]: unknown;
}

export interface OctaneNodeData extends Record<string, unknown> {
  sceneNode: SceneNode;
  inputs?: Array<{
    id: string;
    label?: string;
    pinInfo?: PinInfoData;
    handle?: number;
    nodeInfo?: Record<string, unknown>;
    name?: string;
    connectedNodeName?: string | null;
    isAtTopLevel?: boolean | number | false;
  }>;
  output?: {
    id: string;
    label?: string;
    pinInfo?: PinInfoData;
  };
  onContextMenu?: (event: React.MouseEvent, nodeId: string) => void;
}

type OctaneNodeProps = {
  data: OctaneNodeData;
  selected?: boolean;
  id: string;
};

/**
 * Custom node component matching Octane Studio styling
 */
export const OctaneNode = memo((props: OctaneNodeProps) => {
  const { data, selected, id } = props;
  const { sceneNode, inputs = [], output, onContextMenu } = data;

  // Get node color from nodeInfo - darken and desaturate for Octane SE's muted look
  const rawNodeColor =
    sceneNode.nodeInfo?.nodeColor != null ? formatColorValue(sceneNode.nodeInfo.nodeColor) : '#666';
  const nodeColor = muteNodeColor(rawNodeColor);

  // Calculate dynamic width based on inputs and label length (driven by NODE_SCALE in NodeLayoutUtils)
  const label = sceneNode.name || sceneNode.type || '';
  const calculatedWidth = estimateNodeWidth(inputs.length, label);

  const handleContextMenu = (event: React.MouseEvent) => {
    if (onContextMenu) {
      event.preventDefault();
      event.stopPropagation();
      Logger.debug('[OctaneNode] Context menu triggered for node:', id);
      onContextMenu(event, id);
    }
  };
  const typeStr = String(sceneNode.type || sceneNode.outType || 'unknown');
  const icon = sceneNode.icon || getIconForType(typeStr, sceneNode.name);

  return (
    <div
      className="node"
      onContextMenu={handleContextMenu}
      style={{
        width: calculatedWidth,
        height: NODE_HEIGHT,
        backgroundColor: nodeColor,
        backgroundImage:
          'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 35%, rgba(0,0,0,0.25) 100%)',
        border: selected ? '2px solid #9a7b20' : '1px solid #111',
        borderTop: selected ? '2px solid #9a7b20' : '1px solid #222',
        borderBottom: selected ? '2px solid #9a7b20' : '1px solid #000',
        borderRadius: NODE_BORDER_RADIUS,
        boxShadow: selected
          ? 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 6px rgba(0,0,0,0.4)'
          : 'inset 0 1px 0 rgba(255,255,255,0.1), 0 1px 4px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        padding: `0 ${NODE_PADDING_RIGHT}px 0 ${NODE_PADDING_LEFT}px`,
        cursor: 'grab',
      }}
    >
      {/* Node type icon box - fitted gray box on left side */}
      {sceneNode.type && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: NODE_ICON_BOX,
            backgroundColor: '#909090',
            backgroundImage:
              'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 35%, rgba(0,0,0,0.25) 100%)',
            borderRadius: `${NODE_ICON_RADIUS}px 0 0 ${NODE_ICON_RADIUS}px`,
            borderRight: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 2px rgba(0,0,0,0.3)',
          }}
        >
          <img
            src={icon}
            alt=""
            width={NODE_ICON_SIZE}
            height={NODE_ICON_SIZE}
            style={{ display: 'block', objectFit: 'contain', margin: 0 }}
            onError={e => {
              (e.target as HTMLImageElement).src = '/icons/CATEGORY.png';
            }}
          />
        </div>
      )}

      {/* Input handles on top */}
      {inputs.map((input, index: number) => {
        // Get socket color with proper fallback (Octane → local mapping → default)
        const rawSocketColor = getPinColor(input.pinInfo);
        const socketColor = saturateColor(rawSocketColor); // Fully saturated for vibrant pins

        const inputSpacing = calculatedWidth / (inputs.length + 1);
        const socketX = inputSpacing * (index + 1) - calculatedWidth / 2;

        // Pin appearance logic:
        // - Collapsed node at pin: pin connects to a node NOT at level 1 (not visible in NGE) → SOLID ⬤
        // - Expanded node at pin: pin connects to a node AT level 1 (visible in NGE) → OUTLINE ○
        // - No connection at pin: pin has no connected node → OUTLINE ○
        const isConnectedToCollapsed =
          input.handle !== undefined && input.handle !== 0 && !input.isAtTopLevel;

        // Build tooltip with pin name only
        const buildTooltip = () => {
          // Pin name/label (staticLabel is preferred, fallback to staticName)
          const pinName =
            input.pinInfo?.staticLabel ||
            input.pinInfo?.staticName ||
            input.label ||
            `Input ${index}`;
          return pinName;
        };

        return (
          <Handle
            key={input.id}
            type="target"
            position={Position.Top}
            id={input.id}
            style={{
              left: `calc(50% + ${socketX}px)`,
              top: -NODE_PIN_OFFSET,
              width: NODE_PIN_SIZE,
              height: NODE_PIN_SIZE,
              // Filled if connected to collapsed, unfilled (transparent) if connected to expanded
              backgroundColor: isConnectedToCollapsed ? socketColor : 'transparent',
              border: `${NODE_PIN_BORDER}px solid ${socketColor}`,
              borderRadius: '50%',
              zIndex: 10,
            }}
            title={buildTooltip()}
          />
        );
      })}

      {/* Node title */}
      <div
        style={{
          color: '#fff',
          fontSize: NODE_FONT_SIZE,
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          userSelect: 'none',
          width: '100%',
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        }}
      >
        {sceneNode.name || sceneNode.type}
      </div>

      {/* Output handle on bottom */}
      {output &&
        (() => {
          // Get output socket color with proper fallback (Octane → local mapping → default)
          const rawOutputColor = getPinColor(output.pinInfo);
          const outputColor = saturateColor(rawOutputColor); // Fully saturated for vibrant pins

          // Build output tooltip with node name only
          const buildOutputTooltip = () => {
            // Node name/label (defaultName from ApiNodeInfo is preferred)
            const nodeName = sceneNode.nodeInfo?.defaultName || sceneNode.name || sceneNode.type;
            return nodeName;
          };

          return (
            <Handle
              type="source"
              position={Position.Bottom}
              id={output.id}
              style={{
                left: '50%',
                bottom: -NODE_PIN_OFFSET,
                width: NODE_PIN_SIZE,
                height: NODE_PIN_SIZE,
                backgroundColor: 'transparent',
                border: `${NODE_PIN_BORDER}px solid ${outputColor}`,
                borderRadius: '50%',
                zIndex: 10,
              }}
              title={buildOutputTooltip()}
            />
          );
        })()}
    </div>
  );
});

OctaneNode.displayName = 'OctaneNode';
