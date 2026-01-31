/**
 * Callback-based Render Viewport Component (React TypeScript)
 *
 * Production-ready port of octaneWeb's CallbackRenderViewport with React best practices:
 * - Real-time callback streaming with OnNewImage events
 * - Mouse drag camera synchronization
 * - HDR/LDR buffer processing with proper isolation
 * - Automatic render triggering when connected
 */

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useOctane } from '../../hooks/useOctane';
import { ViewportContextMenu } from './ViewportContextMenu';
import { useImageBufferProcessor } from './hooks/useImageBufferProcessor';
import { useCameraSync } from './hooks/useCameraSync';
import { useMouseInteraction } from './hooks/useMouseInteraction';
import Logger from '../../utils/Logger';

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
  pickingMode?:
    | 'none'
    | 'focus'
    | 'whiteBalance'
    | 'material'
    | 'object'
    | 'cameraTarget'
    | 'renderRegion'
    | 'filmRegion';
  onExportPasses?: () => void;
  onSetBackgroundImage?: () => void;
  onToggleLockViewport?: () => void;
}

export interface CallbackRenderViewportHandle {
  copyToClipboard: () => Promise<void>;
  saveRenderToDisk: () => Promise<void>;
  recenterView: () => void;
}

export const CallbackRenderViewport = React.memo(
  forwardRef<CallbackRenderViewportHandle, CallbackRenderViewportProps>(
    function CallbackRenderViewport(
      {
        showWorldCoord = true,
        viewportLocked = false,
        pickingMode = 'none',
        onExportPasses,
        onSetBackgroundImage,
        onToggleLockViewport,
      },
      ref
    ) {
      const { client, connected } = useOctane();
      const canvasRef = useRef<HTMLCanvasElement>(null);
      const viewportRef = useRef<HTMLDivElement>(null);
      const [frameCount, setFrameCount] = useState(0);
      const [status, setStatus] = useState('Initializing...');
      const [isRendering, setIsRendering] = useState(false);

      // Component mount logging
      useEffect(() => {
        Logger.info('🎯 [VIEWPORT] CallbackRenderViewport component MOUNTED');
        Logger.info('🎯 [VIEWPORT] Initial connected state:', connected);
        Logger.info('🎯 [VIEWPORT] Canvas ref available:', !!canvasRef.current);
        Logger.info('🎯 [VIEWPORT] Viewport ref available:', !!viewportRef.current);
        return () => {
          Logger.info('🎯 [VIEWPORT] CallbackRenderViewport component UNMOUNTED');
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
      const [canvasTransform, setCanvasTransform] = useState({
        scale: 1.0,
        offsetX: 0,
        offsetY: 0,
      });

      // Camera state for mouse controls
      const cameraRef = useRef<CameraState>({
        radius: 20.0,
        theta: 0.0,
        phi: 0.0,
        center: [0.0, 0.0, 0.0],
        fov: 45.0,
      });

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

      // Image buffer processor hook
      const { displayImage } = useImageBufferProcessor({
        canvasRef,
        onFrameRendered: () => setFrameCount(prev => prev + 1),
        onStatusUpdate: setStatus,
      });

      // Camera synchronization hook
      const { initializeCamera, updateCameraThrottled, updateCameraImmediate } = useCameraSync({
        client,
        connected,
        cameraRef,
        triggerOctaneUpdate,
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

          const blob = await new Promise<Blob | null>(resolve => {
            canvas.toBlob(resolve, 'image/png');
          });

          if (!blob) {
            throw new Error('Failed to convert canvas to blob');
          }

          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob,
            }),
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
      useImperativeHandle(
        ref,
        () => ({
          copyToClipboard,
          saveRenderToDisk,
          recenterView,
        }),
        [copyToClipboard, saveRenderToDisk, recenterView]
      );

      /**
       * Trigger initial render when connected
       */
      useEffect(() => {
        Logger.info('🎯 [VIEWPORT] Initialization useEffect triggered, connected:', connected);

        if (!connected) {
          Logger.info('⚠️  [VIEWPORT] Not connected, skipping initialization');
          setStatus('Disconnected from Octane');
          return;
        }

        const initializeRendering = async () => {
          try {
            Logger.info('🎯 [VIEWPORT] Starting initialization...');
            Logger.info('🎯 [VIEWPORT] Canvas ref at init:', !!canvasRef.current);
            Logger.info('🎯 [VIEWPORT] Viewport ref at init:', !!viewportRef.current);

            setStatus('Initializing camera...');

            // Initialize camera from Octane's current state
            Logger.info('📷 [VIEWPORT] Initializing camera from Octane...');
            await initializeCamera();
            Logger.info('✅ [VIEWPORT] Camera initialized');

            setStatus('Triggering initial render...');

            // Trigger initial render via ApiChangeManager
            Logger.info('🎬 [VIEWPORT] Triggering initial render...');
            await triggerOctaneUpdate();
            Logger.info('✅ [VIEWPORT] Initial render triggered');

            setIsRendering(true);
            setStatus('Waiting for render...');

            Logger.info('✅ [VIEWPORT] Render viewport initialized');
          } catch (error: any) {
            Logger.error('❌ [VIEWPORT] Failed to initialize rendering:', error);
            setStatus(`Error: ${error.message}`);
          }
        };

        initializeRendering();
      }, [connected, initializeCamera, triggerOctaneUpdate]);

      /**
       * Setup callback listener for OnNewImage events
       */
      useEffect(() => {
        Logger.info('🎯 [VIEWPORT] OnNewImage listener useEffect triggered, connected:', connected);

        if (!connected) {
          Logger.info('⚠️  [VIEWPORT] Not connected, skipping callback listener setup');
          return;
        }

        const handleNewImage = (data: CallbackData) => {
          Logger.debug('🎯🎯🎯 [VIEWPORT] handleNewImage CALLED');
          Logger.debug('📊 [VIEWPORT] Callback data:', {
            hasRenderImages: !!data.render_images,
            hasData: !!data.render_images?.data,
            imageCount: data.render_images?.data?.length || 0,
          });

          if (data.render_images && data.render_images.data && data.render_images.data.length > 0) {
            Logger.debug('✅ [VIEWPORT] Valid image data received, calling displayImage');
            displayImage(data.render_images.data[0]);
          } else {
            Logger.warn('⚠️  [VIEWPORT] No valid image data in callback');
            // Logger.warn('   [VIEWPORT] data:', data);
          }
        };

        Logger.info('📡 [VIEWPORT] Registering OnNewImage listener with client');
        client.on('OnNewImage', handleNewImage);
        Logger.info('✅ [VIEWPORT] OnNewImage listener registered');

        return () => {
          Logger.info('🔌 [VIEWPORT] Unregistering OnNewImage listener');
          client.off('OnNewImage', handleNewImage);
        };
      }, [connected, client, displayImage]);

      /**
       * MOUSE CONTROLS: Camera orbit, pan, zoom, and picker tools
       * Delegated to useMouseInteraction hook for all mouse and wheel event handling
       */
      useMouseInteraction({
        canvasRef,
        cameraRef,
        connected,
        viewportLocked,
        pickingMode,
        isSelectingRegion,
        regionStart,
        regionEnd,
        client,
        updateCameraThrottled,
        updateCameraImmediate,
        triggerOctaneUpdate,
        setIsSelectingRegion,
        setRegionStart,
        setRegionEnd,
        setCanvasTransform,
        setContextMenuPos,
        setContextMenuVisible,
      });

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
                transition: 'none',
              }}
            />

            {/* World Coordinate Axis Overlay - Octane SE Manual: Display World Coordinate */}
            {showWorldCoord && frameCount > 0 && (
              <div
                className="world-coord-axis"
                style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  width: '60px',
                  height: '60px',
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              >
                <svg width="60" height="60" viewBox="0 0 60 60">
                  {/* X Axis - Red */}
                  <line
                    x1="30"
                    y1="30"
                    x2="54"
                    y2="30"
                    stroke="#ff3333"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <text x="56" y="34" fill="#ff3333" fontSize="12" fontWeight="bold">
                    X
                  </text>

                  {/* Y Axis - Green */}
                  <line
                    x1="30"
                    y1="30"
                    x2="30"
                    y2="6"
                    stroke="#33ff33"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <text x="26" y="4" fill="#33ff33" fontSize="12" fontWeight="bold">
                    Y
                  </text>

                  {/* Z Axis - Blue */}
                  <line
                    x1="30"
                    y1="30"
                    x2="14"
                    y2="44"
                    stroke="#3333ff"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <text x="8" y="52" fill="#3333ff" fontSize="12" fontWeight="bold">
                    Z
                  </text>

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
                  boxSizing: 'border-box',
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
    }
  )
);
