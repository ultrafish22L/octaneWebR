/**
 * Keyboard Shortcuts Dialog
 * Displays all available keyboard shortcuts in a modal dialog
 */

import { useEffect, useRef } from 'react';

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
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        className="modal-dialog keyboard-shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
        tabIndex={-1}
        onKeyDown={e => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <header className="modal-header">
          <h2>⌨️ Keyboard Shortcuts</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close dialog"></button>
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
