import { describe, it, expect } from 'vitest';
import {
  resolveParameters,
  resolveParameterValues,
  resolveToLightingSummary,
  resolveToMaterialSummary,
  resolveToCameraSummary,
  resolveFullState,
} from '../MappingEngine';
import { DIMENSIONS } from '../registry';
import type { SemanticVector } from '../types';

describe('MappingEngine', () => {
  describe('resolveParameters', () => {
    it('returns empty for empty vector', () => {
      const result = resolveParameters({});
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('resolves single dimension correctly', () => {
      // warmth = 1.0 → key_light_temperature should be near 2800K (warm end)
      const result = resolveParameters({ warmth: 1.0 });
      expect(result.key_light_temperature).toBeDefined();
      // Range is [7500, 2800], weight 0.8
      // midpoint = (7500+2800)/2 = 5150
      // contribution = 1.0 * 0.8 * (2800-7500)/2 = 0.8 * (-2350) = -1880
      // final = 5150 + (-1880) = 3270
      expect(result.key_light_temperature.value).toBeCloseTo(3270, 0);
    });

    it('resolves negative dimension value', () => {
      // warmth = -1.0 → key_light_temperature should be near 7500K (cool end)
      const result = resolveParameters({ warmth: -1.0 });
      // midpoint = 5150, contribution = -1.0 * 0.8 * (-2350) = +1880
      // final = 5150 + 1880 = 7030
      expect(result.key_light_temperature.value).toBeCloseTo(7030, 0);
    });

    it('combines multiple dimensions on same parameter', () => {
      // Both warmth and arousal affect key_light_temperature
      const result = resolveParameters({ warmth: 0.7, arousal: 0.3 });
      expect(result.key_light_temperature).toBeDefined();
      expect(result.key_light_temperature.contributions.length).toBeGreaterThanOrEqual(2);
    });

    it('tracks contributions per parameter', () => {
      const result = resolveParameters({ warmth: 0.5 });
      const temp = result.key_light_temperature;
      expect(temp.contributions).toHaveLength(1);
      expect(temp.contributions[0].dimension).toBe('warmth');
      expect(temp.contributions[0].dimValue).toBe(0.5);
      expect(temp.contributions[0].weight).toBe(0.8);
    });

    it('clamps to physical limits', () => {
      // Extreme values shouldn't exceed physical limits
      const result = resolveParameters({
        warmth: 1.0,
        arousal: 1.0,
        contrast: 1.0,
        pleasure: 1.0,
      });
      for (const [param, data] of Object.entries(result)) {
        expect(data.value).toBeGreaterThanOrEqual(0); // no negative physical values
        expect(isFinite(data.value)).toBe(true);
      }
    });

    it('filters by scope', () => {
      const lightOnly = resolveParameters({ warmth: 0.7 }, 'light');
      const envOnly = resolveParameters({ warmth: 0.7 }, 'environment');

      // Light scope should have key_light_temperature, fill_light_temperature
      const lightParams = Object.keys(lightOnly);
      const envParams = Object.keys(envOnly);

      // These should be different sets
      expect(lightParams.some(p => p.includes('light') || p.includes('temperature'))).toBe(true);
      expect(envParams.some(p => p.includes('env') || p.includes('tint'))).toBe(true);
    });

    it('ignores unknown dimensions', () => {
      const result = resolveParameters({ nonexistent: 0.5 });
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('resolveParameterValues', () => {
    it('returns flat value map', () => {
      const values = resolveParameterValues({ warmth: 0.5, contrast: 0.3 });
      expect(typeof values.key_light_temperature).toBe('number');
      expect(typeof values.key_fill_ratio).toBe('number');
    });
  });

  describe('resolveToLightingSummary', () => {
    it('returns all lighting fields', () => {
      const lighting = resolveToLightingSummary({ warmth: 0.7, contrast: 0.5 });
      expect(lighting.keyTemperature).toBeDefined();
      expect(lighting.fillTemperature).toBeDefined();
      expect(lighting.keyFillRatio).toBeDefined();
      expect(lighting.keyAzimuth).toBeDefined();
      expect(lighting.rimPower).toBeDefined();
      expect(lighting.envPower).toBeDefined();
      expect(lighting.fogDensity).toBeDefined();
      expect(lighting.fillPower).toBeDefined();
    });

    it('warm vector produces lower color temperature', () => {
      const warm = resolveToLightingSummary({ warmth: 0.8 });
      const cool = resolveToLightingSummary({ warmth: -0.8 });
      expect(warm.keyTemperature).toBeLessThan(cool.keyTemperature);
    });

    it('high contrast produces higher key:fill ratio', () => {
      const high = resolveToLightingSummary({ contrast: 0.8 });
      const low = resolveToLightingSummary({ contrast: -0.8 });
      expect(high.keyFillRatio).toBeGreaterThan(low.keyFillRatio);
    });

    it('defaults for empty vector', () => {
      const lighting = resolveToLightingSummary({});
      expect(lighting.keyTemperature).toBe(5000); // default
      expect(lighting.keyFillRatio).toBe(2); // default
    });
  });

  describe('resolveToMaterialSummary', () => {
    it('returns all material fields', () => {
      const mat = resolveToMaterialSummary({ surface_detail: 0.5 });
      expect(mat.roughness).toBeDefined();
      expect(mat.bumpStrength).toBeDefined();
      expect(mat.albedoSaturation).toBeDefined();
    });

    it('high surface detail increases roughness', () => {
      const weathered = resolveToMaterialSummary({ surface_detail: 0.8 });
      const smooth = resolveToMaterialSummary({ surface_detail: -0.8 });
      expect(weathered.roughness).toBeGreaterThan(smooth.roughness);
    });

    it('high saturation increases albedo saturation', () => {
      const vivid = resolveToMaterialSummary({ saturation: 0.8 });
      const muted = resolveToMaterialSummary({ saturation: -0.8 });
      expect(vivid.albedoSaturation).toBeGreaterThan(muted.albedoSaturation);
    });
  });

  describe('resolveToCameraSummary', () => {
    it('returns all camera fields', () => {
      const cam = resolveToCameraSummary({ shot_scale: 0.5 });
      expect(cam.distanceMultiplier).toBeDefined();
      expect(cam.fovHorizontal).toBeDefined();
      expect(cam.elevation).toBeDefined();
      expect(cam.aperture).toBeDefined();
    });

    it('wide shot increases distance multiplier', () => {
      const wide = resolveToCameraSummary({ shot_scale: 0.8 });
      const close = resolveToCameraSummary({ shot_scale: -0.8 });
      expect(wide.distanceMultiplier).toBeGreaterThan(close.distanceMultiplier);
    });

    it('high camera angle increases elevation', () => {
      const high = resolveToCameraSummary({ camera_angle: 0.8 });
      const low = resolveToCameraSummary({ camera_angle: -0.8 });
      expect(high.elevation).toBeGreaterThan(low.elevation);
    });

    it('intimacy increases aperture (DOF)', () => {
      const intimate = resolveToCameraSummary({ intimacy: 0.8 });
      const distant = resolveToCameraSummary({ intimacy: -0.8 });
      expect(intimate.aperture).toBeGreaterThan(distant.aperture);
    });
  });

  describe('resolveFullState', () => {
    it('returns all four sections', () => {
      const full = resolveFullState({ warmth: 0.7, contrast: 0.5 });
      expect(full.parameters).toBeDefined();
      expect(full.lighting).toBeDefined();
      expect(full.material).toBeDefined();
      expect(full.camera).toBeDefined();
    });
  });

  describe('preset vectors produce reasonable results', () => {
    it('dramatic preset: high contrast, moderate warmth', () => {
      const dramatic = { contrast: 0.7, arousal: 0.5, warmth: -0.2, key_direction: 0.4 };
      const lighting = resolveToLightingSummary(dramatic);
      expect(lighting.keyFillRatio).toBeGreaterThan(4); // high contrast
      expect(lighting.envPower).toBeLessThan(0.3); // dark environment
    });

    it('ethereal preset: low contrast, warm, atmospheric', () => {
      const ethereal = {
        warmth: 0.5,
        atmosphere: 0.4,
        pleasure: 0.6,
        contrast: -0.3,
        key_direction: 0.6,
      };
      const lighting = resolveToLightingSummary(ethereal);
      expect(lighting.keyFillRatio).toBeLessThan(4); // low contrast
      expect(lighting.fogDensity).toBeGreaterThan(0.05); // atmospheric
    });

    it('product_clean preset: low fog, low contrast', () => {
      const clean = {
        contrast: -0.3,
        complexity: -0.7,
        atmosphere: -0.8,
        surface_detail: -0.3,
        saturation: 0.1,
        groundedness: -0.3,
      };
      const lighting = resolveToLightingSummary(clean);
      expect(lighting.fogDensity).toBeLessThan(0.1); // clear
      expect(lighting.envPower).toBeGreaterThan(0.3); // bright environment
    });
  });
});
