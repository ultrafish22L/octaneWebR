/**
 * Node Tools — create_node, delete_node, connect_nodes, disconnect_pin
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient } from '../OctaneMcpClient';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NodeType } = require('../../../client/src/constants/OctaneTypes');

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

/** Extract handle from gRPC response — tries result.handle, list.handle, handle, value.handle */
function extractHandle(result: any): number | undefined {
  const h =
    result?.result?.handle ?? result?.list?.handle ?? result?.handle ?? result?.value?.handle;
  if (h === undefined || h === null || h === 0 || h === '0') return undefined;
  return Number(h);
}

/** Extract scalar value from gRPC response */
function extractValue(result: any): any {
  return result?.result ?? result?.value ?? result;
}

// --- Pin type validation ---

/** NodePinType enum (from octaneids.proto) → human-readable name */
export const PIN_TYPE_NAMES: Record<number, string> = {
  0: 'PT_UNKNOWN',
  1: 'PT_BOOL',
  2: 'PT_FLOAT',
  3: 'PT_INT',
  4: 'PT_TRANSFORM',
  5: 'PT_TEXTURE',
  6: 'PT_EMISSION',
  7: 'PT_MATERIAL',
  8: 'PT_CAMERA',
  9: 'PT_ENVIRONMENT',
  10: 'PT_IMAGER',
  11: 'PT_KERNEL',
  12: 'PT_GEOMETRY',
  13: 'PT_MEDIUM',
  14: 'PT_PHASEFUNCTION',
  15: 'PT_FILM_SETTINGS',
  16: 'PT_ENUM',
  17: 'PT_OBJECTLAYER',
  18: 'PT_POSTPROCESSING',
  19: 'PT_RENDERTARGET',
  20: 'PT_WORK_PANE',
  21: 'PT_PROJECTION',
  22: 'PT_DISPLACEMENT',
  23: 'PT_STRING',
  24: 'PT_RENDER_PASSES',
  25: 'PT_RENDER_LAYER',
  26: 'PT_VOLUME_RAMP',
  27: 'PT_ANIMATION_SETTINGS',
  28: 'PT_LUT',
  29: 'PT_RENDER_JOB',
  30: 'PT_TOON_RAMP',
  31: 'PT_BIT_MASK',
  32: 'PT_ROUND_EDGES',
  33: 'PT_MATERIAL_LAYER',
  34: 'PT_OCIO_VIEW',
  35: 'PT_OCIO_LOOK',
  36: 'PT_OCIO_COLOR_SPACE',
  37: 'PT_OUTPUT_AOV_GROUP',
  38: 'PT_OUTPUT_AOV',
  39: 'PT_TEX_COMPOSITE_LAYER',
  40: 'PT_OUTPUT_AOV_LAYER',
  44: 'PT_BLENDING_SETTINGS',
  45: 'PT_POST_VOLUME',
  46: 'PT_TRACE_SET_VISIBILITY_RULE_GROUP',
  47: 'PT_TRACE_SET_VISIBILITY_RULE',
};

/** Cache: node handle → output pin type name (e.g. "PT_GEOMETRY") */
const outTypeCache = new Map<number, string>();

/** Cache: node handle → array of pin info (index, type, name) */
const pinInfoCache = new Map<number, { index: number; type: string; name: string }[]>();

/** Get a node's output pin type, with caching */
async function getOutType(client: OctaneMcpClient, handle: number): Promise<string | undefined> {
  const cached = outTypeCache.get(handle);
  if (cached) return cached;
  try {
    const result = await client.callMethod('ApiItem', 'outType', {
      objectPtr: { handle: String(handle), type: 16 },
    });
    const typeNum = Number(extractValue(result) ?? 0);
    const typeName = PIN_TYPE_NAMES[typeNum] ?? `PT_${typeNum}`;
    outTypeCache.set(handle, typeName);
    return typeName;
  } catch {
    return undefined;
  }
}

/** Get all pin info for a node (type + name per pin), with caching */
async function getPinInfo(
  client: OctaneMcpClient,
  handle: number
): Promise<{ index: number; type: string; name: string }[]> {
  const cached = pinInfoCache.get(handle);
  if (cached) return cached;

  const pins: { index: number; type: string; name: string }[] = [];
  try {
    const countResult = await client.callMethod('ApiNode', 'pinCount', {
      objectPtr: { handle: String(handle), type: 17 },
    });
    const count = Number(extractValue(countResult) ?? 0);

    for (let i = 0; i < count; i++) {
      let typeName = 'PT_UNKNOWN';
      let pinName = '';
      try {
        const typeResult = await client.callMethod('ApiNode', 'pinTypeIx', {
          objectPtr: { handle: String(handle), type: 17 },
          index: i,
        });
        const typeNum = Number(extractValue(typeResult) ?? 0);
        typeName = PIN_TYPE_NAMES[typeNum] ?? `PT_${typeNum}`;
      } catch {
        // Pin may not report type
      }
      try {
        const nameResult = await client.callMethod('ApiNode', 'pinNameIx', {
          objectPtr: { handle: String(handle), type: 17 },
          index: i,
        });
        pinName = String(extractValue(nameResult) ?? '');
      } catch {
        // Pin may not have name
      }
      pins.push({ index: i, type: typeName, name: pinName });
    }
  } catch {
    // Node may not support pins
  }

  pinInfoCache.set(handle, pins);
  return pins;
}

export function registerNodeTools(server: McpServer, client: OctaneMcpClient) {
  server.tool(
    'create_node',
    'Create a new Octane node. Use list_node_types to find available types. Example: node_type="NT_MAT_UNIVERSAL" for universal material. For NT_GEO_OBJECT, set primitive type on pin 0 enum child (get_node_info first!) via set_attribute(handle, 185, AT_INT=3, value). Primitive types: 0=Box, 1=Pill, 2=Capsule, 3=Cone, 4=Cylinder, 5=Dreidel, 6=Disc, 7=Dodecahedron, 8=Hemisphere, 9=Ellipsoid, 10=Torus(fat), 11=Hourglass, 12=Hyperboloid, 13=Icosahedron, 14=Octahedron, 15=Plane, 16=Pentagon, 17=Prism, 18=Quad, 19=Saddle, 20=Sphere, 21=Tetrahedron, 22=Torus, 23=TruncatedCone.',
    {
      node_type: z
        .string()
        .describe(
          'Node type key from NodeType constants (e.g. "NT_MAT_UNIVERSAL", "NT_TEX_IMAGE")'
        ),
      node_type_id: z
        .number()
        .optional()
        .describe('Numeric type ID. If provided, overrides node_type lookup.'),
    },
    async ({ node_type, node_type_id }) => {
      try {
        const typeId = node_type_id ?? (NodeType as Record<string, number>)[node_type];
        if (typeId === undefined) {
          return errorResult(
            `Unknown node type: ${node_type}. Use list_node_types to see available types.`
          );
        }

        // Get root graph to create node in
        const rootResult = await client.callMethod('ApiProjectManager', 'rootNodeGraph', {});
        const rootHandle = extractHandle(rootResult);
        if (!rootHandle) return errorResult('No root node graph found');

        const result = await client.callMethod('ApiNode', 'create', {
          type: typeId,
          ownerGraph: { handle: String(rootHandle), type: 20 }, // ObjectType.ApiNodeGraph
          configurePins: true,
        });

        const newHandle = extractHandle(result);
        if (!newHandle) return errorResult('Node creation returned no handle');

        // Get the name Octane assigned
        const nameResult = await client.callMethod('ApiItem', 'name', {
          objectPtr: { handle: String(newHandle), type: 16 },
        });

        // Discover auto-created pin children (eliminates separate get_node_info round-trip)
        const pins: { index: number; handle: number }[] = [];
        try {
          const pinCountResult = await client.callMethod('ApiNode', 'pinCount', {
            objectPtr: { handle: String(newHandle), type: 17 },
          });
          const pinCount = extractValue(pinCountResult) ?? 0;

          for (let i = 0; i < pinCount; i++) {
            let childHandle = 0;
            try {
              const connResult = await client.callMethod('ApiNode', 'connectedNodeIx', {
                objectPtr: { handle: String(newHandle), type: 17 },
                pinIx: i,
                enterWrapperNode: true,
              });
              childHandle = extractHandle(connResult) ?? 0;
            } catch {
              // No child on this pin
            }
            pins.push({ index: i, handle: childHandle });
          }
        } catch {
          // Node may not support pins
        }

        return jsonResult({
          success: true,
          handle: newHandle,
          name: extractValue(nameResult) ?? '',
          type: node_type,
          type_id: typeId,
          pins,
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'delete_node',
    'Delete a node from the scene. WARNING: Deleting a recently-disconnected node can crash Octane. Disconnect pins first and wait briefly before deleting.',
    { handle: z.number().describe('Node handle to delete') },
    async ({ handle }) => {
      try {
        await client.callMethod('ApiItem', 'destroy', {
          objectPtr: { handle: String(handle), type: 16 },
        });
        return jsonResult({ success: true, deleted_handle: handle });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'connect_nodes',
    "Connect a source node to a target node's input pin. Use get_node_info to find pin indices. Provide exactly one of: pin_index (connectToIx), pin_name (connectTo1), or pin_id (connectTo). If connectToIx silently fails (e.g. emission pins), try pin_name or pin_id.",
    {
      target_handle: z.number().describe('Target node handle (the node receiving the connection)'),
      pin_index: z.number().optional().describe('Pin index on the target node (uses connectToIx)'),
      pin_name: z
        .string()
        .optional()
        .describe('Pin name string (uses connectTo1). E.g. "emission", "diffuse"'),
      pin_id: z
        .number()
        .optional()
        .describe('PinId enum value (uses connectTo). E.g. P_EMISSION=41'),
      source_handle: z.number().describe('Source node handle (the node being connected)'),
      evaluate: z.boolean().default(true).describe('Trigger scene evaluation after connecting'),
    },
    async ({ target_handle, pin_index, pin_name, pin_id, source_handle, evaluate }) => {
      try {
        // --- Pin type validation ---
        // Query source node's output type and target pin's expected type.
        // If they mismatch, reject the connection before sending to Octane.
        const sourceType = await getOutType(client, source_handle);
        let targetPinType: string | undefined;
        let resolvedPinName: string | undefined;
        let resolvedPinIndex: number | undefined;

        if (pin_index !== undefined) {
          // Direct index — get pin type for this index
          const pins = await getPinInfo(client, target_handle);
          const pin = pins.find(p => p.index === pin_index);
          targetPinType = pin?.type;
          resolvedPinName = pin?.name;
          resolvedPinIndex = pin_index;
        } else if (pin_name !== undefined) {
          // Name-based — find pin by name
          const pins = await getPinInfo(client, target_handle);
          const pin = pins.find(p => p.name === pin_name);
          targetPinType = pin?.type;
          resolvedPinName = pin_name;
          resolvedPinIndex = pin?.index;
        }
        // pin_id route: skip validation (rare, hard to resolve without full iteration)

        if (
          sourceType &&
          targetPinType &&
          sourceType !== 'PT_UNKNOWN' &&
          targetPinType !== 'PT_UNKNOWN' &&
          sourceType !== targetPinType
        ) {
          const pinDesc = resolvedPinName
            ? `'${resolvedPinName}' (index ${resolvedPinIndex})`
            : `index ${resolvedPinIndex}`;
          return errorResult(
            `Pin type mismatch: target pin ${pinDesc} expects ${targetPinType} ` +
              `but source node (handle ${source_handle}) outputs ${sourceType}. ` +
              `Use get_node_info to check pin types before connecting.`
          );
        }

        // --- Perform the connection ---
        if (pin_id !== undefined) {
          // Connect by PinId enum using connectTo
          await client.callMethod('ApiNode', 'connectTo', {
            objectPtr: { handle: String(target_handle), type: 17 },
            pinId: pin_id,
            sourceNode: { handle: String(source_handle), type: 17 },
            evaluate,
            doCycleCheck: true,
          });
          return jsonResult({
            success: true,
            target: target_handle,
            pin_id,
            source: source_handle,
            source_type: sourceType,
            target_pin_type: targetPinType,
          });
        }
        if (pin_name !== undefined) {
          // Connect by pin name using connectTo1
          await client.callMethod('ApiNode', 'connectTo1', {
            objectPtr: { handle: String(target_handle), type: 17 },
            pinName: pin_name,
            sourceNode: { handle: String(source_handle), type: 17 },
            evaluate,
            doCycleCheck: true,
          });
          return jsonResult({
            success: true,
            target: target_handle,
            pin_name,
            source: source_handle,
            source_type: sourceType,
            target_pin_type: targetPinType,
          });
        }
        if (pin_index === undefined) {
          return errorResult('Provide one of: pin_index, pin_name, or pin_id');
        }
        await client.callMethod('ApiNode', 'connectToIx', {
          objectPtr: { handle: String(target_handle), type: 17 }, // ObjectType.ApiNode
          pinIdx: pin_index,
          sourceNode: { handle: String(source_handle), type: 17 },
          evaluate,
          doCycleCheck: true,
        });
        return jsonResult({
          success: true,
          target: target_handle,
          pin: pin_index,
          source: source_handle,
          source_type: sourceType,
          target_pin_type: targetPinType,
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'disconnect_pin',
    'Disconnect a pin on a node (sets it to null/handle 0)',
    {
      handle: z.number().describe('Node handle'),
      pin_index: z.number().describe('Pin index to disconnect'),
      evaluate: z.boolean().default(true).describe('Trigger scene evaluation after disconnecting'),
    },
    async ({ handle, pin_index, evaluate }) => {
      try {
        await client.callMethod('ApiNode', 'connectToIx', {
          objectPtr: { handle: String(handle), type: 17 },
          pinIdx: pin_index,
          sourceNode: { handle: '0', type: 17 }, // Handle 0 = disconnect
          evaluate,
          doCycleCheck: true,
        });
        return jsonResult({ success: true, handle, pin: pin_index });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
