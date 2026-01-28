# API Version Switching Guide

## Overview

OctaneWebR supports two API versions:
- **Alpha 5 (2026.1)**: Proto files in `server/proto_old/`
- **Beta 2 (2026.1)**: Proto files in `server/proto/`

## ⚠️ Critical Rule

**ALWAYS use the centralized config file to switch versions!**

The app now uses a **single source of truth** for API version configuration.  
Previous bugs were caused by client and server using different API versions.

## How to Switch API Versions

### Method 1: Edit Centralized Config (Recommended ⭐)

1. Open `api-version.config.js` at project root
2. Change line 22:
   ```javascript
   const USE_ALPHA5_API = true;   // For Alpha 5
   const USE_ALPHA5_API = false;  // For Beta 2
   ```
3. Save the file
4. Rebuild: `npm run build`
5. Restart: `npm run dev`

**That's it!** Both client and server will automatically use the same version.

### Method 2: Command Line (Alternative)

```bash
# Switch to Alpha 5
sed -i 's/const USE_ALPHA5_API = false/const USE_ALPHA5_API = true/' api-version.config.js
npm run build && npm run dev

# Switch to Beta 2
sed -i 's/const USE_ALPHA5_API = true/const USE_ALPHA5_API = false/' api-version.config.js
npm run build && npm run dev
```

## What Happens When You Switch

When `USE_ALPHA5_API = true` (Alpha 5):
- ✅ Server loads proto files from `server/proto_old/`
- ✅ Client transforms Beta 2 method names → Alpha 5 method names
  - `getPinValueByPinID` → `getPinValue`
  - `getValueByAttrID` → `getByAttrID`
  - `setPinValueByPinID` → `setPinValue`
  - `setValueByAttrID` → `setByAttrID`
- ✅ Client transforms Beta 2 parameters → Alpha 5 parameters
  - `pin_id` → `id`
  - Removes `expected_type`
  - `bool_value`, `int_value`, etc. → `value`

When `USE_ALPHA5_API = false` (Beta 2):
- ✅ Server loads proto files from `server/proto/`
- ✅ Client uses Beta 2 method names directly (no transformation)
- ✅ Client uses Beta 2 parameters directly (no transformation)

## Key API Differences

| Feature | Beta 2 Method | Alpha 5 Method |
|---------|---------------|----------------|
| Get pin value | `getPinValueByPinID` | `getPinValue` |
| Set pin value | `setPinValueByPinID` | `setPinValue` |
| Get item value | `getValueByAttrID` | `getByAttrID` |
| Set item value | `setValueByAttrID` | `setByAttrID` |

| Parameter | Beta 2 | Alpha 5 |
|-----------|--------|---------|
| Pin ID | `pin_id` | `id` |
| Type validation | `expected_type` (required) | Not used |
| Value field | `bool_value`, `int_value`, `float_value`, etc. | `value` (generic) |

## Verification

After switching, check the console logs:

### Server Console (Terminal)
```
[OCTANE-SERVER] API Version: Alpha 5 (2026.1)
[OCTANE-SERVER] Proto directory: /workspace/project/octaneWebR/server/proto_old
```
or
```
[OCTANE-SERVER] API Version: Beta 2 (2026.1)
[OCTANE-SERVER] Proto directory: /workspace/project/octaneWebR/server/proto
```

### Client Console (Browser)
```
[DEBUG] 🔄 API Compatibility: getPinValueByPinID → getPinValue (Alpha 5)
```
or
```
[DEBUG] 🔄 API Compatibility: Using Beta 2 (no transformation)
```

## Troubleshooting

### Error: "Method not found in service"

**Cause**: Server loaded wrong proto files (doesn't have the method the client is requesting)

**Fix**:
1. Check that you edited `api-version.config.js` (NOT the individual config files)
2. Rebuild and restart the application
3. Clear browser cache if needed

### Error: "INVALID_ARGUMENT" or parameter errors

**Cause**: Client sent wrong parameter structure for the API version

**Fix**: Same as above - ensure centralized config is correct and rebuild

### Previous Configuration Files

**DO NOT EDIT THESE FILES DIRECTLY:**
- ❌ `vite-plugin-octane-grpc.ts` (line 41) - Now imports from centralized config
- ❌ `client/src/config/apiVersionConfig.ts` (line 51) - Now imports from centralized config

These files now **read** from `api-version.config.js`. Editing them will have no effect.

## Architecture

```
api-version.config.js (ROOT - Single Source of Truth)
        ├──> vite-plugin-octane-grpc.ts (Server - CommonJS require)
        └──> client/src/config/apiVersionImport.ts (Bridge - ES module import)
                  └──> client/src/config/apiVersionConfig.ts (Client functions)
```

## Implementation Details

The compatibility layer works at two levels:

1. **Server-Side** (`vite-plugin-octane-grpc.ts`):
   - Selects proto directory based on `USE_ALPHA5_API`
   - Alpha 5: `server/proto_old/`
   - Beta 2: `server/proto/`
   - Transforms parameter names (`objectPtr` → `item_ref` for Beta 2 methods)

2. **Client-Side** (`client/src/config/apiVersionConfig.ts`):
   - Transforms method names (Beta 2 → Alpha 5 if `USE_ALPHA5_API = true`)
   - Transforms parameters (Beta 2 → Alpha 5 if `USE_ALPHA5_API = true`)
   - No transformation if `USE_ALPHA5_API = false`

## See Also

- `BETA2_ANALYSIS.md` - Detailed compatibility analysis
- `AGENTS.md` - Recent fixes and known issues
- `client/src/config/apiVersionConfig.ts` - Client-side compatibility functions
- `vite-plugin-octane-grpc.ts` - Server-side proto loading and parameter transformation
