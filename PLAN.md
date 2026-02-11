# OctaneWebR UX Optimization Plan

## Executive Summary

After a deep code review of the entire progressive UI pipeline (ProgressiveSceneServiceV3 -> OctaneClient -> useSceneTree -> SceneOutliner/NodeGraph/NodeInspector), I've identified **the core problem** and **multiple optimization opportunities**.

---

## Root Cause Analysis: Why Progressive UI Is "Completely Wrong"

### The Core Bug

**ProgressiveSceneServiceV3 emits `scene:childrenLoaded` only for level-1 (top-level) nodes, but the children it attaches are built via `addItemChildren()` which recursively calls `syncSceneProgressive()` -- meaning by the time children are emitted, the entire deep subtree has already been built synchronously inside the service.** The progressive events fire, but the UI never gets intermediate states.

Specifically in `ProgressiveSceneServiceV3.ts`:

1. **Lines 152-168**: Level-1 owned items are loaded one at a time with `yieldToBrowser()` -- this part works, top-level nodes pop in.
2. **Lines 178-190**: For each level-1 item, `addItemChildren(item)` is called. This calls `syncSceneProgressive()` recursively which builds the ENTIRE subtree depth-first with NO yields and NO events for nested levels.
3. **Lines 335-338**: Inside `addSceneItem()`, when `level > 1`, it immediately calls `addItemChildren(entry)` -- meaning deep children are built inline, never yielded.
4. **Lines 184-186**: After `addItemChildren` returns, it emits `scene:childrenLoaded` for the top-level parent -- but by then the entire subtree is already complete. The UI gets one giant tree dump, not progressive updates.

**Result**: The user sees top-level nodes pop in (good), then a long pause while ALL children for each top-level node are loaded synchronously, then children appear all at once (bad). No intermediate pin/child visibility.

### Secondary Issues

- **`handleChildrenLoaded` in useSceneTree.ts creates a new tree via immutable mapping on every event** -- O(n) tree walk per event, causing cascading re-renders.
- **NodeGraph rebuilds entirely from `sceneTree` prop changes** -- no progressive node insertion.
- **NodeInspector doesn't receive progressive updates** -- it only shows the `selectedNode` which is a stale reference until the tree is fully replaced.
- **The `sceneTreeUpdated` event at line 92 of V3 replaces the ENTIRE tree** after progressive events have already built it, causing a duplicate full re-render.

---

## Staged Plan

### Stage 1: Fix Progressive Emission (Core Fix)
**Goal**: Make nodes actually pop in at ALL levels, not just level 0.

**Changes**:
1. **Rewrite `ProgressiveSceneServiceV3.addItemChildren()`** to yield between each child and emit `scene:childrenLoaded` incrementally:
   - After loading each individual pin/child of a node, yield to browser
   - Emit `scene:childrenLoaded` with the parent and its children-so-far (or the newly added child)
   - For deeper levels (level > 2), batch yields (e.g., every 3-5 children) to avoid excessive event overhead

2. **Rewrite `syncSceneProgressive()` for levels > 1** to yield between items at all levels, not just level 1:
   - Add `yieldToBrowser()` calls after processing each item at any level
   - Emit `scene:nodeAdded` for nodes at all levels (with parent handle) so the UI can add them incrementally
   - Throttle yields for deep levels (level 3+) to every N nodes to balance responsiveness vs speed

3. **Remove the final `sceneTreeUpdated` emission** (line 92) since the tree is already built progressively via events. Instead, emit a `scene:complete` event that tells the UI "you already have the final tree."

**Files modified**:
- `client/src/services/octane/ProgressiveSceneServiceV3.ts`

### Stage 2: Optimize UI Event Consumption
**Goal**: Make the SceneOutliner, NodeGraph, and NodeInspector respond correctly to progressive events.

**Changes**:

1. **Rewrite `handleChildrenLoaded` in `useSceneTree.ts`** to use the scene map for O(1) parent lookup instead of O(n) tree traversal:
   - Since `ProgressiveSceneServiceV3` maintains a `scene.map` (handle -> SceneNode), the emitted `parent` object IS the actual node in the tree (same reference). The UI handler can simply trigger a re-render by bumping a version counter rather than doing an immutable tree walk.
   - Alternatively, use a Map<handle, SceneNode> in React state alongside the tree array, so lookups are O(1).

2. **Remove `flushSync` from level-0 handler** -- `flushSync` forces synchronous re-renders which blocks the event loop. Instead, batch level-0 nodes and update once per animation frame.

3. **Stop the `handleLevel0Complete` from replacing the tree** -- it currently calls `setSceneTree(nodes)` which wipes out any children that may have been added by concurrent `childrenLoaded` events. Instead, just ensure consistency without replacement.

4. **Make NodeGraph respond to progressive events**:
   - Subscribe to `scene:nodeAdded` and `scene:childrenLoaded` in the NodeGraph component
   - Add new ReactFlow nodes as they arrive rather than waiting for full `sceneTree` prop change
   - Update edges incrementally when children (connections) are loaded

5. **Make NodeInspector update when selected node's children change**:
   - The `handleSceneTreeChange` in App.tsx already re-finds the selected node (lines 102-121), but it does a full tree search. Instead, keep a ref to the node's handle and subscribe to events for that handle specifically.

**Files modified**:
- `client/src/components/SceneOutliner/hooks/useSceneTree.ts`
- `client/src/components/NodeGraph/index.tsx`
- `client/src/App.tsx`

### Stage 3: Batch API Calls for Speed
**Goal**: Reduce total load time by parallelizing independent API calls.

**Changes**:

1. **Parallelize per-item metadata fetches in `addSceneItem()`**:
   - Currently, `name`, `outType`, `isGraph`, and `position` are fetched sequentially (4 round trips per node). These are independent and can be `Promise.all`'d into 1 round trip.
   - Same for `graphInfo`/`nodeInfo` which can be fetched alongside the above.

2. **Parallelize owned item loading**:
   - In the graph branch, after getting the owned items array handle and size, fetch multiple items concurrently (e.g., 4 at a time using the `RequestQueue`) instead of one at a time.

3. **Parallelize pin loading**:
   - In the node branch, `connectedNodeIx` and `pinInfoIx` for each pin are independent across pins. Load N pins concurrently.

4. **Use `RequestQueue` from `utils/RequestQueue.ts`**:
   - The queue already exists with maxConcurrent=4 but is NOT used anywhere in the scene loading pipeline. Wire it into `ApiService.callApi()` or use it directly in the progressive service.

**Files modified**:
- `client/src/services/octane/ProgressiveSceneServiceV3.ts`
- Possibly `client/src/services/octane/ApiService.ts`

### Stage 4: Reduce React Re-render Overhead
**Goal**: Minimize unnecessary re-renders during progressive loading.

**Changes**:

1. **Use `useRef` + manual re-render trigger instead of `useState` for the scene tree**:
   - Currently every `setSceneTree()` call triggers a full re-render of SceneOutliner, which triggers `flattenTree()`, which triggers `react-window` invalidation.
   - Instead, store the tree in a ref and use a counter state to trigger re-renders at a controlled rate (e.g., max once per 100ms during loading via `requestAnimationFrame`).

2. **Debounce `onSceneTreeChange` callbacks**:
   - App.tsx's `handleSceneTreeChange` is called via `setTimeout(0)` for every single `childrenLoaded` event. During a 200-node scene load, this fires 200 times. Debounce to fire at most every 100-200ms during loading.

3. **Memoize `convertSceneToGraph` output** in NodeGraph:
   - Currently rebuilds the entire ReactFlow node/edge arrays whenever `sceneTree` changes. Use incremental updates instead.

4. **Avoid re-creating synthetic root on every render** in `useTreeExpansion`:
   - The synthetic `SceneRoot` wrapper is created fresh in every `useMemo` call. This is lightweight but causes `flattenTree` to always re-run. Consider stabilizing the reference.

**Files modified**:
- `client/src/components/SceneOutliner/hooks/useSceneTree.ts`
- `client/src/components/SceneOutliner/hooks/useTreeExpansion.ts`
- `client/src/components/NodeGraph/index.tsx`
- `client/src/App.tsx`

### Stage 5: Clean Up Dead Code and Feature Flags
**Goal**: Remove confusion from deprecated V1/V2 code and simplify the codebase.

**Changes**:

1. **Remove V1 and V2 progressive services entirely**:
   - Delete `ProgressiveSceneService.ts` (V1)
   - Delete `ProgressiveSceneServiceV2.ts` (V2)
   - Delete `LoadingScheduler.ts` (V2 only)
   - Remove from `OctaneClient.ts` constructor and imports

2. **Remove V1/V2 feature flags and conditional branches**:
   - Simplify `features.ts` to just V3 (rename to `PROGRESSIVE_LOADING`)
   - Remove all `FEATURES.PROGRESSIVE_LOADING` and `FEATURES.PROGRESSIVE_LOADING_V2` checks from `useSceneTree.ts`, `OctaneClient.ts`, `App.tsx`

3. **Remove `useProgressiveScene.ts` hook** -- it's V1-only and unused by the actual component tree (SceneOutliner uses `useSceneTree` instead).

4. **Clean up excessive debug logging** -- the scene loading pipeline has ~50 `Logger.debug`/`Logger.info` calls that clutter the console. Reduce to key milestones only.

**Files modified/deleted**:
- Delete: `client/src/services/octane/ProgressiveSceneService.ts`
- Delete: `client/src/services/octane/ProgressiveSceneServiceV2.ts`
- Delete: `client/src/services/octane/LoadingScheduler.ts`
- Delete: `client/src/hooks/useProgressiveScene.ts`
- Modify: `client/src/services/OctaneClient.ts`
- Modify: `client/src/config/features.ts`
- Modify: `client/src/components/SceneOutliner/hooks/useSceneTree.ts`
- Modify: `client/src/App.tsx`

---

## Priority & Dependencies

```
Stage 1 (Core Fix) ──> Stage 2 (UI Consumption) ──> Stage 3 (API Parallelization)
                                                  ──> Stage 4 (Re-render Optimization)
                                                  ──> Stage 5 (Cleanup)
```

- **Stage 1 is the critical fix** -- without it, nothing else matters
- **Stage 2 makes the fix visible** across all panels
- **Stages 3 & 4 are independent optimizations** that can be done in parallel
- **Stage 5 is housekeeping** that reduces confusion but doesn't change behavior

## Expected Impact

| Stage | UX Improvement |
|-------|---------------|
| 1 | Nodes pop in at all tree depths, not just top level |
| 2 | All panels (Outliner, NodeGraph, Inspector) update progressively |
| 3 | 2-4x faster total load time (parallel API calls) |
| 4 | Smoother UI during load (fewer jank frames from excessive re-renders) |
| 5 | Cleaner codebase, easier to debug and maintain |
