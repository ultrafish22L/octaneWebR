/**
 * Scene Tools — get_scene_tree, get_node_info
 *
 * These replicate the traversal pattern from SceneService.buildSceneTree
 * but return plain JSON instead of populating a Scene object.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient, mcpLog, mcpLogLazy } from '../OctaneMcpClient';
import { ApiCache } from '../ApiCache';
import { PIN_TYPE_NAMES } from './node';
import { enumeratePins } from './pin-utils';
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

interface SceneTreeNode {
  handle: number;
  name: string;
  type: number;
  typeName?: string;
  isGraph: boolean;
  children?: SceneTreeNode[];
  pinCount?: number;
}

async function traverseGraph(
  client: OctaneMcpClient,
  cache: ApiCache | null,
  graphHandle: number,
  depth: number,
  maxDepth: number
): Promise<SceneTreeNode[]> {
  const nodes: SceneTreeNode[] = [];

  try {
    // Get the owned items array for this graph
    const listResult = await client.callMethod('ApiNodeGraph', 'getOwnedItems', {
      objectPtr: { handle: String(graphHandle), type: OBJ_API_NODE_GRAPH },
    });

    const listHandle = extractHandle(listResult);
    if (!listHandle) return nodes;

    // Get count
    const sizeResult = await client.callMethod('ApiItemArray', 'size', {
      objectPtr: { handle: String(listHandle), type: OBJ_API_ITEM_ARRAY },
    });
    const count = extractValue(sizeResult) ?? 0;

    // Iterate items
    for (let i = 0; i < count; i++) {
      try {
        const itemResult = await client.callMethod('ApiItemArray', 'get', {
          objectPtr: { handle: String(listHandle), type: OBJ_API_ITEM_ARRAY },
          index: i,
        });

        const itemHandle = extractHandle(itemResult);
        if (!itemHandle) continue;

        // Get node info
        const nameResult = await client.callMethod('ApiItem', 'name', {
          objectPtr: { handle: String(itemHandle), type: OBJ_API_ITEM },
        });
        const graphResult = await client.callMethod('ApiItem', 'isGraph', {
          objectPtr: { handle: String(itemHandle), type: OBJ_API_ITEM },
        });

        const name = extractValue(nameResult) ?? '';
        const isGraph = extractValue(graphResult) ?? false;

        // Get node TYPE ID (not outType which returns pin output type like PT_MATERIAL=7).
        // ApiNode.type() returns the NodeType enum (e.g. NT_MAT_UNIVERSAL=130).
        let typeId = 0;
        try {
          const typeResult = await client.callMethod('ApiNode', 'type', {
            objectPtr: { handle: String(itemHandle), type: OBJ_API_NODE },
          });
          const typeRaw = extractValue(typeResult);
          // enums: String → may return "NT_MAT_UNIVERSAL" or a number
          if (typeof typeRaw === 'string' && typeRaw.startsWith('NT_')) {
            typeId = cache?.getNodeTypeId(typeRaw) ?? 0;
          } else {
            typeId = Number(typeRaw ?? 0);
          }
        } catch (e: any) {
          mcpLogLazy('verbose', () => `[scene:tree:nodeType:${itemHandle}] ${e?.message ?? e}`);
          // Some items (pure graphs) may not support ApiNode.type()
        }

        const node: SceneTreeNode = {
          handle: Number(itemHandle),
          name: String(name),
          type: typeId,
          isGraph: Boolean(isGraph),
        };

        // If it's a graph and we haven't hit max depth, recurse
        if (isGraph && depth < maxDepth) {
          node.children = await traverseGraph(
            client,
            cache,
            Number(itemHandle),
            depth + 1,
            maxDepth
          );
        }

        // Get pin count for non-graph nodes
        if (!isGraph) {
          try {
            const pinResult = await client.callMethod('ApiNode', 'pinCount', {
              objectPtr: { handle: String(itemHandle), type: OBJ_API_NODE },
            });
            node.pinCount = extractValue(pinResult) ?? 0;
          } catch (e: any) {
            mcpLogLazy('verbose', () => `[scene:tree:pinCount:${itemHandle}] ${e?.message ?? e}`);
            // Some items may not support pinCount
          }
        }

        nodes.push(node);
      } catch (e: any) {
        mcpLog(`traverseGraph: skipping item ${i} in graph ${graphHandle}: ${e.message}`, 'warn');
        continue;
      }
    }
  } catch (error: any) {
    mcpLog(`traverseGraph error for handle ${graphHandle}: ${error.message}`, 'error');
  }

  return nodes;
}

/** Walk a SceneTreeNode[] and register all nodes in SceneCache. */
function walkTreeIntoCache(
  client: OctaneMcpClient,
  cache: ApiCache | null,
  nodes: SceneTreeNode[],
  parentHandle?: number
): void {
  const childHandles: number[] = [];
  for (const node of nodes) {
    const typeName = cache?.getNodeTypeName(node.type) ?? `TYPE_${node.type}`;
    client.sceneCache.addNode(node.handle, node.name, typeName, node.type);
    childHandles.push(node.handle);
    if (node.children) walkTreeIntoCache(client, cache, node.children, node.handle);
  }
  if (parentHandle !== undefined) {
    client.sceneCache.setChildren(parentHandle, childHandles);
  }
}

/**
 * Populate the SceneCache by traversing the scene graph.
 * Called automatically after load_project so tools don't need a manual get_scene_tree.
 */
export async function populateSceneCache(
  client: OctaneMcpClient,
  cache: ApiCache | null,
  maxDepth = 2
): Promise<void> {
  const rootHandle = await client.getRootNodeGraph();
  const tree = await traverseGraph(client, cache, rootHandle, 0, maxDepth);
  walkTreeIntoCache(client, cache, tree, rootHandle);
  client.sceneCache.markPopulated();
}

export function registerSceneTools(
  server: McpServer,
  client: OctaneMcpClient,
  cache: ApiCache | null
) {
  server.tool(
    'get_scene_tree',
    'Get full scene hierarchy. Returns handle, name, type, isGraph, children for all nodes. Populates internal scene cache for faster subsequent lookups. Use max_depth to limit traversal for large scenes.',
    {
      max_depth: z.number().default(3).describe('Maximum traversal depth (default 3)'),
      compact: z
        .boolean()
        .default(false)
        .describe(
          'If true, returns minimal [handle, name, typeName] tuples instead of full objects'
        ),
    },
    async ({ max_depth, compact }) => {
      try {
        const rootHandle = await client.getRootNodeGraph();

        const tree = await traverseGraph(client, cache, rootHandle, 0, max_depth);

        // Populate scene cache from traversal results
        walkTreeIntoCache(client, cache, tree, rootHandle);
        client.sceneCache.markPopulated();

        if (compact) {
          // Flatten tree to minimal tuples: [handle, name, typeName]
          const flatten = (nodes: SceneTreeNode[]): Array<[number, string, string]> => {
            const result: Array<[number, string, string]> = [];
            for (const n of nodes) {
              const typeName = cache?.getNodeTypeName(n.type) ?? `TYPE_${n.type}`;
              result.push([n.handle, n.name, typeName]);
              if (n.children) result.push(...flatten(n.children));
            }
            return result;
          };
          const flat = flatten(tree);
          return jsonResult({ root_handle: rootHandle, nodes: flat, count: flat.length });
        }
        return jsonResult({ root_handle: rootHandle, nodes: tree, count: tree.length });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'get_node_info',
    'Get node details: name, type, all pins with connection status. WARNING: certain internal type IDs crash Octane — never call on handles of unknown type without checking first. Returns pin index, name, type, and connected_handle for each pin. Updates scene cache with discovered connections.',
    {
      handle: z.number().int().nonnegative().describe('Node handle'),
      connected_only: z
        .boolean()
        .default(false)
        .describe('If true, only return pins with connections (non-zero connected_handle)'),
    },
    async ({ handle, connected_only }) => {
      try {
        // Gate: reject handles never seen by any MCP tool
        const gated = gateHandle('get_node_info', handle, client.sceneCache);
        if (gated) return gated;

        const nameResult = await client.callMethod('ApiItem', 'name', {
          objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
        });
        const typeResult = await client.callMethod('ApiItem', 'outType', {
          objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
        });
        const graphResult = await client.callMethod('ApiItem', 'isGraph', {
          objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
        });

        const info: any = {
          handle,
          name: extractValue(nameResult) ?? '',
          type: extractValue(typeResult),
          isGraph: extractValue(graphResult),
          pins: [],
        };

        // Try to get node type for cache lookup — check sceneCache first to
        // avoid a redundant ApiNode.type() gRPC call for nodes created via MCP.
        let cachedNodeInfo = null;
        if (cache) {
          try {
            let nodeTypeName = client.sceneCache.getTypeName(handle);
            if (!nodeTypeName) {
              const nodeTypeResult = await client.callMethod('ApiNode', 'type', {
                objectPtr: { handle: String(handle), type: OBJ_API_NODE },
              });
              const nodeTypeRaw = extractValue(nodeTypeResult);
              // enums: String → returns "NT_MAT_UNIVERSAL" (string), not 130 (number)
              nodeTypeName =
                typeof nodeTypeRaw === 'string'
                  ? nodeTypeRaw
                  : cache.getNodeTypeName(Number(nodeTypeRaw));
            }
            if (nodeTypeName) {
              cachedNodeInfo = cache.getNodeType(nodeTypeName);
              if (cachedNodeInfo) {
                info.nodeType = nodeTypeName;
                // Update scene cache with discovered type
                const typeId = cache.getNodeTypeId(nodeTypeName) ?? 0;
                client.sceneCache.addNode(handle, String(info.name), nodeTypeName, typeId);
              }
            }
          } catch (e: any) {
            mcpLogLazy('verbose', () => `[scene:get_node_info:type_lookup] ${e?.message ?? e}`);
            // Fall through to gRPC path
          }
        }

        // Get pin information
        try {
          // Nodes with only movable inputs (e.g. NT_GEO_GROUP) have pins:[] in the
          // cache because all their input pins are dynamic.  Fall through to the gRPC
          // path so we discover runtime movable pins instead of returning an empty list.
          const useCache =
            cachedNodeInfo &&
            !(cachedNodeInfo.pins.length === 0 && cachedNodeInfo.movableInputPinCount > 0);

          if (useCache && cachedNodeInfo) {
            // FAST PATH: pin names and types from cache, only query runtime connections
            for (const cp of cachedNodeInfo.pins) {
              const pin: any = {
                index: cp.index,
                name: cp.staticName,
                type: cp.type,
              };

              // Get connected node (runtime data — must query)
              let connectedHandle = 0;
              try {
                const connResult = await client.callMethod('ApiNode', 'connectedNodeIx', {
                  objectPtr: { handle: String(handle), type: OBJ_API_NODE },
                  pinIx: cp.index,
                  enterWrapperNode: true,
                });
                connectedHandle = extractHandle(connResult) ?? 0;
              } catch (e: any) {
                mcpLogLazy(
                  'verbose',
                  () => `[scene:get_node_info:connectedNode:${cp.index}] ${e?.message ?? e}`
                );
                // Not graph-connected, try pin-owned
              }
              if (!connectedHandle) {
                try {
                  const ownedResult = await client.callMethod('ApiNode', 'ownedItemIx', {
                    objectPtr: { handle: String(handle), type: OBJ_API_NODE },
                    pinIx: cp.index,
                  });
                  connectedHandle = extractHandle(ownedResult) ?? 0;
                } catch (e: any) {
                  mcpLogLazy(
                    'verbose',
                    () => `[scene:get_node_info:ownedItem:${cp.index}] ${e?.message ?? e}`
                  );
                  // Pin has no node
                }
              }
              pin.connected_handle = connectedHandle;

              if (connectedHandle && connectedHandle !== 0) {
                try {
                  const connName = await client.callMethod('ApiItem', 'name', {
                    objectPtr: { handle: String(connectedHandle), type: OBJ_API_ITEM },
                  });
                  pin.connected_name = extractValue(connName) ?? '';
                } catch (e: any) {
                  mcpLogLazy(
                    'verbose',
                    () =>
                      `[scene:get_node_info:connectedName:${connectedHandle}] ${e?.message ?? e}`
                  );
                  // Skip if name lookup fails
                }
              }

              info.pins.push(pin);
            }
          } else {
            // FALLBACK: enumerate all pins via shared helper
            const enumerated = await enumeratePins(client, handle, {
              includeOwned: true,
              withConnectedNames: true,
            });
            for (const p of enumerated) {
              info.pins.push({
                index: p.index,
                name: p.name,
                type: p.typeName,
                connected_handle: p.connectedHandle,
                connected_name: p.connectedName ?? '',
              });
            }
          }
        } catch (e: any) {
          mcpLogLazy('verbose', () => `[scene:get_node_info:pins] ${e?.message ?? e}`);
          // Node may not support pins
        }

        // Track all discovered handles for crash prevention
        client.sceneCache.trackHandle(handle);
        for (const pin of info.pins) {
          if (pin.connected_handle && pin.connected_handle !== 0) {
            client.sceneCache.trackHandle(pin.connected_handle);
            client.sceneCache.setConnection(handle, pin.index, pin.connected_handle);
          }
        }

        // Filter to connected pins only if requested
        if (connected_only) {
          info.pins = info.pins.filter((p: any) => p.connected_handle && p.connected_handle !== 0);
        }

        return jsonResult(info);
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
