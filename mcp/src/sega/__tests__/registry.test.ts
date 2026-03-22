import { describe, it, expect } from 'vitest';
import { DIMENSIONS, getDimension, findDimensionByAlias, listDimensions } from '../registry';
import type { DimensionDefinition } from '../types';

describe('SEGA Registry', () => {
  describe('seed dimensions', () => {
    it('has 15 seed dimensions', () => {
      expect(DIMENSIONS).toHaveLength(15);
    });

    it('all dimensions have required fields', () => {
      for (const dim of DIMENSIONS) {
        expect(dim.name).toBeTruthy();
        expect(dim.aliases.length).toBeGreaterThan(0);
        expect(dim.negativeAliases.length).toBeGreaterThan(0);
        expect(dim.source).toBeTruthy();
        expect(dim.description).toBeTruthy();
        expect(dim.negativeLabel).toBeTruthy();
        expect(dim.positiveLabel).toBeTruthy();
        expect(dim.parameterMappings.length).toBeGreaterThan(0);
      }
    });

    it('all dimension names are unique', () => {
      const names = DIMENSIONS.map(d => d.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('all parameter mappings have valid ranges (min != max)', () => {
      for (const dim of DIMENSIONS) {
        for (const m of dim.parameterMappings) {
          expect(m.range[0]).not.toBe(m.range[1]);
          expect(m.weight).toBeGreaterThan(0);
          expect(m.weight).toBeLessThanOrEqual(1);
        }
      }
    });

    it('all parameter mappings have confidence and source', () => {
      for (const dim of DIMENSIONS) {
        for (const m of dim.parameterMappings) {
          expect(m.confidence).toBeGreaterThan(0);
          expect(m.confidence).toBeLessThanOrEqual(1);
          expect(['manual', 'industry', 'learned']).toContain(m.source);
        }
      }
    });

    it('correlation coefficients are in [-1, +1]', () => {
      for (const dim of DIMENSIONS) {
        for (const c of dim.correlations) {
          expect(c.coefficient).toBeGreaterThanOrEqual(-1);
          expect(c.coefficient).toBeLessThanOrEqual(1);
          expect(c.dimension).toBeTruthy();
        }
      }
    });

    it('correlations reference valid dimension names', () => {
      const names = new Set(DIMENSIONS.map(d => d.name));
      for (const dim of DIMENSIONS) {
        for (const c of dim.correlations) {
          expect(names.has(c.dimension)).toBe(true);
        }
      }
    });
  });

  describe('getDimension', () => {
    it('finds dimension by name', () => {
      const d = getDimension('warmth');
      expect(d).toBeDefined();
      expect(d!.name).toBe('warmth');
      expect(d!.source).toBe('itten');
    });

    it('returns undefined for unknown name', () => {
      expect(getDimension('nonexistent')).toBeUndefined();
    });
  });

  describe('findDimensionByAlias', () => {
    it('finds by positive alias', () => {
      const result = findDimensionByAlias('cozy');
      expect(result).toBeDefined();
      expect(result!.dimension.name).toBe('warmth');
      expect(result!.polarity).toBe(1);
    });

    it('finds by negative alias', () => {
      const result = findDimensionByAlias('cold');
      expect(result).toBeDefined();
      expect(result!.dimension.name).toBe('warmth');
      expect(result!.polarity).toBe(-1);
    });

    it('finds by canonical name', () => {
      const result = findDimensionByAlias('contrast');
      expect(result).toBeDefined();
      expect(result!.dimension.name).toBe('contrast');
      expect(result!.polarity).toBe(1);
    });

    it('returns undefined for unknown word', () => {
      expect(findDimensionByAlias('xyzzy')).toBeUndefined();
    });

    it('is case-insensitive', () => {
      const result = findDimensionByAlias('WARM');
      expect(result).toBeDefined();
      expect(result!.dimension.name).toBe('warmth');
    });
  });

  describe('listDimensions', () => {
    it('returns all dimension names', () => {
      const names = listDimensions();
      expect(names).toHaveLength(15);
      expect(names).toContain('warmth');
      expect(names).toContain('contrast');
      expect(names).toContain('pleasure');
      expect(names).toContain('intimacy');
    });
  });

  describe('expected dimensions exist', () => {
    const expectedNames = [
      'pleasure',
      'arousal',
      'dominance',
      'warmth',
      'saturation',
      'contrast',
      'key_direction',
      'complexity',
      'atmosphere',
      'surface_detail',
      'depth_spread',
      'groundedness',
      'shot_scale',
      'camera_angle',
      'intimacy',
    ];

    for (const name of expectedNames) {
      it(`has dimension: ${name}`, () => {
        expect(getDimension(name)).toBeDefined();
      });
    }
  });
});
