/**
 * SemanticState — manages a scene's semantic vector state.
 *
 * Pure state container (no gRPC calls). Handles:
 * - Global vector set/get/delta
 * - Per-object overrides
 * - Undo stack (max 20 entries)
 * - Berlyne warnings (|value| > 0.85)
 * - Self-learning adjustment recording
 *
 * Lifecycle: cleared on crash/reset/load (same as ArtDirectionState).
 */

import type {
  SemanticVector,
  SceneSemanticState,
  LearnedAdjustment,
  BerlyneWarning,
} from './types';

const MAX_UNDO = 20;
const BERLYNE_THRESHOLD = 0.85;

export class SemanticState {
  private state: SceneSemanticState;

  constructor() {
    this.state = {
      global: {},
      overrides: {},
      history: [],
      learnedAdjustments: [],
    };
  }

  // ── Global Vector ─────────────────────────────────────────────────

  /** Get the current global vector (copy). */
  getGlobal(): SemanticVector {
    return { ...this.state.global };
  }

  /** Set the global vector absolutely. Pushes previous to undo stack. */
  setGlobal(vector: SemanticVector): void {
    this.pushUndo();
    this.state.global = clampVector({ ...vector });
  }

  /** Apply a relative delta to the global vector. Pushes previous to undo stack. */
  applyDelta(delta: SemanticVector): void {
    this.pushUndo();
    for (const [dim, val] of Object.entries(delta)) {
      const current = this.state.global[dim] ?? 0;
      this.state.global[dim] = clampValue(current + val);
    }
    // Clean up zero values
    this.state.global = stripZeros(this.state.global);
  }

  /** Get active dimension names (non-zero values in global). */
  getActiveDimensions(): string[] {
    return Object.keys(this.state.global);
  }

  // ── Per-Object Overrides ──────────────────────────────────────────

  /** Set an override vector for a specific object. */
  setOverride(objectId: string, vector: SemanticVector): void {
    this.state.overrides[objectId] = clampVector({ ...vector });
  }

  /** Remove an object's override. */
  removeOverride(objectId: string): void {
    delete this.state.overrides[objectId];
  }

  /** Get the effective vector for an object (global + override). No objectId = global only. */
  getEffective(objectId?: string): SemanticVector {
    if (!objectId) return { ...this.state.global };

    const override = this.state.overrides[objectId];
    if (!override) return { ...this.state.global };

    // Merge: override values add to global
    const result = { ...this.state.global };
    for (const [dim, val] of Object.entries(override)) {
      const current = result[dim] ?? 0;
      result[dim] = clampValue(current + val);
    }
    return stripZeros(result);
  }

  /** List all object IDs that have overrides. */
  listOverrides(): string[] {
    return Object.keys(this.state.overrides);
  }

  /** Get the raw override for an object (without global). */
  getOverride(objectId: string): SemanticVector | undefined {
    const override = this.state.overrides[objectId];
    return override ? { ...override } : undefined;
  }

  // ── Undo ──────────────────────────────────────────────────────────

  /** Undo last global vector change. Returns the restored vector, or undefined if nothing to undo. */
  undo(): SemanticVector | undefined {
    if (this.state.history.length === 0) return undefined;
    this.state.global = this.state.history.pop()!;
    return { ...this.state.global };
  }

  /** Get the undo history (copies). */
  getHistory(): SemanticVector[] {
    return this.state.history.map(v => ({ ...v }));
  }

  private pushUndo(): void {
    this.state.history.push({ ...this.state.global });
    // Trim to max
    while (this.state.history.length > MAX_UNDO) {
      this.state.history.shift();
    }
  }

  // ── Berlyne Warnings ──────────────────────────────────────────────

  /** Check for extreme dimension values that may reduce aesthetic appeal. */
  getWarnings(): BerlyneWarning[] {
    const warnings: BerlyneWarning[] = [];
    for (const [dim, val] of Object.entries(this.state.global)) {
      if (Math.abs(val) > BERLYNE_THRESHOLD) {
        warnings.push({
          dimension: dim,
          value: val,
          message:
            `${dim} = ${val.toFixed(2)} — extreme values often reduce aesthetic appeal ` +
            `(Berlyne inverted-U). Intentional? Consider ${val > 0 ? '0.7-0.8' : '-0.8 to -0.7'} range.`,
        });
      }
    }
    return warnings;
  }

  // ── Self-Learning Hooks ───────────────────────────────────────────

  /** Record a user/critic correction for future learning. */
  recordAdjustment(adj: LearnedAdjustment): void {
    this.state.learnedAdjustments.push(adj);
  }

  /** Get all recorded adjustments (for future training pipeline). */
  getAdjustments(): LearnedAdjustment[] {
    return [...this.state.learnedAdjustments];
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  /** Clear scene-specific state but preserve global intent vector.
   *  Called on reset_project — per-object overrides are invalid but
   *  the mood/intent set in Phase 0b survives for the next build. */
  clearScene(): void {
    this.state = {
      global: this.state.global, // PRESERVED — artistic intent is planning data
      overrides: {}, // cleared — per-object overrides reference scene handles
      history: [], // cleared — adjustment history is scene-specific
      learnedAdjustments: this.state.learnedAdjustments, // PRESERVED — cross-scene learning
    };
  }

  /** Full clear — only on explicit user request or new project. */
  clear(): void {
    this.state = {
      global: {},
      overrides: {},
      history: [],
      learnedAdjustments: [],
    };
  }

  /** Serialize to plain object (for persistence/inspection). */
  toJSON(): SceneSemanticState {
    return {
      global: { ...this.state.global },
      overrides: { ...this.state.overrides },
      history: this.state.history.map(v => ({ ...v })),
      learnedAdjustments: [...this.state.learnedAdjustments],
    };
  }

  /** Restore from serialized data. */
  static fromJSON(data: SceneSemanticState): SemanticState {
    const s = new SemanticState();
    s.state = {
      global: { ...data.global },
      overrides: { ...data.overrides },
      history: (data.history || []).map(v => ({ ...v })),
      learnedAdjustments: [...(data.learnedAdjustments || [])],
    };
    return s;
  }

  /** Summary for get_sega tool. */
  getSummary(): {
    global: SemanticVector;
    activeDimensions: string[];
    overrideCount: number;
    undoDepth: number;
    adjustmentCount: number;
    warnings: BerlyneWarning[];
  } {
    return {
      global: this.getGlobal(),
      activeDimensions: this.getActiveDimensions(),
      overrideCount: Object.keys(this.state.overrides).length,
      undoDepth: this.state.history.length,
      adjustmentCount: this.state.learnedAdjustments.length,
      warnings: this.getWarnings(),
    };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function clampValue(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

function clampVector(v: SemanticVector): SemanticVector {
  const result: SemanticVector = {};
  for (const [k, val] of Object.entries(v)) {
    result[k] = clampValue(val);
  }
  return stripZeros(result);
}

function stripZeros(v: SemanticVector): SemanticVector {
  const result: SemanticVector = {};
  for (const [k, val] of Object.entries(v)) {
    if (val !== 0) result[k] = val;
  }
  return result;
}
