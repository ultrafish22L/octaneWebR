/**
 * Project Service - Project management operations
 *
 * Encapsulates ApiProjectManager calls for saving and exporting the current scene.
 */

import { Logger } from '../../utils/Logger';
import { EventEmitter } from '../../utils/EventEmitter';
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';

/**
 * Settings for saveProjectAsReferencePackage (ORBX export).
 * Percentages are expressed as fractions 0–1, not 0–100.
 */
export interface ReferencePackageSettings {
  mergeScatterInstances: boolean;
  /** Fraction 0–1 (UI shows 0–100%) */
  includeInstancePercentage: number;
  /** Fraction 0–1 (UI shows 0–100%) */
  ignoreSmallObjectPercentage: number;
  exportAnimation: boolean;
  animationFramerate: number;
  enableCustomAnimationTimespan: boolean;
  customAnimationTimespan?: {
    start: { value: number };
    end: { value: number };
  };
  exportNestedReferenceGraphs: boolean;
}

export class ProjectService extends BaseService {
  private apiService: ApiService;

  constructor(emitter: EventEmitter, serverUrl: string, apiService: ApiService) {
    super(emitter, serverUrl);
    this.apiService = apiService;
  }

  /**
   * Save the current scene as an ORBX reference package.
   * @returns true on success, false if Octane reports failure
   */
  async saveProjectAsReferencePackage(
    path: string,
    settings: ReferencePackageSettings
  ): Promise<boolean> {
    try {
      Logger.debug('Saving reference package:', path);

      const response = await this.apiService.callApi(
        'ApiProjectManager',
        'saveProjectAsReferencePackage',
        null,
        {
          path,
          referencePackageSettings: settings,
        }
      );

      const success = !!(response && response.result);
      if (success) {
        Logger.debug('Reference package saved:', path);
      } else {
        Logger.error('saveProjectAsReferencePackage returned failure');
      }
      return success;
    } catch (error) {
      Logger.error(
        'Failed to save reference package:',
        error instanceof Error ? error.message : error
      );
      return false;
    }
  }
}
