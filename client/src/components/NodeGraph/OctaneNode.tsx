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

/**
 * Get pin color with proper fallback logic:
 * 1. Use pinInfo.pinColor if available (from Octane gRPC API)
 * 2. Fall back to local color mapping by pin type (from C++ source in PinTypes.ts)
 * 3. Fall back to default light pink if neither is available
 */
interface PinInfoData {
  pinColor?: number | string | null;
  type?: string;
  staticLabel?: string;
  staticName?: string;
  [key: string]: unknown;
}

function getPinColor(pinInfo: PinInfoData | null | undefined): string {
  // Check for direct pin color from Octane (handles 0 as valid black color)
  if (pinInfo?.pinColor !== undefined && pinInfo?.pinColor !== null) {
    return formatColorValue(pinInfo.pinColor);
  }

  // Fall back to local color mapping by type (from PinTypes.ts - C++ source colors)
  if (pinInfo?.type) {
    try {
      const pinIconInfo = getPinIconInfo(pinInfo.type);
      return pinIconInfo.color;
    } catch {
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

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

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
 * Moderate pin color saturation to match Octane SE's muted, slightly translucent pin style.
 * Caps saturation at 44% and returns rgba with slight transparency.
 */
function saturateColor(hex: string): string {
  const hsl = hexToHsl(hex);
  const mutedHex = hslToHex(hsl.h, Math.min(hsl.s, 44), hsl.l);
  // Convert to rgba with slight translucency
  const r = parseInt(mutedHex.slice(1, 3), 16);
  const g = parseInt(mutedHex.slice(3, 5), 16);
  const b = parseInt(mutedHex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.75)`;
}

/**
 * Darken and desaturate a node color to match Octane SE's muted, professional appearance.
 * Reduces lightness to 65% and saturation to 70% of original values.
 */
function muteNodeColor(hex: string): string {
  const hsl = hexToHsl(hex);
  const newL = Math.min(hsl.l * 0.5, 28);
  const newS = hsl.s * 0.12;
  return hslToHex(hsl.h, newS, newL);
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
  const rawNodeColor = sceneNode.nodeInfo?.nodeColor
    ? formatColorValue(sceneNode.nodeInfo.nodeColor)
    : '#666';
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
