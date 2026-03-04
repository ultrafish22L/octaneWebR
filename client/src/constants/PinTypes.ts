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
  PT_UNKNOWN: { name: 'Unknown', color: '#FFFFFF', icon: '/icons/EMPTY.png' },
  PT_BOOL: { name: 'Bool', color: '#DEA9D4', icon: '/icons/VALUE BOOL node.png' },
  PT_FLOAT: { name: 'Float', color: '#80B3E6', icon: '/icons/VALUE FLOAT node.png' },
  PT_INT: { name: 'Int', color: '#FFD52B', icon: '/icons/VALUE INT node.png' },
  PT_TRANSFORM: { name: 'Transform', color: '#BFDEFF', icon: '/icons/TRANSFORM_IN node.png' },
  PT_TEXTURE: { name: 'Texture', color: '#BFFFDE', icon: '/icons/TEXTURE_BITMAP node.png' },
  PT_EMISSION: { name: 'Emission', color: '#FFD700', icon: '/icons/CATEGORY_EMITTER node.png' },
  PT_MATERIAL: { name: 'Material', color: '#FFF2BD', icon: '/icons/CATEGORY_MATERIAL node.png' },
  PT_CAMERA: { name: 'Camera', color: '#80FFFF', icon: '/icons/CAMERA node.png' },
  PT_ENVIRONMENT: { name: 'Environment', color: '#8080FF', icon: '/icons/ENVIRONMENT node.png' },
  PT_IMAGER: { name: 'Imager', color: '#80FF80', icon: '/icons/IMAGER node.png' },
  PT_KERNEL: { name: 'Kernel', color: '#FFCC80', icon: '/icons/RENDER KERNEL node.png' },
  PT_GEOMETRY: { name: 'Geometry', color: '#FFBDF2', icon: '/icons/MESH archive.png' },
  PT_MEDIUM: { name: 'Medium', color: '#FFF2BD', icon: '/icons/MEDIUM_SWITCH node.png' },
  PT_PHASEFUNCTION: {
    name: 'Phase Function',
    color: '#8844FF',
    icon: '/icons/PHASEFUNCTION_SWITCH node.png',
  },
  PT_FILM_SETTINGS: { name: 'Film Settings', color: '#888888', icon: '/icons/FILM node.png' },
  PT_ENUM: { name: 'Enum', color: '#88FF44', icon: '/icons/VALUE INT node.png' },
  PT_OBJECTLAYER: {
    name: 'Object Layer',
    color: '#44FF88',
    icon: '/icons/OBJECTLAYER_SWITCH node.png',
  },
  PT_POSTPROCESSING: {
    name: 'Post Processing',
    color: '#FF4DFF',
    icon: '/icons/POSTPROC node.png',
  },
  PT_RENDERTARGET: {
    name: 'Render Target',
    color: '#E6E6E6',
    icon: '/icons/RENDER TARGET node.png',
  },
  PT_WORK_PANE: { name: 'Work Pane', color: '#666666', icon: '/icons/CATEGORY.png' },
  PT_PROJECTION: { name: 'Projection', color: '#8888FF', icon: '/icons/PROJECTION_IN node.png' },
  PT_DISPLACEMENT: {
    name: 'Displacement',
    color: '#FF6B35',
    icon: '/icons/DISPLACEMENT_SWITCH node.png',
  },
  PT_STRING: { name: 'String', color: '#FFFF44', icon: '/icons/VALUE STRING node.png' },
  PT_RENDER_PASSES: { name: 'Render Passes', color: '#8888FF', icon: '/icons/render_passes.png' },
  PT_RENDER_LAYER: { name: 'Render Layer', color: '#E68000', icon: '/icons/render_layer.png' },
  PT_VOLUME_RAMP: { name: 'Volume Ramp', color: '#44AAFF', icon: '/icons/VOLUME_RAMP_IN node.png' },
  PT_ANIMATION_SETTINGS: {
    name: 'Animation Settings',
    color: '#FF4444',
    icon: '/icons/animation_settings_node.png',
  },
  PT_LUT: { name: 'LUT', color: '#8844FF', icon: '/icons/LUT_SWITCH node.png' },
  PT_RENDER_JOB: { name: 'Render Job', color: '#FF8888', icon: '/icons/RENDER_JOB_IN node.png' },
  PT_TOON_RAMP: { name: 'Toon Ramp', color: '#FFAA44', icon: '/icons/TOON_RAMP_IN node.png' },
  PT_BIT_MASK: { name: 'Bit Mask', color: '#888888', icon: '/icons/BITMASK_SWITCH node.png' },
  PT_ROUND_EDGES: { name: 'Round Edges', color: '#FF44FF', icon: '/icons/ROUND_EDGES_IN node.png' },
  PT_MATERIAL_LAYER: {
    name: 'Material Layer',
    color: '#FF8844',
    icon: '/icons/MATERIAL_LAYER_SWITCH node.png',
  },
  PT_OCIO_VIEW: { name: 'OCIO View', color: '#FF88AA', icon: '/icons/OCIO_VIEW_SWITCH node.png' },
  PT_OCIO_LOOK: { name: 'OCIO Look', color: '#88AAFF', icon: '/icons/OCIO_LOOK_SWITCH node.png' },
  PT_OCIO_COLOR_SPACE: {
    name: 'OCIO Color Space',
    color: '#FFAA88',
    icon: '/icons/OCIO_COLOR_SPACE_SWITCH node.png',
  },
  PT_OUTPUT_AOV_GROUP: {
    name: 'Output AOV Group',
    color: '#88FF88',
    icon: '/icons/aov-output-group.png',
  },
  PT_OUTPUT_AOV: {
    name: 'Output AOV',
    color: '#88FFFF',
    icon: '/icons/OUTPUT_AOV_SWITCH node.png',
  },
  PT_TEX_COMPOSITE_LAYER: {
    name: 'Texture Composite Layer',
    color: '#FFAAFF',
    icon: '/icons/TEX_COMPOSITE_LAYER_IN node.png',
  },
  PT_OUTPUT_AOV_LAYER: {
    name: 'Output AOV Layer',
    color: '#FFFF88',
    icon: '/icons/OUTPUT_AOV_LAYER_SWITCH node.png',
  },
  PT_BLENDING_SETTINGS: {
    name: 'Blending Settings',
    color: '#FFAA88',
    icon: '/icons/BLENDING_SETTINGS_SWITCH node.png',
  },
  PT_POST_VOLUME: { name: 'Post Volume', color: '#CC3DCC', icon: '/icons/POST_VOLUME_IN node.png' },
  PT_TRACE_SET_VISIBILITY_RULE_GROUP: {
    name: 'Trace Set Visibility Rule Group',
    color: '#AAFFFF',
    icon: '/icons/TRACE_SET_VISIBILITY_RULE_GROUP_IN node.png',
  },
  PT_TRACE_SET_VISIBILITY_RULE: {
    name: 'Trace Set Visibility Rule',
    color: '#AAFFAA',
    icon: '/icons/TRACE_SET_VISIBILITY_RULE_IN node.png',
  },
};

/**
 * Mapping of PT_ pin types to compatible NT_ node types
 * Used for dropdown menus in node inspector to show which node types can connect to a pin
 */
export interface CompatibleNodeType {
  key: string;
  id: number;
}

export const pinTypeToNodeTypes: Record<string, CompatibleNodeType[]> = {
  // Texture pin accepts all texture node types
  PT_TEXTURE: [
    { key: 'NT_TEX_IMAGE', id: 34 },
    { key: 'NT_TEX_ALPHAIMAGE', id: 35 },
    { key: 'NT_TEX_FLOATIMAGE', id: 36 },
    { key: 'NT_TEX_CHECKS', id: 45 },
    { key: 'NT_TEX_NOISE', id: 87 },
    { key: 'NT_TEX_TURBULENCE', id: 22 },
    { key: 'NT_TEX_MARBLE', id: 47 },
    { key: 'NT_TEX_GRADIENT', id: 49 },
    { key: 'NT_TEX_MIX', id: 38 },
    { key: 'NT_TEX_ADD', id: 106 },
    { key: 'NT_TEX_SUBTRACT', id: 108 },
    { key: 'NT_TEX_MULTIPLY', id: 39 },
    { key: 'NT_TEX_FALLOFF', id: 50 },
    { key: 'NT_TEX_RGB', id: 33 },
    { key: 'NT_TEX_FLOAT', id: 31 },
  ],

  // Material pin accepts all material node types
  PT_MATERIAL: [
    { key: 'NT_MAT_DIFFUSE', id: 17 },
    { key: 'NT_MAT_GLOSSY', id: 16 },
    { key: 'NT_MAT_SPECULAR', id: 18 },
    { key: 'NT_MAT_UNIVERSAL', id: 130 },
    { key: 'NT_MAT_MIX', id: 19 },
    { key: 'NT_MAT_PORTAL', id: 20 },
    { key: 'NT_MAT_METAL', id: 120 },
    { key: 'NT_MAT_TOON', id: 121 },
  ],

  // Geometry pin accepts geometry node types
  PT_GEOMETRY: [
    { key: 'NT_GEO_MESH', id: 1 },
    { key: 'NT_GEO_PLANE', id: 110 },
    { key: 'NT_GEO_SCATTER', id: 5 },
    { key: 'NT_GEO_GROUP', id: 3 },
    { key: 'NT_GEO_PLACEMENT', id: 4 },
    { key: 'NT_GEO_OBJECT', id: 153 },
    { key: 'NT_GEO_VOLUME', id: 91 },
  ],

  // Camera pin accepts camera node types
  PT_CAMERA: [
    { key: 'NT_CAM_THINLENS', id: 13 },
    { key: 'NT_CAM_PANORAMIC', id: 62 },
    { key: 'NT_CAM_BAKING', id: 94 },
    { key: 'NT_CAM_UNIVERSAL', id: 157 },
    { key: 'NT_CAM_SIMULATED_LENS', id: 301 },
    { key: 'NT_CAM_OSL', id: 126 },
    { key: 'NT_CAM_OSL_BAKING', id: 128 },
  ],

  // Environment pin accepts environment node types
  PT_ENVIRONMENT: [
    { key: 'NT_ENV_TEXTURE', id: 37 },
    { key: 'NT_ENV_DAYLIGHT', id: 14 },
    { key: 'NT_ENV_PLANETARY', id: 129 },
  ],

  // Kernel pin accepts kernel node types
  PT_KERNEL: [
    { key: 'NT_KERN_PATHTRACING', id: 25 },
    { key: 'NT_KERN_DIRECTLIGHTING', id: 24 },
    { key: 'NT_KERN_PMC', id: 23 },
    { key: 'NT_KERN_INFO', id: 26 },
  ],

  // Emission pin accepts emission node types
  PT_EMISSION: [
    { key: 'NT_EMIS_TEXTURE', id: 54 },
    { key: 'NT_EMIS_BLACKBODY', id: 53 },
  ],

  // Medium pin accepts medium node types
  PT_MEDIUM: [
    { key: 'NT_MED_ABSORPTION', id: 58 },
    { key: 'NT_MED_SCATTERING', id: 59 },
    { key: 'NT_MED_RANDOMWALK', id: 146 },
    { key: 'NT_MED_VOLUME', id: 98 },
  ],

  // Displacement pin accepts displacement node types
  PT_DISPLACEMENT: [{ key: 'NT_DISPLACEMENT', id: 80 }],

  // Render target pin
  PT_RENDERTARGET: [{ key: 'NT_RENDERTARGET', id: 56 }],

  // Value types accept value node types
  PT_BOOL: [{ key: 'NT_BOOL', id: 11 }],
  PT_FLOAT: [{ key: 'NT_FLOAT', id: 6 }],
  PT_INT: [{ key: 'NT_INT', id: 9 }],
  PT_ENUM: [{ key: 'NT_ENUM', id: 57 }],
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
export function getCompatibleNodeTypes(pinType: string): CompatibleNodeType[] {
  return pinTypeToNodeTypes[pinType] || [];
}

/**
 * Check if a node type can connect to a pin type
 */
export function isNodeTypeCompatible(nodeType: string, pinType: string): boolean {
  const compatibleTypes = pinTypeToNodeTypes[pinType];
  if (!compatibleTypes) return false;
  return compatibleTypes.some(t => t.key === nodeType);
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
    'RGB color': 'PT_RGB',
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
