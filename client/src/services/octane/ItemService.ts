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
import { AttributeId, AttrType } from '../../constants/OctaneTypes';

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
    try {
      const response = await this.apiService.callApi('ApiItem', 'getValueByAttrID', handle, {
        attribute_id: AttributeId.A_VALUE,
        expected_type: expectedType,
      });

      if (!response) return null;

      // Response format: { value: "float_value", float_value: 2 }
      // The "value" field names the oneof variant that is populated.
      const responseMap = response as Record<string, unknown>;
      const valueField = (responseMap.value as string) || Object.keys(responseMap)[0];
      const actualValue = responseMap[valueField];

      return { value: actualValue, type: expectedType };
    } catch (error) {
      Logger.error(
        ` getParameterValue failed for handle ${handle}:`,
        error instanceof Error ? error.message : error
      );
      return null;
    }
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
