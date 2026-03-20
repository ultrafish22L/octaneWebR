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
  clayMode: 'none' | 'grey' | 'colored';
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
  showGizmoModeMenu: boolean;
  showClayModeMenu: boolean;
  showSubSampleMenu: boolean;
}

interface UseRenderSettingsProps {
  connected: boolean;
  client: OctaneClient;
  sceneReady?: boolean;
}

export function useRenderSettings({
  connected,
  client,
  sceneReady = false,
}: UseRenderSettingsProps): {
  state: ToolbarState;
  setState: Dispatch<SetStateAction<ToolbarState>>;
} {
  const [state, setState] = useState<ToolbarState>({
    realTimeMode: false,
    viewportLocked: false,
    clayMode: 'none',
    subSampling: 'none',
    renderPriority: 'normal',
    currentPickingMode: 'none',
    decalWireframe: false,
    worldCoordinateDisplay: true,
    objectControlMode: 'local',
    activeGizmo: 'none',
    viewportResolutionLock: false,
    showCameraPresetsMenu: false,
    showRenderPriorityMenu: false,
    showGizmoModeMenu: false,
    showClayModeMenu: false,
    showSubSampleMenu: false,
  });

  // Initialize rendering settings from Octane on connect
  useEffect(() => {
    if (!connected) return;

    const initializeRenderSettings = async () => {
      try {
        // Initialize clay mode — API returns enum strings
        const clayEnum = await client.getClayMode();
        const clayModeState =
          clayEnum.includes('COLOR') || clayEnum.includes('COLOUR')
            ? 'colored'
            : clayEnum.includes('GREY')
              ? 'grey'
              : 'none';
        setState(prev => ({ ...prev, clayMode: clayModeState }));
        Logger.debug('Clay mode initialized:', clayModeState, `(${clayEnum})`);

        // Initialize sub-sampling mode
        const subEnum = await client.getSubSampleMode();
        const subSamplingMode = subEnum.includes('4X4')
          ? '4x4'
          : subEnum.includes('2X2')
            ? '2x2'
            : 'none';
        setState(prev => ({ ...prev, subSampling: subSamplingMode }));
        Logger.debug('Sub-sampling initialized:', subSamplingMode, `(${subEnum})`);

        // Initialize render priority
        const priEnum = await client.getRenderPriority();
        const priorityState = priEnum.includes('LOW')
          ? 'low'
          : priEnum.includes('HIGH')
            ? 'high'
            : 'normal';
        setState(prev => ({ ...prev, renderPriority: priorityState }));
        Logger.debug('Render priority initialized:', priorityState, `(${priEnum})`);

        // Initialize real-time mode
        const realTimeValue = await client.getRealTime();
        setState(prev => ({ ...prev, realTimeMode: realTimeValue }));
        Logger.debug('Real-time mode initialized:', realTimeValue ? 'ON' : 'OFF');
      } catch (err) {
        Logger.error('Failed to initialize render settings:', err);
      }
    };

    initializeRenderSettings();
  }, [connected, client]);

  // RT-dependent settings — only query after scene tree is loaded (RT exists)
  useEffect(() => {
    if (!connected || !sceneReady) return;

    const initRTSettings = async () => {
      try {
        const resolutionLock = await client.getViewportResolutionLock();
        setState(prev => ({ ...prev, viewportResolutionLock: resolutionLock }));
        Logger.debug('Viewport resolution lock initialized:', resolutionLock ? 'ON' : 'OFF');
      } catch {
        // Film settings node may not exist in this scene
      }
    };
    initRTSettings();
  }, [connected, sceneReady, client]);

  return {
    state,
    setState,
  };
}
