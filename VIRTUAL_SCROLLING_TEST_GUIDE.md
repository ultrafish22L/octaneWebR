# Virtual Scrolling Test Guide

## Pre-Testing Checklist

### Environment Setup
- [ ] Octane Render with gRPC API running
- [ ] LiveLink enabled in Octane (Help → LiveLink menu)
- [ ] Scene loaded in Octane (preferably large scene with 1000+ nodes)
- [ ] octaneWebR dev server running: `npm run dev`

### Expected Configuration
- **Package**: react-window v2.2.5
- **Virtual Scrolling**: Enabled (default)
- **Row Height**: 24px (matching Octane UI)
- **Overscan**: Default (smooth scrolling buffer)

---

## Test Scenarios

### Test 1: Basic Rendering
**Goal**: Verify virtual scrolling renders correctly

**Steps:**
1. Open octaneWebR in browser
2. Click "Refresh" button in Scene Outliner
3. Wait for scene to load

**Expected Results:**
- ✅ Scene tree displays in Scene Outliner
- ✅ Only visible rows rendered (~25-30 DOM nodes)
- ✅ No console errors
- ✅ Tree structure intact with proper indentation

**How to Verify:**
- Open browser DevTools → Elements tab
- Inspect `.scene-mesh-list` element
- Count visible row elements (should be ~25-30, not 7424)

**Debug:**
```javascript
// In browser console:
document.querySelectorAll('.tree-node').length  // Should be ~25-30, not thousands
```

---

### Test 2: Scroll Performance
**Goal**: Verify smooth scrolling with large scene

**Steps:**
1. Load large scene (1000+ nodes)
2. Expand several top-level nodes
3. Scroll rapidly up and down through the tree

**Expected Results:**
- ✅ Smooth 60fps scrolling (no lag)
- ✅ Nodes render instantly as they come into view
- ✅ No "white flash" or empty areas during scroll
- ✅ Scroll position maintained accurately

**Performance Metrics:**
- **FPS**: Should stay at 60 (check DevTools → Performance)
- **Scroll responsiveness**: <16ms per frame
- **Memory**: Should be flat (no memory leak during scroll)

**Benchmark Comparison:**
| Scenario | Without Virtual Scrolling | With Virtual Scrolling |
|----------|---------------------------|------------------------|
| Initial render (7424 nodes) | Heavy, laggy | Instant |
| Scroll performance | Laggy, 20-30 FPS | Smooth, 60 FPS |
| DOM nodes | 7424 | ~25-30 |
| Memory usage | High | Low |

---

### Test 3: Expand/Collapse
**Goal**: Verify expand/collapse works with virtualization

**Steps:**
1. Click expand arrow (`+`) on a collapsed node
2. Verify children appear
3. Click collapse arrow (`−`) on an expanded node
4. Verify children hide

**Expected Results:**
- ✅ Children appear/disappear smoothly
- ✅ Virtual scroll adjusts row count dynamically
- ✅ Scroll position maintained (no jumping)
- ✅ Expand/collapse state persists during scroll

**Edge Cases:**
- Expand node near bottom → scroll down to see children
- Collapse node near top → verify scroll position adjusts
- Expand multiple nested levels → verify performance stays smooth

---

### Test 4: Expand All / Collapse All
**Goal**: Verify bulk expand/collapse with virtualization

**Steps:**
1. Click "Expand All" button (uncollapse icon)
2. Wait for tree to expand
3. Scroll through expanded tree
4. Click "Collapse All" button (collapse icon)
5. Verify tree collapses (except Scene root)

**Expected Results:**
- ✅ Expand All: All nodes expand instantly
- ✅ Row count updates to include all visible children
- ✅ Scroll still smooth after expanding (even with 10k+ rows)
- ✅ Collapse All: Collapses everything except Scene root
- ✅ No browser hang or delay

**Performance:**
- Expanding 7424 nodes → should complete in <1 second
- Virtual scrolling ensures only visible rows render

---

### Test 5: Node Selection
**Goal**: Verify node selection works with virtualization

**Steps:**
1. Click a node in the Scene Outliner
2. Verify node highlights (selected state)
3. Scroll to different area
4. Scroll back to selected node
5. Verify selection maintained

**Expected Results:**
- ✅ Selected node highlights correctly
- ✅ Selection state preserved during scroll
- ✅ Selection state persists through expand/collapse
- ✅ Node Inspector updates with selected node's properties

**Check:**
```javascript
// In browser console:
// Find selected node in DOM
document.querySelector('.tree-node.selected')  // Should exist
```

---

### Test 6: Context Menu
**Goal**: Verify context menu works with virtualized rows

**Steps:**
1. Right-click a node in the Scene Outliner
2. Verify context menu appears at cursor position
3. Click "Delete" from context menu
4. Verify node deleted from tree

**Expected Results:**
- ✅ Context menu appears correctly
- ✅ Menu positioned at cursor (not offset)
- ✅ Delete action removes node from tree
- ✅ Virtual scrolling updates row count
- ✅ No console errors after deletion

---

### Test 7: Large Scene Stress Test
**Goal**: Verify performance with extreme node counts

**Test Scene Sizes:**
- Small: 100-500 nodes
- Medium: 500-2000 nodes
- Large: 2000-5000 nodes
- Extreme: 5000+ nodes (like the 7424 node scene)

**Steps:**
1. Load extreme scene (7424+ nodes)
2. Click "Expand All"
3. Scroll to bottom (rapid scroll)
4. Scroll to top (rapid scroll)
5. Perform expand/collapse on random nodes
6. Select nodes at different depths

**Expected Results:**
- ✅ All actions remain smooth (60 FPS)
- ✅ No memory leaks (check DevTools → Memory)
- ✅ No console warnings (React key warnings, etc.)
- ✅ Scene structure correct (no duplicate nodes)

**Performance Monitoring:**
```javascript
// In browser console:
// Check rendered row count (should be ~25-30):
document.querySelectorAll('.tree-node').length

// Check total flattened nodes (should match tree):
// (This requires access to the component's state)
```

---

### Test 8: Node Count Verification
**Goal**: Ensure virtual scrolling doesn't create duplicates

**Steps:**
1. Load scene in sequential mode (set `PARALLEL_CONFIG.ENABLED = false`)
2. Note the node count in console: `✅ Loaded X top-level items`
3. Switch to parallel mode (set `PARALLEL_CONFIG.ENABLED = true`)
4. Reload scene
5. Compare node counts

**Expected Results:**
- ✅ Sequential and parallel node counts **must match exactly**
- ✅ No duplicate nodes in tree
- ✅ No missing nodes
- ✅ Tree structure identical

**Debug:**
```javascript
// Count nodes recursively:
function countNodes(nodes) {
  let count = nodes.length;
  nodes.forEach(node => {
    if (node.children) count += countNodes(node.children);
  });
  return count;
}

// In browser console (after attaching to React component):
// Access via React DevTools or global state
```

---

### Test 9: Memory Leak Check
**Goal**: Verify no memory leaks during extended use

**Steps:**
1. Open DevTools → Memory tab
2. Take heap snapshot (baseline)
3. Scroll through tree 50 times (up and down)
4. Expand/collapse nodes 20 times
5. Select different nodes 30 times
6. Take second heap snapshot
7. Compare snapshots

**Expected Results:**
- ✅ Memory usage stays relatively flat
- ✅ No significant increase in DOM nodes
- ✅ No detached DOM trees (memory leak indicator)
- ✅ Event listeners cleaned up properly

**Warning Signs:**
- ❌ Memory increases linearly with scroll count
- ❌ Detached DOM trees growing
- ❌ Event listener count increasing

---

### Test 10: Browser Compatibility
**Goal**: Verify works in all major browsers

**Browsers to Test:**
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (macOS)

**Steps:**
1. Open octaneWebR in each browser
2. Run Tests 1-5 above
3. Check for browser-specific issues

**Expected Results:**
- ✅ Consistent behavior across browsers
- ✅ No browser-specific console errors
- ✅ Scroll performance similar (60 FPS)

---

## Performance Benchmarks

### Baseline Metrics (Without Virtual Scrolling)
```
Scene Load Time: 30-70 seconds
DOM Nodes Rendered: 7424
Scroll FPS: 20-30 FPS (laggy)
Memory Usage: ~150 MB
```

### Target Metrics (With Virtual Scrolling)
```
Scene Load Time: 3-10 seconds (parallel) / 30-70s (sequential)
DOM Nodes Rendered: ~25-30 (only visible)
Scroll FPS: 60 FPS (smooth)
Memory Usage: ~50 MB
```

### React-Window Performance Characteristics
- **Render only visible rows**: ~25-30 rows for 600px viewport @ 24px row height
- **Overscan**: Additional rows above/below viewport for smooth scroll
- **Dynamic updates**: Rows reused and updated as you scroll
- **Memory efficient**: Constant memory usage regardless of tree size

---

## Troubleshooting

### Issue: "Cannot read property of undefined" during scroll
**Cause**: FlattenedNode at index doesn't exist (race condition)  
**Fix**: VirtualTreeRow has early return `if (!flatNode) return null;` ✅

### Issue: Nodes don't expand/collapse
**Cause**: expansionMap not updating correctly  
**Debug**: Check toggleExpansion in TreeFlattener.ts  
**Verify**: `console.log(expansionMap)` in component

### Issue: Selected node not highlighting
**Cause**: selectedHandle not passed to VirtualTreeRow  
**Fix**: Verify rowProps includes selectedHandle ✅

### Issue: Scroll position jumps when expanding/collapsing
**Cause**: React-window recalculating scroll position  
**Solution**: This is expected behavior. react-window v2 handles this automatically.

### Issue: Console warning "Each child should have unique key"
**Cause**: FlattenedNode.uniqueKey not unique  
**Debug**: Check getNodeKey() in TreeFlattener.ts  
**Fix**: Ensure NO_ITEM nodes (handle=0) use `${parentHandle}_pin${ix}` ✅

### Issue: Performance still slow
**Cause**: Could be several factors  
**Check:**
1. Verify virtual scrolling is actually active (inspect DOM, count nodes)
2. Check for memory leaks (DevTools → Memory)
3. Verify browser GPU acceleration enabled
4. Check for console errors slowing down render

---

## Debug Tools

### Check Virtual Scrolling Active
```javascript
// Browser console:
// Should be ~25-30, not thousands:
document.querySelectorAll('.tree-node').length
```

### Check Expansion State
```javascript
// React DevTools → Components → SceneOutliner
// Find expansionMap in state
// Should be Map<string, boolean> with node keys
```

### Check Flattened Nodes
```javascript
// React DevTools → Components → SceneOutliner
// Find flattenedNodes in state
// Should be array with only visible nodes (collapsed children excluded)
```

### Monitor Performance
```javascript
// Browser DevTools → Performance tab
// Record 5 seconds of scrolling
// Check FPS (should be 60)
// Check scripting time (should be low)
```

---

## Success Criteria

### Build Status
- ✅ TypeScript compiles without errors
- ✅ Production build succeeds
- ✅ No console errors on startup

### Functional Requirements
- ✅ Scene tree displays correctly
- ✅ Expand/collapse works
- ✅ Node selection works
- ✅ Context menu works
- ✅ Expand All / Collapse All buttons work
- ✅ Scroll is smooth (60 FPS)

### Performance Requirements
- ✅ Only ~25-30 DOM nodes rendered (not thousands)
- ✅ Scroll FPS: 60
- ✅ Memory usage: Flat during scroll
- ✅ Node count matches sequential mode

### Code Quality
- ✅ No TypeScript errors
- ✅ No React warnings
- ✅ No memory leaks
- ✅ Clean console logs

---

## Next Steps After Testing

### If All Tests Pass ✅
1. Mark virtual scrolling as **Production Ready**
2. Update AGENTS.md with success status
3. Consider enabling parallel loading by default (PARALLEL_CONFIG.ENABLED = true)
4. Remove old non-virtualized SceneTreeItem (already removed ✅)
5. Document performance gains in README.md

### If Tests Fail ❌
1. Document specific failures
2. Check VIRTUAL_SCROLLING_FIX.md for common issues
3. Verify react-window v2 API usage
4. Check TreeFlattener.ts for edge cases
5. Consider rollback: Revert to commit before virtual scrolling

---

**Last Updated**: 2025-02-02  
**Status**: Ready for Testing  
**Estimated Test Time**: 30-45 minutes
