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
import { useSharedSurfaceRenderer } from './hooks/useSharedSurfaceRenderer';
import { useRendererSelection } from './hooks/useRendererSelection';
import { useCameraSync } from './hooks/useCameraSync';
import { useMouseInteraction } from './hooks/useMouseInteraction';
import { useViewportActions } from './hooks/useViewportActions';
import { Logger } from '../../utils/Logger';
import type { SharedSurfaceMessage } from './renderers/types';

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
  /** Present when Octane provides a DXGI shared surface (Electron fast path) */
  shared_surface?: SharedSurfaceMessage;
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
        Logger.debug('[VIEWPORT] CallbackRenderViewport component MOUNTED');
        Logger.debug('[VIEWPORT] Initial connected state:', connected);
        Logger.debug('[VIEWPORT] Canvas ref available:', !!canvasRef.current);
        Logger.debug('[VIEWPORT] Viewport ref available:', !!viewportRef.current);
        return () => {
          Logger.debug('[VIEWPORT] CallbackRenderViewport component UNMOUNTED');
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
       * Phase 3: Now returns isDragging state for viewport throttling
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

      // Renderer selection: auto-detects shared-surface (Electron+Win+addon) vs canvas2d
      const { activeRenderer, reason: rendererReason } = useRendererSelection('auto');

      // Phase 3: Image buffer processor hook (now receives isDragging for throttling)
      // Phase 4: Now returns flushPendingFrame to clear stale progressive renders
      const canvas2d = useImageBufferProcessor({
        canvasRef,
        onFrameRendered: () => setFrameCount(prev => prev + 1),
        onStatusUpdate: setStatus,
        isDragging, // Phase 3: Pass drag state for input-side throttling
      });

      // Shared surface renderer (stub — delegates to canvas2d internally)
      const sharedSurface = useSharedSurfaceRenderer({
        canvasRef,
        onFrameRendered: () => setFrameCount(prev => prev + 1),
        onStatusUpdate: setStatus,
        isDragging,
      });

      // Select active renderer
      const { displayImage, flushPendingFrame } =
        activeRenderer === 'shared-surface' ? sharedSurface : canvas2d;

      // Log renderer selection once
      useEffect(() => {
        Logger.info(`[Viewport] Renderer: ${activeRenderer} (${rendererReason})`);
      }, [activeRenderer, rendererReason]);

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
        Logger.debug('[VIEWPORT] Initialization useEffect triggered, connected:', connected);

        if (!connected) {
          Logger.info('[VIEWPORT] Not connected, skipping initialization');
          setStatus('Disconnected from Octane');
          return;
        }

        const initializeRendering = async () => {
          try {
            Logger.debug('[VIEWPORT] Starting initialization...');
            Logger.debug('[VIEWPORT] Canvas ref at init:', !!canvasRef.current);
            Logger.debug('[VIEWPORT] Viewport ref at init:', !!viewportRef.current);

            setStatus('Initializing camera...');

            // Initialize camera from Octane's current state
            Logger.debug('[VIEWPORT] Initializing camera from Octane...');
            await initializeCamera();
            Logger.debug('[VIEWPORT] Camera initialized');

            setStatus('Triggering initial render...');

            // Trigger initial render via ApiChangeManager
            Logger.debug('[VIEWPORT] Triggering initial render...');
            await triggerOctaneUpdate();
            Logger.debug('[VIEWPORT] Initial render triggered');

            setIsRendering(true);
            setStatus('Waiting for render...');

            Logger.debug('[VIEWPORT] Render viewport initialized');
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('[VIEWPORT] Failed to initialize rendering:', error);
            setStatus(`Error: ${errorMessage}`);
          }
        };

        initializeRendering();
      }, [connected, initializeCamera, triggerOctaneUpdate]);

      /**
       * Setup callback listener for OnNewImage events
       */
      useEffect(() => {
        Logger.debugV('[VIEWPORT] OnNewImage listener useEffect triggered, connected:', connected);

        if (!connected) {
          Logger.info('[VIEWPORT] Not connected, skipping callback listener setup');
          return;
        }

        const handleNewImage = (data: CallbackData) => {
          Logger.debugV('[VIEWPORT] handleNewImage CALLED');

          // Shared surface fast path (Electron + Windows + native addon)
          if (data.shared_surface && activeRenderer === 'shared-surface') {
            Logger.debugV('[VIEWPORT] Shared surface descriptor received');
            sharedSurface.displaySharedSurface(data.shared_surface);
            return;
          }

          // Standard pixel buffer path
          Logger.debugV('[VIEWPORT] Callback data:', {
            hasRenderImages: !!data.render_images,
            hasData: !!data.render_images?.data,
            imageCount: data.render_images?.data?.length || 0,
            hasSharedSurface: !!data.shared_surface,
          });

          if (data.render_images && data.render_images.data && data.render_images.data.length > 0) {
            Logger.debugV('[VIEWPORT] Valid image data received, calling displayImage');
            displayImage(data.render_images.data[0]);
          } else {
            Logger.warn('[VIEWPORT] No valid image data in callback');
          }
        };
        client.on('OnNewImage', handleNewImage);

        return () => {
          client.off('OnNewImage', handleNewImage);
        };
      }, [connected, client, displayImage, activeRenderer, sharedSurface]);

      /**
       * Phase 4: Flush stale progressive render images when camera drag starts/changes
       *
       * CRITICAL for smooth progressive rendering:
       * - Octane sends 1000s of onNewImage for a single render (progressive refinement)
       * - When camera moves, old images from previous position queue up in RAF
       * - Flush clears these stale images so viewport shows latest position immediately
       * - Result: No lag/choppiness during camera drag!
       */
      useEffect(() => {
        if (isDragging) {
          Logger.debugV('[VIEWPORT] Camera drag detected - flushing stale progressive renders');
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
          Logger.debug('[VIEWPORT] Camera reset event received, re-syncing camera state');

          // Phase 4: Flush stale renders when camera is reset
          flushPendingFrame();

          initializeCamera().catch(err => {
            Logger.error('Failed to re-sync camera after reset:', err);
          });
        };

        client.on('camera:reset', handleCameraReset);

        return () => {
          client.off('camera:reset', handleCameraReset);
        };
      }, [connected, client, initializeCamera, flushPendingFrame]);

      // Memoize canvas style to prevent recreation on every render (Phase 1 optimization)
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

            {/* World Coordinate Axis Overlay - Rotates with camera like Octane SE */}
            {showWorldCoord &&
              frameCount > 0 &&
              (() => {
                // Project 3D world axes to 2D using camera orientation.
                // NOTE: cameraRef is a mutable ref — its updates don't trigger re-renders.
                // The axis orientation refreshes only when frameCount (or another state) changes,
                // so it may be momentarily stale after a camera move before the next render frame.
                const { theta, phi } = cameraRef.current;
                const cosT = Math.cos(theta),
                  sinT = Math.sin(theta);
                const cosP = Math.cos(phi),
                  sinP = Math.sin(phi);
                // Project world axes using real Octane coordinates
                // (internal camera convention swaps X/Z, so swap sinT/cosT)
                const axisLen = 22;
                const cx = 30,
                  cy = 30;
                const axes = [
                  { dx: sinT, dy: cosT * sinP, color: '#ff3333' }, // X = (1,0,0)
                  { dx: 0, dy: -cosP, color: '#33ff33' }, // Y = (0,1,0)
                  { dx: -cosT, dy: sinT * sinP, color: '#3333ff' }, // Z = (0,0,1)
                ];
                return (
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
                      {axes.map((a, i) => (
                        <line
                          key={i}
                          x1={cx}
                          y1={cy}
                          x2={cx + a.dx * axisLen}
                          y2={cy + a.dy * axisLen}
                          stroke={a.color}
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      ))}
                      <circle cx={cx} cy={cy} r="2" fill="#ffffff" stroke="#888" strokeWidth="1" />
                    </svg>
                  </div>
                );
              })()}

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
