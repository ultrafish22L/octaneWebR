/**
 * Parameter Value Management Hook
 *
 * Handles fetching and updating parameter values via the Octane API.
 * Extracted from NodeParameter component for better code organization.
 *
 * Features:
 * - Fetches parameter values using getByAttrID/getValueByAttrID
 * - Updates parameter values using setValueByAttrID
 * - Handles API version differences (Alpha 5 vs Beta 2)
 * - Request queuing to prevent connection pool exhaustion
 * - Type conversion for all Octane attribute types
 */

import { useState, useEffect } from 'react';
import { SceneNode } from '../../../services/OctaneClient';
import type { OctaneClient } from '../../../services/OctaneClient';
import { AttributeId, AttrType } from '../../../constants/OctaneTypes';
import { USE_ALPHA5_API } from '../../../config/apiVersionConfig';
import { Logger } from '../../../utils/Logger';
import { requestQueue } from '../../../utils/RequestQueue';

export interface ParameterValue {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  type: number;
}

export interface UseParameterValueReturn {
  paramValue: ParameterValue | null;

  handleValueChange: (newValue: any) => Promise<void>;
}

/**
 * Hook to manage parameter value fetching and updating
 */
export function useParameterValue(
  node: SceneNode,
  client: OctaneClient,
  isEndNode: boolean
): UseParameterValueReturn {
  const [paramValue, setParamValue] = useState<ParameterValue | null>(null);

  // Fetch parameter value for end nodes (matching octaneWeb's GenericNodeRenderer.getValue())
  useEffect(() => {
    const fetchValue = async () => {
      // Verbose parameter logging (commented out to reduce log flooding)
      // Log every node to understand the tree structure
      // if (level < 3) {  // Only log first 3 levels to avoid spam
      //   Logger.debug(`📋 NodeParameter: "${node.name}" - hasChildren:${hasChildren}, has attrInfo:${!!node.attrInfo}, isEndNode:${isEndNode}, handle:${node.handle}`);
      // }

      if (!node.attrInfo || !node.handle || !isEndNode) {
        return; // Skip without verbose logging
      }

      // Only call value fetch on simple value types (not complex nodes like geometry, materials, etc.)
      // Both APIs are stricter with non-value nodes
      // These PT_ types match PinTypeId enum from octaneids.proto - only primitive value nodes
      const valueTypes = ['PT_BOOL', 'PT_INT', 'PT_FLOAT', 'PT_STRING', 'PT_ENUM'];

      // SPECIAL CASE: AT_FLOAT3 with PT_TEXTURE outType (e.g., stereo filters, sky color)
      // These are texture pins that can ALSO hold simple RGB values
      // We need to fetch their values to display color pickers
      const isFloat3TexturePin =
        node.attrInfo.type === 'AT_FLOAT3' && node.outType === 'PT_TEXTURE';

      if (!node.outType || (!valueTypes.includes(String(node.outType)) && !isFloat3TexturePin)) {
        Logger.debug(
          `🚫 Skipping value fetch for ${node.name} (outType: ${node.outType}, attrType: ${node.attrInfo.type}) - not a simple value type`
        );
        return; // Skip nodes that aren't simple value types
      }

      if (isFloat3TexturePin) {
        Logger.debug(
          `✅ AT_FLOAT3 texture pin detected: ${node.name} - fetching RGB value for color picker`
        );
      }

      // Alpha 5 uses 'getByAttrID', Beta 2 uses 'getValueByAttrID'
      const methodName = USE_ALPHA5_API ? 'getByAttrID' : 'getValueByAttrID';
      Logger.debug(`✅ Calling ${methodName} for ${node.name} (outType: ${node.outType})`);

      try {
        // attrInfo.type is already a STRING like "AT_FLOAT3" from the API
        // Use it directly, no conversion needed
        const expectedType = AttrType[node.attrInfo.type as keyof typeof AttrType];

        if (USE_ALPHA5_API) {
          Logger.debug(`🔍 Alpha 5 API call: ApiItem.${methodName}`);
          Logger.debug(`  - handle: ${node.handle}`);
          Logger.debug(`  - attribute_id: ${AttributeId.A_VALUE} (A_VALUE)`);
          Logger.debug(`  - expected_type: ${expectedType} (${node.attrInfo.type})`);
        }

        // Queue the API call to prevent connection pool exhaustion
        // With large parameter trees (hundreds of parameters), all useEffects fire simultaneously
        // This queues them with max 4 concurrent requests to stay within browser limits
        const response = await requestQueue.enqueue(() =>
          client.callApi(
            'ApiItem',
            methodName, // Use correct method name for API version
            node.handle, // Pass handle as string
            {
              attribute_id: AttributeId.A_VALUE, // 185 - Use constant instead of hardcoded value
              expected_type: expectedType, // number
            }
          )
        );

        if (response) {
          // Extract the actual value from the response
          // API returns format like: {float_value: 2, value: "float_value"}
          // We need to get the value from the field indicated by response.value
          const valueField = response.value || Object.keys(response)[0];
          const actualValue = response[valueField];

          if (USE_ALPHA5_API) {
            Logger.debug(`✅ Alpha 5 value fetch SUCCESS for ${node.name}: ${actualValue}`);
          }

          setParamValue({
            value: actualValue,
            type: expectedType,
          });
        }
      } catch (error: any) {
        // Log Alpha 5 errors for debugging, silently ignore Beta 2 errors
        if (USE_ALPHA5_API) {
          Logger.error(
            `❌ Alpha 5 ${methodName} error for ${node.name}: ${error.message || error}`
          );
        }
      }
    };

    fetchValue();
  }, [isEndNode, node.handle, node.attrInfo, node.name, node.outType, client]);

  // Handle parameter value change
  const handleValueChange = async (newValue: any) => {
    if (!node.handle || !node.attrInfo) return;

    try {
      const expectedType = AttrType[node.attrInfo.type as keyof typeof AttrType];

      // Determine the correct value field name based on type
      // CRITICAL: Must match exact field names used by octaneWeb and Octane API
      let valueField: string;
      let formattedValue: any;

      switch (expectedType) {
        case AttrType.AT_BOOL:
          valueField = 'bool_value';
          formattedValue = Boolean(newValue);
          break;
        case AttrType.AT_INT:
          valueField = 'int_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_INT2:
          valueField = 'int2_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_INT3:
          valueField = 'int3_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_INT4:
          valueField = 'int4_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_LONG:
          valueField = 'long_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_LONG2:
          valueField = 'long2_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_FLOAT:
          valueField = 'float_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_FLOAT2:
          valueField = 'float2_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_FLOAT3:
          valueField = 'float3_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_FLOAT4:
          valueField = 'float4_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_STRING:
          valueField = 'string_value';
          formattedValue = String(newValue);
          break;
        default:
          Logger.warn(`⚠️  Unsupported type for setValue: ${node.attrInfo.type}`);
          return;
      }

      Logger.debug(`📝 Setting ${node.name} = ${JSON.stringify(formattedValue)}`);

      // Call setValueByAttrID to update the value in Octane
      // Note: evaluate: false is required (matches octaneWeb behavior)
      await client.callApi('ApiItem', 'setValueByAttrID', node.handle, {
        attribute_id: AttributeId.A_VALUE,
        expected_type: expectedType,
        [valueField]: formattedValue,
        evaluate: false, // Required parameter from octaneWeb
      });

      // Update local state to reflect the change
      setParamValue({
        value: formattedValue,
        type: expectedType,
      });

      Logger.debug(`✅ Successfully updated ${node.name}`);

      // Trigger render update to see changes
      await client.callApi('ApiChangeManager', 'update', {});
    } catch (error: any) {
      Logger.error(`❌ Failed to update ${node.name}:`, error.message || error);
    }
  };

  return {
    paramValue,
    handleValueChange,
  };
}
