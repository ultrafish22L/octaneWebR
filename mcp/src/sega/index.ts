/**
 * SEGA Tools — Semantic Artistic Guidance for Octane MCP.
 *
 * 3 MCP tools:
 *   set_sega  — Set scene mood via preset, raw vector, or NL description
 *   get_sega  — Read current semantic state + resolved parameters
 *   adjust_sega — Fine-tune a single dimension
 *
 * These are pure knowledge tools — they compute parameter recipes.
 * The AI applies recipes step-by-step using existing MCP tools (DRESS protocol).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { jsonResult, errorResult } from '../tools/utils';
import { SemanticState } from './SemanticState';
import { getPreset, findPresetsByTag, listPresetNames } from './presets';
import { getDimension, findDimensionByAlias, listDimensions, DIMENSIONS } from './registry';
import { resolveFullState } from './MappingEngine';
import { buildNLParsePrompt, buildNLParseUserMessage, parseNLResponse } from './NLParser';
import {
  runCritique,
  buildVLMEstimationPrompt,
  parseVLMEstimation,
  computeGap,
  isGapStagnating,
} from './SemanticCritic';
import { analyzeImage } from './PixelAnalyzer';
import { PRESETS } from './presets';
import type { SemanticVector, SemanticPreset } from './types';

// Re-export public API for programmatic use
export { SemanticState } from './SemanticState';
export { resolveParameters, resolveFullState } from './MappingEngine';
export { getDimension, findDimensionByAlias, listDimensions, DIMENSIONS } from './registry';
export { getPreset, findPresetsByTag, listPresets, listPresetNames } from './presets';
export { buildNLParsePrompt, buildNLParseUserMessage, parseNLResponse } from './NLParser';
export type { NLParseResult } from './NLParser';
export { analyzeImage, measurementToVector } from './PixelAnalyzer';
export type { PixelMeasurement } from './PixelAnalyzer';
export {
  runCritique,
  computeGap,
  isGapStagnating,
  buildVLMEstimationPrompt,
  parseVLMEstimation,
} from './SemanticCritic';
export type { SemanticGap, SemanticCritiqueResult } from './SemanticCritic';
export type {
  SemanticVector,
  DimensionDefinition,
  SemanticPreset,
  ResolvedParameters,
  LearnedAdjustment,
  BerlyneWarning,
  SceneSemanticState,
} from './types';

import { ArtDirectionState, adWorkflow } from '../ArtDirectionState';

export function registerSegaTools(
  server: McpServer,
  segaState: SemanticState,
  artState?: ArtDirectionState
) {
  // ── set_sega ───────────────────────────────────────────

  server.registerTool(
    'set_sega',
    {
      title: 'Set SEGA Intent',
      description:
        '[AD Phase 0b / 2] Set SEGA (Semantic Artistic Guidance) intent via preset, vector, or natural language. ' +
        'Drives suggest_lighting/suggest_material values. Returns resolved parameters + Berlyne warnings. ' +
        'See octane://sega/presets for catalog.',
      inputSchema: {
        preset: z
          .string()
          .optional()
          .describe('Preset name (e.g. "dramatic", "vermeer"). Use "list" to see all.'),
        vector: z
          .record(z.string(), z.number().min(-1).max(1))
          .optional()
          .describe(
            'Raw semantic vector: { dimension: value }. Values in [-1, +1]. ' +
              'Dimensions: pleasure, arousal, dominance, warmth, contrast, complexity, ' +
              'atmosphere, surface_detail, saturation, shot_scale, camera_angle, ' +
              'depth_spread, key_direction, groundedness, intimacy.'
          ),
        natural_language: z
          .string()
          .optional()
          .describe(
            'Natural language description (e.g. "warm and moody", "Vermeer lighting", "make it more dramatic"). ' +
              'Returns an NL parse prompt — the AI parses it and calls back with the parsed vector.'
          ),
        mode: z
          .enum(['absolute', 'relative'])
          .optional()
          .default('absolute')
          .describe('absolute = replace vector, relative = add delta to current'),
        object_id: z
          .string()
          .optional()
          .describe('If set, applies as per-object override instead of global'),
      },
      annotations: { destructiveHint: true },
    },
    async params => {
      try {
        // List presets
        if (params.preset === 'list') {
          return jsonResult({
            presets: {
              mood: listPresetNames('mood'),
              artist: listPresetNames('artist'),
              film: listPresetNames('film'),
              genre: listPresetNames('genre'),
            },
            dimensions: listDimensions(),
            instruction:
              'Call set_sega with any preset name, or provide a raw vector with dimension values.',
          });
        }

        // Resolve input to a vector
        let targetVector: SemanticVector;

        if (params.preset) {
          // Try exact match first, then tag search
          const preset = getPreset(params.preset);
          if (!preset) {
            const tagged = findPresetsByTag(params.preset);
            if (tagged.length > 0) {
              return jsonResult({
                message: `No exact preset "${params.preset}". Did you mean one of these?`,
                matches: tagged.map(p => ({
                  name: p.name,
                  category: p.category,
                  description: p.description,
                })),
                instruction: 'Call set_sega with one of these preset names.',
              });
            }
            return jsonResult({
              error: `Unknown preset "${params.preset}".`,
              available: listPresetNames(),
              instruction: 'Pick from the available presets above.',
            });
          }
          targetVector = preset.vector;
        } else if (params.vector) {
          // Validate dimension names
          const unknowns = Object.keys(params.vector).filter(d => !getDimension(d));
          if (unknowns.length > 0) {
            return jsonResult({
              error: `Unknown dimensions: ${unknowns.join(', ')}`,
              available: listDimensions(),
              instruction: 'Use dimension names from the available list.',
            });
          }
          targetVector = params.vector;
        } else if (params.natural_language) {
          // Return NL parse prompt for the AI to answer
          // The AI reads this, parses the user's intent, then calls back with parsed vector
          const systemPrompt = buildNLParsePrompt();
          const userMessage = buildNLParseUserMessage(
            params.natural_language,
            segaState.getGlobal()
          );
          return jsonResult({
            nl_parse_request: true,
            system_prompt: systemPrompt,
            user_message: userMessage,
            current_vector: segaState.getGlobal(),
            instruction:
              'Parse the natural language using the system prompt and user message above. ' +
              'Extract dimension values as JSON: {"deltas":{...},"mode":"absolute"|"relative","confidence":0-1}. ' +
              'Then call set_sega again with the parsed vector.',
          });
        } else {
          return jsonResult({
            error: 'Provide preset, vector, or natural_language.',
            presets: listPresetNames(),
            dimensions: listDimensions(),
          });
        }

        // Apply to state
        if (params.object_id) {
          segaState.setOverride(params.object_id, targetVector);
        } else if (params.mode === 'relative') {
          segaState.applyDelta(targetVector);
        } else {
          segaState.setGlobal(targetVector);
        }

        // Resolve parameters
        const effective = segaState.getEffective(params.object_id);
        const resolved = resolveFullState(effective);
        const warnings = segaState.getWarnings();

        return jsonResult({
          vector: effective,
          resolved,
          warnings: warnings.length > 0 ? warnings : undefined,
          instruction:
            'Use the resolved lighting/material/camera values to set up your scene. ' +
            'Apply lighting values via suggest_lighting or directly create emissive boxes. ' +
            'Apply material values to NT_MAT_UNIVERSAL attributes. ' +
            'Apply camera values via set_camera.',
          ...(artState ? adWorkflow(artState, 'set_sega') : {}),
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  // ── get_sega ───────────────────────────────────────────

  server.registerTool(
    'get_sega',
    {
      title: 'Get SEGA Intent',
      description:
        'Read current SEGA intent: semantic vector, resolved parameters, ' +
        'active dimensions, per-object overrides, Berlyne warnings, and undo depth.',
      inputSchema: {
        object_id: z
          .string()
          .optional()
          .describe('Get effective vector for a specific object (global + override)'),
      },
      annotations: { readOnlyHint: true },
    },
    async params => {
      try {
        const summary = segaState.getSummary();
        const effective = segaState.getEffective(params.object_id);
        const resolved = resolveFullState(effective);

        return jsonResult({
          ...summary,
          effective: params.object_id
            ? { objectId: params.object_id, vector: effective }
            : undefined,
          resolved,
          instruction:
            'The resolved values show current lighting, material, and camera parameters ' +
            'derived from the semantic vector. Use adjust_sega to fine-tune.',
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  // ── adjust_sega ────────────────────────────────────────

  server.registerTool(
    'adjust_sega',
    {
      title: 'Adjust SEGA',
      description:
        '[AD Phase 2] Fine-tune a single SEGA dimension. Absolute (set to value) or relative (delta from current). ' +
        'Returns updated vector + resolved parameters + warnings.',
      inputSchema: {
        dimension: z
          .string()
          .describe(
            'Dimension name (e.g. "warmth", "contrast"). ' +
              'Available: pleasure, arousal, dominance, warmth, contrast, complexity, ' +
              'atmosphere, surface_detail, saturation, shot_scale, camera_angle, ' +
              'depth_spread, key_direction, groundedness, intimacy.'
          ),
        value: z.number().min(-1).max(1).describe('Target value or delta, in [-1, +1]'),
        mode: z
          .enum(['absolute', 'relative'])
          .optional()
          .default('relative')
          .describe('absolute = set dimension to value, relative = add value to current'),
        object_id: z.string().optional().describe('Apply as per-object override instead of global'),
        undo: z
          .boolean()
          .optional()
          .describe('If true, undo last change instead of applying new one'),
      },
      annotations: { destructiveHint: true },
    },
    async params => {
      try {
        // Undo
        if (params.undo) {
          const restored = segaState.undo();
          if (!restored) {
            return jsonResult({ message: 'Nothing to undo.' });
          }
          const resolved = resolveFullState(restored);
          return jsonResult({
            message: 'Undone. Restored previous vector.',
            vector: restored,
            resolved,
          });
        }

        // Validate dimension
        if (!getDimension(params.dimension)) {
          // Try alias lookup
          const found = findDimensionByAlias(params.dimension);
          if (found) {
            return jsonResult({
              error: `"${params.dimension}" is an alias for "${found.dimension.name}". Use the canonical name.`,
              dimension: found.dimension.name,
              polarity: found.polarity,
            });
          }
          return jsonResult({
            error: `Unknown dimension "${params.dimension}".`,
            available: listDimensions(),
          });
        }

        // Build delta
        const delta: SemanticVector = {};

        if (params.mode === 'absolute') {
          // For absolute, compute the delta needed
          const current = params.object_id
            ? segaState.getEffective(params.object_id)
            : segaState.getGlobal();
          const currentVal = current[params.dimension] ?? 0;
          delta[params.dimension] = params.value - currentVal;
        } else {
          delta[params.dimension] = params.value;
        }

        // Apply
        if (params.object_id) {
          const currentOverride = segaState.getOverride(params.object_id) || {};
          currentOverride[params.dimension] =
            (currentOverride[params.dimension] ?? 0) + delta[params.dimension];
          segaState.setOverride(params.object_id, currentOverride);
        } else {
          segaState.applyDelta(delta);
        }

        const effective = segaState.getEffective(params.object_id);
        const resolved = resolveFullState(effective);
        const warnings = segaState.getWarnings();

        return jsonResult({
          dimension: params.dimension,
          newValue: effective[params.dimension] ?? 0,
          vector: effective,
          resolved,
          warnings: warnings.length > 0 ? warnings : undefined,
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  // ── score_sega ─────────────────────────────────────────────

  server.registerTool(
    'score_sega',
    {
      title: 'Score SEGA',
      description:
        '[AD Phase 3] Score render against SEGA target. Returns gap vector + correction suggestions. Only useful after framing is correct.',
      inputSchema: {
        render_path: z.string().describe('Absolute path to the rendered image (PNG)'),
        vlm_measurements: z
          .record(z.string(), z.number().min(-1).max(1))
          .optional()
          .describe(
            'Optional VLM-estimated measurements for non-pixel dimensions ' +
              '(pleasure, arousal, dominance, complexity, etc.). ' +
              'Get the estimation prompt from get_vlm_estimation_prompt first.'
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async params => {
      try {
        const target = segaState.getGlobal();
        if (Object.keys(target).length === 0) {
          return jsonResult({
            error: 'No artistic intent set. Call set_sega first.',
          });
        }

        const result = runCritique(target, params.render_path, params.vlm_measurements);

        return jsonResult({
          target: result.target,
          measured: result.measured,
          gap: result.gap.gap,
          magnitude: result.gap.magnitude,
          converged: result.gap.converged,
          worstDimensions: result.gap.worstDimensions.slice(0, 5),
          corrections: result.corrections,
          pixelMeasurement: result.pixelMeasurement
            ? {
                contrast: result.pixelMeasurement.contrast,
                warmth: result.pixelMeasurement.warmth,
                saturation: result.pixelMeasurement.saturation,
                atmosphere: result.pixelMeasurement.atmosphere,
              }
            : null,
          warnings: result.warnings.length > 0 ? result.warnings : undefined,
          summary: result.summary,
          instruction: result.gap.converged
            ? 'Scene matches target intent. No further adjustments needed.'
            : 'Apply the corrections via adjust_sega, then re-render and critique again.',
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  // ── get_vlm_estimation_prompt ─────────────────────────────────────

  server.registerTool(
    'get_vlm_estimation_prompt',
    {
      title: 'VLM Estimation Prompt',
      description:
        'Get a prompt for VLM to estimate perceptual semantic dimensions from a render. Call describe_tool("get_vlm_estimation_prompt") for usage.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const target = segaState.getGlobal();
        const targetDims = Object.keys(target);

        if (targetDims.length === 0) {
          return jsonResult({
            error: 'No artistic intent set. Call set_sega first.',
          });
        }

        const prompt = buildVLMEstimationPrompt(targetDims);

        if (!prompt) {
          return jsonResult({
            message: 'All active dimensions are pixel-measurable. No VLM estimation needed.',
            pixelDimensions: ['contrast', 'warmth', 'saturation', 'atmosphere'],
          });
        }

        return jsonResult({
          vlm_prompt: prompt,
          target_dimensions: targetDims,
          pixel_dimensions: ['contrast', 'warmth', 'saturation', 'atmosphere'],
          vlm_dimensions: targetDims.filter(
            d => !['contrast', 'warmth', 'saturation', 'atmosphere'].includes(d)
          ),
          instruction:
            'Send this prompt along with the render image to a vision model. ' +
            'Parse the response and pass the measurements to score_sega as vlm_measurements.',
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  // ── save_user_preset ──────────────────────────────────────────────

  server.registerTool(
    'save_sega_preset',
    {
      title: 'Save SEGA Preset',
      description:
        'Save current SEGA vector as named preset (session only). Call describe_tool("save_sega_preset") for params.',
      inputSchema: {
        name: z.string(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
      },
      annotations: { destructiveHint: true },
    },
    async params => {
      try {
        const vector = segaState.getGlobal();
        if (Object.keys(vector).length === 0) {
          return jsonResult({
            error: 'No artistic intent set. Set one first, then save as preset.',
          });
        }

        // Check for name collision with built-in presets
        const existing = getPreset(params.name);
        if (existing && existing.source !== 'user-created') {
          return jsonResult({
            error: `"${params.name}" is a built-in preset. Choose a different name.`,
          });
        }

        const preset: SemanticPreset = {
          name: params.name.toLowerCase(),
          category: 'user',
          description: params.description || `User preset: ${params.name}`,
          vector: { ...vector },
          tags: params.tags || [params.name],
          source: 'user-created',
        };

        // Add to runtime presets array (session-only, not persisted)
        // Remove existing user preset with same name
        const idx = PRESETS.findIndex(p => p.name === preset.name && p.source === 'user-created');
        if (idx >= 0) {
          PRESETS[idx] = preset;
        } else {
          PRESETS.push(preset);
        }

        return jsonResult({
          saved: preset.name,
          vector,
          category: 'user',
          totalPresets: PRESETS.length,
          instruction: `Preset "${preset.name}" saved. Use set_sega with preset:"${preset.name}" to load it.`,
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
