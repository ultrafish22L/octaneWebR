/**
 * RenderToolbar.tsx - React/TypeScript port of octaneWeb's RenderToolbar.js
 * Official Octane-style render toolbar component with render statistics and viewport controls
 * Located below the render viewport, above the node graph editor
 */

import { Logger } from '../../utils/Logger';
import React, { useState, useEffect, useCallback } from 'react';
import { useOctane } from '../../hooks/useOctane';
import { GPUStatisticsDialog } from '../dialogs/GPUStatisticsDialog';
import { getToolbarIconPath } from '../../constants/ToolbarIconMapping';

interface RenderStats {
  currentSamples: number;           // 1304
  denoisedSamples: number;          // 2720
  maxSamples: number;               // 5000
  megaSamplesPerSec: number;        // 695 Ms/sec
  currentTime: string;              // 00:00:02
  estimatedTime: string;            // 00:00:03
  progressPercent: number;          // 0-100 for progress bar
  status: 'rendering' | 'finished' | 'paused' | 'stopped' | 'waiting' | 'error';
  primitiveCount: number;           // 4032 pri
  meshCount: number;                // 1 mesh
  gpu: string;                      // GPU name
  version: string;                  // Version string
  memory: string;                   // Memory string
}

interface ToolbarState {
  realTimeMode: boolean;
  viewportLocked: boolean;
  clayMode: boolean;
  subSampling: 'none' | '2x2' | '4x4';
  renderPriority: 'low' | 'normal' | 'high';
  currentPickingMode: 'none' | 'focus' | 'whiteBalance' | 'material' | 'object' | 'cameraTarget' | 'renderRegion' | 'filmRegion';
  decalWireframe: boolean;
  worldCoordinateDisplay: boolean;
  objectControlMode: 'world' | 'local';
  activeGizmo: 'none' | 'translate' | 'rotate' | 'scale';
  viewportResolutionLock: boolean;
  showCameraPresetsMenu: boolean;
  showRenderPriorityMenu: boolean;
}

interface RenderToolbarProps {
  className?: string;
  onToggleWorldCoord?: () => void;
  onCopyToClipboard?: () => void;
  onSaveRender?: () => void;
  onExportPasses?: () => void;
  onRecenterView?: () => void;
  onViewportLockChange?: (locked: boolean) => void;
  onPickingModeChange?: (mode: 'none' | 'focus' | 'whiteBalance' | 'material' | 'object' | 'cameraTarget' | 'renderRegion' | 'filmRegion') => void;
}

export const RenderToolbar = React.memo(function RenderToolbar({ className = '', onToggleWorldCoord, onCopyToClipboard, onSaveRender, onExportPasses, onRecenterView, onViewportLockChange, onPickingModeChange }: RenderToolbarProps) {
  const { connected, client } = useOctane();
  
  const [renderStats, setRenderStats] = useState<RenderStats>({
    currentSamples: 0,
    denoisedSamples: 0,
    maxSamples: 5000,
    megaSamplesPerSec: 0,
    currentTime: '00:00:00',
    estimatedTime: '00:00:00',
    progressPercent: 0,
    status: 'finished',
    primitiveCount: 0,
    meshCount: 1,
    gpu: 'NVIDIA GeForce RTX 4090 (RT)',
    version: '1:48.21.2',
    memory: '24.0 GB'
  });

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
    showRenderPriorityMenu: false
  });

  // GPU Statistics Dialog state
  const [showGPUStatsDialog, setShowGPUStatsDialog] = useState(false);
  const [gpuStatsPosition, setGPUStatsPosition] = useState<{ x: number; y: number } | undefined>(undefined);

  // Fetch live GPU data on connection
  useEffect(() => {
    if (!connected) return;

    const fetchGPUData = async () => {
      try {
        // Get Octane version
        const version = await client.getOctaneVersion();
        
        // Get primary GPU device info
        const deviceCount = await client.getDeviceCount();
        let gpuName = 'Unknown GPU';
        let totalMemory = '0 GB';
        
        if (deviceCount > 0) {
          // Get first device (primary GPU)
          gpuName = await client.getDeviceName(0);
          
          // Get memory info
          const memoryUsage = await client.getMemoryUsage(0);
          if (memoryUsage) {
            const totalGB = (memoryUsage.totalDeviceMemory / (1024 * 1024 * 1024)).toFixed(1);
            totalMemory = `${totalGB} GB`;
          }
        }
        
        setRenderStats(prev => ({
          ...prev,
          gpu: gpuName,
          version: version,
          memory: totalMemory
        }));
        
        Logger.debug('🖥️ GPU data loaded:', { gpu: gpuName, version, memory: totalMemory });
      } catch (error: any) {
        Logger.error('❌ Failed to fetch GPU data:', error.message);
      }
    };

    fetchGPUData();
  }, [connected, client]);

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
        const subSamplingMode = subSampleValue === 2 ? '2x2' : subSampleValue === 4 ? '4x4' : 'none';
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

  // Note: System info endpoint removed (was calling non-existent Express server on port 45769)
  // GPU data (version, GPU name, memory) is already fetched via fetchGPUData above using gRPC
  // Primitive/mesh counts remain at default values (0 pri, 1 mesh) until implemented via gRPC
  // TODO: If needed, implement primitive/mesh count fetching using ApiRenderEngine gRPC methods

  // Listen for real-time render statistics from WebSocket callbacks
  useEffect(() => {
    if (!connected) return;
    
    const handleStatistics = (data: any) => {
      try {
        // Parse the statistics object from Octane callback
        // RenderResultStatistics proto fields:
        // - beautySamplesPerPixel (uint32) - current samples
        // - denoisedSamplesPerPixel (uint32) - denoised samples
        // - beautyMaxSamplesPerPixel (uint32) - max target samples
        // - beautySamplesPerSecond (double) - samples per second
        // - renderTime (double) - seconds elapsed
        // - estimatedRenderTime (double) - estimated total seconds
        // - state (RenderState enum) - 0=stopped, 1=waiting, 2=rendering, 3=paused, 4=finished
        const stats = data.statistics;
        if (stats) {
          // Parse samples (current/denoised/max)
          const currentSamples = stats.beautySamplesPerPixel !== undefined ? stats.beautySamplesPerPixel : renderStats.currentSamples;
          const denoisedSamples = stats.denoisedSamplesPerPixel !== undefined ? stats.denoisedSamplesPerPixel : renderStats.denoisedSamples;
          const maxSamples = stats.beautyMaxSamplesPerPixel !== undefined ? stats.beautyMaxSamplesPerPixel : renderStats.maxSamples;
          
          // Calculate progress percentage
          const progressPercent = maxSamples > 0 ? Math.min(100, (currentSamples / maxSamples) * 100) : 0;
          
          // Parse samples per second and convert to mega-samples/sec
          const samplesPerSecond = stats.beautySamplesPerSecond !== undefined ? stats.beautySamplesPerSecond : 0;
          const megaSamplesPerSec = samplesPerSecond / 1000000;
          
          // Format current time (renderTime in seconds) as HH:MM:SS
          let currentTime = renderStats.currentTime;
          if (stats.renderTime !== undefined) {
            const totalSeconds = Math.floor(stats.renderTime);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            currentTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          }
          
          // Format estimated time (estimatedRenderTime in seconds) as HH:MM:SS
          let estimatedTime = renderStats.estimatedTime;
          if (stats.estimatedRenderTime !== undefined) {
            const totalSeconds = Math.floor(stats.estimatedRenderTime);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            estimatedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          }
          
          // Parse render state (state enum)
          // RSTATE_STOPPED=0, RSTATE_WAITING_FOR_DATA=1, RSTATE_RENDERING=2, RSTATE_PAUSED=3, RSTATE_FINISHED=4
          let status: 'rendering' | 'finished' | 'paused' | 'stopped' | 'waiting' | 'error' = renderStats.status;
          if (stats.state !== undefined) {
            switch (stats.state) {
              case 0: status = 'stopped'; break;
              case 1: status = 'waiting'; break;
              case 2: status = 'rendering'; break;
              case 3: status = 'paused'; break;
              case 4: status = 'finished'; break;
              default: status = 'error'; break;
            }
          }
          
          // Update render stats with real data from callback
          setRenderStats(prev => ({
            ...prev,
            currentSamples,
            denoisedSamples,
            maxSamples,
            megaSamplesPerSec,
            currentTime,
            estimatedTime,
            progressPercent,
            status,
          }));
        }
      } catch (error) {
        Logger.error('Failed to process render statistics:', error);
      }
    };

    // Subscribe to OnNewStatistics callback
    client.on('OnNewStatistics', handleStatistics);

    return () => {
      client.off('OnNewStatistics', handleStatistics);
    };
  }, [connected, client]);

  // Close camera presets menu when clicking outside
  useEffect(() => {
    if (!state.showCameraPresetsMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside camera presets menu
      if (!target.closest('.camera-presets-menu') && !target.closest('#camera-presets')) {
        setState(prev => ({ ...prev, showCameraPresetsMenu: false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [state.showCameraPresetsMenu]);

  // Close render priority menu when clicking outside
  useEffect(() => {
    if (!state.showRenderPriorityMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside render priority menu
      if (!target.closest('.render-priority-menu') && !target.closest('#render-priority')) {
        setState(prev => ({ ...prev, showRenderPriorityMenu: false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [state.showRenderPriorityMenu]);

  // ========================================
  // RENDER PRIORITY HANDLERS
  // ========================================

  const applyRenderPriority = useCallback(async (priority: 'low' | 'normal' | 'high') => {
    Logger.debug(`⚙️ Setting render priority: ${priority.toUpperCase()}`);
    
    try {
      // Map priority to API values (assuming 0=low, 1=normal, 2=high based on common conventions)
      const priorityValue = priority === 'low' ? 0 : priority === 'normal' ? 1 : 2;
      
      await client.callApi('ApiRenderEngine', 'setRenderPriority', { priority: priorityValue });
      setState(prev => ({ ...prev, renderPriority: priority, showRenderPriorityMenu: false }));
      Logger.debug(`✅ Render priority set to ${priority.toUpperCase()}`);
    } catch (err) {
      Logger.error(`❌ Failed to set render priority to ${priority}:`, err);
    }
  }, [client]);

  // ========================================
  // CAMERA PRESET HANDLERS
  // ========================================

  const applyCameraPreset = useCallback(async (presetName: string) => {
    Logger.debug(`📷 Applying camera preset: ${presetName}`);
    
    const distance = 10; // Distance from origin for camera position
    const target = { x: 0, y: 0, z: 0 }; // Look at origin
    
    let position = { x: 0, y: 0, z: 0 };
    
    switch (presetName) {
      case 'Front':
        position = { x: 0, y: 0, z: distance };
        break;
      case 'Back':
        position = { x: 0, y: 0, z: -distance };
        break;
      case 'Left':
        position = { x: -distance, y: 0, z: 0 };
        break;
      case 'Right':
        position = { x: distance, y: 0, z: 0 };
        break;
      case 'Top':
        position = { x: 0, y: distance, z: 0 };
        break;
      case 'Bottom':
        position = { x: 0, y: -distance, z: 0 };
        break;
      default:
        Logger.warn(`Unknown camera preset: ${presetName}`);
        return;
    }
    
    try {
      await client.setCameraPositionAndTarget(
        position.x, position.y, position.z,
        target.x, target.y, target.z
      );
      Logger.debug(`✅ Camera preset "${presetName}" applied successfully`);
      setState(prev => ({ ...prev, showCameraPresetsMenu: false })); // Close menu after selection
    } catch (err) {
      Logger.error(`❌ Failed to apply camera preset "${presetName}":`, err);
    }
  }, [client]);

  // ========================================
  // TOOLBAR ACTIONS
  // ========================================

  const handleToolbarAction = useCallback((actionId: string) => {
    Logger.debug(`🔧 RenderToolbar action: ${actionId}`);

    switch (actionId) {
      // Camera & View Controls
      case 'recenter-view':
        Logger.debug('⌖ Recenter view - resetting 2D canvas transform');
        onRecenterView?.();
        break;
      case 'reset-camera':
        Logger.debug('📷 Reset camera to original position');
        client.resetCamera().then(() => {
          Logger.debug('✅ Camera reset successful');
        }).catch(err => {
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
        client.stopRender().then(() => {
          setRenderStats(prev => ({ ...prev, status: 'stopped' }));
        }).catch(err => {
          Logger.error('❌ Failed to stop render:', err);
        });
        break;
      case 'restart-render':
        Logger.debug('🔄 Restart render');
        client.restartRender().then(() => {
          setRenderStats(prev => ({ ...prev, samples: 0, time: '00:00:00', status: 'rendering' }));
        }).catch(err => {
          Logger.error('❌ Failed to restart render:', err);
        });
        break;
      case 'pause-render':
        Logger.debug('⏸️ Pause render');
        client.pauseRender().then(() => {
          setRenderStats(prev => ({ ...prev, status: 'paused' }));
        }).catch(err => {
          Logger.error('❌ Failed to pause render:', err);
        });
        break;
      case 'start-render':
        Logger.debug('▶️ Start render');
        client.startRender().then(() => {
          setRenderStats(prev => ({ ...prev, status: 'rendering' }));
        }).catch(err => {
          Logger.error('❌ Failed to start render:', err);
        });
        break;
      case 'real-time-render':
        const newRealTimeMode = !state.realTimeMode;
        setState(prev => ({ ...prev, realTimeMode: newRealTimeMode }));
        Logger.debug(`⚡ Real-time mode: ${newRealTimeMode ? 'ON' : 'OFF'}`);
        // Real-time mode uses high priority for interactive experience
        // Set render priority: high for real-time, normal for standard
        const rtPriority = newRealTimeMode ? 2 : 1; // 0=low, 1=normal, 2=high
        client.callApi('ApiRenderEngine', 'setRenderPriority', { priority: rtPriority }).then(() => {
          const priorityName = newRealTimeMode ? 'HIGH' : 'NORMAL';
          Logger.debug(`✅ Real-time mode ${newRealTimeMode ? 'enabled' : 'disabled'} - priority set to ${priorityName}`);
          setState(prev => ({ ...prev, renderPriority: newRealTimeMode ? 'high' : 'normal' }));
        }).catch(err => {
          Logger.error('❌ Failed to set real-time rendering priority:', err);
          setState(prev => ({ ...prev, realTimeMode: state.realTimeMode })); // Revert on error
        });
        break;

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
      case 'clay-mode':
        const newClayMode = !state.clayMode;
        setState(prev => ({ ...prev, clayMode: newClayMode }));
        Logger.debug(`🎨 Clay mode: ${newClayMode ? 'ON' : 'OFF'}`);
        // CLAY_MODE_NONE = 0, CLAY_MODE_GREY = 1
        client.setClayMode(newClayMode ? 1 : 0).then(() => {
          Logger.debug('✅ Clay mode updated in Octane');
        }).catch(err => {
          Logger.error('❌ Failed to set clay mode:', err);
          // Revert UI state on error
          setState(prev => ({ ...prev, clayMode: !newClayMode }));
        });
        break;
      case 'subsample-2x2':
        const new2x2Mode = state.subSampling === '2x2' ? 'none' : '2x2';
        setState(prev => ({ ...prev, subSampling: new2x2Mode }));
        Logger.debug(`📐 Sub-sampling 2x2: ${new2x2Mode === '2x2' ? 'ON' : 'OFF'}`);
        // SUBSAMPLEMODE_NONE = 1, SUBSAMPLEMODE_2X2 = 2
        client.setSubSampleMode(new2x2Mode === '2x2' ? 2 : 1).then(() => {
          Logger.debug('✅ Sub-sampling mode updated in Octane');
        }).catch(err => {
          Logger.error('❌ Failed to set sub-sampling mode:', err);
          setState(prev => ({ ...prev, subSampling: state.subSampling }));
        });
        break;
      case 'subsample-4x4':
        const new4x4Mode = state.subSampling === '4x4' ? 'none' : '4x4';
        setState(prev => ({ ...prev, subSampling: new4x4Mode }));
        Logger.debug(`📐 Sub-sampling 4x4: ${new4x4Mode === '4x4' ? 'ON' : 'OFF'}`);
        // SUBSAMPLEMODE_NONE = 1, SUBSAMPLEMODE_4X4 = 4
        client.setSubSampleMode(new4x4Mode === '4x4' ? 4 : 1).then(() => {
          Logger.debug('✅ Sub-sampling mode updated in Octane');
        }).catch(err => {
          Logger.error('❌ Failed to set sub-sampling mode:', err);
          setState(prev => ({ ...prev, subSampling: state.subSampling }));
        });
        break;
      case 'decal-wireframe':
        setState(prev => ({ ...prev, decalWireframe: !prev.decalWireframe }));
        Logger.debug(`🟡 Decal wireframe: ${!state.decalWireframe ? 'ON' : 'OFF'} (UI only - no gRPC API available)`);
        // NOTE: No gRPC API method exists for this feature in apirender_pb2_grpc.py
        // Feature exists in Octane SE manual but not exposed through LiveLink API
        // UI state tracked for future implementation when API becomes available
        break;
      case 'render-priority':
        setState(prev => ({ ...prev, showRenderPriorityMenu: !prev.showRenderPriorityMenu }));
        Logger.debug('⚙️ Render priority menu:', !state.showRenderPriorityMenu ? 'OPEN' : 'CLOSED');
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
      case 'viewport-resolution-lock':
        const newResLockState = !state.viewportResolutionLock;
        setState(prev => ({ ...prev, viewportResolutionLock: newResLockState }));
        Logger.debug(`🔒 Viewport resolution lock: ${newResLockState ? 'ON' : 'OFF'}`);
        client.setViewportResolutionLock(newResLockState).then(() => {
          Logger.debug('✅ Viewport resolution lock updated in Octane');
        }).catch(err => {
          Logger.error('❌ Failed to set viewport resolution lock:', err);
          // Revert UI state on error
          setState(prev => ({ ...prev, viewportResolutionLock: !newResLockState }));
        });
        break;
      case 'lock-viewport':
        const newLockState = !state.viewportLocked;
        setState(prev => ({ ...prev, viewportLocked: newLockState }));
        Logger.debug(`🔒 Viewport lock: ${newLockState ? 'ON' : 'OFF'}`);
        if (onViewportLockChange) {
          onViewportLockChange(newLockState);
        }
        break;

      // Object Manipulation
      case 'object-control-alignment':
        setState(prev => ({
          ...prev,
          objectControlMode: prev.objectControlMode === 'world' ? 'local' : 'world'
        }));
        Logger.debug(`Object control alignment: ${state.objectControlMode === 'world' ? 'local' : 'world'}`);
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
  }, [client, state.worldCoordinateDisplay, onRecenterView, onCopyToClipboard, onSaveRender, onExportPasses, onViewportLockChange, onPickingModeChange, onToggleWorldCoord]);

  const togglePickingMode = (mode: ToolbarState['currentPickingMode']) => {
    const newMode = state.currentPickingMode === mode ? 'none' : mode;
    setState(prev => ({
      ...prev,
      currentPickingMode: newMode
    }));
    Logger.debug(`🎯 Picking mode: ${newMode}`);
    
    // Notify parent component of picking mode change
    if (onPickingModeChange) {
      onPickingModeChange(newMode);
    }
  };

  const toggleGizmo = (gizmo: 'translate' | 'rotate' | 'scale') => {
    setState(prev => ({
      ...prev,
      activeGizmo: prev.activeGizmo === gizmo ? 'none' : gizmo
    }));
    Logger.debug(`Active gizmo: ${state.activeGizmo === gizmo ? 'none' : gizmo}`);
    // TODO: API calls for gizmos
  };

  const getButtonActiveClass = (buttonId: string): string => {
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
  };

  // Official Octane render viewport controls based on documentation
  const toolbarIcons = [
    // Camera & View Controls
    { id: 'recenter-view', tooltip: 'Recenter View - Centers the render view display area in the Render Viewport.' },
    { id: 'reset-camera', tooltip: 'Reset Camera - Resets the camera back to the original position.' },
    { id: 'camera-presets', tooltip: 'Camera View Presets - Provides preset camera views of the scene.' },
    
    { type: 'separator' },
    
    // Render Controls
    { id: 'stop-render', tooltip: 'Stop Render - Aborts the rendering process and frees all resources.', important: true },
    { id: 'restart-render', tooltip: 'Restart Render - Halts and restarts the rendering process at zero samples.', important: true },

    { type: 'separator' },

    { id: 'pause-render', tooltip: 'Pause Render - Pauses the rendering without losing rendered data.', important: true },
    { id: 'start-render', tooltip: 'Start Render - Starts or resumes the rendering process.', important: true },

    { type: 'separator' },

    { id: 'real-time-render', tooltip: 'Real Time Rendering - Uses more GPU memory for interactive experience.' },
    
    { type: 'separator' },
    
    // Picking Tools
    { id: 'focus-picker', tooltip: 'Auto Focus Picking Mode - Click on scene to focus camera on that point.' },
    { id: 'white-balance-picker', tooltip: 'White Balance Picking Mode - Select part of scene for white point colors.' },
    { id: 'material-picker', tooltip: 'Material Picker - Select rendered scene to inspect material.' },
    { id: 'object-picker', tooltip: 'Object Picker - Select objects to inspect attributes.' },
    { id: 'camera-target-picker', tooltip: 'Camera Target Picker - Set center of rotation and zooming.' },
    { id: 'render-region-picker', tooltip: 'Render Region Picker - Specify a region in viewport to view changes.' },
    { id: 'film-region-picker', tooltip: 'Film Region Picker - Set region for Film Settings parameters.' },
    
    { type: 'separator' },
    
    // Rendering Settings
    { id: 'clay-mode', tooltip: 'Clay Mode - Shows model details without complex texturing.' },
    { id: 'subsample-2x2', tooltip: 'Sub-Sampling 2×2 - Smoother navigation by reducing render resolution.' },
    { id: 'subsample-4x4', tooltip: 'Sub-Sampling 4×4 - Maximum navigation smoothness.' },
  
    { type: 'separator' },
    
    { id: 'render-priority', tooltip: 'Render Priority Settings - Set GPU render priority.' },
    
    { type: 'separator' },
    
    // Output Controls
    { id: 'copy-clipboard', tooltip: 'Copy to Clipboard - Copies current render in LDR format.' },
    { id: 'save-render', tooltip: 'Save Render - Saves current render to disk.' },
    { id: 'export-passes', tooltip: 'Export Render Passes - Brings up Render Passes Export window.' },
    { id: 'background-image', tooltip: 'Set Background Image - Places background image in viewport.' },
    
    { type: 'separator' },
    
    // Viewport Controls
    { id: 'lock-viewport', tooltip: 'Lock Viewport - Prevents accidental changes or render restarts.' },
    
    { type: 'separator' },
    
    // Object Manipulation
    { id: 'object-control-alignment', tooltip: 'Object Control Alignment - World or local coordinate system.' },
    { id: 'translate-gizmo', tooltip: 'Placement Translation Tool - Move objects along axes.' },
    { id: 'rotate-gizmo', tooltip: 'Placement Rotation Tool - Rotate objects around axes.' },
    { id: 'scale-gizmo', tooltip: 'Placement Scale Tool - Scale objects uniformly or per axis.' },
    { id: 'world-coordinate', tooltip: 'Display World Coordinate - Shows world axis in viewport corner.' },

    { id: 'decal-wireframe', tooltip: 'Decal Wireframe - Toggles wireframe along decal boundaries.' },
   
  ];

  // Memoized camera preset handlers
  const handleFrontPresetClick = useCallback(() => applyCameraPreset('Front'), [applyCameraPreset]);
  const handleBackPresetClick = useCallback(() => applyCameraPreset('Back'), [applyCameraPreset]);
  const handleLeftPresetClick = useCallback(() => applyCameraPreset('Left'), [applyCameraPreset]);
  const handleRightPresetClick = useCallback(() => applyCameraPreset('Right'), [applyCameraPreset]);
  const handleTopPresetClick = useCallback(() => applyCameraPreset('Top'), [applyCameraPreset]);
  const handleBottomPresetClick = useCallback(() => applyCameraPreset('Bottom'), [applyCameraPreset]);

  // Memoized render priority handlers
  const handleLowPriorityClick = useCallback(() => applyRenderPriority('low'), [applyRenderPriority]);
  const handleNormalPriorityClick = useCallback(() => applyRenderPriority('normal'), [applyRenderPriority]);
  const handleHighPriorityClick = useCallback(() => applyRenderPriority('high'), [applyRenderPriority]);

  // Handle right-click on render progress indicator or GPU info bar
  const handleStatsContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setGPUStatsPosition({ x: event.clientX, y: event.clientY });
    setShowGPUStatsDialog(true);
  }, []);

  return (
    <div className={`render-toolbar-container ${className}`}>
      {/* Render Statistics Bar - Matching Octane format exactly */}
      <div className="render-stats-bar">
        <div 
          className="render-stats-left" 
          onContextMenu={handleStatsContextMenu}
          style={{ cursor: 'context-menu', position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}
          title="Right-click for GPU resource statistics"
        >
          {/* Progress Bar */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${renderStats.progressPercent}%`,
            backgroundColor: 'rgba(0, 150, 255, 0.15)',
            transition: 'width 0.3s ease',
            pointerEvents: 'none',
            zIndex: 0
          }} />
          
          {/* Stats Text (above progress bar) */}
          <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span id="render-samples-display" style={{ fontWeight: 500 }}>
              {renderStats.currentSamples}/{renderStats.denoisedSamples}/{renderStats.maxSamples} s/px
            </span>
            <span className="stats-separator">, </span>
            <span id="render-speed-display">{Math.round(renderStats.megaSamplesPerSec)} Ms/sec</span>
            <span className="stats-separator">, </span>
            <span id="render-time-display">{renderStats.currentTime}/{renderStats.estimatedTime}</span>
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
          <span id="render-memory-combined">{renderStats.version}/{renderStats.memory}</span>
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
                  <img
                    src={iconPath}
                    alt={tooltip}
                    className="toolbar-icon"
                    draggable={false}
                  />
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
