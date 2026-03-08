/**
 * Project Tools — load_project, save_project, reset_project
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

export function registerProjectTools(server: McpServer, client: OctaneMcpClient) {
  server.tool(
    'load_project',
    'Load an Octane project file (.orbx or .ocs). The scene takes ~2 seconds to fully load after the call returns.',
    { path: z.string().describe('Absolute path to .orbx or .ocs file') },
    async ({ path }) => {
      try {
        const result = await client.callMethod('ApiProjectManager', 'loadProject', {
          projectPath: path,
        });
        // loadProject is async in Octane — wait for scene to populate
        await new Promise(r => setTimeout(r, 2000));
        return jsonResult({ success: true, path, callbackId: result?.callbackId });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'save_project',
    'Save the current Octane project. If path is omitted, saves to the current location.',
    {
      path: z
        .string()
        .optional()
        .describe('Absolute path to save to. Omit to save to current path.'),
    },
    async ({ path }) => {
      try {
        if (path) {
          await client.callMethod('ApiProjectManager', 'saveProjectAs', { path });
        } else {
          await client.callMethod('ApiProjectManager', 'saveProject', {});
        }
        return jsonResult({ success: true, path });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'reset_project',
    'Clear the current scene and reset to a blank project. This can take up to 120 seconds.',
    {},
    async () => {
      try {
        await client.callMethod('ApiProjectManager', 'resetProject', { suppressUI: true }, 120000);
        return jsonResult({ success: true });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
