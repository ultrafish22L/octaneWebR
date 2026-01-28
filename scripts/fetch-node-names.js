#!/usr/bin/env node

/**
 * Fetch human-readable display names for all node types using ApiInfo.nodeInfo()
 * 
 * This script:
 * 1. Reads metadata.json with NT_* enum names and IDs
 * 2. Calls ApiInfo.nodeInfo(nodeId) for each node type
 * 3. Extracts display name (description) and category
 * 4. Generates node-display-names.json mapping file
 */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const fs = require('fs');

const PROTO_PATH = path.resolve(__dirname, '../server/proto');
const METADATA_PATH = path.resolve(__dirname, '../client/public/icons/nodes/metadata.json');
const OUTPUT_PATH = path.resolve(__dirname, '../client/public/icons/nodes/node-display-names.json');

const octaneHost = process.env.OCTANE_HOST || 'host.docker.internal';
const octanePort = parseInt(process.env.OCTANE_PORT || '51022');

class ApiInfoClient {
  constructor() {
    this.client = null;
  }

  async initialize() {
    console.log('📦 Loading ApiInfo proto...');
    
    const protoFile = path.join(PROTO_PATH, 'apiinfo.proto');
    if (!fs.existsSync(protoFile)) {
      throw new Error(`Proto file not found: ${protoFile}`);
    }

    const packageDefinition = protoLoader.loadSync([protoFile], {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [PROTO_PATH]
    });

    const descriptor = grpc.loadPackageDefinition(packageDefinition);
    const ApiInfoService = descriptor.octaneapi?.ApiInfoService;

    if (!ApiInfoService) {
      throw new Error('ApiInfoService not found in proto');
    }

    this.client = new ApiInfoService(
      `${octaneHost}:${octanePort}`,
      grpc.credentials.createInsecure()
    );

    console.log(`✅ Connected to Octane at ${octaneHost}:${octanePort}`);
  }

  async getNodeInfo(nodeTypeId) {
    return new Promise((resolve, reject) => {
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 5);

      this.client.nodeInfo(
        { type: nodeTypeId },
        new grpc.Metadata(),
        { deadline },
        (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response.result || {});
          }
        }
      );
    });
  }
}

async function fetchNodeNames() {
  console.log('\n🔍 Fetching node display names from Octane...\n');

  // Load metadata.json
  if (!fs.existsSync(METADATA_PATH)) {
    console.error(`❌ Metadata file not found: ${METADATA_PATH}`);
    process.exit(1);
  }

  const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));
  console.log(`📋 Loaded ${metadata.length} node types from metadata.json`);

  // Initialize API client
  const client = new ApiInfoClient();
  await client.initialize();

  // Fetch node info for each type
  const nodeNames = {};
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < metadata.length; i++) {
    const item = metadata[i];
    const { node_name, node_id } = item;

    process.stdout.write(`[${i + 1}/${metadata.length}] ${node_name} (ID: ${node_id})... `);

    try {
      const info = await client.getNodeInfo(node_id);
      
      nodeNames[node_name] = {
        id: node_id,
        displayName: info.description || node_name,
        category: info.category || 'Unknown',
        defaultName: info.defaultName || info.description || node_name,
        nodeColor: info.nodeColor || 0,
        isHidden: info.isHidden || false
      };

      console.log(`✅ "${info.description || node_name}"`);
      successCount++;

      // Small delay to avoid overwhelming Octane
      await new Promise(resolve => setTimeout(resolve, 10));
    } catch (error) {
      console.log(`❌ ${error.message}`);
      
      // Store fallback data even on error
      nodeNames[node_name] = {
        id: node_id,
        displayName: node_name.replace(/^NT_/, '').replace(/_/g, ' '),
        category: 'Unknown',
        defaultName: node_name,
        error: error.message
      };
      
      errorCount++;
    }
  }

  // Save results
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(nodeNames, null, 2));

  console.log(`\n✅ Node names saved to: ${OUTPUT_PATH}`);
  console.log(`📊 Success: ${successCount} | Errors: ${errorCount} | Total: ${metadata.length}`);
  
  // Display sample mappings
  console.log('\n📋 Sample mappings:');
  const samples = Object.entries(nodeNames).slice(0, 5);
  samples.forEach(([enumName, info]) => {
    console.log(`   ${enumName} → "${info.displayName}" [${info.category}]`);
  });

  return nodeNames;
}

// Run the script
fetchNodeNames()
  .then((nodeNames) => {
    console.log('\n✅ Node name mapping complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed to fetch node names:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
