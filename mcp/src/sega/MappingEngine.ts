/**
 * MappingEngine — resolves semantic vectors into concrete DCC parameters.
 *
 * Algorithm: weighted linear interpolation across all active dimensions.
 * When multiple dimensions affect the same parameter, weights determine
 * relative influence.
 *
 * Formula per parameter:
 *   midpoint = (range[0] + range[1]) / 2
 *   contribution = dimValue * weight * (range[1] - range[0]) / 2
 *   final = clamp(midpoint + sum(contributions), physicalMin, physicalMax)
 *
 * Also provides bridge functions to convert resolved parameters into
 * existing LightingRecipe / MaterialRecipe interfaces for DRESS compatibility.
 */

import type {
  SemanticVector,
  ResolvedParameters,
  ResolvedParameter,
  ParameterContribution,
  DimensionDefinition,
  MappingScope,
} from './types';
import { DIMENSIONS } from './registry';

// ── Physical Limits ─────────────────────────────────────────────────
// Parameters can't go outside their physical valid range.

const PHYSICAL_LIMITS: Record<string, [number, number]> = {
  key_light_temperature: [1800, 12000],
  fill_light_temperature: [1800, 12000],
  key_fill_ratio: [1, 16],
  key_azimuth: [0, 360],
  env_power: [0.01, 2.0],
  env_tint_warmth: [0, 1],
  env_saturation: [0, 1],
  fill_power: [0, 30],
  rim_power: [0, 30],
  fog_density: [0, 1],
  scatter_amount: [0, 1],
  roughness_base: [0, 1],
  bump_strength: [0, 2],
  albedo_saturation: [0, 1],
  camera_distance_multiplier: [0.1, 10],
  fov_horizontal: [10, 170],
  camera_elevation: [-90, 90],
  aperture: [0, 5],
  contact_shadow_strength: [0, 1],
  floor_roughness: [0, 1],
  texture_detail: [0, 1],
  object_count_hint: [1, 50],
  depth_layer_separation: [0.1, 10],
};

// ── Core Resolution ─────────────────────────────────────────────────

/**
 * Resolve a semantic vector into concrete parameter values.
 *
 * @param vector   Active semantic dimensions with values in [-1, +1]
 * @param scope    Filter mappings by scope (omit for all scopes)
 * @param registry Dimension definitions (defaults to built-in DIMENSIONS)
 * @returns Map of parameter name → { value, contributions }
 */
export function resolveParameters(
  vector: SemanticVector,
  scope?: MappingScope,
  registry: DimensionDefinition[] = DIMENSIONS
): ResolvedParameters {
  // Collect all contributions per parameter
  const contributions = new Map<string, ParameterContribution[]>();
  const ranges = new Map<string, [number, number]>();

  for (const [dimName, dimValue] of Object.entries(vector)) {
    if (dimValue === 0) continue;

    const dim = registry.find(d => d.name === dimName);
    if (!dim) continue;

    for (const mapping of dim.parameterMappings) {
      // Filter by scope if specified
      if (scope && mapping.scope !== scope) continue;

      const param = mapping.parameter;
      if (!contributions.has(param)) {
        contributions.set(param, []);
        ranges.set(param, mapping.range);
      }

      const rangeSpan = mapping.range[1] - mapping.range[0];
      const contribution = dimValue * mapping.weight * (rangeSpan / 2);

      contributions.get(param)!.push({
        dimension: dimName,
        dimValue,
        weight: mapping.weight,
        contribution,
      });
    }
  }

  // Resolve each parameter
  const result: ResolvedParameters = {};

  for (const [param, contribs] of contributions.entries()) {
    const range = ranges.get(param)!;
    const midpoint = (range[0] + range[1]) / 2;
    const totalContribution = contribs.reduce((sum, c) => sum + c.contribution, 0);

    // Get physical limits (fall back to mapping range)
    const limits = PHYSICAL_LIMITS[param] || range;
    const raw = midpoint + totalContribution;
    const value = Math.max(limits[0], Math.min(limits[1], raw));

    result[param] = { value, contributions: contribs };
  }

  return result;
}

/**
 * Get just the parameter values (without contribution details).
 * Convenience for when you just need the numbers.
 */
export function resolveParameterValues(
  vector: SemanticVector,
  scope?: MappingScope,
  registry?: DimensionDefinition[]
): Record<string, number> {
  const resolved = resolveParameters(vector, scope, registry);
  const values: Record<string, number> = {};
  for (const [param, data] of Object.entries(resolved)) {
    values[param] = data.value;
  }
  return values;
}

// ── Bridge to Existing Systems ──────────────────────────────────────

/**
 * Convert resolved parameters into a lighting recipe summary.
 * Returns values that map to the existing suggestLighting interface.
 */
export function resolveToLightingSummary(vector: SemanticVector): {
  keyTemperature: number;
  fillTemperature: number;
  keyFillRatio: number;
  keyAzimuth: number;
  rimPower: number;
  envPower: number;
  fogDensity: number;
  fillPower: number;
} {
  const params = resolveParameterValues(vector);
  return {
    keyTemperature: params.key_light_temperature ?? 5000,
    fillTemperature: params.fill_light_temperature ?? 5500,
    keyFillRatio: params.key_fill_ratio ?? 2,
    keyAzimuth: params.key_azimuth ?? 45,
    rimPower: params.rim_power ?? 5,
    envPower: params.env_power ?? 0.4,
    fogDensity: params.fog_density ?? 0,
    fillPower: params.fill_power ?? 5,
  };
}

/**
 * Convert resolved parameters into a material recipe summary.
 * Returns values that map to the existing suggestMaterial interface.
 */
export function resolveToMaterialSummary(vector: SemanticVector): {
  roughness: number;
  bumpStrength: number;
  albedoSaturation: number;
} {
  const params = resolveParameterValues(vector);
  return {
    roughness: params.roughness_base ?? 0.5,
    bumpStrength: params.bump_strength ?? 0,
    albedoSaturation: params.albedo_saturation ?? 0.6,
  };
}

/**
 * Convert resolved parameters into a camera recipe summary.
 */
export function resolveToCameraSummary(vector: SemanticVector): {
  distanceMultiplier: number;
  fovHorizontal: number;
  elevation: number;
  aperture: number;
} {
  const params = resolveParameterValues(vector);
  return {
    distanceMultiplier: params.camera_distance_multiplier ?? 1.0,
    fovHorizontal: params.fov_horizontal ?? 82,
    elevation: params.camera_elevation ?? 15,
    aperture: params.aperture ?? 0,
  };
}

/**
 * Get the full resolved state: parameters + summaries.
 * This is the main output of the mapping engine.
 */
export function resolveFullState(vector: SemanticVector): {
  parameters: ResolvedParameters;
  lighting: ReturnType<typeof resolveToLightingSummary>;
  material: ReturnType<typeof resolveToMaterialSummary>;
  camera: ReturnType<typeof resolveToCameraSummary>;
} {
  return {
    parameters: resolveParameters(vector),
    lighting: resolveToLightingSummary(vector),
    material: resolveToMaterialSummary(vector),
    camera: resolveToCameraSummary(vector),
  };
}
