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
  useMemo,
} from 'react';
import { useOctane } from '../../hooks/useOctane';
import { ViewportContextMenu } from './ViewportContextMenu';
import { useImageBufferProcessor } from './hooks/useImageBufferProcessor';
import { useCameraSync } from './hooks/useCameraSync';
import { useMouseInteraction } from './hooks/useMouseInteraction';
import { useViewportActions } from './hooks/useViewportActions';
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      // Region selection state (for render region picking)
      const [isSelectingRegion, setIsSelectingRegion] = useState(false);
      const [regionStart, setRegionStart] = useState<{ x: number; y: number } | null>(null);
      const [regionEnd, setRegionEnd] = useState<{ x: number; y: number } | null>(null);

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
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          Logger.error('Failed to trigger render:', errorMessage);
        }
      }, [client]);

      // Viewport actions hook (Phase 4: Context menu & UI callbacks)
      const {
        contextMenuVisible,
        setContextMenuVisible,
        contextMenuPos,
        setContextMenuPos,
        canvasTransform,
        setCanvasTransform,
        copyToClipboard,
        saveRenderToDisk,
        recenterView,
        handleCloseContextMenu,
        handleContextCopyToClipboard,
        handleContextSaveRender,
        handleContextExportPasses,
        handleContextSetBackgroundImage,
        handleContextToggleLockViewport,
      } = useViewportActions({
        canvasRef,
        onExportPasses,
        onSetBackgroundImage,
        onToggleLockViewport,
      });

      // Camera synchronization hook (needed by useMouseInteraction)
      const { initializeCamera, updateCameraThrottled, updateCameraImmediate } = useCameraSync({
        client,
        connected,
        cameraRef,
        triggerOctaneUpdate,
      });

      /**
       * MOUSE CONTROLS: Camera orbit, pan, zoom, and picker tools
       * ✅ Phase 3: Now returns isDragging state for viewport throttling
       */
      const { isDragging } = useMouseInteraction({
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

      // ✅ Phase 3: Image buffer processor hook (now receives isDragging for throttling)
      // ✅ Phase 4: Now returns flushPendingFrame to clear stale progressive renders
      const { displayImage, flushPendingFrame } = useImageBufferProcessor({
        canvasRef,
        onFrameRendered: () => setFrameCount(prev => prev + 1),
        onStatusUpdate: setStatus,
        isDragging, // ✅ Phase 3: Pass drag state for input-side throttling
      });

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
          // Defer setState to avoid cascading renders
          setTimeout(() => setStatus('Disconnected from Octane'), 0);
          return;
        }

        const initializeRendering = async () => {
          try {
            Logger.info('🎯 [VIEWPORT] Starting initialization...');
            Logger.info('🎯 [VIEWPORT] Canvas ref at init:', !!canvasRef.current);
            Logger.info('🎯 [VIEWPORT] Viewport ref at init:', !!viewportRef.current);

            setStatus('Initializing camera...');

            // Initialize camera from Octane's current state
            Logger.debug('📷 [VIEWPORT] Initializing camera from Octane...');
            await initializeCamera();
            Logger.debug('✅ [VIEWPORT] Camera initialized');

            setStatus('Triggering initial render...');

            // Trigger initial render via ApiChangeManager
            Logger.debug('🎬 [VIEWPORT] Triggering initial render...');
            await triggerOctaneUpdate();
            Logger.debug('✅ [VIEWPORT] Initial render triggered');

            setIsRendering(true);
            setStatus('Waiting for render...');

            Logger.debug('✅ [VIEWPORT] Render viewport initialized');
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('❌ [VIEWPORT] Failed to initialize rendering:', error);
            setStatus(`Error: ${errorMessage}`);
          }
        };

        initializeRendering();
      }, [connected, initializeCamera, triggerOctaneUpdate]);

      /**
       * Setup callback listener for OnNewImage events
       */
      useEffect(() => {
        Logger.debugV('🎯 [VIEWPORT] OnNewImage listener useEffect triggered, connected:', connected);

        if (!connected) {
          Logger.info('⚠️  [VIEWPORT] Not connected, skipping callback listener setup');
          return;
        }

        const handleNewImage = (data: CallbackData) => {
          Logger.debugV('🎯🎯🎯 [VIEWPORT] handleNewImage CALLED');
          Logger.debugV('📊 [VIEWPORT] Callback data:', {
            hasRenderImages: !!data.render_images,
            hasData: !!data.render_images?.data,
            imageCount: data.render_images?.data?.length || 0,
          });

          if (data.render_images && data.render_images.data && data.render_images.data.length > 0) {
            Logger.debugV('✅ [VIEWPORT] Valid image data received, calling displayImage');
            displayImage(data.render_images.data[0]);
          } else {
            Logger.warn('⚠️  [VIEWPORT] No valid image data in callback');
            // Logger.warn('   [VIEWPORT] data:', data);
          }
        };
        client.on('OnNewImage', handleNewImage);

        return () => {
          client.off('OnNewImage', handleNewImage);
        };
      }, [connected, client, displayImage]);

      /**
       * ✅ Phase 4: Flush stale progressive render images when camera drag starts/changes
       * 
       * CRITICAL for smooth progressive rendering:
       * - Octane sends 1000s of onNewImage for a single render (progressive refinement)
       * - When camera moves, old images from previous position queue up in RAF
       * - Flush clears these stale images so viewport shows latest position immediately
       * - Result: No lag/choppiness during camera drag!
       */
      useEffect(() => {
        if (isDragging) {
          Logger.debugV('[VIEWPORT] 🚮 Camera drag detected - flushing stale progressive renders');
          flushPendingFrame();
        }
      }, [isDragging, flushPendingFrame]);

      /**
       * Listen for programmatic camera changes (e.g., Reset Camera button)
       * Re-sync local camera state when camera is moved externally
       */
      useEffect(() => {
        if (!connected) return;

        const handleCameraReset = () => {
          Logger.debug('🔔 [VIEWPORT] Camera reset event received, re-syncing camera state');
          
          // ✅ Phase 4: Flush stale renders when camera is reset
          flushPendingFrame();
          
          initializeCamera().catch(err => {
            Logger.error('❌ Failed to re-sync camera after reset:', err);
          });
        };

        client.on('camera:reset', handleCameraReset);

        return () => {
          client.off('camera:reset', handleCameraReset);
        };
      }, [connected, client, initializeCamera, flushPendingFrame]);

      // ✅ Memoize canvas style to prevent recreation on every render (Phase 1 optimization)
      // Stable object reference prevents unnecessary React DOM updates
      const canvasStyle = useMemo(
        () => ({
          border: '1px solid #444',
          imageRendering: 'pixelated' as const,
          display: frameCount > 0 ? 'block' : 'none',
          transform: `translate(${canvasTransform.offsetX}px, ${canvasTransform.offsetY}px) scale(${canvasTransform.scale})`,
          transformOrigin: 'center center',
          transition: 'none',
          willChange: 'transform', // GPU optimization hint
        }),
        [frameCount, canvasTransform.offsetX, canvasTransform.offsetY, canvasTransform.scale]
      );

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
            <canvas ref={canvasRef} className="render-canvas" style={canvasStyle} />

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
