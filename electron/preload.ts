/**
 * Electron Preload Script
 *
 * Exposes environment information to the renderer process via contextBridge.
 * The renderer can check window.electronAPI to detect Electron environment
 * and adjust behavior (e.g., server URL, DX shared surface availability).
 */

import { contextBridge, ipcRenderer } from 'electron';

// Query addon status from main process (sync IPC — runs before window loads)
const addonAvailable: boolean = ipcRenderer.sendSync('get-dx-addon-status') === true;

contextBridge.exposeInMainWorld('electronAPI', {
  /** True when running inside Electron */
  isElectron: true,

  /** Platform identifier */
  platform: process.platform,

  /** Whether the native DX shared surface addon is loaded and D3D11 is available */
  hasNativeAddon: addonAvailable,

  /** Node.js version available in Electron */
  nodeVersion: process.versions.node,

  /** Electron version */
  electronVersion: process.versions.electron,
});
