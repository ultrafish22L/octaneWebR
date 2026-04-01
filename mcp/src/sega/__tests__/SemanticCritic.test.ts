import { describe, it, expect } from 'vitest';
import {
  computeGap,
  isGapStagnating,
  buildVLMEstimationPrompt,
  parseVLMEstimation,
  runCritique,
} from '../SemanticCritic';
import type { SemanticVector } from '../types';

describe('SemanticCritic', () => {
  describe('computeGap', () => {
    it('returns zero gap for matching vectors', () => {
      const gap = computeGap({ warmth: 0.5, contrast: 0.3 }, { warmth: 0.5, contrast: 0.3 });
      expect(gap.magnitude).toBeLessThan(0.02);
      expect(gap.converged).toBe(true);
    });

    it('computes correct gap direction', () => {
      const gap = computeGap({ warmth: 0.7 }, { warmth: 0.4 });
      // measured - target = 0.4 - 0.7 = -0.3 (not enough warmth)
      expect(gap.gap.warmth).toBeCloseTo(-0.3);
      expect(gap.worstDimensions[0].direction).toBe('not enough');
    });

    it('computes magnitude correctly', () => {
      const gap = computeGap({ warmth: 0.7, contrast: 0.6 }, { warmth: 0.4, contrast: 0.9 });
      // gap = {warmth: -0.3, contrast: +0.3}
      // magnitude = sqrt(0.09 + 0.09) ≈ 0.424
      expect(gap.magnitude).toBeCloseTo(0.424, 2);
    });

    it('flags convergence when gap is small', () => {
      const gap = computeGap({ warmth: 0.5 }, { warmth: 0.55 });
      expect(gap.converged).toBe(true);
    });

    it('does not converge for large gap', () => {
      const gap = computeGap({ warmth: 0.7 }, { warmth: 0.1 });
      expect(gap.converged).toBe(false);
    });

    it('sorts worst dimensions by magnitude', () => {
      const gap = computeGap(
        { warmth: 0.7, contrast: 0.5, saturation: 0.3 },
        { warmth: 0.1, contrast: 0.4, saturation: 0.3 }
      );
      expect(gap.worstDimensions[0].dimension).toBe('warmth');
    });

    it('handles empty vectors', () => {
      const gap = computeGap({}, {});
      expect(gap.magnitude).toBe(0);
      expect(gap.converged).toBe(true);
    });

    it('handles dimensions in measured but not target', () => {
      const gap = computeGap({}, { warmth: 0.5 });
      expect(gap.gap.warmth).toBeCloseTo(0.5);
    });

    it('handles dimensions in target but not measured', () => {
      const gap = computeGap({ warmth: 0.5 }, {});
      expect(gap.gap.warmth).toBeCloseTo(-0.5);
    });
  });

  describe('isGapStagnating', () => {
    it('detects stagnation when magnitude barely changes', () => {
      expect(isGapStagnating(0.5, 0.48)).toBe(true);
    });

    it('not stagnating when magnitude drops significantly', () => {
      expect(isGapStagnating(0.5, 0.3)).toBe(false);
    });

    it('detects stagnation when magnitude increases slightly', () => {
      expect(isGapStagnating(0.3, 0.33)).toBe(true);
    });
  });

  describe('buildVLMEstimationPrompt', () => {
    it('excludes pixel-computable dimensions', () => {
      const prompt = buildVLMEstimationPrompt(['warmth', 'contrast', 'pleasure', 'arousal']);
      // warmth and contrast are pixel-computable, should be excluded
      expect(prompt).not.toContain('**warmth**');
      expect(prompt).not.toContain('**contrast**');
      // pleasure and arousal should be included
      expect(prompt).toContain('**pleasure**');
      expect(prompt).toContain('**arousal**');
    });

    it('returns empty for all-pixel dimensions', () => {
      const prompt = buildVLMEstimationPrompt(['contrast', 'warmth', 'saturation', 'atmosphere']);
      expect(prompt).toBe('');
    });

    it('includes dimension descriptions', () => {
      const prompt = buildVLMEstimationPrompt(['pleasure', 'dominance']);
      expect(prompt).toContain('beautiful');
      expect(prompt).toContain('vast');
    });
  });

  describe('parseVLMEstimation', () => {
    it('parses clean JSON with measurements key', () => {
      const result = parseVLMEstimation('{"measurements":{"pleasure":0.6,"arousal":-0.3}}');
      expect(result).not.toBeNull();
      expect(result!.pleasure).toBeCloseTo(0.6);
      expect(result!.arousal).toBeCloseTo(-0.3);
    });

    it('parses bare object (no measurements wrapper)', () => {
      const result = parseVLMEstimation('{"pleasure":0.5,"dominance":0.7}');
      expect(result).not.toBeNull();
      expect(result!.pleasure).toBeCloseTo(0.5);
    });

    it('parses from markdown code block', () => {
      const result = parseVLMEstimation('```json\n{"measurements":{"pleasure":0.4}}\n```');
      expect(result).not.toBeNull();
      expect(result!.pleasure).toBeCloseTo(0.4);
    });

    it('clamps values', () => {
      const result = parseVLMEstimation('{"measurements":{"pleasure":2.0}}');
      expect(result).not.toBeNull();
      expect(result!.pleasure).toBe(1);
    });

    it('returns null for garbage', () => {
      expect(parseVLMEstimation('not json at all')).toBeNull();
    });
  });

  describe('runCritique', () => {
    it('handles missing image gracefully', () => {
      const result = runCritique({ warmth: 0.7, contrast: 0.5 }, '/nonexistent/image.png');
      // Should still compute gap using only VLM measurements (empty)
      expect(result.pixelMeasurement).toBeNull();
      expect(result.gap).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it('includes Berlyne warnings for extreme target values', () => {
      const result = runCritique({ warmth: 0.95, contrast: 0.9 }, '/nonexistent/image.png');
      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
    });

    it('merges VLM measurements', () => {
      const result = runCritique({ pleasure: 0.7, warmth: 0.5 }, '/nonexistent/image.png', {
        pleasure: 0.4,
      });
      // VLM measurement should appear in measured vector
      expect(result.measured.pleasure).toBeCloseTo(0.4);
    });

    it('generates corrections for gap dimensions', () => {
      const result = runCritique({ pleasure: 0.8 }, '/nonexistent/image.png', { pleasure: 0.2 });
      // Gap is -0.6, so correction should be +0.6
      expect(result.corrections.pleasure).toBeCloseTo(0.6);
    });
  });
});
