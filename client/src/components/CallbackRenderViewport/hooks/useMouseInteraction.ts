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

interface OctaneClient {
  pick: (x: number, y: number) => Promise<any[]>;
  pickWhitePoint: (x: number, y: number) => Promise<any>;
  setRenderRegion: (active: boolean, min: Point, max: Point, featherWidth: number) => Promise<void>;
  callApi: (service: string, method: string, handle: number, params: any) => Promise<any>;
  emit: (event: string, data: any) => void;
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
  // ✅ Phase 3: Drag state for viewport throttling
  // Tracks if ANY camera manipulation is in progress (orbit, pan, 2D pan)
  const [isDragging, setIsDragging] = useState(false);

  // Mouse drag state refs (internal to hook)
  const isDraggingRef = useRef(false); // Left button = orbit
  const isPanningRef = useRef(false); // Right button = pan
  const is2DPanningRef = useRef(false); // Ctrl+left drag = 2D canvas pan
  const hasRightDraggedRef = useRef(false); // Track if right-click involved dragging
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    Logger.info('🖱️  [VIEWPORT] Mouse interaction hook mounted');
    Logger.info('📊 [VIEWPORT] Connected:', connected);

    const canvas = canvasRef.current;
    if (!canvas || !connected) {
      Logger.info('⚠️  [VIEWPORT] Skipping mouse controls setup (canvas or not connected)');
      return;
    }

    Logger.info('🖱️  [VIEWPORT] Setting up mouse event handlers...');

    const handleMouseDown = (e: MouseEvent) => {
      Logger.info('🖱️  [VIEWPORT] handleMouseDown CALLED', {
        button: e.button,
        x: e.clientX,
        y: e.clientY,
      });

      if (viewportLocked) {
        Logger.info('🔒 [VIEWPORT] Viewport locked, ignoring mouse input');
        return;
      }

      // Get canvas-relative coordinates
      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      Logger.info('📊 [VIEWPORT] Canvas coords:', { canvasX, canvasY });

      if (e.button === 0) {
        // Left button
        // CTRL+LEFT: 2D Canvas Pan (Octane SE Manual: Control key + left mouse button pans the rendered display)
        if (e.ctrlKey || e.metaKey) {
          is2DPanningRef.current = true;
          setIsDragging(true); // ✅ Phase 3: Track drag for throttling
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
          setIsDragging(true); // ✅ Phase 3: Track drag for throttling
          lastMousePosRef.current = { x: e.clientX, y: e.clientY };
          canvas.style.cursor = 'grabbing';
        }
      } else if (e.button === 2) {
        // Right button = PAN (always available)
        isPanningRef.current = true;
        setIsDragging(true); // ✅ Phase 3: Track drag for throttling
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
      updateCameraThrottled();
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
        } catch (error: any) {
          Logger.error('Failed to set render region:', error.message);
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
        pickingMode !== 'renderRegion' &&
        pickingMode !== 'none'
      ) {
        const rect = canvas.getBoundingClientRect();
        const canvasX = Math.floor(
          ((lastMousePosRef.current.x - rect.left) / rect.width) * canvas.width
        );
        const canvasY = Math.floor(
          ((lastMousePosRef.current.y - rect.top) / rect.height) * canvas.height
        );

        Logger.debug(`${pickingMode} picker activated at (${canvasX}, ${canvasY})`);

        try {
          if (pickingMode === 'whiteBalance') {
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
                Logger.debug(
                  `Camera target set to: [${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}]`
                );
                cameraRef.current.center = [x, y, z];
                await updateCameraImmediate();
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
        } catch (error: any) {
          Logger.error(`Picking failed (${pickingMode}):`, error.message);
        }
        return;
      }

      // 2D CANVAS PAN MODE: Complete pan
      if (is2DPanningRef.current) {
        is2DPanningRef.current = false;
        setIsDragging(false); // ✅ Phase 3: End drag throttling
        canvas.style.cursor = pickingMode !== 'none' ? 'crosshair' : 'grab';
        return;
      }

      // CAMERA MODE: Complete orbit/pan
      if (isDraggingRef.current || isPanningRef.current) {
        const wasPanning = isPanningRef.current;
        isDraggingRef.current = false;
        isPanningRef.current = false;
        setIsDragging(false); // ✅ Phase 3: End drag throttling
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
        updateCameraImmediate();
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

      await updateCameraThrottled();
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('contextmenu', handleContextMenu);
    Logger.info('✅ [VIEWPORT] All mouse event listeners attached');

    // Set cursor based on viewport lock state and picking mode
    if (viewportLocked) {
      canvas.style.cursor = 'not-allowed';
    } else if (pickingMode !== 'none') {
      canvas.style.cursor = 'crosshair'; // All picking modes use crosshair cursor
    } else {
      canvas.style.cursor = 'grab';
    }
    Logger.info('🖱️  [VIEWPORT] Cursor style set to:', canvas.style.cursor);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [
    connected,
    updateCameraThrottled,
    updateCameraImmediate,
    viewportLocked,
    pickingMode,
    isSelectingRegion,
    regionStart,
    regionEnd,
    client,
    triggerOctaneUpdate,
    canvasRef,
    cameraRef,
    setIsSelectingRegion,
    setRegionStart,
    setRegionEnd,
    setCanvasTransform,
    setContextMenuPos,
    setContextMenuVisible,
  ]);

  // ✅ Phase 3: Return drag state for viewport throttling
  return { isDragging };
}
