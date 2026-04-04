/**
 * Build a fully self-contained MCP server bundle (no externals).
 *
 * Unlike the regular `npm run build` (which marks grpc-js, proto-loader,
 * mcp/sdk, and zod as external), this bundles EVERYTHING into one CJS file
 * suitable for Node.js Single Executable Application (SEA) packaging.
 *
 * Key differences from the dev build:
 *   - No --external flags — all npm deps are inlined
 *   - esbuild plugin inlines the dynamic require() of OctaneGrpcClientBase
 *   - Banner patches __dirname for SEA mode (exe directory, not source tree)
 */

import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MCP_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(MCP_ROOT, '..');

/**
 * Plugin A: Inline the dynamic require(GRPC_CLIENT_PATH).
 *
 * OctaneMcpClient.ts computes a path at runtime and calls require() on it.
 * esbuild can't follow dynamic requires. This plugin rewrites the source
 * at build time to use a static require that esbuild CAN bundle.
 */
const inlineGrpcClientPlugin = {
  name: 'inline-grpc-client',
  setup(build) {
    build.onLoad({ filter: /OctaneMcpClient\.ts$/ }, async (args) => {
      let contents = await fs.promises.readFile(args.path, 'utf8');

      // Replace the dynamic require with a static one
      contents = contents.replace(
        /const grpcModule = require\(GRPC_CLIENT_PATH\) as GrpcModule;/,
        `const grpcModule = require('../../server/dist/grpc/OctaneGrpcClientBase') as GrpcModule;`
      );

      // SERVER_ROOT is still used by the GrpcClientBase constructor for proto path.
      // In standalone/SEA mode, OCTANE_PROTO_DIR env var overrides it (set by sea-entry.cjs).
      // Keep SERVER_ROOT as a fallback for non-SEA usage of the standalone bundle.

      return { contents, loader: 'ts' };
    });
  },
};

/**
 * Plugin B: Resolve relative requires from OctaneGrpcClientBase.js.
 *
 * The gRPC client lives at server/dist/grpc/ and requires:
 *   ../../../api-version.config.js
 *   ../../../grpc-constants.js
 * These resolve relative to server/dist/grpc/ → repo root.
 */
const resolveServerRelativesPlugin = {
  name: 'resolve-server-relatives',
  setup(build) {
    // When resolving from server/dist/grpc/*, map ../../../ X to repo root X
    build.onResolve({ filter: /^\.\.\/\.\.\/\.\.\/(?:api-version\.config|grpc-constants)/ }, (args) => {
      const basename = path.basename(args.path);
      return { path: path.resolve(REPO_ROOT, basename) };
    });
  },
};

/**
 * Plugin C: Patch gRPC log path in OctaneGrpcClientBase.js.
 *
 * The compiled JS has:
 *   const logPath = path_1.default.resolve(__dirname, '..', '..', '..', 'log_grpc.log');
 *
 * In standalone/SEA mode, __dirname is meaningless (bundle root, not source tree).
 * Replace with env var check so log lands next to the exe.
 */
const patchGrpcLogPathPlugin = {
  name: 'patch-grpc-log-path',
  setup(build) {
    build.onLoad({ filter: /OctaneGrpcClientBase\.js$/ }, async (args) => {
      let contents = await fs.promises.readFile(args.path, 'utf8');

      contents = contents.replace(
        /const logPath = path_1\.default\.resolve\(__dirname, '\.\.', '\.\.', '\.\.', 'log_grpc\.log'\);/,
        `const logPath = process.env.OCTANE_MCP_LOG_DIR ` +
        `? path_1.default.join(process.env.OCTANE_MCP_LOG_DIR, 'log_grpc.log') ` +
        `: path_1.default.resolve(__dirname, '..', '..', '..', 'log_grpc.log');`
      );

      return { contents, loader: 'js' };
    });
  },
};

// Banner: In SEA mode, extract embedded assets (protos, API cache) to a temp
// directory and set env vars BEFORE any bundle code runs.
//
// NOTE: Do NOT override __dirname — the bundle has multiple path.resolve(__dirname, ...)
// calls with different relative depths. Instead, set targeted env vars that
// the source code checks.
const seaBanner = `
try {
  var __sea_mod = require('node:sea');
  if (__sea_mod.isSea()) {
    var __sea_fs = require('fs');
    var __sea_path = require('path');
    var __sea_os = require('os');
    var __sea_exeDir = __sea_path.dirname(process.execPath);

    // Extract embedded assets to temp dir
    var __sea_tmp = __sea_path.join(__sea_os.tmpdir(), 'octane-mcp-' + process.pid);
    __sea_fs.mkdirSync(__sea_path.join(__sea_tmp, 'proto'), { recursive: true });
    __sea_fs.mkdirSync(__sea_path.join(__sea_tmp, 'data'), { recursive: true });

    // Extract proto files
    var __sea_manifest = JSON.parse(__sea_mod.getAsset('manifest.json', 'utf8'));
    for (var __sea_i = 0; __sea_i < __sea_manifest.protos.length; __sea_i++) {
      var __sea_name = __sea_manifest.protos[__sea_i];
      __sea_fs.writeFileSync(
        __sea_path.join(__sea_tmp, 'proto', __sea_name),
        __sea_mod.getAsset('proto/' + __sea_name, 'utf8')
      );
    }

    // Extract API cache
    __sea_fs.writeFileSync(
      __sea_path.join(__sea_tmp, 'data', 'octane-api-cache.json'),
      __sea_mod.getAsset('data/octane-api-cache.json', 'utf8')
    );

    // Extract docs (MCP resources — BUILD.md, REFERENCE.md, etc.)
    __sea_fs.mkdirSync(__sea_path.join(__sea_tmp, 'docs'), { recursive: true });
    for (var __sea_di = 0; __sea_di < __sea_manifest.docs.length; __sea_di++) {
      var __sea_doc = __sea_manifest.docs[__sea_di];
      __sea_fs.writeFileSync(
        __sea_path.join(__sea_tmp, 'docs', __sea_doc),
        __sea_mod.getAsset('docs/' + __sea_doc, 'utf8')
      );
    }

    // Set env vars for the MCP server code:
    //   OCTANE_PROTO_DIR     — proto files (read by api-version.config.js getProtoDir())
    //   OCTANE_MCP_CACHE_DIR — API cache + scoreboard (read by ApiCache.ts, import.ts)
    //   OCTANE_MCP_LOG_DIR   — log files next to the exe (read by OctaneMcpClient.ts, OctaneGrpcClientBase.js)
    //   OCTANE_MCP_DOCS_DIR  — docs for MCP resources (read by resources.ts)
    process.env.OCTANE_PROTO_DIR = __sea_path.join(__sea_tmp, 'proto');
    process.env.OCTANE_MCP_CACHE_DIR = __sea_path.join(__sea_tmp, 'data');
    process.env.OCTANE_MCP_LOG_DIR = __sea_exeDir;
    process.env.OCTANE_MCP_DOCS_DIR = __sea_path.join(__sea_tmp, 'docs');

    // Cleanup temp dir on exit
    var __sea_cleanup = function() {
      try { __sea_fs.rmSync(__sea_tmp, { recursive: true, force: true }); } catch(_) {}
    };
    process.on('exit', __sea_cleanup);
    process.on('SIGINT', function() { __sea_cleanup(); process.exit(0); });
    process.on('SIGTERM', function() { __sea_cleanup(); process.exit(0); });
  }
} catch (_) {}
`;

async function build() {
  // Read version from package.json at build time so the SEA exe doesn't need it at runtime.
  const pkg = JSON.parse(fs.readFileSync(path.join(MCP_ROOT, 'package.json'), 'utf8'));

  const result = await esbuild.build({
    entryPoints: [path.join(MCP_ROOT, 'src/index.ts')],
    bundle: true,
    outfile: path.join(MCP_ROOT, 'dist/standalone.cjs'),
    platform: 'node',
    target: 'es2020',
    format: 'cjs',
    sourcemap: false,
    banner: { js: seaBanner },
    define: { '__MCP_VERSION__': JSON.stringify(pkg.version) },
    plugins: [inlineGrpcClientPlugin, resolveServerRelativesPlugin, patchGrpcLogPathPlugin],
    // No externals — bundle everything
    logLevel: 'info',
  });

  if (result.errors.length > 0) {
    console.error('Build failed');
    process.exit(1);
  }

  const stat = fs.statSync(path.join(MCP_ROOT, 'dist/standalone.cjs'));
  console.log(`standalone.cjs: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
