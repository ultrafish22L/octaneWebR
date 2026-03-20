/**
 * Attribute Tools — get_attribute, set_attribute
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { OctaneMcpClient } from '../OctaneMcpClient';
import { jsonResult, errorResult, gateHandle, OBJ_API_ITEM } from './utils';

// AttrType enum values (from OctaneProtocol.ts)
const AT_BOOL = 1;
const AT_INT = 3;
const AT_INT2 = 4;
const AT_FLOAT = 9;
const AT_FLOAT2 = 90;
const AT_FLOAT3 = 11;
const AT_STRING = 14;

/**
 * Map expected_type to the correct proto oneof field for getValue responses.
 */
function extractValue(result: any, expectedType: number): any {
  if (!result) return null;

  // The response may have the value directly or nested
  if (result.bool_value !== undefined) return result.bool_value;
  if (result.int_value !== undefined) return result.int_value;
  if (result.float_value !== undefined) return result.float_value;
  if (result.string_value !== undefined) return result.string_value;
  if (result.float3_value !== undefined) return result.float3_value;
  if (result.float2_value !== undefined) return result.float2_value;
  if (result.int2_value !== undefined) return result.int2_value;
  if (result.int3_value !== undefined) return result.int3_value;

  // Fallback: return the raw result
  return result.value ?? result;
}

/**
 * Build the value params for a setAttribute call based on the expected type.
 */
function buildValueParams(value: any, expectedType: number): Record<string, any> {
  switch (expectedType) {
    case AT_BOOL:
      return { bool_value: Boolean(value) };
    case AT_INT:
      return { int_value: Number(value) };
    case AT_FLOAT:
      return { float_value: Number(value) };
    case AT_STRING:
      return { string_value: String(value) };
    case AT_INT2:
      if (typeof value === 'object' && value.x !== undefined) {
        return { int2_value: { x: Number(value.x), y: Number(value.y ?? 0) } };
      }
      return { int_value: Number(value) };
    case AT_FLOAT2:
      if (typeof value === 'object' && value.x !== undefined) {
        return { float2_value: { x: value.x, y: value.y ?? 0 } };
      }
      return { float_value: Number(value) };
    case AT_FLOAT3:
      if (typeof value === 'object' && value.x !== undefined) {
        return { float3_value: { x: value.x, y: value.y ?? 0, z: value.z ?? 0 } };
      }
      return { float_value: Number(value) };
    default:
      // For other types, try to infer
      if (typeof value === 'boolean') return { bool_value: value };
      if (typeof value === 'number') return { float_value: value };
      if (typeof value === 'string') return { string_value: value };
      return { float_value: Number(value) };
  }
}

export function registerAttributeTools(server: McpServer, client: OctaneMcpClient) {
  // Always use Beta 2 method names — OctaneGrpcClientBase.callMethod() translates
  const getMethod = 'getValueByAttrID';
  const setMethod = 'setValueByAttrID';

  server.tool(
    'get_attribute',
    'Get a node attribute value by attribute ID. Use list_node_types to find attribute IDs and types. Common: A_VALUE=185, A_FILENAME=34. Types: AT_BOOL=1, AT_INT=3, AT_FLOAT=9, AT_FLOAT3=11, AT_STRING=14.',
    {
      handle: z.number().int().nonnegative().describe('Node handle'),
      attribute_id: z.number().describe('Attribute ID (e.g. 185 for A_VALUE, 34 for A_FILENAME)'),
      expected_type: z
        .number()
        .describe('AttrType enum value (e.g. 1=AT_BOOL, 3=AT_INT, 9=AT_FLOAT, 14=AT_STRING)'),
    },
    async ({ handle, attribute_id, expected_type }) => {
      try {
        const gated = gateHandle('get_attribute', handle, client.sceneCache);
        if (gated) return gated;

        // Pre-check: does this handle actually support this attribute?
        const hasAttrResult = await client.callMethod('ApiItem', 'hasAttr', {
          objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
          id: attribute_id,
        });
        if (!hasAttrResult?.result) {
          return errorResult(
            `Handle ${handle} does not have attribute ${attribute_id}. ` +
              `Use get_node_info to find the correct child handle for this attribute.`
          );
        }

        const result = await client.callMethod('ApiItem', getMethod, {
          objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
          attribute_id,
          expected_type,
        });
        const value = extractValue(result, expected_type);
        return jsonResult({ handle, attribute_id, expected_type, value });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'set_attribute',
    'Set a node attribute value. Common: A_VALUE=185, A_FILENAME=34, A_TRANSLATION=172, A_ROTATION=137 (degrees!), A_SCALE=139. Types: AT_BOOL=1, AT_INT=3, AT_FLOAT=9, AT_FLOAT2=90, AT_FLOAT3=11, AT_STRING=14. IMPORTANT: Transform attributes (A_TRANSLATION, A_ROTATION, A_SCALE) must be set on the TRANSFORM CHILD handle (pin 3 connected_handle on NT_GEO_OBJECT), NOT on the geo object itself — setting on the geo object silently does nothing. DOF is ON by default (aperture=0.893) — set to 0. Emission efficiency defaults to 0.025 — set to 1.0 or lights will be 40x dim. A_FILENAME validates path exists (bad paths hang gRPC 30s).',
    {
      handle: z.number().int().nonnegative().describe('Node handle'),
      attribute_id: z.number().describe('Attribute ID'),
      expected_type: z.number().describe('AttrType enum value'),
      value: z
        .union([
          z.boolean(),
          z.number(),
          z.string(),
          z.object({ x: z.number(), y: z.number().optional(), z: z.number().optional() }),
        ])
        .describe('Value to set (boolean, number, string, or {x, y, z} for float3)'),
    },
    async ({ handle, attribute_id, expected_type, value }) => {
      try {
        // Gate: reject handles never seen by any MCP tool
        const gated = gateHandle('set_attribute', handle, client.sceneCache);
        if (gated) return gated;

        // Pre-check: does this handle actually support this attribute?
        // ApiItem.hasAttr is a safe per-instance check (no crash risk).
        const hasAttrResult = await client.callMethod('ApiItem', 'hasAttr', {
          objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
          id: attribute_id,
        });
        if (!hasAttrResult?.result) {
          return errorResult(
            `Handle ${handle} does not have attribute ${attribute_id}. ` +
              `Use get_node_info to find the correct child handle for this attribute.`
          );
        }

        // A_FILENAME (34) with AT_STRING (14): validate path to prevent blocking Octane dialog
        if (attribute_id === 34 && expected_type === AT_STRING) {
          const filePath = String(value);
          if (!path.isAbsolute(filePath)) {
            return errorResult(
              'A_FILENAME requires an absolute path. Relative paths cause Octane to pop a blocking dialog.'
            );
          }
          // Skip existence check for UNC paths (network mounts)
          if (!filePath.startsWith('\\\\') && !fs.existsSync(filePath)) {
            return errorResult(
              `File not found: ${filePath}. Non-existent paths cause Octane to pop a blocking dialog that hangs gRPC for 30s.`
            );
          }
        }

        const valueParams = buildValueParams(value, expected_type);
        // Match web UI pattern: set with evaluate:false, then ApiChangeManager.update()
        await client.callMethod('ApiItem', setMethod, {
          objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
          attribute_id,
          ...valueParams,
          evaluate: false,
        });

        // Always flush — matches web UI's ItemService.setParameterValue() pattern
        await client.callMethod('ApiChangeManager', 'update', {});

        return jsonResult({ success: true, handle, attribute_id, value });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  // NOTE: set_pin_value (setPinValueByIx) is defined in the proto but returns
  // UNIMPLEMENTED from the Octane gRPC server. All 6 pin value RPCs (get/set ×
  // ByIx/ByPinID/ByName) are unimplemented as of Octane 2025.1. Use
  // get_node_info + set_attribute on child handles instead.
}
