/**
 * SEGA Guidance — contradiction detection + vagueness detection.
 *
 * Pure functions that analyze user input and SEGA vectors to provide
 * helpful guidance when requests are vague or contradictory.
 * Does NOT block — returns advisory information alongside normal results.
 *
 * Design: data-only module, no side effects. Pure lookups against registry.
 */

import type { SemanticVector } from './types';
import { DIMENSIONS, findDimensionByAlias } from './registry';

// ── Types ───────────────────────────────────────────────────────────

export interface TensionPair {
  dimA: string;
  dimB: string;
  coefficient: number;
  valA: number;
  valB: number;
  tension: number; // abs(valA * valB * abs(coefficient))
  optionA: string; // "Keep X (label), reduce Y"
  optionB: string; // "Keep Y (label), reduce X"
}

export interface ContradictionResult {
  hasTension: boolean;
  pairs: TensionPair[];
}

export interface VaguenessResult {
  isVague: boolean;
  vagueTerms: string[];
  guidingQuestion: string;
  suggestions: string[];
  presetSuggestions: string[];
}

// ── Vagueness Dictionary ────────────────────────────────────────────

interface VagueEntry {
  question: string;
  concreteOptions: string[];
  presetHints: string[];
}

const VAGUE_TERMS: Record<string, VagueEntry> = {
  cool: {
    question: 'What kind of cool?',
    concreteOptions: [
      'dramatic lighting (preset: dramatic)',
      'desaturated palette (dimension: saturation → -0.5)',
      'cold color temperature (dimension: warmth → -0.5)',
      'minimalist composition (dimension: complexity → -0.5)',
    ],
    presetHints: ['fincher', 'noir', 'moonlit'],
  },
  nice: {
    question: 'Nice in what way?',
    concreteOptions: [
      'warm and pleasant (preset: natural)',
      'clean and professional (preset: studio)',
      'soft and dreamy (preset: ethereal)',
    ],
    presetHints: ['natural', 'studio', 'ethereal'],
  },
  good: {
    question: 'Good is broad — what matters most?',
    concreteOptions: [
      'good lighting contrast (dimension: contrast → 0.5)',
      'good material detail (dimension: surface_detail → 0.5)',
      'good composition depth (dimension: depth_spread → 0.5)',
    ],
    presetHints: ['studio', 'product_clean'],
  },
  interesting: {
    question: 'Interesting how?',
    concreteOptions: [
      'unexpected camera angles (dimension: camera_angle → 0.6)',
      'high visual complexity (dimension: complexity → 0.5)',
      'unusual color palette (dimension: saturation → 0.4, warmth → -0.3)',
    ],
    presetHints: ['kubrick', 'blade_runner'],
  },
  better: {
    question: 'Better in which direction?',
    concreteOptions: [
      'more contrast/drama (dimension: contrast → +0.3)',
      'warmer/more inviting (dimension: warmth → +0.3)',
      'more detail/polish (dimension: surface_detail → +0.3)',
      'better composition (use fit_camera or adjust framing)',
    ],
    presetHints: [],
  },
  amazing: {
    question: "Amazing covers a lot of ground. What's most important?",
    concreteOptions: [
      'dramatic impact (preset: dramatic)',
      'ethereal beauty (preset: ethereal)',
      'cinematic quality (preset: villeneuve)',
    ],
    presetHints: ['dramatic', 'ethereal', 'villeneuve'],
  },
  pretty: {
    question: 'Pretty how?',
    concreteOptions: [
      'soft and delicate (preset: ethereal)',
      'warm golden light (preset: golden_hour)',
      'rich and colorful (dimension: saturation → 0.5, pleasure → 0.5)',
    ],
    presetHints: ['ethereal', 'golden_hour'],
  },
};

// ── Contradiction Detection ─────────────────────────────────────────

/**
 * Detect contradictions in a SEGA vector by checking inverse correlations.
 *
 * Flags when two dimensions with correlation < -0.5 are both pushed
 * in the same direction (both positive or both active with opposing intent).
 * Only flags when both |value| >= 0.3 to avoid noise from mild settings.
 *
 * Returns up to 3 tensions sorted by severity.
 */
export function detectContradictions(vector: SemanticVector): ContradictionResult {
  const pairs: TensionPair[] = [];
  const activeDims = Object.entries(vector).filter(([, v]) => Math.abs(v) >= 0.3);

  for (const [nameA, valA] of activeDims) {
    const dimDef = DIMENSIONS.find(d => d.name === nameA);
    if (!dimDef) continue;

    for (const corr of dimDef.correlations) {
      if (corr.coefficient >= -0.5) continue; // only strong inverse

      const valB = vector[corr.dimension];
      if (valB === undefined || Math.abs(valB) < 0.3) continue;

      // Tension = both pushed same sign despite inverse correlation
      // e.g., dominance:+0.7 and intimacy:+0.5 (they should oppose)
      if (Math.sign(valA) === Math.sign(valB)) {
        const tension = Math.abs(valA * valB * Math.abs(corr.coefficient));

        // Avoid duplicate pairs (A→B and B→A)
        const key = [nameA, corr.dimension].sort().join(':');
        if (pairs.some(p => [p.dimA, p.dimB].sort().join(':') === key)) continue;

        const dimA = DIMENSIONS.find(d => d.name === nameA)!;
        const dimB = DIMENSIONS.find(d => d.name === corr.dimension)!;

        pairs.push({
          dimA: nameA,
          dimB: corr.dimension,
          coefficient: corr.coefficient,
          valA,
          valB,
          tension,
          optionA: `Keep ${nameA} (${valA > 0 ? dimA.positiveLabel : dimA.negativeLabel}), reduce ${corr.dimension}`,
          optionB: `Keep ${corr.dimension} (${valB > 0 ? dimB.positiveLabel : dimB.negativeLabel}), reduce ${nameA}`,
        });
      }
    }
  }

  // Sort by tension severity, cap at 3
  pairs.sort((a, b) => b.tension - a.tension);
  const top = pairs.slice(0, 3);

  return {
    hasTension: top.length > 0,
    pairs: top,
  };
}

/**
 * Detect contradictions in a natural language string by mapping words
 * to SEGA dimensions via aliases, then checking for inverse correlations.
 *
 * Example: "warm and icy" → warmth:+1 and warmth:-1 (same dim, opposing)
 * Example: "intimate landscape" → intimacy:+1 and dominance:+1 (inverse corr)
 */
export function detectNLContradictions(input: string): ContradictionResult | null {
  const words = input
    .toLowerCase()
    .split(/[\s,;.!?]+/)
    .filter(Boolean);
  if (words.length === 0) return null;

  // Map words to implied dimension/polarity pairs
  const implied: Map<string, number[]> = new Map();

  for (const word of words) {
    for (const dim of DIMENSIONS) {
      if (dim.aliases.some(a => a === word)) {
        const arr = implied.get(dim.name) || [];
        arr.push(0.5); // positive alias → positive value
        implied.set(dim.name, arr);
      }
      if (dim.negativeAliases.some(a => a === word)) {
        const arr = implied.get(dim.name) || [];
        arr.push(-0.5); // negative alias → negative value
        implied.set(dim.name, arr);
      }
    }
  }

  // Check for same-dimension contradictions (e.g., "warm and icy" both map to warmth)
  for (const [, vals] of implied) {
    const hasPos = vals.some(v => v > 0);
    const hasNeg = vals.some(v => v < 0);
    if (hasPos && hasNeg) {
      // Same dimension pulled both ways — build a synthetic vector to report
      const syntheticVector: SemanticVector = {};
      for (const [dim, dimVals] of implied) {
        syntheticVector[dim] = dimVals.reduce((a, b) => a + b, 0) / dimVals.length;
      }
      // Return with a custom message about within-dimension conflict
      return {
        hasTension: true,
        pairs: [
          {
            dimA: [...implied.entries()].find(
              ([, v]) => v.some(x => x > 0) && v.some(x => x < 0)
            )![0],
            dimB: '(same dimension)',
            coefficient: -1,
            valA: 0.5,
            valB: -0.5,
            tension: 1.0,
            optionA: 'Use the positive direction (e.g., warm)',
            optionB: 'Use the negative direction (e.g., cool/icy)',
          },
        ],
      };
    }
  }

  // Check for cross-dimension contradictions via correlation
  const avgVector: SemanticVector = {};
  for (const [dim, vals] of implied) {
    avgVector[dim] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  if (Object.keys(avgVector).length < 2) return null;
  const result = detectContradictions(avgVector);
  return result.hasTension ? result : null;
}

// ── Vagueness Detection ─────────────────────────────────────────────

/**
 * Detect vague/low-information natural language input.
 *
 * Returns guidance when the input contains only vague terms and no
 * specific dimension aliases. Mixed inputs (vague + specific) are not
 * flagged — the specific parts carry enough signal.
 */
export function detectVagueness(input: string): VaguenessResult {
  const lower = input.toLowerCase().trim();
  const words = lower.split(/[\s,;.!?]+/).filter(w => w.length > 1);

  if (words.length === 0) {
    return {
      isVague: false,
      vagueTerms: [],
      guidingQuestion: '',
      suggestions: [],
      presetSuggestions: [],
    };
  }

  // Find vague terms
  const foundVague: string[] = [];
  for (const w of words) {
    if (VAGUE_TERMS[w]) foundVague.push(w);
  }

  if (foundVague.length === 0) {
    return {
      isVague: false,
      vagueTerms: [],
      guidingQuestion: '',
      suggestions: [],
      presetSuggestions: [],
    };
  }

  // Check if there are also specific dimension aliases
  let hasSpecific = false;
  for (const w of words) {
    if (VAGUE_TERMS[w]) continue; // skip vague terms themselves
    // Skip common filler words
    if (
      [
        'make',
        'it',
        'the',
        'a',
        'an',
        'more',
        'very',
        'really',
        'so',
        'and',
        'but',
        'or',
        'something',
        'look',
        'looks',
        'like',
      ].includes(w)
    )
      continue;
    const match = findDimensionByAlias(w);
    if (match) {
      hasSpecific = true;
      break;
    }
  }

  // If there are specific terms too, don't flag as vague
  if (hasSpecific) {
    return {
      isVague: false,
      vagueTerms: foundVague,
      guidingQuestion: '',
      suggestions: [],
      presetSuggestions: [],
    };
  }

  // Build combined guidance from all found vague terms
  const allSuggestions: string[] = [];
  const allPresets: string[] = [];
  let question = '';

  for (const vt of foundVague) {
    const entry = VAGUE_TERMS[vt];
    if (!question) question = entry.question; // use first vague term's question
    allSuggestions.push(...entry.concreteOptions);
    allPresets.push(...entry.presetHints);
  }

  return {
    isVague: true,
    vagueTerms: foundVague,
    guidingQuestion: question,
    suggestions: [...new Set(allSuggestions)],
    presetSuggestions: [...new Set(allPresets)],
  };
}
