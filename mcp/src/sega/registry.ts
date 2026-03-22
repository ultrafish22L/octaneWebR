/**
 * SEGA Dimension Registry — 15 seed dimensions with parameter mappings.
 *
 * Each dimension maps [-1, +1] to concrete Octane parameter ranges.
 * Ranges come from industry standards (ASC Manual, CineTechBench, Itten).
 * All mappings start at confidence 0.7 — future learning engine refines.
 *
 * Design: data-only module, no side effects. Pure lookups.
 */

import type { DimensionDefinition } from './types';

// ── Seed Dimensions ─────────────────────────────────────────────────

export const DIMENSIONS: DimensionDefinition[] = [
  // ── PAD (Psychology) ──────────────────────────────────────────────
  {
    name: 'pleasure',
    aliases: ['beautiful', 'pleasant', 'pleasing', 'pretty', 'lovely', 'attractive', 'appealing'],
    negativeAliases: ['harsh', 'ugly', 'unpleasant', 'jarring', 'gritty', 'raw'],
    source: 'pad',
    description: 'Aesthetic pleasure — how appealing the visual result feels',
    negativeLabel: 'harsh',
    positiveLabel: 'beautiful',
    parameterMappings: [
      {
        parameter: 'albedo_saturation',
        range: [0.3, 0.8],
        weight: 0.5,
        scope: 'global',
        confidence: 0.7,
        source: 'industry',
      },
      {
        parameter: 'roughness_base',
        range: [0.8, 0.3],
        weight: 0.4,
        scope: 'hero',
        confidence: 0.7,
        source: 'industry',
      },
      {
        parameter: 'env_power',
        range: [0.2, 0.8],
        weight: 0.3,
        scope: 'environment',
        confidence: 0.7,
        source: 'industry',
      },
    ],
    correlations: [
      { dimension: 'warmth', coefficient: 0.4, note: 'Warm scenes generally feel more pleasant' },
      {
        dimension: 'saturation',
        coefficient: 0.3,
        note: 'Moderate saturation correlates with pleasure',
      },
    ],
  },
  {
    name: 'arousal',
    aliases: ['energized', 'intense', 'dynamic', 'exciting', 'vibrant', 'powerful'],
    negativeAliases: ['calm', 'serene', 'peaceful', 'tranquil', 'quiet', 'still', 'relaxed'],
    source: 'pad',
    description: 'Energy level — from calm serenity to intense excitement',
    negativeLabel: 'calm',
    positiveLabel: 'intense',
    parameterMappings: [
      {
        parameter: 'key_fill_ratio',
        range: [1.5, 6],
        weight: 0.6,
        scope: 'light',
        confidence: 0.7,
        source: 'industry',
      },
      {
        parameter: 'albedo_saturation',
        range: [0.4, 0.9],
        weight: 0.4,
        scope: 'global',
        confidence: 0.7,
        source: 'industry',
      },
      {
        parameter: 'key_light_temperature',
        range: [5500, 4000],
        weight: 0.2,
        scope: 'light',
        confidence: 0.6,
        source: 'industry',
      },
    ],
    correlations: [
      {
        dimension: 'contrast',
        coefficient: 0.5,
        note: 'High arousal typically needs higher contrast',
      },
    ],
  },
  {
    name: 'dominance',
    aliases: ['vast', 'powerful', 'grand', 'epic', 'monumental', 'imposing', 'commanding'],
    negativeAliases: ['intimate', 'enclosed', 'small', 'sheltered', 'contained'],
    source: 'pad',
    description: 'Scale of power — from intimate enclosure to vast grandeur',
    negativeLabel: 'intimate',
    positiveLabel: 'vast',
    parameterMappings: [
      {
        parameter: 'camera_distance_multiplier',
        range: [0.5, 3.0],
        weight: 0.8,
        scope: 'global',
        confidence: 0.7,
        source: 'industry',
      },
      {
        parameter: 'fov_horizontal',
        range: [35, 110],
        weight: 0.6,
        scope: 'global',
        confidence: 0.7,
        source: 'industry',
      },
      {
        parameter: 'env_power',
        range: [0.3, 0.8],
        weight: 0.3,
        scope: 'environment',
        confidence: 0.6,
        source: 'industry',
      },
    ],
    correlations: [
      {
        dimension: 'shot_scale',
        coefficient: 0.7,
        note: 'Dominance and shot scale strongly co-vary',
      },
      {
        dimension: 'intimacy',
        coefficient: -0.8,
        note: 'Dominance is inversely related to intimacy',
      },
    ],
  },

  // ── Itten Color Theory ────────────────────────────────────────────
  {
    name: 'warmth',
    aliases: ['warm', 'cozy', 'golden', 'amber', 'sunset', 'candlelit', 'fire'],
    negativeAliases: ['cool', 'cold', 'icy', 'clinical', 'blue', 'moonlight', 'sterile'],
    source: 'itten',
    description: 'Color temperature tendency — cool blues to warm ambers',
    negativeLabel: 'cool',
    positiveLabel: 'warm',
    parameterMappings: [
      {
        parameter: 'key_light_temperature',
        range: [7500, 2800],
        weight: 0.8,
        scope: 'light',
        confidence: 0.8,
        source: 'industry',
      },
      {
        parameter: 'env_tint_warmth',
        range: [0.0, 1.0],
        weight: 0.5,
        scope: 'environment',
        confidence: 0.7,
        source: 'industry',
      },
      {
        parameter: 'fill_light_temperature',
        range: [6500, 3500],
        weight: 0.5,
        scope: 'light',
        confidence: 0.7,
        source: 'industry',
      },
    ],
    correlations: [
      { dimension: 'pleasure', coefficient: 0.4, note: 'Warm light generally feels more pleasant' },
    ],
  },
  {
    name: 'saturation',
    aliases: ['vivid', 'punchy', 'colorful', 'rich', 'saturated', 'bold'],
    negativeAliases: ['muted', 'desaturated', 'pastel', 'washed', 'faded', 'dull', 'monochrome'],
    source: 'itten',
    description: 'Color intensity — from muted/washed to vivid/punchy',
    negativeLabel: 'muted',
    positiveLabel: 'vivid',
    parameterMappings: [
      {
        parameter: 'albedo_saturation',
        range: [0.15, 1.0],
        weight: 0.9,
        scope: 'global',
        confidence: 0.8,
        source: 'industry',
      },
      {
        parameter: 'env_saturation',
        range: [0.2, 1.0],
        weight: 0.5,
        scope: 'environment',
        confidence: 0.7,
        source: 'industry',
      },
    ],
    correlations: [
      {
        dimension: 'pleasure',
        coefficient: 0.3,
        note: 'Moderate saturation correlates with pleasure',
      },
    ],
  },

  // ── ASC Manual ────────────────────────────────────────────────────
  {
    name: 'contrast',
    aliases: ['dramatic', 'contrasty', 'hard', 'chiaroscuro', 'shadowy', 'moody'],
    negativeAliases: ['flat', 'even', 'soft', 'diffused', 'low-contrast', 'ambient'],
    source: 'asc',
    description: 'Light contrast — from flat even lighting to hard dramatic shadows',
    negativeLabel: 'flat',
    positiveLabel: 'hard shadows',
    parameterMappings: [
      {
        parameter: 'key_fill_ratio',
        range: [1, 8],
        weight: 0.9,
        scope: 'light',
        confidence: 0.8,
        source: 'industry',
      },
      {
        parameter: 'env_power',
        range: [0.8, 0.05],
        weight: 0.6,
        scope: 'environment',
        confidence: 0.7,
        source: 'industry',
      },
      {
        parameter: 'fill_power',
        range: [10, 2],
        weight: 0.5,
        scope: 'light',
        confidence: 0.7,
        source: 'industry',
      },
    ],
    correlations: [
      { dimension: 'arousal', coefficient: 0.5, note: 'Contrast and arousal often co-vary' },
      {
        dimension: 'atmosphere',
        coefficient: -0.3,
        note: 'Heavy atmosphere reduces perceived contrast',
      },
    ],
  },
  {
    name: 'key_direction',
    aliases: ['backlit', 'rim-lit', 'rimlight', 'silhouette', 'contre-jour'],
    negativeAliases: ['front-lit', 'frontal', 'flat-lit', 'head-on'],
    source: 'asc',
    description: 'Key light placement — from frontal to rim/backlight',
    negativeLabel: 'front-lit',
    positiveLabel: 'back/rim-lit',
    parameterMappings: [
      {
        parameter: 'key_azimuth',
        range: [0, 180],
        weight: 0.9,
        scope: 'light',
        confidence: 0.8,
        source: 'industry',
      },
      {
        parameter: 'rim_power',
        range: [0, 20],
        weight: 0.6,
        scope: 'light',
        confidence: 0.7,
        source: 'industry',
      },
    ],
    correlations: [
      {
        dimension: 'contrast',
        coefficient: 0.3,
        note: 'Backlighting tends to increase perceived contrast',
      },
    ],
  },

  // ── Berlyne Aesthetics ────────────────────────────────────────────
  {
    name: 'complexity',
    aliases: ['dense', 'detailed', 'intricate', 'layered', 'busy', 'ornate'],
    negativeAliases: ['minimal', 'clean', 'simple', 'sparse', 'bare', 'empty'],
    source: 'berlyne',
    description: 'Visual density — from clean minimalism to dense detail',
    negativeLabel: 'minimal',
    positiveLabel: 'dense',
    parameterMappings: [
      {
        parameter: 'texture_detail',
        range: [0.2, 1.0],
        weight: 0.7,
        scope: 'global',
        confidence: 0.6,
        source: 'industry',
      },
      {
        parameter: 'object_count_hint',
        range: [1, 12],
        weight: 0.5,
        scope: 'global',
        confidence: 0.5,
        source: 'industry',
      },
    ],
    correlations: [
      {
        dimension: 'arousal',
        coefficient: 0.3,
        note: 'Dense scenes tend to feel more energized',
      },
    ],
  },

  // ── CG Craft ──────────────────────────────────────────────────────
  {
    name: 'atmosphere',
    aliases: ['hazy', 'foggy', 'misty', 'smoky', 'diffused', 'atmospheric', 'dreamy'],
    negativeAliases: ['clear', 'crisp', 'sharp', 'clean-air', 'transparent'],
    source: 'craft',
    description: 'Atmospheric density — from crystal clear to heavy fog',
    negativeLabel: 'clear',
    positiveLabel: 'hazy',
    parameterMappings: [
      {
        parameter: 'fog_density',
        range: [0, 0.5],
        weight: 0.9,
        scope: 'environment',
        confidence: 0.7,
        source: 'industry',
      },
      {
        parameter: 'scatter_amount',
        range: [0, 0.8],
        weight: 0.6,
        scope: 'environment',
        confidence: 0.6,
        source: 'industry',
      },
    ],
    correlations: [
      {
        dimension: 'contrast',
        coefficient: -0.3,
        note: 'Atmosphere reduces perceived contrast',
      },
      { dimension: 'intimacy', coefficient: 0.2, note: 'Fog can increase sense of closeness' },
    ],
  },
  {
    name: 'surface_detail',
    aliases: ['weathered', 'textured', 'rough', 'worn', 'aged', 'patina', 'bumpy'],
    negativeAliases: ['smooth', 'pristine', 'polished', 'clean', 'new', 'glossy', 'flawless'],
    source: 'craft',
    description: 'Surface quality — from pristine smooth to weathered/textured',
    negativeLabel: 'smooth',
    positiveLabel: 'weathered',
    parameterMappings: [
      {
        parameter: 'roughness_base',
        range: [0.1, 0.9],
        weight: 0.8,
        scope: 'hero',
        confidence: 0.8,
        source: 'industry',
      },
      {
        parameter: 'bump_strength',
        range: [0, 1.0],
        weight: 0.7,
        scope: 'hero',
        confidence: 0.6,
        source: 'industry',
      },
    ],
    correlations: [
      {
        dimension: 'pleasure',
        coefficient: -0.2,
        note: 'Heavy weathering can reduce surface beauty',
      },
    ],
  },
  {
    name: 'depth_spread',
    aliases: ['layered', 'deep', 'receding', 'spatial', 'three-dimensional'],
    negativeAliases: ['flat', 'compressed', 'shallow', 'two-dimensional', 'stacked'],
    source: 'craft',
    description: 'Depth layering — from flat/compressed to deep/layered spatial arrangement',
    negativeLabel: 'flat',
    positiveLabel: 'deep layered',
    parameterMappings: [
      {
        parameter: 'depth_layer_separation',
        range: [0.5, 4.0],
        weight: 0.8,
        scope: 'global',
        confidence: 0.7,
        source: 'industry',
      },
      {
        parameter: 'fog_density',
        range: [0, 0.15],
        weight: 0.3,
        scope: 'environment',
        confidence: 0.5,
        source: 'industry',
      },
    ],
    correlations: [
      {
        dimension: 'dominance',
        coefficient: 0.3,
        note: 'Deep layering implies larger perceived space',
      },
    ],
  },
  {
    name: 'groundedness',
    aliases: ['grounded', 'physical', 'solid', 'real', 'heavy', 'earthbound'],
    negativeAliases: ['floating', 'abstract', 'weightless', 'ethereal', 'suspended'],
    source: 'craft',
    description: 'Physical grounding — from floating/abstract to firmly planted',
    negativeLabel: 'floating',
    positiveLabel: 'grounded',
    parameterMappings: [
      {
        parameter: 'contact_shadow_strength',
        range: [0, 1.0],
        weight: 0.8,
        scope: 'global',
        confidence: 0.7,
        source: 'industry',
      },
      {
        parameter: 'floor_roughness',
        range: [0.3, 0.9],
        weight: 0.5,
        scope: 'environment',
        confidence: 0.6,
        source: 'industry',
      },
    ],
    correlations: [],
  },

  // ── CineTechBench ─────────────────────────────────────────────────
  {
    name: 'shot_scale',
    aliases: ['wide', 'establishing', 'panoramic', 'full-shot', 'long-shot'],
    negativeAliases: ['close-up', 'closeup', 'tight', 'macro', 'detail', 'extreme-close'],
    source: 'cinetech',
    description: 'Camera framing scale — from extreme close-up to extreme wide',
    negativeLabel: 'close-up',
    positiveLabel: 'wide',
    parameterMappings: [
      {
        parameter: 'camera_distance_multiplier',
        range: [0.3, 4.0],
        weight: 0.9,
        scope: 'global',
        confidence: 0.8,
        source: 'industry',
      },
      {
        parameter: 'fov_horizontal',
        range: [24, 120],
        weight: 0.5,
        scope: 'global',
        confidence: 0.7,
        source: 'industry',
      },
    ],
    correlations: [
      {
        dimension: 'dominance',
        coefficient: 0.7,
        note: 'Wide shots convey grandeur',
      },
      {
        dimension: 'intimacy',
        coefficient: -0.8,
        note: 'Wide and intimate are near-opposites',
      },
    ],
  },
  {
    name: 'camera_angle',
    aliases: ['high-angle', 'birds-eye', 'overhead', 'top-down', 'aerial'],
    negativeAliases: ['low-angle', 'worms-eye', 'ground-level', 'upward', 'heroic'],
    source: 'cinetech',
    description: 'Camera elevation — from low worm-eye to high bird-eye',
    negativeLabel: 'low angle',
    positiveLabel: 'high angle',
    parameterMappings: [
      {
        parameter: 'camera_elevation',
        range: [-30, 60],
        weight: 0.9,
        scope: 'global',
        confidence: 0.8,
        source: 'industry',
      },
    ],
    correlations: [
      {
        dimension: 'dominance',
        coefficient: -0.3,
        note: 'Low angles make subjects feel more powerful',
      },
    ],
  },

  // ── PAD / CineTech hybrid ─────────────────────────────────────────
  {
    name: 'intimacy',
    aliases: ['close', 'personal', 'near', 'private', 'tender', 'delicate'],
    negativeAliases: ['distant', 'observational', 'detached', 'remote', 'impersonal'],
    source: 'pad',
    description: 'Emotional distance — from detached observation to close personal connection',
    negativeLabel: 'distant',
    positiveLabel: 'close',
    parameterMappings: [
      {
        parameter: 'camera_distance_multiplier',
        range: [3.0, 0.4],
        weight: 0.7,
        scope: 'global',
        confidence: 0.7,
        source: 'industry',
      },
      {
        parameter: 'aperture',
        range: [0, 1.2],
        weight: 0.5,
        scope: 'global',
        confidence: 0.6,
        source: 'industry',
      },
      {
        parameter: 'fov_horizontal',
        range: [90, 40],
        weight: 0.4,
        scope: 'global',
        confidence: 0.6,
        source: 'industry',
      },
    ],
    correlations: [
      {
        dimension: 'dominance',
        coefficient: -0.8,
        note: 'Intimacy is inversely related to grandeur',
      },
      {
        dimension: 'shot_scale',
        coefficient: -0.8,
        note: 'Close shots feel intimate',
      },
    ],
  },
];

// ── Lookup Helpers ──────────────────────────────────────────────────

/** Get a dimension by canonical name. */
export function getDimension(name: string): DimensionDefinition | undefined {
  return DIMENSIONS.find(d => d.name === name);
}

/** Find a dimension by any alias (positive or negative). Returns the dimension and polarity. */
export function findDimensionByAlias(
  word: string
): { dimension: DimensionDefinition; polarity: 1 | -1 } | undefined {
  const lower = word.toLowerCase();
  for (const dim of DIMENSIONS) {
    if (dim.name === lower) return { dimension: dim, polarity: 1 };
    if (dim.aliases.some(a => a.toLowerCase() === lower)) return { dimension: dim, polarity: 1 };
    if (dim.negativeAliases.some(a => a.toLowerCase() === lower))
      return { dimension: dim, polarity: -1 };
  }
  return undefined;
}

/** List all dimension names. */
export function listDimensions(): string[] {
  return DIMENSIONS.map(d => d.name);
}
