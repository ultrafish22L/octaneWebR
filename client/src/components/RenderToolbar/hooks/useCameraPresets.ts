/**
 * useCameraPresets Hook
 *
 * Manages camera preset functionality for RenderToolbar:
 * - Camera preset handlers (front, back, left, right, top, bottom)
 * - Click-outside handlers for camera and render priority menus
 * - Render priority settings
 *
 * Part of RenderToolbar component refactoring (Phase 3)
 */

import { useCallback, useEffect, Dispatch, SetStateAction } from 'react';
import { OctaneClient } from '../../../services/OctaneClient';
import { Logger } from '../../../utils/Logger';
import { ToolbarState } from './useRenderSettings';

interface UseCameraPresetsProps {
  client: OctaneClient;
  state: ToolbarState;
  setState: Dispatch<SetStateAction<ToolbarState>>;
}

export function useCameraPresets({ client, state, setState }: UseCameraPresetsProps) {
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
  }, [state.showCameraPresetsMenu, setState]);

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
  }, [state.showRenderPriorityMenu, setState]);

  // ========================================
  // RENDER PRIORITY HANDLERS
  // ========================================

  const applyRenderPriority = useCallback(
    async (priority: 'low' | 'normal' | 'high') => {
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
    },
    [client, setState]
  );

  // ========================================
  // CAMERA PRESET HANDLERS
  // ========================================

  const applyCameraPreset = useCallback(
    async (presetName: string) => {
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
          position.x,
          position.y,
          position.z,
          target.x,
          target.y,
          target.z
        );
        Logger.debug(`✅ Camera preset "${presetName}" applied successfully`);
        setState(prev => ({ ...prev, showCameraPresetsMenu: false })); // Close menu after selection
      } catch (err) {
        Logger.error(`❌ Failed to apply camera preset "${presetName}":`, err);
      }
    },
    [client, setState]
  );

  return {
    applyRenderPriority,
    applyCameraPreset,
  };
}
