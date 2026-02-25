/**
 * Render Export Service - Render saving and export
 * Handles saving renders, grabbing for clipboard, and exporting passes
 */

import { Logger } from '../../utils/Logger';
import { EventEmitter } from '../../utils/EventEmitter';
import { BaseService } from './BaseService';
import { ApiService, asBool, asObject, asString } from './ApiService';

/** Maps format strings to Octane imageSaveFormat enum values */
const FORMAT_MAP: Record<string, number> = { PNG: 0, JPG: 1, EXR: 2, TIFF: 3 };

export class RenderExportService extends BaseService {
  private apiService: ApiService;

  constructor(emitter: EventEmitter, serverUrl: string, apiService: ApiService) {
    super(emitter, serverUrl);
    this.apiService = apiService;
  }

  async saveRender(
    filePath: string,
    format: 'PNG' | 'JPG' | 'EXR' | 'TIFF' = 'PNG',
    renderPassId: number = 0
  ): Promise<boolean> {
    try {
      const imageSaveFormat = FORMAT_MAP[format];

      const response = await this.apiService.callApi('ApiRenderEngine', 'saveImage1', null, {
        renderPassId,
        fullPath: filePath,
        imageSaveFormat,
        colorSpace: 1, // NAMED_COLOR_SPACE_SRGB = 1
        premultipliedAlphaType: 0, // PREMULTIPLIED_ALPHA_TYPE_STRAIGHT = 0
        exrCompressionType: 4, // EXR_COMPRESSION_TYPE_ZIP = 4
        exrCompressionLevel: 4.5,
        asynchronous: false,
      });

      const success = asBool(response?.result, false);

      if (success) {
        Logger.debug(`✅ Render saved successfully: ${filePath}`);
      } else {
        Logger.error(`❌ Failed to save render: ${filePath}`);
      }

      return success;
    } catch (error) {
      Logger.error(
        '❌ Error saving render:',
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  async grabRenderForClipboard(): Promise<string | null> {
    try {
      const response = await this.apiService.callApi('ApiRenderEngine', 'grabRenderResult', {});

      const renderImagesObj = asObject(response?.renderImages);
      const dataArr = renderImagesObj?.data;
      if (!response?.result || !Array.isArray(dataArr) || dataArr.length === 0) {
        Logger.error('❌ No render images available');
        return null;
      }

      const renderImage = asObject(dataArr[0]);
      const bufferObj = asObject(renderImage?.buffer);

      if (!bufferObj?.data) {
        Logger.error('❌ No image buffer data');
        return null;
      }

      const base64Data = asString(bufferObj.data, '');

      await this.apiService.callApi('ApiRenderEngine', 'releaseRenderResult', {});

      return base64Data;
    } catch (error) {
      Logger.error(
        '❌ Error grabbing render for clipboard:',
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  async exportRenderPasses(
    outputDirectory: string,
    filenamePrefix: string = 'render',
    format: 'PNG' | 'JPG' | 'EXR' | 'TIFF' = 'PNG'
  ): Promise<boolean> {
    try {
      const imageSaveFormat = FORMAT_MAP[format];

      const response = await this.apiService.callApi('ApiRenderEngine', 'saveRenderPasses1', null, {
        outputDirectory,
        filenamePrefix,
        imageSaveFormat,
        colorSpace: 1, // NAMED_COLOR_SPACE_SRGB = 1
        premultipliedAlphaType: 0, // PREMULTIPLIED_ALPHA_TYPE_STRAIGHT = 0
        exrCompressionType: 4, // EXR_COMPRESSION_TYPE_ZIP = 4
        exrCompressionLevel: 4.5,
        asynchronous: false,
      });

      const success = asBool(response?.result, false);

      if (success) {
        Logger.debug(`✅ Render passes exported successfully to: ${outputDirectory}`);
      } else {
        Logger.error(`❌ Failed to export render passes to: ${outputDirectory}`);
      }

      return success;
    } catch (error) {
      Logger.error(
        '❌ Error exporting render passes:',
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }
}
