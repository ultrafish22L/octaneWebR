/**
 * Keyboard Shortcuts Dialog
 * Displays all available keyboard shortcuts in a modal dialog
 */

import { useEffect } from 'react';

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutSection {
  title: string;
  shortcuts: Array<{
    keys: string;
    description: string;
  }>;
}

const SHORTCUTS: ShortcutSection[] = [
  {
    title: 'File Operations',
    shortcuts: [
      { keys: 'Ctrl+N', description: 'New scene' },
      { keys: 'Ctrl+O', description: 'Open scene' },
      { keys: 'Ctrl+S', description: 'Save scene' },
      { keys: 'Ctrl+Shift+S', description: 'Save scene as' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { keys: 'F5', description: 'Refresh scene' },
      { keys: 'F11', description: 'Toggle fullscreen' },
    ],
  },
  {
    title: 'Help',
    shortcuts: [{ keys: 'F1', description: 'Open documentation' }],
  },
];

export function KeyboardShortcutsDialog({ isOpen, onClose }: KeyboardShortcutsDialogProps) {
  // Close dialog on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog keyboard-shortcuts-dialog" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2>⌨️ Keyboard Shortcuts</h2>
          <button className="close-button" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </header>

        <div className="modal-body">
          {SHORTCUTS.map((section, sectionIdx) => (
            <div key={sectionIdx} className="shortcuts-section">
              <h3>{section.title}</h3>
              <table className="shortcuts-table">
                <tbody>
                  {section.shortcuts.map((shortcut, idx) => (
                    <tr key={idx}>
                      <td className="shortcut-keys">
                        <kbd>{shortcut.keys}</kbd>
                      </td>
                      <td className="shortcut-description">{shortcut.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <footer className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
