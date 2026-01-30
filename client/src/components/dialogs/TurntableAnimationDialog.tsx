/**
 * TurntableAnimationDialog Component
 * Script for creating turntable animation sequences
 * Matches Octane SE: Script > Turntable Animation...
 * Renders images that are pieced together to form turntable animation
 */

import { Logger } from '../../utils/Logger';
import { useState, useEffect } from 'react';

interface TurntableAnimationDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TurntableAnimationDialog({ isOpen, onClose }: TurntableAnimationDialogProps) {
  const [duration, setDuration] = useState(5);
  const [frameRate, setFrameRate] = useState(24);
  const [frames, setFrames] = useState(120);
  const [shutterSpeed, setShutterSpeed] = useState(100);
  const [samplesPerPixel, setSamplesPerPixel] = useState(1000);
  const [outputPath, setOutputPath] = useState('');
  const [startFileNumbering, setStartFileNumbering] = useState(1);
  const [skipExisting, setSkipExisting] = useState(false);

  // Synchronize frames with duration and framerate
  useEffect(() => {
    const calculatedFrames = Math.round(duration * frameRate);
    setFrames(calculatedFrames);
  }, [duration, frameRate]);

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

  const handleSelectOutputPath = () => {
    // TODO: Implement folder selection dialog
    Logger.debug('Select output folder dialog');
  };

  const handleStartAnimation = () => {
    Logger.debug('Starting turntable animation with settings:', {
      duration,
      frameRate,
      frames,
      shutterSpeed,
      samplesPerPixel,
      outputPath,
      startFileNumbering,
      skipExisting,
    });
    // TODO: Implement turntable animation rendering via Octane API
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="turntable-animation-title"
      tabIndex={-1}
    >
      <div className="turntable-animation-dialog">
        <div className="modal-header">
          <h2 id="turntable-animation-title">Turntable Animation</h2>
          <button
            className="modal-close-button"
            onClick={onClose}
            aria-label="Close turntable animation"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="dialog-description">
            Render images for a turntable animation. Images are saved to the specified output
            directory and can be pieced together to form a rotating turntable animation.
          </p>

          {/* Animation Settings */}
          <div className="form-section">
            <h3>Animation Settings</h3>
            <div className="form-row">
              <div className="form-field">
                <label>Duration:</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={duration}
                  onChange={e => setDuration(parseFloat(e.target.value))}
                  autoComplete="off"
                  name="number-0"
                />
                <span className="field-unit">sec</span>
              </div>
              <div className="form-field">
                <label>Framerate:</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={frameRate}
                  onChange={e => setFrameRate(parseInt(e.target.value))}
                  autoComplete="off"
                  name="number-1"
                />
                <span className="field-unit">fps</span>
              </div>
            </div>
            <div className="form-field">
              <label>Frames:</label>
              <input
                type="number"
                min="1"
                value={frames}
                onChange={e => {
                  const newFrames = parseInt(e.target.value);
                  setFrames(newFrames);
                  setDuration(newFrames / frameRate);
                }}
                autoComplete="off"
                name="number-2"
              />
              <p className="field-hint">
                Duration and Frames re-adjust when you change either value
              </p>
            </div>
          </div>

          {/* Motion Blur Settings */}
          <div className="form-section">
            <h3>Motion Blur</h3>
            <div className="form-field">
              <label>Shutter Speed:</label>
              <input
                type="number"
                min="0"
                step="1"
                value={shutterSpeed}
                onChange={e => setShutterSpeed(parseFloat(e.target.value))}
                autoComplete="off"
                name="number-3"
              />
              <span className="field-unit">%</span>
              <p className="field-hint">
                Shutter time percentage relative to duration of a single frame. Controls how much
                time the shutter stays open. Can be set above 100% for extended motion blur.
              </p>
            </div>
          </div>

          {/* Render Quality */}
          <div className="form-section">
            <h3>Render Quality</h3>
            <div className="form-field">
              <label>Samples/px:</label>
              <input
                type="number"
                min="1"
                max="100000"
                value={samplesPerPixel}
                onChange={e => setSamplesPerPixel(parseInt(e.target.value))}
                autoComplete="off"
                name="number-4"
              />
              <p className="field-hint">Number of kernel samples per pixel</p>
            </div>
          </div>

          {/* Output Settings */}
          <div className="form-section">
            <h3>Output Settings</h3>
            <div className="form-field">
              <label>Output:</label>
              <div className="folder-select">
                <input
                  type="text"
                  value={outputPath}
                  onChange={e => setOutputPath(e.target.value)}
                  placeholder="/path/to/output/folder"
                  autoComplete="off"
                  name="text-5"
                />
                <button className="button-secondary" onClick={handleSelectOutputPath}>
                  Browse...
                </button>
              </div>
              <p className="field-hint">Path to save rendered images</p>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Start File Numbering:</label>
                <input
                  type="number"
                  min="0"
                  value={startFileNumbering}
                  onChange={e => setStartFileNumbering(parseInt(e.target.value))}
                  autoComplete="off"
                  name="number-6"
                />
              </div>
            </div>
            <div className="form-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={skipExisting}
                  onChange={e => setSkipExisting(e.target.checked)}
                  autoComplete="off"
                  name="checkbox-7"
                />
                Skip Existing Image Files
              </label>
              <p className="field-hint">Prevent overwriting existing image files</p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button-primary" onClick={handleStartAnimation}>
            Start Animation
          </button>
        </div>
      </div>
    </div>
  );
}
