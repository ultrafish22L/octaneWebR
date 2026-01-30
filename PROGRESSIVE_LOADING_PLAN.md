# Progressive Scene Loading Implementation Plan

## Problem Statement
Scenes take 200+ seconds to sync, with no UI feedback during this time. Users see only "Loading scene..." with no progress indication or intermediate results.

## Root Cause Analysis
Current implementation (`SceneService.buildSceneTree()`):
1. Fetches **all node metadata** sequentially
2. Fetches **all pin data** recursively for each node
3. Only emits `sceneTreeUpdated` event **once at the end**
4. UI blocks completely during sync with no progress feedback

The commented code at `SceneService.ts:247-249` shows progressive updates were attempted but abandoned (likely due to UI thrashing or race conditions).

## Solution: Three-Phase Progressive Loading

### Phase 1: Quick Skeleton Structure (1-5 seconds)
**Goal**: Display basic tree structure immediately
- Fetch node hierarchy: name, type, handle, parent relationships
- **Skip pins/children temporarily** (that's the slow part)
- Display nodes with loading indicators
- User can see structure immediately

### Phase 2: Batch Pin Loading (10-200+ seconds)
**Goal**: Load details progressively with visual feedback
- Load pins in **batches of 20-50 nodes** (not per-node)
- Update UI after **each batch** (not per-node to avoid thrashing)
- Show progress: "Loading details: 45/200 nodes (23%)"
- Prioritize **visible nodes first** (viewport optimization)

### Phase 3: On-Demand Deep Loading (immediate)
**Goal**: Ensure selected node has complete data
- When user selects node, check if pins loaded
- If not, fetch immediately and show spinner
- Prevents user from seeing incomplete data

---

## Technical Architecture

### 1. Data Model Updates

```typescript
// client/src/services/octane/types.ts

export interface SceneNode {
  // ... existing properties ...
  
  // NEW: Progressive loading state
  loadingState?: 'skeleton' | 'loading' | 'loaded' | 'error';
  loadError?: string;
  childrenLoaded?: boolean;  // Track if children have been fetched
}

export interface SceneSyncProgress {
  phase: 'idle' | 'structure' | 'details' | 'complete' | 'cancelled';
  nodesStructureLoaded: number;   // Nodes with basic metadata
  nodesPinsLoaded: number;        // Nodes with full pin data
  nodesTotal: number;
  currentBatch?: number;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
}

export interface SceneStructureLoadedEvent {
  nodes: SceneNode[];  // Basic structure, no pins
  total: number;
}

export interface NodeBatchLoadedEvent {
  handles: number[];  // Handles of nodes that just loaded
  progress: SceneSyncProgress;
}
```

### 2. Service Layer: SceneService.ts

**New Methods to Add:**

```typescript
// Fast structure load - no pins, no recursion
async buildSceneStructureFast(): Promise<SceneNode[]>

// Load pins for specific nodes (batch)
async loadNodePinsBatch(handles: number[]): Promise<void>

// Progressive sync with events
async buildSceneTreeProgressive(): Promise<SceneNode[]>

// Cancel in-progress sync
cancelSceneSync(): void
```

**Implementation Strategy:**

```typescript
async buildSceneTreeProgressive(): Promise<SceneNode[]> {
  // Reset abort controller
  this.abortController = new AbortController();
  const signal = this.abortController.signal;
  const startTime = performance.now();
  
  try {
    // ===== PHASE 1: Quick Structure Load =====
    Logger.info('📊 Phase 1: Loading scene structure...');
    this.emit('sceneSyncStarted', { phase: 'structure' });
    
    // Get all nodes WITHOUT loading pins (fast!)
    const nodes = await this.buildSceneStructureFast();
    
    // Mark all as skeleton state
    nodes.forEach(node => {
      node.loadingState = 'skeleton';
      node.childrenLoaded = false;
    });
    
    // Emit structure immediately so UI can display
    this.emit('sceneStructureLoaded', {
      nodes,
      total: nodes.length
    });
    
    Logger.info(`✅ Phase 1 complete: ${nodes.length} nodes in ${((performance.now() - startTime) / 1000).toFixed(2)}s`);
    
    // ===== PHASE 2: Batch Pin Loading =====
    Logger.info('📊 Phase 2: Loading node details...');
    this.emit('sceneSyncProgress', {
      phase: 'details',
      nodesStructureLoaded: nodes.length,
      nodesPinsLoaded: 0,
      nodesTotal: nodes.length,
      elapsedTime: (performance.now() - startTime) / 1000
    });
    
    const BATCH_SIZE = 30;  // Tune based on testing
    const allHandles = nodes
      .filter(n => n.handle && n.handle !== 0)
      .map(n => n.handle!);
    
    for (let i = 0; i < allHandles.length; i += BATCH_SIZE) {
      // Check for cancellation
      if (signal.aborted) {
        throw new Error('Scene sync cancelled by user');
      }
      
      const batch = allHandles.slice(i, i + BATCH_SIZE);
      
      // Load pins for this batch
      await this.loadNodePinsBatch(batch);
      
      // Mark nodes as loaded
      batch.forEach(handle => {
        const node = this.scene.map.get(handle);
        if (node) {
          node.loadingState = 'loaded';
          node.childrenLoaded = true;
        }
      });
      
      // Emit progress update
      const loaded = i + batch.length;
      const progress: SceneSyncProgress = {
        phase: 'details',
        nodesStructureLoaded: nodes.length,
        nodesPinsLoaded: loaded,
        nodesTotal: nodes.length,
        currentBatch: Math.floor(i / BATCH_SIZE) + 1,
        elapsedTime: (performance.now() - startTime) / 1000,
        estimatedTimeRemaining: this.estimateTimeRemaining(loaded, nodes.length, startTime)
      };
      
      this.emit('nodeBatchLoaded', {
        handles: batch,
        progress
      });
      
      // Small delay to keep UI responsive
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // ===== PHASE 3: Complete =====
    const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
    Logger.info(`✅ Scene sync complete: ${nodes.length} nodes in ${totalTime}s`);
    
    this.emit('sceneSyncComplete', {
      phase: 'complete',
      nodesStructureLoaded: nodes.length,
      nodesPinsLoaded: nodes.length,
      nodesTotal: nodes.length,
      elapsedTime: parseFloat(totalTime)
    });
    
    return nodes;
    
  } catch (error: any) {
    if (error.message.includes('cancelled')) {
      Logger.info('🚫 Scene sync cancelled by user');
      this.emit('sceneSyncCancelled');
    } else {
      Logger.error('❌ Scene sync failed:', error);
      this.emit('sceneSyncError', { error: error.message });
    }
    throw error;
  }
}

private estimateTimeRemaining(loaded: number, total: number, startTime: number): number {
  const elapsed = (performance.now() - startTime) / 1000;
  const rate = loaded / elapsed;  // nodes per second
  const remaining = total - loaded;
  return Math.ceil(remaining / rate);
}

async buildSceneStructureFast(): Promise<SceneNode[]> {
  // Similar to current buildSceneTree, but:
  // 1. Don't call addItemChildren (that's what loads pins)
  // 2. Only fetch: name, type, handle, parent relationship
  // 3. Store in map but mark as 'skeleton'
  
  // Implementation: Use existing syncSceneSequential but stop at level 1
  // and don't recurse into children yet
}

async loadNodePinsBatch(handles: number[]): Promise<void> {
  // For each handle in batch:
  // 1. Call addItemChildren() to load pins
  // 2. Update node in scene.map
  // 3. Don't emit per-node events (batch handles it)
  
  await Promise.all(
    handles.map(async (handle) => {
      const node = this.scene.map.get(handle);
      if (node) {
        await this.addItemChildren(node);
      }
    })
  );
}
```

### 3. UI Components

**File: `client/src/components/SceneOutliner/index.tsx`**

**New State:**
```typescript
const [syncProgress, setSyncProgress] = useState<SceneSyncProgress | null>(null);
const [isProgressiveSync, setIsProgressiveSync] = useState(false);
```

**New Event Handlers:**
```typescript
useEffect(() => {
  const handleSceneStructureLoaded = (event: SceneStructureLoadedEvent) => {
    Logger.debug('📊 Scene structure loaded, displaying skeleton tree');
    
    // Display tree immediately with loading indicators
    setSceneTree(event.nodes);
    setIsProgressiveSync(true);
    
    // Initialize expansion map
    const syntheticRoot: SceneNode[] = [{
      handle: -1,
      name: 'Scene',
      type: 'SceneRoot',
      typeEnum: 0,
      children: event.nodes
    }];
    setExpansionMap(initializeExpansionMap(syntheticRoot));
  };
  
  const handleNodeBatchLoaded = (event: NodeBatchLoadedEvent) => {
    Logger.debug(`📊 Batch loaded: ${event.handles.length} nodes`);
    
    // Update progress
    setSyncProgress(event.progress);
    
    // Update tree to reflect loaded state
    // Use structural sharing to avoid full re-render
    setSceneTree(prev => updateNodesLoadingState(prev, event.handles, 'loaded'));
  };
  
  const handleSyncProgress = (progress: SceneSyncProgress) => {
    setSyncProgress(progress);
  };
  
  const handleSyncComplete = (progress: SceneSyncProgress) => {
    Logger.debug('✅ Scene sync complete');
    setIsProgressiveSync(false);
    setSyncProgress(null);
    setLoading(false);
    onSyncStateChange?.(false);
  };
  
  const handleSyncCancelled = () => {
    Logger.debug('🚫 Scene sync cancelled');
    setIsProgressiveSync(false);
    setSyncProgress(null);
    setLoading(false);
    onSyncStateChange?.(false);
  };
  
  client.on('sceneStructureLoaded', handleSceneStructureLoaded);
  client.on('nodeBatchLoaded', handleNodeBatchLoaded);
  client.on('sceneSyncProgress', handleSyncProgress);
  client.on('sceneSyncComplete', handleSyncComplete);
  client.on('sceneSyncCancelled', handleSyncCancelled);
  
  return () => {
    client.off('sceneStructureLoaded', handleSceneStructureLoaded);
    client.off('nodeBatchLoaded', handleNodeBatchLoaded);
    client.off('sceneSyncProgress', handleSyncProgress);
    client.off('sceneSyncComplete', handleSyncComplete);
    client.off('sceneSyncCancelled', handleSyncCancelled);
  };
}, [client]);

// Helper: Update node states without full tree rebuild
function updateNodesLoadingState(
  tree: SceneNode[],
  handles: number[],
  state: 'skeleton' | 'loading' | 'loaded'
): SceneNode[] {
  const handleSet = new Set(handles);
  
  const updateNode = (node: SceneNode): SceneNode => {
    if (node.handle && handleSet.has(node.handle)) {
      // Create new node object with updated state
      return {
        ...node,
        loadingState: state,
        children: node.children?.map(updateNode)
      };
    }
    
    // Check children
    if (node.children && node.children.length > 0) {
      const updatedChildren = node.children.map(updateNode);
      // Only create new object if children changed
      if (updatedChildren.some((c, i) => c !== node.children![i])) {
        return { ...node, children: updatedChildren };
      }
    }
    
    return node; // Return same reference if unchanged
  };
  
  return tree.map(updateNode);
}
```

**New Progress Component:**
```typescript
// client/src/components/SceneOutliner/SceneSyncProgressBar.tsx
interface SceneSyncProgressBarProps {
  progress: SceneSyncProgress;
  onCancel: () => void;
}

export function SceneSyncProgressBar({ progress, onCancel }: SceneSyncProgressBarProps) {
  const percentage = (progress.nodesPinsLoaded / progress.nodesTotal) * 100;
  
  return (
    <div className="scene-sync-progress">
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${percentage}%` }} />
      </div>
      <div className="progress-text">
        {progress.phase === 'structure' ? (
          <span>Loading scene structure...</span>
        ) : (
          <span>
            Loading details: {progress.nodesPinsLoaded}/{progress.nodesTotal} nodes ({percentage.toFixed(0)}%)
            {progress.estimatedTimeRemaining && (
              <span className="eta"> • ~{progress.estimatedTimeRemaining}s remaining</span>
            )}
          </span>
        )}
      </div>
      <button className="cancel-sync-btn" onClick={onCancel}>Cancel</button>
    </div>
  );
}
```

**Update VirtualTreeRow to show loading state:**
```typescript
// client/src/components/SceneOutliner/VirtualTreeRow.tsx

export function VirtualTreeRow(props: ...) {
  const { node } = flatNode;
  const isLoading = node.loadingState === 'skeleton' || node.loadingState === 'loading';
  const hasError = node.loadingState === 'error';
  
  return (
    <div className={`tree-node ${isSelected ? 'selected' : ''} ${isLoading ? 'loading' : ''}`}>
      <div className="node-content">
        {/* Existing toggle/icon code */}
        
        {/* Loading indicator */}
        {isLoading && (
          <span className="node-loading-spinner">⟳</span>
        )}
        
        {/* Error indicator */}
        {hasError && (
          <span className="node-error-icon" title={node.loadError}>⚠️</span>
        )}
        
        <span className="node-name">{node.name}</span>
      </div>
    </div>
  );
}
```

### 4. CSS Styling

```css
/* client/src/styles/scene-outliner.css */

/* Progress bar */
.scene-sync-progress {
  padding: 8px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar-container {
  flex: 1;
  height: 4px;
  background: var(--bg-primary);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--accent-color);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: var(--font-size-tiny);
  color: var(--text-secondary);
  white-space: nowrap;
}

.progress-text .eta {
  opacity: 0.7;
}

.cancel-sync-btn {
  padding: 2px 8px;
  font-size: var(--font-size-tiny);
  background: var(--bg-header);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  cursor: pointer;
  color: var(--text-secondary);
}

.cancel-sync-btn:hover {
  background: var(--bg-hover);
}

/* Loading state for tree nodes */
.tree-node.loading {
  opacity: 0.6;
}

.tree-node.loading .node-name {
  font-style: italic;
}

.node-loading-spinner {
  margin-left: 4px;
  display: inline-block;
  animation: spin 1s linear infinite;
  font-size: 12px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.node-error-icon {
  margin-left: 4px;
  color: var(--error-color);
  cursor: help;
}
```

---

## Implementation Phases (Incremental Rollout)

### Phase 1: Basic Progressive Loading ⭐ **START HERE**
**Goal**: Get basic two-phase loading working
**Files to modify:**
1. `types.ts` - Add SceneSyncProgress types
2. `SceneService.ts` - Add buildSceneStructureFast() stub
3. `SceneService.ts` - Add events to buildSceneTree()
4. `SceneOutliner/index.tsx` - Listen to events, show basic progress

**Success Criteria:**
- Scene structure appears within 5 seconds
- Console shows "Structure loaded" message
- Existing functionality still works

### Phase 2: Batch Loading with Progress
**Goal**: Add batch pin loading with visual feedback
**Files to modify:**
1. `SceneService.ts` - Implement loadNodePinsBatch()
2. `SceneService.ts` - Implement buildSceneTreeProgressive()
3. `OctaneClient.ts` - Expose buildSceneTreeProgressive()
4. `SceneOutliner/index.tsx` - Call progressive method
5. Create `SceneSyncProgressBar.tsx`
6. Add progress bar to SceneOutliner

**Success Criteria:**
- Progress bar shows percentage
- Updates every ~1 second
- Large scenes (200s) show continuous progress
- Can expand nodes while loading

### Phase 3: UI Polish and Optimization
**Goal**: Add loading indicators and optimizations
**Files to modify:**
1. `VirtualTreeRow.tsx` - Add loading spinner per node
2. `scene-outliner.css` - Add loading animations
3. `SceneService.ts` - Add viewport prioritization
4. `SceneOutliner/index.tsx` - Add cancel button

**Success Criteria:**
- Nodes show loading spinner while in skeleton state
- Cancel button works
- No UI stuttering or lag
- Visible nodes load first

### Phase 4: Error Handling and Polish
**Goal**: Handle errors gracefully
**Files to modify:**
1. `SceneService.ts` - Catch individual node errors
2. `VirtualTreeRow.tsx` - Show error icon
3. Add retry mechanism for failed nodes

**Success Criteria:**
- Individual node failures don't crash sync
- Error icons show on failed nodes
- User can retry failed nodes

---

## Testing Strategy

### Test Scenarios:
1. **Small scene (< 10 nodes)**: Should complete in < 5 seconds, minimal progressive behavior
2. **Medium scene (50-100 nodes)**: Should show structure in 2-5s, complete in 10-30s
3. **Large scene (200+ nodes)**: Should show structure in 3-5s, progress bar visible for 60-200s
4. **Cancellation**: Click cancel during sync, verify clean abort
5. **Re-sync during sync**: Click refresh during active sync, verify old sync cancels
6. **Node selection during sync**: Select nodes while loading, verify inspector works
7. **Expand/collapse during sync**: Verify tree interactions work while loading

### Performance Metrics:
- Time to first node displayed: < 5 seconds
- Progress update frequency: Every 1-2 seconds
- Batch size tuning: 20-50 nodes (test to find optimal)
- Memory usage: Should not increase significantly
- UI responsiveness: 60fps during sync

---

## Risk Mitigation

### Why Previous Attempts Failed:
1. **Event flooding**: Too many per-node events (200+ nodes = 200+ setState calls = UI freeze)
   - **Solution**: Batch updates (20-50 nodes at once)
   
2. **Race conditions**: Multiple updates to same node
   - **Solution**: Use structural sharing, batch handles

3. **Key instability**: Node keys changing causing re-renders
   - **Solution**: Use node.handle as stable key

4. **Virtualization conflicts**: react-window losing scroll position
   - **Solution**: Immutable updates keep node references stable

### Fallback Strategy:
- Keep original `buildSceneTree()` as fallback
- Add feature flag: `ENABLE_PROGRESSIVE_LOADING`
- If progressive fails, fall back to sequential
- User can disable in settings if issues occur

---

## Success Metrics

### User Experience Goals:
- ✅ See scene structure within **5 seconds** (vs 200s currently)
- ✅ Progress bar shows **live percentage** and ETA
- ✅ Can **interact with tree** while loading (expand, select)
- ✅ **Cancel button** works immediately
- ✅ No UI freezing or stuttering

### Technical Goals:
- ✅ Emit batched events (not per-node)
- ✅ Use structural sharing for React optimization
- ✅ Stable keys prevent full re-renders
- ✅ Abort controller for clean cancellation
- ✅ Memory efficient (no duplicate trees)

---

## Next Steps

1. **Review this plan** with team/user
2. **Start with Phase 1** (basic structure loading)
3. **Test Phase 1** with real scene before proceeding
4. **Iterate through phases** based on feedback
5. **Document learnings** in CHANGELOG.md

Ready to begin implementation? 🚀
