/**
 * Viewport Service - Viewport picking and interaction
 * Handles picking objects, materials, white points, and scene info
 */

import { Logger } from '../../utils/Logger';
import { EventEmitter } from '../../utils/EventEmitter';
import { BaseService } from './BaseService';
import { ApiService, asObject, asNumber } from './ApiService';

export class ViewportService extends BaseService {
  private apiService: ApiService;

  constructor(emitter: EventEmitter, serverUrl: string, apiService: ApiService) {
    super(emitter, serverUrl);
    this.apiService = apiService;
  }

  async pick(x: number, y: number): Promise<Record<string, unknown>[]> {
    try {
      Logger.debug(`🎯 Picking at viewport position (${x}, ${y})...`);
      const response = await this.apiService.callApi('ApiRenderEngine', 'pick', null, {
        position: { x, y },
      });

      const intersections = response?.intersections;
      if (!Array.isArray(intersections) || intersections.length === 0) {
        Logger.debug('🎯 Pick: No intersections found');
        return [];
      }

      Logger.debug(`🎯 Pick: Found ${intersections.length} intersection(s)`);
      Logger.debug('🎯 Pick result:', intersections);
      return intersections as Record<string, unknown>[];
    } catch (error) {
      Logger.error(
        '❌ Failed to pick at viewport position:',
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
        Logger.debug(`✅ White point picked at (${x}, ${y}):`, wp);
        return wp;
      } else {
        Logger.warn('⚠️ No white point returned from pick');
        return null;
      }
    } catch (error) {
      Logger.error(
        '❌ Failed to pick white point:',
        error instanceof Error ? error.message : String(error)
      );
      throw error;
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
      Logger.debug(`🎯 Scene pick at (${x}, ${y}):`, response);
      return response;
    } catch (error) {
      Logger.error(
        '❌ Failed to pick scene info:',
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }
}
