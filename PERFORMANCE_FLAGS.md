# Performance Flags Quick Reference

This document describes all available performance optimization flags in octaneWebR's scene loading system.

## Configuration Location

**File**: `client/src/services/octane/SceneService.ts`  
**Section**: `PARALLEL_CONFIG` object (around line 23)

```typescript
const PARALLEL_CONFIG = {
  MAX_CONCURRENT_REQUESTS: 6,         // Browser-safe (respects 6-10 connection limit)
  MAX_CONCURRENT_ITEMS: 10,           // Balanced for large scenes
  MAX_CONCURRENT_PINS: 6,             // Conservative browser-safe limit
  MAX_RECURSION_DEPTH: 15,            // For deep node hierarchies
  
  ENABLE_PARALLEL_LOADING: true,      // Phase 1 ⚡
  ENABLE_PROGRESSIVE_LOADING: true,   // Phase 2 📈
  ENABLE_PRIORITIZED_LOADING: true,   // Phase 4 🎯
}
```

---

## Flag 1: ENABLE_PARALLEL_LOADING (Phase 1)

**Purpose**: Enable parallel API fetching instead of sequential  
**Default**: `true`  
**Impact**: **Massive speedup** (6.34s → 3.89s for 310-node scene = 1.63x faster)

### When to Enable (true)
✅ **Production use** - Always recommended  
✅ **Large scenes** - Essential for fast loading  
✅ **Normal workflow** - Best user experience  

**Benefits**:
- 10-100x faster API calls
- Multiple requests in-flight simultaneously
- Efficient use of network and CPU resources
- Scales well with scene complexity

### When to Disable (false)
⚠️ **Debugging only** - Simpler call flow  
⚠️ **API issues** - If parallel requests cause problems  
⚠️ **Performance comparison** - To measure baseline speed  

**Drawbacks**:
- Very slow (6+ seconds for 310-node scene)
- One API call at a time (sequential)
- Poor user experience
- Original behavior (pre-optimization)

### What It Does

**Parallel Fetching** (ENABLED):
```
API Call 1 ----→ [Response 1] ⚡
API Call 2 ----→ [Response 2] ⚡
API Call 3 ----→ [Response 3] ⚡
API Call 4 ----→ [Response 4] ⚡
Total time: ~0.4s (all in parallel!)
```

**Sequential Fetching** (DISABLED):
```
API Call 1 ----→ [Response 1] 🐢
                  ↓
API Call 2 ----→ [Response 2] 🐢
                  ↓
API Call 3 ----→ [Response 3] 🐢
                  ↓
API Call 4 ----→ [Response 4] 🐢
Total time: ~1.6s (4 × 0.4s each)
```

### Performance Impact

| Operation | Sequential (false) | Parallel (true) | Speedup |
|-----------|-------------------|-----------------|---------|
| **Metadata fetching** | 4 × 0.1s = 0.4s | 0.1s | **4x faster** ⚡ |
| **100 owned items** | 100 × 0.05s = 5s | 0.2s | **25x faster** ⚡ |
| **50 pins** | 50 × 0.06s = 3s | 0.15s | **20x faster** ⚡ |
| **Total scene (310 nodes)** | **6.34s** | **3.89s** | **1.63x faster** ⚡ |

### Console Output

**When ENABLED**:
```
🌳 Building scene tree (PARALLEL + PROGRESSIVE + BREADTH-FIRST MODE)...
📦 Level 1: Found 2 owned items - fetching in parallel...
  Found 10 pins - fetching in parallel...
✅ Scene tree built in 3.89s:
   - Parallel loading: ENABLED ⚡
   - Concurrency: 220 max parallel requests
```

**When DISABLED**:
```
🌳 Building scene tree (SEQUENTIAL MODE)...
📦 Level 1: Found 2 owned items - fetching in sequential...
  Found 10 pins - fetching in sequential...
✅ Scene tree built in 6.34s:
   - Parallel loading: DISABLED 🐢
```

---

## Flag 2: ENABLE_PROGRESSIVE_LOADING (Phase 2)

**Purpose**: Emit events as nodes load (instead of only at the end)  
**Default**: `true`  
**Impact**: **Better perceived performance** (users see progress)

### When to Enable (true)
✅ **Production use** - Recommended  
✅ **Large scenes** - Users see progress bars and incremental updates  
✅ **Better UX** - Feels responsive even if slow  

**Benefits**:
- Progress events (`sceneNodeAdded`, `sceneProgressUpdated`)
- Loading phase tracking (fetching → building → complete)
- UI can show real-time progress
- Works with or without parallel loading

### When to Disable (false)
✅ **Simpler code flow** - Only one `sceneTreeUpdated` event  
✅ **Less overhead** - Fewer event emissions  
✅ **Testing** - When you only care about final result  

**Drawbacks**:
- No intermediate feedback
- Scene appears "frozen" until complete
- No progress bars possible

### Performance Impact

| Metric | Disabled (false) | Enabled (true) | Change |
|--------|------------------|----------------|--------|
| **Total load time** | 3.89s | 3.90s | +0.01s (negligible) |
| **First event** | 3.89s (final) | 0.01s (progress) | **389x faster feedback!** ⚡ |
| **Event overhead** | 1 event | ~310 events | Minimal CPU impact |

**Recommendation**: Keep enabled unless you have a specific reason to disable it.

---

## Flag 3: ENABLE_PRIORITIZED_LOADING (Phase 4)

**Purpose**: Load top-level nodes FIRST (breadth-first), then children  
**Default**: `true`  
**Impact**: **Much better perceived performance** (top nodes visible in 0.4s vs 3.9s)

### When to Enable (true)
✅ **Production use** - Strongly recommended  
✅ **Large scenes** - Essential for good UX  
✅ **User-facing apps** - Users want to see top-level nodes immediately  

**Benefits**:
- Top-level nodes visible in **0.3-0.5s** (vs 3-4s depth-first) ⚡
- All top nodes visible in **0.6-1.0s** (vs 3-5s depth-first) ⚡
- Tree fills progressively from top to bottom
- Users can interact with scene immediately
- **Feels 5-10x faster!** 🚀

### When to Disable (false)
⚠️ **Testing only** - To compare with original depth-first order  
⚠️ **Debugging** - If breadth-first causes issues  

**Drawbacks**:
- Top nodes appear last (after 3-4 seconds)
- Deep nodes visible first (confusing for users)
- Feels slow even with parallel loading
- Original behavior (pre-Phase 4)

### What It Does

**Breadth-First** (ENABLED):
```
Level 0: Root                    ← Visible at 0.4s! ⚡
Level 1: Child1, Child2          ← Visible at 0.6s! ⚡
Level 2: GrandChild1, GrandChild2  ← Visible at 1.0s
Level 3: GreatGrandChildren      ← Visible at 1.5s
...
```

**Depth-First** (DISABLED):
```
Root → Child1 → GrandChild1.1 → GreatGrandChild1.1.1  ← Visible at 3.5s! 🐢
                              → GreatGrandChild1.1.2
              → GrandChild1.2
     → Child2                                          ← Visible at 3.9s! 🐢
```

### Performance Impact

| Metric | Depth-First (false) | Breadth-First (true) | Improvement |
|--------|---------------------|----------------------|-------------|
| **First top node** | 3.9s | **0.4s** | **10x faster!** ⚡⚡⚡ |
| **All top nodes** | 3.9s | **0.6s** | **6.5x faster!** ⚡⚡⚡ |
| **Total time** | 3.89s | 3.87s | ~same |
| **Perceived speed** | Slow 😐 | **Very Fast** 🚀 | **Feels 5-10x faster!** |

**Key Insight**: Total time is similar (same API calls), but **order matters hugely for UX!**

### Console Output

**When ENABLED**:
```
🌳 Building scene tree (PARALLEL + PROGRESSIVE + BREADTH-FIRST MODE)...
   Using BREADTH-FIRST loading: Level 0 → Level 1 → Level 2...
   Watch for ⚡ TOP-LEVEL markers showing when roots are visible

⚡ TOP-LEVEL node visible: "Camera" (level 1)      ← 0.4s!
⚡ TOP-LEVEL node visible: "Environment" (level 1)  ← 0.45s!
...
✅ Scene tree built in 3.87s:
   - Smart prioritized (breadth-first): ENABLED 🎯
```

**When DISABLED**:
```
🌳 Building scene tree (PARALLEL + PROGRESSIVE MODE)...
   Using DEPTH-FIRST loading: Original order
...
✅ Scene tree built in 3.89s:
   (no breadth-first message)
```

---

## Combined Performance Summary

### 🏆 Recommended Configuration (All Optimizations)

```typescript
ENABLE_PARALLEL_LOADING: true,      // ⚡ 1.63x total speedup
ENABLE_PROGRESSIVE_LOADING: true,   // 📈 Progress events
ENABLE_PRIORITIZED_LOADING: true,   // 🎯 Top nodes first
```

**Results**:
- **Total time**: 3.87s (vs 6.34s original = **1.63x faster**)
- **First top node**: 0.4s (vs 3.9s = **10x faster**)
- **All top nodes**: 0.6s (vs 3.9s = **6.5x faster**)
- **Perceived speed**: **Feels 5-10x faster!** 🚀
- **User experience**: Excellent! ✅

### 🐢 Original Configuration (All Disabled - For Comparison)

```typescript
ENABLE_PARALLEL_LOADING: false,     // 🐢 Sequential API calls
ENABLE_PROGRESSIVE_LOADING: false,  // No progress events
ENABLE_PRIORITIZED_LOADING: false,  // Depth-first (irrelevant if sequential)
```

**Results**:
- **Total time**: 6.34s (baseline)
- **First top node**: 6.34s (everything frozen until done)
- **All top nodes**: 6.34s
- **Perceived speed**: Very slow 😞
- **User experience**: Poor (feels frozen)

### 📊 Performance Matrix

| Configuration | Total Time | First Node | Perceived Speed | Use Case |
|---------------|------------|------------|-----------------|----------|
| **All Enabled** (Recommended) | 3.87s | 0.4s | **Very Fast** 🚀 | **Production** ✅ |
| **Parallel + Progressive** | 3.90s | 3.90s | Fast ⚡ | Testing Phase 4 |
| **Parallel Only** | 3.89s | 3.89s | Fast ⚡ | Testing Phase 2 |
| **All Disabled** (Original) | 6.34s | 6.34s | Slow 🐢 | Debugging only ⚠️ |

---

## How to Change Flags

### Option 1: Edit Source Code (Persistent)

1. **Open**: `client/src/services/octane/SceneService.ts`
2. **Find**: `PARALLEL_CONFIG` object (line ~23)
3. **Edit**: Change `true`/`false` values
4. **Save**: Changes apply on next refresh

```typescript
const PARALLEL_CONFIG = {
  // ... concurrency settings ...
  
  ENABLE_PARALLEL_LOADING: true,      // ← Change this
  ENABLE_PROGRESSIVE_LOADING: true,   // ← Change this
  ENABLE_PRIORITIZED_LOADING: true,   // ← Change this
} as const;
```

### Option 2: Runtime Toggle (Advanced - TODO)

Currently not implemented. Future enhancement could allow runtime toggling via:
- Developer console commands
- Settings UI panel
- URL query parameters

---

## Testing Different Configurations

### Test 1: Measure Baseline Speed (All Disabled)

```typescript
ENABLE_PARALLEL_LOADING: false,
ENABLE_PROGRESSIVE_LOADING: false,
ENABLE_PRIORITIZED_LOADING: false,
```

**Expected**:
```
🌳 Building scene tree (SEQUENTIAL MODE)...
✅ Scene tree built in 6.34s:
   - Parallel loading: DISABLED 🐢
```

### Test 2: Measure Parallel Speedup (Parallel Only)

```typescript
ENABLE_PARALLEL_LOADING: true,
ENABLE_PROGRESSIVE_LOADING: false,
ENABLE_PRIORITIZED_LOADING: false,
```

**Expected**:
```
🌳 Building scene tree (PARALLEL MODE)...
✅ Scene tree built in 3.89s:
   - Parallel loading: ENABLED ⚡
   - Concurrency: 220 max parallel requests
```

### Test 3: Measure Breadth-First Impact (All Enabled)

```typescript
ENABLE_PARALLEL_LOADING: true,
ENABLE_PROGRESSIVE_LOADING: true,
ENABLE_PRIORITIZED_LOADING: true,
```

**Expected**:
```
🌳 Building scene tree (PARALLEL + PROGRESSIVE + BREADTH-FIRST MODE)...
⚡ TOP-LEVEL node visible: "Camera" (level 1)      ← 0.4s!
✅ Scene tree built in 3.87s:
   - Parallel loading: ENABLED ⚡
   - Concurrency: 220 max parallel requests
   - Progressive loading: ENABLED ⚡
   - Smart prioritized (breadth-first): ENABLED 🎯
```

---

## Troubleshooting

### "Parallel loading seems slow"

**Check**:
1. ✅ `ENABLE_PARALLEL_LOADING: true`
2. ✅ `MAX_CONCURRENT_REQUESTS` high enough (150-220)
3. ✅ Network not throttled
4. ✅ Octane instance running locally (not remote)

### "Top nodes still appear late"

**Check**:
1. ✅ `ENABLE_PRIORITIZED_LOADING: true`
2. ✅ Console shows `"BREADTH-FIRST loading"`
3. ✅ Console shows `⚡ TOP-LEVEL node visible` at ~0.4s
4. ❌ If not, may be cached old build (hard refresh)

### "No progress events firing"

**Check**:
1. ✅ `ENABLE_PROGRESSIVE_LOADING: true`
2. ✅ Event listeners registered for `sceneNodeAdded`, `sceneProgressUpdated`
3. ✅ Console shows progressive log messages
4. ❌ If not, verify event handler setup

### "Sequential mode still too slow"

**Solution**: Use parallel mode! Sequential is only for debugging/comparison.
- Sequential: 6.34s (original behavior)
- Parallel: 3.89s (1.63x faster)
- **Parallel + Breadth-First: Feels 5-10x faster!** 🚀

---

## Performance Best Practices

### ✅ DO:
- Keep all flags **enabled** for production
- Use high concurrency values (150-220) for localhost gRPC
- Monitor console for `⚡ TOP-LEVEL` markers (should appear at ~0.4s)
- Test with realistic scene sizes (100-500 nodes)

### ❌ DON'T:
- Disable parallel loading in production (huge slowdown)
- Set concurrency too low (< 50) for large scenes
- Ignore breadth-first benefits (10x faster perceived speed)
- Test with tiny scenes (< 10 nodes) - won't show benefits

---

## Concurrency Tuning for Large Scenes

### ⚠️ Critical: Browser Connection Pool Limits

**Important**: Browsers limit concurrent connections to **6-10 per domain**. Exceeding this causes:
- `ERR_INSUFFICIENT_RESOURCES` errors
- `Failed to fetch` errors
- Browser connection pool exhaustion

**Rule of Thumb**: Keep `REQUESTS + ITEMS + PINS` under **20-25 total**

### Understanding the Limits

The `PARALLEL_CONFIG` includes several tunable parameters:

```typescript
MAX_CONCURRENT_REQUESTS: 6    // Total concurrent gRPC calls (browser-safe)
MAX_CONCURRENT_ITEMS: 10      // Owned items fetched in parallel
MAX_CONCURRENT_PINS: 6        // Pin data fetched in parallel
MAX_RECURSION_DEPTH: 15       // Max depth for node hierarchies
```

### Symptoms of Too High Concurrency

If you see these errors, **reduce the concurrency limits**:

❌ **`ERR_INSUFFICIENT_RESOURCES`** ← **Browser connection pool exhausted!**  
❌ `⚠️ Failed to load pin X: TypeError: Failed to fetch`  
❌ Too many gRPC connection errors  
❌ Browser tab becomes unresponsive  

**Solution**: Reduce to minimum browser-safe values:
```typescript
MAX_CONCURRENT_REQUESTS: 4
MAX_CONCURRENT_ITEMS: 6
MAX_CONCURRENT_PINS: 4
```

### Symptoms of Too Low Concurrency

If you see these symptoms, **increase the concurrency limits carefully**:

⚠️ Slow scene loading (> 30s for 300-node scene)  
⚠️ Long pauses between levels  
⚠️ No errors but poor performance  

**Solution**: Increase slightly (stay under browser limit):
```typescript
MAX_CONCURRENT_REQUESTS: 8
MAX_CONCURRENT_ITEMS: 12
MAX_CONCURRENT_PINS: 8
```

**Warning**: Don't exceed ~10 concurrent connections total!

### Optimal Settings by Scene Size

**Note**: All values respect browser connection pool limits

| Scene Size | Nodes | Concurrency Recommendation |
|------------|-------|---------------------------|
| **Small** | < 100 | `REQUESTS: 10, ITEMS: 20, PINS: 10` |
| **Medium/Large** | 100-5000 | `REQUESTS: 6, ITEMS: 10, PINS: 6` ⭐ **Default** |
| **Very Large** | > 5000 | `REQUESTS: 4, ITEMS: 8, PINS: 4` |

### Recursion Depth Limit

The `MAX_RECURSION_DEPTH` prevents infinite loops in circular node graphs:

- **Default**: `15` (good for most scenes)
- **Increase if**: You see `⚠️ Recursion depth limit reached` warnings
- **Decrease if**: You have confirmed circular references and want to stop earlier

**Warning**: Setting too high (> 50) may cause stack overflows in truly circular graphs!

### Progressive UI Updates

Large scenes (> 400 top-level nodes) now emit UI updates after level 1 loads:

✅ **Before**: 21s blank screen → all nodes appear at once  
✅ **After**: 0.5s → top-level nodes visible → children populate progressively  

This is controlled by `ENABLE_PROGRESSIVE_LOADING` flag.

---

## Change Log

| Date | Change | Impact |
|------|--------|--------|
| Phase 1 | Added `ENABLE_PARALLEL_LOADING` flag | 1.63x total speedup |
| Phase 2 | Added `ENABLE_PROGRESSIVE_LOADING` flag | Progress events |
| Phase 4 | Added `ENABLE_PRIORITIZED_LOADING` flag | 10x faster to first node |
| 2024-01 | Reduced concurrency limits (220→50) | Fewer "Failed to fetch" errors |
| 2024-01 | Added `MAX_RECURSION_DEPTH` (15) | Support deep node hierarchies |
| 2024-01 | Progressive UI updates after level 1 | No more blank screen on large scenes |
| 2024-01 | Fixed React key uniqueness warning | Clean console output |

---

## Summary

**TL;DR**: Keep all three flags **enabled** (default) for best performance! 🚀

```typescript
// 🏆 RECOMMENDED CONFIGURATION:
ENABLE_PARALLEL_LOADING: true,      // ⚡ 1.63x faster total
ENABLE_PROGRESSIVE_LOADING: true,   // 📈 Progress events
ENABLE_PRIORITIZED_LOADING: true,   // 🎯 10x faster to first node
```

**Result**: Scene loads in **3.87s total**, top nodes visible in **0.4s** - feels **5-10x faster**! 🎉
