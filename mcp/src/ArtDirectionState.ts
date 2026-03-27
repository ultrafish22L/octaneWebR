/**
 * ArtDirectionState — session-persistent state for the art direction system.
 *
 * Tracks composition specs, critique history, and object-to-handle mappings.
 * Cleared on crash/reset/load (same lifecycle as SceneCache).
 *
 * Design rules:
 * - Pure state container, no gRPC calls.
 * - Stagnation detection: flags when scores stop improving.
 * - Fully testable without Octane.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ObjectPlacement {
  id: string;
  role: 'hero' | 'secondary' | 'accent' | 'ground' | 'light' | 'environment';
  position: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  depthLayer: number; // 0=foreground, 1=midground, 2=background, etc.
}

export interface CameraSpec {
  position: Vec3;
  target: Vec3;
  up: Vec3;
  fovHorizontalDeg: number;
  compositionRule: 'rule-of-thirds' | 'centered' | 'golden-ratio' | 'diagonal';
}

export interface CompositionSpec {
  name: string;
  description: string;
  camera: CameraSpec;
  objects: ObjectPlacement[];
  depthLayers: number;
  focalPoint: string; // id of the hero object
  lightingMood: string;
  referenceImagePath?: string;
  sceneExtents: { min: Vec3; max: Vec3 };
  /** SEGA semantic target vector — links composition to artistic intent. */
  semanticTarget?: Record<string, number>;
}

export interface CorrectionEntry {
  target: string; // 'camera_position' | 'object_position' | etc.
  objectId?: string;
  delta?: Vec3;
  value?: number | string | Vec3;
  priority: number; // 1=critical, 2=important, 3=polish
  description: string;
}

export interface CritiqueScores {
  framing: number;
  depth: number;
  composition: number;
  lighting: number;
  placement: number;
}

export interface CritiqueRecord {
  iteration: number;
  overallScore: number;
  passed: boolean;
  scores: CritiqueScores;
  corrections: CorrectionEntry[];
  renderPath: string;
  timestamp: number;
}

// ── State class ──────────────────────────────────────────────────────

/** Minimum score improvement to not be considered stagnating */
const STAGNATION_THRESHOLD = 0.3;

/** Maximum critique iterations before forcing a redesign */
export const MAX_ITERATIONS = 5;

/** Score threshold for a passing critique */
export const PASS_THRESHOLD = 3.5;

/** Minimum acceptable individual dimension score */
export const MIN_DIMENSION_SCORE = 2;

export type AdMode = 'active' | 'inactive';

// ── Workflow checklist ────────────────────────────────────────────

/** All steps in the AD workflow, in order. */
export const AD_STEPS = [
  // Phase 0 — Plan
  'analyze_reference',
  'analyze_mesh',
  'plan_composition',
  'validate_layout',
  // Phase 1 — Frame
  'suggest_placement',
  'fit_camera',
  'register_scene_object',
  'framing_verified', // gate: visual confirm all objects framed
  // Phase 2 — Dress
  'set_artistic_intent',
  'suggest_lighting',
  'suggest_material',
  // Phase 3 — Critique (iterate)
  'critique_render',
  'apply_corrections',
] as const;

export type AdStep = (typeof AD_STEPS)[number];

const STEP_PHASE: Record<AdStep, number> = {
  analyze_reference: 0,
  analyze_mesh: 0,
  plan_composition: 0,
  validate_layout: 0,
  suggest_placement: 1,
  fit_camera: 1,
  register_scene_object: 1,
  framing_verified: 1,
  set_artistic_intent: 2,
  suggest_lighting: 2,
  suggest_material: 2,
  critique_render: 3,
  apply_corrections: 3,
};

/** Prerequisites: which steps must be done before this step. */
const STEP_PREREQS: Partial<Record<AdStep, AdStep[]>> = {
  plan_composition: ['analyze_mesh'],
  validate_layout: ['plan_composition'],
  suggest_placement: ['plan_composition'],
  fit_camera: [], // always allowed — Phase 1 entry
  register_scene_object: ['fit_camera'],
  framing_verified: ['fit_camera', 'register_scene_object'],
  set_artistic_intent: ['framing_verified'],
  suggest_lighting: ['set_artistic_intent'],
  suggest_material: ['framing_verified'],
  critique_render: ['set_artistic_intent', 'framing_verified'],
  apply_corrections: ['critique_render'],
};

/** What to call next after completing this step (when AD active). */
const STEP_NEXT: Partial<Record<AdStep, { step: AdStep; reason: string }>> = {
  analyze_reference: { step: 'analyze_mesh', reason: 'Analyze each mesh before planning layout' },
  analyze_mesh: {
    step: 'plan_composition',
    reason: 'Create composition plan from analyzed meshes',
  },
  plan_composition: { step: 'validate_layout', reason: 'Validate geometry before building' },
  validate_layout: {
    step: 'suggest_placement',
    reason: 'Get collision-free positions for each object',
  },
  suggest_placement: { step: 'fit_camera', reason: 'Frame the placed objects' },
  fit_camera: { step: 'register_scene_object', reason: 'Register placed object in scene DB' },
  register_scene_object: {
    step: 'fit_camera',
    reason: 'Frame again after registering (or verify framing if all objects placed)',
  },
  framing_verified: {
    step: 'set_artistic_intent',
    reason: 'Set mood/style now that framing is locked',
  },
  set_artistic_intent: { step: 'suggest_lighting', reason: 'Build lighting recipe from mood' },
  suggest_lighting: {
    step: 'suggest_material',
    reason: 'Apply PBR properties (preserve mesh textures)',
  },
  suggest_material: { step: 'critique_render', reason: 'Score the dressed scene' },
  critique_render: {
    step: 'apply_corrections',
    reason: 'Record scores and get correction priorities',
  },
  apply_corrections: {
    step: 'critique_render',
    reason: 'Re-render and critique again until passed',
  },
};

export interface WorkflowStatus {
  phase: number;
  completed: AdStep[];
  pending: AdStep[];
  notes: Record<string, string>; // step → quality annotation (e.g. "VLM verified, high confidence")
  next_step: { step: AdStep; reason: string } | null;
  prereq_warnings: string[];
}

export class ArtDirectionState {
  private specs = new Map<string, CompositionSpec>();
  private history = new Map<string, CritiqueRecord[]>();
  private _handleMap = new Map<string, number>(); // objectId → Octane handle
  private _mode: AdMode = 'inactive';
  private _completedSteps = new Set<AdStep>();
  private _stepNotes = new Map<AdStep, string>(); // quality/status annotations per step

  // ── AD mode ───────────────────────────────────────────────────────

  get mode(): AdMode {
    return this._mode;
  }

  setMode(mode: AdMode): void {
    this._mode = mode;
    if (mode === 'active') {
      // Don't clear steps — user might activate mid-workflow
    }
  }

  get isActive(): boolean {
    return this._mode === 'active';
  }

  // ── Workflow checklist ────────────────────────────────────────────

  /** Mark a step as completed with optional quality note. Auto-derives gate steps. */
  completeStep(step: AdStep, note?: string): void {
    this._completedSteps.add(step);
    if (note) this._stepNotes.set(step, note);
    // Auto-complete framing_verified gate when both fit_camera and register_scene_object done
    if (
      (step === 'fit_camera' || step === 'register_scene_object') &&
      this._completedSteps.has('fit_camera') &&
      this._completedSteps.has('register_scene_object')
    ) {
      this._completedSteps.add('framing_verified');
    }
  }

  /** Check if a step has been completed. */
  isStepDone(step: AdStep): boolean {
    return this._completedSteps.has(step);
  }

  /** Reset the workflow checklist (e.g. when starting a new scene). */
  resetWorkflow(): void {
    this._completedSteps.clear();
    this._stepNotes.clear();
  }

  /**
   * Check prerequisites for a step. Returns list of missing prereqs.
   * Empty list = all prereqs met.
   */
  checkPrereqs(step: AdStep): string[] {
    const prereqs = STEP_PREREQS[step];
    if (!prereqs) return [];
    return prereqs.filter(p => !this._completedSteps.has(p));
  }

  /**
   * Get full workflow status — included in every tool response when AD is active.
   * Shows what's done, what's pending, and what to do next.
   */
  getWorkflowStatus(currentStep?: AdStep): WorkflowStatus {
    const completed = AD_STEPS.filter(s => this._completedSteps.has(s));
    const pending = AD_STEPS.filter(s => !this._completedSteps.has(s));

    // Determine current phase from highest completed step
    let phase = 0;
    for (const s of completed) {
      const p = STEP_PHASE[s];
      if (p > phase) phase = p;
    }

    // Next step
    let next_step: { step: AdStep; reason: string } | null = null;
    if (currentStep && STEP_NEXT[currentStep]) {
      next_step = STEP_NEXT[currentStep]!;
    } else {
      // Find first incomplete step
      for (const s of AD_STEPS) {
        if (!this._completedSteps.has(s)) {
          const prereqs = this.checkPrereqs(s);
          if (prereqs.length === 0) {
            next_step = { step: s, reason: `Next incomplete step in workflow` };
            break;
          }
        }
      }
    }

    // Prereq warnings for current step
    const prereq_warnings = currentStep
      ? this.checkPrereqs(currentStep).map(
          p => `Missing prerequisite: ${p} (should be done before ${currentStep})`
        )
      : [];

    // Step notes (quality annotations)
    const notes: Record<string, string> = {};
    for (const [step, note] of this._stepNotes) {
      notes[step] = note;
    }

    return {
      phase,
      completed: [...completed],
      pending: [...pending],
      notes,
      next_step,
      prereq_warnings,
    };
  }

  // ── Spec management ─────────────────────────────────────────────

  setSpec(name: string, spec: CompositionSpec): void {
    this.specs.set(name, spec);
    // Reset history when spec changes
    this.history.set(name, []);
  }

  getSpec(name: string): CompositionSpec | undefined {
    return this.specs.get(name);
  }

  listSpecs(): string[] {
    return [...this.specs.keys()];
  }

  // ── Critique history ────────────────────────────────────────────

  addCritique(specName: string, record: CritiqueRecord): void {
    if (!this.history.has(specName)) {
      this.history.set(specName, []);
    }
    this.history.get(specName)!.push(record);
  }

  getHistory(specName: string): CritiqueRecord[] {
    return this.history.get(specName) || [];
  }

  getLatestScore(specName: string): number | undefined {
    const h = this.history.get(specName);
    if (!h || h.length === 0) return undefined;
    return h[h.length - 1].overallScore;
  }

  getIterationCount(specName: string): number {
    return (this.history.get(specName) || []).length;
  }

  /**
   * Returns true if the last 2 iterations improved by less than STAGNATION_THRESHOLD.
   * Only meaningful after at least 2 critiques.
   */
  isStagnating(specName: string): boolean {
    const h = this.history.get(specName);
    if (!h || h.length < 2) return false;
    const last = h[h.length - 1].overallScore;
    const prev = h[h.length - 2].overallScore;
    return Math.abs(last - prev) < STAGNATION_THRESHOLD;
  }

  /**
   * Returns true if iteration limit has been reached without passing.
   */
  isExhausted(specName: string): boolean {
    const h = this.history.get(specName);
    if (!h) return false;
    return h.length >= MAX_ITERATIONS && !h[h.length - 1].passed;
  }

  // ── Handle mapping ──────────────────────────────────────────────

  mapHandle(objectId: string, handle: number): void {
    this._handleMap.set(objectId, handle);
  }

  getHandle(objectId: string): number | undefined {
    return this._handleMap.get(objectId);
  }

  listHandles(): Record<string, number> {
    return Object.fromEntries(this._handleMap);
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  /** Clear all state — called on crash, reset_project, load_project */
  clear(): void {
    this.specs.clear();
    this.history.clear();
    this._handleMap.clear();
    this._completedSteps.clear();
    this._stepNotes.clear();
    // mode persists across clear — user toggles it explicitly
  }

  /** Summary for get_art_direction_state tool */
  getSummary(): {
    specs: string[];
    scores: Record<
      string,
      { latest: number | undefined; iterations: number; stagnating: boolean; exhausted: boolean }
    >;
    handleCount: number;
  } {
    const scores: Record<
      string,
      { latest: number | undefined; iterations: number; stagnating: boolean; exhausted: boolean }
    > = {};
    for (const name of this.specs.keys()) {
      scores[name] = {
        latest: this.getLatestScore(name),
        iterations: this.getIterationCount(name),
        stagnating: this.isStagnating(name),
        exhausted: this.isExhausted(name),
      };
    }
    return {
      ad_mode: this._mode,
      workflow: this._mode === 'active' ? this.getWorkflowStatus() : undefined,
      specs: this.listSpecs(),
      scores,
      handleCount: this._handleMap.size,
    };
  }
}

// ── Shared workflow helper (used by all tool files) ─────────────────

/**
 * Build workflow fields to include in a tool response when AD is active.
 * Marks the step complete, checks prereqs, returns status for the response.
 * Returns undefined when AD is inactive (spread into response is a no-op).
 */
export function adWorkflow(
  artState: ArtDirectionState,
  step: AdStep,
  note?: string
): Record<string, unknown> | undefined {
  if (!artState.isActive) return undefined;
  const missing = artState.checkPrereqs(step);
  artState.completeStep(step, note);
  const status = artState.getWorkflowStatus(step);
  return {
    ad_workflow: {
      step_completed: step,
      prereq_warnings:
        missing.length > 0 ? missing.map(m => `⚠ Missing prerequisite: ${m}`) : undefined,
      ...status,
    },
  };
}
