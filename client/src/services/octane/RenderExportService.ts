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
        Logger.debug(`Render saved successfully: ${filePath}`);
      } else {
        Logger.error(`Failed to save render: ${filePath}`);
        this.emitUserError('Failed to save render');
      }

      return success;
    } catch (error) {
      Logger.error('Error saving render:', error instanceof Error ? error.message : String(error));
      this.emitUserError('Failed to save render');
      return false;
    }
  }

  async grabRenderForClipboard(): Promise<string | null> {
    let grabbed = false;
    try {
      const response = await this.apiService.callApi('ApiRenderEngine', 'grabRenderResult', {});
      grabbed = true;

      const renderImagesObj = asObject(response?.renderImages);
      const dataArr = renderImagesObj?.data;
      if (!response?.result || !Array.isArray(dataArr) || dataArr.length === 0) {
        Logger.error('No render images available');
        this.emitUserError('No render available to copy');
        return null;
      }

      const renderImage = asObject(dataArr[0]);
      const bufferObj = asObject(renderImage?.buffer);

      if (!bufferObj?.data) {
        Logger.error('No image buffer data');
        return null;
      }

      return asString(bufferObj.data, '');
    } catch (error) {
      Logger.error(
        'Error grabbing render for clipboard:',
        error instanceof Error ? error.message : String(error)
      );
      this.emitUserError('Failed to copy render to clipboard');
      return null;
    } finally {
      if (grabbed) {
        await this.apiService
          .callApi('ApiRenderEngine', 'releaseRenderResult', {})
          .catch(e =>
            Logger.error(
              'Failed to release render result:',
              e instanceof Error ? e.message : String(e)
            )
          );
      }
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
        Logger.debug(`Render passes exported successfully to: ${outputDirectory}`);
      } else {
        Logger.error(`Failed to export render passes to: ${outputDirectory}`);
        this.emitUserError('Failed to export render passes');
      }

      return success;
    } catch (error) {
      Logger.error(
        'Error exporting render passes:',
        error instanceof Error ? error.message : String(error)
      );
      this.emitUserError('Failed to export render passes');
      return false;
    }
  }
}
