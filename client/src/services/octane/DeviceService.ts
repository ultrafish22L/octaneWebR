/**
 * Device Service - GPU device statistics and information
 * Handles device count, names, memory usage, and resource statistics
 */

import { Logger } from '../../utils/Logger';
import { EventEmitter } from '../../utils/EventEmitter';
import { BaseService } from './BaseService';
import { ApiService, asObject, asNumber, asString, asBool } from './ApiService';

export class DeviceService extends BaseService {
  private apiService: ApiService;

  constructor(emitter: EventEmitter, serverUrl: string, apiService: ApiService) {
    super(emitter, serverUrl);
    this.apiService = apiService;
  }

  async getDeviceCount(): Promise<number> {
    try {
      const response = await this.apiService.callApi('ApiRenderEngine', 'getDeviceCount', {});
      return asNumber(response?.result);
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
      return asString(response?.result, 'Unknown Device');
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
      const mem = asObject(response?.memUsage);
      if (!mem) return null;
      return {
        usedDeviceMemory: Number(mem.usedDeviceMemory) || 0,
        freeDeviceMemory: Number(mem.freeDeviceMemory) || 0,
        totalDeviceMemory: Number(mem.totalDeviceMemory) || 0,
        outOfCoreMemory: Number(mem.outOfCoreMemory) || 0,
        peerToPeerBytesUsed: Number(mem.peerToPeerBytesUsed) || 0,
      };
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
      const stats = asObject(response?.resourceStats);
      if (!stats) return null;
      return {
        runtimeDataSize: Number(stats.runtimeDataSize) || 0,
        filmDataSize: Number(stats.filmDataSize) || 0,
        geometryDataSize: Number(stats.geometryDataSize) || 0,
        nodeSystemDataSize: Number(stats.nodeSystemDataSize) || 0,
        imagesDataSize: Number(stats.imagesDataSize) || 0,
        compositorDataSize: Number(stats.compositorDataSize) || 0,
        denoiserDataSize: Number(stats.denoiserDataSize) || 0,
      };
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
      const stats = asObject(response?.stats);
      if (!stats) return null;
      return {
        triCount: Number(stats.triCount) || 0,
        dispTriCount: Number(stats.dispTriCount) || 0,
        hairSegCount: Number(stats.hairSegCount) || 0,
        voxelCount: Number(stats.voxelCount) || 0,
        gaussianSplatCount: Number(stats.gaussianSplatCount) || 0,
        sphereCount: Number(stats.sphereCount) || 0,
        instanceCount: Number(stats.instanceCount) || 0,
        emitPriCount: Number(stats.emitPriCount) || 0,
        emitInstanceCount: Number(stats.emitInstanceCount) || 0,
        analyticLiCount: Number(stats.analyticLiCount) || 0,
      };
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
      const stats = asObject(response?.textureStats);
      if (!stats) return null;
      return {
        usedRgba32Textures: Number(stats.usedRgba32Textures) || 0,
        usedRgba64Textures: Number(stats.usedRgba64Textures) || 0,
        usedY8Textures: Number(stats.usedY8Textures) || 0,
        usedY16Textures: Number(stats.usedY16Textures) || 0,
        usedVirtualTextures: Number(stats.usedVirtualTextures) || 0,
      };
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
      return asString(response?.result, 'Unknown');
    } catch (error) {
      Logger.error(
        'Failed to get Octane version:',
        error instanceof Error ? error.message : String(error)
      );
      return 'Unknown';
    }
  }

  async getOctaneInfo(): Promise<{
    name: string;
    isDemo: boolean;
    isSubscription: boolean;
    tier: number;
  }> {
    const [nameRes, demoRes, subRes, tierRes] = await Promise.all([
      this.apiService.callApi('ApiInfo', 'octaneName', {}).catch(() => null),
      this.apiService.callApi('ApiInfo', 'isDemoVersion', {}).catch(() => null),
      this.apiService.callApi('ApiInfo', 'isSubscriptionVersion', {}).catch(() => null),
      this.apiService.callApi('ApiInfo', 'tierIdx', {}).catch(() => null),
    ]);
    return {
      name: asString(nameRes?.result),
      isDemo: asBool(demoRes?.result),
      isSubscription: asBool(subRes?.result),
      tier: asNumber(tierRes?.result, -1),
    };
  }
}
