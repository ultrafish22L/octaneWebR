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

const DEFAULT_PANEL_SIZES: PanelSizes = {
  left: 260, // Scene Outliner width
  center: 0, // Will be calculated
  right: 440, // Node Inspector width
  top: 0, // Will be calculated as 60% of window height on mount
  bottom: 0, // Will be calculated from window height - top
};

// Calculate initial top panel height as 60% of available height
const getInitialTopHeight = (): number => {
  // Subtract menu bar (30px) and status bar (25px) from window height
  const availableHeight = window.innerHeight - 30 - 25;
  return Math.floor(availableHeight * 0.6); // 60% for render viewport
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
    Logger.debug(`🖱️ Splitter drag started: ${type}`);
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
          const minLeft = 150;
          const maxLeft = containerRect.width - prev.right - TOTAL_SPLITTERS - 400;
          const newLeft = Math.max(minLeft, Math.min(maxLeft, mouseX));
          Logger.debug(`📏 Left panel resize: ${newLeft}px (mouse: ${mouseX}px)`);

          return {
            ...prev,
            left: newLeft,
          };
        } else if (dragType === 'right') {
          // Dragging right boundary (between center and Node Inspector)
          const minRight = 250;
          const maxRight = containerRect.width - prev.left - TOTAL_SPLITTERS - 400;
          const distanceFromRight = containerRect.width - mouseX;
          const newRight = Math.max(minRight, Math.min(maxRight, distanceFromRight));
          Logger.debug(`📏 Right panel resize: ${newRight}px (mouse: ${mouseX}px)`);

          return {
            ...prev,
            right: newRight,
          };
        } else if (dragType === 'top') {
          // Dragging top/bottom boundary (between top row and Node Graph Editor)
          const minTop = 200;
          const maxTop = containerRect.height - 150; // Leave room for node graph
          const newTop = Math.max(minTop, Math.min(maxTop, mouseY));
          Logger.debug(`📏 Top row resize: ${newTop}px (mouse: ${mouseY}px)`);

          return {
            ...prev,
            top: newTop,
          };
        }

        return prev;
      });
    };

    const handleMouseUp = () => {
      Logger.debug('🖱️ Splitter drag ended');
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
