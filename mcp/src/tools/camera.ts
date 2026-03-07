/**
 * Camera Tools — get_camera, set_camera
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

const Vec3Schema = z
  .object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  })
  .describe('3D vector {x, y, z}');

export function registerCameraTools(server: McpServer, client: OctaneMcpClient) {
  server.tool(
    'get_camera',
    'Get the current camera position, target, and up vector in world coordinates',
    {},
    async () => {
      try {
        const result = await client.callMethod('LiveLink', 'GetCamera', {});
        return jsonResult(result);
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'set_camera',
    'Set camera position and/or target in world coordinates. At least one of position or target must be provided. Changes are reflected in octaneWebR viewport in real time.',
    {
      position: Vec3Schema.optional().describe('Camera position in world coordinates'),
      target: Vec3Schema.optional().describe('Camera look-at target in world coordinates'),
    },
    async ({ position, target }) => {
      if (!position && !target) {
        return errorResult('Provide position, target, or both');
      }
      try {
        const params: any = {};
        if (position) params.position = position;
        if (target) params.target = target;
        await client.callMethod('LiveLink', 'SetCamera', params);
        return jsonResult({ success: true });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
