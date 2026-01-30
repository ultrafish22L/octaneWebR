/**
 * ExportPassesDialog.tsx - Modal dialog for exporting all render passes
 * Based on Octane SE Manual - The Render Viewport > Export Render Passes button
 */

import { Logger } from '../../utils/Logger';
import { useState, useEffect } from 'react';
import { useOctane } from '../../hooks/useOctane';

interface ExportPassesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImageFormat = 'PNG' | 'JPG' | 'EXR' | 'TIFF';

export function ExportPassesDialog({ isOpen, onClose }: ExportPassesDialogProps) {
  const { client, connected } = useOctane();
  const [format, setFormat] = useState<ImageFormat>('PNG');
  const [outputDirectory, setOutputDirectory] = useState('renders');
  const [filenamePrefix, setFilenamePrefix] = useState('render');
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Generate default prefix with timestamp
  useEffect(() => {
    if (isOpen) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      setFilenamePrefix(`render-${timestamp}`);
      setErrorMessage('');
    }
  }, [isOpen]);

  const handleExport = async () => {
    if (!connected) {
      setErrorMessage('Not connected to Octane');
      return;
    }

    if (!outputDirectory.trim()) {
      setErrorMessage('Please enter an output directory');
      return;
    }

    if (!filenamePrefix.trim()) {
      setErrorMessage('Please enter a filename prefix');
      return;
    }

    setExporting(true);
    setErrorMessage('');

    try {
      Logger.debug(`📤 Exporting render passes to: ${outputDirectory}`);
      Logger.debug(`📄 Filename prefix: ${filenamePrefix}`);
      Logger.debug(`🖼️ Format: ${format}`);

      // Call Octane API to export all passes
      const success = await client.exportRenderPasses(outputDirectory, filenamePrefix, format);

      if (success) {
        Logger.debug('✅ Render passes exported successfully');
        onClose();
      } else {
        setErrorMessage('Failed to export passes. Check console for details.');
      }
    } catch (error: any) {
      Logger.error('❌ Error exporting passes:', error);
      setErrorMessage(error.message || 'Unknown error occurred');
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog export-passes-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Export Render Passes</h2>
          <button className="modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="output-directory">Output Directory:</label>
            <input
              type="text"
              id="output-directory"
              className="form-control"
              value={outputDirectory}
              onChange={e => setOutputDirectory(e.target.value)}
              placeholder="Enter directory path"
              disabled={exporting}
              autoComplete="off"
              name="form-control-0"
            />
            <small className="form-text">Directory where all pass files will be saved</small>
          </div>

          <div className="form-group">
            <label htmlFor="filename-prefix">Filename Prefix:</label>
            <input
              type="text"
              id="filename-prefix"
              className="form-control"
              value={filenamePrefix}
              onChange={e => setFilenamePrefix(e.target.value)}
              placeholder="Enter prefix"
              disabled={exporting}
              autoComplete="off"
              name="form-control-1"
            />
            <small className="form-text">Each pass will be saved as: prefix_passname.ext</small>
          </div>

          <div className="form-group">
            <label htmlFor="format">Format:</label>
            <select
              id="format"
              className="form-control"
              value={format}
              onChange={e => setFormat(e.target.value as ImageFormat)}
              disabled={exporting}
              name="form-control-2"
            >
              <option value="PNG">PNG (Lossless, Alpha support)</option>
              <option value="JPG">JPG (Smaller file size)</option>
              <option value="EXR">EXR (HDR, 32-bit float)</option>
              <option value="TIFF">TIFF (High quality)</option>
            </select>
          </div>

          <div className="form-info">
            <p>
              💡 <strong>Tip:</strong> This will export all enabled render passes (Beauty, Diffuse,
              Specular, etc.) as separate files.
            </p>
            <p>
              📁 Example output:{' '}
              <code>
                {outputDirectory}/{filenamePrefix}_beauty.{format.toLowerCase()}
              </code>
            </p>
          </div>

          {errorMessage && <div className="error-message">⚠️ {errorMessage}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={exporting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={exporting || !connected}
          >
            {exporting ? 'Exporting...' : 'Export All Passes'}
          </button>
        </div>
      </div>
    </div>
  );
}
