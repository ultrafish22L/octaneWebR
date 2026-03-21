/**
 * Shared Octane Protocol Constants
 *
 * Single source of truth for protocol-level enums used by both
 * client/src and mcp/src. Values come from .proto files and are immutable.
 *
 * Import path from client: '../../../shared/OctaneConstants'
 * Import path from MCP:    '../../shared/OctaneConstants'
 */

// ─── AttrType — attribute value types ────────────────────────────────────────

export const AttrType = {
  AT_UNKNOWN: 0,
  AT_BOOL: 1,
  AT_BYTE: 2,
  AT_INT: 3,
  AT_INT2: 4,
  AT_INT3: 5,
  AT_INT4: 6,
  AT_LONG: 7,
  AT_LONG2: 8,
  AT_FLOAT: 9,
  AT_FLOAT2: 90, // Note: 90 not 10 — verified in common.proto
  AT_FLOAT3: 11,
  AT_FLOAT4: 12,
  AT_MATRIX: 13,
  AT_STRING: 14,
} as const;

export type AttrTypeValue = (typeof AttrType)[keyof typeof AttrType];

// ─── AttributeId — well-known attribute IDs ──────────────────────────────────

export const AttributeId = {
  A_VALUE: 185,
  A_FILENAME: 34,
  A_VERTICES_PER_POLY: 189,
  A_POLY_OBJECT_INDICES: 116,
  A_PIN_COUNT: 113,
  A_RELOAD: 124,
  A_INPUT_ACTION: 128,
  A_ROTATION_ORDER: 136,
  A_ROTATION: 137,
  A_SCALE: 139,
  A_TRANSLATION: 172,
} as const;

export type AttributeIdValue = (typeof AttributeId)[keyof typeof AttributeId];

// ─── ObjectType — gRPC objectPtr type enum ───────────────────────────────────

export const OBJ_API_ITEM = 16;
export const OBJ_API_NODE = 17;
export const OBJ_API_NODE_GRAPH = 20;
export const OBJ_API_ITEM_ARRAY = 31;

// ─── Crash-prone type IDs — never use with create_node or nodeInfo ───────────

export const CRASH_TYPE_IDS = new Set([
  0, 116, 408, 40000, 50000, 50106, 50107, 50108, 50136, 50137,
]);

// ─── NodeTypeId — well-known node type IDs ───────────────────────────────────

export const NodeTypeId = {
  NT_GEO_MESH: 1,
  NT_GEO_PLACEMENT: 4,
  NT_TEX_IMAGE: 34,
  NT_RENDERTARGET: 113,
  NT_MAT_UNIVERSAL: 130,
} as const;

// ─── Pin type names — NodePinType enum → human-readable ──────────────────────

export const PIN_TYPE_NAMES: Record<number, string> = {
  0: 'PT_UNKNOWN',
  1: 'PT_BOOL',
  2: 'PT_FLOAT',
  3: 'PT_INT',
  4: 'PT_TRANSFORM',
  5: 'PT_TEXTURE',
  6: 'PT_EMISSION',
  7: 'PT_MATERIAL',
  8: 'PT_CAMERA',
  9: 'PT_ENVIRONMENT',
  10: 'PT_IMAGER',
  11: 'PT_KERNEL',
  12: 'PT_GEOMETRY',
  13: 'PT_MEDIUM',
  14: 'PT_PHASEFUNCTION',
  15: 'PT_FILM_SETTINGS',
  16: 'PT_ENUM',
  17: 'PT_OBJECTLAYER',
  18: 'PT_POSTPROCESSING',
  19: 'PT_RENDERTARGET',
  20: 'PT_WORK_PANE',
  21: 'PT_PROJECTION',
  22: 'PT_DISPLACEMENT',
  23: 'PT_STRING',
  24: 'PT_RENDER_PASSES',
  25: 'PT_RENDER_LAYER',
  26: 'PT_VOLUME_RAMP',
  27: 'PT_ANIMATION_SETTINGS',
  28: 'PT_LUT',
  29: 'PT_RENDER_JOB',
  30: 'PT_TOON_RAMP',
  31: 'PT_BIT_MASK',
  32: 'PT_ROUND_EDGES',
  33: 'PT_MATERIAL_LAYER',
  34: 'PT_OCIO_VIEW',
  35: 'PT_OCIO_LOOK',
  36: 'PT_OCIO_COLOR_SPACE',
  37: 'PT_OUTPUT_AOV_GROUP',
  38: 'PT_OUTPUT_AOV',
  39: 'PT_TEX_COMPOSITE_LAYER',
  40: 'PT_OUTPUT_AOV_LAYER',
  44: 'PT_BLENDING_SETTINGS',
  45: 'PT_POST_VOLUME',
  46: 'PT_TRACE_SET_VISIBILITY_RULE_GROUP',
  47: 'PT_TRACE_SET_VISIBILITY_RULE',
};

// ─── RenderPriority — GPU render priority ────────────────────────────────────

export const RenderPriority = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
} as const;

export type RenderPriorityValue = (typeof RenderPriority)[keyof typeof RenderPriority];

// ─── ClayMode — diffuse-only rendering mode ──────────────────────────────────

export const ClayMode = {
  NONE: 0,
  GREY: 1,
  COLOR: 2,
} as const;

export type ClayModeValue = (typeof ClayMode)[keyof typeof ClayMode];

// ─── SubSampleMode — viewport sub-sampling for performance ───────────────────

export const SubSampleMode = {
  NONE: 0,
  '2x2': 1,
  '4x4': 2,
  '8x8': 3,
} as const;

// ─── RenderPassId — well-known render pass IDs ──────────────────────────────

export const RenderPassId = {
  BEAUTY: 0,
  EMIT: 1,
  ENVIRONMENT: 2,
  DIFFUSE: 3,
  DIFFUSE_DIRECT: 4,
  DIFFUSE_INDIRECT: 5,
  DIFFUSE_FILTER: 6,
  REFLECTION: 7,
  REFLECTION_DIRECT: 8,
  REFLECTION_INDIRECT: 9,
  REFLECTION_FILTER: 10,
  REFRACTION: 11,
  REFRACTION_FILTER: 12,
  TRANSMISSION_FILTER: 13,
  SUBSURFACE_SCATTERING: 14,
  SHADOW: 16,
  IRRADIANCE: 17,
  LIGHT_DIRECTION: 18,
  AMBIENT_OCCLUSION: 19,
  VOLUME: 21,
  VOLUME_MASK: 22,
  VOLUME_Z_DEPTH_FRONT: 23,
  VOLUME_Z_DEPTH_BACK: 24,
  NOISE: 25,
  DENOISER_BEAUTY: 26,
  // Info passes (1000+)
  GEOMETRIC_NORMAL: 1000,
  SHADING_NORMAL: 1001,
  POSITION: 1002,
  Z_DEPTH: 1003,
  MATERIAL_ID: 1004,
  UV_COORD: 1005,
  TANGENT_NORMAL: 1006,
  WIREFRAME: 1007,
  OBJECT_LAYER_COLOR: 1008,
  BAKING_GROUP_ID: 1009,
  LIGHT_PASS_ID: 1010,
  RENDER_LAYER_ID: 1011,
  RENDER_LAYER_MASK: 1012,
  AMBIENT_LIGHT: 1013,
  SUNLIGHT: 1014,
  LIGHT_1: 1015,
  LIGHT_2: 1016,
  MOTION_VECTOR: 1030,
  OBJECT_ID: 1031,
  CRYPTO_MATERIAL: 1050,
  CRYPTO_OBJECT: 1051,
  // Custom passes (501-520)
  CUSTOM_1: 501,
  CUSTOM_2: 502,
  CUSTOM_3: 503,
  CUSTOM_4: 504,
  CUSTOM_5: 505,
  // Global texture passes (1101-1119)
  GLOBAL_TEX_1: 1101,
  GLOBAL_TEX_2: 1102,
  GLOBAL_TEX_3: 1103,
} as const;

export type RenderPassIdValue = (typeof RenderPassId)[keyof typeof RenderPassId];

// ─── ImageSaveFormat — render output formats ─────────────────────────────────

export const ImageSaveFormat = {
  PNG: 0,
  PNG16: 1,
  EXR: 2,
  EXR_TONEMAP: 3,
  TGA: 4,
  HDR: 10,
  TIFF: 11,
  TIFF16: 12,
  JPG: 13,
} as const;

// ─── RT pin layout — well-known render target pin indices ────────────────────

export const RT_PINS = {
  CAMERA: 0,
  ENVIRONMENT: 1,
  GEOMETRY: 3,
  FILM: 4,
  KERNEL: 6,
} as const;
