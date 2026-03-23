/**
 * Renderer Selection Hook
 *
 * Auto-detects the best available rendering backend based on environment:
 * - Electron + Windows + native addon → shared-surface
 * - Everything else → canvas2d (default)
 *
 * The selection is determined once at mount time and doesn't change.
 */

import { useMemo } from 'react';
import { isElectron, isWindows, hasNativeAddon } from '../../../utils/environment';
import type { RendererPreference, RendererSelection } from '../renderers/types';

/**
 * Determine which renderer backend to use.
 *
 * @param preferred - 'auto' (default), 'canvas2d', or 'shared-surface'
 * @returns The active renderer and reason for selection
 */
export function useRendererSelection(preferred: RendererPreference = 'auto'): RendererSelection {
  return useMemo(() => {
    // Explicit canvas2d preference — always honor
    if (preferred === 'canvas2d') {
      return { activeRenderer: 'canvas2d' as const, reason: 'User preference: canvas2d' };
    }

    // Check if shared surface conditions are met
    const inElectron = isElectron();
    const onWindows = isWindows();
    const addonAvailable = hasNativeAddon();

    if (preferred === 'shared-surface' || preferred === 'auto') {
      if (!inElectron) {
        return { activeRenderer: 'canvas2d' as const, reason: 'Not running in Electron' };
      }
      if (!onWindows) {
        return {
          activeRenderer: 'canvas2d' as const,
          reason: 'DX shared surfaces require Windows',
        };
      }
      if (!addonAvailable) {
        return { activeRenderer: 'canvas2d' as const, reason: 'Native DX addon not loaded' };
      }
      // All conditions met — use shared surface
      return { activeRenderer: 'shared-surface' as const, reason: 'DX shared surface available' };
    }

    return { activeRenderer: 'canvas2d' as const, reason: 'Default fallback' };
  }, [preferred]);
}
