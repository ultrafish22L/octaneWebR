#!/usr/bin/env node
/**
 * Extract all Octane node types from octaneids.proto and generate
 * a complete NodeTypes.ts file with proper categorization
 */

const fs = require('fs');
const path = require('path');

// Read octaneids.proto
const protoPath = path.join(__dirname, '../../sdk/src/api/grpc/protodef/octaneids.proto');
const protoContent = fs.readFileSync(protoPath, 'utf-8');

// Extract NodeType enum
const nodeTypeMatch = protoContent.match(/enum NodeType\s*\{([^}]+)\}/s);
if (!nodeTypeMatch) {
  console.error('Could not find NodeType enum in octaneids.proto');
  process.exit(1);
}

const nodeTypeEnum = nodeTypeMatch[1];

// Parse node types (skip deprecated ones starting with _)
const nodeTypes = [];
const lines = nodeTypeEnum.split('\n');
for (const line of lines) {
  const match = line.match(/^\s*(NT_[A-Z_0-9]+)\s*=\s*\d+/);
  if (match && !match[1].startsWith('_NT_')) {
    nodeTypes.push(match[1]);
  }
}

console.log(`Found ${nodeTypes.length} node types`);

// Categorization map based on NT_ prefix - matching Octane's exact category names
const categoryMap = {
  'NT_CAM_': 'Cameras',
  'NT_DISPLACEMENT': 'Displacement',
  'NT_VERTEX_DISPLACEMENT': 'Displacement',
  'NT_EMIS_': 'Emission',
  'NT_ENV_': 'Environments',
  'NT_GEO_': 'Geometry',
  'NT_BOOL': 'Input',
  'NT_FLOAT': 'Input',
  'NT_INT': 'Input',
  'NT_ENUM': 'Input',
  'NT_STRING': 'Input',
  'NT_FILE': 'Input',
  'NT_DIRECTORY': 'Input',
  'NT_KERN_': 'Kernels',
  'NT_LIGHT_': 'Lights',
  'NT_TOON_POINT_LIGHT': 'Lights',
  'NT_TOON_DIRECTIONAL_LIGHT': 'Lights',
  'NT_MAT_COMPOSITE': 'Material layers',
  'NT_MAT_SPECULAR_LAYER': 'Material layers',
  'NT_MAT_DIFFUSE_LAYER': 'Material layers',
  'NT_MAT_METALLIC_LAYER': 'Material layers',
  'NT_MAT_SHEEN_LAYER': 'Material layers',
  'NT_MAT_LAYER': 'Material layers',
  'NT_MAT_LAYER_GROUP': 'Material layers',
  'NT_MAT_': 'Materials',
  'NT_MED_': 'Medium',
  'NT_PHASE_': 'Medium',
  'NT_PROJ_': 'Projection',
  'NT_SCATTER_': 'Geometry',
  'NT_TEX_COMPOSITE': 'Texture layers',
  'NT_TEX_': 'Textures',
  'NT_TRANSFORM_': 'Transforms',
  'NT_SUN_DIRECTION': 'Transforms',
  'NT_RENDERTARGET': 'Render target',
  'NT_RENDER_PASSES': 'Render settings',
  'NT_RENDER_LAYER': 'Render settings',
  'NT_RENDER_JOB_': 'Render job',
  'NT_AOV_': 'Render AOVs',
  'NT_COMPOSITE_AOV': 'Output AOVs',
  'NT_OUTPUT_AOV': 'Output AOVs',
  'NT_POSTPROCESSING': 'Output',
  'NT_POST_': 'Output',
  'NT_IMAGER_': 'Output',
  'NT_OBJECTLAYER': 'Values',
  'NT_VOLUME_RAMP': 'Values',
  'NT_ANIMATION_SETTINGS': 'Render settings',
  'NT_FILM_SETTINGS': 'Render settings',
  'NT_LUT_': 'Values',
  'NT_TOON_RAMP': 'Values',
  'NT_BIT_MASK': 'Values',
  'NT_ROUND_EDGES': 'Round edges',
  'NT_OCIO_': 'Values',
  'NT_BLENDING_SETTINGS': 'Output AOVs',
  'NT_TRACE_SET_': 'Values',
  'NT_METADATA': 'Other',
  'NT_ANNOTATION': 'Other',
  'NT_IN_': 'Node graph',
  'NT_SWITCH_': 'Node graph',
  'NT_RNDR_VERSION': 'Other',
  'NT_IMAGE_RESOLUTION': 'Render settings',
  'NT_LOCAL_APP_PREFS': 'Other',
  'NT_PROJECT_SETTINGS': 'Other',
  'NT_SPLIT_PANE': 'Other',
  'NT_WORK_PANE': 'Other',
  'NT_IMPORT_': 'Other',
};

// Category colors (matching Octane's color scheme)
const categoryColors = {
  'Cameras': '#8B4513',
  'Displacement': '#FF6B35',
  'Emission': '#FFD700',
  'Environments': '#87CEEB',
  'Geometry': '#32CD32',
  'Input': '#9370DB',
  'Kernels': '#FF1493',
  'Lights': '#FFFF00',
  'Material layers': '#6495ED',
  'MaterialX': '#4682B4',
  'Materials': '#4169E1',
  'Medium': '#8A2BE2',
  'Module graphs': '#BC8F8F',
  'Neural models': '#9370DB',
  'Other': '#A9A9A9',
  'Output': '#DDA0DD',
  'Output AOVs': '#FF1493',
  'Projection': '#FF8C00',
  'Render AOVs': '#FF69B4',
  'Render job': '#CD853F',
  'Render settings': '#FFA500',
  'Render target': '#FFA07A',
  'Round edges': '#FFB6C1',
  'Texture layers': '#48D1CC',
  'Textures': '#20B2AA',
  'Transforms': '#DC143C',
  'Values': '#7B68EE',
  'Vectron®': '#BA55D3',
  'Node graph': '#9370DB',
};

// Define category display order (matching Octane's menu order)
const categoryOrder = [
  'Cameras',
  'Displacement',
  'Emission',
  'Environments',
  'Geometry',
  'Input',
  'Kernels',
  'Lights',
  'Material layers',
  'MaterialX',
  'Materials',
  'Medium',
  'Module graphs',
  'Neural models',
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
  'Vectron®',
  '___SEPARATOR___',
  'Node graph',
  'Render target',
];

// Function to determine category for a node type
function getCategory(nodeType) {
  // Try exact match first
  if (categoryMap[nodeType]) {
    return categoryMap[nodeType];
  }
  
  // Try prefix match
  for (const [prefix, category] of Object.entries(categoryMap)) {
    if (nodeType.startsWith(prefix)) {
      return category;
    }
  }
  
  return 'Other';
}

// Function to convert NT_SOMETHING_NAME to "Something Name"
function toHumanReadable(nodeType) {
  return nodeType
    .substring(3) // Remove NT_
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

// Group node types by category
const categorized = {};
for (const nodeType of nodeTypes) {
  const category = getCategory(nodeType);
  if (!categorized[category]) {
    categorized[category] = {};
  }
  
  const color = categoryColors[category] || '#808080';
  categorized[category][nodeType] = {
    name: toHumanReadable(nodeType),
    color: color
  };
}

// Sort categories by Octane's display order
const sortedCategories = categoryOrder.filter(cat => 
  cat === '___SEPARATOR___' || categorized[cat]
);

// Generate TypeScript file
let tsContent = `/**
 * Complete Octane Node Type Definitions
 * Auto-generated from octaneids.proto
 * 
 * Total nodes: ${nodeTypes.length}
 * Categories: ${sortedCategories.length}
 */

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

/**
 * Complete Octane node type hierarchy with all ${nodeTypes.length} node types
 */
export const OCTANE_NODE_TYPES: NodeTypeHierarchy = {\n`;

for (const category of sortedCategories) {
  // Skip separators when generating the node type hierarchy
  if (category === '___SEPARATOR___') continue;
  
  tsContent += `  '${category}': {\n`;
  const nodes = categorized[category];
  if (nodes) {
    const nodeKeys = Object.keys(nodes).sort();
    for (const nodeType of nodeKeys) {
      const info = nodes[nodeType];
      tsContent += `    '${nodeType}': { name: '${info.name}', color: '${info.color}' },\n`;
    }
  }
  tsContent += `  },\n`;
}

tsContent += `};

/**
 * Category display order matching Octane's context menu
 * '___SEPARATOR___' indicates a visual separator line
 */
export const CATEGORY_ORDER: string[] = [
`;

for (const category of sortedCategories) {
  tsContent += `  '${category}',\n`;
}

tsContent += `];

/**
 * Get all categories
 */
export function getNodeCategories(): string[] {
  return Object.keys(OCTANE_NODE_TYPES);
}

/**
 * Get categories in display order (with separators)
 */
export function getCategoriesInOrder(): string[] {
  return CATEGORY_ORDER;
}

/**
 * Get node types for a specific category
 */
export function getNodeTypesForCategory(category: string): NodeTypeCategory | undefined {
  return OCTANE_NODE_TYPES[category];
}

/**
 * Get node type info
 */
export function getNodeTypeInfo(nodeType: string): NodeTypeInfo | undefined {
  for (const category of Object.values(OCTANE_NODE_TYPES)) {
    if (category[nodeType]) {
      return category[nodeType];
    }
  }
  return undefined;
}

/**
 * Get all node types as a flat list
 */
export function getAllNodeTypes(): string[] {
  const allTypes: string[] = [];
  for (const category of Object.values(OCTANE_NODE_TYPES)) {
    allTypes.push(...Object.keys(category));
  }
  return allTypes.sort();
}
`;

// Write to file
const outputPath = path.join(__dirname, '../client/src/constants/NodeTypes.ts');
fs.writeFileSync(outputPath, tsContent);

const actualCategories = sortedCategories.filter(c => c !== '___SEPARATOR___' && categorized[c]);
console.log(`✅ Generated NodeTypes.ts with ${nodeTypes.length} node types in ${actualCategories.length} categories`);
console.log(`📝 Output: ${outputPath}`);
console.log(`\n📊 Categories:`);
for (const category of sortedCategories) {
  if (category === '___SEPARATOR___') {
    console.log(`  ---`);
  } else if (categorized[category]) {
    const count = Object.keys(categorized[category]).length;
    console.log(`  - ${category}: ${count} nodes`);
  }
}
