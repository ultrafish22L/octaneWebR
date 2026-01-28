# Quick Start: Switching API Versions

## TL;DR - How to Switch

### Edit ONE file: `api-version.config.js` (line 22)

```javascript
// For Alpha 5 (2026.1)
const USE_ALPHA5_API = true;

// For Beta 2 (2026.1)  
const USE_ALPHA5_API = false;
```

### Then rebuild and restart:
```bash
npm run build && npm run dev
```

**That's it!** ✅

---

## Why This Works

- **Before**: Had to edit 2 files (client + server configs)
- **Now**: Edit 1 file (automatically syncs both)
- **Result**: No more "Method not found" errors from mismatched configs

---

## Verify It Worked

Check the console logs when server starts:

**Alpha 5:**
```
[OCTANE-SERVER] API Version: Alpha 5 (2026.1)
[OCTANE-SERVER] Proto directory: /workspace/project/octaneWebR/server/proto_old
```

**Beta 2:**
```
[OCTANE-SERVER] API Version: Beta 2 (2026.1)
[OCTANE-SERVER] Proto directory: /workspace/project/octaneWebR/server/proto
```

---

## For Full Details

See `API_VERSION_SWITCHING.md` for complete documentation.

---

## Troubleshooting

**Error: "Method not found in service"**
- Clear build cache: `rm -rf dist node_modules/.vite`
- Rebuild: `npm run build`
- Restart: `npm run dev`
- Verify `api-version.config.js` line 22 matches your Octane version

**Still not working?**
1. Check which Octane version you're running
2. Verify the config value matches:
   - Alpha 5 = `true`
   - Beta 2 = `false`
3. Make sure you rebuilt after changing the config
