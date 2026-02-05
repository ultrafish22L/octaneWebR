/**
 * Image Buffer Processing Hook for CallbackRenderViewport
 *
 * Handles HDR/LDR buffer decoding and canvas rendering.
 * Extracted from CallbackRenderViewport to reduce component complexity.
 *
 * CRITICAL: Direct port of octaneWeb buffer processing logic - preserves buffer isolation
 */

import { useCallback, RefObject, useRef } from 'react';
import Logger from '../../../utils/Logger';

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
}

/**
 * Hook for processing Octane image buffers and rendering to canvas
 */
export function useImageBufferProcessor({
  canvasRef,
  onFrameRendered,
  onStatusUpdate,
}: UseImageBufferProcessorParams) {
  // ✅ Throttle status updates to human-readable rate (Phase 1 optimization)
  const lastStatusUpdateRef = useRef(0);
  const STATUS_UPDATE_INTERVAL = 500; // ms (2 updates per second max)

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

  /**
   * Display image from callback data
   * CRITICAL: Direct port of octaneWeb buffer processing logic
   */
  const displayImage = useCallback(
    (imageData: OctaneImageData) => {
      Logger.debug('🎯🎯🎯 [VIEWPORT] displayCallbackImage CALLED');
      Logger.debug('📊 [VIEWPORT] Image data:', {
        hasSize: !!imageData.size,
        width: imageData.size?.x,
        height: imageData.size?.y,
        hasBuffer: !!imageData.buffer,
        bufferSize: imageData.buffer?.size,
        type: imageData.type,
      });

      try {
        const canvas = canvasRef.current;
        Logger.debug('🎯 [VIEWPORT] Canvas ref:', !!canvas);

        if (!canvas) {
          Logger.error('❌ [VIEWPORT] Canvas ref is null - cannot display image!');
          return;
        }

        Logger.debug('📊 [VIEWPORT] Canvas element:', {
          width: canvas.width,
          height: canvas.height,
          offsetWidth: canvas.offsetWidth,
          offsetHeight: canvas.offsetHeight,
          parentElement: !!canvas.parentElement,
        });

        if (onFrameRendered) {
          onFrameRendered();
        }

        if (!imageData.buffer || !imageData.buffer.data) {
          Logger.error('❌ [VIEWPORT] No image buffer in callback data');
          return;
        }

        // Decode base64 buffer
        const bufferData: any = imageData.buffer.data; // Can be string or Buffer object
        const width = imageData.size.x;
        const height = imageData.size.y;

        // ✅ Only resize canvas when dimensions actually change (Phase 1 optimization)
        // Setting canvas.width/height clears the canvas, so avoid it when unnecessary
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          Logger.debug('[displayCallbackImage] Failed to get 2d context');
          return;
        }

        const canvasImageData = ctx.createImageData(width, height);

        // Handle buffer data - could be base64 string or Node.js Buffer object
        let bytes: Uint8Array;

        // Check if it's a Node.js Buffer serialized as JSON {type: "Buffer", data: [bytes]}
        if (
          typeof bufferData === 'object' &&
          bufferData.type === 'Buffer' &&
          Array.isArray(bufferData.data)
        ) {
          bytes = new Uint8Array(bufferData.data);
        } else if (typeof bufferData === 'string') {
          // It's a base64 string
          try {
            const binaryString = atob(bufferData);
            bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
          } catch (error: any) {
            Logger.debug(
              '[displayCallbackImage] Base64 decode error:',
              error?.message || error?.toString() || JSON.stringify(error)
            );
            return;
          }
        } else {
          Logger.debug(
            '[displayCallbackImage] Unknown buffer format:',
            typeof bufferData,
            bufferData
          );
          return;
        }

        // Convert buffer to RGBA format for canvas
        Logger.debug('🎨 [VIEWPORT] Converting buffer to canvas format...');
        convertBufferToCanvas(bytes, imageData, canvasImageData);
        Logger.debug('✅ [VIEWPORT] Buffer conversion complete');

        Logger.debug('🎨 [VIEWPORT] Rendering to canvas...');
        ctx.putImageData(canvasImageData, 0, 0);
        Logger.debug('✅ [VIEWPORT] Image rendered to canvas successfully!');

        // ✅ Throttled status updates (Phase 1 optimization)
        // Only update status 2 times per second max (human-readable rate)
        if (onStatusUpdate) {
          const now = Date.now();
          if (now - lastStatusUpdateRef.current >= STATUS_UPDATE_INTERVAL) {
            lastStatusUpdateRef.current = now;
            const newStatus =
              `${width}x${height} | ` +
              `${(imageData.buffer.size / 1024).toFixed(1)}KB | ` +
              `${imageData.tonemappedSamplesPerPixel.toFixed(1)} spp`;
            onStatusUpdate(newStatus);
            Logger.debug('📊 [VIEWPORT] Status updated:', newStatus);
          }
        }
      } catch (error: any) {
        Logger.error('❌ [VIEWPORT] Error displaying callback image:', error);
        Logger.error('❌ [VIEWPORT] Stack:', error.stack);
      }
    },
    [canvasRef, onFrameRendered, onStatusUpdate, convertBufferToCanvas]
  );

  return { displayImage };
}
