/**
 * SEGA Types — Semantic Artistic Guidance for Octane MCP.
 *
 * All interfaces for the semantic vector layer between natural language
 * and DCC parameters. Self-learning extension points are baked in:
 * - ParameterMapping.confidence / .source — future engine adjusts these
 * - LearnedAdjustment — records user corrections for future training
 * - ResolvedParameters.contributions — full transparency for analysis
 */

// ── Semantic Vector ─────────────────────────────────────────────────

/** Sparse vector of named dimensions, each in [-1, +1]. Inactive dimensions omitted. */
export interface SemanticVector {
  [dimension: string]: number;
}

// ── Dimension Registry ──────────────────────────────────────────────

export type MappingSource = 'manual' | 'industry' | 'learned';
export type MappingScope = 'global' | 'hero' | 'light' | 'environment';

export interface ParameterMapping {
  parameter: string; // e.g. "key_light_temperature", "roughness"
  range: [number, number]; // value at dimension = [-1, +1]
  weight: number; // 0-1, influence strength
  scope: MappingScope;
  /** How well-tested this mapping is. Future learning engine adjusts this. */
  confidence: number; // 0-1
  /** Where this mapping came from. */
  source: MappingSource;
}

export interface Correlation {
  dimension: string;
  coefficient: number; // -1 to +1
  note: string;
}

export interface DimensionDefinition {
  name: string;
  aliases: string[]; // NL triggers: ["warm", "cozy", "golden"]
  negativeAliases: string[]; // words that push toward -1: ["cool", "cold", "icy"]
  source: string; // "itten" | "pad" | "cinetech" | "asc" | "craft" | "berlyne"
  description: string;
  negativeLabel: string; // e.g. "cool"
  positiveLabel: string; // e.g. "warm"
  parameterMappings: ParameterMapping[];
  correlations: Correlation[];
}

// ── Presets ──────────────────────────────────────────────────────────

export type PresetCategory = 'mood' | 'artist' | 'film' | 'genre' | 'user' | 'hidden';

/** Metadata for easter egg presets — clearly signals fun event to the user. */
export interface EasterEggMeta {
  event: string; // e.g. "moo", "dino"
  art: string; // ASCII art
  tradition: string; // explain the tradition
}

export interface SemanticPreset {
  name: string;
  category: PresetCategory;
  description: string;
  vector: SemanticVector;
  tags: string[]; // NL trigger words
  source: string; // "industry-derived" | "user-created" | "learned" | "easter-egg"
  /** Present only on easter egg presets — signals a fun event to the user. */
  easterEgg?: EasterEggMeta;
}

// ── Parameter Resolution ────────────────────────────────────────────

export interface ParameterContribution {
  dimension: string;
  dimValue: number;
  weight: number;
  contribution: number;
}

export interface ResolvedParameter {
  value: number;
  contributions: ParameterContribution[];
}

export interface ResolvedParameters {
  [parameter: string]: ResolvedParameter;
}

// ── Self-Learning Data ──────────────────────────────────────────────

/**
 * Records a user/critic correction to a SEGA-computed value.
 * Populated now, consumed by a future learning engine.
 */
export interface LearnedAdjustment {
  timestamp: number;
  dimension: string;
  parameter: string;
  targetValue: number; // what SEGA computed
  actualValue: number; // what user/critic corrected to
  delta: number; // difference (actual - target)
  context: string; // scene description for pattern matching
}

// ── Scene Semantic State ────────────────────────────────────────────

export interface SceneSemanticState {
  global: SemanticVector;
  overrides: Record<string, SemanticVector>; // objectId → override
  history: SemanticVector[]; // undo stack
  learnedAdjustments: LearnedAdjustment[];
}

// ── Berlyne Warning ─────────────────────────────────────────────────

export interface BerlyneWarning {
  dimension: string;
  value: number;
  message: string;
}
