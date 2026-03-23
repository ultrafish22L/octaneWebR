/**
 * Renderer Abstraction Types
 *
 * Defines interfaces for pluggable viewport renderers:
 * - canvas2d: Current default (works in any browser)
 * - shared-surface: DX shared surface (Electron + Windows + native addon)
 *
 * The shared-surface renderer is a future optimization path that enables
 * GPU-to-GPU texture sharing between Octane and the Electron viewport,
 * eliminating the CPU-bound serialize/deserialize pipeline.
 */

// ============================================================================
// SHARED SURFACE TYPES
// ============================================================================

/** Describes a shared DXGI surface handle */
export interface SharedSurfaceDescriptor {
  /** DXGI shared handle (HANDLE as number — safe for JS since handles fit in 32 bits) */
  handle: number;
  /** Texture width in pixels */
  width: number;
  /** Texture height in pixels */
  height: number;
  /**
   * DXGI_FORMAT enum value
   * Common: 87 = DXGI_FORMAT_B8G8R8A8_UNORM, 28 = DXGI_FORMAT_R8G8B8A8_UNORM
   */
  format: number;
  /** Whether the surface is currently mapped and readable */
  isMapped: boolean;
}

/** Lifecycle status of the shared surface renderer */
export type SharedSurfaceStatus =
  | { state: 'unavailable'; reason: string }
  | { state: 'initializing' }
  | { state: 'active'; surface: SharedSurfaceDescriptor }
  | { state: 'error'; error: string };

// ============================================================================
// RENDERER INTERFACE
// ============================================================================

/** Backend type identifier */
export type RendererBackend = 'canvas2d' | 'shared-surface';

/** Preferred renderer selection */
export type RendererPreference = RendererBackend | 'auto';

/** Result of renderer auto-detection */
export interface RendererSelection {
  /** Which renderer backend is active */
  activeRenderer: RendererBackend;
  /** Human-readable reason for the selection */
  reason: string;
}

// ============================================================================
// NATIVE ADDON INTERFACE
// ============================================================================

/**
 * Interface for the native DX shared surface addon (node-addon-api).
 * This addon runs in the Electron main process and provides GPU texture access.
 *
 * Future implementation will:
 * 1. Open a DXGI shared handle from Octane's render output
 * 2. Map the texture to a CPU-readable buffer (or use EGL interop for zero-copy)
 * 3. Provide the buffer to the renderer process for display
 */
export interface DXSharedSurfaceAddon {
  /** Check if DX11 is available on this system */
  isAvailable(): boolean;

  /** Open a DXGI shared handle and return surface descriptor */
  openSharedSurface(handle: number): SharedSurfaceDescriptor;

  /** Map the texture to a CPU-readable ArrayBuffer */
  mapSurface(handle: number): ArrayBuffer;

  /** Unmap a previously mapped texture */
  unmapSurface(handle: number): void;

  /** Close the shared handle and release resources */
  closeSurface(handle: number): void;
}

// ============================================================================
// DXGI FORMAT CONSTANTS (subset)
// ============================================================================

export const DXGI_FORMAT = {
  UNKNOWN: 0,
  R8G8B8A8_UNORM: 28,
  R8G8B8A8_UNORM_SRGB: 29,
  B8G8R8A8_UNORM: 87,
  B8G8R8A8_UNORM_SRGB: 91,
  R32G32B32A32_FLOAT: 2, // HDR
  R16G16B16A16_FLOAT: 10, // Half-float HDR
} as const;
