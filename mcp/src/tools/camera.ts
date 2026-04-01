/**
 * Camera Tools — get_camera, set_camera, fit_camera
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient, mcpLog } from '../OctaneMcpClient';
import {
  jsonResult,
  errorResult,
  OBJ_API_NODE,
  OBJ_API_ITEM,
  getConnectedByPinName,
} from './utils';
import { ScenePlacementState } from '../ScenePlacementState';
import { AttributeId } from '../shared/OctaneConstants';
import { ArtDirectionState, adWorkflow } from '../ArtDirectionState';

const Vec3Schema = z
  .object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  })
  .describe('3D vector {x, y, z}');

/**
 * Query live state from Octane for each placement entry via ScenePlacementState.refreshFromOctane.
 * Uses pin NAMES (not indices) so it works across all node types (NT_GEO_OBJECT, NT_GEO_MESH, etc).
 */
async function refreshPlacementFromOctane(
  client: OctaneMcpClient,
  placementState: ScenePlacementState
): Promise<Set<number>> {
  return placementState.refreshFromOctane(async (handle: number) => {
    let alive = true;
    let cameraVisible = true;
    let position: { x: number; y: number; z: number } | undefined;
    let scale: { x: number; y: number; z: number } | undefined;

    // Check node exists by querying any pin
    const olHandle = await getConnectedByPinName(client, handle, 'objectLayer');
    if (olHandle === 0) {
      // No objectLayer pin — could be NT_GEO_MESH or node doesn't exist.
      // Try transform to confirm alive.
      const xfHandle = await getConnectedByPinName(client, handle, 'transform');
      if (xfHandle === 0) {
        alive = false;
        return { alive, cameraVisible, position, scale };
      }
    }

    // Camera visibility: objectLayer → camera_visibility
    if (olHandle) {
      const cvHandle = await getConnectedByPinName(client, olHandle, 'camera_visibility');
      if (cvHandle) {
        try {
          const valResult = await client.callMethod('ApiItem', 'getValueByAttrID', {
            objectPtr: { handle: String(cvHandle), type: OBJ_API_ITEM },
            attribute_id: AttributeId.A_VALUE,
            expected_type: 1,
          });
          if (valResult?.result === false || valResult?.bool_value === false) {
            cameraVisible = false;
          }
        } catch {
          // Can't read visibility — assume visible
        }
      }
    }

    // Live transform: node → "transform" pin → A_TRANSLATION, A_SCALE
    const xfHandle = await getConnectedByPinName(client, handle, 'transform');
    if (xfHandle) {
      try {
        const posResult = await client.callMethod('ApiItem', 'getValueByAttrID', {
          objectPtr: { handle: String(xfHandle), type: OBJ_API_ITEM },
          attribute_id: AttributeId.A_TRANSLATION,
          expected_type: 11,
        });
        const scaleResult = await client.callMethod('ApiItem', 'getValueByAttrID', {
          objectPtr: { handle: String(xfHandle), type: OBJ_API_ITEM },
          attribute_id: AttributeId.A_SCALE,
          expected_type: 11,
        });
        const p = posResult?.result ?? posResult?.float3_value;
        const s = scaleResult?.result ?? scaleResult?.float3_value;
        if (p) position = { x: p.x ?? 0, y: p.y ?? 0, z: p.z ?? 0 };
        if (s) scale = { x: s.x ?? 1, y: s.y ?? 1, z: s.z ?? 1 };
      } catch {
        // Transform read failed — keep alive, use cached bounds
      }
    }

    return { alive, cameraVisible, position, scale };
  });
}

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
      title: 'Set Camera',
      description:
        '[Phase 4] Set camera position and/or target. ⛔ AD Phase 4 ONLY — use fit_camera for framing. Wrong framing = fix geometry, not camera. See octane://docs/creative/3.',
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

        // Hard gate: reject set_camera before framing_verified (Phase 1-3)
        if (artState?.isActive && !artState.isStepDone('framing_verified')) {
          return jsonResult({
            success: false,
            error:
              '⛔ REJECTED: set_camera is blocked before framing_verified. Use fit_camera(framing_mode:"subjects") in Phase 1-3. set_camera is Phase 4 only. If fit_camera frames wrong, fix geometry (position/scale), do NOT bypass with set_camera.',
            ...(artState ? adWorkflow(artState, 'fit_camera') : {}),
          });
        }

        await client.callMethod('LiveLink', 'SetCamera', params);

        return jsonResult({
          success: true,
          ...(artState ? adWorkflow(artState, 'fit_camera') : {}),
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'fit_camera',
    {
      title: 'Fit Camera',
      description:
        '[Phase 1+] Frame camera to bounding box. MANDATORY after every place_geo call. Pass explicit bounds or omit for auto. See octane://docs/creative/3.',
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
            // Query live transforms + camera visibility from Octane
            let excludeHandles: Set<number> | undefined;
            try {
              excludeHandles = await refreshPlacementFromOctane(client, placementState);
              if (excludeHandles.size > 0) {
                mcpLog(
                  `fit_camera: excluding ${excludeHandles.size} camera-invisible objects from framing`,
                  'info'
                );
              }
            } catch {
              // If query fails, use cached state
            }

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
                const framingBounds = placementState.getFramingBounds(excludeHandles);
                if (framingBounds) {
                  bMin = framingBounds.min;
                  bMax = framingBounds.max;
                  framingSource = 'subject_bounds (no hero)';
                  resolved = true;
                }
              }
            } else {
              // framing_mode === 'subjects'
              const framingBounds = placementState.getFramingBounds(excludeHandles);
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

        // Null/NaN guard — corrupted bounds from failed set_attribute or stale placement DB
        const hasNullBounds = [bMin.x, bMin.y, bMin.z, bMax.x, bMax.y, bMax.z].some(
          v => v === null || v === undefined || Number.isNaN(v)
        );
        if (hasNullBounds) {
          return errorResult(
            `Bounding box has null/NaN values (min=${JSON.stringify(bMin)}, max=${JSON.stringify(bMax)}). ` +
              `Re-register objects with register_object or use explicit bbox_min/bbox_max.`
          );
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
        // BUG: 0.15 cap is too aggressive for tall/narrow meshes — crops tops.
        // Compounded by refreshFromOctane re-centering asymmetric bounds (see ScenePlacementState.ts).
        // TODO: raise to 0.3 or remove cap after fixing refreshFromOctane bounds.
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
          const entryCount = placementState ? placementState.getEntries().length : 0;
          result.warning =
            entryCount === 0
              ? 'Placement state is empty — using full scene bounds (includes ground planes, lights). ' +
                'Framing may be inaccurate. Use register_object or place_geo to register objects for correct subject framing.'
              : `Placement state has ${entryCount} entries but all are ground/light roles — no frameable subjects. ` +
                'Using full scene bounds. Place a hero/secondary/accent/prop object for correct subject framing.';
        }

        return jsonResult(result);
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
