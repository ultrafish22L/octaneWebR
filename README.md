# OctaneWebR

A browser-based UI for Octane Render Studio, built with React and TypeScript. OctaneWebR communicates with Octane through its gRPC LiveLink API, providing a scene outliner, node graph editor, parameter inspector, and live render viewport — all running in the browser. An MCP server lets AI agents (Claude) build and modify Octane scenes programmatically.

## Quick Start

### Prerequisites

- **Octane Render** with gRPC enabled (File > Preferences > GRPC API > Enable)
- **Node.js 18+**

### Install and Run

```bash
npm install
npm run dev
```

Open **http://localhost:43929**. The app connects to Octane at `localhost:51022` by default.

## Architecture

OctaneWebR is a Vite application with an embedded gRPC plugin that handles all API proxying, WebSocket callbacks, and file browser endpoints. There is no separate backend server — the Vite plugin bridges the browser to Octane's gRPC API directly.

```
Browser  -->  Vite Dev Server (port 43929)  -->  Octane gRPC (port 51022)
              - HTTP proxy (/api/grpc/*)
              - WebSocket (/ws) for callbacks and render streaming
              - File browser (/api/files/*)
```

**Stack:** React 18, TypeScript (strict mode), Vite, ReactFlow v12, React Query

**Client services:** 11 modular service wrappers extending `BaseService`, fronted by `OctaneClient.ts` as the main API facade.

## Features

### Scene Outliner

Virtualized hierarchical tree with type-specific icons, visibility toggles, and selection sync. Tabs for Scene, LiveDB (OTOY cloud library), and LocalDB (local materials).

### Node Graph Editor

ReactFlow-based editor supporting 755+ Octane node types across 25 categories. Drag-and-drop connections, multi-select, copy/paste, connection cutter (Ctrl+Drag), search (Ctrl+F), and minimap.

### Node Inspector

Real-time parameter editing: booleans, numbers (with scrub controls), vectors, color pickers, enum dropdowns, text fields, and collapsible groups. Supports node type replacement via dropdown.

### Render Viewport

Live render streaming with orbit/pan/zoom camera controls. Picker tools for material, object, focus distance, camera target, and white balance. Render region selection.

### Menu System

File (New/Open/Save/Package), Edit (Undo/Redo/Cut/Copy/Paste), Script (Batch/Daylight/Turntable), View (panel toggles, F5 refresh), Window (Material DB, Fullscreen), Help.

### Themes

Three CSS variable themes with 134 variables each: **Vibe** (default, pastel purple), **Octane** (dark professional), **Debug** (colored layout borders for development).

## MCP Server

The MCP server exposes Octane's gRPC API to AI agents via stdio transport. Claude can create nodes, set materials, position cameras, trigger renders, and modify scenes while OctaneWebR visualizes changes in real time.

```
Claude Code  <--stdio-->  MCP Server  <--gRPC-->  Octane  <--gRPC-->  OctaneWebR
```

### Setup

The `.mcp.json` config is already in the project root. To build and run manually:

```bash
cd mcp
npm install
npm run build
npm run mcp:start
```

**27 tools** organized by category: project management, camera, rendering, scene tree, node creation/deletion, attribute get/set, pin connections, and webapp sync.

### Companion MCPs

- [Octane Docs MCP](https://octane-mcp.otoy.ai/sse) — Octane Lua API documentation and examples
- [OTOY Studio](https://otoy.studio/) — AI-generated 3D assets, textures, video, and music

## Project Structure

```
octaneWebR/
├── client/src/
│   ├── components/              # React components (Viewport, NodeGraph, Outliner, Inspector)
│   ├── services/octane/         # 11 gRPC service wrappers
│   ├── services/OctaneClient.ts # Main API facade
│   ├── hooks/                   # React hooks
│   ├── utils/                   # Logger, formatters, helpers
│   ├── constants/               # Node types (755+), icon mappings
│   ├── styles/                  # CSS themes and component styles
│   └── App.tsx                  # Root component
├── server/
│   ├── proto/                   # Protobuf definitions
│   └── src/                     # gRPC server utilities
├── mcp/src/                     # MCP server (27 tools, stdio transport)
├── vite-plugin-octane-grpc.ts   # Vite plugin: proxy, WebSocket, file browser
├── api-version.config.js        # API version configuration
└── docs/
    ├── project/                 # Architecture, improvements, test plan, changelog
    ├── mcp/                     # MCP reference, cheatsheet, build protocols, creative guides
    ├── ui/                      # UI implementation notes
    └── recipes/                 # Scene recipes and creative briefs
```

## Environment Variables

| Variable            | Default     | Purpose                                                         |
| ------------------- | ----------- | --------------------------------------------------------------- |
| `OCTANE_HOST`       | `127.0.0.1` | Octane gRPC host                                                |
| `OCTANE_PORT`       | `51022`     | Octane gRPC port                                                |
| `WORKER_1`          | `43929`     | Vite dev server port                                            |
| `OCTANE_BIND_HOST`  | `0.0.0.0`   | Network bind address (set to `127.0.0.1` on untrusted networks) |
| `OCTANE_FILE_ROOTS` | —           | Additional file browser root paths                              |

## Development

```bash
npm run dev          # Dev server with HMR (port 43929)
npm run build        # Production build
npm run lint         # ESLint (flat config)
npx tsc --noEmit     # Type check
```

Pre-commit hooks (Husky) run linting and type checks automatically.

## Documentation

- [QUICKSTART.md](./QUICKSTART.md) — Detailed setup guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Architecture and design patterns
- [CHANGELOG.md](./CHANGELOG.md) — Version history
- [docs/mcp/OCTANE_MCP.md](./docs/mcp/OCTANE_MCP.md) — MCP technical reference

### External Resources

- [Octane SE Manual](https://docs.otoy.com/standaloneSE/CoverPage.html)
- [Octane Help Agent](https://octane-agent.pages.dev/)
- [ReactFlow v12 Docs](https://reactflow.dev/)

---

OTOY &copy; 2026. Octane Render and OTOY are registered trademarks of OTOY Inc.

**Version 2.0.0** | Active Development
