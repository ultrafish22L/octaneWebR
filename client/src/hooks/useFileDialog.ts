/**
 * useFileDialog Hook
 * React hook for native browser file dialogs (open/save)
 */

import { useCallback } from 'react';

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
  /**
   * Show native file open dialog
   */
  const openFileDialog = useCallback(async (options: FileDialogOptions = {}): Promise<FileList | null> => {
    const {
      accept = '*/*',
      multiple = false,
      directory = false
    } = options;

    return new Promise((resolve) => {
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

      input.onchange = () => {
        const files = input.files;
        document.body.removeChild(input);
        resolve(files && files.length > 0 ? files : null);
      };

      // Handle cancel
      input.oncancel = () => {
        document.body.removeChild(input);
        resolve(null);
      };

      // Trigger dialog
      input.click();
    });
  }, []);

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

    // Clean up
    URL.revokeObjectURL(url);
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
    readFileAsDataURL
  };
}
