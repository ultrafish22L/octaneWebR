# Progressive Scene Loading - Visual Architecture

## Current vs Progressive Flow

### ❌ Current Implementation (Blocking)
```
User clicks Refresh
        ↓
    setLoading(true)
        ↓
    "Loading scene..."   <-- User sees ONLY this for 200+ seconds
        ↓
  [Fetch all 200 nodes sequentially]
  [For each node, fetch all pins]
  [Build complete tree]
        ↓
    (200 seconds later...)
        ↓
    setLoading(false)
        ↓
    Display complete tree

❌ Problems:
- No visual feedback for 200+ seconds
- User can't interact during load
- Appears frozen/broken
- No progress indication
- Can't cancel
```

### ✅ Progressive Implementation (Responsive)
```
User clicks Refresh
        ↓
    setLoading(true)
        ↓
═══════════════════════════════════════════════════════════
PHASE 1: Quick Structure Load (1-5 seconds)
═══════════════════════════════════════════════════════════
        ↓
  [Fetch node metadata ONLY]
  - name, type, handle
  - Skip pins/children
        ↓
    Emit: sceneStructureLoaded
        ↓
┌───────────────────────────────────────────────────────┐
│ UI UPDATE 1: Tree appears immediately!                │
│                                                        │
│ 📁 Scene                                              │
│   📷 Camera 1          ⟳  (loading...)               │
│   🎬 Render Target 1   ⟳  (loading...)               │
│   📦 Geometry 1        ⟳  (loading...)               │
│   📦 Geometry 2        ⟳  (loading...)               │
│   ...                                                  │
│                                                        │
│ ✅ User can expand/collapse nodes                     │
│ ✅ User can select nodes                              │
│ ✅ Tree structure visible                             │
└───────────────────────────────────────────────────────┘
        ↓
═══════════════════════════════════════════════════════════
PHASE 2: Batch Pin Loading (10-200 seconds)
═══════════════════════════════════════════════════════════
        ↓
  [Load pins in batches of 30]
  Batch 1: Nodes 1-30   → loadNodePinsBatch([1...30])
        ↓
    Emit: nodeBatchLoaded (handles: [1...30])
        ↓
┌───────────────────────────────────────────────────────┐
│ UI UPDATE 2: Progress bar appears                     │
│                                                        │
│ ▓▓▓▓▓▓░░░░░░░░░░░░░░  30/200 nodes (15%)  [Cancel]  │
│                                                        │
│ 📁 Scene                                              │
│   📷 Camera 1          ✅ (loaded)                    │
│   🎬 Render Target 1   ✅ (loaded)                    │
│   📦 Geometry 1        ✅ (loaded)                    │
│   📦 Geometry 2        ⟳  (loading...)               │
│   ...                                                  │
└───────────────────────────────────────────────────────┘
        ↓
  Batch 2: Nodes 31-60  → loadNodePinsBatch([31...60])
        ↓
    Emit: nodeBatchLoaded (handles: [31...60])
        ↓
┌───────────────────────────────────────────────────────┐
│ UI UPDATE 3: Progress advances                        │
│                                                        │
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  60/200 nodes (30%) ~120s left │
│                                                        │
│ 📁 Scene                                              │
│   📷 Camera 1          ✅ (loaded)                    │
│   🎬 Render Target 1   ✅ (loaded)                    │
│   📦 Geometry 1        ✅ (loaded)                    │
│   📦 Geometry 2        ✅ (loaded)                    │
│   🎨 Material 1        ✅ (loaded)                    │
│   🎨 Material 2        ⟳  (loading...)               │
│   ...                                                  │
└───────────────────────────────────────────────────────┘
        ↓
  ... continue batches ...
        ↓
  Batch 7: Nodes 181-200
        ↓
    Emit: sceneSyncComplete
        ↓
┌───────────────────────────────────────────────────────┐
│ UI UPDATE FINAL: Complete!                            │
│                                                        │
│ ✅ Scene loaded (200 nodes in 187s)                   │
│                                                        │
│ 📁 Scene                                              │
│   📷 Camera 1          ✅                             │
│   🎬 Render Target 1   ✅                             │
│   📦 Geometry 1        ✅                             │
│   ... (all loaded)                                    │
└───────────────────────────────────────────────────────┘

✅ Benefits:
- User sees structure in 5 seconds
- Live progress updates every 5-10 seconds
- Can interact during load
- Can cancel anytime
- Shows time remaining
```

---

## Event Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SceneService.ts                         │
│                                                              │
│  buildSceneTreeProgressive() {                              │
│                                                              │
│    // PHASE 1: Quick structure                              │
│    nodes = await buildSceneStructureFast()                  │
│    emit('sceneStructureLoaded', { nodes })  ────────────┐  │
│                                                          │  │
│    // PHASE 2: Batch loading                            │  │
│    for (batch of nodes) {                               │  │
│      await loadNodePinsBatch(batch)                     │  │
│      emit('nodeBatchLoaded', { handles, progress }) ────┼──│──┐
│    }                                                     │  │  │
│                                                          │  │  │
│    // PHASE 3: Complete                                 │  │  │
│    emit('sceneSyncComplete', { progress })  ────────────┼──│──┼──┐
│  }                                                       │  │  │  │
└──────────────────────────────────────────────────────────┼──┼──┼──┘
                                                           │  │  │
                                                           │  │  │
┌──────────────────────────────────────────────────────────┼──┼──┼──┐
│                  OctaneClient.ts                         │  │  │  │
│                  (Event Bus)                             │  │  │  │
│                                                           │  │  │  │
│  Forward events to UI components ─────────────────────────┼──┼──┼──│
└───────────────────────────────────────────────────────────┼──┼──┼──┘
                                                            ↓  ↓  ↓
┌──────────────────────────────────────────────────────────────────┐
│               SceneOutliner/index.tsx                            │
│                                                                   │
│  useEffect(() => {                                               │
│    client.on('sceneStructureLoaded', (event) => {    <───────┐  │
│      setSceneTree(event.nodes)  // Show skeleton tree         │  │
│    })                                                          │  │
│                                                                   │
│    client.on('nodeBatchLoaded', (event) => {         <────────┼──┐
│      setSyncProgress(event.progress)  // Update progress bar  │  │
│      updateNodeStates(event.handles, 'loaded')  // Update UI  │  │
│    })                                                          │  │
│                                                                   │
│    client.on('sceneSyncComplete', () => {            <─────────┼──┼──┐
│      setLoading(false)  // Hide progress bar                   │  │  │
│    })                                                          │  │  │
│  }, [client])                                                  │  │  │
└────────────────────────────────────────────────────────────────┘  │  │
                                                                     │  │
                                                                     │  │
┌────────────────────────────────────────────────────────────────────┘  │
│ UI Render 1: Tree appears (5 seconds)                                 │
│                                                                        │
│ ┌────────────────────────┐                                           │
│ │ 📁 Camera 1        ⟳  │ ← All nodes visible immediately           │
│ │ 🎬 RenderTarget 1  ⟳  │                                            │
│ │ 📦 Geometry 1      ⟳  │                                            │
│ └────────────────────────┘                                           │
└────────────────────────────────────────────────────────────────────────┘
                                                                         │
┌────────────────────────────────────────────────────────────────────────┘
│ UI Render 2: Progress bar updates (every batch, ~5-10s intervals)
│
│ ┌─────────────────────────────────────────────────────┐
│ │ ▓▓▓▓▓▓░░░░░░  60/200 (30%) ~120s left    [Cancel] │
│ └─────────────────────────────────────────────────────┘
│ ┌────────────────────────┐
│ │ 📁 Camera 1        ✅ │ ← First 60 loaded
│ │ 🎬 RenderTarget 1  ✅ │
│ │ 📦 Geometry 1      ⟳  │ ← Still loading
│ └────────────────────────┘
└────────────────────────────────────────────────────────────────────────┘
                                                                         │
┌────────────────────────────────────────────────────────────────────────┘
│ UI Render 3: Complete (187 seconds total)
│
│ ✅ Scene loaded (200 nodes)
│ ┌────────────────────────┐
│ │ 📁 Camera 1        ✅ │
│ │ 🎬 RenderTarget 1  ✅ │
│ │ 📦 Geometry 1      ✅ │
│ └────────────────────────┘
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Structural Sharing for Performance

### ❌ Naive Approach (Would Cause UI Thrashing)
```typescript
// BAD: Creates new tree on every batch
for (const batch of batches) {
  const newTree = [...tree];  // Copy entire tree
  updateNodes(newTree, batch);
  setSceneTree(newTree);  // Full re-render of 200+ nodes
}

Result: 200+ full re-renders = UI freeze
```

### ✅ Structural Sharing (Efficient)
```typescript
// GOOD: Only creates new objects for updated nodes
function updateNodesLoadingState(tree, handles, state) {
  const handleSet = new Set(handles);
  
  return tree.map(node => {
    if (handleSet.has(node.handle)) {
      // Only this node gets new object
      return { ...node, loadingState: state };
    }
    return node;  // Same reference = React skips re-render
  });
}

Result: Only 30 nodes re-render per batch = smooth 60fps
```

**Visual Example:**
```
Before batch update:
┌─────────────────────────────────────────┐
│ tree = [                                │
│   { handle: 1, name: 'Camera' },    ───┼──→ Reference A
│   { handle: 2, name: 'Geo 1' },     ───┼──→ Reference B
│   { handle: 3, name: 'Geo 2' }      ───┼──→ Reference C
│ ]                                       │
└─────────────────────────────────────────┘

After updating handle 2:
┌─────────────────────────────────────────┐
│ tree = [                                │
│   { handle: 1, name: 'Camera' },    ───┼──→ Reference A (SAME!)
│   { handle: 2, loadingState: 'ok' },───┼──→ Reference D (NEW)
│   { handle: 3, name: 'Geo 2' }      ───┼──→ Reference C (SAME!)
│ ]                                       │
└─────────────────────────────────────────┘

React sees:
- Nodes 1,3: Same reference → Skip re-render ✅
- Node 2: New reference → Re-render only this ✅
```

---

## Batch Size Tuning

### Too Small (10 nodes/batch)
```
Pros:
✅ Very frequent UI updates (looks smooth)
✅ Progress bar moves constantly

Cons:
❌ Too many setState calls (20 batches for 200 nodes)
❌ Overhead from event emission
❌ Slight UI lag from rapid updates
```

### Too Large (100 nodes/batch)
```
Pros:
✅ Fewer setState calls (2 batches for 200 nodes)
✅ Less overhead

Cons:
❌ Infrequent updates (long gaps in progress)
❌ Feels unresponsive
❌ Progress bar jumps in large increments
```

### Optimal (30-50 nodes/batch) ⭐
```
✅ Good balance:
- 4-7 batches for 200 nodes
- Updates every 5-10 seconds
- Smooth progress bar
- Minimal overhead
- Responsive UI

Recommended: 30 nodes/batch (tune based on testing)
```

---

## Cancel Flow

```
User clicks "Cancel" button
        ↓
    client.cancelSceneSync()
        ↓
    abortController.abort()
        ↓
SceneService checks signal in loop:
    for (batch of batches) {
      if (signal.aborted) throw Error('cancelled')  ← Exit here
      ...
    }
        ↓
    catch block detects cancellation
        ↓
    emit('sceneSyncCancelled')
        ↓
SceneOutliner handles event:
    - setLoading(false)
    - setSyncProgress(null)
    - Keep partially loaded tree (don't clear)
        ↓
✅ User sees partially loaded tree
✅ Can click refresh to resume
```

---

## Memory Management

### Current (Blocking)
```
Memory usage: 1x tree size
- Build complete tree in memory
- Set to state once
```

### Progressive (Efficient)
```
Memory usage: 1x tree size (same!)
- Build skeleton tree (small)
- Update nodes in-place in scene.map
- setState only references existing objects

✅ No duplicate trees
✅ Structural sharing prevents copies
✅ Same memory footprint as current
```

---

## Edge Cases Handled

### 1. User selects node during sync
```
User clicks node with loadingState='skeleton'
        ↓
SceneOutliner: handleNodeSelect(node)
        ↓
Check: if (node.loadingState !== 'loaded') {
  // Show loading spinner in Node Inspector
  // Wait for batch to complete
  // Then show full data
}
```

### 2. User refreshes during sync
```
User clicks "Refresh" while sync in progress
        ↓
SceneService: buildSceneTreeProgressive() called again
        ↓
First line: this.abortController.abort()  ← Cancels old sync
        ↓
Creates new abortController
        ↓
Starts fresh sync
        ↓
✅ Clean cancellation, no conflicts
```

### 3. Connection lost during sync
```
gRPC error thrown mid-batch
        ↓
SceneService: catch block
        ↓
emit('sceneSyncError', { error })
        ↓
SceneOutliner: show error message
        ↓
Keep partially loaded tree
        ↓
✅ User can see what loaded before failure
```

### 4. Very small scene (5 nodes)
```
buildSceneTreeProgressive() runs
        ↓
Phase 1: 5 nodes loaded (< 1 second)
        ↓
Phase 2: 1 batch (5 nodes)
        ↓
sceneSyncComplete emitted immediately
        ↓
✅ No unnecessary complexity for small scenes
✅ Progress bar barely visible (< 1s)
```

---

## Performance Comparison

### Current (Blocking)
```
Small scene (10 nodes):    5s  loading, 5s to display
Medium scene (50 nodes):  30s loading, 30s to display
Large scene (200 nodes): 187s loading, 187s to display

User experience:
❌ Black box - no feedback
❌ Can't interact
❌ Appears frozen
```

### Progressive
```
Small scene (10 nodes):    1s structure, 4s details = 5s total
Medium scene (50 nodes):   2s structure, 28s details = 30s total
Large scene (200 nodes):   4s structure, 183s details = 187s total

User experience:
✅ Tree visible in 1-4 seconds
✅ Progress bar shows live updates
✅ Can interact immediately
✅ Can cancel anytime
✅ Time remaining estimated
```

**Key Improvement:**
- Time to first interaction: **187s → 4s** (96% faster!)
- Total time: Same (187s) but feels much faster due to feedback

---

## Testing Plan

### Unit Tests
```typescript
// SceneService.test.ts
test('buildSceneStructureFast returns nodes without pins', async () => {
  const nodes = await service.buildSceneStructureFast();
  expect(nodes[0].children).toBeUndefined();
  expect(nodes[0].loadingState).toBe('skeleton');
});

test('loadNodePinsBatch loads pins for all handles', async () => {
  const handles = [1, 2, 3];
  await service.loadNodePinsBatch(handles);
  handles.forEach(h => {
    expect(service.scene.map.get(h)?.childrenLoaded).toBe(true);
  });
});

test('cancelSceneSync aborts in-progress sync', async () => {
  const promise = service.buildSceneTreeProgressive();
  setTimeout(() => service.cancelSceneSync(), 100);
  await expect(promise).rejects.toThrow('cancelled');
});
```

### Integration Tests
```typescript
// SceneOutliner.test.ts
test('displays tree after structure loads', async () => {
  render(<SceneOutliner client={mockClient} />);
  
  // Simulate structure event
  act(() => {
    mockClient.emit('sceneStructureLoaded', {
      nodes: [{ handle: 1, name: 'Camera' }]
    });
  });
  
  expect(screen.getByText('Camera')).toBeInTheDocument();
  expect(screen.getByText('⟳')).toBeInTheDocument(); // Loading icon
});

test('updates progress bar during batch loading', async () => {
  render(<SceneOutliner client={mockClient} />);
  
  act(() => {
    mockClient.emit('nodeBatchLoaded', {
      progress: { nodesPinsLoaded: 50, nodesTotal: 100 }
    });
  });
  
  expect(screen.getByText('50/100 nodes (50%)')).toBeInTheDocument();
});
```

### Manual Tests
```
1. Small scene (< 10 nodes)
   - ✅ Structure appears < 2 seconds
   - ✅ Complete < 5 seconds
   - ✅ No unnecessary progress bar

2. Large scene (200+ nodes)
   - ✅ Structure appears < 5 seconds
   - ✅ Progress bar updates every 5-10s
   - ✅ Can expand nodes while loading
   - ✅ Can select nodes while loading
   - ✅ Cancel button works

3. Connection issues
   - ✅ Error message shows
   - ✅ Partial tree preserved
   - ✅ Can retry

4. Multiple refreshes
   - ✅ Old sync cancels cleanly
   - ✅ New sync starts
   - ✅ No memory leaks
```

---

## Success Criteria Checklist

### Phase 1 (Basic Progressive)
- [ ] buildSceneStructureFast() implemented
- [ ] sceneStructureLoaded event emitted
- [ ] SceneOutliner listens to event
- [ ] Tree displays skeleton nodes < 5 seconds
- [ ] Existing functionality unchanged

### Phase 2 (Batch Loading)
- [ ] loadNodePinsBatch() implemented
- [ ] nodeBatchLoaded event emitted
- [ ] Progress bar component created
- [ ] Progress updates every batch
- [ ] Structural sharing prevents thrashing

### Phase 3 (UI Polish)
- [ ] Loading spinner on nodes
- [ ] Cancel button functional
- [ ] Time remaining estimation
- [ ] Error handling
- [ ] CSS animations smooth

### Phase 4 (Optimization)
- [ ] Viewport priority loading
- [ ] Batch size tuned (30 nodes optimal)
- [ ] Memory profiling clean
- [ ] 60fps maintained during updates

Ready to implement Phase 1! 🚀
