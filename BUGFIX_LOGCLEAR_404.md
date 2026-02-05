# BugFix: logClear() 404 Error - 2025-02-03

## Issue

**Error**: `Failed to load resource: the server responded with a status of 404 (Not Found)`

**Cause**: Case mismatch between client and server endpoint URLs

## Root Cause Analysis

### Client Code (Logger.ts)
```typescript
// Line 56 - Constructor calls logClear on page refresh
fetch('/api/logClear', {  // ← camelCase
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
});
```

### Server Code (vite-plugin-octane-grpc.ts)
```typescript
// Line 679 - BEFORE (wrong!)
if (url === '/api/logclear' && req.method === 'POST') {  // ← lowercase
  // ...
}
```

**Problem**: 
- Client requests: `/api/logClear` (camelCase 'C')
- Server listens: `/api/logclear` (lowercase 'c')
- Result: 404 Not Found

## Solution

Changed server endpoint to match client's camelCase format:

```typescript
// Line 679 - AFTER (fixed!)
if (url === '/api/logClear' && req.method === 'POST') {  // ← camelCase matches client
  try {
    fs.rmSync('/tmp/octaneWebR_client.log', { force: true });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'Log cleared' }));
  } catch (error: any) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', error: error.message }));
  }
  return;
}
```

## What logClear() Does

**Purpose**: Deletes the server-side log file on page refresh for a clean log session.

**Behavior**:
1. When Logger.ts initializes (page load/refresh), it calls `/api/logClear`
2. Server deletes `/tmp/octaneWebR_client.log` if it exists
3. Fresh log file created when new logs arrive via `/api/log`
4. Only active when `DEBUG_MODE = true` in Logger.ts

**File**: `/tmp/octaneWebR_client.log`  
**Content**: Server-side copy of client logs (for debugging)

## Impact

### Before Fix
- ❌ 404 error on every page refresh
- ❌ Old log content persists across sessions
- ❌ Console cluttered with error messages

### After Fix
- ✅ 200 OK response on page refresh
- ✅ Log file cleared for fresh session
- ✅ Clean console, no errors

## Validation

### TypeScript Check ✅
```bash
npx tsc --noEmit
# Result: 0 errors
```

### Manual Test
```bash
# Start dev server
npm run dev

# In another terminal - test endpoint
curl -X POST http://localhost:57341/api/logClear

# Expected response:
# {"status":"ok","message":"Log cleared"}
```

### Browser Test
1. Open browser DevTools → Network tab
2. Refresh page (F5)
3. Look for `/api/logClear` request
4. Should show: **Status 200 OK** ✅

## Files Changed

1. **vite-plugin-octane-grpc.ts** (line 679)
   - Changed: `/api/logclear` → `/api/logClear`
   - Added comment explaining camelCase requirement

## Related Endpoints

All API endpoints in vite-plugin-octane-grpc.ts:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/logClear` | POST | Clear log file (page refresh) |
| `/api/log` | POST | Append to log file (continuous) |
| `/api/*` | Various | gRPC proxy endpoints |

## Best Practice

**Convention**: Use camelCase for API endpoints to match JavaScript/TypeScript naming conventions.

**Why This Matters**:
- URLs are case-sensitive
- `/api/logClear` ≠ `/api/logclear` ≠ `/api/LogClear`
- Client and server must match exactly

## Debug Mode

The logging system has two modes:

```typescript
// Logger.ts line 10
const DEBUG_MODE = false;  // ← Controls server-side file logging
```

**When `DEBUG_MODE = false` (default)**:
- Logs only to browser console
- No file logging to `/tmp/octaneWebR_client.log`
- No calls to `/api/log` endpoint
- `/api/logClear` still called but harmless (clears non-existent file)

**When `DEBUG_MODE = true`**:
- Logs to browser console AND server file
- Writes to `/tmp/octaneWebR_client.log`
- Buffers logs and flushes every 1 second
- Useful for debugging backend issues

## Testing

To test the fix:

1. **Enable Debug Mode** (optional):
   ```typescript
   // client/src/utils/Logger.ts line 10
   const DEBUG_MODE = true;  // Enable file logging
   ```

2. **Start Dev Server**:
   ```bash
   npm run dev
   ```

3. **Refresh Browser** and check:
   - DevTools → Network: `/api/logClear` should be **200 OK**
   - Console: No 404 errors
   - Server terminal: Log file cleared

4. **Check Log File** (if DEBUG_MODE = true):
   ```bash
   # Should be empty or non-existent after refresh
   cat /tmp/octaneWebR_client.log
   
   # Trigger some logs, then check again
   cat /tmp/octaneWebR_client.log
   ```

## Summary

**Issue**: Case-sensitive URL mismatch causing 404  
**Root Cause**: `/api/logclear` (server) vs `/api/logClear` (client)  
**Fix**: Changed server to match client's camelCase  
**Impact**: Clean page refreshes, no 404 errors  
**Lines Changed**: 1 (vite-plugin-octane-grpc.ts:679)  
**Testing**: ✅ TypeScript passes, endpoint now matches  

---

**Last Updated**: 2025-02-03  
**Status**: Fixed ✅  
**Severity**: Minor (cosmetic 404 error, no functional impact)
