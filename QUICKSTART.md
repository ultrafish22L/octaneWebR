# Quick Start

**OctaneWebR** is a browser UI and AI scene builder for Octane Render. The browser provides a scene outliner, node graph editor, parameter inspector, and live render viewport. The MCP server gives Claude 65+ tools to build scenes through natural language.

## Applications

The build produces three executables in `bin/{version}/`:

| Executable             | What it is                                                                                                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **octaneServGrpc.exe** | Standalone GPU render engine. C++ gRPC server embedding the Octane Render SDK — no separate octane.exe needed. Listens on port 51022 with 96 proto services.                                  |
| **octaneWebR.exe**     | Electron client. Hosts the React/TypeScript browser UI (scene outliner, node graph, inspector, live viewport) and the MCP server for AI scene building. Connects to octaneServGrpc over gRPC. |
| **octaneGrpcSE.exe**   | Integrated build — octaneServGrpc + octaneWebR bundled into a single executable. Launches the gRPC server and the Electron UI together.                                                       |

## Launch (prebuilt binaries)

**Option A — Integrated (simplest)**

```
octaneGrpcSE.exe
```

Everything starts together. Skip to [Verify](#verify).

**Option B — Separate processes**

```bash
# 1. Start the render server
octaneServGrpc.exe
# Wait ~5s for gRPC on port 51022

# 2. Start the client
octaneWebR.exe
```

## Launch (from source)

### Prerequisites

- **octaneServGrpc** running on port 51022 (see `../octaneServGrpc/QUICKSTART.md`)
- Node.js 18+
- Claude Code or Claude Desktop (for AI scene building)

### Install & Build

```bash
npm install && cd mcp && npm install && cd ..    # install dependencies
cd mcp && npm run build && cd ..                 # build MCP server (esbuild, 10ms)
```

> **Never use `tsc` for MCP builds** — it OOMs. Always use `npm run build` (esbuild).

### Start

Order matters — gRPC server must be running first.

```bash
# 1. Start octaneServGrpc (if not already running)
octaneServGrpc/build/Release/octaneServGrpc.exe &

# 2. Wait ~5s, verify port 51022 is listening

# 3. Start web UI
npm run dev
```

Open **http://localhost:43929** in your browser.

## Verify

1. Browser scene tree should populate (load a scene in Octane if empty)
2. Render viewport shows a live image
3. Select a node — inspector shows properties

## AI Scene Building (MCP)

Open Claude Code in the `octaneWebR` directory. It reads `.mcp.json` and connects automatically.

Try: `"Create a blue metallic sphere on a white floor, lit by sunset daylight"`

Claude creates nodes, sets materials, positions the camera, and renders — while you watch in the browser.

## Environment Variables

| Variable            | Default     | Purpose                                           |
| ------------------- | ----------- | ------------------------------------------------- |
| `OCTANE_HOST`       | `127.0.0.1` | gRPC host                                         |
| `OCTANE_PORT`       | `51022`     | gRPC port                                         |
| `WORKER_1`          | `43929`     | Web UI port                                       |
| `OCTANE_FILE_ROOTS` | `~`         | Dirs MCP/UI can read/write (`*` = unrestricted)   |
| `GRPC_DEBUG_LOG`    | `1`         | Log gRPC calls to `log_grpc.log` (`0` to disable) |

## Next Steps

- [docs/mcp/README.md](docs/mcp/README.md) — Full MCP guide (65 tools)
- [docs/mcp/BUILD.md](docs/mcp/BUILD.md) — Build workflow (SCRATCH, DRESS, SHOW)
- [docs/mcp/REFERENCE.md](docs/mcp/REFERENCE.md) — Node types, attributes, material presets
- [docs/mcp/CREATIVE.md](docs/mcp/CREATIVE.md) — Lighting, materials, composition
