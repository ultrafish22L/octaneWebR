/**
 * PreferencesDialog Component
 * Application preferences dialog with tabbed interface
 * Matches Octane SE: File > Preferences (Ctrl+,)
 */

import { useState } from 'react';

interface PreferencesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type PreferencesTab = 'application' | 'shortcuts' | 'devices';

export function PreferencesDialog({ isOpen, onClose }: PreferencesDialogProps) {
  const [activeTab, setActiveTab] = useState<PreferencesTab>('application');

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

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="preferences-title"
      tabIndex={-1}
    >
      <div className="preferences-dialog">
        <div className="preferences-header">
          <h2 id="preferences-title">Preferences</h2>
          <button
            className="preferences-close-button"
            onClick={onClose}
            aria-label="Close preferences"
          >
            ✕
          </button>
        </div>

        <div className="preferences-content">
          {/* Tab Navigation */}
          <div className="preferences-tabs">
            <button
              className={`preferences-tab ${activeTab === 'application' ? 'active' : ''}`}
              onClick={() => setActiveTab('application')}
            >
              Application
            </button>
            <button
              className={`preferences-tab ${activeTab === 'shortcuts' ? 'active' : ''}`}
              onClick={() => setActiveTab('shortcuts')}
            >
              Shortcuts
            </button>
            <button
              className={`preferences-tab ${activeTab === 'devices' ? 'active' : ''}`}
              onClick={() => setActiveTab('devices')}
            >
              Devices
            </button>
          </div>

          {/* Tab Content */}
          <div className="preferences-panel">
            {activeTab === 'application' && <ApplicationTab />}
            {activeTab === 'shortcuts' && <ShortcutsTab />}
            {activeTab === 'devices' && <DevicesTab />}
          </div>
        </div>

        <div className="preferences-footer">
          <button className="button-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ApplicationTab() {
  return (
    <div className="preferences-tab-content">
      <h3>Application Settings</h3>
      
      <div className="preference-section">
        <h4>Statistics</h4>
        <label className="preference-checkbox">
          <input type="checkbox" defaultChecked />
          <span>Enable anonymous usage statistics</span>
        </label>
        <p className="preference-description">
          Send anonymous statistics to help improve OctaneRender. Includes session duration,
          render settings, geometry size, and GPU count. No personal information is collected.
        </p>
      </div>

      <div className="preference-section">
        <h4>Performance</h4>
        <label className="preference-field">
          <span>Max CPU cores for AI training:</span>
          <input type="number" min="1" max="32" defaultValue="8"                         autoComplete="off"
                        name="preference-description-0"
          />
        </label>
        <p className="preference-description">
          Limit the number of CPU cores used for AI scene training. Leave empty to use all available cores.
        </p>
      </div>

      <div className="preference-section">
        <h4>File Caching</h4>
        <label className="preference-field">
          <span>Cache size limit (GB):</span>
          <input type="number" min="1" max="1000" defaultValue="50" />
        </label>
        <p className="preference-description">
          Maximum disk space used for caching textures and other resources.
        </p>
      </div>

      <div className="preference-section">
        <h4>Developer Options</h4>
        <label className="preference-checkbox">
          <input type="checkbox"                         autoComplete="off"
                        name="preference-description-1"
          />
          <span>Enable developer mode</span>
        </label>
        <label className="preference-field">
          <span>OSL include directories (one per line):</span>
          <textarea
            rows={4}
            placeholder="~/octane/osl&#10;/usr/local/octane/includes"
            style={{ fontFamily: 'monospace', fontSize: '12px' }}
                                  name="textarea-2"
          />
        </label>
        <p className="preference-description">
          Specify paths to OSL include directories for script compilation. Use tilde (~) for home directory.
        </p>
      </div>
    </div>
  );
}

function ShortcutsTab() {
  const shortcuts = [
    { category: 'File Operations', items: [
      { action: 'New Scene', shortcut: 'Ctrl+N' },
      { action: 'Open Scene', shortcut: 'Ctrl+O' },
      { action: 'Save Scene', shortcut: 'Ctrl+S' },
      { action: 'Save As', shortcut: 'Ctrl+Shift+S' },
      { action: 'Preferences', shortcut: 'Ctrl+,' }
    ]},
    { category: 'Edit Operations', items: [
      { action: 'Undo', shortcut: 'Ctrl+Z' },
      { action: 'Redo', shortcut: 'Ctrl+Y' },
      { action: 'Cut', shortcut: 'Ctrl+X' },
      { action: 'Copy', shortcut: 'Ctrl+C' },
      { action: 'Paste', shortcut: 'Ctrl+V' },
      { action: 'Delete', shortcut: 'Del' },
      { action: 'Select All', shortcut: 'Ctrl+A' }
    ]},
    { category: 'Node Graph', items: [
      { action: 'Search Nodes', shortcut: 'Ctrl+F' }
    ]},
    { category: 'View', items: [
      { action: 'Refresh Scene', shortcut: 'F5' },
      { action: 'Fullscreen', shortcut: 'F11' }
    ]},
    { category: 'Help', items: [
      { action: 'Documentation', shortcut: 'F1' }
    ]}
  ];

  return (
    <div className="preferences-tab-content">
      <h3>Keyboard Shortcuts</h3>
      <p className="preference-description">
        View all available keyboard shortcuts. Custom shortcut configuration coming soon.
      </p>

      <div className="shortcuts-list">
        {shortcuts.map(category => (
          <div key={category.category} className="shortcut-category">
            <h4>{category.category}</h4>
            <table className="shortcuts-table">
              <tbody>
                {category.items.map(item => (
                  <tr key={item.action}>
                    <td className="shortcut-action">{item.action}</td>
                    <td className="shortcut-key">{item.shortcut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

function DevicesTab() {
  return (
    <div className="preferences-tab-content">
      <h3>GPU Devices</h3>
      <p className="preference-description">
        GPU device information and rendering preferences. Connect to Octane to view available devices.
      </p>

      <div className="preference-section">
        <h4>Available Devices</h4>
        <div className="devices-placeholder">
          <p>🔌 Connect to Octane LiveLink to view GPU devices</p>
          <p className="text-muted">Device information will appear here when connected</p>
        </div>
      </div>

      <div className="preference-section">
        <h4>Rendering Options</h4>
        <label className="preference-checkbox">
          <input type="checkbox" defaultChecked />
          <span>Use all available GPUs for rendering</span>
        </label>
        <label className="preference-checkbox">
          <input type="checkbox"                         autoComplete="off"
                        name="preference-checkbox-3"
          />
          <span>Enable GPU viewport acceleration</span>
        </label>
      </div>

      <div className="preference-section">
        <h4>Out of Core Settings</h4>
        <label className="preference-checkbox">
          <input type="checkbox" />
          <span>Enable out-of-core geometry</span>
        </label>
        <p className="preference-description">
          Allow geometry that exceeds GPU memory to be streamed from system RAM or disk.
        </p>
        <label className="preference-field">
          <span>Out-of-core cache size (GB):</span>
          <input type="number" min="1" max="500" defaultValue="10"                         autoComplete="off"
                        name="preference-description-4"
          />
        </label>
      </div>
    </div>
  );
}
