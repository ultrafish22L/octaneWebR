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

import React, { memo, useState, useRef, useCallback, useEffect } from 'react';
import { SceneNode } from '../../services/OctaneClient';
import { AttrType } from '../../constants/OctaneTypes';
import { formatColorValue } from '../../utils/ColorUtils';
import { Logger } from '../../utils/Logger';
import type { ParameterValue } from './hooks/useParameterValue';

/**
 * Format float value for display (matches Octane's formatting):
 * - Very large values (>= 1e9) show as ∞
 * - Snaps to 3 decimal places when float32 noise is the only extra precision
 * - Shows up to 6 decimal places for values with real precision
 * Examples: 36 → "36.000", 50.000004 → "50.000", 0.892857 → "0.892857"
 */
function formatFloatForDisplay(value: number): string {
  // Show infinity symbol for very large values (matches Octane)
  if (Math.abs(value) >= 1e9) return '∞';

  // Try snapping to 3 decimal places — if the difference is just float32 noise
  // (< 1e-5), use the cleaner 3-decimal value. Otherwise keep full 6 decimals.
  const round3 = Math.round(value * 1e3) / 1e3;
  const useClean = Math.abs(value - round3) < 1e-5;
  const base = useClean ? round3 : value;

  const str = base.toFixed(6);
  const [intPart, decPart] = str.split('.');

  // Keep first 3 decimals, then remove trailing zeros from remaining 3
  const minDecimals = decPart.slice(0, 3);
  const extraDecimals = decPart.slice(3).replace(/0+$/, '');

  return `${intPart}.${minDecimals}${extraDecimals}`;
}

/**
 * Format float as percentage for display (value 0.5 → "50.0%", 1.0 → "100.0%")
 * Octane stores percentages as 0–1 floats but displays them as 0–100%.
 */
function formatPercentForDisplay(value: number): string {
  const pct = value * 100;
  // Use 1 decimal place like Octane (e.g., "0.0%", "50.0%", "100.0%")
  return `${pct.toFixed(1)}%`;
}

/**
 * Parse float value from input (handles string input)
 */
function parseFloatValue(value: string | number): number {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

/**
 * Parse percentage input back to 0–1 float ("50%" or "50" → 0.5)
 */
function parsePercentValue(value: string | number): number {
  const str = String(value).replace('%', '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num / 100;
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

/**
 * Octane-style number input with left/right arrow buttons and background scrub bar.
 * Used for single-value numeric fields (AT_FLOAT, AT_INT, AT_LONG).
 */
function NumberInput({
  value,
  onCommit,
  step,
  min,
  max,
  format,
  parse,
}: {
  value: number;
  onCommit: (value: number) => void;
  step: number;
  min?: number;
  max?: number;
  format: (n: number) => string;
  parse: (s: string) => number;
}) {
  const [localValue, setLocalValue] = useState(format(value));
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartValue = useRef(0);

  // Auto-hide arrows when container is narrow
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setNarrow(entry.contentRect.width < 80);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compute scrub bar fill percentage
  const scrubMin = min ?? 0;
  const scrubMax = max ?? (value > 0 ? value * 2 : value < 0 ? -value * 2 : 1);
  const range = scrubMax - scrubMin;
  const fillPct = range > 0 ? Math.max(0, Math.min(100, ((value - scrubMin) / range) * 100)) : 0;

  const inputRef = useRef<HTMLInputElement>(null);

  const handleScrubDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Arrows handle their own clicks
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      e.preventDefault();
      dragStartX.current = e.clientX;
      dragStartValue.current = value;
      let didDrag = false;

      const onMove = (me: MouseEvent) => {
        if (!didDrag && Math.abs(me.clientX - dragStartX.current) > 3) {
          didDrag = true;
          setDragging(true);
        }
        if (didDrag && range > 0) {
          const r = containerRef.current?.getBoundingClientRect();
          if (!r) return;
          const pct = Math.max(0, Math.min(1, (me.clientX - r.left) / r.width));
          const newVal = scrubMin + pct * range;
          const snapped = Math.round(newVal / step) * step;
          onCommit(snapped);
        }
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        if (didDrag) {
          setDragging(false);
        } else {
          // Click without drag — enter text edit mode
          setFocused(true);
          setLocalValue(format(value));
          setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
          }, 0);
        }
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [value, step, scrubMin, range, onCommit, format]
  );

  return (
    <div
      ref={containerRef}
      className={`number-control${narrow ? ' narrow' : ''}${dragging ? ' dragging' : ''}`}
      onMouseDown={handleScrubDown}
      role="slider"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={-1}
    >
      <div className="number-control-scrub">
        <div className="number-control-scrub-fill" style={{ width: `${fillPct}%` }} />
      </div>
      {!narrow && (
        <button
          className="number-control-arrow number-control-arrow-left"
          onClick={e => {
            e.stopPropagation();
            onCommit(parse(format(value - step)));
          }}
          title="Decrease value"
          type="button"
        >
          &#9664;
        </button>
      )}
      <input
        ref={inputRef}
        type="text"
        className="number-input number-control-input"
        value={focused ? localValue : format(value)}
        onChange={e => setLocalValue(e.target.value)}
        onMouseDown={e => {
          if (!focused) e.preventDefault();
        }}
        onFocus={() => {
          setFocused(true);
          setLocalValue(format(value));
        }}
        onBlur={() => {
          setFocused(false);
          onCommit(parse(localValue));
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        autoComplete="off"
      />
      {!narrow && (
        <button
          className="number-control-arrow number-control-arrow-right"
          onClick={e => {
            e.stopPropagation();
            onCommit(parse(format(value + step)));
          }}
          title="Increase value"
          type="button"
        >
          &#9654;
        </button>
      )}
    </div>
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
      const step = Number(floatInfo?.dimInfos?.[0]?.sliderStep) || 0.001;
      const sliderMin = floatInfo?.dimInfos?.[0]?.minValue;
      const sliderMax = floatInfo?.dimInfos?.[0]?.maxValue;

      controlHtml = (
        <div className="parameter-control-container">
          <NumberInput
            value={floatValue}
            onCommit={v => onValueChange(v)}
            step={step}
            min={sliderMin != null ? Number(sliderMin) : undefined}
            max={sliderMax != null ? Number(sliderMax) : undefined}
            format={formatFloatForDisplay}
            parse={parseFloatValue}
          />
        </div>
      );
      break;
    }

    case AttrType.AT_FLOAT2: {
      if (value && typeof value === 'object' && 'x' in value) {
        const { x = 0, y = 0 } = value;
        const floatInfo = node.pinInfo?.floatInfo;
        const dimCount = floatInfo?.dimCount ?? 2;
        const step = Number(floatInfo?.dimInfos?.[0]?.sliderStep) || 0.001;
        const dimMin = floatInfo?.dimInfos?.[0]?.minValue;
        const dimMax = floatInfo?.dimInfos?.[0]?.maxValue;
        const isPct = !!floatInfo?.displayPercentages;
        const fmt = isPct ? formatPercentForDisplay : formatFloatForDisplay;
        const prs = isPct ? parsePercentValue : parseFloatValue;

        if (dimCount === 1) {
          controlHtml = (
            <div className="parameter-control-container">
              <NumberInput
                value={isPct ? x * 100 : x}
                onCommit={v => onValueChange({ x: isPct ? v / 100 : v, y })}
                step={isPct ? 0.1 : step}
                min={dimMin != null ? Number(dimMin) * (isPct ? 100 : 1) : undefined}
                max={dimMax != null ? Number(dimMax) * (isPct ? 100 : 1) : undefined}
                format={isPct ? (v: number) => `${v.toFixed(1)}%` : formatFloatForDisplay}
                parse={parseFloatValue}
              />
            </div>
          );
        } else {
          controlHtml = (
            <div className="parameter-control-container">
              <DeferredInput
                type="text"
                className="number-input parameter-control"
                displayValue={fmt(x)}
                onCommit={v => onValueChange({ x: prs(v), y })}
                autoComplete="off"
                name="octane-number-input-2"
              />
              {dimCount >= 2 && (
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={fmt(y)}
                  onCommit={v => onValueChange({ x, y: prs(v) })}
                  autoComplete="off"
                  name="octane-number-input-3"
                />
              )}
            </div>
          );
        }
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
        } else if (dimCount === 1) {
          const step = Number(floatInfo?.dimInfos?.[0]?.sliderStep) || 0.001;
          const dimMin = floatInfo?.dimInfos?.[0]?.minValue;
          const dimMax = floatInfo?.dimInfos?.[0]?.maxValue;
          const isPct3 = !!floatInfo?.displayPercentages;
          controlHtml = (
            <div className="parameter-control-container">
              <NumberInput
                value={isPct3 ? x * 100 : x}
                onCommit={v => onValueChange({ x: isPct3 ? v / 100 : v, y, z })}
                step={isPct3 ? 0.1 : step}
                min={dimMin != null ? Number(dimMin) * (isPct3 ? 100 : 1) : undefined}
                max={dimMax != null ? Number(dimMax) * (isPct3 ? 100 : 1) : undefined}
                format={isPct3 ? (v: number) => `${v.toFixed(1)}%` : formatFloatForDisplay}
                parse={parseFloatValue}
              />
            </div>
          );
        } else {
          const isPct3 = !!floatInfo?.displayPercentages;
          const fmt3 = isPct3 ? formatPercentForDisplay : formatFloatForDisplay;
          const prs3 = isPct3 ? parsePercentValue : parseFloatValue;
          controlHtml = (
            <div className="parameter-control-container">
              <DeferredInput
                type="text"
                className="number-input parameter-control"
                displayValue={fmt3(x)}
                onCommit={v => onValueChange({ x: prs3(v), y, z })}
                autoComplete="off"
                name="octane-number-input-5"
              />
              {dimCount >= 2 && (
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={fmt3(y)}
                  onCommit={v => onValueChange({ x, y: prs3(v), z })}
                  autoComplete="off"
                  name="octane-number-input-6"
                />
              )}
              {dimCount >= 3 && (
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={fmt3(z)}
                  onCommit={v => onValueChange({ x, y, z: prs3(v) })}
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
        const isPct4 = !!floatInfo?.displayPercentages;
        const fmt4 = isPct4 ? formatPercentForDisplay : formatFloatForDisplay;
        const prs4 = isPct4 ? parsePercentValue : parseFloatValue;

        // Render based on dimension count (matching octaneWeb exactly)
        const f4step = Number(floatInfo?.dimInfos?.[0]?.sliderStep) || 0.001;
        const f4min = floatInfo?.dimInfos?.[0]?.minValue;
        const f4max = floatInfo?.dimInfos?.[0]?.maxValue;

        switch (dimCount) {
          case 1:
            controlHtml = (
              <div className="parameter-control-container">
                <NumberInput
                  value={isPct4 ? x * 100 : x}
                  onCommit={v => onValueChange({ x: isPct4 ? v / 100 : v, y, z, w })}
                  step={isPct4 ? 0.1 : f4step}
                  min={f4min != null ? Number(f4min) * (isPct4 ? 100 : 1) : undefined}
                  max={f4max != null ? Number(f4max) * (isPct4 ? 100 : 1) : undefined}
                  format={isPct4 ? (v: number) => `${v.toFixed(1)}%` : formatFloatForDisplay}
                  parse={parseFloatValue}
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
                  displayValue={fmt4(x)}
                  onCommit={v => onValueChange({ x: prs4(v), y, z, w })}
                  autoComplete="off"
                  name="octane-number-input-9"
                />
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={fmt4(y)}
                  onCommit={v => onValueChange({ x, y: prs4(v), z, w })}
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
                  displayValue={fmt4(x)}
                  onCommit={v => onValueChange({ x: prs4(v), y, z, w })}
                  autoComplete="off"
                  name="octane-number-input-11"
                />
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={fmt4(y)}
                  onCommit={v => onValueChange({ x, y: prs4(v), z, w })}
                  autoComplete="off"
                  name="octane-number-input-12"
                />
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={fmt4(z)}
                  onCommit={v => onValueChange({ x, y, z: prs4(v), w })}
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
                  displayValue={fmt4(x)}
                  onCommit={v => onValueChange({ x: prs4(v), y, z, w })}
                  autoComplete="off"
                  name="octane-number-input-14"
                />
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={fmt4(y)}
                  onCommit={v => onValueChange({ x, y: prs4(v), z, w })}
                  autoComplete="off"
                  name="octane-number-input-15"
                />
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={fmt4(z)}
                  onCommit={v => onValueChange({ x, y, z: prs4(v), w })}
                  autoComplete="off"
                  name="octane-number-input-16"
                />
                <DeferredInput
                  type="text"
                  className="number-input parameter-control"
                  displayValue={fmt4(w)}
                  onCommit={v => onValueChange({ x, y, z, w: prs4(v) })}
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
        // Regular integer input with Octane-style arrows
        const intInfo = node.pinInfo?.intInfo;
        const step = intInfo?.dimInfos?.[0]?.sliderStep ?? 1;
        const sliderMin = intInfo?.dimInfos?.[0]?.minValue;
        const sliderMax = intInfo?.dimInfos?.[0]?.maxValue;

        controlHtml = (
          <div className="parameter-control-container">
            <NumberInput
              value={intValue}
              onCommit={v => onValueChange(Math.round(v))}
              step={step}
              min={sliderMin != null ? Number(sliderMin) : undefined}
              max={sliderMax != null ? Number(sliderMax) : undefined}
              format={n => String(Math.round(n))}
              parse={s => parseInt(s) || 0}
            />
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

        if (dimCount === 1) {
          const step = intInfo?.dimInfos?.[0]?.sliderStep ?? 1;
          const dimMin = intInfo?.dimInfos?.[0]?.minValue;
          const dimMax = intInfo?.dimInfos?.[0]?.maxValue;
          controlHtml = (
            <div className="parameter-control-container">
              <NumberInput
                value={x}
                onCommit={v => onValueChange({ x: Math.round(v), y })}
                step={step}
                min={dimMin != null ? Number(dimMin) : undefined}
                max={dimMax != null ? Number(dimMax) : undefined}
                format={n => String(Math.round(n))}
                parse={s => parseInt(s) || 0}
              />
            </div>
          );
        } else {
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
      }
      break;
    }

    case AttrType.AT_INT3: {
      if (value && typeof value === 'object' && 'x' in value) {
        const { x = 0, y = 0, z = 0 } = value;
        const intInfo = node.pinInfo?.intInfo;
        const dimCount = intInfo?.dimCount ?? 3;

        if (dimCount === 1) {
          const step = intInfo?.dimInfos?.[0]?.sliderStep ?? 1;
          const dimMin = intInfo?.dimInfos?.[0]?.minValue;
          const dimMax = intInfo?.dimInfos?.[0]?.maxValue;
          controlHtml = (
            <div className="parameter-control-container">
              <NumberInput
                value={x}
                onCommit={v => onValueChange({ x: Math.round(v), y, z })}
                step={step}
                min={dimMin != null ? Number(dimMin) : undefined}
                max={dimMax != null ? Number(dimMax) : undefined}
                format={n => String(Math.round(n))}
                parse={s => parseInt(s) || 0}
              />
            </div>
          );
        } else {
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
      }
      break;
    }

    case AttrType.AT_INT4: {
      if (value && typeof value === 'object' && 'x' in value) {
        const { x = 0, y = 0, z = 0, w = 0 } = value;
        const intInfo = node.pinInfo?.intInfo;
        const dimCount = intInfo?.dimCount ?? 4;

        if (dimCount === 1) {
          const step = intInfo?.dimInfos?.[0]?.sliderStep ?? 1;
          const dimMin = intInfo?.dimInfos?.[0]?.minValue;
          const dimMax = intInfo?.dimInfos?.[0]?.maxValue;
          controlHtml = (
            <div className="parameter-control-container">
              <NumberInput
                value={x}
                onCommit={v => onValueChange({ x: Math.round(v), y, z, w })}
                step={step}
                min={dimMin != null ? Number(dimMin) : undefined}
                max={dimMax != null ? Number(dimMax) : undefined}
                format={n => String(Math.round(n))}
                parse={s => parseInt(s) || 0}
              />
            </div>
          );
        } else {
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
      }
      break;
    }

    case AttrType.AT_LONG: {
      const longValue = typeof value === 'number' ? value : 0;
      controlHtml = (
        <div className="parameter-control-container">
          <NumberInput
            value={longValue}
            onCommit={v => onValueChange(Math.round(v))}
            step={1}
            format={n => String(Math.round(n))}
            parse={s => parseInt(s) || 0}
          />
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
