/**
 * Pin Color Utilities
 * Handles pin color resolution with proper fallback logic
 */

import { formatColorValue } from './ColorUtils';
import { getPinTypeInfo } from '../constants/PinTypes';

/**
 * Get pin color with proper fallback logic:
 * 1. Use pinInfo.pinColor if available (from Octane gRPC API)
 * 2. Fall back to local color mapping by pin type (from C++ source in PinTypes.ts)
 * 3. Fall back to default amber if neither is available
 *
 * @param pinInfo - Pin information object from Octane
 * @returns Hex color string (e.g., '#ffc107')
 */
export function getPinColor(pinInfo: any): string {
  // Check for direct pin color from Octane (handles 0 as valid black color)
  if (pinInfo?.pinColor !== undefined && pinInfo?.pinColor !== null) {
    return formatColorValue(pinInfo.pinColor);
  }

  // Fall back to local color mapping by type (from PinTypes.ts - C++ source colors)
  if (pinInfo?.type) {
    try {
      const info = getPinTypeInfo(pinInfo.type);

      if (info) {
        return info.color;
      }
    } catch (e) {
      // Type not found in mapping, continue to default
      // Final fallback to amber
      return '#ffc107';
    }
  }
  // Final fallback to amber
  return '#ffc107';
}
