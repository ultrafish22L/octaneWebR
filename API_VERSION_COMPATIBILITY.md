# API Version Compatibility Layer

octaneWebR includes a compatibility layer to support multiple versions of the Octane gRPC API through a simple configuration flag.

## Supported Versions

- **Beta 2 (2026.1)** - Uses proto files from `server/proto/`
- **Alpha 5 (2026.1)** - Uses proto files from `server/proto_old/`

## Quick Start

### Switch to Alpha 5

1. Open `client/src/config/apiVersionConfig.ts`
2. Change `USE_ALPHA5_API = false` to `USE_ALPHA5_API = true`
3. Rebuild and restart: `npm run build && npm run dev`

### Switch to Beta 2 (Default)

1. Open `client/src/config/apiVersionConfig.ts`
2. Change `USE_ALPHA5_API = true` to `USE_ALPHA5_API = false`
3. Rebuild and restart: `npm run build && npm run dev`

## How It Works

The compatibility layer operates at two levels in `ApiService.callApi()`:

### 1. Method Name Translation

Beta 2 API method names are automatically translated to their Alpha 5 equivalents:

| Beta 2 Method | Alpha 5 Method |
|---------------|----------------|
| `getPinValueByPinID` | `getPinValue` |
| `setPinValueByPinID` | `setPinValue` |
| `setValueByAttrID` | `setByAttrID` |
| `getValueByAttrID` | `getByAttrID` |

**Implementation**: `getCompatibleMethodName()` in `apiVersionConfig.ts`

### 2. Parameter Transformation

Request parameters are transformed to match each API version's structure:

#### getPinValueByPinID / setPinValueByPinID

**Beta 2 Request:**
```javascript
{
  pin_id: 2672,
  expected_type: PIN_ID_BOOL,
  bool_value: true,
  evaluate: true
}
```

**Alpha 5 Request (after transformation):**
```javascript
{
  id: 2672,
  value: true,
  evaluate: true
}
```

**Transformations Applied:**
- `pin_id` → `id`
- `bool_value` / `int_value` / `float_value` / etc. → `value`
- `expected_type` is removed (not used in Alpha 5)

**Implementation**: `transformRequestParams()` in `apiVersionConfig.ts`

## Key API Differences

### Method Names

Beta 2 uses more descriptive method names while Alpha 5 uses shorter names with overloading:

```typescript
// Beta 2 style (explicit)
getPinValueByPinID()  // Get by pin ID
getPinValueByName()   // Get by name
getPinValueByIx()     // Get by index

// Alpha 5 style (overloaded)
getPinValue()         // Get by pin ID
getPinValue12()       // Get by name (overload 12)
getPinValueIx()       // Get by index
```

### Request Structure

**Beta 2** uses a `oneof` structure with typed value fields:
```protobuf
message setPinValueByIDRequest {
  ObjectRef item_ref = 1;
  PinId pin_id = 2;
  optional bool evaluate = 3;
  oneof value {
    bool bool_value = 10;
    int32 int_value = 11;
    float float_value = 17;
    // ... etc
  }
}
```

**Alpha 5** uses method overloading with a generic `value` field:
```protobuf
message setPinValueRequest {
  ObjectRef objectPtr = 1;
  PinId id = 2;
  bool value = 3;      // bool overload
  bool evaluate = 4;
}

message setPinValue1Request {
  ObjectRef objectPtr = 1;
  PinId id = 2;
  float value = 3;     // float overload
  bool evaluate = 4;
}
```

The compatibility layer handles this by:
1. Using the base method name (`setPinValue`)
2. Transforming typed fields (`bool_value`, `float_value`) to generic `value`
3. Letting the gRPC server select the correct overload based on the value type

## Architecture

### File Structure

```
client/src/
├── config/
│   └── apiVersionConfig.ts    # Version flag and transformation logic
└── services/octane/
    └── ApiService.ts           # Integrates compatibility layer
```

### Call Flow

```
Component/Service
    ↓
client.callApi('ApiNode', 'getPinValueByPinID', handle, params)
    ↓
ApiService.callApi()
    ↓
getCompatibleMethodName('ApiNode', 'getPinValueByPinID')
    → Returns 'getPinValue' if USE_ALPHA5_API=true
    → Returns 'getPinValueByPinID' if USE_ALPHA5_API=false
    ↓
transformRequestParams('ApiNode', 'getPinValueByPinID', params)
    → Transforms params if USE_ALPHA5_API=true
    → Returns params unchanged if USE_ALPHA5_API=false
    ↓
fetch(`/api/grpc/ApiNode/${compatibleMethod}`, { body: transformedParams })
    ↓
gRPC Server (vite-plugin-octane-grpc)
    ↓
Octane LiveLink Server (port 51022)
```

## Debugging

### Console Logs

When the compatibility layer is active, you'll see debug logs in the browser console:

```
🔄 API Compatibility: getPinValueByPinID → getPinValue (Alpha 5 (2026.1))
🔄 API Compatibility: Parameter transformation applied
   Original: { pin_id: 2672, expected_type: 1, bool_value: true }
   Transformed: { id: 2672, value: true }
```

### Enable Debug Logging

```javascript
// In browser console
localStorage.setItem('logLevel', 'DEBUG');
```

### Check Current Version

```javascript
// In browser console
import { getApiVersion } from './client/src/config/apiVersionConfig';
console.log(getApiVersion());
// Output: "Beta 2 (2026.1)" or "Alpha 5 (2026.1)"
```

## Adding New Method Mappings

If you find additional API methods that need compatibility mappings:

### 1. Add Method Name Mapping

Edit `client/src/config/apiVersionConfig.ts`:

```typescript
export const METHOD_NAME_MAP: Record<string, string> = {
  'getPinValueByPinID': 'getPinValue',
  'setPinValueByPinID': 'setPinValue',
  'setValueByAttrID': 'setByAttrID',
  
  // Add new mapping
  'newBeta2Method': 'newAlpha5Method',
};
```

### 2. Add Parameter Transformation (if needed)

Edit the `transformRequestParams()` function:

```typescript
if (methodName === 'newBeta2Method') {
  // Add parameter transformations
  if ('beta2ParamName' in transformed) {
    transformed.alpha5ParamName = transformed.beta2ParamName;
    delete transformed.beta2ParamName;
  }
}
```

## Testing

### Test with Beta 2

1. Set `USE_ALPHA5_API = false`
2. Start Octane with Beta 2 gRPC build
3. Run octaneWebR: `npm run dev`
4. Test features: node creation, parameter editing, rendering

### Test with Alpha 5

1. Set `USE_ALPHA5_API = true`
2. Start Octane with Alpha 5 gRPC build
3. Run octaneWebR: `npm run dev`
4. Test same features: node creation, parameter editing, rendering
5. Check console for compatibility layer logs

### Verification Checklist

- [ ] Node creation works
- [ ] Node connections work
- [ ] Parameter editing works (Node Inspector)
- [ ] Viewport resolution lock works (uses `getPinValueByPinID`/`setPinValueByPinID`)
- [ ] Scene tree loads correctly
- [ ] No gRPC errors in console
- [ ] Compatibility logs appear when using Alpha 5

## Known Limitations

1. **Method Overloading**: Alpha 5 uses numbered method overloads (`setPinValue1`, `setPinValue2`, etc.) for different types. Currently, we use the base method name and rely on the gRPC server to select the correct overload based on the parameter types. This may not work for all cases.

2. **Response Structure**: Currently only request parameters are transformed. If response structures differ between versions, additional transformation may be needed.

3. **Proto Files**: Both `server/proto/` and `server/proto_old/` must be present. The flag only affects which method names and parameter structures are used, not which proto files are compiled.

## Future Enhancements

- [ ] Automatic overload selection based on value type
- [ ] Response transformation if needed
- [ ] Runtime API version detection (query Octane for version)
- [ ] Automated tests for compatibility layer
- [ ] Support for additional API versions

## Troubleshooting

### Error: Method not found

**Symptom**: `gRPC error: Method 'getPinValue' not found`

**Solution**: 
- Check that you're using the correct Octane build (Alpha 5 vs Beta 2)
- Verify `USE_ALPHA5_API` matches your Octane version
- Check method name mapping in `apiVersionConfig.ts`

### Error: Invalid parameter

**Symptom**: `gRPC error: Unknown field 'pin_id'` or `Unknown field 'id'`

**Solution**:
- Check parameter transformation in `transformRequestParams()`
- Verify parameter names match the proto definitions
- Check console logs for parameter transformation output

### No compatibility logs appearing

**Symptom**: Using Alpha 5 but no `🔄 API Compatibility` logs

**Solution**:
- Enable debug logging: `localStorage.setItem('logLevel', 'DEBUG')`
- Verify `USE_ALPHA5_API = true` in `apiVersionConfig.ts`
- Check that affected methods are being called

## References

- Proto files: `server/proto/` (Beta 2) and `server/proto_old/` (Alpha 5)
- Config file: `client/src/config/apiVersionConfig.ts`
- Integration: `client/src/services/octane/ApiService.ts`
- Usage examples: `client/src/services/octane/RenderService.ts` (lines 164, 183)

---

**Last Updated**: 2025-01-30  
**Version**: 1.0.0
