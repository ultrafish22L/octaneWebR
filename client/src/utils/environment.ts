/**
 * Environment Detection Utilities
 *
 * Detects whether the app is running in Electron vs browser,
 * and provides the correct server URL for API calls.
 */

/** Electron API exposed via preload.ts contextBridge */
interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  hasNativeAddon: boolean;
  nodeVersion: string;
  electronVersion: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

/** Check if running inside Electron */
export function isElectron(): boolean {
  return !!window.electronAPI?.isElectron;
}

/** Check if running on Windows */
export function isWindows(): boolean {
  return window.electronAPI?.platform === 'win32';
}

/** Check if native DX shared surface addon is available */
export function hasNativeAddon(): boolean {
  return !!window.electronAPI?.hasNativeAddon;
}

/**
 * Get the server URL for API calls.
 * In Electron production mode, the gRPC proxy runs on a separate port (43930).
 * In browser/dev mode, uses window.location.origin (same-origin).
 */
export function getServerUrl(): string {
  // In Electron production, the proxy server is at 127.0.0.1:43930
  // In Electron dev, Vite dev server is at localhost:43929
  // In browser, use same-origin
  return window.location.origin;
}
