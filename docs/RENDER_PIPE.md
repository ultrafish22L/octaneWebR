# Render Pipeline: Deep Analysis & Optimization

## Pipeline Overview

```
Octane GPU ──► octaneServGrpc (gRPC) ──► Vite Plugin (WS relay) ──► Browser (Canvas 2D)
   render        protobuf stream          binary WebSocket           RAF + putImageData
   ~100ms           ~5ms                     ~5ms                       ~0.3ms
```

**Current performance** (1024x512, measured):

- Octane render-to-callback: ~125ms (8 fps during drag)
- Client paint (decode + set + putImageData): 0.3ms avg, 0.8ms max
- Camera update rate: 30 Hz (33ms interval)
- Frame acceptance during drag: 30 fps throttle (33ms)
- E2E latency: ~150ms (render + network + RAF vsync)

**Bottleneck**: Octane GPU render time dominates. Client pipeline is essentially free.

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

`useImageBufferProcessor.ts` validates and throttles incoming frames.

**Drag throttle**: During camera drag, accepts max 1 frame per 33ms (30 fps). Frames arriving sooner are silently dropped. This reduces GPU/CPU contention.

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

## Why It's 8 FPS During Drag

The 30 Hz camera update sends a new camera position every 33ms. But Octane takes ~125ms to render each frame. So:

```
t=0ms    camera update #1 sent
t=33ms   camera update #2 sent (Octane still rendering #1)
t=66ms   camera update #3 sent (Octane still rendering #1)
t=99ms   camera update #4 sent (Octane still rendering #1)
t=125ms  frame #1 arrives (from camera #1, already stale)
t=132ms  camera update #5 sent
...
```

Octane can only start a new render when the previous one finishes. With 125ms render time, we get 8 fps maximum regardless of how fast camera updates are sent. The camera updates at 30 Hz just ensure Octane always has the latest position queued.

---

## Optimization — Next Steps

| Priority | Solution                     | Impact                       | Effort            | Risk   |
| -------- | ---------------------------- | ---------------------------- | ----------------- | ------ |
| 1        | **Subsample during drag**    | 8fps → 60+fps                | Low (2 API calls) | Low    |
| 2        | **Predictive CSS transform** | Perceived 60fps even at 8fps | Medium            | Low    |
| 3        | WebGL texture upload         | Marginal (<0.3ms)            | High              | Medium |
| 4        | OffscreenCanvas worker       | Main thread = 0ms            | High              | Medium |

**Recommended:** Subsample mode (`set_subsample_mode(2)` on drag start, `(0)` on drag end) gives real 60fps during interaction. Predictive CSS transform complements it for perceived smoothness. Binary WebSocket relay already implemented (Solution F — done).

---

## Current Throttle/Rate Summary

| What                         | Rate               | Where                                                    |
| ---------------------------- | ------------------ | -------------------------------------------------------- |
| Camera updates to Octane     | 30 Hz (33ms)       | `useCameraSync.ts` CAMERA_UPDATE_INTERVAL                |
| Frame acceptance during drag | 30 fps (33ms)      | `useImageBufferProcessor.ts` DRAG_THROTTLE_INTERVAL      |
| RAF rendering                | 60 fps max (vsync) | Browser requestAnimationFrame                            |
| WS backpressure drop         | >10 MB buffered    | `vite-plugin-octane-grpc.ts` MAX_WS_BUFFER               |
| Status bar updates           | 2/sec (500ms)      | `useCanvasRenderer.ts` STATUS_UPDATE_INTERVAL            |
| Server log (mutations)       | Per-call           | `vite-plugin-octane-grpc.ts` (SetCamera/update excluded) |
