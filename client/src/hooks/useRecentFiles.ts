/**
 * useRecentFiles Hook
 * React hook for managing recent files list using localStorage
 */

import { Logger } from '../utils/Logger';
import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'octaneWebR.recentFiles';
const MAX_RECENT_FILES = 10;

export interface RecentFile {
  path: string;
  name: string;
  timestamp: number;
}

export function useRecentFiles() {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  /**
   * Load recent files from localStorage on mount
   */
  useEffect(() => {
    const loadRecentFiles = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const files = JSON.parse(stored) as RecentFile[];
          setRecentFiles(files);
        }
      } catch (error) {
        Logger.error('Failed to load recent files:', error);
        setRecentFiles([]);
      }
    };

    loadRecentFiles();
  }, []);

  /**
   * Save recent files to localStorage
   */
  const saveToStorage = useCallback((files: RecentFile[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
      setRecentFiles(files);
    } catch (error) {
      Logger.error('Failed to save recent files:', error);
    }
  }, []);

  /**
   * Add a file to recent files list
   */
  const addRecentFile = useCallback((path: string, name?: string) => {
    const fileName = name || path.split(/[\\\/]/).pop() || path;
    const newFile: RecentFile = {
      path,
      name: fileName,
      timestamp: Date.now(),
    };

    setRecentFiles(currentFiles => {
      // Remove if already exists (to move to top)
      const filtered = currentFiles.filter(f => f.path !== path);

      // Add to beginning
      const updated = [newFile, ...filtered];

      // Keep only MAX_RECENT_FILES
      const trimmed = updated.slice(0, MAX_RECENT_FILES);

      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch (error) {
        Logger.error('Failed to save recent files:', error);
      }

      return trimmed;
    });
  }, []);

  /**
   * Remove a file from recent files list
   */
  const removeRecentFile = useCallback(
    (path: string) => {
      setRecentFiles(currentFiles => {
        const updated = currentFiles.filter(f => f.path !== path);
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage]
  );

  /**
   * Clear all recent files
   */
  const clearRecentFiles = useCallback(() => {
    saveToStorage([]);
  }, [saveToStorage]);

  /**
   * Get recent files as simple string array (for compatibility)
   */
  const getRecentFilePaths = useCallback((): string[] => {
    return recentFiles.map(f => f.path);
  }, [recentFiles]);

  return {
    recentFiles,
    addRecentFile,
    removeRecentFile,
    clearRecentFiles,
    getRecentFilePaths,
  };
}
