/**
 * Vision score prompts — description-first approach.
 *
 * VLM describes what it sees in natural language (its strength),
 * then provides minimal numeric scores. All scoring math (weighting,
 * framing gate, pass/fail) stays server-side in normalizeScores().
 */

import { mcpLogLazy } from '../OctaneMcpClient';
import type { CompositionSpec } from '../ArtDirectionState';

/**
 * Build a structured score prompt for a single render.
 * Forces measurable observations, not vague impressions.
 */
export function buildScorePrompt(spec: CompositionSpec): string {
  const objectList = spec.objects.map(o => `  - "${o.id}" (${o.role})`).join('\n');

  return `Look at this 3D render and check the COMPOSITION against the plan below.
Ignore lighting, color, and mood for now — focus only on what is visible and how it is framed.

THE PLAN:
- Scene: "${spec.description}"
- Focal point: "${spec.focalPoint}" (${spec.camera.compositionRule})
- Expected objects:
${objectList}

Answer each question:
1. Is the main subject ("${spec.focalPoint}") fully visible — head to toe, no cropping? Or is part of it cut off?
2. Is this a wide shot, medium shot, or close-up? The plan calls for the full scene to be visible.
3. Is the ground/floor visible? How much of the frame does it take up?
4. List every object you can see. Compare to the expected objects above — what is missing?
5. Where is the main subject positioned in the frame (center, left, right, top, bottom)?
6. How much empty space surrounds the subject? Too tight, about right, or too much?
7. What is the single most important composition fix needed?`;
}

/**
 * Build a calibration prompt for concept art — same composition questions as score
 * but without "THE PLAN" section (the concept art IS the plan).
 * Run once per scene, cache the result as the VLM calibration baseline.
 */
export function buildCalibrationPrompt(): string {
  return `Look at this image and describe its composition in detail.
Ignore artistic style and color — focus only on what is visible and how it is framed.

Answer each question:
1. Is the main subject fully visible — head to toe, no cropping? Or is part of it cut off?
2. Is this a wide shot, medium shot, or close-up?
3. Is the ground/floor visible? How much of the frame does it take up?
4. List every distinct object or element you can see.
5. Where is the main subject positioned in the frame (center, left, right, top, bottom)?
6. How much empty space surrounds the subject? Tight framing, about right, or lots of space?
7. Describe the overall composition in one sentence.`;
}

/**
 * Build a reference analysis prompt to extract structured composition data.
 */
export function buildReferenceAnalysisPrompt(sceneDescription: string, scaleHint: number): string {
  return `Analyze this reference image for 3D scene reconstruction.
Extract PRECISE, MEASURABLE data — no vague descriptions.

Scene: "${sceneDescription}"
Scale: ${scaleHint} world units across the full scene width.

Extract as JSON:

{
  "objects": [
    {
      "id": "descriptive_name",
      "role": "hero|secondary|accent|ground|light|environment",
      "relative_position": {"x": -1..1, "y": -1..1, "z": -1..1},
      "depth_layer": 0,
      "approximate_scale": {"x": 0.1, "y": 0.2, "z": 0.1},
      "notes": "brief description"
    }
  ],
  "camera": {
    "elevation_deg": -10,
    "distance": "close|medium|far",
    "fov": "narrow|normal|wide"
  },
  "lighting": {
    "key_direction": {"x": 0.5, "y": 0.7, "z": -0.5},
    "warmth": "warm|neutral|cool",
    "fill_ratio": 0.3,
    "mood": "dramatic|natural|studio|ethereal|noir"
  },
  "depth": {
    "layer_count": 3,
    "cues": ["fog", "size_diminution", "overlap", "color_shift"],
    "total_depth": "shallow|medium|deep"
  },
  "composition": {
    "rule": "rule-of-thirds|centered|golden-ratio|diagonal",
    "focal_point_id": "main_subject",
    "negative_space": "top|bottom|left|right|center",
    "framing_notes": "how the scene is framed"
  }
}

IMPORTANT: Position coordinates use:
- x: -1 = far left, 0 = center, +1 = far right
- y: -1 = bottom, 0 = center, +1 = top
- z: -1 = far background, 0 = midground, +1 = close foreground
Scale by ${scaleHint} to get world-space coordinates.`;
}

/**
 * Build a context-aware comparison prompt for concept art vs render (two images).
 * Uses AdContext to tailor scoring to current phase, iteration, and mood target.
 */
export function buildComparisonScorePrompt(ctx: import('../ArtDirectionState').AdContext): string {
  // Build expected objects list from context
  const objectList =
    ctx.objects.length > 0
      ? `\nExpected objects: ${ctx.objects.map(o => `${o.id} (${o.role})`).join(', ')}.`
      : '';

  // ── CLAY MODE (Phase 1) ──────────────────────────────────────────
  if (ctx.isClay) {
    return `Image 1 is the concept art. Image 2 is a CLAY MODE 3D render.
${objectList}

CLAY MODE RULES — read these before scoring:
- Clay mode replaces ALL materials with uniform flat color. There are NO textures, NO reflections, NO darkness, NO lighting effects. This is intentional.
- Do NOT penalize for: missing darkness/shadows, missing reflections, missing material properties (marble, metal, glass), wrong colors, missing mood/atmosphere, missing environmental lighting. These CANNOT exist in clay mode and will be added later.
- Do NOT list material or lighting properties in missing_elements. "Reflective floor", "dark background", "dramatic lighting" are NOT missing — they are disabled.
- ONLY evaluate: Are the correct SHAPES present? Are they in the right POSITIONS relative to each other? Is the CAMERA ANGLE similar? Do the SILHOUETTES and SCALE RELATIONSHIPS match?

Score composition_match 1-5 based ONLY on spatial layout:
5 = all objects present, correct positions, camera matches concept
4 = objects present with minor position/scale differences
3 = key objects present, rough layout matches
2 = some objects missing or major position errors
1 = layout doesn't match concept at all

Answer as JSON: { "grade": "C+", "composition_match": 3, "lighting_match": 3, "material_match": 3, "mood_match": 3, "depth_match": 3, "missing_elements": [], "top_fixes": [], "notes": "" }
IMPORTANT: In clay mode, lighting_match, material_match, mood_match, and depth_match MUST be 3 (neutral). Only composition_match matters. missing_elements should ONLY list missing GEOMETRY (objects/shapes), never materials or lighting.`;
  }

  // ── FULL RENDER (Phase 2+) ───────────────────────────────────────

  // Build mood description from SEGA intent
  let moodLine = '';
  if (ctx.segaActiveDimensions.length > 0) {
    const dims = ctx.segaActiveDimensions
      .map(d => {
        const v = ctx.segaIntent[d];
        const label = v > 0.3 ? 'high' : v < -0.3 ? 'low' : 'moderate';
        return `${label} ${d}`;
      })
      .slice(0, 5)
      .join(', ');
    moodLine = `\nTarget mood: ${dims}.${ctx.lightingMood ? ` Lighting mood: ${ctx.lightingMood}.` : ''}`;
  }

  // Build iteration context
  let iterationLine = '';
  if (ctx.iteration > 1 && ctx.previousGrade) {
    iterationLine = `\nIteration ${ctx.iteration}. Previous grade: ${ctx.previousGrade}.`;
    if (ctx.previousFixes.length > 0) {
      iterationLine += ` Previous top fixes: ${ctx.previousFixes.join('; ')}.`;
    }
    iterationLine += ' Evaluate whether previous issues were addressed.';
  }
  if (ctx.stagnating) {
    iterationLine +=
      '\n⚠️ Scene is STAGNATING (last 2 iterations showed <0.3 improvement). Recommend large structural changes, not tweaks.';
  }

  return `Image 1 is the concept art. Image 2 is the 3D render.
${objectList}${moodLine}${iterationLine}

Compare the render against the concept art. Grade A-F.

Score each dimension 1-5:
- composition_match: Object placement, camera angle, framing, spatial layout
- lighting_match: Light direction, shadow quality, contrast, temperature
- material_match: Surface quality, roughness, reflectivity, texture detail
- mood_match: Overall atmosphere, color palette, emotional tone vs target
- depth_match: Foreground/mid/background separation, depth cues, scale

Grade scale: A=exceptional, B=good (minor issues), C=acceptable (clear issues), D=poor (major problems), F=fundamentally wrong.

Answer as JSON: { "grade": "C+", "composition_match": 3, "lighting_match": 3, "material_match": 3, "mood_match": 3, "depth_match": 3, "missing_elements": [], "top_fixes": [], "notes": "" }
top_fixes: max 3 items, most impactful first. notes: max 1 sentence.`;
}

/**
 * Parse a VLM response into structured score scores.
 * Handles both clean JSON and JSON embedded in markdown/text.
 */
/**
 * Coerce a score value to a valid number 1-5.
 * Handles string numbers ("3"), floats (3.5), and clamps to range.
 * Returns null if value is not a usable number.
 */
function coerceScore(v: unknown): number | null {
  if (typeof v === 'number' && !isNaN(v)) return Math.max(1, Math.min(5, v));
  if (typeof v === 'string') {
    const n = parseFloat(v);
    if (!isNaN(n)) return Math.max(1, Math.min(5, n));
  }
  return null;
}

/**
 * Normalize a parsed JSON object into valid score scores.
 * Handles VLM quirks: string numbers, missing fields, out-of-range values.
 */
export interface NormalizedScore {
  scores: {
    framing: number;
    depth: number;
    composition: number;
    lighting: number;
    placement: number;
  };
  overall: number;
  passed: boolean;
  corrections: Array<{ target: string; objectId?: string; description: string; priority: number }>;
  description: string;
  differences: string;
  topFix: string;
  raw: string;
}

function normalizeScores(data: any): NormalizedScore | null {
  // Accept scores at top level (new format) or nested in scores:{} (old format)
  const s = data?.scores ?? data;
  if (!s) return null;

  const framing = coerceScore(s.framing);
  const depth = coerceScore(s.depth);
  const composition = coerceScore(s.composition);
  const lighting = coerceScore(s.lighting);
  const placement = coerceScore(s.placement);

  // Need at least 3 valid scores to be usable
  const validCount = [framing, depth, composition, lighting, placement].filter(
    v => v !== null
  ).length;
  if (validCount < 3) return null;

  const scores = {
    framing: framing ?? 3,
    depth: depth ?? 3,
    composition: composition ?? 3,
    lighting: lighting ?? 3,
    placement: placement ?? 3,
  };

  // Recompute overall server-side (don't trust VLM math)
  const weighted =
    (scores.framing * 2 +
      scores.placement * 1.5 +
      scores.composition * 1.5 +
      scores.depth * 1 +
      scores.lighting * 1) /
    7;
  const overall = scores.framing < 3 ? Math.min(weighted, 2.5) : weighted;

  const allAboveMin = Object.values(scores).every(v => v >= 1.5);
  const passed = overall >= 4.0 && scores.framing >= 3 && allAboveMin;

  // Extract text fields from either top-level data or nested
  const description = data?.description || data?.render_description || '';
  const differences = data?.differences || data?.matches_plan || '';
  const topFix = data?.top_fix || '';

  // Legacy corrections array (old format) — convert top_fix to corrections if needed
  let corrections: Array<{
    target: string;
    objectId?: string;
    description: string;
    priority: number;
  }> = [];
  if (Array.isArray(data?.corrections)) {
    corrections = data.corrections;
  } else if (topFix) {
    corrections = [{ target: 'scene', description: topFix, priority: 1 }];
  }

  return {
    scores,
    overall: Math.round(overall * 10) / 10,
    passed,
    corrections,
    description,
    differences,
    topFix,
    raw: JSON.stringify(data),
  };
}

export function parseScoreResponse(response: string): NormalizedScore | null {
  // Candidates to try parsing, in order of confidence
  const candidates: string[] = [response];

  // Extract from markdown code blocks
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) candidates.push(jsonMatch[1]);

  // Extract bare JSON object containing "scores"
  const braceMatch = response.match(/\{[\s\S]*"scores"[\s\S]*\}/);
  if (braceMatch) candidates.push(braceMatch[0]);

  for (const candidate of candidates) {
    try {
      const data = JSON.parse(candidate);
      const result = normalizeScores(data);
      if (result) return result;
    } catch {
      // Try repairing truncated JSON
      let repaired = candidate.trim().replace(/,\s*$/, '');
      const opens = (repaired.match(/\[/g) || []).length;
      const closes = (repaired.match(/\]/g) || []).length;
      const openBraces = (repaired.match(/\{/g) || []).length;
      const closeBraces = (repaired.match(/\}/g) || []).length;
      for (let i = 0; i < opens - closes; i++) repaired += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
      try {
        const data = JSON.parse(repaired);
        const result = normalizeScores(data);
        if (result) {
          mcpLogLazy('info', () => `[vision:parseScore] repaired truncated JSON`);
          return result;
        }
      } catch {
        /* truly unparseable */
      }
    }
  }

  // Description-only response (no JSON / no scores) — treat raw text as description
  if (response.trim().length > 20) {
    mcpLogLazy('info', () => `[vision:parseScore] no JSON found, using raw text as description`);
    return {
      scores: { framing: 3, depth: 3, composition: 3, lighting: 3, placement: 3 },
      overall: 3,
      passed: false,
      corrections: [],
      description: response.trim(),
      differences: '',
      topFix: '',
      raw: response,
    };
  }

  return null;
}
