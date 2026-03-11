/**
 * Attribute Tools — get_attribute, set_attribute
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient } from '../OctaneMcpClient';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { USE_ALPHA5_API } = require('../../../api-version.config.js');

function jsonResult(data: any) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(error: any) {
  return {
    content: [
      { type: 'text' as const, text: JSON.stringify({ error: String(error?.message || error) }) },
    ],
    isError: true as const,
  };
}

// AttrType enum values (from OctaneTypes.ts)
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
  if (result.float3_value) return result.float3_value;
  if (result.float2_value) return result.float2_value;
  if (result.int2_value) return result.int2_value;
  if (result.int3_value) return result.int3_value;

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

// Primitive type names for error messages
const PRIMITIVE_NAMES: Record<number, string> = {
  0: 'Box',
  1: 'Pill',
  2: 'Capsule',
  3: 'Cone',
  4: 'Cylinder',
  5: 'Dreidel',
  6: 'Disc',
  7: 'Dodecahedron',
  8: 'Hemisphere',
  9: 'Ellipsoid',
  10: 'Torus(fat)',
  11: 'Hourglass',
  12: 'Hyperboloid',
  13: 'Icosahedron',
  14: 'Octahedron',
  15: 'Plane',
  16: 'Pentagon',
  17: 'Prism',
  18: 'Quad',
  19: 'Saddle',
  20: 'Sphere',
  21: 'Tetrahedron',
  22: 'Torus',
  23: 'TruncatedCone',
};

export function registerAttributeTools(server: McpServer, client: OctaneMcpClient) {
  const getMethod = USE_ALPHA5_API ? 'getByAttrID' : 'getValueByAttrID';
  const setMethod = USE_ALPHA5_API ? 'setByAttrID' : 'setValueByAttrID';

  server.tool(
    'get_attribute',
    'Get a node attribute value by attribute ID. Use list_node_types to find attribute IDs and types. Common: A_VALUE=185, A_FILENAME=34. Types: AT_BOOL=1, AT_INT=3, AT_FLOAT=9, AT_FLOAT3=11, AT_STRING=14.',
    {
      handle: z.number().describe('Node handle'),
      attribute_id: z.number().describe('Attribute ID (e.g. 185 for A_VALUE, 34 for A_FILENAME)'),
      expected_type: z
        .number()
        .describe('AttrType enum value (e.g. 1=AT_BOOL, 3=AT_INT, 9=AT_FLOAT, 14=AT_STRING)'),
    },
    async ({ handle, attribute_id, expected_type }) => {
      try {
        const result = await client.callMethod('ApiItem', getMethod, {
          objectPtr: { handle: String(handle), type: 16 },
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
    'Set a node attribute value. Common: A_VALUE=185, A_FILENAME=34. Types: AT_BOOL=1, AT_INT=3, AT_FLOAT=9, AT_FLOAT3=11, AT_STRING=14.',
    {
      handle: z.number().describe('Node handle'),
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
      evaluate: z
        .boolean()
        .default(true)
        .describe(
          'Trigger scene evaluation after setting. Set false to batch multiple attribute changes, then call update_scene. WARNING: primitive type changes on NT_GEO_OBJECT are blocked — they crash Octane. Use NT_GEO_MESH + .obj files for non-box shapes.'
        ),
    },
    async ({ handle, attribute_id, expected_type, value, evaluate }) => {
      try {
        // SAFETY GUARD: Block primitive type changes on NT_GEO_OBJECT.
        // ALL non-default primitive changes crash Octane (Sphere=20, Torus=22, Cone=3,
        // Capsule=2 confirmed). Use NT_GEO_MESH + .obj files for non-box shapes.
        if (
          client.primitiveEnumHandles.has(handle) &&
          attribute_id === 185 &&
          expected_type === AT_INT
        ) {
          const primName = PRIMITIVE_NAMES[Number(value)] ?? `unknown(${value})`;
          return errorResult(
            `BLOCKED: Setting primitive type to ${primName} (${value}) would crash Octane. ` +
              `ALL NT_GEO_OBJECT primitive type changes cause ECONNRESET crashes. Box(0) works ` +
              `only because it is the default. For non-box shapes, use NT_GEO_MESH with .obj ` +
              `files instead (e.g., sphere_hd.obj, torus.obj). See OCTANE_MCP.md "Confirmed Crashes".`
          );
        }

        const valueParams = buildValueParams(value, expected_type);
        // Always send evaluate: false in gRPC params (matching octaneWebR pattern).
        // Then explicitly call ApiChangeManager.update() to trigger re-evaluation.
        // Without this, Octane may double-evaluate (once from the set call's default
        // evaluate=true, once from update()), which can cause render engine crashes.
        await client.callMethod('ApiItem', setMethod, {
          objectPtr: { handle: String(handle), type: 16 },
          attribute_id,
          expected_type,
          ...valueParams,
          evaluate: false,
        });

        if (evaluate) {
          await client.callMethod('ApiChangeManager', 'update', {});
        }

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
