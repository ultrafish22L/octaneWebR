import { describe, it, expect, beforeEach } from 'vitest';
import {
  ArtDirectionState,
  PASS_THRESHOLD,
  MAX_ITERATIONS,
  adWorkflow,
} from '../ArtDirectionState';
import type { CompositionSpec, CritiqueRecord } from '../ArtDirectionState';

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

function makeCritique(iteration: number, score: number, passed = false): CritiqueRecord {
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
      state.addCritique('s', makeCritique(1, 2.5));
      expect(state.getIterationCount('s')).toBe(1);
      state.setSpec('s', makeSpec('s')); // re-set
      expect(state.getIterationCount('s')).toBe(0);
    });
  });

  describe('critique history', () => {
    it('tracks scores across iterations', () => {
      state.setSpec('s', makeSpec('s'));
      state.addCritique('s', makeCritique(1, 2.0));
      state.addCritique('s', makeCritique(2, 3.0));
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
      state.addCritique('s', makeCritique(1, 2.5));
      expect(state.isStagnating('s')).toBe(false);
    });

    it('detects stagnation when improvement < 0.3', () => {
      state.setSpec('s', makeSpec('s'));
      state.addCritique('s', makeCritique(1, 2.5));
      state.addCritique('s', makeCritique(2, 2.6)); // +0.1 < 0.3
      expect(state.isStagnating('s')).toBe(true);
    });

    it('not stagnating when improvement >= 0.3', () => {
      state.setSpec('s', makeSpec('s'));
      state.addCritique('s', makeCritique(1, 2.0));
      state.addCritique('s', makeCritique(2, 2.5)); // +0.5 >= 0.3
      expect(state.isStagnating('s')).toBe(false);
    });
  });

  describe('exhaustion detection', () => {
    it('not exhausted with fewer than MAX_ITERATIONS', () => {
      state.setSpec('s', makeSpec('s'));
      for (let i = 1; i < MAX_ITERATIONS; i++) {
        state.addCritique('s', makeCritique(i, 2.0));
      }
      expect(state.isExhausted('s')).toBe(false);
    });

    it('exhausted at MAX_ITERATIONS without passing', () => {
      state.setSpec('s', makeSpec('s'));
      for (let i = 1; i <= MAX_ITERATIONS; i++) {
        state.addCritique('s', makeCritique(i, 2.0));
      }
      expect(state.isExhausted('s')).toBe(true);
    });

    it('not exhausted if last iteration passed', () => {
      state.setSpec('s', makeSpec('s'));
      for (let i = 1; i < MAX_ITERATIONS; i++) {
        state.addCritique('s', makeCritique(i, 2.0));
      }
      state.addCritique('s', makeCritique(MAX_ITERATIONS, 4.0, true));
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
      state.addCritique('s', makeCritique(1, 2.0));
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
      state.addCritique('s', makeCritique(1, 3.0));
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
      state.completeStep('analyze_mesh');
      expect(state.isStepDone('analyze_mesh')).toBe(true);
      expect(state.isStepDone('plan_composition')).toBe(false);
    });

    it('checks prerequisites', () => {
      // plan_composition requires analyze_mesh
      expect(state.checkPrereqs('plan_composition')).toEqual(['analyze_mesh']);
      state.completeStep('analyze_mesh');
      expect(state.checkPrereqs('plan_composition')).toEqual([]);
    });

    it('auto-completes framing_verified when fit_camera + register_scene_object done', () => {
      state.completeStep('fit_camera');
      expect(state.isStepDone('framing_verified')).toBe(false);
      state.completeStep('register_scene_object');
      expect(state.isStepDone('framing_verified')).toBe(true);
    });

    it('getWorkflowStatus shows completed and pending', () => {
      state.completeStep('analyze_mesh');
      state.completeStep('plan_composition');
      const status = state.getWorkflowStatus('plan_composition');
      expect(status.completed).toContain('analyze_mesh');
      expect(status.completed).toContain('plan_composition');
      expect(status.pending).toContain('validate_layout');
      expect(status.next_step?.step).toBe('validate_layout');
    });

    it('resets workflow on resetWorkflow', () => {
      state.completeStep('analyze_mesh');
      state.resetWorkflow();
      expect(state.isStepDone('analyze_mesh')).toBe(false);
    });

    it('clear resets workflow', () => {
      state.completeStep('analyze_mesh');
      state.clear();
      expect(state.isStepDone('analyze_mesh')).toBe(false);
    });
  });

  describe('adWorkflow helper', () => {
    it('returns undefined when inactive', () => {
      expect(adWorkflow(state, 'analyze_mesh')).toBeUndefined();
    });

    it('returns workflow status when active', () => {
      state.setMode('active');
      const result = adWorkflow(state, 'analyze_mesh');
      expect(result).toBeDefined();
      expect(result!.ad_workflow).toBeDefined();
      const wf = result!.ad_workflow as any;
      expect(wf.step_completed).toBe('analyze_mesh');
      expect(wf.completed).toContain('analyze_mesh');
    });

    it('reports missing prerequisites', () => {
      state.setMode('active');
      // plan_composition requires analyze_mesh — skip it
      const result = adWorkflow(state, 'plan_composition');
      const wf = result!.ad_workflow as any;
      expect(wf.prereq_warnings).toBeDefined();
      expect(wf.prereq_warnings.length).toBeGreaterThan(0);
      expect(wf.prereq_warnings[0]).toContain('analyze_mesh');
    });
  });
});
