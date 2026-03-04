/**
 * Resizable Panels Hook
 * Manages drag-to-resize functionality for panel boundaries
 */

import { Logger } from '../utils/Logger';
import { useState, useCallback, useEffect, useRef } from 'react';

interface PanelSizes {
  left: number;
  center: number;
  right: number;
  top: number; // Top row height (viewport + inspector)
  bottom: number; // Calculated from window height - top
}

// Layout constants
const MENU_BAR_HEIGHT = 30;
const STATUS_BAR_HEIGHT = 25;
const VIEWPORT_HEIGHT_RATIO = 0.6;
const MIN_OUTLINER_WIDTH = 150;
const MIN_INSPECTOR_WIDTH = 250;
const MIN_CENTER_WIDTH = 400;
const MIN_VIEWPORT_HEIGHT = 200;
const MIN_GRAPH_HEIGHT = 150;

const DEFAULT_PANEL_SIZES: PanelSizes = {
  left: 260,
  center: 0,
  right: 550,
  top: 0,
  bottom: 0,
};

const getInitialTopHeight = (): number => {
  const availableHeight = window.innerHeight - MENU_BAR_HEIGHT - STATUS_BAR_HEIGHT;
  return Math.floor(availableHeight * VIEWPORT_HEIGHT_RATIO);
};

export function useResizablePanels() {
  const [panelSizes, setPanelSizes] = useState<PanelSizes>({
    ...DEFAULT_PANEL_SIZES,
    top: getInitialTopHeight(),
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'left' | 'right' | 'top' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset panel sizes to default
  const resetPanelSizes = useCallback(() => {
    Logger.debug('↺ Resetting panel sizes to defaults (60% render viewport, 40% node graph)');
    setPanelSizes({
      ...DEFAULT_PANEL_SIZES,
      top: getInitialTopHeight(),
    });
  }, []);

  // Handle mouse down on splitter
  const handleSplitterMouseDown = useCallback((type: 'left' | 'right' | 'top') => {
    Logger.debug(`Splitter drag started: ${type}`);
    setIsDragging(true);
    setDragType(type);
    document.body.style.cursor = type === 'top' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // Handle mouse move
  useEffect(() => {
    if (!isDragging || !dragType || !containerRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left;
      const mouseY = e.clientY - containerRect.top;

      setPanelSizes(prev => {
        const TOTAL_SPLITTERS = 8; // Two 4px splitters

        if (dragType === 'left') {
          // Dragging left boundary (between Scene Outliner and center)
          const minLeft = MIN_OUTLINER_WIDTH;
          const maxLeft = containerRect.width - prev.right - TOTAL_SPLITTERS - MIN_CENTER_WIDTH;
          const newLeft = Math.max(minLeft, Math.min(maxLeft, mouseX));
          Logger.debug(`Left panel resize: ${newLeft}px (mouse: ${mouseX}px)`);

          return {
            ...prev,
            left: newLeft,
          };
        } else if (dragType === 'right') {
          // Dragging right boundary (between center and Node Inspector)
          const minRight = MIN_INSPECTOR_WIDTH;
          const maxRight = containerRect.width - prev.left - TOTAL_SPLITTERS - MIN_CENTER_WIDTH;
          const distanceFromRight = containerRect.width - mouseX;
          const newRight = Math.max(minRight, Math.min(maxRight, distanceFromRight));
          Logger.debug(`Right panel resize: ${newRight}px (mouse: ${mouseX}px)`);

          return {
            ...prev,
            right: newRight,
          };
        } else if (dragType === 'top') {
          // Dragging top/bottom boundary (between top row and Node Graph Editor)
          const minTop = MIN_VIEWPORT_HEIGHT;
          const maxTop = containerRect.height - MIN_GRAPH_HEIGHT;
          const newTop = Math.max(minTop, Math.min(maxTop, mouseY));
          Logger.debug(`Top row resize: ${newTop}px (mouse: ${mouseY}px)`);

          return {
            ...prev,
            top: newTop,
          };
        }

        return prev;
      });
    };

    const handleMouseUp = () => {
      Logger.debug('Splitter drag ended');
      setIsDragging(false);
      setDragType(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragType]);

  return {
    panelSizes,
    handleSplitterMouseDown,
    containerRef,
    isDragging,
    resetPanelSizes,
  };
}
