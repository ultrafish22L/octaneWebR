/**
 * Device Service - GPU device statistics and information
 * Handles device count, names, memory usage, and resource statistics
 */

import { Logger } from '../../utils/Logger';
import { EventEmitter } from '../../utils/EventEmitter';
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';

export class DeviceService extends BaseService {
  private apiService: ApiService;

  constructor(emitter: EventEmitter, serverUrl: string, apiService: ApiService) {
    super(emitter, serverUrl);
    this.apiService = apiService;
  }

  async getDeviceCount(): Promise<number> {
    try {
      const response = await this.apiService.callApi('ApiRenderEngine', 'getDeviceCount', {});
      return (response?.result as number) ?? 0;
    } catch (error) {
      Logger.error(
        'Failed to get device count:',
        error instanceof Error ? error.message : String(error)
      );
      return 0;
    }
  }

  async getDeviceName(deviceIndex: number): Promise<string> {
    try {
      const response = await this.apiService.callApi('ApiRenderEngine', 'getDeviceName', null, {
        deviceIndex,
      });
      return (response?.result as string) ?? 'Unknown Device';
    } catch (error) {
      Logger.error(
        `Failed to get device name for device ${deviceIndex}:`,
        error instanceof Error ? error.message : String(error)
      );
      return 'Unknown Device';
    }
  }

  async getMemoryUsage(deviceIndex: number): Promise<{
    usedDeviceMemory: number;
    freeDeviceMemory: number;
    totalDeviceMemory: number;
    outOfCoreMemory: number;
    peerToPeerBytesUsed: number;
  } | null> {
    try {
      const response = await this.apiService.callApi('ApiRenderEngine', 'getMemoryUsage', null, {
        deviceIndex,
      });
      return (
        (response?.result as {
          usedDeviceMemory: number;
          freeDeviceMemory: number;
          totalDeviceMemory: number;
          outOfCoreMemory: number;
          peerToPeerBytesUsed: number;
        } | null) ?? null
      );
    } catch (error) {
      Logger.error(
        `Failed to get memory usage for device ${deviceIndex}:`,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  async getResourceStatistics(deviceIndex: number): Promise<{
    runtimeDataSize: number;
    filmDataSize: number;
    geometryDataSize: number;
    nodeSystemDataSize: number;
    imagesDataSize: number;
    compositorDataSize: number;
    denoiserDataSize: number;
  } | null> {
    try {
      const response = await this.apiService.callApi(
        'ApiRenderEngine',
        'getResourceStatistics',
        null,
        { deviceIndex }
      );
      return (
        (response?.result as {
          runtimeDataSize: number;
          filmDataSize: number;
          geometryDataSize: number;
          nodeSystemDataSize: number;
          imagesDataSize: number;
          compositorDataSize: number;
          denoiserDataSize: number;
        } | null) ?? null
      );
    } catch (error) {
      Logger.error(
        `Failed to get resource statistics for device ${deviceIndex}:`,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  async getGeometryStatistics(deviceIndex: number): Promise<{
    triCount: number;
    dispTriCount: number;
    hairSegCount: number;
    voxelCount: number;
    gaussianSplatCount: number;
    sphereCount: number;
    instanceCount: number;
    emitPriCount: number;
    emitInstanceCount: number;
    analyticLiCount: number;
  } | null> {
    try {
      const response = await this.apiService.callApi(
        'ApiRenderEngine',
        'getGeometryStatistics',
        null,
        { deviceIndex }
      );
      return (
        (response?.result as {
          triCount: number;
          dispTriCount: number;
          hairSegCount: number;
          voxelCount: number;
          gaussianSplatCount: number;
          sphereCount: number;
          instanceCount: number;
          emitPriCount: number;
          emitInstanceCount: number;
          analyticLiCount: number;
        } | null) ?? null
      );
    } catch (error) {
      Logger.error(
        `Failed to get geometry statistics for device ${deviceIndex}:`,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  async getTexturesStatistics(deviceIndex: number): Promise<{
    usedRgba32Textures: number;
    usedRgba64Textures: number;
    usedY8Textures: number;
    usedY16Textures: number;
    usedVirtualTextures: number;
  } | null> {
    try {
      const response = await this.apiService.callApi(
        'ApiRenderEngine',
        'getTexturesStatistics',
        null,
        { deviceIndex }
      );
      return (
        (response?.result as {
          usedRgba32Textures: number;
          usedRgba64Textures: number;
          usedY8Textures: number;
          usedY16Textures: number;
          usedVirtualTextures: number;
        } | null) ?? null
      );
    } catch (error) {
      Logger.error(
        `Failed to get textures statistics for device ${deviceIndex}:`,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  async getOctaneVersion(): Promise<string> {
    try {
      const response = await this.apiService.callApi('ApiInfo', 'octaneVersion', {});
      return (response?.result as string) ?? 'Unknown';
    } catch (error) {
      Logger.error(
        'Failed to get Octane version:',
        error instanceof Error ? error.message : String(error)
      );
      return 'Unknown';
    }
  }
}
