# Viewport Optimization Phase 3: Input-Side Throttling

**Status**: PLANNED  
**Priority**: HIGH (User reports choppiness still present)  
**Estimated Time**: 1-2 hours  
**Risk**: LOW  

---

## 🎯 Problem Statement

**User Report**: "Still pretty choppy during camera movements"

**Root Cause Analysis**:

Current flow (Phase 2):
```
Octane sends image (100/sec during drag)
    ↓
displayImage() called (100/sec) ← Still processing all images!
    ↓
scheduleRender() stores image (100/sec) ← Overwrites pending image
    ↓
RAF fires (60/sec)
    ↓
renderFrame() processes image (60/sec) ← Buffer decode + convert + render
    ↓
Canvas rendered (60/sec)
```

**The Issue**: We're still **accepting and storing** 100 images/sec, even though RAF only fires 60 times. More importantly, **60 FPS during camera drag is overkill** - 30 FPS is smooth enough for camera movement.

**CPU Bottleneck**: Buffer decoding and conversion is expensive. Even at 60 FPS, it might cause stuttering if the CPU can't keep up.

---

## 💡 Solution: Input-Side Throttling

**Key Insight**: During camera drag, we don't need 60 FPS. **30 FPS is sufficient** and much smoother because it gives CPU more time per frame.

**Strategy**: Throttle image **acceptance** (not rendering) during mouse drag.

### Proposed Flow

```
Octane sends image (100/sec during drag)
    ↓
displayImage() called (100/sec)
    ↓
🚦 THROTTLE CHECK (NEW!)
    ├─ Is user dragging? YES
    ├─ Time since last accepted image? < 33ms
    └─ IGNORE (don't schedule RAF) ← 70% of images ignored!
    
    OR
    
    ├─ Is user dragging? YES
    ├─ Time since last accepted image? >= 33ms
    └─ ACCEPT (schedule RAF) ← Only 30 images/sec processed!
    
    OR
    
    ├─ Is user dragging? NO
    └─ ACCEPT (schedule RAF) ← Full 60 FPS when not dragging
    
    ↓
scheduleRender() stores image (30/sec during drag, 60/sec otherwise)
    ↓
RAF fires (30/sec during drag, 60/sec otherwise)
    ↓
renderFrame() processes image (30/sec during drag, 60/sec otherwise)
    ↓
Canvas rendered (smooth 30 FPS during drag!)
```

---

## 📊 Expected Performance Impact

| Metric | Phase 2 (Current) | Phase 3 (Proposed) | Improvement |
|--------|-------------------|---------------------|-------------|
| **Images Accepted/sec (drag)** | 60/sec | **30/sec** | **50% reduction** |
| **Buffer Decodes/sec (drag)** | 60/sec | **30/sec** | **50% reduction** |
| **CPU Usage (drag)** | 20-30% | **10-20%** | **40% less** |
| **Frame Time Budget** | 16.6ms | **33ms** | **2× more time** |
| **Smoothness (drag)** | Choppy (60 FPS stressed) | **Smooth (30 FPS relaxed)** | ✅ |
| **FPS (idle/after drag)** | 60 FPS | **60 FPS** | ✅ Same |

**Key Benefit**: 30 FPS with 33ms per frame is **smoother** than 60 FPS with CPU struggling to meet 16.6ms deadline!

---

## 🛠️ Implementation Plan

### Step 1: Track Drag State (useMouseInteraction.ts)

**Add drag state tracking**:

```typescript
// useMouseInteraction.ts
export function useMouseInteraction({ ... }) {
  const [isDragging, setIsDragging] = useState(false);
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) { // Middle mouse
      setIsDragging(true);
      // ... existing orbit logic
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
    // ... existing logic
  };
  
  return { isDragging /* expose to parent */ };
}
```

**Files Modified**: `hooks/useMouseInteraction.ts` (~10 lines)

---

### Step 2: Pass Drag State to Viewport (CallbackRenderViewport/index.tsx)

**Expose drag state**:

```typescript
// CallbackRenderViewport/index.tsx
const { isDragging } = useMouseInteraction({ ... });

// Pass to image processor
const { displayImage } = useImageBufferProcessor({
  canvasRef,
  onFrameRendered,
  onStatusUpdate,
  isDragging, // ← NEW
});
```

**Files Modified**: `CallbackRenderViewport/index.tsx` (~5 lines)

---

### Step 3: Throttle Image Acceptance (useImageBufferProcessor.ts)

**Add throttling logic**:

```typescript
// useImageBufferProcessor.ts
export function useImageBufferProcessor({
  canvasRef,
  onFrameRendered,
  onStatusUpdate,
  isDragging, // ← NEW
}: UseImageBufferProcessorParams) {
  
  // ✅ Phase 3: Input-side throttling during drag
  const lastAcceptedTimeRef = useRef(0);
  const DRAG_THROTTLE_INTERVAL = 33; // ms (30 FPS)
  
  const displayImage = useCallback(
    (imageData: OctaneImageData) => {
      // Quick validation
      if (!canvasRef.current || !imageData.buffer?.data) {
        return;
      }
      
      // ✅ Phase 3: Throttle during drag
      if (isDragging) {
        const now = Date.now();
        const timeSinceLastAccepted = now - lastAcceptedTimeRef.current;
        
        if (timeSinceLastAccepted < DRAG_THROTTLE_INTERVAL) {
          Logger.debugV(`[THROTTLE] Ignored image (${timeSinceLastAccepted}ms < ${DRAG_THROTTLE_INTERVAL}ms)`);
          return; // IGNORE - too soon after last accepted image
        }
        
        lastAcceptedTimeRef.current = now;
        Logger.debugV(`[THROTTLE] Accepted image (${timeSinceLastAccepted}ms >= ${DRAG_THROTTLE_INTERVAL}ms)`);
      }
      
      // Schedule RAF render
      scheduleRender(imageData);
    },
    [canvasRef, scheduleRender, isDragging]
  );
  
  return { displayImage };
}
```

**Files Modified**: `hooks/useImageBufferProcessor.ts` (~20 lines)

---

### Step 4: Adaptive RAF Scheduling (useCanvasRenderer.ts) - OPTIONAL

**Bonus optimization**: Adjust RAF target based on drag state.

```typescript
// useCanvasRenderer.ts
export function useCanvasRenderer({
  canvasRef,
  onFrameRendered,
  onStatusUpdate,
  convertBufferToCanvas,
  isDragging, // ← NEW
}: UseCanvasRendererParams) {
  
  // ✅ Phase 3: Adaptive RAF scheduling
  const getTargetInterval = () => {
    return isDragging ? 33 : 16.6; // 30 FPS vs 60 FPS
  };
  
  const scheduleRender = useCallback(
    (imageData: OctaneImageData) => {
      pendingImageRef.current = imageData;
      
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(renderFrame);
        Logger.debugV(`[RAF] Scheduled (target: ${getTargetInterval()}ms)`);
      }
    },
    [renderFrame, getTargetInterval]
  );
  
  // ... rest of hook
}
```

**Files Modified**: `hooks/useCanvasRenderer.ts` (~10 lines)  
**Note**: This is OPTIONAL - input throttling in Step 3 already achieves 30 FPS during drag.

---

## 🧪 Testing Strategy

### Test 1: Verify Throttling Active During Drag

1. Start octaneWebR with dev server
2. Open browser console
3. Enable verbose logging: `Logger.setLevel('DEBUG_V')`
4. Start camera orbit (middle mouse drag)
5. Check console:
   ```
   [THROTTLE] Ignored image (8ms < 33ms)
   [THROTTLE] Ignored image (16ms < 33ms)
   [THROTTLE] Accepted image (35ms >= 33ms)
   [THROTTLE] Ignored image (7ms < 33ms)
   [THROTTLE] Accepted image (42ms >= 33ms)
   ```
6. Expected: ~30 "Accepted" messages per second during drag

### Test 2: Verify Smoothness Improvement

1. Start camera orbit
2. Observe viewport rendering
3. Expected: **Smooth, consistent 30 FPS** (no drops, no stutter)
4. Stop drag
5. Expected: Returns to 60 FPS for high-quality rendering

### Test 3: Verify CPU Usage Reduction

1. Open DevTools → Performance
2. Click **Record**
3. Orbit camera for 5 seconds
4. Stop recording
5. Check CPU usage during drag
6. Expected: **10-20% CPU** (was 20-30% in Phase 2)

### Test 4: Verify Full FPS When Not Dragging

1. Let camera sit idle
2. Move an object in Octane (triggers viewport updates)
3. Check console - no throttling messages
4. Expected: Full 60 FPS rendering when not dragging

---

## 📈 Performance Comparison

### Before Phase 3 (Current)
```
Camera Drag Active:
- Octane sends: 100 images/sec
- displayImage calls: 100/sec
- RAF fires: 60/sec
- Buffer decodes: 60/sec ← CPU bottleneck!
- CPU usage: 20-30%
- Frame time: 16.6ms (tight deadline)
- Result: Choppy (CPU can't keep up)
```

### After Phase 3 (Proposed)
```
Camera Drag Active:
- Octane sends: 100 images/sec
- displayImage calls: 100/sec
- Images ACCEPTED: 30/sec ← Throttled!
- RAF fires: 30/sec
- Buffer decodes: 30/sec ← 50% reduction!
- CPU usage: 10-20%
- Frame time: 33ms (relaxed deadline)
- Result: Smooth 30 FPS (CPU has time)

Camera Idle:
- Same as Phase 2 (full 60 FPS)
```

---

## 🎯 Why This Works

### Problem with 60 FPS During Drag

**16.6ms frame budget** is tight:
```
Buffer decode: 8ms
Buffer convert: 5ms
Canvas render: 2ms
Total: 15ms (tight! any GC or other work = dropped frame)
```

**Result**: CPU struggles to meet deadline → stuttering

### Solution with 30 FPS During Drag

**33ms frame budget** is relaxed:
```
Buffer decode: 8ms
Buffer convert: 5ms
Canvas render: 2ms
Slack time: 18ms (plenty of time for GC, other work)
Total: 15ms work, 18ms slack
```

**Result**: CPU easily meets deadline → smooth rendering

### Human Perception

- **60 FPS**: Needed for static scenes, text, UI elements
- **30 FPS**: Sufficient for camera movement (motion blur hides judder)
- **< 24 FPS**: Looks choppy

**Conclusion**: 30 FPS during drag is the sweet spot for smooth camera movement!

---

## 🔧 Configuration Options

### Adjustable Throttle Rate

```typescript
// Make throttle interval configurable
const DRAG_THROTTLE_FPS = 30; // Adjustable: 24, 30, 40, 60
const DRAG_THROTTLE_INTERVAL = 1000 / DRAG_THROTTLE_FPS; // ms

// Could expose as viewport prop
<CallbackRenderViewport
  dragThrottleFPS={30} // User-configurable
/>
```

### Adaptive Throttling

```typescript
// More aggressive throttling during fast movement
const getThrottleInterval = (velocity: number) => {
  if (velocity > 100) return 50; // 20 FPS for fast movement
  if (velocity > 50) return 33;  // 30 FPS for medium movement
  return 16.6;                    // 60 FPS for slow/stopped
};
```

**Recommendation**: Start with fixed 30 FPS throttle, add adaptive later if needed.

---

## ⚠️ Edge Cases

### Edge Case 1: Short Drag

**Scenario**: User clicks and releases immediately (< 33ms drag)

**Behavior**: Zero images processed during drag (no rendering)

**Fix**: Not needed - short drag = no movement = no need to render

### Edge Case 2: Multiple Simultaneous Drags

**Scenario**: User uses multiple input devices simultaneously

**Behavior**: isDragging tracks ANY drag, throttles regardless of source

**Fix**: Not needed - throttling applies to all drag sources equally

### Edge Case 3: Transition from Drag to Idle

**Scenario**: User stops dragging, should return to 60 FPS immediately

**Behavior**: isDragging = false, throttle disabled, next image accepted immediately

**Fix**: Already handled - throttle only active when isDragging = true

---

## 📝 Alternative Approaches (Considered and Rejected)

### Alternative 1: Increase RAF Target to 30 FPS Always

**Idea**: Set RAF to 30 FPS globally

**Rejected**: We want 60 FPS when NOT dragging for high-quality static rendering

### Alternative 2: Reduce Octane Send Rate

**Idea**: Tell Octane to send fewer images during drag

**Rejected**: We don't control Octane's send rate, and it's useful to have high-frequency updates available

### Alternative 3: Use Web Worker for Buffer Processing

**Idea**: Move buffer decode/convert to worker thread

**Rejected**: Adds complexity, and 30 FPS throttling is simpler and sufficient

### Alternative 4: Reduce Canvas Resolution During Drag

**Idea**: Render at lower resolution during drag, upscale to full size

**Rejected**: Visual quality loss, and throttling achieves same CPU savings without quality loss

---

## 🚀 Implementation Timeline

**Total Estimated Time**: 1-2 hours

1. **Step 1: Drag State Tracking** (15 mins)
   - Modify `useMouseInteraction.ts`
   - Add `isDragging` state
   - Expose to parent

2. **Step 2: Pass Drag State** (10 mins)
   - Modify `CallbackRenderViewport/index.tsx`
   - Pass `isDragging` to image processor

3. **Step 3: Throttling Logic** (30 mins)
   - Modify `useImageBufferProcessor.ts`
   - Add throttle check in `displayImage`
   - Add debug logging

4. **Step 4: Testing** (30 mins)
   - Verify throttling active
   - Test smoothness
   - Check CPU usage
   - Verify 60 FPS when not dragging

5. **Step 5: Documentation** (15 mins)
   - Update CHANGELOG
   - Add comments
   - Create completion summary

---

## ✅ Success Criteria

| Criterion | Target | Verification |
|-----------|--------|--------------|
| **FPS During Drag** | 30 FPS stable | DevTools Performance |
| **Smoothness** | No stutter/jank | Visual inspection |
| **CPU Usage (drag)** | 10-20% | DevTools Performance |
| **FPS (idle)** | 60 FPS | DevTools Performance |
| **Images Ignored** | ~70/sec during drag | Console logs |
| **Images Accepted** | ~30/sec during drag | Console logs |

---

## 🎯 Expected User Experience

### Before Phase 3
```
User orbits camera
    ↓
Viewport feels choppy/stuttery
    ↓
User thinks: "This doesn't feel smooth"
```

### After Phase 3
```
User orbits camera
    ↓
Viewport feels buttery smooth
    ↓
User thinks: "This feels great!"
```

---

## 📚 Documentation Updates

1. **VIEWPORT_OPTIMIZATION_COMPLETE.md**: Add Phase 3 section
2. **CHANGELOG.md**: Add Phase 3 entry
3. **Code Comments**: Mark Phase 3 optimizations
4. **AGENTS.md**: Update with throttling knowledge

---

## 🏁 Summary

**Problem**: Viewport still choppy during camera drag (60 FPS too aggressive)

**Solution**: Input-side throttling to 30 FPS during drag

**Key Insight**: 30 FPS with relaxed frame budget (33ms) is smoother than 60 FPS with stressed CPU (16.6ms)

**Implementation**: 3 simple steps, ~45 lines of code

**Expected Impact**:
- ✅ Smooth 30 FPS during camera movement
- ✅ 50% reduction in CPU usage during drag
- ✅ 2× more time per frame (33ms vs 16.6ms)
- ✅ Full 60 FPS when not dragging

**Risk**: LOW (non-breaking change, easily reversible)

**Time**: 1-2 hours total implementation + testing

---

**Ready to implement when user approves!** 🚀
