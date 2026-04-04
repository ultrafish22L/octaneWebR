/**
 * Build octaneServMcp.exe — standalone MCP server as a Node.js SEA.
 *
 * Pipeline:
 *   1. Run build-standalone.mjs → dist/standalone.cjs
 *   2. Generate manifest.json (proto file list)
 *   3. Generate sea-config.json with all embedded assets
 *   4. node --experimental-sea-config → sea-prep.blob
 *   5. Copy node.exe → octaneServMcp.exe
 *   6. Inject blob via postject
 *   7. Clean up temp files
 *
 * Output: dist/sea/octaneServMcp.exe
 *
 * Requirements:
 *   - Node.js 22+ (SEA assets API)
 *   - npx postject (auto-installed)
 */

import fs from 'fs';
import path from 'path';
import { execSync, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MCP_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(MCP_ROOT, '..');
const PROTO_DIR = path.resolve(REPO_ROOT, '..', 'octaneServGrpc', 'proto');
const SEA_OUT = path.join(MCP_ROOT, 'dist', 'sea');
const EXE_NAME = 'octaneServMcp.exe';

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', cwd: MCP_ROOT, ...opts });
}

function step(n, msg) {
  console.log(`\n[${'='.repeat(60)}]`);
  console.log(`  Step ${n}: ${msg}`);
  console.log(`[${'='.repeat(60)}]\n`);
}

async function build() {
  // ── Step 1: Build the standalone JS bundle ──────────────────────────
  step(1, 'Building standalone.cjs (esbuild, no externals)');
  run('node scripts/build-standalone.mjs');

  if (!fs.existsSync(path.join(MCP_ROOT, 'dist', 'standalone.cjs'))) {
    throw new Error('build-standalone.mjs did not produce dist/standalone.cjs');
  }

  // ── Step 2: Generate manifest.json ──────────────────────────────────
  step(2, 'Generating manifest.json (proto file inventory)');

  if (!fs.existsSync(PROTO_DIR)) {
    throw new Error(`Proto directory not found: ${PROTO_DIR}`);
  }

  const protoFiles = fs.readdirSync(PROTO_DIR).filter(f => f.endsWith('.proto'));
  console.log(`Found ${protoFiles.length} proto files`);

  // Collect docs/mcp/*.md files
  const DOCS_DIR = path.resolve(REPO_ROOT, 'docs', 'mcp');
  const docFiles = fs.existsSync(DOCS_DIR)
    ? fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'))
    : [];
  console.log(`Found ${docFiles.length} doc files`);

  const manifest = { protos: protoFiles, docs: docFiles };
  const manifestPath = path.join(MCP_ROOT, 'dist', 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // ── Step 3: Generate sea-config.json ────────────────────────────────
  step(3, 'Generating sea-config.json with embedded assets');

  const assets = {
    'manifest.json': manifestPath,
    'data/octane-api-cache.json': path.join(MCP_ROOT, 'data', 'octane-api-cache.json'),
  };

  // Add all proto files as assets
  for (const proto of protoFiles) {
    assets[`proto/${proto}`] = path.join(PROTO_DIR, proto);
  }

  // Add all doc files as assets
  for (const doc of docFiles) {
    assets[`docs/${doc}`] = path.join(DOCS_DIR, doc);
  }

  const seaConfig = {
    main: path.join(MCP_ROOT, 'dist', 'standalone.cjs'),
    output: path.join(MCP_ROOT, 'dist', 'sea-prep.blob'),
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: true,
    assets,
  };

  const seaConfigPath = path.join(MCP_ROOT, 'dist', 'sea-config.json');
  fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));

  const assetCount = Object.keys(assets).length;
  console.log(`SEA config: ${assetCount} assets (${protoFiles.length} protos, ${docFiles.length} docs, manifest, cache)`);

  // ── Step 4: Generate SEA blob ───────────────────────────────────────
  step(4, 'Generating SEA blob (node --experimental-sea-config)');
  run(`node --experimental-sea-config "${seaConfigPath}"`);

  const blobPath = path.join(MCP_ROOT, 'dist', 'sea-prep.blob');
  if (!fs.existsSync(blobPath)) {
    throw new Error('SEA blob generation failed — sea-prep.blob not found');
  }

  const blobSize = fs.statSync(blobPath).size;
  console.log(`Blob size: ${(blobSize / 1024 / 1024).toFixed(1)} MB`);

  // ── Step 5: Copy node.exe → octaneServMcp.exe ──────────────────────
  step(5, `Creating ${EXE_NAME}`);

  fs.mkdirSync(SEA_OUT, { recursive: true });
  const exePath = path.join(SEA_OUT, EXE_NAME);

  // Find the node binary
  const nodeBin = process.execPath;
  console.log(`Copying ${nodeBin} → ${exePath}`);
  fs.copyFileSync(nodeBin, exePath);

  // Remove code signature (Windows) — postject requires unsigned exe.
  // signtool may not be available, so we try and ignore failure.
  try {
    run(`signtool remove /s "${exePath}"`, { stdio: 'pipe' });
    console.log('Removed existing code signature');
  } catch (_) {
    console.log('No signtool or no signature to remove (OK)');
  }

  // ── Step 6: Inject SEA blob ─────────────────────────────────────────
  step(6, 'Injecting SEA blob via postject');

  const sentinel = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
  run(
    `npx --yes postject "${exePath}" NODE_SEA_BLOB "${blobPath}" ` +
    `--sentinel-fuse ${sentinel} --overwrite`
  );

  const exeSize = fs.statSync(exePath).size;
  console.log(`\n${EXE_NAME}: ${(exeSize / 1024 / 1024).toFixed(1)} MB`);

  // ── Step 7: Clean up temp files ─────────────────────────────────────
  step(7, 'Cleanup');

  for (const tmp of [seaConfigPath, manifestPath, blobPath]) {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }

  // ── Done ────────────────────────────────────────────────────────────
  console.log(`\nBuild complete: ${exePath}`);
  console.log(`\nUsage in .mcp.json:`);
  console.log(JSON.stringify({
    mcpServers: {
      octane: { command: `./${EXE_NAME}` }
    }
  }, null, 2));
}

build().catch((err) => {
  console.error('\nBuild failed:', err.message);
  process.exit(1);
});
