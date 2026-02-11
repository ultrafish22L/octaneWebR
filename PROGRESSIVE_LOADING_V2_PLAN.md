# Progressive Scene Loading V2 - Code Review & Implementation Plan

**Date**: 2025-02-11  
**Status**: Planning  
**Priority**: High  
**Goal**: Make UI highly responsive during scene syncing with visibility-aware progressive loading

---

## Executive Summary

Transform scene loading from "load everything sequentially" to "load visible data first, continue in background" for dramatically improved perceived performance and UI responsiveness.

**Key Principles**:
1. **Visible First**: Always prioritize loading data for what's currently visible in the UI
2. **Progressive Rendering**: UI updates as data arrives, not after everything is loaded
3. **Background Completion**: Non-visible data loads in the background without blocking UI
4. **Graceful Degradation**: Falls back to synchronous loading if progressive fails

---

## Code Review: Current Implementation

### 1. SceneService.ts (Synchronous - Reference Implementation)

**Location**: `client/src/services/octane/SceneService.ts`

**Strengths**:
- ✅ Well-tested, proven implementation
- ✅ Complete data structure (all attrInfo, children, connections)
- ✅ Simple mental model - load everything, then render

**Weaknesses**:
- ❌ Blocks UI completely during load
- ❌ No progress feedback during heavy scenes
- ❌ 25+ second load times for large scenes

**Keep as**: Reference implementation and fallback via `PROGRESSIVE_LOADING=false`

### 2. ProgressiveSceneService.ts (Current Progressive - V1)

**Location**: `client/src/services/octane/ProgressiveSceneService.ts` (678 lines)

**What It Does**:
1. Loads level 0 nodes with 100ms delays for visual feedback
2. Emits `scene:nodeAdded` for each level 0 node
3. Breadth-first traversal through child levels
4. Emits `scene:childrenLoaded` when children load

**Issues Found**:

```typescript
// Problem 1: Arbitrary fixed delays (not responsive)
await new Promise(resolve => setTimeout(resolve, 100)); // Line 137

// Problem 2: No visibility awareness
// Loads ALL nodes in order, regardless of what user sees

// Problem 3: attrInfo fetched during scene sync
// Slows down level 0 loading for Node Inspector that may not be visible
const attrInfoResponse = await this.apiService.callApi(
  'ApiItem', 'attrInfo', node.handle, { id: AttributeId.A_VALUE }
); // Lines 103-110

// Problem 4: Sequential API calls (no batching)
for (let i = 0; i < size; i++) {
  const itemResponse = await this.apiService.callApi(...); // One at a time
}
```

**Measured Problems**:
- Level 0 loading: ~100ms × N nodes = 10+ seconds for 100 nodes
- Children loading: 50ms delays = 5+ seconds per level
- Total: Still 15-20 seconds for medium scenes, just with progress feedback

### 3. useSceneTree.ts Hook

**Location**: `client/src/components/SceneOutliner/hooks/useSceneTree.ts`

**Good Patterns**:
```typescript
// Using flushSync for immediate level 0 updates
import { flushSync } from 'react-dom';

const handleProgressiveNodeAdded = ({ node, level }: any) => {
  if (level === 0) {
    flushSync(() => {
      setSceneTree(prev => [...prev, node]);
    });
  }
};
```

**Issues**:
- No communication of visible range to service
- No on-demand loading for selected node details
- Tree updates don't consider what's visible in virtual scroll

### 4. SceneOutliner Component

**Location**: `client/src/components/SceneOutliner/index.tsx`

**Uses react-window virtual scrolling** - Only renders visible rows.

**Missing Integration**:
```typescript
// No visibility tracking to inform progressive loader
<List
  key={listKey}
  rowCount={flattenedNodes.length}
  rowHeight={20}
  rowComponent={VirtualTreeRow}
  rowProps={rowProps}
/>
// react-window provides onItemsRendered callback - not used
```

### 5. NodeGraph Component

**Location**: `client/src/components/NodeGraph/index.tsx`

**Behavior**: Only shows level 0 nodes - perfect for progressive loading!
- Level 0 nodes appear immediately
- Edges connect level 0 nodes (pins are children)
- **No changes needed** for progressive V2

### 6. NodeInspector Component

**Behavior**: Shows parameters (attrInfo) for selected node

**Current Problem**: attrInfo loaded during scene sync for ALL nodes
```typescript
// In ProgressiveSceneService.ts - loads attrInfo for every node
const attrInfoResponse = await this.apiService.callApi(
  'ApiItem', 'attrInfo', item.handle, { id: AttributeId.A_VALUE }
);
```

**Better Approach**: Load attrInfo on-demand when node is selected

---

## Architecture for Progressive Loading V2

### Core Concept: Visibility-Aware Loading Scheduler

```
┌─────────────────────────────────────────────────────────────┐
│                    ProgressiveSceneServiceV2                │
│                                                             │
│  ┌─────────────────────┐    ┌────────────────────────┐     │
│  │   LoadingScheduler  │    │   Scene Data Store     │     │
│  │                     │    │                        │     │
│  │  priorityQueue ─────┼───>│  scene.tree            │     │
│  │  backgroundQueue    │    │  scene.map             │     │
│  │  currentLoadingSet  │    │  pendingDetails[]      │     │
│  └─────────────────────┘    └────────────────────────┘     │
│           │                            │                    │
│           ▼                            ▼                    │
│  ┌─────────────────────┐    ┌────────────────────────┐     │
│  │  VisibilityTracker  │    │   Event Emitter        │     │
│  │                     │    │                        │     │
│  │  visibleHandles[]   │    │  scene:nodeAdded       │     │
│  │  scrollPosition     │    │  scene:detailsLoaded   │     │
│  │  onVisibilityChange │    │  scene:complete        │     │
│  └─────────────────────┘    └────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Loading Phases

```
Phase 1: Skeleton (0-200ms)
├── Get root node graph
├── Get count of level 0 items
└── Create placeholder nodes with names only
    └── UI shows: Names + loading indicators

Phase 2: Visible First (200ms-1s)
├── Get visible row indices from UI
├── Load full details for visible nodes:
│   ├── type, outType, graphInfo, nodeInfo
│   ├── position (for NodeGraph)
│   └── children (immediate pins only)
└── UI shows: Fully rendered visible nodes

Phase 3: Background Completion (1s+)
├── Load remaining level 0 nodes
├── Load children for all nodes (depth-first from top)
├── Pause on scroll, resume when stable
└── UI shows: Full tree, smooth scrolling

Phase 4: On-Demand Details
├── Load attrInfo only when node selected
├── Cache in scene.map
└── NodeInspector shows: Real parameter values
```

### Event Flow

```typescript
// V2 Events
'scene:v2:started'         // { totalEstimate: number }
'scene:v2:skeleton'        // { node: SkeletonNode, index: number }
'scene:v2:detailsLoaded'   // { handle: number, node: SceneNode }
'scene:v2:childrenLoaded'  // { parentHandle: number, children: SceneNode[] }
'scene:v2:progress'        // { phase: string, progress: number, message: string }
'scene:v2:complete'        // { totalNodes: number, elapsedMs: number }

// Keep V1 events for compatibility
'scene:nodeAdded'          // Emitted when node details are loaded
'scene:level0Complete'     // Emitted when all level 0 are loaded
'scene:childrenLoaded'     // Emitted when children are loaded
'sceneTreeUpdated'         // Emitted on completion
```

---

## Implementation Plan

### Feature Flags

```typescript
// config/features.ts
export const FEATURES = {
  // V1: Sequential progressive (current)
  PROGRESSIVE_LOADING: import.meta.env.VITE_PROGRESSIVE_LOADING === 'true',
  
  // V2: Visibility-aware progressive (new)
  PROGRESSIVE_LOADING_V2: import.meta.env.VITE_PROGRESSIVE_LOADING_V2 === 'true',
  
  // On-demand attrInfo loading
  LAZY_ATTR_INFO: import.meta.env.VITE_LAZY_ATTR_INFO === 'true',
};
```

### Task Breakdown

#### Task 1: Create SkeletonNode Type and Phase 1 Loading (2 hours)

**Files to modify**:
- `services/octane/types.ts` - Add SkeletonNode type
- `services/octane/ProgressiveSceneServiceV2.ts` - New file

```typescript
// types.ts additions
interface SkeletonNode {
  handle: number;
  name: string;        // Just the name
  level: number;
  loadState: 'skeleton' | 'loading' | 'loaded' | 'error';
  children?: SkeletonNode[];
}

// Phase 1 output: Array of skeleton nodes in ~200ms
```

#### Task 2: LoadingScheduler with Priority Queue (3 hours)

**New file**: `services/octane/LoadingScheduler.ts`

```typescript
interface LoadingScheduler {
  // Add to priority queue (visible items)
  prioritize(handles: number[]): void;
  
  // Add to background queue
  enqueue(handles: number[]): void;
  
  // Pause background loading (on scroll)
  pause(): void;
  
  // Resume background loading
  resume(): void;
  
  // Get next item to load
  next(): number | null;
  
  // Processing callbacks
  onLoad: (handle: number, node: SceneNode) => void;
}
```

#### Task 3: VisibilityTracker Integration (2 hours)

**Files to modify**:
- `components/SceneOutliner/index.tsx` - Add onItemsRendered callback
- `components/SceneOutliner/hooks/useSceneTree.ts` - Track visible handles

```typescript
// SceneOutliner integration
<List
  onItemsRendered={({ visibleStartIndex, visibleStopIndex }) => {
    const visibleHandles = flattenedNodes
      .slice(visibleStartIndex, visibleStopIndex + 1)
      .map(n => n.handle)
      .filter(Boolean);
    onVisibleNodesChange?.(visibleHandles);
  }}
/>
```

#### Task 4: Background Loading with Pause/Resume (2 hours)

**In ProgressiveSceneServiceV2**:

```typescript
private async runBackgroundLoader(): Promise<void> {
  while (!this.abortController?.signal.aborted) {
    if (this.isPaused) {
      await this.waitForResume();
      continue;
    }
    
    const handle = this.scheduler.next();
    if (!handle) break;
    
    try {
      await this.loadNodeDetails(handle);
      await this.yieldToBrowser(); // requestAnimationFrame
    } catch (error) {
      Logger.warn(`Background load failed for ${handle}:`, error);
    }
  }
}
```

#### Task 5: On-Demand attrInfo Loading (1 hour)

**Files to modify**:
- `components/NodeInspector/hooks/useNodeParameters.ts` (or similar)

```typescript
// Only load attrInfo when node is selected
const loadAttrInfo = useCallback(async (handle: number) => {
  if (!FEATURES.LAZY_ATTR_INFO) return; // Fallback to existing
  
  const cached = client.getNodeByHandle(handle);
  if (cached?.attrInfo) return cached.attrInfo;
  
  const attrInfo = await client.callApi('ApiItem', 'attrInfo', handle, { id: A_VALUE });
  // Update cache
  cached.attrInfo = attrInfo.result;
  return attrInfo.result;
}, [client]);
```

#### Task 6: V2 Hook for SceneOutliner (2 hours)

**New file**: `hooks/useProgressiveSceneV2.ts`

```typescript
export function useProgressiveSceneV2(options: {
  onVisibleNodesChange?: (handles: number[]) => void;
}) {
  // Manages V2 progressive state
  // Coordinates visibility -> priority loading
  // Handles all V2 events
}
```

#### Task 7: Testing & Benchmarking (2 hours)

Create test harness to measure:
- Time to first visible node
- Time to interactive (can scroll)
- Time to complete
- API call count
- Memory usage

---

## API Optimization Opportunities

### Batch API Calls (Future Enhancement)

Current: Sequential calls
```typescript
for (let i = 0; i < size; i++) {
  await apiService.callApi('ApiItemArray', 'get', handle, { index: i });
}
```

Better: Batch call (if Octane API supports)
```typescript
// Hypothetical batch endpoint
await apiService.callApi('ApiItemArray', 'getRange', handle, { start: 0, count: size });
```

### Parallel API Calls (Immediate Gain)

```typescript
// Load multiple items in parallel (limit concurrency)
const PARALLEL_LIMIT = 6;
await pMap(handles, async (handle) => {
  await loadNodeDetails(handle);
}, { concurrency: PARALLEL_LIMIT });
```

---

## Expected Performance

### Before (Synchronous)
```
Scene: 1000 nodes
├── Time to first render: 25.3 seconds
├── Time to interactive: 25.3 seconds
├── API calls: 3024
└── User experience: ❌ Blank screen, blocking
```

### After (Progressive V1)
```
Scene: 1000 nodes
├── Time to first render: 0.48 seconds
├── Time to interactive: 12 seconds (scrolling janky)
├── API calls: 3024
└── User experience: 🟡 Progress visible, but slow
```

### Target (Progressive V2)
```
Scene: 1000 nodes
├── Time to first render: 0.2 seconds (skeleton)
├── Time to interactive: 0.5 seconds (visible nodes)
├── Time to complete: 25 seconds (background)
├── API calls: 3024 (same, but prioritized)
└── User experience: ✅ Instant response, smooth scrolling
```

---

## File Changes Summary

### New Files
1. `services/octane/ProgressiveSceneServiceV2.ts` - New visibility-aware loader
2. `services/octane/LoadingScheduler.ts` - Priority queue for load order
3. `hooks/useProgressiveSceneV2.ts` - React hook for V2 state

### Modified Files
1. `config/features.ts` - Add PROGRESSIVE_LOADING_V2 flag
2. `services/octane/types.ts` - Add SkeletonNode type
3. `services/OctaneClient.ts` - Integrate V2 service
4. `components/SceneOutliner/index.tsx` - Add visibility tracking
5. `components/SceneOutliner/hooks/useSceneTree.ts` - Handle V2 events
6. `components/NodeInspector/hooks/*` - Lazy attrInfo loading

### Unchanged Files (Reference)
1. `services/octane/SceneService.ts` - Keep as synchronous fallback
2. `services/octane/ProgressiveSceneService.ts` - Keep V1 for comparison
3. `components/NodeGraph/index.tsx` - Already works with progressive

---

## Rollout Plan

### Phase 1: Development (Week 1)
- [ ] Create ProgressiveSceneServiceV2 skeleton
- [ ] Implement LoadingScheduler
- [ ] Phase 1 skeleton loading
- [ ] Phase 2 visible-first loading

### Phase 2: Integration (Week 1-2)
- [ ] VisibilityTracker in SceneOutliner
- [ ] Background loading with pause/resume
- [ ] Lazy attrInfo loading
- [ ] V2 events in hooks

### Phase 3: Testing (Week 2)
- [ ] Benchmark against V1 and sync
- [ ] Test with various scene sizes
- [ ] Memory profiling
- [ ] Edge cases (empty scene, single node, 10k nodes)

### Phase 4: Deployment
- [ ] Deploy with V2 flag disabled
- [ ] Enable for internal testing
- [ ] Gradual rollout: 10% → 50% → 100%

---

## Success Metrics

| Metric | Current (V1) | Target (V2) |
|--------|-------------|-------------|
| Time to skeleton | N/A | < 200ms |
| Time to interactive | 12s | < 500ms |
| Scroll smoothness | Janky during load | 60fps |
| Memory efficiency | Load all attrInfo | On-demand |
| API call priority | Sequential | Visibility-first |

---

## Risks and Mitigations

### Risk 1: Race conditions between visibility changes and loading
**Mitigation**: LoadingScheduler tracks in-progress items, deduplicates

### Risk 2: Memory pressure with large scenes
**Mitigation**: Implement LRU cache for attrInfo, only keep N most recent

### Risk 3: API rate limiting
**Mitigation**: Concurrency limit (6 parallel calls), exponential backoff

### Risk 4: Complex state management
**Mitigation**: Clear phases, comprehensive event system, extensive logging

---

## References

- [PROGRESSIVE_LOADING_FIX.md](./PROGRESSIVE_LOADING_FIX.md) - V1 implementation details
- [PROGRESSIVE_SCENE_IMPLEMENTATION.md](./PROGRESSIVE_SCENE_IMPLEMENTATION.md) - Original design doc
- [react-window docs](https://react-window.vercel.app/) - Virtual scrolling library
- [React 18 Automatic Batching](https://react.dev/blog/2022/03/29/react-v18#new-feature-automatic-batching)

---

**Last Updated**: 2025-02-11
