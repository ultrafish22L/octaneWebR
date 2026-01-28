/**
 * Render Export Service - Render saving and export
 * Handles saving renders, grabbing for clipboard, and exporting passes
 */

import { Logger } from '../../utils/Logger';
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';

export class RenderExportService extends BaseService {
  private apiService: ApiService;

  constructor(emitter: any, serverUrl: string, apiService: ApiService) {
    super(emitter, serverUrl);
    this.apiService = apiService;
  }

  async saveRender(
    filePath: string,
    format: 'PNG' | 'JPG' | 'EXR' | 'TIFF' = 'PNG',
    renderPassId: number = 0
  ): Promise<boolean> {
    try {
      const formatMap: Record<string, number> = {
        'PNG': 0,
        'JPG': 1,
        'EXR': 2,
        'TIFF': 3
      };
      
      const imageSaveFormat = formatMap[format];
      
      const response = await this.apiService.callApi('ApiRenderEngine', 'saveImage1', null, {
        renderPassId,
        fullPath: filePath,
        imageSaveFormat,
        colorSpace: 1, // NAMED_COLOR_SPACE_SRGB = 1
        premultipliedAlphaType: 0, // PREMULTIPLIED_ALPHA_TYPE_STRAIGHT = 0
        exrCompressionType: 4, // EXR_COMPRESSION_TYPE_ZIP = 4
        exrCompressionLevel: 4.5,
        asynchronous: false
      });
      
      const success = response?.result ?? false;
      
      if (success) {
        Logger.debug(`✅ Render saved successfully: ${filePath}`);
      } else {
        Logger.error(`❌ Failed to save render: ${filePath}`);
      }
      
      return success;
    } catch (error: any) {
      Logger.error('❌ Error saving render:', error.message);
      return false;
    }
  }

  async grabRenderForClipboard(): Promise<string | null> {
    try {
      const response = await this.apiService.callApi('ApiRenderEngine', 'grabRenderResult', {});
      
      if (!response?.result || !response.renderImages?.data?.length) {
        Logger.error('❌ No render images available');
        return null;
      }
      
      const renderImage = response.renderImages.data[0];
      
      if (!renderImage?.buffer?.data) {
        Logger.error('❌ No image buffer data');
        return null;
      }
      
      const base64Data = renderImage.buffer.data;
      
      await this.apiService.callApi('ApiRenderEngine', 'releaseRenderResult', {});
      
      return base64Data;
    } catch (error: any) {
      Logger.error('❌ Error grabbing render for clipboard:', error.message);
      return null;
    }
  }

  async exportRenderPasses(
    outputDirectory: string,
    filenamePrefix: string = 'render',
    format: 'PNG' | 'JPG' | 'EXR' | 'TIFF' = 'PNG'
  ): Promise<boolean> {
    try {
      const formatMap: Record<string, number> = {
        'PNG': 0,
        'JPG': 1,
        'EXR': 2,
        'TIFF': 3
      };
      
      const imageSaveFormat = formatMap[format];
      
      const response = await this.apiService.callApi('ApiRenderEngine', 'saveRenderPasses1', null, {
        outputDirectory,
        filenamePrefix,
        imageSaveFormat,
        colorSpace: 1, // NAMED_COLOR_SPACE_SRGB = 1
        premultipliedAlphaType: 0, // PREMULTIPLIED_ALPHA_TYPE_STRAIGHT = 0
        exrCompressionType: 4, // EXR_COMPRESSION_TYPE_ZIP = 4
        exrCompressionLevel: 4.5,
        asynchronous: false
      });
      
      const success = response?.result ?? false;
      
      if (success) {
        Logger.debug(`✅ Render passes exported successfully to: ${outputDirectory}`);
      } else {
        Logger.error(`❌ Failed to export render passes to: ${outputDirectory}`);
      }
      
      return success;
    } catch (error: any) {
      Logger.error('❌ Error exporting render passes:', error.message);
      return false;
    }
  }
}
