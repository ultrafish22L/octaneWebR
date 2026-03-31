/**
 * Attribute Tools — get_attribute, set_attribute
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient, mcpLogLazy } from '../OctaneMcpClient';
import { jsonResult, errorResult, OBJ_API_ITEM } from './utils';
import { AttrType, AttributeId } from '../shared/OctaneConstants';

/** Targeted error message when hasAttr returns false */
function missingAttrError(handle: number, attribute_id: number): string {
  const TRANSFORM_ATTRS: Record<number, string> = {
    172: 'A_TRANSLATION',
    137: 'A_ROTATION',
    139: 'A_SCALE',
  };
  const transformName = TRANSFORM_ATTRS[attribute_id];
  if (transformName) {
    return (
      `Handle ${handle} does not have attribute ${attribute_id} (${transformName}). ` +
      `Transform attributes must be set on the TRANSFORM CHILD, not the parent node. ` +
      `Use get_node_info(${handle}) → find pin 3 (transform) → use its connected_handle.`
    );
  }
  return (
    `Handle ${handle} does not have attribute ${attribute_id}. ` +
    `Use get_node_info to find the correct child handle for this attribute.`
  );
}

const AT_BOOL = AttrType.AT_BOOL;
const AT_INT = AttrType.AT_INT;
const AT_INT2 = AttrType.AT_INT2;
const AT_INT3 = AttrType.AT_INT3;
const AT_INT4 = AttrType.AT_INT4;
const AT_FLOAT = AttrType.AT_FLOAT;
const AT_FLOAT2 = AttrType.AT_FLOAT2;
const AT_FLOAT3 = AttrType.AT_FLOAT3;
const AT_FLOAT4 = AttrType.AT_FLOAT4;
const AT_STRING = AttrType.AT_STRING;

/**
 * Map expected_type to the correct proto oneof field for getValue responses.
 *
 * Octane often returns vector types (int4_value, float4_value) even for
 * logically-scalar attributes (e.g. float value nodes use AT_FLOAT4).
 * When expectedType is a scalar (AT_INT, AT_FLOAT) but the response
 * contains a vector, we extract the .x component — matching the pattern
 * used by the web-UI client (RenderService.ts, ItemService.ts).
 */
function extractAttributeValue(result: any, expectedType: number): any {
  if (!result) return null;

  // ── Scalars ──────────────────────────────────────────────────────────
  if (result.bool_value !== undefined) return result.bool_value;
  if (result.int_value !== undefined) return result.int_value;
  if (result.float_value !== undefined) return result.float_value;
  if (result.string_value !== undefined) return result.string_value;

  // ── Vectors (2/3/4-component) ────────────────────────────────────────
  if (result.int2_value !== undefined) return result.int2_value;
  if (result.int3_value !== undefined) return result.int3_value;
  if (result.int4_value !== undefined) {
    const v = result.int4_value;
    // If caller expected a scalar, extract .x (common: float value nodes are AT_INT4)
    if (expectedType === AT_INT || expectedType === AT_BOOL) {
      return v?.x ?? v;
    }
    return v;
  }
  if (result.float2_value !== undefined) return result.float2_value;
  if (result.float3_value !== undefined) return result.float3_value;
  if (result.float4_value !== undefined) {
    const v = result.float4_value;
    // If caller expected a scalar, extract .x (common: float value nodes are AT_FLOAT4)
    if (expectedType === AT_FLOAT) {
      return v?.x ?? v;
    }
    return v;
  }

  // Fallback: return the raw result
  return result.value ?? result;
}

/**
 * Build the value params for a setAttribute call based on the expected type.
 *
 * Octane float/int "value nodes" use AT_FLOAT4 / AT_INT4 internally,
 * even when logically scalar. Callers can pass a plain number and this
 * function wraps it into the correct {x,y,z,w} vector.
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
      return { int2_value: { x: Number(value), y: 0 } };
    case AT_INT3:
      if (typeof value === 'object' && value.x !== undefined) {
        return {
          int3_value: { x: Number(value.x), y: Number(value.y ?? 0), z: Number(value.z ?? 0) },
        };
      }
      return { int3_value: { x: Number(value), y: 0, z: 0 } };
    case AT_INT4:
      if (typeof value === 'object' && value.x !== undefined) {
        return {
          int4_value: {
            x: Number(value.x),
            y: Number(value.y ?? 0),
            z: Number(value.z ?? 0),
            w: Number(value.w ?? 0),
          },
        };
      }
      return { int4_value: { x: Number(value), y: 0, z: 0, w: 0 } };
    case AT_FLOAT2:
      if (typeof value === 'object' && value.x !== undefined) {
        return { float2_value: { x: value.x, y: value.y ?? 0 } };
      }
      return { float2_value: { x: Number(value), y: 0 } };
    case AT_FLOAT3:
      if (typeof value === 'object' && value.x !== undefined) {
        return { float3_value: { x: value.x, y: value.y ?? 0, z: value.z ?? 0 } };
      }
      return { float3_value: { x: Number(value), y: 0, z: 0 } };
    case AT_FLOAT4:
      if (typeof value === 'object' && value.x !== undefined) {
        return { float4_value: { x: value.x, y: value.y ?? 0, z: value.z ?? 0, w: value.w ?? 0 } };
      }
      return { float4_value: { x: Number(value), y: 0, z: 0, w: 0 } };
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

  server.registerTool(
    'get_attribute',
    {
      title: 'Get Attribute',
      description:
        'Get a node attribute value by ID. Float/int value nodes use AT_FLOAT4/AT_INT4 internally — AT_FLOAT auto-extracts .x component.',
      inputSchema: {
        handle: z.number().int().nonnegative().describe('Node handle'),
        attribute_id: z.number().describe('Attribute ID (e.g. 185 for A_VALUE, 34 for A_FILENAME)'),
        expected_type: z
          .number()
          .describe('AttrType enum value (e.g. 1=AT_BOOL, 3=AT_INT, 9=AT_FLOAT, 14=AT_STRING)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ handle, attribute_id, expected_type }) => {
      try {
        // Pre-check: does this handle actually support this attribute?
        const hasAttrResult = await client.callMethod('ApiItem', 'hasAttr', {
          objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
          id: attribute_id,
        });
        if (!hasAttrResult?.result) {
          return errorResult(missingAttrError(handle, attribute_id));
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

  server.registerTool(
    'set_attribute',
    {
      title: 'Set Attribute',
      description:
        'Set a node attribute value by ID. Supports bool, int, float, float3, float4, string. ' +
        'Transform attrs (translation/rotation/scale) go on the TRANSFORM CHILD at pin 3, not the geo object. ' +
        'See octane://constants for IDs.',
      inputSchema: {
        handle: z.number().int().nonnegative().describe('Node handle'),
        attribute_id: z.number().describe('Attribute ID'),
        expected_type: z.number().describe('AttrType enum value'),
        value: z
          .union([
            z.boolean(),
            z.number(),
            z.string(),
            z.object({
              x: z.number(),
              y: z.number().optional(),
              z: z.number().optional(),
              w: z.number().optional(),
            }),
          ])
          .describe(
            'Value to set (boolean, number, string, or {x, y, z, w} for float3/float4). Scalar numbers auto-wrap for float4/int4 types.'
          ),
        skip_evaluate: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            'If true, skip ApiChangeManager.update() after setting. Caller must call flush_changes manually. Use for batching multiple attribute changes.'
          ),
      },
      annotations: { destructiveHint: true },
    },
    async ({ handle, attribute_id, expected_type, value, skip_evaluate }) => {
      try {
        // Pre-check: does this handle actually support this attribute?
        // ApiItem.hasAttr is a safe per-instance check (no crash risk).
        const hasAttrResult = await client.callMethod('ApiItem', 'hasAttr', {
          objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
          id: attribute_id,
        });
        if (!hasAttrResult?.result) {
          return errorResult(missingAttrError(handle, attribute_id));
        }

        const valueParams = buildValueParams(value, expected_type);
        // A_FILENAME triggers SDK file load (mesh/texture import) — can take 30s+ for large files.
        // Use 120s timeout to prevent hung tool calls while still catching real failures.
        const isFileLoad = attribute_id === AttributeId.A_FILENAME;
        const timeout = isFileLoad ? 120_000 : undefined;
        // Match web UI pattern: set with evaluate:false, then ApiChangeManager.update()
        await client.callMethod(
          'ApiItem',
          setMethod,
          {
            objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
            attribute_id,
            ...valueParams,
            evaluate: false,
          },
          timeout
        );

        // Flush scene evaluation unless caller explicitly skips (for batching)
        if (!skip_evaluate) {
          await client.callMethod('ApiChangeManager', 'update', {});
        }

        return jsonResult({ success: true, handle, attribute_id, value });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'flush_changes',
    {
      title: 'Flush Changes',
      description:
        'Flush pending attribute changes. Required after set_attribute calls with skip_evaluate:true.',
      annotations: { idempotentHint: true },
    },
    async () => {
      try {
        await client.callMethod('ApiChangeManager', 'update', {});
        return jsonResult({ success: true, message: 'Scene evaluation flushed.' });
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

  server.registerTool(
    'list_attributes',
    {
      title: 'List Attributes',
      description:
        'Enumerate all attributes on a node. Call describe_tool("list_attributes") for params.',
      inputSchema: {
        handle: z.number().int().nonnegative(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ handle }) => {
      try {
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

  server.registerTool(
    'describe_attribute',
    {
      title: 'Describe Attribute',
      description:
        'Get attribute metadata by ID. Call describe_tool("describe_attribute") for params.',
      inputSchema: {
        handle: z.number().int().nonnegative(),
        attribute_id: z.number(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ handle, attribute_id }) => {
      try {
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

  server.registerTool(
    'read_pin_value',
    {
      title: 'Read Pin Value',
      description:
        'Get a pin\'s connected node attribute value in one call. Call describe_tool("read_pin_value") for params.',
      inputSchema: {
        handle: z.number().int().nonnegative(),
        pin_index: z.number().int().nonnegative(),
        attribute_id: z.number().optional().default(185),
        expected_type: z.number().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ handle, pin_index, attribute_id, expected_type }) => {
      try {
        // Get connected node on this pin
        const { getConnectedHandle } = await import('./pin-utils');
        const connHandle = await getConnectedHandle(client, handle, pin_index);
        if (!connHandle) {
          return errorResult(`Pin ${pin_index} on handle ${handle} has no connected node`);
        }

        // Cache discovered pin child for AI context
        client.sceneCache.addNode(connHandle, `pin_${pin_index}_child`, 'NT_UNKNOWN', 0);

        // Auto-detect attribute type if not specified
        let resolvedType = expected_type;
        if (resolvedType === undefined || resolvedType === null) {
          // Introspect the connected node's first attribute to get actual type
          const countResult = await client.callMethod('ApiItem', 'attrCount', {
            objectPtr: { handle: String(connHandle), type: OBJ_API_ITEM },
          });
          const count = Number(countResult?.result ?? 0);
          if (count > 0) {
            // Find the attribute matching attribute_id and get its type
            for (let i = 0; i < count; i++) {
              const idResult = await client.callMethod('ApiItem', 'attrIdIx', {
                objectPtr: { handle: String(connHandle), type: OBJ_API_ITEM },
                index: i,
              });
              const rawId = idResult?.result;
              const attrIdStr = typeof rawId === 'string' ? rawId : String(rawId ?? '');
              // Match by numeric ID or enum name (e.g. "A_VALUE" or "185")
              if (
                attrIdStr === String(attribute_id) ||
                (attribute_id === 185 && attrIdStr === 'A_VALUE')
              ) {
                const infoResult = await client.callMethod('ApiItem', 'attrInfoIx', {
                  objectPtr: { handle: String(connHandle), type: OBJ_API_ITEM },
                  index: i,
                });
                const info = infoResult?.result ?? infoResult;
                const typeStr = info?.type ?? '';
                // Map type string to numeric AttrType
                const typeMap: Record<string, number> = {
                  AT_BOOL: 1,
                  AT_INT: 3,
                  AT_INT2: 4,
                  AT_INT3: 5,
                  AT_INT4: 6,
                  AT_FLOAT: 9,
                  AT_FLOAT2: 90,
                  AT_FLOAT3: 11,
                  AT_FLOAT4: 12,
                  AT_STRING: 14,
                };
                resolvedType = typeMap[typeStr] ?? AT_FLOAT4; // default float4 if unknown
                break;
              }
            }
          }
          if (resolvedType === undefined || resolvedType === null) {
            resolvedType = AT_FLOAT4; // safest default — most value nodes are float4
          }
        }

        // Read attribute from connected node
        const result = await client.callMethod('ApiItem', getMethod, {
          objectPtr: { handle: String(connHandle), type: OBJ_API_ITEM },
          attribute_id,
          expected_type: resolvedType,
        });
        const value = extractAttributeValue(result, resolvedType);
        return jsonResult({
          handle,
          pin_index,
          connected_handle: connHandle,
          attribute_id,
          expected_type: resolvedType,
          value,
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
