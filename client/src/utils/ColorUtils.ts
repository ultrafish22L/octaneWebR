/**
 * Color Utility Functions
 *
 * Functions for converting between different color formats:
 * - RGB objects/arrays to hex strings
 * - Hex strings to RGB objects
 * - Octane packed uint32 colors to hex
 * - Node color formatting
 */

/**
 * Color value types from Octane
 */
export type ColorValue =
  | string // Hex string like "#FF0000"
  | number // Packed uint32 ARGB
  | { x: number; y: number; z: number } // RGB object (0-1)
  | [number, number, number] // RGB array (0-1)
  | [number, number, number, number]; // RGBA array (0-1)

/**
 * RGB color object (values 0-1)
 */
export interface RGBColor {
  x: number;
  y: number;
  z: number;
}

/**
 * Format color value for HTML color input
 * Converts various Octane color formats to hex string
 *
 * @param value - Color value (object, array, string, or number)
 * @returns Hex color string (#RRGGBB)
 */
export function formatColorValue(value: ColorValue): string {
  // Already a hex string
  if (typeof value === 'string' && value.startsWith('#')) {
    return value;
  }

  // Array format [r, g, b] or [r, g, b, a] where values are 0-1
  if (Array.isArray(value) && value.length >= 3) {
    const r = Math.round((value[0] || 0) * 255);
    const g = Math.round((value[1] || 0) * 255);
    const b = Math.round((value[2] || 0) * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // Object format {x, y, z} where values are 0-1
  if (typeof value === 'object' && value !== null && 'x' in value) {
    const r = Math.round((value.x || 0) * 255);
    const g = Math.round((value.y || 0) * 255);
    const b = Math.round((value.z || 0) * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // Number format (packed uint32)
  // Octane uses ARGB format: 0xAARRGGBB (Alpha, Red, Green, Blue)
  // Extract RGB bytes, ignoring alpha channel
  if (typeof value === 'number') {
    const r = (value >> 16) & 0xff;
    const g = (value >> 8) & 0xff;
    const b = value & 0xff;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // Default white
  return '#ffffff';
}

/**
 * Parse HTML color input to Octane RGB object
 * Converts hex string to RGB object with values 0-1
 *
 * @param hexColor - Hex color string (#RRGGBB)
 * @returns RGB color object {x, y, z} with values 0-1
 */
export function parseColorValue(hexColor: string): RGBColor {
  if (typeof hexColor === 'string' && hexColor.startsWith('#')) {
    let hex = hexColor.substring(1);

    // Expand 3-digit shorthand (#RGB -> RRGGBB)
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map(c => c + c)
        .join('');
    }

    if (hex.length >= 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        return { x: r / 255, y: g / 255, z: b / 255 };
      }
    }
  }

  // Default white
  return { x: 1, y: 1, z: 1 };
}

/**
 * Format node color from Octane color value
 * Specialized version for node header colors
 *
 * @param nodeColor - Color value from Octane (number or RGB object)
 * @returns Hex color string, or default gray if undefined
 */
export function formatNodeColor(nodeColor?: number | RGBColor): string {
  if (!nodeColor) {
    return '#666666'; // Default gray for undefined
  }

  // Handle object format {x, y, z}
  if (typeof nodeColor === 'object') {
    const r = Math.round((nodeColor.x || 0) * 255);
    const g = Math.round((nodeColor.y || 0) * 255);
    const b = Math.round((nodeColor.z || 0) * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // Handle number format (RGB packed)
  const r = (nodeColor >> 16) & 0xff;
  const g = (nodeColor >> 8) & 0xff;
  const b = nodeColor & 0xff;

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Convert RGB object to CSS rgba string
 *
 * @param color - RGB color object (0-1 values)
 * @param alpha - Optional alpha value (0-1)
 * @returns CSS rgba string
 */
export function rgbToRGBA(color: RGBColor, alpha: number = 1): string {
  const r = Math.round((color.x || 0) * 255);
  const g = Math.round((color.y || 0) * 255);
  const b = Math.round((color.z || 0) * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Convert hex color to RGB object
 *
 * @param hex - Hex color string (#RRGGBB or #RGB)
 * @returns RGB color object (0-1 values)
 */
export function hexToRGB(hex: string): RGBColor {
  // Remove # if present
  hex = hex.replace('#', '');

  // Handle 3-digit hex (#RGB -> #RRGGBB)
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map(char => char + char)
      .join('');
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Guard against malformed hex producing NaN
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return { x: 1, y: 1, z: 1 }; // Default white
  }

  return { x: r / 255, y: g / 255, z: b / 255 };
}

/**
 * Convert RGB object to array
 *
 * @param color - RGB color object (0-1 values)
 * @returns Array [r, g, b]
 */
export function rgbToArray(color: RGBColor): [number, number, number] {
  return [color.x, color.y, color.z];
}

/**
 * Convert array to RGB object
 *
 * @param arr - Array [r, g, b] (0-1 values)
 * @returns RGB color object
 */
export function arrayToRGB(arr: [number, number, number]): RGBColor {
  return { x: arr[0], y: arr[1], z: arr[2] };
}

/**
 * Convert hex color to HSL
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
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
export function hslToHex(h: number, s: number, l: number): string {
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
export function saturateColor(hex: string): string {
  const hsl = hexToHsl(hex);
  const mutedHex = hslToHex(hsl.h, Math.min(hsl.s, 44), hsl.l);
  const r = parseInt(mutedHex.slice(1, 3), 16);
  const g = parseInt(mutedHex.slice(3, 5), 16);
  const b = parseInt(mutedHex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.75)`;
}

/**
 * Darken and desaturate a node color to match Octane SE's muted, professional appearance.
 * Reduces lightness and saturation to produce subtle node backgrounds.
 */
export function muteNodeColor(hex: string): string {
  const hsl = hexToHsl(hex);
  const newL = Math.min(hsl.l * 0.5, 28);
  const newS = hsl.s * 0.12;
  return hslToHex(hsl.h, newS, newL);
}
