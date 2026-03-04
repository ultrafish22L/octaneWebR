/**
 * useFileDialog Hook
 * React hook for native browser file dialogs (open/save)
 */

import { useCallback, useEffect, useRef } from 'react';

export interface FileDialogOptions {
  accept?: string;
  multiple?: boolean;
  directory?: boolean;
}

export interface SaveFileOptions {
  filename: string;
  data: string | Blob;
  mimeType?: string;
}

export function useFileDialog() {
  // Track the active input element and resolve function so we can clean up on unmount
  const activeInputRef = useRef<HTMLInputElement | null>(null);
  const activeResolveRef = useRef<((value: FileList | null) => void) | null>(null);
  // Track pending blob URL revoke timer for saveFile cleanup
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveBlobUrlRef = useRef<string | null>(null);

  // Clean up on unmount: remove orphaned input, settle pending Promise, revoke blob URLs
  useEffect(() => {
    return () => {
      if (activeInputRef.current) {
        if (document.body.contains(activeInputRef.current)) {
          document.body.removeChild(activeInputRef.current);
        }
        activeInputRef.current = null;
      }
      if (activeResolveRef.current) {
        activeResolveRef.current(null);
        activeResolveRef.current = null;
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (saveBlobUrlRef.current) URL.revokeObjectURL(saveBlobUrlRef.current);
    };
  }, []);

  /**
   * Show native file open dialog
   */
  const openFileDialog = useCallback(
    async (options: FileDialogOptions = {}): Promise<FileList | null> => {
      const { accept = '*/*', multiple = false, directory = false } = options;

      return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.multiple = multiple;

        if (directory) {
          input.setAttribute('webkitdirectory', 'true');
        }

        // Append to body (required for some browsers)
        input.style.display = 'none';
        document.body.appendChild(input);

        // Track for cleanup on unmount
        activeInputRef.current = input;
        activeResolveRef.current = resolve;

        const cleanup = () => {
          activeInputRef.current = null;
          activeResolveRef.current = null;
          if (document.body.contains(input)) {
            document.body.removeChild(input);
          }
        };

        input.onchange = () => {
          const files = input.files;
          cleanup();
          resolve(files && files.length > 0 ? files : null);
        };

        // Handle cancel
        input.oncancel = () => {
          cleanup();
          resolve(null);
        };

        // Trigger dialog
        input.click();
      });
    },
    []
  );

  /**
   * Save file using browser download
   */
  const saveFile = useCallback(async (options: SaveFileOptions): Promise<void> => {
    const { filename, data, mimeType = 'application/octet-stream' } = options;

    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Delay revoke to ensure browser starts the download (async on some browsers)
    saveBlobUrlRef.current = url;
    saveTimerRef.current = setTimeout(() => {
      URL.revokeObjectURL(url);
      saveTimerRef.current = null;
      saveBlobUrlRef.current = null;
    }, 1000);
  }, []);

  /**
   * Read file as text
   */
  const readFileAsText = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }, []);

  /**
   * Read file as ArrayBuffer
   */
  const readFileAsArrayBuffer = useCallback(async (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }, []);

  /**
   * Read file as Data URL
   */
  const readFileAsDataURL = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }, []);

  return {
    openFileDialog,
    saveFile,
    readFileAsText,
    readFileAsArrayBuffer,
    readFileAsDataURL,
  };
}
