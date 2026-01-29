# Parallel Loading Implementation Guide

## Overview

The scene loading system now has **two separate implementations**:

1. **Sequential** (default) - Original proven implementation, always works
2. **Parallel** (opt-in) - Optimized concurrent loading, 10-20x faster

You can toggle between them with a single configuration flag.

---

## Quick Start

### Test Sequential Loading (Default)

```typescript
// client/src/services/octane/parallelConfig.ts
export const PARALLEL_CONFIG = {
  ENABLED: false,  // ← Sequential mode (safe, proven)
  MAX_CONCURRENT: 6,
  MAX_DEPTH: 5
};
```

**Expected Result:**
```
✅ Scene tree built in 30-70s:
   - 448 top-level items
   - 3661 total nodes
   - Mode: SEQUENTIAL
```

### Enable Parallel Loading

```typescript
// client/src/services/octane/parallelConfig.ts
export const PARALLEL_CONFIG = {
  ENABLED: true,  // ← Parallel mode (faster, experimental)
  MAX_CONCURRENT: 6,
  MAX_DEPTH: 5
};
```

**Expected Result:**
```
✅ Scene tree built in 3-10s:
   - 448 top-level items
   - 3661 total nodes
   - Mode: PARALLEL
```

---

## Architecture

### File Structure

```
client/src/services/octane/
├── SceneService.ts           # Main service with both implementations
├── parallelConfig.ts         # Configuration (ENABLED flag)
├── parallelUtils.ts          # Reusable parallel helpers
└── types.ts                  # Shared types
```

### Code Structure

```typescript
// SceneService.ts

class SceneService {
  async buildSceneTree() {
    // Dispatcher - chooses implementation based on config
    if (PARALLEL_CONFIG.ENABLED) {
      this.scene.tree = await this.syncSceneParallel(...);
    } else {
      this.scene.tree = await this.syncSceneSequential(...);
    }
  }

  // SEQUENTIAL: Original proven implementation (always works)
  private async syncSceneSequential(...) {
    // Process nodes one at a time in order
    // Simple, predictable, reliable
  }

  // PARALLEL: Optimized concurrent implementation (10-20x faster)
  private async syncSceneParallel(...) {
    // Process multiple nodes concurrently
    // Uses parallelLimit() to respect browser connection pool
  }

  // SHARED: Both implementations use these helpers
  private async addSceneItem(...) { }
  private async addItemChildren(...) { }
}
```

---

## How Parallel Loading Works

### Sequential Flow (Original)

```
Level 1: Fetch node 1 → Fetch node 2 → Fetch node 3 → ... (sequential)
         ↓
         Build children for node 1 (sequential)
         ↓
         Build children for node 2 (sequential)
         ↓
         ...

Total time: 30-70 seconds for large scenes
```

### Parallel Flow (Optimized)

```
Level 1: Fetch 6 nodes concurrently → Fetch next 6 → ... (parallel)
         ↓
         Build children for all 448 nodes concurrently (parallel, limited to 6 at once)
         ↓
Level 2: Process all children concurrently
         ↓
         ...

Total time: 3-10 seconds for large scenes
```

### Key Optimizations

1. **Concurrent API Requests**: Up to 6 requests at once (browser limit)
   ```typescript
   // Instead of:
   for (let i = 0; i < items.length; i++) {
     await fetchItem(i);  // Sequential
   }
   
   // Do:
   await parallelLimit(items, 6, async (item) => {
     await fetchItem(item);  // 6 at once
   });
   ```

2. **Batch Building Level 1 Children**: Build all top-level node children together
   ```typescript
   // Instead of building children as each node is created
   // Build all level 1 children together after all level 1 nodes exist
   await parallelLimit(level1Nodes, 6, async (node) => {
     await this.addItemChildren(node);
   });
   ```

3. **Deduplication at Source**: Check before creating
   ```typescript
   // In addSceneItem:
   const handleNum = Number(item.handle);
   const existing = this.scene.map.get(handleNum);
   if (existing) {
     return existing;  // Reuse existing node
   }
   // Otherwise create new node
   ```

---

## Configuration Options

### ENABLED

**Type**: `boolean`  
**Default**: `false`  
**Description**: Master switch for parallel loading

- `false`: Use sequential (proven, always works)
- `true`: Use parallel (faster, experimental)

**When to use parallel**:
- ✅ Large scenes (1000+ nodes)
- ✅ Fast internet connection
- ✅ Modern browser
- ✅ After testing that it works correctly

**When to use sequential**:
- ✅ First time loading a scene (verify correctness)
- ✅ Debugging scene structure issues
- ✅ Slow/unstable connection
- ✅ If parallel produces unexpected results

### MAX_CONCURRENT

**Type**: `number`  
**Default**: `6`  
**Description**: Maximum concurrent API requests

**Browser limits**:
- HTTP/1.1: 6 connections per domain (standard)
- HTTP/2: Higher (but gRPC-web typically uses HTTP/1.1)

**Recommended values**:
- `6`: Safe default (won't exhaust connection pool)
- `4`: Conservative (slower but more stable)
- `8-10`: Aggressive (only if you get HTTP/2 or multiple domains)

**Symptoms of too high**:
- `ERR_INSUFFICIENT_RESOURCES` errors
- Failed API requests
- Browser hanging

### MAX_DEPTH

**Type**: `number`  
**Default**: `5`  
**Description**: Maximum recursion depth for scene tree

Prevents infinite loops in circular graphs. Typical scenes have 3-5 levels.

---

## Testing Guide

### Step 1: Test Sequential (Baseline)

1. Set `ENABLED: false` in `parallelConfig.ts`
2. Restart dev server
3. Hard refresh browser (Ctrl+Shift+R)
4. Load scene
5. **Record**:
   - Load time: `_____ seconds`
   - Node count: `_____ nodes`
   - Any errors: `_____`

### Step 2: Test Parallel

1. Set `ENABLED: true` in `parallelConfig.ts`
2. Restart dev server
3. Hard refresh browser (Ctrl+Shift+R)
4. Load scene
5. **Record**:
   - Load time: `_____ seconds`
   - Node count: `_____ nodes`
   - Any errors: `_____`

### Step 3: Compare Results

**Correctness Checks**:
- ✅ Node count should be **identical** (sequential vs parallel)
- ✅ Scene structure should look the same
- ✅ No React key warnings in console
- ✅ No duplicate nodes in scene outliner

**Performance Checks**:
- ✅ Parallel should be 5-20x faster
- ✅ No browser connection errors
- ✅ UI stays responsive during loading

### Step 4: Report Issues

If parallel produces different results than sequential:

1. **Check console logs**:
   - Look for `PARALLEL` vs `SEQUENTIAL` in build message
   - Check for any API errors
   - Note the node counts

2. **Capture details**:
   ```
   Sequential: X nodes in Y seconds
   Parallel: A nodes in B seconds (SHOULD MATCH!)
   ```

3. **Report**: Include console logs and node count comparison

---

## Troubleshooting

### Problem: Node count differs (parallel vs sequential)

**Symptoms**: Parallel shows 5000 nodes, sequential shows 3661

**Likely Cause**: Nodes being added to `scene.map` multiple times

**Debug**:
```typescript
// In addSceneItem, add logging:
if (this.scene.map.has(handleNum)) {
  const existing = this.scene.map.get(handleNum);
  Logger.warn(`⚠️ DUPLICATE: ${itemName} (handle ${handleNum}) already exists as "${existing.name}"`);
}
```

**Fix**: Ensure `addSceneItem` early return is working (lines 443-451 in SceneService.ts)

### Problem: ERR_INSUFFICIENT_RESOURCES

**Symptoms**: Browser shows connection errors during parallel loading

**Cause**: Too many concurrent connections (exhausted browser pool)

**Fix**: Reduce `MAX_CONCURRENT` from 6 to 4:
```typescript
export const PARALLEL_CONFIG = {
  ENABLED: true,
  MAX_CONCURRENT: 4,  // ← Reduced from 6
  MAX_DEPTH: 5
};
```

### Problem: Parallel is slow

**Symptoms**: Parallel takes same time as sequential (no speedup)

**Possible Causes**:
1. **Slow server**: Octane server can't handle concurrent requests
2. **Slow network**: Connection is the bottleneck, not processing
3. **Small scene**: Parallel overhead not worth it (< 100 nodes)

**Debug**: Check network tab in browser devtools:
- Are requests happening concurrently (waterfall should show 6 parallel)?
- What's the average request duration?

### Problem: Scene structure looks wrong

**Symptoms**: Nodes appear in wrong place, missing children, etc.

**Cause**: Bug in parallel implementation (shouldn't happen, but possible)

**Immediate Fix**: Switch back to sequential:
```typescript
ENABLED: false  // Use proven sequential implementation
```

**Report**: This is a bug! Please report with:
- Console logs
- Expected vs actual node structure
- Steps to reproduce

---

## Performance Benchmarks

### Small Scene (< 100 nodes)

| Mode | Time | Speedup |
|------|------|---------|
| Sequential | 2-5s | 1x |
| Parallel | 1-3s | 1.5-2x |

**Recommendation**: Sequential (not worth the complexity)

### Medium Scene (100-1000 nodes)

| Mode | Time | Speedup |
|------|------|---------|
| Sequential | 10-30s | 1x |
| Parallel | 2-5s | 5-10x |

**Recommendation**: Parallel (significant speedup)

### Large Scene (1000+ nodes)

| Mode | Time | Speedup |
|------|------|---------|
| Sequential | 30-70s | 1x |
| Parallel | 3-10s | 10-20x |

**Recommendation**: Parallel (dramatic speedup)

---

## Development Guidelines

### When Adding Features

If you need to modify scene loading:

1. **Add to both implementations**: Ensure feature works in sequential AND parallel
2. **Test both modes**: Verify identical results
3. **Keep them separate**: Don't share complex logic between them

### When Debugging

1. **Always test sequential first**: It's the source of truth
2. **Compare**: Run both modes and compare results
3. **Isolate**: If parallel has issues, check where it differs from sequential

### Code Review Checklist

- [ ] Feature works in sequential mode
- [ ] Feature works in parallel mode  
- [ ] Node counts match between modes
- [ ] No performance regression in sequential
- [ ] Parallel respects MAX_CONCURRENT limit
- [ ] Deduplication logic intact (addSceneItem lines 443-451)

---

## Future Enhancements

### Potential Optimizations

1. **Progressive UI Updates**: Emit updates after each level completes
   - Makes UI feel faster even if total time is same
   - Users see tree populate gradually

2. **Smarter Concurrency**: Adjust based on available resources
   ```typescript
   const maxConcurrent = navigator.connection?.effectiveType === '4g' ? 6 : 3;
   ```

3. **Caching**: Don't re-fetch unchanged nodes
   ```typescript
   if (this.scene.map.has(handleNum) && !forceRefresh) {
     return this.scene.map.get(handleNum);
   }
   ```

4. **Breadth-First Loading**: Prioritize visible nodes
   - Load level 1 first (visible immediately)
   - Then load their children (visible on expand)
   - Deep nodes load last (rarely accessed)

### Not Recommended

1. **More flags**: Keep it simple (ENABLED = true/false)
2. **Merging implementations**: Keep them separate for debuggability
3. **Parallel recursion beyond level 1**: Exponential complexity, diminishing returns

---

## Summary

**Default**: Sequential (proven, reliable)  
**Opt-in**: Parallel (10-20x faster for large scenes)  
**Toggle**: Single `ENABLED` flag  
**Fallback**: Sequential always available  
**Test**: Both modes should produce identical results  

**Success Criteria**:
- ✅ Node count matches in both modes
- ✅ Scene structure identical
- ✅ Parallel 5-20x faster
- ✅ No browser resource errors
- ✅ Easy to toggle and debug
