/**
 * Render Tools — start_render, stop_render, restart_render, get_render_status, save_render
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient } from '../OctaneMcpClient';
import { jsonResult, errorResult, OBJ_API_NODE } from './utils';

// Maps format name to Octane's imageSaveFormat enum
const FORMAT_MAP: Record<string, number> = {
  PNG: 0,
  PNG16: 1,
  EXR: 2,
  EXR_TONEMAP: 3,
  HDR: 10,
  TGA: 4,
  TIFF: 11,
  TIFF16: 12,
  JPG: 13,
};

export function registerRenderTools(server: McpServer, client: OctaneMcpClient) {
  server.tool(
    'start_render',
    'Start or continue rendering the current scene',
    {
      render_target_handle: z
        .number()
        .optional()
        .describe('Handle of the RenderTarget node to select for rendering'),
    },
    async ({ render_target_handle }) => {
      try {
        if (render_target_handle) {
          await client.callMethod('ApiRenderEngine', 'setRenderTargetNode', {
            targetNode: { handle: String(render_target_handle), type: OBJ_API_NODE },
          });
        }
        await client.callMethod('ApiRenderEngine', 'continueRendering', {});
        return jsonResult({ success: true });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool('stop_render', 'Stop the current render', {}, async () => {
    try {
      await client.callMethod('ApiRenderEngine', 'stopRendering', {});
      return jsonResult({ success: true });
    } catch (error: any) {
      return errorResult(error);
    }
  });

  server.tool(
    'restart_render',
    'DEPRECATED — DO NOT USE. Causes Octane crashes (ECONNRESET). Use start_render once; Octane stays in render mode and picks up all changes live.',
    {},
    async () => {
      return jsonResult({
        success: false,
        message:
          'restart_render is deprecated — it crashes Octane. ' +
          'start_render keeps render mode active. All changes (connect, set_attribute) are picked up automatically.',
      });
    }
  );

  server.tool(
    'get_render_status',
    'Get current render statistics including sample count, render time, and progress',
    {},
    async () => {
      try {
        const result = await client.callMethod('ApiRenderEngine', 'getRenderStatistics', {});
        // Extract only useful stats — drop huge repeated RENDER_PASS arrays
        const s = result?.statistics ?? result;
        return jsonResult({
          resolution: s?.setSize ? `${s.setSize.x}x${s.setSize.y}` : undefined,
          samples: s?.beautySamplesPerPixel ?? 0,
          maxSamples: s?.beautyMaxSamplesPerPixel ?? 0,
          renderTime: s?.renderTime ?? 0,
          state: s?.state ?? 'unknown',
          samplesPerSecond: s?.beautySamplesPerSecond ?? 0,
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'save_render',
    'Save the current render result to an image file on disk',
    {
      path: z.string().describe('Absolute file path to save to (e.g. C:\\renders\\scene.png)'),
      format: z
        .enum(['PNG', 'PNG16', 'EXR', 'EXR_TONEMAP', 'HDR', 'TGA', 'TIFF', 'TIFF16', 'JPG'])
        .default('PNG')
        .describe('Image format'),
      render_pass_id: z.number().default(0).describe('Render pass ID (0 = beauty pass)'),
    },
    async ({ path, format, render_pass_id }) => {
      try {
        const imageSaveFormat = FORMAT_MAP[format] ?? 0;
        await client.callMethod('ApiRenderEngine', 'saveImage1', {
          renderPassId: render_pass_id,
          fullPath: path,
          imageSaveFormat,
          colorSpace: 1,
          premultipliedAlphaType: 0,
          exrCompressionType: 4,
          exrCompressionLevel: 4.5,
          asynchronous: false,
        });
        return jsonResult({ success: true, path, format });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
