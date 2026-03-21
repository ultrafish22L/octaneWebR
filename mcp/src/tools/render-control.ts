/**
 * Render Control Tools — render region, clay mode, render priority, sub-sample mode
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient } from '../OctaneMcpClient';
import { jsonResult, errorResult } from './utils';

export function registerRenderControlTools(server: McpServer, client: OctaneMcpClient) {
  // Render region removed — viewport UI interaction, not MCP-useful.
  // Also pick_point crashes Octane when render region is active.

  // ── Clay Mode ──────────────────────────────────────────────────────

  server.tool(
    'set_clay_mode',
    'Toggle clay (diffuse-only) rendering for fast scene layout verification. Modes: 0=none (normal), 1=grey clay, 2=color clay.',
    {
      mode: z.number().int().min(0).max(2).describe('Clay mode: 0=none, 1=grey, 2=color'),
    },
    async ({ mode }) => {
      try {
        await client.callMethod('ApiRenderEngine', 'setClayMode', { mode });
        return jsonResult({
          success: true,
          clay_mode: mode,
          mode_name: ['none', 'grey', 'color'][mode],
        });
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'get_clay_mode',
    'Get the current clay mode. Returns 0=none, 1=grey, 2=color.',
    {},
    async () => {
      try {
        const result = await client.callMethod('ApiRenderEngine', 'clayMode', {});
        const mode = result?.result ?? result?.mode ?? result;
        return jsonResult({ clay_mode: mode });
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );

  // ── Render Priority ────────────────────────────────────────────────

  server.tool(
    'set_render_priority',
    'Set GPU render priority. LOW=background rendering, MEDIUM=balanced, HIGH=maximum GPU allocation.',
    {
      priority: z.number().int().min(0).max(2).describe('Priority: 0=LOW, 1=MEDIUM, 2=HIGH'),
    },
    async ({ priority }) => {
      try {
        await client.callMethod('ApiRenderEngine', 'setRenderPriority', { priority });
        return jsonResult({
          success: true,
          priority,
          priority_name: ['LOW', 'MEDIUM', 'HIGH'][priority],
        });
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'get_render_priority',
    'Get the current GPU render priority (0=LOW, 1=MEDIUM, 2=HIGH).',
    {},
    async () => {
      try {
        const result = await client.callMethod('ApiRenderEngine', 'renderPriority', {});
        const priority = result?.result ?? result?.priority ?? result;
        return jsonResult({ priority });
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );

  // ── Sub-Sample Mode ────────────────────────────────────────────────

  server.tool(
    'set_subsample_mode',
    'Set viewport sub-sampling for faster interactive rendering. Modes: 0=none (full res), 1=2x2, 2=4x4, 3=8x8.',
    {
      mode: z.number().int().min(0).max(3).describe('Sub-sample mode: 0=none, 1=2x2, 2=4x4, 3=8x8'),
    },
    async ({ mode }) => {
      try {
        await client.callMethod('ApiRenderEngine', 'setSubSampleMode', { mode });
        return jsonResult({ success: true, subsample_mode: mode });
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'get_subsample_mode',
    'Get the current viewport sub-sampling mode (0=none, 1=2x2, 2=4x4, 3=8x8).',
    {},
    async () => {
      try {
        const result = await client.callMethod('ApiRenderEngine', 'getSubSampleMode', {});
        const mode = result?.result ?? result?.mode ?? result;
        return jsonResult({ subsample_mode: mode });
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );
}
