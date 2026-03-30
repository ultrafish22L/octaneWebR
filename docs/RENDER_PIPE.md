# Render Pipeline: Deep Analysis & Optimization

## Pipeline Overview

```
Standard (Vite / Electron dev):
  Octane GPU ──► octaneServGrpc (gRPC) ──► Vite Plugin (WS relay) ──► Browser (Canvas 2D)
     render        protobuf stream          binary WebSocket           RAF + putImageData
     ~100ms           ~5ms                     ~5ms                       ~0.3ms

dxSS (Electron dist — v2.4.5):
  Octane GPU ──► octaneServGrpc ──► GrpcProxyServer ──► Browser (Canvas 2D)
     render      DuplicateHandle    native addon DMA     binary WebSocket
     ~100ms          ~1ms               ~0ms                ~1ms
```

**Current performance** (1024x512, measured):

- Octane render-to-callback: ~125ms (full samples), ~37ms (subsample 2x2 + 1 sample)
- Client paint (decode + set + putImageData): 0.3ms avg, 0.8ms max
- Camera update rate: 30 Hz (33ms interval)
- Frame acceptance during drag: unlimited (throttle disabled v2.4.1)
- Interactive drag FPS: ~27 FPS (with auto-subsample)
- E2E latency: ~150ms at full quality, ~40ms during drag

**Bottleneck**: Octane GPU render time dominates. Client pipeline is essentially free. v2.4.1 drag optimizations (auto-subsample 2x2 + kernel samples=1) reduce render time 3x during interaction.

---

## Stage-by-Stage Analysis

### Stage 1: Octane Render (GPU) — ~100-125ms

Octane path-traces the scene on GPU. At 1024x512, each progressive sample takes ~125ms. This is the hard floor — nothing downstream can make frames arrive faster.

The `onNewImage` callback fires each time a new sample completes. Octane sends the full pixel buffer (width x height x 4 bytes RGBA) via the gRPC callback stream.

**Buffer**: Raw RGBA pixels, 2 MB at 1024x512, 8.3 MB at 1080p.

### Stage 2: gRPC Callback Stream — ~1-5ms

`CallbackStreamManager` (`mcp/src/shared/CallbackStreamManager.ts:149-217`) maintains a bidirectional gRPC stream to `StreamCallbackService.callbackChannel()`. When Octane fires `onNewImage`, the stream delivers a protobuf message containing the pixel buffer.

**Buffer ops**: Protobuf deserialization → JS object with `Uint8Array` pixel reference. One copy (wire → V8 heap).

**Stream deadline**: 60 seconds, auto-reconnects on `DEADLINE_EXCEEDED`.

### Stage 3: Vite WebSocket Relay — ~0.5ms

`vite-plugin-octane-grpc.ts:719-825` relays callbacks to browser WebSocket clients.

**Binary frame format** (same as MCP relay):

```
[4 bytes: headerLen uint32 LE] [JSON header ~500B] [raw pixel bytes]
```

**Backpressure**: `ws.bufferedAmount > 10MB` → drop frame (line 728).

**Buffer ops**: `Buffer.concat([lenBuf, headerBuf, pixelBuf])` — smart concat, pixel buffer passed by reference. Header JSON encoded (~500 bytes copy). No pixel copy at this stage.

### Stage 4: Browser WebSocket Reception — ~1ms

`ConnectionService.ts:128-160` receives binary frames as `ArrayBuffer`.

**Zero-copy path**:

- `new DataView(event.data)` — lightweight view
- `new Uint8Array(event.data, 4, headerLen)` — zero-copy slice for header
- `new Uint8Array(event.data, 4 + headerLen)` — zero-copy slice for pixels
- `JSON.parse(TextDecoder.decode(headerBytes))` — only header decoded (~500 bytes)

Pixel bytes are never copied at this stage — just a typed array view of the network buffer.

### Stage 5: Image Buffer Processor — ~0ms (gating only)

`useImageBufferProcessor.ts` validates incoming frames.

**Drag throttle**: **Disabled in v2.4.1** (`DRAG_THROTTLE_INTERVAL = 0`). Profiling showed 27 FPS without throttle vs 12 FPS with 33ms throttle — the throttle was counterproductive once subsample reduced render cost below the throttle interval.

**RAF scheduling**: Stores latest image in `pendingImageRef`, schedules `requestAnimationFrame` if not already scheduled. Frame coalescing: if multiple images arrive before RAF fires, only the latest renders.

### Stage 6: Canvas Rendering (RAF callback) — ~0.3ms

`useCanvasRenderer.ts:109-195` runs inside `requestAnimationFrame`.

**Buffer decode**: `Uint8Array` from binary WebSocket → returned as-is (zero-copy).

**LDR RGBA conversion**: `canvasImageData.data.set(buffer)` — single memcpy-equivalent call, potentially SIMD-optimized by browser engine. **This is the only real pixel copy in the client.**

**HDR RGBA conversion**: Two copies — byte-to-float reinterpret + per-pixel tone-mapping `Math.min(255, Math.max(0, float * 255))`. ~10-15ms at 1080p.

**Canvas write**: `ctx.putImageData(canvasImageData, 0, 0)` — uploads to canvas backing store → GPU.

**Optimizations in place**:

- Cached `ImageData` (reused across frames, eliminates ~500 MB/min GC pressure)
- Cached 2D context with `{ alpha: false, desynchronized: true }`
- `desynchronized: true` bypasses compositor (hint, ~16ms less latency when supported)

---

## Buffer Copy Count (LDR Path, 1080p)

| Stage              | Operation            | Copy?      | Size   |
| ------------------ | -------------------- | ---------- | ------ |
| Octane → gRPC      | Protobuf serialize   | Copy       | 8.3 MB |
| gRPC → Vite        | Protobuf deserialize | Copy       | 8.3 MB |
| Vite → WS          | Buffer.concat        | Reference  | 0      |
| WS → Browser       | Network transmit     | Kernel     | 8.3 MB |
| Browser receive    | ArrayBuffer          | Zero-copy  | 0      |
| Pixel slice        | Uint8Array view      | Zero-copy  | 0      |
| LDR → ImageData    | `data.set(buffer)`   | **Copy**   | 8.3 MB |
| ImageData → Canvas | putImageData         | GPU upload | 8.3 MB |

**Total real copies**: 4 (protobuf ser, protobuf deser, data.set, GPU upload). Only the last two are on the browser main thread, and they take ~0.3ms combined.

---

## Why It Was 8 FPS During Drag (pre-v2.4.1)

Without subsample, Octane takes ~125ms per frame at full resolution. Camera updates at 30 Hz, but Octane can only start a new render when the previous finishes:

```
t=0ms    camera update #1 sent
t=125ms  frame #1 arrives (stale by 3 camera updates)
t=250ms  frame #2 arrives → 8 fps ceiling
```

### v2.4.1 Solution: Auto-Subsample During Drag

On drag start, the viewport automatically:

1. Sets subsample mode to 2x2 (quarter resolution render)
2. Sets kernel max samples to 1 (single sample per pixel)
3. Restores both on drag end

This drops render time from ~125ms to ~37ms → **27 FPS** during interaction. Both optimizations are preference-gated (`getDragSubsampleEnabled()`, `getDragSamples1Enabled()`), on by default.

The 33ms drag throttle was also disabled — with 37ms render time, the throttle was the bottleneck, not the GPU.

---

## Optimization Status

| Priority | Solution                   | Impact             | Status                                              |
| -------- | -------------------------- | ------------------ | --------------------------------------------------- |
| 1        | **Subsample during drag**  | 8fps → 27fps       | **DONE** (v2.4.1) — auto 2x2 + samples=1 on drag    |
| 2        | **Binary WebSocket relay** | Zero-copy pipeline | **DONE** (v2.4.0) — replaced JSON encoding          |
| 3        | **Drag throttle removal**  | 12fps → 27fps      | **DONE** (v2.4.1) — throttle was the bottleneck     |
| —        | Predictive CSS transform   | Perceived 60fps    | Not needed — 27fps is smooth enough for interaction |
| 4        | **dxSS shared surface**    | ~10ms → ~2ms       | **DONE** (v2.4.5) — Electron dist, GPU DMA bypass   |
| —        | WebGL texture upload       | Marginal (<0.3ms)  | Not needed — putImageData is 0.3ms                  |
| —        | OffscreenCanvas worker     | Main thread = 0ms  | Not needed — client pipeline already ~0.3ms         |

---

## Current Throttle/Rate Summary

| What                         | Rate                           | Where                                                    |
| ---------------------------- | ------------------------------ | -------------------------------------------------------- |
| Camera updates to Octane     | 30 Hz (33ms)                   | `useCameraSync.ts` CAMERA_UPDATE_INTERVAL                |
| Frame acceptance during drag | Unlimited (throttle disabled)  | `useImageBufferProcessor.ts` DRAG_THROTTLE_INTERVAL = 0  |
| Auto-subsample during drag   | 2x2 on drag start, restore end | `CallbackRenderViewport/index.tsx` drag effect           |
| Kernel samples during drag   | 1 on drag start, restore end   | `CallbackRenderViewport/index.tsx` drag effect           |
| RAF rendering                | 60 fps max (vsync)             | Browser requestAnimationFrame                            |
| WS backpressure drop         | >10 MB buffered                | `vite-plugin-octane-grpc.ts` MAX_WS_BUFFER               |
| Status bar updates           | 2/sec (500ms)                  | `useCanvasRenderer.ts` STATUS_UPDATE_INTERVAL            |
| Server log (mutations)       | Per-call                       | `vite-plugin-octane-grpc.ts` (SetCamera/update excluded) |

---

## dxSS Shared Surface Pipeline (v2.4.5, Electron dist only)

Eliminates protobuf serialization by sharing the GPU render texture directly between Octane and the Electron process via DXGI shared handles.

### Flow

```
Octane GPU render
  ↓ mSharedSurface on ApiRenderImage (D3D11 texture, keyed mutex)
octaneServGrpc: grabSharedFrame RPC
  ↓ clone() → DuplicateHandle into Electron process PID
  ↓ returns SharedSurfaceFrame { handle, luid, width, height, pitch, format, frameId }
GrpcProxyServer (Node.js, Electron main process)
  ↓ dxAddon.initDevice(luid) — once, creates D3D11 device on same GPU adapter
  ↓ dxAddon.mapSurface(handle) — OpenSharedResource1 → CopyResource → Map → memcpy to Buffer
  ↓ dxAddon.closeSurface(handle) + releaseSharedFrame(frameId)
  ↓ sends pixel Buffer over WebSocket (same binary frame format as standard path)
Browser canvas2d (same as standard path)
```

### Key files

| File                                            | Role                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| `native/src/dx_shared_surface.cpp`              | D3D11 device, staging texture, mapSurface hot path                |
| `server/src/grpc/GrpcProxyServer.ts`            | enableSharedSurface, grabSharedFrame, handle lifecycle            |
| `octaneServGrpc/src/grpc_server.cpp`            | SharedSurfaceFrameServiceImpl (clone, DuplicateHandle, TTL purge) |
| `octaneServGrpc/proto/sharedsurfaceframe.proto` | RPC + message definitions                                         |
| `electron/main.ts`                              | Addon loading, passes dxAddon to GrpcProxyServer                  |
| `electron/preload.ts`                           | Exposes hasNativeAddon to renderer via contextBridge              |

### Performance

At 1024x512 LDR RGBA (2 MB/frame):

- `grabSharedFrame` RPC: ~1ms (handle duplication, no pixel copy)
- `mapSurface`: ~0ms (GPU DMA copy + CPU map, sub-millisecond)
- WS send: ~1ms
- **Total: ~2ms** vs ~10ms for protobuf serialize+deserialize

### Handle lifecycle

1. Server clones `ApiSharedSurface` and tracks in `sClonedSurfaces[frameId]`
2. Client maps the texture, sends pixels, then calls `closeSurface(handle)` + `releaseSharedFrame(frameId)`
3. Stale handles (>10s) force-released by client-side cleanup timer
4. Orphaned server clones (>30s) purged by TTL sweep in `grabSharedFrame`

### When dxSS is NOT used

- Vite dev mode: explicitly disabled (`setSharedSurfaceOutputType(0)`)
- Electron dev mode: Vite handles gRPC, no GrpcProxyServer
- Non-Windows: native addon returns `isAvailable() = false`
- No GPU: D3D11 device creation fails, falls back to pixel path
