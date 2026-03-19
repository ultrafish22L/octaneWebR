/**
 * useRenderOutput Hook
 * Manages render save/export/clipboard operations and file browser dialogs.
 * Extracted from App.tsx to reduce state concentration.
 */

import { useState, useCallback, useRef, useEffect, type RefObject } from 'react';
import { OctaneClient } from '../services/OctaneClient';
import { CallbackRenderViewportHandle } from '../components/CallbackRenderViewport';
import { useFileBrowser } from './useFileBrowser';
import { useStatusActions } from '../contexts/StatusMessageContext';
import { Logger } from '../utils/Logger';
import type { FileBrowserDialogProps } from '../components/dialogs/FileBrowserDialog';

export function useRenderOutput(
  client: OctaneClient,
  viewportRef: RefObject<CallbackRenderViewportHandle | null>
) {
  const { setTemporaryStatus, setStatusMessage } = useStatusActions();
  const [exportFormat, setExportFormat] = useState<'PNG' | 'JPG' | 'EXR' | 'TIFF'>('PNG');
  const exportFormatRef = useRef(exportFormat);
  useEffect(() => {
    exportFormatRef.current = exportFormat;
  }, [exportFormat]);
  const renderPathRef = useRef<string>('');

  // Save render file browser
  const { browse: browseSaveRender, dialogProps: saveRenderDialogProps } = useFileBrowser(
    useCallback(
      async (path: string | null) => {
        if (!path) return;
        const ext = path.split('.').pop()?.toLowerCase() || '';
        const formatMap: Record<string, 'PNG' | 'JPG' | 'EXR' | 'TIFF'> = {
          png: 'PNG',
          jpg: 'JPG',
          jpeg: 'JPG',
          exr: 'EXR',
          tiff: 'TIFF',
          tif: 'TIFF',
        };
        const format = formatMap[ext] || 'PNG';
        Logger.debug(`Saving render: ${path} (format: ${format})`);
        try {
          setStatusMessage(`Saving render to ${path}...`);
          await client.saveRender(path, format, 0);
          setStatusMessage(`Render saved: ${path}`);
        } catch (error) {
          Logger.error('Failed to save render:', error);
          setStatusMessage(
            `Failed to save render: ${error instanceof Error ? error.message : error}`
          );
        }
      },
      [client, setStatusMessage]
    ),
    renderPathRef
  );

  // Export passes file browser
  const { browse: browseExportPasses, dialogProps: exportPassesDialogProps } = useFileBrowser(
    useCallback(
      async (path: string | null) => {
        if (!path) return;
        const dotIdx = path.lastIndexOf('.');
        const basePath = dotIdx > 0 ? path.slice(0, dotIdx) : path;
        Logger.debug(`Exporting render passes: ${basePath} (format: ${exportFormatRef.current})`);
        try {
          setStatusMessage(`Exporting render passes to ${basePath}...`);
          await client.exportRenderPasses(basePath, exportFormatRef.current);
          setStatusMessage(`Render passes exported: ${basePath}`);
        } catch (error) {
          Logger.error('Failed to export render passes:', error);
          setStatusMessage(
            `Failed to export passes: ${error instanceof Error ? error.message : error}`
          );
        }
      },
      [client, setStatusMessage]
    ),
    renderPathRef
  );

  const handleCopyToClipboard = useCallback(async () => {
    if (!viewportRef.current) {
      Logger.warn('Viewport not available for clipboard copy');
      return;
    }

    try {
      await viewportRef.current.copyToClipboard();
      setTemporaryStatus('Render copied to clipboard', 2000);
    } catch (error) {
      Logger.error('Failed to copy to clipboard:', error);
      setTemporaryStatus('Failed to copy render to clipboard', 3000);
    }
  }, [viewportRef, setTemporaryStatus]);

  const handleSaveRender = useCallback(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    browseSaveRender({
      mode: 'save',
      title: 'Save Render',
      filePatterns: '*.png;*.jpg;*.exr;*.tiff',
      defaultFilename: `octane-render-${timestamp}.png`,
    });
  }, [browseSaveRender]);

  const handleExportPasses = useCallback(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    browseExportPasses({
      mode: 'save',
      title: 'Export Render Passes',
      filePatterns: '*.png;*.jpg;*.exr;*.tiff',
      defaultFilename: `render-passes-${timestamp}`,
      extraContent: (
        <div className="form-group" style={{ padding: '0 12px' }}>
          <label htmlFor="export-format">Format:</label>
          <select
            id="export-format"
            className="form-control"
            value={exportFormatRef.current}
            onChange={e => setExportFormat(e.target.value as 'PNG' | 'JPG' | 'EXR' | 'TIFF')}
            name="export-format"
          >
            <option value="PNG">PNG</option>
            <option value="JPG">JPG</option>
            <option value="EXR">EXR</option>
            <option value="TIFF">TIFF</option>
          </select>
        </div>
      ),
    });
  }, [browseExportPasses, setExportFormat]);

  return {
    handleCopyToClipboard,
    handleSaveRender,
    handleExportPasses,
    saveRenderDialogProps: saveRenderDialogProps as FileBrowserDialogProps | null,
    exportPassesDialogProps: exportPassesDialogProps as FileBrowserDialogProps | null,
  };
}
