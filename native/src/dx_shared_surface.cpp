/**
 * DirectX Shared Surface Native Addon — STUB Implementation
 *
 * This is a stub that compiles and exports the correct N-API interface
 * but does not perform actual DirectX operations. All functions return
 * mock/default values.
 *
 * When fully implemented, this addon will:
 * 1. Create a D3D11 device on the same GPU as Octane
 * 2. Open shared DXGI texture handles from Octane's render output
 * 3. Map textures to CPU-readable staging buffers
 * 4. Provide zero-copy buffer access to the Electron renderer process
 *
 * Build: cd native && npm run build
 * Requires: node-gyp, node-addon-api, Windows SDK (for d3d11.h, dxgi.h)
 */

#include "dx_shared_surface.h"

namespace DXSharedSurface {

/**
 * Check if DirectX 11 is available on this system.
 * STUB: Always returns false.
 *
 * Real implementation would:
 * - Call D3D11CreateDevice() to test DX11 availability
 * - Verify DXGI shared handle support
 * - Check that the GPU matches Octane's GPU
 */
Napi::Boolean IsAvailable(const Napi::CallbackInfo& info) {
  // STUB: DX not implemented yet
  return Napi::Boolean::New(info.Env(), false);
}

/**
 * Open a DXGI shared handle and return a surface descriptor.
 * STUB: Returns a mock descriptor with zeroed fields.
 *
 * Real implementation would:
 * - ID3D11Device::OpenSharedResource(handle, IID_ID3D11Texture2D, &texture)
 * - Query texture description (width, height, format)
 * - Return the descriptor
 *
 * @param handle - DXGI shared handle (uint32)
 * @returns SharedSurfaceDescriptor object
 */
Napi::Object OpenSharedSurface(const Napi::CallbackInfo& info) {
  auto env = info.Env();

  // Validate arguments
  if (info.Length() < 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "Expected shared handle as number argument")
        .ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  uint32_t handle = info[0].As<Napi::Number>().Uint32Value();

  // STUB: Return mock descriptor
  auto result = Napi::Object::New(env);
  result.Set("handle", Napi::Number::New(env, handle));
  result.Set("width", Napi::Number::New(env, 0));
  result.Set("height", Napi::Number::New(env, 0));
  result.Set("format", Napi::Number::New(env, DXGI_FORMAT_B8G8R8A8_UNORM));
  result.Set("isMapped", Napi::Boolean::New(env, false));

  return result;
}

/**
 * Map a shared texture to a CPU-readable buffer.
 * STUB: Returns an empty buffer.
 *
 * Real implementation would:
 * - Create a staging texture (D3D11_USAGE_STAGING)
 * - CopyResource from shared texture to staging texture
 * - Map the staging texture (D3D11_MAP_READ)
 * - Return the mapped data as a Node.js Buffer
 */
Napi::Buffer<uint8_t> MapSurface(const Napi::CallbackInfo& info) {
  auto env = info.Env();

  if (info.Length() < 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "Expected shared handle as number argument")
        .ThrowAsJavaScriptException();
    return Napi::Buffer<uint8_t>::New(env, 0);
  }

  // STUB: Return empty buffer
  return Napi::Buffer<uint8_t>::New(env, 0);
}

/**
 * Unmap a previously mapped texture.
 * STUB: No-op.
 *
 * Real implementation would:
 * - ID3D11DeviceContext::Unmap(stagingTexture, 0)
 */
void UnmapSurface(const Napi::CallbackInfo& info) {
  // STUB: No-op
}

/**
 * Close a shared surface handle and release resources.
 * STUB: No-op.
 *
 * Real implementation would:
 * - Release ID3D11Texture2D reference
 * - Release staging texture if exists
 * - Clean up device context state
 */
void CloseSurface(const Napi::CallbackInfo& info) {
  // STUB: No-op
}

/**
 * Module initialization — register all exported functions.
 */
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("isAvailable",
              Napi::Function::New(env, IsAvailable));
  exports.Set("openSharedSurface",
              Napi::Function::New(env, OpenSharedSurface));
  exports.Set("mapSurface",
              Napi::Function::New(env, MapSurface));
  exports.Set("unmapSurface",
              Napi::Function::New(env, UnmapSurface));
  exports.Set("closeSurface",
              Napi::Function::New(env, CloseSurface));

  return exports;
}

} // namespace DXSharedSurface

NODE_API_MODULE(dx_shared_surface, DXSharedSurface::Init)
