/**
 * Import & Analysis Tools — import_geo, analyze_geo, place_geo
 *
 * import_geo: Low-level geometry import (OBJ, GLB/glTF). OBJ loaded directly;
 *             GLB/glTF converted to OBJ first via Python trimesh.
 * analyze_geo: Analyzes a mesh file to suggest orientation, scale, and ground placement.
 * place_geo: Unified placement for primitives and meshes — wires to geo group, registers in scene.
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
import { enumeratePins, ensureDynamicPin, computeWorldAABB } from './pin-utils';
import { analyzeReference } from '../vision/index';

import zlib from 'zlib';

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

/** Mugshot rendering constants. */
const MUGSHOT_FILM_RESOLUTION = 1024; // square film — 1024×1024
const MUGSHOT_SAMPLES = 256; // path tracing samples for crisp renders
const MUGSHOT_ENV_POWER = 0.8; // daylight env power — neutral, avoids blowout
const DEFAULT_MUGSHOT_MARGIN = 0.1; // camera fit margin (10% padding)
const PANCAKE_HEIGHT_THRESHOLD = 0.1; // height/footprint ratio below which mesh is "flat"

/** Detect flat/pancake meshes that shouldn't have ground planes. */
function isPancakeMesh(extents?: { x: number; y: number; z: number }): boolean {
  if (!extents) return false;
  return extents.y / Math.max(extents.x, extents.z, 0.001) < PANCAKE_HEIGHT_THRESHOLD;
}

/** Write a simple quad ground plane OBJ file. Returns the file path. */
function writePlaneOBJ(outputDir: string, baseName: string, footprint: number): string {
  const objPath = path.join(outputDir, `${baseName}_ground_plane.obj`);
  const h = footprint / 2;
  fs.writeFileSync(
    objPath,
    `# ground\nv ${-h} 0 ${-h}\nv ${h} 0 ${-h}\nv ${h} 0 ${h}\nv ${-h} 0 ${h}\nvn 0 1 0\nf 1//1 2//1 3//1 4//1\n`,
    'utf8'
  );
  return objPath;
}

/** Well-known node type IDs for mugshot scene construction. */
const MUGSHOT_TYPES = {
  RT: 56, // NT_RENDERTARGET
  CAM: 13, // NT_CAM_THINLENS
  KERN_PT: 25, // NT_KERN_PATHTRACING
  KERN_DL: 24, // NT_KERN_DIRECTLIGHTING
  GEO_GROUP: 3, // NT_GEO_GROUP
  GEO_OBJECT: 153, // NT_GEO_OBJECT (primitives)
  GEO_MESH: 1, // NT_GEO_MESH
  GEO_PLACEMENT: 4, // NT_GEO_PLACEMENT
  ENV_DAYLIGHT: 14, // NT_ENV_DAYLIGHT
  TEX_IMAGE: 34, // NT_TEX_IMAGE
};

/** Mugshot view configuration. */
interface MugshotView {
  name: string; // e.g. "front_clay"
  yaw: number; // camera orbit degrees
  elevation: number;
  clay: boolean; // true = color clay (mode 2), false = normal rendering
  ground: boolean; // true = show ground plane, false = hide for this view
}

/**
 * Mugshot views — 8 clay views for full 360° spatial coverage.
 * Geometric guess rotation IS applied so VLM sees the mesh (hopefully) upright.
 * Ring 1: 4 cardinal eye-level views (front/right with ground, back/left without).
 * Ring 2: 2 elevated diagonals from opposing corners (with ground for shadow cues).
 * Ring 3: overhead with ground (shadow plan), below-front without ground (underside).
 * Ground plane is toggled per-view to give VLM unoccluded + gravity-cued views.
 */
const MUGSHOT_VIEWS: MugshotView[] = [
  // Ring 1 — Eye-level cardinals
  { name: 'front', yaw: 0, elevation: 0, clay: true, ground: true },
  { name: 'right', yaw: 90, elevation: 0, clay: true, ground: true },
  { name: 'back', yaw: 180, elevation: 0, clay: true, ground: false },
  { name: 'left', yaw: 270, elevation: 0, clay: true, ground: false },
  // Ring 2 — Elevated diagonals (ground ON for shadow cues)
  { name: 'front_high', yaw: 45, elevation: 35, clay: true, ground: true },
  { name: 'back_high', yaw: 225, elevation: 35, clay: true, ground: true },
  // Ring 3 — Vertical extremes
  { name: 'top', yaw: 0, elevation: 85, clay: true, ground: true },
  { name: 'below_front', yaw: 0, elevation: -25, clay: true, ground: false },
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
    evaluate: false,
    doCycleCheck: true,
  });
}

/**
 * Helper: create mesh + placement, connect them, and return transform handle.
 * Matches the exact pattern from import_geo that works with serv build 5.
 */
async function createMeshPlacement(
  client: OctaneMcpClient,
  objPath: string
): Promise<{ mesh: number; placement: number; transform: number }> {
  const rootHandle = await client.getRootNodeGraph();

  // Create mesh
  const meshResult = await client.callMethod('ApiNode', 'create', {
    type: 1, // NT_GEO_MESH
    ownerGraph: { handle: String(rootHandle), type: OBJ_API_NODE_GRAPH },
    configurePins: true,
  });
  const mesh = extractHandle(meshResult) ?? 0;
  if (!mesh) throw new Error('Failed to create NT_GEO_MESH');

  // Set filename
  await client.callMethod('ApiItem', 'setValueByAttrID', {
    objectPtr: { handle: String(mesh), type: OBJ_API_ITEM },
    attribute_id: AttributeId.A_FILENAME,
    string_value: objPath,
    evaluate: false,
  });

  // Create placement
  const placementResult = await client.callMethod('ApiNode', 'create', {
    type: 4, // NT_GEO_PLACEMENT
    ownerGraph: { handle: String(rootHandle), type: OBJ_API_NODE_GRAPH },
    configurePins: true,
  });
  const placement = extractHandle(placementResult) ?? 0;
  if (!placement) throw new Error('Failed to create NT_GEO_PLACEMENT');

  // Connect mesh → placement pin 1
  await client.callMethod('ApiNode', 'connectToIx', {
    objectPtr: { handle: String(placement), type: OBJ_API_NODE },
    pinIdx: 1,
    sourceNode: { handle: String(mesh), type: OBJ_API_NODE },
    evaluate: false,
    doCycleCheck: true,
  });

  // Get transform child (pin 0) — same pattern as import_geo
  let transform = 0;
  try {
    const connResult = await client.callMethod('ApiNode', 'connectedNodeIx', {
      objectPtr: { handle: String(placement), type: OBJ_API_NODE },
      pinIx: 0,
      enterWrapperNode: true,
    });
    transform = extractHandle(connResult) ?? 0;
  } catch {
    mcpLog('createMeshPlacement: no transform child on placement pin 0', 'warn');
  }

  return { mesh, placement, transform };
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
  } else if (attrType === 5) {
    const v = typeof value === 'object' ? value : { x: 0, y: 0, z: 0 };
    valueParams = { int3_value: { x: Math.round(v.x), y: Math.round(v.y), z: Math.round(v.z) } };
  } else if (attrType === 6) {
    const v = typeof value === 'object' ? value : { x: 0, y: 0, z: 0, w: 0 };
    valueParams = {
      int4_value: {
        x: Math.round(v.x),
        y: Math.round(v.y),
        z: Math.round(v.z),
        w: Math.round(v.w || 0),
      },
    };
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

// ── Zero-dep PNG read/write for contact sheet ──────────────────────

/** Read PNG pixels — minimal decoder using zlib.inflateSync. */
function readPngPixels(
  buffer: Buffer
): { width: number; height: number; pixels: Uint8Array } | null {
  const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (buffer[i] !== PNG_SIG[i]) return null;

  let width = 0,
    height = 0,
    bitDepth = 0,
    colorType = 0;
  const idatChunks: Buffer[] = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'IHDR') {
      width = buffer.readUInt32BE(offset + 8);
      height = buffer.readUInt32BE(offset + 12);
      bitDepth = buffer[offset + 16];
      colorType = buffer[offset + 17];
    } else if (type === 'IDAT') {
      idatChunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    } else if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (width === 0 || height === 0 || idatChunks.length === 0) return null;
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) return null;

  const compressed = Buffer.concat(idatChunks);
  let decompressed: Buffer;
  try {
    decompressed = zlib.inflateSync(compressed);
  } catch {
    return null;
  }

  const channels = colorType === 6 ? 4 : 3;
  const rowBytes = 1 + width * channels;
  const pixels = new Uint8Array(width * height * 4);
  const prevRow = new Uint8Array(width * channels);
  let srcOff = 0;

  for (let y = 0; y < height; y++) {
    const filter = decompressed[srcOff++];
    const row = new Uint8Array(width * channels);
    for (let x = 0; x < width * channels; x++) {
      const raw = decompressed[srcOff++];
      const a = x >= channels ? row[x - channels] : 0;
      const b = prevRow[x];
      switch (filter) {
        case 0:
          row[x] = raw;
          break;
        case 1:
          row[x] = (raw + a) & 0xff;
          break;
        case 2:
          row[x] = (raw + b) & 0xff;
          break;
        case 3:
          row[x] = (raw + ((a + b) >> 1)) & 0xff;
          break;
        case 4: {
          const c = x >= channels ? prevRow[x - channels] : 0;
          const p = a + b - c;
          const pa = Math.abs(p - a),
            pb = Math.abs(p - b),
            pc = Math.abs(p - c);
          row[x] = (raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default:
          row[x] = raw;
      }
    }
    for (let x = 0; x < width; x++) {
      const dstIdx = (y * width + x) * 4;
      const srcIdx = x * channels;
      pixels[dstIdx] = row[srcIdx];
      pixels[dstIdx + 1] = row[srcIdx + 1];
      pixels[dstIdx + 2] = row[srcIdx + 2];
      pixels[dstIdx + 3] = channels === 4 ? row[srcIdx + 3] : 255;
    }
    prevRow.set(row);
  }
  return { width, height, pixels };
}

/** Encode RGBA pixels to PNG buffer (zero-dep, filter=None). */
function encodePng(width: number, height: number, pixels: Uint8Array): Buffer {
  // Build raw scanlines: filter byte (0=None) + RGBA row
  const rawLen = height * (1 + width * 4);
  const raw = Buffer.alloc(rawLen);
  let off = 0;
  for (let y = 0; y < height; y++) {
    raw[off++] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      raw[off++] = pixels[si];
      raw[off++] = pixels[si + 1];
      raw[off++] = pixels[si + 2];
      raw[off++] = pixels[si + 3];
    }
  }
  const compressed = zlib.deflateSync(raw);

  // Assemble PNG file
  const chunks: Buffer[] = [];

  // Signature
  chunks.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  // Helper: write chunk (type + data)
  function writeChunk(type: string, data: Buffer) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type, 'ascii');
    const crcInput = Buffer.concat([typeB, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcInput), 0);
    chunks.push(len, typeB, data, crc);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  writeChunk('IHDR', ihdr);

  // IDAT
  writeChunk('IDAT', compressed);

  // IEND
  writeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat(chunks);
}

/** CRC32 for PNG chunks. */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Compose multiple mugshot PNGs into a single labeled contact sheet.
 * 2×4 grid with labels burned into each cell. Zero external dependencies.
 * Returns the path to the saved contact sheet PNG.
 */
function composeContactSheet(imagePaths: string[], labels: string[], outputPath: string): string {
  // Read all source images
  const images: Array<{ width: number; height: number; pixels: Uint8Array }> = [];
  for (const p of imagePaths) {
    const buf = fs.readFileSync(p);
    const img = readPngPixels(buf);
    if (!img) throw new Error(`Failed to read PNG: ${p}`);
    images.push(img);
  }

  // Grid layout: 4 columns × 2 rows (8 images)
  const cols = 4;
  const rows = Math.ceil(images.length / cols);
  const cellW = images[0].width;
  const cellH = images[0].height;
  const labelH = 20; // pixels for label bar
  const gridW = cols * cellW;
  const gridH = rows * (cellH + labelH);

  const out = new Uint8Array(gridW * gridH * 4);
  // Fill with dark grey background
  for (let i = 0; i < out.length; i += 4) {
    out[i] = 30;
    out[i + 1] = 30;
    out[i + 2] = 30;
    out[i + 3] = 255;
  }

  for (let idx = 0; idx < images.length; idx++) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const img = images[idx];
    const dstX = col * cellW;
    const dstY = row * (cellH + labelH) + labelH; // image below label

    // Copy image pixels
    for (let y = 0; y < img.height && y < cellH; y++) {
      for (let x = 0; x < img.width && x < cellW; x++) {
        const si = (y * img.width + x) * 4;
        const di = ((dstY + y) * gridW + (dstX + x)) * 4;
        out[di] = img.pixels[si];
        out[di + 1] = img.pixels[si + 1];
        out[di + 2] = img.pixels[si + 2];
        out[di + 3] = img.pixels[si + 3];
      }
    }

    // Burn label into the label bar (simple 5×7 pixel font)
    const label = labels[idx] || `${idx + 1}`;
    const labelY = row * (cellH + labelH);
    burnLabel(out, gridW, gridH, dstX + 4, labelY + 4, label);
  }

  const png = encodePng(gridW, gridH, out);
  fs.writeFileSync(outputPath, png);
  mcpLog(`mugshot: contact sheet saved → ${outputPath} (${gridW}×${gridH})`, 'info');
  return outputPath;
}

/** Burn text into pixel buffer using a minimal 5×7 bitmap font. */
function burnLabel(
  pixels: Uint8Array,
  imgW: number,
  imgH: number,
  startX: number,
  startY: number,
  text: string
) {
  // Minimal ASCII bitmap font (5×7, chars 32-127)
  // Only define what we need: 0-9, A-Z, a-z, space, °, (, ), -, =, .
  const GLYPH_W = 5,
    GLYPH_H = 7,
    SPACING = 1;
  const glyphs: Record<string, number[]> = {
    ' ': [0, 0, 0, 0, 0, 0, 0],
    '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
    '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
    '2': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
    '3': [0x0e, 0x11, 0x01, 0x06, 0x01, 0x11, 0x0e],
    '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
    '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
    '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
    '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
    '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
    '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
    A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
    C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
    D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
    E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
    F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
    G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
    H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
    K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
    L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
    M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
    N: [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11],
    O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
    R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
    S: [0x0e, 0x11, 0x10, 0x0e, 0x01, 0x11, 0x0e],
    T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
    U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
    Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
    '-': [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
    '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04],
    '=': [0x00, 0x00, 0x1f, 0x00, 0x1f, 0x00, 0x00],
    '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
    ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  };

  let cx = startX;
  for (const ch of text.toUpperCase()) {
    const glyph = glyphs[ch];
    if (!glyph) {
      cx += GLYPH_W + SPACING;
      continue;
    }
    for (let gy = 0; gy < GLYPH_H; gy++) {
      const row = glyph[gy];
      for (let gx = 0; gx < GLYPH_W; gx++) {
        if (row & (0x10 >> gx)) {
          const px = cx + gx;
          const py = startY + gy;
          if (px >= 0 && px < imgW && py >= 0 && py < imgH) {
            const di = (py * imgW + px) * 4;
            pixels[di] = 255;
            pixels[di + 1] = 255;
            pixels[di + 2] = 0;
            pixels[di + 3] = 255;
          }
        }
      }
    }
    cx += GLYPH_W + SPACING;
  }
}

// ── Mugshot scoreboard for configuration mode ────────────────────────

const SCOREBOARD_PATH = path.resolve(__dirname, '../../data/mugshot_scoreboard.json');
// Anthropic models use direct Claude API. Sonnet best for spatial reasoning.
const AVAILABLE_VLM_MODELS = ['claude-sonnet'];

/** Map config model names to Anthropic API model IDs */
const ANTHROPIC_MODEL_IDS: Record<string, string> = {
  'claude-haiku': 'claude-haiku-4-5-20251001',
  'claude-sonnet': 'claude-sonnet-4-20250514',
};

/** Known source endpoint → axis convention map.
 * Meshes from these endpoints always need the specified rotation.
 * Avoids VLM Pass 1 diagnosis when source is known. */
const ENDPOINT_AXIS_MAP: Record<
  string,
  { rotation: [number, number, number]; convention: string }
> = {
  huynan: { rotation: [90, 0, 0], convention: 'z_up' },
};

interface ModelResult {
  is_upright: boolean;
  front_direction: string;
  correction: [number, number, number];
  confidence: string;
  object_type: string;
  notes: string;
  raw_response?: string;
}

interface ScoreboardRun {
  mesh: string;
  path: string;
  timestamp: string;
  ground_truth: {
    is_upright: boolean;
    front_direction: string;
    correction: [number, number, number];
  } | null;
  model_results: Record<string, ModelResult>;
}

interface Scoreboard {
  runs: ScoreboardRun[];
  preferred_model: string | null;
  scores: Record<string, { accuracy: number; total: number; correct: number }>;
}

function loadScoreboard(): Scoreboard {
  try {
    if (fs.existsSync(SCOREBOARD_PATH)) {
      return JSON.parse(fs.readFileSync(SCOREBOARD_PATH, 'utf8'));
    }
  } catch {
    /* corrupt */
  }
  return { runs: [], preferred_model: null, scores: {} };
}

function saveScoreboard(sb: Scoreboard): void {
  const dir = path.dirname(SCOREBOARD_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SCOREBOARD_PATH, JSON.stringify(sb, null, 2), 'utf8');
  mcpLog(`mugshot: scoreboard saved → ${SCOREBOARD_PATH}`, 'info');
}

/** Get the preferred VLM model from scoreboard, or fall back to first available. */
function getPreferredModel(): string {
  const sb = loadScoreboard();
  return sb.preferred_model || AVAILABLE_VLM_MODELS[0] || 'claude-sonnet';
}

// renderMugshots — DELETED in v2.4.4. All rendering goes through renderViews().

/** View spec for lean mugshot rendering. */
interface ViewSpec {
  name: string;
  yaw: number;
  elevation: number;
  ground: boolean;
  clay?: boolean; // default true (mode 2 = color clay). Set false for full materials.
  margin?: number; // camera fit margin, default DEFAULT_MUGSHOT_MARGIN
}

/**
 * Render views of a mesh in an isolated scene.
 * Creates a temporary render target, camera, kernel, env, and geo group,
 * renders each ViewSpec, then cleans up all created nodes.
 * Returns paths to saved PNGs.
 */
async function renderViews(
  client: OctaneMcpClient,
  cache: ApiCache | null,
  objPath: string,
  rotation: { x: number; y: number; z: number },
  groundOffsetY: number,
  outputDir: string,
  baseName: string,
  views: ViewSpec[],
  meshExtents?: { x: number; y: number; z: number },
  rawBoundsMin?: { x: number; y: number; z: number },
  rawBoundsMax?: { x: number; y: number; z: number }
): Promise<string[]> {
  mcpLog(`mugshot: renderViews ${views.map(v => v.name).join(',')} for ${baseName}`, 'info');
  const savedPaths: string[] = [];

  // Create isolated scene
  const rt = await createNodeRaw(client, MUGSHOT_TYPES.RT);
  const cam = await createNodeRaw(client, MUGSHOT_TYPES.CAM);
  const kern = await createNodeRaw(client, MUGSHOT_TYPES.KERN_PT);
  const geoGroup = await createNodeRaw(client, MUGSHOT_TYPES.GEO_GROUP);
  const env = await createNodeRaw(client, MUGSHOT_TYPES.ENV_DAYLIGHT);

  // Wire RT
  await connectRaw(client, rt, cam, 0);
  await connectRaw(client, rt, env, 1);
  await connectRaw(client, rt, geoGroup, 3);
  await connectRaw(client, rt, kern, 6);

  // Square film resolution
  const filmHandle = await getConnectedChild(client, rt, 4);
  if (filmHandle) {
    const resHandle = await getConnectedChild(client, filmHandle, 0);
    if (resHandle) {
      await setAttrRaw(client, resHandle, AttributeId.A_VALUE, 5, {
        x: MUGSHOT_FILM_RESOLUTION,
        y: MUGSHOT_FILM_RESOLUTION,
        z: 0,
      });
    }
  }

  // Disable DOF — set aperture to 0 on pin 14 child
  const aperture = await getConnectedChild(client, cam, 14);
  if (aperture) {
    await setAttrRaw(client, aperture, AttributeId.A_VALUE, 9, 0);
    mcpLog(`mugshot: DOF disabled (aperture handle=${aperture} → 0)`, 'info');
  } else {
    mcpLog(`mugshot: WARNING — no aperture child on cam pin 14, DOF may be active`, 'warn');
  }
  // Also try setting aperture edge (pin 15) to 1 to sharpen if DOF leaks through
  const apertureEdge = await getConnectedChild(client, cam, 15);
  if (apertureEdge) await setAttrRaw(client, apertureEdge, AttributeId.A_VALUE, 9, 1);

  // Env power
  const envPower = await getConnectedChild(client, env, 2);
  if (envPower) await setAttrRaw(client, envPower, AttributeId.A_VALUE, 9, MUGSHOT_ENV_POWER);

  // Ground plane needed?
  const pancake = isPancakeMesh(meshExtents);
  const hasGround = !pancake && views.some(v => v.ground);
  await setAttrRaw(client, geoGroup, AttributeId.A_PIN_COUNT, 3, hasGround ? 2 : 1);

  // Load mesh + placement using shared helper (same pattern as import_geo)
  const { mesh, placement, transform: xform } = await createMeshPlacement(client, objPath);

  // Apply rotation + ground offset
  if (xform) {
    await setAttrRaw(client, xform, AttributeId.A_ROTATION, 11, rotation);
    await setAttrRaw(client, xform, AttributeId.A_TRANSLATION, 11, {
      x: 0,
      y: groundOffsetY,
      z: 0,
    });
  }
  mcpLog(
    `mugshot: xform=${xform}, connecting placement ${placement} to geoGroup ${geoGroup} pin 0`,
    'debug'
  );
  await connectRaw(client, geoGroup, placement, 0);
  mcpLog(`mugshot: placement connected to geoGroup OK`, 'debug');

  // Ground plane
  let groundPlacement = 0;
  let groundMesh = 0;
  let groundMat = 0;
  let groundPlaneObjPath = '';
  if (hasGround) {
    groundMesh = await createNodeRaw(client, MUGSHOT_TYPES.GEO_MESH);
    const gp = await createNodeRaw(client, MUGSHOT_TYPES.GEO_PLACEMENT);
    groundMat = await createNodeRaw(client, 33); // NT_MAT_DIFFUSE
    const footprint = meshExtents ? Math.max(meshExtents.x, meshExtents.z, 0.5) * 3 : 3;
    groundPlaneObjPath = writePlaneOBJ(outputDir, baseName, footprint);
    await setAttrRaw(client, groundMesh, AttributeId.A_FILENAME, 14, groundPlaneObjPath);
    await connectRaw(client, gp, groundMesh, 1);
    // Set ground color — wrap in try/catch since new serv may not auto-create pin children
    try {
      const diffColor = await getConnectedChild(client, groundMat, 0);
      if (diffColor)
        await setAttrRaw(client, diffColor, AttributeId.A_VALUE, 11, { x: 0.5, y: 0.5, z: 0.5 });
    } catch {
      /* ground color is cosmetic — skip if pin not available */
    }
    await connectRaw(client, gp, groundMat, 0);
    await connectRaw(client, geoGroup, gp, 1);
    groundPlacement = gp;
  }

  // Flush + select RT
  await client.callMethod('ApiChangeManager', 'update', {});
  await client.callMethod('ApiRenderEngine', 'setRenderTargetNode', {
    targetNode: { handle: String(rt), type: OBJ_API_NODE },
  });

  // Max samples for mugshot renders
  let maxSamples = 0;
  try {
    maxSamples = await getConnectedChild(client, kern, 0);
  } catch {
    /* skip */
  }
  if (maxSamples) await setAttrRaw(client, maxSamples, AttributeId.A_VALUE, 3, MUGSHOT_SAMPLES);

  fs.mkdirSync(outputDir, { recursive: true });

  // Compute MESH-ONLY world-space bounds from raw bounds + rotation + offset.
  // This excludes the ground plane so camera frames the mesh tightly.
  let bboxMin = { x: -0.5, y: 0, z: -0.5 };
  let bboxMax = { x: 0.5, y: 1, z: 0.5 };
  if (rawBoundsMin && rawBoundsMax) {
    // Get all 8 corners of the raw AABB
    const corners = [
      { x: rawBoundsMin.x, y: rawBoundsMin.y, z: rawBoundsMin.z },
      { x: rawBoundsMax.x, y: rawBoundsMin.y, z: rawBoundsMin.z },
      { x: rawBoundsMin.x, y: rawBoundsMax.y, z: rawBoundsMin.z },
      { x: rawBoundsMax.x, y: rawBoundsMax.y, z: rawBoundsMin.z },
      { x: rawBoundsMin.x, y: rawBoundsMin.y, z: rawBoundsMax.z },
      { x: rawBoundsMax.x, y: rawBoundsMin.y, z: rawBoundsMax.z },
      { x: rawBoundsMin.x, y: rawBoundsMax.y, z: rawBoundsMax.z },
      { x: rawBoundsMax.x, y: rawBoundsMax.y, z: rawBoundsMax.z },
    ];
    // Rotate each corner (Euler XYZ in degrees)
    const rx = (rotation.x * Math.PI) / 180;
    const ry = (rotation.y * Math.PI) / 180;
    const rz = (rotation.z * Math.PI) / 180;
    const cx = Math.cos(rx),
      sx = Math.sin(rx);
    const cy = Math.cos(ry),
      sy = Math.sin(ry);
    const cz = Math.cos(rz),
      sz = Math.sin(rz);
    // Rotation matrix (XYZ order)
    const rotPoint = (p: { x: number; y: number; z: number }) => {
      // X rotation
      let y1 = p.y * cx - p.z * sx;
      let z1 = p.y * sx + p.z * cx;
      // Y rotation
      let x2 = p.x * cy + z1 * sy;
      let z2 = -p.x * sy + z1 * cy;
      // Z rotation
      let x3 = x2 * cz - y1 * sz;
      let y3 = x2 * sz + y1 * cz;
      return { x: x3, y: y3 + groundOffsetY, z: z2 };
    };
    const rotated = corners.map(rotPoint);
    bboxMin = {
      x: Math.min(...rotated.map(r => r.x)),
      y: Math.min(...rotated.map(r => r.y)),
      z: Math.min(...rotated.map(r => r.z)),
    };
    bboxMax = {
      x: Math.max(...rotated.map(r => r.x)),
      y: Math.max(...rotated.map(r => r.y)),
      z: Math.max(...rotated.map(r => r.z)),
    };
    mcpLog(
      `mugshot: mesh-only bounds (${bboxMin.x.toFixed(3)},${bboxMin.y.toFixed(3)},${bboxMin.z.toFixed(3)}) → (${bboxMax.x.toFixed(3)},${bboxMax.y.toFixed(3)},${bboxMax.z.toFixed(3)})`,
      'info'
    );
  }

  let groundVisible = true;

  try {
    for (const view of views) {
      // Toggle ground
      if (groundPlacement && view.ground !== groundVisible) {
        if (view.ground) {
          await connectRaw(client, geoGroup, groundPlacement, 1);
        } else {
          await client.callMethod('ApiNode', 'connectToIx', {
            objectPtr: { handle: String(geoGroup), type: OBJ_API_NODE },
            pinIdx: 1,
            sourceNode: { handle: '0', type: OBJ_API_NODE },
            evaluate: true,
            doCycleCheck: false,
          });
        }
        groundVisible = view.ground;
        await client.callMethod('ApiChangeManager', 'update', {});
      }

      // Clay mode: default on (mode 2 = color clay), off only when clay===false
      await client.callMethod('ApiRenderEngine', 'setClayMode', {
        mode: view.clay === false ? 0 : 2,
      });

      // Camera — 1:1 aspect ratio for square mugshot film
      const fit = computeFitCamera(
        bboxMin,
        bboxMax,
        view.margin ?? DEFAULT_MUGSHOT_MARGIN,
        view.elevation,
        view.yaw,
        undefined,
        1
      );
      await client.callMethod('LiveLink', 'SetCamera', {
        position: fit.position,
        target: fit.target,
        up: { x: 0, y: 1, z: 0 },
      });

      // Render
      await client.callMethod('ApiChangeManager', 'update', {});
      await client.callMethod('ApiRenderEngine', 'continueRendering', {});
      const t0 = Date.now();
      while (Date.now() - t0 < 30000) {
        await new Promise(r => setTimeout(r, 500));
        try {
          const stats = await client.callMethod('ApiRenderEngine', 'getRenderStatistics', {});
          const s = stats?.statistics ?? stats;
          if (s?.beautySamplesPerPixel >= 250 || s?.state === 'RSTATE_FINISHED') break;
        } catch (e: any) {
          mcpLog(`mugshot: render poll error: ${e?.message ?? e}`, 'verbose');
        }
      }

      // Save
      const outPath = path.join(outputDir, `${baseName}.${view.name}.png`);
      await client.callMethod(
        'ApiRenderEngine',
        'saveImage1',
        {
          renderPassId: 0,
          fullPath: outPath,
          imageSaveFormat: 0,
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
  } finally {
    // Always restore clay mode even if render loop throws
    await client
      .callMethod('ApiRenderEngine', 'setClayMode', { mode: 0 })
      .catch((e: any) => mcpLog(`mugshot: failed to restore clay mode: ${e?.message}`, 'warn'));

    // Cleanup: delete all created nodes so mugshots don't pollute the scene
    const toDelete = [
      groundMat,
      groundMesh,
      groundPlacement,
      placement,
      mesh,
      env,
      geoGroup,
      kern,
      cam,
      rt,
    ].filter(h => h > 0);
    for (const handle of toDelete) {
      try {
        await client.callMethod('ApiItem', 'destroy', {
          objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
        });
      } catch (e: any) {
        mcpLog(`mugshot: failed to destroy node ${handle}: ${e?.message}`, 'warn');
      }
    }
    // Clean up temp ground plane OBJ
    if (groundPlaneObjPath) {
      try {
        fs.unlinkSync(groundPlaneObjPath);
      } catch (e: any) {
        mcpLog(`mugshot: failed to delete ground plane OBJ: ${e?.message}`, 'verbose');
      }
      mcpLog(`mugshot: cleaned up ${toDelete.length} nodes`, 'info');
    }
  }

  return savedPaths;
}

/** Build VLM orientation prompt — Pass 1: diagnosis only, no rotation numbers. */
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
    const parts: string[] = [];
    if (metadata.filename) parts.push(`File: "${metadata.filename}"`);
    if (metadata.category)
      parts.push(
        `Category: ${metadata.category}${metadata.subcategory ? ` (${metadata.subcategory})` : ''}`
      );
    if (metadata.extents)
      parts.push(
        `Extents: ${metadata.extents.x.toFixed(3)} × ${metadata.extents.y.toFixed(3)} × ${metadata.extents.z.toFixed(3)}`
      );
    if (metadata.tallestAxis) parts.push(`Tallest axis: ${metadata.tallestAxis}`);
    if (metadata.sceneContext) parts.push(`Scene: ${metadata.sceneContext}`);
    metaBlock = '\n' + parts.join(' | ') + '\n';
  }

  return `You are analyzing a CONTACT SHEET of 8 clay renders of a 3D mesh for orientation.
No pre-rotation applied — raw file orientation.
${metaBlock}
4×2 grid, left-to-right, top-to-bottom:
Row 1: FRONT (yaw=0°) | RIGHT (90°) | BACK (180°) | LEFT (270°)
Row 2: FRONT-HIGH (45°, 35° above) | BACK-HIGH (225°, 35° above) | TOP (85° above) | BELOW-FRONT (0°, 25° below)

Views 1,2,5,6,7 have ground plane with shadows. Views 3,4,8 float (no ground).

Describe what you see. Do NOT provide rotation numbers. Respond JSON only:
{
  "object_type": "what is this object",
  "is_upright": true/false,
  "orientation_matters": true/false,
  "pose": "upright | lying_on_back | lying_on_front | lying_on_side | upside_down",
  "front_visible_in": "view number where the face/front of the object is visible, e.g. 1, 2, 3, or 4",
  "confidence": "high | medium | low",
  "estimated_height_m": 0.0,
  "notes": "what you see in each relevant view"
}`;
}

/** Build VLM verification prompt — Pass 2: confirm corrected orientation. */
function buildVerificationPrompt(): string {
  return `You are verifying a CORRECTED orientation of a 3D mesh. A rotation was applied based on a previous analysis.

Same 4×2 contact sheet layout:
Row 1: FRONT (yaw=0°) | RIGHT (90°) | BACK (180°) | LEFT (270°)
Row 2: FRONT-HIGH (45°, 35° above) | BACK-HIGH (225°, 35° above) | TOP (85° above) | BELOW-FRONT (0°, 25° below)

Is the object now upright and facing forward? Respond JSON only:
{
  "is_correct": true/false,
  "issue": "none | still_lying_down | upside_down | facing_wrong_way | other",
  "notes": "what you see"
}`;
}

/**
 * Map VLM diagnosis (pose + front_visible_in + tallest axis) to a deterministic rotation.
 * We know Octane's coordinate system — VLM just tells us what's wrong.
 */
function diagnosisToRotation(
  pose: string,
  frontVisibleIn: string | number,
  tallestAxis: string,
  boundsMin: number[],
  boundsMax: number[]
): { rotation: { x: number; y: number; z: number }; groundOffset: number } {
  const p = (pose || '').toLowerCase().replace(/[^a-z_]/g, '');
  let rotation = { x: 0, y: 0, z: 0 };
  let groundOffset = Math.max(0, -boundsMin[1]);

  // Step 1: Fix upright orientation based on pose + tallest axis
  if (p === 'lying_on_back' || p === 'lying_on_front') {
    if (tallestAxis === 'Z') {
      // Z-up model lying down → rotate X+90 to stand up
      rotation.x = 90;
      // After X+90: new Y = -old_Z, so minY = -boundsMax[2]
      groundOffset = Math.max(0, boundsMax[2]);
    } else if (tallestAxis === 'X') {
      // X tallest lying down → rotate Z+90
      rotation.z = 90;
      groundOffset = Math.max(0, -boundsMin[0]);
    }
    if (p === 'lying_on_front') {
      // Face-down: also needs 180° flip vs face-up
      rotation.x += 180;
      // Recompute ground offset for the flipped case
      if (tallestAxis === 'Z') {
        groundOffset = Math.max(0, -boundsMin[2]);
      }
    }
  } else if (p === 'upside_down') {
    rotation.x = 180;
    groundOffset = Math.max(0, -boundsMax[1]); // flip Y
  } else if (p === 'lying_on_side') {
    if (tallestAxis === 'X') {
      rotation.z = 90;
      groundOffset = Math.max(0, -boundsMin[0]);
    } else if (tallestAxis === 'Z') {
      rotation.x = 90;
      groundOffset = Math.max(0, boundsMax[2]);
    }
  }
  // 'upright' → no rotation needed

  // Step 2: Fix front-facing direction based on which view shows the front
  const fv = parseInt(String(frontVisibleIn), 10);
  if (fv === 3)
    rotation.y += 180; // front visible in BACK view → turn 180
  else if (fv === 2)
    rotation.y += -90; // front visible in RIGHT view → turn -90
  else if (fv === 4) rotation.y += 90; // front visible in LEFT view → turn +90
  // fv === 1 → already facing front, no Y rotation

  return { rotation, groundOffset };
}

interface MugshotVLMResult {
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
  /** All model results when running in configuration mode */
  model_results?: Record<string, ModelResult>;
}

/**
 * Send mugshot contact sheet to VLM for orientation analysis.
 * Composes ALL mugshot views into a single labeled grid, sends to otoy-studio.
 * In configuration mode, runs ALL available VLM models and saves results to scoreboard.
 * Returns structured orientation data or null if VLM unavailable.
 *
 * NOTE: Only uses otoy-studio as vision backend. Anthropic/Gemini direct API
 * paths are NOT used for mugshot analysis — those stay for critique_render only.
 */
async function analyzeMugshotsWithVLM(
  mugshotPaths: string[],
  metadata?: Parameters<typeof buildOrientationPrompt>[0],
  options?: { configuration?: boolean; meshName?: string; meshPath?: string }
): Promise<MugshotVLMResult | null> {
  const { extractOtoyStudioToken } = await import('../vision/otoy-studio');
  const token = extractOtoyStudioToken();
  if (!token) {
    mcpLog('mugshot VLM: no otoy-studio token available, skipping visual check', 'warn');
    return null;
  }

  // Step 1: Compose contact sheet from ALL 8 mugshot views (4×2 grid).
  // Above-front (view 8) is also kept as standalone for two-pass verification.
  const contactDir = path.dirname(mugshotPaths[0]);
  const baseName = path.basename(mugshotPaths[0]).replace(/\.mugshot_.*/, '');
  const contactSheetPath = path.join(contactDir, `${baseName}.mugshot_contact.png`);

  const labels = MUGSHOT_VIEWS.map((v, i) => `${i + 1}. ${v.name.toUpperCase()} yaw=${v.yaw}`);

  try {
    composeContactSheet(mugshotPaths, labels, contactSheetPath);
  } catch (e: any) {
    mcpLog(`mugshot VLM: contact sheet failed: ${e.message}`, 'warn');
    return null;
  }

  const prompt = buildOrientationPrompt(metadata);
  const { analyseImageFromFile } = await import('../vision/otoy-studio');

  // Configuration mode: run ALL models on the same contact sheet
  if (options?.configuration) {
    mcpLog(
      `mugshot VLM: CONFIGURATION MODE — running ${AVAILABLE_VLM_MODELS.length} models`,
      'info'
    );
    const modelResults: Record<string, ModelResult> = {};

    for (const model of AVAILABLE_VLM_MODELS) {
      try {
        mcpLog(`mugshot VLM: testing model "${model}"…`, 'info');
        let result: { text: string; model?: string };

        if (ANTHROPIC_VLM_MODELS.includes(model)) {
          // Claude models — direct Anthropic API with base64 image
          const { callAnthropicVision, getAnthropicKey } = await import('../vision/anthropic');
          const apiKey = getAnthropicKey();
          if (!apiKey) {
            mcpLog(`mugshot VLM [${model}]: no Anthropic API key, skipping`, 'warn');
            modelResults[model] = {
              is_upright: true,
              front_direction: 'unknown',
              correction: [0, 0, 0],
              confidence: 'low',
              object_type: 'skipped',
              notes: 'No ANTHROPIC_API_KEY env var',
            };
            continue;
          }
          const imgBuf = fs.readFileSync(path.resolve(contactSheetPath));
          const base64 = imgBuf.toString('base64');
          const anthropicResult = await callAnthropicVision(
            prompt,
            [{ base64, mediaType: 'image/png' }],
            {
              apiKey,
              model: ANTHROPIC_MODEL_IDS[model] || 'claude-haiku-4-5-20251001',
              maxTokens: 2000,
            }
          );
          result = { text: anthropicResult.text, model: anthropicResult.model };
        } else {
          // otoy-studio models (moondream3, moondream-next, llava-next)
          result = await analyseImageFromFile(path.resolve(contactSheetPath), 'ask', prompt, {
            model,
          });
        }

        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          let parsed: any;
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {
            // Try repairing common JSON issues (trailing commas, missing braces)
            let repaired = jsonMatch[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
            const openB = (repaired.match(/\{/g) || []).length;
            const closeB = (repaired.match(/\}/g) || []).length;
            for (let i = 0; i < openB - closeB; i++) repaired += '}';
            try {
              parsed = JSON.parse(repaired);
            } catch {
              /* truly broken */
            }
          }
          if (parsed) {
            const corr = parsed.correction_rotation_deg ??
              parsed.correction_rotation ?? { x: 0, y: 0, z: 0 };
            modelResults[model] = {
              is_upright: parsed.is_upright ?? true,
              front_direction: parsed.front_direction ?? 'toward_camera',
              correction: [corr.x || 0, corr.y || 0, corr.z || 0],
              confidence: parsed.confidence ?? 'medium',
              object_type: parsed.object_type ?? 'unknown',
              notes: parsed.notes ?? '',
              raw_response: result.text,
            };
            mcpLog(
              `mugshot VLM [${model}]: ${parsed.object_type}, upright=${parsed.is_upright}, front=${parsed.front_direction}, confidence=${parsed.confidence}`,
              'info'
            );
          } else {
            mcpLog(`mugshot VLM [${model}]: unparseable JSON`, 'warn');
            modelResults[model] = {
              is_upright: true,
              front_direction: 'unknown',
              correction: [0, 0, 0],
              confidence: 'low',
              object_type: 'parse_error',
              notes: 'JSON parse failed',
              raw_response: result.text,
            };
          }
        } else {
          mcpLog(`mugshot VLM [${model}]: no JSON in response`, 'warn');
          modelResults[model] = {
            is_upright: true,
            front_direction: 'unknown',
            correction: [0, 0, 0],
            confidence: 'low',
            object_type: 'unknown',
            notes: 'No JSON response',
            raw_response: result.text,
          };
        }
      } catch (e: any) {
        mcpLog(`mugshot VLM [${model}]: failed: ${e.message}`, 'warn');
        modelResults[model] = {
          is_upright: true,
          front_direction: 'unknown',
          correction: [0, 0, 0],
          confidence: 'low',
          object_type: 'error',
          notes: `Error: ${e.message}`,
          raw_response: (e as any).rawResponse || '',
        };
      }
    }

    // Save to scoreboard
    const sb = loadScoreboard();
    const meshName = options.meshName || baseName;
    // Remove existing run for same mesh if present
    sb.runs = sb.runs.filter(r => r.mesh !== meshName);
    sb.runs.push({
      mesh: meshName,
      path: options.meshPath || '',
      timestamp: new Date().toISOString(),
      ground_truth: null,
      model_results: modelResults,
    });
    saveScoreboard(sb);

    // Use preferred model's result (or moondream3 fallback) for the return value
    const preferredModel = getPreferredModel();
    const bestResult =
      modelResults[preferredModel] || modelResults['moondream3'] || Object.values(modelResults)[0];

    if (bestResult) {
      return {
        object_type: bestResult.object_type,
        is_upright: bestResult.is_upright,
        orientation_matters: true,
        confidence: bestResult.confidence as any,
        correction_rotation: {
          x: bestResult.correction[0],
          y: bestResult.correction[1],
          z: bestResult.correction[2],
        },
        front_direction: bestResult.front_direction,
        estimated_height_m: 0,
        notes: `[CONFIG MODE] ${Object.keys(modelResults).length} models tested. Using ${preferredModel}: ${bestResult.notes}`,
        vlm_model: preferredModel,
        model_results: modelResults,
      };
    }
    return null;
  }

  // Normal mode: use preferred model only
  // If preferred model is not in AVAILABLE_VLM_MODELS, use first available
  let model = getPreferredModel();
  if (AVAILABLE_VLM_MODELS.length > 0 && !AVAILABLE_VLM_MODELS.includes(model)) {
    model = AVAILABLE_VLM_MODELS[0];
  }
  try {
    mcpLog(`mugshot VLM: using model "${model}" on contact sheet`, 'info');
    let result: { text: string; model?: string };

    if (ANTHROPIC_VLM_MODELS.includes(model)) {
      // Claude models — direct Anthropic API with base64 image
      const { callAnthropicVision, getAnthropicKey } = await import('../vision/anthropic');
      const apiKey = getAnthropicKey();
      if (!apiKey) {
        mcpLog(`mugshot VLM: no Anthropic API key for ${model}`, 'warn');
        return null;
      }
      const imgBuf = fs.readFileSync(path.resolve(contactSheetPath));
      const base64 = imgBuf.toString('base64');
      const anthropicResult = await callAnthropicVision(
        prompt,
        [{ base64, mediaType: 'image/png' }],
        { apiKey, model: ANTHROPIC_MODEL_IDS[model] || 'claude-sonnet-4-20250514', maxTokens: 2000 }
      );
      result = { text: anthropicResult.text, model: anthropicResult.model };
    } else {
      // otoy-studio models (moondream3, moondream-next, llava-next)
      result = await analyseImageFromFile(path.resolve(contactSheetPath), 'ask', prompt, {
        model,
      });
    }

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      parsed.orientation_matters = parsed.orientation_matters ?? true;
      parsed.confidence = parsed.confidence ?? 'medium';
      mcpLog(
        `mugshot VLM: ${parsed.object_type}, upright=${parsed.is_upright}, orientation_matters=${parsed.orientation_matters}, confidence=${parsed.confidence}`,
        'info'
      );
      return { ...parsed, vlm_model: result.model || model };
    }
  } catch (e: any) {
    mcpLog(`mugshot VLM: failed: ${e.message}`, 'warn');
  }

  return null;
}

import { ArtDirectionState, adWorkflow } from '../ArtDirectionState';
import { ScenePlacementState } from '../ScenePlacementState';

export function registerImportTools(
  server: McpServer,
  client: OctaneMcpClient,
  cache: ApiCache | null,
  artState?: ArtDirectionState,
  placementState?: ScenePlacementState
) {
  // import_geo demoted — internal only. Use place_geo for all geometry placement.
  // importGeoInternal() below is still called by place_geo.

  /** Core geometry import: creates mesh + placement + material + textures, reads sidecar.
   *  Does NOT wire to geo group or register in placement state — that's place_geo's job. */
  async function importGeoInternal(
    file_path: string,
    assetName?: string,
    metallic?: number,
    roughness?: number
  ) {
    try {
      // Validate input path
      if (!fs.existsSync(file_path)) {
        return errorResult(new Error(`File not found: ${file_path}`));
      }
      const ext = path.extname(file_path).toLowerCase();
      const SUPPORTED = ['.obj', '.glb', '.gltf'];
      if (!SUPPORTED.includes(ext)) {
        return errorResult(
          new Error(`Unsupported format "${ext}". Supported: ${SUPPORTED.join(', ')}`)
        );
      }

      // Derive name from filename if not provided
      const derivedName =
        assetName ||
        path
          .basename(file_path, ext)
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .substring(0, 40);
      const outDir = path.join(ASSETS_DIR, derivedName);

      // Validate output path
      const pathError = validateFilePath(outDir);
      if (pathError) return errorResult(new Error(pathError));

      // Phase 1: Get OBJ path — convert if GLB/glTF, use directly if OBJ
      let objPath: string;
      let texturePaths: string[] = [];
      let vertices = 0;
      let faces = 0;
      let boundsMin: [number, number, number] = [0, 0, 0];
      let boundsMax: [number, number, number] = [0, 0, 0];
      let hasMtl = false;

      if (ext === '.obj') {
        // OBJ — load directly, no conversion needed
        objPath = path.resolve(file_path);
        mcpLog(`import_geo: loading OBJ directly: ${objPath}`, 'info');

        // Check for .mtl companion — Octane reads it automatically
        const objDir = path.dirname(objPath);
        const mtlPath = objPath.replace(/\.obj$/i, '.mtl');
        if (fs.existsSync(mtlPath)) {
          hasMtl = true;
          mcpLog(`import_geo: found .mtl companion — Octane will load textures from it`, 'info');
          // Parse .mtl to find referenced texture maps
          try {
            const mtlContent = fs.readFileSync(mtlPath, 'utf-8');
            const mapLines = mtlContent.match(/^map_\w+\s+(.+)$/gm) || [];
            for (const line of mapLines) {
              const texFile = line.replace(/^map_\w+\s+/, '').trim();
              const texFullPath = path.resolve(objDir, texFile);
              if (fs.existsSync(texFullPath) && !texturePaths.includes(texFullPath)) {
                texturePaths.push(texFullPath);
              }
            }
            mcpLog(`import_geo: .mtl references ${texturePaths.length} texture(s)`, 'info');
          } catch {
            /* mtl parse is best-effort */
          }
        }
        // Also pick up any loose texture files next to OBJ (exclude mugshots from analyze_geo)
        if (texturePaths.length === 0) {
          const siblings = fs.readdirSync(objDir);
          texturePaths = siblings
            .filter(f => /\.(png|jpg|jpeg)$/i.test(f) && !f.includes('.mugshot_'))
            .map(f => path.join(objDir, f));
        }
      } else {
        // GLB/glTF — convert to OBJ
        mcpLog(`import_geo: converting ${file_path} → ${outDir}/${derivedName}.obj`, 'info');
        const conv = await convertGlbToObj(file_path, outDir, derivedName);
        mcpLog(
          `import_geo: converted ${conv.vertices} verts, ${conv.faces} faces, ${conv.texturePaths.length} textures`,
          'info'
        );
        objPath = conv.objPath;
        texturePaths = conv.texturePaths;
        vertices = conv.vertices;
        faces = conv.faces;
        boundsMin = conv.boundsMin;
        boundsMax = conv.boundsMax;
      }

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
          string_value: objPath.replace(/\//g, '\\'),
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
        if (transformHandle) {
          client.sceneCache.addNode(transformHandle, 'Transform', 'NT_TRANSFORM_VALUE', 0);
        }
      } catch (e: any) {
        mcpLogLazy('verbose', () => `[import:geo:transform_child] ${e?.message ?? e}`);
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
      // If OBJ has .mtl, Octane loads textures internally — don't override albedo.
      // Only create explicit texture node for GLB conversions or loose textures without .mtl.
      if (texturePaths.length > 0 && !hasMtl) {
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
              string_value: texturePaths[0].replace(/\//g, '\\'),
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
        if (pin.name === 'roughness' && pin.connectedHandle) roughnessHandle = pin.connectedHandle;
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
        `import_geo: complete — mesh=${meshHandle} placement=${placementHandle} material=${matHandle} tex=${texHandle || 'none'}`,
        'info'
      );

      // Compute mesh extents for orientation help
      const extents = [
        boundsMax[0] - boundsMin[0],
        boundsMax[1] - boundsMin[1],
        boundsMax[2] - boundsMin[2],
      ];

      // Check for cached mesh_info sidecar (from prior analyze_geo)
      const sidecarPath = objPath.replace(/\.obj$/i, '.mesh_info.json');
      let meshInfo: any = null;
      const analyzeMeshWarnings: string[] = [];
      if (fs.existsSync(sidecarPath)) {
        try {
          meshInfo = JSON.parse(fs.readFileSync(sidecarPath, 'utf-8'));
          mcpLog(`import_geo: found cached mesh_info sidecar`, 'info');
        } catch {
          /* ignore parse errors */
        }
      }
      if (!meshInfo) {
        analyzeMeshWarnings.push(
          `⛔ NO MESH ANALYSIS: analyze_geo was NOT run on "${path.basename(objPath)}". You are guessing orientation and scale. STOP and run analyze_geo("${objPath}") FIRST — it renders 6 mugshots (front/right/top × clay/textured) and caches the result. Then re-import with correct rotation/scale from the .mesh_info.json sidecar.`
        );
        mcpLog(`import_geo: ⛔ NO SIDECAR — analyze_geo not run for ${objPath}`, 'warning');
      }

      return jsonResult({
        success: true,
        source_format: ext,
        handles: {
          mesh: meshHandle,
          placement: placementHandle,
          transform: transformHandle,
          material: matHandle,
          texture: texHandle || undefined,
        },
        obj_path: objPath,
        textures: texturePaths,
        vertices,
        faces,
        bounds: {
          min: boundsMin,
          max: boundsMax,
          extents,
        },
        mesh_info: meshInfo
          ? {
              rotation_deg: meshInfo.final_suggestion?.rotation_deg,
              scale_factor: meshInfo.final_suggestion?.scale_factor,
              ground_offset_y: meshInfo.final_suggestion?.ground_offset_y,
              category: meshInfo.semantic?.category,
            }
          : undefined,
        has_mtl: hasMtl,
        has_texture: texHandle > 0 || hasMtl,
        texture_note: hasMtl
          ? 'OBJ has .mtl — Octane loads textures internally. Do NOT override albedo. Only set roughness/metallic/specular/IOR on the material.'
          : undefined,
        next_steps: [
          ...(meshInfo
            ? []
            : [
                `FIRST: call analyze_geo on ${objPath} — generates mugshots for VLM orientation analysis`,
              ]),
          `Connect placement (${placementHandle}) to geo group via pin_index N`,
          `Set transform rotation: set_attribute(${transformHandle}, ${AttributeId.A_ROTATION}, 11, {rx, ry, rz})`,
          `Set transform position: set_attribute(${transformHandle}, ${AttributeId.A_TRANSLATION}, 11, {x, y, z})`,
          `Set transform scale: set_attribute(${transformHandle}, ${AttributeId.A_SCALE}, 11, {s, s, s})`,
          ...(meshInfo
            ? [
                `Apply cached suggestion: rotation=${JSON.stringify(meshInfo.final_suggestion?.rotation_deg)}, scale=${meshInfo.final_suggestion?.scale_factor}`,
              ]
            : []),
        ],
        warnings: analyzeMeshWarnings.length > 0 ? analyzeMeshWarnings : undefined,
        instruction: meshInfo
          ? 'Asset imported with cached mesh analysis. Apply suggested transforms, connect to geo group, then fit_camera + save_render to verify.'
          : '⛔ Asset imported WITHOUT mesh analysis. Orientation is unknown — you are guessing. STOP: call analyze_geo on the OBJ path NOW to generate mugshots and get VLM-verified orientation. Then apply the sidecar rotation/scale.',
      });
    } catch (error: any) {
      mcpLog(`import_geo FAILED: ${error.message}`, 'error');
      return errorResult(error);
    }
  }

  // ── analyze_geo ──────────────────────────────────────────────────

  server.registerTool(
    'analyze_geo',
    {
      title: 'Analyze Mesh',
      description:
        'Analyze mesh orientation and scale BEFORE placement. Renders mugshots, sends to VLM for orientation verification. Caches result in .mesh_info.json sidecar. Accepts OBJ, GLB, or glTF. MUST run on every mesh before placement.',
      inputSchema: {
        obj_path: z.string().describe('Absolute path to mesh file (OBJ, GLB, or glTF)'),
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
        configuration: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            'Configuration mode: run ALL available VLM models, save results to scoreboard for comparison. Use on several meshes, then score to find best model.'
          ),
        source_endpoint: z
          .string()
          .optional()
          .describe(
            'DEPRECATED — ignored. All meshes run full VLM mugshot verification. Do not pass this parameter.'
          ),
      },
      annotations: { destructiveHint: true, openWorldHint: true },
    },
    async ({
      obj_path,
      scene_context,
      target_height,
      force_reanalyze,
      configuration,
      source_endpoint,
    }) => {
      try {
        let resolved = path.resolve(obj_path);
        if (!fs.existsSync(resolved)) {
          return errorResult(new Error(`File not found: ${resolved}`));
        }
        const ext = path.extname(resolved).toLowerCase();
        const SUPPORTED = ['.obj', '.glb', '.gltf'];
        if (!SUPPORTED.includes(ext)) {
          return errorResult(
            new Error(`Unsupported format "${ext}". Supported: ${SUPPORTED.join(', ')}`)
          );
        }

        // GLB/glTF → convert to OBJ first (same conversion as import_geo)
        if (ext !== '.obj') {
          const outDir = path.join(path.dirname(resolved), path.basename(resolved, ext));
          const derivedName = path.basename(resolved, ext);
          mcpLog(`analyze_geo: converting ${resolved} → OBJ`, 'info');
          const conv = await convertGlbToObj(resolved, outDir, derivedName);
          resolved = path.resolve(conv.objPath);
          mcpLog(
            `analyze_geo: converted → ${resolved} (${conv.vertices} verts, ${conv.faces} faces)`,
            'info'
          );
        }

        const sidecar = sidecarPath(resolved);

        // Check sidecar cache
        if (!force_reanalyze && fs.existsSync(sidecar)) {
          try {
            const cached = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
            // v4 sidecar (contact sheet + ground plane) is fully cached
            if (cached.version >= 4 && cached.visual_check?.performed_at) {
              // If configuration mode requested but this wasn't a config run, don't use cache
              if (configuration && !cached.visual_check?.configuration_mode) {
                mcpLog(
                  `analyze_geo: v4 cached but configuration mode requested — re-analyzing`,
                  'info'
                );
              } else {
                mcpLog(
                  `analyze_geo: returning v4 cached sidecar for ${path.basename(resolved)}`,
                  'info'
                );
                const cachedNote = cached.visual_check?.confidence
                  ? `Cached VLM (${cached.visual_check.confidence} confidence, ${cached.visual_check.protocol || 'legacy'})`
                  : 'Cached (no VLM data)';
                return jsonResult({
                  ...cached,
                  cached: true,
                  sidecar_path: sidecar,
                  instruction:
                    'Cached analysis returned (v4 with contact sheet + ground plane). Use final_suggestion for transform. Override if scene intent differs.',
                  ...(artState ? adWorkflow(artState, 'analyze_geo', cachedNote) : {}),
                });
              }
            }
            // v3 sidecar (8-view mugshots, no contact sheet) — return with upgrade hint
            if (cached.version === 3 && cached.visual_check?.performed_at && !configuration) {
              mcpLog(
                `analyze_geo: returning v3 cached sidecar for ${path.basename(resolved)} (upgrade available with force_reanalyze)`,
                'info'
              );
              const cachedNote = cached.visual_check?.confidence
                ? `Cached v3 VLM (${cached.visual_check.confidence} confidence, upgrade to v4 available)`
                : 'Cached v3 (no VLM data)';
              return jsonResult({
                ...cached,
                cached: true,
                upgrade_available: true,
                sidecar_path: sidecar,
                instruction:
                  'Cached v3 analysis (individual mugshots, no contact sheet). Still valid. Use force_reanalyze=true to upgrade to v4 (contact sheet + ground plane) for better orientation accuracy.',
                ...(artState ? adWorkflow(artState, 'analyze_geo', cachedNote) : {}),
              });
            }
            // v2 sidecar (4-view) — still valid, return with upgrade hint
            if (cached.version === 2 && cached.visual_check?.performed_at && !configuration) {
              mcpLog(
                `analyze_geo: returning v2 cached sidecar for ${path.basename(resolved)} (upgrade available with force_reanalyze)`,
                'info'
              );
              const v2Note = cached.visual_check?.confidence
                ? `Cached v2 VLM (${cached.visual_check.confidence} confidence, upgrade available)`
                : 'Cached v2 (no VLM data)';
              return jsonResult({
                ...cached,
                cached: true,
                upgrade_available: true,
                sidecar_path: sidecar,
                instruction:
                  'Cached v2 analysis (4-view mugshots). Still valid. Use force_reanalyze=true to upgrade to v3 (8-view) for better orientation coverage.',
                ...(artState ? adWorkflow(artState, 'analyze_geo', v2Note) : {}),
              });
            }
            // v1 sidecar — run full analysis
            mcpLog(`analyze_geo: v1 sidecar found, upgrading to v4 with contact sheet`, 'info');
          } catch {
            mcpLog(`analyze_geo: corrupt sidecar, re-analyzing`, 'warn');
          }
        }

        // Tier 1: Geometric analysis via trimesh
        mcpLog(`analyze_geo: Tier 1 — trimesh bounds on ${path.basename(resolved)}`, 'info');
        const geo = await getMeshBounds(resolved);

        const extents = {
          x: geo.boundsMax[0] - geo.boundsMin[0],
          y: geo.boundsMax[1] - geo.boundsMin[1],
          z: geo.boundsMax[2] - geo.boundsMin[2],
        };

        // Tier 2: Semantic inference from filename
        mcpLog(`analyze_geo: Tier 2 — semantic inference`, 'info');
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

        // Tier 3: Lean VLM orientation — diagnose / correct / verify / hero
        mcpLog(`analyze_geo: Tier 3 — lean VLM orientation`, 'info');
        const outputDir = path.dirname(resolved);
        const baseName = path.basename(resolved, '.obj');
        const rawMin = { x: geo.boundsMin[0], y: geo.boundsMin[1], z: geo.boundsMin[2] };
        const rawMax = { x: geo.boundsMax[0], y: geo.boundsMax[1], z: geo.boundsMax[2] };

        // Clean stale render PNGs before re-render (prevents confusion with old files)
        if (force_reanalyze) {
          try {
            const staleFiles = fs
              .readdirSync(outputDir)
              .filter(
                (f: string) =>
                  f.startsWith(baseName) &&
                  (f.includes('.mugshot_') ||
                    f.includes('.check_') ||
                    f.includes('.hero.') ||
                    f.includes('.diag_')) &&
                  f.endsWith('.png')
              );
            for (const f of staleFiles) {
              fs.unlinkSync(path.join(outputDir, f));
            }
            if (staleFiles.length > 0)
              mcpLog(`analyze_geo: cleaned ${staleFiles.length} stale render PNGs`, 'info');
          } catch (e: any) {
            mcpLog(`analyze_geo: stale file cleanup failed: ${e?.message}`, 'warn');
          }
        }

        let visualCheck: any = null;
        let finalRotation = orientation.suggestedRotation;
        let finalGroundOffset = orientation.groundOffsetY;
        let finalConfidence = orientation.confidence;
        let heroPath = '';
        // VLM transparency: accumulate all prompts + responses for tool output
        const vlmTranscript: Array<{ type: 'text'; text: string }> = [];

        // Known source hint — DISABLED: always run full VLM mugshot verification.
        const knownSource = null; // source_endpoint ? ENDPOINT_AXIS_MAP[source_endpoint] : null;

        try {
          const { callAnthropicVision, getAnthropicKey } = await import('../vision/anthropic');
          const apiKey = getAnthropicKey();
          if (!apiKey) {
            mcpLog(`analyze_geo: no Anthropic API key, skipping VLM`, 'warn');
            throw new Error('No Anthropic API key');
          }

          const vlmModel = ANTHROPIC_MODEL_IDS['claude-sonnet'] || 'claude-sonnet-4-20250514';
          let diag: any = null;

          if (knownSource) {
            // === FAST PATH: Known source endpoint — apply deterministic rotation ===
            mcpLog(
              `analyze_geo: known source "${source_endpoint}" → applying ${knownSource.convention} correction (${knownSource.rotation.join(',')})°`,
              'info'
            );
            finalRotation = {
              x: knownSource.rotation[0],
              y: knownSource.rotation[1],
              z: knownSource.rotation[2],
            };
            // Recompute ground offset for the applied rotation
            if (finalRotation.x === 90) finalGroundOffset = Math.max(0, geo.boundsMax[2]);
            else if (finalRotation.x === -90) finalGroundOffset = Math.max(0, -geo.boundsMin[2]);
            else finalGroundOffset = Math.max(0, -geo.boundsMin[1]);

            visualCheck = {
              performed_at: new Date().toISOString(),
              protocol: 'known_source',
              vlm_model: vlmModel,
              source_endpoint,
              axis_convention: knownSource.convention,
              known_rotation: knownSource.rotation,
            };

            // Always render diagnostic mugshots + hero — never skip
            const mugshotViewSpecs: ViewSpec[] = MUGSHOT_VIEWS.map(v => ({
              name: `mugshot_${v.name}`,
              yaw: v.yaw,
              elevation: v.elevation,
              ground: v.ground,
              // no clay property → defaults to color clay (mode 2) in renderViews
            }));
            await renderViews(
              client,
              cache,
              resolved,
              finalRotation,
              finalGroundOffset,
              outputDir,
              baseName,
              mugshotViewSpecs,
              extents,
              rawMin,
              rawMax
            );

            // Hero shot (color clay thumbnail)
            const heroViews: ViewSpec[] = [{ name: 'hero', yaw: 4, elevation: 7, ground: true }];
            const heroPaths = await renderViews(
              client,
              cache,
              resolved,
              finalRotation,
              finalGroundOffset,
              outputDir,
              baseName,
              heroViews,
              extents,
              rawMin,
              rawMax
            );
            heroPath = heroPaths[0] || '';
            visualCheck.hero_shot = path.basename(heroPath);
            mcpLog(`analyze_geo: hero shot → ${heroPath}`, 'info');
          } else {
            // === PASS 1: Diagnosis — render 2-3 raw views, ask VLM what it sees ===
            const rawRotation = { x: 0, y: 0, z: 0 };
            const rawGroundOffset = Math.max(0, -geo.boundsMin[1]);
            const diagViews: ViewSpec[] = [
              { name: 'diag_front', yaw: 0, elevation: 0, ground: true },
              { name: 'diag_side', yaw: 90, elevation: 0, ground: true },
              { name: 'diag_top', yaw: 0, elevation: 85, ground: true },
            ];
            const diagPaths = await renderViews(
              client,
              cache,
              resolved,
              rawRotation,
              rawGroundOffset,
              outputDir,
              baseName,
              diagViews,
              extents,
              rawMin,
              rawMax
            );

            // Send to VLM — individual full-res images, concise prompt
            const diagPrompt = buildOrientationPrompt({
              filename: path.basename(resolved),
              category: categoryInfo.category,
              subcategory: assetFile,
              extents,
              tallestAxis: orientation.uprightAxis,
              sceneContext: scene_context,
            });
            const diagImages = diagPaths.map(p => ({
              base64: fs.readFileSync(p).toString('base64'),
              mediaType: 'image/png' as string,
            }));
            const pass1 = await callAnthropicVision(diagPrompt, diagImages, {
              apiKey,
              model: vlmModel,
              maxTokens: 1000,
            });

            // VLM transparency: log Pass 1 prompt + response
            vlmTranscript.push({
              type: 'text',
              text: `--- MUGSHOT PASS 1 PROMPT ---\n${diagPrompt}\n--- END PROMPT ---`,
            });
            vlmTranscript.push({
              type: 'text',
              text: `--- MUGSHOT PASS 1 RESPONSE ---\n${pass1.text}\n--- END RESPONSE ---`,
            });
            vlmTranscript.push({
              type: 'text',
              text: `--- MUGSHOT PASS 1 IMAGES ---\n${diagPaths.map(p => path.basename(p)).join(', ')}\n--- END IMAGES ---`,
            });

            // Parse Pass 1 response
            const jsonMatch = pass1.text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('Pass 1: no JSON in VLM response');
            diag = JSON.parse(jsonMatch[0]);
            mcpLog(
              `analyze_geo: Pass 1 diagnosis — ${diag.object_type}, upright=${diag.is_upright}, pose=${diag.pose}, front_in=${diag.front_visible_in}, confidence=${diag.confidence}`,
              'info'
            );

            visualCheck = {
              performed_at: new Date().toISOString(),
              protocol: 'lean_2pass',
              vlm_model: pass1.model || vlmModel,
              pass1_diagnosis: diag,
              pass1_views: diagPaths.map(p => path.basename(p)),
            };

            // === MAP DIAGNOSIS → ROTATION (deterministic) ===
            if (diag.is_upright === false || (diag.pose && diag.pose !== 'upright')) {
              const mapped = diagnosisToRotation(
                diag.pose || 'lying_on_back',
                diag.front_visible_in || '1',
                orientation.uprightAxis,
                geo.boundsMin,
                geo.boundsMax
              );
              finalRotation = mapped.rotation;
              finalGroundOffset = mapped.groundOffset;
              mcpLog(
                `analyze_geo: diagnosis mapped → rotation=(${finalRotation.x},${finalRotation.y},${finalRotation.z})°, groundOffset=${finalGroundOffset.toFixed(3)}`,
                'info'
              );
            } else {
              // Upright — just handle front-facing
              finalRotation = { x: 0, y: 0, z: 0 };
              finalGroundOffset = rawGroundOffset;
              const fv = parseInt(String(diag.front_visible_in || '1'), 10);
              if (fv === 3) finalRotation.y = 180;
              else if (fv === 2) finalRotation.y = -90;
              else if (fv === 4) finalRotation.y = 90;
            }

            // Always render diagnostic mugshots — never skip
            const mugshotViewSpecs: ViewSpec[] = MUGSHOT_VIEWS.map(v => ({
              name: `mugshot_${v.name}`,
              yaw: v.yaw,
              elevation: v.elevation,
              ground: v.ground,
            }));
            await renderViews(
              client,
              cache,
              resolved,
              finalRotation,
              finalGroundOffset,
              outputDir,
              baseName,
              mugshotViewSpecs,
              extents,
              rawMin,
              rawMax
            );
          }

          // === PASS 2: Verification loop — always at least 1 pass, even for known sources ===
          const MAX_VERIFY_PASSES = 4;
          let verified = false;
          for (let attempt = 0; attempt < MAX_VERIFY_PASSES; attempt++) {
            const checkViews: ViewSpec[] = [
              { name: 'check_front', yaw: 0, elevation: 0, ground: true },
              { name: 'check_side', yaw: 90, elevation: 0, ground: true },
            ];
            const checkPaths = await renderViews(
              client,
              cache,
              resolved,
              finalRotation,
              finalGroundOffset,
              outputDir,
              baseName,
              checkViews,
              extents,
              rawMin,
              rawMax
            );

            const checkImages = checkPaths.map(p => ({
              base64: fs.readFileSync(p).toString('base64'),
              mediaType: 'image/png' as string,
            }));
            const pass2 = await callAnthropicVision(buildVerificationPrompt(), checkImages, {
              apiKey,
              model: vlmModel,
              maxTokens: 500,
            });

            // VLM transparency: log Pass 2 prompt + response
            vlmTranscript.push({
              type: 'text',
              text: `--- MUGSHOT PASS 2 (attempt ${attempt + 1}) PROMPT ---\n${buildVerificationPrompt()}\n--- END PROMPT ---`,
            });
            vlmTranscript.push({
              type: 'text',
              text: `--- MUGSHOT PASS 2 (attempt ${attempt + 1}) RESPONSE ---\n${pass2.text}\n--- END RESPONSE ---`,
            });
            vlmTranscript.push({
              type: 'text',
              text: `--- MUGSHOT PASS 2 (attempt ${attempt + 1}) IMAGES ---\n${checkPaths.map(p => path.basename(p)).join(', ')}\n--- END IMAGES ---`,
            });

            const verifyMatch = pass2.text.match(/\{[\s\S]*\}/);
            if (verifyMatch) {
              const vResult = JSON.parse(verifyMatch[0]);
              mcpLog(
                `analyze_geo: Pass 2 verify (attempt ${attempt + 1}) — correct=${vResult.is_correct}, issue=${vResult.issue}`,
                'info'
              );
              visualCheck[`pass2_attempt_${attempt + 1}`] = {
                views: checkPaths.map(p => path.basename(p)),
                result: vResult,
              };

              if (vResult.is_correct) {
                verified = true;
                break;
              }

              // Adjust based on issue
              const issue = (vResult.issue || '').toLowerCase();
              if (issue === 'upside_down') {
                finalRotation.x += 180;
              } else if (issue === 'facing_wrong_way') {
                finalRotation.y += 180;
              } else if (issue === 'still_lying_down') {
                finalRotation.x = -finalRotation.x;
                if (finalRotation.x === 0) finalRotation.x = 90;
              }
              // Recompute ground offset
              if (finalRotation.x === 90) finalGroundOffset = Math.max(0, geo.boundsMax[2]);
              else if (finalRotation.x === -90) finalGroundOffset = Math.max(0, -geo.boundsMin[2]);
              else if (finalRotation.x === 180) finalGroundOffset = Math.max(0, geo.boundsMax[1]);
              else finalGroundOffset = Math.max(0, -geo.boundsMin[1]);

              mcpLog(
                `analyze_geo: adjusting → rotation=(${finalRotation.x},${finalRotation.y},${finalRotation.z})°`,
                'info'
              );
            }
          }

          visualCheck.verified = verified;
          finalConfidence = verified ? 'high' : diag?.confidence || 'medium';

          // === HERO SHOT — always rendered (thumbnail/reference image) ===
          const heroViews: ViewSpec[] = [{ name: 'hero', yaw: 4, elevation: 7, ground: true }];
          const heroPaths = await renderViews(
            client,
            cache,
            resolved,
            finalRotation,
            finalGroundOffset,
            outputDir,
            baseName,
            heroViews,
            extents,
            rawMin,
            rawMax
          );
          heroPath = heroPaths[0] || '';
          visualCheck.hero_shot = path.basename(heroPath);
          mcpLog(`analyze_geo: hero shot → ${heroPath}`, 'info');

          if (diag?.orientation_matters === false) {
            visualCheck.orientation_matters = false;
          }
          visualCheck.confidence = finalConfidence;
        } catch (e: any) {
          mcpLog(`analyze_geo: VLM failed (non-fatal): ${e.message}`, 'warn');
          // Fall back to geometric+semantic only
        }

        // Build v5 sidecar (lean 2-pass VLM)
        const result: any = {
          version: 5,
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
              visualCheck?.orientation_matters ??
              visualCheck?.pass1_diagnosis?.orientation_matters ??
              categoryInfo.expectUpright,
            confidence: categoryInfo.confidence,
          },
          ...(source_endpoint && knownSource
            ? {
                source: {
                  endpoint: source_endpoint,
                  axis_convention: knownSource.convention,
                  known_rotation: knownSource.rotation,
                },
              }
            : {}),
          visual_check: visualCheck,
          final_suggestion: {
            rotation_deg: [finalRotation.x, finalRotation.y, finalRotation.z],
            ground_offset_y: finalGroundOffset,
            scale_factor: scaleFactor,
            notes: visualCheck
              ? `VLM ${visualCheck.verified ? 'verified' : 'unverified'}: ${finalRotation.x === 0 && finalRotation.y === 0 && finalRotation.z === 0 ? 'upright, no rotation needed' : `rotate (${finalRotation.x}, ${finalRotation.y}, ${finalRotation.z})°`}. ${categoryInfo.category}.`
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

        // Write v4 sidecar cache
        try {
          fs.writeFileSync(sidecar, JSON.stringify(result, null, 2), 'utf8');
          mcpLog(`analyze_geo: wrote v4 sidecar ${sidecar}`, 'info');
        } catch (e: any) {
          mcpLog(`analyze_geo: failed to write sidecar: ${e.message}`, 'warn');
        }

        const meshNote = visualCheck
          ? `VLM ${visualCheck.verified ? 'verified' : 'checked'} (${finalConfidence} confidence, ${visualCheck.vlm_model})`
          : 'Geometric+semantic only (no VLM)';

        // Return with VLM transcript for full transparency
        const resultJson = {
          ...legacyResult,
          cached: false,
          sidecar_path: sidecar,
          ...(heroPath ? { hero_shot: heroPath } : {}),
          instruction:
            'Use placement_suggestion to set transform on the mesh placement. These are SUGGESTIONS — override if your scene intent differs (flying objects, tilted angles, etc.).' +
            (heroPath
              ? visualCheck?.verified === false
                ? ' HERO SHOT available — orientation UNVERIFIED. Show to human for manual review before proceeding.'
                : ' HERO SHOT available as thumbnail/reference.'
              : ''),
          ...(artState ? adWorkflow(artState, 'analyze_geo', meshNote) : {}),
        };
        if (vlmTranscript.length > 0) {
          // Multi-content: VLM transcript blocks + final JSON result
          return {
            content: [
              ...vlmTranscript,
              { type: 'text' as const, text: JSON.stringify(resultJson, null, 2) },
            ],
          };
        }
        return jsonResult(resultJson);
      } catch (error: any) {
        mcpLog(`analyze_geo FAILED: ${error.message}`, 'error');
        return errorResult(error);
      }
    }
  );

  // ── benchmark_vlm_models ──────────────────────────────────────────

  server.registerTool(
    'benchmark_vlm_models',
    {
      title: 'Benchmark VLM Models',
      description:
        'Score VLM models from configuration mode runs. Set ground_truth on scoreboard entries first, then call this to compute accuracy per model and set the preferred model.',
      inputSchema: {
        set_ground_truth: z
          .array(
            z.object({
              mesh: z.string().describe('Mesh name (matches scoreboard run)'),
              is_upright: z.boolean(),
              front_direction: z.string().describe('toward_camera | away | left | right'),
              correction: z.array(z.number()).length(3).describe('[x, y, z] degrees'),
            })
          )
          .optional()
          .describe('Set ground truth for meshes before scoring'),
      },
      annotations: { destructiveHint: true, openWorldHint: true },
    },
    async ({ set_ground_truth }) => {
      try {
        const sb = loadScoreboard();

        // Apply ground truth if provided
        if (set_ground_truth) {
          for (const gt of set_ground_truth) {
            const run = sb.runs.find(r => r.mesh === gt.mesh);
            if (run) {
              run.ground_truth = {
                is_upright: gt.is_upright,
                front_direction: gt.front_direction,
                correction: gt.correction as [number, number, number],
              };
              mcpLog(`mugshot scoring: set ground truth for "${gt.mesh}"`, 'info');
            } else {
              mcpLog(`mugshot scoring: no run found for "${gt.mesh}"`, 'warn');
            }
          }
        }

        // Score all models
        const runsWithTruth = sb.runs.filter(r => r.ground_truth !== null);
        if (runsWithTruth.length === 0) {
          saveScoreboard(sb);
          return jsonResult({
            message: 'No runs with ground_truth set. Set ground_truth first, then score.',
            runs: sb.runs.map(r => ({ mesh: r.mesh, has_ground_truth: !!r.ground_truth })),
          });
        }

        const modelScores: Record<string, { correct: number; total: number; details: any[] }> = {};

        for (const run of runsWithTruth) {
          const gt = run.ground_truth!;
          for (const [model, result] of Object.entries(run.model_results)) {
            if (!modelScores[model]) modelScores[model] = { correct: 0, total: 0, details: [] };
            const ms = modelScores[model];
            ms.total += 3; // 3 criteria per mesh

            const uprightMatch = result.is_upright === gt.is_upright;
            const frontMatch =
              result.front_direction.toLowerCase().replace(/[^a-z_]/g, '') ===
              gt.front_direction.toLowerCase().replace(/[^a-z_]/g, '');
            const corrClose = result.correction.every(
              (v, i) => Math.abs(v - gt.correction[i]) <= 15
            );

            if (uprightMatch) ms.correct++;
            if (frontMatch) ms.correct++;
            if (corrClose) ms.correct++;

            ms.details.push({
              mesh: run.mesh,
              upright: uprightMatch ? '✓' : `✗ (got ${result.is_upright}, want ${gt.is_upright})`,
              front: frontMatch
                ? '✓'
                : `✗ (got ${result.front_direction}, want ${gt.front_direction})`,
              correction: corrClose
                ? '✓'
                : `✗ (got [${result.correction}], want [${gt.correction}])`,
            });
          }
        }

        // Compute accuracy and find best
        const ranked: Array<{
          model: string;
          accuracy: number;
          correct: number;
          total: number;
          details: any[];
        }> = [];
        for (const [model, scores] of Object.entries(modelScores)) {
          const accuracy =
            scores.total > 0 ? Math.round((scores.correct / scores.total) * 1000) / 10 : 0;
          ranked.push({
            model,
            accuracy,
            correct: scores.correct,
            total: scores.total,
            details: scores.details,
          });
          sb.scores[model] = { accuracy, total: scores.total, correct: scores.correct };
        }
        ranked.sort((a, b) => b.accuracy - a.accuracy);

        // Set preferred model to the best performer
        if (ranked.length > 0) {
          sb.preferred_model = ranked[0].model;
          mcpLog(
            `mugshot scoring: preferred model set to "${ranked[0].model}" (${ranked[0].accuracy}%)`,
            'info'
          );
        }

        saveScoreboard(sb);

        return jsonResult({
          ranked,
          preferred_model: sb.preferred_model,
          meshes_scored: runsWithTruth.length,
          total_runs: sb.runs.length,
        });
      } catch (error: any) {
        mcpLog(`benchmark_vlm_models FAILED: ${error.message}`, 'error');
        return errorResult(error);
      }
    }
  );

  // ── place_geo helpers ──────────────────────────────────────────────
  // ── Shared helpers for place_geo ──────────────────────────────────

  const PRIMITIVE_SHAPES: Record<string, number> = {
    box: 1,
    capsule: 2,
    cone: 3,
    cylinder: 4,
    disc: 6,
    plane: 15,
    sphere: 20,
    torus: 22,
  };

  // NT_MAT_UNIVERSAL pin layout (from octane://pin-layout/NT_MAT_UNIVERSAL)
  const MAT_PIN = {
    TRANSMISSION: 0,
    ALBEDO: 2,
    METALLIC: 4,
    SPECULAR: 6,
    ROUGHNESS: 8,
    IOR: 12, // Dielectric IOR (PT_FLOAT)
    COATING: 19,
    COATING_ROUGHNESS: 20,
    SHEEN: 26,
    OPACITY: 33,
    EMISSION: 44,
  } as const;

  /** Find or create a geo group on the active RT. */
  async function findOrCreateGeoGroup(
    geoGroupOverride?: number
  ): Promise<{ geoGroup: number; rtHandle: number }> {
    if (geoGroupOverride) return { geoGroup: geoGroupOverride, rtHandle: 0 };

    const activeRt = await client.callMethod('ApiRenderEngine', 'getRenderTargetNode', {});
    const activeRtHandle = extractHandle(activeRt);
    if (activeRtHandle) {
      const pins = await enumeratePins(client, activeRtHandle);
      const geoPin = pins.find(p => p.index === 3);
      if (geoPin?.connectedHandle) {
        return { geoGroup: geoPin.connectedHandle, rtHandle: activeRtHandle };
      }
      const geoGroup = await createNodeRaw(client, MUGSHOT_TYPES.GEO_GROUP);
      await connectRaw(client, activeRtHandle, geoGroup, 3);
      mcpLog(`place_geo: created geo group ${geoGroup} on existing RT ${activeRtHandle}`, 'info');
      return { geoGroup, rtHandle: activeRtHandle };
    }

    const rtHandle = await createNodeRaw(client, MUGSHOT_TYPES.RT);
    client.sceneCache.addNode(rtHandle, 'Render target', 'NT_RENDERTARGET', 56);
    const cam = await createNodeRaw(client, MUGSHOT_TYPES.CAM);
    const kern = await createNodeRaw(client, MUGSHOT_TYPES.KERN_PT);
    const env = await createNodeRaw(client, MUGSHOT_TYPES.ENV_DAYLIGHT);
    const geoGroup = await createNodeRaw(client, MUGSHOT_TYPES.GEO_GROUP);
    await connectRaw(client, rtHandle, cam, 0);
    await connectRaw(client, rtHandle, env, 1);
    await connectRaw(client, rtHandle, geoGroup, 3);
    await connectRaw(client, rtHandle, kern, 6);
    const aperture = await getConnectedChild(client, cam, 14);
    if (aperture) await setAttrRaw(client, aperture, AttributeId.A_VALUE, 9, 0);
    await client.callMethod('ApiRenderEngine', 'setRenderTargetNode', {
      targetNode: { handle: String(rtHandle), type: OBJ_API_NODE },
    });
    mcpLog(`place_geo: created new RT ${rtHandle} with geo group ${geoGroup}`, 'info');
    return { geoGroup, rtHandle };
  }

  /** Wire a node to geo group, flush, continue rendering. */
  async function wireToGeoGroup(nodeHandle: number, geoGroup: number): Promise<number> {
    const actualPin = await ensureDynamicPin(client, geoGroup);
    await connectRaw(client, geoGroup, nodeHandle, actualPin);
    await client.callMethod('ApiChangeManager', 'update', {});
    await client.callMethod('ApiRenderEngine', 'continueRendering', {});
    return actualPin;
  }

  // ── place_geo — unified placement ────────────────────────────────
  // Primitives: creates NT_GEO_OBJECT directly.
  // Meshes: calls importGeoInternal() then applies sidecar transforms + wiring.

  server.registerTool(
    'place_geo',
    {
      title: 'Place Geometry',
      description:
        'Unified geometry placement for primitives and meshes. Sets shape/transform, wires to geo group on active RT, auto-registers. Primitives need no analyze_geo.',
      inputSchema: {
        type: z
          .enum(['primitive', 'mesh'])
          .describe('Geometry type: "primitive" for NT_GEO_OBJECT shapes, "mesh" for mesh files'),
        shape: z
          .union([z.string(), z.number()])
          .optional()
          .describe(
            'Primitive shape: name ("box","plane","sphere","cone","cylinder","disc","torus","capsule") or enum value (1-23). Required for type="primitive".'
          ),
        obj_path: z
          .string()
          .optional()
          .describe('Path to mesh file. Required for type="mesh". Reads .mesh_info.json sidecar.'),
        name: z.string().optional().describe('Display name (default: auto)'),
        position: z
          .object({ x: z.number(), y: z.number(), z: z.number() })
          .default({ x: 0, y: 0, z: 0 })
          .describe('World position'),
        rotation: z
          .object({ x: z.number(), y: z.number(), z: z.number() })
          .default({ x: 0, y: 0, z: 0 })
          .describe('Rotation in degrees'),
        scale: z
          .union([z.number(), z.object({ x: z.number(), y: z.number(), z: z.number() })])
          .default(1)
          .describe('Scale: uniform number or per-axis {x,y,z}'),
        role: z
          .enum(['hero', 'secondary', 'accent', 'ground', 'light', 'prop'])
          .default('prop')
          .describe('Role in composition'),
        material: z
          .object({
            albedo: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
            roughness: z.number().min(0).max(1).optional(),
            metallic: z.number().min(0).max(1).optional(),
          })
          .optional()
          .describe('Optional inline material properties'),
        geo_group_handle: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe(
            'Existing geo group handle. If omitted, finds or creates one on the active RT.'
          ),
      },
      annotations: { destructiveHint: true },
    },
    async ({
      type,
      shape,
      obj_path,
      name,
      position,
      rotation,
      scale,
      role,
      material,
      geo_group_handle,
    }) => {
      try {
        // ── Mesh path: import via importGeoInternal, read sidecar, wire, register ──
        if (type === 'mesh') {
          if (!obj_path) return errorResult(new Error('obj_path is required for type="mesh"'));
          const resolved = path.resolve(obj_path);
          if (!fs.existsSync(resolved))
            return errorResult(new Error(`File not found: ${resolved}`));

          // Read sidecar for transforms
          const sidecarPath = resolved.replace(/\.obj$/i, '.mesh_info.json');
          if (!fs.existsSync(sidecarPath)) {
            return errorResult(
              new Error(`No .mesh_info.json sidecar. Run analyze_geo("${resolved}") first.`)
            );
          }
          const meshInfo = JSON.parse(fs.readFileSync(sidecarPath, 'utf-8'));
          const suggestion = meshInfo.final_suggestion || meshInfo.placement_suggestion;
          if (!suggestion)
            return errorResult(
              new Error('Sidecar has no placement suggestion. Re-run analyze_geo.')
            );

          // Extract transforms from sidecar (with overrides from params)
          const rotOverride =
            rotation.x !== 0 || rotation.y !== 0 || rotation.z !== 0 ? rotation : undefined;
          const rot =
            rotOverride ||
            (() => {
              const r = suggestion.rotation_deg || suggestion.rotation;
              if (Array.isArray(r)) return { x: r[0], y: r[1], z: r[2] };
              return r || { x: 0, y: 0, z: 0 };
            })();
          const scaleOverride = typeof scale === 'number' && scale !== 1 ? scale : undefined;
          const scaleFactor = scaleOverride ?? suggestion.scale_factor ?? suggestion.scale?.x ?? 1;
          const posOverride =
            position.x !== 0 || position.y !== 0 || position.z !== 0 ? position : undefined;
          const yOffset = posOverride?.y ?? suggestion.ground_offset_y ?? suggestion.y_offset ?? 0;
          const pos = posOverride || { x: 0, y: yOffset, z: 0 };

          mcpLog(
            `place_geo(mesh): ${path.basename(resolved)} rot=(${rot.x},${rot.y},${rot.z}) scale=${scaleFactor} pos=(${pos.x},${pos.y},${pos.z})`,
            'info'
          );

          // Import via importGeoInternal (creates mesh + placement + material + textures)
          const importResult = await importGeoInternal(resolved, name);
          if (
            !importResult ||
            (importResult as any).content?.[0]?.text?.includes('"success":false')
          ) {
            return importResult; // propagate error
          }
          // Extract handles from importGeoInternal result
          const resultData = JSON.parse((importResult as any).content[0].text);
          if (!resultData.success) return importResult;

          const handles = resultData.handles;
          const derivedName =
            name ||
            path
              .basename(resolved, path.extname(resolved))
              .replace(/[^a-zA-Z0-9_-]/g, '_')
              .substring(0, 40);

          // Apply sidecar transforms to placement's transform child
          if (handles.transform) {
            await setAttrRaw(client, handles.transform, AttributeId.A_ROTATION, 11, rot);
            await setAttrRaw(client, handles.transform, AttributeId.A_SCALE, 11, {
              x: scaleFactor,
              y: scaleFactor,
              z: scaleFactor,
            });
            await setAttrRaw(client, handles.transform, AttributeId.A_TRANSLATION, 11, pos);
          }

          // Wire to geo group
          const { geoGroup, rtHandle } = await findOrCreateGeoGroup(geo_group_handle);
          const actualPin = await wireToGeoGroup(handles.placement, geoGroup);

          mcpLog(`place_geo(mesh): ${derivedName} attached at geo group pin ${actualPin}`, 'info');

          // Register in placement state
          if (placementState) {
            try {
              const geoBounds = meshInfo.geometry;
              const localMin = geoBounds?.bounds_min
                ? {
                    x: geoBounds.bounds_min[0],
                    y: geoBounds.bounds_min[1],
                    z: geoBounds.bounds_min[2],
                  }
                : { x: -0.5, y: -0.5, z: -0.5 };
              const localMax = geoBounds?.bounds_max
                ? {
                    x: geoBounds.bounds_max[0],
                    y: geoBounds.bounds_max[1],
                    z: geoBounds.bounds_max[2],
                  }
                : { x: 0.5, y: 0.5, z: 0.5 };
              const scaleVec = { x: scaleFactor, y: scaleFactor, z: scaleFactor };
              placementState.addEntry({
                handle: handles.placement,
                name: derivedName,
                role: (role as any) || 'hero',
                position: pos,
                rotation: rot,
                scale: scaleVec,
                boundsWorld: computeWorldAABB(localMin, localMax, pos, rot, scaleVec),
              });
              mcpLog(`place_geo(mesh): registered "${derivedName}" as ${role}`, 'info');
            } catch (regErr: any) {
              mcpLog(`place_geo(mesh): register warning: ${regErr.message}`, 'warn');
            }
          }

          return jsonResult({
            success: true,
            mesh: derivedName,
            handles: { ...handles, geo_group: geoGroup, render_target: rtHandle || undefined },
            applied_transform: { rotation: rot, scale: scaleFactor, position: pos },
            geo_group_pin: actualPin,
            sidecar_source: sidecarPath,
            category: meshInfo.semantic?.category,
            has_mtl: resultData.has_mtl,
            has_texture: resultData.has_texture,
            texture_count: resultData.textures?.length || 0,
            auto_registered: !!placementState,
            instruction:
              'Placed. Use fit_camera(framing_mode:"subjects") then save_render to verify.',
          });
        }

        // ── Primitive path ──
        if (!shape) return errorResult(new Error('shape is required for type="primitive"'));

        const shapeVal =
          typeof shape === 'number'
            ? shape
            : (PRIMITIVE_SHAPES[shape.toLowerCase()] ?? parseInt(shape, 10));
        if (!shapeVal || shapeVal < 1 || shapeVal > 23) {
          return errorResult(
            new Error(
              `Invalid shape "${shape}". Use: ${Object.keys(PRIMITIVE_SHAPES).join(', ')} or enum 1-23.`
            )
          );
        }

        const displayName =
          name ||
          (typeof shape === 'string'
            ? shape.charAt(0).toUpperCase() + shape.slice(1)
            : `Primitive_${shapeVal}`);
        const scaleVec = typeof scale === 'number' ? { x: scale, y: scale, z: scale } : scale;

        mcpLog(
          `place_geo: ${displayName} shape=${shapeVal} pos=(${position.x},${position.y},${position.z}) scale=(${scaleVec.x},${scaleVec.y},${scaleVec.z})`,
          'info'
        );

        // 1. Create NT_GEO_OBJECT + set primitive type
        const geoHandle = await createNodeRaw(client, MUGSHOT_TYPES.GEO_OBJECT);
        client.sceneCache.addNode(
          geoHandle,
          displayName,
          'NT_GEO_OBJECT',
          MUGSHOT_TYPES.GEO_OBJECT
        );
        const enumChild = await getConnectedChild(client, geoHandle, 0);
        if (enumChild) await setAttrRaw(client, enumChild, AttributeId.A_VALUE, 3, shapeVal);

        // 2. Set transform (pin 3 child)
        const xformHandle = await getConnectedChild(client, geoHandle, 3);
        if (!xformHandle) {
          mcpLog(`place_geo: WARNING — no transform child on pin 3`, 'warn');
        } else {
          await setAttrRaw(client, xformHandle, AttributeId.A_TRANSLATION, 11, position);
          await setAttrRaw(client, xformHandle, AttributeId.A_SCALE, 11, scaleVec);
          if (rotation.x !== 0 || rotation.y !== 0 || rotation.z !== 0) {
            await setAttrRaw(client, xformHandle, AttributeId.A_ROTATION, 11, rotation);
          }
        }

        // 3. Material (optional)
        let matHandle = 0;
        if (material) {
          matHandle =
            extractHandle(
              await client.callMethod('ApiNode', 'create', {
                type: NodeTypeId.NT_MAT_UNIVERSAL,
                ownerGraph: {
                  handle: String(await client.getRootNodeGraph()),
                  type: OBJ_API_NODE_GRAPH,
                },
                configurePins: true,
              })
            ) ?? 0;
          if (matHandle) {
            client.sceneCache.addNode(matHandle, `${displayName}_mat`, 'NT_MAT_UNIVERSAL', 130);
            if (material.albedo) {
              const c = await getConnectedChild(client, matHandle, MAT_PIN.ALBEDO);
              if (c) await setAttrRaw(client, c, AttributeId.A_VALUE, 11, material.albedo);
            }
            if (material.roughness !== undefined) {
              const c = await getConnectedChild(client, matHandle, MAT_PIN.ROUGHNESS);
              if (c) await setAttrRaw(client, c, AttributeId.A_VALUE, 9, material.roughness);
            }
            if (material.metallic !== undefined) {
              const c = await getConnectedChild(client, matHandle, MAT_PIN.METALLIC);
              if (c) await setAttrRaw(client, c, AttributeId.A_VALUE, 9, material.metallic);
            }
            await connectRaw(client, geoHandle, matHandle, 1);
          }
        }

        // 4. Wire to geo group
        const { geoGroup, rtHandle } = await findOrCreateGeoGroup(geo_group_handle);
        const actualPin = await wireToGeoGroup(geoHandle, geoGroup);

        mcpLog(`place_geo: ${displayName} attached at geo group pin ${actualPin}`, 'info');

        // 5. Register in placement state
        if (placementState) {
          try {
            placementState.addEntry({
              handle: geoHandle,
              name: displayName,
              role: (role as any) || 'prop',
              position,
              rotation,
              scale: scaleVec,
              boundsWorld: computeWorldAABB(
                { x: -0.5, y: -0.5, z: -0.5 },
                { x: 0.5, y: 0.5, z: 0.5 },
                position,
                rotation,
                scaleVec
              ),
            });
            mcpLog(`place_geo: registered "${displayName}" as ${role}`, 'info');
          } catch (regErr: any) {
            mcpLog(`place_geo: register warning: ${regErr.message}`, 'warn');
          }
        }

        return jsonResult({
          success: true,
          name: displayName,
          handles: {
            geo: geoHandle,
            transform: xformHandle || undefined,
            material: matHandle || undefined,
            geo_group: geoGroup,
            render_target: rtHandle || undefined,
          },
          shape: shapeVal,
          applied_transform: { position, rotation, scale: scaleVec },
          geo_group_pin: actualPin,
          auto_registered: !!placementState,
          instruction: `"${displayName}" placed. Use fit_camera(framing_mode:"subjects") then save_render to verify.`,
        });
      } catch (error: any) {
        mcpLog(`place_geo FAILED: ${error.message}`, 'error');
        return errorResult(error);
      }
    }
  );

  // ── apply_material ──────────────────────────────────────────────

  server.registerTool(
    'apply_material',
    {
      title: 'Apply Material',
      description:
        '[AD Phase 2] Apply a PBR material recipe to an existing material node in one call. ' +
        'Pass values from suggest_material. Set skip_albedo:true if mesh has .mtl textures.',
      inputSchema: {
        material_handle: z.number().int().nonnegative().describe('Handle of NT_MAT_UNIVERSAL node'),
        albedo: z
          .object({ x: z.number(), y: z.number(), z: z.number() })
          .optional()
          .describe('Albedo RGB (0-1). Skipped if skip_albedo is true.'),
        roughness: z.number().min(0).max(1).optional().describe('Roughness 0-1'),
        metallic: z.number().min(0).max(1).optional().describe('Metallic 0-1'),
        specular: z.number().min(0).max(1).optional().describe('Specular 0-1'),
        ior: z.number().optional().describe('Dielectric IOR (e.g. 1.5 for glass)'),
        skip_albedo: z
          .boolean()
          .optional()
          .default(false)
          .describe('Skip albedo (true when mesh has .mtl textures)'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ material_handle, albedo, roughness, metallic, specular, ior, skip_albedo }) => {
      try {
        const applied: string[] = [];
        const failed: string[] = [];

        async function applyPin(
          pinIdx: number,
          name: string,
          attrType: number,
          value: any
        ): Promise<void> {
          try {
            const child = await getConnectedChild(client, material_handle, pinIdx);
            if (!child) {
              failed.push(`${name}: no child node at pin ${pinIdx}`);
              return;
            }
            await setAttrRaw(client, child, AttributeId.A_VALUE, attrType, value);
            applied.push(name);
          } catch (e: any) {
            failed.push(`${name}: ${e.message}`);
          }
        }

        if (albedo && !skip_albedo) {
          await applyPin(MAT_PIN.ALBEDO, 'albedo', 11, albedo); // AT_FLOAT3
        }
        if (roughness !== undefined) {
          await applyPin(MAT_PIN.ROUGHNESS, 'roughness', 9, roughness); // AT_FLOAT
        }
        if (metallic !== undefined) {
          await applyPin(MAT_PIN.METALLIC, 'metallic', 9, metallic);
        }
        if (specular !== undefined) {
          await applyPin(MAT_PIN.SPECULAR, 'specular', 9, specular);
        }
        if (ior !== undefined) {
          await applyPin(MAT_PIN.IOR, 'ior', 9, ior);
        }

        // Flush all changes at once
        await client.callMethod('ApiChangeManager', 'update', {});

        return jsonResult({
          success: failed.length === 0,
          material_handle,
          applied,
          failed: failed.length > 0 ? failed : undefined,
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
