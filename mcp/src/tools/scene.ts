/**
 * Scene Tools — get_scene_tree, get_node_info, update_scene
 *
 * These replicate the traversal pattern from SceneService.buildSceneTree
 * but return plain JSON instead of populating a Scene object.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient } from '../OctaneMcpClient';
import { ApiCache } from '../ApiCache';
import { PIN_TYPE_NAMES } from './node';
import {
  jsonResult,
  errorResult,
  extractHandle,
  extractValue,
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
        const typeResult = await client.callMethod('ApiItem', 'outType', {
          objectPtr: { handle: String(itemHandle), type: OBJ_API_ITEM },
        });
        const graphResult = await client.callMethod('ApiItem', 'isGraph', {
          objectPtr: { handle: String(itemHandle), type: OBJ_API_ITEM },
        });

        const name = extractValue(nameResult) ?? '';
        const type = extractValue(typeResult) ?? 0;
        const isGraph = extractValue(graphResult) ?? false;

        const node: SceneTreeNode = {
          handle: Number(itemHandle),
          name: String(name),
          type: Number(type),
          isGraph: Boolean(isGraph),
        };

        // If it's a graph and we haven't hit max depth, recurse
        if (isGraph && depth < maxDepth) {
          node.children = await traverseGraph(client, Number(itemHandle), depth + 1, maxDepth);
        }

        // Get pin count for non-graph nodes
        if (!isGraph) {
          try {
            const pinResult = await client.callMethod('ApiNode', 'pinCount', {
              objectPtr: { handle: String(itemHandle), type: OBJ_API_NODE },
            });
            node.pinCount = extractValue(pinResult) ?? 0;
          } catch {
            // Some items may not support pinCount
          }
        }

        nodes.push(node);
      } catch {
        // Skip items that fail to query
        continue;
      }
    }
  } catch (error: any) {
    console.error(`traverseGraph error for handle ${graphHandle}:`, error.message);
  }

  return nodes;
}

export function registerSceneTools(
  server: McpServer,
  client: OctaneMcpClient,
  cache: ApiCache | null
) {
  server.tool(
    'get_scene_tree',
    'Get the full scene node hierarchy. Returns handles, names, types, and children for all nodes. Use max_depth to limit traversal depth for large scenes.',
    { max_depth: z.number().default(3).describe('Maximum traversal depth (default 3)') },
    async ({ max_depth }) => {
      try {
        const rootHandle = await client.getRootNodeGraph();

        const tree = await traverseGraph(client, rootHandle, 0, max_depth);
        return jsonResult({ root_handle: rootHandle, nodes: tree, count: tree.length });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'get_node_info',
    'Get detailed information about a specific node including its name, type, and pin connections',
    { handle: z.number().describe('Node handle') },
    async ({ handle }) => {
      try {
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

        // Try to get node type for cache lookup
        let cachedNodeInfo = null;
        if (cache) {
          try {
            const nodeTypeResult = await client.callMethod('ApiNode', 'type', {
              objectPtr: { handle: String(handle), type: OBJ_API_NODE },
            });
            const nodeTypeRaw = extractValue(nodeTypeResult);
            // enums: String → returns "NT_MAT_UNIVERSAL" (string), not 130 (number)
            const nodeTypeName =
              typeof nodeTypeRaw === 'string'
                ? nodeTypeRaw
                : cache.getNodeTypeName(Number(nodeTypeRaw));
            if (nodeTypeName) {
              cachedNodeInfo = cache.getNodeType(nodeTypeName);
              if (cachedNodeInfo) {
                info.nodeType = nodeTypeName;
                client.handleToTypeName.set(handle, nodeTypeName);
              }
            }
          } catch {
            // Fall through to gRPC path
          }
        }

        // Get pin information
        try {
          if (cachedNodeInfo) {
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
              } catch {
                // Not graph-connected, try pin-owned
              }
              if (!connectedHandle) {
                try {
                  const ownedResult = await client.callMethod('ApiNode', 'ownedItemIx', {
                    objectPtr: { handle: String(handle), type: OBJ_API_NODE },
                    pinIx: cp.index,
                  });
                  connectedHandle = extractHandle(ownedResult) ?? 0;
                } catch {
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
                } catch {
                  // Skip if name lookup fails
                }
              }

              info.pins.push(pin);
            }
          } else {
            // FALLBACK: enumerate all pins via gRPC
            const pinCountResult = await client.callMethod('ApiNode', 'pinCount', {
              objectPtr: { handle: String(handle), type: OBJ_API_NODE },
            });
            const pinCount = extractValue(pinCountResult) ?? 0;

            for (let i = 0; i < pinCount; i++) {
              try {
                const pin: any = { index: i };

                try {
                  const pinNameResult = await client.callMethod('ApiNode', 'pinNameIx', {
                    objectPtr: { handle: String(handle), type: OBJ_API_NODE },
                    index: i,
                  });
                  pin.name = extractValue(pinNameResult) ?? '';
                } catch {
                  // Some pins may not have names
                }

                try {
                  const pinTypeResult = await client.callMethod('ApiNode', 'pinTypeIx', {
                    objectPtr: { handle: String(handle), type: OBJ_API_NODE },
                    index: i,
                  });
                  const typeRaw = extractValue(pinTypeResult);
                  // enums: String → returns "PT_TEXTURE" (string), not 5 (number)
                  if (typeof typeRaw === 'string' && typeRaw.startsWith('PT_')) {
                    pin.type = typeRaw;
                  } else {
                    const typeNum = Number(typeRaw ?? 0);
                    pin.type = PIN_TYPE_NAMES[typeNum] ?? `PT_${typeNum}`;
                  }
                } catch {
                  // Some pins may not report type
                }

                let connectedHandle = 0;
                try {
                  const connResult = await client.callMethod('ApiNode', 'connectedNodeIx', {
                    objectPtr: { handle: String(handle), type: OBJ_API_NODE },
                    pinIx: i,
                  });
                  connectedHandle = extractHandle(connResult) ?? 0;
                } catch {
                  // Not graph-connected, try pin-owned
                }
                if (!connectedHandle) {
                  try {
                    const ownedResult = await client.callMethod('ApiNode', 'ownedItemIx', {
                      objectPtr: { handle: String(handle), type: OBJ_API_NODE },
                      pinIx: i,
                    });
                    connectedHandle = extractHandle(ownedResult) ?? 0;
                  } catch {
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
                  } catch {
                    // Skip if name lookup fails
                  }
                }

                info.pins.push(pin);
              } catch (pinErr: any) {
                info.pins.push({
                  index: i,
                  error: `failed to read pin: ${pinErr?.message || pinErr}`,
                });
              }
            }
          }
        } catch {
          // Node may not support pins
        }

        return jsonResult(info);
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'update_scene',
    'Flush pending changes to the render engine. Call this after a batch of set_attribute and/or connect_nodes calls (which defer evaluation by default). This is the equivalent of ApiChangeManager.update() — it tells Octane to re-evaluate all dirty nodes and update the render.',
    {},
    async () => {
      try {
        const pendingCount = client.getDeferredEvalCount();
        await client.callMethod('ApiChangeManager', 'update', {});
        client.resetDeferredEvalCount();
        return jsonResult({ success: true, flushed_deferred_count: pendingCount });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
