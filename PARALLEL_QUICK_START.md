# Parallel Loading - Quick Start

## 🚀 TL;DR

Scene loading now has two modes:
- **Sequential** (default): Safe, proven, 30-70s
- **Parallel** (opt-in): Fast, experimental, 3-10s

Toggle in `client/src/services/octane/parallelConfig.ts`:

```typescript
export const PARALLEL_CONFIG = {
  ENABLED: false,  // ← Change to true for parallel
  MAX_CONCURRENT: 6,
  MAX_DEPTH: 5
};
```

---

## 🧪 Test It

### Step 1: Verify Sequential Works

```bash
# Ensure ENABLED = false
npm run dev
# Hard refresh browser (Ctrl+Shift+R)
# Load scene
```

**Expected Console Output:**
```
✅ Scene tree built in 30-70s:
   - 448 top-level items
   - 3661 total nodes         ← Write this down!
   - Mode: SEQUENTIAL
```

### Step 2: Try Parallel

```typescript
// Edit parallelConfig.ts
ENABLED: true  // ← Enable parallel
```

```bash
# Restart dev server
npm run dev
# Hard refresh browser (Ctrl+Shift+R)
# Load scene
```

**Expected Console Output:**
```
✅ Scene tree built in 3-10s:
   - 448 top-level items
   - 3661 total nodes         ← Should MATCH step 1!
   - Mode: PARALLEL
```

### Step 3: Compare

```
✅ Node count matches? → Parallel is correct!
❌ Node count differs? → Use sequential, report issue
```

---

## 📊 What to Check

### ✅ Success Indicators

- Node count identical (sequential vs parallel)
- No React warnings in console
- No duplicate nodes in scene outliner
- Parallel is much faster (5-20x)
- No browser connection errors

### ❌ Problem Indicators

- Different node counts
- Console errors or warnings
- `ERR_INSUFFICIENT_RESOURCES`
- Duplicate nodes visible
- Parallel not faster

**If you see problems**: Switch back to `ENABLED: false` and report issue.

---

## 🔧 Troubleshooting

### Problem: Too many connection errors

**Fix**: Reduce concurrency
```typescript
MAX_CONCURRENT: 4  // Down from 6
```

### Problem: Node counts don't match

**Debug**: Add logging in `addSceneItem` (line ~443):
```typescript
if (this.scene.map.has(handleNum)) {
  Logger.warn(`⚠️ DUPLICATE: ${itemName} (${handleNum})`);
}
```

**Immediate Fix**: Use sequential
```typescript
ENABLED: false
```

### Problem: Parallel is slow

**Check**: Network tab in browser devtools
- Are 6 requests happening at once?
- What's the request duration?

---

## 📖 Full Documentation

Three detailed guides available:

1. **PARALLEL_LOADING_GUIDE.md** - Complete usage guide
2. **PARALLEL_LOADING_LEARNINGS.md** - Why we rewrote it
3. **PARALLEL_LOADING_REWRITE.md** - What changed

---

## 🎯 Key Points

1. **Sequential is the baseline** - Always works, use to verify correctness
2. **Parallel is opt-in** - Faster but needs testing
3. **One flag to toggle** - Simple `ENABLED: true/false`
4. **Node count must match** - If it doesn't, something is wrong
5. **Easy to switch back** - Sequential is always available

---

## 📝 Report Results

After testing, please share:

```
Sequential Mode:
- Node count: _____
- Load time: _____
- Any errors: _____

Parallel Mode:
- Node count: _____
- Load time: _____
- Any errors: _____

Match: ✅ / ❌
```

---

## 🚦 Status

**Current**: `ENABLED: false` (sequential, safe)  
**Ready**: Yes, parallel implementation complete  
**Tested**: Awaiting your test results!  
**Docs**: Complete and comprehensive  

**Next**: Test both modes and compare results!
