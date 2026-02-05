/**
 * Camera Synchronization Hook for CallbackRenderViewport
 *
 * Manages camera state synchronization between local viewport and Octane renderer.
 * Extracted from CallbackRenderViewport to reduce component complexity.
 *
 * Features:
 * - Initialize camera from Octane's current state
 * - Update Octane camera from local state
 * - Throttled updates for smooth performance (10 Hz rate limit)
 * - Immediate updates for final position on mouse up
 */

import { useCallback, useRef, MutableRefObject } from 'react';
import Logger from '../../../utils/Logger';

interface CameraState {
  radius: number;
  theta: number;
  phi: number;
  center: [number, number, number];
  fov: number;
}

interface OctaneClient {
  getCamera: () => Promise<any>;
  setCameraPositionAndTarget: (
    posX: number,
    posY: number,
    posZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    silent?: boolean
  ) => Promise<void>;
}

interface UseCameraSyncParams {
  client: OctaneClient;
  connected: boolean;
  cameraRef: MutableRefObject<CameraState>;
  triggerOctaneUpdate: () => Promise<void>;
}

const CAMERA_UPDATE_INTERVAL = 100; // ms (10 Hz rate limit)

/**
 * Hook for synchronizing camera state with Octane renderer
 */
export function useCameraSync({
  client,
  connected,
  cameraRef,
  triggerOctaneUpdate,
}: UseCameraSyncParams) {
  // Camera update rate limiting refs
  const lastCameraUpdateRef = useRef(0);
  const pendingCameraUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPendingUpdateRef = useRef(false);

  /**
   * Initialize camera from Octane's current camera settings
   * Uses LiveLink.GetCamera to fetch current camera position and target
   */
  const initializeCamera = useCallback(async () => {
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
  }, [client, cameraRef]);

  /**
   * Update Octane camera from current state
   * Uses LiveLink.SetCamera to update both position and target efficiently
   */
  const updateCamera = useCallback(async () => {
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
      // silent=true prevents event emission (this is viewport updating Octane, not external update)
      await client.setCameraPositionAndTarget(posX, posY, posZ, center[0], center[1], center[2], true);

      // Trigger render update
      await triggerOctaneUpdate();
    } catch (error: any) {
      Logger.error('Failed to update camera:', error.message);
    }
  }, [connected, client, cameraRef, triggerOctaneUpdate]);

  /**
   * Throttled camera update - limits updates to 10 Hz for smooth performance
   * Immediately updates local state, but rate-limits Octane API calls
   */
  const updateCameraThrottled = useCallback(() => {
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
      updateCamera();
    } else {
      // Too soon, schedule update for later
      const delay = CAMERA_UPDATE_INTERVAL - timeSinceLastUpdate;
      hasPendingUpdateRef.current = true;
      pendingCameraUpdateRef.current = setTimeout(() => {
        lastCameraUpdateRef.current = Date.now();
        hasPendingUpdateRef.current = false;
        updateCamera();
      }, delay);
    }
  }, [updateCamera]);

  /**
   * Force immediate camera update - used on mouse up to ensure final position is sent
   */
  const updateCameraImmediate = useCallback(() => {
    // Clear any pending throttled update
    if (pendingCameraUpdateRef.current) {
      clearTimeout(pendingCameraUpdateRef.current);
      pendingCameraUpdateRef.current = null;
    }
    hasPendingUpdateRef.current = false;
    lastCameraUpdateRef.current = Date.now();
    updateCamera();
  }, [updateCamera]);

  return {
    initializeCamera,
    updateCamera,
    updateCameraThrottled,
    updateCameraImmediate,
  };
}
