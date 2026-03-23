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

import { useEffect, useMemo, useRef, RefObject } from 'react';
import { Logger } from '../../../utils/Logger';
import { useImageBufferProcessor } from './useImageBufferProcessor';
import type { SharedSurfaceStatus } from '../renderers/types';

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
      reason: 'Stub implementation — DX shared surface not yet implemented',
    }),
    []
  );

  // Log stub status once
  const hasLoggedRef = useRef(false);
  useEffect(() => {
    if (!hasLoggedRef.current) {
      hasLoggedRef.current = true;
      Logger.info(
        '[SharedSurface] Stub renderer active — falling through to canvas2d pipeline. ' +
          'Future: DX shared handle → native addon → WebGL texture upload'
      );
    }
  }, []);

  // Delegate to canvas2d pipeline (the stub just passes through)
  const { displayImage, flushPendingFrame } = useImageBufferProcessor({
    canvasRef,
    onFrameRendered,
    onStatusUpdate,
    isDragging,
  });

  return {
    displayImage,
    flushPendingFrame,
    surfaceStatus,
  };
}
