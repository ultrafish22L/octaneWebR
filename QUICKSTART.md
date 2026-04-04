# Quick Start

**OctaneWebR** is a browser UI and AI scene builder for Octane Render. The browser provides a scene outliner, node graph editor, parameter inspector, and live render viewport. The MCP server gives Claude 65+ tools to build scenes through natural language.

## Applications

The build produces four executables in `bin/{version}/`:

| Executable             | What it is                                                                                                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **octaneServGrpc.exe** | Standalone GPU render engine. C++ gRPC server embedding the Octane Render SDK — no separate octane.exe needed. Listens on port 51022 with 96 proto services.                                  |
| **octaneWebR.exe**     | Electron client. Hosts the React/TypeScript browser UI (scene outliner, node graph, inspector, live viewport) and the MCP server for AI scene building. Connects to octaneServGrpc over gRPC. |
| **octaneGrpcSE.exe**   | Integrated build — octaneServGrpc + octaneWebR bundled into a single executable. Launches the gRPC server and the Electron UI together.                                                       |
| **octaneServMcp.exe**  | Standalone MCP server. Self-contained Node.js SEA — no Node.js install required. Proto files, API cache, and docs are embedded. Produces `log_mcp.log` and `log_grpc.log` next to the exe.    |

## Launch (prebuilt binaries)

**Option A — Integrated (simplest)**

```
octaneGrpcSE.exe
```

Everything starts together. Skip to [AI Scene Building](#ai-scene-building-mcp).

**Option B — Separate processes (any start order)**

```bash
octaneServGrpc.exe              # GPU render server (tray app, port 51022)
octaneWebR.exe                  # Browser UI (optional — for visual preview)
```

These can start in any order. The UI shows "disconnected" until the server is ready, then reconnects automatically. GPU initialization takes 10-30 seconds.

## AI Scene Building (MCP)

Create a `.mcp.json` in your working directory (next to the exes, or wherever you launch Claude Code):

```json
{
  "mcpServers": {
    "octane": {
      "command": "./octaneServMcp.exe"
    }
  }
}
```

Open Claude Code in that directory. It reads `.mcp.json` and auto-starts the MCP server. Claude discovers all 65+ tools automatically. No Node.js install required.

Log files (`log_mcp.log`, `log_grpc.log`) are written next to `octaneServMcp.exe`.

### Optional: browser preview

Run `octaneWebR.exe` alongside to watch the scene build in real-time. The browser provides a scene outliner, node graph, parameter inspector, and live render viewport.

### Try it

```
"Create a red metallic sphere on a white floor with dramatic lighting"
```

Claude creates geometry, sets materials, positions the camera, lights the scene, and renders — showing you each step.

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

## Build

```bash
# Full rebuild (C++ servers + Electron app + MCP exe)
build.bat

# Individual targets
build.bat grpc              # C++ servers only
build.bat electron          # Electron app only
build.bat mcp               # MCP standalone exe only

# Demo SDK builds
build.bat --demo            # all targets with demo SDK
build.bat grpc --demo       # C++ servers with demo SDK
```

Output goes to `bin/{version}/` (or `bin/{version}_DEMO/` for demo builds).

## Environment Variables (optional)

No env vars are required for default usage. These are available for advanced configuration:

| Variable            | Default     | Purpose                                                   |
| ------------------- | ----------- | --------------------------------------------------------- |
| `OCTANE_HOST`       | `127.0.0.1` | gRPC host                                                 |
| `OCTANE_PORT`       | `51022`     | gRPC port                                                 |
| `WORKER_1`          | `43929`     | Web UI port                                               |
| `OCTANE_FILE_ROOTS` | `cwd`       | Dirs MCP/UI can read/write (`*` = unrestricted)           |
| `GRPC_DEBUG_LOG`    | `1`         | Log gRPC calls to `log_grpc.log` (`0` to disable)         |
| `ANTHROPIC_API_KEY` | —           | Required only for VLM scoring (score_render, analyze_geo) |

## Next Steps

- [docs/mcp/README.md](docs/mcp/README.md) — Full MCP guide (65 tools)
- [docs/mcp/BUILD.md](docs/mcp/BUILD.md) — Build workflow (SCRATCH, DRESS, SHOW)
- [docs/mcp/REFERENCE.md](docs/mcp/REFERENCE.md) — Node types, attributes, material presets
- [docs/mcp/CREATIVE.md](docs/mcp/CREATIVE.md) — Lighting, materials, composition
