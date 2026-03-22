/**
 * Attribute Tools — get_attribute, set_attribute
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { OctaneMcpClient, mcpLogLazy } from '../OctaneMcpClient';
import { jsonResult, errorResult, gateHandle, OBJ_API_ITEM } from './utils';
import { AttrType } from '../../../shared/OctaneConstants';

const AT_BOOL = AttrType.AT_BOOL;
const AT_INT = AttrType.AT_INT;
const AT_INT2 = AttrType.AT_INT2;
const AT_FLOAT = AttrType.AT_FLOAT;
const AT_FLOAT2 = AttrType.AT_FLOAT2;
const AT_FLOAT3 = AttrType.AT_FLOAT3;
const AT_STRING = AttrType.AT_STRING;

/**
 * Map expected_type to the correct proto oneof field for getValue responses.
 */
function extractAttributeValue(result: any, expectedType: number): any {
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
        const value = extractAttributeValue(result, expected_type);
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

  // ── Tier 2A: Attribute Introspection ──────────────────────────────────

  server.tool(
    'get_all_attributes',
    'Enumerate all attributes on a node. Returns list of {id, name, type} for every attribute. Essential for discovering what properties a node supports.',
    {
      handle: z.number().int().nonnegative().describe('Node handle'),
    },
    async ({ handle }) => {
      try {
        const gated = gateHandle('get_all_attributes', handle, client.sceneCache);
        if (gated) return gated;

        // Get attribute count
        const countResult = await client.callMethod('ApiItem', 'attrCount', {
          objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
        });
        const count = Number(countResult?.result ?? 0);

        const attrs: { id: number; name: string; type: string; isArray: boolean }[] = [];
        for (let i = 0; i < count; i++) {
          try {
            // Get attribute ID at index
            const idResult = await client.callMethod('ApiItem', 'attrIdIx', {
              objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
              index: i,
            });
            // attrIdIx returns AttributeId enum — may be string ("A_VALUE") or number
            const rawId = idResult?.result;
            const attrId = typeof rawId === 'string' ? rawId : Number(rawId ?? 0);

            // Get attribute info
            const infoResult = await client.callMethod('ApiItem', 'attrInfoIx', {
              objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
              index: i,
            });
            const info = infoResult?.result ?? infoResult;

            attrs.push({
              id: attrId,
              name: info?.name ?? info?.description ?? '',
              type: info?.type ?? 'UNKNOWN',
              isArray: info?.isArray ?? false,
            });
          } catch (e: any) {
            mcpLogLazy(
              'verbose',
              () => `[attribute:get_all_attributes:attr:${i}] ${e?.message ?? e}`
            );
            // Skip unreadable attributes
          }
        }

        return jsonResult({ handle, attribute_count: count, attributes: attrs });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'get_attribute_info',
    'Get metadata for a specific attribute by ID: name, type, isArray, defaults, description. Use after get_all_attributes to dig into a specific attribute.',
    {
      handle: z.number().int().nonnegative().describe('Node handle'),
      attribute_id: z.number().describe('Attribute ID'),
    },
    async ({ handle, attribute_id }) => {
      try {
        const gated = gateHandle('get_attribute_info', handle, client.sceneCache);
        if (gated) return gated;

        const result = await client.callMethod('ApiItem', 'attrInfo', {
          objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
          id: attribute_id,
        });
        const info = result?.result ?? result;
        return jsonResult({
          handle,
          attribute_id,
          info: {
            id: info?.id,
            type: info?.type,
            isArray: info?.isArray,
            description: info?.description,
            defaultInts: info?.defaultInts,
            defaultFloats: info?.defaultFloats,
            defaultString: info?.defaultString,
          },
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'get_pin_value',
    "Get the value of a pin's connected node attribute in one call. Shortcut for: get_node_info → find connected_handle → get_attribute. Returns the A_VALUE (185) of the connected node.",
    {
      handle: z.number().int().nonnegative().describe('Node handle'),
      pin_index: z.number().int().nonnegative().describe('Pin index to read value from'),
      attribute_id: z
        .number()
        .optional()
        .default(185)
        .describe('Attribute ID to read (default: A_VALUE=185)'),
      expected_type: z
        .number()
        .optional()
        .default(AT_FLOAT3)
        .describe('AttrType (default: AT_FLOAT3=11)'),
    },
    async ({ handle, pin_index, attribute_id, expected_type }) => {
      try {
        const gated = gateHandle('get_pin_value', handle, client.sceneCache);
        if (gated) return gated;

        // Get connected node on this pin
        const { getConnectedHandle } = await import('./pin-utils');
        const connHandle = await getConnectedHandle(client, handle, pin_index);
        if (!connHandle) {
          return errorResult(`Pin ${pin_index} on handle ${handle} has no connected node`);
        }

        // Track discovered handle so subsequent get/set_attribute calls aren't gated
        if (!client.sceneCache.validateHandle(connHandle).valid) {
          client.sceneCache.addNode(connHandle, `pin_${pin_index}_child`, 'NT_UNKNOWN', 0);
        }

        // Read attribute from connected node
        const result = await client.callMethod('ApiItem', getMethod, {
          objectPtr: { handle: String(connHandle), type: OBJ_API_ITEM },
          attribute_id,
          expected_type,
        });
        const value = extractAttributeValue(result, expected_type);
        return jsonResult({
          handle,
          pin_index,
          connected_handle: connHandle,
          attribute_id,
          value,
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'is_animated',
    'Check if an attribute on a node has animation. Returns true if an animator is attached.',
    {
      handle: z.number().int().nonnegative().describe('Node handle'),
      attribute_id: z.number().describe('Attribute ID to check'),
    },
    async ({ handle, attribute_id }) => {
      try {
        const gated = gateHandle('is_animated', handle, client.sceneCache);
        if (gated) return gated;

        const result = await client.callMethod('ApiItem', 'isAnimated', {
          objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
          id: attribute_id,
        });
        return jsonResult({
          handle,
          attribute_id,
          is_animated: result?.result ?? false,
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
