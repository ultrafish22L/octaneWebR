/**
 * Project Tools — load_project, save_project, reset_project
 *
 * Load readiness: waits for Octane's projectManagerChanged callback via
 * StreamCallbackService (shared/CallbackStreamManager.ts). Falls back to
 * a fixed delay if callback streaming is unavailable.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs';
import { OctaneMcpClient, mcpLog, mcpLogReset, MCP_LOG_PATH } from '../OctaneMcpClient';
import { ApiCache } from '../ApiCache';
import { jsonResult, errorResult, validateFilePath } from './utils';
import { notifyWebapp } from './webapp';

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

        // Get file size for logging
        let fileSizeMB = 0;
        try {
          const stat = fs.statSync(path);
          fileSizeMB = stat.size / (1024 * 1024);
        } catch {
          // Can't stat — no big deal
        }

        mcpLog(`load_project: loading ${fileSizeMB.toFixed(0)}MB scene: ${path}`, 'info');

        // Register callback listener BEFORE sending loadProject — the
        // projectManagerChanged event can fire while loadProject is still
        // being awaited, and we'd miss it if the listener wasn't set up yet.
        const loadStartMs = Date.now();
        const changePromise = client.waitForProjectChange(120_000);

        const result = await client.callMethod('ApiProjectManager', 'loadProject', {
          projectPath: path,
          evaluate: true,
        });

        const event = await changePromise;
        const loadMs = Date.now() - loadStartMs;

        if (event) {
          mcpLog(`load_project: projectManagerChanged received after ${loadMs}ms`, 'info');
        } else {
          mcpLog(
            `load_project: no callback received after ${loadMs}ms — proceeding anyway`,
            'warn'
          );
        }

        client.clearRootGraphCache();

        // Verify Octane is still alive — but only if the callback didn't confirm it.
        // If projectManagerChanged fired, Octane is obviously alive.
        if (!event) {
          const alive = await client.checkHealth();
          if (!alive) {
            return jsonResult({
              success: false,
              path,
              error: 'Octane crashed or disconnected while loading the scene.',
            });
          }
        }

        // Trigger scene evaluation — without this, MCP-loaded scenes render white.
        // The web UI triggers eval automatically, but gRPC loadProject does not.
        try {
          await client.callMethod('ApiChangeManager', 'update', {});
          mcpLog('load_project: scene evaluation triggered', 'info');
        } catch (e: any) {
          mcpLog(`load_project: scene eval failed: ${e.message}`, 'warn');
        }

        return jsonResult({
          success: true,
          path,
          callbackId: result?.callbackId,
          loadTimeMs: loadMs,
          fileSizeMB: Math.round(fileSizeMB),
        });
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
    'Clear scene to blank. Invalidates ALL handles. Can take up to 120s.',
    {
      clear_log: z
        .boolean()
        .optional()
        .default(true)
        .describe('Clear log_mcp.log for a clean debugging session (default: true)'),
    },
    async ({ clear_log }) => {
      try {
        // suppressUI: true prevents Octane's "Save changes?" blocking dialog.
        // Safe on SDK-based server (octaneServGrpc) — no dialog is ever shown.
        await client.callMethod('ApiProjectManager', 'resetProject', { suppressUI: true }, 120000);
        client.clearRootGraphCache();

        // Tell web UI to drop all cached handles and refresh
        await notifyWebapp({ type: 'refreshScene' });

        // Optionally clear the MCP log for a fresh debugging session
        let log_cleared = false;
        let old_log_lines = 0;
        if (clear_log && fs.existsSync(MCP_LOG_PATH)) {
          const content = fs.readFileSync(MCP_LOG_PATH, 'utf-8');
          old_log_lines = content.split('\n').length;
          mcpLogReset();
          fs.writeFileSync(MCP_LOG_PATH, '');
          log_cleared = true;
        }

        return jsonResult({
          success: true,
          message: 'Scene cleared. All previous handles are invalid.',
          ...(log_cleared && { log_cleared: true, old_log_lines }),
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
