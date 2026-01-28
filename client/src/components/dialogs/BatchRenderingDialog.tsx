/**
 * BatchRenderingDialog Component
 * Batch rendering automation dialog for rendering animation sequences
 * Matches Octane SE: Script > Batch Rendering...
 */

import { Logger } from '../../utils/Logger';
import React, { useState } from 'react';

interface BatchRenderingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function BatchRenderingDialog({ isOpen, onClose }: BatchRenderingDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState('PNG 8bit sRGB');
  const [colorSpace, setColorSpace] = useState('sRGB');
  const [frameRate, setFrameRate] = useState(24);
  const [startFrame, setStartFrame] = useState(1);
  const [endFrame, setEndFrame] = useState(100);
  const [subFrame, setSubFrame] = useState(1);
  const [fileNumbering, setFileNumbering] = useState(1);
  const [overrideSamples, setOverrideSamples] = useState(false);
  const [maxSamples, setMaxSamples] = useState(1000);
  const [filenameTemplate, setFilenameTemplate] = useState('%n_%f_%p.%e');
  const [outputFolder, setOutputFolder] = useState('');
  const [skipExisting, setSkipExisting] = useState(false);
  const [saveAllPasses, setSaveAllPasses] = useState(false);
  const [saveDenoisedMain, setSaveDenoisedMain] = useState(false);
  const [saveLayeredEXR, setSaveLayeredEXR] = useState(false);
  const [premultipliedAlpha, setPremultipliedAlpha] = useState(false);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelectOutputFolder = () => {
    // TODO: Implement file dialog for folder selection
    Logger.debug('Select output folder dialog');
  };

  const handleStartRender = () => {
    Logger.debug('Starting batch render with settings:', {
      format: selectedFormat,
      frameRange: [startFrame, endFrame],
      filenameTemplate,
      outputFolder
    });
    // TODO: Implement actual batch rendering via Octane API
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-rendering-title"
      tabIndex={-1}
    >
      <div className="batch-rendering-dialog">
        <div className="modal-header">
          <h2 id="batch-rendering-title">Batch Rendering</h2>
          <button
            className="modal-close-button"
            onClick={onClose}
            aria-label="Close batch rendering"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Render Target Selection */}
          <div className="form-section">
            <h3>Render Targets</h3>
            <div className="form-field">
              <label>Select render targets to batch:</label>
              <select 
                multiple 
                size={4} 
                className="render-target-select"
                name="render-target-select-0"
                autoComplete="off"
              >
                <option value="RenderTarget_1">RenderTarget_1</option>
                <option value="RenderTarget_2">RenderTarget_2</option>
                <option value="RenderTarget_3">RenderTarget_3</option>
              </select>
              <p className="field-hint">
                Hold Ctrl to select multiple render targets. Targets are detected automatically from scene.
              </p>
            </div>
          </div>

          {/* Output Settings */}
          <div className="form-section">
            <h3>Output Settings</h3>
            <div className="form-row">
              <div className="form-field">
                <label>Format:</label>
                <select
                  value={selectedFormat}
                  onChange={e => setSelectedFormat(e.target.value)}
                                              name="select-1"
                >
                  <option>PNG 8bit sRGB</option>
                  <option>PNG 16bit Linear</option>
                  <option>EXR Half Float</option>
                  <option>EXR Full Float</option>
                  <option>TIFF 8bit</option>
                  <option>TIFF 16bit</option>
                  <option>JPEG 95%</option>
                </select>
              </div>
              <div className="form-field">
                <label>Color Space:</label>
                <select
                  value={colorSpace}
                  onChange={e => setColorSpace(e.target.value)}
                                              name="select-2"
                >
                  <option>sRGB</option>
                  <option>Linear sRGB</option>
                  <option>ACES</option>
                  <option>ACEScg</option>
                  <option>OCIO</option>
                </select>
              </div>
            </div>
          </div>

          {/* Frame Range */}
          <div className="form-section">
            <h3>Frame Range</h3>
            <div className="form-row">
              <div className="form-field">
                <label>Frame Rate:</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={frameRate}
                  onChange={e => setFrameRate(parseInt(e.target.value))}
                                              autoComplete="off"
                              name="number-3"
                />
              </div>
              <div className="form-field">
                <label>Start Frame:</label>
                <input
                  type="number"
                  min="0"
                  value={startFrame}
                  onChange={e => setStartFrame(parseInt(e.target.value))}
                                              autoComplete="off"
                              name="number-4"
                />
              </div>
              <div className="form-field">
                <label>End Frame:</label>
                <input
                  type="number"
                  min="0"
                  value={endFrame}
                  onChange={e => setEndFrame(parseInt(e.target.value))}
                                              autoComplete="off"
                              name="number-5"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Sub Frame:</label>
                <input
                  type="number"
                  min="1"
                  value={subFrame}
                  onChange={e => setSubFrame(parseInt(e.target.value))}
                                              autoComplete="off"
                              name="number-6"
                />
              </div>
              <div className="form-field">
                <label>File Numbering Start:</label>
                <input
                  type="number"
                  min="0"
                  value={fileNumbering}
                  onChange={e => setFileNumbering(parseInt(e.target.value))}
                                              autoComplete="off"
                              name="number-7"
                />
              </div>
            </div>
          </div>

          {/* Render Quality */}
          <div className="form-section">
            <h3>Render Quality</h3>
            <div className="form-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={overrideSamples}
                  onChange={e => setOverrideSamples(e.target.checked)}
                                              autoComplete="off"
                              name="checkbox-8"
                />
                Override samples per pixel
              </label>
              {overrideSamples && (
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={maxSamples}
                  onChange={e => setMaxSamples(parseInt(e.target.value))}
                  style={{ marginLeft: '20px', width: '100px' }}
                                              autoComplete="off"
                              name="number-9"
                />
              )}
            </div>
          </div>

          {/* Output File Settings */}
          <div className="form-section">
            <h3>Output Files</h3>
            <div className="form-field">
              <label>Filename Template:</label>
              <input
                type="text"
                value={filenameTemplate}
                onChange={e => setFilenameTemplate(e.target.value)}
                style={{ fontFamily: 'monospace' }}
                                          autoComplete="off"
                            name="text-10"
              />
              <p className="field-hint">
                Variables: %i=index, %n=name, %e=extension, %t=timestamp, %f=frame, %p=pass
              </p>
            </div>
            <div className="form-field">
              <label>Output Folder:</label>
              <div className="folder-select">
                <input
                  type="text"
                  value={outputFolder}
                  onChange={e => setOutputFolder(e.target.value)}
                  placeholder="/path/to/output/folder"
                                              autoComplete="off"
                              name="text-11"
                />
                <button
                  className="button-secondary"
                  onClick={handleSelectOutputFolder}
                >
                  Browse...
                </button>
              </div>
              <p className="field-hint">
                Leave blank to test render without saving files
              </p>
            </div>
          </div>

          {/* Advanced Options */}
          <div className="form-section">
            <h3>Advanced Options</h3>
            <div className="form-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={skipExisting}
                  onChange={e => setSkipExisting(e.target.checked)}
                                              autoComplete="off"
                              name="checkbox-12"
                />
                Skip already existing files
              </label>
            </div>
            <div className="form-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={saveAllPasses}
                  onChange={e => setSaveAllPasses(e.target.checked)}
                                              autoComplete="off"
                              name="checkbox-13"
                />
                Save all enabled passes
              </label>
            </div>
            <div className="form-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={saveDenoisedMain}
                  onChange={e => setSaveDenoisedMain(e.target.checked)}
                                              autoComplete="off"
                              name="checkbox-14"
                />
                Save denoised main pass if available
              </label>
            </div>
            {selectedFormat.includes('EXR') && (
              <>
                <div className="form-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={saveLayeredEXR}
                      onChange={e => setSaveLayeredEXR(e.target.checked)}
                                                      autoComplete="off"
                                  name="checkbox-15"
                    />
                    Save layered EXR
                  </label>
                </div>
                <div className="form-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={premultipliedAlpha}
                      onChange={e => setPremultipliedAlpha(e.target.checked)}
                                                      autoComplete="off"
                                  name="checkbox-16"
                    />
                    Premultiplied alpha
                  </label>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button-primary" onClick={handleStartRender}>
            Start Batch Render
          </button>
        </div>
      </div>
    </div>
  );
}

export const BatchRenderingDialogMemoized = React.memo(BatchRenderingDialog);
export { BatchRenderingDialogMemoized as BatchRenderingDialog };
