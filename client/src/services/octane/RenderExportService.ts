/**
 * Render Export Service - Render saving and export
 * Handles saving renders, grabbing for clipboard, and exporting passes
 */

import { Logger } from '../../utils/Logger';
import { EventEmitter } from '../../utils/EventEmitter';
import { BaseService } from './BaseService';
import { ApiService, asBool, asObject, asString } from './ApiService';

/** Maps format strings to Octane ImageSaveFormat enum values (octaneenums.proto:846-854) */
const FORMAT_MAP: Record<string, number> = { PNG: 0, EXR: 3, TIFF: 4, JPG: 6 };

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
        await this.releaseRenderResult();
      }
    }
  }

  /**
   * Download the current render as a PNG via the browser.
   * Uses grabRenderResult to get the full-resolution image buffer from Octane,
   * paints it onto an OffscreenCanvas, converts to PNG blob, and triggers download.
   * Works regardless of whether Octane is local or remote.
   */
  async downloadRender(filename: string = 'octane-render'): Promise<boolean> {
    let grabbed = false;
    try {
      const response = await this.apiService.callApi('ApiRenderEngine', 'grabRenderResult', {});
      grabbed = true;

      const renderImagesObj = asObject(response?.renderImages);
      const dataArr = renderImagesObj?.data;
      if (!response?.result || !Array.isArray(dataArr) || dataArr.length === 0) {
        Logger.error('No render images available for download');
        this.emitUserError('No render available to download');
        return false;
      }

      const renderImage = asObject(dataArr[0]);
      const width = Number(renderImage?.sizeX || 0);
      const height = Number(renderImage?.sizeY || 0);
      const bufferObj = asObject(renderImage?.buffer);
      const base64Data = asString(bufferObj?.data, '');

      if (!base64Data || width === 0 || height === 0) {
        Logger.error('Invalid render image data', { width, height, hasData: !!base64Data });
        this.emitUserError('Invalid render image data');
        return false;
      }

      Logger.debug(`Render image: ${width}x${height}, buffer length: ${base64Data.length}`);

      // Decode base64 RGBA buffer
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Paint onto OffscreenCanvas
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        Logger.error('Failed to get OffscreenCanvas 2D context');
        this.emitUserError('Browser does not support OffscreenCanvas');
        return false;
      }

      const expectedSize = width * height * 4;
      if (bytes.length !== expectedSize) {
        Logger.error(`Buffer size mismatch: got ${bytes.length}, expected ${expectedSize}`);
        this.emitUserError('Render data corrupted');
        return false;
      }

      const imageData = new ImageData(new Uint8ClampedArray(bytes.buffer), width, height);
      ctx.putImageData(imageData, 0, 0);

      // Convert to PNG blob and trigger browser download
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Delay revoke to let download start
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      Logger.info(`Render downloaded: ${filename}.png (${width}x${height})`);
      return true;
    } catch (error) {
      Logger.error(
        'Error downloading render:',
        error instanceof Error ? error.message : String(error)
      );
      this.emitUserError('Failed to download render');
      return false;
    } finally {
      if (grabbed) {
        await this.releaseRenderResult();
      }
    }
  }

  private async releaseRenderResult(): Promise<void> {
    await this.apiService
      .callApi('ApiRenderEngine', 'releaseRenderResult', {})
      .catch(e =>
        Logger.error('Failed to release render result:', e instanceof Error ? e.message : String(e))
      );
  }

  /**
   * Export render passes by saving each pass individually via saveImage1.
   * Appends the pass name (e.g. _beauty) and extension to the base path.
   * @param basePath Directory + filename stem without extension (e.g. "C:\renders\scene-2026")
   * @param format Image format
   */
  async exportRenderPasses(
    basePath: string,
    format: 'PNG' | 'JPG' | 'EXR' | 'TIFF' = 'PNG'
  ): Promise<boolean> {
    // RenderPassId enum values → short names (octaneenums.proto)
    // For now, export beauty pass. Additional passes from onNewImage can be added here.
    const passes: { id: number; name: string }[] = [{ id: 0, name: 'beauty' }];

    const ext = '.' + format.toLowerCase();
    let allSuccess = true;

    for (const pass of passes) {
      const fullPath = `${basePath}_${pass.name}${ext}`;
      const success = await this.saveRender(fullPath, format, pass.id);
      if (!success) allSuccess = false;
    }

    if (allSuccess) {
      Logger.debug(`Render passes exported: ${basePath}`);
    }

    return allSuccess;
  }
}
