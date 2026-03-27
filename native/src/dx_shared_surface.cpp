/**
 * DirectX Shared Surface Native Addon — D3D11 Implementation
 *
 * Hot path for the dxSS viewport rendering in standalone Electron:
 *   1. initDevice(luid)    — create D3D11 device on Octane's GPU adapter
 *   2. mapSurface(handle)  — open shared texture, DMA to staging, map to CPU buffer
 *   3. closeSurface(handle)— close the duplicated NT handle
 *
 * The staging texture is cached and reused across frames. Only recreated when
 * the render resolution changes.
 *
 * Build: cd native && npm run build
 * Requires: Windows SDK (d3d11.h, dxgi.h), node-addon-api
 */

#include "dx_shared_surface.h"

#ifdef _WIN32
#include <cstring>

// Link against D3D11 and DXGI (binding.gyp also specifies these)
#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "dxgi.lib")
#endif

namespace DXSharedSurface {

#ifdef _WIN32
// Singleton device state
DeviceState g_device;

// Cached availability result
static int s_availableCache = -1; // -1 = not checked, 0 = no, 1 = yes

/**
 * Bytes per pixel for common DXGI formats.
 */
static uint32_t bytesPerPixel(DXGI_FORMAT fmt) {
    switch (fmt) {
        case DXGI_FORMAT_R8G8B8A8_UNORM:
        case DXGI_FORMAT_R8G8B8A8_UNORM_SRGB:
        case DXGI_FORMAT_B8G8R8A8_UNORM:
        case DXGI_FORMAT_B8G8R8A8_UNORM_SRGB:
            return 4;
        case DXGI_FORMAT_R16G16B16A16_FLOAT:
            return 8;
        case DXGI_FORMAT_R32G32B32A32_FLOAT:
            return 16;
        default:
            return 4;
    }
}

/**
 * Ensure the staging texture matches the requested dimensions and format.
 * Creates a new one if needed, reuses the existing one otherwise.
 */
static bool ensureStagingTexture(uint32_t w, uint32_t h, DXGI_FORMAT fmt) {
    if (g_device.staging && g_device.stagingW == w &&
        g_device.stagingH == h && g_device.stagingFmt == fmt) {
        return true; // reuse
    }

    // Release old staging texture
    g_device.staging.Reset();

    D3D11_TEXTURE2D_DESC desc = {};
    desc.Width              = w;
    desc.Height             = h;
    desc.MipLevels          = 1;
    desc.ArraySize          = 1;
    desc.Format             = fmt;
    desc.SampleDesc.Count   = 1;
    desc.SampleDesc.Quality = 0;
    desc.Usage              = D3D11_USAGE_STAGING;
    desc.CPUAccessFlags     = D3D11_CPU_ACCESS_READ;
    desc.BindFlags          = 0;

    HRESULT hr = g_device.device->CreateTexture2D(&desc, nullptr, &g_device.staging);
    if (FAILED(hr)) {
        g_device.stagingW = 0;
        g_device.stagingH = 0;
        return false;
    }

    g_device.stagingW   = w;
    g_device.stagingH   = h;
    g_device.stagingFmt = fmt;
    return true;
}
#endif // _WIN32

// ============================================================================
// N-API Exports
// ============================================================================

/**
 * isAvailable() → boolean
 * Check if D3D11 hardware is available.
 */
Napi::Boolean IsAvailable(const Napi::CallbackInfo& info) {
#ifdef _WIN32
    if (s_availableCache < 0) {
        ComPtr<ID3D11Device> testDevice;
        D3D_FEATURE_LEVEL featureLevel;
        HRESULT hr = D3D11CreateDevice(
            nullptr,                    // default adapter
            D3D_DRIVER_TYPE_HARDWARE,
            nullptr,                    // no software rasterizer
            0,                          // no flags
            nullptr, 0,                 // default feature levels
            D3D11_SDK_VERSION,
            &testDevice,
            &featureLevel,
            nullptr);
        s_availableCache = SUCCEEDED(hr) ? 1 : 0;
    }
    return Napi::Boolean::New(info.Env(), s_availableCache == 1);
#else
    return Napi::Boolean::New(info.Env(), false);
#endif
}

/**
 * initDevice(adapterLuid: number) → void
 * Create a D3D11 device on the adapter matching the given LUID.
 * Must be called once before any shared surface operations.
 */
Napi::Value InitDevice(const Napi::CallbackInfo& info) {
    auto env = info.Env();

#ifdef _WIN32
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "initDevice: expected adapter LUID as number")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uint64_t targetLuid = info[0].As<Napi::Number>().Int64Value();

    // Enumerate adapters and find the one matching the LUID
    ComPtr<IDXGIFactory1> factory;
    HRESULT hr = CreateDXGIFactory1(IID_PPV_ARGS(&factory));
    if (FAILED(hr)) {
        Napi::Error::New(env, "initDevice: CreateDXGIFactory1 failed")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    ComPtr<IDXGIAdapter1> matchedAdapter;
    for (UINT i = 0; ; ++i) {
        ComPtr<IDXGIAdapter1> adapter;
        hr = factory->EnumAdapters1(i, &adapter);
        if (hr == DXGI_ERROR_NOT_FOUND) break;

        DXGI_ADAPTER_DESC1 desc;
        adapter->GetDesc1(&desc);

        // Combine LUID fields the same way Octane does
        uint64_t adapterLuid =
            (static_cast<uint64_t>(desc.AdapterLuid.HighPart) << 32) |
            static_cast<uint64_t>(desc.AdapterLuid.LowPart);

        if (adapterLuid == targetLuid) {
            matchedAdapter = adapter;
            break;
        }
    }

    if (!matchedAdapter) {
        Napi::Error::New(env, "initDevice: no adapter matching LUID")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    // Create D3D11 device on the matched adapter
    D3D_FEATURE_LEVEL featureLevels[] = { D3D_FEATURE_LEVEL_11_1, D3D_FEATURE_LEVEL_11_0 };
    ComPtr<ID3D11Device> baseDevice;
    ComPtr<ID3D11DeviceContext> baseCtx;
    D3D_FEATURE_LEVEL actualLevel;

    hr = D3D11CreateDevice(
        matchedAdapter.Get(),
        D3D_DRIVER_TYPE_UNKNOWN,    // must be UNKNOWN when specifying an adapter
        nullptr,
        D3D11_CREATE_DEVICE_BGRA_SUPPORT,
        featureLevels, 2,
        D3D11_SDK_VERSION,
        &baseDevice,
        &actualLevel,
        &baseCtx);

    if (FAILED(hr)) {
        Napi::Error::New(env, "initDevice: D3D11CreateDevice failed")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    // QI for ID3D11Device1 (needed for OpenSharedResource1)
    hr = baseDevice.As(&g_device.device);
    if (FAILED(hr)) {
        Napi::Error::New(env, "initDevice: QueryInterface ID3D11Device1 failed")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    g_device.device->GetImmediateContext(reinterpret_cast<ID3D11DeviceContext**>(g_device.ctx.GetAddressOf()));
    g_device.initialized = true;

    return env.Undefined();
#else
    Napi::Error::New(env, "initDevice: not supported on this platform")
        .ThrowAsJavaScriptException();
    return env.Undefined();
#endif
}

/**
 * openSharedSurface(handle: number) → { handle, width, height, format, isMapped }
 * Open a DXGI shared handle and return a surface descriptor.
 */
Napi::Object OpenSharedSurface(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    auto result = Napi::Object::New(env);

#ifdef _WIN32
    if (!g_device.initialized) {
        Napi::Error::New(env, "openSharedSurface: device not initialized (call initDevice first)")
            .ThrowAsJavaScriptException();
        return result;
    }

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "openSharedSurface: expected handle as number")
            .ThrowAsJavaScriptException();
        return result;
    }

    uint64_t handleVal = info[0].As<Napi::Number>().Int64Value();
    HANDLE ntHandle = reinterpret_cast<HANDLE>(static_cast<uintptr_t>(handleVal));

    ComPtr<ID3D11Texture2D> sharedTex;
    HRESULT hr = g_device.device->OpenSharedResource1(
        ntHandle, IID_PPV_ARGS(&sharedTex));

    if (FAILED(hr)) {
        Napi::Error::New(env, "openSharedSurface: OpenSharedResource1 failed")
            .ThrowAsJavaScriptException();
        return result;
    }

    D3D11_TEXTURE2D_DESC desc;
    sharedTex->GetDesc(&desc);

    result.Set("handle", Napi::Number::New(env, static_cast<double>(handleVal)));
    result.Set("width",  Napi::Number::New(env, desc.Width));
    result.Set("height", Napi::Number::New(env, desc.Height));
    result.Set("format", Napi::Number::New(env, static_cast<uint32_t>(desc.Format)));
    result.Set("isMapped", Napi::Boolean::New(env, false));
#endif

    return result;
}

/**
 * mapSurface(handle: number) → Buffer
 *
 * HOT PATH — called every frame.
 * Opens the shared texture, acquires the keyed mutex, DMA-copies to staging,
 * releases the mutex, maps staging to CPU, copies to a Node.js Buffer.
 *
 * The staging texture is cached and reused across frames.
 */
Napi::Value MapSurface(const Napi::CallbackInfo& info) {
    auto env = info.Env();

#ifdef _WIN32
    if (!g_device.initialized) {
        Napi::Error::New(env, "mapSurface: device not initialized")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "mapSurface: expected handle as number")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    uint64_t handleVal = info[0].As<Napi::Number>().Int64Value();
    HANDLE ntHandle = reinterpret_cast<HANDLE>(static_cast<uintptr_t>(handleVal));

    // Open the shared texture
    ComPtr<ID3D11Texture2D> sharedTex;
    HRESULT hr = g_device.device->OpenSharedResource1(
        ntHandle, IID_PPV_ARGS(&sharedTex));
    if (FAILED(hr)) {
        Napi::Error::New(env, "mapSurface: OpenSharedResource1 failed")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    // Get texture dimensions
    D3D11_TEXTURE2D_DESC texDesc;
    sharedTex->GetDesc(&texDesc);

    // Acquire keyed mutex (Octane uses key 0)
    ComPtr<IDXGIKeyedMutex> keyedMutex;
    hr = sharedTex.As(&keyedMutex);
    if (FAILED(hr)) {
        Napi::Error::New(env, "mapSurface: texture does not support keyed mutex")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    hr = keyedMutex->AcquireSync(0, 5000); // 5 second timeout
    if (FAILED(hr)) {
        Napi::Error::New(env, "mapSurface: AcquireSync timeout")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    // Ensure staging texture is ready
    if (!ensureStagingTexture(texDesc.Width, texDesc.Height, texDesc.Format)) {
        keyedMutex->ReleaseSync(0);
        Napi::Error::New(env, "mapSurface: failed to create staging texture")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    // GPU DMA copy: shared texture → staging texture
    g_device.ctx->CopyResource(g_device.staging.Get(), sharedTex.Get());

    // Release the mutex immediately after the copy command is queued
    keyedMutex->ReleaseSync(0);

    // Map the staging texture for CPU read
    D3D11_MAPPED_SUBRESOURCE mapped;
    hr = g_device.ctx->Map(g_device.staging.Get(), 0, D3D11_MAP_READ, 0, &mapped);
    if (FAILED(hr)) {
        Napi::Error::New(env, "mapSurface: Map staging texture failed")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    // Calculate buffer size and copy to Node.js Buffer
    uint32_t bpp = bytesPerPixel(texDesc.Format);
    uint32_t rowBytes = texDesc.Width * bpp;
    uint32_t totalBytes = rowBytes * texDesc.Height;

    // Fast path: if mapped row pitch matches expected row bytes, single memcpy
    Napi::Buffer<uint8_t> outBuf = Napi::Buffer<uint8_t>::New(env, totalBytes);
    uint8_t* dst = outBuf.Data();

    if (mapped.RowPitch == rowBytes) {
        // Contiguous — single memcpy (fastest)
        std::memcpy(dst, mapped.pData, totalBytes);
    } else {
        // Pitch differs — copy row by row
        const uint8_t* src = static_cast<const uint8_t*>(mapped.pData);
        for (uint32_t y = 0; y < texDesc.Height; ++y) {
            std::memcpy(dst + y * rowBytes, src + y * mapped.RowPitch, rowBytes);
        }
    }

    // Unmap staging
    g_device.ctx->Unmap(g_device.staging.Get(), 0);

    return outBuf;
#else
    return Napi::Buffer<uint8_t>::New(env, 0);
#endif
}

/**
 * unmapSurface() → void
 * No-op in the copy-to-buffer mode. Staging is unmapped immediately after copy.
 */
void UnmapSurface(const Napi::CallbackInfo&) {
    // No-op — staging is unmapped in mapSurface after memcpy
}

/**
 * closeSurface(handle: number) → void
 * Close a duplicated NT handle. Must be called after mapSurface to prevent handle leaks.
 */
void CloseSurface(const Napi::CallbackInfo& info) {
#ifdef _WIN32
    if (info.Length() >= 1 && info[0].IsNumber()) {
        uint64_t handleVal = info[0].As<Napi::Number>().Int64Value();
        HANDLE ntHandle = reinterpret_cast<HANDLE>(static_cast<uintptr_t>(handleVal));
        if (ntHandle && ntHandle != INVALID_HANDLE_VALUE) {
            CloseHandle(ntHandle);
        }
    }
#endif
}

/**
 * destroyDevice() → void
 * Release the D3D11 device, context, and cached staging texture.
 * Called on shutdown to free GPU resources deterministically.
 */
void DestroyDevice(const Napi::CallbackInfo&) {
#ifdef _WIN32
    g_device.staging.Reset();
    g_device.ctx.Reset();
    g_device.device.Reset();
    g_device.stagingW = 0;
    g_device.stagingH = 0;
    g_device.stagingFmt = DXGI_FORMAT_UNKNOWN;
    g_device.initialized = false;
    s_availableCache = -1;
#endif
}

/**
 * Module initialization — register all exported functions.
 */
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("isAvailable",
                Napi::Function::New(env, IsAvailable));
    exports.Set("initDevice",
                Napi::Function::New(env, InitDevice));
    exports.Set("openSharedSurface",
                Napi::Function::New(env, OpenSharedSurface));
    exports.Set("mapSurface",
                Napi::Function::New(env, MapSurface));
    exports.Set("unmapSurface",
                Napi::Function::New(env, UnmapSurface));
    exports.Set("closeSurface",
                Napi::Function::New(env, CloseSurface));
    exports.Set("destroyDevice",
                Napi::Function::New(env, DestroyDevice));

    return exports;
}

} // namespace DXSharedSurface

static Napi::Object InitModule(Napi::Env env, Napi::Object exports) {
    return DXSharedSurface::Init(env, exports);
}

NODE_API_MODULE(dx_shared_surface, InitModule)
