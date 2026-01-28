# Render Callback Image Fix

## Problem

Render viewport was not displaying images even though callbacks were being received. The issue was that the callback handler was calling `grabRenderResult()` to fetch images, but this approach wasn't working.

## Root Cause Analysis

### Proto Structure Investigation

Examined both Alpha 5 and Beta 2 callback proto files:

```protobuf
// server/proto/callback.proto (Beta 2)
// server/proto_old/callback.proto (Alpha 5)

message OnNewImageRequest {
    string callback_source = 1;
    int32 callback_id = 2;
    uint64 user_data = 3;
    ApiArrayApiRenderImage render_images = 4;  // ⭐ Images are HERE!
}

message StreamCallbackRequest {
    oneof payload {
        OnNewImageRequest newImage = 10;
        // ...
    }
}
```

**Key Discovery**: `OnNewImageRequest` includes `render_images` field directly (line 4).

### Old Implementation (Working)

From `/workspace/callbackManager.ts`:
```typescript
// Old code expected images directly in callback response
if (data.render_images && data.render_images.data) {
    this.emit('OnNewImage', {
        render_images: data.render_images,  // Direct access
        callback_id: data.callback_id
    });
}
```

### Current Implementation (Broken)

From `vite-plugin-octane-grpc.ts`:
```typescript
// BEFORE (wrong approach)
if (callbackRequest.newImage) {
    // Calling grabRenderResult to fetch images separately
    const renderResult = await this.callMethod('ApiRenderEngine', 'grabRenderResult', {});
    
    if (renderResult && renderResult.renderImages) {
        this.notifyCallbacks({ render_images: renderResult.renderImages });
    }
}
```

**Problem**: 
1. Images are already in `callbackRequest.newImage.render_images`
2. Calling `grabRenderResult()` adds unnecessary latency and complexity
3. `grabRenderResult()` might not return the same image or might fail

## Solution

### Changed Approach

Access images directly from the callback stream:

```typescript
// AFTER (correct approach)
if (callbackRequest.newImage) {
    // Images are already in the callback - use them directly!
    const renderImages = callbackRequest.newImage.render_images;
    
    if (renderImages && renderImages.data && renderImages.data.length > 0) {
        const imageData = {
            callback_source: callbackRequest.newImage.callback_source || 'grpc',
            callback_id: callbackRequest.newImage.callback_id || this.callbackId,
            user_data: callbackRequest.newImage.user_data,
            render_images: renderImages
        };
        
        this.notifyCallbacks(imageData);
    }
}
```

### Benefits

✅ **No extra API call**: Uses data already in callback  
✅ **Lower latency**: No round-trip to Octane for image fetch  
✅ **More reliable**: No chance of timing issues with grabRenderResult  
✅ **Matches old implementation**: Same approach that was working before  
✅ **Works in both Alpha 5 and Beta 2**: Proto structures are identical  

## Implementation Details

### Files Changed

**`vite-plugin-octane-grpc.ts`**:
- Lines 356-384: Rewrote callback handler to use images directly
- Line 27: Enabled `DEBUG_SERVER_LOGS = true` to verify image data flow

### Data Flow

```
OCTANE LIVELINK
    ↓
    OnNewImage callback with render_images
    ↓
StreamCallbackService.callbackChannel (stream)
    ↓
vite-plugin-octane-grpc.ts (server)
    callbackRequest.newImage.render_images ← Extract here!
    ↓
    notifyCallbacks(imageData)
    ↓
WebSocket broadcast to clients
    ↓
client.emit('OnNewImage', imageData)
    ↓
CallbackRenderViewport component
    ↓
    displayCallbackImage(data.render_images.data[0])
    ↓
Canvas rendering
```

### Expected Data Structure

Frontend expects:
```typescript
{
  callback_source: 'grpc',
  callback_id: number,
  user_data: number,
  render_images: {
    data: [
      {
        type: number,  // Image type (HDR/LDR)
        size: { x: number, y: number },  // Dimensions
        pitch: number,
        tonemappedSamplesPerPixel: number,
        renderTime: number,
        buffer: {
          data: string | Buffer,  // Base64 or Node Buffer
          size: number,
          encoding: string
        }
      }
    ]
  }
}
```

## Verification

### Debug Logs Enabled

With `DEBUG_SERVER_LOGS = true`, you should see:
```
[OCTANE-SERVER] 🖼️  OnNewImage callback received
[OCTANE-SERVER] 📡 Callback contains render_images: { hasRenderImages: true, imageCount: 1 }
[OCTANE-SERVER] ✅ Got 1 render images from callback
```

### Frontend Logs

In browser console:
```
🔍 CLIENT: [CallbackViewport] Received callback with 1 images
🔍 CLIENT: [displayCallbackImage] Rendering 1920x1080 image
```

### Testing Checklist

- [ ] Start Octane with LiveLink enabled (port 51022)
- [ ] Start octaneWebR: `npm run dev`
- [ ] Start rendering in Octane
- [ ] Check server logs for "OnNewImage callback received"
- [ ] Check server logs for "Got X render images from callback"
- [ ] Verify images appear in render viewport
- [ ] Check frame counter increments
- [ ] Verify no errors in console

## Comparison: Old vs New

| Aspect | Old (Working) | Current (Fixed) |
|--------|---------------|-----------------|
| Callback Registration | ✅ setOnNewImageCallback | ✅ setOnNewImageCallback |
| Image Fetch Method | ~~getNewImageFromCallback~~ (polling) | ✅ Stream callback data |
| Image Source | Response from polling | callbackRequest.newImage.render_images |
| Extra API Call | Yes (polling loop) | ❌ No (direct access) |
| Latency | High (polling interval) | Low (real-time stream) |
| Reliability | Moderate (polling can miss) | High (stream guaranteed delivery) |

## Why grabRenderResult Doesn't Work Well

### Issues with grabRenderResult Approach

1. **Timing**: By the time we call it, the image might be released
2. **Race Conditions**: Multiple callbacks might compete for the same result
3. **Latency**: Adds round-trip time (callback notification → API call → response)
4. **Complexity**: Extra error handling, state management
5. **Mismatch**: The grabbed result might not match the callback notification

### When to Use grabRenderResult

`grabRenderResult()` is designed for:
- Manual image polling (without callbacks)
- Explicit user action (e.g., "Save Render" button)
- One-time snapshot retrieval

**Not for**: Real-time callback streaming

## Proto Files Comparison

Both versions have identical callback structures:

### Alpha 5 (server/proto_old/callback.proto)
```protobuf
message OnNewImageRequest {
    string callback_source = 1;
    int32 callback_id = 2;
    uint64 user_data = 3;
    ApiArrayApiRenderImage render_images = 4;  // ✅ Same
}
```

### Beta 2 (server/proto/callback.proto)
```protobuf
message OnNewImageRequest {
    string callback_source = 1;
    int32 callback_id = 2;
    uint64 user_data = 3;
    ApiArrayApiRenderImage render_images = 4;  // ✅ Same
}
```

**Result**: This fix works for BOTH API versions ✅

## Related Documentation

- `vite-plugin-octane-grpc.ts` (lines 356-384): Callback handler implementation
- `client/src/components/CallbackRenderViewport/index.tsx` (lines 634-646): Frontend callback listener
- `server/proto/callback.proto`: Callback message definitions (Beta 2)
- `server/proto_old/callback.proto`: Callback message definitions (Alpha 5)

## Rollback (If Needed)

To revert to grabRenderResult approach:
```typescript
if (callbackRequest.newImage) {
    const renderResult = await this.callMethod('ApiRenderEngine', 'grabRenderResult', {});
    if (renderResult && renderResult.renderImages) {
        this.notifyCallbacks({ render_images: renderResult.renderImages });
    }
}
```

**Not recommended** - original approach has timing and reliability issues.

---

**Fix Applied**: 2025-01-31  
**Status**: ✅ Ready for testing  
**API Compatibility**: Both Alpha 5 and Beta 2  
**Debug Logs**: Enabled (set `DEBUG_SERVER_LOGS = false` after verification)
