/**
 * Project Tools — load_project, save_project, reset_project
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient, mcpLog } from '../OctaneMcpClient';
import { ApiCache } from '../ApiCache';
import { jsonResult, errorResult, validateFilePath } from './utils';
import { populateSceneCache } from './scene';

export function registerProjectTools(
  server: McpServer,
  client: OctaneMcpClient,
  cache: ApiCache | null
) {
  server.tool(
    'load_project',
    'Load an Octane project file (.orbx or .ocs). Scene takes ~2s to populate after call returns. Clears all cached handles — previous node handles become invalid.',
    { path: z.string().describe('Absolute path to .orbx or .ocs file') },
    async ({ path }) => {
      try {
        const pathError = validateFilePath(path);
        if (pathError) return errorResult(new Error(pathError));

        const result = await client.callMethod('ApiProjectManager', 'loadProject', {
          projectPath: path,
        });
        // loadProject is async in Octane — wait for scene to populate
        await new Promise(r => setTimeout(r, 2000));
        client.clearRootGraphCache();

        // Auto-populate SceneCache so tools work immediately (no manual get_scene_tree needed)
        try {
          await populateSceneCache(client, cache, 2);
          mcpLog('load_project: SceneCache auto-populated', 'debug');
        } catch (e: any) {
          mcpLog(`load_project: SceneCache auto-populate failed: ${e.message}`, 'warn');
        }

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
          const pathError = validateFilePath(path);
          if (pathError) return errorResult(new Error(pathError));
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
    'Clear scene to blank. DANGER: Pops a BLOCKING DIALOG if project is unsaved — this hangs gRPC for 30+ seconds. ALWAYS call save_project first, or delete all nodes manually. Invalidates ALL handles. Can take up to 120s.',
    {},
    async () => {
      try {
        await client.callMethod('ApiProjectManager', 'resetProject', { suppressUI: true }, 120000);
        client.clearRootGraphCache();
        return jsonResult({
          success: true,
          warning: 'Scene reset to blank. All previous nodes and connections are gone.',
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
