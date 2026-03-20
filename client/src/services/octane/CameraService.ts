/**
 * Camera Service - Camera position and orientation management
 * Handles all camera-related operations via LiveLink service
 */

import { Logger } from '../../utils/Logger';
import { EventEmitter } from '../../utils/EventEmitter';
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';
import { CameraState } from './types';

export class CameraService extends BaseService {
  private apiService: ApiService;
  private originalCameraState: CameraState | null = null;

  constructor(emitter: EventEmitter, serverUrl: string, apiService: ApiService) {
    super(emitter, serverUrl);
    this.apiService = apiService;
  }

  async getCamera(): Promise<CameraState> {
    // LiveLink.GetCamera returns CameraState with position, target, up vectors
    const response = await this.apiService.callApi('LiveLink', 'GetCamera', {});
    const state = response as Record<string, unknown>;
    if (!state || typeof state !== 'object' || !('position' in state || 'target' in state)) {
      throw new Error('GetCamera returned unexpected shape');
    }
    // Safe: CameraState has index signature [key: string]: unknown,
    // and we validated position/target exist above
    return state as CameraState;
  }

  async setCameraPosition(x: number, y: number, z: number): Promise<void> {
    // LiveLink.SetCamera takes CameraState with optional position, target, up
    await this.apiService.callApi('LiveLink', 'SetCamera', {
      position: { x, y, z },
    });
  }

  async setCameraTarget(x: number, y: number, z: number): Promise<void> {
    // LiveLink.SetCamera takes CameraState with optional position, target, up
    await this.apiService.callApi('LiveLink', 'SetCamera', {
      target: { x, y, z },
    });
  }

  async setCameraPositionAndTarget(
    posX: number,
    posY: number,
    posZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    silent = false // Set to true to skip event emission (for viewport drag operations)
  ): Promise<void> {
    // More efficient: set both position and target in one call
    await this.apiService.callApi('LiveLink', 'SetCamera', {
      position: { x: posX, y: posY, z: posZ },
      target: { x: targetX, y: targetY, z: targetZ },
    });

    // Emit event to notify viewport of programmatic camera changes
    // (unless silent=true for viewport drag operations)
    if (!silent) {
      this.emit('camera:reset', {
        position: { x: posX, y: posY, z: posZ },
        target: { x: targetX, y: targetY, z: targetZ },
      });
      Logger.debug('Emitted camera:reset event');
    }
  }

  async resetCamera(): Promise<void> {
    // Reset camera to original position captured at connection time
    if (!this.originalCameraState) {
      Logger.warn('No original camera state stored - fetching current as fallback');
      this.originalCameraState = await this.getCamera();
    }

    Logger.debug('Resetting camera to original state:', this.originalCameraState);
    await this.apiService.callApi('LiveLink', 'SetCamera', this.originalCameraState);

    // Emit event to notify viewport that camera was programmatically moved
    // Viewport will re-sync its local camera state from Octane
    this.emit('camera:reset', { state: this.originalCameraState });
    Logger.debug('Emitted camera:reset event');
  }

  /**
   * Frame the camera to fit the entire scene.
   * Calls getSceneBounds to get the bounding box, computes centroid for target,
   * and pulls the camera back far enough to fit the extents in frame.
   * Uses calibrated FOV values from CAMERA_MATH.md.
   *
   * @param elevation - Camera elevation angle in degrees (default 29° — product shot sweet spot)
   * @param margin - Extra margin multiplier (default 1.15 — 15% breathing room)
   */
  async frameScene(elevation = 25, margin = 1.5): Promise<boolean> {
    try {
      const bounds = await this.apiService.callApi('ApiRenderEngine', 'getSceneBounds', {});

      const boundsResult = bounds as {
        result?: boolean;
        bboxMin?: { x: number; y: number; z: number };
        bboxMax?: { x: number; y: number; z: number };
      };

      if (!boundsResult?.result || !boundsResult.bboxMin || !boundsResult.bboxMax) {
        Logger.warn('No scene geometry to frame');
        return false;
      }

      const min = boundsResult.bboxMin;
      const max = boundsResult.bboxMax;

      // Get actual camera FOV for accurate framing
      let fovDeg = 43.6; // fallback
      try {
        const cam = await this.getCamera();
        if (cam.fov && typeof cam.fov === 'number' && cam.fov > 0) {
          fovDeg = cam.fov;
        }
      } catch {
        /* use fallback */
      }

      // Centroid = center of bounding box
      const cx = (min.x + max.x) / 2;
      const cy = (min.y + max.y) / 2;
      const cz = (min.z + max.z) / 2;

      // Extents — use the diagonal of the bounding box for safe framing
      const width = max.x - min.x;
      const height = max.y - min.y;
      const depth = max.z - min.z;

      // Half FOV from actual camera (fov is full vertical angle)
      const halfFovRad = ((fovDeg / 2) * Math.PI) / 180;

      // Distance to fit the largest extent in frame
      // Use max of width, height, depth as the "size to frame"
      const maxExtent = Math.max(width, height, depth);
      const dist = ((maxExtent / 2) * margin) / Math.tan(halfFovRad);

      // Camera position: pull back along Z with elevation
      const elevRad = (elevation * Math.PI) / 180;
      const posX = cx; // Centered — avoid asymmetric clipping
      const posY = cy + dist * Math.sin(elevRad);
      const posZ = cz + dist * Math.cos(elevRad);

      // Target at centroid
      await this.setCameraPositionAndTarget(posX, posY, posZ, cx, cy, cz);

      Logger.debug(
        () =>
          `Framed scene: bounds [${min.x.toFixed(1)},${min.y.toFixed(1)},${min.z.toFixed(1)}]-[${max.x.toFixed(1)},${max.y.toFixed(1)},${max.z.toFixed(1)}], dist=${dist.toFixed(2)}`
      );

      return true;
    } catch (error) {
      Logger.error('Failed to frame scene:', error);
      return false;
    }
  }

  async captureOriginalCameraState(): Promise<void> {
    try {
      this.originalCameraState = await this.getCamera();
      Logger.debug('Captured original camera state:', this.originalCameraState);
    } catch (error) {
      // Expected on empty scenes (no RT/camera yet) — debug, not warn
      Logger.debug(
        'Failed to initialize camera from Octane:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}
