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
import { useStatusActions } from '../../../contexts/StatusMessageContext';
import { ToolbarState } from './useRenderSettings';
import { RenderStats } from './useGPUData';

interface UseToolbarActionsProps {
  client: OctaneClient;
  state: ToolbarState;
  setState: Dispatch<SetStateAction<ToolbarState>>;
  renderStats: RenderStats;
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
  renderStats,
  setRenderStats,
  onRecenterView,
  onCopyToClipboard,
  onSaveRender,
  onExportPasses,
  onViewportLockChange,
  onPickingModeChange,
  onToggleWorldCoord,
}: UseToolbarActionsProps) {
  const { setTemporaryStatus } = useStatusActions();

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
      Logger.debug(`Picking mode: ${newMode}`);

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
        case 'start-render':
          return renderStats.status !== 'paused' && renderStats.status !== 'stopped'
            ? 'active'
            : '';
        case 'pause-render':
          return renderStats.status === 'paused' ? 'active' : '';
        case 'real-time-render':
          return state.realTimeMode ? 'active' : '';
        case 'lock-viewport':
          return state.viewportLocked ? 'active' : '';
        case 'clay-mode':
          return state.clayMode !== 'none' ? 'active' : '';
        case 'subsample-mode':
          return state.subSampling !== 'none' ? 'active' : '';
        case 'decal-wireframe':
          return state.decalWireframe ? 'active' : '';
        case 'viewport-resolution-lock':
          return state.viewportResolutionLock ? 'active' : '';
        case 'object-control-alignment':
          return '';
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
    [state, renderStats.status]
  );

  // ========================================
  // TOOLBAR ACTIONS
  // ========================================

  const handleToolbarAction = useCallback(
    (actionId: string) => {
      Logger.debug(`RenderToolbar action: ${actionId}`);

      switch (actionId) {
        // Camera & View Controls
        case 'recenter-view':
          Logger.debug('Recenter view - resetting 2D canvas transform + framing scene');
          onRecenterView?.();
          client.frameScene().catch(err => {
            Logger.error('Failed to frame scene:', err);
          });
          break;
        case 'reset-camera':
          Logger.debug('Reset camera to original position');
          client
            .resetCamera()
            .then(() => {
              Logger.debug('Camera reset successful');
            })
            .catch(err => {
              Logger.error('Failed to reset camera:', err);
              setTemporaryStatus('Failed to reset camera', 3000);
            });
          break;
        case 'camera-presets':
          setState(prev => ({
            ...prev,
            showCameraPresetsMenu: !prev.showCameraPresetsMenu,
            showRenderPriorityMenu: false,
            showGizmoModeMenu: false,
            showClayModeMenu: false,
            showSubSampleMenu: false,
          }));
          break;

        // Render Controls
        case 'stop-render':
          Logger.debug('Stop render');
          client
            .stopRender()
            .then(() => {
              setRenderStats(prev => ({ ...prev, status: 'stopped' }));
            })
            .catch(err => {
              Logger.error('Failed to stop render:', err);
              setTemporaryStatus('Failed to stop render', 3000);
            });
          break;
        case 'restart-render':
          Logger.debug('Restart render');
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
              Logger.error('Failed to restart render:', err);
              setTemporaryStatus('Failed to restart render', 3000);
            });
          break;
        case 'pause-render':
          Logger.debug('Pause render');
          client
            .pauseRender()
            .then(() => {
              setRenderStats(prev => ({ ...prev, status: 'paused' }));
            })
            .catch(err => {
              Logger.error('Failed to pause render:', err);
              setTemporaryStatus('Failed to pause render', 3000);
            });
          break;
        case 'start-render':
          Logger.debug('Start render');
          client
            .startRender()
            .then(() => {
              setRenderStats(prev => ({ ...prev, status: 'rendering' }));
            })
            .catch(err => {
              Logger.error('Failed to start render:', err);
              setTemporaryStatus('Failed to start render', 3000);
            });
          break;
        case 'real-time-render': {
          const newRealTimeMode = !state.realTimeMode;
          setState(prev => ({ ...prev, realTimeMode: newRealTimeMode }));
          Logger.debug(`Real-time mode: ${newRealTimeMode ? 'ON' : 'OFF'}`);
          // Real-time mode uses high priority for interactive experience
          // Set render priority: high for real-time, normal for standard
          const rtPriority = newRealTimeMode ? 2 : 1; // 0=low, 1=normal, 2=high
          client
            .callApi('ApiRenderEngine', 'setRenderPriority', { priority: rtPriority })
            .then(() => {
              const priorityName = newRealTimeMode ? 'HIGH' : 'NORMAL';
              Logger.debug(
                ` Real-time mode ${newRealTimeMode ? 'enabled' : 'disabled'} - priority set to ${priorityName}`
              );
              setState(prev => ({ ...prev, renderPriority: newRealTimeMode ? 'high' : 'normal' }));
            })
            .catch(err => {
              Logger.error('Failed to set real-time rendering priority:', err);
              setTemporaryStatus('Failed to set real-time mode', 3000);
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

        // Rendering Settings — dropdowns
        case 'clay-mode':
          setState(prev => ({
            ...prev,
            showClayModeMenu: !prev.showClayModeMenu,
            showSubSampleMenu: false,
            showCameraPresetsMenu: false,
            showRenderPriorityMenu: false,
            showGizmoModeMenu: false,
          }));
          break;
        case 'subsample-mode':
          setState(prev => ({
            ...prev,
            showSubSampleMenu: !prev.showSubSampleMenu,
            showClayModeMenu: false,
            showCameraPresetsMenu: false,
            showRenderPriorityMenu: false,
            showGizmoModeMenu: false,
          }));
          break;
        case 'decal-wireframe':
          setState(prev => ({ ...prev, decalWireframe: !prev.decalWireframe }));
          Logger.debug(
            ` Decal wireframe: ${!state.decalWireframe ? 'ON' : 'OFF'} (UI only - no gRPC API available)`
          );
          // NOTE: No gRPC API method exists for this feature in apirender_pb2_grpc.py
          // Feature exists in Octane SE manual but not exposed through LiveLink API
          // UI state tracked for future implementation when API becomes available
          break;
        case 'render-priority':
          setState(prev => ({
            ...prev,
            showRenderPriorityMenu: !prev.showRenderPriorityMenu,
            showCameraPresetsMenu: false,
            showGizmoModeMenu: false,
            showClayModeMenu: false,
            showSubSampleMenu: false,
          }));
          break;

        // Output Controls
        case 'copy-clipboard':
          Logger.debug('Copy render to clipboard');
          if (onCopyToClipboard) {
            onCopyToClipboard();
          } else {
            Logger.warn('onCopyToClipboard handler not provided');
          }
          break;
        case 'save-render':
          Logger.debug('Save render to disk');
          if (onSaveRender) {
            onSaveRender();
          } else {
            Logger.warn('onSaveRender handler not provided');
          }
          break;
        case 'export-passes':
          Logger.debug('Export render passes');
          if (onExportPasses) {
            onExportPasses();
          } else {
            Logger.warn('onExportPasses handler not provided');
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
          Logger.debug(`Viewport resolution lock: ${newResLockState ? 'ON' : 'OFF'}`);
          client
            .setViewportResolutionLock(newResLockState)
            .then(() => {
              Logger.debug('Viewport resolution lock updated in Octane');
            })
            .catch(err => {
              Logger.error('Failed to set viewport resolution lock:', err);
              setTemporaryStatus('Failed to set viewport resolution lock', 3000);
              // Revert UI state on error
              setState(prev => ({ ...prev, viewportResolutionLock: !newResLockState }));
            });
          break;
        }
        case 'lock-viewport': {
          const newLockState = !state.viewportLocked;
          setState(prev => ({ ...prev, viewportLocked: newLockState }));
          Logger.debug(`Viewport lock: ${newLockState ? 'ON' : 'OFF'}`);
          if (onViewportLockChange) {
            onViewportLockChange(newLockState);
          }
          break;
        }

        // Object Manipulation
        case 'object-control-alignment':
          setState(prev => ({
            ...prev,
            showGizmoModeMenu: !prev.showGizmoModeMenu,
            showCameraPresetsMenu: false,
            showRenderPriorityMenu: false,
            showClayModeMenu: false,
            showSubSampleMenu: false,
          }));
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
      setTemporaryStatus,
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
