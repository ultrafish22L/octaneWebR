/**
 * Item Service - ApiItem parameter get/set operations
 *
 * Encapsulates all attribute value operations on Octane nodes.
 * Used by the Node Inspector to read and write parameter values.
 */

import { Logger } from '../../utils/Logger';
import { EventEmitter } from '../../utils/EventEmitter';
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';
import { AttributeId, AttrType } from '../../constants/OctaneProtocol';
import { cacheManager } from '../CacheManager';

export type ParameterRawValue =
  | boolean
  | string
  | number
  | number[]
  | { x: number; y?: number; z?: number; w?: number };

export interface ParameterValue {
  /** Dynamic value from gRPC — runtime type varies by AttrType (bool, int, float, string, vector, etc.) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  type: number;
}

export class ItemService extends BaseService {
  private apiService: ApiService;

  constructor(emitter: EventEmitter, serverUrl: string, apiService: ApiService) {
    super(emitter, serverUrl);
    this.apiService = apiService;
  }

  /**
   * Read an attribute value from a node.
   * Returns null when the attribute is absent or the call fails.
   */
  async getParameterValue(handle: string, expectedType: number): Promise<ParameterValue | null> {
    const cacheKey = `node:${handle}:params:${expectedType}`;
    return cacheManager.get<ParameterValue | null>(cacheKey, async () => {
      try {
        const response = await this.apiService.callApi('ApiItem', 'getValueByAttrID', handle, {
          attribute_id: AttributeId.A_VALUE,
          expected_type: expectedType,
        });

        if (!response) return null;

        // Response format: { value: "float_value", float_value: 2 }
        // The "value" field names the oneof variant that is populated.
        // Check for specific known field names rather than relying on Object.keys() order.
        const responseMap = response as Record<string, unknown>;
        const valueField =
          (responseMap.value as string) ||
          (responseMap.bool_value !== undefined ? 'bool_value' : undefined) ||
          (responseMap.int_value !== undefined ? 'int_value' : undefined) ||
          (responseMap.int2_value !== undefined ? 'int2_value' : undefined) ||
          (responseMap.int3_value !== undefined ? 'int3_value' : undefined) ||
          (responseMap.int4_value !== undefined ? 'int4_value' : undefined) ||
          (responseMap.long_value !== undefined ? 'long_value' : undefined) ||
          (responseMap.long2_value !== undefined ? 'long2_value' : undefined) ||
          (responseMap.float_value !== undefined ? 'float_value' : undefined) ||
          (responseMap.float2_value !== undefined ? 'float2_value' : undefined) ||
          (responseMap.float3_value !== undefined ? 'float3_value' : undefined) ||
          (responseMap.float4_value !== undefined ? 'float4_value' : undefined) ||
          (responseMap.string_value !== undefined ? 'string_value' : undefined);
        if (!valueField) return null;
        const actualValue = responseMap[valueField];

        return { value: actualValue, type: expectedType };
      } catch (error) {
        Logger.error(
          ` getParameterValue failed for handle ${handle}:`,
          error instanceof Error ? error.message : error
        );
        return null;
      }
    });
  }

  /**
   * Write an attribute value to a node and trigger a render update.
   *
   * The protobuf oneof field name (bool_value, float_value, etc.) is
   * determined from expectedType here so callers never have to know it.
   */
  async setParameterValue(
    handle: string,
    expectedType: number,
    newValue: ParameterRawValue
  ): Promise<void> {
    // Map AttrType → the exact protobuf oneof field name.
    // These names must match the oneof fields in apiitem.proto.
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
        Logger.warn(`Unsupported AttrType for setParameterValue: ${expectedType}`);
        return;
    }

    await this.apiService.callApi('ApiItem', 'setValueByAttrID', handle, {
      attribute_id: AttributeId.A_VALUE,
      expected_type: expectedType,
      [valueField]: formattedValue,
      evaluate: false, // Defer evaluation until ApiChangeManager.update
    });

    // Invalidate cached parameter values for this node
    cacheManager.invalidate(`node:${handle}:params:*`);

    // Notify Octane to re-evaluate the scene after the value change
    await this.apiService.callApi('ApiChangeManager', 'update', {});
  }

  /**
   * Force Octane to reload the file associated with a file node
   * (mesh, texture, etc.) by toggling the boolean trigger attribute.
   */
  async reloadFileNode(handle: string): Promise<void> {
    await this.apiService.callApi('ApiItem', 'setValueByAttrID', handle, {
      attribute_id: AttributeId.A_VALUE,
      expected_type: AttrType.AT_BOOL,
      bool_value: true,
      evaluate: true,
    });
  }
}
