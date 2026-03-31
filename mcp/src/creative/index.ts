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
import { ArtDirectionState, adWorkflow } from '../ArtDirectionState';

const Vec3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() });

export function registerCreativeTools(
  server: McpServer,
  _client: OctaneMcpClient,
  artState?: ArtDirectionState
) {
  // ── suggest_lighting ────────────────────────────────────────────

  server.registerTool(
    'suggest_lighting',
    {
      title: 'Suggest Lighting',
      description:
        '[AD Phase 2] Get lighting recipe from mood + scene bounds. Returns positions, colors (K), power, ratios. ' +
        'PREFER setup_lighting() — creates lights automatically. See octane://docs/creative/1.',
      inputSchema: {
        mood: z
          .string()
          .describe(
            'Lighting mood: ethereal, dramatic, natural, studio, noir, golden_hour, moonlit'
          ),
        subject_bounds_min: Vec3Schema.describe('Min corner of subject bounding box'),
        subject_bounds_max: Vec3Schema.describe('Max corner of subject bounding box'),
        camera_position: Vec3Schema.optional().describe(
          'Camera position (for light angle computation)'
        ),
      },
      annotations: { idempotentHint: true },
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
          ...(artState ? adWorkflow(artState, 'suggest_lighting') : {}),
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  // ── suggest_material ────────────────────────────────────────────

  server.registerTool(
    'suggest_material',
    {
      title: 'Suggest Material',
      description:
        '[AD Phase 2] Get PBR values for a surface type. Returns roughness, metallic, specular, IOR, albedo. ' +
        'Apply via apply_material(). Skip albedo if mesh has .mtl textures. See octane://docs/reference/5.',
      inputSchema: {
        surface_type: z
          .string()
          .describe(
            'Surface type name (e.g., "moss", "gold", "mushroom_cap", "glass"). Call with "list" to see all types.'
          ),
      },
      annotations: { idempotentHint: true },
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
          'Apply with apply_material(material_handle, ...recipe values). ' +
          'If mesh has .mtl textures: pass skip_albedo:true. ' +
          'Emission: connect NT_EMIS_BLACKBODY to pin 44 separately.',
        ...(artState ? adWorkflow(artState, 'suggest_material') : {}),
      });
    }
  );
}
