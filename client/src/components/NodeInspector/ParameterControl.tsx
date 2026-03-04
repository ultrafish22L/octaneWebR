/**
 * Parameter Control Component
 *
 * Renders parameter controls based on Octane attribute types.
 * Extracted from NodeInspector to improve code organization.
 *
 * Features:
 * - All Octane attribute types (AT_BOOL, AT_INT*, AT_FLOAT*, AT_LONG*, AT_STRING)
 * - Vector inputs with dynamic dimension count
 * - Color pickers for RGB values
 * - Number spinners for numeric inputs
 * - Matches octaneWeb GenericNodeRenderer structure
 *
 * Performance:
 * - Memoized with React.memo to prevent unnecessary re-renders
 * - Custom comparison function for deep equality checks on paramValue
 */

import React, { memo, useState } from 'react';
import { SceneNode } from '../../services/OctaneClient';
import { AttrType } from '../../constants/OctaneTypes';
import { formatColorValue } from '../../utils/ColorUtils';
import { Logger } from '../../utils/Logger';
import type { ParameterValue } from './hooks/useParameterValue';

/**
 * Format float value for display (minimum 3, maximum 6 decimal places)
 * Examples: 36 → "36.000", 43.45 → "43.450", 43.455845 → "43.455845"
 */
function formatFloatForDisplay(value: number): string {
  const str = value.toFixed(6);
  const [intPart, decPart] = str.split('.');

  // Keep first 3 decimals, then remove trailing zeros from remaining 3
  const minDecimals = decPart.slice(0, 3);
  const extraDecimals = decPart.slice(3).replace(/0+$/, '');

  return `${intPart}.${minDecimals}${extraDecimals}`;
}

/**
 * Parse float value from input (handles string input)
 */
function parseFloatValue(value: string | number): number {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : parseFloat(num.toFixed(6));
}

/**
 * Input that defers API calls until blur or Enter.
 * Prevents firing gRPC calls on every keystroke for text/number inputs.
 */
function DeferredInput({
  displayValue,
  onCommit,
  ...inputProps
}: Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'onBlur' | 'onKeyDown' | 'onFocus'
> & {
  displayValue: string;
  onCommit: (value: string) => void;
}) {
  const [localValue, setLocalValue] = useState(displayValue);
  const [focused, setFocused] = useState(false);

  return (
    <input
      {...inputProps}
      value={focused ? localValue : displayValue}
      onChange={e => setLocalValue(e.target.value)}
      onFocus={() => {
        setFocused(true);
        setLocalValue(displayValue);
      }}
      onBlur={() => {
        setFocused(false);
        onCommit(localValue);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

type ParameterValueType =
  | boolean
  | number
  | string
  | { x: number; y?: number; z?: number; w?: number };

interface ParameterControlProps {
  node: SceneNode;
  paramValue: ParameterValue | null;
  onValueChange: (_: ParameterValueType) => Promise<void>;
}

/**
 * Renders parameter controls based on attribute type
 */
function ParameterControlComponent({
  node,
  paramValue,
  onValueChange,
}: ParameterControlProps): React.JSX.Element | null {
  if (!paramValue) return null;

  const { value, type } = paramValue;

  // Debug logging for stereo parameters (broaden search to catch all stereo-related params)
  const nodeName = node.pinInfo?.staticLabel || node.name;
  if (nodeName.toLowerCase().includes('stereo')) {
    Logger.debugV(
      ' ParameterControl RENDERING:',
      JSON.stringify(
        {
          nodeName,
          type,
          value,
          floatInfo: node.pinInfo?.floatInfo,
          nodeType: node.nodeInfo?.type,
        },
        null,
        2
      )
    );
  }

  // Controls must be wrapped in parameter-control-container or parameter-checkbox-container
  // which are then wrapped in node-parameter-controls div (matching octaneWeb structure)
  let controlHtml = null;

  switch (type) {
    case AttrType.AT_BOOL: {
      const boolValue = typeof value === 'boolean' ? value : false;
      controlHtml = (
        <div className="parameter-checkbox-container">
          <input
            type="checkbox"
            className="checkbox parameter-control"
            checked={boolValue}
            onChange={e => onValueChange(e.target.checked)}
            id={`checkbox-${node.handle}`}
            autoComplete="off"
            name="octane-checkbox-0"
          />
        </div>
      );
      break;
    }

    case AttrType.AT_FLOAT: {
      const floatValue = typeof value === 'number' ? value : 0;
      const floatInfo = node.pinInfo?.floatInfo;
      const useSliders = floatInfo?.useSliders ?? true;
      const step = floatInfo?.dimInfos?.[0]?.sliderStep ?? 0.001;

      controlHtml = (
        <div className="parameter-control-container">
          <div className="parameter-number-with-spinner">
            <DeferredInput
              type="text"
              className="number-input parameter-control"
              displayValue={formatFloatForDisplay(floatValue)}
              onCommit={v => onValueChange(parseFloatValue(v))}
              autoComplete="off"
              name="octane-number-input-1"
            />
            {useSliders && (
              <div className="parameter-spinner-container">
                <button
                  className="parameter-spinner-btn"
                  onClick={() => onValueChange(parseFloatValue((floatValue || 0) + step))}
                  title="Increase value"
                >
                  ▲
                </button>
                <button
                  className="parameter-spinner-btn"
                  onClick={() => onValueChange(parseFloatValue((floatValue || 0) - step))}
                  title="Decrease value"
                >
                  ▼
                </button>
              </div>
            )}
          </div>
        </div>
      );
      break;
    }

    case AttrType.AT_FLOAT2: {
      if (value && typeof value === 'object' && 'x' in value) {
        const { x = 0, y = 0 } = value;
        const floatInfo = node.pinInfo?.floatInfo;
        const dimCount = floatInfo?.dimCount ?? 2;

        controlHtml = (
          <div className="parameter-control-container">
            <DeferredInput
              type="text"
              className="number-input parameter-control"
              displayValue={formatFloatForDisplay(x)}
              onCommit={v => onValueChange({ x: parseFloatValue(v), y })}
              autoComplete="off"
              name="octane-number-input-2"
            />
            {dimCount >= 2 && (
              <DeferredInput
                type="text"
                className="number-input parameter-control"
                displayValue={formatFloatForDisplay(y)}
                onCommit={v => onValueChange({ x, y: parseFloatValue(v) })}
                autoComplete="off"
                name="octane-number-input-3"
              />
            )}
          </div>
        );
      }
      break;
    }

    case AttrType.AT_FLOAT3: {
      if (value && typeof value === 'object' && 'x' in value) {
        const { x = 0, y = 0, z = 0 } = value;
        const floatInfo = node.pinInfo?.floatInfo;
        const dimCount = floatInfo?.dimCount ?? 3;
        const isColor = floatInfo?.isColor || node.nodeInfo?.type === 'NT_TEX_RGB';

        // Check if this is a color (NT_TEX_RGB)
        if (isColor) {
          const hexColor = formatColorValue(value);

          controlHtml = (
            <div className="parameter-control-container">
              <input
                type="color"
                className="color-input parameter-control"
                value={hexColor}
                onChange={e => {
                  const hex = e.target.value;
                  const r = parseInt(hex.substring(1, 3), 16) / 255;
                  const g = parseInt(hex.substring(3, 5), 16) / 255;
                  const b = parseInt(hex.substring(5, 7), 16) / 255;
                  onValueChange({
                    x: parseFloatValue(r),
                    y: parseFloatValue(g),
                    z: parseFloatValue(b),
                  });
                }}
                autoComplete="off"
                name="octane-color-input-4"
              />
            </div>
          );
        } else {
          controlHtml = (
            <div className="parameter-control-container">
              <DeferredInput
                type="text"
                className="number-input parameter-control"
                displayValue={formatFloatForDisplay(x)}
                onCommit={v => onValueChange({ x: parseFloatValue(v), y, z })}
                autoComplete="off"
                name="octane-number-input-5"
              />
              {dimCount >= 2 && (
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={formatFloatForDisplay(y)}
                  onCommit={v => onValueChange({ x, y: parseFloatValue(v), z })}
                  autoComplete="off"
                  name="octane-number-input-6"
                />
              )}
              {dimCount >= 3 && (
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={formatFloatForDisplay(z)}
                  onCommit={v => onValueChange({ x, y, z: parseFloatValue(v) })}
                  autoComplete="off"
                  name="octane-number-input-7"
                />
              )}
            </div>
          );
        }
      }
      break;
    }

    case AttrType.AT_FLOAT4: {
      if (value && typeof value === 'object' && 'x' in value) {
        const { x = 0, y = 0, z = 0, w = 0 } = value;
        const floatInfo = node.pinInfo?.floatInfo;
        const dimCount = floatInfo?.dimCount ?? 4;

        // Render based on dimension count (matching octaneWeb exactly)
        switch (dimCount) {
          case 1:
            controlHtml = (
              <div className="parameter-control-container">
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={formatFloatForDisplay(x)}
                  onCommit={v => onValueChange({ x: parseFloatValue(v), y, z, w })}
                  autoComplete="off"
                  name="octane-number-input-8"
                />
              </div>
            );
            break;
          case 2:
            controlHtml = (
              <div className="parameter-control-container">
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={formatFloatForDisplay(x)}
                  onCommit={v => onValueChange({ x: parseFloatValue(v), y, z, w })}
                  autoComplete="off"
                  name="octane-number-input-9"
                />
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={formatFloatForDisplay(y)}
                  onCommit={v => onValueChange({ x, y: parseFloatValue(v), z, w })}
                  autoComplete="off"
                  name="octane-number-input-10"
                />
              </div>
            );
            break;
          case 3:
            controlHtml = (
              <div className="parameter-control-container">
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={formatFloatForDisplay(x)}
                  onCommit={v => onValueChange({ x: parseFloatValue(v), y, z, w })}
                  autoComplete="off"
                  name="octane-number-input-11"
                />
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={formatFloatForDisplay(y)}
                  onCommit={v => onValueChange({ x, y: parseFloatValue(v), z, w })}
                  autoComplete="off"
                  name="octane-number-input-12"
                />
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={formatFloatForDisplay(z)}
                  onCommit={v => onValueChange({ x, y, z: parseFloatValue(v), w })}
                  autoComplete="off"
                  name="octane-number-input-13"
                />
              </div>
            );
            break;
          default:
            // 4 dimensions (full RGBA or XYZW)
            controlHtml = (
              <div className="parameter-control-container">
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={formatFloatForDisplay(x)}
                  onCommit={v => onValueChange({ x: parseFloatValue(v), y, z, w })}
                  autoComplete="off"
                  name="octane-number-input-14"
                />
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={formatFloatForDisplay(y)}
                  onCommit={v => onValueChange({ x, y: parseFloatValue(v), z, w })}
                  autoComplete="off"
                  name="octane-number-input-15"
                />
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={formatFloatForDisplay(z)}
                  onCommit={v => onValueChange({ x, y, z: parseFloatValue(v), w })}
                  autoComplete="off"
                  name="octane-number-input-16"
                />
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={formatFloatForDisplay(w)}
                  onCommit={v => onValueChange({ x, y, z, w: parseFloatValue(v) })}
                  autoComplete="off"
                  name="octane-number-input-17"
                />
              </div>
            );
            break;
        }
      }
      break;
    }

    case AttrType.AT_INT: {
      const intValue = typeof value === 'number' ? value : 0;

      // Check if this is an enum (NT_ENUM) - render dropdown
      if (node.nodeInfo?.type === 'NT_ENUM' && node.pinInfo?.enumInfo?.values) {
        const enumOptions = node.pinInfo.enumInfo.values;
        controlHtml = (
          <div className="parameter-control-container">
            <select
              className="parameter-dropdown parameter-control"
              value={intValue || 0}
              onChange={e => onValueChange(parseInt(e.target.value))}
              name="octane-dropdown-18"
            >
              {enumOptions.map((option, idx: number) => {
                const optValue = option.value ?? option.id ?? idx;
                const optLabel = option.label ?? option.name ?? String(optValue);
                return (
                  <option key={optValue} value={optValue}>
                    {optLabel}
                  </option>
                );
              })}
            </select>
          </div>
        );
      } else {
        // Regular integer input with spinners
        const intInfo = node.pinInfo?.intInfo;
        const useSliders = intInfo?.useSliders ?? true;
        const step = intInfo?.dimInfos?.[0]?.sliderStep ?? 1;

        controlHtml = (
          <div className="parameter-control-container">
            <div className="parameter-number-with-spinner">
              <input
                type="number"
                className="number-input parameter-control"
                value={intValue || 0}
                step={step}
                onChange={e => onValueChange(parseInt(e.target.value))}
                autoComplete="off"
                name="octane-number-input-18"
              />
              {useSliders && (
                <div className="parameter-spinner-container">
                  <button
                    className="parameter-spinner-btn"
                    onClick={() => onValueChange((intValue || 0) + step)}
                    title="Increase value"
                  >
                    ▲
                  </button>
                  <button
                    className="parameter-spinner-btn"
                    onClick={() => onValueChange((intValue || 0) - step)}
                    title="Decrease value"
                  >
                    ▼
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      }
      break;
    }

    case AttrType.AT_INT2: {
      if (value && typeof value === 'object' && 'x' in value) {
        const { x = 0, y = 0 } = value;
        const intInfo = node.pinInfo?.intInfo;
        const dimCount = intInfo?.dimCount ?? 2;

        controlHtml = (
          <div className="parameter-control-container">
            <DeferredInput
              type="text"
              className="number-input parameter-control"
              displayValue={String(x || 0)}
              onCommit={v => onValueChange({ x: parseInt(v) || 0, y })}
              autoComplete="off"
              name="octane-number-input-20"
            />
            {dimCount >= 2 && (
              <DeferredInput
                type="text"
                className="number-input parameter-control"
                displayValue={String(y || 0)}
                onCommit={v => onValueChange({ x, y: parseInt(v) || 0 })}
                autoComplete="off"
                name="octane-number-input-21"
              />
            )}
          </div>
        );
      }
      break;
    }

    case AttrType.AT_INT3: {
      if (value && typeof value === 'object' && 'x' in value) {
        const { x = 0, y = 0, z = 0 } = value;
        const intInfo = node.pinInfo?.intInfo;
        const dimCount = intInfo?.dimCount ?? 3;

        controlHtml = (
          <div className="parameter-control-container">
            <DeferredInput
              type="text"
              className="number-input parameter-control"
              displayValue={String(x || 0)}
              onCommit={v => onValueChange({ x: parseInt(v) || 0, y, z })}
              autoComplete="off"
              name="octane-number-input-22"
            />
            {dimCount >= 2 && (
              <DeferredInput
                type="text"
                className="number-input parameter-control"
                displayValue={String(y || 0)}
                onCommit={v => onValueChange({ x, y: parseInt(v) || 0, z })}
                autoComplete="off"
                name="octane-number-input-23"
              />
            )}
            {dimCount >= 3 && (
              <DeferredInput
                type="text"
                className="number-input parameter-control"
                displayValue={String(z || 0)}
                onCommit={v => onValueChange({ x, y, z: parseInt(v) || 0 })}
                autoComplete="off"
                name="octane-number-input-24"
              />
            )}
          </div>
        );
      }
      break;
    }

    case AttrType.AT_INT4: {
      if (value && typeof value === 'object' && 'x' in value) {
        const { x = 0, y = 0, z = 0, w = 0 } = value;
        const intInfo = node.pinInfo?.intInfo;
        const dimCount = intInfo?.dimCount ?? 4;

        const inputs = [];
        if (dimCount >= 1) {
          inputs.push(
            <DeferredInput
              key="x"
              type="text"
              className="number-input parameter-control"
              displayValue={String(x || 0)}
              onCommit={v => onValueChange({ x: parseInt(v) || 0, y, z, w })}
              autoComplete="off"
              name="octane-number-input-25"
            />
          );
        }
        if (dimCount >= 2) {
          inputs.push(
            <DeferredInput
              key="y"
              type="text"
              className="number-input parameter-control"
              displayValue={String(y || 0)}
              onCommit={v => onValueChange({ x, y: parseInt(v) || 0, z, w })}
              autoComplete="off"
              name="octane-number-input-26"
            />
          );
        }
        if (dimCount >= 3) {
          inputs.push(
            <DeferredInput
              key="z"
              type="text"
              className="number-input parameter-control"
              displayValue={String(z || 0)}
              onCommit={v => onValueChange({ x, y, z: parseInt(v) || 0, w })}
              autoComplete="off"
              name="octane-number-input-27"
            />
          );
        }
        if (dimCount >= 4) {
          inputs.push(
            <DeferredInput
              key="w"
              type="text"
              className="number-input parameter-control"
              displayValue={String(w || 0)}
              onCommit={v => onValueChange({ x, y, z, w: parseInt(v) || 0 })}
              autoComplete="off"
              name="octane-number-input-28"
            />
          );
        }

        controlHtml = <div className="parameter-control-container">{inputs}</div>;
      }
      break;
    }

    case AttrType.AT_LONG: {
      const longValue = typeof value === 'number' ? value : 0;
      controlHtml = (
        <div className="parameter-control-container">
          <div className="parameter-number-with-spinner">
            <input
              type="number"
              className="number-input parameter-control"
              value={longValue || 0}
              step="1"
              onChange={e => onValueChange(parseInt(e.target.value))}
              autoComplete="off"
              name="octane-number-input-29"
            />
            <div className="parameter-spinner-container">
              <button
                className="parameter-spinner-btn"
                onClick={() => onValueChange((longValue || 0) + 1)}
                title="Increase value"
              >
                ▲
              </button>
              <button
                className="parameter-spinner-btn"
                onClick={() => onValueChange((longValue || 0) - 1)}
                title="Decrease value"
              >
                ▼
              </button>
            </div>
          </div>
        </div>
      );
      break;
    }

    case AttrType.AT_LONG2: {
      if (value && typeof value === 'object' && 'x' in value) {
        const { x = 0, y = 0 } = value;
        controlHtml = (
          <div className="parameter-control-container">
            <DeferredInput
              type="text"
              className="number-input parameter-control"
              displayValue={String(x || 0)}
              onCommit={v => onValueChange({ x: parseInt(v) || 0, y })}
              autoComplete="off"
              name="octane-number-input-30"
            />
            <DeferredInput
              type="text"
              className="number-input parameter-control"
              displayValue={String(y || 0)}
              onCommit={v => onValueChange({ x, y: parseInt(v) || 0 })}
              autoComplete="off"
              name="octane-number-input-31"
            />
          </div>
        );
      }
      break;
    }

    case AttrType.AT_STRING: {
      const stringValue = typeof value === 'string' ? value : '';
      controlHtml = (
        <DeferredInput
          type="text"
          className="text-input parameter-control"
          displayValue={stringValue}
          onCommit={v => onValueChange(v)}
          autoComplete="off"
          name="octane-text-input-32"
        />
      );
      break;
    }

    default: {
      // For unknown types, render as text input
      const stringValue = typeof value === 'string' ? value : '';
      controlHtml = (
        <DeferredInput
          type="text"
          className="text-input parameter-control"
          displayValue={stringValue}
          onCommit={v => onValueChange(v)}
          autoComplete="off"
          name="octane-text-input-33"
        />
      );
      break;
    }
  }

  // Wrap in node-parameter-controls div (matching octaneWeb GenericNodeRenderer structure)
  return controlHtml ? <div className="node-parameter-controls">{controlHtml}</div> : null;
}

/**
 * Custom comparison function for React.memo
 * Compares node.handle and paramValue deeply to prevent unnecessary re-renders
 */
function arePropsEqual(
  prevProps: ParameterControlProps,
  nextProps: ParameterControlProps
): boolean {
  // Compare node handle (most important - if node changed, re-render)
  if (prevProps.node.handle !== nextProps.node.handle) {
    return false;
  }

  // Compare paramValue (null checks)
  if (prevProps.paramValue === null && nextProps.paramValue === null) {
    return true;
  }
  if (prevProps.paramValue === null || nextProps.paramValue === null) {
    return false;
  }

  // Compare paramValue type
  if (prevProps.paramValue.type !== nextProps.paramValue.type) {
    return false;
  }

  // Deep compare paramValue.value (handles primitives and objects like {x, y, z})
  const prevValue = prevProps.paramValue.value;
  const nextValue = nextProps.paramValue.value;

  if (typeof prevValue !== typeof nextValue) {
    return false;
  }

  if (typeof prevValue === 'object' && prevValue !== null && nextValue !== null) {
    // Compare object properties (for vectors like {x, y, z, w})
    const prevKeys = Object.keys(prevValue);
    const nextKeys = Object.keys(nextValue);

    if (prevKeys.length !== nextKeys.length) {
      return false;
    }

    for (const key of prevKeys) {
      if (prevValue[key] !== nextValue[key]) {
        return false;
      }
    }

    return true;
  }

  // Primitive comparison
  return prevValue === nextValue;
}

/**
 * Memoized ParameterControl component
 * Only re-renders when node handle or paramValue actually changes
 */
export const ParameterControl = memo(ParameterControlComponent, arePropsEqual);
