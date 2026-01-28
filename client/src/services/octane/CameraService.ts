/**
 * Camera Service - Camera position and orientation management
 * Handles all camera-related operations via LiveLink service
 */

import { Logger } from '../../utils/Logger';
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';
import { CameraState } from './types';

export class CameraService extends BaseService {
  private apiService: ApiService;
  private originalCameraState: CameraState | null = null;

  constructor(emitter: any, serverUrl: string, apiService: ApiService) {
    super(emitter, serverUrl);
    this.apiService = apiService;
  }

  async getCamera(): Promise<CameraState> {
    // LiveLink.GetCamera returns CameraState with position, target, up vectors
    return this.apiService.callApi('LiveLink', 'GetCamera', {});
  }

  async setCameraPosition(x: number, y: number, z: number): Promise<void> {
    // LiveLink.SetCamera takes CameraState with optional position, target, up
    await this.apiService.callApi('LiveLink', 'SetCamera', {
      position: { x, y, z }
    });
  }

  async setCameraTarget(x: number, y: number, z: number): Promise<void> {
    // LiveLink.SetCamera takes CameraState with optional position, target, up
    await this.apiService.callApi('LiveLink', 'SetCamera', {
      target: { x, y, z }
    });
  }

  async setCameraPositionAndTarget(
    posX: number, posY: number, posZ: number,
    targetX: number, targetY: number, targetZ: number
  ): Promise<void> {
    // More efficient: set both position and target in one call
    await this.apiService.callApi('LiveLink', 'SetCamera', {
      position: { x: posX, y: posY, z: posZ },
      target: { x: targetX, y: targetY, z: targetZ }
    });
  }
  
  async resetCamera(): Promise<void> {
    // Reset camera to original position captured at connection time
    if (!this.originalCameraState) {
      Logger.warn('⚠️ No original camera state stored - fetching current as fallback');
      this.originalCameraState = await this.getCamera();
    }
    
    Logger.debug('📷 Resetting camera to original state:', this.originalCameraState);
    await this.apiService.callApi('LiveLink', 'SetCamera', this.originalCameraState);
  }

  async captureOriginalCameraState(): Promise<void> {
    try {
      this.originalCameraState = await this.getCamera();
      Logger.debug('📷 Captured original camera state:', this.originalCameraState);
    } catch (error: any) {
      Logger.warn('⚠️ Could not capture initial camera state:', error.message);
    }
  }
}
