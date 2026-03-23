/**
 * Shared Surface Renderer Hook (STUB)
 *
 * Placeholder for future DX shared surface rendering in Electron.
 * Currently delegates to the standard canvas2d pipeline.
 *
 * When fully implemented, this hook will:
 * 1. Receive a DXGI shared handle from Octane (via IPC or new gRPC callback)
 * 2. Use the native addon to open the shared texture
 * 3. Map the texture directly to a WebGL texture (zero-copy via EGL interop)
 *    or copy to a staging buffer and upload via texImage2D
 * 4. Render the texture to a WebGL canvas
 *
 * The stub is wired but inert — it logs that shared surface mode is stubbed
 * and falls through to canvas2d rendering via useImageBufferProcessor.
 */

import { useCallback, useEffect, useMemo, useRef, RefObject } from 'react';
import { Logger } from '../../../utils/Logger';
import { useImageBufferProcessor } from './useImageBufferProcessor';
import type { SharedSurfaceMessage, SharedSurfaceStatus } from '../renderers/types';

interface UseSharedSurfaceRendererParams {
  canvasRef: RefObject<HTMLCanvasElement>;
  onFrameRendered?: () => void;
  onStatusUpdate?: (status: string) => void;
  isDragging?: boolean;
}

export function useSharedSurfaceRenderer({
  canvasRef,
  onFrameRendered,
  onStatusUpdate,
  isDragging = false,
}: UseSharedSurfaceRendererParams) {
  const surfaceStatus = useMemo<SharedSurfaceStatus>(
    () => ({
      state: 'unavailable',
      reason: 'Waiting for native addon (Phase 2) — detection active, rendering via canvas2d',
    }),
    []
  );

  // Log stub status once
  const hasLoggedRef = useRef(false);
  useEffect(() => {
    if (!hasLoggedRef.current) {
      hasLoggedRef.current = true;
      Logger.info(
        '[SharedSurface] Detection active — shared surface descriptors will be logged. ' +
          'Rendering via canvas2d until native addon is available (Phase 2).'
      );
    }
  }, []);

  // Delegate to canvas2d pipeline (fallback until native addon is built)
  const { displayImage, flushPendingFrame } = useImageBufferProcessor({
    canvasRef,
    onFrameRendered,
    onStatusUpdate,
    isDragging,
  });

  /**
   * Handle a shared surface descriptor from the server.
   * Phase 1: Log the descriptor for validation. Falls through to canvas2d via displayImage.
   * Phase 2+: Will use native addon to open DXGI handle and map texture.
   */
  const sharedSurfaceCountRef = useRef(0);
  const displaySharedSurface = useCallback((descriptor: SharedSurfaceMessage) => {
    sharedSurfaceCountRef.current++;
    // Log first occurrence and then every 100th to avoid spam
    if (sharedSurfaceCountRef.current === 1 || sharedSurfaceCountRef.current % 100 === 0) {
      Logger.info(
        `[SharedSurface] Descriptor #${sharedSurfaceCountRef.current}: ` +
          `${descriptor.width}x${descriptor.height} ${descriptor.imageType} ` +
          `LUID=${descriptor.luid} ref=${descriptor.surfaceRef}`
      );
    }
    // Phase 1: No native addon yet — the server also sends render_images as fallback,
    // so the standard pixel buffer path will handle rendering via the else branch
    // in handleNewImage. This method is only called when activeRenderer === 'shared-surface',
    // which requires hasNativeAddon to be true (Phase 2).
  }, []);

  return {
    displayImage,
    flushPendingFrame,
    displaySharedSurface,
    surfaceStatus,
  };
}
