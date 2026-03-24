/**
 * Node Tools — create_node, delete_node, connect_nodes, disconnect_pin
 *
 * Uses ApiCache for instant pin layout / type lookups when available.
 * Falls back to gRPC queries when cache is missing or handle is unknown.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient, mcpLog, mcpLogLazy } from '../OctaneMcpClient';
import { ApiCache } from '../ApiCache';
import { notifyWebapp } from './webapp';
import {
  jsonResult,
  errorResult,
  extractHandle,
  extractValue,
  gateHandle,
  OBJ_API_ITEM,
  OBJ_API_NODE,
  OBJ_API_NODE_GRAPH,
  OBJ_API_ITEM_ARRAY,
} from './utils';
import { CRASH_TYPE_IDS, PIN_TYPE_NAMES, AttributeId } from '../shared/OctaneConstants';
import { enumeratePins } from './pin-utils';
// Re-export for scene.ts which imports PIN_TYPE_NAMES from './node'
export { PIN_TYPE_NAMES };

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
  } catch (e: any) {
    mcpLogLazy('verbose', () => `[node:getOutTypeFallback] ${e?.message ?? e}`);
    return undefined;
  }
}

// getPinInfoFallback replaced by shared enumeratePins from pin-utils.ts

export function registerNodeTools(
  server: McpServer,
  client: OctaneMcpClient,
  cache: ApiCache | null
) {
  server.tool(
    'create_node',
    'Create an Octane node. Rejects known crash-causing type IDs. Common types: NT_MAT_UNIVERSAL (PBR material), NT_GEO_MESH (mesh from .obj file), NT_GEO_OBJECT (box primitive only), NT_TEX_IMAGE (image texture), NT_RENDER_TARGET (RT). For non-box geometry (spheres, etc.), prefer NT_GEO_MESH + set_attribute(A_FILENAME=34) with sphere_hd.obj or floor.obj — NT_GEO_OBJECT primitive type changes are unstable and can crash Octane. NT_GEO_OBJECT is safe as default Box only. Use list_node_types for full catalog.',
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
        const typeId = node_type_id ?? cache?.getNodeTypeId(node_type);
        if (typeId === undefined) {
          return errorResult(
            `Unknown node type: ${node_type}. Use list_node_types to see available types.`
          );
        }

        // Block crash-causing type IDs
        if (CRASH_TYPE_IDS.has(typeId)) {
          return errorResult(
            `Type ID ${typeId} (${node_type}) crashes Octane — these are internal/system types that cannot be created via API.`
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

        // Get the name Octane assigned
        const nameResult = await client.callMethod('ApiItem', 'name', {
          objectPtr: { handle: String(newHandle), type: OBJ_API_ITEM },
        });

        // Track in scene cache for connect_nodes type lookups and scene awareness
        client.sceneCache.addNode(
          newHandle,
          String(extractValue(nameResult) ?? ''),
          node_type,
          typeId
        );

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
              } catch (e: any) {
                mcpLogLazy('verbose', () => `[node:create_node:pin_child] ${e?.message ?? e}`);
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
              } catch (e: any) {
                mcpLogLazy('verbose', () => `[node:create_node:pin_query:${i}] ${e?.message ?? e}`);
              }
              pins.push({ index: i, handle: childHandle });
            }
          } catch (e: any) {
            mcpLogLazy('verbose', () => `[node:create_node:pinCount_fallback] ${e?.message ?? e}`);
          }
        }

        await notifyWebapp({ type: 'nodeAdded', handle: newHandle });

        // Track all handles returned to the AI for crash prevention,
        // and add auto-created children to the nodes Map so getTypeName() works
        // for subsequent connect_nodes type validation.
        client.sceneCache.trackHandle(newHandle);
        for (const p of pins) {
          if (p.handle !== 0) {
            client.sceneCache.trackHandle(p.handle);
            // Cache child with its defaultNodeType from ApiCache if known
            const childTypeName = cachedInfo?.pins.find(
              cp => cp.index === p.index
            )?.defaultNodeType;
            if (childTypeName) {
              const childTypeId = cache?.getNodeTypeId(childTypeName) ?? 0;
              client.sceneCache.addNode(p.handle, p.name ?? '', childTypeName, childTypeId);
            }
          }
        }

        // Only return pins with auto-created children (handle != 0).
        // Reduces response size dramatically (e.g. PT kernel: 49 pins → ~15 with children).
        // Claude can use get_node_info if it needs the full pin layout later.
        const activePins = pins.filter(p => p.handle !== 0);

        // ── Auto-fix defaults that cause silent gotchas ──────────────
        const warnings: string[] = [];

        // RT: disable DOF by default (aperture 0.893 → 0)
        // DOF makes every render blurry unless manually disabled.
        if (node_type === 'NT_RENDERTARGET') {
          const cameraPin = activePins.find(p => p.name === 'camera');
          if (cameraPin?.handle) {
            try {
              // Camera → pin 14 (aperture) → child handle → set A_VALUE to 0
              const apertureConn = await client.callMethod('ApiNode', 'connectedNodeIx', {
                objectPtr: { handle: String(cameraPin.handle), type: OBJ_API_NODE },
                pinIx: 14,
                enterWrapperNode: true,
              });
              const apertureHandle = extractHandle(apertureConn);
              if (apertureHandle) {
                await client.callMethod('ApiItem', 'setValueByAttrID', {
                  objectPtr: { handle: String(apertureHandle), type: OBJ_API_ITEM },
                  attribute_id: AttributeId.A_VALUE,
                  float_value: 0,
                  evaluate: false,
                });
                client.sceneCache.trackHandle(apertureHandle);
                warnings.push(
                  'DOF disabled (aperture set to 0). Set aperture > 0 on camera pin 14 to re-enable.'
                );
              }
            } catch (e: any) {
              mcpLogLazy('verbose', () => `[node:create_node:dof_fix] ${e?.message ?? e}`);
            }
          }
        }

        // Emission: set efficiency to 1.0 (default 0.025 = 40x dim)
        if (node_type === 'NT_EMIS_BLACKBODY' || node_type === 'NT_EMIS_TEXTURE') {
          const effPin = activePins.find(p => p.name === 'efficiency or texture');
          if (effPin?.handle) {
            try {
              await client.callMethod('ApiItem', 'setValueByAttrID', {
                objectPtr: { handle: String(effPin.handle), type: OBJ_API_ITEM },
                attribute_id: AttributeId.A_VALUE,
                float_value: 1.0,
                evaluate: false,
              });
              warnings.push(
                'Emission efficiency set to 1.0 (default was 0.025). Adjust if too bright.'
              );
            } catch (e: any) {
              mcpLogLazy('verbose', () => `[node:create_node:emission_fix] ${e?.message ?? e}`);
            }
          }
        }

        const response: Record<string, any> = {
          success: true,
          handle: newHandle,
          name: extractValue(nameResult) ?? '',
          type: node_type,
          type_id: typeId,
          pins: activePins,
        };
        if (warnings.length > 0) response.warnings = warnings;
        return jsonResult(response);
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'delete_node',
    'Delete a node from the scene. Disconnect pins first — deleting a recently-disconnected node can crash Octane. Clears node from scene cache.',
    { handle: z.number().int().nonnegative().describe('Node handle to delete') },
    async ({ handle }) => {
      try {
        const gated = gateHandle('delete_node', handle, client.sceneCache);
        if (gated) return gated;

        // Guard: reject deletion of nodes with active connections (crashes Octane)
        const activeConns = client.sceneCache.getConnectionsInvolving(handle);
        if (activeConns.length > 0) {
          const pinList = activeConns
            .map(c =>
              c.source === handle
                ? `source for ${c.target}:pin${c.pinIndex}`
                : `target pin ${c.pinIndex} ← ${c.source}`
            )
            .join(', ');
          return errorResult(
            `Cannot delete handle ${handle} — ${activeConns.length} active connection(s): ${pinList}. ` +
              `Disconnect pins first. Deleting connected nodes crashes Octane.`
          );
        }

        await client.callMethod('ApiItem', 'destroy', {
          objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
        });
        client.sceneCache.removeNode(handle);
        await notifyWebapp({ type: 'nodeDeleted', handle });
        return jsonResult({ success: true, deleted_handle: handle });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'connect_nodes',
    'Connect source node to target node input pin. Connection is auto-verified. Use pin_name (most readable) — e.g. "camera", "geometry", "diffuse". Use pin_index as fallback for dynamic/movable pins. Query octane://pin-layout/{typeName} to discover pin names. RT pins: camera(0), environment(1), geometry(3), film(4), kernel(6). Cannot connect to auto-created internal children — create standalone node + connect to parent pin.',
    {
      target_handle: z
        .number()
        .int()
        .nonnegative()
        .describe('Target node handle (the node receiving the connection)'),
      pin_name: z
        .string()
        .optional()
        .describe('Pin name (preferred). E.g. "camera", "geometry", "diffuse", "emission"'),
      pin_index: z
        .number()
        .optional()
        .describe('Pin index (fallback for dynamic/movable pins). E.g. 0, 1, 3'),
      source_handle: z
        .number()
        .int()
        .nonnegative()
        .describe('Source node handle (the node being connected)'),
    },
    async ({ target_handle, pin_index: pin_index_in, pin_name, source_handle }) => {
      let pin_index = pin_index_in; // mutable — auto-slot may override
      try {
        // Gate: reject handles never seen by any MCP tool
        const gatedTarget = gateHandle('connect_nodes(target)', target_handle, client.sceneCache);
        if (gatedTarget) return gatedTarget;
        const gatedSource = gateHandle('connect_nodes(source)', source_handle, client.sceneCache);
        if (gatedSource) return gatedSource;

        // --- Pin type validation (cache-first, gRPC fallback) ---
        const sourceTypeName = client.sceneCache.getTypeName(source_handle);
        const targetTypeName = client.sceneCache.getTypeName(target_handle);

        // --- Auto-slot for movable-input nodes (e.g. NT_GEO_GROUP) ---
        // These nodes have dynamic pins. If caller didn't specify a pin,
        // find the first empty slot. If all full, expand by 1.
        // Caller should never need to think about A_PIN_COUNT.
        const MAX_DYNAMIC_PINS = 32;
        if (targetTypeName && cache && pin_index === undefined && pin_name === undefined) {
          const targetInfo = cache.getNodeType(targetTypeName);
          if (targetInfo && targetInfo.movableInputPinCount > 0 && targetInfo.pins.length === 0) {
            try {
              const curResult = await client.callMethod('ApiNode', 'pinCount', {
                objectPtr: { handle: String(target_handle), type: OBJ_API_NODE },
              });
              const curCount = Number(extractValue(curResult) ?? 0);

              // Find first empty pin
              let freePin = -1;
              for (let i = 0; i < curCount; i++) {
                const conn = await client.callMethod('ApiNode', 'connectedNodeIx', {
                  objectPtr: { handle: String(target_handle), type: OBJ_API_NODE },
                  pinIx: i,
                  enterWrapperNode: false,
                });
                const connHandle = extractHandle(conn) ?? 0;
                if (connHandle === 0) {
                  freePin = i;
                  break;
                }
              }

              if (freePin >= 0) {
                // Use the free slot
                pin_index = freePin;
              } else if (curCount < MAX_DYNAMIC_PINS) {
                // All full — expand by 1
                const newCount = curCount + 1;
                await client.callMethod('ApiItem', 'setValueByAttrID', {
                  objectPtr: { handle: String(target_handle), type: OBJ_API_ITEM },
                  attribute_id: AttributeId.A_PIN_COUNT,
                  int_value: newCount,
                  evaluate: false,
                });
                await client.callMethod('ApiChangeManager', 'update', {});
                pin_index = curCount; // new slot is at the end
              } else {
                return errorResult(
                  `Geo group ${target_handle} already has ${curCount} children (max ${MAX_DYNAMIC_PINS}).`
                );
              }
            } catch (e: any) {
              mcpLogLazy('verbose', () => `[node:connect_nodes:auto_slot] ${e?.message ?? e}`);
            }
          }
        }
        // If caller specified pin_index on a dynamic node, ensure enough pins exist (capped)
        if (targetTypeName && cache && pin_index !== undefined) {
          const targetInfo = cache.getNodeType(targetTypeName);
          if (targetInfo && targetInfo.movableInputPinCount > 0 && targetInfo.pins.length === 0) {
            if (pin_index >= MAX_DYNAMIC_PINS) {
              return errorResult(
                `pin_index ${pin_index} exceeds max dynamic pins (${MAX_DYNAMIC_PINS}).`
              );
            }
            try {
              const curResult = await client.callMethod('ApiNode', 'pinCount', {
                objectPtr: { handle: String(target_handle), type: OBJ_API_NODE },
              });
              const curCount = Number(extractValue(curResult) ?? 0);
              if (curCount <= pin_index) {
                await client.callMethod('ApiItem', 'setValueByAttrID', {
                  objectPtr: { handle: String(target_handle), type: OBJ_API_ITEM },
                  attribute_id: AttributeId.A_PIN_COUNT,
                  int_value: pin_index + 1,
                  evaluate: false,
                });
                await client.callMethod('ApiChangeManager', 'update', {});
              }
            } catch (e: any) {
              mcpLogLazy('verbose', () => `[node:connect_nodes:expand_pins] ${e?.message ?? e}`);
            }
          }
        }

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
            const pins = await enumeratePins(client, target_handle);
            const pin = pins.find(p => p.index === pin_index);
            targetPinType = pin?.typeName;
            resolvedPinName = pin?.name;
          }
          resolvedPinIndex = pin_index;
        } else if (pin_name !== undefined) {
          if (targetTypeName && cache) {
            const pin = cache.getPinByName(targetTypeName, pin_name);
            targetPinType = pin?.type;
            resolvedPinIndex = pin?.index;
          } else {
            const pins = await enumeratePins(client, target_handle);
            const pin = pins.find(p => p.name === pin_name);
            targetPinType = pin?.typeName;
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
            ? `'${resolvedPinName}'${resolvedPinIndex !== undefined ? ` (index ${resolvedPinIndex})` : ' (not found)'}`
            : resolvedPinIndex !== undefined
              ? `index ${resolvedPinIndex}`
              : 'unknown pin';
          return errorResult(
            `Pin type mismatch: target pin ${pinDesc} expects ${targetPinType} ` +
              `but source node (handle ${source_handle}) outputs ${sourceType}. ` +
              `Use get_node_info to check pin types before connecting.`
          );
        }

        // --- Perform the connection (always evaluate) ---
        if (pin_name !== undefined) {
          await client.callMethod('ApiNode', 'connectTo1', {
            objectPtr: { handle: String(target_handle), type: OBJ_API_NODE },
            pinName: pin_name,
            sourceNode: { handle: String(source_handle), type: OBJ_API_NODE },
            evaluate: true,
            doCycleCheck: true,
          });
        } else if (pin_index !== undefined) {
          await client.callMethod('ApiNode', 'connectToIx', {
            objectPtr: { handle: String(target_handle), type: OBJ_API_NODE },
            pinIdx: pin_index,
            sourceNode: { handle: String(source_handle), type: OBJ_API_NODE },
            evaluate: true,
            doCycleCheck: true,
          });
        } else {
          return errorResult('Provide pin_name (preferred) or pin_index');
        }

        // Flush scene changes so the connection takes effect immediately
        await client.callMethod('ApiChangeManager', 'update', {});

        // Auto-verify: check the pin actually got connected (silent failures are common)
        const verifyPinIdx = resolvedPinIndex ?? pin_index ?? 0;
        let verified = true;
        let verifyWarning: string | undefined;
        try {
          // enterWrapperNode: false — we want the actual source handle, not the wrapper.
          // With true, geo→placement returns a wrapper handle that != source_handle,
          // causing false negatives on valid connections.
          const verifyResult = await client.callMethod('ApiNode', 'connectedNodeIx', {
            objectPtr: { handle: String(target_handle), type: OBJ_API_NODE },
            pinIx: verifyPinIdx,
            enterWrapperNode: false,
          });
          const connectedHandle = extractHandle(verifyResult) ?? 0;
          if (connectedHandle !== source_handle) {
            verified = false;
            verifyWarning =
              `Connection verification FAILED: pin ${verifyPinIdx} shows connected_handle=${connectedHandle} ` +
              `(expected ${source_handle}). Check pin type compatibility with get_node_info.`;
          }
        } catch (e: any) {
          mcpLogLazy('verbose', () => `[node:connect_nodes:verify] ${e?.message ?? e}`);
          // If verify call itself fails, don't block — just warn
          verifyWarning =
            'Connection verification skipped (verify call failed). Check with get_node_info.';
        }

        // Update scene cache on verified connection
        if (verified) {
          client.sceneCache.setConnection(target_handle, verifyPinIdx, source_handle);
        }

        await notifyWebapp({ type: 'nodeChanged', handle: target_handle });

        const result: Record<string, any> = {
          success: verified,
          target: target_handle,
          source: source_handle,
          pin: verifyPinIdx,
          verified,
          source_type: sourceType,
          target_pin_type: targetPinType,
        };
        if (pin_name !== undefined) result.pin_name = pin_name;
        if (verifyWarning) result.verify_warning = verifyWarning;

        if (!verified) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            isError: true as const,
          };
        }
        return jsonResult(result);
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'disconnect_pin',
    'Disconnect a pin on a node (sets connection to null). Updates scene cache.',
    {
      handle: z.number().int().nonnegative().describe('Node handle'),
      pin_index: z.number().describe('Pin index to disconnect'),
    },
    async ({ handle, pin_index }) => {
      try {
        const gated = gateHandle('disconnect_pin', handle, client.sceneCache);
        if (gated) return gated;

        await client.callMethod('ApiNode', 'connectToIx', {
          objectPtr: { handle: String(handle), type: OBJ_API_NODE },
          pinIdx: pin_index,
          sourceNode: { handle: 0, type: OBJ_API_NODE },
          evaluate: true,
          doCycleCheck: true,
        });
        // Flush scene changes so the disconnect takes effect immediately
        await client.callMethod('ApiChangeManager', 'update', {});
        client.sceneCache.removeConnection(handle, pin_index);
        await notifyWebapp({ type: 'nodeChanged', handle });
        return jsonResult({ success: true, handle, pin: pin_index });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'create_and_connect',
    'Create a node and connect it to a target pin in one call. Saves round-trips for the most common pattern (e.g. create material + connect to mesh pin 0). Auto-verifies the connection. If connect fails, returns the created handle so you can retry or clean up.',
    {
      node_type: z.string().describe('Node type (e.g. "NT_MAT_UNIVERSAL", "NT_GEO_OBJECT")'),
      target_handle: z.number().int().nonnegative().describe('Target node to connect to'),
      pin_index: z.number().int().nonnegative().describe('Pin index on target node'),
    },
    async ({ node_type, target_handle, pin_index }) => {
      try {
        const gated = gateHandle('create_and_connect(target)', target_handle, client.sceneCache);
        if (gated) return gated;

        // --- Create ---
        const typeId = cache?.getNodeTypeId(node_type);
        if (typeId === undefined) {
          return errorResult(
            `Unknown node type: ${node_type}. Use list_node_types to see available types.`
          );
        }
        if (CRASH_TYPE_IDS.has(typeId)) {
          return errorResult(
            `Type ID ${typeId} (${node_type}) crashes Octane — internal/system type.`
          );
        }

        const rootHandle = await client.getRootNodeGraph();
        const createResult = await client.callMethod('ApiNode', 'create', {
          type: typeId,
          ownerGraph: { handle: String(rootHandle), type: OBJ_API_NODE_GRAPH },
          configurePins: true,
        });
        const newHandle = extractHandle(createResult);
        if (!newHandle) return errorResult('Node creation returned no handle');

        const nameResult = await client.callMethod('ApiItem', 'name', {
          objectPtr: { handle: String(newHandle), type: OBJ_API_ITEM },
        });
        const nodeName = String(extractValue(nameResult) ?? '');
        client.sceneCache.addNode(newHandle, nodeName, node_type, typeId);
        await notifyWebapp({ type: 'nodeAdded', handle: newHandle });

        // --- Connect ---
        await client.callMethod('ApiNode', 'connectToIx', {
          objectPtr: { handle: String(target_handle), type: OBJ_API_NODE },
          pinIdx: pin_index,
          sourceNode: { handle: String(newHandle), type: OBJ_API_NODE },
          evaluate: true,
          doCycleCheck: true,
        });
        // Flush scene changes so the connection takes effect immediately
        await client.callMethod('ApiChangeManager', 'update', {});

        // --- Verify ---
        let verified = true;
        let verifyWarning: string | undefined;
        try {
          // enterWrapperNode: false — we want the actual source handle, not the wrapper.
          // With true, geo→placement returns a wrapper handle that != source_handle,
          // causing false negatives on valid connections.
          const verifyResult = await client.callMethod('ApiNode', 'connectedNodeIx', {
            objectPtr: { handle: String(target_handle), type: OBJ_API_NODE },
            pinIx: pin_index,
            enterWrapperNode: false,
          });
          const connectedHandle = extractHandle(verifyResult) ?? 0;
          if (connectedHandle !== newHandle) {
            verified = false;
            verifyWarning = `Connection verification FAILED: pin ${pin_index} shows handle=${connectedHandle} (expected ${newHandle}).`;
          }
        } catch (e: any) {
          mcpLogLazy('verbose', () => `[node:create_and_connect:verify] ${e?.message ?? e}`);
          verifyWarning = 'Connection verification skipped (verify call failed).';
        }

        if (verified) {
          client.sceneCache.setConnection(target_handle, pin_index, newHandle);
        }
        await notifyWebapp({ type: 'nodeChanged', handle: target_handle });

        const result: Record<string, any> = {
          success: true,
          handle: newHandle,
          name: nodeName,
          type: node_type,
          type_id: typeId,
          connected_to: target_handle,
          pin_index,
          verified,
        };
        if (verifyWarning) result.verify_warning = verifyWarning;

        if (!verified) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            isError: true as const,
          };
        }
        return jsonResult(result);
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  // ── Tier 1D: Node Management ─────────────────────────────────────

  server.tool(
    'rename_node',
    'Set the display name of a node. Does not affect connections or behavior.',
    {
      handle: z.number().int().nonnegative().describe('Node handle'),
      name: z.string().min(1).describe('New display name'),
    },
    async ({ handle, name }) => {
      try {
        const gated = gateHandle('rename_node', handle, client.sceneCache);
        if (gated) return gated;

        await client.callMethod('ApiItem', 'setName', {
          objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
          name,
        });
        // Update scene cache
        client.sceneCache.updateName(handle, name);
        await notifyWebapp({ type: 'nodeChanged', handle });
        return jsonResult({ success: true, handle, name });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'find_nodes',
    'Search the scene graph for nodes by type ID or by name. Returns matching handles. Useful for working with loaded scenes where handles are unknown.',
    {
      type_id: z
        .number()
        .int()
        .optional()
        .describe('Node type ID to search for (e.g. 130 for NT_MAT_UNIVERSAL)'),
      name: z.string().optional().describe('Node name to search for (exact match)'),
      recurse: z
        .boolean()
        .optional()
        .default(true)
        .describe('Search recursively into subgraphs (default true)'),
    },
    async ({ type_id, name, recurse }) => {
      try {
        if (type_id === undefined && name === undefined) {
          return errorResult('Provide type_id or name (or both)');
        }

        const rootHandle = await client.getRootNodeGraph();
        const rootRef = { handle: String(rootHandle), type: OBJ_API_NODE_GRAPH };
        const results: { handle: number; name: string }[] = [];

        if (name !== undefined) {
          // Find by name
          const listResult = await client.callMethod('ApiNodeGraph', 'findItemsByName', {
            objectPtr: rootRef,
            name,
            recurse: recurse ?? true,
          });
          const listHandle = extractHandle(listResult);
          if (listHandle) {
            // Iterate the returned ApiItemArray
            const sizeResult = await client.callMethod('ApiItemArray', 'size', {
              objectPtr: { handle: String(listHandle), type: OBJ_API_ITEM_ARRAY },
            });
            const count = Number(extractValue(sizeResult) ?? 0);
            for (let i = 0; i < count; i++) {
              const itemResult = await client.callMethod('ApiItemArray', 'get', {
                objectPtr: { handle: String(listHandle), type: OBJ_API_ITEM_ARRAY },
                index: i,
              });
              const itemHandle = extractHandle(itemResult);
              if (itemHandle) {
                // Optionally filter by type_id too
                if (type_id !== undefined) {
                  const typeResult = await client.callMethod('ApiNode', 'type', {
                    objectPtr: { handle: String(itemHandle), type: OBJ_API_NODE },
                  });
                  const nodeType = Number(extractValue(typeResult) ?? -1);
                  if (nodeType !== type_id) continue;
                }
                const nameResult = await client.callMethod('ApiItem', 'name', {
                  objectPtr: { handle: String(itemHandle), type: OBJ_API_ITEM },
                });
                const nodeName = String(extractValue(nameResult) ?? '');
                results.push({ handle: itemHandle, name: nodeName });
                client.sceneCache.trackHandle(itemHandle);
              }
            }
          }
        } else if (type_id !== undefined) {
          // Find by type — use NON-RECURSIVE Octane API to avoid crashes on
          // scenes with dangerous node types (negative IDs, crash-prone types).
          // Octane's internal recursive findNodes traverses ALL subgraphs including
          // nodes with bad type IDs, which crashes the engine.
          // Instead: search top-level only, then optionally recurse ourselves
          // using the safe traversal that skips dangerous types.
          const listResult = await client.callMethod('ApiNodeGraph', 'findNodes', {
            objectPtr: rootRef,
            type: type_id,
            recurse: false, // NEVER let Octane recurse — it crashes on bad types
          });
          const listHandle = extractHandle(listResult);
          if (listHandle) {
            const sizeResult = await client.callMethod('ApiItemArray', 'size', {
              objectPtr: { handle: String(listHandle), type: OBJ_API_ITEM_ARRAY },
            });
            const count = Number(extractValue(sizeResult) ?? 0);
            for (let i = 0; i < count; i++) {
              const itemResult = await client.callMethod('ApiItemArray', 'get', {
                objectPtr: { handle: String(listHandle), type: OBJ_API_ITEM_ARRAY },
                index: i,
              });
              const itemHandle = extractHandle(itemResult);
              if (itemHandle) {
                const nameResult = await client.callMethod('ApiItem', 'name', {
                  objectPtr: { handle: String(itemHandle), type: OBJ_API_ITEM },
                });
                const nodeName = String(extractValue(nameResult) ?? '');
                results.push({ handle: itemHandle, name: nodeName });
                client.sceneCache.trackHandle(itemHandle);
              }
            }
          }

          // If recurse was requested and we found nothing at top level,
          // do a safe manual search through subgraphs (skipping dangerous types).
          if ((recurse ?? true) && results.length === 0) {
            // Get top-level items and search their subgraphs safely
            const topListResult = await client.callMethod('ApiNodeGraph', 'getItems', {
              objectPtr: rootRef,
            });
            const topListHandle = extractHandle(topListResult);
            if (topListHandle) {
              const topSizeResult = await client.callMethod('ApiItemArray', 'size', {
                objectPtr: { handle: String(topListHandle), type: OBJ_API_ITEM_ARRAY },
              });
              const topCount = Number(extractValue(topSizeResult) ?? 0);
              for (let i = 0; i < topCount && results.length < 100; i++) {
                try {
                  const itemResult = await client.callMethod('ApiItemArray', 'get', {
                    objectPtr: { handle: String(topListHandle), type: OBJ_API_ITEM_ARRAY },
                    index: i,
                  });
                  const itemHandle = extractHandle(itemResult);
                  if (!itemHandle) continue;

                  // Check if this item is a graph we can safely recurse into
                  const graphResult = await client.callMethod('ApiItem', 'isGraph', {
                    objectPtr: { handle: String(itemHandle), type: OBJ_API_ITEM },
                  });
                  const isGraph = extractValue(graphResult) ?? false;
                  if (!isGraph) continue;

                  // Check the item's type — skip dangerous types
                  let itemTypeId = 0;
                  try {
                    const typeResult = await client.callMethod('ApiNode', 'type', {
                      objectPtr: { handle: String(itemHandle), type: OBJ_API_NODE },
                    });
                    const typeRaw = extractValue(typeResult);
                    itemTypeId = Number(typeRaw ?? 0);
                  } catch {
                    // Can't get type → skip
                    continue;
                  }

                  if (itemTypeId <= 0 || CRASH_TYPE_IDS.has(itemTypeId)) continue;

                  // Safe to search this subgraph (non-recursive at each level)
                  try {
                    const subRef = { handle: String(itemHandle), type: OBJ_API_NODE_GRAPH };
                    const subListResult = await client.callMethod('ApiNodeGraph', 'findNodes', {
                      objectPtr: subRef,
                      type: type_id,
                      recurse: false,
                    });
                    const subListHandle = extractHandle(subListResult);
                    if (subListHandle) {
                      const subSizeResult = await client.callMethod('ApiItemArray', 'size', {
                        objectPtr: { handle: String(subListHandle), type: OBJ_API_ITEM_ARRAY },
                      });
                      const subCount = Number(extractValue(subSizeResult) ?? 0);
                      for (let j = 0; j < subCount; j++) {
                        const subItemResult = await client.callMethod('ApiItemArray', 'get', {
                          objectPtr: { handle: String(subListHandle), type: OBJ_API_ITEM_ARRAY },
                          index: j,
                        });
                        const subItemHandle = extractHandle(subItemResult);
                        if (subItemHandle) {
                          const subNameResult = await client.callMethod('ApiItem', 'name', {
                            objectPtr: { handle: String(subItemHandle), type: OBJ_API_ITEM },
                          });
                          const subNodeName = String(extractValue(subNameResult) ?? '');
                          results.push({ handle: subItemHandle, name: subNodeName });
                          client.sceneCache.trackHandle(subItemHandle);
                        }
                      }
                    }
                  } catch {
                    // Subgraph search failed — skip this graph, continue to next
                  }
                } catch {
                  continue;
                }
              }
            }
          }
        }

        return jsonResult({ count: results.length, nodes: results });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'duplicate_node',
    'Deep-copy a node (and its subtree) within the scene. Returns the new root handle. All new handles are tracked in SceneCache.',
    {
      handle: z.number().int().nonnegative().describe('Handle of the node to duplicate'),
    },
    async ({ handle }) => {
      try {
        const gated = gateHandle('duplicate_node', handle, client.sceneCache);
        if (gated) return gated;

        const rootHandle = await client.getRootNodeGraph();
        const result = await client.callMethod('ApiNodeGraph', 'copyItemTree', {
          objectPtr: { handle: String(rootHandle), type: OBJ_API_NODE_GRAPH },
          rootItem: { handle: String(handle), type: OBJ_API_ITEM },
        });
        const newHandle = extractHandle(result);
        if (!newHandle) return errorResult('Copy returned no handle');

        // Get name and track
        const nameResult = await client.callMethod('ApiItem', 'name', {
          objectPtr: { handle: String(newHandle), type: OBJ_API_ITEM },
        });
        const nodeName = String(extractValue(nameResult) ?? '');
        const origType = client.sceneCache.getTypeName(handle);
        const origTypeId = client.sceneCache.getTypeId(handle);
        client.sceneCache.addNode(newHandle, nodeName, origType ?? '', origTypeId ?? 0);
        await notifyWebapp({ type: 'nodeAdded', handle: newHandle });

        return jsonResult({
          success: true,
          original_handle: handle,
          new_handle: newHandle,
          name: nodeName,
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'delete_unconnected',
    'Delete all orphaned/unconnected nodes in the scene. Refreshes SceneCache after cleanup. Use with caution — may remove nodes you intended to connect later.',
    {},
    async () => {
      try {
        const rootHandle = await client.getRootNodeGraph();
        await client.callMethod('ApiItem', 'deleteUnconnectedItems', {
          objectPtr: { handle: String(rootHandle), type: OBJ_API_NODE_GRAPH },
        });
        // Invalidate entire scene cache since we don't know which nodes were removed
        client.sceneCache.clear();
        await notifyWebapp({ type: 'sceneChanged' });
        return jsonResult({
          success: true,
          message: 'Orphaned nodes deleted. SceneCache cleared — use get_scene_tree to refresh.',
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
