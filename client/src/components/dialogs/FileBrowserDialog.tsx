/**
 * FileBrowserDialog - File browser dialog for selecting files/directories.
 * Displays a navigable directory listing with breadcrumbs.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOctane } from '../../hooks/useOctane';
import type { FileEntry } from '../../services/octane/FileChooserService';

export type BrowseMode = 'open' | 'save' | 'directory';

export interface FileBrowserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  mode: BrowseMode;
  title: string;
  filePatterns?: string; // e.g. "*.orbx;*.ocs"
  initialPath?: string;
  defaultFilename?: string; // for save mode
  onPathChange?: (path: string) => void; // notify parent of directory changes
  extraContent?: React.ReactNode; // optional extra UI (e.g. format dropdown)
}

/** Format bytes to human-readable string */
function formatSize(bytes: number): string {
  if (bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

/** Parse file patterns like "*.orbx;*.ocs" into lowercase extensions */
function parsePatterns(patterns?: string): string[] | null {
  if (!patterns) return null;
  const exts = patterns
    .split(';')
    .map(p => p.trim().replace('*', '').toLowerCase())
    .filter(Boolean);
  return exts.length > 0 ? exts : null;
}

/** Detect path separator from a path string */
function pathSep(p: string): string {
  return p.includes('/') ? '/' : '\\';
}

/** Join a parent path and child name with the correct separator */
function joinPath(parent: string, child: string): string {
  if (!parent) return child;
  const sep = pathSep(parent);
  return parent.replace(/[\\/]$/, '') + sep + child;
}

/** Split a path into breadcrumb segments */
function pathSegments(p: string): { label: string; path: string }[] {
  if (!p) return [];
  const sep = pathSep(p);
  const parts = p.split(sep).filter(Boolean);
  const segments: { label: string; path: string }[] = [];
  let accumulated = '';
  for (const part of parts) {
    if (!accumulated) {
      // First part: drive letter (C:) on Windows, or empty prefix on Unix
      accumulated = sep === '/' ? sep + part : part + sep;
      segments.push({ label: part, path: accumulated });
    } else {
      accumulated += part;
      segments.push({ label: part, path: accumulated });
      accumulated += sep;
    }
  }
  return segments;
}

export function FileBrowserDialog({
  isOpen,
  onClose,
  onSelect,
  mode,
  title,
  filePatterns,
  initialPath,
  defaultFilename,
  onPathChange,
  extraContent,
}: FileBrowserDialogProps) {
  const { client } = useOctane();
  const [currentPath, setCurrentPath] = useState(initialPath || '');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [filename, setFilename] = useState(defaultFilename || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const extensions = parsePatterns(filePatterns);

  const loadDirectory = useCallback(
    async (dirPath: string) => {
      setLoading(true);
      setError('');
      setSelectedEntry(null);
      const listing = await client.listDirectory(dirPath);
      if (listing) {
        setCurrentPath(listing.path);
        setParentPath(listing.parent);
        onPathChange?.(listing.path);
        let filtered = listing.entries;
        // Apply extension filter to files (directories always shown)
        if (extensions && mode !== 'directory') {
          filtered = filtered.filter(
            e => e.isDirectory || extensions.some(ext => e.extension === ext)
          );
        }
        setEntries(filtered);
      } else {
        setError(`Cannot read directory: ${dirPath}`);
        setEntries([]);
      }
      setLoading(false);
    },
    [client, extensions, mode, onPathChange]
  );

  // Focus dialog and load initial directory on open
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
      // Fetch on mount — legitimate cascading render for async data loading
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadDirectory(initialPath || '');
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigateTo = useCallback(
    (dirPath: string) => {
      loadDirectory(dirPath);
    },
    [loadDirectory]
  );

  const handleEntryClick = useCallback((entry: FileEntry) => {
    if (entry.isDirectory) {
      setSelectedEntry(entry.name);
    } else {
      setSelectedEntry(entry.name);
      setFilename(entry.name);
    }
  }, []);

  const handleEntryDoubleClick = useCallback(
    (entry: FileEntry) => {
      if (entry.isDirectory) {
        // Drive roots (C:\) and Unix root (/) are already full paths
        const isRoot = /^[A-Z]:\\$/i.test(entry.name) || entry.name === '/';
        const newPath = isRoot ? entry.name : joinPath(currentPath, entry.name);
        navigateTo(newPath);
      } else {
        onSelect(joinPath(currentPath, entry.name));
      }
    },
    [currentPath, navigateTo, onSelect]
  );

  const handleConfirm = useCallback(() => {
    if (mode === 'directory') {
      onSelect(currentPath);
      return;
    }
    if (!filename.trim()) return;
    onSelect(joinPath(currentPath, filename.trim()));
  }, [mode, currentPath, filename, onSelect]);

  const handleUp = useCallback(() => {
    if (parentPath !== null) {
      navigateTo(parentPath);
    }
  }, [parentPath, navigateTo]);

  if (!isOpen) return null;

  const breadcrumbs = pathSegments(currentPath);

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
        className="modal-dialog file-browser-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={e => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Enter' && filename.trim()) handleConfirm();
        }}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Breadcrumb + navigation */}
        <div className="file-browser-breadcrumb">
          <button
            className="file-browser-nav-btn"
            onClick={handleUp}
            title="Up one level"
            disabled={parentPath === null}
          >
            &uarr;
          </button>
          <button
            className="file-browser-nav-btn"
            onClick={() => loadDirectory(currentPath)}
            title="Refresh"
          >
            &#8635;
          </button>
          <span
            className="file-browser-breadcrumb-segment"
            onClick={() => navigateTo('')}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && navigateTo('')}
          >
            Root
          </span>
          {breadcrumbs.map((seg, i) => (
            <span key={seg.path}>
              <span className="file-browser-breadcrumb-separator">&rsaquo;</span>
              <span
                className={`file-browser-breadcrumb-segment${i === breadcrumbs.length - 1 ? ' active' : ''}`}
                onClick={() => i < breadcrumbs.length - 1 && navigateTo(seg.path)}
                role="button"
                tabIndex={0}
                onKeyDown={e =>
                  e.key === 'Enter' && i < breadcrumbs.length - 1 && navigateTo(seg.path)
                }
              >
                {seg.label}
              </span>
            </span>
          ))}
        </div>

        {/* File listing */}
        <div className="file-browser-list">
          {loading && <div className="file-browser-loading">Loading...</div>}
          {error && <div className="file-browser-error">{error}</div>}
          {!loading && !error && entries.length === 0 && (
            <div className="file-browser-empty">Empty directory</div>
          )}
          {!loading &&
            entries.map(entry => (
              <div
                key={entry.name}
                className={`file-browser-entry${selectedEntry === entry.name ? ' selected' : ''}`}
                onClick={() => handleEntryClick(entry)}
                onDoubleClick={() => handleEntryDoubleClick(entry)}
                role="option"
                aria-selected={selectedEntry === entry.name}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleEntryDoubleClick(entry);
                }}
              >
                <span className="file-browser-entry-icon">
                  {entry.isDirectory ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}
                </span>
                <span className="file-browser-entry-name">{entry.name}</span>
                <span className="file-browser-entry-size">{formatSize(entry.size)}</span>
              </div>
            ))}
        </div>

        {extraContent}

        {/* Filename input (for open/save, not directory mode) */}
        {mode !== 'directory' && (
          <div className="file-browser-filename-row">
            <label htmlFor="file-browser-filename">
              {mode === 'save' ? 'Save as:' : 'File name:'}
            </label>
            <input
              type="text"
              id="file-browser-filename"
              className="form-control"
              value={filename}
              onChange={e => setFilename(e.target.value)}
              placeholder="Enter filename"
              autoComplete="off"
              name="file-browser-filename"
            />
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={mode !== 'directory' && !filename.trim()}
          >
            {mode === 'save' ? 'Save' : mode === 'directory' ? 'Select Folder' : 'Open'}
          </button>
        </div>
      </div>
    </div>
  );
}
