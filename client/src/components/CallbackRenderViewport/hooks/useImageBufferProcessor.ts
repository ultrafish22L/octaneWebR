/**
 * Image Buffer Processing Hook for CallbackRenderViewport
 *
 * Handles HDR/LDR buffer decoding and canvas rendering.
 * Extracted from CallbackRenderViewport to reduce component complexity.
 *
 * CRITICAL: Direct port of octaneWeb buffer processing logic - preserves buffer isolation
 */

import { useCallback, useRef, RefObject } from 'react';
import { Logger } from '../../../utils/Logger';
import { useCanvasRenderer } from './useCanvasRenderer';

interface OctaneImageData {
  type: number | string; // Can be numeric (0, 1) or string enum ("IMAGE_TYPE_LDR_RGBA", etc.)
  size: { x: number; y: number };
  pitch: number;
  tonemappedSamplesPerPixel: number;
  renderTime: number;
  buffer: {
    data: string;
    size: number;
    encoding: string;
  };
}

interface UseImageBufferProcessorParams {
  canvasRef: RefObject<HTMLCanvasElement>;
  onFrameRendered?: () => void;
  onStatusUpdate?: (status: string) => void;
  isDragging?: boolean; // ✅ Phase 3: Drag state for input-side throttling
}

/**
 * Hook for processing Octane image buffers and rendering to canvas
 * ✅ Phase 3: Now supports input-side throttling during camera drag
 */
export function useImageBufferProcessor({
  canvasRef,
  onFrameRendered,
  onStatusUpdate,
  isDragging = false, // ✅ Phase 3: Drag state for input-side throttling
}: UseImageBufferProcessorParams) {
  // ✅ Phase 3: Input-side throttling during camera drag
  // Track last accepted image time to throttle to 30 FPS during drag
  const lastAcceptedTimeRef = useRef(0);
  const DRAG_THROTTLE_INTERVAL = 33; // ms (30 FPS = 1000ms / 30 = 33.33ms)

  /**
   * Convert LDR RGBA buffer to canvas
   * CRITICAL: Exact port from octaneWeb - preserves buffer isolation
   */
  const convertLDRRGBA = useCallback(
    (
      buffer: Uint8Array,
      width: number,
      height: number,
      pitch: number,
      canvasImageData: ImageData
    ) => {
      const data = canvasImageData.data;
      const expectedSize = width * height * 4;

      if (buffer.length === expectedSize) {
        // Direct copy - no pitch issues
        for (let i = 0; i < expectedSize; i += 4) {
          data[i] = buffer[i]; // R
          data[i + 1] = buffer[i + 1]; // G
          data[i + 2] = buffer[i + 2]; // B
          data[i + 3] = buffer[i + 3]; // A
        }
      } else {
        // Handle pitch (row stride)
        let pitchBytes;

        if (pitch * height === buffer.length) {
          pitchBytes = pitch;
        } else if (pitch * 4 * height === buffer.length) {
          pitchBytes = pitch * 4;
        } else {
          pitchBytes = width * 4;
        }

        // Copy with pitch consideration
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const srcIndex = y * pitchBytes + x * 4;
            const dstIndex = (y * width + x) * 4;

            if (srcIndex + 3 < buffer.length) {
              data[dstIndex] = buffer[srcIndex]; // R
              data[dstIndex + 1] = buffer[srcIndex + 1]; // G
              data[dstIndex + 2] = buffer[srcIndex + 2]; // B
              data[dstIndex + 3] = buffer[srcIndex + 3]; // A
            }
          }
        }
      }
    },
    []
  );

  /**
   * Convert HDR RGBA buffer to canvas
   * CRITICAL: Exact port from octaneWeb - buffer isolation prevents corruption
   */
  const convertHDRRGBA = useCallback(
    (
      buffer: Uint8Array,
      width: number,
      height: number,
      pitch: number,
      canvasImageData: ImageData
    ) => {
      const data = canvasImageData.data;

      // Create a new ArrayBuffer to avoid buffer reuse corruption
      const floatBuffer = new ArrayBuffer(buffer.length);
      const floatView = new Float32Array(floatBuffer);
      const uint8View = new Uint8Array(floatBuffer);

      // Copy the original buffer data
      uint8View.set(buffer);

      // Now reinterpret as floats safely
      const expectedFloats = width * height * 4;

      if (floatView.length === expectedFloats) {
        // Direct copy - no pitch issues
        for (let i = 0; i < expectedFloats; i += 4) {
          // Simple tone mapping: clamp and convert to 8-bit
          data[i] = Math.min(255, Math.max(0, floatView[i] * 255)); // R
          data[i + 1] = Math.min(255, Math.max(0, floatView[i + 1] * 255)); // G
          data[i + 2] = Math.min(255, Math.max(0, floatView[i + 2] * 255)); // B
          data[i + 3] = Math.min(255, Math.max(0, floatView[i + 3] * 255)); // A
        }
      } else {
        // Handle pitch for HDR
        let pitchFloats;

        if (pitch * height === buffer.length) {
          pitchFloats = pitch / 4;
        } else if (pitch * 4 * height === buffer.length) {
          pitchFloats = pitch;
        } else {
          pitchFloats = width;
        }

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const srcIndex = (y * pitchFloats + x) * 4;
            const dstIndex = (y * width + x) * 4;

            if (srcIndex + 3 < floatView.length) {
              data[dstIndex] = Math.min(255, Math.max(0, floatView[srcIndex] * 255));
              data[dstIndex + 1] = Math.min(255, Math.max(0, floatView[srcIndex + 1] * 255));
              data[dstIndex + 2] = Math.min(255, Math.max(0, floatView[srcIndex + 2] * 255));
              data[dstIndex + 3] = Math.min(255, Math.max(0, floatView[srcIndex + 3] * 255));
            }
          }
        }
      }
    },
    []
  );

  /**
   * Convert raw buffer to canvas ImageData
   * CRITICAL: Exact port of octaneWeb conversion logic
   */
  const convertBufferToCanvas = useCallback(
    (buffer: Uint8Array, imageData: OctaneImageData, canvasImageData: globalThis.ImageData) => {
      const width = imageData.size.x;
      const height = imageData.size.y;
      const imageType = imageData.type;

      // Handle both numeric (0, 1) and string enum ("IMAGE_TYPE_LDR_RGBA", "IMAGE_TYPE_HDR_RGBA")
      const isLDR = imageType === 0 || imageType === 'IMAGE_TYPE_LDR_RGBA';
      const isHDR = imageType === 1 || imageType === 'IMAGE_TYPE_HDR_RGBA';

      if (isLDR) {
        convertLDRRGBA(buffer, width, height, imageData.pitch, canvasImageData);
      } else if (isHDR) {
        convertHDRRGBA(buffer, width, height, imageData.pitch, canvasImageData);
      } else {
        Logger.debug(`Unsupported image type: ${imageType}, defaulting to LDR RGBA`);
        convertLDRRGBA(buffer, width, height, imageData.pitch, canvasImageData);
      }
    },
    [convertLDRRGBA, convertHDRRGBA]
  );

  // ✅ Phase 2: RAF-based renderer with frame coalescing
  // ✅ Phase 4: Flush mechanism for progressive rendering
  const { scheduleRender, flushPendingFrame } = useCanvasRenderer({
    canvasRef,
    onFrameRendered,
    onStatusUpdate,
    convertBufferToCanvas,
  });

  /**
   * Display image from callback data
   * ✅ Phase 2: Now schedules RAF instead of immediate rendering
   * ✅ Phase 3: Input-side throttling during camera drag (30 FPS)
   * - Validates image data
   * - Throttles image acceptance to 30 FPS during drag
   * - Schedules RAF render (automatic frame coalescing)
   * - RAF loop handles actual canvas rendering
   */
  const displayImage = useCallback(
    (imageData: OctaneImageData) => {
      Logger.debug('🎯 [VIEWPORT] displayImage CALLED (RAF scheduling)');
      Logger.debugV('📊 [VIEWPORT] Image data:', {
        hasSize: !!imageData.size,
        width: imageData.size?.x,
        height: imageData.size?.y,
        hasBuffer: !!imageData.buffer,
        bufferSize: imageData.buffer?.size,
        type: imageData.type,
      });

      try {
        // Quick validation
        if (!canvasRef.current) {
          Logger.error('❌ [VIEWPORT] Canvas ref is null');
          return;
        }

        if (!imageData.buffer || !imageData.buffer.data) {
          Logger.error('❌ [VIEWPORT] No image buffer in callback data');
          return;
        }

        // ✅ Phase 3: Input-side throttling during camera drag
        // During drag, only accept 1 image every 33ms (30 FPS)
        // This gives CPU more time per frame (33ms vs 16.6ms at 60 FPS)
        // Result: Smooth 30 FPS with relaxed CPU vs choppy 60 FPS with stressed CPU
        if (isDragging) {
          const now = Date.now();
          const timeSinceLastAccepted = now - lastAcceptedTimeRef.current;

          if (timeSinceLastAccepted < DRAG_THROTTLE_INTERVAL) {
            Logger.debugV(
              `🚦 [THROTTLE] Ignored image (${timeSinceLastAccepted}ms < ${DRAG_THROTTLE_INTERVAL}ms)`
            );
            return; // IGNORE - too soon after last accepted image
          }

          lastAcceptedTimeRef.current = now;
          Logger.debugV(
            `✅ [THROTTLE] Accepted image (${timeSinceLastAccepted}ms >= ${DRAG_THROTTLE_INTERVAL}ms)`
          );
        }

        // ✅ Phase 2: Schedule RAF render instead of immediate rendering
        // This enables frame coalescing - if RAF hasn't fired yet, this
        // image replaces the previous pending image
        scheduleRender(imageData);
        Logger.debugV('✅ [VIEWPORT] Render scheduled via RAF');
      } catch (error: any) {
        Logger.error('❌ [VIEWPORT] Error scheduling render:', error);
        Logger.error('❌ [VIEWPORT] Stack:', error.stack);
      }
    },
    [canvasRef, scheduleRender, isDragging]
  );

  return { displayImage, flushPendingFrame };
}
