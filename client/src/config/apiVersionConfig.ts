/**
 * API Version Compatibility Configuration
 * 
 * This file manages compatibility between different Octane gRPC API versions:
 * - Beta 2 (2026.1): Uses server/proto/ files
 * - Alpha 5 (2026.1): Uses server/proto_old/ files
 * 
 * ## How to Switch Versions
 * 
 * 1. Set `USE_ALPHA5_API = true` to use Alpha 5 API
 * 2. Set `USE_ALPHA5_API = false` to use Beta 2 API (default)
 * 3. Rebuild and restart the application
 * 
 * ## Key API Differences
 * 
 * ### Method Names
 * - Beta 2: `getPinValueByPinID`, `setPinValueByPinID`, `setValueByAttrID`
 * - Alpha 5: `getPinValue`, `setPinValue`, `setByAttrID`
 * 
 * ### Request Parameters
 * - Beta 2: Uses `pin_id`, `expected_type`, typed value fields (`bool_value`, `int_value`, etc.)
 * - Alpha 5: Uses `id`, no `expected_type`, generic `value` field
 * 
 * ### Method Overloading
 * - Beta 2: Single method with `oneof` for different value types
 * - Alpha 5: Multiple overloaded methods (`setPinValue`, `setPinValue1`, `setPinValue2`, etc.)
 *   Note: Currently we use the base method name and let the server resolve the overload
 * 
 * ## Implementation
 * 
 * The compatibility layer works at two levels:
 * 1. Method name translation: `getCompatibleMethodName()` maps Beta 2 → Alpha 5 method names
 * 2. Parameter transformation: `transformRequestParams()` converts Beta 2 → Alpha 5 parameter structure
 * 
 * These functions are called in `ApiService.callApi()` before making the gRPC request.
 */

// ============================================================================
// VERSION CONFIGURATION
// ============================================================================

/**
 * API version setting injected at build time by Vite.
 * 
 * ⭐ TO SWITCH API VERSIONS: Edit api-version.config.js at project root!
 * 
 * This ensures both client and server use identical settings.
 * Previous bugs were caused by mismatched configurations.
 * 
 * The __USE_ALPHA5_API__ constant is injected by vite.config.mts at build time.
 */
declare const __USE_ALPHA5_API__: boolean;
export const USE_ALPHA5_API = __USE_ALPHA5_API__;

// ============================================================================
// METHOD NAME MAPPINGS
// ============================================================================

/**
 * API method name compatibility mappings
 * Maps Beta 2 method names to Alpha 5 equivalents
 */
export const METHOD_NAME_MAP: Record<string, string> = {
  // ApiNode methods
  'getPinValueByPinID': 'getPinValue',
  'setPinValueByPinID': 'setPinValue',
  
  // ApiItem methods (if setValueByAttrID was renamed)
  'setValueByAttrID': 'setByAttrID',
  'getValueByAttrID': 'getByAttrID',
  'setValueByIx': 'setByIx',
  'getValueByIx': 'getByIx',
  'setValueByName': 'setByName',
  'getValueByName': 'getByName',
};

/**
 * Get the actual method name to use based on current API version
 * @param _serviceName - The gRPC service name (reserved for future use)
 * @param methodName - The method name (Beta 2 version)
 * @returns The method name to use for the current API version
 */
export function getCompatibleMethodName(_serviceName: string, methodName: string): string {
  if (!USE_ALPHA5_API) {
    // Using Beta 2, no translation needed
    return methodName;
  }
  
  // Using Alpha 5, check if method needs translation
  const mappedName = METHOD_NAME_MAP[methodName];
  return mappedName || methodName;
}

/**
 * Get the current API version string
 */
export function getApiVersion(): string {
  return USE_ALPHA5_API ? 'Alpha 5 (2026.1)' : 'Beta 2 (2026.1)';
}

/**
 * Check if a feature is supported in the current API version
 * @param featureName - Name of the feature to check
 * @returns true if feature is supported
 */
export function isFeatureSupported(featureName: string): boolean {
  const alpha5UnsupportedFeatures: string[] = [
    // Add any features that only work in Beta 2
  ];
  
  if (USE_ALPHA5_API) {
    return !alpha5UnsupportedFeatures.includes(featureName);
  }
  
  return true;
}

// ============================================================================
// REQUEST PARAMETER MAPPINGS (if needed)
// ============================================================================

/**
 * Transform request parameters if needed for compatibility
 * @param _serviceName - The gRPC service name (reserved for future use)
 * @param methodName - The method name (Beta 2 version)
 * @param params - The request parameters (Beta 2 format)
 * @returns The parameters transformed for the current API version
 */
export function transformRequestParams(
  _serviceName: string,
  methodName: string,
  params: any
): any {
  if (!USE_ALPHA5_API) {
    // Using Beta 2, no transformation needed
    return params;
  }
  
  // Using Alpha 5, apply transformations
  const transformed: any = { ...params };
  
  // -------------------------------------------------------------------------
  // getPinValueByPinID / setPinValueByPinID transformations
  // -------------------------------------------------------------------------
  if (methodName === 'getPinValueByPinID' || methodName === 'setPinValueByPinID') {
    // Beta 2: pin_id → Alpha 5: id
    if ('pin_id' in transformed) {
      transformed.id = transformed.pin_id;
      delete transformed.pin_id;
    }
    
    // Beta 2 has expected_type, Alpha 5 doesn't
    if ('expected_type' in transformed) {
      delete transformed.expected_type;
    }
    
    // Beta 2 uses typed value fields (bool_value, int_value, float_value, etc.)
    // Alpha 5 uses generic 'value' field
    const valueFieldMap: Record<string, string> = {
      'bool_value': 'value',
      'int_value': 'value',
      'int2_value': 'value',
      'int3_value': 'value',
      'int4_value': 'value',
      'long_value': 'value',
      'long2_value': 'value',
      'float_value': 'value',
      'float2_value': 'value',
      'float3_value': 'value',
      'float4_value': 'value',
      'string_value': 'value',
    };
    
    for (const [beta2Field, alpha5Field] of Object.entries(valueFieldMap)) {
      if (beta2Field in transformed) {
        transformed[alpha5Field] = transformed[beta2Field];
        delete transformed[beta2Field];
        break; // Only one value field should be present
      }
    }
  }
  
  // -------------------------------------------------------------------------
  // getValueByAttrID / setValueByAttrID transformations
  // -------------------------------------------------------------------------
  if (methodName === 'getValueByAttrID' || methodName === 'setValueByAttrID') {
    // ✅ NO CLIENT-SIDE TRANSFORMATIONS NEEDED
    // Proto verification (2025-01-31): Both Alpha 5 and Beta 2 use identical
    // parameter structures (item_ref, attribute_id, value oneof).
    // Server-side handles objectPtr → item_ref transformation at HTTP boundary.
    // See COMPATIBILITY_VERIFICATION.md for full proto structure analysis.
  }
  
  return transformed;
}
