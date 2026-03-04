/**
 * useViewportActions Hook
 *
 * Manages viewport UI actions and context menu interactions:
 * - Canvas export operations (clipboard copy, save to disk)
 * - Canvas transform state (2D zoom/pan)
 * - Context menu visibility and positioning
 * - Context menu action handlers
 *
 * Part of CallbackRenderViewport component refactoring (Phase 4)
 */

import { useState, useCallback, useEffect, useRef, RefObject } from 'react';
import { Logger } from '../../../utils/Logger';

interface UseViewportActionsProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  onExportPasses?: () => void;
  onSetBackgroundImage?: () => void;
  onToggleLockViewport?: () => void;
}

interface CanvasTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface ContextMenuPosition {
  x: number;
  y: number;
}

export function useViewportActions({
  canvasRef,
  onExportPasses,
  onSetBackgroundImage,
  onToggleLockViewport,
}: UseViewportActionsProps) {
  // Track pending revokeObjectURL timeout and URL so both are cleaned up on unmount
  const revokeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingBlobUrlRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (revokeTimerRef.current) clearTimeout(revokeTimerRef.current);
      if (pendingBlobUrlRef.current) URL.revokeObjectURL(pendingBlobUrlRef.current);
    };
  }, []);

  // Context menu state (for right-click menu)
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<ContextMenuPosition>({ x: 0, y: 0 });

  // 2D Canvas transform state (for Ctrl+zoom and Ctrl+pan)
  // Octane SE Manual: When viewport resolution lock is disabled, Ctrl+wheel zooms and Ctrl+drag pans the display
  const [canvasTransform, setCanvasTransform] = useState<CanvasTransform>({
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,
  });

  /**
   * Copy current render to clipboard
   * Copies the canvas as PNG image in LDR format
   */
  const copyToClipboard = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      Logger.warn('Cannot copy to clipboard: canvas not available');
      return;
    }

    try {
      Logger.debug('Copying render to clipboard...');

      // Draw canvas into a temporary img inside a contenteditable div,
      // select it, and use execCommand('copy'). This avoids the Clipboard API
      // permission issues that block navigator.clipboard.write in Chrome.
      const dataUrl = canvas.toDataURL('image/png');
      const img = document.createElement('img');
      img.src = dataUrl;

      const div = document.createElement('div');
      div.contentEditable = 'true';
      div.style.position = 'fixed';
      div.style.left = '-9999px';
      div.appendChild(img);
      document.body.appendChild(div);

      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(div);
      selection?.removeAllRanges();
      selection?.addRange(range);

      document.execCommand('copy');

      selection?.removeAllRanges();
      document.body.removeChild(div);

      Logger.info('Render copied to clipboard');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Failed to copy to clipboard:', errorMessage);
      throw error;
    }
  }, [canvasRef]);

  /**
   * Save current render to disk
   * Triggers browser download of canvas as PNG file
   */
  const saveRenderToDisk = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      Logger.warn('Cannot save render: canvas not available');
      return;
    }

    try {
      Logger.debug('Saving render to disk...');

      const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, 'image/png');
      });

      if (!blob) {
        throw new Error('Failed to convert canvas to blob');
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      link.download = `octane-render-${timestamp}.png`;
      link.href = url;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Delay revoke to ensure browser starts the download
      pendingBlobUrlRef.current = url;
      revokeTimerRef.current = setTimeout(() => {
        URL.revokeObjectURL(url);
        revokeTimerRef.current = null;
        pendingBlobUrlRef.current = null;
      }, 1000);

      Logger.info('Render saved to disk');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Failed to save render:', errorMessage);
      throw error;
    }
  }, [canvasRef]);

  /**
   * Recenter View - Resets 2D canvas pan/zoom to default centered view
   */
  const recenterView = useCallback(() => {
    Logger.debug('Recenter view - resetting 2D canvas transform');
    setCanvasTransform({ scale: 1.0, offsetX: 0, offsetY: 0 });
  }, []);

  /**
   * Context menu handlers
   */
  const handleCloseContextMenu = useCallback(() => {
    setContextMenuVisible(false);
  }, []);

  const handleContextCopyToClipboard = useCallback(async () => {
    try {
      await copyToClipboard();
    } catch (error) {
      Logger.error('Context menu: Copy failed', error);
    }
  }, [copyToClipboard]);

  const handleContextSaveRender = useCallback(async () => {
    try {
      await saveRenderToDisk();
    } catch (error) {
      Logger.error('Context menu: Save failed', error);
    }
  }, [saveRenderToDisk]);

  const handleContextExportPasses = useCallback(() => {
    if (onExportPasses) {
      onExportPasses();
    } else {
      Logger.debug('Export Passes handler not provided');
    }
  }, [onExportPasses]);

  const handleContextSetBackgroundImage = useCallback(() => {
    if (onSetBackgroundImage) {
      onSetBackgroundImage();
    } else {
      Logger.debug('Set Background Image handler not provided');
    }
  }, [onSetBackgroundImage]);

  const handleContextToggleLockViewport = useCallback(() => {
    if (onToggleLockViewport) {
      onToggleLockViewport();
    } else {
      Logger.debug('Toggle Lock Viewport handler not provided');
    }
  }, [onToggleLockViewport]);

  return {
    // State
    contextMenuVisible,
    setContextMenuVisible,
    contextMenuPos,
    setContextMenuPos,
    canvasTransform,
    setCanvasTransform,

    // Export functions
    copyToClipboard,
    saveRenderToDisk,
    recenterView,

    // Context menu handlers
    handleCloseContextMenu,
    handleContextCopyToClipboard,
    handleContextSaveRender,
    handleContextExportPasses,
    handleContextSetBackgroundImage,
    handleContextToggleLockViewport,
  };
}
