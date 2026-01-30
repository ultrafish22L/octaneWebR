/**
 * Custom Octane Node Component for ReactFlow
 * Matches the visual style and behavior of octaneWeb's NodeGraphEditor
 */

import { Logger } from '../../utils/Logger';
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { SceneNode } from '../../services/OctaneClient';
import { getIconForType, getPinIconInfo } from '../../constants/PinTypes';
import { formatColorValue } from '../../utils/ColorUtils';

/**
 * Get pin color with proper fallback logic:
 * 1. Use pinInfo.pinColor if available (from Octane gRPC API)
 * 2. Fall back to local color mapping by pin type (from C++ source in PinTypes.ts)
 * 3. Fall back to default light pink if neither is available
 */
function getPinColor(pinInfo: any): string {
  // Check for direct pin color from Octane (handles 0 as valid black color)
  if (pinInfo?.pinColor !== undefined && pinInfo?.pinColor !== null) {
    return formatColorValue(pinInfo.pinColor);
  }

  // Fall back to local color mapping by type (from PinTypes.ts - C++ source colors)
  if (pinInfo?.type) {
    try {
      const pinIconInfo = getPinIconInfo(pinInfo.type);
      return pinIconInfo.color;
    } catch (e) {
      // Type not found in mapping, continue to default
    }
  }

  // Final fallback to light pink
  return '#f3dcde';
}

/**
 * Convert hex color to HSL
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to hex color
 */
function hslToHex(h: number, s: number, l: number): string {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Desaturate a color (make it more muted)
 * Currently unused but kept for future use
 */
// @ts-ignore - Kept for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _desaturateColor(hex: string, amount: number = 0.5): string {
  const hsl = hexToHsl(hex);
  return hslToHex(hsl.h, hsl.s * amount, hsl.l);
}

/**
 * Fully saturate a color (make it vibrant)
 */
function saturateColor(hex: string): string {
  const hsl = hexToHsl(hex);
  return hslToHex(hsl.h, 100, hsl.l);
}

export interface OctaneNodeData extends Record<string, unknown> {
  sceneNode: SceneNode;
  inputs?: Array<{
    id: string;
    label?: string;
    pinInfo?: any;
    handle?: number;
    nodeInfo?: any;
    name?: string;
    connectedNodeName?: string | null;
  }>;
  output?: {
    id: string;
    label?: string;
    pinInfo?: any;
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

  // Get node color from nodeInfo - desaturate for muted appearance
  const rawNodeColor = sceneNode.nodeInfo?.nodeColor
    ? formatColorValue(sceneNode.nodeInfo.nodeColor)
    : '#666';
  const nodeColor = rawNodeColor; //desaturateColor(rawNodeColor, 0.4); // 40% saturation for muted look

  // Calculate dynamic width based on inputs
  const inputCount = inputs.length;
  const minWidth = 180;
  const minPinSpacing = 30; // Increased spacing for better visibility
  const calculatedWidth =
    inputCount > 0 ? Math.max(minWidth, inputCount * minPinSpacing + 40) : minWidth;

  const handleContextMenu = (event: React.MouseEvent) => {
    if (onContextMenu) {
      event.preventDefault();
      event.stopPropagation();
      Logger.debug('🖱️ [OctaneNode] Context menu triggered for node:', id);
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
        minWidth: minWidth,
        height: 32,
        backgroundColor: nodeColor,
        border: selected ? '2px solid #ffc107' : '1px solid #555',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        padding: '0 10px 0 32px',
        cursor: 'grab',
      }}
    >
      {/* Node type icon box - fitted gray box on left side */}
      {sceneNode.type && (
        <div
          style={{
            position: 'absolute',
            left: -1,
            top: -1,
            bottom: -1,
            width: 26,
            backgroundColor: '#555',
            borderRadius: '8px 0 0 8px',
            borderTop: selected ? '2px solid #ffc107' : '1px solid #555',
            borderBottom: selected ? '2px solid #ffc107' : '1px solid #555',
            borderLeft: selected ? '2px solid #ffc107' : '1px solid #555',
            borderRight: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.4)',
          }}
        >
          <img
            src={icon}
            alt=""
            className="node-icon"
            width={24}
            height={24}
            onError={e => {
              (e.target as HTMLImageElement).src = '/icons/CATEGORY.png';
            }}
          />
        </div>
      )}

      {/* Input handles on top */}
      {inputs.map((input: any, index: number) => {
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
              top: -4, // Move slightly above the node
              width: 12,
              height: 12,
              // Filled if connected to collapsed, unfilled (transparent) if connected to expanded
              backgroundColor: isConnectedToCollapsed ? socketColor : 'transparent',
              border: `2px solid ${socketColor}`,
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
          fontSize: 11,
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          userSelect: 'none',
          width: '100%',
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
                bottom: -4, // Move slightly below the node
                width: 12,
                height: 12,
                backgroundColor: outputColor,
                border: `2px solid ${outputColor}`,
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
