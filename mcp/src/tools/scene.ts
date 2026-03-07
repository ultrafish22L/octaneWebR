/**
 * Scene Tools — get_scene_tree, get_node_info
 *
 * These replicate the traversal pattern from SceneService.buildSceneTree
 * but return plain JSON instead of populating a Scene object.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient } from '../OctaneMcpClient';

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
      objectPtr: { handle: String(graphHandle), type: 20 }, // ObjectType.ApiNodeGraph = 20
    });

    const listHandle = listResult?.handle ?? listResult?.value?.handle;
    if (!listHandle) return nodes;

    // Get count
    const sizeResult = await client.callMethod('ApiItemArray', 'size', {
      objectPtr: { handle: String(listHandle), type: 31 }, // ObjectType.ApiItemArray = 31
    });
    const count = sizeResult?.value ?? sizeResult ?? 0;

    // Iterate items
    for (let i = 0; i < count; i++) {
      try {
        const itemResult = await client.callMethod('ApiItemArray', 'getAt', {
          objectPtr: { handle: String(listHandle), type: 31 },
          index: i,
        });

        const itemHandle = itemResult?.handle ?? itemResult?.value?.handle;
        if (!itemHandle || itemHandle === 0) continue;

        // Get node info
        const nameResult = await client.callMethod('ApiItem', 'name', {
          objectPtr: { handle: String(itemHandle), type: 16 }, // ObjectType.ApiItem = 16
        });
        const typeResult = await client.callMethod('ApiItem', 'outType', {
          objectPtr: { handle: String(itemHandle), type: 16 },
        });
        const graphResult = await client.callMethod('ApiItem', 'isGraph', {
          objectPtr: { handle: String(itemHandle), type: 16 },
        });

        const name = nameResult?.value ?? String(nameResult);
        const type = typeResult?.value ?? typeResult ?? 0;
        const isGraph = graphResult?.value ?? graphResult ?? false;

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
              objectPtr: { handle: String(itemHandle), type: 17 }, // ObjectType.ApiNode = 17
            });
            node.pinCount = pinResult?.value ?? pinResult ?? 0;
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

export function registerSceneTools(server: McpServer, client: OctaneMcpClient) {
  server.tool(
    'get_scene_tree',
    'Get the full scene node hierarchy. Returns handles, names, types, and children for all nodes. Use max_depth to limit traversal depth for large scenes.',
    { max_depth: z.number().default(3).describe('Maximum traversal depth (default 3)') },
    async ({ max_depth }) => {
      try {
        // Get root node graph
        const rootResult = await client.callMethod('ApiProjectManager', 'rootNodeGraph', {});
        const rootHandle = rootResult?.handle ?? rootResult?.value?.handle;

        if (!rootHandle) {
          return errorResult('No root node graph found. Is a scene loaded?');
        }

        const tree = await traverseGraph(client, Number(rootHandle), 0, max_depth);
        return jsonResult({ root_handle: Number(rootHandle), nodes: tree, count: tree.length });
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
          objectPtr: { handle: String(handle), type: 16 },
        });
        const typeResult = await client.callMethod('ApiItem', 'outType', {
          objectPtr: { handle: String(handle), type: 16 },
        });
        const graphResult = await client.callMethod('ApiItem', 'isGraph', {
          objectPtr: { handle: String(handle), type: 16 },
        });

        const info: any = {
          handle,
          name: nameResult?.value ?? String(nameResult),
          type: typeResult?.value ?? typeResult,
          isGraph: graphResult?.value ?? graphResult,
          pins: [],
        };

        // Get pin information
        try {
          const pinCountResult = await client.callMethod('ApiNode', 'pinCount', {
            objectPtr: { handle: String(handle), type: 17 },
          });
          const pinCount = pinCountResult?.value ?? pinCountResult ?? 0;

          for (let i = 0; i < pinCount; i++) {
            try {
              const pinValue = await client.callMethod('ApiNode', 'getPinValueByIx', {
                objectPtr: { handle: String(handle), type: 17 },
                pinIdx: i,
              });
              const connectedHandle = pinValue?.handle ?? pinValue?.value?.handle ?? 0;

              const pin: any = { index: i, connected_handle: Number(connectedHandle) };

              // Get connected node name if connected
              if (connectedHandle && connectedHandle !== 0) {
                try {
                  const connName = await client.callMethod('ApiItem', 'name', {
                    objectPtr: { handle: String(connectedHandle), type: 16 },
                  });
                  pin.connected_name = connName?.value ?? String(connName);
                } catch {
                  // Skip if name lookup fails
                }
              }

              info.pins.push(pin);
            } catch {
              info.pins.push({ index: i, error: 'failed to read pin' });
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
}
