# Build Guide

App-level build instructions for octaneWebR (React UI + Electron). For MCP server build workflow (scene building), see [mcp/BUILD.md](mcp/BUILD.md).

## Prerequisites

- Node.js 18+
- octaneServGrpc running on port 51022

## Commands

```bash
# Install
npm install
cd mcp && npm install && cd ..

# Dev server (HMR, port 43929)
npm run dev

# Production build
npm run build

# MCP server (esbuild — NEVER use tsc, it OOMs)
cd mcp && npm run build

# Lint
npm run lint

# Tests (289 tests, Vitest)
npm test
```

## Electron Build

```bash
npm run electron:build     # Packages standalone .exe
```

Electron uses `GrpcProxyServer` (separate compile step via `build:grpc-server`). The `npm run build` command includes this automatically.

Known issue: `log_grpc.log` writes to `__dirname` which is inside the read-only asar in packaged builds. See `octaneServGrpc/docs/TODO.md` § Electron Packaging.

## Environment Variables

| Variable            | Default     | Purpose                                           |
| ------------------- | ----------- | ------------------------------------------------- |
| `OCTANE_HOST`       | `127.0.0.1` | gRPC host                                         |
| `OCTANE_PORT`       | `51022`     | gRPC port                                         |
| `WORKER_1`          | `43929`     | Dev server port                                   |
| `OCTANE_BIND_HOST`  | `0.0.0.0`   | Network bind address                              |
| `OCTANE_FILE_ROOTS` | `~`         | Dirs MCP/UI can read/write (`*` = unrestricted)   |
| `GRPC_DEBUG_LOG`    | `1`         | Log gRPC calls to `log_grpc.log` (`0` to disable) |

## Logging

| File             | Source                             | Notes                                                            |
| ---------------- | ---------------------------------- | ---------------------------------------------------------------- |
| `log_grpc.log`   | OctaneGrpcClientBase + Vite plugin | Client-side gRPC calls. Cleared on dev server start.             |
| `log_mcp.log`    | MCP server                         | `MCP_LOG_LEVEL` overrides global. Cleared on MCP start.          |
| `log_client.log` | Browser Logger (via `/api/log`)    | Client JS errors batched to server. Cleared on dev server start. |
| `log_serv.log`   | octaneServGrpc (C++ server)        | Server-side RPCs. In `build/Release/` next to exe.               |

See `octaneServGrpc/docs/BUILD.md` § Logging for log levels and patterns.

## Project Structure

```
octaneWebR/
├── client/src/
│   ├── components/       # React UI (Viewport, NodeGraph, Outliner, Inspector)
│   ├── services/         # 11 gRPC service wrappers + OctaneClient facade
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Logger, formatters, icon mappers
│   ├── constants/        # Node types (755+), icon mappings, protocol enums
│   └── styles/           # CSS themes (vibe, octane, debug — 134 vars each)
├── server/
│   ├── proto/            # Protobuf definitions
│   └── src/grpc/         # Shared gRPC client (OctaneGrpcClientBase)
├── shared/               # Protocol constants (AttrType, AttributeId, etc.)
├── mcp/                  # MCP server (separate package, 78 tools)
├── electron/             # Electron main + preload
├── native/               # D3D11 shared surface native addon
└── vite-plugin-octane-grpc.ts  # Embedded proxy plugin
```

## Stack

React 18, TypeScript (strict), Vite, ReactFlow v12, React Query, gRPC, esbuild (MCP), Electron (dist builds)
