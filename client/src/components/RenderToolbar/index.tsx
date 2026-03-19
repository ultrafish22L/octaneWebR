/**
 * RenderToolbar.tsx - React/TypeScript port of octaneWeb's RenderToolbar.js
 * Official Octane-style render toolbar component with render statistics and viewport controls
 * Located below the render viewport, above the node graph editor
 *
 * Refactored: Extracted logic into custom hooks for better maintainability
 * - useGPUData: GPU info and render statistics
 * - useRenderSettings: Toolbar state management
 * - useCameraPresets: Camera presets and menus
 * - useToolbarActions: Toolbar button handlers
 */

import React, { useCallback, useEffect } from 'react';
import { useOctane } from '../../hooks/useOctane';
import { GPUStatisticsDialog } from '../dialogs/GPUStatisticsDialog';
import { getToolbarIconPath } from '../../constants/ToolbarIconMapping';
import { useGPUData } from './hooks/useGPUData';
import { useRenderSettings } from './hooks/useRenderSettings';
import { useCameraPresets } from './hooks/useCameraPresets';
import { useToolbarActions } from './hooks/useToolbarActions';

interface RenderToolbarProps {
  className?: string;
  onToggleWorldCoord?: () => void;
  onCopyToClipboard?: () => void;
  onSaveRender?: () => void;
  onExportPasses?: () => void;
  onRecenterView?: () => void;
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
}

export const RenderToolbar = React.memo(function RenderToolbar({
  className = '',
  onToggleWorldCoord,
  onCopyToClipboard,
  onSaveRender,
  onExportPasses,
  onRecenterView,
  onViewportLockChange,
  onPickingModeChange,
}: RenderToolbarProps) {
  const { connected, client } = useOctane();

  // Custom hooks for component logic
  const {
    renderStats,
    setRenderStats,
    showGPUStatsDialog,
    setShowGPUStatsDialog,
    gpuStatsPosition,
    setGPUStatsPosition,
  } = useGPUData({ connected, client });

  const { state, setState } = useRenderSettings({ connected, client });

  const { applyRenderPriority, applyCameraPreset } = useCameraPresets({
    client,
    state,
    setState,
  });

  const { handleToolbarAction, getButtonActiveClass } = useToolbarActions({
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
  });

  // Note: System info endpoint removed (was calling non-existent Express server on port 45769)
  // GPU data (version, GPU name, memory) is already fetched via fetchGPUData above using gRPC
  // Primitive/mesh counts remain at default values (0 pri, 1 mesh) until implemented via gRPC
  // Future: primitive/mesh count fetching via ApiRenderEngine gRPC (currently shows defaults)

  // Official Octane render viewport controls based on documentation
  const toolbarIcons = [
    // Camera & View Controls
    {
      id: 'recenter-view',
      tooltip: 'Centers the rendered image in the viewport. Use Ctrl to also reset the zoom.',
    },
    {
      id: 'reset-camera',
      tooltip: 'Resets the camera to its initial position and target.',
    },
    {
      id: 'camera-presets',
      tooltip: 'Camera View Presets - Provides preset camera views of the scene.',
    },

    { type: 'separator' },

    // Render Controls
    {
      id: 'stop-render',
      tooltip: 'Stops the current render.',
      important: true,
    },
    {
      id: 'restart-render',
      tooltip: 'Restarts the current render.',
      important: true,
    },

    { type: 'separator' },

    {
      id: 'pause-render',
      tooltip: 'Pauses the current render.',
      important: true,
    },
    {
      id: 'start-render',
      tooltip: 'Start Render - Starts or resumes the rendering process.',
      important: true,
    },

    { type: 'separator' },

    {
      id: 'real-time-render',
      tooltip: 'Toggle real-time rendering.',
    },

    { type: 'separator' },

    // Picking Tools
    {
      id: 'focus-picker',
      tooltip: 'Toggles the camera focus picker of the render viewport.',
    },
    {
      id: 'white-balance-picker',
      tooltip: 'Toggles the imager white point picker of the viewport.',
    },
    {
      id: 'material-picker',
      tooltip: 'Toggles the material picker of the render viewport.',
    },
    { id: 'object-picker', tooltip: 'Toggles the object picker of the render viewport.' },
    {
      id: 'camera-target-picker',
      tooltip: 'Toggles the camera target picker of the render viewport.',
    },
    {
      id: 'render-region-picker',
      tooltip: 'Toggles the render region lasso in the viewport.',
    },
    {
      id: 'film-region-picker',
      tooltip: 'Toggles the film region settings lasso in the viewport.',
    },

    { type: 'separator' },

    // Rendering Settings — dropdowns
    {
      id: 'clay-mode',
      tooltip: 'The clay mode that should be used for rendering.',
    },
    {
      id: 'subsample-mode',
      tooltip: 'The subsample mode that should be used for rendering.',
    },

    { type: 'separator' },

    { id: 'render-priority', tooltip: 'Render Priority Settings - Set GPU render priority.' },

    { type: 'separator' },

    // Output Controls
    { id: 'copy-clipboard', tooltip: 'Copy to clipboard.' },
    { id: 'save-render', tooltip: 'Save Render - Saves current render to disk.' },
    {
      id: 'export-passes',
      tooltip: 'Export Render Passes - Brings up Render Passes Export window.',
    },
    {
      id: 'background-image',
      tooltip: 'Shows a dialog to change the background image of the render viewport.',
    },

    { type: 'separator' },

    // Viewport Controls
    {
      id: 'lock-viewport',
      tooltip: 'Lock Viewport - Prevents accidental changes or render restarts.',
    },

    { type: 'separator' },

    // Object Manipulation
    {
      id: 'object-control-alignment',
      tooltip: 'Toggle the current gizmo mode',
    },
    { id: 'translate-gizmo', tooltip: 'Toggle the move gizmo frame.' },
    { id: 'rotate-gizmo', tooltip: 'Toggle the rotate gizmo frame.' },
    { id: 'scale-gizmo', tooltip: 'Toggle the scale gizmo frame.' },
    {
      id: 'world-coordinate',
      tooltip: 'Display World Coordinate - Shows world axis in viewport corner.',
    },

    {
      id: 'decal-wireframe',
      tooltip: 'Decal Wireframe - Toggles wireframe along decal boundaries.',
    },
  ];

  // Memoized camera preset handlers
  const handleFrontPresetClick = useCallback(() => applyCameraPreset('Front'), [applyCameraPreset]);
  const handleBackPresetClick = useCallback(() => applyCameraPreset('Back'), [applyCameraPreset]);
  const handleLeftPresetClick = useCallback(() => applyCameraPreset('Left'), [applyCameraPreset]);
  const handleRightPresetClick = useCallback(() => applyCameraPreset('Right'), [applyCameraPreset]);
  const handleTopPresetClick = useCallback(() => applyCameraPreset('Top'), [applyCameraPreset]);
  const handleBottomPresetClick = useCallback(
    () => applyCameraPreset('Bottom'),
    [applyCameraPreset]
  );

  // Memoized render priority handlers
  const handleLowPriorityClick = useCallback(
    () => applyRenderPriority('low'),
    [applyRenderPriority]
  );
  const handleNormalPriorityClick = useCallback(
    () => applyRenderPriority('normal'),
    [applyRenderPriority]
  );
  const handleHighPriorityClick = useCallback(
    () => applyRenderPriority('high'),
    [applyRenderPriority]
  );

  // Gizmo mode handlers
  const handleLocalModeClick = useCallback(() => {
    setState(prev => ({ ...prev, objectControlMode: 'local', showGizmoModeMenu: false }));
  }, [setState]);
  const handleWorldModeClick = useCallback(() => {
    setState(prev => ({ ...prev, objectControlMode: 'world', showGizmoModeMenu: false }));
  }, [setState]);

  // Clay mode handlers — CLAY_MODE_NONE = 0, CLAY_MODE_GREY = 1, CLAY_MODE_COLORED = 2
  const handleClayMode = useCallback(
    (mode: 'none' | 'grey' | 'colored') => {
      const prev = state.clayMode;
      const modeValue = mode === 'colored' ? 2 : mode === 'grey' ? 1 : 0;
      setState(p => ({ ...p, clayMode: mode, showClayModeMenu: false }));
      client.setClayMode(modeValue).catch(() => {
        setState(p => ({ ...p, clayMode: prev }));
      });
    },
    [state.clayMode, setState, client]
  );

  // Sub-sample mode handlers — SUBSAMPLEMODE_NONE = 1, SUBSAMPLEMODE_2X2 = 2, SUBSAMPLEMODE_4X4 = 4
  const handleSubSampleMode = useCallback(
    (mode: 'none' | '2x2' | '4x4') => {
      const prev = state.subSampling;
      const modeValue = mode === '4x4' ? 4 : mode === '2x2' ? 2 : 1;
      setState(p => ({ ...p, subSampling: mode, showSubSampleMenu: false }));
      client.setSubSampleMode(modeValue).catch(() => {
        setState(p => ({ ...p, subSampling: prev }));
      });
    },
    [state.subSampling, setState, client]
  );

  // Close all toolbar dropdowns on any click outside
  const anyDropdownOpen =
    state.showClayModeMenu ||
    state.showSubSampleMenu ||
    state.showRenderPriorityMenu ||
    state.showCameraPresetsMenu ||
    state.showGizmoModeMenu;

  useEffect(() => {
    if (!anyDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking on a dropdown button or inside a dropdown
      if (target.closest('.toolbar-dropdown') || target.closest('.has-dropdown')) return;
      setState(prev => ({
        ...prev,
        showClayModeMenu: false,
        showSubSampleMenu: false,
        showRenderPriorityMenu: false,
        showCameraPresetsMenu: false,
        showGizmoModeMenu: false,
      }));
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [anyDropdownOpen, setState]);

  // Handle right-click on render progress indicator or GPU info bar
  const handleStatsContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setGPUStatsPosition({ x: event.clientX, y: event.clientY });
      setShowGPUStatsDialog(true);
    },
    [setGPUStatsPosition, setShowGPUStatsDialog]
  );

  return (
    <div className={`render-toolbar-container ${className}`}>
      {/* Render Statistics Bar - Matching Octane format exactly */}
      <div className="render-stats-bar">
        <div
          className="render-stats-left"
          onContextMenu={handleStatsContextMenu}
          style={{ cursor: 'context-menu' }}
          title="Right-click for GPU resource statistics"
        >
          {/* Sample Progress Bar - fixed-width container with fill */}
          <div className="stats-progress-track">
            <div
              className="stats-progress-fill"
              style={{ width: `${Math.max(renderStats.progressPercent, 0)}%` }}
            />
          </div>

          {/* Stats Text */}
          <span id="render-samples-display">
            {renderStats.currentSamples}/{renderStats.denoisedSamples}/{renderStats.maxSamples} s/px
            {Math.round(renderStats.megaSamplesPerSec) > 0 ? ',' : ''}
          </span>
          {Math.round(renderStats.megaSamplesPerSec) > 0 && (
            <span id="render-speed-display">
              {Math.round(renderStats.megaSamplesPerSec)} Ms/sec,
            </span>
          )}
          <span id="render-time-display">
            {renderStats.currentTime}/{renderStats.estimatedTime}
          </span>
          <span
            id="render-status-display"
            className={`render-status-${renderStats.maxSamples > 0 && renderStats.currentSamples >= renderStats.maxSamples ? 'finished' : renderStats.status}`}
          >
            (
            {renderStats.maxSamples > 0 && renderStats.currentSamples >= renderStats.maxSamples
              ? 'finished'
              : renderStats.status === 'rendering'
                ? 'rendering...'
                : renderStats.status}
            )
          </span>
        </div>
        <div
          className="render-stats-right"
          onContextMenu={handleStatsContextMenu}
          style={{ cursor: 'context-menu' }}
          title="Right-click for GPU resource statistics"
        >
          <span id="render-primitive-count">{renderStats.primitiveCount} pri,</span>
          <span id="render-mesh-count">{renderStats.meshCount} mesh,</span>
          <span id="render-gpu-info">{renderStats.gpu},</span>
          <span id="render-memory-combined">{renderStats.memory}</span>
          {/* GPU Memory Progress Bar - matches left side style */}
          <div className="stats-progress-track">
            <div
              className="stats-progress-fill"
              style={{
                width: `${renderStats.totalMemoryGB > 0 ? Math.min(100, (renderStats.usedMemoryGB / renderStats.totalMemoryGB) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Render Toolbar Icons */}
      <div className="render-toolbar">
        <div className="render-toolbar-icons">
          {toolbarIcons.map((iconData, index) => {
            if ('type' in iconData && iconData.type === 'separator') {
              return <div key={`sep-${index}`} className="toolbar-separator" />;
            }

            const { id, tooltip, important } = iconData as {
              id: string;
              tooltip: string;
              important?: boolean;
            };

            // Dynamic icons: switch icon based on current state
            const iconKey =
              id === 'object-control-alignment'
                ? `object-control-alignment-${state.objectControlMode}`
                : id === 'lock-viewport'
                  ? state.viewportLocked
                    ? 'lock-viewport'
                    : 'unlock-viewport'
                  : id === 'clay-mode'
                    ? state.clayMode === 'colored'
                      ? 'clay-mode-colored'
                      : state.clayMode === 'grey'
                        ? 'clay-mode'
                        : 'clay-mode-none'
                    : id === 'subsample-mode'
                      ? state.subSampling === '4x4'
                        ? 'subsample-4x4'
                        : state.subSampling === '2x2'
                          ? 'subsample-2x2'
                          : 'subsample-none'
                      : id === 'render-priority'
                        ? `render-priority-${state.renderPriority === 'normal' ? 'normal' : state.renderPriority}`
                        : id;
            const iconPath = getToolbarIconPath(iconKey);

            const hasDropdown = [
              'clay-mode',
              'subsample-mode',
              'render-priority',
              'camera-presets',
              'object-control-alignment',
            ].includes(id);

            return (
              <button
                key={id}
                id={id}
                className={`toolbar-icon-btn ${important ? 'important' : ''} ${getButtonActiveClass(id)} ${hasDropdown ? 'has-dropdown' : ''}`}
                title={tooltip}
                onClick={() => handleToolbarAction(id)}
              >
                {iconPath && (
                  <img src={iconPath} alt={tooltip} className="toolbar-icon" draggable={false} />
                )}
              </button>
            );
          })}
        </div>

        {/* Camera Presets Menu - Dropdown positioned below camera-presets button */}
        {state.showCameraPresetsMenu && (
          <div className="camera-presets-menu">
            <div className="camera-presets-menu-header">Camera View Presets</div>
            <div className="camera-presets-menu-items">
              <button onClick={handleFrontPresetClick} className="camera-preset-item">
                Front View
              </button>
              <button onClick={handleBackPresetClick} className="camera-preset-item">
                Back View
              </button>
              <button onClick={handleLeftPresetClick} className="camera-preset-item">
                Left View
              </button>
              <button onClick={handleRightPresetClick} className="camera-preset-item">
                Right View
              </button>
              <button onClick={handleTopPresetClick} className="camera-preset-item">
                Top View
              </button>
              <button onClick={handleBottomPresetClick} className="camera-preset-item">
                Bottom View
              </button>
            </div>
          </div>
        )}

        {/* Render Priority Menu — positioned below button using fixed coords */}
        {state.showRenderPriorityMenu &&
          (() => {
            const btn = document.getElementById('render-priority');
            const rect = btn?.getBoundingClientRect();
            const left = rect ? rect.left : 0;
            const top = rect ? rect.bottom : 0;
            return (
              <div className="toolbar-dropdown context-menu" style={{ left, top }}>
                <button
                  onClick={handleLowPriorityClick}
                  className={`context-menu-item ${state.renderPriority === 'low' ? 'active' : ''}`}
                >
                  <img src={getToolbarIconPath('render-priority-low')} alt="" draggable={false} />
                  Low priority
                </button>
                <button
                  onClick={handleNormalPriorityClick}
                  className={`context-menu-item ${state.renderPriority === 'normal' ? 'active' : ''}`}
                >
                  <img
                    src={getToolbarIconPath('render-priority-normal')}
                    alt=""
                    draggable={false}
                  />
                  Medium priority
                </button>
                <button
                  onClick={handleHighPriorityClick}
                  className={`context-menu-item ${state.renderPriority === 'high' ? 'active' : ''}`}
                >
                  <img src={getToolbarIconPath('render-priority-high')} alt="" draggable={false} />
                  High priority
                </button>
              </div>
            );
          })()}

        {/* Gizmo Mode Menu — positioned below button using fixed coords */}
        {state.showGizmoModeMenu &&
          (() => {
            const btn = document.getElementById('object-control-alignment');
            const rect = btn?.getBoundingClientRect();
            const left = rect ? rect.left : 0;
            const top = rect ? rect.bottom : 0;
            return (
              <div className="toolbar-dropdown context-menu" style={{ left, top }}>
                <button
                  onClick={handleLocalModeClick}
                  className={`context-menu-item ${state.objectControlMode === 'local' ? 'active' : ''}`}
                >
                  <img
                    src={getToolbarIconPath('object-control-alignment-local')}
                    alt=""
                    draggable={false}
                  />
                  Local mode
                </button>
                <button
                  onClick={handleWorldModeClick}
                  className={`context-menu-item ${state.objectControlMode === 'world' ? 'active' : ''}`}
                >
                  <img
                    src={getToolbarIconPath('object-control-alignment-world')}
                    alt=""
                    draggable={false}
                  />
                  World mode
                </button>
              </div>
            );
          })()}

        {/* Clay Mode Menu — positioned below button using fixed coords */}
        {state.showClayModeMenu &&
          (() => {
            const btn = document.getElementById('clay-mode');
            const rect = btn?.getBoundingClientRect();
            const left = rect ? rect.left : 0;
            const top = rect ? rect.bottom : 0;
            return (
              <div className="toolbar-dropdown context-menu" style={{ left, top }}>
                <button
                  onClick={() => handleClayMode('none')}
                  className={`context-menu-item ${state.clayMode === 'none' ? 'active' : ''}`}
                >
                  <img src={getToolbarIconPath('clay-mode-none')} alt="" draggable={false} />
                  Normal rendering
                </button>
                <button
                  onClick={() => handleClayMode('grey')}
                  className={`context-menu-item ${state.clayMode === 'grey' ? 'active' : ''}`}
                >
                  <img src={getToolbarIconPath('clay-mode')} alt="" draggable={false} />
                  Clay mode
                </button>
                <button
                  onClick={() => handleClayMode('colored')}
                  className={`context-menu-item ${state.clayMode === 'colored' ? 'active' : ''}`}
                >
                  <img src={getToolbarIconPath('clay-mode-colored')} alt="" draggable={false} />
                  Colored clay mode
                </button>
              </div>
            );
          })()}

        {/* Sub-Sample Mode Menu — positioned below button using fixed coords */}
        {state.showSubSampleMenu &&
          (() => {
            const btn = document.getElementById('subsample-mode');
            const rect = btn?.getBoundingClientRect();
            const left = rect ? rect.left : 0;
            const top = rect ? rect.bottom : 0;
            return (
              <div className="toolbar-dropdown context-menu" style={{ left, top }}>
                <button
                  onClick={() => handleSubSampleMode('none')}
                  className={`context-menu-item ${state.subSampling === 'none' ? 'active' : ''}`}
                >
                  <img src={getToolbarIconPath('subsample-none')} alt="" draggable={false} />
                  No subsampling
                </button>
                <button
                  onClick={() => handleSubSampleMode('2x2')}
                  className={`context-menu-item ${state.subSampling === '2x2' ? 'active' : ''}`}
                >
                  <img src={getToolbarIconPath('subsample-2x2')} alt="" draggable={false} />
                  2x2 subsampling
                </button>
                <button
                  onClick={() => handleSubSampleMode('4x4')}
                  className={`context-menu-item ${state.subSampling === '4x4' ? 'active' : ''}`}
                >
                  <img src={getToolbarIconPath('subsample-4x4')} alt="" draggable={false} />
                  4x4 subsampling
                </button>
              </div>
            );
          })()}
      </div>

      {/* GPU Statistics Dialog */}
      <GPUStatisticsDialog
        isOpen={showGPUStatsDialog}
        onClose={() => setShowGPUStatsDialog(false)}
        position={gpuStatsPosition}
      />
    </div>
  );
});
