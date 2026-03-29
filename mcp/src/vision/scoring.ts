/**
 * Server-side scoring — computes match scores from VLM descriptions without
 * asking the VLM for numbers. Uses SEGA dimension aliases for synonym matching.
 */

import { DIMENSIONS } from '../sega/registry';

// ── Keyword Extraction ────────────────────────────────────────────────

/** Extract keywords from a VLM description, normalized to lowercase. */
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

// ── Composition Keywords ──────────────────────────────────────────────

/** Terms that indicate composition properties — used for structured matching. */
const COMPOSITION_TERMS: Record<string, string[]> = {
  shot_type: [
    'wide shot',
    'medium shot',
    'close-up',
    'close up',
    'extreme close',
    'full body',
    'portrait',
    'landscape',
  ],
  body_visibility: [
    'fully visible',
    'head to toe',
    'full body',
    'cropped',
    'cut off',
    'truncated',
    'partial',
  ],
  ground: ['ground', 'floor', 'grass', 'hill', 'terrain', 'surface', 'earth', 'sand', 'rock'],
  framing: [
    'centered',
    'off-center',
    'left',
    'right',
    'too tight',
    'too much space',
    'well-framed',
    'well framed',
  ],
};

// ── Keyword Overlap Score ─────────────────────────────────────────────

/**
 * Score keyword overlap between render description and calibration description.
 * Uses SEGA dimension aliases as synonym sets for fuzzy matching.
 * Returns 0-1 overall match score.
 */
export function scoreKeywordOverlap(
  renderDesc: string,
  calibrationDesc: string
): { score: number; matched: string[]; missing: string[]; extra: string[] } {
  const renderWords = new Set(extractKeywords(renderDesc));
  const calibWords = new Set(extractKeywords(calibrationDesc));

  // Build synonym map from SEGA aliases
  const synonymGroups: string[][] = [];
  for (const dim of DIMENSIONS) {
    synonymGroups.push([
      ...dim.aliases,
      ...dim.negativeAliases,
      dim.positiveLabel,
      dim.negativeLabel,
    ]);
  }

  // Check which calibration keywords appear (or have synonyms) in render
  const matched: string[] = [];
  const missing: string[] = [];

  for (const calibWord of calibWords) {
    if (renderWords.has(calibWord)) {
      matched.push(calibWord);
      continue;
    }

    // Check synonym match
    let found = false;
    for (const group of synonymGroups) {
      if (group.includes(calibWord)) {
        for (const syn of group) {
          if (renderWords.has(syn)) {
            matched.push(`${calibWord}~${syn}`);
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }

    if (!found && calibWord.length > 3) {
      missing.push(calibWord);
    }
  }

  // Extra words in render not in calibration (may indicate wrong content)
  const extra: string[] = [];
  for (const word of renderWords) {
    if (!calibWords.has(word) && word.length > 4) {
      extra.push(word);
    }
  }

  const total = calibWords.size || 1;
  const score = Math.min(1, matched.length / total);

  return { score, matched, missing, extra };
}

// ── Composition Match Score ───────────────────────────────────────────

/**
 * Score composition match between render and calibration descriptions
 * using structured composition term detection.
 * Returns per-category match and overall 0-1 score.
 */
export function scoreCompositionMatch(
  renderDesc: string,
  calibrationDesc: string
): {
  score: number;
  categories: Record<string, { render: string; calibration: string; match: boolean }>;
} {
  const renderLower = renderDesc.toLowerCase();
  const calibLower = calibrationDesc.toLowerCase();

  const categories: Record<string, { render: string; calibration: string; match: boolean }> = {};
  let matchCount = 0;
  let totalCategories = 0;

  for (const [category, terms] of Object.entries(COMPOSITION_TERMS)) {
    const renderTerms = terms.filter(t => renderLower.includes(t));
    const calibTerms = terms.filter(t => calibLower.includes(t));

    if (calibTerms.length === 0 && renderTerms.length === 0) continue;

    totalCategories++;
    const renderStr = renderTerms.join(', ') || 'none detected';
    const calibStr = calibTerms.join(', ') || 'none detected';

    // Match if any term overlaps, or both have no terms
    const hasOverlap = renderTerms.some(t => calibTerms.includes(t));
    const bothEmpty = renderTerms.length === 0 && calibTerms.length === 0;
    const match = hasOverlap || bothEmpty;

    if (match) matchCount++;

    categories[category] = { render: renderStr, calibration: calibStr, match };
  }

  const score = totalCategories > 0 ? matchCount / totalCategories : 0.5;

  return { score, categories };
}

// ── Combined Score ────────────────────────────────────────────────────

export interface ServerScore {
  /** Overall match score 0-1 */
  overall: number;
  /** Keyword overlap score */
  keyword: { score: number; matched: string[]; missing: string[]; extra: string[] };
  /** Composition term match */
  composition: {
    score: number;
    categories: Record<string, { render: string; calibration: string; match: boolean }>;
  };
  /** Pixel analysis gap (optional, from PixelAnalyzer) */
  pixelGap?: { magnitude: number; worst: string[] };
  /** Server-computed pass/fail */
  passed: boolean;
}

/**
 * Compute overall server-side score from all available signals.
 * Weights: composition 50%, keyword 30%, pixel 20%.
 */
export function computeServerScore(
  renderDesc: string,
  calibrationDesc: string,
  pixelGap?: { magnitude: number; worst: string[] }
): ServerScore {
  const keyword = scoreKeywordOverlap(renderDesc, calibrationDesc);
  const composition = scoreCompositionMatch(renderDesc, calibrationDesc);

  // Weighted combination
  let overall: number;
  if (pixelGap) {
    // Pixel gap is 0=perfect, higher=worse — invert to 0-1 match score
    const pixelScore = Math.max(0, 1 - pixelGap.magnitude);
    overall = composition.score * 0.5 + keyword.score * 0.3 + pixelScore * 0.2;
  } else {
    // No pixel data — reweight
    overall = composition.score * 0.6 + keyword.score * 0.4;
  }

  return {
    overall: Math.round(overall * 100) / 100,
    keyword,
    composition,
    pixelGap,
    passed: overall >= 0.7 && composition.score >= 0.5,
  };
}
