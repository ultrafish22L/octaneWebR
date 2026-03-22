/**
 * Structured prompts for vision critique and reference analysis.
 *
 * These prompts are designed to be evaluator-agnostic — they work with
 * Claude self-critique, OTOY Studio chat_completion, or direct API calls.
 * The key improvement over v1: forces SPECIFIC MEASURABLE comparisons
 * instead of vague subjective scoring.
 */

import { mcpLogLazy } from '../OctaneMcpClient';
import type { CompositionSpec } from '../ArtDirectionState';
import { PASS_THRESHOLD, MIN_DIMENSION_SCORE } from '../ArtDirectionState';

/**
 * Build a structured critique prompt for a single render.
 * Forces measurable observations, not vague impressions.
 */
export function buildCritiquePrompt(spec: CompositionSpec): string {
  const objectList = spec.objects
    .map(
      o =>
        `- "${o.id}" (${o.role}): planned at {${o.position.x.toFixed(1)}, ${o.position.y.toFixed(1)}, ${o.position.z.toFixed(1)}}, depth layer ${o.depthLayer}`
    )
    .join('\n');

  return `You are a harsh 3D art critic. Analyze this render against the composition plan below.
BE STRICT. A score of 4+ means professional quality. Most first-draft renders deserve 2-3.

COMPOSITION PLAN:
- Focal point: "${spec.focalPoint}"
- Depth layers planned: ${spec.depthLayers}
- Composition rule: ${spec.camera.compositionRule}
- Lighting mood: ${spec.lightingMood}
- Objects:
${objectList}

MEASURE THESE SPECIFICS (don't guess — count and estimate):
- How many distinct objects are visible? (compare to ${spec.objects.length} planned)
- What fraction of the frame does the focal point "${spec.focalPoint}" occupy? (<5% = too small, >50% = too large)
- How many distinct depth planes can you identify? (count by size/fog differences)
- Where does the visual weight sit on a 3x3 grid?
- Is there clear light direction or is it flat/ambient?

SCORE each 1-5 (be harsh — 3 = acceptable, 4 = good, 5 = professional):

1. FRAMING (1-5): Subject well-framed? Not too small, not cropped? Appropriate headroom/lead room?
2. DEPTH (1-5): Can you perceive ${spec.depthLayers}+ distinct depth layers? Size diminution? Atmospheric perspective? Or flat?
3. COMPOSITION (1-5): Focal point near ${spec.camera.compositionRule} power points? Clear visual hierarchy? Good negative space?
4. LIGHTING (1-5): Clear key light direction? Shadow modeling? Mood matches "${spec.lightingMood}"? Or flat/harsh?
5. PLACEMENT (1-5): Objects at planned positions? Natural arrangement? Any clipping/floating/intersection?

For EACH score below 4, provide a SPECIFIC correction:
- target: what to change (camera_position, camera_target, object_position, object_scale, light_power, environment_power)
- objectId: which object (if applicable)
- description: exact change needed with direction and magnitude
- priority: 1=critical, 2=important, 3=polish

Respond as JSON only:
{"scores":{"framing":N,"depth":N,"composition":N,"lighting":N,"placement":N},"overall":N,"passed":BOOL,"corrections":[{"target":"...","objectId":"...","description":"...","priority":N}],"observations":"2-3 sentences of what you actually see"}

overall = average of 5 scores. passed = overall >= ${PASS_THRESHOLD} AND no score < ${MIN_DIMENSION_SCORE}.`;
}

/**
 * Build a two-image comparison prompt (render vs reference).
 * Forces the critic to identify specific differences.
 */
export function buildComparisonPrompt(spec: CompositionSpec): string {
  return `You are comparing a 3D RENDER (image 1) against a REFERENCE image (image 2).
Your job: identify SPECIFIC, MEASURABLE differences. Be harsh and precise.

REFERENCE is the target. RENDER is the attempt. Score how close the RENDER matches the REFERENCE.

COMPARE these specifics:
1. Count visible main objects in each image. Same number?
2. Compare depth: how many distinct depth layers in each? Does render have same depth spread?
3. Compare lighting: warm/cool? Direction? Contrast? Same mood?
4. Compare color palette: what are the dominant colors in each?
5. Compare composition: where is the focal point in each? Same grid position?
6. Compare scale: are objects similar relative sizes?
7. Compare atmosphere: is there fog/haze in reference? In render?

SCORE each 1-5 (how close render matches reference):

1. FRAMING (1-5): Same framing/camera angle? Same amount of scene visible?
2. DEPTH (1-5): Same depth spread? Same number of layers? Same depth cues (fog, size)?
3. COMPOSITION (1-5): Focal point in same position? Same visual weight distribution?
4. LIGHTING (1-5): Same light direction? Same warmth? Same contrast/mood?
5. PLACEMENT (1-5): Objects in similar relative positions? Similar spacing?

For scores below 4, provide SPECIFIC corrections to make render match reference better.

Respond as JSON only:
{"scores":{"framing":N,"depth":N,"composition":N,"lighting":N,"placement":N},"overall":N,"passed":BOOL,"corrections":[{"target":"...","description":"...","priority":N}],"differences":"3-4 sentences listing the biggest visual differences between render and reference"}`;
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
 * Parse a VLM response into structured critique scores.
 * Handles both clean JSON and JSON embedded in markdown/text.
 */
export function parseCritiqueResponse(response: string): {
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
  raw: string;
} | null {
  try {
    // Try direct JSON parse
    const data = JSON.parse(response);
    if (data.scores && typeof data.overall === 'number') {
      return { ...data, raw: response };
    }
  } catch (e: any) {
    mcpLogLazy('verbose', () => `[vision:parseCritique:directJSON] ${e?.message ?? e}`);
    // Try extracting JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        if (data.scores && typeof data.overall === 'number') {
          return { ...data, raw: response };
        }
      } catch (e2: any) {
        mcpLogLazy('verbose', () => `[vision:parseCritique:codeBlock] ${e2?.message ?? e2}`);
        /* continue */
      }
    }
    // Try finding JSON object in text
    const braceMatch = response.match(/\{[\s\S]*"scores"[\s\S]*\}/);
    if (braceMatch) {
      try {
        const data = JSON.parse(braceMatch[0]);
        if (data.scores && typeof data.overall === 'number') {
          return { ...data, raw: response };
        }
      } catch (e3: any) {
        mcpLogLazy('verbose', () => `[vision:parseCritique:braceMatch] ${e3?.message ?? e3}`);
        /* give up */
      }
    }
  }
  return null;
}
