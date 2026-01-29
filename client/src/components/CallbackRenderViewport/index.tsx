/**
 * Callback-based Render Viewport Component (React TypeScript)
 * 
 * Production-ready port of octaneWeb's CallbackRenderViewport with React best practices:
 * - Real-time callback streaming with OnNewImage events
 * - Mouse drag camera synchronization
 * - HDR/LDR buffer processing with proper isolation
 * - Automatic render triggering when connected
 */

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useOctane } from '../../hooks/useOctane';
import { ViewportContextMenu } from './ViewportContextMenu';
import Logger from '../../utils/Logger';

interface OctaneImageData {
  type: number | string;  // Can be numeric (0, 1) or string enum ("IMAGE_TYPE_LDR_RGBA", etc.)
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

interface CallbackData {
  type: string;
  render_images?: {
    data: OctaneImageData[];
  };
  timestamp?: number;
  callback_id?: string;
}

interface CameraState {
  radius: number;
  theta: number;
  phi: number;
  center: [number, number, number];
  fov: number;
}

interface CallbackRenderViewportProps {
  showWorldCoord?: boolean;
  viewportLocked?: boolean;
  pickingMode?: 'none' | 'focus' | 'whiteBalance' | 'material' | 'object' | 'cameraTarget' | 'renderRegion' | 'filmRegion';
  onExportPasses?: () => void;
  onSetBackgroundImage?: () => void;
  onToggleLockViewport?: () => void;
}

export interface CallbackRenderViewportHandle {
  copyToClipboard: () => Promise<void>;
  saveRenderToDisk: () => Promise<void>;
  recenterView: () => void;
}

export const CallbackRenderViewport = React.memo(forwardRef<CallbackRenderViewportHandle, CallbackRenderViewportProps>(
  function CallbackRenderViewport({ 
    showWorldCoord = true, 
    viewportLocked = false, 
    pickingMode = 'none',
    onExportPasses,
    onSetBackgroundImage,
    onToggleLockViewport
  }, ref) {
  const { client, connected } = useOctane();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [status, setStatus] = useState('Initializing...');
  const [isRendering, setIsRendering] = useState(false);
  
  // Component mount logging
  useEffect(() => {
    console.log('🎯 [VIEWPORT] CallbackRenderViewport component MOUNTED');
    console.log('🎯 [VIEWPORT] Initial connected state:', connected);
    console.log('🎯 [VIEWPORT] Canvas ref available:', !!canvasRef.current);
    console.log('🎯 [VIEWPORT] Viewport ref available:', !!viewportRef.current);
    return () => {
      console.log('🎯 [VIEWPORT] CallbackRenderViewport component UNMOUNTED');
    };
  }, []);
  
  // Region selection state (for render region picking)
  const [isSelectingRegion, setIsSelectingRegion] = useState(false);
  const [regionStart, setRegionStart] = useState<{ x: number; y: number } | null>(null);
  const [regionEnd, setRegionEnd] = useState<{ x: number; y: number } | null>(null);
  
  // Context menu state (for right-click menu)
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  
  // 2D Canvas transform state (for Ctrl+zoom and Ctrl+pan)
  // Octane SE Manual: When viewport resolution lock is disabled, Ctrl+wheel zooms and Ctrl+drag pans the display
  const [canvasTransform, setCanvasTransform] = useState({ scale: 1.0, offsetX: 0, offsetY: 0 });
  const is2DPanningRef = useRef(false);  // Ctrl+left drag = 2D canvas pan
  
  // Camera state for mouse controls
  const cameraRef = useRef<CameraState>({
    radius: 20.0,
    theta: 0.0,
    phi: 0.0,
    center: [0.0, 0.0, 0.0],
    fov: 45.0
  });
  
  // Mouse drag state
  const isDraggingRef = useRef(false);  // Left button = orbit
  const isPanningRef = useRef(false);   // Right button = pan
  const hasRightDraggedRef = useRef(false);  // Track if right-click involved dragging
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  
  // Camera update rate limiting (10 Hz = 100ms between updates)
  const CAMERA_UPDATE_INTERVAL = 100; // ms
  const lastCameraUpdateRef = useRef(0);
  const pendingCameraUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const hasPendingUpdateRef = useRef(false);

  /**
   * Trigger Octane display update via ApiChangeManager
   */
  const triggerOctaneUpdate = useCallback(async () => {
    try {
      await client.callApi('ApiChangeManager', 'update', {});
    } catch (error: any) {
      Logger.error('Failed to trigger render:', error.message);
    }
  }, [client]);

  /**
   * Initialize camera from Octane's current camera settings
   * Uses LiveLink.GetCamera to fetch current camera position and target
   */
  const initializeCameraFromOctane = useCallback(async () => {
    try {
      // Get current camera from Octane using LiveLink.GetCamera
      const response = await client.getCamera();
      
      if (!response || !response.position || !response.target) {
        Logger.debug('No camera data from Octane, using defaults');
        return;
      }

      const position = response.position;
      const target = response.target;
      
      Logger.debug('Camera from Octane:', { position, target });
      
      cameraRef.current.center = [target.x, target.y, target.z];
      
      const dx = position.x - target.x;
      const dy = position.y - target.y;
      const dz = position.z - target.z;
      
      cameraRef.current.radius = Math.sqrt(dx * dx + dy * dy + dz * dz);
      cameraRef.current.theta = Math.atan2(dz, dx);
      cameraRef.current.phi = Math.asin(dy / cameraRef.current.radius);
      
      Logger.debug('Camera initialized:', cameraRef.current);
    } catch (error: any) {
      Logger.warn('Failed to initialize camera from Octane:', error.message);
    }
  }, [client]);

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
      
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });

      if (!blob) {
        throw new Error('Failed to convert canvas to blob');
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob
        })
      ]);

      Logger.info('Render copied to clipboard');
    } catch (error: any) {
      Logger.error('Failed to copy to clipboard:', error.message);
      throw error;
    }
  }, []);

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
      
      const blob = await new Promise<Blob | null>((resolve) => {
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
      
      URL.revokeObjectURL(url);

      Logger.info('Render saved to disk');
    } catch (error: any) {
      Logger.error('Failed to save render:', error.message);
      throw error;
    }
  }, []);

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

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    copyToClipboard,
    saveRenderToDisk,
    recenterView
  }), [copyToClipboard, saveRenderToDisk, recenterView]);

  /**
   * Update Octane camera from current state
   * Uses LiveLink.SetCamera to update both position and target efficiently
   */
  const updateOctaneCamera = useCallback(async () => {
    if (!connected) return;

    try {
      const { radius, theta, phi, center } = cameraRef.current;
      
      // Convert spherical to Cartesian coordinates
      const x = radius * Math.cos(phi) * Math.sin(theta);
      const y = radius * Math.sin(phi);
      const z = radius * Math.cos(phi) * Math.cos(theta);
      
      const posX = x + center[0];
      const posY = y + center[1];
      const posZ = z + center[2];
      
      // Set both camera position and target in one efficient call
      await client.setCameraPositionAndTarget(
        posX, posY, posZ,
        center[0], center[1], center[2]
      );
      
      // Trigger render update
      await triggerOctaneUpdate();
    } catch (error: any) {
      Logger.error('Failed to update camera:', error.message);
    }
  }, [connected, client, triggerOctaneUpdate]);

  /**
   * Throttled camera update - limits updates to 10 Hz for smooth performance
   * Immediately updates local state, but rate-limits Octane API calls
   */
  const updateOctaneCameraThrottled = useCallback(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastCameraUpdateRef.current;

    // Clear any pending timeout
    if (pendingCameraUpdateRef.current) {
      clearTimeout(pendingCameraUpdateRef.current);
      pendingCameraUpdateRef.current = null;
    }

    if (timeSinceLastUpdate >= CAMERA_UPDATE_INTERVAL) {
      // Enough time has passed, update immediately
      lastCameraUpdateRef.current = now;
      hasPendingUpdateRef.current = false;
      updateOctaneCamera();
    } else {
      // Too soon, schedule update for later
      const delay = CAMERA_UPDATE_INTERVAL - timeSinceLastUpdate;
      hasPendingUpdateRef.current = true;
      pendingCameraUpdateRef.current = setTimeout(() => {
        lastCameraUpdateRef.current = Date.now();
        hasPendingUpdateRef.current = false;
        updateOctaneCamera();
      }, delay);
    }
  }, [updateOctaneCamera]);

  /**
   * Force immediate camera update - used on mouse up to ensure final position is sent
   */
  const updateOctaneCameraImmediate = useCallback(() => {
    // Clear any pending throttled update
    if (pendingCameraUpdateRef.current) {
      clearTimeout(pendingCameraUpdateRef.current);
      pendingCameraUpdateRef.current = null;
    }
    hasPendingUpdateRef.current = false;
    lastCameraUpdateRef.current = Date.now();
    updateOctaneCamera();
  }, [updateOctaneCamera]);

  /**
   * Display image from callback data
   * CRITICAL: Direct port of octaneWeb buffer processing logic
   */
  const displayCallbackImage = useCallback((imageData: OctaneImageData) => {
    console.log('🎯🎯🎯 [VIEWPORT] displayCallbackImage CALLED');
    console.log('📊 [VIEWPORT] Image data:', {
      hasSize: !!imageData.size,
      width: imageData.size?.x,
      height: imageData.size?.y,
      hasBuffer: !!imageData.buffer,
      bufferSize: imageData.buffer?.size,
      type: imageData.type
    });
    
    try {
      const canvas = canvasRef.current;
      console.log('🎯 [VIEWPORT] Canvas ref:', !!canvas);
      
      if (!canvas) {
        console.error('❌ [VIEWPORT] Canvas ref is null - cannot display image!');
        return;
      }

      console.log('📊 [VIEWPORT] Canvas element:', {
        width: canvas.width,
        height: canvas.height,
        offsetWidth: canvas.offsetWidth,
        offsetHeight: canvas.offsetHeight,
        parentElement: !!canvas.parentElement
      });

      setFrameCount(prev => {
        const newCount = prev + 1;
        console.log('🎬 [VIEWPORT] Frame count incremented to:', newCount);
        return newCount;
      });

      if (!imageData.buffer || !imageData.buffer.data) {
        console.error('❌ [VIEWPORT] No image buffer in callback data');
        return;
      }

      // Decode base64 buffer
      const bufferData: any = imageData.buffer.data; // Can be string or Buffer object
      const width = imageData.size.x;
      const height = imageData.size.y;

      // Set canvas internal resolution
      canvas.width = width;
      canvas.height = height;

      // Set CSS display size to match (actual pixel size)
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        Logger.debug('[displayCallbackImage] Failed to get 2d context');
        return;
      }

      const canvasImageData = ctx.createImageData(width, height);

      // Handle buffer data - could be base64 string or Node.js Buffer object
      let bytes: Uint8Array;
      
      // Check if it's a Node.js Buffer serialized as JSON {type: "Buffer", data: [bytes]}
      if (typeof bufferData === 'object' && bufferData.type === 'Buffer' && Array.isArray(bufferData.data)) {
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
          Logger.debug('[displayCallbackImage] Base64 decode error:', error?.message || error?.toString() || JSON.stringify(error));
          return;
        }
      } else {
        Logger.debug('[displayCallbackImage] Unknown buffer format:', typeof bufferData, bufferData);
        return;
      }

      // Convert buffer to RGBA format for canvas
      console.log('🎨 [VIEWPORT] Converting buffer to canvas format...');
      convertBufferToCanvas(bytes, imageData, canvasImageData);
      console.log('✅ [VIEWPORT] Buffer conversion complete');

      console.log('🎨 [VIEWPORT] Rendering to canvas...');
      ctx.putImageData(canvasImageData, 0, 0);
      console.log('✅ [VIEWPORT] Image rendered to canvas successfully!');

      // Update status
      const newStatus = `${width}x${height} | ` +
        `${(imageData.buffer.size / 1024).toFixed(1)}KB | ` +
        `${imageData.tonemappedSamplesPerPixel.toFixed(1)} spp`;
      setStatus(newStatus);
      console.log('📊 [VIEWPORT] Status updated:', newStatus);
    } catch (error: any) {
      console.error('❌ [VIEWPORT] Error displaying callback image:', error);
      console.error('❌ [VIEWPORT] Stack:', error.stack);
    }
  }, []);

  /**
   * Convert raw buffer to canvas ImageData
   * CRITICAL: Exact port of octaneWeb conversion logic
   */
  const convertBufferToCanvas = (
    buffer: Uint8Array,
    imageData: OctaneImageData,
    canvasImageData: globalThis.ImageData
  ) => {
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
  };

  /**
   * Convert LDR RGBA buffer to canvas
   * CRITICAL: Exact port from octaneWeb - preserves buffer isolation
   */
  const convertLDRRGBA = (
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
        data[i] = buffer[i];         // R
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
            data[dstIndex] = buffer[srcIndex];         // R
            data[dstIndex + 1] = buffer[srcIndex + 1]; // G
            data[dstIndex + 2] = buffer[srcIndex + 2]; // B
            data[dstIndex + 3] = buffer[srcIndex + 3]; // A
          }
        }
      }
    }
  };

  /**
   * Convert HDR RGBA buffer to canvas
   * CRITICAL: Exact port from octaneWeb - buffer isolation prevents corruption
   */
  const convertHDRRGBA = (
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
        data[i] = Math.min(255, Math.max(0, floatView[i] * 255));         // R
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
  };

  /**
   * Trigger initial render when connected
   */
  useEffect(() => {
    console.log('🎯 [VIEWPORT] Initialization useEffect triggered, connected:', connected);
    
    if (!connected) {
      console.log('⚠️  [VIEWPORT] Not connected, skipping initialization');
      setStatus('Disconnected from Octane');
      return;
    }

    const initializeRendering = async () => {
      try {
        console.log('🎯 [VIEWPORT] Starting initialization...');
        console.log('🎯 [VIEWPORT] Canvas ref at init:', !!canvasRef.current);
        console.log('🎯 [VIEWPORT] Viewport ref at init:', !!viewportRef.current);
        
        setStatus('Initializing camera...');
        
        // Initialize camera from Octane's current state
        console.log('📷 [VIEWPORT] Initializing camera from Octane...');
        await initializeCameraFromOctane();
        console.log('✅ [VIEWPORT] Camera initialized');
        
        setStatus('Triggering initial render...');
        
        // Trigger initial render via ApiChangeManager
        console.log('🎬 [VIEWPORT] Triggering initial render...');
        await triggerOctaneUpdate();
        console.log('✅ [VIEWPORT] Initial render triggered');
        
        setIsRendering(true);
        setStatus('Waiting for render...');
        
        console.log('✅ [VIEWPORT] Render viewport initialized');
      } catch (error: any) {
        console.error('❌ [VIEWPORT] Failed to initialize rendering:', error);
        setStatus(`Error: ${error.message}`);
      }
    };

    initializeRendering();
  }, [connected, initializeCameraFromOctane, triggerOctaneUpdate]);

  /**
   * Setup callback listener for OnNewImage events
   */
  useEffect(() => {
    console.log('🎯 [VIEWPORT] OnNewImage listener useEffect triggered, connected:', connected);
    
    if (!connected) {
      console.log('⚠️  [VIEWPORT] Not connected, skipping callback listener setup');
      return;
    }

    const handleNewImage = (data: CallbackData) => {
      console.log('🎯🎯🎯 [VIEWPORT] handleNewImage CALLED');
      console.log('📊 [VIEWPORT] Callback data:', {
        hasRenderImages: !!(data.render_images),
        hasData: !!(data.render_images?.data),
        imageCount: data.render_images?.data?.length || 0
      });
      
      if (data.render_images && data.render_images.data && data.render_images.data.length > 0) {
        console.log('✅ [VIEWPORT] Valid image data received, calling displayCallbackImage');
        displayCallbackImage(data.render_images.data[0]);
      } else {
        console.warn('⚠️  [VIEWPORT] No valid image data in callback');
        // console.warn('   [VIEWPORT] data:', data);
      }
    };

    console.log('📡 [VIEWPORT] Registering OnNewImage listener with client');
    client.on('OnNewImage', handleNewImage);
    console.log('✅ [VIEWPORT] OnNewImage listener registered');

    return () => {
      console.log('🔌 [VIEWPORT] Unregistering OnNewImage listener');
      client.off('OnNewImage', handleNewImage);
    };
  }, [connected, client, displayCallbackImage]);

  /**
   * Setup mouse controls for camera manipulation
   */
  useEffect(() => {
    console.log('🎯 [VIEWPORT] Mouse controls useEffect triggered');
    console.log('📊 [VIEWPORT] Canvas available:', !!canvasRef.current);
    console.log('📊 [VIEWPORT] Connected:', connected);
    
    const canvas = canvasRef.current;
    if (!canvas || !connected) {
      console.log('⚠️  [VIEWPORT] Skipping mouse controls setup (canvas or not connected)');
      return;
    }
    
    console.log('🖱️  [VIEWPORT] Setting up mouse event handlers...');

    const handleMouseDown = (e: MouseEvent) => {
      console.log('🖱️  [VIEWPORT] handleMouseDown CALLED', { button: e.button, x: e.clientX, y: e.clientY });
      
      if (viewportLocked) {
        console.log('🔒 [VIEWPORT] Viewport locked, ignoring mouse input');
        return;
      }
      
      // Get canvas-relative coordinates
      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      console.log('📊 [VIEWPORT] Canvas coords:', { canvasX, canvasY });
      
      if (e.button === 0) { // Left button
        // CTRL+LEFT: 2D Canvas Pan (Octane SE Manual: Control key + left mouse button pans the rendered display)
        if (e.ctrlKey || e.metaKey) {
          is2DPanningRef.current = true;
          lastMousePosRef.current = { x: e.clientX, y: e.clientY };
          canvas.style.cursor = 'move';
          e.preventDefault();
        }
        // REGION SELECTION MODE: Start region picking
        else if (pickingMode === 'renderRegion') {
          setIsSelectingRegion(true);
          setRegionStart({ x: canvasX, y: canvasY });
          setRegionEnd({ x: canvasX, y: canvasY });
          canvas.style.cursor = 'crosshair';
        } else if (pickingMode !== 'none') {
          // PICKING MODES: Store last mouse position for click detection
          lastMousePosRef.current = { x: e.clientX, y: e.clientY };
          canvas.style.cursor = 'crosshair';
        } else {
          // CAMERA MODE: Orbit
          isDraggingRef.current = true;
          lastMousePosRef.current = { x: e.clientX, y: e.clientY };
          canvas.style.cursor = 'grabbing';
        }
      } else if (e.button === 2) { // Right button = PAN (always available)
        isPanningRef.current = true;
        hasRightDraggedRef.current = false;  // Reset drag tracking
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'move';
        e.preventDefault(); // Prevent context menu
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Get canvas-relative coordinates
      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      
      // REGION SELECTION MODE: Update region end point
      if (isSelectingRegion) {
        setRegionEnd({ x: canvasX, y: canvasY });
        return;
      }
      
      // 2D CANVAS PAN MODE: Update canvas offset (no camera movement)
      if (is2DPanningRef.current) {
        const deltaX = e.clientX - lastMousePosRef.current.x;
        const deltaY = e.clientY - lastMousePosRef.current.y;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        
        setCanvasTransform(prev => ({
          ...prev,
          offsetX: prev.offsetX + deltaX,
          offsetY: prev.offsetY + deltaY
        }));
        return;
      }
      
      // CAMERA MODE: Handle orbit/pan
      if (!isDraggingRef.current && !isPanningRef.current) return;

      const deltaX = e.clientX - lastMousePosRef.current.x;
      const deltaY = e.clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      if (isDraggingRef.current) {
        // LEFT CLICK: Orbit camera around target
        const sensitivity = 0.01;
        cameraRef.current.theta -= deltaX * sensitivity;  // Inverted: drag right = rotate left
        cameraRef.current.phi -= deltaY * sensitivity;

        // Clamp phi to prevent flipping
        cameraRef.current.phi = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraRef.current.phi));
      } else if (isPanningRef.current) {
        // RIGHT CLICK: Pan camera target in X/Y screen space (no Z depth)
        // Pan speed scales with distance from target
        const panSpeed = cameraRef.current.radius * 0.001;

        // Track that mouse has moved (dragged) while right button is down
        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
          hasRightDraggedRef.current = true;
        }

        // Update target position - X and Y only (no Z)
        cameraRef.current.center[0] -= deltaX * panSpeed;  // Horizontal (X)
        cameraRef.current.center[1] += deltaY * panSpeed;  // Vertical (Y)
        // Z (depth) remains unchanged
      }

      // Update Octane camera with throttling (10 Hz rate limit)
      updateOctaneCameraThrottled();
    };

    const handleMouseUp = async (e: MouseEvent) => {
      // Prevent browser context menu on right-click release (button 2)
      if (e.button === 2) {
        e.preventDefault();
      }
      
      // REGION SELECTION MODE: Complete region and apply to Octane
      if (isSelectingRegion && regionStart && regionEnd) {
        setIsSelectingRegion(false);
        canvas.style.cursor = pickingMode !== 'none' ? 'crosshair' : 'grab';
        
        // Calculate normalized coordinates (0.0 to 1.0)
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        
        const minX = Math.min(regionStart.x, regionEnd.x) / canvasWidth;
        const minY = Math.min(regionStart.y, regionEnd.y) / canvasHeight;
        const maxX = Math.max(regionStart.x, regionEnd.x) / canvasWidth;
        const maxY = Math.max(regionStart.y, regionEnd.y) / canvasHeight;
        
        // Clamp to valid range [0, 1]
        const clampedMinX = Math.max(0, Math.min(1, minX));
        const clampedMinY = Math.max(0, Math.min(1, minY));
        const clampedMaxX = Math.max(0, Math.min(1, maxX));
        const clampedMaxY = Math.max(0, Math.min(1, maxY));
        
        Logger.debug(' Render region selected:', {
          minX: clampedMinX.toFixed(3),
          minY: clampedMinY.toFixed(3),
          maxX: clampedMaxX.toFixed(3),
          maxY: clampedMaxY.toFixed(3)
        });
        
        try {
          // Apply render region to Octane
          await client.setRenderRegion(
            true, // active
            { x: clampedMinX, y: clampedMinY },
            { x: clampedMaxX, y: clampedMaxY },
            0 // featherWidth (no feathering by default)
          );
          
          // Trigger render update to show the region
          await triggerOctaneUpdate();
          
          Logger.debug(' Render region applied to Octane');
        } catch (error: any) {
          Logger.error('Failed to set render region:', error.message);
        }
        
        // Clear region selection (visual overlay will be removed)
        setRegionStart(null);
        setRegionEnd(null);
        return;
      }

      // PICKING MODES: Handle click-based pickers (white balance, camera target, etc.)
      if (!isDraggingRef.current && !isPanningRef.current && pickingMode !== 'renderRegion' && pickingMode !== 'none') {
        const rect = canvas.getBoundingClientRect();
        const canvasX = Math.floor((lastMousePosRef.current.x - rect.left) / rect.width * canvas.width);
        const canvasY = Math.floor((lastMousePosRef.current.y - rect.top) / rect.height * canvas.height);

        Logger.debug(`${pickingMode} picker activated at (${canvasX}, ${canvasY})`);

        try {
          if (pickingMode === 'whiteBalance') {
            // White Balance Picker - Calculate white point from picked location
            const whitePoint = await client.pickWhitePoint(canvasX, canvasY);
            if (whitePoint) {
              Logger.debug(' White balance picked:', { r: whitePoint.x, g: whitePoint.y, b: whitePoint.z });
              // TODO: Apply white point to camera/renderer settings
              // Would need to set this on the camera imager node or post-processing
            }
          } else if (pickingMode === 'cameraTarget') {
            // Camera Target Picker - Set camera rotation center to picked position
            const intersections = await client.pick(canvasX, canvasY);
            if (intersections.length > 0) {
              const firstHit = intersections[0];
              const position = firstHit.position;
              if (position && (position.x !== undefined || position[0] !== undefined)) {
                const x = position.x ?? position[0] ?? 0;
                const y = position.y ?? position[1] ?? 0;
                const z = position.z ?? position[2] ?? 0;
                Logger.debug(`Camera target set to: [${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}]`);
                cameraRef.current.center = [x, y, z];
                await updateOctaneCamera();
              }
            } else {
              Logger.debug(' Camera target pick: No intersection found');
            }
          } else if (pickingMode === 'focus') {
            // Auto Focus Picker - Set camera focus distance to picked depth
            const intersections = await client.pick(canvasX, canvasY);
            if (intersections.length > 0) {
              const firstHit = intersections[0];
              const depth = firstHit.depth;
              if (depth !== undefined) {
                Logger.debug(`Focus distance set to: ${depth.toFixed(3)}`);
                // TODO: Set camera focus distance in Octane
                // Would need to update the camera node's focus distance parameter
              }
            } else {
              Logger.debug(' Focus pick: No intersection found');
            }
          } else if (pickingMode === 'material') {
            // Material Picker - Select and inspect material at picked location
            const intersections = await client.pick(canvasX, canvasY);
            if (intersections.length > 0) {
              const firstHit = intersections[0];
              const geometryNode = firstHit.node;
              const materialPinIndex = firstHit.materialPinIx ?? firstHit.materialPinIndex;
              
              Logger.debug(' Material pick:', {
                geometryNode: geometryNode?.handle,
                materialPinIndex,
                depth: firstHit.depth
              });
              
              if (geometryNode?.handle !== undefined && materialPinIndex !== undefined) {
                // Get the material node connected to the geometry's material pin
                try {
                  const materialResponse = await client.callApi('ApiNode', 'connectedNodeIx', geometryNode.handle, {
                    pinIx: materialPinIndex
                  });
                  
                  if (materialResponse?.result?.handle) {
                    const materialHandle = materialResponse.result.handle;
                    Logger.debug(`Material found: handle=${materialHandle}`);
                    
                    // Emit event to select material in Node Inspector
                    client.emit('nodeSelected', { handle: materialHandle });
                    
                    // Highlight in Scene Outliner (optional)
                    client.emit('highlightNode', { handle: materialHandle });
                  } else {
                    Logger.debug(' No material connected to this geometry');
                  }
                } catch (err: any) {
                  Logger.error('Failed to get material node:', err.message);
                }
              }
            } else {
              Logger.debug(' Material pick: No intersection found');
            }
          } else if (pickingMode === 'object') {
            // Object Picker - Select and inspect object (geometry node) at picked location
            const intersections = await client.pick(canvasX, canvasY);
            if (intersections.length > 0) {
              const firstHit = intersections[0];
              const geometryNode = firstHit.node;
              
              Logger.debug(' Object pick:', {
                node: geometryNode?.handle,
                depth: firstHit.depth,
                primitiveType: firstHit.primitiveType
              });
              
              if (geometryNode?.handle !== undefined) {
                const objectHandle = geometryNode.handle;
                Logger.debug(`Object found: handle=${objectHandle}`);
                
                // Emit event to select object in Node Inspector
                client.emit('nodeSelected', { handle: objectHandle });
                
                // Highlight in Scene Outliner
                client.emit('highlightNode', { handle: objectHandle });
                
                // Select in Node Graph Editor (if visible)
                client.emit('selectNodeInGraph', { handle: objectHandle });
              }
            } else {
              Logger.debug(' Object pick: No intersection found');
            }
          }
        } catch (error: any) {
          Logger.error(`Picking failed (${pickingMode}):`, error.message);
        }
        return;
      }
      
      // 2D CANVAS PAN MODE: Complete pan
      if (is2DPanningRef.current) {
        is2DPanningRef.current = false;
        canvas.style.cursor = pickingMode !== 'none' ? 'crosshair' : 'grab';
        return;
      }
      
      // CAMERA MODE: Complete orbit/pan
      if (isDraggingRef.current || isPanningRef.current) {
        const wasPanning = isPanningRef.current;
        isDraggingRef.current = false;
        isPanningRef.current = false;
        canvas.style.cursor = pickingMode !== 'none' ? 'crosshair' : 'grab';
        
        // Show context menu if right-click without drag (Octane SE behavior)
        if (wasPanning && !hasRightDraggedRef.current) {
          const x = lastMousePosRef.current.x;
          const y = lastMousePosRef.current.y;
          setContextMenuPos({ x, y });
          setContextMenuVisible(true);
          return;
        }
        
        // Send final camera position immediately to ensure accuracy
        updateOctaneCameraImmediate();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // Prevent right-click context menu
      e.stopPropagation(); // Stop event from bubbling up
    };

    const handleWheel = async (e: WheelEvent) => {
      e.preventDefault();
      if (viewportLocked) return; // Viewport locked - ignore wheel input
      
      // CTRL+WHEEL: 2D Canvas Zoom (Octane SE Manual: Control key + mouse wheel zooms the rendered display)
      if (e.ctrlKey || e.metaKey) {
        const zoomSpeed = 0.0005;
        const zoomFactor = 1 - (e.deltaY * zoomSpeed);
        
        setCanvasTransform(prev => {
          const newScale = Math.max(0.1, Math.min(10.0, prev.scale * zoomFactor));
          return { ...prev, scale: newScale };
        });
        return;
      }
      
      // NORMAL WHEEL: 3D Camera Zoom (changes camera distance)
      const zoomSpeed = 0.1;
      cameraRef.current.radius += e.deltaY * zoomSpeed;
      cameraRef.current.radius = Math.max(1.0, Math.min(100.0, cameraRef.current.radius));
      
      await updateOctaneCamera();
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('contextmenu', handleContextMenu);
    console.log('✅ [VIEWPORT] All mouse event listeners attached');
    
    // Set cursor based on viewport lock state and picking mode
    if (viewportLocked) {
      canvas.style.cursor = 'not-allowed';
    } else if (pickingMode !== 'none') {
      canvas.style.cursor = 'crosshair';  // All picking modes use crosshair cursor
    } else {
      canvas.style.cursor = 'grab';
    }
    console.log('🖱️  [VIEWPORT] Cursor style set to:', canvas.style.cursor);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      
      // Cleanup any pending camera updates
      if (pendingCameraUpdateRef.current) {
        clearTimeout(pendingCameraUpdateRef.current);
        pendingCameraUpdateRef.current = null;
      }
    };
  }, [connected, updateOctaneCamera, updateOctaneCameraThrottled, updateOctaneCameraImmediate, viewportLocked, pickingMode, isSelectingRegion, regionStart, regionEnd, client, triggerOctaneUpdate]);

  return (
    <div className="callback-render-viewport" ref={viewportRef}>
      <div className="viewport-canvas-container">
        {!connected && (
          <div className="viewport-placeholder">
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📡</div>
            <div>Disconnected from Octane</div>
            <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
              Waiting for LiveLink connection...
            </div>
          </div>
        )}
        {connected && !isRendering && (
          <div className="viewport-placeholder">
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎬</div>
            <div>{status}</div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="render-canvas"
          style={{
            border: '1px solid #444',
            imageRendering: 'pixelated',
            display: frameCount > 0 ? 'block' : 'none',
            transform: `translate(${canvasTransform.offsetX}px, ${canvasTransform.offsetY}px) scale(${canvasTransform.scale})`,
            transformOrigin: 'center center',
            transition: 'none'
          }}
        />
        
        {/* World Coordinate Axis Overlay - Octane SE Manual: Display World Coordinate */}
        {showWorldCoord && frameCount > 0 && (
          <div className="world-coord-axis" style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            width: '60px',
            height: '60px',
            pointerEvents: 'none',
            zIndex: 10
          }}>
            <svg width="60" height="60" viewBox="0 0 60 60">
              {/* X Axis - Red */}
              <line x1="30" y1="30" x2="54" y2="30" 
                    stroke="#ff3333" strokeWidth="2" strokeLinecap="round" />
              <text x="56" y="34" fill="#ff3333" fontSize="12" fontWeight="bold">X</text>
              
              {/* Y Axis - Green */}
              <line x1="30" y1="30" x2="30" y2="6" 
                    stroke="#33ff33" strokeWidth="2" strokeLinecap="round" />
              <text x="26" y="4" fill="#33ff33" fontSize="12" fontWeight="bold">Y</text>
              
              {/* Z Axis - Blue */}
              <line x1="30" y1="30" x2="14" y2="44" 
                    stroke="#3333ff" strokeWidth="2" strokeLinecap="round" />
              <text x="8" y="52" fill="#3333ff" fontSize="12" fontWeight="bold">Z</text>
              
              {/* Origin Circle */}
              <circle cx="30" cy="30" r="3" fill="#ffffff" stroke="#888" strokeWidth="1" />
            </svg>
          </div>
        )}
        
        {/* Render Region Selection Overlay - Octane SE Manual: Render Region */}
        {isSelectingRegion && regionStart && regionEnd && (
          <div
            className="region-selection-overlay"
            style={{
              position: 'absolute',
              left: `${Math.min(regionStart.x, regionEnd.x)}px`,
              top: `${Math.min(regionStart.y, regionEnd.y)}px`,
              width: `${Math.abs(regionEnd.x - regionStart.x)}px`,
              height: `${Math.abs(regionEnd.y - regionStart.y)}px`,
              border: '2px solid #00ff00',
              backgroundColor: 'rgba(0, 255, 0, 0.1)',
              pointerEvents: 'none',
              zIndex: 20,
              boxSizing: 'border-box'
            }}
          />
        )}
      </div>
      
      {/* Viewport Context Menu - Octane SE Manual: Right-click (without drag) menu */}
      <ViewportContextMenu
        visible={contextMenuVisible}
        x={contextMenuPos.x}
        y={contextMenuPos.y}
        onClose={handleCloseContextMenu}
        onCopyToClipboard={handleContextCopyToClipboard}
        onSaveRender={handleContextSaveRender}
        onExportPasses={handleContextExportPasses}
        onSetBackgroundImage={handleContextSetBackgroundImage}
        onToggleLockViewport={handleContextToggleLockViewport}
        viewportLocked={viewportLocked}
      />
    </div>
  );
}));
