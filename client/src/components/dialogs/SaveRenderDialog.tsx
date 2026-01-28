/**
 * SaveRenderDialog.tsx - Modal dialog for saving renders with format options
 * Based on Octane SE Manual - The Render Viewport > Save Render button
 */

import { Logger } from '../../utils/Logger';
import { useState, useEffect } from 'react';
import { useOctane } from '../../hooks/useOctane';

interface SaveRenderDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImageFormat = 'PNG' | 'JPG' | 'EXR' | 'TIFF';

export function SaveRenderDialog({ isOpen, onClose }: SaveRenderDialogProps) {
  const { client, connected } = useOctane();
  const [format, setFormat] = useState<ImageFormat>('PNG');
  const [filename, setFilename] = useState('render');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Generate default filename with timestamp
  useEffect(() => {
    if (isOpen) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      setFilename(`octane-render-${timestamp}`);
      setErrorMessage('');
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!connected) {
      setErrorMessage('Not connected to Octane');
      return;
    }

    if (!filename.trim()) {
      setErrorMessage('Please enter a filename');
      return;
    }

    setSaving(true);
    setErrorMessage('');

    try {
      // Get file extension for format
      const ext = format.toLowerCase();
      const fullPath = `${filename}.${ext}`;
      
      Logger.debug(`💾 Saving render as ${format}: ${fullPath}`);
      
      // Call Octane API to save render
      const success = await client.saveRender(fullPath, format, 0);
      
      if (success) {
        Logger.debug('✅ Render saved successfully');
        onClose();
      } else {
        setErrorMessage('Failed to save render. Check console for details.');
      }
    } catch (error: any) {
      Logger.error('❌ Error saving render:', error);
      setErrorMessage(error.message || 'Unknown error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog save-render-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Save Render</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="filename">Filename:</label>
            <input
              type="text"
              id="filename"
              className="form-control"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="Enter filename"
              disabled={saving}
                                      autoComplete="off"
                          name="form-control-0"
            />
          </div>

          <div className="form-group">
            <label htmlFor="format">Format:</label>
            <select
              id="format"
              className="form-control"
              value={format}
              onChange={(e) => setFormat(e.target.value as ImageFormat)}
              disabled={saving}
                                      name="form-control-1"
            >
              <option value="PNG">PNG (Lossless, Alpha support)</option>
              <option value="JPG">JPG (Smaller file size)</option>
              <option value="EXR">EXR (HDR, 32-bit float)</option>
              <option value="TIFF">TIFF (High quality)</option>
            </select>
          </div>

          <div className="form-info">
            <p>💡 <strong>Tip:</strong> PNG and JPG are good for web/screen use. EXR preserves HDR data for compositing.</p>
          </div>

          {errorMessage && (
            <div className="error-message">
              ⚠️ {errorMessage}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !connected}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
