/**
 * Fuzzy matching — "did you mean?" for materials, presets, and dimensions.
 *
 * Pure functions, zero external dependencies. Uses Levenshtein distance
 * for typo correction and keyword matching for semantic search.
 */

// ── Levenshtein distance ────────────────────────────────────────────

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ── Types ───────────────────────────────────────────────────────────

export interface FuzzyMatch {
  name: string;
  distance: number;
}

export interface FuzzyMatchResult {
  exactMatch: boolean;
  suggestions: FuzzyMatch[];
  didYouMean?: string;
}

// ── Core fuzzy search ───────────────────────────────────────────────

function maxDistance(input: string): number {
  return Math.max(2, Math.floor(input.length / 3));
}

/**
 * Fuzzy-match an input string against a list of candidate strings.
 * Returns sorted suggestions within the edit distance threshold.
 */
export function fuzzySearch(input: string, candidates: string[]): FuzzyMatchResult {
  const lower = input.toLowerCase();
  if (candidates.includes(lower)) {
    return { exactMatch: true, suggestions: [] };
  }

  const threshold = maxDistance(lower);
  const hits: FuzzyMatch[] = [];

  for (const c of candidates) {
    const d = levenshtein(lower, c.toLowerCase());
    if (d <= threshold) {
      hits.push({ name: c, distance: d });
    }
  }

  hits.sort((a, b) => a.distance - b.distance);
  const top = hits.slice(0, 5);

  return {
    exactMatch: false,
    suggestions: top,
    didYouMean: top.length > 0 ? top[0].name : undefined,
  };
}

// ── Material-specific fuzzy match ───────────────────────────────────

/**
 * Fuzzy-match against material names + alias keys.
 * Call with the exported keys from materials.ts.
 */
export function fuzzyMatchMaterial(
  input: string,
  materialKeys: string[],
  aliasKeys: string[]
): FuzzyMatchResult {
  const allKeys = [...new Set([...materialKeys, ...aliasKeys])];
  return fuzzySearch(input, allKeys);
}

/**
 * Keyword-based semantic search against material notes.
 * Returns material names whose notes contain any of the input words.
 */
export function semanticMaterialSearch(
  input: string,
  materials: Record<string, { notes: string }>
): string[] {
  const words = input
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2);
  if (words.length === 0) return [];

  const results: string[] = [];
  for (const [name, mat] of Object.entries(materials)) {
    const haystack = `${name} ${mat.notes}`.toLowerCase();
    if (words.some(w => haystack.includes(w))) {
      results.push(name);
    }
  }
  return results;
}

// ── Preset fuzzy match ──────────────────────────────────────────────

/**
 * Fuzzy-match against preset names + tags.
 */
export function fuzzyMatchPreset(
  input: string,
  presetNames: string[],
  presetTags: string[]
): FuzzyMatchResult {
  const allKeys = [...new Set([...presetNames, ...presetTags])];
  return fuzzySearch(input, allKeys);
}
