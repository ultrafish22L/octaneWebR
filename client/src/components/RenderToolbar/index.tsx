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

import React, { useCallback } from 'react';
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
  // TODO: If needed, implement primitive/mesh count fetching using ApiRenderEngine gRPC methods

  // Official Octane render viewport controls based on documentation
  const toolbarIcons = [
    // Camera & View Controls
    {
      id: 'recenter-view',
      tooltip: 'Recenter View - Centers the render view display area in the Render Viewport.',
    },
    {
      id: 'reset-camera',
      tooltip: 'Reset Camera - Resets the camera back to the original position.',
    },
    {
      id: 'camera-presets',
      tooltip: 'Camera View Presets - Provides preset camera views of the scene.',
    },

    { type: 'separator' },

    // Render Controls
    {
      id: 'stop-render',
      tooltip: 'Stop Render - Aborts the rendering process and frees all resources.',
      important: true,
    },
    {
      id: 'restart-render',
      tooltip: 'Restart Render - Halts and restarts the rendering process at zero samples.',
      important: true,
    },

    { type: 'separator' },

    {
      id: 'pause-render',
      tooltip: 'Pause Render - Pauses the rendering without losing rendered data.',
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
      tooltip: 'Real Time Rendering - Uses more GPU memory for interactive experience.',
    },

    { type: 'separator' },

    // Picking Tools
    {
      id: 'focus-picker',
      tooltip: 'Auto Focus Picking Mode - Click on scene to focus camera on that point.',
    },
    {
      id: 'white-balance-picker',
      tooltip: 'White Balance Picking Mode - Select part of scene for white point colors.',
    },
    {
      id: 'material-picker',
      tooltip: 'Material Picker - Select rendered scene to inspect material.',
    },
    { id: 'object-picker', tooltip: 'Object Picker - Select objects to inspect attributes.' },
    {
      id: 'camera-target-picker',
      tooltip: 'Camera Target Picker - Set center of rotation and zooming.',
    },
    {
      id: 'render-region-picker',
      tooltip: 'Render Region Picker - Specify a region in viewport to view changes.',
    },
    {
      id: 'film-region-picker',
      tooltip: 'Film Region Picker - Set region for Film Settings parameters.',
    },

    { type: 'separator' },

    // Rendering Settings
    { id: 'clay-mode', tooltip: 'Clay Mode - Shows model details without complex texturing.' },
    {
      id: 'subsample-2x2',
      tooltip: 'Sub-Sampling 2×2 - Smoother navigation by reducing render resolution.',
    },
    { id: 'subsample-4x4', tooltip: 'Sub-Sampling 4×4 - Maximum navigation smoothness.' },

    { type: 'separator' },

    { id: 'render-priority', tooltip: 'Render Priority Settings - Set GPU render priority.' },

    { type: 'separator' },

    // Output Controls
    { id: 'copy-clipboard', tooltip: 'Copy to Clipboard - Copies current render in LDR format.' },
    { id: 'save-render', tooltip: 'Save Render - Saves current render to disk.' },
    {
      id: 'export-passes',
      tooltip: 'Export Render Passes - Brings up Render Passes Export window.',
    },
    {
      id: 'background-image',
      tooltip: 'Set Background Image - Places background image in viewport.',
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
      tooltip: 'Object Control Alignment - World or local coordinate system.',
    },
    { id: 'translate-gizmo', tooltip: 'Placement Translation Tool - Move objects along axes.' },
    { id: 'rotate-gizmo', tooltip: 'Placement Rotation Tool - Rotate objects around axes.' },
    { id: 'scale-gizmo', tooltip: 'Placement Scale Tool - Scale objects uniformly or per axis.' },
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
          style={{
            cursor: 'context-menu',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          title="Right-click for GPU resource statistics"
        >
          {/* Progress Bar */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${renderStats.progressPercent}%`,
              backgroundColor: 'rgba(0, 150, 255, 0.15)',
              transition: 'width 0.3s ease',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {/* Stats Text (above progress bar) */}
          <span
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span id="render-samples-display" style={{ fontWeight: 500 }}>
              {renderStats.currentSamples}/{renderStats.denoisedSamples}/{renderStats.maxSamples}{' '}
              s/px
            </span>
            <span className="stats-separator">, </span>
            <span id="render-speed-display">
              {Math.round(renderStats.megaSamplesPerSec)} Ms/sec
            </span>
            <span className="stats-separator">, </span>
            <span id="render-time-display">
              {renderStats.currentTime}/{renderStats.estimatedTime}
            </span>
            <span> </span>
            <span id="render-status-display" className={`render-status-${renderStats.status}`}>
              ({renderStats.status === 'rendering' ? 'rendering...' : renderStats.status})
            </span>
          </span>
        </div>
        <div
          className="render-stats-right"
          onContextMenu={handleStatsContextMenu}
          style={{ cursor: 'context-menu' }}
          title="Right-click for GPU resource statistics"
        >
          <span id="render-primitive-count">{renderStats.primitiveCount} pri</span>
          <span className="stats-separator">, </span>
          <span id="render-mesh-count">{renderStats.meshCount} mesh</span>
          <span className="stats-separator">, </span>
          <span id="render-gpu-info">{renderStats.gpu}</span>
          <span className="stats-separator">, </span>
          <span id="render-memory-combined">
            {renderStats.version}/{renderStats.memory}
          </span>
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

            const iconPath = getToolbarIconPath(id);

            return (
              <button
                key={id}
                id={id}
                className={`toolbar-icon-btn ${important ? 'important' : ''} ${getButtonActiveClass(id)}`}
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

        {/* Render Priority Menu - Dropdown for GPU render priority */}
        {state.showRenderPriorityMenu && (
          <div className="render-priority-menu">
            <div className="render-priority-menu-header">Render Priority Settings</div>
            <div className="render-priority-menu-items">
              <button
                onClick={handleLowPriorityClick}
                className={`render-priority-item ${state.renderPriority === 'low' ? 'active' : ''}`}
              >
                Low Priority
              </button>
              <button
                onClick={handleNormalPriorityClick}
                className={`render-priority-item ${state.renderPriority === 'normal' ? 'active' : ''}`}
              >
                Normal Priority
              </button>
              <button
                onClick={handleHighPriorityClick}
                className={`render-priority-item ${state.renderPriority === 'high' ? 'active' : ''}`}
              >
                High Priority
              </button>
            </div>
          </div>
        )}
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
