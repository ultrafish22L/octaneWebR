/**
 * Parameter Value Management Hook
 *
 * Handles fetching and updating parameter values via the Octane API.
 * Extracted from NodeParameter component for better code organization.
 *
 * Features:
 * - Fetches parameter values using getValueByAttrID
 * - Updates parameter values using setValueByAttrID
 * - Handles API version differences (Alpha 5 vs Beta 2)
 * - Request queuing to prevent connection pool exhaustion
 * - Type conversion for all Octane attribute types
 */

import { useState, useEffect, useCallback } from 'react';
import { SceneNode } from '../../../services/OctaneClient';
import type { OctaneClient } from '../../../services/OctaneClient';
import { AttributeId, AttrType } from '../../../constants/OctaneTypes';
import { Logger } from '../../../utils/Logger';
import { useStatusMessage } from '../../../contexts/StatusMessageContext';
import { requestQueue } from '../../../utils/RequestQueue';
import type { ParameterRawValue, ParameterValue } from '../../../services/octane/ItemService';
export type { ParameterRawValue, ParameterValue };

export interface UseParameterValueReturn {
  paramValue: ParameterValue | null;
  handleValueChange: (newValue: ParameterRawValue) => Promise<void>;
}

/**
 * Hook to manage parameter value fetching and updating
 */
export function useParameterValue(
  node: SceneNode,
  client: OctaneClient,
  isEndNode: boolean
): UseParameterValueReturn {
  const { setTemporaryStatus } = useStatusMessage();
  const [paramValue, setParamValue] = useState<ParameterValue | null>(null);

  // Fetch parameter value for end nodes (matching octaneWeb's GenericNodeRenderer.getValue())
  useEffect(() => {
    let cancelled = false;

    const fetchValue = async () => {
      if (!node.attrInfo || !node.handle || !isEndNode) {
        return;
      }
      try {
        const expectedType = AttrType[node.attrInfo.type as keyof typeof AttrType];

        // Queue the API call to prevent connection pool exhaustion
        // With large parameter trees (hundreds of parameters), all useEffects fire simultaneously
        // This queues them with max 4 concurrent requests to stay within browser limits
        const response = await requestQueue.enqueue(() =>
          client.callApi('ApiItem', 'getValueByAttrID', node.handle, {
            attribute_id: AttributeId.A_VALUE,
            expected_type: expectedType,
          })
        );

        if (cancelled) return;

        if (response) {
          const responseMap = response as Record<string, unknown>;
          const valueField = (responseMap.value as string) || Object.keys(responseMap)[0];
          const actualValue = responseMap[valueField];

          Logger.debugV(`ApiItem:getValueByAttrID for ${node.name}: ${actualValue}`);

          setParamValue({
            value: actualValue,
            type: expectedType,
          });
        }
      } catch (error: unknown) {
        if (cancelled) return;
        Logger.error(
          `getValueByAttrID error for ${node.name}: ${error instanceof Error ? error.message : error}`
        );
      }
    };

    fetchValue();
    return () => {
      cancelled = true;
    };
  }, [isEndNode, node.handle, node.attrInfo, node.name, node.outType, client]);

  // Handle parameter value change (memoized with useCallback)
  const handleValueChange = useCallback(
    async (newValue: ParameterRawValue) => {
      if (!node.handle || !node.attrInfo) return;

      try {
        const expectedType = AttrType[node.attrInfo.type as keyof typeof AttrType];

        // Determine the correct value field name for the setValueByAttrID request.
        // These field names must exactly match the protobuf oneof field names in
        // apiitem.proto — e.g., bool_value, float_value, float3_value, etc.
        let valueField: string;
        let formattedValue: ParameterRawValue;

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
            Logger.warn(`Unsupported type for setValue: ${node.attrInfo.type}`);
            return;
        }

        Logger.debug(`Setting ${node.name} = ${JSON.stringify(formattedValue)}`);

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

        Logger.debug(`Successfully updated ${node.name}`);

        // Trigger render update to see changes
        await client.callApi('ApiChangeManager', 'update', {});
      } catch (error: unknown) {
        Logger.error(
          `Failed to update ${node.name}:`,
          error instanceof Error ? error.message : error
        );
        setTemporaryStatus(`Failed to update ${node.name}`, 3000);
      }
    },
    [node.handle, node.attrInfo, node.name, client, setTemporaryStatus]
  );

  return {
    paramValue,
    handleValueChange,
  };
}
