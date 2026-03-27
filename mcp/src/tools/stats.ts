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

  server.tool(
    'get_geometry_stats',
    'Get scene geometry statistics: triangle count, instance count, voxel count, hair segment count, Gaussian splat count, etc. Useful for understanding scene complexity.',
    {},
    async () => {
      try {
        const result = await client.callMethod('ApiRenderEngine', 'getGeometryStatistics', {});

        // Fix 4: Detect triCount drops — likely means geometry disconnected or mesh failed to load
        const stats = (result as any)?.stats ?? result;
        const currentTriCount = Number(stats?.triCount ?? 0);
        const response: Record<string, any> = { stats };

        // Only warn on meaningful drops (not after reset_project which goes to 0)
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
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'get_texture_stats',
    'Get VRAM breakdown by texture type (RGBA32, RGBA64, Y8, Y16, virtual textures, etc.). Shows how much GPU memory textures consume.',
    {},
    async () => {
      try {
        const result = await client.callMethod('ApiRenderEngine', 'getTexturesStatistics', {});
        return jsonResult(result);
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'get_resource_stats',
    'Get device resource breakdown: runtime, film, geometry, node system, images, compositor, denoiser memory usage. Specify device_index for multi-GPU setups.',
    {
      device_index: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .default(0)
        .describe('GPU device index (default 0)'),
    },
    async ({ device_index }) => {
      try {
        const result = await client.callMethod('ApiRenderEngine', 'getResourceStatistics', {
          deviceIx: device_index,
          memoryLocation: 0, // GPU memory
        });
        return jsonResult(result);
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'get_scene_bounds',
    'Get the world-space axis-aligned bounding box of the entire scene. Returns bboxMin and bboxMax as {x,y,z}. Essential for computing camera positions and object placement. Returns result=false if scene is empty.',
    {},
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

  server.tool(
    'get_render_state',
    'Get comprehensive render pipeline state: is compiling shaders, compressing textures, has pending data, is paused, has failure. Useful for troubleshooting render issues.',
    {},
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
