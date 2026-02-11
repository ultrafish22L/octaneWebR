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
**Goal**: Make nodes pop in at ALL levels with a two-pass visibility-aware approach, and progressively show pins as they load.

#### The Problem Restated
Currently `addItemChildren()` recursively builds an entire subtree depth-first with zero yields and zero events. The user sees top-level nodes appear, then a long freeze, then everything else appears at once. Most of the frozen time is spent loading deep children that aren't even visible (collapsed in the Outliner, not shown in NodeGraph, irrelevant to NodeInspector until selected).

#### Design: Two-Pass Loading with Per-Pin Emission

**Pass 1 — Visible/Structural (fast, yields to UI after every node)**:
1. Load all level-1 nodes with full metadata (name, outType, isGraph, position, nodeInfo/graphInfo). Emit `scene:nodeAdded` + yield after each. *(Already works.)*
2. Emit `scene:level0Complete`.
3. For each level-1 node, load its **immediate children (pins)** one at a time:
   - For each pin: fetch `connectedNodeIx` + `pinInfoIx` + `getApiNodePinInfo`, create the child SceneNode, **append it to parent.children**, then **emit `scene:pinAdded`** (new event: `{ parent, child, pinIndex }`).
   - Yield to browser after each pin so the Outliner/Inspector show pins popping in one by one.
   - Do NOT recurse into the child's own children yet — just create the node with `children: []`.
   - After all pins for a parent are loaded, emit `scene:childrenLoaded` for that parent (signals "this node's direct children are complete").
4. At the end of Pass 1, emit `scene:structureComplete` — the full level-1 + level-2 skeleton is in place. All panels can render a meaningful tree.

**Pass 2 — Deep/Background (non-visible nodes, no UI urgency)**:
5. Build a work queue of all level-2 nodes that need their own children loaded (nodes where `isGraph || pinCount > 0`).
6. Process this queue breadth-first. For each node:
   - Load its children (pins or owned items) using the same per-pin emit pattern as Pass 1.
   - Yield to browser every N children (e.g., every 3-5) rather than every single one — these nodes are typically collapsed/invisible, so we trade per-node feedback for throughput.
   - Emit `scene:childrenLoaded` for each parent after its children complete.
   - If a node becomes visible mid-load (user expands it in Outliner or selects it in Inspector), promote it to the front of the queue.
7. After all deep nodes are done, emit `scene:complete`.

**Pass 2 can also be interrupted**: if the user triggers a scene refresh or loads a new file, the existing `abortController` cancels in-flight work.

#### Key Changes in `ProgressiveSceneServiceV3.ts`

1. **Split `syncSceneProgressive()` into two phases**: `loadImmediateChildren()` (Pass 1) and `loadDeepChildren()` (Pass 2).

2. **New `loadImmediateChildren(parent)`** method:
   - If parent is a graph: get owned items, iterate, create each child node, emit `scene:pinAdded`, yield.
   - If parent is a node: get pin count, iterate pins, load connectedNode + pinInfo, create child node, emit `scene:pinAdded`, yield.
   - Does NOT recurse — children are created with `children: []`.

3. **New `loadDeepChildren()` method**:
   - Takes a queue of nodes from Pass 1 that need deeper loading.
   - Processes breadth-first.
   - Calls `loadImmediateChildren()` for each, with reduced yield frequency (every 3-5 children).
   - Supports priority promotion via `promoteNode(handle)`.

4. **Remove the inline `addItemChildren(entry)` call at line 336** (`addSceneItem` level > 1). Instead, just create the node and add it to the deep-load queue.

5. **New event: `scene:pinAdded`** — lightweight event for single-pin additions:
   ```ts
   { parent: SceneNode, child: SceneNode, pinIndex: number }
   ```
   This is the key to per-pin progressive display. The UI can append a single child to a parent without rebuilding the whole tree.

6. **Remove the final `sceneTreeUpdated` emission** (line 92). The tree is already built via events. Emit `scene:complete` instead.

7. **`addSceneItem()` no longer calls `addItemChildren()` for level > 1** — it just creates the node entry with `children: []` and registers it in `scene.map`. The deep-load queue handles populating children later.

#### Visibility-Awareness

The service doesn't need to know the UI expansion state directly. The two-pass design naturally handles it:
- **Pass 1** loads what's always visible: level-1 nodes (NodeGraph, Outliner root) and their immediate pins (NodeInspector when selected, Outliner when expanded).
- **Pass 2** loads everything else in the background.
- A `promoteNode(handle)` API lets the UI signal "user just expanded/selected this node, load its children next" — the service moves that node to the front of the deep-load queue.

#### attrInfo Loading
- **Pass 1**: Load attrInfo for level-1 nodes (they're visible in Inspector immediately if selected).
- **Pass 2**: Load attrInfo for deeper nodes as they're processed. Emit `scene:nodeUpdated` with the updated attrInfo so the Inspector can refresh if showing that node.
- The existing `LAZY_ATTR_INFO` flag can gate whether attrInfo is loaded eagerly (in the pass) or only on selection.

**Files modified**:
- `client/src/services/octane/ProgressiveSceneServiceV3.ts`

### Stage 2: Optimize UI Event Consumption
**Goal**: Make the SceneOutliner, NodeGraph, and NodeInspector respond correctly to progressive events, including the new `scene:pinAdded` event and visibility promotion.

**Changes**:

1. **Handle new `scene:pinAdded` event in `useSceneTree.ts`**:
   - This is the per-pin incremental update. Handler appends a single child to the parent node.
   - Use the emitted `parent` reference (same object in the service's tree) to avoid O(n) lookup.
   - Bump a version counter to trigger re-render rather than doing immutable tree mapping for each pin.
   - Throttle re-renders: collect pin additions in a microtask batch and flush once per animation frame.

2. **Rewrite `handleChildrenLoaded`** to be a lightweight "children complete" signal:
   - Since individual pins are already added via `scene:pinAdded`, `childrenLoaded` just confirms "all direct children are done for this parent."
   - Trigger a single re-render if one hasn't already fired, and update expansion state.

3. **Remove `flushSync` from level-0 handler** -- `flushSync` forces synchronous re-renders which blocks the event loop. Instead, batch level-0 nodes and update once per animation frame.

4. **Stop `handleLevel0Complete` from replacing the tree** -- it currently calls `setSceneTree(nodes)` which wipes out children that may have been added by concurrent events. Instead, just ensure consistency without full replacement.

5. **Make NodeGraph respond to progressive events**:
   - Subscribe to `scene:nodeAdded` in NodeGraph to add ReactFlow nodes as they arrive (level-1 only — NodeGraph only shows top-level).
   - Subscribe to `scene:childrenLoaded` to update edges: when a level-1 node's children (pins/connections) are fully loaded, rebuild edges for just that node.
   - No need to listen to `scene:pinAdded` — NodeGraph only cares about complete connection info.

6. **Make NodeInspector update on per-pin additions**:
   - When the selected node receives `scene:pinAdded` events, the Inspector should show each pin popping in.
   - Subscribe to `scene:pinAdded` and `scene:nodeUpdated` (for attrInfo) filtered by the currently selected node's handle.
   - When the user selects a node whose deep children haven't loaded yet (Pass 2 pending), call `client.promoteNode(handle)` to prioritize loading that subtree.

7. **Visibility promotion from SceneOutliner**:
   - When the user expands a node in the Outliner, if that node's children are `[]` (not yet loaded by Pass 2), call `client.promoteNode(handle)` to move it to the front of the deep-load queue.
   - Show a subtle loading indicator (e.g., skeleton children) while waiting for the promoted node's children to arrive.

**Files modified**:
- `client/src/components/SceneOutliner/hooks/useSceneTree.ts`
- `client/src/components/SceneOutliner/hooks/useTreeExpansion.ts` (promote on expand)
- `client/src/components/NodeGraph/index.tsx`
- `client/src/components/NodeInspector/index.tsx` (per-pin updates)
- `client/src/App.tsx`
- `client/src/services/OctaneClient.ts` (expose `promoteNode()`)

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
| 1 | Pass 1: Level-1 nodes + their pins pop in individually. Pass 2: Deep children load in background without blocking UI. Expanding a not-yet-loaded node promotes it to load immediately. |
| 2 | All panels update progressively: Outliner shows pins appearing one by one, NodeGraph adds edges as connections resolve, Inspector shows pins filling in for the selected node. |
| 3 | 2-4x faster total load time (parallel API calls reduce sequential round-trips) |
| 4 | Smoother UI during load (fewer jank frames from throttled re-renders) |
| 5 | Cleaner codebase, easier to debug and maintain |
