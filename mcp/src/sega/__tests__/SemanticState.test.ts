import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticState } from '../SemanticState';
import type { SemanticVector, LearnedAdjustment } from '../types';

describe('SemanticState', () => {
  let state: SemanticState;

  beforeEach(() => {
    state = new SemanticState();
  });

  describe('initial state', () => {
    it('starts with empty global vector', () => {
      expect(state.getGlobal()).toEqual({});
    });

    it('has no active dimensions', () => {
      expect(state.getActiveDimensions()).toHaveLength(0);
    });

    it('has no overrides', () => {
      expect(state.listOverrides()).toHaveLength(0);
    });

    it('has empty undo history', () => {
      expect(state.getHistory()).toHaveLength(0);
    });

    it('has no warnings', () => {
      expect(state.getWarnings()).toHaveLength(0);
    });
  });

  describe('setGlobal', () => {
    it('sets the global vector', () => {
      state.setGlobal({ warmth: 0.7, contrast: 0.5 });
      expect(state.getGlobal()).toEqual({ warmth: 0.7, contrast: 0.5 });
    });

    it('replaces previous vector', () => {
      state.setGlobal({ warmth: 0.7 });
      state.setGlobal({ contrast: 0.5 });
      expect(state.getGlobal()).toEqual({ contrast: 0.5 });
    });

    it('clamps values to [-1, +1]', () => {
      state.setGlobal({ warmth: 1.5, contrast: -2.0 });
      expect(state.getGlobal().warmth).toBe(1);
      expect(state.getGlobal().contrast).toBe(-1);
    });

    it('strips zero values', () => {
      state.setGlobal({ warmth: 0.7, contrast: 0 });
      expect(state.getGlobal()).toEqual({ warmth: 0.7 });
    });

    it('pushes to undo stack', () => {
      state.setGlobal({ warmth: 0.5 });
      state.setGlobal({ contrast: 0.3 });
      expect(state.getHistory()).toHaveLength(2);
    });
  });

  describe('applyDelta', () => {
    it('adds delta to current vector', () => {
      state.setGlobal({ warmth: 0.3, contrast: 0.2 });
      state.applyDelta({ warmth: 0.2, arousal: 0.5 });
      const g = state.getGlobal();
      expect(g.warmth).toBeCloseTo(0.5);
      expect(g.contrast).toBeCloseTo(0.2);
      expect(g.arousal).toBeCloseTo(0.5);
    });

    it('clamps after adding', () => {
      state.setGlobal({ warmth: 0.8 });
      state.applyDelta({ warmth: 0.5 });
      expect(state.getGlobal().warmth).toBe(1);
    });

    it('removes dimension when zeroed out', () => {
      state.setGlobal({ warmth: 0.5 });
      state.applyDelta({ warmth: -0.5 });
      expect(state.getGlobal()).toEqual({});
    });

    it('pushes to undo stack', () => {
      state.applyDelta({ warmth: 0.5 });
      expect(state.getHistory()).toHaveLength(1);
    });
  });

  describe('getActiveDimensions', () => {
    it('returns names of non-zero dimensions', () => {
      state.setGlobal({ warmth: 0.7, contrast: -0.3, pleasure: 0.5 });
      const active = state.getActiveDimensions();
      expect(active).toHaveLength(3);
      expect(active).toContain('warmth');
      expect(active).toContain('contrast');
      expect(active).toContain('pleasure');
    });
  });

  describe('per-object overrides', () => {
    it('sets and gets override', () => {
      state.setOverride('hero', { surface_detail: 0.8 });
      expect(state.getOverride('hero')).toEqual({ surface_detail: 0.8 });
    });

    it('lists override object IDs', () => {
      state.setOverride('hero', { surface_detail: 0.8 });
      state.setOverride('ground', { roughness_base: 0.9 });
      expect(state.listOverrides()).toHaveLength(2);
    });

    it('returns undefined for unknown object', () => {
      expect(state.getOverride('nope')).toBeUndefined();
    });

    it('removes override', () => {
      state.setOverride('hero', { surface_detail: 0.8 });
      state.removeOverride('hero');
      expect(state.getOverride('hero')).toBeUndefined();
      expect(state.listOverrides()).toHaveLength(0);
    });
  });

  describe('getEffective', () => {
    it('returns global when no objectId', () => {
      state.setGlobal({ warmth: 0.7 });
      expect(state.getEffective()).toEqual({ warmth: 0.7 });
    });

    it('returns global when object has no override', () => {
      state.setGlobal({ warmth: 0.7 });
      expect(state.getEffective('hero')).toEqual({ warmth: 0.7 });
    });

    it('merges global + override', () => {
      state.setGlobal({ warmth: 0.5, contrast: 0.3 });
      state.setOverride('hero', { surface_detail: 0.8 });
      const eff = state.getEffective('hero');
      expect(eff.warmth).toBeCloseTo(0.5);
      expect(eff.contrast).toBeCloseTo(0.3);
      expect(eff.surface_detail).toBeCloseTo(0.8);
    });

    it('adds override to global on same dimension', () => {
      state.setGlobal({ warmth: 0.5 });
      state.setOverride('hero', { warmth: 0.3 });
      expect(state.getEffective('hero').warmth).toBeCloseTo(0.8);
    });

    it('clamps merged values', () => {
      state.setGlobal({ warmth: 0.8 });
      state.setOverride('hero', { warmth: 0.5 });
      expect(state.getEffective('hero').warmth).toBe(1);
    });
  });

  describe('undo', () => {
    it('restores previous state', () => {
      state.setGlobal({ warmth: 0.5 });
      state.setGlobal({ contrast: 0.3 });
      const restored = state.undo();
      expect(restored).toEqual({ warmth: 0.5 });
      expect(state.getGlobal()).toEqual({ warmth: 0.5 });
    });

    it('returns undefined when nothing to undo', () => {
      expect(state.undo()).toBeUndefined();
    });

    it('can undo multiple times', () => {
      state.setGlobal({ warmth: 0.1 });
      state.setGlobal({ warmth: 0.5 });
      state.setGlobal({ warmth: 0.9 });
      state.undo(); // back to 0.5
      state.undo(); // back to 0.1
      expect(state.getGlobal().warmth).toBeCloseTo(0.1);
    });

    it('limits undo stack to 20', () => {
      for (let i = 0; i < 25; i++) {
        state.setGlobal({ warmth: i / 25 });
      }
      // 25 setGlobal calls = 25 history entries, but trimmed to 20
      expect(state.getHistory().length).toBeLessThanOrEqual(20);
    });
  });

  describe('Berlyne warnings', () => {
    it('warns when dimension exceeds 0.85', () => {
      state.setGlobal({ contrast: 0.9 });
      const warnings = state.getWarnings();
      expect(warnings).toHaveLength(1);
      expect(warnings[0].dimension).toBe('contrast');
      expect(warnings[0].value).toBe(0.9);
    });

    it('warns for negative extreme', () => {
      state.setGlobal({ warmth: -0.95 });
      const warnings = state.getWarnings();
      expect(warnings).toHaveLength(1);
      expect(warnings[0].dimension).toBe('warmth');
    });

    it('no warning at 0.85 exactly', () => {
      state.setGlobal({ contrast: 0.85 });
      expect(state.getWarnings()).toHaveLength(0);
    });

    it('no warning for moderate values', () => {
      state.setGlobal({ warmth: 0.7, contrast: 0.5 });
      expect(state.getWarnings()).toHaveLength(0);
    });

    it('warns for multiple extreme dimensions', () => {
      state.setGlobal({ contrast: 0.9, arousal: -0.95 });
      expect(state.getWarnings()).toHaveLength(2);
    });
  });

  describe('self-learning hooks', () => {
    it('records adjustment', () => {
      const adj: LearnedAdjustment = {
        timestamp: Date.now(),
        dimension: 'warmth',
        parameter: 'key_light_temperature',
        targetValue: 3200,
        actualValue: 3800,
        delta: 600,
        context: 'product shot on white background',
      };
      state.recordAdjustment(adj);
      const adjustments = state.getAdjustments();
      expect(adjustments).toHaveLength(1);
      expect(adjustments[0].dimension).toBe('warmth');
      expect(adjustments[0].delta).toBe(600);
    });

    it('returns copy of adjustments', () => {
      state.recordAdjustment({
        timestamp: 1,
        dimension: 'warmth',
        parameter: 'temp',
        targetValue: 3000,
        actualValue: 3500,
        delta: 500,
        context: 'test',
      });
      const a1 = state.getAdjustments();
      const a2 = state.getAdjustments();
      expect(a1).not.toBe(a2); // different arrays
      expect(a1).toEqual(a2); // same content
    });
  });

  describe('lifecycle', () => {
    it('clear resets everything', () => {
      state.setGlobal({ warmth: 0.5 });
      state.setOverride('hero', { contrast: 0.3 });
      state.recordAdjustment({
        timestamp: 1,
        dimension: 'warmth',
        parameter: 'temp',
        targetValue: 3000,
        actualValue: 3500,
        delta: 500,
        context: 'test',
      });
      state.clear();
      expect(state.getGlobal()).toEqual({});
      expect(state.listOverrides()).toHaveLength(0);
      expect(state.getHistory()).toHaveLength(0);
      expect(state.getAdjustments()).toHaveLength(0);
    });
  });

  describe('JSON serialization', () => {
    it('round-trips correctly', () => {
      state.setGlobal({ warmth: 0.7, contrast: 0.5 });
      state.setOverride('hero', { surface_detail: 0.8 });
      state.recordAdjustment({
        timestamp: 123,
        dimension: 'warmth',
        parameter: 'temp',
        targetValue: 3000,
        actualValue: 3500,
        delta: 500,
        context: 'test',
      });

      const json = state.toJSON();
      const restored = SemanticState.fromJSON(json);

      expect(restored.getGlobal()).toEqual({ warmth: 0.7, contrast: 0.5 });
      expect(restored.getOverride('hero')).toEqual({ surface_detail: 0.8 });
      expect(restored.getAdjustments()).toHaveLength(1);
    });
  });

  describe('getSummary', () => {
    it('returns complete summary', () => {
      state.setGlobal({ warmth: 0.7, contrast: 0.9 });
      state.setOverride('hero', { surface_detail: 0.8 });
      const summary = state.getSummary();
      expect(summary.activeDimensions).toContain('warmth');
      expect(summary.activeDimensions).toContain('contrast');
      expect(summary.overrideCount).toBe(1);
      expect(summary.undoDepth).toBe(1); // setGlobal pushed once
      expect(summary.warnings.length).toBeGreaterThan(0); // contrast 0.9
    });
  });
});
