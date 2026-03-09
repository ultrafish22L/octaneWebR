#!/usr/bin/env node

/**
 * Fetch complete static Octane API metadata and write to cache JSON.
 *
 * Queries ApiInfo + ApiNodePinInfoEx services for every node type:
 *   - nodeInfo(type)       → outType, pinInfoCount, category, etc.
 *   - nodePinInfo(type, i) → ObjectRef per pin
 *   - getApiNodePinInfo()  → full ApiNodePinInfo struct
 *
 * Output: mcp/data/octane-api-cache.json
 *
 * Usage:
 *   OCTANE_HOST=127.0.0.1 node scripts/fetch-api-cache.js
 */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const fs = require('fs');

const PROTO_PATH = path.resolve(__dirname, '../server/proto');
const OUTPUT_PATH = path.resolve(__dirname, '../mcp/data/octane-api-cache.json');

const octaneHost = process.env.OCTANE_HOST || '127.0.0.1';
const octanePort = parseInt(process.env.OCTANE_PORT || '51022');
const address = `${octaneHost}:${octanePort}`;

// ---------- helpers ----------

function makeCallOnce(client, method, params = {}, timeoutSec = 10) {
  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + timeoutSec);
    client[method](params, new grpc.Metadata(), { deadline }, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function makeCall(client, method, params = {}, timeoutSec = 10) {
  const MAX_RETRIES = 5;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await makeCallOnce(client, method, params, timeoutSec);
    } catch (err) {
      const msg = err.message || '';
      const isConnectionError = msg.includes('ECONNRESET') || msg.includes('ECONNREFUSED') || msg.includes('UNAVAILABLE');
      if (isConnectionError && attempt < MAX_RETRIES) {
        const waitSec = attempt * 5;
        process.stdout.write(`\n  [retry ${attempt}/${MAX_RETRIES} in ${waitSec}s - ${msg.slice(0, 60)}]... `);
        await sleep(waitSec * 1000);
        continue;
      }
      throw err;
    }
  }
}

function extractHandle(objRef) {
  if (!objRef) return null;
  const h = objRef.handle;
  if (h === undefined || h === null) return null;
  const n = typeof h === 'string' ? parseInt(h, 10) : h;
  return isNaN(n) || n === 0 ? null : n;
}

// ---------- main ----------

async function main() {
  console.log(`\nOctane API Cache Generator\n${'='.repeat(40)}\n`);

  // Load protos
  const protos = ['apiinfo.proto', 'apinodepininfohelper.proto'];
  const packageDefinition = protoLoader.loadSync(
    protos.map(p => path.join(PROTO_PATH, p)),
    {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [PROTO_PATH],
    }
  );
  const descriptor = grpc.loadPackageDefinition(packageDefinition);

  const ApiInfoService = descriptor.octaneapi?.ApiInfoService;
  const ApiNodePinInfoExService = descriptor.octaneapi?.ApiNodePinInfoExService;
  if (!ApiInfoService || !ApiNodePinInfoExService) {
    throw new Error('Required services not found in proto definitions');
  }

  const creds = grpc.credentials.createInsecure();
  const apiInfo = new ApiInfoService(address, creds);
  const pinInfoEx = new ApiNodePinInfoExService(address, creds);

  console.log(`Connected to Octane at ${address}`);

  // Wait for Octane to fully initialize before making API calls
  const startDelay = parseInt(process.env.START_DELAY || '5');
  console.log(`Waiting ${startDelay}s for Octane to stabilize...\n`);
  await sleep(startDelay * 1000);

  // Extract numeric enum values from proto descriptor for NodeType
  // Proto-loader stores enums as { 0: {name: "NT_UNKNOWN", number: 0}, 1: {name: "NT_GEO_MESH", number: 1}, ... }
  const nodeTypeEnum = descriptor.octaneapi?.NodeType?.type?.value || {};
  const enumNameToId = {};
  for (const def of Object.values(nodeTypeEnum)) {
    if (def && typeof def === 'object' && def.name && def.number !== undefined) {
      enumNameToId[def.name] = def.number;
    }
  }
  console.log(`  Enum map: ${Object.keys(enumNameToId).length} NodeType entries\n`);

  // ---- Meta ----
  const versionRes = await makeCall(apiInfo, 'octaneVersion');
  const nameRes = await makeCall(apiInfo, 'octaneName');
  const octaneVersion = versionRes.result;
  const octaneName = nameRes.result;
  console.log(`Octane: ${octaneName} (version ${octaneVersion})\n`);

  // ---- Pin types ----
  // Proto: NodePinTypeArrayT { repeated NodePinType data = 1; }
  // With enums:String, values come as strings like "PT_BOOL"
  console.log('Fetching pin types...');
  const pinTypesRes = await makeCall(apiInfo, 'getPinTypes');
  const pinTypeRaw = pinTypesRes.pinTypes?.data || [];
  const pinTypes = {};
  for (const pt of pinTypeRaw) {
    // With enums:String, pt is the enum name like "PT_BOOL"
    // We need the numeric value — call getPinTypeName with the enum string
    // Actually, we need to resolve enum string → number. Let's store by name and build reverse map.
    // For now, store the string values and resolve to numbers via getPinTypeName
    const name = String(pt);
    try {
      const colorRes = await makeCall(apiInfo, 'getPinTypeColor', { type: pt });
      pinTypes[name] = { color: colorRes.result || 0 };
    } catch {
      pinTypes[name] = { color: 0 };
    }
  }
  console.log(`  ${Object.keys(pinTypes).length} pin types\n`);

  // ---- Attribute types ----
  console.log('Fetching attribute types...');
  const attrTypesRes = await makeCall(apiInfo, 'getAttributeTypes');
  const attrTypeRaw = attrTypesRes.attributeTypes?.data || [];
  const attributeTypes = {};
  for (const at of attrTypeRaw) {
    const name = String(at);
    try {
      const nameRes = await makeCall(apiInfo, 'getAttributeTypeName', { type: at });
      attributeTypes[name] = nameRes.result || name;
    } catch {
      attributeTypes[name] = name;
    }
  }
  console.log(`  ${Object.keys(attributeTypes).length} attribute types\n`);

  // ---- Node types ----
  console.log('Fetching node types...');
  const nodeTypesRes = await makeCall(apiInfo, 'getNodeTypes');
  const nodeTypeRaw = nodeTypesRes.nodesTypes?.data || [];
  console.log(`  ${nodeTypeRaw.length} raw node type IDs\n`);

  const nodeTypes = {};
  const nodeTypesByName = {};
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  let totalPins = 0;

  // Filter: skip NT_UNKNOWN (crashes Octane) and _NT_* (deprecated internals)
  const nodeTypeFiltered = nodeTypeRaw.filter(t => {
    const name = String(t);
    return name !== 'NT_UNKNOWN' && !name.startsWith('_NT_');
  });
  console.log(`  ${nodeTypeFiltered.length} after filtering (skipped NT_UNKNOWN and _NT_*)\n`);

  for (let i = 0; i < nodeTypeFiltered.length; i++) {
    const typeEnum = nodeTypeFiltered[i];
    const typeName = String(typeEnum);

    process.stdout.write(`[${i + 1}/${nodeTypeFiltered.length}] ${typeName}... `);

    // Get node info — pass enum string directly
    let info;
    try {
      const infoRes = await makeCall(apiInfo, 'nodeInfo', { type: typeEnum });
      info = infoRes.result;
    } catch (err) {
      console.log(`SKIP (nodeInfo failed: ${err.message})`);
      errorCount++;
      continue;
    }

    if (!info) {
      console.log('SKIP (null info)');
      skipCount++;
      continue;
    }

    // With enums:String, outType comes as "PT_MATERIAL" etc.
    const outTypeName = String(info.outType || 'PT_UNKNOWN');
    const pinInfoCount = info.pinInfoCount || 0;

    // Fetch pin info for each pin
    const pins = [];
    for (let pinIx = 0; pinIx < pinInfoCount; pinIx++) {
      try {
        // Step 1: get ObjectRef from nodePinInfo
        const pinRefRes = await makeCall(apiInfo, 'nodePinInfo', {
          nodeType: typeEnum,
          pinIx,
        });
        const objRef = pinRefRes.result;
        const handle = extractHandle(objRef);

        if (!handle) {
          pins.push({ index: pinIx, id: 'P_UNKNOWN', type: 'PT_UNKNOWN', staticName: '', staticLabel: '' });
          continue;
        }

        // Step 2: get full ApiNodePinInfo from the ObjectRef
        const pinInfoRes = await makeCall(pinInfoEx, 'getApiNodePinInfo', {
          nodePinInfoRef: { handle: String(handle), type: objRef.type || 0 },
        });

        const pi = pinInfoRes.nodePinInfo;
        if (!pi) {
          pins.push({ index: pinIx, id: 'P_UNKNOWN', type: 'PT_UNKNOWN', staticName: '', staticLabel: '' });
          continue;
        }

        // With enums:String, pi.type = "PT_TEXTURE", pi.id = "P_DIFFUSE", pi.defaultNodeType = "NT_TEX_RGB"
        pins.push({
          index: pinIx,
          id: String(pi.id || 'P_UNKNOWN'),
          type: String(pi.type || 'PT_UNKNOWN'),
          staticName: pi.staticName || '',
          staticLabel: pi.staticLabel || '',
          defaultNodeType: pi.defaultNodeType && String(pi.defaultNodeType) !== 'NT_UNKNOWN' ? String(pi.defaultNodeType) : undefined,
          description: pi.description || undefined,
          pinColor: pi.pinColor || undefined,
        });
      } catch (err) {
        pins.push({ index: pinIx, id: 'P_UNKNOWN', type: 'PT_UNKNOWN', staticName: '', staticLabel: '', error: err.message });
      }
    }

    totalPins += pins.length;

    const entry = {
      name: typeName,
      description: info.description || '',
      outType: outTypeName,
      category: info.category || '',
      defaultName: info.defaultName || '',
      nodeColor: info.nodeColor || 0,
      isHidden: !!info.isHidden,
      isCreatableByApi: info.isCreatableByApi !== false,
      pinInfoCount,
      attributeInfoCount: info.attributeInfoCount || 0,
      movableInputPinCount: info.movableInputPinCount || 0,
      movableInputName: info.movableInputName || '',
      pins,
    };

    nodeTypes[typeName] = entry;
    // Store name → numeric enum ID for reverse lookup in ApiCache
    const numericId = enumNameToId[typeName];
    if (numericId !== undefined) {
      nodeTypesByName[typeName] = String(numericId);
    }
    successCount++;

    console.log(`OK (${pinInfoCount} pins)`);

    // Incremental save every 50 nodes — protects against Octane crashes
    if (successCount % 50 === 0) {
      const partial = {
        meta: { octaneVersion, octaneName, generatedAt: new Date().toISOString(), nodeTypeCount: successCount, pinTypeCount: Object.keys(pinTypes).length, totalPins, partial: true },
        pinTypes, attributeTypes, nodeTypes, nodeTypesByName, compatibleTypes: {},
      };
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(partial, null, 2));
      console.log(`  [saved partial: ${successCount} types]\n`);
    }

    // Delay between nodes to avoid overwhelming Octane
    if (i % 5 === 4) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // ---- Compatible types per pin type ----
  console.log('\nFetching pin type compatibility...');
  const compatibleTypes = {};
  for (const ptName of Object.keys(pinTypes)) {
    try {
      const res = await makeCall(apiInfo, 'getCompatibleTypes', { outType: ptName });
      const compatNodes = (res.compatNodes?.data || []).map(v => String(v));
      const compatGraphs = (res.compatGraphs?.data || []).map(v => String(v));
      if (compatNodes.length > 0 || compatGraphs.length > 0) {
        compatibleTypes[ptName] = { nodes: compatNodes, graphs: compatGraphs };
      }
    } catch {
      // Some pin types may not have compatibility info
    }
  }
  console.log(`  ${Object.keys(compatibleTypes).length} pin types with compatibility maps\n`);

  // ---- Write output ----
  const cache = {
    meta: {
      octaneVersion,
      octaneName,
      generatedAt: new Date().toISOString(),
      nodeTypeCount: successCount,
      pinTypeCount: Object.keys(pinTypes).length,
      totalPins,
    },
    pinTypes,
    attributeTypes,
    nodeTypes,
    nodeTypesByName,
    compatibleTypes,
  };

  const json = JSON.stringify(cache, null, 2);
  fs.writeFileSync(OUTPUT_PATH, json);

  console.log(`${'='.repeat(40)}`);
  console.log(`Cache written to: ${OUTPUT_PATH}`);
  console.log(`Size: ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`);
  console.log(`Node types: ${successCount} OK, ${skipCount} skipped, ${errorCount} errors`);
  console.log(`Total pins cached: ${totalPins}`);
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\nFATAL: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  });
