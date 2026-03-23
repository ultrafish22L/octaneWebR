/**
 * DirectX Shared Surface Native Addon — Header
 *
 * Defines the DX types and function signatures for the native addon.
 * When fully implemented, this will include:
 * - ID3D11Device / ID3D11DeviceContext management
 * - IDXGIResource shared handle operations
 * - Texture mapping / staging buffer management
 */

#ifndef DX_SHARED_SURFACE_H
#define DX_SHARED_SURFACE_H

#include <napi.h>

#ifdef _WIN32
// Forward declarations — actual DX headers included in .cpp when implemented
// #include <d3d11.h>
// #include <dxgi.h>
#endif

namespace DXSharedSurface {

/**
 * DXGI format constants (subset matching renderers/types.ts)
 */
enum DXGIFormat {
  DXGI_FORMAT_UNKNOWN = 0,
  DXGI_FORMAT_R8G8B8A8_UNORM = 28,
  DXGI_FORMAT_B8G8R8A8_UNORM = 87,
  DXGI_FORMAT_R32G32B32A32_FLOAT = 2,
  DXGI_FORMAT_R16G16B16A16_FLOAT = 10,
};

/**
 * Surface descriptor matching the TypeScript SharedSurfaceDescriptor
 */
struct SurfaceDescriptor {
  uint32_t handle;
  uint32_t width;
  uint32_t height;
  uint32_t format;
  bool isMapped;
};

// N-API function declarations
Napi::Boolean IsAvailable(const Napi::CallbackInfo& info);
Napi::Object OpenSharedSurface(const Napi::CallbackInfo& info);
Napi::Buffer<uint8_t> MapSurface(const Napi::CallbackInfo& info);
void UnmapSurface(const Napi::CallbackInfo& info);
void CloseSurface(const Napi::CallbackInfo& info);
Napi::Object Init(Napi::Env env, Napi::Object exports);

} // namespace DXSharedSurface

#endif // DX_SHARED_SURFACE_H
