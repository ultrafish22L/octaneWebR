/**
 * Mouse Interaction Hook for CallbackRenderViewport
 *
 * Manages all mouse and wheel event handling for the viewport canvas.
 * Extracted from CallbackRenderViewport to reduce component complexity.
 *
 * Features:
 * - Camera orbit (left drag): Rotate camera around target
 * - Camera pan (right drag): Move camera target in XY plane
 * - 2D canvas pan (Ctrl+left drag): Pan the rendered image without moving camera
 * - 3D camera zoom (wheel): Change camera distance from target
 * - 2D canvas zoom (Ctrl+wheel): Zoom the rendered image without moving camera
 * - Picker tools: Material, object, camera target, white balance, focus
 * - Render region selection: Click-drag to define render region
 * - Context menu: Right-click without drag shows context menu
 *
 * Mouse controls match Octane SE behavior documented in the manual.
 */

import { useEffect, useRef, useState, MutableRefObject } from 'react';
import { Logger } from '../../../utils/Logger';
import { useStatusMessage } from '../../../contexts/StatusMessageContext';

interface CameraState {
  radius: number;
  theta: number;
  phi: number;
  center: [number, number, number];
  fov: number;
}

interface CanvasTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface Point {
  x: number;
  y: number;
}

interface PickVector3 {
  x?: number;
  y?: number;
  z?: number;
  [index: number]: number | undefined;
}

interface PickNode {
  handle?: number;
  [key: string]: unknown;
}

interface PickResult {
  position?: PickVector3;
  depth?: number;
  node?: PickNode;
  materialPinIx?: number;
  materialPinIndex?: number;
  primitiveType?: unknown;
  [key: string]: unknown;
}

interface ApiResponse {
  result?: {
    handle?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface OctaneClient {
  pick: (x: number, y: number) => Promise<PickResult[]>;
  pickWhitePoint: (x: number, y: number) => Promise<Record<string, unknown> | null>;
  setRenderRegion: (active: boolean, min: Point, max: Point, featherWidth: number) => Promise<void>;
  callApi: (
    service: string,
    method: string,
    handle: number,
    params: Record<string, unknown>
  ) => Promise<ApiResponse>;
  emit: (event: string, data: unknown) => void;
}

interface UseMouseInteractionParams {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  cameraRef: MutableRefObject<CameraState>;
  connected: boolean;
  viewportLocked: boolean;
  pickingMode: string;
  isSelectingRegion: boolean;
  regionStart: Point | null;
  regionEnd: Point | null;
  client: OctaneClient;
  updateCameraThrottled: () => void;
  updateCameraImmediate: () => void;
  triggerOctaneUpdate: () => Promise<void>;
  setIsSelectingRegion: (value: boolean) => void;
  setRegionStart: (value: Point | null) => void;
  setRegionEnd: (value: Point | null) => void;
  setCanvasTransform: (
    value: CanvasTransform | ((prev: CanvasTransform) => CanvasTransform)
  ) => void;
  setContextMenuPos: (value: Point) => void;
  setContextMenuVisible: (value: boolean) => void;
}

/**
 * Hook for managing mouse and wheel interactions with the viewport canvas
 */
export function useMouseInteraction({
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
}: UseMouseInteractionParams) {
  const { setTemporaryStatus } = useStatusMessage();

  // Phase 3: Drag state for viewport throttling
  // Tracks if ANY camera manipulation is in progress (orbit, pan, 2D pan)
  const [isDragging, setIsDragging] = useState(false);

  // Mouse drag state refs (internal to hook)
  const isDraggingRef = useRef(false); // Left button = orbit
  const isPanningRef = useRef(false); // Right button = pan
  const is2DPanningRef = useRef(false); // Ctrl+left drag = 2D canvas pan
  const hasRightDraggedRef = useRef(false); // Track if right-click involved dragging
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Mirror frequently-changing props into refs so event handlers stay stable
  // This prevents tearing down and re-adding all 6 listeners on every state change
  const viewportLockedRef = useRef(viewportLocked);
  const pickingModeRef = useRef(pickingMode);
  const isSelectingRegionRef = useRef(isSelectingRegion);
  const regionStartRef = useRef(regionStart);
  const regionEndRef = useRef(regionEnd);

  // Mirror callback props into refs to prevent stale closures in event handlers
  // Without this, handlers capture old versions of these callbacks at registration time
  const updateCameraThrottledRef = useRef(updateCameraThrottled);
  const updateCameraImmediateRef = useRef(updateCameraImmediate);

  useEffect(() => {
    viewportLockedRef.current = viewportLocked;
    pickingModeRef.current = pickingMode;
    isSelectingRegionRef.current = isSelectingRegion;
    regionStartRef.current = regionStart;
    regionEndRef.current = regionEnd;
    updateCameraThrottledRef.current = updateCameraThrottled;
    updateCameraImmediateRef.current = updateCameraImmediate;
  }, [
    viewportLocked,
    pickingMode,
    isSelectingRegion,
    regionStart,
    regionEnd,
    updateCameraThrottled,
    updateCameraImmediate,
  ]);

  useEffect(() => {
    Logger.debug('[VIEWPORT] Mouse interaction hook mounted');
    Logger.debug('[VIEWPORT] Connected:', connected);

    const canvas = canvasRef.current;
    if (!canvas || !connected) {
      Logger.info('[VIEWPORT] Skipping mouse controls setup (canvas or not connected)');
      return;
    }

    Logger.debug('[VIEWPORT] Setting up mouse event handlers...');

    const handleMouseDown = (e: MouseEvent) => {
      Logger.debug('[VIEWPORT] handleMouseDown CALLED', {
        button: e.button,
        x: e.clientX,
        y: e.clientY,
      });

      if (viewportLockedRef.current) {
        Logger.info('[VIEWPORT] Viewport locked, ignoring mouse input');
        return;
      }

      // Get canvas-relative coordinates
      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      Logger.debug('[VIEWPORT] Canvas coords:', { canvasX, canvasY });

      if (e.button === 0) {
        // Left button
        // CTRL+LEFT: 2D Canvas Pan (Octane SE Manual: Control key + left mouse button pans the rendered display)
        if (e.ctrlKey || e.metaKey) {
          is2DPanningRef.current = true;
          setIsDragging(true); // Phase 3: Track drag for throttling
          lastMousePosRef.current = { x: e.clientX, y: e.clientY };
          canvas.style.cursor = 'move';
          e.preventDefault();
        }
        // REGION SELECTION MODE: Start region picking
        else if (pickingModeRef.current === 'renderRegion') {
          setIsSelectingRegion(true);
          setRegionStart({ x: canvasX, y: canvasY });
          setRegionEnd({ x: canvasX, y: canvasY });
          canvas.style.cursor = 'crosshair';
        } else if (pickingModeRef.current !== 'none') {
          // PICKING MODES: Store last mouse position for click detection
          lastMousePosRef.current = { x: e.clientX, y: e.clientY };
          canvas.style.cursor = 'crosshair';
        } else {
          // CAMERA MODE: Orbit
          isDraggingRef.current = true;
          setIsDragging(true); // Phase 3: Track drag for throttling
          lastMousePosRef.current = { x: e.clientX, y: e.clientY };
          canvas.style.cursor = 'grabbing';
        }
      } else if (e.button === 2) {
        // Right button = PAN (always available)
        isPanningRef.current = true;
        setIsDragging(true); // Phase 3: Track drag for throttling
        hasRightDraggedRef.current = false; // Reset drag tracking
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
      if (isSelectingRegionRef.current) {
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
          offsetY: prev.offsetY + deltaY,
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
        cameraRef.current.theta -= deltaX * sensitivity; // Inverted: drag right = rotate left
        cameraRef.current.phi -= deltaY * sensitivity;

        // Clamp phi to prevent flipping
        cameraRef.current.phi = Math.max(
          -Math.PI / 2 + 0.1,
          Math.min(Math.PI / 2 - 0.1, cameraRef.current.phi)
        );
      } else if (isPanningRef.current) {
        // RIGHT CLICK: Pan camera target in X/Y screen space (no Z depth)
        // Pan speed scales with distance from target
        const panSpeed = cameraRef.current.radius * 0.001;

        // Track that mouse has moved (dragged) while right button is down
        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
          hasRightDraggedRef.current = true;
        }

        // Update target position - X and Y only (no Z)
        cameraRef.current.center[0] -= deltaX * panSpeed; // Horizontal (X)
        cameraRef.current.center[1] += deltaY * panSpeed; // Vertical (Y)
        // Z (depth) remains unchanged
      }

      // Update Octane camera with throttling (10 Hz rate limit)
      updateCameraThrottledRef.current();
    };

    const handleMouseUp = async (e: MouseEvent) => {
      // Prevent browser context menu on right-click release (button 2)
      if (e.button === 2) {
        e.preventDefault();
      }

      // REGION SELECTION MODE: Complete region and apply to Octane
      if (isSelectingRegionRef.current && regionStartRef.current && regionEndRef.current) {
        setIsSelectingRegion(false);
        canvas.style.cursor = pickingModeRef.current !== 'none' ? 'crosshair' : 'grab';

        // Calculate normalized coordinates (0.0 to 1.0)
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        const minX = Math.min(regionStartRef.current.x, regionEndRef.current.x) / canvasWidth;
        const minY = Math.min(regionStartRef.current.y, regionEndRef.current.y) / canvasHeight;
        const maxX = Math.max(regionStartRef.current.x, regionEndRef.current.x) / canvasWidth;
        const maxY = Math.max(regionStartRef.current.y, regionEndRef.current.y) / canvasHeight;

        // Clamp to valid range [0, 1]
        const clampedMinX = Math.max(0, Math.min(1, minX));
        const clampedMinY = Math.max(0, Math.min(1, minY));
        const clampedMaxX = Math.max(0, Math.min(1, maxX));
        const clampedMaxY = Math.max(0, Math.min(1, maxY));

        Logger.debug(' Render region selected:', {
          minX: clampedMinX.toFixed(3),
          minY: clampedMinY.toFixed(3),
          maxX: clampedMaxX.toFixed(3),
          maxY: clampedMaxY.toFixed(3),
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
        } catch (error) {
          Logger.error(
            'Failed to set render region:',
            error instanceof Error ? error.message : String(error)
          );
          setTemporaryStatus('Failed to set render region', 3000);
        }

        // Clear region selection (visual overlay will be removed)
        setRegionStart(null);
        setRegionEnd(null);
        return;
      }

      // PICKING MODES: Handle click-based pickers (white balance, camera target, etc.)
      if (
        !isDraggingRef.current &&
        !isPanningRef.current &&
        pickingModeRef.current !== 'renderRegion' &&
        pickingModeRef.current !== 'none'
      ) {
        const rect = canvas.getBoundingClientRect();
        const canvasX = Math.floor(
          ((lastMousePosRef.current.x - rect.left) / rect.width) * canvas.width
        );
        const canvasY = Math.floor(
          ((lastMousePosRef.current.y - rect.top) / rect.height) * canvas.height
        );

        const currentPickingMode = pickingModeRef.current;
        Logger.debug(`${currentPickingMode} picker activated at (${canvasX}, ${canvasY})`);

        try {
          if (currentPickingMode === 'whiteBalance') {
            // White Balance Picker - Calculate white point from picked location
            const whitePoint = await client.pickWhitePoint(canvasX, canvasY);
            if (whitePoint) {
              Logger.debug(' White balance picked:', {
                r: whitePoint.x,
                g: whitePoint.y,
                b: whitePoint.z,
              });
              // TODO: Apply white point to camera/renderer settings
              // Would need to set this on the camera imager node or post-processing
            }
          } else if (currentPickingMode === 'cameraTarget') {
            // Camera Target Picker - Set camera rotation center to picked position
            const intersections = await client.pick(canvasX, canvasY);
            if (intersections.length > 0) {
              const firstHit = intersections[0];
              const position = firstHit.position;
              if (position && (position.x !== undefined || position[0] !== undefined)) {
                const x = position.x ?? position[0] ?? 0;
                const y = position.y ?? position[1] ?? 0;
                const z = position.z ?? position[2] ?? 0;
                Logger.debug(
                  `Camera target set to: [${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}]`
                );
                cameraRef.current.center = [x, y, z];
                await updateCameraImmediateRef.current();
              }
            } else {
              Logger.debug(' Camera target pick: No intersection found');
            }
          } else if (currentPickingMode === 'focus') {
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
          } else if (currentPickingMode === 'material') {
            // Material Picker - Select and inspect material at picked location
            const intersections = await client.pick(canvasX, canvasY);
            if (intersections.length > 0) {
              const firstHit = intersections[0];
              const geometryNode = firstHit.node;
              const materialPinIndex = firstHit.materialPinIx ?? firstHit.materialPinIndex;

              Logger.debug(' Material pick:', {
                geometryNode: geometryNode?.handle,
                materialPinIndex,
                depth: firstHit.depth,
              });

              if (geometryNode?.handle !== undefined && materialPinIndex !== undefined) {
                // Get the material node connected to the geometry's material pin
                try {
                  const materialResponse = await client.callApi(
                    'ApiNode',
                    'connectedNodeIx',
                    geometryNode.handle,
                    {
                      pinIx: materialPinIndex,
                    }
                  );

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
                } catch (err) {
                  Logger.error(
                    'Failed to get material node:',
                    err instanceof Error ? err.message : String(err)
                  );
                  setTemporaryStatus('Failed to pick material', 3000);
                }
              }
            } else {
              Logger.debug(' Material pick: No intersection found');
            }
          } else if (currentPickingMode === 'object') {
            // Object Picker - Select and inspect object (geometry node) at picked location
            const intersections = await client.pick(canvasX, canvasY);
            if (intersections.length > 0) {
              const firstHit = intersections[0];
              const geometryNode = firstHit.node;

              Logger.debug(' Object pick:', {
                node: geometryNode?.handle,
                depth: firstHit.depth,
                primitiveType: firstHit.primitiveType,
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
        } catch (error) {
          Logger.error(
            `Picking failed (${currentPickingMode}):`,
            error instanceof Error ? error.message : String(error)
          );
          setTemporaryStatus(`Picking failed (${currentPickingMode})`, 3000);
        }
        return;
      }

      // 2D CANVAS PAN MODE: Complete pan
      if (is2DPanningRef.current) {
        is2DPanningRef.current = false;
        setIsDragging(false); // Phase 3: End drag throttling
        canvas.style.cursor = pickingModeRef.current !== 'none' ? 'crosshair' : 'grab';
        return;
      }

      // CAMERA MODE: Complete orbit/pan
      if (isDraggingRef.current || isPanningRef.current) {
        const wasPanning = isPanningRef.current;
        isDraggingRef.current = false;
        isPanningRef.current = false;
        setIsDragging(false); // Phase 3: End drag throttling
        canvas.style.cursor = pickingModeRef.current !== 'none' ? 'crosshair' : 'grab';

        // Show context menu if right-click without drag (Octane SE behavior)
        if (wasPanning && !hasRightDraggedRef.current) {
          const x = lastMousePosRef.current.x;
          const y = lastMousePosRef.current.y;
          setContextMenuPos({ x, y });
          setContextMenuVisible(true);
          return;
        }

        // Send final camera position immediately to ensure accuracy
        updateCameraImmediateRef.current();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // Prevent right-click context menu
      e.stopPropagation(); // Stop event from bubbling up
    };

    const handleWheel = async (e: WheelEvent) => {
      e.preventDefault();
      if (viewportLockedRef.current) return; // Viewport locked - ignore wheel input

      // CTRL+WHEEL: 2D Canvas Zoom (Octane SE Manual: Control key + mouse wheel zooms the rendered display)
      if (e.ctrlKey || e.metaKey) {
        const zoomSpeed = 0.0005;
        const zoomFactor = 1 - e.deltaY * zoomSpeed;

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

      await updateCameraThrottledRef.current();
    };

    // Lightweight drag-cancel on mouse leave — no API calls
    const handleMouseLeave = () => {
      if (isDraggingRef.current || isPanningRef.current) {
        isDraggingRef.current = false;
        isPanningRef.current = false;
        setIsDragging(false);
        canvas.style.cursor = pickingModeRef.current !== 'none' ? 'crosshair' : 'grab';
        updateCameraImmediateRef.current();
      }
      if (is2DPanningRef.current) {
        is2DPanningRef.current = false;
        setIsDragging(false);
        canvas.style.cursor = pickingModeRef.current !== 'none' ? 'crosshair' : 'grab';
      }
      if (isSelectingRegionRef.current) {
        setIsSelectingRegion(false);
        setRegionStart(null);
        setRegionEnd(null);
        canvas.style.cursor = pickingModeRef.current !== 'none' ? 'crosshair' : 'grab';
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('contextmenu', handleContextMenu);
    Logger.debug('[VIEWPORT] All mouse event listeners attached');

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [
    connected,
    client,
    triggerOctaneUpdate,
    setIsSelectingRegion,
    setRegionStart,
    setRegionEnd,
    setCanvasTransform,
    setContextMenuPos,
    setContextMenuVisible,
    setTemporaryStatus,
    canvasRef,
    cameraRef,
  ]);

  // Update cursor when viewport lock or picking mode changes (lightweight, no listener churn)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !connected) return;

    if (viewportLocked) {
      canvas.style.cursor = 'not-allowed';
    } else if (pickingMode !== 'none') {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = 'grab';
    }
  }, [connected, viewportLocked, pickingMode, canvasRef]);

  // Phase 3: Return drag state for viewport throttling
  return { isDragging };
}
