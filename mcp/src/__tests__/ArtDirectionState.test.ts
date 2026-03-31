import { describe, it, expect, beforeEach } from 'vitest';
import {
  ArtDirectionState,
  PASS_THRESHOLD,
  MAX_ITERATIONS,
  adWorkflow,
} from '../ArtDirectionState';
import type { CompositionSpec, ScoreRecord } from '../ArtDirectionState';

function makeSpec(name: string): CompositionSpec {
  return {
    name,
    description: 'test',
    camera: {
      position: { x: 0, y: 2, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      fovHorizontalDeg: 82,
      compositionRule: 'rule-of-thirds',
    },
    objects: [{ id: 'hero', role: 'hero', position: { x: 0, y: 0, z: 0 }, depthLayer: 0 }],
    depthLayers: 1,
    focalPoint: 'hero',
    lightingMood: 'natural',
    sceneExtents: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
  };
}

function makeScore(iteration: number, score: number, passed = false): ScoreRecord {
  return {
    iteration,
    overallScore: score,
    passed,
    scores: { framing: score, depth: score, composition: score, lighting: score, placement: score },
    corrections: [],
    renderPath: '/test/render.png',
    timestamp: Date.now(),
  };
}

describe('ArtDirectionState', () => {
  let state: ArtDirectionState;

  beforeEach(() => {
    state = new ArtDirectionState();
  });

  describe('spec management', () => {
    it('stores and retrieves specs', () => {
      const spec = makeSpec('test');
      state.setSpec('test', spec);
      expect(state.getSpec('test')).toBe(spec);
      expect(state.listSpecs()).toEqual(['test']);
    });

    it('returns undefined for unknown spec', () => {
      expect(state.getSpec('nope')).toBeUndefined();
    });

    it('resets history when spec is updated', () => {
      state.setSpec('s', makeSpec('s'));
      state.addScore('s', makeScore(1, 2.5));
      expect(state.getIterationCount('s')).toBe(1);
      state.setSpec('s', makeSpec('s')); // re-set
      expect(state.getIterationCount('s')).toBe(0);
    });
  });

  describe('score history', () => {
    it('tracks scores across iterations', () => {
      state.setSpec('s', makeSpec('s'));
      state.addScore('s', makeScore(1, 2.0));
      state.addScore('s', makeScore(2, 3.0));
      expect(state.getLatestScore('s')).toBe(3.0);
      expect(state.getIterationCount('s')).toBe(2);
      expect(state.getHistory('s')).toHaveLength(2);
    });

    it('returns undefined score for no history', () => {
      expect(state.getLatestScore('nope')).toBeUndefined();
    });
  });

  describe('stagnation detection', () => {
    it('not stagnating with <2 iterations', () => {
      state.setSpec('s', makeSpec('s'));
      state.addScore('s', makeScore(1, 2.5));
      expect(state.isStagnating('s')).toBe(false);
    });

    it('detects stagnation when improvement < 0.3', () => {
      state.setSpec('s', makeSpec('s'));
      state.addScore('s', makeScore(1, 2.5));
      state.addScore('s', makeScore(2, 2.6)); // +0.1 < 0.3
      expect(state.isStagnating('s')).toBe(true);
    });

    it('not stagnating when improvement >= 0.3', () => {
      state.setSpec('s', makeSpec('s'));
      state.addScore('s', makeScore(1, 2.0));
      state.addScore('s', makeScore(2, 2.5)); // +0.5 >= 0.3
      expect(state.isStagnating('s')).toBe(false);
    });
  });

  describe('exhaustion detection', () => {
    it('not exhausted with fewer than MAX_ITERATIONS', () => {
      state.setSpec('s', makeSpec('s'));
      for (let i = 1; i < MAX_ITERATIONS; i++) {
        state.addScore('s', makeScore(i, 2.0));
      }
      expect(state.isExhausted('s')).toBe(false);
    });

    it('exhausted at MAX_ITERATIONS without passing', () => {
      state.setSpec('s', makeSpec('s'));
      for (let i = 1; i <= MAX_ITERATIONS; i++) {
        state.addScore('s', makeScore(i, 2.0));
      }
      expect(state.isExhausted('s')).toBe(true);
    });

    it('not exhausted if last iteration passed', () => {
      state.setSpec('s', makeSpec('s'));
      for (let i = 1; i < MAX_ITERATIONS; i++) {
        state.addScore('s', makeScore(i, 2.0));
      }
      state.addScore('s', makeScore(MAX_ITERATIONS, 4.0, true));
      expect(state.isExhausted('s')).toBe(false);
    });
  });

  describe('handle mapping', () => {
    it('maps object ids to handles', () => {
      state.mapHandle('hero', 1000042);
      expect(state.getHandle('hero')).toBe(1000042);
      expect(state.listHandles()).toEqual({ hero: 1000042 });
    });
  });

  describe('clear', () => {
    it('clears all state', () => {
      state.setSpec('s', makeSpec('s'));
      state.addScore('s', makeScore(1, 2.0));
      state.mapHandle('hero', 42);
      state.clear();
      expect(state.listSpecs()).toEqual([]);
      expect(state.getHistory('s')).toEqual([]);
      expect(state.getHandle('hero')).toBeUndefined();
    });
  });

  describe('getSummary', () => {
    it('returns structured summary', () => {
      state.setSpec('s', makeSpec('s'));
      state.addScore('s', makeScore(1, 3.0));
      state.mapHandle('hero', 42);
      const summary = state.getSummary();
      expect(summary.specs).toEqual(['s']);
      expect(summary.scores.s.latest).toBe(3.0);
      expect(summary.scores.s.iterations).toBe(1);
      expect(summary.handleCount).toBe(1);
    });
  });

  describe('AD mode', () => {
    it('defaults to inactive', () => {
      expect(state.mode).toBe('inactive');
      expect(state.isActive).toBe(false);
    });

    it('toggles mode', () => {
      state.setMode('active');
      expect(state.isActive).toBe(true);
      state.setMode('inactive');
      expect(state.isActive).toBe(false);
    });

    it('mode persists across clear', () => {
      state.setMode('active');
      state.clear();
      expect(state.isActive).toBe(true);
    });
  });

  describe('workflow checklist', () => {
    beforeEach(() => {
      state.setMode('active');
    });

    it('tracks completed steps', () => {
      state.completeStep('analyze_geo');
      expect(state.isStepDone('analyze_geo')).toBe(true);
      expect(state.isStepDone('plan_layout')).toBe(false);
    });

    it('checks prerequisites', () => {
      // set_sega requires analyze_reference
      expect(state.checkPrereqs('set_sega')).toEqual(['analyze_reference']);
      state.completeStep('analyze_reference');
      expect(state.checkPrereqs('set_sega')).toEqual([]);
      // plan_layout has no hard prereqs (primitives skip analyze_geo)
      expect(state.checkPrereqs('plan_layout')).toEqual([]);
    });

    it('auto-completes framing_verified when fit_camera + register_object + score_render done', () => {
      state.completeStep('fit_camera');
      expect(state.isStepDone('framing_verified')).toBe(false);
      state.completeStep('register_object');
      expect(state.isStepDone('framing_verified')).toBe(false);
      state.completeStep('score_render');
      expect(state.isStepDone('framing_verified')).toBe(true);
    });

    it('getWorkflowStatus shows completed and pending', () => {
      state.completeStep('analyze_geo');
      state.completeStep('plan_layout');
      const status = state.getWorkflowStatus('plan_layout');
      expect(status.completed).toContain('analyze_geo');
      expect(status.completed).toContain('plan_layout');
      expect(status.pending).toContain('validate_layout');
      expect(status.next_step?.step).toBe('validate_layout');
    });

    it('resets workflow on resetWorkflow', () => {
      state.completeStep('analyze_geo');
      state.resetWorkflow();
      expect(state.isStepDone('analyze_geo')).toBe(false);
    });

    it('clear resets workflow', () => {
      state.completeStep('analyze_geo');
      state.clear();
      expect(state.isStepDone('analyze_geo')).toBe(false);
    });
  });

  describe('adWorkflow helper', () => {
    it('returns undefined when inactive', () => {
      expect(adWorkflow(state, 'analyze_geo')).toBeUndefined();
    });

    it('returns workflow status when active', () => {
      state.setMode('active');
      const result = adWorkflow(state, 'analyze_geo');
      expect(result).toBeDefined();
      expect(result!.ad_workflow).toBeDefined();
      const wf = result!.ad_workflow as any;
      expect(wf.step_completed).toBe('analyze_geo');
      expect(wf.completed).toContain('analyze_geo');
    });

    it('reports missing prerequisites', () => {
      state.setMode('active');
      // set_sega requires analyze_reference — skip it
      const result = adWorkflow(state, 'set_sega');
      const wf = result!.ad_workflow as any;
      expect(wf.prereq_warnings).toBeDefined();
      expect(wf.prereq_warnings.length).toBeGreaterThan(0);
      expect(wf.prereq_warnings[0]).toContain('analyze_reference');
    });
  });
});
