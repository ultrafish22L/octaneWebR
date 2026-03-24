#!/usr/bin/env node

/**
 * Interactive/resumable cache builder.
 *
 * Run repeatedly — it picks up where it left off.
 * Saves after every single node type, so a crash loses at most 1 type.
 *
 * Usage:
 *   node scripts/fetch-cache-interactive.js          # full run
 *   node scripts/fetch-cache-interactive.js --meta    # phase 1 only (meta + node list)
 *   node scripts/fetch-cache-interactive.js --batch=20  # do 20 node types then stop
 */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const fs = require('fs');

const PROTO_PATH = path.resolve(__dirname, '../../octaneServGrpc/proto');
const OUTPUT = path.resolve(__dirname, '../mcp/data/octane-api-cache.json');

const args = process.argv.slice(2);
const metaOnly = args.includes('--meta');
const batchArg = args.find(a => a.startsWith('--batch='));
const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : Infinity;

// ---- gRPC setup ----

const pkg = protoLoader.loadSync(
  [path.join(PROTO_PATH, 'apiinfo.proto'), path.join(PROTO_PATH, 'apinodepininfohelper.proto')],
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true, includeDirs: [PROTO_PATH] }
);
const desc = grpc.loadPackageDefinition(pkg);
const ADDRESS = '127.0.0.1:51022';
const creds = grpc.credentials.createInsecure();

// Fresh stub factory — matches octaneWebR pattern of recreating stubs
function makeApiStub() { return new desc.octaneapi.ApiInfoService(ADDRESS, creds); }
function makePinStub() { return new desc.octaneapi.ApiNodePinInfoExService(ADDRESS, creds); }
let api = makeApiStub();
let pinEx = makePinStub();

function resetStubs() {
  try { api.close(); } catch {}
  try { pinEx.close(); } catch {}
  api = makeApiStub();
  pinEx = makePinStub();
}

// Deadline as number (ms since epoch) — matches octaneWebR's Date.now() + timeout pattern
function call(client, method, params = {}, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    client[method](params, new grpc.Metadata(), { deadline }, (e, r) => e ? reject(e) : resolve(r));
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function extractHandle(objRef) {
  if (!objRef) return null;
  const h = objRef.handle;
  if (h === undefined || h === null) return null;
  const n = typeof h === 'string' ? parseInt(h, 10) : h;
  return isNaN(n) || n === 0 ? null : n;
}

// ---- Enum map from proto ----

const nodeTypeEnum = desc.octaneapi.NodeType.type.value || {};
const enumNameToId = {};
for (const def of Object.values(nodeTypeEnum)) {
  if (def && typeof def === 'object' && def.name != null && def.number != null) {
    enumNameToId[def.name] = def.number;
  }
}

// ---- Load or init cache ----

let cache;
if (fs.existsSync(OUTPUT)) {
  try {
    cache = JSON.parse(fs.readFileSync(OUTPUT, 'utf-8'));
    console.log(`Resuming: ${Object.keys(cache.nodeTypes || {}).length} types already cached`);
  } catch {
    cache = null;
  }
}
if (!cache) {
  cache = {
    meta: { octaneVersion: 0, octaneName: '', generatedAt: '', nodeTypeCount: 0, pinTypeCount: 0, totalPins: 0 },
    pinTypes: {},
    attributeTypes: {},
    nodeTypes: {},
    nodeTypesByName: {},
    compatibleTypes: {},
    _pending: [],
  };
}

function saveCache() {
  cache.meta.nodeTypeCount = Object.keys(cache.nodeTypes).length;
  cache.meta.totalPins = Object.values(cache.nodeTypes).reduce((sum, nt) => sum + (nt.pins ? nt.pins.length : 0), 0);
  cache.meta.generatedAt = new Date().toISOString();
  fs.writeFileSync(OUTPUT, JSON.stringify(cache, null, 2));
}

// ---- Main ----

async function main() {
  console.log(`\nInteractive Cache Builder\n${'='.repeat(35)}\n`);

  // Phase 1: metadata (if not done yet)
  if (!cache.meta.octaneVersion) {
    console.log('Phase 1: Fetching metadata...');

    const ver = await call(api, 'octaneVersion');
    const name = await call(api, 'octaneName');
    cache.meta.octaneVersion = ver.result;
    cache.meta.octaneName = name.result;
    console.log(`  Octane: ${name.result} (v${ver.result})`);

    // Pin types
    const ptRes = await call(api, 'getPinTypes');
    const ptRaw = ptRes.pinTypes?.data || [];
    for (const pt of ptRaw) {
      const ptName = String(pt);
      if (cache.pinTypes[ptName]) continue;
      try {
        const c = await call(api, 'getPinTypeColor', { type: pt });
        cache.pinTypes[ptName] = { color: c.result || 0 };
      } catch {
        cache.pinTypes[ptName] = { color: 0 };
      }
    }
    cache.meta.pinTypeCount = Object.keys(cache.pinTypes).length;
    console.log(`  Pin types: ${cache.meta.pinTypeCount}`);

    // Attribute types
    const atRes = await call(api, 'getAttributeTypes');
    const atRaw = atRes.attributeTypes?.data || [];
    for (const at of atRaw) {
      const atName = String(at);
      if (cache.attributeTypes[atName]) continue;
      try {
        const n = await call(api, 'getAttributeTypeName', { type: at });
        cache.attributeTypes[atName] = n.result || atName;
      } catch {
        cache.attributeTypes[atName] = atName;
      }
    }
    console.log(`  Attr types: ${Object.keys(cache.attributeTypes).length}`);

    // Node type list (filtered)
    const ntRes = await call(api, 'getNodeTypes');
    const ntRaw = ntRes.nodesTypes?.data || [];
    const filtered = ntRaw
      .map(String)
      .filter(t => t !== 'NT_UNKNOWN' && !t.startsWith('_NT_'));
    cache._pending = filtered.filter(t => !cache.nodeTypes[t]);
    console.log(`  Node types: ${filtered.length} total, ${cache._pending.length} pending`);

    saveCache();
    console.log(`  Saved (${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB)\n`);
  }

  if (metaOnly) {
    console.log('--meta flag: stopping after metadata.');
    return;
  }

  // Phase 2: node types (one at a time, save after each)
  const pending = (cache._pending || []).filter(t => !cache.nodeTypes[t]);
  if (pending.length === 0) {
    console.log('All node types cached! Moving to compatibility...');
  } else {
    const todo = pending.slice(0, batchSize);
    console.log(`Phase 2: Fetching ${todo.length} node types (of ${pending.length} remaining)...\n`);

    for (let i = 0; i < todo.length; i++) {
      const typeName = todo[i];
      process.stdout.write(`  [${i + 1}/${todo.length}] ${typeName}... `);

      try {
        const infoRes = await call(api, 'nodeInfo', { type: typeName });
        const info = infoRes.result;

        if (!info) {
          console.log('SKIP (null)');
          continue;
        }

        const pinCount = info.pinInfoCount || 0;
        const pins = [];

        for (let p = 0; p < pinCount; p++) {
          try {
            const pinRefRes = await call(api, 'nodePinInfo', { nodeType: typeName, pinIx: p });
            const handle = extractHandle(pinRefRes.result);

            if (!handle) {
              pins.push({ index: p, id: 'P_UNKNOWN', type: 'PT_UNKNOWN', staticName: '', staticLabel: '' });
              continue;
            }

            const piRes = await call(pinEx, 'getApiNodePinInfo', {
              nodePinInfoRef: { handle: String(handle), type: pinRefRes.result?.type || 0 },
            });
            const pi = piRes.nodePinInfo;

            if (!pi) {
              pins.push({ index: p, id: 'P_UNKNOWN', type: 'PT_UNKNOWN', staticName: '', staticLabel: '' });
              continue;
            }

            const pinEntry = {
              index: p,
              id: String(pi.id || 'P_UNKNOWN'),
              type: String(pi.type || 'PT_UNKNOWN'),
              staticName: pi.staticName || '',
              staticLabel: pi.staticLabel || '',
            };
            if (pi.defaultNodeType && String(pi.defaultNodeType) !== 'NT_UNKNOWN') {
              pinEntry.defaultNodeType = String(pi.defaultNodeType);
            }
            if (pi.description) pinEntry.description = pi.description;
            pins.push(pinEntry);
          } catch (pinErr) {
            pins.push({ index: p, id: 'P_UNKNOWN', type: 'PT_UNKNOWN', staticName: '', staticLabel: '', error: pinErr.message });
          }
        }

        cache.nodeTypes[typeName] = {
          name: typeName,
          description: info.description || '',
          outType: String(info.outType || 'PT_UNKNOWN'),
          category: info.category || '',
          defaultName: info.defaultName || '',
          nodeColor: info.nodeColor || 0,
          isHidden: !!info.isHidden,
          isCreatableByApi: info.isCreatableByApi !== false,
          pinInfoCount: pinCount,
          attributeInfoCount: info.attributeInfoCount || 0,
          movableInputPinCount: info.movableInputPinCount || 0,
          movableInputName: info.movableInputName || '',
          pins,
        };

        // Store numeric ID
        const numId = enumNameToId[typeName];
        if (numId !== undefined) {
          cache.nodeTypesByName[typeName] = String(numId);
        }

        console.log(`OK (${pinCount} pins)`);
        saveCache();

        // Small breathing room
        if (i % 5 === 4) await sleep(50);

      } catch (err) {
        console.log(`ERROR: ${err.message}`);
        saveCache();
        if (err.message.includes('ECONNRESET') || err.message.includes('ECONNREFUSED') || err.message.includes('UNAVAILABLE')) {
          console.log('\nOctane connection lost. Resetting stubs and waiting 10s...');
          resetStubs();
          await sleep(10000);
          // Try one more time with fresh stubs
          try {
            await call(api, 'octaneVersion');
            console.log('  Reconnected! Continuing...');
          } catch {
            console.log('  Still down. Run again to resume.');
            process.exit(1);
          }
        }
      }
    }

    // Update pending list
    cache._pending = (cache._pending || []).filter(t => !cache.nodeTypes[t]);
    saveCache();
  }

  // Phase 3: compatibility maps (only when all node types done)
  if ((cache._pending || []).filter(t => !cache.nodeTypes[t]).length === 0 && Object.keys(cache.compatibleTypes).length === 0) {
    console.log('\nPhase 3: Fetching compatibility maps...');
    for (const ptName of Object.keys(cache.pinTypes)) {
      try {
        const res = await call(api, 'getCompatibleTypes', { outType: ptName });
        const nodes = (res.compatNodes?.data || []).map(String);
        const graphs = (res.compatGraphs?.data || []).map(String);
        if (nodes.length > 0 || graphs.length > 0) {
          cache.compatibleTypes[ptName] = { nodes, graphs };
        }
      } catch { /* skip */ }
    }
    console.log(`  ${Object.keys(cache.compatibleTypes).length} compatibility maps`);

    // Clean up internal fields
    delete cache._pending;
    saveCache();
  }

  const size = (fs.statSync(OUTPUT).size / 1024).toFixed(1);
  const remaining = (cache._pending || []).filter(t => !cache.nodeTypes[t]).length;
  console.log(`\nDone. ${Object.keys(cache.nodeTypes).length} types cached, ${remaining} remaining. File: ${size} KB`);
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error('FATAL:', e.message); process.exit(1); });
