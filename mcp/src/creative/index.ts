/**
 * Creative Tools — suggest_lighting, suggest_material
 *
 * Pure knowledge tools that return recipes (JSON specs).
 * The AI applies recipes step-by-step using existing MCP tools,
 * preserving DRESS protocol (render after each step).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient } from '../OctaneMcpClient';
import { jsonResult, errorResult } from '../tools/utils';
import { suggestLighting } from './lighting';
import { suggestMaterial, listMaterialTypes } from './materials';

const Vec3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() });

export function registerCreativeTools(server: McpServer, _client: OctaneMcpClient) {
  // ── suggest_lighting ────────────────────────────────────────────

  server.tool(
    'suggest_lighting',
    'Get a computed lighting recipe from mood + scene bounds. Returns light positions, colors, power, key:fill:rim ratios. Moods: ethereal, dramatic, natural, studio, noir, golden_hour, moonlit.',
    {
      mood: z
        .string()
        .describe('Lighting mood: ethereal, dramatic, natural, studio, noir, golden_hour, moonlit'),
      subject_bounds_min: Vec3Schema.describe('Min corner of subject bounding box'),
      subject_bounds_max: Vec3Schema.describe('Max corner of subject bounding box'),
      camera_position: Vec3Schema.optional().describe(
        'Camera position (for light angle computation)'
      ),
    },
    async params => {
      try {
        const recipe = suggestLighting(
          params.mood,
          { min: params.subject_bounds_min, max: params.subject_bounds_max },
          params.camera_position
        );
        return jsonResult({
          recipe,
          instruction:
            'Create emissive box primitives at each light position with the specified temperature and power. Set emission efficiency to 1.0 (Octane default is 0.025). Connect to geo group.',
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  // ── suggest_material ────────────────────────────────────────────

  server.tool(
    'suggest_material',
    'Get material attribute values for a surface type. Returns roughness, metallic, specular, IOR, albedo for NT_MAT_UNIVERSAL. 30+ types available.',
    {
      surface_type: z
        .string()
        .describe(
          'Surface type name (e.g., "moss", "gold", "mushroom_cap", "glass"). Call with "list" to see all types.'
        ),
    },
    async ({ surface_type }) => {
      if (surface_type === 'list') {
        return jsonResult({
          available_types: listMaterialTypes(),
          instruction:
            'Call suggest_material with any of these surface_type values to get the recipe.',
        });
      }

      const recipe = suggestMaterial(surface_type);
      if (!recipe) {
        return jsonResult({
          error: `Unknown surface type "${surface_type}".`,
          available_types: listMaterialTypes(),
          instruction: 'Pick from the available types above.',
        });
      }

      return jsonResult({
        recipe,
        instruction:
          'Create NT_MAT_UNIVERSAL and set attributes: albedo RGB on pin 2, roughness on pin 8, metallic on pin 4, specular on pin 6. For emission, connect NT_EMIS_BLACKBODY to pin 44.',
      });
    }
  );
}
