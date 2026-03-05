/**
 * usePanelLayout Hook
 * Manages panel visibility, material database modal, and integrates
 * resizable panel sizes from useResizablePanels.
 * Extracted from App.tsx to reduce state concentration.
 */

import { useState, useCallback } from 'react';
import { useResizablePanels } from './useResizablePanels';
import { Logger } from '../utils/Logger';

export interface PanelVisibility {
  renderViewport: boolean;
  nodeInspector: boolean;
  graphEditor: boolean;
  sceneOutliner: boolean;
}

export function usePanelLayout() {
  const [panelVisibility, setPanelVisibility] = useState<PanelVisibility>({
    renderViewport: true,
    nodeInspector: true,
    graphEditor: true,
    sceneOutliner: true,
  });

  const [materialDatabaseVisible, setMaterialDatabaseVisible] = useState(false);

  const { panelSizes, handleSplitterMouseDown, containerRef, isDragging, resetPanelSizes } =
    useResizablePanels();

  const handleTogglePanelVisibility = useCallback((panel: keyof PanelVisibility) => {
    setPanelVisibility(prev => ({
      ...prev,
      [panel]: !prev[panel],
    }));
    Logger.debug(`Toggled ${panel} visibility`);
  }, []);

  const handleResetLayout = useCallback(() => {
    Logger.debug('↺ Resetting layout to defaults');
    setPanelVisibility({
      renderViewport: true,
      nodeInspector: true,
      graphEditor: true,
      sceneOutliner: true,
    });
    resetPanelSizes();
  }, [resetPanelSizes]);

  const handleMaterialDatabaseOpen = useCallback(() => {
    Logger.debug('Opening Material Database');
    setMaterialDatabaseVisible(true);
  }, []);

  const handleMaterialDatabaseClose = useCallback(() => {
    Logger.debug('Closing Material Database');
    setMaterialDatabaseVisible(false);
  }, []);

  return {
    panelVisibility,
    materialDatabaseVisible,
    panelSizes,
    handleSplitterMouseDown,
    containerRef,
    isDragging,
    handleTogglePanelVisibility,
    handleResetLayout,
    handleMaterialDatabaseOpen,
    handleMaterialDatabaseClose,
  };
}
