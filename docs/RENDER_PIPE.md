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

## Optimization Solutions

### Solution A: Predictive Canvas Transform (Recommended — highest impact, client-only)

**Concept**: While waiting for the next Octane frame, apply a CSS transform to the canvas that approximates the expected camera movement. When the real frame arrives, snap back to true pixels.

**Implementation**:

1. On each `pointermove` during orbit, compute the delta (dx, dy) in screen pixels
2. Apply `canvas.style.transform = translate(dx, dy) rotate(theta)` — instant, GPU-composited
3. When next Octane frame arrives in RAF, reset transform to identity and paint the real pixels

**Why it works**: Human perception tolerates ~100ms of approximate feedback if it's smooth. The CSS transform gives 60fps visual response while Octane renders at 8fps. The 125ms "stale" frame actually looks correct enough because orbital rotation is smooth and predictable.

**Latency**: 0ms (CSS transform is GPU-composited, no main thread work)
**Accuracy**: Approximate — slight parallax error since we're transforming a 2D projection. Acceptable for orbit; less accurate for pan (translation is exact though).
**Complexity**: Medium — need to track cumulative transform during drag, reset on each real frame.

**Risk**: Low. CSS transform on canvas is a standard pattern (used by Google Maps, Figma, etc.). Falls back gracefully — if transform math is wrong, user just sees a brief jump when real frame arrives.

### Solution B: Subsample Mode During Drag (Recommended — complements A)

**Concept**: Tell Octane to render at lower resolution during camera interaction, producing frames faster.

**Implementation**:

1. On drag start: `set_subsample_mode(2)` (4x4 subsampling — 16x fewer pixels)
2. On drag end: `set_subsample_mode(0)` (full resolution)

**Why it works**: At 4x4 subsampling, a 1024x512 render becomes 256x128 internally. Octane can produce these in ~10-15ms instead of ~125ms, giving 60+ fps during drag.

**Latency**: ~10-15ms per frame (vs 125ms at full res)
**Visual quality**: Blocky during drag (acceptable — user is moving the camera, not examining pixels)
**Complexity**: Low — two API calls (drag start/end)

**Risk**: Low. Subsample mode is a built-in Octane feature. The `set_subsample_mode` MCP tool already exists. The viewport already handles resolution changes (auto-resizes canvas on dimension change).

**Caveat**: Need to flush stale full-res frames on drag start (already implemented in `flushPendingFrame`). On drag end, first few frames will be subsampled until the mode-change propagates.

### Solution C: Reduce Render Resolution During Drag (Alternative to B)

**Concept**: Change the render target resolution itself during drag.

**Implementation**: Modify film settings on the render target to use half or quarter resolution during drag, restore on mouse up.

**Why it works**: Same principle as subsample — fewer pixels = faster render.

**Complexity**: Higher than B (need to modify render target attributes, handle resize events).

**Risk**: Medium — changing render resolution mid-stream may cause Octane to restart the render engine, adding a one-time ~200ms stall.

**Verdict**: Subsample mode (Solution B) is strictly better for this use case. It's designed for interactive preview and doesn't restart the engine.

### Solution D: WebGL Texture Upload (Future — replaces putImageData)

**Concept**: Replace Canvas 2D + `putImageData` with WebGL + `texImage2D` for direct GPU texture upload.

**Implementation**:

1. Create WebGL context instead of Canvas 2D
2. Create a texture and a full-screen quad
3. On each frame: `gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels)`
4. Draw quad with texture

**Why it works**: `texImage2D` can be faster than `putImageData` because:

- Direct GPU upload (no intermediate staging buffer)
- Can use `gl.PIXEL_UNPACK_BUFFER` for async upload (PBO)
- Avoids Canvas 2D's alpha premultiplication step (even with `alpha: false`)

**Latency**: ~0.1-0.5ms (vs ~0.3ms current — marginal improvement)
**Complexity**: High — full renderer rewrite, WebGL context management, shader program
**Risk**: Medium — WebGL context can be lost, need fallback to Canvas 2D

**Verdict**: Not worth it now. `putImageData` at 0.3ms is already well within budget. Only revisit if rendering 4K+ resolution where GPU upload becomes the bottleneck.

### Solution E: OffscreenCanvas in Web Worker (Future)

**Concept**: Move buffer decode + pixel conversion to a Web Worker using `OffscreenCanvas`.

**Implementation**:

1. Transfer canvas control to worker via `canvas.transferControlToOffscreen()`
2. Worker receives pixel data via `postMessage` with transferable `ArrayBuffer`
3. Worker does `data.set()` + `putImageData()` on `OffscreenCanvas`
4. Main thread completely free for input handling

**Why it works**: Unblocks main thread from all pixel processing. Mouse events + CSS transforms have zero contention with rendering.

**Latency**: Same total, but main thread latency = 0ms (all work in worker)
**Complexity**: High — worker thread management, transferable buffers, fallback
**Risk**: Medium — `OffscreenCanvas` support varies, `desynchronized` may not work in workers

**Verdict**: Not needed now. Main thread rendering takes 0.3ms — already negligible. Only worth it if combined with HDR tone-mapping in worker (which takes 10-15ms and actually blocks the main thread).

### Solution F: Binary WebSocket from gRPC (Already Implemented)

The Vite plugin and browser client already use binary WebSocket frames, eliminating base64 encoding. The zero-copy pipeline from network → typed array view → `data.set()` means only one real pixel copy happens in the browser.

**Status**: Done. No further optimization needed at this layer.

---

## Recommended Implementation Order

| Priority | Solution                        | Impact                       | Effort            | Risk   |
| -------- | ------------------------------- | ---------------------------- | ----------------- | ------ |
| 1        | **B: Subsample during drag**    | 8fps → 60+fps                | Low (2 API calls) | Low    |
| 2        | **A: Predictive CSS transform** | Perceived 60fps even at 8fps | Medium            | Low    |
| 3        | D: WebGL texture upload         | Marginal (<0.3ms)            | High              | Medium |
| 4        | E: OffscreenCanvas worker       | Main thread = 0ms            | High              | Medium |

**Solutions B + A together** would give buttery smooth viewport interaction:

- Subsample mode gives real 60fps frames (low-res but fast)
- Predictive transform fills gaps if subsample still can't keep up
- Full-res progressive refinement kicks in the moment drag ends

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
