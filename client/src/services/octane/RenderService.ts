/**
 * Render Service - Render control and settings management
 * Handles render operations, modes, regions, and statistics
 */

import { Logger } from '../../utils/Logger';
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';
import { RenderState, RenderRegion } from './types';
import { PinId, PinTypeId } from '../../constants/OctaneTypes';

export class RenderService extends BaseService {
  private apiService: ApiService;
  private renderState: RenderState;

  constructor(emitter: any, serverUrl: string, apiService: ApiService) {
    super(emitter, serverUrl);
    this.apiService = apiService;
    this.renderState = {
      isRendering: false,
      progress: 0,
      samples: 0,
      renderTime: 0,
      resolution: { width: 1920, height: 1080 }
    };
  }

  async startRender(): Promise<void> {
    await this.apiService.callApi('ApiRenderEngine', 'continueRendering', {});
    this.renderState.isRendering = true;
    this.emit('renderStateChanged', this.renderState);
  }

  async stopRender(): Promise<void> {
    await this.apiService.callApi('ApiRenderEngine', 'stopRendering', {});
    this.renderState.isRendering = false;
    this.emit('renderStateChanged', this.renderState);
  }

  async pauseRender(): Promise<void> {
    await this.apiService.callApi('ApiRenderEngine', 'pauseRendering', {});
    this.renderState.isRendering = false;
    this.emit('renderStateChanged', this.renderState);
  }

  async restartRender(): Promise<void> {
    await this.apiService.callApi('ApiRenderEngine', 'restartRendering', {});
    this.renderState.isRendering = true;
    this.renderState.samples = 0;
    this.emit('renderStateChanged', this.renderState);
  }

  async getClayMode(): Promise<number> {
    const response = await this.apiService.callApi('ApiRenderEngine', 'clayMode', {});
    return response?.result ?? 0;
  }

  async setClayMode(mode: number): Promise<void> {
    await this.apiService.callApi('ApiRenderEngine', 'setClayMode', null, { mode });
  }

  async getSubSampleMode(): Promise<number> {
    const response = await this.apiService.callApi('ApiRenderEngine', 'getSubSampleMode', {});
    return response?.result ?? 1;
  }

  async setSubSampleMode(mode: number): Promise<void> {
    await this.apiService.callApi('ApiRenderEngine', 'setSubSampleMode', null, { mode });
  }

  async getRenderStatistics(): Promise<any> {
    try {
      const response = await this.apiService.callApi('ApiRenderEngine', 'getRenderStatistics', 0, {});
      return response?.statistics || null;
    } catch (error: any) {
      Logger.error('❌ Failed to get render statistics:', error.message);
      return null;
    }
  }

  async getRenderRegion(): Promise<RenderRegion> {
    try {
      const response = await this.apiService.callApi('ApiRenderEngine', 'getRenderRegion', {});
      return {
        active: response?.active ?? false,
        regionMin: response?.regionMin ?? { x: 0, y: 0 },
        regionMax: response?.regionMax ?? { x: 1920, y: 1080 },
        featherWidth: response?.featherWidth ?? 0
      };
    } catch (error: any) {
      Logger.error('❌ Failed to get render region:', error.message);
      return {
        active: false,
        regionMin: { x: 0, y: 0 },
        regionMax: { x: 1920, y: 1080 },
        featherWidth: 0
      };
    }
  }

  async setRenderRegion(
    active: boolean,
    regionMin: { x: number; y: number },
    regionMax: { x: number; y: number },
    featherWidth: number = 0
  ): Promise<void> {
    try {
      await this.apiService.callApi('ApiRenderEngine', 'setRenderRegion', null, {
        active,
        regionMin,
        regionMax,
        featherWidth
      });
      Logger.debug(`✅ Render region ${active ? 'enabled' : 'disabled'}:`, { regionMin, regionMax, featherWidth });
    } catch (error: any) {
      Logger.error('❌ Failed to set render region:', error.message);
      throw error;
    }
  }

  /**
   * Gets the Film Settings node connected to the render target
   * 
   * Octane's render pipeline structure:
   * RenderEngine → RenderTarget → FilmSettings (pin 15 = P_FILM_SETTINGS)
   * 
   * Film Settings controls resolution, AOVs, and output options.
   * Returns null if no render target exists or no Film Settings connected.
   */
  private async getFilmSettingsNode(): Promise<number | null> {
    try {
      const renderTargetResponse = await this.apiService.callApi('ApiRenderEngine', 'getRenderTargetNode', {});
      if (!renderTargetResponse?.result?.handle) {
        Logger.warn('⚠️ No render target found');
        return null;
      }
      
      const renderTargetHandle = renderTargetResponse.result.handle;
      
      const filmSettingsResponse = await this.apiService.callApi('ApiNode', 'connectedNode', renderTargetHandle, { pinId: PinId.P_FILM_SETTINGS });
      const handle = filmSettingsResponse?.result?.handle;
      
      // API returns "0" string/number for disconnected pins
      if (!handle || handle === "0" || handle === 0) {
        Logger.warn('⚠️ No Film Settings node connected to render target');
        return null;
      }
      
      return handle;
    } catch (error: any) {
      Logger.error('❌ Failed to get Film Settings node:', error.message);
      return null;
    }
  }

  async getViewportResolutionLock(): Promise<boolean> {
    try {
      const filmSettingsHandle = await this.getFilmSettingsNode();
      if (!filmSettingsHandle) {
        return false;
      }

      // Get boolean value directly using PinId (from OctaneTypes.PinId)
      const valueResponse = await this.apiService.callApi('ApiNode', 'getPinValueByPinID', filmSettingsHandle, { 
        pin_id: PinId.P_LOCK_RENDER_AOVS,
        expected_type: PinTypeId.PIN_ID_BOOL
      });
      return valueResponse?.bool_value ?? false;
    } catch (error: any) {
      Logger.error('❌ Failed to get viewport resolution lock:', error.message);
      return false;
    }
  }

  async setViewportResolutionLock(locked: boolean): Promise<void> {
    try {
      const filmSettingsHandle = await this.getFilmSettingsNode();
      if (!filmSettingsHandle) {
        throw new Error('Film Settings node not found');
      }

      // Set boolean value directly using PinId (from OctaneTypes.PinId)
      await this.apiService.callApi('ApiNode', 'setPinValueByPinID', filmSettingsHandle, {
        pin_id: PinId.P_LOCK_RENDER_AOVS,  // 2672
        bool_value: locked
      });
    } catch (error: any) {
      Logger.error('❌ Failed to set viewport resolution lock:', error.message);
      throw error;
    }
  }

  getRenderState(): RenderState {
    return this.renderState;
  }
}
