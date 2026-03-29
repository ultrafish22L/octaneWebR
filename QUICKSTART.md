# OctaneWebR v2.4.4 — Quick Start

Get the browser UI and AI scene builder running in under 5 minutes.

OctaneWebR provides two interfaces to Octane: a browser UI for visual editing, and an MCP server that lets AI (Claude) build scenes through natural language. MCP (Model Context Protocol) is a standard that lets AI assistants use external tools — in this case, 78 tools for controlling Octane.

## §1 Prerequisites

- **Octane Render Studio 2026.1+** with gRPC enabled
- **Node.js 18+**
- **Claude Desktop or Claude Code CLI** (for MCP / AI scene building)

## §2 gRPC Server

`octaneServGrpc` listens on `127.0.0.1:51022` by default. No configuration needed.

## §3 Install

```bash
git clone <repo-url> octaneWebR
cd octaneWebR
npm install
cd mcp && npm install && cd ..
```

## §4 Build MCP Server

```bash
cd mcp && npm run build && cd ..
```

Compiles to `mcp/dist/index.js`. Rebuild only when MCP code changes.

## §5 Launch

**Order matters.** The gRPC server must be running before anything connects to it.

```bash
# 1. Launch octaneServGrpc
octaneServGrpc/build/Release/octaneServGrpc.exe &

# 2. Wait for gRPC to start (~5 seconds)
#    Verify (PowerShell): Get-NetTCPConnection -LocalPort 51022

# 3. Start the web UI
npm run dev
```

Open **http://localhost:43929** in your browser.

## §6 Verify

1. In Octane, load any scene (or create a Render Target)
2. The browser's left panel should populate with the scene tree
3. The render viewport should show a live image
4. Select a node — the inspector panel shows its properties

## §7 MCP Setup

Open Claude Code CLI or Claude Desktop's code tab in the `octaneWebR` directory. Both read `.mcp.json` automatically and connect to the Octane MCP server.

**Try these prompts:**

```
"Create a scene with a blue metallic sphere on a white floor, lit by sunset daylight"

"Add a gold torus floating above the sphere and render it"

"Frame the camera from a low dramatic angle and save the render"
```

Claude creates nodes, sets materials, positions the camera, and triggers renders — all while you watch in the browser.

### What's Connected

The `.mcp.json` registers three MCP servers:

| Server          | What It Does                                                   |
| --------------- | -------------------------------------------------------------- |
| **octane**      | Scene control — nodes, materials, camera, rendering (78 tools) |
| **octane-docs** | Search Octane's API documentation and examples                 |
| **otoy-studio** | AI images, 3D, video, music, vision                            |

## §8 Web UI Only

If you only want the browser interface:

```bash
# 1. Start octaneServGrpc
octaneServGrpc/build/Release/octaneServGrpc.exe &

# 2. Start the dev server
npm run dev
```

Open http://localhost:43929. Full scene outliner, node graph editor, parameter inspector, and live render viewport.

## §9 MCP Only

If you only want AI control without the browser:

```bash
# 1. Build the MCP server (if not already built)
cd mcp && npm run build && cd ..

# 2. Start octaneServGrpc
octaneServGrpc/build/Release/octaneServGrpc.exe &

# 3. Open the project in Claude Desktop's code tab or Claude Code CLI
#    MCP connects via .mcp.json automatically
```

Claude can build scenes, render, and save images without the web UI running.

## §10 Environment Variables

| Variable            | Default     | Purpose                                                                                  |
| ------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| `OCTANE_HOST`       | `127.0.0.1` | Octane gRPC host                                                                         |
| `OCTANE_PORT`       | `51022`     | Octane gRPC port                                                                         |
| `WORKER_1`          | `43929`     | Web UI port                                                                              |
| `OCTANE_BIND_HOST`  | `0.0.0.0`   | Network bind address (use `127.0.0.1` on open networks)                                  |
| `OCTANE_FILE_ROOTS` | `~`         | Comma-separated dirs MCP/UI can read/write (scenes, renders, meshes). `*` = unrestricted |
| `GRPC_DEBUG_LOG`    | `1`         | Log gRPC calls to `log_grpc.log` (set `0` to disable)                                    |

## Troubleshooting

| Problem                      | Fix                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------- |
| Browser shows "Disconnected" | Is Octane running? Is gRPC enabled on port 51022?                                |
| Empty scene tree             | Load a scene in Octane, then press F5 in the browser                             |
| MCP tools fail               | Did you build? `cd mcp && npm run build`                                         |
| Blurry render                | DOF is auto-disabled for new scenes; for loaded scenes, set camera aperture to 0 |
| Octane not responding        | Check for blocking dialogs in the Octane window                                  |

## Next Steps

- **[docs/mcp/README.md](docs/mcp/README.md)** — Full MCP user guide with all 78 tools, tips, and pitfalls
- **[docs/mcp/BUILD.md](docs/mcp/BUILD.md)** — Build protocols: SCRATCH, FRESH, DRESS, SHOW
- **[docs/mcp/CREATIVE.md](docs/mcp/CREATIVE.md)** — Lighting, materials, composition guide
- **[docs/mcp/REFERENCE.md](docs/mcp/REFERENCE.md)** — Node types, pin layouts, attribute IDs
- **[docs/mcp/TROUBLESHOOTING.md](docs/mcp/TROUBLESHOOTING.md)** — All known issues and workarounds

---

OTOY &copy; 2026. Octane Render and OTOY are registered trademarks of OTOY Inc.
