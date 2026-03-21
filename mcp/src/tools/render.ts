/**
 * Render Tools — start_render, stop_render, restart_render, get_render_status, save_render
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import path from 'path';
import { OctaneMcpClient } from '../OctaneMcpClient';
import { jsonResult, errorResult, validateFilePath, OBJ_API_NODE } from './utils';

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
    'Start rendering. Does NOT evaluate the scene — must trigger eval first (connect with evaluate:true, set_attribute, or update_scene). Ensure RT has: camera (pin 0), geometry (pin 3), kernel (pin 6). If render is all white, check connections. If blurry, disable DOF (aperture→0).',
    {
      render_target_handle: z
        .number()
        .int()
        .nonnegative()
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

  // restart_render removed — it crashes Octane (ECONNRESET). Use start_render instead.

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
    'Save current render to disk. Path must be absolute with existing parent directory. Formats: PNG (default), PNG16, EXR, EXR_TONEMAP, HDR, TGA, TIFF, TIFF16, JPG.',
    {
      path: z.string().describe('Absolute file path to save to (e.g. C:\\renders\\scene.png)'),
      format: z
        .enum(['PNG', 'PNG16', 'EXR', 'EXR_TONEMAP', 'HDR', 'TGA', 'TIFF', 'TIFF16', 'JPG'])
        .default('PNG')
        .describe('Image format'),
      render_pass_id: z.number().default(0).describe('Render pass ID (0 = beauty pass)'),
    },
    async ({ path: savePath, format, render_pass_id }) => {
      try {
        const pathError = validateFilePath(savePath);
        if (pathError) return errorResult(new Error(pathError));

        // Validate parent directory exists
        const fs = await import('fs');
        const parentDir = path.dirname(savePath);
        if (!fs.existsSync(parentDir)) {
          return errorResult(new Error(`Parent directory does not exist: ${parentDir}`));
        }

        const imageSaveFormat = FORMAT_MAP[format] ?? 0;
        await client.callMethod('ApiRenderEngine', 'saveImage1', {
          renderPassId: render_pass_id,
          fullPath: savePath,
          imageSaveFormat,
          colorSpace: 1,
          premultipliedAlphaType: 0,
          exrCompressionType: 4,
          exrCompressionLevel: 4.5,
          asynchronous: false,
        });
        return jsonResult({ success: true, path: savePath, format });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  // ── Pick Point ───────────────────────────────────────────────────

  server.tool(
    'pick_point',
    'Ray-cast a pixel in the rendered image to get world position, normal, node handle, material pin, and primitive type. Requires an active render. Pixel (0,0) is top-left.',
    {
      x: z.number().int().nonnegative().describe('Pixel X coordinate'),
      y: z.number().int().nonnegative().describe('Pixel Y coordinate'),
      max_intersections: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .default(1)
        .describe('Max intersections to return (default 1)'),
    },
    async ({ x, y, max_intersections }) => {
      try {
        const result = await client.callMethod('ApiRenderEngine', 'pick', {
          x,
          y,
          filterDuplicateMaterialPins: true,
          intersectionsSize: max_intersections,
        });
        const count = result?.result ?? 0;
        if (count === 0) {
          return jsonResult({
            hit_count: 0,
            message: 'Ray missed all geometry at this pixel.',
          });
        }
        return jsonResult({
          hit_count: count,
          intersections: result?.intersections ?? [],
        });
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );

  // ── Render Passes ────────────────────────────────────────────────

  server.tool(
    'get_enabled_aovs',
    'Get the list of enabled AOV/render pass IDs on the current render target. Common IDs: 0=beauty, 3=diffuse, 7=reflection, 1000=geometric_normal, 1002=position, 1003=z_depth.',
    {
      render_target_handle: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe('RT handle (uses current RT if omitted)'),
    },
    async ({ render_target_handle }) => {
      try {
        const params: Record<string, unknown> = {};
        if (render_target_handle) {
          params.renderTargetNode = { handle: String(render_target_handle), type: OBJ_API_NODE };
        }
        const result = await client.callMethod('ApiRenderEngine', 'getEnabledAovs', params);
        return jsonResult(result);
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'save_render_passes',
    'Save all enabled render passes to a directory. Each pass is saved as a separate file. Use get_enabled_aovs first to see which passes are active.',
    {
      output_directory: z.string().describe('Absolute path to output directory'),
      format: z
        .enum(['PNG', 'PNG16', 'EXR', 'EXR_TONEMAP', 'HDR', 'TGA', 'TIFF', 'TIFF16', 'JPG'])
        .default('EXR')
        .describe('Image format (default EXR for passes)'),
      use_half: z
        .boolean()
        .optional()
        .default(true)
        .describe('Use half-float precision for EXR (default true)'),
    },
    async ({ output_directory, format, use_half }) => {
      try {
        const pathError = validateFilePath(output_directory);
        if (pathError) return errorResult(new Error(pathError));

        const fs = await import('fs');
        if (!fs.existsSync(output_directory)) {
          return errorResult(new Error(`Output directory does not exist: ${output_directory}`));
        }

        const imageSaveFormat = FORMAT_MAP[format] ?? 2; // default EXR
        // Use saveRenderPasses1 (simpler overload with NamedColorSpace enum)
        await client.callMethod('ApiRenderEngine', 'saveRenderPasses1', {
          outputDirectory: output_directory,
          passesToExport: { renderPassId: 0, exportName: '' },
          passesToExportLength: 0,
          imageSaveFormat,
          colorSpace: 0, // NAMED_COLOR_SPACE_LINEAR_SRGB
          premultipliedAlphaType: 0,
          exrCompressionType: 0,
          useHalf: use_half,
          metadata: { values: [] },
          metadataLength: 0,
          asynchronous: false,
        });
        return jsonResult({ success: true, output_directory, format });
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'save_render_passes_exr',
    'Save all enabled render passes as a single multi-layer EXR file. Production standard output for compositing.',
    {
      path: z
        .string()
        .describe(
          'Absolute file path for the multi-layer EXR (e.g. C:\\renders\\scene_passes.exr)'
        ),
      use_half: z
        .boolean()
        .optional()
        .default(true)
        .describe('Use half-float precision (default true)'),
      preserve_layer_names: z
        .boolean()
        .optional()
        .default(true)
        .describe('Preserve layer names in EXR (default true)'),
      premultiply_alpha: z
        .boolean()
        .optional()
        .default(false)
        .describe('Premultiply alpha (default false)'),
    },
    async ({ path: savePath, use_half, preserve_layer_names, premultiply_alpha }) => {
      try {
        const pathError = validateFilePath(savePath);
        if (pathError) return errorResult(new Error(pathError));

        const fs = await import('fs');
        const parentDir = path.dirname(savePath);
        if (!fs.existsSync(parentDir)) {
          return errorResult(new Error(`Parent directory does not exist: ${parentDir}`));
        }

        // Use saveRenderPassesMultiExr1 (simpler overload with NamedColorSpace enum)
        await client.callMethod('ApiRenderEngine', 'saveRenderPassesMultiExr1', {
          fullPath: savePath,
          passesToExport: { renderPassId: 0, exportName: '' },
          passesToExportLength: 0,
          useHalf: use_half,
          colorSpace: 0, // NAMED_COLOR_SPACE_LINEAR_SRGB
          premultipliedAlpha: premultiply_alpha,
          preserveLayerNames: preserve_layer_names,
          metadata: { values: [] },
          metadataLength: 0,
          asynchronous: false,
        });
        return jsonResult({ success: true, path: savePath });
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );

  // ── Tier 2B: Render Pass Viewport ─────────────────────────────────

  server.tool(
    'get_display_pass',
    'Get the render pass currently displayed in the viewport. Returns the RenderPassId (0=beauty, 3=diffuse, 7=reflection, 1000=geometric_normal, 1002=position, 1003=z_depth).',
    {},
    async () => {
      try {
        const result = await client.callMethod('ApiRenderEngine', 'displayRenderPassId', {});
        return jsonResult({ render_pass_id: result?.result ?? result });
      } catch (error: unknown) {
        return errorResult(error);
      }
    }
  );
}
