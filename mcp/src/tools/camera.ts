/**
 * Camera Tools — get_camera, set_camera, fit_camera
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient } from '../OctaneMcpClient';
import { jsonResult, errorResult } from './utils';
import { ScenePlacementState } from '../ScenePlacementState';
import { ArtDirectionState, adWorkflow } from '../ArtDirectionState';

const Vec3Schema = z
  .object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  })
  .describe('3D vector {x, y, z}');

/** Default horizontal FOV in degrees.
 * Octane thin lens default: 36mm sensor / 50mm focal = 2*atan(36/(2*50)) ≈ 39.6°.
 * computeFitCamera accepts hFovDeg override for non-default cameras. */
const DEFAULT_H_FOV_DEG = 39.6;

type V3 = { x: number; y: number; z: number };
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const norm = (v: V3): V3 => {
  const l = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  return l > 1e-12 ? { x: v.x / l, y: v.y / l, z: v.z / l } : { x: 0, y: 0, z: 1 };
};
const scale = (v: V3, s: number): V3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

/**
 * Fit camera to bounding box.
 *
 * Algorithm: build camera basis from pitch + yaw, generate all 8 bbox corners,
 * project each into camera space, find the minimum distance along the view
 * direction so every corner fits within the frustum (horizontal & vertical FOV).
 *
 * Sources: standard "frame AABB in frustum" approach per
 * https://www.gamedev.net/forums/topic/638114-how-to-fit-a-box-in-the-camera39s-view-frustum/
 */
export function computeFitCamera(
  bboxMin: V3,
  bboxMax: V3,
  margin: number,
  pitchDeg: number,
  yawDeg: number,
  hFovDeg: number = DEFAULT_H_FOV_DEG,
  aspectRatio: number = 2 // width/height — callers should query actual film resolution
) {
  // Centroid = camera target
  const center: V3 = {
    x: (bboxMin.x + bboxMax.x) / 2,
    y: (bboxMin.y + bboxMax.y) / 2,
    z: (bboxMin.z + bboxMax.z) / 2,
  };

  // Pad the bbox by margin (0 = exact fit, 0.3 = 30% padding)
  const pad = 1 + margin;
  const hx = ((bboxMax.x - bboxMin.x) / 2) * pad;
  const hy = ((bboxMax.y - bboxMin.y) / 2) * pad;
  const hz = ((bboxMax.z - bboxMin.z) / 2) * pad;

  // Camera direction from pitch (elevation) and yaw (orbit)
  const pitchRad = (pitchDeg * Math.PI) / 180;
  const yawRad = (yawDeg * Math.PI) / 180;

  // Forward = direction FROM camera TO target (negated to get camera position offset)
  // Pitch rotates around X, yaw rotates around Y
  const forward: V3 = {
    x: -Math.sin(yawRad) * Math.cos(pitchRad),
    y: -Math.sin(pitchRad),
    z: -Math.cos(yawRad) * Math.cos(pitchRad),
  };
  // Camera position = center - forward * distance (camera looks along +forward toward center)

  const worldUp: V3 = { x: 0, y: 1, z: 0 };
  const right = norm(cross(forward, worldUp));
  const up = cross(right, forward); // already unit length

  // FOV half-angles (default ~39.6° horizontal from Octane thin lens 36mm/50mm)
  const hHalfFovRad = ((hFovDeg / 2) * Math.PI) / 180;
  const tanH = Math.tan(hHalfFovRad);
  const tanV = Math.tan(Math.atan(tanH / aspectRatio)); // aspect-aware vertical half-FOV

  // Generate all 8 bbox corners, project into camera space,
  // compute minimum distance so each corner fits in the frustum.
  let dist = 1;
  for (const xs of [-1, 1]) {
    for (const ys of [-1, 1]) {
      for (const zs of [-1, 1]) {
        // Corner in world space relative to center
        const corner: V3 = { x: xs * hx, y: ys * hy, z: zs * hz };

        // Project corner onto camera axes
        const cDepth = dot(corner, forward); // along view direction (positive = in front)
        const cRight = dot(corner, right); // horizontal offset
        const cUp = dot(corner, up); // vertical offset

        // Distance needed so this corner fits:
        // In camera space, corner is at (cRight, cUp, d + cDepth) where d is the
        // distance from center to camera along -forward.
        // Frustum constraint: |cRight| / (d + cDepth) <= tanH
        //                     |cUp|    / (d + cDepth) <= tanV
        // Solving: d >= |cRight| / tanH - cDepth
        //          d >= |cUp|    / tanV - cDepth

        const dFromH = Math.abs(cRight) / tanH - cDepth;
        const dFromV = Math.abs(cUp) / tanV - cDepth;
        const dNeeded = Math.max(dFromH, dFromV);
        if (dNeeded > dist) dist = dNeeded;
      }
    }
  }

  // Camera position = center + (-forward) * dist
  const position = add(center, scale(forward, -dist));

  return {
    position,
    target: center,
    distance: dist,
    extents: { x: hx * 2, y: hy * 2, z: hz * 2 },
  };
}

export function registerCameraTools(
  server: McpServer,
  client: OctaneMcpClient,
  placementState?: ScenePlacementState,
  artState?: ArtDirectionState
) {
  server.registerTool(
    'get_camera',
    {
      title: 'Get Camera',
      description: 'Get the current camera position, target, and up vector in world coordinates',
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const result = await client.callMethod('LiveLink', 'GetCamera', {});
        return jsonResult(result);
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'set_camera',
    {
      title: 'Set Camera (Phase 4)',
      description:
        '[Phase 4 ONLY] Set camera position and/or target in world coordinates. ⛔ Do NOT use in Phase 1 — use fit_camera instead. set_camera is for Phase 4 hero shots only. If framing is wrong, fix geometry (position/scale/floor size), not the camera.',
      inputSchema: {
        position: Vec3Schema.optional().describe('Camera position in world coordinates'),
        target: Vec3Schema.optional().describe('Camera look-at target in world coordinates'),
        up: Vec3Schema.optional().describe(
          'Camera up vector (default: {0,1,0}). Set to maintain roll orientation.'
        ),
      },
      annotations: { destructiveHint: true },
    },
    async ({ position, target, up }) => {
      if (!position && !target) {
        return errorResult('Provide position, target, or both');
      }
      try {
        const params: any = {};
        if (position) params.position = position;
        if (target) params.target = target;
        // Up vector defaults to {0,1,0}. Degenerate up guard is in gRPC server.
        params.up = up ?? { x: 0, y: 1, z: 0 };

        await client.callMethod('LiveLink', 'SetCamera', params);

        // Phase 1 warning: if framing_verified hasn't been completed, warn loudly
        const warnings: string[] = [];
        if (artState.isActive && !artState.isStepDone('framing_verified')) {
          warnings.push(
            '⛔ PHASE VIOLATION: set_camera used before framing_verified. In Phase 1, use fit_camera ONLY. set_camera is for Phase 4 hero shots. If fit_camera frames wrong, fix the geometry (position, scale, floor plane size) — do NOT hack the camera.'
          );
        }

        return jsonResult({
          success: true,
          ...(warnings.length > 0 ? { warnings } : {}),
          ...adWorkflow(artState, 'fit_camera'), // track as camera operation
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'fit_camera',
    {
      title: 'Fit Camera (Phase 1)',
      description:
        '[Phase 1] MANDATORY after every geo placement. Compute and set camera to frame a bounding box. Must pass before any lighting/mood work (Phase 2). Pass explicit bounds or omit to use scene bounds. Returns computed camera position, target, and distance.',
      inputSchema: {
        bbox_min: Vec3Schema.optional().describe(
          'Min corner of bounding box. Omit to auto-query scene bounds.'
        ),
        bbox_max: Vec3Schema.optional().describe(
          'Max corner of bounding box. Omit to auto-query scene bounds.'
        ),
        margin: z
          .number()
          .optional()
          .default(0.3)
          .describe('Margin as fraction (default 0.3 = 30% padding, 0 = exact fit)'),
        elevation: z
          .number()
          .optional()
          .default(20)
          .describe('Camera elevation in degrees above horizon (default 20)'),
        yaw: z
          .number()
          .optional()
          .default(0)
          .describe('Camera yaw/orbit in degrees (default 0 = front view, 45 = 3/4 view)'),
        framing_mode: z
          .enum(['scene', 'hero', 'subjects'])
          .optional()
          .default('subjects')
          .describe(
            'What to frame: "subjects" = hero+secondary+accent+prop (excludes ground/light, default), "hero" = hero object only, "scene" = all objects (legacy)'
          ),
      },
      annotations: { idempotentHint: true },
    },
    async ({ bbox_min, bbox_max, margin, elevation, yaw, framing_mode }) => {
      try {
        let bMin = bbox_min;
        let bMax = bbox_max;
        let framingSource = 'explicit';
        let heroCenter: V3 | null = null;

        // Auto-query bounds if not provided
        if (!bMin || !bMax) {
          let resolved = false;

          // Try role-filtered bounds from placement state
          if (
            placementState &&
            placementState.getEntries().length > 0 &&
            framing_mode !== 'scene'
          ) {
            if (framing_mode === 'hero') {
              const heroBounds = placementState.getHeroBounds();
              if (heroBounds) {
                bMin = heroBounds.min;
                bMax = heroBounds.max;
                heroCenter = {
                  x: (heroBounds.min.x + heroBounds.max.x) / 2,
                  y: (heroBounds.min.y + heroBounds.max.y) / 2,
                  z: (heroBounds.min.z + heroBounds.max.z) / 2,
                };
                framingSource = 'hero_bounds';
                resolved = true;
              }
              // Fallback: try subjects if no hero
              if (!resolved) {
                const framingBounds = placementState.getFramingBounds();
                if (framingBounds) {
                  bMin = framingBounds.min;
                  bMax = framingBounds.max;
                  framingSource = 'subject_bounds (no hero)';
                  resolved = true;
                }
              }
            } else {
              // framing_mode === 'subjects'
              const framingBounds = placementState.getFramingBounds();
              if (framingBounds) {
                bMin = framingBounds.min;
                bMax = framingBounds.max;
                framingSource = 'subject_bounds';
                resolved = true;
              }
              // Set hero center for camera targeting
              const heroBounds = placementState.getHeroBounds();
              if (heroBounds) {
                heroCenter = {
                  x: (heroBounds.min.x + heroBounds.max.x) / 2,
                  y: (heroBounds.min.y + heroBounds.max.y) / 2,
                  z: (heroBounds.min.z + heroBounds.max.z) / 2,
                };
              }
            }
          }

          // Fallback to full scene bounds
          if (!resolved) {
            const boundsResult = await client.callMethod('ApiRenderEngine', 'getSceneBounds', {});
            const br = boundsResult as any;
            if (br?.result === false) {
              return errorResult('Scene is empty — no geometry to frame.');
            }
            bMin = br?.bboxMin ?? br?.bbox_min;
            bMax = br?.bboxMax ?? br?.bbox_max;
            framingSource = 'scene_bounds_fallback';
            if (!bMin || !bMax) {
              return errorResult('Could not read scene bounds. Pass bbox_min/bbox_max explicitly.');
            }
          }
        }

        // Degenerate check — zero-size bbox
        const sx = bMax.x - bMin.x;
        const sy = bMax.y - bMin.y;
        const sz = bMax.z - bMin.z;
        if (sx < 1e-6 && sy < 1e-6 && sz < 1e-6) {
          return errorResult(
            `Bounding box is zero-size (min=${JSON.stringify(bMin)}, max=${JSON.stringify(bMax)}). ` +
              `Cannot compute camera framing for a point.`
          );
        }

        // Tighten margin for hero-only framing
        const effectiveMargin = framing_mode === 'hero' ? Math.min(margin, 0.15) : margin;

        // Query actual film resolution for correct aspect ratio
        let aspectRatio = 2; // fallback if query fails
        try {
          const stats = await client.callMethod('ApiRenderEngine', 'getRenderStatistics', {});
          const s = stats?.statistics ?? stats;
          if (s?.setSize?.x && s?.setSize?.y) {
            aspectRatio = s.setSize.x / s.setSize.y;
          }
        } catch {}

        const fit = computeFitCamera(
          bMin,
          bMax,
          effectiveMargin,
          elevation,
          yaw,
          undefined,
          aspectRatio
        );

        // Override target to hero center when available (camera looks AT hero, not bbox center)
        const target = heroCenter ?? fit.target;
        // Recompute position to maintain same distance but aim at hero
        const position = heroCenter ? add(heroCenter, sub(fit.position, fit.target)) : fit.position;

        // gRPC SetCamera now persists to both LiveLink and node graph attributes
        await client.callMethod('LiveLink', 'SetCamera', {
          position,
          target,
          up: { x: 0, y: 1, z: 0 },
        });

        const result: Record<string, any> = {
          success: true,
          position,
          target,
          distance: fit.distance,
          bbox_min: bMin,
          bbox_max: bMax,
          extents: fit.extents,
          margin: effectiveMargin,
          elevation,
          yaw,
          framing_mode,
          framing_source: framingSource,
          ...(artState ? adWorkflow(artState, 'fit_camera') : {}),
        };

        if (framingSource === 'scene_bounds_fallback') {
          result.warning =
            'Placement state is empty — using full scene bounds (includes ground planes, lights). ' +
            'Framing may be inaccurate. Use register_scene_object or place_mesh to register objects for correct subject framing.';
        }

        return jsonResult(result);
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
