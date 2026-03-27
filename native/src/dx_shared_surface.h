/**
 * DirectX Shared Surface Native Addon
 *
 * Opens DXGI shared texture handles (NT handles duplicated from octaneServGrpc),
 * copies to a staging texture via GPU DMA, and maps to CPU for Node.js consumption.
 *
 * Used by GrpcProxyServer in the standalone Electron build to bypass protobuf
 * pixel serialization — the dxSS fast path.
 */

#ifndef DX_SHARED_SURFACE_H
#define DX_SHARED_SURFACE_H

#include <napi.h>

#ifdef _WIN32
#include <d3d11_1.h>
#include <dxgi1_2.h>
#include <wrl/client.h>
#endif

namespace DXSharedSurface {

#ifdef _WIN32
using Microsoft::WRL::ComPtr;

/**
 * Per-process D3D11 device state. Created once via initDevice(luid),
 * reused for all subsequent shared surface operations.
 */
struct DeviceState {
    ComPtr<ID3D11Device1>       device;
    ComPtr<ID3D11DeviceContext>  ctx;

    // Cached staging texture — reused across frames, recreated on dimension change.
    ComPtr<ID3D11Texture2D>     staging;
    uint32_t                    stagingW   = 0;
    uint32_t                    stagingH   = 0;
    DXGI_FORMAT                 stagingFmt = DXGI_FORMAT_UNKNOWN;

    bool initialized = false;
};

// Module-level device state (singleton — one D3D11 device per addon instance).
extern DeviceState g_device;
#endif

// N-API exports
Napi::Boolean IsAvailable(const Napi::CallbackInfo& info);
Napi::Value   InitDevice(const Napi::CallbackInfo& info);
Napi::Object  OpenSharedSurface(const Napi::CallbackInfo& info);
Napi::Value   MapSurface(const Napi::CallbackInfo& info);
void          UnmapSurface(const Napi::CallbackInfo& info);
void          CloseSurface(const Napi::CallbackInfo& info);
void          DestroyDevice(const Napi::CallbackInfo& info);
Napi::Object  Init(Napi::Env env, Napi::Object exports);

} // namespace DXSharedSurface

#endif // DX_SHARED_SURFACE_H
