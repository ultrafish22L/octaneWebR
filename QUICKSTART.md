# OctaneWebR Quick Start

Get the browser UI and AI scene builder running in under 5 minutes.

OctaneWebR gives you two ways to work with Octane: a browser UI for visual editing, and an MCP server that lets AI (Claude) build scenes for you through natural language. MCP (Model Context Protocol) is a standard that lets AI assistants use external tools — in this case, 78 tools for controlling Octane.

## §1 What You Need

- **Octane Render Studio 2026.1+** with gRPC enabled (gRPC is how programs talk to Octane remotely)
- **Node.js 18+**
- **Claude Desktop or Claude Code CLI** (for MCP / AI scene building)

## §2 Enable gRPC in Octane

Open Octane → File → Preferences → GRPC API:

- **Enable GRPC Server**: checked
- **Address**: `127.0.0.1:51022`

Restart Octane after changing this setting.

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

This compiles to `mcp/dist/index.js`. You only need to rebuild when MCP code changes.

## §5 Launch

**Order matters.** Octane must be running before anything connects to it.

```bash
# 1. Launch Octane (adjust path to your installation)
octane.exe

# 2. Wait for gRPC to start (~10-15 seconds)
#    Verify (PowerShell): Get-NetTCPConnection -LocalPort 51022

# 3. Start the web UI
npm run dev
```

Open **http://localhost:43929** in your browser.

## §6 Verify

1. In Octane, load any scene (or create a Render Target)
2. In the browser, the scene tree should populate in the left panel
3. The render viewport should show a live image
4. Try selecting a node — the inspector panel shows its properties

## §7 MCP Setup

Open Claude Code CLI or Claude Desktop's code tab in the `octaneWebR` directory. Both read `.mcp.json` automatically and connect to the Octane MCP server. Claude Desktop's code tab is the primary development environment for this project.

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
| **otoy-studio** | Generate AI images, 3D assets, video, and music                |

## §8 Web UI Only

If you only want the browser interface:

```bash
# 1. Start Octane
# 2. Start the dev server
npm run dev
```

Open http://localhost:43929. You get a full scene outliner, node graph editor, parameter inspector, and live render viewport.

## §9 MCP Only

If you only want AI control without the browser:

```bash
# 1. Build the MCP server first (if you haven't already)
cd mcp && npm run build && cd ..

# 2. Start Octane

# 3. Open the project in Claude Desktop's code tab or Claude Code CLI
#    MCP connects via .mcp.json automatically
```

Claude can build scenes, render, and save images without octaneWebR running.

## §10 Environment Variables

| Variable            | Default     | What It Does                                            |
| ------------------- | ----------- | ------------------------------------------------------- |
| `OCTANE_HOST`       | `127.0.0.1` | Octane gRPC host                                        |
| `OCTANE_PORT`       | `51022`     | Octane gRPC port                                        |
| `WORKER_1`          | `43929`     | Web UI port                                             |
| `OCTANE_BIND_HOST`  | `0.0.0.0`   | Network bind address (use `127.0.0.1` on open networks) |
| `OCTANE_FILE_ROOTS` | —           | Allowed file browser root paths (comma-separated)       |
| `GRPC_DEBUG_LOG`    | `1`         | Log gRPC calls to `log_grpc.log` (set `0` to disable)   |

## Troubleshooting

| Problem                      | Fix                                                                         |
| ---------------------------- | --------------------------------------------------------------------------- |
| Browser shows "Disconnected" | Is Octane running? Is gRPC enabled on port 51022?                           |
| Empty scene tree             | Load a scene in Octane, then press F5 in the browser                        |
| MCP tools fail               | Did you build? `cd mcp && npm run build`                                    |
| Blurry render                | DOF is on by default — ask Claude to disable it or set camera aperture to 0 |
| Octane not responding        | Check for blocking dialogs in the Octane window                             |

## Next Steps

- **[docs/mcp/README.md](docs/mcp/README.md)** — Full MCP user guide with all 78 tools, tips, and pitfalls
- **[docs/mcp/BUILD.md](docs/mcp/BUILD.md)** — Scene building protocols (DRESS demo mode, SPEED batch mode)
- **[docs/mcp/CREATIVE.md](docs/mcp/CREATIVE.md)** — Lighting, materials, composition guide
- **[docs/mcp/REFERENCE.md](docs/mcp/REFERENCE.md)** — Node types, pin layouts, attribute IDs
- **[docs/mcp/TROUBLESHOOTING.md](docs/mcp/TROUBLESHOOTING.md)** — All known issues and workarounds

---

OTOY &copy; 2026. Octane Render and OTOY are registered trademarks of OTOY Inc.
