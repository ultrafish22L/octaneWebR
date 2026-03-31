/**
 * Scene Statistics Tools — geometry stats, texture stats, resource stats, scene bounds
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient } from '../OctaneMcpClient';
import { jsonResult, errorResult } from './utils';

export function registerStatsTools(server: McpServer, client: OctaneMcpClient) {
  // Fix 4: Track previous triCount for drop detection
  let prevTriCount = -1;

  server.registerTool(
    'get_stats',
    {
      title: 'Scene Stats',
      description:
        'Get scene statistics. Types: geometry (tri/instance counts), texture (VRAM by type), resource (GPU memory breakdown).',
      inputSchema: {
        type: z.enum(['geometry', 'texture', 'resource']).describe('Stats category'),
        device_index: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .default(0)
          .describe('GPU device index for resource stats (default 0)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ type, device_index }) => {
      try {
        switch (type) {
          case 'geometry': {
            const result = await client.callMethod('ApiRenderEngine', 'getGeometryStatistics', {});
            const stats = (result as any)?.stats ?? result;
            const currentTriCount = Number(stats?.triCount ?? 0);
            const response: Record<string, any> = { type: 'geometry', stats };

            if (prevTriCount > 12 && currentTriCount < prevTriCount) {
              response.warning =
                `\u26a0 triCount DROPPED from ${prevTriCount} to ${currentTriCount}. ` +
                `Geometry was lost. STOP. Follow crash protocol: ` +
                `1) read log_mcp.log for errors, ` +
                `2) call get_scene_tree to check connections, ` +
                `3) trace the actual cause. Do NOT guess from docs.`;
            }
            prevTriCount = currentTriCount;
            return jsonResult(response);
          }

          case 'texture': {
            const result = await client.callMethod('ApiRenderEngine', 'getTexturesStatistics', {});
            return jsonResult({ type: 'texture', ...result });
          }

          case 'resource': {
            const result = await client.callMethod('ApiRenderEngine', 'getResourceStatistics', {
              deviceIx: device_index,
              memoryLocation: 0,
            });
            return jsonResult({ type: 'resource', device_index, ...result });
          }
        }
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'get_scene_bounds',
    {
      title: 'Scene Bounds',
      description:
        'Get the world-space axis-aligned bounding box of the entire scene. Returns bboxMin and bboxMax as {x,y,z}. Essential for computing camera positions and object placement. Returns result=false if scene is empty.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const result = await client.callMethod('ApiRenderEngine', 'getSceneBounds', {});
        // result: { result: bool, bboxMin: {x,y,z}, bboxMax: {x,y,z} }
        const success = result?.result ?? false;
        if (!success) {
          return jsonResult({
            success: false,
            message: 'Scene is empty or has no renderable geometry',
          });
        }
        return jsonResult({
          success: true,
          bbox_min: result.bboxMin,
          bbox_max: result.bboxMax,
        });
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'get_render_state',
    {
      title: 'Render State',
      description:
        'Get comprehensive render pipeline state: compiling, pending, paused, failure. For troubleshooting.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        // Query multiple render state flags in sequence (serialized by mutex)
        const [compiling, compressing, pending, paused, failure] = await Promise.all([
          client
            .callMethod('ApiRenderEngine', 'isCompiling', {})
            .catch(() => ({ result: 'unknown' })),
          client
            .callMethod('ApiRenderEngine', 'isCompressingTextures', {})
            .catch(() => ({ result: 'unknown' })),
          client
            .callMethod('ApiRenderEngine', 'hasPendingRenderData', {})
            .catch(() => ({ result: 'unknown' })),
          client
            .callMethod('ApiRenderEngine', 'isRenderingPaused', {})
            .catch(() => ({ result: 'unknown' })),
          client
            .callMethod('ApiRenderEngine', 'isRenderFailure', {})
            .catch(() => ({ result: 'unknown' })),
        ]);
        return jsonResult({
          is_compiling: compiling?.result ?? compiling,
          is_compressing_textures: compressing?.result ?? compressing,
          has_pending_render_data: pending?.result ?? pending,
          is_rendering_paused: paused?.result ?? paused,
          is_render_failure: failure?.result ?? failure,
        });
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );
}
