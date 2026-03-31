/**
 * Render Control Tools — clay mode, render priority, sub-sample mode
 *
 * Each is a single tool: pass value to set, omit to get current value.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient } from '../OctaneMcpClient';
import { ArtDirectionState } from '../ArtDirectionState';
import { jsonResult, errorResult } from './utils';

export function registerRenderControlTools(
  server: McpServer,
  client: OctaneMcpClient,
  artState?: ArtDirectionState
) {
  // ── Clay Mode ──────────────────────────────────────────────────────

  server.registerTool(
    'clay_mode',
    {
      title: 'Clay Mode',
      description:
        'Toggle clay rendering for scene layout verification. When AD is active: mode 2 ON for Phase 1, OFF at Phase 2 start. Modes: 0=none (normal), 1=grey clay, 2=color clay.',
      inputSchema: {
        mode: z
          .number()
          .int()
          .min(0)
          .max(2)
          .optional()
          .describe('Clay mode to set: 0=none, 1=grey, 2=color. Omit to read current mode.'),
      },
    },
    async ({ mode }) => {
      try {
        if (mode !== undefined) {
          await client.callMethod('ApiRenderEngine', 'setClayMode', { mode });
          artState?.setCachedClay(mode);
          return jsonResult({
            success: true,
            clay_mode: mode,
            mode_name: ['none', 'grey', 'color'][mode],
          });
        } else {
          const result = await client.callMethod('ApiRenderEngine', 'clayMode', {});
          const current = result?.result ?? result?.mode ?? result;
          return jsonResult({ clay_mode: current });
        }
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );

  // ── Render Priority ────────────────────────────────────────────────

  server.registerTool(
    'render_priority',
    {
      title: 'Render Priority',
      description: 'Set GPU render priority. Call describe_tool("render_priority") for params.',
      inputSchema: {
        priority: z.number().int().min(0).max(2).optional(),
      },
    },
    async ({ priority }) => {
      try {
        if (priority !== undefined) {
          await client.callMethod('ApiRenderEngine', 'setRenderPriority', { priority });
          return jsonResult({
            success: true,
            priority,
            priority_name: ['LOW', 'MEDIUM', 'HIGH'][priority],
          });
        } else {
          const result = await client.callMethod('ApiRenderEngine', 'renderPriority', {});
          const current = result?.result ?? result?.priority ?? result;
          return jsonResult({ priority: current });
        }
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );

  // ── Sub-Sample Mode ────────────────────────────────────────────────

  server.registerTool(
    'subsample_mode',
    {
      title: 'Subsample Mode',
      description: 'Set viewport sub-sampling. Call describe_tool("subsample_mode") for params.',
      inputSchema: {
        mode: z.number().int().min(0).max(3).optional(),
      },
    },
    async ({ mode }) => {
      try {
        if (mode !== undefined) {
          await client.callMethod('ApiRenderEngine', 'setSubSampleMode', { mode });
          return jsonResult({ success: true, subsample_mode: mode });
        } else {
          const result = await client.callMethod('ApiRenderEngine', 'getSubSampleMode', {});
          const current = result?.result ?? result?.mode ?? result;
          return jsonResult({ subsample_mode: current });
        }
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );
}
