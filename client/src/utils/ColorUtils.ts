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
    const r = (value >> 16) & 0xFF;
    const g = (value >> 8) & 0xFF;
    const b = value & 0xFF;
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
    return {
      x: parseInt(hexColor.substring(1, 3), 16) / 255,
      y: parseInt(hexColor.substring(3, 5), 16) / 255,
      z: parseInt(hexColor.substring(5, 7), 16) / 255
    };
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
  const r = (nodeColor >> 16) & 0xFF;
  const g = (nodeColor >> 8) & 0xFF;
  const b = nodeColor & 0xFF;
  
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
    hex = hex.split('').map(char => char + char).join('');
  }
  
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  return { x: r, y: g, z: b };
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
 * Lighten a color by a percentage
 * 
 * @param hexColor - Hex color string
 * @param percent - Percentage to lighten (0-100)
 * @returns Lightened hex color string
 */
export function lightenColor(hexColor: string, percent: number): string {
  const rgb = hexToRGB(hexColor);
  const factor = 1 + (percent / 100);
  
  const r = Math.min(1, rgb.x * factor);
  const g = Math.min(1, rgb.y * factor);
  const b = Math.min(1, rgb.z * factor);
  
  return formatColorValue({ x: r, y: g, z: b });
}

/**
 * Darken a color by a percentage
 * 
 * @param hexColor - Hex color string
 * @param percent - Percentage to darken (0-100)
 * @returns Darkened hex color string
 */
export function darkenColor(hexColor: string, percent: number): string {
  const rgb = hexToRGB(hexColor);
  const factor = 1 - (percent / 100);
  
  const r = Math.max(0, rgb.x * factor);
  const g = Math.max(0, rgb.y * factor);
  const b = Math.max(0, rgb.z * factor);
  
  return formatColorValue({ x: r, y: g, z: b });
}

/**
 * Get contrasting text color (black or white) for a background color
 * 
 * @param hexColor - Background hex color string
 * @returns '#000000' or '#ffffff' for optimal contrast
 */
export function getContrastTextColor(hexColor: string): string {
  const rgb = hexToRGB(hexColor);
  
  // Calculate relative luminance using sRGB formula
  const luminance = 0.2126 * rgb.x + 0.7152 * rgb.y + 0.0722 * rgb.z;
  
  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Interpolate between two colors
 * 
 * @param color1 - First hex color
 * @param color2 - Second hex color
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated hex color
 */
export function interpolateColors(color1: string, color2: string, t: number): string {
  const rgb1 = hexToRGB(color1);
  const rgb2 = hexToRGB(color2);
  
  const r = rgb1.x + (rgb2.x - rgb1.x) * t;
  const g = rgb1.y + (rgb2.y - rgb1.y) * t;
  const b = rgb1.z + (rgb2.z - rgb1.z) * t;
  
  return formatColorValue({ x: r, y: g, z: b });
}
