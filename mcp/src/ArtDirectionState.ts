/**
 * ArtDirectionState — session-persistent state for the art direction system.
 *
 * Tracks composition specs, score history, and object-to-handle mappings.
 * Cleared on crash/reset/load (same lifecycle as SceneCache).
 *
 * Design rules:
 * - Pure state container, no gRPC calls.
 * - Stagnation detection: flags when scores stop improving.
 * - Fully testable without Octane.
 */

import type { SemanticState } from './sega/SemanticState';
import type { ScenePlacementState } from './ScenePlacementState';

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

/** Cached VLM calibration of concept art — run once, used for all score comparisons. */
export interface CachedCalibration {
  /** VLM's composition description of concept art (same prompt as render score) */
  composition: string;
  /** VLM's semantic dimension estimates for concept art */
  semanticEstimates?: Record<string, number>;
  /** Extracted keywords from calibration description */
  keywords?: string[];
  /** Which VLM model produced this calibration */
  vlmModel: string;
  /** When calibration was generated */
  timestamp: number;
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
  /** Cached VLM calibration of concept art */
  calibration?: CachedCalibration;
}

export interface CorrectionEntry {
  target: string; // 'camera_position' | 'object_position' | etc.
  objectId?: string;
  delta?: Vec3;
  value?: number | string | Vec3;
  priority: number; // 1=critical, 2=important, 3=polish
  description: string;
}

export interface ScoreValues {
  framing: number;
  depth: number;
  composition: number;
  lighting: number;
  placement: number;
}

/** Sonnet concept-vs-render comparison scores */
export interface ComparisonScores {
  grade: string; // A-F
  composition_match: number; // 1-5
  lighting_match: number; // 1-5
  material_match: number; // 1-5
  mood_match: number; // 1-5
  depth_match: number; // 1-5
  missing_elements: string[];
  top_fixes: string[];
  notes: string;
  model: string; // Sonnet model ID
  latency_ms: number; // API call time
}

/** Orchestrator (main Claude) assessment */
export interface OrchestratorAssessment {
  grade: string; // A-F
  notes: string;
  agrees_with_sonnet: boolean;
}

export interface ScoreRecord {
  iteration: number;
  overallScore: number;
  passed: boolean;
  scores: ScoreValues;
  corrections: CorrectionEntry[];
  /** Sonnet concept-vs-render comparison (when concept art available) */
  comparison?: ComparisonScores;
  /** Orchestrator assessment (filled by main Claude after reviewing) */
  orchestrator?: OrchestratorAssessment;
  renderPath: string;
  timestamp: number;
}

// ── Unified AD Context ──────────────────────────────────────────────

/** Complete snapshot of all AD state — read from artState.context by any tool. */
export interface AdContext {
  // Build state
  buildMode: BuildMode;
  adActive: boolean;
  phase: number;
  completedSteps: string[];

  // Current spec
  specName: string | null;
  description: string | null;
  objects: Array<{ id: string; role: string }>;
  focalPoint: string | null;
  lightingMood: string | null;

  // Iteration state
  iteration: number;
  previousGrade: string | null;
  previousFixes: string[];
  stagnating: boolean;
  exhausted: boolean;

  // Scene state (cached by tools)
  isClay: boolean;
  clayMode: number;

  // SEGA intent (from attached SemanticState)
  segaIntent: Record<string, number>;
  segaActiveDimensions: string[];

  // Placement (from attached ScenePlacementState)
  placedObjects: Array<{
    name: string;
    role: string;
    position: Vec3;
  }>;
}

// ── State class ──────────────────────────────────────────────────────

/** Minimum score improvement to not be considered stagnating */
const STAGNATION_THRESHOLD = 0.3;

/** Maximum score iterations before forcing a redesign */
export const MAX_ITERATIONS = 5;

/** Score threshold for a passing score */
export const PASS_THRESHOLD = 3.5;

/** Minimum acceptable individual dimension score */
export const MIN_DIMENSION_SCORE = 2;

export type AdMode = 'active' | 'inactive';
export type BuildMode = 'shop' | 'dress' | 'show' | null;

/** AD flag defaults per build mode */
const BUILD_MODE_AD_DEFAULTS: Record<string, AdMode> = {
  shop: 'inactive',
  dress: 'active',
  show: 'active',
};

// ── Workflow checklist ────────────────────────────────────────────

/** All steps in the AD workflow, in order. */
export const AD_STEPS = [
  // Phase 0 — Concept + Assets
  'analyze_reference', // image or text brief — at least one required
  'analyze_geo', // per mesh (skip for primitives-only)
  'set_sega', // mood set after concept + assets are known
  'plan_layout',
  'validate_layout',
  // Phase 1 — Frame
  'suggest_placement',
  'fit_camera',
  'register_object',
  'framing_verified', // gate: clay score passes composition_match >= 3
  // Phase 2 — Style
  'suggest_lighting',
  'suggest_material',
  // Phase 3 — Score (iterate)
  'score_render',
  'commit_scores',
] as const;

export type AdStep = (typeof AD_STEPS)[number];

const STEP_PHASE: Record<AdStep, number> = {
  analyze_reference: 0,
  analyze_geo: 0,
  set_sega: 0,
  plan_layout: 0,
  validate_layout: 0,
  suggest_placement: 1,
  fit_camera: 1,
  register_object: 1,
  framing_verified: 1,
  suggest_lighting: 2,
  suggest_material: 2,
  score_render: 3,
  commit_scores: 3,
};

/**
 * Prerequisites: which steps must be done before this step.
 *
 * analyze_reference is the entry point — no prereqs. Accepts image OR text brief.
 * set_sega after analyze_reference + analyze_geo: mood informed by concept + assets.
 * plan_layout has no hard prereqs — works with primitives (no analyze_geo needed).
 *
 * score_render has NO prereqs — it's used in BOTH:
 *   - Phase 1 (clay composition check, before framing_verified)
 *   - Phase 3 (final score loop, after dress)
 *
 * framing_verified requires score_render because the clay-mode
 * score IS the gate. You can't skip it by just running fit_camera.
 */
const STEP_PREREQS: Partial<Record<AdStep, AdStep[]>> = {
  set_sega: ['analyze_reference'], // mood from concept analysis
  plan_layout: [], // no hard prereqs — primitives skip analyze_geo
  validate_layout: ['plan_layout'],
  suggest_placement: ['plan_layout'],
  fit_camera: [], // always allowed — Phase 1 entry
  register_object: ['fit_camera'],
  framing_verified: ['fit_camera', 'register_object', 'score_render'],
  suggest_lighting: ['set_sega', 'framing_verified'], // needs mood AND locked framing
  suggest_material: ['framing_verified'],
  score_render: [], // no prereqs — used in Phase 1 (clay) AND Phase 3 (final)
  commit_scores: ['score_render'],
};

/** What to call next after completing this step (when AD active). */
const STEP_NEXT: Partial<Record<AdStep, { step: AdStep; reason: string }>> = {
  analyze_reference: {
    step: 'analyze_geo',
    reason: 'Analyze each mesh (skip if primitives only, proceed to set_sega)',
  },
  analyze_geo: {
    step: 'set_sega',
    reason: 'Set mood now that concept + assets are known',
  },
  set_sega: { step: 'plan_layout', reason: 'Plan spatial layout with known mood' },
  plan_layout: { step: 'validate_layout', reason: 'Validate geometry before building' },
  validate_layout: {
    step: 'suggest_placement',
    reason: 'Get collision-free positions for each object',
  },
  suggest_placement: { step: 'fit_camera', reason: 'Frame the placed objects' },
  fit_camera: { step: 'register_object', reason: 'Register placed object in scene DB' },
  register_object: {
    step: 'score_render',
    reason:
      'Run score_render IN CLAY MODE to verify composition. framing_verified gate requires score_render + fit_camera + register_object.',
  },
  framing_verified: {
    step: 'suggest_lighting',
    reason: 'Build lighting from SEGA mood now that framing is locked',
  },
  suggest_lighting: {
    step: 'suggest_material',
    reason: 'Apply PBR properties (preserve mesh textures)',
  },
  suggest_material: { step: 'score_render', reason: 'Score the dressed scene' },
  score_render: {
    step: 'commit_scores',
    reason: 'Record scores and get correction priorities',
  },
  commit_scores: {
    step: 'score_render',
    reason: 'Re-render and score again until passed',
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
  private history = new Map<string, ScoreRecord[]>();
  private _handleMap = new Map<string, number>(); // objectId → Octane handle
  private _mode: AdMode = 'inactive';
  private _buildMode: BuildMode = null;
  private _completedSteps = new Set<AdStep>();
  private _stepNotes = new Map<AdStep, string>(); // quality/status annotations per step
  private _lastCalibration: CachedCalibration | null = null;
  private _lastCalibrationPath: string | null = null;

  // ── Attached state refs (set once via attachStates) ─────────────
  private _segaState: SemanticState | null = null;
  private _placementState: ScenePlacementState | null = null;

  // ── Cached runtime values (updated by tools as side effects) ────
  private _clayMode = 0;
  private _lastRenderPath: string | null = null;

  /** Attach external state refs. Call once after all states constructed. */
  attachStates(sega: SemanticState, placement: ScenePlacementState): void {
    this._segaState = sega;
    this._placementState = placement;
  }

  // ── Cached value setters (called by tool handlers) ──────────────

  setCachedClay(mode: number): void {
    this._clayMode = mode;
  }
  setCachedRenderPath(path: string): void {
    this._lastRenderPath = path;
  }

  // ── Unified context snapshot ────────────────────────────────────

  /** Complete AD context — call from any tool via artState.context. */
  get context(): AdContext {
    // Find the primary spec (first one, usually only one)
    const specName = this.specs.size > 0 ? (this.specs.keys().next().value ?? null) : null;
    const spec = specName ? (this.specs.get(specName) ?? null) : null;

    // Previous score data
    const records = specName ? (this.history.get(specName) ?? []) : [];
    const lastRecord = records.length > 0 ? records[records.length - 1] : null;

    // SEGA from attached state
    const segaIntent = this._segaState?.getGlobal() ?? {};
    const segaActiveDimensions = this._segaState?.getActiveDimensions() ?? [];

    // Placement from attached state
    const placedObjects = (this._placementState?.getEntries() ?? []).map(e => ({
      name: e.name,
      role: e.role,
      position: e.position,
    }));

    const workflow = this._mode === 'active' ? this.getWorkflowStatus() : null;

    return {
      buildMode: this._buildMode,
      adActive: this._mode === 'active',
      phase: workflow?.phase ?? 0,
      completedSteps: workflow?.completed ?? [],

      specName: specName ?? null,
      description: spec?.description ?? null,
      objects: (spec?.objects ?? []).map(o => ({ id: o.id, role: o.role })),
      focalPoint: spec?.focalPoint ?? null,
      lightingMood: spec?.lightingMood ?? null,

      iteration: specName ? this.getIterationCount(specName) : 0,
      previousGrade: lastRecord?.comparison?.grade ?? null,
      previousFixes: lastRecord?.comparison?.top_fixes?.slice(0, 3) ?? [],
      stagnating: specName ? this.isStagnating(specName) : false,
      exhausted: specName ? this.isExhausted(specName) : false,

      isClay: this._clayMode > 0,
      clayMode: this._clayMode,

      segaIntent,
      segaActiveDimensions,

      placedObjects,
    };
  }

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

  // ── Build mode ──────────────────────────────────────────────────

  get buildMode(): BuildMode {
    return this._buildMode;
  }

  /** Set build mode and auto-set AD flag per defaults (SHOP→off, DRESS/SHOW→on).
   *  Pass null to clear build mode. AD flag can still be overridden with setMode(). */
  setBuildMode(mode: BuildMode): void {
    this._buildMode = mode;
    if (mode) {
      this._mode = BUILD_MODE_AD_DEFAULTS[mode] ?? 'inactive';
    } else {
      this._mode = 'inactive';
    }
  }

  // ── Workflow checklist ────────────────────────────────────────────

  /**
   * Mark a step as completed with optional quality note. Auto-derives gate steps.
   *
   * framing_verified requires ALL THREE:
   *   1. fit_camera (scene is framed)
   *   2. register_object (objects registered in scene DB)
   *   3. score_render (VLM confirmed composition in clay mode)
   *
   * This prevents skipping the clay-mode score gate before Phase 2.
   */
  completeStep(step: AdStep, note?: string): void {
    this._completedSteps.add(step);
    if (note) this._stepNotes.set(step, note);
    // Auto-complete framing_verified when all three Phase 1 gates are met
    if (
      (step === 'fit_camera' || step === 'register_object' || step === 'score_render') &&
      this._completedSteps.has('fit_camera') &&
      this._completedSteps.has('register_object') &&
      this._completedSteps.has('score_render')
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

  /** Clear all composition specs — call on explicit scene transition (reset_ad with clear_specs:true). */
  clearSpecs(): void {
    this.specs.clear();
    this.history.clear();
    this._lastCalibration = null;
    this._lastCalibrationPath = null;
  }

  // ── Score history ────────────────────────────────────────────

  addScore(specName: string, record: ScoreRecord): void {
    if (!this.history.has(specName)) {
      this.history.set(specName, []);
    }
    this.history.get(specName)!.push(record);
  }

  getHistory(specName: string): ScoreRecord[] {
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
   * Only meaningful after at least 2 scores.
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

  // ── Calibration ─────────────────────────────────────────────────

  /** Store VLM calibration for a reference image (pass resolved absolute path). */
  setCalibration(resolvedPath: string, calibration: CachedCalibration): void {
    this._lastCalibration = calibration;
    this._lastCalibrationPath = resolvedPath;
  }

  /** Get the last stored calibration. */
  getCalibration(): { calibration: CachedCalibration; path: string } | null {
    if (!this._lastCalibration || !this._lastCalibrationPath) return null;
    return { calibration: this._lastCalibration, path: this._lastCalibrationPath };
  }

  /** Get all specs as an iterable (for external traversal without as-any). */
  getSpecs(): IterableIterator<[string, CompositionSpec]> {
    return this.specs.entries();
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  /** Clear scene-specific state but preserve planning data (specs, mode).
   *  Called on reset_project / load_project — scene handles are invalid but
   *  composition plans and artistic intent survive for the next build. */
  clearScene(): void {
    this.history.clear();
    this._handleMap.clear();
    this._completedSteps.clear();
    this._stepNotes.clear();
    this._clayMode = 0;
    this._lastRenderPath = null;
    // ⚠️ Calibration is per-scene — MUST clear to prevent cross-scene spec contamination.
    // If stale calibration survives into a new scene, score_render uses the old scene's
    // expected-objects list and reports wrong missing_elements (e.g. s01 skull/fruit in s02).
    this._lastCalibration = null;
    this._lastCalibrationPath = null;
    // specs PRESERVED — they're planning data, not scene data
    // mode PRESERVED — user toggles it explicitly
    // state refs PRESERVED — they have their own clear()
  }

  /** Full clear — only on explicit user request or new project */
  clear(): void {
    this.specs.clear();
    this.history.clear();
    this._handleMap.clear();
    this._completedSteps.clear();
    this._stepNotes.clear();
    this._buildMode = null;
    this._clayMode = 0;
    this._lastRenderPath = null;
    this._lastCalibration = null;
    this._lastCalibrationPath = null;
    // mode persists across clear — user toggles it explicitly
    // state refs PRESERVED — they have their own clear()
  }

  /** Summary for get_art_direction_state tool */
  getSummary(): {
    build_mode: BuildMode;
    ad_active: boolean;
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
      build_mode: this._buildMode,
      ad_active: this.isActive,
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
 *
 * Missing prerequisites produce GATE VIOLATION errors (not just warnings).
 * The step still completes (tools already executed), but the violation is
 * surfaced loudly so the agent corrects course.
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

  const gateViolations =
    missing.length > 0
      ? missing.map(
          m =>
            `⛔ GATE VIOLATION: "${m}" must be completed before "${step}". Go back and complete it NOW. Do not continue forward.`
        )
      : undefined;

  return {
    ad_workflow: {
      step_completed: step,
      gate_violations: gateViolations,
      protocol_ok: !gateViolations,
      ...status,
    },
  };
}
