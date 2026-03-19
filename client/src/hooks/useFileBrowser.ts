/**
 * useFileBrowser hook - Opens a file browser dialog and returns the selected path.
 * Manages dialog state so consumers just call browse() and render the dialog.
 */

import type { MutableRefObject, ReactNode } from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import type { BrowseMode, FileBrowserDialogProps } from '../components/dialogs/FileBrowserDialog';

export interface FileBrowseOptions {
  mode: BrowseMode;
  title: string;
  filePatterns?: string;
  initialPath?: string;
  defaultFilename?: string;
  extraContent?: ReactNode;
}

export interface UseFileBrowserReturn {
  /** Trigger file browsing. The dialog opens and the result callback fires. */
  browse: (options: FileBrowseOptions) => void;
  /** Props to spread onto <FileBrowserDialog>. Null when dialog is closed. */
  dialogProps: FileBrowserDialogProps | null;
}

export function useFileBrowser(
  onResult?: (path: string | null) => void,
  externalPathRef?: MutableRefObject<string>
): UseFileBrowserReturn {
  const [dialogProps, setDialogProps] = useState<FileBrowserDialogProps | null>(null);
  const onResultRef = useRef(onResult);
  const internalPathRef = useRef<string>('');
  const lastPathRef = externalPathRef || internalPathRef;

  // Keep ref in sync with latest callback (intentionally no deps — must run every render
  // to avoid stale closures when onResult is an inline function)

  useEffect(() => {
    onResultRef.current = onResult;
  });

  const browse = useCallback(
    (options: FileBrowseOptions) => {
      setDialogProps({
        isOpen: true,
        mode: options.mode,
        title: options.title,
        filePatterns: options.filePatterns,
        initialPath: options.initialPath || lastPathRef.current,
        defaultFilename: options.defaultFilename,
        extraContent: options.extraContent,
        onPathChange: (dir: string) => {
          lastPathRef.current = dir;
        },
        onClose: () => {
          setDialogProps(null);
          onResultRef.current?.(null);
        },
        onSelect: (path: string) => {
          setDialogProps(null);
          onResultRef.current?.(path);
        },
      });
    },
    [lastPathRef]
  );

  return { browse, dialogProps };
}
