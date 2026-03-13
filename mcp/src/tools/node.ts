/**
 * Node Tools — create_node, delete_node, connect_nodes, disconnect_pin
 *
 * Uses ApiCache for instant pin layout / type lookups when available.
 * Falls back to gRPC queries when cache is missing or handle is unknown.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient } from '../OctaneMcpClient';
import { ApiCache } from '../ApiCache';
import { notifyWebapp } from './webapp';
import {
  jsonResult,
  errorResult,
  extractHandle,
  extractValue,
  OBJ_API_ITEM,
  OBJ_API_NODE,
  OBJ_API_NODE_GRAPH,
} from './utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NodeType } = require('../../../client/src/constants/OctaneTypes');

// --- Legacy pin type validation (fallback when cache unavailable) ---

/** NodePinType enum → human-readable name */
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

/** Fallback: get output type via gRPC */
async function getOutTypeFallback(
  client: OctaneMcpClient,
  handle: number
): Promise<string | undefined> {
  try {
    const result = await client.callMethod('ApiItem', 'outType', {
      objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
    });
    const typeRaw = extractValue(result);
    // enums: String → returns "PT_TEXTURE" (string), not 5 (number)
    if (typeof typeRaw === 'string' && typeRaw.startsWith('PT_')) return typeRaw;
    const typeNum = Number(typeRaw ?? 0);
    return PIN_TYPE_NAMES[typeNum] ?? `PT_${typeNum}`;
  } catch {
    return undefined;
  }
}

/** Fallback: get pin info via gRPC */
async function getPinInfoFallback(
  client: OctaneMcpClient,
  handle: number
): Promise<{ index: number; type: string; name: string }[]> {
  const pins: { index: number; type: string; name: string }[] = [];
  try {
    const countResult = await client.callMethod('ApiNode', 'pinCount', {
      objectPtr: { handle: String(handle), type: OBJ_API_NODE },
    });
    const count = Number(extractValue(countResult) ?? 0);
    for (let i = 0; i < count; i++) {
      let typeName = 'PT_UNKNOWN';
      let pinName = '';
      try {
        const typeResult = await client.callMethod('ApiNode', 'pinTypeIx', {
          objectPtr: { handle: String(handle), type: OBJ_API_NODE },
          index: i,
        });
        const typeRaw = extractValue(typeResult);
        if (typeof typeRaw === 'string' && typeRaw.startsWith('PT_')) {
          typeName = typeRaw;
        } else {
          const typeNum = Number(typeRaw ?? 0);
          typeName = PIN_TYPE_NAMES[typeNum] ?? `PT_${typeNum}`;
        }
      } catch {
        /* */
      }
      try {
        const nameResult = await client.callMethod('ApiNode', 'pinNameIx', {
          objectPtr: { handle: String(handle), type: OBJ_API_NODE },
          index: i,
        });
        pinName = String(extractValue(nameResult) ?? '');
      } catch {
        /* */
      }
      pins.push({ index: i, type: typeName, name: pinName });
    }
  } catch {
    /* */
  }
  return pins;
}

export function registerNodeTools(
  server: McpServer,
  client: OctaneMcpClient,
  cache: ApiCache | null
) {
  server.tool(
    'create_node',
    'Create a new Octane node. Use list_node_types to find available types. Example: node_type="NT_MAT_UNIVERSAL" for universal material. NT_GEO_OBJECT defaults to Box primitive. Change primitive type via pin 0 enum child: set_attribute(enum_handle, 185, AT_INT=3, N). See OCTANE_MCP.md for primitive type values.',
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

        // Get root graph — cached after first call
        const rootHandle = await client.getRootNodeGraph();

        const result = await client.callMethod('ApiNode', 'create', {
          type: typeId,
          ownerGraph: { handle: String(rootHandle), type: OBJ_API_NODE_GRAPH },
          configurePins: true,
        });

        const newHandle = extractHandle(result);
        if (!newHandle) return errorResult('Node creation returned no handle');

        // Track handle → type for connect_nodes cache lookups
        client.handleToTypeName.set(newHandle, node_type);

        // Get the name Octane assigned
        const nameResult = await client.callMethod('ApiItem', 'name', {
          objectPtr: { handle: String(newHandle), type: OBJ_API_ITEM },
        });

        // Discover auto-created pin children
        const cachedInfo = cache?.getNodeType(node_type);
        const pins: { index: number; handle: number; name?: string; type?: string }[] = [];

        if (cachedInfo) {
          // FAST PATH: use cache for pin layout, only query pins with defaultNodeType
          for (const cp of cachedInfo.pins) {
            let childHandle = 0;
            if (cp.defaultNodeType) {
              try {
                const connResult = await client.callMethod('ApiNode', 'connectedNodeIx', {
                  objectPtr: { handle: String(newHandle), type: OBJ_API_NODE },
                  pinIx: cp.index,
                  enterWrapperNode: true,
                });
                childHandle = extractHandle(connResult) ?? 0;
              } catch {
                /* no child */
              }
            }
            pins.push({
              index: cp.index,
              handle: childHandle,
              name: cp.staticName,
              type: cp.type,
            });
          }
        } else {
          // FALLBACK: enumerate all pins via gRPC
          try {
            const pinCountResult = await client.callMethod('ApiNode', 'pinCount', {
              objectPtr: { handle: String(newHandle), type: OBJ_API_NODE },
            });
            const pinCount = extractValue(pinCountResult) ?? 0;
            for (let i = 0; i < pinCount; i++) {
              let childHandle = 0;
              try {
                const connResult = await client.callMethod('ApiNode', 'connectedNodeIx', {
                  objectPtr: { handle: String(newHandle), type: OBJ_API_NODE },
                  pinIx: i,
                  enterWrapperNode: true,
                });
                childHandle = extractHandle(connResult) ?? 0;
              } catch {
                /* */
              }
              pins.push({ index: i, handle: childHandle });
            }
          } catch {
            /* */
          }
        }

        // Track primitive enum handles for crash prevention.
        // ALL NT_GEO_OBJECT primitive type changes crash Octane (Sphere=20, Torus=22,
        // Cone=3, Capsule=2 confirmed). Pin 0 child is the primitive enum.
        if (node_type === 'NT_GEO_OBJECT') {
          const pin0 = pins.find(p => p.index === 0);
          if (pin0 && pin0.handle) {
            client.primitiveEnumHandles.add(pin0.handle);
          }
        }

        await notifyWebapp({ type: 'nodeAdded', handle: newHandle });

        // Only return pins with auto-created children (handle != 0).
        // Reduces response size dramatically (e.g. PT kernel: 49 pins → ~15 with children).
        // Claude can use get_node_info if it needs the full pin layout later.
        const activePins = pins.filter(p => p.handle !== 0);

        return jsonResult({
          success: true,
          handle: newHandle,
          name: extractValue(nameResult) ?? '',
          type: node_type,
          type_id: typeId,
          pins: activePins,
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
          objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
        });
        client.handleToTypeName.delete(handle);
        await notifyWebapp({ type: 'nodeDeleted', handle });
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
        // --- Pin type validation (cache-first, gRPC fallback) ---
        const sourceTypeName = client.handleToTypeName.get(source_handle);
        const targetTypeName = client.handleToTypeName.get(target_handle);

        let sourceType: string | undefined;
        let targetPinType: string | undefined;
        let resolvedPinName: string | undefined;
        let resolvedPinIndex: number | undefined;

        // Get source output type
        if (sourceTypeName && cache) {
          sourceType = cache.getOutType(sourceTypeName);
        } else {
          sourceType = await getOutTypeFallback(client, source_handle);
        }

        // Get target pin type
        if (pin_index !== undefined) {
          if (targetTypeName && cache) {
            const pin = cache.getPinByIndex(targetTypeName, pin_index);
            targetPinType = pin?.type;
            resolvedPinName = pin?.staticName;
          } else {
            const pins = await getPinInfoFallback(client, target_handle);
            const pin = pins.find(p => p.index === pin_index);
            targetPinType = pin?.type;
            resolvedPinName = pin?.name;
          }
          resolvedPinIndex = pin_index;
        } else if (pin_name !== undefined) {
          if (targetTypeName && cache) {
            const pin = cache.getPinByName(targetTypeName, pin_name);
            targetPinType = pin?.type;
            resolvedPinIndex = pin?.index;
          } else {
            const pins = await getPinInfoFallback(client, target_handle);
            const pin = pins.find(p => p.name === pin_name);
            targetPinType = pin?.type;
            resolvedPinIndex = pin?.index;
          }
          resolvedPinName = pin_name;
        }

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

        // Track deferred evaluations
        let evalWarning: string | undefined;
        if (evaluate) {
          client.resetDeferredEvalCount();
        } else {
          const warning = client.trackDeferredEval();
          if (warning) evalWarning = warning;
        }

        // --- Perform the connection ---
        if (pin_id !== undefined) {
          await client.callMethod('ApiNode', 'connectTo', {
            objectPtr: { handle: String(target_handle), type: OBJ_API_NODE },
            pinId: pin_id,
            sourceNode: { handle: String(source_handle), type: OBJ_API_NODE },
            evaluate,
            doCycleCheck: true,
          });
          await notifyWebapp({ type: 'nodeChanged', handle: target_handle });
          return jsonResult({
            success: true,
            target: target_handle,
            pin_id,
            source: source_handle,
            source_type: sourceType,
            target_pin_type: targetPinType,
            ...(evalWarning && { warning: evalWarning }),
          });
        }
        if (pin_name !== undefined) {
          await client.callMethod('ApiNode', 'connectTo1', {
            objectPtr: { handle: String(target_handle), type: OBJ_API_NODE },
            pinName: pin_name,
            sourceNode: { handle: String(source_handle), type: OBJ_API_NODE },
            evaluate,
            doCycleCheck: true,
          });
          await notifyWebapp({ type: 'nodeChanged', handle: target_handle });
          return jsonResult({
            success: true,
            target: target_handle,
            pin_name,
            source: source_handle,
            source_type: sourceType,
            target_pin_type: targetPinType,
            ...(evalWarning && { warning: evalWarning }),
          });
        }
        if (pin_index === undefined) {
          return errorResult('Provide one of: pin_index, pin_name, or pin_id');
        }
        await client.callMethod('ApiNode', 'connectToIx', {
          objectPtr: { handle: String(target_handle), type: OBJ_API_NODE },
          pinIdx: pin_index,
          sourceNode: { handle: String(source_handle), type: OBJ_API_NODE },
          evaluate,
          doCycleCheck: true,
        });
        await notifyWebapp({ type: 'nodeChanged', handle: target_handle });
        return jsonResult({
          success: true,
          target: target_handle,
          pin: pin_index,
          source: source_handle,
          source_type: sourceType,
          target_pin_type: targetPinType,
          ...(evalWarning && { warning: evalWarning }),
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
          objectPtr: { handle: String(handle), type: OBJ_API_NODE },
          pinIdx: pin_index,
          sourceNode: { handle: '0', type: OBJ_API_NODE },
          evaluate,
          doCycleCheck: true,
        });
        await notifyWebapp({ type: 'nodeChanged', handle });
        return jsonResult({ success: true, handle, pin: pin_index });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
