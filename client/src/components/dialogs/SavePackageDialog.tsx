/**
 * Save Package Dialog Component
 * Dialog for configuring ORBX package export settings
 * Based on: https://docs.otoy.com/standaloneSE/ThePackagerandtheORBXFile.html
 */

import { Logger } from '../../utils/Logger';
import React, { useState } from 'react';
import { useOctane } from '../../hooks/useOctane';

interface SavePackageDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PackageSettings {
  mergeScatterInstances: boolean;
  includeInstancePercentage: number;
  ignoreSmallObjectPercentage: number;
  exportAnimation: boolean;
  animationFramerate: number;
  enableCustomAnimationTimespan: boolean;
  customAnimationStart: number;
  customAnimationEnd: number;
  exportNestedReferenceGraphs: boolean;
}

function SavePackageDialog({ isOpen, onClose }: SavePackageDialogProps) {
  const { client, connected } = useOctane();
  const [filename, setFilename] = useState('scene.orbx');
  const [isProcessing, setIsProcessing] = useState(false);

  const [settings, setSettings] = useState<PackageSettings>({
    mergeScatterInstances: true,
    includeInstancePercentage: 100,
    ignoreSmallObjectPercentage: 0,
    exportAnimation: false,
    animationFramerate: 30,
    enableCustomAnimationTimespan: false,
    customAnimationStart: 0,
    customAnimationEnd: 100,
    exportNestedReferenceGraphs: true,
  });

  const handleSave = async () => {
    if (!connected) {
      alert('Not connected to Octane');
      return;
    }

    if (!filename.trim()) {
      alert('Please enter a filename');
      return;
    }

    setIsProcessing(true);

    try {
      // Prepare reference package settings
      const referencePackageSettings = {
        mergeScatterInstances: settings.mergeScatterInstances,
        includeInstancePercentage: settings.includeInstancePercentage / 100,
        ignoreSmallObjectPercentage: settings.ignoreSmallObjectPercentage / 100,
        exportAnimation: settings.exportAnimation,
        animationFramerate: settings.animationFramerate,
        enableCustomAnimationTimespan: settings.enableCustomAnimationTimespan,
        customAnimationTimespan: settings.enableCustomAnimationTimespan
          ? {
              start: { value: settings.customAnimationStart },
              end: { value: settings.customAnimationEnd },
            }
          : undefined,
        exportNestedReferenceGraphs: settings.exportNestedReferenceGraphs,
      };

      Logger.debug('🎁 Saving package:', filename, referencePackageSettings);

      const response = await client.callApi('ApiProjectManager', 'saveProjectAsReferencePackage', {
        path: filename,
        referencePackageSettings,
      });

      if (response && response.result) {
        Logger.debug('✅ Package saved successfully');
        alert(`Package saved successfully: ${filename}`);
        onClose();
      } else {
        Logger.error('❌ Failed to save package');
        alert('Failed to save package');
      }
    } catch (error) {
      Logger.error('Error saving package:', error);
      alert(`Error saving package: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const updateSetting = <K extends keyof PackageSettings>(key: K, value: PackageSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog save-package-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>💾 Save as Package (ORBX)</h2>
          <button className="dialog-close" onClick={onClose} disabled={isProcessing}>
            ×
          </button>
        </div>

        <div className="dialog-body">
          {/* Filename Section */}
          <div className="dialog-section">
            <h3>Package File</h3>
            <div className="form-group">
              <label htmlFor="filename">Filename:</label>
              <input
                type="text"
                id="filename"
                value={filename}
                onChange={e => setFilename(e.target.value)}
                placeholder="scene.orbx"
                disabled={isProcessing}
                autoComplete="off"
                name="text-0"
              />
              <p className="help-text">
                ORBX packages all scene data, geometry, textures, and materials into a single
                portable file.
              </p>
            </div>
          </div>

          {/* Instance Settings */}
          <div className="dialog-section">
            <h3>Instance Settings</h3>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.mergeScatterInstances}
                  onChange={e => updateSetting('mergeScatterInstances', e.target.checked)}
                  disabled={isProcessing}
                  autoComplete="off"
                  name="checkbox-1"
                />
                Merge scatter instances
              </label>
              <p className="help-text">Combine scattered instances for smaller file size</p>
            </div>

            <div className="form-group">
              <label htmlFor="includeInstancePercentage">Include instance percentage:</label>
              <div className="slider-group">
                <input
                  type="range"
                  id="includeInstancePercentage"
                  min="0"
                  max="100"
                  value={settings.includeInstancePercentage}
                  onChange={e =>
                    updateSetting('includeInstancePercentage', parseFloat(e.target.value))
                  }
                  disabled={isProcessing}
                  autoComplete="off"
                  name="range-2"
                />
                <input
                  type="number"
                  value={settings.includeInstancePercentage}
                  onChange={e =>
                    updateSetting('includeInstancePercentage', parseFloat(e.target.value) || 0)
                  }
                  min="0"
                  max="100"
                  step="1"
                  className="number-input-small"
                  disabled={isProcessing}
                  autoComplete="off"
                  name="number-input-small-3"
                />
                <span>%</span>
              </div>
              <p className="help-text">
                Percentage of instances to include (reduce for faster exports)
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="ignoreSmallObjectPercentage">Ignore small object percentage:</label>
              <div className="slider-group">
                <input
                  type="range"
                  id="ignoreSmallObjectPercentage"
                  min="0"
                  max="100"
                  value={settings.ignoreSmallObjectPercentage}
                  onChange={e =>
                    updateSetting('ignoreSmallObjectPercentage', parseFloat(e.target.value))
                  }
                  disabled={isProcessing}
                  autoComplete="off"
                  name="range-4"
                />
                <input
                  type="number"
                  value={settings.ignoreSmallObjectPercentage}
                  onChange={e =>
                    updateSetting('ignoreSmallObjectPercentage', parseFloat(e.target.value) || 0)
                  }
                  min="0"
                  max="100"
                  step="1"
                  className="number-input-small"
                  disabled={isProcessing}
                  autoComplete="off"
                  name="number-input-small-5"
                />
                <span>%</span>
              </div>
              <p className="help-text">Exclude objects below this size threshold</p>
            </div>
          </div>

          {/* Animation Settings */}
          <div className="dialog-section">
            <h3>Animation Settings</h3>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.exportAnimation}
                  onChange={e => updateSetting('exportAnimation', e.target.checked)}
                  disabled={isProcessing}
                  autoComplete="off"
                  name="checkbox-6"
                />
                Export animation
              </label>
              <p className="help-text">Include animation keyframes in package</p>
            </div>

            {settings.exportAnimation && (
              <>
                <div className="form-group">
                  <label htmlFor="animationFramerate">Animation framerate:</label>
                  <input
                    type="number"
                    id="animationFramerate"
                    value={settings.animationFramerate}
                    onChange={e =>
                      updateSetting('animationFramerate', parseFloat(e.target.value) || 30)
                    }
                    min="1"
                    max="120"
                    step="1"
                    disabled={isProcessing}
                    autoComplete="off"
                    name="number-7"
                  />
                  <span className="unit">fps</span>
                  <p className="help-text">Frames per second for animation</p>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.enableCustomAnimationTimespan}
                      onChange={e =>
                        updateSetting('enableCustomAnimationTimespan', e.target.checked)
                      }
                      disabled={isProcessing}
                      autoComplete="off"
                      name="checkbox-8"
                    />
                    Custom animation timespan
                  </label>
                  <p className="help-text">Export specific frame range instead of full animation</p>
                </div>

                {settings.enableCustomAnimationTimespan && (
                  <div className="form-group range-group">
                    <div className="range-inputs">
                      <div>
                        <label htmlFor="customAnimationStart">Start frame:</label>
                        <input
                          type="number"
                          id="customAnimationStart"
                          value={settings.customAnimationStart}
                          onChange={e =>
                            updateSetting('customAnimationStart', parseFloat(e.target.value) || 0)
                          }
                          disabled={isProcessing}
                          autoComplete="off"
                          name="number-9"
                        />
                      </div>
                      <div>
                        <label htmlFor="customAnimationEnd">End frame:</label>
                        <input
                          type="number"
                          id="customAnimationEnd"
                          value={settings.customAnimationEnd}
                          onChange={e =>
                            updateSetting('customAnimationEnd', parseFloat(e.target.value) || 100)
                          }
                          disabled={isProcessing}
                          autoComplete="off"
                          name="number-10"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Advanced Settings */}
          <div className="dialog-section">
            <h3>Advanced Settings</h3>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.exportNestedReferenceGraphs}
                  onChange={e => updateSetting('exportNestedReferenceGraphs', e.target.checked)}
                  disabled={isProcessing}
                  autoComplete="off"
                  name="checkbox-11"
                />
                Export nested reference graphs
              </label>
              <p className="help-text">Include all nested node graphs in package</p>
            </div>
          </div>

          {/* Info Box */}
          <div className="dialog-info-box">
            <strong>ℹ️ About ORBX Format:</strong>
            <p>
              ORBX is Octane's container format that packages all scene data, geometry, textures,
              and materials into a single portable file. The format is not compressed, so file sizes
              can be large. ORBX is the recommended format for transferring scenes between Octane
              applications and platforms.
            </p>
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={onClose} disabled={isProcessing}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={isProcessing || !filename.trim()}
          >
            {isProcessing ? '⏳ Saving...' : '💾 Save Package'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const SavePackageDialogMemoized = React.memo(SavePackageDialog);
export { SavePackageDialogMemoized as SavePackageDialog };
