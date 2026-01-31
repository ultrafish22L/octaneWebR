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
 */

import React from 'react';
import { SceneNode } from '../../services/OctaneClient';
import { AttrType } from '../../constants/OctaneTypes';
import { formatColorValue } from '../../utils/ColorUtils';
import type { ParameterValue } from './hooks/useParameterValue';

/**
 * Format float value to maximum 6 decimal places
 */
function formatFloat(value: number): number {
  return parseFloat(value.toFixed(6));
}

type ParameterValueType = boolean | number | string | { x: number; y?: number; z?: number; w?: number };

interface ParameterControlProps {
  node: SceneNode;
  paramValue: ParameterValue | null;
  onValueChange: (_: ParameterValueType) => Promise<void>;
}

/**
 * Renders parameter controls based on attribute type
 */
export function ParameterControl({
  node,
  paramValue,
  onValueChange,
}: ParameterControlProps): React.JSX.Element | null {
  if (!paramValue) return null;

  const { value, type } = paramValue;

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
      const floatValue = typeof value === 'number' ? formatFloat(value) : 0;
      const floatInfo = node.pinInfo?.floatInfo;
      const useSliders = floatInfo?.useSliders ?? true;
      const step = floatInfo?.dimInfos?.[0]?.sliderStep ?? 0.001;

      controlHtml = (
        <div className="parameter-control-container">
          <div className="parameter-number-with-spinner">
            <input
              type="number"
              className="number-input parameter-control"
              value={floatValue || 0}
              step={step}
              onChange={e => onValueChange(formatFloat(parseFloat(e.target.value)))}
              autoComplete="off"
              name="octane-number-input-1"
            />
            {useSliders && (
              <div className="parameter-spinner-container">
                <button
                  className="parameter-spinner-btn"
                  onClick={() => onValueChange(formatFloat((floatValue || 0) + step))}
                  title="Increase value"
                >
                  ▲
                </button>
                <button
                  className="parameter-spinner-btn"
                  onClick={() => onValueChange(formatFloat((floatValue || 0) - step))}
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
        const step = floatInfo?.dimInfos?.[0]?.sliderStep ?? 0.001;

        controlHtml = (
          <div className="parameter-control-container">
            <input
              type="number"
              className="number-input parameter-control"
              value={formatFloat(x)}
              step={step}
              onChange={e => onValueChange({ x: formatFloat(parseFloat(e.target.value)), y })}
              autoComplete="off"
              name="octane-number-input-2"
            />
            {dimCount >= 2 && (
              <input
                type="number"
                className="number-input parameter-control"
                value={formatFloat(y)}
                step={step}
                onChange={e =>
                  onValueChange({ x, y: formatFloat(parseFloat(e.target.value)) })
                }
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
        const step = floatInfo?.dimInfos?.[0]?.sliderStep ?? 0.001;
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
                style={{ background: hexColor, color: hexColor }}
                onChange={e => {
                  const hex = e.target.value;
                  const r = parseInt(hex.substring(1, 3), 16) / 255;
                  const g = parseInt(hex.substring(3, 5), 16) / 255;
                  const b = parseInt(hex.substring(5, 7), 16) / 255;
                  onValueChange({ x: formatFloat(r), y: formatFloat(g), z: formatFloat(b) });
                }}
                autoComplete="off"
                name="octane-color-input-4"
              />
            </div>
          );
        } else {
          controlHtml = (
            <div className="parameter-control-container">
              <input
                type="number"
                className="number-input parameter-control"
                value={formatFloat(x)}
                step={step}
                onChange={e =>
                  onValueChange({ x: formatFloat(parseFloat(e.target.value)), y, z })
                }
                autoComplete="off"
                name="octane-number-input-5"
              />
              {dimCount >= 2 && (
                <input
                  type="number"
                  className="number-input parameter-control"
                  value={formatFloat(y)}
                  step={step}
                  onChange={e =>
                    onValueChange({ x, y: formatFloat(parseFloat(e.target.value)), z })
                  }
                  autoComplete="off"
                  name="octane-number-input-6"
                />
              )}
              {dimCount >= 3 && (
                <input
                  type="number"
                  className="number-input parameter-control"
                  value={formatFloat(z)}
                  step={step}
                  onChange={e =>
                    onValueChange({ x, y, z: formatFloat(parseFloat(e.target.value)) })
                  }
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
        const step = floatInfo?.dimInfos?.[0]?.sliderStep ?? 0.001;

        // Render based on dimension count (matching octaneWeb exactly)
        switch (dimCount) {
          case 1:
            controlHtml = (
              <div className="parameter-control-container">
                <input
                  type="number"
                  className="number-input parameter-control"
                  value={formatFloat(x)}
                  step={step}
                  onChange={e =>
                    onValueChange({ x: formatFloat(parseFloat(e.target.value)), y, z, w })
                  }
                  autoComplete="off"
                  name="octane-number-input-8"
                />
              </div>
            );
            break;
          case 2:
            controlHtml = (
              <div className="parameter-control-container">
                <input
                  type="number"
                  className="number-input parameter-control"
                  value={formatFloat(x)}
                  step={step}
                  onChange={e =>
                    onValueChange({ x: formatFloat(parseFloat(e.target.value)), y, z, w })
                  }
                  autoComplete="off"
                  name="octane-number-input-9"
                />
                <input
                  type="number"
                  className="number-input parameter-control"
                  value={formatFloat(y)}
                  step={step}
                  onChange={e =>
                    onValueChange({ x, y: formatFloat(parseFloat(e.target.value)), z, w })
                  }
                  autoComplete="off"
                  name="octane-number-input-10"
                />
              </div>
            );
            break;
          case 3:
            controlHtml = (
              <div className="parameter-control-container">
                <input
                  type="number"
                  className="number-input parameter-control"
                  value={formatFloat(x)}
                  step={step}
                  onChange={e =>
                    onValueChange({ x: formatFloat(parseFloat(e.target.value)), y, z, w })
                  }
                  autoComplete="off"
                  name="octane-number-input-11"
                />
                <input
                  type="number"
                  className="number-input parameter-control"
                  value={formatFloat(y)}
                  step={step}
                  onChange={e =>
                    onValueChange({ x, y: formatFloat(parseFloat(e.target.value)), z, w })
                  }
                  autoComplete="off"
                  name="octane-number-input-12"
                />
                <input
                  type="number"
                  className="number-input parameter-control"
                  value={formatFloat(z)}
                  step={step}
                  onChange={e =>
                    onValueChange({ x, y, z: formatFloat(parseFloat(e.target.value)), w })
                  }
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
                <input
                  type="number"
                  className="number-input parameter-control"
                  value={formatFloat(x)}
                  step={step}
                  onChange={e =>
                    onValueChange({ x: formatFloat(parseFloat(e.target.value)), y, z, w })
                  }
                  autoComplete="off"
                  name="octane-number-input-14"
                />
                <input
                  type="number"
                  className="number-input parameter-control"
                  value={formatFloat(y)}
                  step={step}
                  onChange={e =>
                    onValueChange({ x, y: formatFloat(parseFloat(e.target.value)), z, w })
                  }
                  autoComplete="off"
                  name="octane-number-input-15"
                />
                <input
                  type="number"
                  className="number-input parameter-control"
                  value={formatFloat(z)}
                  step={step}
                  onChange={e =>
                    onValueChange({ x, y, z: formatFloat(parseFloat(e.target.value)), w })
                  }
                  autoComplete="off"
                  name="octane-number-input-16"
                />
                <input
                  type="number"
                  className="number-input parameter-control"
                  value={formatFloat(w)}
                  step={step}
                  onChange={e =>
                    onValueChange({ x, y, z, w: formatFloat(parseFloat(e.target.value)) })
                  }
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
      break;
    }

    case AttrType.AT_INT2: {
      if (value && typeof value === 'object' && 'x' in value) {
        const { x = 0, y = 0 } = value;
        const intInfo = node.pinInfo?.intInfo;
        const dimCount = intInfo?.dimCount ?? 2;
        const step = intInfo?.dimInfos?.[0]?.sliderStep ?? 1;

        controlHtml = (
          <div className="parameter-control-container">
            <input
              type="number"
              className="number-input parameter-control"
              value={x || 0}
              step={step}
              onChange={e => onValueChange({ x: parseInt(e.target.value), y })}
              autoComplete="off"
              name="octane-number-input-20"
            />
            {dimCount >= 2 && (
              <input
                type="number"
                className="number-input parameter-control"
                value={y || 0}
                step={step}
                onChange={e => onValueChange({ x, y: parseInt(e.target.value) })}
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
        const step = intInfo?.dimInfos?.[0]?.sliderStep ?? 1;

        controlHtml = (
          <div className="parameter-control-container">
            <input
              type="number"
              className="number-input parameter-control"
              value={x || 0}
              step={step}
              onChange={e => onValueChange({ x: parseInt(e.target.value), y, z })}
              autoComplete="off"
              name="octane-number-input-22"
            />
            {dimCount >= 2 && (
              <input
                type="number"
                className="number-input parameter-control"
                value={y || 0}
                step={step}
                onChange={e => onValueChange({ x, y: parseInt(e.target.value), z })}
                autoComplete="off"
                name="octane-number-input-23"
              />
            )}
            {dimCount >= 3 && (
              <input
                type="number"
                className="number-input parameter-control"
                value={z || 0}
                step={step}
                onChange={e => onValueChange({ x, y, z: parseInt(e.target.value) })}
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
        const step = intInfo?.dimInfos?.[0]?.sliderStep ?? 1;

        const inputs = [];
        if (dimCount >= 1) {
          inputs.push(
            <input
              key="x"
              type="number"
              className="number-input parameter-control"
              value={x || 0}
              step={step}
              onChange={e => onValueChange({ x: parseInt(e.target.value), y, z, w })}
              autoComplete="off"
              name="octane-number-input-25"
            />
          );
        }
        if (dimCount >= 2) {
          inputs.push(
            <input
              key="y"
              type="number"
              className="number-input parameter-control"
              value={y || 0}
              step={step}
              onChange={e => onValueChange({ x, y: parseInt(e.target.value), z, w })}
              autoComplete="off"
              name="octane-number-input-26"
            />
          );
        }
        if (dimCount >= 3) {
          inputs.push(
            <input
              key="z"
              type="number"
              className="number-input parameter-control"
              value={z || 0}
              step={step}
              onChange={e => onValueChange({ x, y, z: parseInt(e.target.value), w })}
              autoComplete="off"
              name="octane-number-input-27"
            />
          );
        }
        if (dimCount >= 4) {
          inputs.push(
            <input
              key="w"
              type="number"
              className="number-input parameter-control"
              value={w || 0}
              step={step}
              onChange={e => onValueChange({ x, y, z, w: parseInt(e.target.value) })}
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
            <input
              type="number"
              className="number-input parameter-control"
              value={x || 0}
              step="1"
              onChange={e => onValueChange({ x: parseInt(e.target.value), y })}
              autoComplete="off"
              name="octane-number-input-30"
            />
            <input
              type="number"
              className="number-input parameter-control"
              value={y || 0}
              step="1"
              onChange={e => onValueChange({ x, y: parseInt(e.target.value) })}
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
        <input
          type="text"
          className="text-input parameter-control"
          value={stringValue}
          onChange={e => onValueChange(e.target.value)}
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
        <input
          type="text"
          className="text-input parameter-control"
          value={stringValue}
          onChange={e => onValueChange(e.target.value)}
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
