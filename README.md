# OctaneWebR v2.4.0

A browser-based UI for Octane Render Studio, built with React and TypeScript. OctaneWebR communicates with Octane through its gRPC LiveLink API, providing a scene outliner, node graph editor, parameter inspector, and live render viewport — all running in the browser.

An MCP server lets AI agents (Claude) build and modify Octane scenes programmatically while the browser UI shows every change in real time.

## Quick Start

```bash
npm install && cd mcp && npm install && cd ..   # Install dependencies
cd mcp && npm run build && cd ..                 # Build MCP server
npm run dev                                      # Start web UI (port 43929)
```

> Octane must be running with gRPC enabled first. See [QUICKSTART.md](./QUICKSTART.md) for full setup.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Octane (gRPC :51022)                      │
└──────────┬───────────────────────────────────┬───────────────────┘
           │ gRPC                               │ gRPC
┌──────────┴──────────┐              ┌─────────┴──────────┐
│  Vite Dev Server    │              │   MCP Server       │
│  HTTP proxy + WS    │              │   stdio transport   │
│  port 43929         │              │   78 tools          │
└──────────┬──────────┘              └─────────┬──────────┘
           │ HTTP/WS                            │ stdio
┌──────────┴──────────┐              ┌─────────┴──────────┐
│   Browser UI        │              │  Claude Desktop    │
│   React + ReactFlow │              │  (code tab) or     │
│   Live render       │              │  Claude Code CLI   │
└─────────────────────┘              └────────────────────┘
```

Both paths use the same shared gRPC client with a compatibility layer for different Octane builds (see `docs/mcp/ALPHA5_COMPAT.md`).

**Stack:** React 18, TypeScript (strict), Vite, ReactFlow v12, React Query, gRPC

## Features

### Browser UI

- **Scene Outliner** — Virtualized tree with type icons, visibility toggles, selection sync. Tabs for Scene, LiveDB, and LocalDB.
- **Node Graph Editor** — 755+ node types across 25 categories. Drag-and-drop connections, multi-select, copy/paste, connection cutter, search, minimap.
- **Node Inspector** — Real-time editing: booleans, numbers with scrub controls, vectors, color pickers, enums, text fields, collapsible groups.
- **Render Viewport** — Live render streaming with orbit/pan/zoom. Picker tools for material, object, focus distance, camera target, white balance. Render region selection.
- **Menu System** — File, Edit, Script (batch/daylight/turntable), View, Window, Help.
- **Themes** — Vibe (pastel purple, default), Octane (dark pro), Debug (colored borders).

### MCP Server (AI Scene Builder)

78 tools let AI agents control Octane through natural language:

| Category            | Count | What They Do                                                                  |
| ------------------- | ----- | ----------------------------------------------------------------------------- |
| **Nodes**           | 11    | Create, delete, connect, disconnect, find, duplicate, rename, inspect         |
| **Attributes**      | 6     | Get/set values, enumerate all attributes, pin value shortcut, animation check |
| **Render**          | 7     | Start/stop, status, save image, AOVs, multi-pass export                       |
| **Render Control**  | 6     | Clay mode, GPU priority, sub-sampling (get/set each)                          |
| **Stats**           | 5     | Geometry, texture, resource stats, scene bounds, render state                 |
| **Camera**          | 3     | Get/set position and target, fit camera to bounding box                       |
| **Animation**       | 5     | Read/write keyframes, animation range, clear animation                        |
| **Art Direction**   | 6     | Composition planning, spatial validation, vision critic loop                  |
| **Creative**        | 2     | Material and lighting recipe suggestions                                      |
| **Color/MaterialX** | 4     | OCIO config, color spaces, MaterialX import/list                              |
| **Project**         | 3     | Load, save, reset scenes                                                      |
| **Import**          | 1     | GLB import with OBJ conversion, textures, material wiring                     |
| **System**          | 9     | Version, device info, node types, profiling, log, webapp sync                 |

**MCP + OctaneWebR together** is the best experience: ask Claude to build a scene in your terminal while watching every node, connection, and render update live in the browser.

```
You: "Create a gold sphere on a dark floor with dramatic side lighting"

Claude: Creates RT → frames camera → sphere mesh + gold material → renders →
        environment → floor mesh → area light → hero camera → final render

Browser: Shows every node appearing in the outliner, connections forming in
         the graph, and the render updating in real time.
```

### Companion MCP Servers

The `.mcp.json` also connects:

- **[Octane Docs MCP](https://octane-mcp.otoy.ai/sse)** — Search Octane's API docs, browse modules, find examples
- **[OTOY Studio MCP](https://otoy.studio/)** — AI images, 3D, video, music, vision

## Project Structure

```
octaneWebR/
├── client/src/
│   ├── components/              # React UI (Viewport, NodeGraph, Outliner, Inspector)
│   ├── services/octane/         # 11 gRPC service wrappers
│   ├── services/OctaneClient.ts # Main API facade
│   ├── hooks/                   # React hooks
│   ├── utils/                   # Logger, formatters, helpers
│   ├── constants/               # Node types (755+), icon mappings, protocol enums
│   └── styles/                  # CSS themes (134 variables each)
├── server/proto/                # Protobuf definitions
├── shared/                      # Shared constants (AttrType, AttributeId, etc.)
├── mcp/src/                     # MCP server (78 tools, SceneCache, ApiCache)
│   ├── tools/                   # Tool implementations by category
│   ├── types/                   # TypeScript interfaces (GrpcClientTypes)
│   └── __tests__/               # Unit tests
├── vite-plugin-octane-grpc.ts   # Vite plugin: proxy, WebSocket, file browser
├── .mcp.json                    # MCP server configuration
├── temp/                        # Renders, test output, scratch (not committed)
└── docs/
    ├── mcp/                     # MCP docs: user guide, reference, build protocols, creative
    ├── project/                 # Architecture, changelog, improvements, test plan
    ├── ui/                      # UI implementation notes
    └── recipes/                 # Scene recipes (creative briefs)
```

## Environment Variables

| Variable            | Default     | Purpose                                                        |
| ------------------- | ----------- | -------------------------------------------------------------- |
| `OCTANE_HOST`       | `127.0.0.1` | Octane gRPC host                                               |
| `OCTANE_PORT`       | `51022`     | Octane gRPC port                                               |
| `WORKER_1`          | `43929`     | Dev server port                                                |
| `OCTANE_BIND_HOST`  | `0.0.0.0`   | Network bind address (use `127.0.0.1` on untrusted networks)   |
| `OCTANE_FILE_ROOTS` | —           | Allowed file browser roots (comma-separated)                   |
| `GRPC_DEBUG_LOG`    | `1`         | Log mutating gRPC calls to `log_grpc.log` (set `0` to disable) |

## Development

```bash
npm run dev          # Dev server with HMR (port 43929)
npm run build        # Production build
npm run lint         # ESLint
npm test             # 281 tests (Vitest)
npx tsc --noEmit     # Type check
```

Pre-commit hooks (Husky) run linting and type checks automatically.

## Documentation

| Doc                                                            | What's In It                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| [QUICKSTART.md](./QUICKSTART.md)                               | Full setup guide — running in 5 minutes                         |
| [docs/mcp/README.md](./docs/mcp/README.md)                     | Complete MCP user guide — all 78 tools, tips, pitfalls          |
| [docs/mcp/REFERENCE.md](./docs/mcp/REFERENCE.md)               | Lookup tables — pin layouts, node types, attribute IDs, presets |
| [docs/mcp/BUILD.md](./docs/mcp/BUILD.md)                       | Build protocols — SCRATCH, FRESH, DRESS, SHOW                   |
| [docs/mcp/CREATIVE.md](./docs/mcp/CREATIVE.md)                 | Creative guide — lighting, materials, composition               |
| [docs/mcp/TROUBLESHOOTING.md](./docs/mcp/TROUBLESHOOTING.md)   | Known issues and workarounds                                    |
| [docs/project/ARCHITECTURE.md](./docs/project/ARCHITECTURE.md) | Architecture and design patterns                                |
| [docs/project/CHANGELOG.md](./docs/project/CHANGELOG.md)       | Version history                                                 |

### External Resources

- [Octane SE Manual](https://docs.otoy.com/standaloneSE/CoverPage.html)
- [Octane Help Agent](https://octane-agent.pages.dev/)
- [ReactFlow v12 Docs](https://reactflow.dev/)

---

OTOY &copy; 2026. Octane Render and OTOY are registered trademarks of OTOY Inc.
