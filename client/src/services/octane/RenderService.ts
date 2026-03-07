/**
 * Render Service - Render control and settings management
 * Handles render operations, modes, regions, and statistics
 */

import { Logger } from '../../utils/Logger';
import { EventEmitter } from '../../utils/EventEmitter';
import { BaseService } from './BaseService';
import { ApiService, asObject, asNumber, asBool, getHandle } from './ApiService';
import { RenderState, RenderRegion } from './types';
import { PinId, PinTypeId } from '../../constants/OctaneTypes';

export class RenderService extends BaseService {
  private apiService: ApiService;
  private renderState: RenderState;

  constructor(emitter: EventEmitter, serverUrl: string, apiService: ApiService) {
    super(emitter, serverUrl);
    this.apiService = apiService;
    this.renderState = {
      isRendering: false,
      progress: 0,
      samples: 0,
      renderTime: 0,
      resolution: { width: 1920, height: 1080 },
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
    return asNumber(response?.result, 0);
  }

  async setClayMode(mode: number): Promise<void> {
    await this.apiService.callApi('ApiRenderEngine', 'setClayMode', null, { mode });
  }

  async getSubSampleMode(): Promise<number> {
    const response = await this.apiService.callApi('ApiRenderEngine', 'getSubSampleMode', {});
    return asNumber(response?.result, 1);
  }

  async setSubSampleMode(mode: number): Promise<void> {
    await this.apiService.callApi('ApiRenderEngine', 'setSubSampleMode', null, { mode });
  }

  async getRenderStatistics(): Promise<Record<string, unknown> | null> {
    try {
      const response = await this.apiService.callApi(
        'ApiRenderEngine',
        'getRenderStatistics',
        0,
        {}
      );
      return (asObject(response?.statistics) as Record<string, unknown> | null) ?? null;
    } catch (error) {
      Logger.error(
        'Failed to get render statistics:',
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  async getRenderRegion(): Promise<RenderRegion> {
    try {
      const response = await this.apiService.callApi('ApiRenderEngine', 'getRenderRegion', {});
      const regionMinObj = asObject(response?.regionMin);
      const regionMaxObj = asObject(response?.regionMax);
      return {
        active: asBool(response?.active, false),
        regionMin: regionMinObj
          ? { x: asNumber(regionMinObj.x, 0), y: asNumber(regionMinObj.y, 0) }
          : { x: 0, y: 0 },
        regionMax: regionMaxObj
          ? { x: asNumber(regionMaxObj.x, 1920), y: asNumber(regionMaxObj.y, 1080) }
          : { x: 1920, y: 1080 },
        featherWidth: asNumber(response?.featherWidth, 0),
      };
    } catch (error) {
      Logger.error(
        'Failed to get render region:',
        error instanceof Error ? error.message : String(error)
      );
      return {
        active: false,
        regionMin: { x: 0, y: 0 },
        regionMax: { x: 1920, y: 1080 },
        featherWidth: 0,
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
        featherWidth,
      });
      Logger.debug(`Render region ${active ? 'enabled' : 'disabled'}:`, {
        regionMin,
        regionMax,
        featherWidth,
      });
    } catch (error) {
      Logger.error(
        'Failed to set render region:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Sets the render target node that should be rendered
   * @param nodeHandle - Handle of the render target node, or null to clear
   * @returns true if successful, false if the node wasn't valid
   */
  async setRenderTargetNode(nodeHandle: number | null): Promise<boolean> {
    try {
      // Convert null to empty object for gRPC
      const targetNode = nodeHandle ? { handle: nodeHandle } : {};

      const response = await this.apiService.callApi(
        'ApiRenderEngine',
        'setRenderTargetNode',
        null,
        {
          targetNode,
        }
      );

      const success = asBool(response?.result, false);

      if (success) {
        Logger.debug(`Render target set to node handle: ${nodeHandle || 'null'}`);
      } else {
        Logger.warn(`Failed to set render target (invalid node or wrong type)`);
      }

      return success;
    } catch (error) {
      Logger.error(
        'Failed to set render target node:',
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  /**
   * Gets the render target node that's currently being rendered
   * @returns Handle of the render target node, or null if none is set
   */
  async getRenderTargetNode(): Promise<number | null> {
    try {
      const response = await this.apiService.callApi('ApiRenderEngine', 'getRenderTargetNode', {});
      const handle = getHandle(response?.result);

      // API returns 0 for no render target
      if (!handle || handle === 0) {
        return null;
      }

      return handle;
    } catch (error) {
      Logger.error(
        'Failed to get render target node:',
        error instanceof Error ? error.message : String(error)
      );
      return null;
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
      const renderTargetHandle = await this.getRenderTargetNode();
      if (!renderTargetHandle) {
        Logger.warn('No render target found');
        return null;
      }

      const filmSettingsResponse = await this.apiService.callApi(
        'ApiNode',
        'connectedNode',
        renderTargetHandle,
        {
          pinId: PinId.P_FILM_SETTINGS,
          enterWrapperNode: true,
        }
      );
      const handle = getHandle(filmSettingsResponse?.result);

      // API returns 0 for disconnected pins
      if (!handle || handle === 0) {
        Logger.warn('No Film Settings node connected to render target');
        return null;
      }

      return handle;
    } catch (error) {
      Logger.error(
        'Failed to get Film Settings node:',
        error instanceof Error ? error.message : String(error)
      );
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
      const valueResponse = await this.apiService.callApi(
        'ApiNode',
        'getPinValueByPinID',
        filmSettingsHandle,
        {
          pin_id: PinId.P_LOCK_RENDER_AOVS,
          expected_type: PinTypeId.PIN_ID_BOOL,
        }
      );
      return asBool(valueResponse?.bool_value, false);
    } catch (error) {
      Logger.error(
        'Failed to get viewport resolution lock:',
        error instanceof Error ? error.message : String(error)
      );
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
        pin_id: PinId.P_LOCK_RENDER_AOVS, // 2672
        bool_value: locked,
      });
    } catch (error) {
      Logger.error(
        'Failed to set viewport resolution lock:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  getRenderState(): RenderState {
    return this.renderState;
  }

  async setRenderPriority(priority: number): Promise<void> {
    await this.apiService.callApi('ApiRenderEngine', 'setRenderPriority', null, { priority });
  }

  // ==================== Viewport Picking ====================

  async pick(x: number, y: number): Promise<Record<string, unknown>[]> {
    try {
      Logger.debug(`Picking at viewport position (${x}, ${y})...`);
      const response = await this.apiService.callApi('ApiRenderEngine', 'pick', null, {
        x,
        y,
      });

      const intersections = response?.intersections;
      if (!Array.isArray(intersections) || intersections.length === 0) {
        Logger.debug('Pick: No intersections found');
        return [];
      }

      Logger.debug(`Pick: Found ${intersections.length} intersection(s)`);
      Logger.debug('Pick result:', intersections);
      return intersections as Record<string, unknown>[];
    } catch (error) {
      Logger.error(
        'Failed to pick at viewport position:',
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  async pickWhitePoint(x: number, y: number): Promise<{ x: number; y: number; z: number } | null> {
    try {
      const response = await this.apiService.callApi('ApiRenderEngine', 'pickWhitePoint', null, {
        x,
        y,
      });
      const whitePointObj = asObject(response?.whitePoint);
      if (response?.result && whitePointObj) {
        const wp = {
          x: asNumber(whitePointObj.x, 0),
          y: asNumber(whitePointObj.y, 0),
          z: asNumber(whitePointObj.z, 0),
        };
        Logger.debug(`White point picked at (${x}, ${y}):`, wp);
        return wp;
      } else {
        Logger.warn('No white point returned from pick');
        return null;
      }
    } catch (error) {
      Logger.error(
        'Failed to pick white point:',
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  async pickSceneInfo(x: number, y: number): Promise<Record<string, unknown>> {
    try {
      const response = await this.apiService.callApi('ApiRenderEngine', 'pick', null, {
        x,
        y,
        filterDuplicateMaterialPins: true,
        intersectionsSize: 10,
      });
      Logger.debug(`Scene pick at (${x}, ${y}):`, response);
      return response;
    } catch (error) {
      Logger.error(
        'Failed to pick scene info:',
        error instanceof Error ? error.message : String(error)
      );
      return {};
    }
  }
}
