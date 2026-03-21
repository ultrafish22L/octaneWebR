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

export class ArtDirectionState {
  private specs = new Map<string, CompositionSpec>();
  private history = new Map<string, CritiqueRecord[]>();
  private _handleMap = new Map<string, number>(); // objectId → Octane handle

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
      specs: this.listSpecs(),
      scores,
      handleCount: this._handleMap.size,
    };
  }
}
