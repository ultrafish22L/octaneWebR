/**
 * useRenderSettings Hook
 *
 * Manages render settings and toolbar state for RenderToolbar:
 * - Toolbar state management (ToolbarState interface)
 * - Initialize render settings from Octane (clay mode, sub-sampling, resolution lock)
 * - State updates for various toolbar controls
 *
 * Part of RenderToolbar component refactoring (Phase 2)
 */

import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import { OctaneClient } from '../../../services/OctaneClient';
import { Logger } from '../../../utils/Logger';

export interface ToolbarState {
  realTimeMode: boolean;
  viewportLocked: boolean;
  clayMode: boolean;
  subSampling: 'none' | '2x2' | '4x4';
  renderPriority: 'low' | 'normal' | 'high';
  currentPickingMode:
    | 'none'
    | 'focus'
    | 'whiteBalance'
    | 'material'
    | 'object'
    | 'cameraTarget'
    | 'renderRegion'
    | 'filmRegion';
  decalWireframe: boolean;
  worldCoordinateDisplay: boolean;
  objectControlMode: 'world' | 'local';
  activeGizmo: 'none' | 'translate' | 'rotate' | 'scale';
  viewportResolutionLock: boolean;
  showCameraPresetsMenu: boolean;
  showRenderPriorityMenu: boolean;
}

interface UseRenderSettingsProps {
  connected: boolean;
  client: OctaneClient;
}

export function useRenderSettings({ connected, client }: UseRenderSettingsProps): {
  state: ToolbarState;
  setState: Dispatch<SetStateAction<ToolbarState>>;
} {
  const [state, setState] = useState<ToolbarState>({
    realTimeMode: false,
    viewportLocked: false,
    clayMode: false,
    subSampling: 'none',
    renderPriority: 'normal',
    currentPickingMode: 'none',
    decalWireframe: false,
    worldCoordinateDisplay: true,
    objectControlMode: 'world',
    activeGizmo: 'none',
    viewportResolutionLock: false,
    showCameraPresetsMenu: false,
    showRenderPriorityMenu: false,
  });

  // Initialize rendering settings from Octane on connect
  useEffect(() => {
    if (!connected) return;

    const initializeRenderSettings = async () => {
      try {
        // Initialize clay mode
        const clayModeValue = await client.getClayMode();
        setState(prev => ({ ...prev, clayMode: clayModeValue !== 0 }));
        Logger.debug('🎨 Clay mode initialized:', clayModeValue === 0 ? 'OFF' : 'ON');

        // Initialize sub-sampling mode
        const subSampleValue = await client.getSubSampleMode();
        const subSamplingMode =
          subSampleValue === 2 ? '2x2' : subSampleValue === 4 ? '4x4' : 'none';
        setState(prev => ({ ...prev, subSampling: subSamplingMode }));
        Logger.debug('📐 Sub-sampling initialized:', subSamplingMode.toUpperCase());

        // Initialize viewport resolution lock
        const resolutionLock = await client.getViewportResolutionLock();
        setState(prev => ({ ...prev, viewportResolutionLock: resolutionLock }));
        Logger.debug('🔒 Viewport resolution lock initialized:', resolutionLock ? 'ON' : 'OFF');
      } catch (err) {
        Logger.error('❌ Failed to initialize render settings:', err);
      }
    };

    initializeRenderSettings();
  }, [connected, client]);

  return {
    state,
    setState,
  };
}
