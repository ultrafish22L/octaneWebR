/**
 * Octane Node Type Display Data
 *
 * Icon mappings and display functions for Octane node types.
 * Node type data (names, categories, colors, IDs) comes from OctaneCacheService
 * at runtime — no hardcoded hierarchy needed.
 */

import { octaneCacheService } from '../services/OctaneCacheService';

export interface NodeTypeInfo {
  name: string;
  color: string;
}

export interface NodeTypeCategory {
  [nodeType: string]: NodeTypeInfo;
}

export interface NodeTypeHierarchy {
  [category: string]: NodeTypeCategory;
}

// ─── Category Display Order ─────────────────────────────────────────────────

/**
 * Predefined category display order for the context menu.
 * '___SEPARATOR___' indicates a visual separator line.
 */
export const CATEGORY_ORDER: string[] = [
  'Cameras',
  'Displacement',
  'Emission',
  'Environments',
  'Geometry',
  'Input',
  'Kernels',
  'Lights',
  'Material layers',
  'Materials',
  'Medium',
  'Other',
  'Output',
  'Output AOVs',
  'Projection',
  'Render AOVs',
  'Render job',
  'Render settings',
  'Round edges',
  'Texture layers',
  'Textures',
  'Transforms',
  'Values',
  '___SEPARATOR___',
  'Node graph',
  'Render target',
];

// ─── Cache-Delegating Functions ─────────────────────────────────────────────

/**
 * Get categories in display order (with separators)
 */
export function getCategoriesInOrder(): string[] {
  return CATEGORY_ORDER;
}

/**
 * Get all categories from cache
 */
export function getNodeCategories(): string[] {
  const hierarchy = octaneCacheService.getNodeTypeHierarchy();
  return hierarchy ? Object.keys(hierarchy) : [];
}

/**
 * Get node types for a specific category (from cache)
 */
export function getNodeTypesForCategory(category: string): NodeTypeCategory | undefined {
  const hierarchy = octaneCacheService.getNodeTypeHierarchy();
  return hierarchy?.[category];
}

/**
 * Get node type info from cache.
 */
export function getNodeTypeInfo(nodeType: string): NodeTypeInfo | undefined {
  const cached = octaneCacheService.getNodeTypeInfo(nodeType);
  if (cached) return { name: cached.name, color: cached.color };
  return undefined;
}

/**
 * Get all node types as a flat list (from cache)
 */
export function getAllNodeTypes(): string[] {
  return octaneCacheService.getAllNodeTypes() || [];
}

// ─── Icon Mapping ───────────────────────────────────────────────────────────

export interface IconMapping {
  [nodeType: string]: string;
}

/**
 * Complete mapping of NT_ node types to icon filenames.
 * Icons are extracted from the actual Octane UI and named descriptively.
 */
export const nodeIconMapping: IconMapping = {
  // Cameras — all use CAMERA node.png (only universal icon exists)
  NT_CAM_BAKING: 'CAMERA node.png',
  NT_CAM_OSL: 'CAMERA node.png',
  NT_CAM_OSL_BAKING: 'CAMERA node.png',
  NT_CAM_PANORAMIC: 'CAMERA node.png',
  NT_CAM_SIMULATED_LENS: 'CAMERA node.png',
  NT_CAM_THINLENS: 'CAMERA node.png',
  NT_CAM_UNIVERSAL: 'CAMERA node.png',

  // Displacement
  NT_DISPLACEMENT: 'displacement_node.png',
  NT_VERTEX_DISPLACEMENT: 'displacement_node.png',
  NT_VERTEX_DISPLACEMENT_MIXER: 'displacement_node.png',

  // Emission
  NT_EMIS_BLACKBODY: 'EMITTER_BBODY node.png',
  NT_EMIS_NULL: 'EMITTER_NULL node.png',
  NT_EMIS_TEXTURE: 'EMITTER_TEXTURE node.png',

  // Environments
  NT_ENV_DAYLIGHT: 'ENVIRONMENT node.png',
  NT_ENV_PLANETARY: 'ENVIRONMENT node.png',
  NT_ENV_TEXTURE: 'ENVIRONMENT node.png',

  // Geometry - Basic
  NT_GEO_DECAL: 'MESH node.png',
  NT_GEO_EXPORTER: 'MESH node.png',
  NT_GEO_GAUSSIAN_SPLAT: 'MESH node.png',
  NT_GEO_GROUP: 'MESH node.png',
  NT_GEO_JOINT: 'JOINT node.png',
  NT_GEO_MESH: 'MESH node.png',
  NT_GEO_MESH_VOLUME: 'MESH node.png',
  NT_GEO_MESH_VOLUME_SDF: 'MESH node.png',
  NT_GEO_OBJECT: 'scene_node.png',
  NT_GEO_OSL: 'MESH node.png',
  NT_GEO_PLACEMENT: 'MESH node.png',
  NT_GEO_PLANE: 'MESH PLANE node.png',
  NT_GEO_SCATTER: 'MESH SCATTER node.png',

  // Geometry - SDF (all use sdf_node.png)
  NT_GEO_SDF_ARRAY_CIRCULAR: 'sdf_node.png',
  NT_GEO_SDF_ARRAY_LINEAR: 'sdf_node.png',
  NT_GEO_SDF_AVOID: 'sdf_node.png',
  NT_GEO_SDF_BOX: 'sdf_node.png',
  NT_GEO_SDF_CAPSULE: 'sdf_node.png',
  NT_GEO_SDF_CLIP: 'sdf_node.png',
  NT_GEO_SDF_CONE: 'sdf_node.png',
  NT_GEO_SDF_CYLINDER: 'sdf_node.png',
  NT_GEO_SDF_DISPLACEMENT: 'sdf_node.png',
  NT_GEO_SDF_DOMAIN: 'sdf_node.png',
  NT_GEO_SDF_INK: 'sdf_node.png',
  NT_GEO_SDF_INSET: 'sdf_node.png',
  NT_GEO_SDF_INTERSECT: 'sdf_node.png',
  NT_GEO_SDF_MIRROR: 'sdf_node.png',
  NT_GEO_SDF_OFFSET: 'sdf_node.png',
  NT_GEO_SDF_PRISM: 'sdf_node.png',
  NT_GEO_SDF_PULL: 'sdf_node.png',
  NT_GEO_SDF_PUSH: 'sdf_node.png',
  NT_GEO_SDF_REPEL: 'sdf_node.png',
  NT_GEO_SDF_SPHERE: 'sdf_node.png',
  NT_GEO_SDF_SUBTRACT: 'sdf_node.png',
  NT_GEO_SDF_TORUS: 'sdf_node.png',
  NT_GEO_SDF_TUBE: 'sdf_node.png',
  NT_GEO_SDF_UNION: 'sdf_node.png',

  // Geometry - Volume
  NT_GEO_UNIT_VOLUME: 'VOLUME node.png',
  NT_GEO_VOLUME: 'VOLUME node.png',
  NT_GEO_VOLUME_SDF: 'VOLUME node.png',
  NT_SCATTER_SURFACE: 'MESH SCATTER node.png',
  NT_SCATTER_VOLUME: 'MESH SCATTER node.png',

  // Input - Basic Types
  NT_BOOL: 'VALUE BOOL node.png',
  NT_BOOL_LOGIC_OPERATOR: 'VALUE BOOL node.png',
  NT_DIRECTORY: 'VALUE STRING node.png',
  NT_ENUM: 'VALUE INT node.png',
  NT_FILE: 'VALUE STRING node.png',
  NT_FLOAT: 'VALUE FLOAT node.png',
  NT_FLOAT_COMPONENT_MERGER: 'TEXTURE_MATH_node.png',
  NT_FLOAT_COMPONENT_PICKER: 'TEXTURE_MATH_node.png',
  NT_FLOAT_IF: 'TEXTURE_MATH_node.png',
  NT_FLOAT_MATH_BINARY: 'TEXTURE_MATH_node.png',
  NT_FLOAT_MATH_UNARY: 'TEXTURE_MATH_node.png',
  NT_FLOAT_RANGE: 'TEXTURE_MATH_node.png',
  NT_FLOAT_RELATIONAL_OPERATOR: 'TEXTURE_MATH_node.png',
  NT_FLOAT_TIME: 'TEXTURE_MATH_node.png',
  NT_FLOAT_TO_INT: 'TEXTURE_MATH_node.png',
  NT_INT: 'VALUE INT node.png',
  NT_INT_COMPONENT_MERGER: 'TEXTURE_MATH_node.png',
  NT_INT_COMPONENT_PICKER: 'TEXTURE_MATH_node.png',
  NT_INT_FRAME_INDEX: 'TEXTURE_MATH_node.png',
  NT_INT_IF: 'TEXTURE_MATH_node.png',
  NT_INT_RELATIONAL_OPERATOR: 'TEXTURE_MATH_node.png',
  NT_INT_TO_FLOAT: 'TEXTURE_MATH_node.png',
  NT_STRING: 'VALUE STRING node.png',

  // Kernels
  NT_KERN_DIRECTLIGHTING: 'RENDER KERNEL node.png',
  NT_KERN_INFO: 'RENDER INFO KERNEL node.png',
  NT_KERN_MATPREVIEW: 'RENDER KERNEL node.png',
  NT_KERN_PATHTRACING: 'RENDER KERNEL node.png',
  NT_KERN_PHOTONTRACING: 'RENDER KERNEL node.png',
  NT_KERN_PMC: 'RENDER KERNEL node.png',

  // Lights (all use EMITTER_BBODY as category fallback)
  NT_LIGHT_ANALYTIC: 'EMITTER_BBODY node.png',
  NT_LIGHT_ANALYTIC_INTERNAL: 'EMITTER_BBODY node.png',
  NT_LIGHT_DIRECTIONAL: 'EMITTER_BBODY node.png',
  NT_LIGHT_QUAD: 'EMITTER_BBODY node.png',
  NT_LIGHT_SPHERE: 'EMITTER_BBODY node.png',
  NT_LIGHT_VOLUME_SPOT: 'EMITTER_BBODY node.png',
  NT_TOON_DIRECTIONAL_LIGHT: 'EMITTER_BBODY node.png',
  NT_TOON_POINT_LIGHT: 'EMITTER_BBODY node.png',

  // Material Layers (use MATERIAL_MIX as category fallback)
  NT_MAT_COMPOSITE: 'MATERIAL_MIX node.png',
  NT_MAT_DIFFUSE_LAYER: 'MATERIAL_MIX node.png',
  NT_MAT_LAYER: 'MATERIAL_MIX node.png',
  NT_MAT_LAYER_GROUP: 'MATERIAL_MIX node.png',
  NT_MAT_METALLIC_LAYER: 'MATERIAL_MIX node.png',
  NT_MAT_SHEEN_LAYER: 'MATERIAL_MIX node.png',
  NT_MAT_SPECULAR_LAYER: 'MATERIAL_MIX node.png',

  // Materials
  NT_MAT_CLIPPING: 'MATERIAL_TRANSPARENT node.png',
  NT_MAT_DIFFUSE: 'MATERIAL_DIFFUSE node.png',
  NT_MAT_GLOSSY: 'MATERIAL_GLOSSY node.png',
  NT_MAT_HAIR: 'MATERIAL_TRANSPARENT node.png',
  NT_MAT_METAL: 'MATERIAL_METAL node.png',
  NT_MAT_MIX: 'MATERIAL_MIX node.png',
  NT_MAT_NULL: 'MATERIAL_TRANSPARENT node.png',
  NT_MAT_OSL: 'SCRIPTED node.png',
  NT_MAT_PORTAL: 'PORTAL node.png',
  NT_MAT_SHADOW_CATCHER: 'MATERIAL_TRANSPARENT node.png',
  NT_MAT_SPECULAR: 'MATERIAL_TRANSPARENT node.png',
  NT_MAT_TOON: 'MATERIAL_TOON node.png',
  NT_MAT_UNIVERSAL: 'MATERIAL_TRANSPARENT node.png',

  // Medium
  NT_MED_ABSORPTION: 'ABSORPTION_MEDIUM node.png',
  NT_MED_SCATTERING: 'SCATTERING_MEDIUM node.png',

  // Imagers and Post Processing
  NT_IMAGER: 'IMAGER node.png',
  NT_POSTPROCESSING: 'POSTPROC node.png',
  NT_POST_VOLUME: 'POSTPROC node.png',

  // Projection (all use TRANSFORM as category fallback)
  NT_PROJ_BOX: 'TRANSFORM node.png',
  NT_PROJ_CYLINDRICAL: 'TRANSFORM node.png',
  NT_PROJ_LINEAR: 'TRANSFORM node.png',
  NT_PROJ_OSL: 'TRANSFORM node.png',
  NT_PROJ_PERSPECTIVE: 'TRANSFORM node.png',
  NT_PROJ_SPHERICAL: 'TRANSFORM node.png',
  NT_PROJ_TRIPLANAR: 'TRANSFORM node.png',
  NT_PROJ_UVW: 'TRANSFORM node.png',
  NT_PROJ_XYZ: 'TRANSFORM node.png',

  // Textures - Basic
  NT_TEX_ADD: 'TEXTURE_ADD node.png',
  NT_TEX_ALPHAIMAGE: 'TEXTURE_ALPHA node.png',
  NT_TEX_ATTRIBUTE: 'TEXTURE_ATTRIBUTE node.png',
  NT_TEX_BAKED_IMAGE: 'TEXTURE_BITMAP node.png',
  NT_TEX_CHECKS: 'TEXTURE_CHECKER node.png',
  NT_TEX_CLAMP: 'TEXTURE_PATTERN node.png',
  NT_TEX_COMPARE: 'TEXTURE_COMPARE node.png',
  NT_TEX_CURVATURE: 'TEXTURE_PATTERN node.png',
  NT_TEX_DIRT: 'TEXTURE_PROCEDURAL node.png',
  NT_TEX_FALLOFF: 'TEXTURE_PATTERN node.png',
  NT_TEX_FLOAT: 'TEXTURE_SPECTRUM B&W node.png',
  NT_TEX_FLOATIMAGE: 'TEXTURE_BITMAP B&W node.png',
  NT_TEX_GRADIENT: 'TEXTURE_GRADIENT node.png',
  NT_TEX_IMAGE: 'TEXTURE_BITMAP node.png',
  NT_TEX_IMAGE_TILES: 'TEXTURE_IMGTILES node.png',
  NT_TEX_IMAGE_TILE_SET: 'TEXTURE_IMGTILES node.png',
  NT_TEX_INVERT: 'TEXTURE_PATTERN node.png',
  NT_TEX_MARBLE: 'TEXTURE_PROCEDURAL node.png',
  NT_TEX_MIX: 'TEXTURE_MIX node.png',
  NT_TEX_MULTIPLY: 'TEXTURE_MUL node.png',
  NT_TEX_NOISE: 'TEXTURE_PROCEDURAL node.png',
  NT_TEX_OSL: 'TEXTURE_OSL node.png',
  NT_TEX_RGB: 'TEXTURE_SPECTRUM node.png',
  NT_TEX_SIDE: 'TEXTURE_PATTERN node.png',
  NT_TEX_SUBTRACT: 'TEXTURE_SUB node.png',
  NT_TEX_TRIPLANAR: 'TEXTURE_BITMAP node.png',
  NT_TEX_TURBULENCE: 'TEXTURE_PROCEDURAL node.png',

  // Transforms
  NT_TRANSFORM_2D: 'TRANSFORM node.png',
  NT_TRANSFORM_3D: 'TRANSFORM node.png',
  NT_TRANSFORM_ROTATION: 'TRANSFORM node.png',
  NT_TRANSFORM_SCALE: 'TRANSFORM node.png',
  NT_TRANSFORM_VALUE: 'TRANSFORM node.png',

  // Render Target
  NT_RENDERTARGET: 'RENDER TARGET node.png',

  // Output and Render
  NT_RENDER_AOV_GROUP: 'aov-output-group.png',
  NT_RENDER_LAYER: 'render_layer.png',
  NT_RENDER_PASSES: 'render_layer.png',

  // Output AOVs
  NT_OUT_EMISSION: 'aov-output-group.png',
  NT_OUT_OCIO_COLOR_SPACE: 'OCIO_COLOR_SPACE_node.png',
  NT_OUT_OCIO_LOOK: 'OCIO_LOOK_node.png',
  NT_OUT_OCIO_VIEW: 'OCIO_VIEW_node.png',
  NT_OUTPUT_AOV: 'aov-output-group.png',
  NT_OUTPUT_AOV_GROUP: 'aov-output-group.png',
  NT_OUTPUT_AOV_LAYER: 'aov-output-group.png',

  // Render Jobs
  NT_RENDER_JOB: 'RENDER JOB node.png',
  NT_RENDER_JOB_FRAME: 'RENDER JOB node.png',

  // Film and Settings
  NT_FILM_SETTINGS: 'FILM node.png',
  NT_IMAGE_RESOLUTION: 'FILM node.png',

  // Animation and Settings
  NT_ANIMATION_SETTINGS: 'animation_settings_node.png',

  // Blending Settings
  NT_BLENDING_SETTINGS: 'blending_settings_node.png',

  // Round Edges
  NT_ROUND_EDGES: 'ROUND_EDGES node.png',

  // Trace Sets
  NT_TRACE_SET_VISIBILITY_RULE: 'trace_set_visibility_rule_node.png',
  NT_TRACE_SET_VISIBILITY_RULE_GROUP: 'trace_set_visibility_rule_group_node.png',

  // Object Layers
  NT_OBJECTLAYER: 'OBJECTLAYER_node.png',

  // Phase Functions
  NT_PHASE_SCHLICK: 'SCHLICK_PHASE_FUNCTION node.png',

  // Toon and Volume Ramps
  NT_TOON_RAMP: 'MATERIAL_TOON node.png',
  NT_VOLUME_RAMP: 'VOLUME node.png',

  // LUT
  NT_LUT_CUSTOM: 'OCIO_LOOK_node.png',

  // Sun Direction
  NT_SUN_DIRECTION: 'ENVIRONMENT node.png',

  // Gaussian Splatting
  NT_GS: 'gs_node.png',

  // Macro
  NT_MACRO: 'MACRO node.png',
  NT_MACRO_MASK: 'MACRO_MASK node.png',

  // Linker Mask
  NT_LINKER_MASK: 'LINKER_MASK node.png',

  // Switch Mask
  NT_SWITCH_MASK: 'switch-mask-node.png',

  // Annotation
  NT_ANNOTATION: 'ANNOTATION node.png',

  // In nodes — use matching category icons
  NT_IN_ANIMATION_SETTINGS: 'animation_settings_node.png',
  NT_IN_BIT_MASK: 'VALUE INT node.png',
  NT_IN_BLENDING_SETTINGS: 'blending_settings_node.png',
  NT_IN_BOOL: 'VALUE BOOL node.png',
  NT_IN_CAMERA: 'CAMERA node.png',
  NT_IN_DISPLACEMENT: 'displacement_node.png',
  NT_IN_EMISSION: 'EMITTER_TEXTURE node.png',
  NT_IN_ENUM: 'VALUE INT node.png',
  NT_IN_ENVIRONMENT: 'ENVIRONMENT node.png',
  NT_IN_FILM_SETTINGS: 'FILM node.png',
  NT_IN_FLOAT: 'VALUE FLOAT node.png',
  NT_IN_GEOMETRY: 'MESH node.png',
  NT_IN_IMAGER: 'IMAGER node.png',
  NT_IN_INT: 'VALUE INT node.png',
  NT_IN_KERNEL: 'RENDER KERNEL node.png',
  NT_IN_LUT: 'OCIO_LOOK_node.png',
  NT_IN_MATERIAL: 'MATERIAL_TRANSPARENT node.png',
  NT_IN_MATERIAL_LAYER: 'MATERIAL_MIX node.png',
  NT_IN_MEDIUM: 'SCATTERING_MEDIUM node.png',
  NT_IN_OBJECTLAYER: 'OBJECTLAYER_node.png',
  NT_IN_OCIO_COLOR_SPACE: 'OCIO_COLOR_SPACE_node.png',
  NT_IN_OCIO_LOOK: 'OCIO_LOOK_node.png',
  NT_IN_OCIO_VIEW: 'OCIO_VIEW_node.png',
  NT_IN_OFFSET: 'TRANSFORM node.png',
  NT_IN_OUTPUT_AOV: 'aov-output-group.png',
  NT_IN_OUTPUT_AOV_GROUP: 'aov-output-group.png',
  NT_IN_OUTPUT_AOV_LAYER: 'aov-output-group.png',
  NT_IN_PHASEFUNCTION: 'SCHLICK_PHASE_FUNCTION node.png',
  NT_IN_POSTPROCESSING: 'POSTPROC node.png',
  NT_IN_POST_VOLUME: 'POSTPROC node.png',
  NT_IN_PROJECTION: 'TRANSFORM node.png',
  NT_IN_RENDERTARGET: 'RENDER TARGET node.png',
  NT_IN_RENDER_JOB: 'RENDER JOB node.png',
  NT_IN_RENDER_LAYER: 'render_layer.png',
  NT_IN_RENDER_PASSES: 'render_layer.png',
  NT_IN_ROUND_EDGES: 'ROUND_EDGES node.png',
  NT_IN_STRING: 'VALUE STRING node.png',
  NT_IN_TEXTURE: 'TEXTURE_PATTERN node.png',
  NT_IN_TEX_COMPOSITE_LAYER: 'TEXTURE_MIX node.png',
  NT_IN_TOON_RAMP: 'MATERIAL_TOON node.png',
  NT_IN_TRACE_SET_VISIBILITY_RULE: 'trace_set_visibility_rule_node.png',
  NT_IN_TRACE_SET_VISIBILITY_RULE_GROUP: 'trace_set_visibility_rule_group_node.png',
  NT_IN_TRANSFORM: 'TRANSFORM node.png',
  NT_IN_VOLUME_RAMP: 'VOLUME node.png',

  // Switch nodes — use matching category icons
  NT_SWITCH_ANIMATION_SETTINGS: 'animation_settings_node.png',
  NT_SWITCH_BIT_MASK: 'VALUE INT node.png',
  NT_SWITCH_BLENDING_SETTINGS: 'blending_settings_node.png',
  NT_SWITCH_BOOL: 'VALUE BOOL node.png',
  NT_SWITCH_CAMERA: 'CAMERA node.png',
  NT_SWITCH_DISPLACEMENT: 'displacement_node.png',
  NT_SWITCH_EMISSION: 'EMITTER_TEXTURE node.png',
  NT_SWITCH_ENUM: 'VALUE INT node.png',
  NT_SWITCH_ENVIRONMENT: 'ENVIRONMENT node.png',
  NT_SWITCH_FILM_SETTINGS: 'FILM node.png',
  NT_SWITCH_FLOAT: 'VALUE FLOAT node.png',
  NT_SWITCH_GEOMETRY: 'MESH node.png',
  NT_SWITCH_IMAGER: 'IMAGER node.png',
  NT_SWITCH_INT: 'VALUE INT node.png',
  NT_SWITCH_INTERNAL: 'TEXTURE_PATTERN node.png',
  NT_SWITCH_KERNEL: 'RENDER KERNEL node.png',
  NT_SWITCH_LUT: 'OCIO_LOOK_node.png',
  NT_SWITCH_MATERIAL: 'MATERIAL_TRANSPARENT node.png',
  NT_SWITCH_MATERIAL_LAYER: 'MATERIAL_MIX node.png',
  NT_SWITCH_MEDIUM: 'SCATTERING_MEDIUM node.png',
  NT_SWITCH_OBJECTLAYER: 'OBJECTLAYER_node.png',
  NT_SWITCH_OCIO_COLOR_SPACE: 'OCIO_COLOR_SPACE_node.png',
  NT_SWITCH_OCIO_LOOK: 'OCIO_LOOK_node.png',
  NT_SWITCH_OCIO_VIEW: 'OCIO_VIEW_node.png',
  NT_SWITCH_OFFSET: 'TRANSFORM node.png',
  NT_SWITCH_OUTPUT_AOV: 'aov-output-group.png',
  NT_SWITCH_OUTPUT_AOV_GROUP: 'aov-output-group.png',
  NT_SWITCH_OUTPUT_AOV_LAYER: 'aov-output-group.png',
  NT_SWITCH_PHASEFUNCTION: 'SCHLICK_PHASE_FUNCTION node.png',
  NT_SWITCH_POSTPROCESSING: 'POSTPROC node.png',
  NT_SWITCH_POST_VOLUME: 'POSTPROC node.png',
  NT_SWITCH_PROJECTION: 'TRANSFORM node.png',
  NT_SWITCH_RENDERTARGET: 'RENDER TARGET node.png',
  NT_SWITCH_RENDER_JOB: 'RENDER JOB node.png',
  NT_SWITCH_RENDER_LAYER: 'render_layer.png',
  NT_SWITCH_RENDER_PASSES: 'render_layer.png',
  NT_SWITCH_ROUND_EDGES: 'ROUND_EDGES node.png',
  NT_SWITCH_STRING: 'VALUE STRING node.png',
  NT_SWITCH_TEXTURE: 'TEXTURE_PATTERN node.png',
  NT_SWITCH_TEX_COMPOSITE_LAYER: 'TEXTURE_MIX node.png',
  NT_SWITCH_TOON_RAMP: 'MATERIAL_TOON node.png',
  NT_SWITCH_TRACE_SET_VISIBILITY_RULE: 'trace_set_visibility_rule_node.png',
  NT_SWITCH_TRACE_SET_VISIBILITY_RULE_GROUP: 'trace_set_visibility_rule_group_node.png',
  NT_SWITCH_TRANSFORM: 'TRANSFORM node.png',
  NT_SWITCH_VOLUME_RAMP: 'VOLUME node.png',
};

// ─── Category Icon Fallbacks ────────────────────────────────────────────────

/**
 * Category fallback icons for NT_ prefixes not in the explicit mapping.
 * Covers all 750+ node types without needing an entry for each one.
 * Ordered specific → general for longest-prefix-match.
 */
const CATEGORY_ICON_FALLBACKS: [string, string][] = [
  ['NT_MX_', 'MATERIALX_node.png'],
  ['NT_TEX_', 'TEXTURE_PATTERN node.png'],
  ['NT_MAT_', 'MATERIAL_TRANSPARENT node.png'],
  ['NT_CAM_', 'CAMERA node.png'],
  ['NT_ENV_', 'ENVIRONMENT node.png'],
  ['NT_KERN_', 'RENDER KERNEL node.png'],
  ['NT_GEO_SDF_', 'sdf_node.png'],
  ['NT_GEO_', 'MESH node.png'],
  ['NT_LIGHT_', 'EMITTER_BBODY node.png'],
  ['NT_EMIS_', 'EMITTER_TEXTURE node.png'],
  ['NT_MED_', 'SCATTERING_MEDIUM node.png'],
  ['NT_PROJ_', 'TRANSFORM node.png'],
  ['NT_TRANSFORM_', 'TRANSFORM node.png'],
  ['NT_TOON_', 'MATERIAL_TOON node.png'],
  ['NT_IN_', 'TEXTURE_PATTERN node.png'],
  ['NT_OUT_', 'aov-output-group.png'],
  ['NT_SWITCH_', 'TEXTURE_PATTERN node.png'],
  ['NT_OUTPUT_AOV', 'aov-output-group.png'],
  ['NT_AOV_', 'aov-output-group.png'],
  ['NT_RENDER_', 'render_layer.png'],
  ['NT_FLOAT_', 'VALUE FLOAT node.png'],
  ['NT_INT_', 'VALUE INT node.png'],
  ['NT_BOOL_', 'VALUE BOOL node.png'],
  ['NT_SCATTER_', 'MESH SCATTER node.png'],
  ['NT_DISPLACEMENT', 'displacement_node.png'],
  ['NT_VERTEX_DISPLACEMENT', 'displacement_node.png'],
  ['NT_POST', 'POSTPROC node.png'],
  ['NT_TRACE_SET_', 'trace_set_visibility_rule_node.png'],
  ['NT_BLENDING_', 'blending_settings_node.png'],
  ['NT_VOLUME_', 'VOLUME node.png'],
  ['NT_IMPORT_', 'MESH node.png'],
  ['NT_OCIO_', 'OCIO_COLOR_SPACE_node.png'],
  ['NT_BIT_', 'VALUE INT node.png'],
  ['NT_VEC_', 'VALUE FLOAT node.png'],
  ['NT_COMPOSITE_', 'TEXTURE_MIX node.png'],
  ['NT_MATERIALX_', 'MATERIALX_node.png'],
  ['NT_METADATA', 'FILM node.png'],
  ['NT_RNDR_', 'render_layer.png'],
  ['NT_PROGRAMMABLE_', 'SCRIPTED node.png'],
  ['NT_PROJECT_', 'scene_node.png'],
  ['NT_SPLIT_', 'TEXTURE_PATTERN node.png'],
  ['NT_WORK_', 'scene_node.png'],
  ['NT_LOCAL_', 'scene_node.png'],
];

// ─── Icon Functions ─────────────────────────────────────────────────────────

/**
 * Get icon path for a node type
 * @param nodeType NT_ enum string
 * @returns path to icon file
 */
export function getNodeIconPath(nodeType: string): string {
  // Exact match in explicit mapping
  if (hasIconMapping(nodeType)) {
    const iconFile = nodeIconMapping[nodeType];
    if (iconFile) {
      return `/icons/${iconFile}`;
    }
  }
  // Category prefix fallback — longest prefix match first (entries ordered specific→general)
  for (const [prefix, icon] of CATEGORY_ICON_FALLBACKS) {
    if (nodeType.startsWith(prefix)) {
      return `/icons/${icon}`;
    }
  }
  return '/icons/EMPTY.png';
}

/**
 * Check if a node type has an icon mapping
 */
export function hasIconMapping(nodeType: string): boolean {
  return nodeType in nodeIconMapping;
}
