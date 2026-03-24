#!/usr/bin/env node
/** Fix nodeTypesByName to use numeric enum IDs instead of string names */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const fs = require('fs');

const PROTO_PATH = path.resolve(__dirname, '../../octaneServGrpc/proto');
const OUTPUT = path.resolve(__dirname, '../mcp/data/octane-api-cache.json');

// Get enum map from proto
const pkg = protoLoader.loadSync(
  [path.join(PROTO_PATH, 'apiinfo.proto')],
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true, includeDirs: [PROTO_PATH] }
);
const desc = grpc.loadPackageDefinition(pkg);
const enumValues = desc.octaneapi.NodeType.type.value || {};
const enumNameToId = {};
for (const def of Object.values(enumValues)) {
  if (def && typeof def === 'object' && def.name !== undefined && def.number !== undefined) {
    enumNameToId[def.name] = def.number;
  }
}
console.log('Enum map:', Object.keys(enumNameToId).length, 'entries');

// Fix cache
const cache = JSON.parse(fs.readFileSync(OUTPUT, 'utf-8'));
let fixed = 0;
let missing = 0;
for (const typeName of Object.keys(cache.nodeTypes)) {
  const numId = enumNameToId[typeName];
  if (numId !== undefined) {
    cache.nodeTypesByName[typeName] = String(numId);
    fixed++;
  } else {
    missing++;
    console.log('  No enum ID for:', typeName);
  }
}
fs.writeFileSync(OUTPUT, JSON.stringify(cache, null, 2));
console.log('Fixed', fixed, 'entries,', missing, 'missing');

// Verify
console.log('\nSamples:');
console.log('  NT_MAT_UNIVERSAL:', cache.nodeTypesByName['NT_MAT_UNIVERSAL']);
console.log('  NT_GEO_MESH:', cache.nodeTypesByName['NT_GEO_MESH']);
console.log('  NT_TEX_IMAGE:', cache.nodeTypesByName['NT_TEX_IMAGE']);
console.log('  NT_RENDER_TARGET:', cache.nodeTypesByName['NT_RENDER_TARGET']);
console.log('\nFile size:', (fs.statSync(OUTPUT).size / 1024).toFixed(1), 'KB');
