# Progressive Loading - Quick Testing Guide

**Quick reference for testing Phase 1 progressive scene loading**

---

## Prerequisites

1. **Octane Render** running with LiveLink enabled (port 51022)
2. **octaneWebR** dev server running (`npm run dev`)
3. Browser open to http://localhost:57341
4. Browser DevTools console open (F12)

---

## Test 1: Small Scene (Quick Validation)

### Setup
- Load `ORBX/teapot.orbx` in Octane
- Click on Render Target in Octane

### Steps
1. In octaneWebR, press **F5** (Refresh Scene)
2. Watch console and Scene Outliner

### Expected Results ✅
- Console logs:
  ```
  🌳 Building scene tree progressively...
  📊 Phase 1: Loading scene structure (fast)...
  ✅ Phase 1 complete: X nodes in 0.XX s
  📊 Phase 2: Loading node details in batches...
  ✅ Scene sync complete: X nodes in Y.YY s
  ```
- Scene Outliner shows tree almost instantly
- Progress bar appears briefly (< 1 second)
- Render viewport shows rendered image

### Failure Signs ❌
- Console errors in red
- Progress bar doesn't appear
- Tree doesn't load
- "Loading scene..." message persists

---

## Test 2: Large Scene (Main Use Case)

### Setup
- Load a complex scene with 100+ nodes in Octane
- If you don't have one, create multiple objects with materials

### Steps
1. In octaneWebR, press **F5**
2. **Immediately observe** Scene Outliner and progress bar

### Expected Results ✅

**Phase 1 (First 5 seconds):**
- Scene Outliner shows tree structure with node names
- Nodes have loading spinner icon (⟳)
- Progress bar appears: "Loading scene structure..."

**Phase 2 (Next 30-200 seconds):**
- Progress bar updates: "Loading details: 15/200 nodes (8%)"
- Percentage increases steadily
- Time remaining appears: "~180s remaining"
- Can expand/collapse nodes while loading
- Can select nodes while loading

**Phase 3 (Completion):**
- Progress bar disappears
- All nodes fully loaded
- Console shows total time
- Render target activates automatically

### Performance Checks ✅
- UI remains responsive during loading
- No stuttering or freezing
- Smooth scrolling in Scene Outliner
- Console shows no memory warnings

---

## Test 3: Cancellation

### Steps
1. Start loading large scene (F5)
2. Wait until progress bar shows ~30% loaded
3. Click **Cancel** button in progress bar

### Expected Results ✅
- Loading stops immediately
- Progress bar disappears
- Partial tree remains visible (30% of nodes)
- Console: "🚫 Scene sync cancelled by user"
- Can still interact with loaded nodes

---

## Test 4: Rapid Refresh (Edge Case)

### Steps
1. Start loading scene (F5)
2. Immediately press F5 again (before Phase 1 completes)
3. Observe behavior

### Expected Results ✅
- First sync cancels automatically
- Second sync starts fresh
- Console: "🚫 Cancelling previous scene tree build"
- No duplicate nodes or errors
- Scene loads normally

---

## Test 5: Visual Inspection

### Check These UI Elements:

**Progress Bar:**
- [ ] Appears below Scene Outliner tabs
- [ ] Gray background with blue fill
- [ ] Smooth width animation
- [ ] Text is readable (white/light gray)
- [ ] Cancel button has hover effect

**Loading Nodes:**
- [ ] Spinner icon (⟳) visible on loading nodes
- [ ] Node names are readable
- [ ] Icons show correct type
- [ ] Can click to expand/select

**Progress Text:**
- [ ] Shows current phase clearly
- [ ] Percentage is accurate
- [ ] Time remaining updates every 5-10 seconds
- [ ] No text overflow or wrapping

---

## Console Log Reference

### Normal Flow
```
🔄 Loading scene tree progressively from Octane...
🌳 Building scene tree progressively...
📊 Phase 1: Loading scene structure (fast)...
🔍 Getting root node graph...
📍 Found 25 top-level items in scene graph
✅ Fast structure load complete: 25 nodes
✅ Phase 1 complete: 25 nodes in 0.45s
📊 Phase 2: Loading node details in batches...
📊 Batch loaded: 1 nodes (1/25)
📊 Batch loaded: 1 nodes (2/25)
...
✅ Scene sync complete: 25 nodes in 8.23s
```

### Cancellation Flow
```
🔄 Loading scene tree progressively from Octane...
🌳 Building scene tree progressively...
📊 Phase 1: Loading scene structure (fast)...
...
[User clicks Cancel]
🚫 Scene sync cancelled by user
```

### Error Flow
```
🔄 Loading scene tree progressively from Octane...
🌳 Building scene tree progressively...
❌ Scene sync failed: [error message]
```

---

## Performance Benchmarks

Record these metrics for comparison:

| Metric | Small Scene | Large Scene |
|--------|------------|-------------|
| **Time to first node** | < 2s | < 5s |
| **Time to completion** | < 5s | 30-200s |
| **Progress bar updates** | Barely visible | Every 1-2s |
| **UI responsiveness** | Smooth | Smooth |
| **Memory usage** | Stable | Stable |

---

## Troubleshooting

### Issue: Progress bar doesn't show
**Possible causes:**
- Scene loads too fast (< 1 second)
- CSS not loaded properly
**Solution:** Check large scene, inspect DevTools Elements tab for progress bar HTML

### Issue: Time remaining shows "0s" or negative
**Possible causes:**
- First few nodes loading (not enough data for estimate)
**Solution:** Normal, estimate appears after ~5-10 nodes loaded

### Issue: Console shows many errors
**Possible causes:**
- Octane not connected
- gRPC API mismatch (Alpha 5 vs Beta 2)
**Solution:** Check connection, verify API version in `api-version.config.js`

### Issue: Nodes appear duplicated
**Possible causes:**
- Structural sharing issue
- Multiple builds running simultaneously
**Solution:** Report bug with scene details, check for multiple F5 presses

### Issue: Cancel doesn't work
**Possible causes:**
- Button not clickable
- AbortController not working
**Solution:** Check browser console for errors, try refresh

---

## Success Criteria Summary

✅ **Phase 1 is working if:**
1. Tree structure appears within 5 seconds
2. Progress bar shows live updates
3. UI remains responsive during loading
4. Cancel button works
5. No console errors (except expected warnings)
6. Memory usage is stable
7. Render target auto-activates after load

---

## Next Steps After Testing

**If all tests pass:**
- Update CHANGELOG.md with Phase 1 completion
- Consider tuning batch size (currently 1, try 10 or 30)
- Move to Phase 2 planning (viewport prioritization)

**If issues found:**
- Document specific failure case
- Check console errors
- Review PHASE1_PROGRESSIVE_LOADING_COMPLETE.md for rollback plan
- Report to development team with:
  - Scene details (number of nodes)
  - Browser (Chrome, Firefox, etc.)
  - Console logs
  - Screenshots of issue

---

**Testing Date**: _____________  
**Tested By**: _____________  
**Test Result**: ⬜ PASS  ⬜ FAIL  ⬜ PARTIAL  
**Notes**: _____________________________________________
