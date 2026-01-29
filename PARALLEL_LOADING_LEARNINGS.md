# Parallel Loading Implementation - Learnings & Redesign

## Executive Summary

This document captures lessons learned from the initial parallel loading implementation (commits up to ~2e35b5b), which improved scene loading from 30-70s down to ~23s, but introduced node duplication bugs and complexity that made debugging difficult.

**Decision**: Revert and re-implement with a cleaner architecture that keeps the original sequential pathway intact.

---

## What We Learned

### ✅ What Worked

1. **Parallel API Requests**: Using `parallelLimit()` to make concurrent gRPC calls dramatically improved performance
   - From 30-70s sequential → 23s parallel
   - 6 concurrent requests was a good balance (didn't exhaust connection pool)
   
2. **Batch Building Level 1 Children**: Instead of building each top-level node's children individually, batch them all together
   - Reduced recursion depth
   - Better parallelization opportunities
   
3. **Progressive Loading**: Emitting UI updates as top-level nodes loaded (before children) made the app feel more responsive
   - Users saw the scene tree populate immediately
   - Perception of speed even if total time was similar

4. **Connection Pool Management**: Fixed browser `ERR_INSUFFICIENT_RESOURCES` by limiting concurrent requests
   - Browser default: ~6 connections per domain
   - Our limit: 6 concurrent with keepalive
   - Result: Stable, no connection exhaustion

### ❌ What Didn't Work

1. **Complex Multi-Path Building**: Having BOTH individual building AND batch building paths caused duplication
   - Level 2+ nodes had children built twice (individual + batch)
   - Hard to track which path was executing
   - Flag-based prevention (`childrenLoaded`) was fragile
   
2. **Too Many Configuration Flags**: 
   ```typescript
   ENABLE_PARALLEL_LOADING
   ENABLE_PROGRESSIVE_LOADING  
   ENABLE_PRIORITIZED_LOADING (breadth-first)
   ```
   - Interactions between flags were complex
   - Hard to reason about which code path would execute
   - Debugging required tracing through multiple conditions

3. **Interleaved Sequential/Parallel Code**: The original sequential code was modified in-place
   - Lost the simple, working baseline
   - Couldn't easily toggle back to sequential for debugging
   - Made it hard to isolate parallel-specific bugs

4. **Duplicate Node Detection Was Reactive**: Tried to prevent duplication with flags after the fact
   - `childrenLoaded` flag checked too late
   - Didn't address root cause (multiple build paths)
   - Still saw 5616 nodes instead of 3661

---

## Root Causes of Issues

### Issue: Duplicate Nodes (5616 instead of 3661)

**Symptom**: React warnings about duplicate keys, scene outliner showing duplicate entries

**Root Cause**: Two separate code paths building the same children:

```typescript
// Path 1: Individual building (in addSceneItem)
if (level > 1) {
  await this.addItemChildren(entry);  // Builds children
}

// Path 2: Batch building (in syncSceneRecurse)  
if (shouldBatchBuildChildren) {
  await parallelLimitSettled(sceneItems, async (item) => {
    await this.addItemChildren(item);  // Builds children AGAIN
  });
}
```

With `ENABLE_PRIORITIZED_LOADING=true`, **both paths executed**, creating duplicates.

**Attempted Fix**: Added `willBatchBuildChildren` check to skip individual building
**Result**: Reduced from 7424 → 5616 but still not correct (3661)

**Why It Failed**: Even with the check, handles were still being added to `scene.map` multiple times. The issue was deeper than just the two obvious paths.

---

## Redesign Principles

### 1. **Keep Original Sequential Path Intact**

Don't modify the working sequential code. Keep it as a fallback:

```typescript
// Original sequential (ALWAYS WORKS)
private async syncSceneSequential(...) {
  // Simple, proven logic
  // No flags, no complexity
}

// New parallel wrapper (OPTIONAL)
private async syncSceneParallel(...) {
  // Delegates to sequential for correctness checks
  // Only adds parallelism at safe points
}
```

### 2. **Single Build Path Per Node**

Each node's children should be built by **exactly one** code path:

```typescript
// EITHER batch build at level N...
await batchBuildChildren(allLevelNNodes);

// OR let each node build its own children...
for (node of nodes) {
  await node.buildChildren();
}

// NEVER BOTH
```

### 3. **Explicit Over Implicit**

No hidden flag interactions. Make it obvious what's happening:

```typescript
// BAD (implicit)
if (PARALLEL && (level === 1 || PRIORITIZED)) {
  // What does this do?
}

// GOOD (explicit)
if (useParallelLoading) {
  await this.syncSceneParallel(handle, sceneItems, isGraph, level);
} else {
  await this.syncSceneSequential(handle, sceneItems, isGraph, level);
}
```

### 4. **Testable in Isolation**

Should be able to:
- Test sequential path alone
- Test parallel path alone  
- Compare results for equality
- Easily toggle between them

---

## New Implementation Plan

### Architecture

```
SceneService
├── syncScene() 
│   ├── if (ENABLE_PARALLEL) → syncSceneParallel()
│   └── else → syncSceneSequential()
│
├── syncSceneSequential()  [ORIGINAL, PROVEN]
│   ├── getChildren()
│   ├── for each child: addSceneItem()
│   └── for each child: syncSceneSequential() [RECURSE]
│
└── syncSceneParallel()    [NEW, OPTIMIZED]
    ├── getChildren()
    ├── parallelLimit(children, addSceneItem)  [PARALLEL]
    └── parallelLimit(children, syncSceneParallel) [PARALLEL RECURSE]
```

### Key Changes from Original Parallel Approach

1. **Separate Functions**: `syncSceneSequential` vs `syncSceneParallel`
   - No shared code paths
   - No flag-based branching
   - Easy to compare and debug

2. **Single Configuration Flag**: `ENABLE_PARALLEL_LOADING` (boolean)
   - No complex interactions
   - On/off switch
   - Falls back to proven sequential

3. **Parallel Only at Safe Points**: 
   - When processing children at the same level
   - Never parallel across parent/child relationships
   - Maintains tree consistency

4. **Deduplication at Source**: Use `scene.map` to check if node already exists BEFORE creating
   ```typescript
   // Check first
   if (this.scene.map.has(handleNum)) {
     return this.scene.map.get(handleNum);  // Reuse existing
   }
   
   // Create only if new
   const entry = { ... };
   this.scene.map.set(handleNum, entry);
   ```

### Implementation Steps

#### Phase 1: Revert to Clean State
1. Find commit before parallel work started
2. Revert to that commit
3. Verify sequential loading still works
4. Create new branch for clean parallel implementation

#### Phase 2: Add Parallel Wrapper (No Behavior Change)
1. Rename current `syncSceneRecurse` → `syncSceneSequential`
2. Create `syncSceneParallel` as wrapper calling sequential
3. Add `ENABLE_PARALLEL_LOADING` flag (defaults to false)
4. Test: Verify behavior identical

#### Phase 3: Parallelize Children Processing
1. In `syncSceneParallel`, replace:
   ```typescript
   // Sequential
   for (const child of children) {
     await addSceneItem(child);
   }
   
   // Parallel
   await parallelLimit(children, 6, async (child) => {
     await addSceneItem(child);
   });
   ```
2. Test: Verify node count correct
3. Measure: Compare timing

#### Phase 4: Parallelize Recursion
1. In `syncSceneParallel`, replace:
   ```typescript
   // Sequential
   for (const child of children) {
     await syncSceneParallel(child);
   }
   
   // Parallel
   await parallelLimit(children, 6, async (child) => {
     await syncSceneParallel(child);
   });
   ```
2. Test: Verify tree structure correct
3. Measure: Final timing

#### Phase 5: Add Progressive Loading (Optional)
1. Emit UI updates after each level completes
2. Only if `ENABLE_PARALLEL_LOADING` is true
3. Test: Verify no duplication

---

## Success Criteria

### Correctness
- ✅ Node count matches Octane standalone (3661 nodes)
- ✅ No duplicate handles in `scene.map`
- ✅ No React key warnings
- ✅ Scene tree structure matches sequential build

### Performance  
- ✅ Load time < 5s (target: 1-3s)
- ✅ No browser connection pool exhaustion
- ✅ Responsive UI during loading

### Maintainability
- ✅ Can toggle parallel on/off with single flag
- ✅ Sequential path always available as fallback
- ✅ Easy to debug (separate code paths)
- ✅ Clear, documented code

---

## Technical Debt from Old Implementation

### Files to Clean Up
- `LARGE_SCENE_FIXES.md` - Contains fixes for bugs introduced by complexity
- Multiple debug logging statements scattered throughout
- `childrenLoaded` flag that shouldn't be necessary

### Commits to Revert
Find the commit before parallel work started (likely around when `syncScene` was still simple), then:
```bash
git log --oneline --graph
# Find last good commit
git revert <commit-range>
# Or reset to clean state
git reset --hard <last-good-commit>
```

---

## Conclusion

The initial parallel implementation achieved good performance gains (30-70s → 23s) but introduced complexity that made it fragile and hard to debug. 

By starting fresh with:
- Separate sequential/parallel paths
- Single configuration flag
- Deduplication at source
- Testable in isolation

We can achieve the same or better performance with much better maintainability and correctness.

**Next Step**: Find the commit before parallel work and start the clean reimplementation.
