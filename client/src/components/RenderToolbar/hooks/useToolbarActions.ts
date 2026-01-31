/**
 * useToolbarActions Hook
 *
 * Manages toolbar button actions and state for RenderToolbar:
 * - Main toolbar action handler (handleToolbarAction)
 * - Picking mode toggles (focus, white balance, material, etc.)
 * - Gizmo toggles (translate, rotate, scale)
 * - Button active state helper (getButtonActiveClass)
 * - Render controls (start, stop, pause, restart)
 * - Render settings (clay mode, sub-sampling, resolution lock)
 * - Output controls (copy, save, export)
 * - Viewport controls
 *
 * Part of RenderToolbar component refactoring (Phase 4)
 */

import { useCallback, Dispatch, SetStateAction } from 'react';
import { OctaneClient } from '../../../services/OctaneClient';
import { Logger } from '../../../utils/Logger';
import { ToolbarState } from './useRenderSettings';
import { RenderStats } from './useGPUData';

interface UseToolbarActionsProps {
  client: OctaneClient;
  state: ToolbarState;
  setState: Dispatch<SetStateAction<ToolbarState>>;
  setRenderStats: Dispatch<SetStateAction<RenderStats>>;
  onRecenterView?: () => void;
  onCopyToClipboard?: () => void;
  onSaveRender?: () => void;
  onExportPasses?: () => void;
  onViewportLockChange?: (locked: boolean) => void;
  onPickingModeChange?: (
    mode:
      | 'none'
      | 'focus'
      | 'whiteBalance'
      | 'material'
      | 'object'
      | 'cameraTarget'
      | 'renderRegion'
      | 'filmRegion'
  ) => void;
  onToggleWorldCoord?: () => void;
}

export function useToolbarActions({
  client,
  state,
  setState,
  setRenderStats,
  onRecenterView,
  onCopyToClipboard,
  onSaveRender,
  onExportPasses,
  onViewportLockChange,
  onPickingModeChange,
  onToggleWorldCoord,
}: UseToolbarActionsProps) {
  // ========================================
  // TOGGLE FUNCTIONS
  // ========================================

  const togglePickingMode = useCallback(
    (mode: ToolbarState['currentPickingMode']) => {
      const newMode = state.currentPickingMode === mode ? 'none' : mode;
      setState(prev => ({
        ...prev,
        currentPickingMode: newMode,
      }));
      Logger.debug(`🎯 Picking mode: ${newMode}`);

      // Notify parent component of picking mode change
      if (onPickingModeChange) {
        onPickingModeChange(newMode);
      }
    },
    [state.currentPickingMode, setState, onPickingModeChange]
  );

  const toggleGizmo = useCallback(
    (gizmo: 'translate' | 'rotate' | 'scale') => {
      setState(prev => ({
        ...prev,
        activeGizmo: prev.activeGizmo === gizmo ? 'none' : gizmo,
      }));
      Logger.debug(`Active gizmo: ${state.activeGizmo === gizmo ? 'none' : gizmo}`);
      // TODO: API calls for gizmos
    },
    [state.activeGizmo, setState]
  );

  // ========================================
  // BUTTON ACTIVE CLASS HELPER
  // ========================================

  const getButtonActiveClass = useCallback(
    (buttonId: string): string => {
      switch (buttonId) {
        case 'real-time-render':
          return state.realTimeMode ? 'active' : '';
        case 'lock-viewport':
          return state.viewportLocked ? 'active' : '';
        case 'clay-mode':
          return state.clayMode ? 'active' : '';
        case 'subsample-2x2':
          return state.subSampling === '2x2' ? 'active' : '';
        case 'subsample-4x4':
          return state.subSampling === '4x4' ? 'active' : '';
        case 'decal-wireframe':
          return state.decalWireframe ? 'active' : '';
        case 'viewport-resolution-lock':
          return state.viewportResolutionLock ? 'active' : '';
        case 'object-control-alignment':
          return state.objectControlMode === 'world' ? 'active' : '';
        case 'translate-gizmo':
          return state.activeGizmo === 'translate' ? 'active' : '';
        case 'rotate-gizmo':
          return state.activeGizmo === 'rotate' ? 'active' : '';
        case 'scale-gizmo':
          return state.activeGizmo === 'scale' ? 'active' : '';
        case 'world-coordinate':
          return state.worldCoordinateDisplay ? 'active' : '';
        case 'focus-picker':
          return state.currentPickingMode === 'focus' ? 'active' : '';
        case 'white-balance-picker':
          return state.currentPickingMode === 'whiteBalance' ? 'active' : '';
        case 'material-picker':
          return state.currentPickingMode === 'material' ? 'active' : '';
        case 'object-picker':
          return state.currentPickingMode === 'object' ? 'active' : '';
        case 'camera-target-picker':
          return state.currentPickingMode === 'cameraTarget' ? 'active' : '';
        case 'render-region-picker':
          return state.currentPickingMode === 'renderRegion' ? 'active' : '';
        case 'film-region-picker':
          return state.currentPickingMode === 'filmRegion' ? 'active' : '';
        default:
          return '';
      }
    },
    [state]
  );

  // ========================================
  // TOOLBAR ACTIONS
  // ========================================

  const handleToolbarAction = useCallback(
    (actionId: string) => {
      Logger.debug(`🔧 RenderToolbar action: ${actionId}`);

      switch (actionId) {
        // Camera & View Controls
        case 'recenter-view':
          Logger.debug('⌖ Recenter view - resetting 2D canvas transform');
          onRecenterView?.();
          break;
        case 'reset-camera':
          Logger.debug('📷 Reset camera to original position');
          client
            .resetCamera()
            .then(() => {
              Logger.debug('✅ Camera reset successful');
            })
            .catch(err => {
              Logger.error('❌ Failed to reset camera:', err);
            });
          break;
        case 'camera-presets':
          setState(prev => ({ ...prev, showCameraPresetsMenu: !prev.showCameraPresetsMenu }));
          Logger.debug('📸 Camera presets menu:', !state.showCameraPresetsMenu ? 'OPEN' : 'CLOSED');
          break;

        // Render Controls
        case 'stop-render':
          Logger.debug('🛑 Stop render');
          client
            .stopRender()
            .then(() => {
              setRenderStats(prev => ({ ...prev, status: 'stopped' }));
            })
            .catch(err => {
              Logger.error('❌ Failed to stop render:', err);
            });
          break;
        case 'restart-render':
          Logger.debug('🔄 Restart render');
          client
            .restartRender()
            .then(() => {
              setRenderStats(prev => ({
                ...prev,
                currentSamples: 0,
                currentTime: '00:00:00',
                status: 'rendering',
              }));
            })
            .catch(err => {
              Logger.error('❌ Failed to restart render:', err);
            });
          break;
        case 'pause-render':
          Logger.debug('⏸️ Pause render');
          client
            .pauseRender()
            .then(() => {
              setRenderStats(prev => ({ ...prev, status: 'paused' }));
            })
            .catch(err => {
              Logger.error('❌ Failed to pause render:', err);
            });
          break;
        case 'start-render':
          Logger.debug('▶️ Start render');
          client
            .startRender()
            .then(() => {
              setRenderStats(prev => ({ ...prev, status: 'rendering' }));
            })
            .catch(err => {
              Logger.error('❌ Failed to start render:', err);
            });
          break;
        case 'real-time-render': {
          const newRealTimeMode = !state.realTimeMode;
          setState(prev => ({ ...prev, realTimeMode: newRealTimeMode }));
          Logger.debug(`⚡ Real-time mode: ${newRealTimeMode ? 'ON' : 'OFF'}`);
          // Real-time mode uses high priority for interactive experience
          // Set render priority: high for real-time, normal for standard
          const rtPriority = newRealTimeMode ? 2 : 1; // 0=low, 1=normal, 2=high
          client
            .callApi('ApiRenderEngine', 'setRenderPriority', { priority: rtPriority })
            .then(() => {
              const priorityName = newRealTimeMode ? 'HIGH' : 'NORMAL';
              Logger.debug(
                `✅ Real-time mode ${newRealTimeMode ? 'enabled' : 'disabled'} - priority set to ${priorityName}`
              );
              setState(prev => ({ ...prev, renderPriority: newRealTimeMode ? 'high' : 'normal' }));
            })
            .catch(err => {
              Logger.error('❌ Failed to set real-time rendering priority:', err);
              setState(prev => ({ ...prev, realTimeMode: state.realTimeMode })); // Revert on error
            });
          break;
        }

        // Picking Tools
        case 'focus-picker':
          togglePickingMode('focus');
          break;
        case 'white-balance-picker':
          togglePickingMode('whiteBalance');
          break;
        case 'material-picker':
          togglePickingMode('material');
          break;
        case 'object-picker':
          togglePickingMode('object');
          break;
        case 'camera-target-picker':
          togglePickingMode('cameraTarget');
          break;

        // Region Tools
        case 'render-region-picker':
          togglePickingMode('renderRegion');
          break;
        case 'film-region-picker':
          togglePickingMode('filmRegion');
          break;

        // Rendering Settings
        case 'clay-mode': {
          const newClayMode = !state.clayMode;
          setState(prev => ({ ...prev, clayMode: newClayMode }));
          Logger.debug(`🎨 Clay mode: ${newClayMode ? 'ON' : 'OFF'}`);
          // CLAY_MODE_NONE = 0, CLAY_MODE_GREY = 1
          client
            .setClayMode(newClayMode ? 1 : 0)
            .then(() => {
              Logger.debug('✅ Clay mode updated in Octane');
            })
            .catch(err => {
              Logger.error('❌ Failed to set clay mode:', err);
              // Revert UI state on error
              setState(prev => ({ ...prev, clayMode: !newClayMode }));
            });
          break;
        }
        case 'subsample-2x2': {
          const new2x2Mode = state.subSampling === '2x2' ? 'none' : '2x2';
          setState(prev => ({ ...prev, subSampling: new2x2Mode }));
          Logger.debug(`📐 Sub-sampling 2x2: ${new2x2Mode === '2x2' ? 'ON' : 'OFF'}`);
          // SUBSAMPLEMODE_NONE = 1, SUBSAMPLEMODE_2X2 = 2
          client
            .setSubSampleMode(new2x2Mode === '2x2' ? 2 : 1)
            .then(() => {
              Logger.debug('✅ Sub-sampling mode updated in Octane');
            })
            .catch(err => {
              Logger.error('❌ Failed to set sub-sampling mode:', err);
              setState(prev => ({ ...prev, subSampling: state.subSampling }));
            });
          break;
        }
        case 'subsample-4x4': {
          const new4x4Mode = state.subSampling === '4x4' ? 'none' : '4x4';
          setState(prev => ({ ...prev, subSampling: new4x4Mode }));
          Logger.debug(`📐 Sub-sampling 4x4: ${new4x4Mode === '4x4' ? 'ON' : 'OFF'}`);
          // SUBSAMPLEMODE_NONE = 1, SUBSAMPLEMODE_4X4 = 4
          client
            .setSubSampleMode(new4x4Mode === '4x4' ? 4 : 1)
            .then(() => {
              Logger.debug('✅ Sub-sampling mode updated in Octane');
            })
            .catch(err => {
              Logger.error('❌ Failed to set sub-sampling mode:', err);
              setState(prev => ({ ...prev, subSampling: state.subSampling }));
            });
          break;
        }
        case 'decal-wireframe':
          setState(prev => ({ ...prev, decalWireframe: !prev.decalWireframe }));
          Logger.debug(
            `🟡 Decal wireframe: ${!state.decalWireframe ? 'ON' : 'OFF'} (UI only - no gRPC API available)`
          );
          // NOTE: No gRPC API method exists for this feature in apirender_pb2_grpc.py
          // Feature exists in Octane SE manual but not exposed through LiveLink API
          // UI state tracked for future implementation when API becomes available
          break;
        case 'render-priority':
          setState(prev => ({ ...prev, showRenderPriorityMenu: !prev.showRenderPriorityMenu }));
          Logger.debug(
            '⚙️ Render priority menu:',
            !state.showRenderPriorityMenu ? 'OPEN' : 'CLOSED'
          );
          break;

        // Output Controls
        case 'copy-clipboard':
          Logger.debug('📋 Copy render to clipboard');
          if (onCopyToClipboard) {
            onCopyToClipboard();
          } else {
            Logger.warn('⚠️ onCopyToClipboard handler not provided');
          }
          break;
        case 'save-render':
          Logger.debug('💾 Save render to disk');
          if (onSaveRender) {
            onSaveRender();
          } else {
            Logger.warn('⚠️ onSaveRender handler not provided');
          }
          break;
        case 'export-passes':
          Logger.debug('📤 Export render passes');
          if (onExportPasses) {
            onExportPasses();
          } else {
            Logger.warn('⚠️ onExportPasses handler not provided');
          }
          break;
        case 'background-image':
          Logger.debug('Set background image');
          // TODO: Show file dialog for background image
          break;

        // Viewport Controls
        case 'viewport-resolution-lock': {
          const newResLockState = !state.viewportResolutionLock;
          setState(prev => ({ ...prev, viewportResolutionLock: newResLockState }));
          Logger.debug(`🔒 Viewport resolution lock: ${newResLockState ? 'ON' : 'OFF'}`);
          client
            .setViewportResolutionLock(newResLockState)
            .then(() => {
              Logger.debug('✅ Viewport resolution lock updated in Octane');
            })
            .catch(err => {
              Logger.error('❌ Failed to set viewport resolution lock:', err);
              // Revert UI state on error
              setState(prev => ({ ...prev, viewportResolutionLock: !newResLockState }));
            });
          break;
        }
        case 'lock-viewport': {
          const newLockState = !state.viewportLocked;
          setState(prev => ({ ...prev, viewportLocked: newLockState }));
          Logger.debug(`🔒 Viewport lock: ${newLockState ? 'ON' : 'OFF'}`);
          if (onViewportLockChange) {
            onViewportLockChange(newLockState);
          }
          break;
        }

        // Object Manipulation
        case 'object-control-alignment':
          setState(prev => ({
            ...prev,
            objectControlMode: prev.objectControlMode === 'world' ? 'local' : 'world',
          }));
          Logger.debug(
            `Object control alignment: ${state.objectControlMode === 'world' ? 'local' : 'world'}`
          );
          // TODO: API call to set object control alignment
          break;
        case 'translate-gizmo':
          toggleGizmo('translate');
          break;
        case 'rotate-gizmo':
          toggleGizmo('rotate');
          break;
        case 'scale-gizmo':
          toggleGizmo('scale');
          break;
        case 'world-coordinate':
          setState(prev => ({ ...prev, worldCoordinateDisplay: !prev.worldCoordinateDisplay }));
          Logger.debug(`World coordinate display: ${!state.worldCoordinateDisplay ? 'ON' : 'OFF'}`);
          onToggleWorldCoord?.();
          break;

        default:
          Logger.warn(`Unknown toolbar action: ${actionId}`);
      }
    },
    [
      client,
      state,
      setState,
      setRenderStats,
      onRecenterView,
      onCopyToClipboard,
      onSaveRender,
      onExportPasses,
      onViewportLockChange,
      onToggleWorldCoord,
      togglePickingMode,
      toggleGizmo,
    ]
  );

  return {
    handleToolbarAction,
    togglePickingMode,
    toggleGizmo,
    getButtonActiveClass,
  };
}
