# Progressive UI Scene Loading - Optimization Plan (Revised)

## Status

The V3 two-pass service (`ProgressiveSceneServiceV3.ts`) was implemented in the previous iteration and has solid fundamentals: correct tree structure, per-pin emission, two-pass loading, deduplication, and `promoteNode()` API. However, the **UI consumption layer** has critical bugs that make progressive updates produce wrong/incomplete UI across all panels.

---

## Root Cause Analysis: Why Progressive UI Is "Completely Wrong"

### Bug 1: `handlePinAdded` never propagates to App.tsx
**`useSceneTree.ts:266-270`**

The V3 `handlePinAdded` handler does `setSceneTree(prev => [...prev])` - a shallow copy that triggers the Outliner to re-render, but **never calls `onSceneTreeChange`**. That callback is what propagates the tree to App.tsx, which feeds NodeInspector and NodeGraphEditor. During Pass 1, the Outliner may show partial updates but the other two panels see **nothing** until `scene:childrenLoaded` fires for each parent.

### Bug 2: Mutation-in-place defeats React change detection
**`useSceneTree.ts:277-293` + `ProgressiveSceneServiceV3.ts:250,302`**

The V3 service **mutates** `parent.children` in place (pushes children directly onto the array). Then `handleChildrenLoadedV3` does `const updated = [...prev]` — a shallow copy of the root array. All node objects keep the **same references**. When App.tsx receives this via `onSceneTreeChange` and searches for `selectedNode` by handle, it finds the identical object. React sees no reference change → **NodeInspector doesn't re-render** with the new children.

### Bug 3: NodeGraphEditor skips rebuild during progressive loading
**`NodeGraph/index.tsx:332-357`**

The sceneTree useEffect checks `if (currentNodes.length < sceneTree.length && currentNodes.length > 0)` and skips rebuild, assuming the `nodeAdded` event handler is managing it. But progressive events (`scene:pinAdded`, `scene:childrenLoaded`) are **different events** than `nodeAdded`. The NodeGraphEditor doesn't listen to progressive events at all. It only rebuilds when array lengths happen to match or on `scene:complete`.

### Bug 4: Edge connections are incomplete after rebuild
Even when NodeGraphEditor does rebuild, `convertSceneToGraph` reads `item.children` to create edges. During progressive loading, children arrive incrementally, but the graph may rebuild at a moment when connections are incomplete — producing a graph with nodes but missing edges.

### Bug 5: Expansion map initialization races with progressive load
**`useTreeExpansion.ts:33-46`**

Expansion map initializes when `sceneTree.length > 0 && expansionMap.size === 0` — triggered on the first level-0 nodes. At that point nodes have **no children**. The map only has root-level keys. When children load later, they're not in the expansion map, so they render collapsed. The `handleExpandNodes` callback tries to fix this but only expands the direct parent, not the full ancestor path.

### Bug 6: Auto-expand only expands parent, not ancestor path
**`useSceneTree.ts:286-288`**

`onExpandNodes([parent.handle])` only expands the direct parent. If the parent's own parent (grandparent) is collapsed, the children are still invisible in the Outliner.

### Bug 7: `listKey` invalidation only tracks `flattenedNodes.length`
**`SceneOutliner/index.tsx:99-101`**

If children are added but the parent is collapsed (flattened count unchanged), the virtual list doesn't re-render. Minor issue but contributes to stale rendering.

---

## Staged Implementation Plan

### Stage 1: Fix Core Data Flow (Critical)
**Goal:** Fix the fundamental data flow so ALL panels update correctly during progressive loading.

**1a. Throttled `onSceneTreeChange` in `handlePinAdded`**
- Add a throttled (~100ms) call to `onSceneTreeChange` inside `handlePinAdded`
- This ensures NodeInspector and NodeGraphEditor receive tree updates during Pass 1
- Use a ref-based throttle to avoid creating new closures on every pin

**1b. Fix reference identity for mutation-based updates**
- In `handleChildrenLoadedV3`, create **new node references along the path** from root to the changed parent (structural sharing)
- Only clone nodes on the path to the modified parent; leave siblings as-is
- This makes React detect the change and re-render NodeInspector with updated children

**1c. Fix NodeGraphEditor progressive rebuild**
- Listen for `scene:structureComplete` (end of Pass 1) → full graph rebuild with edges
- Listen for `scene:complete` → final rebuild to pick up Pass 2 changes
- Remove the incorrect `currentNodes.length < sceneTree.length` skip logic when V3 progressive is active
- During progressive load, skip the sceneTree-change-driven rebuild (use event-driven rebuilds instead)

**Files:** `useSceneTree.ts`, `NodeGraph/index.tsx`, `App.tsx`

---

### Stage 2: Fix Tree Expansion for Progressive Loading
**Goal:** Nodes appear properly expanded in the Outliner as they load.

**2a. Auto-expand full ancestor path to loaded children**
- When `scene:childrenLoaded` fires, compute path from root to parent
- Expand all ancestor handles, not just the parent

**2b. Additive expansion map updates**
- After `scene:level0Complete`, initialize expansion with level-0 nodes expanded
- After `scene:structureComplete`, update expansion map to include newly discovered children
- Never reset user collapses — only add new entries

**2c. Track `flattenedNodes` by reference not just length**
- Remove the `listKey` counter approach
- Let React's `useMemo` on `flattenedNodes` (which depends on `sceneTree` + `expansionMap`) naturally trigger re-renders when either changes

**Files:** `useTreeExpansion.ts`, `useSceneTree.ts`, `SceneOutliner/index.tsx`

---

### Stage 3: Optimize Render Performance
**Goal:** Reduce unnecessary re-renders and improve perceived speed.

**3a. Batch `scene:pinAdded` events**
- Collect pin additions in a ref, flush via `requestAnimationFrame` every ~100ms
- Reduces React render cycles from O(pins) to O(pins/batch)

**3b. Debounce `onSceneTreeChange` during loading**
- App.tsx `handleSceneTreeChange` runs an O(n) `findNodeInTree` on every call
- During progressive loading (between `scene:buildStart` and `scene:complete`), debounce to max every ~150ms
- After loading completes, revert to immediate updates

**3c. Shallow-compare selectedNode before re-render**
- In App.tsx `handleSceneTreeChange`, only call `setSelectedNode(updatedNode)` if `children.length` or `attrInfo` actually changed
- Prevents redundant NodeInspector renders

**3d. NodeGraphEditor: defer edge rebuild until Pass 1 complete**
- During Pass 1, only add node shapes (no edges — connections are incomplete)
- On `scene:structureComplete`, rebuild edges once with complete connection data
- Eliminates repeated O(n^2) edge computation

**Files:** `useSceneTree.ts`, `App.tsx`, `NodeGraph/index.tsx`

---

### Stage 4: UX Polish
**Goal:** Make progressive loading feel polished and professional.

**4a. Loading progress in status bar**
- Show "Pass 1: Loading structure... 15/42 nodes" → "Pass 2: Loading details..."
- Already partially exists via `scene:buildProgress` — wire it more completely

**4b. Skeleton placeholders in NodeInspector**
- When selected node's children are still loading (Pass 2 pending), show skeleton pins
- Replace with real data as it arrives

**4c. Loading indicator for incomplete Outliner nodes**
- Show subtle spinner or "..." next to nodes whose children haven't loaded yet
- Remove when `scene:childrenLoaded` fires for that node

**4d. Wire `promoteNode()` to user interactions**
- When user expands a node in Outliner during Pass 2, call `client.promoteNode(handle)`
- When user selects a node in any panel, promote it too
- The API exists but isn't connected to any UI interaction

**Files:** `SceneOutliner/index.tsx`, `NodeInspector/index.tsx`, `App.tsx`, `useSceneTree.ts`

---

### Stage 5: Clean Up Dead Code
**Goal:** Remove confusion from deprecated V1/V2 code.

**5a. Delete deprecated services**
- `ProgressiveSceneService.ts` (V1)
- `ProgressiveSceneServiceV2.ts` (V2)
- `LoadingScheduler.ts` (V2 only)

**5b. Simplify feature flags**
- Remove V1/V2 flags from `features.ts`
- Remove all V1/V2 conditional branches from `useSceneTree.ts`, `OctaneClient.ts`, `App.tsx`

**5c. Reduce debug logging**
- Remove verbose Logger.info calls in event handlers (e.g., `useSceneTree.ts:196-225` logs every child name)
- Keep Logger.debug for milestone events only

**Files to delete:** `ProgressiveSceneService.ts`, `ProgressiveSceneServiceV2.ts`, `LoadingScheduler.ts`
**Files to modify:** `OctaneClient.ts`, `features.ts`, `useSceneTree.ts`, `App.tsx`, `types.ts`

---

## Implementation Order & Dependencies

```
Stage 1 (Core Fix) ──> Stage 2 (Expansion) ──> Stage 3 (Performance)
                                             ──> Stage 4 (Polish)
                                             ──> Stage 5 (Cleanup)
```

- **Stage 1 is the blocker** — without correct data flow, progressive UI is broken
- **Stage 2 makes it visible** — expansion state must work for users to see progressive updates
- **Stages 3, 4, 5 are independent** and can be done in any order or parallel

## File Change Summary

| Stage | Files Modified | Risk |
|-------|---------------|------|
| 1 | `useSceneTree.ts`, `NodeGraph/index.tsx`, `App.tsx` | Medium |
| 2 | `useTreeExpansion.ts`, `useSceneTree.ts`, `SceneOutliner/index.tsx` | Low |
| 3 | `useSceneTree.ts`, `App.tsx`, `NodeGraph/index.tsx` | Low |
| 4 | `SceneOutliner/index.tsx`, `NodeInspector/index.tsx`, `App.tsx` | Low |
| 5 | Multiple deletions + modifications | Low |
