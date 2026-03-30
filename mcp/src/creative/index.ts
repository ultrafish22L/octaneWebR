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
        '[Phase 2] Camera must be positioned first (fit_camera). Get a computed lighting recipe from mood + scene bounds. ' +
        'Returns light positions, colors (Kelvin), power, key:fill:rim ratios. ' +
        'NEXT: You MUST build the lights — create emissive plane primitives at each recipe position, set blackbody temperature + power, emission efficiency = 1.0. ' +
        'See getPrompt("setup-lighting") for full steps. Moods: ethereal, dramatic, natural, studio, noir, golden_hour, moonlit.',
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
        '[Phase 2] Get PBR values for a surface type. Returns roughness, metallic, specular, IOR, albedo. ' +
        'NEXT: You MUST apply these values — use read_pin_value to get child handles, then set_attribute on each. ' +
        'If mesh has .mtl textures, do NOT override albedo — apply only roughness/metallic/specular/IOR. ' +
        'Call with surface_type:"list" to see all 30+ types.',
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
          'If mesh has .mtl textures: do NOT override albedo — apply ONLY roughness (pin 8), metallic (pin 4), specular (pin 6), IOR to the existing material. ' +
          'If untextured: create NT_MAT_UNIVERSAL with albedo RGB (pin 2), roughness (pin 8), metallic (pin 4), specular (pin 6). ' +
          'Emission: connect NT_EMIS_BLACKBODY to pin 44.',
        ...(artState ? adWorkflow(artState, 'suggest_material') : {}),
      });
    }
  );
}
