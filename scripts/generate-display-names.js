#!/usr/bin/env node

/**
 * Generate node-display-names.json from existing NodeTypes.ts
 * 
 * This extracts display names from the already-defined OCTANE_NODE_TYPES
 * constant and creates a mapping file for the icon system.
 */

const fs = require('fs');
const path = require('path');

const NODE_TYPES_PATH = path.resolve(__dirname, '../client/src/constants/NodeTypes.ts');
const METADATA_PATH = path.resolve(__dirname, '../client/public/icons/nodes/metadata.json');
const OUTPUT_PATH = path.resolve(__dirname, '../client/public/icons/nodes/node-display-names.json');

console.log('📋 Generating node display names from NodeTypes.ts...\n');

// Read NodeTypes.ts
if (!fs.existsSync(NODE_TYPES_PATH)) {
  console.error(`❌ NodeTypes.ts not found: ${NODE_TYPES_PATH}`);
  process.exit(1);
}

const nodeTypesContent = fs.readFileSync(NODE_TYPES_PATH, 'utf-8');

// Parse OCTANE_NODE_TYPES structure line by line to preserve category associations
const mapping = {};
const lines = nodeTypesContent.split('\n');
let currentCategory = 'Other';
let inCategoryBlock = false;
let totalCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Detect category start (e.g., '  'Cameras': {')
  const categoryStartMatch = line.match(/^\s*'([^']+)':\s*\{/);
  if (categoryStartMatch && !line.includes('NT_')) {
    currentCategory = categoryStartMatch[1];
    inCategoryBlock = true;
    continue;
  }
  
  // Detect node definition (e.g., 'NT_CAM_BAKING': { name: 'Cam Baking', color: '#8B4513' },)
  const nodeMatch = line.match(/'(NT_[A-Z_0-9]+)':\s*\{\s*name:\s*'([^']+)',\s*color:\s*'([^']+)'\s*\}/);
  if (nodeMatch && inCategoryBlock) {
    const [, enumName, displayName, color] = nodeMatch;
    
    mapping[enumName] = {
      displayName,
      category: currentCategory,
      color,
      enumName
    };
    
    totalCount++;
  }
  
  // Detect end of category block (closing },)
  if (line.match(/^\s+\},?\s*$/)) {
    inCategoryBlock = false;
  }
}

console.log(`✅ Extracted ${totalCount} node type definitions from NodeTypes.ts`);

// Load metadata.json to get node IDs
if (!fs.existsSync(METADATA_PATH)) {
  console.error(`❌ metadata.json not found: ${METADATA_PATH}`);
  process.exit(1);
}

const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));
console.log(`📋 Loaded ${metadata.length} node icons from metadata.json`);

// Enhance mapping with node IDs from metadata
let matchedCount = 0;
let unmatchedCount = 0;
const unmatchedNodes = [];

for (const item of metadata) {
  const { node_name, node_id } = item;
  
  if (mapping[node_name]) {
    mapping[node_name].id = node_id;
    matchedCount++;
  } else {
    unmatchedCount++;
    unmatchedNodes.push(node_name);
    
    // Add fallback mapping for unmatched nodes
    mapping[node_name] = {
      id: node_id,
      displayName: node_name.replace(/^NT_/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      category: 'Other',
      color: '#808080',
      enumName: node_name
    };
  }
}

console.log(`✅ Matched ${matchedCount} nodes with metadata`);
if (unmatchedCount > 0) {
  console.log(`⚠️  ${unmatchedCount} nodes not found in NodeTypes.ts (using fallback names)`);
  console.log(`   Sample unmatched: ${unmatchedNodes.slice(0, 5).join(', ')}`);
}

// Save the complete mapping
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(mapping, null, 2));
console.log(`\n✅ Display names saved to: ${OUTPUT_PATH}`);

// Display sample mappings
console.log('\n📋 Sample mappings:');
const samples = Object.entries(mapping)
  .filter(([, info]) => info.id)
  .slice(0, 10);

samples.forEach(([enumName, info]) => {
  console.log(`   ${enumName} → "${info.displayName}" [${info.category}] (ID: ${info.id})`);
});

// Summary statistics
const byCategory = {};
Object.values(mapping).forEach(info => {
  byCategory[info.category] = (byCategory[info.category] || 0) + 1;
});

console.log('\n📊 Nodes by category:');
Object.entries(byCategory)
  .sort((a, b) => b[1] - a[1])
  .forEach(([category, count]) => {
    console.log(`   ${category.padEnd(25)} ${count}`);
  });

console.log(`\n✅ Complete! Total nodes with display names: ${Object.keys(mapping).length}`);
