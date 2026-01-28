/**
 * DaylightAnimationDialog Component
 * Script for creating daylight-based animation sequences
 * Matches Octane SE: Script > Daylight Animation...
 * Requires Daylight Environment node connected to Render Target
 */

import { Logger } from '../../utils/Logger';
import { useState, useEffect } from 'react';

interface DaylightAnimationDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DaylightAnimationDialog({ isOpen, onClose }: DaylightAnimationDialogProps) {
  const [startHour, setStartHour] = useState(6);
  const [endHour, setEndHour] = useState(18);
  const [duration, setDuration] = useState(10);
  const [frameRate, setFrameRate] = useState(24);
  const [frames, setFrames] = useState(240);
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
    Logger.debug('Starting daylight animation with settings:', {
      startHour,
      endHour,
      duration,
      frameRate,
      frames,
      samplesPerPixel,
      outputPath,
      startFileNumbering,
      skipExisting
    });
    // TODO: Implement daylight animation rendering via Octane API
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="daylight-animation-title"
      tabIndex={-1}
    >
      <div className="daylight-animation-dialog">
        <div className="modal-header">
          <h2 id="daylight-animation-title">Daylight Animation</h2>
          <button
            className="modal-close-button"
            onClick={onClose}
            aria-label="Close daylight animation"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="dialog-description">
            Create a daylight-based animation sequence. Requires a Daylight Environment node
            connected to the Render Target node.
          </p>

          {/* Time Range Settings */}
          <div className="form-section">
            <h3>Time Range</h3>
            <div className="form-row">
              <div className="form-field">
                <label>Start Hour:</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  step="0.5"
                  value={startHour}
                  onChange={e => setStartHour(parseFloat(e.target.value))}
                                              autoComplete="off"
                              name="number-0"
                />
                <span className="field-unit">h</span>
              </div>
              <div className="form-field">
                <label>End Hour:</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  step="0.5"
                  value={endHour}
                  onChange={e => setEndHour(parseFloat(e.target.value))}
                                              autoComplete="off"
                              name="number-1"
                />
                <span className="field-unit">h</span>
              </div>
            </div>
            <p className="field-hint">
              Animation will simulate daylight changes from {startHour}:00 to {endHour}:00
            </p>
          </div>

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
                              name="number-2"
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
                              name="number-3"
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
                            name="number-4"
              />
              <p className="field-hint">
                Total frames calculated from duration and framerate (or enter manually to adjust duration)
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
                            name="number-5"
              />
              <p className="field-hint">
                Number of kernel samples per pixel
              </p>
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
                              name="text-6"
                />
                <button
                  className="button-secondary"
                  onClick={handleSelectOutputPath}
                >
                  Browse...
                </button>
              </div>
              <p className="field-hint">
                Path to render out the animation sequence
              </p>
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
                              name="number-7"
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
                              name="checkbox-8"
                />
                Skip Existing Image Files
              </label>
              <p className="field-hint">
                Prevent overwriting existing image files
              </p>
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
