/**
 * Camera Tools — get_camera, set_camera, fit_camera
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient } from '../OctaneMcpClient';
import { jsonResult, errorResult } from './utils';

const Vec3Schema = z
  .object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  })
  .describe('3D vector {x, y, z}');

/** Horizontal half-FOV in radians.
 * Octane default: 36mm sensor, 50mm focal → FOV = 2*atan(36/(2*50)) = 39.6°
 * Half-FOV = 19.8° */
const H_HALF_FOV_RAD = Math.atan(36 / (2 * 50)); // ~0.346 rad, tan ≈ 0.36

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
function computeFitCamera(
  bboxMin: V3,
  bboxMax: V3,
  margin: number,
  pitchDeg: number,
  yawDeg: number
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

  // FOV half-angles
  const tanH = Math.tan(H_HALF_FOV_RAD);
  const tanV = Math.tan(Math.atan(tanH * 0.5)); // 2:1 aspect → vertical half-FOV

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

export function registerCameraTools(server: McpServer, client: OctaneMcpClient) {
  server.tool(
    'get_camera',
    'Get the current camera position, target, and up vector in world coordinates',
    {},
    async () => {
      try {
        const result = await client.callMethod('LiveLink', 'GetCamera', {});
        return jsonResult(result);
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'set_camera',
    'Set camera position and/or target in world coordinates. Triggers scene evaluation (updates render). At least one of position or target required. Changes reflected in octaneWebR viewport in real time.',
    {
      position: Vec3Schema.optional().describe('Camera position in world coordinates'),
      target: Vec3Schema.optional().describe('Camera look-at target in world coordinates'),
      up: Vec3Schema.optional().describe(
        'Camera up vector (default: {0,1,0}). Set to maintain roll orientation.'
      ),
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
        return jsonResult({ success: true });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'fit_camera',
    'Compute and set camera to frame a bounding box. Pass explicit bounds or omit to use scene bounds from get_scene_bounds. Returns the computed camera position, target, and distance. Slightly elevated view with margin.',
    {
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
    },
    async ({ bbox_min, bbox_max, margin, elevation, yaw }) => {
      try {
        let bMin = bbox_min;
        let bMax = bbox_max;

        // Auto-query scene bounds if not provided
        if (!bMin || !bMax) {
          const boundsResult = await client.callMethod('ApiRenderEngine', 'getSceneBounds', {});
          const br = boundsResult as any;
          if (br?.result === false) {
            return errorResult('Scene is empty — no geometry to frame.');
          }
          bMin = br?.bboxMin ?? br?.bbox_min;
          bMax = br?.bboxMax ?? br?.bbox_max;
          if (!bMin || !bMax) {
            return errorResult('Could not read scene bounds. Pass bbox_min/bbox_max explicitly.');
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

        const fit = computeFitCamera(bMin, bMax, margin, elevation, yaw);

        // gRPC SetCamera now persists to both LiveLink and node graph attributes
        await client.callMethod('LiveLink', 'SetCamera', {
          position: fit.position,
          target: fit.target,
          up: { x: 0, y: 1, z: 0 },
        });

        return jsonResult({
          success: true,
          position: fit.position,
          target: fit.target,
          distance: fit.distance,
          bbox_min: bMin,
          bbox_max: bMax,
          extents: fit.extents,
          margin,
          elevation,
          yaw,
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
