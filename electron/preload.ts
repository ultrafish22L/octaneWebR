/**
 * Electron Preload Script
 *
 * Exposes environment information to the renderer process via contextBridge.
 * The renderer can check window.electronAPI to detect Electron environment
 * and adjust behavior (e.g., server URL, DX shared surface availability).
 */

import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  /** True when running inside Electron */
  isElectron: true,

  /** Platform identifier */
  platform: process.platform,

  /** Whether the native DX shared surface addon is available */
  hasNativeAddon: false, // Stub — will be true once native addon is built and loaded

  /** Node.js version available in Electron */
  nodeVersion: process.versions.node,

  /** Electron version */
  electronVersion: process.versions.electron,
});
