/**
 * useViewportControls Hook
 * Manages viewport interaction state: world coordinate display,
 * viewport locking, and picking mode.
 * Extracted from App.tsx to reduce state concentration.
 */

import { useState, useCallback } from 'react';
import { Logger } from '../utils/Logger';

export type PickingMode =
  | 'none'
  | 'focus'
  | 'whiteBalance'
  | 'material'
  | 'object'
  | 'cameraTarget'
  | 'renderRegion'
  | 'filmRegion';

export function useViewportControls() {
  const [showWorldCoord, setShowWorldCoord] = useState(true);
  const [viewportLocked, setViewportLocked] = useState(false);
  const [pickingMode, setPickingMode] = useState<PickingMode>('none');

  const toggleWorldCoord = useCallback(() => {
    setShowWorldCoord(prev => !prev);
  }, []);

  const handleViewportLockChange = useCallback((locked: boolean) => {
    setViewportLocked(locked);
    Logger.debug(`App.tsx: Viewport lock ${locked ? 'enabled' : 'disabled'}`);
  }, []);

  const handleToggleLockViewport = useCallback(() => {
    setViewportLocked(prev => {
      Logger.debug(`App.tsx: Viewport lock toggled to ${!prev ? 'enabled' : 'disabled'}`);
      return !prev;
    });
  }, []);

  const handlePickingModeChange = useCallback((mode: PickingMode) => {
    setPickingMode(mode);
    Logger.debug(`App.tsx: Picking mode changed to: ${mode}`);
  }, []);

  const handleSetBackgroundImage = useCallback(() => {
    Logger.debug('Set Background Image - TODO: Implement file picker');
    Logger.warn(
      'Set Background Image: Feature coming soon! This will allow you to set a background image visible through alpha channel.'
    );
  }, []);

  return {
    showWorldCoord,
    viewportLocked,
    pickingMode,
    toggleWorldCoord,
    handleViewportLockChange,
    handleToggleLockViewport,
    handlePickingModeChange,
    handleSetBackgroundImage,
  };
}
