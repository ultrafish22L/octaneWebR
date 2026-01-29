# Phase 1: Parallel Scene Loading Optimization

**Status**: ✅ IMPLEMENTED  
**Date**: 2025-02-01  
**Impact**: Expected 10-100x speedup for scene loading

---

## Overview

Converted sequential scene tree building to parallel/concurrent API fetching. This is the biggest performance optimization opportunity for octaneWebR's scene synchronization with Octane.

### Problem

Previously, the code made API calls **sequentially** in nested loops:
```typescript
for (let i = 0; i < 100 nodes; i++) {
  const name = await getName(i);      // Wait
  const type = await getType(i);      // Wait
  const info = await getInfo(i);      // Wait
  // ... 5-10 calls per node
}
// Total: 500-1000 sequential API calls = 5-50 seconds! 😱
```

### Solution

Fetch data in parallel with controlled concurrency:
```typescript
const results = await parallelLimit(nodes, 50, async (node) => {
  const [name, type, info] = await Promise.all([
    getName(node),
    getType(node), 
    getInfo(node)
  ]);
  return { name, type, info };
});
// Total: ~1-2 seconds with 50 concurrent requests! 🚀
```

---

## Changes Made

### 1. Created Parallel Async Utilities

**File**: `client/src/utils/parallelAsync.ts`

**Functions**:
- `parallelLimit()` - Execute functions with concurrency limit
- `parallelLimitSettled()` - Same but with error resilience (uses `Promise.allSettled`)
- `batchProcess()` - Process items in batches
- `executeParallel()` - High-level wrapper with config

**Features**:
- ✅ Controlled concurrency (prevents overwhelming server)
- ✅ Error resilience (continues on failures)
- ✅ Maintains result order
- ✅ TypeScript generic types

**Example**:
```typescript
const results = await parallelLimitSettled(
  items,
  50,  // Max 50 concurrent
  async (item) => fetchData(item)
);

results.forEach((result, i) => {
  if (result.status === 'fulfilled') {
    processData(result.value);
  } else {
    Logger.warn(`Item ${i} failed:`, result.reason);
  }
});
```

---

### 2. Refactored SceneService for Parallel Loading

**File**: `client/src/services/octane/SceneService.ts`

#### Configuration Constants
```typescript
const PARALLEL_CONFIG = {
  MAX_CONCURRENT_REQUESTS: 50,  // Optimal for localhost gRPC
  MAX_CONCURRENT_ITEMS: 50,
  MAX_CONCURRENT_PINS: 50,
};
```

#### Optimization Areas

##### A. Parallel Metadata Fetching in `addSceneItem()`

**Before** (Sequential):
```typescript
const name = await getName(handle);
const type = await getType(handle);
const isGraph = await getIsGraph(handle);
const position = await getPosition(handle);
// 4 sequential calls = 40-200ms
```

**After** (Parallel):
```typescript
const [name, type, isGraph, position] = await Promise.all([
  getName(handle),
  getType(handle),
  getIsGraph(handle),
  getPosition(handle)
]);
// All 4 parallel = 10-50ms
```

**Speedup**: ~4x per node

---

##### B. Parallel Owned Items Fetching in `syncSceneRecurse()`

**Before** (Sequential):
```typescript
for (let i = 0; i < 100 items; i++) {
  const item = await getItem(i);
  await processItem(item);
}
// 100 sequential iterations
```

**After** (Parallel):
```typescript
const itemResults = await parallelLimitSettled(
  Array.from({length: 100}, (_, i) => i),
  50,  // 50 concurrent
  async (index) => {
    const item = await getItem(index);
    return { index, item };
  }
);
// Process all 100 items with max 50 concurrent
```

**Speedup**: ~50x for 100 items

---

##### C. Parallel Children Building

**Before** (Sequential):
```typescript
for (const item of sceneItems) {
  await addItemChildren(item);
  await delay(50ms);  // Artificial delay!
}
```

**After** (Parallel):
```typescript
await parallelLimitSettled(
  sceneItems,
  50,
  async (item) => await addItemChildren(item)
);
// No artificial delays needed
```

**Speedup**: ~50x + eliminates delays

---

##### D. Parallel Pin Fetching

**Before** (Sequential):
```typescript
for (let i = 0; i < pinCount; i++) {
  const connected = await getConnectedNode(i);
  const pinInfoHandle = await getPinInfoHandle(i);
  const pinInfo = await getPinInfo(pinInfoHandle);
  // 3 sequential calls per pin
}
```

**After** (Parallel):
```typescript
const pinResults = await parallelLimitSettled(
  Array.from({length: pinCount}, (_, i) => i),
  50,
  async (pinIndex) => {
    // Fetch connected and pinInfoHandle in parallel
    const [connected, pinInfoHandle] = await Promise.all([
      getConnectedNode(pinIndex),
      getPinInfoHandle(pinIndex)
    ]);
    const pinInfo = await getPinInfo(pinInfoHandle);
    return { connected, pinInfo };
  }
);
```

**Speedup**: ~25-50x depending on pin count

---

### 3. Performance Logging

Added timing measurements to track improvements:

```typescript
const startTime = performance.now();
// ... build scene tree ...
const duration = ((performance.now() - startTime) / 1000).toFixed(2);

Logger.success(`✅ Scene tree built in ${duration}s:`);
Logger.success(`   - ${nodeCount} nodes`);
Logger.success(`   - Concurrency: ${MAX_CONCURRENT} parallel requests`);
```

---

## Expected Performance Improvements

### Theoretical Speedup Calculation

**Assumptions**:
- 100 nodes in scene
- 5 API calls per node (metadata)
- 10 pins average per node
- 3 API calls per pin
- Average latency: 20ms per call

**Before (Sequential)**:
```
Metadata: 100 nodes × 5 calls × 20ms = 10,000ms (10s)
Pins:     100 nodes × 10 pins × 3 calls × 20ms = 60,000ms (60s)
Total:    70 seconds
```

**After (Parallel with 50 concurrent)**:
```
Metadata: 100 nodes × 5 calls / 50 concurrent × 20ms = 200ms
Pins:     100 nodes × 10 pins × 3 calls / 50 concurrent × 20ms = 1,200ms
Total:    ~1.5 seconds
```

**Speedup**: **70s → 1.5s = 47x faster!** 🚀

### Real-World Expected Results

| Scene Size | Before | After | Speedup |
|------------|--------|-------|---------|
| 10 nodes   | 3s     | 0.3s  | 10x     |
| 50 nodes   | 15s    | 0.8s  | 19x     |
| 100 nodes  | 30s    | 1.5s  | 20x     |
| 500 nodes  | 150s   | 7s    | 21x     |
| 1000 nodes | 300s   | 15s   | 20x     |

**Note**: Actual results depend on:
- Network latency (local vs remote gRPC)
- Server processing capacity
- Scene complexity (pins per node)
- Hardware performance

---

## Error Resilience

All parallel operations use `Promise.allSettled()` to handle failures gracefully:

```typescript
const results = await parallelLimitSettled(items, 50, fetchNode);

results.forEach((result, i) => {
  if (result.status === 'fulfilled') {
    processNode(result.value);
  } else {
    Logger.warn(`Failed to load node ${i}:`, result.reason);
    // Continue processing other nodes
  }
});
```

**Benefits**:
- ✅ One failed API call doesn't break entire tree loading
- ✅ Partial scene data is still usable
- ✅ User sees maximum available data
- ✅ Failed nodes logged for debugging

---

## Concurrency Control

### Why Limit Concurrency?

Without limits, 1000 nodes = 5000 simultaneous requests:
- ❌ Server overload (CPU/memory)
- ❌ Network saturation
- ❌ Browser stalls
- ❌ Rate limiting kicks in

### Optimal Limits

```typescript
const OPTIMAL_CONCURRENCY = {
  localhost: 50-100,   // Local gRPC server
  LAN: 20-50,          // Same network
  WAN: 5-10,           // Remote server
};
```

**Current setting**: 50 (optimal for localhost gRPC)

Can be tuned in `PARALLEL_CONFIG` constant based on deployment:
```typescript
const PARALLEL_CONFIG = {
  MAX_CONCURRENT_REQUESTS: 50,  // Adjust based on testing
};
```

---

## Testing Checklist

### Manual Testing

1. **Start Octane with scene**
   ```bash
   # Load teapot.orbx or any test scene
   ```

2. **Start octaneWebR**
   ```bash
   npm run dev
   ```

3. **Open browser and monitor console**
   - Look for: `✅ Scene tree built in X.XXs`
   - Compare to previous load times
   - Check for errors/warnings

4. **Test various scene sizes**
   - Small (10 nodes)
   - Medium (50-100 nodes)
   - Large (500+ nodes)

5. **Verify UI functionality**
   - Scene outliner loads correctly
   - Node graph displays all nodes
   - Node inspector shows parameters
   - No missing/duplicate nodes

### Error Testing

1. **Disconnect Octane mid-load**
   - Should handle gracefully
   - Show partial data
   - Log warnings

2. **Load corrupted scene**
   - Should skip bad nodes
   - Continue loading good nodes

3. **Check browser console**
   - No unhandled promise rejections
   - Clear error messages

---

## Configuration Tuning

### Adjusting Concurrency

Edit `PARALLEL_CONFIG` in `SceneService.ts`:

```typescript
const PARALLEL_CONFIG = {
  MAX_CONCURRENT_REQUESTS: 50,   // Increase for faster local
  MAX_CONCURRENT_ITEMS: 100,     // Decrease for slow networks
  MAX_CONCURRENT_PINS: 50,       // Tune based on testing
};
```

**Symptoms of too high**:
- Server errors (500)
- Octane becomes unresponsive
- Browser tab freezes

**Symptoms of too low**:
- Loading still slow
- Not utilizing available bandwidth
- Sequential-like behavior

**Recommended tuning approach**:
1. Start with 50 (default)
2. Test scene load time
3. Increase to 75, test again
4. Continue until no improvement or errors appear
5. Back off 10-20% for safety margin

---

## Monitoring and Metrics

### Console Logs to Watch

```
🌳 Building scene tree (PARALLEL MODE)...
📦 Level 1: Found 50 owned items - fetching in parallel...
✅ Level 1: Added 50/50 owned items
🔄 Building children for 50 level 1 items in parallel...
✅ Finished building children: 50/50 successful
✅ Scene tree built in 1.23s:
   - 50 top-level items
   - 243 total nodes
   - Concurrency: 50 max parallel requests
```

### Performance Metrics

Track these over time:
- **Load time**: Target < 2s for typical scenes
- **Node count**: Verify all nodes loaded
- **Success rate**: Should be >95%
- **Failed requests**: Should be minimal (<5%)

---

## Next Steps (Future Phases)

### Phase 2: Progressive UI Updates (Estimated 2-3 days)
- Emit incremental scene updates
- Show loading skeletons
- Prioritize visible nodes
- **Expected improvement**: Time to first visible node < 0.5s

### Phase 3: Static Metadata Cache (Estimated 1-2 days)
- Cache node type definitions
- LocalStorage persistence
- **Expected improvement**: 30-40% reduction in API calls

### Phase 4: Lazy Loading (Estimated 2-3 days)
- Load only expanded branches
- Virtual scrolling
- **Expected improvement**: Scales to infinite scene size

---

## Rollback Plan

If issues arise, revert changes:

```bash
git log --oneline | grep "Phase 1"
# Find commit hash before Phase 1
git revert <commit-hash>
```

Or manually:
1. Remove `parallelAsync.ts`
2. Restore original `SceneService.ts` from git history
3. Rebuild and restart

---

## Code Review Notes

### Key Design Decisions

1. **Why `parallelLimitSettled` instead of `Promise.all`?**
   - Prevents one failure from breaking entire load
   - Provides detailed error info per item
   - More resilient for production

2. **Why maintain item order?**
   - Scene tree structure depends on order
   - Easier debugging (indices match)
   - Predictable UI rendering

3. **Why not parallelize `addSceneItem` calls?**
   - Each modifies shared `scene.map`
   - Potential race conditions
   - Minimal time vs metadata fetching
   - Can be optimized in Phase 2

4. **Why separate concurrency limits for items/pins?**
   - Allows independent tuning
   - Different optimal values
   - Future: dynamic adjustment based on load

---

## References

- **GraphQL DataLoader**: Batching pattern inspiration
- **React Query**: Parallel query patterns
- **Octane gRPC API**: See `server/proto/` for method definitions
- **Performance API**: [`performance.now()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now)

---

**Implemented by**: AI Assistant  
**Reviewed by**: [Pending]  
**Status**: Ready for testing  
**Version**: octaneWebR v1.1.0-parallel
