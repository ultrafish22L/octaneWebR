/**
 * Octane Pin Type Definitions and Mappings
 * 
 * Defines all pin types (PT_*) with their icons, colors, and compatible node types.
 * This file provides the mapping needed for:
 * - Pin visualization in the node graph
 * - Node type dropdowns in the node inspector
 * - Color coding for pin connections
 */

import { hasIconMapping, getNodeIconPath } from './NodeTypes';

/**
 * Pin icon and color mapping for all PT_ types
 * Maps pin type to icon path and connection color
 * 
 * Colors are ported from Octane C++ source (JUCE float RGBA → hex RGB)
 * The 0.7 alpha from C++ is applied separately via CSS edge opacity
 */
export interface PinIconInfo {
  icon: string;
  color: string;
}

/**
 * Complete pin type definitions (all PT_ constants from octaneids.proto)
 * Similar to OCTANE_NODE_TYPES but without categories
 */
export interface PinTypeInfo {
  name: string;
  color: string;
  icon: string;
}

export const OCTANE_PIN_TYPES: Record<string, PinTypeInfo> = {
  'PT_UNKNOWN': { name: 'Unknown', color: '#FFFFFF', icon: '/icons/EMPTY.png' },
  'PT_BOOL': { name: 'Bool', color: '#DEA9D4', icon: '/icons/VALUE BOOL node.png' },
  'PT_FLOAT': { name: 'Float', color: '#80B3E6', icon: '/icons/VALUE FLOAT node.png' },
  'PT_INT': { name: 'Int', color: '#FFD52B', icon: '/icons/VALUE INT node.png' },
  'PT_TRANSFORM': { name: 'Transform', color: '#BFDEFF', icon: '/icons/TRANSFORM_IN node.png' },
  'PT_TEXTURE': { name: 'Texture', color: '#BFFFDE', icon: '/icons/TEXTURE_BITMAP node.png' },
  'PT_EMISSION': { name: 'Emission', color: '#FFD700', icon: '/icons/CATEGORY_EMITTER node.png' },
  'PT_MATERIAL': { name: 'Material', color: '#FFF2BD', icon: '/icons/CATEGORY_MATERIAL node.png' },
  'PT_CAMERA': { name: 'Camera', color: '#80FFFF', icon: '/icons/CAMERA node.png' },
  'PT_ENVIRONMENT': { name: 'Environment', color: '#8080FF', icon: '/icons/ENVIRONMENT node.png' },
  'PT_IMAGER': { name: 'Imager', color: '#80FF80', icon: '/icons/IMAGER node.png' },
  'PT_KERNEL': { name: 'Kernel', color: '#FFCC80', icon: '/icons/RENDER KERNEL node.png' },
  'PT_GEOMETRY': { name: 'Geometry', color: '#FFBDF2', icon: '/icons/MESH node.png' },
  'PT_MEDIUM': { name: 'Medium', color: '#FFF2BD', icon: '/icons/MEDIUM_SWITCH node.png' },
  'PT_PHASEFUNCTION': { name: 'Phase Function', color: '#8844FF', icon: '/icons/PHASEFUNCTION_SWITCH node.png' },
  'PT_FILM_SETTINGS': { name: 'Film Settings', color: '#888888', icon: '/icons/FILM node.png' },
  'PT_ENUM': { name: 'Enum', color: '#88FF44', icon: '/icons/VALUE INT node.png' },
  'PT_OBJECTLAYER': { name: 'Object Layer', color: '#44FF88', icon: '/icons/OBJECTLAYER_SWITCH node.png' },
  'PT_POSTPROCESSING': { name: 'Post Processing', color: '#FF4DFF', icon: '/icons/POSTPROC node.png' },
  'PT_RENDERTARGET': { name: 'Render Target', color: '#E6E6E6', icon: '/icons/RENDER TARGET node.png' },
  'PT_WORK_PANE': { name: 'Work Pane', color: '#666666', icon: '/icons/CATEGORY.png' },
  'PT_PROJECTION': { name: 'Projection', color: '#8888FF', icon: '/icons/PROJECTION_IN node.png' },
  'PT_DISPLACEMENT': { name: 'Displacement', color: '#FF6B35', icon: '/icons/DISPLACEMENT_SWITCH node.png' },
  'PT_STRING': { name: 'String', color: '#FFFF44', icon: '/icons/VALUE STRING node.png' },
  'PT_RENDER_PASSES': { name: 'Render Passes', color: '#8888FF', icon: '/icons/render_passes.png' },
  'PT_RENDER_LAYER': { name: 'Render Layer', color: '#E68000', icon: '/icons/render_layer.png' },
  'PT_VOLUME_RAMP': { name: 'Volume Ramp', color: '#44AAFF', icon: '/icons/VOLUME_RAMP_IN node.png' },
  'PT_ANIMATION_SETTINGS': { name: 'Animation Settings', color: '#FF4444', icon: '/icons/animation_settings_node.png' },
  'PT_LUT': { name: 'LUT', color: '#8844FF', icon: '/icons/LUT_SWITCH node.png' },
  'PT_RENDER_JOB': { name: 'Render Job', color: '#FF8888', icon: '/icons/RENDER_JOB_IN node.png' },
  'PT_TOON_RAMP': { name: 'Toon Ramp', color: '#FFAA44', icon: '/icons/TOON_RAMP_IN node.png' },
  'PT_BIT_MASK': { name: 'Bit Mask', color: '#888888', icon: '/icons/BITMASK_SWITCH node.png' },
  'PT_ROUND_EDGES': { name: 'Round Edges', color: '#FF44FF', icon: '/icons/ROUND_EDGES_IN node.png' },
  'PT_MATERIAL_LAYER': { name: 'Material Layer', color: '#FF8844', icon: '/icons/MATERIAL_LAYER_SWITCH node.png' },
  'PT_OCIO_VIEW': { name: 'OCIO View', color: '#FF88AA', icon: '/icons/OCIO_VIEW_SWITCH node.png' },
  'PT_OCIO_LOOK': { name: 'OCIO Look', color: '#88AAFF', icon: '/icons/OCIO_LOOK_SWITCH node.png' },
  'PT_OCIO_COLOR_SPACE': { name: 'OCIO Color Space', color: '#FFAA88', icon: '/icons/OCIO_COLOR_SPACE_SWITCH node.png' },
  'PT_OUTPUT_AOV_GROUP': { name: 'Output AOV Group', color: '#88FF88', icon: '/icons/aov-output-group.png' },
  'PT_OUTPUT_AOV': { name: 'Output AOV', color: '#88FFFF', icon: '/icons/OUTPUT_AOV_SWITCH node.png' },
  'PT_TEX_COMPOSITE_LAYER': { name: 'Texture Composite Layer', color: '#FFAAFF', icon: '/icons/TEX_COMPOSITE_LAYER_IN node.png' },
  'PT_OUTPUT_AOV_LAYER': { name: 'Output AOV Layer', color: '#FFFF88', icon: '/icons/OUTPUT_AOV_LAYER_SWITCH node.png' },
  'PT_BLENDING_SETTINGS': { name: 'Blending Settings', color: '#FFAA88', icon: '/icons/BLENDING_SETTINGS_SWITCH node.png' },
  'PT_POST_VOLUME': { name: 'Post Volume', color: '#CC3DCC', icon: '/icons/POST_VOLUME_IN node.png' },
  'PT_TRACE_SET_VISIBILITY_RULE_GROUP': { name: 'Trace Set Visibility Rule Group', color: '#AAFFFF', icon: '/icons/TRACE_SET_VISIBILITY_RULE_GROUP_IN node.png' },
  'PT_TRACE_SET_VISIBILITY_RULE': { name: 'Trace Set Visibility Rule', color: '#AAFFAA', icon: '/icons/TRACE_SET_VISIBILITY_RULE_IN node.png' }
};

/**
 * Mapping of PT_ pin types to compatible NT_ node types
 * Used for dropdown menus in node inspector to show which node types can connect to a pin
 */
export const pinTypeToNodeTypes: Record<string, string[]> = {
  // Texture pin accepts all texture node types
  'PT_TEXTURE': [
    'NT_TEX_IMAGE',
    'NT_TEX_ALPHA_IMAGE',
    'NT_TEX_GREYSCALE_IMAGE',
    'NT_TEX_IMAGE_TILES',
    'NT_TEX_ANIMATED_IMAGE',
    'NT_TEX_CHECKS',
    'NT_TEX_NOISE',
    'NT_TEX_FBM',
    'NT_TEX_TURBULENCE',
    'NT_TEX_MARBLE',
    'NT_TEX_GRADIENT',
    'NT_TEX_SPECTRUM',
    'NT_TEX_MIX',
    'NT_TEX_ADD',
    'NT_TEX_SUBTRACT',
    'NT_TEX_MULTIPLY',
    'NT_TEX_INVERT',
    'NT_TEX_CLAMP',
    // ... add more texture types as needed
  ],
  
  // Material pin accepts all material node types
  'PT_MATERIAL': [
    'NT_MAT_DIFFUSE',
    'NT_MAT_GLOSSY',
    'NT_MAT_SPECULAR',
    'NT_MAT_METALLIC',
    'NT_MAT_UNIVERSAL',
    'NT_MAT_MIX',
    'NT_MAT_LAYERED',
    'NT_MAT_COMPOSITE',
    'NT_MAT_PORTAL',
    'NT_MAT_SHADOW_CATCHER',
    'NT_MAT_TOON',
    'NT_MAT_HAIR',
    'NT_MAT_NULL',
    'NT_MAT_CLIPPING',
    // ... add more material types
  ],
  
  // Geometry pin accepts geometry node types
  'PT_GEOMETRY': [
    'NT_GEO_MESH',
    'NT_GEO_PLANE',
    'NT_GEO_SCATTER',
    'NT_GEO_GROUP',
    'NT_GEO_PLACEMENT',
    'NT_GEO_OBJECT',
    'NT_GEO_VOLUME',
    'NT_GEO_VOLUME_SDF',
    'NT_GEO_MESH_VOLUME',
    'NT_GEO_MESH_VOLUME_SDF',
    'NT_GEO_UNIT_VOLUME',
    'NT_GEO_DECAL',
    'NT_GEO_GAUSSIAN_SPLAT',
    'NT_SCATTER_SURFACE',
    'NT_SCATTER_VOLUME',
    // ... add more geometry types
  ],
  
  // Camera pin accepts camera node types
  'PT_CAMERA': [
    'NT_CAM_THINLENS',
    'NT_CAM_PANORAMIC',
    'NT_CAM_BAKING',
    'NT_CAM_UNIVERSAL',
    'NT_CAM_SIMULATED_LENS',
    'NT_CAM_OSL',
    'NT_CAM_OSL_BAKING',
  ],
  
  // Environment pin accepts environment node types
  'PT_ENVIRONMENT': [
    'NT_ENV_TEXTURE',
    'NT_ENV_DAYLIGHT',
    'NT_ENV_PLANETARY',
  ],
  
  // Kernel pin accepts kernel node types
  'PT_KERNEL': [
    'NT_KERN_PATHTRACING',
    'NT_KERN_DIRECT_LIGHT',
    'NT_KERN_PMC',
    'NT_KERN_INFO_CHANNEL',
    'NT_KERN_PHOTON_TRACING',
  ],
  
  // Emission pin accepts emission node types
  'PT_EMISSION': [
    'NT_EMIS_TEXTURE',
    'NT_EMIS_BLACKBODY',
  ],
  
  // Medium pin accepts medium node types
  'PT_MEDIUM': [
    'NT_MED_ABSORPTION',
    'NT_MED_SCATTERING',
    'NT_MED_RANDOM_WALK',
    'NT_MED_STANDARD_VOLUME',
  ],
  
  // Displacement pin accepts displacement node types
  'PT_DISPLACEMENT': [
    'NT_DISPLACEMENT',
    'NT_VERTEX_DISPLACEMENT',
    'NT_VERTEX_DISPLACEMENT_MIXER',
  ],
  
  // Projection pin accepts projection node types
  'PT_PROJECTION': [
    'NT_PROJ_MESH_UV',
    'NT_PROJ_BOX',
    'NT_PROJ_CYLINDRICAL',
    'NT_PROJ_PERSPECTIVE',
    'NT_PROJ_SPHERICAL',
    'NT_PROJ_TRIPLANAR',
    'NT_PROJ_XYZ_TO_UVW',
    'NT_PROJ_OSL',
    // ... add more projection types
  ],
  
  // Transform pin accepts transform node types
  'PT_TRANSFORM': [
    'NT_TRANSFORM_2D',
    'NT_TRANSFORM_3D',
    'NT_TRANSFORM_ROTATION_3D',
    'NT_TRANSFORM_SCALE_3D',
    'NT_TRANSFORM_VALUE',
    'NT_TRANSFORM_LOOKAT',
  ],
  
  // Value types accept value node types
  'PT_BOOL': ['NT_BOOL', 'NT_BOOL_LOGIC_OPERATOR'],
  'PT_FLOAT': ['NT_FLOAT', 'NT_FLOAT_COMPONENT_MERGER', 'NT_FLOAT_VECTOR_EXTRACTOR', 'NT_VALUE_OPERATOR'],
  'PT_INT': ['NT_INT', 'NT_INT_VECTOR_EXTRACTOR'],
  'PT_STRING': ['NT_STRING'],
  'PT_ENUM': ['NT_ENUM'],
  
  // Imager pin
  'PT_IMAGER': ['NT_IMAGER'],
  
  // Post processing pin
  'PT_POSTPROCESSING': ['NT_POSTPROC'],
  
  // Film settings pin
  'PT_FILM_SETTINGS': ['NT_FILM_SETTINGS'],
  
  // Render target pin
  'PT_RENDERTARGET': ['NT_RENDERTARGET'],
  
  // Object layer pin
  'PT_OBJECTLAYER': ['NT_OBJECTLAYER'],
  
  // Material layer pin
  'PT_MATERIAL_LAYER': [
    'NT_MAT_LAYER_DIFFUSE',
    'NT_MAT_LAYER_SPECULAR',
    'NT_MAT_LAYER_METALLIC',
    'NT_MAT_LAYER_SHEEN',
    'NT_MAT_LAYER_GROUP',
  ],
  
  // Round edges pin
  'PT_ROUND_EDGES': ['NT_ROUND_EDGES'],
};

/**
 * Get icon and color for a pin type
 */
export function getPinIconInfo(pinType: string): PinIconInfo {
  return OCTANE_PIN_TYPES[pinType] || OCTANE_PIN_TYPES['PT_UNKNOWN'];
}

/**
 * Get compatible node types for a pin type
 */
export function getCompatibleNodeTypes(pinType: string): string[] {
  return pinTypeToNodeTypes[pinType] || [];
}

/**
 * Check if a node type can connect to a pin type
 */
export function isNodeTypeCompatible(nodeType: string, pinType: string): boolean {
  const compatibleTypes = pinTypeToNodeTypes[pinType];
  if (!compatibleTypes) return false;
  return compatibleTypes.includes(nodeType);
}

/**
 * Get all pin types
 */
export function getAllPinTypes(): string[] {
  return Object.keys(OCTANE_PIN_TYPES);
}

/**
 * Get pin type info
 */
export function getPinTypeInfo(pinType: string): PinTypeInfo | undefined {
  return OCTANE_PIN_TYPES[pinType];
}

/**
 * Unified icon lookup for both node types (NT_) and pin types (PT_)
 * This replaces the scattered icon lookup logic throughout the codebase
 * 
 * @param type - Node type (NT_*) or Pin type (PT_*)
 * @param name - Optional name for legacy lookups
 * @returns Icon path
 */
export function getIconForType(type: string, name?: string): string {
  // Handle NT_ node types
  if (type && type.startsWith('NT_')) {
    if (hasIconMapping(type)) {
      return getNodeIconPath(type);
    }
  }
  
  // Handle PT_ pin types
  if (type && type.startsWith('PT_')) {
    return getPinIconInfo(type).icon;
  }
  
  // Handle legacy name-based lookups
  const nameToType: Record<string, string> = {
    'Bool value': 'PT_BOOL',
    'Float value': 'PT_FLOAT',
    'Int value': 'PT_INT',
    'String value': 'PT_STRING',
    'Enum value': 'PT_ENUM',
    'RGB color': 'PT_RGB'
  };
  
  if (name && nameToType[name]) {
    return getPinIconInfo(nameToType[name]).icon;
  }
  
  // Unknown type fallback
  return getPinIconInfo('PT_UNKNOWN').icon;
}

/**
 * Get color for a type (works for both NT_ and PT_)
 * Node types use their node color, pin types use their pin color
 * 
 * @param type - Node type (NT_*) or Pin type (PT_*)
 * @returns Hex color string
 */
export function getColorForType(type: string): string {
  if (type && type.startsWith('PT_')) {
    return getPinIconInfo(type).color;
  }
  
  // For NT_ types, return a default color (they use node-specific colors)
  return '#666666';
}
