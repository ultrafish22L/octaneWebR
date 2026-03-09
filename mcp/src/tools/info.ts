/**
 * Info Tools — list_node_types, get_device_info, get_octane_version
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient } from '../OctaneMcpClient';

// Import node type constants from client
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  NodeType,
  AttrType,
  AttributeId,
  ObjectType,
} = require('../../../client/src/constants/OctaneTypes');

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

export function registerInfoTools(server: McpServer, client: OctaneMcpClient) {
  server.tool(
    'get_octane_version',
    'Get the Octane version and license information',
    {},
    async () => {
      try {
        const info = await client.getSessionInfo();
        return jsonResult(info);
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'get_device_info',
    'Get GPU device information including name and memory usage',
    { device_index: z.number().default(0).describe('GPU device index (default 0)') },
    async ({ device_index }) => {
      try {
        const count = await client.getDeviceCount();
        const name = await client.getDeviceName(device_index);
        // Memory is dynamic — always query fresh
        const memory = await client.callMethod('ApiRenderEngine', 'getMemoryUsage', {
          deviceIndex: device_index,
        });
        return jsonResult({
          device_count: count,
          name: name,
          memory: memory,
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'list_node_types',
    'List available Octane node types, attribute types, and attribute IDs. Use category to filter node types by prefix (e.g. "CAM" for cameras, "MAT" for materials, "TEX" for textures, "GEO" for geometry, "LIGHT" for lights, "ENV" for environments, "KERN" for kernels).',
    {
      category: z
        .string()
        .optional()
        .describe('Filter node types by prefix, e.g. "CAM", "MAT", "TEX", "GEO", "LIGHT"'),
    },
    async ({ category }) => {
      try {
        let nodeTypes = NodeType as Record<string, number>;

        if (category) {
          const prefix = `NT_${category.toUpperCase()}`;
          const filtered: Record<string, number> = {};
          for (const [key, value] of Object.entries(nodeTypes)) {
            if (key.startsWith(prefix)) {
              filtered[key] = value as number;
            }
          }
          nodeTypes = filtered;
        }

        return jsonResult({
          node_types: nodeTypes,
          attr_types: AttrType,
          attribute_ids: AttributeId,
          object_types: { ApiItem: ObjectType.ApiItem, ApiNode: ObjectType.ApiNode },
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
