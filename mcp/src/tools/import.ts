/**
 * Import & Analysis Tools — import_glb, analyze_mesh
 *
 * import_glb: Converts external 3D assets (GLB/glTF) to OBJ and loads them into Octane.
 * analyze_mesh: Analyzes an OBJ mesh file to suggest orientation, scale, and ground placement.
 *              Results cached in .mesh_info.json sidecar files next to the OBJ.
 *              v2: Includes visual mugshot analysis via VLM for reliable orientation detection.
 *
 * Uses Python trimesh for geometry analysis (must be installed: pip install trimesh).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { OctaneMcpClient, mcpLog, mcpLogLazy } from '../OctaneMcpClient';
import { computeFitCamera } from './camera';
import { ApiCache } from '../ApiCache';
import {
  jsonResult,
  errorResult,
  validateFilePath,
  extractHandle,
  extractValue,
  OBJ_API_NODE,
  OBJ_API_NODE_GRAPH,
  OBJ_API_ITEM,
} from './utils';
import { notifyWebapp } from './webapp';
import { AttributeId, NodeTypeId } from '../shared/OctaneConstants';
import { enumeratePins } from './pin-utils';
import { analyzeReference } from '../vision/index';

const execFileAsync = promisify(execFile);

/** Default output directory for converted assets */
const ASSETS_DIR = path.resolve(__dirname, '../../assets');

/**
 * Convert GLB to OBJ using Python trimesh.
 * Returns { objPath, texturePaths, vertices, faces, bounds }.
 */
async function convertGlbToObj(
  glbPath: string,
  outDir: string,
  name: string
): Promise<{
  objPath: string;
  texturePaths: string[];
  vertices: number;
  faces: number;
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
}> {
  const script = `
import trimesh, json, os, sys

glb_path = sys.argv[1]
out_dir = sys.argv[2]
name = sys.argv[3]

os.makedirs(out_dir, exist_ok=True)
scene = trimesh.load(glb_path)
if hasattr(scene, 'geometry'):
    mesh = trimesh.util.concatenate(list(scene.geometry.values()))
else:
    mesh = scene

obj_path = os.path.join(out_dir, name + '.obj')
mesh.export(obj_path, file_type='obj')

# Find exported texture files
textures = [f for f in os.listdir(out_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]

result = {
    'objPath': obj_path,
    'texturePaths': [os.path.join(out_dir, t) for t in textures],
    'vertices': len(mesh.vertices),
    'faces': len(mesh.faces),
    'boundsMin': mesh.bounds[0].tolist(),
    'boundsMax': mesh.bounds[1].tolist()
}
print(json.dumps(result))
`;

  const { stdout, stderr } = await execFileAsync('python', ['-c', script, glbPath, outDir, name], {
    timeout: 60000,
  });

  if (stderr && !stdout.trim()) {
    throw new Error(`Conversion failed: ${stderr}`);
  }

  return JSON.parse(stdout.trim());
}

// ── Mesh Analysis ─────────────────────────────────────────────────

/** Read OBJ bounding box via Python trimesh (no Octane needed). */
async function getMeshBounds(objPath: string): Promise<{
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
  vertices: number;
  faces: number;
}> {
  const script = `
import trimesh, json, sys
mesh = trimesh.load(sys.argv[1], force='mesh')
result = {
    'boundsMin': mesh.bounds[0].tolist(),
    'boundsMax': mesh.bounds[1].tolist(),
    'vertices': len(mesh.vertices),
    'faces': len(mesh.faces)
}
print(json.dumps(result))
`;
  const { stdout, stderr } = await execFileAsync('python', ['-c', script, objPath], {
    timeout: 30000,
  });
  if (stderr && !stdout.trim()) throw new Error(`trimesh bounds failed: ${stderr}`);
  return JSON.parse(stdout.trim());
}

/** Sidecar filename for mesh analysis cache. */
function sidecarPath(objPath: string): string {
  const dir = path.dirname(objPath);
  const base = path.basename(objPath, path.extname(objPath));
  return path.join(dir, `${base}.mesh_info.json`);
}

// ── Category / orientation knowledge base ─────────────────────────

interface CategoryInfo {
  category: string;
  naturalHeightM: number;
  expectUpright: boolean;
  confidence: 'high' | 'medium' | 'low';
}

/** Name-based category inference. Matches substrings in the asset folder/file name. */
const CATEGORY_PATTERNS: [RegExp, CategoryInfo][] = [
  [
    /fairy/i,
    { category: 'character', naturalHeightM: 0.15, expectUpright: true, confidence: 'high' },
  ],
  [
    /samurai/i,
    { category: 'character', naturalHeightM: 1.75, expectUpright: true, confidence: 'high' },
  ],
  [
    /dragon/i,
    { category: 'creature', naturalHeightM: 3.0, expectUpright: true, confidence: 'medium' },
  ],
  [
    /gargoyle/i,
    { category: 'creature', naturalHeightM: 0.8, expectUpright: true, confidence: 'medium' },
  ],
  [/skull/i, { category: 'prop', naturalHeightM: 0.25, expectUpright: true, confidence: 'medium' }],
  [
    /mushroom|shroom/i,
    { category: 'organic', naturalHeightM: 0.15, expectUpright: true, confidence: 'high' },
  ],
  [
    /flower/i,
    { category: 'organic', naturalHeightM: 0.3, expectUpright: true, confidence: 'high' },
  ],
  [/fern/i, { category: 'organic', naturalHeightM: 0.5, expectUpright: true, confidence: 'high' }],
  [
    /rock|stone/i,
    { category: 'mineral', naturalHeightM: 0.5, expectUpright: false, confidence: 'low' },
  ],
  [
    /crystal/i,
    { category: 'mineral', naturalHeightM: 0.3, expectUpright: false, confidence: 'low' },
  ],
  [
    /obsidian/i,
    { category: 'mineral', naturalHeightM: 0.4, expectUpright: false, confidence: 'low' },
  ],
  [/moss/i, { category: 'organic', naturalHeightM: 0.1, expectUpright: false, confidence: 'low' }],
  [/tree/i, { category: 'organic', naturalHeightM: 5.0, expectUpright: true, confidence: 'high' }],
  [
    /temple/i,
    { category: 'architecture', naturalHeightM: 3.0, expectUpright: true, confidence: 'high' },
  ],
];

const DEFAULT_CATEGORY: CategoryInfo = {
  category: 'unknown',
  naturalHeightM: 1.0,
  expectUpright: true,
  confidence: 'low',
};

function inferCategory(assetName: string): CategoryInfo {
  for (const [pattern, info] of CATEGORY_PATTERNS) {
    if (pattern.test(assetName)) return info;
  }
  return DEFAULT_CATEGORY;
}

/** Geometric orientation analysis from bounding box extents. */
function analyzeOrientation(
  boundsMin: [number, number, number],
  boundsMax: [number, number, number],
  categoryInfo: CategoryInfo
): {
  suggestedRotation: { x: number; y: number; z: number };
  groundOffsetY: number;
  uprightAxis: 'X' | 'Y' | 'Z';
  confidence: 'high' | 'medium' | 'low';
  notes: string;
} {
  const extents = [
    boundsMax[0] - boundsMin[0], // X
    boundsMax[1] - boundsMin[1], // Y
    boundsMax[2] - boundsMin[2], // Z
  ];

  // Find tallest axis
  const maxIdx = extents.indexOf(Math.max(...extents));
  const uprightAxis = (['X', 'Y', 'Z'] as const)[maxIdx];

  let suggestedRotation = { x: 0, y: 0, z: 0 };
  let notes = '';
  let confidence = categoryInfo.confidence;

  if (!categoryInfo.expectUpright) {
    // Rocks, crystals, moss — no preferred orientation
    notes = `${categoryInfo.category}, no preferred orientation. Tallest axis is ${uprightAxis}.`;
    // Still place on ground — use current Y min
    return {
      suggestedRotation,
      groundOffsetY: -boundsMin[1],
      uprightAxis,
      confidence,
      notes,
    };
  }

  // For upright objects, ensure tallest axis maps to Y
  if (maxIdx === 0) {
    // Tallest is X — rotate +90° around Z to stand up
    // +90° Z rotation: (x,y,z) → (-y, x, z). Min Y after = -boundsMax[0] if neg, but
    // ground offset = max(0, -min_Y_after_rotation).
    // After Z+90: new Y = original X. Min Y after = boundsMin[0].
    suggestedRotation = { x: 0, y: 0, z: 90 };
    const minYAfterZRot = boundsMin[0]; // X maps to Y
    notes = `Tallest axis is X (lying sideways). Rotate Z+90° to stand upright.`;
    return {
      suggestedRotation,
      groundOffsetY: Math.max(0, -minYAfterZRot),
      uprightAxis,
      confidence: confidence === 'low' ? 'low' : 'medium',
      notes,
    };
  } else if (maxIdx === 2) {
    // Tallest is Z — rotate +90° around X to stand up (Z-up → Y-up)
    // +90° X rotation: (x,y,z) → (x, -z, y). So new Y = -original_Z.
    // If original Z range is [-0.81, 0], after rotation Y range is [0, 0.81].
    // Min Y after = -boundsMax[2], so ground offset = max(0, boundsMax[2]).
    // For typical Z-up models where Z goes negative (below origin), this gives offset ≈ 0.
    suggestedRotation = { x: 90, y: 0, z: 0 };
    const minYAfterXRot = -boundsMax[2]; // -Z maps to Y after +90 X
    notes = `Tallest axis is Z (Z-up model). Rotate X+90° to convert to Y-up.`;
    return {
      suggestedRotation,
      groundOffsetY: Math.max(0, -minYAfterXRot),
      uprightAxis,
      confidence: confidence === 'low' ? 'low' : 'medium',
      notes,
    };
  }

  // Already Y-up
  notes = `${categoryInfo.category}, Y-up native. No rotation needed.`;
  return {
    suggestedRotation,
    groundOffsetY: -boundsMin[1],
    uprightAxis,
    confidence,
    notes,
  };
}

// ── Mugshot Rendering + VLM Orientation Analysis ─────────────────

/** Well-known node type IDs for mugshot scene construction. */
const MUGSHOT_TYPES = {
  RT: 56, // NT_RENDERTARGET
  CAM: 13, // NT_CAM_THINLENS
  KERN_PT: 25, // NT_KERN_PATHTRACING
  GEO_GROUP: 3, // NT_GEO_GROUP
  GEO_OBJECT: 153, // NT_GEO_OBJECT (primitives)
  GEO_MESH: 1, // NT_GEO_MESH
  GEO_PLACEMENT: 4, // NT_GEO_PLACEMENT
  ENV_DAYLIGHT: 14, // NT_ENV_DAYLIGHT
};

/** Mugshot view configuration. */
interface MugshotView {
  name: string; // e.g. "front_clay"
  yaw: number; // camera orbit degrees
  elevation: number;
  clay: boolean; // true = grey clay, false = textured
}

/**
 * Mugshot views — 8 clay views for full 360° spatial coverage.
 * Geometric guess rotation IS applied so VLM sees the mesh (hopefully) upright.
 * Ring 1: 4 cardinal eye-level views (full horizontal silhouette).
 * Ring 2: 2 elevated diagonals from opposing corners (3D depth).
 * Ring 3: true overhead + below-angle (vertical extremes, catches inversions).
 */
const MUGSHOT_VIEWS: MugshotView[] = [
  // Ring 1 — Eye-level cardinals (full 360° horizontal)
  { name: 'front', yaw: 0, elevation: 0, clay: true },
  { name: 'right', yaw: 90, elevation: 0, clay: true },
  { name: 'back', yaw: 180, elevation: 0, clay: true },
  { name: 'left', yaw: 270, elevation: 0, clay: true },
  // Ring 2 — Elevated diagonals (opposing corners)
  { name: 'front_high', yaw: 45, elevation: 35, clay: true },
  { name: 'back_high', yaw: 225, elevation: 35, clay: true },
  // Ring 3 — Vertical extremes
  { name: 'top', yaw: 0, elevation: 85, clay: true },
  { name: 'below_front', yaw: 0, elevation: -25, clay: true },
];

/** Helper: create a node and return its handle. */
async function createNodeRaw(client: OctaneMcpClient, typeId: number): Promise<number> {
  const rootHandle = await client.getRootNodeGraph();
  const result = await client.callMethod('ApiNode', 'create', {
    type: typeId,
    ownerGraph: { handle: String(rootHandle), type: OBJ_API_NODE_GRAPH },
    configurePins: true,
  });
  const handle = extractHandle(result);
  if (!handle) throw new Error(`Failed to create node type ${typeId}`);
  return handle;
}

/** Helper: connect source to target at pin index. */
async function connectRaw(
  client: OctaneMcpClient,
  targetHandle: number,
  sourceHandle: number,
  pinIdx: number
): Promise<void> {
  await client.callMethod('ApiNode', 'connectToIx', {
    objectPtr: { handle: String(targetHandle), type: OBJ_API_NODE },
    pinIdx,
    sourceNode: { handle: String(sourceHandle), type: OBJ_API_NODE },
    evaluate: true,
    doCycleCheck: true,
  });
}

/** Helper: get the child node connected to a pin. */
async function getConnectedChild(
  client: OctaneMcpClient,
  handle: number,
  pinIx: number
): Promise<number> {
  const result = await client.callMethod('ApiNode', 'connectedNodeIx', {
    objectPtr: { handle: String(handle), type: OBJ_API_NODE },
    pinIx,
    enterWrapperNode: true,
  });
  return Number(result?.result?.handle ?? 0);
}

/** Helper: set an attribute value on a node via ApiItem.setValueByAttrID.
 *  Matches the pattern used by the set_attribute MCP tool in attribute.ts. */
async function setAttrRaw(
  client: OctaneMcpClient,
  handle: number,
  attrId: number,
  attrType: number,
  value: any
): Promise<void> {
  let valueParams: Record<string, any> = {};
  if (attrType === 1) valueParams = { bool_value: Boolean(value) };
  else if (attrType === 3) valueParams = { int_value: Number(value) };
  else if (attrType === 9) valueParams = { float_value: Number(value) };
  else if (attrType === 11) {
    const v = typeof value === 'object' ? value : { x: 0, y: 0, z: 0 };
    valueParams = { float3_value: { x: v.x, y: v.y, z: v.z } };
  } else if (attrType === 14) valueParams = { string_value: String(value) };
  else throw new Error(`Unsupported attr type ${attrType}`);

  // A_FILENAME (34) triggers SDK file load — use extended timeout
  const timeout = attrId === AttributeId.A_FILENAME ? 120_000 : undefined;
  await client.callMethod(
    'ApiItem',
    'setValueByAttrID',
    {
      objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
      attribute_id: attrId,
      ...valueParams,
      evaluate: false,
    },
    timeout
  );
}

/**
 * Render 6 mugshot views of a single mesh on an isolated ground plane.
 * Pre-pass: expects an empty/reset scene. Builds temp scene, renders, cleans up.
 *
 * Returns paths to the 6 saved PNGs.
 */
async function renderMugshots(
  client: OctaneMcpClient,
  cache: ApiCache | null,
  objPath: string,
  rotationGuess: { x: number; y: number; z: number },
  groundOffsetY: number,
  outputDir: string,
  baseName: string,
  meshExtents?: { x: number; y: number; z: number },
  rawBoundsMin?: { x: number; y: number; z: number },
  rawBoundsMax?: { x: number; y: number; z: number }
): Promise<string[]> {
  mcpLog(`mugshot: building isolated scene for ${baseName}`, 'info');
  const savedPaths: string[] = [];

  // Create mugshot scene infrastructure
  const rt = await createNodeRaw(client, MUGSHOT_TYPES.RT);
  const cam = await createNodeRaw(client, MUGSHOT_TYPES.CAM);
  const kern = await createNodeRaw(client, MUGSHOT_TYPES.KERN_PT);
  const geoGroup = await createNodeRaw(client, MUGSHOT_TYPES.GEO_GROUP);
  const env = await createNodeRaw(client, MUGSHOT_TYPES.ENV_DAYLIGHT);

  // Wire RT: camera(0), environment(1), geometry(3), kernel(6)
  await connectRaw(client, rt, cam, 0);
  await connectRaw(client, rt, env, 1);
  await connectRaw(client, rt, geoGroup, 3);
  await connectRaw(client, rt, kern, 6);

  // Disable DOF on camera — pin 14 (aperture)
  const aperturePinHandle = await getConnectedChild(client, cam, 14);
  if (aperturePinHandle) {
    await setAttrRaw(client, aperturePinHandle, AttributeId.A_VALUE, 9, 0);
  }

  // Set env power low for clean mugshot lighting — pin 2 (power)
  const envPowerHandle = await getConnectedChild(client, env, 2);
  if (envPowerHandle) {
    await setAttrRaw(client, envPowerHandle, AttributeId.A_VALUE, 9, 0.8);
  }

  // Geo group needs 1 pin for the mesh (no ground plane — it occludes side views)
  await setAttrRaw(client, geoGroup, AttributeId.A_PIN_COUNT, 3, 1);

  // Create mesh + placement for the asset
  const mesh = await createNodeRaw(client, MUGSHOT_TYPES.GEO_MESH);
  const placement = await createNodeRaw(client, MUGSHOT_TYPES.GEO_PLACEMENT);

  // Load OBJ file
  await setAttrRaw(client, mesh, AttributeId.A_FILENAME, 14, objPath);

  // Connect mesh to placement geometry pin (pin 1)
  await connectRaw(client, placement, mesh, 1);

  // Apply geometric guess rotation so VLM sees the mesh (hopefully) upright.
  // This makes mugshots human-readable: base at bottom, figure standing.
  // VLM confirms or provides additional correction.
  const placementXform = await getConnectedChild(client, placement, 0); // transform pin
  if (placementXform) {
    await setAttrRaw(client, placementXform, AttributeId.A_ROTATION, 11, rotationGuess);
    await setAttrRaw(client, placementXform, AttributeId.A_TRANSLATION, 11, {
      x: 0,
      y: groundOffsetY,
      z: 0,
    });
  }

  // Connect placement to geo group (pin 0 — only object, no ground plane)
  await connectRaw(client, geoGroup, placement, 0);

  // Flush scene so Octane computes post-rotation bounds
  await client.callMethod('ApiChangeManager', 'update', {});

  // Select this RT for rendering
  await client.callMethod('ApiRenderEngine', 'setRenderTargetNode', {
    targetNode: { handle: String(rt), type: OBJ_API_NODE },
  });

  // Set low max samples for fast mugshot renders
  const maxSamplesHandle = await getConnectedChild(client, kern, 0); // maxsamples pin
  if (maxSamplesHandle) {
    await setAttrRaw(client, maxSamplesHandle, AttributeId.A_VALUE, 3, 100);
  }

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Get ACTUAL scene bounds from Octane (post-rotation, post-translation).
  // This is the ground truth for camera framing — no manual bbox math needed.
  let meshBboxMin = { x: -0.5, y: 0, z: -0.5 };
  let meshBboxMax = { x: 0.5, y: 1, z: 0.5 };
  try {
    const sceneBounds = await client.callMethod('ApiRenderEngine', 'getSceneBounds', {});
    if (sceneBounds?.bboxMin && sceneBounds?.bboxMax) {
      meshBboxMin = {
        x: sceneBounds.bboxMin.x,
        y: sceneBounds.bboxMin.y,
        z: sceneBounds.bboxMin.z,
      };
      meshBboxMax = {
        x: sceneBounds.bboxMax.x,
        y: sceneBounds.bboxMax.y,
        z: sceneBounds.bboxMax.z,
      };
      mcpLog(
        `mugshot: scene bounds = (${meshBboxMin.x.toFixed(3)}, ${meshBboxMin.y.toFixed(3)}, ${meshBboxMin.z.toFixed(3)}) → (${meshBboxMax.x.toFixed(3)}, ${meshBboxMax.y.toFixed(3)}, ${meshBboxMax.z.toFixed(3)})`,
        'info'
      );
    }
  } catch (e: any) {
    mcpLog(`mugshot: getSceneBounds failed (${e.message}), using fallback bbox`, 'warn');
  }

  // Render each view
  for (const view of MUGSHOT_VIEWS) {
    mcpLog(`mugshot: rendering ${view.name}`, 'info');

    // Set clay mode
    await client.callMethod('ApiRenderEngine', 'setClayMode', { mode: view.clay ? 1 : 0 });

    // Use computeFitCamera — same proven math as the fit_camera MCP tool
    const fit = computeFitCamera(meshBboxMin, meshBboxMax, 0.15, view.elevation, view.yaw);
    const camX = fit.position.x;
    const camY = fit.position.y;
    const camZ = fit.position.z;

    await client.callMethod('LiveLink', 'SetCamera', {
      position: fit.position,
      target: fit.target,
      up: { x: 0, y: 1, z: 0 },
    });

    // Start render and wait for completion
    await client.callMethod('ApiChangeManager', 'update', {});
    await client.callMethod('ApiRenderEngine', 'continueRendering', {});

    // Poll for render completion (max 30s)
    const startTime = Date.now();
    while (Date.now() - startTime < 30000) {
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        const stats = await client.callMethod('ApiRenderEngine', 'getRenderStatistics', {});
        const s = stats?.statistics ?? stats;
        if (s?.beautySamplesPerPixel >= 100 || s?.state === 'RSTATE_FINISHED') break;
      } catch {
        /* ignore polling errors */
      }
    }

    // Save render
    const outPath = path.join(outputDir, `${baseName}.mugshot_${view.name}.png`);
    await client.callMethod(
      'ApiRenderEngine',
      'saveImage1',
      {
        renderPassId: 0,
        fullPath: outPath,
        imageSaveFormat: 0, // PNG
        colorSpace: 1,
        premultipliedAlphaType: 0,
        exrCompressionType: 4,
        exrCompressionLevel: 4.5,
        asynchronous: false,
      },
      120_000
    );
    savedPaths.push(outPath);
    mcpLog(`mugshot: saved ${view.name} → ${outPath}`, 'info');
  }

  // Restore clay mode to normal
  await client.callMethod('ApiRenderEngine', 'setClayMode', { mode: 0 });

  mcpLog(`mugshot: rendered ${savedPaths.length} views for ${baseName}`, 'info');
  return savedPaths;
}

/** Build VLM orientation prompt with mesh metadata for informed analysis. */
function buildOrientationPrompt(metadata?: {
  filename?: string;
  category?: string;
  subcategory?: string;
  extents?: { x: number; y: number; z: number };
  tallestAxis?: string;
  geometricGuess?: { x: number; y: number; z: number };
  sceneContext?: string;
}): string {
  let metaBlock = '';
  if (metadata) {
    const lines: string[] = ['Mesh metadata (use ONLY for identification, NOT for orientation):'];
    if (metadata.filename) lines.push(`- Filename: "${metadata.filename}"`);
    if (metadata.category)
      lines.push(
        `- Category: ${metadata.category}${metadata.subcategory ? ` (${metadata.subcategory})` : ''}`
      );
    if (metadata.extents)
      lines.push(
        `- Bounding box extents: ${metadata.extents.x.toFixed(3)} × ${metadata.extents.y.toFixed(3)} × ${metadata.extents.z.toFixed(3)}`
      );
    if (metadata.tallestAxis) lines.push(`- Tallest axis: ${metadata.tallestAxis}`);
    if (metadata.geometricGuess)
      lines.push(
        `- Geometric guess rotation applied: (${metadata.geometricGuess.x}, ${metadata.geometricGuess.y}, ${metadata.geometricGuess.z})°`
      );
    if (metadata.sceneContext) lines.push(`- Scene context: ${metadata.sceneContext}`);
    lines.push('');
    lines.push(
      'CRITICAL: The metadata tells you WHAT this object is. But you MUST determine orientation'
    );
    lines.push('(upright, front direction) ONLY from the actual pixel content of the images.');
    lines.push(
      'Do NOT assume the FRONT view (image 1) shows the face/front of the object — it may show the back.'
    );
    lines.push(
      'Do NOT hallucinate features. If you cannot see eye sockets, teeth, or a face in a view, say so.'
    );
    metaBlock = '\n' + lines.join('\n') + '\n';
  }

  return `You are analyzing 8 clay renders of a 3D mesh for orientation correctness.
A geometric guess rotation has been applied. The mesh is in empty space (no ground plane).
${metaBlock}
Views (in image order):
1. FRONT (yaw=0°, eye level) — looking at the front face
2. RIGHT (yaw=90°, eye level) — looking at the right side
3. BACK (yaw=180°, eye level) — looking at the rear
4. LEFT (yaw=270°, eye level) — looking at the left side
5. FRONT-HIGH (yaw=45°, 35° above) — elevated three-quarter from front-right
6. BACK-HIGH (yaw=225°, 35° above) — elevated three-quarter from back-left
7. TOP (near-overhead, 85° above) — plan view looking straight down
8. BELOW-FRONT (yaw=0°, 25° below eye level) — looking slightly upward at the base

Cross-reference strategy:
- Compare FRONT (1) vs BACK (3) to verify front/back orientation
- Compare RIGHT (2) vs LEFT (4) to check symmetry and side identity
- Compare FRONT-HIGH (5) vs BACK-HIGH (6) for 3D structure confirmation
- TOP (7) reveals plan-view shape (important for flat or wide objects)
- BELOW-FRONT (8) shows the base/underside — key for detecting inverted objects

If the object is something where orientation does not meaningfully matter (sphere, abstract rock, amorphous blob), set orientation_matters to false.

For thin/flat objects (coins, plates, leaves): side views showing a thin edge/line is EXPECTED and correct — do not flag this as a problem.

Respond in JSON format ONLY (no markdown, no explanation):
{
  "object_type": "description of what this object is",
  "is_upright": true/false,
  "orientation_matters": true/false,
  "confidence": "high" | "medium" | "low",
  "correction_rotation": {"x": 0, "y": 0, "z": 0},
  "front_direction": "toward_camera | away | left | right",
  "estimated_height_m": 0.0,
  "notes": "what you see across all views, cross-reference observations"
}

Rules:
- "is_upright" = the object is standing naturally as it would in the real world
- "orientation_matters" = false for symmetric/amorphous objects where any rotation is acceptable
- "confidence" = how certain you are about the identification and orientation judgment
- correction_rotation is the ADDITIONAL rotation needed on top of what was already applied
- If upright AND facing front, set correction_rotation to {0,0,0}
- If NOT upright, provide the X/Z rotation correction needed
- "front_direction" is CRITICAL and must be based on PIXEL EVIDENCE, not assumptions:
  - First identify which view shows the object's natural front (face, eyes, opening, decorative side)
  - Then report where that front points relative to FRONT camera (view 1):
  - "toward_camera" = the face/front is visible in view 1 (FRONT)
  - "away" = the face/front is visible in view 3 (BACK) — meaning it points away from FRONT camera
  - "left" = the face/front is visible in view 4 (LEFT)
  - "right" = the face/front is visible in view 2 (RIGHT)
  - In your notes, state WHICH VIEW number shows the face/front and WHAT features you see there
- For creatures/skulls: eye sockets, nostrils, jaw opening, teeth define the face
- A smooth rounded surface is likely the BACK of a skull, not the face
- Cross-reference opposing views before concluding — describe what you see in BOTH
- Use metadata to help identify the object type, but determine orientation from pixels only
- "estimated_height_m" is the real-world height when properly oriented`;
}

/**
 * Send mugshot images to VLM for orientation analysis.
 * Returns structured orientation data or null if VLM unavailable.
 */
async function analyzeMugshotsWithVLM(
  mugshotPaths: string[],
  metadata?: Parameters<typeof buildOrientationPrompt>[0]
): Promise<{
  object_type: string;
  is_upright: boolean;
  orientation_matters: boolean;
  confidence: 'high' | 'medium' | 'low';
  correction_rotation_deg?: { x: number; y: number; z: number };
  correction_rotation?: { x: number; y: number; z: number };
  front_direction: string;
  estimated_height_m: number;
  notes: string;
  vlm_model?: string;
} | null> {
  const prompt = buildOrientationPrompt(metadata);
  // Reuse analyzeReference which already handles multi-image VLM calls
  // We need to use callVision directly for multi-image support
  const { detectBackend } = await import('../vision/index');
  const backend = detectBackend();

  if (backend === 'self') {
    mcpLog('mugshot VLM: no vision backend available, skipping visual check', 'warn');
    return null;
  }

  // Load all images
  const images = mugshotPaths.map(p => {
    const buffer = fs.readFileSync(path.resolve(p));
    const ext = path.extname(p).toLowerCase();
    const mediaType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
    return { base64: buffer.toString('base64'), mediaType };
  });

  // Try Anthropic first
  try {
    const { callAnthropicVision, getAnthropicKey } = await import('../vision/anthropic');
    const key = getAnthropicKey();
    if (key) {
      const result = await callAnthropicVision(prompt, images, {
        apiKey: key,
        model: process.env.VISION_MODEL || 'claude-haiku-4-5-20251001',
        maxTokens: 1000,
      });

      // Parse JSON response
      const text = result.text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Default new v3 fields if VLM didn't include them
        parsed.orientation_matters = parsed.orientation_matters ?? true;
        parsed.confidence = parsed.confidence ?? 'medium';
        mcpLog(
          `mugshot VLM: ${parsed.object_type}, upright=${parsed.is_upright}, orientation_matters=${parsed.orientation_matters}, confidence=${parsed.confidence}`,
          'info'
        );
        return { ...parsed, vlm_model: result.model };
      }
    }
  } catch (e: any) {
    mcpLog(`mugshot VLM: Anthropic failed: ${e.message}`, 'warn');
  }

  // Try Gemini fallback
  try {
    const { callGeminiVision, getGeminiKey } = await import('../vision/gemini');
    const key = getGeminiKey();
    if (key) {
      const result = await callGeminiVision(prompt, images, { apiKey: key });
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        parsed.orientation_matters = parsed.orientation_matters ?? true;
        parsed.confidence = parsed.confidence ?? 'medium';
        return { ...parsed, vlm_model: result.model };
      }
    }
  } catch (e: any) {
    mcpLog(`mugshot VLM: Gemini failed: ${e.message}`, 'warn');
  }

  return null;
}

export function registerImportTools(
  server: McpServer,
  client: OctaneMcpClient,
  cache: ApiCache | null
) {
  server.tool(
    'import_glb',
    'Import a GLB/glTF 3D model into the Octane scene. Converts to OBJ, creates mesh + placement + material with texture, and returns all handles. The placement is NOT connected to a geo group — caller must do that. Orientation note: OTOY Studio GLBs are Z-up; apply rotation {90,0,0} on placement transform to stand upright in Octane (Y-up).',
    {
      glb_path: z.string().describe('Absolute path to GLB file (e.g. C:\\Users\\...\\model.glb)'),
      name: z
        .string()
        .optional()
        .describe(
          'Asset name for output folder/files (default: derived from filename). Used as subfolder under assets/.'
        ),
      metallic: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe('Metallic value 0-1 for material (default: 0.3)'),
      roughness: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe('Roughness value 0-1 for material (default: 0.4)'),
    },
    async ({ glb_path, name: assetName, metallic, roughness }) => {
      try {
        // Validate input path
        if (!fs.existsSync(glb_path)) {
          return errorResult(new Error(`File not found: ${glb_path}`));
        }
        if (!glb_path.toLowerCase().endsWith('.glb') && !glb_path.toLowerCase().endsWith('.gltf')) {
          return errorResult(new Error('File must be .glb or .gltf'));
        }

        // Derive name from filename if not provided
        const derivedName =
          assetName ||
          path
            .basename(glb_path, path.extname(glb_path))
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .substring(0, 40);
        const outDir = path.join(ASSETS_DIR, derivedName);

        // Validate output path
        const pathError = validateFilePath(outDir);
        if (pathError) return errorResult(new Error(pathError));

        // Phase 1: Convert GLB → OBJ
        mcpLog(`import_glb: converting ${glb_path} → ${outDir}/${derivedName}.obj`, 'info');
        const conv = await convertGlbToObj(glb_path, outDir, derivedName);
        mcpLog(
          `import_glb: converted ${conv.vertices} verts, ${conv.faces} faces, ${conv.texturePaths.length} textures`,
          'info'
        );

        // Phase 2: Create NT_GEO_MESH and set filename
        const rootGraph = await client.getRootNodeGraph();
        const meshResult = await client.callMethod('ApiNode', 'create', {
          type: NodeTypeId.NT_GEO_MESH,
          ownerGraph: { handle: String(rootGraph), type: OBJ_API_NODE_GRAPH },
          configurePins: true,
        });
        const meshHandle = extractHandle(meshResult) ?? 0;
        if (!meshHandle) throw new Error('Failed to create NT_GEO_MESH node');

        // Set OBJ filename — extended timeout for large mesh loads
        await client.callMethod(
          'ApiItem',
          'setValueByAttrID',
          {
            objectPtr: { handle: String(meshHandle), type: OBJ_API_ITEM },
            attribute_id: AttributeId.A_FILENAME,
            string_value: conv.objPath.replace(/\//g, '\\'),
            evaluate: false,
          },
          120_000
        );

        // Reload mesh
        await client.callMethod('ApiItem', 'setValueByAttrID', {
          objectPtr: { handle: String(meshHandle), type: OBJ_API_ITEM },
          attribute_id: AttributeId.A_RELOAD,
          bool_value: true,
          evaluate: false,
        });

        client.sceneCache.addNode(meshHandle, 'Mesh', 'NT_GEO_MESH', 1);
        notifyWebapp({ type: 'nodeAdded', handle: meshHandle });

        // Phase 3: Create NT_GEO_PLACEMENT and connect mesh
        const placementResult = await client.callMethod('ApiNode', 'create', {
          type: NodeTypeId.NT_GEO_PLACEMENT,
          ownerGraph: { handle: String(rootGraph), type: OBJ_API_NODE_GRAPH },
          configurePins: true,
        });
        const placementHandle = extractHandle(placementResult) ?? 0;
        if (!placementHandle) throw new Error('Failed to create NT_GEO_PLACEMENT node');

        client.sceneCache.addNode(placementHandle, 'Placement', 'NT_GEO_PLACEMENT', 4);
        notifyWebapp({ type: 'nodeAdded', handle: placementHandle });

        // Connect mesh → placement pin "geometry" (pin index 1)
        await client.callMethod('ApiNode', 'connectToIx', {
          objectPtr: { handle: String(placementHandle), type: OBJ_API_NODE },
          pinIdx: 1,
          sourceNode: { handle: String(meshHandle), type: OBJ_API_NODE },
          evaluate: false,
          doCycleCheck: true,
        });

        // Get placement transform handle (pin 0 = transform)
        let transformHandle = 0;
        try {
          const connResult = await client.callMethod('ApiNode', 'connectedNodeIx', {
            objectPtr: { handle: String(placementHandle), type: OBJ_API_NODE },
            pinIx: 0,
            enterWrapperNode: true,
          });
          transformHandle = extractHandle(connResult) ?? 0;
        } catch (e: any) {
          mcpLogLazy('verbose', () => `[import:glb:transform_child] ${e?.message ?? e}`);
          /* no transform child */
        }

        // Phase 4: Create material with texture
        const matResult = await client.callMethod('ApiNode', 'create', {
          type: NodeTypeId.NT_MAT_UNIVERSAL,
          ownerGraph: { handle: String(rootGraph), type: OBJ_API_NODE_GRAPH },
          configurePins: true,
        });
        const matHandle = extractHandle(matResult) ?? 0;
        if (!matHandle) throw new Error('Failed to create NT_MAT_UNIVERSAL node');

        client.sceneCache.addNode(matHandle, 'Material', 'NT_MAT_UNIVERSAL', 130);
        notifyWebapp({ type: 'nodeAdded', handle: matHandle });

        // Connect material → mesh pin 0
        await client.callMethod('ApiNode', 'connectToIx', {
          objectPtr: { handle: String(meshHandle), type: OBJ_API_NODE },
          pinIdx: 0,
          sourceNode: { handle: String(matHandle), type: OBJ_API_NODE },
          evaluate: false,
          doCycleCheck: true,
        });

        let texHandle = 0;
        // If textures were exported, create NT_TEX_IMAGE and connect to albedo
        if (conv.texturePaths.length > 0) {
          const texResult = await client.callMethod('ApiNode', 'create', {
            type: NodeTypeId.NT_TEX_IMAGE,
            ownerGraph: { handle: String(rootGraph), type: OBJ_API_NODE_GRAPH },
            configurePins: true,
          });
          texHandle = extractHandle(texResult) ?? 0;

          if (texHandle) {
            client.sceneCache.addNode(texHandle, 'Texture', 'NT_TEX_IMAGE', 34);
            notifyWebapp({ type: 'nodeAdded', handle: texHandle });

            // Set texture filename — extended timeout for large textures
            await client.callMethod(
              'ApiItem',
              'setValueByAttrID',
              {
                objectPtr: { handle: String(texHandle), type: OBJ_API_ITEM },
                attribute_id: AttributeId.A_FILENAME,
                string_value: conv.texturePaths[0].replace(/\//g, '\\'),
                evaluate: false,
              },
              120_000
            );

            // Connect texture → material albedo (pin 2 on NT_MAT_UNIVERSAL)
            await client.callMethod('ApiNode', 'connectToIx', {
              objectPtr: { handle: String(matHandle), type: OBJ_API_NODE },
              pinIdx: 2, // albedo pin
              sourceNode: { handle: String(texHandle), type: OBJ_API_NODE },
              evaluate: false,
              doCycleCheck: true,
            });
          }
        }

        // Set metallic and roughness on material child pins via shared helper
        const matPins = await enumeratePins(client, matHandle);
        let metallicHandle = 0;
        let roughnessHandle = 0;
        for (const pin of matPins) {
          if (pin.name === 'metallic' && pin.connectedHandle) metallicHandle = pin.connectedHandle;
          if (pin.name === 'roughness' && pin.connectedHandle)
            roughnessHandle = pin.connectedHandle;
          if (metallicHandle && roughnessHandle) break;
        }

        const metallicVal = metallic ?? 0.3;
        const roughnessVal = roughness ?? 0.4;

        if (metallicHandle) {
          await client.callMethod('ApiItem', 'setValueByAttrID', {
            objectPtr: { handle: String(metallicHandle), type: OBJ_API_ITEM },
            attribute_id: AttributeId.A_VALUE,
            float3_value: { x: metallicVal, y: metallicVal, z: metallicVal },
            evaluate: false,
          });
        }
        if (roughnessHandle) {
          await client.callMethod('ApiItem', 'setValueByAttrID', {
            objectPtr: { handle: String(roughnessHandle), type: OBJ_API_ITEM },
            attribute_id: AttributeId.A_VALUE,
            float3_value: { x: roughnessVal, y: roughnessVal, z: roughnessVal },
            evaluate: false,
          });
        }

        mcpLog(
          `import_glb: complete — mesh=${meshHandle} placement=${placementHandle} material=${matHandle}`,
          'info'
        );

        // Compute mesh extents for orientation help
        const extents = [
          conv.boundsMax[0] - conv.boundsMin[0],
          conv.boundsMax[1] - conv.boundsMin[1],
          conv.boundsMax[2] - conv.boundsMin[2],
        ];

        return jsonResult({
          success: true,
          handles: {
            mesh: meshHandle,
            placement: placementHandle,
            transform: transformHandle,
            material: matHandle,
            texture: texHandle || undefined,
          },
          conversion: {
            obj_path: conv.objPath,
            textures: conv.texturePaths,
            vertices: conv.vertices,
            faces: conv.faces,
          },
          bounds: {
            min: conv.boundsMin,
            max: conv.boundsMax,
            extents,
          },
          orientation_hint:
            'OTOY Studio GLBs are Z-up. Set placement transform rotation to {90,0,0} to stand upright in Octane (Y-up). Orbit 3 views (front/right/top) to discover facing direction before framing.',
          next_steps: [
            `Connect placement (${placementHandle}) to geo group via pin_index N`,
            `Set transform rotation: set_attribute(${transformHandle}, ${AttributeId.A_ROTATION}, 11, {90, Y_rotation, 0})`,
            `Set transform position: set_attribute(${transformHandle}, ${AttributeId.A_TRANSLATION}, 11, {x, y, z})`,
            `Set transform scale: set_attribute(${transformHandle}, ${AttributeId.A_SCALE}, 11, {s, s, s})`,
          ],
        });
      } catch (error: any) {
        mcpLog(`import_glb FAILED: ${error.message}`, 'error');
        return errorResult(error);
      }
    }
  );

  // ── analyze_mesh ──────────────────────────────────────────────────

  server.tool(
    'analyze_mesh',
    'Analyze a mesh file (OBJ) and suggest proper orientation, scale, and ground placement for the scene. Returns advisory suggestions — not forced. Results cached in a .mesh_info.json sidecar next to the OBJ file. Use before placing meshes to avoid upside-down characters, floor penetration, and bunched objects.',
    {
      obj_path: z.string().describe('Absolute path to OBJ file'),
      scene_context: z
        .string()
        .optional()
        .describe('Scene description for better inference (e.g. "forest floor scene")'),
      target_height: z
        .number()
        .optional()
        .describe('Desired height in scene units (overrides auto-estimate)'),
      force_reanalyze: z
        .boolean()
        .optional()
        .default(false)
        .describe('Ignore cached sidecar, re-run analysis'),
    },
    async ({ obj_path, scene_context, target_height, force_reanalyze }) => {
      try {
        const resolved = path.resolve(obj_path);
        if (!fs.existsSync(resolved)) {
          return errorResult(new Error(`File not found: ${resolved}`));
        }
        if (!resolved.toLowerCase().endsWith('.obj')) {
          return errorResult(new Error('analyze_mesh currently supports .obj files only'));
        }

        const sidecar = sidecarPath(resolved);

        // Check sidecar cache
        if (!force_reanalyze && fs.existsSync(sidecar)) {
          try {
            const cached = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
            // v3 sidecar (8-view mugshots) is fully cached
            if (cached.version >= 3 && cached.visual_check?.performed_at) {
              mcpLog(
                `analyze_mesh: returning v3 cached sidecar for ${path.basename(resolved)}`,
                'info'
              );
              return jsonResult({
                ...cached,
                cached: true,
                sidecar_path: sidecar,
                instruction:
                  'Cached analysis returned (v3 with 8-view visual check). Use final_suggestion for transform. Override if scene intent differs.',
              });
            }
            // v2 sidecar (4-view) — still valid, return with upgrade hint
            if (cached.version === 2 && cached.visual_check?.performed_at) {
              mcpLog(
                `analyze_mesh: returning v2 cached sidecar for ${path.basename(resolved)} (upgrade available with force_reanalyze)`,
                'info'
              );
              return jsonResult({
                ...cached,
                cached: true,
                upgrade_available: true,
                sidecar_path: sidecar,
                instruction:
                  'Cached v2 analysis (4-view mugshots). Still valid. Use force_reanalyze=true to upgrade to v3 (8-view) for better orientation coverage.',
              });
            }
            // v1 sidecar — run full analysis
            mcpLog(`analyze_mesh: v1 sidecar found, upgrading to v3 with visual check`, 'info');
          } catch {
            mcpLog(`analyze_mesh: corrupt sidecar, re-analyzing`, 'warn');
          }
        }

        // Tier 1: Geometric analysis via trimesh
        mcpLog(`analyze_mesh: Tier 1 — trimesh bounds on ${path.basename(resolved)}`, 'info');
        const geo = await getMeshBounds(resolved);

        const extents = {
          x: geo.boundsMax[0] - geo.boundsMin[0],
          y: geo.boundsMax[1] - geo.boundsMin[1],
          z: geo.boundsMax[2] - geo.boundsMin[2],
        };

        // Tier 2: Semantic inference from filename
        mcpLog(`analyze_mesh: Tier 2 — semantic inference`, 'info');
        const assetDir = path.basename(path.dirname(resolved));
        const assetFile = path.basename(resolved, '.obj');
        const nameForInference = `${assetDir} ${assetFile}`;
        const categoryInfo = inferCategory(nameForInference);

        // Geometric orientation analysis (initial guess for mugshot)
        const orientation = analyzeOrientation(geo.boundsMin, geo.boundsMax, categoryInfo);

        // Scale suggestion
        const currentHeight = Math.max(extents.x, extents.y, extents.z);
        const desiredHeight = target_height ?? categoryInfo.naturalHeightM;
        const scaleFactor =
          desiredHeight > 0 && currentHeight > 0 ? desiredHeight / currentHeight : 1;

        // Tier 3: Visual mugshot analysis via VLM
        mcpLog(`analyze_mesh: Tier 3 — mugshot rendering + VLM check`, 'info');
        const outputDir = path.dirname(resolved);
        const baseName = path.basename(resolved, '.obj');

        let visualCheck: any = null;
        let mugshotPaths: string[] = [];
        let finalRotation = orientation.suggestedRotation;
        let finalGroundOffset = orientation.groundOffsetY;
        let finalConfidence = orientation.confidence;

        try {
          // Render 8 mugshot views (full 360° coverage)
          mugshotPaths = await renderMugshots(
            client,
            cache,
            resolved,
            orientation.suggestedRotation,
            orientation.groundOffsetY,
            outputDir,
            baseName,
            extents,
            { x: geo.boundsMin[0], y: geo.boundsMin[1], z: geo.boundsMin[2] },
            { x: geo.boundsMax[0], y: geo.boundsMax[1], z: geo.boundsMax[2] }
          );

          // Send to VLM for analysis — include metadata for informed identification
          const vlmResult = await analyzeMugshotsWithVLM(mugshotPaths, {
            filename: path.basename(resolved),
            category: categoryInfo.category,
            subcategory: assetFile,
            extents,
            tallestAxis: orientation.uprightAxis,
            geometricGuess: orientation.suggestedRotation,
            sceneContext: scene_context,
          });

          if (vlmResult) {
            const corr = vlmResult.correction_rotation_deg ??
              vlmResult.correction_rotation ?? { x: 0, y: 0, z: 0 };
            visualCheck = {
              performed_at: new Date().toISOString(),
              vlm_model: vlmResult.vlm_model,
              mugshot_views: MUGSHOT_VIEWS.length,
              mugshot_paths: mugshotPaths.map(p => path.basename(p)),
              vlm_response: {
                object_type: vlmResult.object_type,
                is_upright: vlmResult.is_upright,
                orientation_matters: vlmResult.orientation_matters,
                confidence: vlmResult.confidence,
                correction_rotation: corr,
                front_direction: vlmResult.front_direction,
                estimated_height_m: vlmResult.estimated_height_m,
                notes: vlmResult.notes,
              },
              confidence: vlmResult.confidence, // VLM self-assessed confidence
            };

            // Step 1: Apply upright correction
            if (!vlmResult.is_upright) {
              // Mugshot was rendered WITH geometric guess applied.
              // VLM correction is ADDITIONAL rotation on top of the guess.
              finalRotation = {
                x: orientation.suggestedRotation.x + (corr.x || 0),
                y: orientation.suggestedRotation.y + (corr.y || 0),
                z: orientation.suggestedRotation.z + (corr.z || 0),
              };
              mcpLog(
                `analyze_mesh: VLM says NOT upright, guess=(${orientation.suggestedRotation.x},${orientation.suggestedRotation.y},${orientation.suggestedRotation.z}) + correction=(${corr.x || 0},${corr.y || 0},${corr.z || 0}) → final=(${finalRotation.x},${finalRotation.y},${finalRotation.z})`,
                'info'
              );
            } else {
              // VLM confirms the geometric guess made it upright — guess is correct
              finalRotation = orientation.suggestedRotation;
              mcpLog(
                `analyze_mesh: VLM confirms upright with guess rotation (${finalRotation.x}, ${finalRotation.y}, ${finalRotation.z})° ✓`,
                'info'
              );
            }

            // Step 2: Apply front-facing correction based on front_direction
            // The object should face yaw=0° (toward FRONT camera). If VLM says the face
            // points elsewhere, rotate Y to bring it to front.
            const fd = (vlmResult.front_direction || '').toLowerCase().replace(/[^a-z_]/g, '');
            let facingYaw = 0;
            if (fd === 'away') facingYaw = 180;
            else if (fd === 'left') facingYaw = 90;
            else if (fd === 'right') facingYaw = -90;
            if (facingYaw !== 0 && vlmResult.orientation_matters !== false) {
              finalRotation = { ...finalRotation, y: finalRotation.y + facingYaw };
              mcpLog(
                `analyze_mesh: VLM says front faces "${vlmResult.front_direction}", applying Y+${facingYaw}° → final Y=${finalRotation.y}°`,
                'info'
              );
            }

            // Use VLM height estimate if available and category didn't have a strong one
            if (vlmResult.estimated_height_m > 0 && categoryInfo.confidence !== 'high') {
              // Could update desiredHeight here, but keep it advisory
            }

            finalConfidence = vlmResult.confidence; // VLM self-assessed
          } else {
            mcpLog(`analyze_mesh: VLM unavailable, using geometric+semantic only`, 'warn');
            finalConfidence = orientation.confidence;
          }
        } catch (e: any) {
          mcpLog(`analyze_mesh: mugshot/VLM failed (non-fatal): ${e.message}`, 'warn');
          // Fall back to geometric+semantic only
        }

        // Build v3 sidecar (8-view mugshots, orientation_matters, VLM confidence)
        const result: any = {
          version: 3,
          obj_file: path.basename(resolved),
          analyzed_at: new Date().toISOString(),
          geometry: {
            bounds_min: [geo.boundsMin[0], geo.boundsMin[1], geo.boundsMin[2]],
            bounds_max: [geo.boundsMax[0], geo.boundsMax[1], geo.boundsMax[2]],
            extents: [extents.x, extents.y, extents.z],
            vertices: geo.vertices,
            faces: geo.faces,
            tallest_axis: orientation.uprightAxis,
            native_up: orientation.uprightAxis,
          },
          semantic: {
            category: categoryInfo.category,
            subcategory: assetFile,
            natural_height_m: categoryInfo.naturalHeightM,
            orientation_matters:
              visualCheck?.vlm_response?.orientation_matters ?? categoryInfo.expectUpright,
            confidence: categoryInfo.confidence,
          },
          visual_check: visualCheck,
          final_suggestion: {
            rotation_deg: [finalRotation.x, finalRotation.y, finalRotation.z],
            ground_offset_y: finalGroundOffset,
            scale_factor: scaleFactor,
            notes: visualCheck
              ? `VLM-verified: ${visualCheck.vlm_response.is_upright ? 'upright confirmed — no rotation needed' : `correction applied — rotate (${finalRotation.x}, ${finalRotation.y}, ${finalRotation.z})°`}. ${categoryInfo.category}.`
              : `Geometric+semantic only (VLM unavailable). ${orientation.notes}`,
          },
        };

        // Also include the legacy format fields for backward compatibility
        const legacyResult = {
          ...result,
          bounds: {
            min: { x: geo.boundsMin[0], y: geo.boundsMin[1], z: geo.boundsMin[2] },
            max: { x: geo.boundsMax[0], y: geo.boundsMax[1], z: geo.boundsMax[2] },
          },
          extents,
          vertices: geo.vertices,
          faces: geo.faces,
          analysis: {
            category: categoryInfo.category,
            canonical_up:
              orientation.uprightAxis === 'Y'
                ? { x: 0, y: 1, z: 0 }
                : orientation.uprightAxis === 'Z'
                  ? { x: 0, y: 0, z: 1 }
                  : { x: 1, y: 0, z: 0 },
            natural_height_m: categoryInfo.naturalHeightM,
            suggested_rotation: finalRotation,
            ground_offset_y: finalGroundOffset,
            confidence: finalConfidence,
            method: visualCheck ? 'geometric+semantic+vlm' : 'geometric+semantic',
            notes: result.final_suggestion.notes,
          },
          placement_suggestion: {
            rotation: finalRotation,
            scale: { x: scaleFactor, y: scaleFactor, z: scaleFactor },
            y_offset: finalGroundOffset * scaleFactor,
            description: `Place at Y=${(finalGroundOffset * scaleFactor).toFixed(2)} so base touches ground plane at Y=0. ${
              finalRotation.x !== 0 || finalRotation.y !== 0 || finalRotation.z !== 0
                ? `Rotate (${finalRotation.x}, ${finalRotation.y}, ${finalRotation.z})° to stand upright.`
                : 'No rotation needed.'
            }${scaleFactor !== 1 ? ` Scale ${scaleFactor.toFixed(3)}x for ~${desiredHeight.toFixed(2)} scene units tall.` : ''}`,
          },
        };

        // Write v2 sidecar cache
        try {
          fs.writeFileSync(sidecar, JSON.stringify(result, null, 2), 'utf8');
          mcpLog(`analyze_mesh: wrote v3 sidecar ${sidecar}`, 'info');
        } catch (e: any) {
          mcpLog(`analyze_mesh: failed to write sidecar: ${e.message}`, 'warn');
        }

        return jsonResult({
          ...legacyResult,
          cached: false,
          sidecar_path: sidecar,
          instruction:
            'Use placement_suggestion to set transform on the mesh placement. These are SUGGESTIONS — override if your scene intent differs (flying objects, tilted angles, etc.).',
        });
      } catch (error: any) {
        mcpLog(`analyze_mesh FAILED: ${error.message}`, 'error');
        return errorResult(error);
      }
    }
  );
}
