# Beta 2 Compatibility Analysis

**Date**: 2025-01-31  
**Status**: Configuration mismatch identified  
**Impact**: Beta 2 methods failing despite correct proto definitions

---

## Problem Summary

When testing with Beta 2 Octane, the following errors occur repeatedly:

```
[ERROR] Method getPinValueByPinID not found in service ApiNode
[ERROR] Method getValueByAttrID not found in service ApiItem (100+ times)
```

---

## Root Cause

**Configuration mismatch**: Both client and server are configured for Alpha 5, but user is testing Beta 2 Octane.

### Current State
```typescript
// vite-plugin-octane-grpc.ts (line 35)
const USE_ALPHA5_API = true;  // ❌ Loading proto_old (Alpha 5)

// client/src/config/apiVersionConfig.ts (line 46)
export const USE_ALPHA5_API = true;  // ❌ Transforming to Alpha 5 method names
```

### What's Happening

1. **Client side** (`apiVersionConfig.ts`):
   - Code calls Beta 2 method: `getValueByAttrID`
   - `getCompatibleMethodName()` transforms it to Alpha 5: `getByAttrID`
   - HTTP request sent with Alpha 5 method name

2. **Server side** (`vite-plugin-octane-grpc.ts`):
   - Receives Alpha 5 method name: `getByAttrID`
   - Loads Alpha 5 proto files from `proto_old/`
   - Calls Octane with Alpha 5 method name
   - **Beta 2 Octane rejects** unknown method

---

## API Differences

### Method Names

| Feature | Beta 2 | Alpha 5 |
|---------|--------|---------|
| Get pin value | `getPinValueByPinID` | `getPinValue` |
| Set pin value | `setPinValueByPinID` | `setPinValue` |
| Get item value | `getValueByAttrID` | `getByAttrID` |
| Set item value | `setValueByAttrID` | `setByAttrID` |

### Proto File Verification

**Beta 2** (`server/proto/apinodesystem.proto`):
```proto
rpc getValueByAttrID(ApiItem.getValueByIDRequest) returns (ApiItem.getValueResponse);  // Line 11017
rpc getPinValueByPinID(ApiNode.getPinValueByIDRequest) returns (ApiNode.getPinValueByXResponse);  // Line 11546
```

**Alpha 5** (`server/proto_old/apinodesystem.proto`):
```proto
rpc getByAttrID(...)  // Different name
rpc getPinValue(...)  // Different name
```

---

## Solution

**Change both config files to Beta 2 mode**:

### 1. Server Config
```typescript
// vite-plugin-octane-grpc.ts (line 35)
const USE_ALPHA5_API = false;  // ✅ Use Beta 2 protos
```

### 2. Client Config
```typescript
// client/src/config/apiVersionConfig.ts (line 46)
export const USE_ALPHA5_API = false;  // ✅ No method name transformation
```

### Flow After Fix

1. Client calls Beta 2 method: `getValueByAttrID`
2. No transformation (USE_ALPHA5_API = false)
3. Server loads Beta 2 proto files
4. Server finds `getValueByAttrID` in Beta 2 protos ✅
5. Calls Beta 2 Octane with correct method name ✅
6. Success! ✅

---

## Implementation Details

### Client Transformation (ApiService.ts)

```typescript
// Line 45: Method name translation
const compatibleMethod = getCompatibleMethodName(service, method);

// Line 79: Parameter transformation
const transformedParams = transformRequestParams(service, method, params);
```

**When `USE_ALPHA5_API = false`**:
- `getCompatibleMethodName()` returns original Beta 2 name (no translation)
- `transformRequestParams()` returns original params (no transformation)

### Server Proto Loading (vite-plugin-octane-grpc.ts)

```typescript
// Line 102, 120: Proto directory selection
const PROTO_DIR = USE_ALPHA5_API ? 'proto_old' : 'proto';
```

**When `USE_ALPHA5_API = false`**:
- Loads from `server/proto/` (Beta 2 proto files)
- Service definitions match Beta 2 Octane API

---

## Testing Checklist

After changing `USE_ALPHA5_API = false` in both files:

- [ ] Rebuild: `npm run build`
- [ ] Restart dev server: `npm run dev`
- [ ] Check server logs for: `"API Version: Beta 2 (2026.1)"`
- [ ] Check server logs for: `"Proto directory: <path>/proto"`
- [ ] Connect to Beta 2 Octane
- [ ] Verify no "Method not found" errors
- [ ] Check viewport renders correctly
- [ ] Test mouse camera controls

---

## Switching Between Versions

### To Use Alpha 5
```typescript
// Both files: SET TO true
vite-plugin-octane-grpc.ts:     const USE_ALPHA5_API = true;
apiVersionConfig.ts:            export const USE_ALPHA5_API = true;
```

### To Use Beta 2
```typescript
// Both files: SET TO false
vite-plugin-octane-grpc.ts:     const USE_ALPHA5_API = false;
apiVersionConfig.ts:            export const USE_ALPHA5_API = false;
```

**CRITICAL**: Both files must match. Mismatched settings will cause method resolution failures.

---

## Log Evidence

From `/workspace/octaneWebR_client.log`:

```
Line 110:  [ERROR] ApiNode.getPinValueByPinID error: Method getPinValueByPinID not found
Line 133+: [ERROR] ApiItem.getValueByAttrID error: Method getValueByAttrID not found (100+ occurrences)
```

These are **Beta 2 method names** being rejected because:
1. Client transformed them to Alpha 5 names (with USE_ALPHA5_API=true)
2. Alpha 5 names sent to Beta 2 Octane
3. Beta 2 Octane doesn't recognize Alpha 5 names

---

## Next Steps

1. ✅ Set `USE_ALPHA5_API = false` in both config files
2. ✅ Rebuild and restart
3. ✅ Test with Beta 2 Octane
4. ✅ Verify all methods work
5. ⏳ Document version switching in README

