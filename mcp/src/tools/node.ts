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

export function registerNodeTools(server: McpServer, client: OctaneMcpClient) {
  server.tool(
    'create_node',
    'Create a new Octane node. Use list_node_types to find available types. Example: node_type="NT_MAT_UNIVERSAL" for universal material.',
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
        const rootHandle = rootResult?.handle ?? rootResult?.value?.handle;
        if (!rootHandle) return errorResult('No root node graph found');

        const result = await client.callMethod('ApiNode', 'create', {
          type: typeId,
          ownerGraph: { handle: String(rootHandle), type: 20 }, // ObjectType.ApiNodeGraph
          configurePins: true,
        });

        const newHandle = result?.handle ?? result?.value?.handle;
        if (!newHandle) return errorResult('Node creation returned no handle');

        // Get the name Octane assigned
        const nameResult = await client.callMethod('ApiItem', 'name', {
          objectPtr: { handle: String(newHandle), type: 16 },
        });

        return jsonResult({
          success: true,
          handle: Number(newHandle),
          name: nameResult?.value ?? String(nameResult),
          type: node_type,
          type_id: typeId,
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
    "Connect a source node to a target node's input pin. Use get_node_info to find pin indices.",
    {
      target_handle: z.number().describe('Target node handle (the node receiving the connection)'),
      pin_index: z.number().describe('Pin index on the target node to connect to'),
      source_handle: z.number().describe('Source node handle (the node being connected)'),
      evaluate: z.boolean().default(true).describe('Trigger scene evaluation after connecting'),
    },
    async ({ target_handle, pin_index, source_handle, evaluate }) => {
      try {
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
