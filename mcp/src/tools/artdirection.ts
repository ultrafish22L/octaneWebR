/**
 * Art Direction Tools — plan_composition, validate_layout, analyze_reference,
 * critique_render, apply_corrections, get_art_direction_state
 *
 * Solves two problems:
 * 1. Spatial reasoning: math-based validation BEFORE rendering (no guessing)
 * 2. Quality control: structured critique loop with stagnation detection
 *
 * Tools 1-3 are pure math (no Octane calls, fully testable).
 * Tools 4-5 use existing gRPC calls (save_render).
 * Tool 6 is read-only state inspection.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { OctaneMcpClient } from '../OctaneMcpClient';
import {
  ArtDirectionState,
  CompositionSpec,
  CritiqueRecord,
  PASS_THRESHOLD,
  MIN_DIMENSION_SCORE,
  MAX_ITERATIONS,
  Vec3,
  ObjectPlacement,
  CameraSpec,
} from '../ArtDirectionState';
import { jsonResult, errorResult, validateFilePath } from './utils';
import {
  ScenePlacementState,
  type PlacementRole,
  type ScenePlacementEntry,
  type AABB,
} from '../ScenePlacementState';
import {
  critiqueRender as visionCritique,
  analyzeReference as visionAnalyze,
  detectBackend,
} from '../vision/index';
import {
  buildCritiquePrompt as buildVisionCritiquePrompt,
  buildComparisonPrompt,
  buildReferenceAnalysisPrompt as buildVisionRefPrompt,
} from '../vision/prompts';

// ── Vector math helpers ──────────────────────────────────────────────

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vec3Length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function vec3Normalize(v: Vec3): Vec3 {
  const len = vec3Length(v);
  if (len < 1e-9) return { x: 0, y: 0, z: 1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function vec3Dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function vec3Distance(a: Vec3, b: Vec3): number {
  return vec3Length(vec3Sub(a, b));
}

function vec3Min(a: Vec3, b: Vec3): Vec3 {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), z: Math.min(a.z, b.z) };
}

function vec3Max(a: Vec3, b: Vec3): Vec3 {
  return { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y), z: Math.max(a.z, b.z) };
}

function degToRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// ── Composition grid helpers ─────────────────────────────────────────

interface ScreenPos {
  u: number; // 0=left, 1=right
  v: number; // 0=top, 1=bottom
}

/**
 * Project a world-space point onto screen [0,1]x[0,1] given camera spec.
 * Uses a simple pinhole model — sufficient for composition validation.
 */
export function projectToScreen(point: Vec3, cam: CameraSpec, aspectRatio = 1): ScreenPos {
  const forward = vec3Normalize(vec3Sub(cam.target, cam.position));
  const up = vec3Normalize(cam.up);
  // Right vector = forward × up
  const right: Vec3 = {
    x: forward.y * up.z - forward.z * up.y,
    y: forward.z * up.x - forward.x * up.z,
    z: forward.x * up.y - forward.y * up.x,
  };
  const rightN = vec3Normalize(right);
  // Recompute up = right × forward (orthogonal)
  const upN: Vec3 = {
    x: rightN.y * forward.z - rightN.z * forward.y,
    y: rightN.z * forward.x - rightN.x * forward.z,
    z: rightN.x * forward.y - rightN.y * forward.x,
  };

  const toPoint = vec3Sub(point, cam.position);
  const depth = vec3Dot(toPoint, forward);
  if (depth <= 0) return { u: -1, v: -1 }; // behind camera

  const halfFovRad = degToRad(cam.fovHorizontalDeg / 2);
  const halfWidth = Math.tan(halfFovRad) * depth;
  const halfHeight = halfWidth / aspectRatio; // width/height ratio (e.g. 16/9 = 1.778)

  const screenX = vec3Dot(toPoint, rightN);
  const screenY = vec3Dot(toPoint, upN);

  const u = 0.5 + screenX / (2 * halfWidth);
  const v = 0.5 - screenY / (2 * halfHeight);
  return { u, v };
}

function getGridPoints(rule: string): ScreenPos[] {
  switch (rule) {
    case 'rule-of-thirds':
      return [
        { u: 1 / 3, v: 1 / 3 },
        { u: 2 / 3, v: 1 / 3 },
        { u: 1 / 3, v: 2 / 3 },
        { u: 2 / 3, v: 2 / 3 },
      ];
    case 'golden-ratio': {
      const g = 1 / 1.618;
      return [
        { u: g, v: g },
        { u: 1 - g, v: g },
        { u: g, v: 1 - g },
        { u: 1 - g, v: 1 - g },
      ];
    }
    case 'centered':
      return [{ u: 0.5, v: 0.5 }];
    case 'diagonal':
      return [
        { u: 0.25, v: 0.25 },
        { u: 0.75, v: 0.75 },
        { u: 0.25, v: 0.75 },
        { u: 0.75, v: 0.25 },
      ];
    default:
      return [{ u: 0.5, v: 0.5 }];
  }
}

function screenDist(a: ScreenPos, b: ScreenPos): number {
  return Math.sqrt((a.u - b.u) ** 2 + (a.v - b.v) ** 2);
}

// ── Geometric validation ─────────────────────────────────────────────

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  object?: string;
  message: string;
  fix: string;
}

export interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
  summary: string;
}

export function validateComposition(spec: CompositionSpec): ValidationResult {
  const issues: ValidationIssue[] = [];
  const camDir = vec3Normalize(vec3Sub(spec.camera.target, spec.camera.position));
  const halfFovRad = degToRad(spec.camera.fovHorizontalDeg / 2);

  // 1. Frustum check
  for (const obj of spec.objects) {
    const toObj = vec3Sub(obj.position, spec.camera.position);
    const toObjN = vec3Normalize(toObj);
    const angleCos = vec3Dot(camDir, toObjN);
    const angle = Math.acos(Math.min(1, Math.max(-1, angleCos)));
    if (angle > halfFovRad * 1.2) {
      issues.push({
        severity: 'error',
        object: obj.id,
        message: `"${obj.id}" outside frustum (${((angle * 180) / Math.PI).toFixed(1)}° > FOV/2 ${((halfFovRad * 180) / Math.PI).toFixed(1)}°)`,
        fix: `Move camera back, widen FOV, or reposition "${obj.id}"`,
      });
    }
    if (vec3Dot(toObj, camDir) <= 0) {
      issues.push({
        severity: 'error',
        object: obj.id,
        message: `"${obj.id}" is behind the camera`,
        fix: `Move it in front of camera or adjust camera position`,
      });
    }
  }

  // 2. Depth layer separation
  const layerDepths = new Map<number, number[]>();
  for (const obj of spec.objects) {
    const depth = vec3Dot(vec3Sub(obj.position, spec.camera.position), camDir);
    if (!layerDepths.has(obj.depthLayer)) layerDepths.set(obj.depthLayer, []);
    layerDepths.get(obj.depthLayer)!.push(depth);
  }
  const sortedLayers = [...layerDepths.keys()].sort((a, b) => a - b);
  if (sortedLayers.length > 1) {
    const allDepths = [...layerDepths.values()].flat();
    const sceneDepth = Math.max(...allDepths) - Math.min(...allDepths);
    for (let i = 1; i < sortedLayers.length; i++) {
      const prevAvg =
        layerDepths.get(sortedLayers[i - 1])!.reduce((s, d) => s + d, 0) /
        layerDepths.get(sortedLayers[i - 1])!.length;
      const currAvg =
        layerDepths.get(sortedLayers[i])!.reduce((s, d) => s + d, 0) /
        layerDepths.get(sortedLayers[i])!.length;
      const sep = Math.abs(currAvg - prevAvg);
      if (sceneDepth > 0 && sep < sceneDepth * 0.15) {
        issues.push({
          severity: 'warning',
          message: `Layers ${sortedLayers[i - 1]}→${sortedLayers[i]}: only ${sep.toFixed(1)} units apart (${((sep / sceneDepth) * 100).toFixed(0)}%). Will look flat.`,
          fix: `Increase Z separation to ≥${(sceneDepth * 0.15).toFixed(1)} units`,
        });
      }
    }
  }

  // 3. Object proximity
  for (let i = 0; i < spec.objects.length; i++) {
    for (let j = i + 1; j < spec.objects.length; j++) {
      const dist = vec3Distance(spec.objects[i].position, spec.objects[j].position);
      if (dist < 0.5) {
        issues.push({
          severity: 'warning',
          object: `${spec.objects[i].id}/${spec.objects[j].id}`,
          message: `"${spec.objects[i].id}" and "${spec.objects[j].id}" are ${dist.toFixed(2)} units apart — may clip`,
          fix: `Separate by ≥0.5 units`,
        });
      }
    }
  }

  // 4. Composition grid alignment
  const focalObj = spec.objects.find(o => o.id === spec.focalPoint);
  if (focalObj) {
    const screenPos = projectToScreen(focalObj.position, spec.camera);
    if (screenPos.u >= 0 && screenPos.v >= 0) {
      const gridPoints = getGridPoints(spec.camera.compositionRule);
      let minDist = Infinity;
      for (const gp of gridPoints) {
        const d = screenDist(screenPos, gp);
        if (d < minDist) minDist = d;
      }
      if (minDist > 0.15) {
        issues.push({
          severity: 'info',
          object: spec.focalPoint,
          message: `Focal "${spec.focalPoint}" is ${(minDist * 100).toFixed(0)}% off ${spec.camera.compositionRule} grid (screen u=${screenPos.u.toFixed(2)} v=${screenPos.v.toFixed(2)})`,
          fix: `Adjust camera or object to align with composition grid`,
        });
      }
    }
  } else if (spec.focalPoint) {
    issues.push({
      severity: 'warning',
      message: `Focal point "${spec.focalPoint}" not found in objects`,
      fix: `Add object with id "${spec.focalPoint}" or change focalPoint`,
    });
  }

  // 5. Lighting angle check
  const lights = spec.objects.filter(o => o.role === 'light');
  if (lights.length > 0 && focalObj) {
    const camToSubject = vec3Normalize(vec3Sub(focalObj.position, spec.camera.position));
    for (const light of lights) {
      const lightToSubject = vec3Normalize(vec3Sub(focalObj.position, light.position));
      const cosAngle = vec3Dot(camToSubject, lightToSubject);
      const angle = Math.acos(Math.min(1, Math.max(-1, cosAngle))) * (180 / Math.PI);
      if (angle < 15) {
        issues.push({
          severity: 'warning',
          object: light.id,
          message: `Light "${light.id}" at ${angle.toFixed(0)}° from camera axis — flat lighting`,
          fix: `Move to 30-60° from camera-subject axis`,
        });
      }
    }
  }

  // 6. Hero screen-space coverage check
  if (focalObj) {
    const screenCenter = projectToScreen(focalObj.position, spec.camera);
    if (screenCenter.u >= 0 && screenCenter.v >= 0) {
      // Estimate hero extent from scale or default 1 unit
      const halfExtent = focalObj.scale
        ? Math.max(focalObj.scale.x, focalObj.scale.y, focalObj.scale.z) / 2
        : 0.5;
      const topLeft = projectToScreen(
        {
          x: focalObj.position.x - halfExtent,
          y: focalObj.position.y + halfExtent,
          z: focalObj.position.z,
        },
        spec.camera
      );
      const bottomRight = projectToScreen(
        {
          x: focalObj.position.x + halfExtent,
          y: focalObj.position.y - halfExtent,
          z: focalObj.position.z,
        },
        spec.camera
      );
      if (topLeft.u >= 0 && bottomRight.u >= 0) {
        const heroWidth = Math.abs(bottomRight.u - topLeft.u);
        const heroHeight = Math.abs(bottomRight.v - topLeft.v);
        const heroArea = heroWidth * heroHeight;
        if (heroArea < 0.05) {
          issues.push({
            severity: 'error',
            object: spec.focalPoint,
            message: `Hero "${spec.focalPoint}" covers only ${(heroArea * 100).toFixed(1)}% of frame — too small`,
            fix: 'Move camera closer or increase object scale',
          });
        } else if (heroArea < 0.1) {
          issues.push({
            severity: 'warning',
            object: spec.focalPoint,
            message: `Hero "${spec.focalPoint}" covers ${(heroArea * 100).toFixed(1)}% of frame — consider tighter framing`,
            fix: 'Move camera closer to fill more of the frame',
          });
        } else if (heroArea > 0.85) {
          issues.push({
            severity: 'warning',
            object: spec.focalPoint,
            message: `Hero "${spec.focalPoint}" covers ${(heroArea * 100).toFixed(1)}% of frame — may be clipped`,
            fix: 'Move camera back or reduce object scale',
          });
        }
      }
    }
  }

  // 7. Floor/empty space check — hero pushed to bottom of frame
  if (focalObj) {
    // Project hero's bottom edge (position is base) and top edge to screen
    const heroBottomY = focalObj.position.y;
    const heroTopY = focalObj.position.y + (focalObj.scale?.y ?? 1);
    const heroBottom = projectToScreen(
      { x: focalObj.position.x, y: heroBottomY, z: focalObj.position.z },
      spec.camera
    );
    const heroTop = projectToScreen(
      { x: focalObj.position.x, y: heroTopY, z: focalObj.position.z },
      spec.camera
    );
    if (heroBottom.u >= 0 && heroBottom.v > 0.85) {
      issues.push({
        severity: 'warning',
        object: spec.focalPoint,
        message: `Hero "${spec.focalPoint}" pushed to bottom of frame (v=${heroBottom.v.toFixed(2)}) — too much floor/sky visible`,
        fix: 'Lower camera elevation or adjust camera target to hero center',
      });
    }
    if (heroTop.u >= 0 && heroTop.v < 0.05) {
      issues.push({
        severity: 'warning',
        object: spec.focalPoint,
        message: `Hero "${spec.focalPoint}" clipped at top of frame (v=${heroTop.v.toFixed(2)})`,
        fix: 'Move camera back or lower target to include full hero',
      });
    }
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warning').length;
  return {
    passed: errorCount === 0,
    issues,
    summary: `${issues.length} issues (${errorCount} errors, ${warnCount} warnings). ${errorCount === 0 ? 'PASSED' : 'FAILED'}`,
  };
}

// ── Scene extent / camera helpers ────────────────────────────────────

function computeSceneExtents(
  objects: ObjectPlacement[],
  excludeRoles: string[] = ['ground', 'light', 'environment']
): { min: Vec3; max: Vec3 } {
  const filtered = objects.filter(o => !excludeRoles.includes(o.role));
  // Fallback to all objects if everything was excluded
  const effective = filtered.length > 0 ? filtered : objects;
  if (effective.length === 0) return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };

  // Use object bounds (position ± half scale), not just position points
  let min = { x: Infinity, y: Infinity, z: Infinity };
  let max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const obj of effective) {
    const halfX = (obj.scale?.x ?? 1) / 2;
    const halfY = (obj.scale?.y ?? 1) / 2;
    const halfZ = (obj.scale?.z ?? 1) / 2;
    min = vec3Min(min, {
      x: obj.position.x - halfX,
      y: obj.position.y - halfY,
      z: obj.position.z - halfZ,
    });
    max = vec3Max(max, {
      x: obj.position.x + halfX,
      y: obj.position.y + halfY,
      z: obj.position.z + halfZ,
    });
  }
  return { min, max };
}

function computeSuggestedCamera(
  objects: ObjectPlacement[],
  fovDeg: number
): { position: Vec3; target: Vec3 } {
  // Use filtered extents (excludes ground/light/environment) — now includes scale
  const ext = computeSceneExtents(objects);

  // Target the hero's visual center (position + half height), not its base
  const hero = objects.find(o => o.role === 'hero');
  const heroHalfHeight = hero ? (hero.scale?.y ?? 1) / 2 : 0;
  const target: Vec3 = hero
    ? { x: hero.position.x, y: hero.position.y + heroHalfHeight, z: hero.position.z }
    : {
        x: (ext.min.x + ext.max.x) / 2,
        y: (ext.min.y + ext.max.y) / 2,
        z: (ext.min.z + ext.max.z) / 2,
      };

  // Scene size now accurate (includes object bounds)
  const sceneHeight = ext.max.y - ext.min.y;
  const sceneWidth = Math.max(ext.max.x - ext.min.x, sceneHeight, 1);
  const distance = (sceneWidth / 2 / Math.tan(degToRad(fovDeg / 2))) * 1.15;

  // Slight elevation above target center for natural 3/4 view
  const elevationY = target.y + sceneHeight * 0.15;

  return {
    position: { x: target.x, y: elevationY, z: target.z + distance },
    target,
  };
}

// ── Critique prompt builders ─────────────────────────────────────────

function buildCritiquePrompt(spec: CompositionSpec): string {
  const objectList = spec.objects
    .map(
      o =>
        `- "${o.id}" (${o.role}): pos {${o.position.x.toFixed(1)}, ${o.position.y.toFixed(1)}, ${o.position.z.toFixed(1)}}, layer ${o.depthLayer}`
    )
    .join('\n');

  return `Analyze this 3D render against the composition plan.

PLAN:
- Camera: {${spec.camera.position.x.toFixed(1)}, ${spec.camera.position.y.toFixed(1)}, ${spec.camera.position.z.toFixed(1)}} → {${spec.camera.target.x.toFixed(1)}, ${spec.camera.target.y.toFixed(1)}, ${spec.camera.target.z.toFixed(1)}}
- Focal: "${spec.focalPoint}", Layers: ${spec.depthLayers}, Rule: ${spec.camera.compositionRule}, Mood: ${spec.lightingMood}
- Objects:
${objectList}

SCORE each 1-5:
1. FRAMING: Subject well-framed? Space balance?
2. DEPTH: Distinct depth layers visible? Or flat?
3. COMPOSITION: Focal point on ${spec.camera.compositionRule} grid? Visual hierarchy?
4. LIGHTING: Clear direction? Contrast? Mood = "${spec.lightingMood}"?
5. PLACEMENT: Objects at planned positions? Clipping/overlap? Missing?

For scores <4, give SPECIFIC CORRECTION with target (camera_position/object_position/etc.), direction+magnitude, priority (1-3).

Return JSON:
{ "framing": {"score":N,"issues":"...","corrections":[...]}, "depth": {...}, "composition": {...}, "lighting": {...}, "placement": {...}, "overall": N, "passed": bool }

overall = average of 5. passed = overall >= ${PASS_THRESHOLD} AND no dim < ${MIN_DIMENSION_SCORE}.`;
}

function buildReferencePrompt(desc: string, scale: number): string {
  return `Analyze this reference image for 3D scene reconstruction.

Scene: "${desc}", Scale: ${scale} world units across.

Extract as JSON:
1. OBJECTS: [{id, role (hero/secondary/accent/ground/light/environment), relative_position {x,y,z} normalized [-1,1], depth_layer (0=fg,1=mid,2=bg), approximate_scale {x,y,z} as fraction of scene width}]
2. CAMERA: {elevation_deg, distance_relative (close/medium/far), fov_estimate (narrow/normal/wide)}
3. LIGHTING: {key_direction {x,y,z}, key_warmth (warm/neutral/cool), fill_ratio 0-1, mood (dramatic/natural/studio/ethereal/noir)}
4. DEPTH_INFO: {layer_count, depth_cues [fog/size/overlap/blur/color], total_depth (shallow/medium/deep)}
5. COMPOSITION: {rule (rule-of-thirds/centered/golden-ratio/diagonal), focal_point_id, negative_space (top/bottom/left/right/center), framing description}`;
}

// ── Zod schemas ──────────────────────────────────────────────────────

const Vec3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() });

const ObjectPlacementSchema = z.object({
  id: z.string(),
  role: z.enum(['hero', 'secondary', 'accent', 'ground', 'light', 'environment']),
  position: Vec3Schema,
  rotation: Vec3Schema.optional(),
  scale: Vec3Schema.optional(),
  depthLayer: z.number().int().min(0),
});

const CameraSpecSchema = z.object({
  position: Vec3Schema,
  target: Vec3Schema,
  up: Vec3Schema.default({ x: 0, y: 1, z: 0 }),
  fovHorizontalDeg: z.number().default(82),
  compositionRule: z
    .enum(['rule-of-thirds', 'centered', 'golden-ratio', 'diagonal'])
    .default('rule-of-thirds'),
});

const CorrectionSchema = z.object({
  target: z.string(),
  objectId: z.string().optional(),
  delta: Vec3Schema.optional(),
  value: z.union([z.number(), z.string(), Vec3Schema]).optional(),
  priority: z.number().int().min(1).max(3),
  description: z.string(),
});

// ── Tool registration ────────────────────────────────────────────────

export function registerArtDirectionTools(
  server: McpServer,
  client: OctaneMcpClient,
  artState: ArtDirectionState,
  placementState?: ScenePlacementState
) {
  const placement = placementState ?? new ScenePlacementState();
  // ── 1. plan_composition ──────────────────────────────────────────

  server.tool(
    'plan_composition',
    'Create a validated scene composition plan with computed camera math. Does NOT create Octane nodes — pure planning. Returns plan + validation for review before building.',
    {
      name: z.string().describe('Unique name for this composition'),
      description: z.string().describe('Creative brief'),
      objects: z.array(ObjectPlacementSchema).min(1),
      camera: CameraSpecSchema.optional().describe(
        'Camera override. If omitted, computed from layout.'
      ),
      focal_point: z.string().describe('id of the hero object'),
      lighting_mood: z.string().default('natural'),
      reference_image_path: z.string().optional(),
    },
    async params => {
      try {
        const objects = params.objects as ObjectPlacement[];
        const extents = computeSceneExtents(objects);
        const depthLayers = new Set(objects.map(o => o.depthLayer)).size;

        let camera: CameraSpec;
        if (params.camera) {
          camera = params.camera as CameraSpec;
        } else {
          const suggested = computeSuggestedCamera(objects, 82);
          camera = {
            ...suggested,
            up: { x: 0, y: 1, z: 0 },
            fovHorizontalDeg: 82,
            compositionRule: 'rule-of-thirds' as const,
          };
        }

        const spec: CompositionSpec = {
          name: params.name,
          description: params.description,
          camera,
          objects,
          depthLayers,
          focalPoint: params.focal_point,
          lightingMood: params.lighting_mood,
          referenceImagePath: params.reference_image_path,
          sceneExtents: extents,
        };

        const validation = validateComposition(spec);
        artState.setSpec(params.name, spec);

        return jsonResult({
          spec,
          validation,
          instruction: validation.passed
            ? 'Layout validated. Proceed to build the scene using these positions.'
            : 'Layout has errors. Fix issues and call plan_composition again.',
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  // ── 2. validate_layout ───────────────────────────────────────────

  server.tool(
    'validate_layout',
    'Run geometric validation on a planned composition. Checks frustum, depth separation, proximity, composition grid, lighting angles.',
    { spec_name: z.string() },
    async ({ spec_name }) => {
      const spec = artState.getSpec(spec_name);
      if (!spec)
        return errorResult(
          `No spec "${spec_name}". Available: ${artState.listSpecs().join(', ') || 'none'}`
        );
      return jsonResult(validateComposition(spec));
    }
  );

  // ── 3. analyze_reference ─────────────────────────────────────────

  server.tool(
    'analyze_reference',
    'Extract composition data from a reference image. If a vision API key is available, analyzes the image server-side and returns structured data. Otherwise returns a prompt for self-analysis.',
    {
      image_path: z.string().describe('Absolute path to reference image'),
      scene_description: z.string(),
      scale_hint: z.number().default(10).describe('World-space width of scene (default 10)'),
    },
    async params => {
      const resolved = path.resolve(params.image_path);
      if (!fs.existsSync(resolved)) return errorResult(`Image not found: ${resolved}`);

      const analysisPrompt = buildVisionRefPrompt(params.scene_description, params.scale_hint);

      // Try external vision analysis first
      const visionResult = await visionAnalyze(resolved, analysisPrompt);
      if (visionResult && visionResult.backend !== 'self') {
        return jsonResult({
          image_path: resolved,
          analysis: visionResult.data, // structured JSON if parseable, null otherwise
          raw_analysis: visionResult.data ? undefined : visionResult.raw, // raw text if JSON parse failed
          backend: visionResult.backend,
          model: visionResult.model,
          scale_hint: params.scale_hint,
          instruction: visionResult.data
            ? 'Vision analysis complete. Feed the analysis data into plan_composition, scaling relative positions by scale_hint.'
            : 'Vision analysis returned text but JSON parsing failed. Parse the raw_analysis text yourself and feed results to plan_composition.',
        });
      }

      // Fallback: return prompt for self-analysis (v1 behavior)
      return jsonResult({
        image_path: resolved,
        analysis_prompt: analysisPrompt,
        scale_hint: params.scale_hint,
        instruction:
          'No vision API available. Read the image, answer the analysis_prompt, then feed results to plan_composition.',
      });
    }
  );

  // ── 4. critique_render ───────────────────────────────────────────

  server.tool(
    'critique_render',
    'Save current render and generate critique prompt. If a vision API key is available, calls an external VLM to score the render (returns scores directly). Otherwise returns a prompt for self-critique. MANDATORY after every DRESS render.',
    {
      render_path: z.string().describe('Absolute path to save render'),
      spec_name: z.string(),
      reference_image_path: z
        .string()
        .optional()
        .describe('Path to reference image for side-by-side comparison'),
    },
    async params => {
      const spec = artState.getSpec(params.spec_name);
      if (!spec) return errorResult(`No spec "${params.spec_name}". Call plan_composition first.`);

      const pathErr = validateFilePath(params.render_path);
      if (pathErr) return errorResult(pathErr);
      const dir = path.dirname(params.render_path);
      if (!fs.existsSync(dir)) return errorResult(`Directory does not exist: ${dir}`);

      try {
        const resolved = path.resolve(params.render_path);
        await client.callMethod('ApiRenderEngine', 'saveImage1', {
          fullPath: resolved,
          imageSaveFormat: 0,
          renderPassId: 0,
          colorSpace: 1,
          premultipliedAlphaType: 0,
          asynchronous: false,
        });

        const iteration = artState.getIterationCount(params.spec_name) + 1;
        const warnings: string[] = [];
        if (artState.isStagnating(params.spec_name))
          warnings.push(
            'STAGNATING: Last 2 iterations improved <0.3. Redesign the plan instead of tweaking.'
          );
        if (iteration > MAX_ITERATIONS)
          warnings.push(`EXHAUSTED: ${iteration} iterations. Step back and rethink the layout.`);

        // Try external vision critique
        const critiquePrompt = params.reference_image_path
          ? buildComparisonPrompt(spec)
          : buildVisionCritiquePrompt(spec);

        const visionResult = await visionCritique(
          resolved,
          critiquePrompt,
          params.reference_image_path ? path.resolve(params.reference_image_path) : undefined
        );

        if (visionResult) {
          // External vision worked — record and return scores directly
          const record: CritiqueRecord = {
            iteration,
            overallScore: visionResult.overall,
            passed: visionResult.passed,
            scores: visionResult.scores,
            corrections: visionResult.corrections,
            renderPath: resolved,
            timestamp: Date.now(),
          };
          artState.addCritique(params.spec_name, record);

          return jsonResult({
            render_path: resolved,
            spec_name: params.spec_name,
            iteration,
            vision_backend: visionResult.backend,
            vision_model: visionResult.model,
            scores: visionResult.scores,
            overall: visionResult.overall,
            passed: visionResult.passed,
            corrections: visionResult.corrections,
            observations: visionResult.observations || visionResult.differences,
            warnings,
            stagnating: artState.isStagnating(params.spec_name),
            exhausted: artState.isExhausted(params.spec_name),
            instruction: visionResult.passed
              ? 'External vision critique PASSED. Proceed to next phase.'
              : `External vision scored ${visionResult.overall.toFixed(1)}/5. Apply corrections and re-render.`,
          });
        }

        // Fallback: return prompt for self-critique (v1 behavior)
        return jsonResult({
          render_path: resolved,
          critique_prompt: buildCritiquePrompt(spec),
          spec_name: params.spec_name,
          iteration,
          warnings,
          vision_backend: 'self',
          instruction:
            'No vision API available. Read the render image, answer critique_prompt, then call apply_corrections with scores.',
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  // ── 5. apply_corrections ─────────────────────────────────────────

  server.tool(
    'apply_corrections',
    'Record critique scores. Tracks history, detects stagnation, gates further iteration.',
    {
      spec_name: z.string(),
      iteration: z.number().int(),
      overall_score: z.number().min(1).max(5),
      passed: z.boolean(),
      scores: z.object({
        framing: z.number().min(1).max(5),
        depth: z.number().min(1).max(5),
        composition: z.number().min(1).max(5),
        lighting: z.number().min(1).max(5),
        placement: z.number().min(1).max(5),
      }),
      corrections: z.array(CorrectionSchema).default([]),
      render_path: z.string().optional(),
    },
    async params => {
      const spec = artState.getSpec(params.spec_name);
      if (!spec) return errorResult(`No spec "${params.spec_name}".`);

      const record: CritiqueRecord = {
        iteration: params.iteration,
        overallScore: params.overall_score,
        passed: params.passed,
        scores: params.scores,
        corrections: params.corrections,
        renderPath: params.render_path || '',
        timestamp: Date.now(),
      };
      artState.addCritique(params.spec_name, record);

      const history = artState.getHistory(params.spec_name);
      const scoreHistory = history.map(h => ({
        iteration: h.iteration,
        score: h.overallScore,
        passed: h.passed,
      }));

      const result: Record<string, unknown> = {
        recorded: true,
        score: params.overall_score,
        passed: params.passed,
        score_history: scoreHistory,
        stagnating: artState.isStagnating(params.spec_name),
        exhausted: artState.isExhausted(params.spec_name),
      };

      if (params.passed) {
        result.instruction = 'Critique passed! Proceed to next phase or save final render.';
      } else if (artState.isExhausted(params.spec_name)) {
        result.instruction = 'STOP. Redesign composition from scratch — not converging.';
      } else if (artState.isStagnating(params.spec_name)) {
        result.instruction = 'Stagnating. Make a LARGE change or redesign — no more small tweaks.';
      } else {
        const worst = Object.entries(params.scores).reduce((a, b) => (a[1] < b[1] ? a : b));
        result.instruction = `Focus on "${worst[0]}" (score ${worst[1]}). Apply priority-1 corrections, re-render, critique again.`;
        result.priority_corrections = params.corrections
          .filter(c => c.priority === 1)
          .map(c => c.description);
      }
      return jsonResult(result);
    }
  );

  // ── 6. get_art_direction_state ───────────────────────────────────

  server.tool(
    'get_art_direction_state',
    'Get current art direction state: specs, scores, iteration history, stagnation status.',
    {},
    async () => jsonResult(artState.getSummary())
  );

  // ── 7. suggest_placement ──────────────────────────────────────────

  server.tool(
    'suggest_placement',
    'Given existing scene objects and a new mesh to add, suggest position/rotation/scale that avoids collisions, maintains spacing, and respects composition. Advisory only — override if scene intent differs. Call register_scene_object first to populate the scene database, or it auto-reads from scene tree.',
    {
      mesh_path: z.string().describe('Path to OBJ file (runs analyze_mesh if no sidecar exists)'),
      role: z
        .enum(['hero', 'secondary', 'accent', 'ground', 'light', 'prop'])
        .optional()
        .default('prop')
        .describe('Role in the composition'),
      relationship: z
        .string()
        .optional()
        .describe(
          'Spatial relationship (e.g. "next to fairy", "behind flowers", "left of dragon")'
        ),
      min_clearance: z
        .number()
        .optional()
        .default(0.5)
        .describe('Minimum distance from other objects (default 0.5)'),
    },
    async ({ mesh_path, role, relationship, min_clearance }) => {
      try {
        const resolved = path.resolve(mesh_path);

        // Try to read mesh analysis sidecar
        const dir = path.dirname(resolved);
        const base = path.basename(resolved, path.extname(resolved));
        const sidecarFile = path.join(dir, `${base}.mesh_info.json`);

        let meshExtents = { x: 1, y: 1, z: 1 };
        let meshInfo: ScenePlacementEntry['meshInfo'];

        if (fs.existsSync(sidecarFile)) {
          try {
            const data = JSON.parse(fs.readFileSync(sidecarFile, 'utf8'));
            meshExtents = data.extents ?? meshExtents;
            if (data.analysis) {
              meshInfo = {
                category: data.analysis.category,
                naturalHeightM: data.analysis.natural_height_m,
                suggestedRotation: data.analysis.suggested_rotation,
                groundOffsetY: data.analysis.ground_offset_y,
              };
            }
          } catch {
            /* corrupt sidecar, use defaults */
          }
        }

        const suggestion = placement.suggestPlacement(
          meshExtents,
          role as PlacementRole,
          min_clearance,
          relationship
        );

        // Merge analyze_mesh rotation/scale if available
        if (meshInfo) {
          suggestion.rotation = meshInfo.suggestedRotation;
          // Adjust Y for ground offset
          suggestion.position.y = Math.max(suggestion.position.y, meshInfo.groundOffsetY);
        }

        // Check if suggested position is inside the current camera frustum
        let frustumWarning: string | undefined;
        try {
          const cam = (await client.callMethod('LiveLink', 'GetCamera', {})) as any;
          if (cam?.position && cam?.target) {
            const camPos = cam.position as Vec3;
            const camTarget = cam.target as Vec3;
            const forward = vec3Normalize(vec3Sub(camTarget, camPos));
            const toObj = vec3Normalize(vec3Sub(suggestion.position, camPos));
            const angleCos = vec3Dot(forward, toObj);
            const angle = Math.acos(Math.min(1, Math.max(-1, angleCos)));
            // Default FOV ~82° → half = 41° = 0.716 rad. Use 1.1x tolerance.
            const halfFov = degToRad(41) * 1.1;
            if (angle > halfFov) {
              frustumWarning = `Suggested position is outside the current camera view (${((angle * 180) / Math.PI).toFixed(0)}° from center). Consider adjusting camera after placement.`;
              suggestion.warnings.push(frustumWarning);
            }
          }
        } catch {
          /* camera query failed — skip frustum check */
        }

        return jsonResult({
          ...suggestion,
          mesh_path: resolved,
          sidecar_found: fs.existsSync(sidecarFile),
          scene_objects: placement.getEntries().length,
          frustum_warning: frustumWarning,
          instruction:
            'These are SUGGESTIONS. Apply via set_attribute on the placement transform. Override rotation/position if your scene intent differs.',
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  // ── 8. register_scene_object ──────────────────────────────────────

  server.tool(
    'register_scene_object',
    'Register a placed object in the scene awareness database. Call after placing each mesh/primitive so suggest_placement knows what exists. Also used by validate_layout for physical checks.',
    {
      handle: z.number().int().min(0).describe('Node handle of the placed object'),
      name: z.string().describe('Display name (e.g. "Fairy", "Crystal Sphere")'),
      role: z
        .enum(['hero', 'secondary', 'accent', 'ground', 'light', 'prop'])
        .describe('Role in the composition'),
      position: z
        .object({ x: z.number(), y: z.number(), z: z.number() })
        .describe('World position'),
      rotation: z
        .object({ x: z.number(), y: z.number(), z: z.number() })
        .optional()
        .default({ x: 0, y: 0, z: 0 }),
      scale: z
        .object({ x: z.number(), y: z.number(), z: z.number() })
        .optional()
        .default({ x: 1, y: 1, z: 1 }),
      bounds_size: z
        .object({ x: z.number(), y: z.number(), z: z.number() })
        .optional()
        .describe(
          'Object extents (from analyze_mesh). Assumes mesh centered at origin. If omitted, uses unit cube. For non-centered meshes, use bounds_min/bounds_max instead.'
        ),
      bounds_min: z
        .object({ x: z.number(), y: z.number(), z: z.number() })
        .optional()
        .describe(
          'Mesh-local min bounds (from analyze_mesh bboxMin). Use with bounds_max for non-centered meshes.'
        ),
      bounds_max: z
        .object({ x: z.number(), y: z.number(), z: z.number() })
        .optional()
        .describe(
          'Mesh-local max bounds (from analyze_mesh bboxMax). Use with bounds_min for non-centered meshes.'
        ),
      mesh_info_path: z
        .string()
        .optional()
        .describe('Path to .mesh_info.json sidecar for mesh analysis data'),
    },
    async params => {
      try {
        // Compute world-space AABB from mesh bounds + rotation + scale + position.
        // Transform order: Scale → Rotate → Translate (Octane convention).
        // For rotated objects, we compute the AABB of the rotated+scaled bounding box.

        // Step 1: Get mesh-local min/max (before any transform)
        let localMin: Vec3, localMax: Vec3;
        if (params.bounds_min && params.bounds_max) {
          // Explicit mesh bounds (handles non-centered origins correctly)
          localMin = params.bounds_min;
          localMax = params.bounds_max;
        } else if (params.bounds_size) {
          // Centered bounds (assumes mesh origin = center)
          localMin = {
            x: -params.bounds_size.x / 2,
            y: -params.bounds_size.y / 2,
            z: -params.bounds_size.z / 2,
          };
          localMax = {
            x: params.bounds_size.x / 2,
            y: params.bounds_size.y / 2,
            z: params.bounds_size.z / 2,
          };
        } else {
          localMin = { x: -0.5, y: -0.5, z: -0.5 };
          localMax = { x: 0.5, y: 0.5, z: 0.5 };
        }

        // Step 2: Apply scale
        const sMin = {
          x: localMin.x * params.scale.x,
          y: localMin.y * params.scale.y,
          z: localMin.z * params.scale.z,
        };
        const sMax = {
          x: localMax.x * params.scale.x,
          y: localMax.y * params.scale.y,
          z: localMax.z * params.scale.z,
        };

        // Step 3: Build rotation matrix from Euler XYZ (degrees)
        const rx = (params.rotation.x * Math.PI) / 180;
        const ry = (params.rotation.y * Math.PI) / 180;
        const rz = (params.rotation.z * Math.PI) / 180;
        const cx = Math.cos(rx),
          sx = Math.sin(rx);
        const cy = Math.cos(ry),
          sy = Math.sin(ry);
        const cz = Math.cos(rz),
          sz = Math.sin(rz);
        // R = Rz * Ry * Rx (standard Euler XYZ)
        const R = [
          [cy * cz, sx * sy * cz - cx * sz, cx * sy * cz + sx * sz],
          [cy * sz, sx * sy * sz + cx * cz, cx * sy * sz - sx * cz],
          [-sy, sx * cy, cx * cy],
        ];

        // Step 4: Compute AABB of rotated box using abs-matrix method.
        // For each axis, the new half-extent = sum of |R[row][col]| * half_extent[col]
        const corners = [
          { x: sMin.x, y: sMin.y, z: sMin.z },
          { x: sMax.x, y: sMin.y, z: sMin.z },
          { x: sMin.x, y: sMax.y, z: sMin.z },
          { x: sMax.x, y: sMax.y, z: sMin.z },
          { x: sMin.x, y: sMin.y, z: sMax.z },
          { x: sMax.x, y: sMin.y, z: sMax.z },
          { x: sMin.x, y: sMax.y, z: sMax.z },
          { x: sMax.x, y: sMax.y, z: sMax.z },
        ];

        let rMin = { x: Infinity, y: Infinity, z: Infinity };
        let rMax = { x: -Infinity, y: -Infinity, z: -Infinity };
        for (const c of corners) {
          const rx2 = R[0][0] * c.x + R[0][1] * c.y + R[0][2] * c.z;
          const ry2 = R[1][0] * c.x + R[1][1] * c.y + R[1][2] * c.z;
          const rz2 = R[2][0] * c.x + R[2][1] * c.y + R[2][2] * c.z;
          rMin = { x: Math.min(rMin.x, rx2), y: Math.min(rMin.y, ry2), z: Math.min(rMin.z, rz2) };
          rMax = { x: Math.max(rMax.x, rx2), y: Math.max(rMax.y, ry2), z: Math.max(rMax.z, rz2) };
        }

        // Step 5: Translate to world position
        const boundsWorld: AABB = {
          min: {
            x: params.position.x + rMin.x,
            y: params.position.y + rMin.y,
            z: params.position.z + rMin.z,
          },
          max: {
            x: params.position.x + rMax.x,
            y: params.position.y + rMax.y,
            z: params.position.z + rMax.z,
          },
        };

        // Read mesh info from sidecar if provided
        let meshInfo: ScenePlacementEntry['meshInfo'];
        if (params.mesh_info_path && fs.existsSync(params.mesh_info_path)) {
          try {
            const data = JSON.parse(fs.readFileSync(params.mesh_info_path, 'utf8'));
            if (data.analysis) {
              meshInfo = {
                category: data.analysis.category,
                naturalHeightM: data.analysis.natural_height_m,
                suggestedRotation: data.analysis.suggested_rotation,
                groundOffsetY: data.analysis.ground_offset_y,
              };
            }
          } catch {
            /* ignore corrupt sidecar */
          }
        }

        const entry: ScenePlacementEntry = {
          handle: params.handle,
          name: params.name,
          role: params.role as PlacementRole,
          position: params.position,
          rotation: params.rotation,
          scale: params.scale,
          boundsWorld,
          meshInfo,
        };

        placement.addEntry(entry);

        // If this is a ground plane, set the ground Y level
        if (params.role === 'ground') {
          placement.groundY = params.position.y;
        }

        // Check for issues
        const warnings: string[] = [];

        // Ground penetration check
        if (params.role !== 'ground' && boundsWorld.min.y < placement.groundY - 0.01) {
          const penetration = placement.groundY - boundsWorld.min.y;
          warnings.push(
            `Object penetrates ground plane by ${penetration.toFixed(2)} units. ` +
              `Raise Y by ${penetration.toFixed(2)} to fix.`
          );
        }

        // Orientation check against mesh analysis
        if (meshInfo && meshInfo.suggestedRotation) {
          const sr = meshInfo.suggestedRotation;
          const ar = params.rotation;
          const rotDiff = Math.abs(sr.x - ar.x) + Math.abs(sr.y - ar.y) + Math.abs(sr.z - ar.z);
          if (rotDiff > 45) {
            warnings.push(
              `Rotation differs ${rotDiff.toFixed(0)}° from suggested canonical orientation ` +
                `(${sr.x},${sr.y},${sr.z})° — is this intentional?`
            );
          }
        }

        // Collision check
        const collision = placement.checkCollisions(boundsWorld, params.handle);
        if (collision.collides) {
          warnings.push(
            `Overlaps with: ${collision.overlapping.join(', ')} ` +
              `(penetration ${collision.penetrationDepth.toFixed(2)} units)`
          );
        }

        return jsonResult({
          registered: true,
          handle: params.handle,
          name: params.name,
          role: params.role,
          scene_objects: placement.getEntries().length,
          warnings,
          instruction:
            warnings.length > 0
              ? 'Warnings detected — consider adjusting position/rotation.'
              : 'Object registered. Scene database updated.',
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  // ── 9. get_scene_placement_state ──────────────────────────────────

  server.tool(
    'get_scene_placement_state',
    'Get the current scene placement database: all registered objects, positions, bounds, roles, and warnings.',
    {},
    async () => jsonResult(placement.snapshot())
  );
}
