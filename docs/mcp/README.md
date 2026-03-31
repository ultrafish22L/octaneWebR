# Octane MCP User Guide

Control Octane Render from AI agents. **65 active tools**. Build scenes, set materials, position cameras, and render — all through natural language. v3.1.1.

## What Is This?

**MCP** (Model Context Protocol) is a standard that lets AI assistants use external tools. The Octane MCP server wraps Octane's gRPC LiveLink API into 65 tools that Claude can call. The AI becomes your 3D scene builder — you describe what you want, it creates nodes, wires them together, sets materials, frames the camera, and renders.

Three ways to use it:

1. **MCP alone (Claude Code CLI)** — Claude controls Octane directly. You see results in Octane's viewport or as saved render images.
2. **MCP + octaneWebR** — Claude controls Octane while octaneWebR shows the scene tree, node graph, inspector, and live render in your browser. Best visual experience.
3. **Claude Desktop (code tab)** — Open the `octaneWebR` folder in Claude Desktop's code tab. It reads `.mcp.json` automatically and connects to all three MCP servers. This is the primary development environment — same MCP capabilities as CLI, but with Claude Desktop's conversational UI. Supports all the same scene building, rendering, and debugging workflows.

```
┌───────────────────┐  stdio  ┌────────────┐  gRPC   ┌──────────┐
│ Claude Code CLI   │◄───────►│            │◄───────►│          │
│    — or —         │         │ MCP Server │         │  Octane  │
│ Claude Desktop    │◄───────►│            │         │          │
│  (code tab)       │         └────────────┘         └────┬─────┘
└───────────────────┘                                     │ gRPC
                                                          │ (separate
                                                          │  connection)
                                                     ┌────┴─────┐
                                                     │ octaneWebR│
                                                     │  Browser  │
                                                     └──────────┘
```

> **octaneWebR and MCP are independent.** Both connect to Octane via gRPC separately. You can use either one alone, or both together for the best experience.

## Prerequisites

| Requirement                   | Version | Notes                                                                                 |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------- |
| Octane Render Studio          | 2026.1+ | gRPC must be enabled (Preferences > GRPC API > Enable)                                |
| Node.js                       | 18+     | For MCP server and octaneWebR dev server                                              |
| Claude Desktop or Claude Code | Latest  | Claude Desktop's code tab is the primary dev environment. Claude Code CLI also works. |

## Setup

### 1. Install Dependencies

```bash
cd octaneWebR
npm install              # Root project (octaneWebR + shared)
cd mcp && npm install    # MCP server (separate package)
```

### 2. Build the MCP Server

```bash
cd mcp
npm run build            # Compiles to mcp/dist/index.js
```

### 3. Configure Your MCP Client

The project includes `.mcp.json` at the root, which Claude Code reads automatically. It registers three MCP servers:

| Server        | Purpose                                                |
| ------------- | ------------------------------------------------------ |
| `octane`      | Scene control — create nodes, set attributes, render   |
| `octane-docs` | Octane Lua API documentation and examples              |
| `otoy-studio` | MCP server for AI images/video/vision/music (20 tools) |

If you're using a different MCP client, point it to `node mcp/dist/index.js` with stdio transport.

### 4. Launch octaneServGrpc

The gRPC server must be running before the MCP server connects.

```bash
# Launch octaneServGrpc
octaneServGrpc/build/Release/octaneServGrpc.exe &
```

Wait 10–15 seconds for the gRPC server to start. Verify it's listening:

```bash
# Windows
powershell -Command "Get-NetTCPConnection -LocalPort 51022"

# Linux/macOS
lsof -i :51022
```

### 5. (Optional) Launch octaneWebR

For the full visual experience:

```bash
npm run dev              # Starts on http://localhost:43929
```

Open the URL in your browser. You'll see the scene tree, node graph, and live render viewport. Every MCP action shows up here in real time.

---

## Using MCP Alone

With Octane running and Claude open in the project directory — either Claude Code CLI or Claude Desktop's code tab — you can start building scenes immediately. Both read `.mcp.json` and connect to the MCP server automatically.

### Your First Scene

Ask Claude something like:

> "Create a scene with a red sphere on a grey floor, lit by warm daylight. Frame it nicely and render."

Behind the scenes, Claude will:

1. Create a Render Target (the scene root)
2. Set the camera to a good viewing angle
3. Create a sphere mesh with a loud red material — **you see it immediately**
4. Add a daylight environment for lighting
5. Swap in the final material, tweak lighting
6. Render and save the image

Claude prioritizes getting something on screen fast so you can watch the scene take shape, not building everything backstage first.

### What You Can Ask For

**Scene setup:**

- "Create a new empty scene with path tracing"
- "Load the teapot scene from ORBX/teapot.orbx"
- "Save the current project to C:/renders/my_scene.orbx"

**Objects and materials:**

- "Add a gold torus next to the sphere"
- "Make the floor material glossy chrome"
- "Import the robot.glb model into the scene"

**Camera and rendering:**

- "Frame the camera to show all objects from a 3/4 angle"
- "Set portrait aspect ratio (720x1280)"
- "Render at 500 samples and save to C:/renders/hero.png"

**Lighting:**

- "Switch to sunset lighting"
- "Add a blue rim light behind the subject"
- "Make the environment darker for more dramatic contrast"

**Scene queries:**

- "What's in the scene right now?"
- "Show me the material settings on the sphere"
- "What's the current camera position?"

### Tips for Better Results

1. **Be specific about positions.** "Put the cube at position 2, 0, -1" works better than "put it somewhere nearby."
2. **Ask for renders often.** "Render after each change" lets you (and Claude) see what's happening.
3. **Iterate visually.** "The light is too harsh — bring it down to 50%" is faster than describing the perfect lighting upfront.
4. **Use save_render for feedback.** Claude can read saved PNGs to evaluate the scene and make adjustments.

---

## Using MCP with octaneWebR (Recommended)

This is where it gets good. With octaneWebR running alongside MCP, you get a live browser UI that shows every change Claude makes:

- **Scene Outliner** — watch nodes appear as Claude creates them
- **Node Graph** — see connections form in real time
- **Node Inspector** — see attribute values change as Claude sets them
- **Render Viewport** — live render updates with orbit/pan/zoom

### The Workflow

1. Start `octaneServGrpc` (gRPC server on port 51022)
2. Run `npm run dev` (octaneWebR on port 43929)
3. Open http://localhost:43929 in your browser
4. Open the project in Claude Code CLI or Claude Desktop's code tab
5. Start asking Claude to build your scene

You interact through Claude while watching the results in the browser. It's like having a 3D artist working in real time while you direct.

> **Note:** This project has been primarily developed and tested using Claude Desktop's code tab. Both CLI and Desktop work identically — same `.mcp.json`, same MCP servers, same tools.

### What You Can Do in the Browser

While Claude builds via MCP, you can:

- **Orbit the camera** — click and drag in the render viewport
- **Select nodes** — click in the outliner or graph to inspect them
- **Edit parameters** — use the inspector to tweak values Claude set
- **Use picker tools** — material picker, object picker, focus distance picker
- **Switch themes** — Vibe (pastel), Octane (dark pro), Debug (dev layout)

Changes you make in the browser are visible to Octane immediately. Claude can query the scene to see your changes too.

### Live Sync

When Claude modifies a node that's currently selected in octaneWebR, you may need to re-select it to refresh the inspector. The render viewport updates automatically.

---

## What Can the MCP Server Do?

Beyond basic node manipulation, the MCP server includes several high-level systems:

**Build and modify scenes** — Create nodes, wire the node graph, set materials, position cameras, render images. The core workflow that turns natural language into Octane scenes.

**Art-direct your scenes** — Plan compositions mathematically, set artistic mood with SEGA semantic vectors (25 presets from "noir" to "Kubrick"), get collision-free object placement, and run an iterative vision critique loop that scores your renders and suggests corrections. See [Art Direction System](../ADSYSTEM.md) for the full picture.

**Generate and import assets** — Use OTOY Studio to generate concept art and 3D meshes, convert to OBJ, analyze mesh orientation automatically via the mugshot protocol, and import into Octane with correct materials and placement. See [Art Direction System — Asset Pipeline](../ADSYSTEM.md#asset-generation-pipeline).

**Get creative suggestions** — Lighting recipes for 7 moods (dramatic, ethereal, noir...) and PBR material values for 30+ surface types (gold, glass, wood, fabric...). See [Creative Guide](CREATIVE.md).

**Query everything** — Scene hierarchy, geometry/texture/resource stats, camera state, render status, animation data, color management, device info, and full node type introspection via 9 read-only MCP resources.

---

## Tool Reference

| Category           | Tools                                                                                                                                                           | What They Do                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Project**        | `load_project`, `save_project`, `reset_project`                                                                                                                 | Open/save/clear scenes                                                                                                         |
| **Camera**         | `get_camera`, `set_camera`, `fit_camera`                                                                                                                        | Read/set camera, auto-frame scene (elevation/yaw/margin)                                                                       |
| **Render**         | `start_render`, `stop_render`, `get_render_status`, `save_render`, `save_render_passes`                                                                         | Control rendering, export images and AOV passes                                                                                |
| **Scene**          | `get_scene_tree`, `list_node_types`, `flush_changes`                                                                                                            | Query hierarchy, 755+ node types, flush pending changes                                                                        |
| **Nodes**          | `create_node`, `delete_node`, `get_node_info`, `connect_nodes`, `disconnect_pin`, `create_at_pin`, `find_nodes`, `clone_node`, `rename_node`, `cleanup_orphans` | Build and manage the node graph                                                                                                |
| **Attributes**     | `set_attribute`, `get_attribute`, `list_attributes`, `describe_attribute`, `read_pin_value`                                                                     | Read/write node properties and metadata                                                                                        |
| **Import**         | `analyze_geo`, `place_geo`                                                                                                                                      | OBJ/GLB/glTF → Octane nodes + wiring. `place_geo` handles full pipeline (sidecar, wiring, registration)                        |
| **Mesh Placement** | `analyze_geo`, `suggest_placement`, `register_object`, `get_scene_placement_state`                                                                              | Pre-build mesh analysis, collision-free placement                                                                              |
| **AD Composition** | `plan_layout`, `validate_layout`, `analyze_reference`, `score_render`, `commit_scores`, `score_sega`, `ad_state`                                                | Spatial layout, camera math, vision critique loop. See [AD System](../ADSYSTEM.md)                                             |
| **SEGA**           | `set_sega`, `adjust_sega`, `get_sega`                                                                                                                           | Mood via preset, vector, or natural language (15 dimensions). See [AD System](../ADSYSTEM.md#sega--semantic-artistic-guidance) |
| **Lighting**       | `create_light`, `setup_lighting`, `set_daylight`                                                                                                                | Single light creation, full 3-point rig (SEGA-aware), daylight env control                                                     |
| **Creative**       | `suggest_lighting`, `suggest_material`                                                                                                                          | Lighting recipe (positions/temps), PBR values for 28+ surfaces                                                                 |
| **Stats**          | `get_stats` (geometry/texture/resource), `get_scene_bounds`, `get_render_state`                                                                                 | Scene complexity and resource usage                                                                                            |
| **Animation**      | `animation` (range/check/list/get/set/clear)                                                                                                                    | Keyframe control                                                                                                               |
| **Color**          | `get_ocio_config`, `list_color_spaces`                                                                                                                          | Color management (OCIO). Use `search_tools`/`describe_tool` for param details                                                  |
| **Viewport**       | `refresh_ui`, `clay_mode`, `render_priority`, `subsample_mode`                                                                                                  | Interactive rendering and octaneWebR sync                                                                                      |
| **Info**           | `get_octane_version`, `get_device_info`, `get_enabled_aovs`                                                                                                     | System info, build tracking, AOV status                                                                                        |
| **Debug/Profile**  | `clear_log`, `profile` (start/end/report/reset)                                                                                                                 | Logging and performance timing                                                                                                 |
| **Discovery**      | `search_tools`, `describe_tool`                                                                                                                                 | Find tools by keyword, get full param docs for long-tail tools                                                                 |

### MCP Resources (9 read-only)

See [REFERENCE.md §8](./REFERENCE.md) for the full resource table. Key resources: `octane://pin-layout/{typeName}` (resolves pin_index vs pin_id confusion), `octane://scene` (current scene snapshot).

---

## Companion MCP Servers

`.mcp.json` registers two companions: **octane-docs** (Octane Lua API search, module browsing, code examples) and **otoy-studio** (AI image/video/vision/music — 20 MCP tools). For image-to-3D and 1099 other endpoints, use the `que.otoy.studio` queue API directly (`OTOY_API_KEY` required). See `OTOY_STUDIO.md` for full reference.

---

## Scene Building

For build workflow and phases: [BUILD.md](./BUILD.md). For pin layouts and attribute IDs: [REFERENCE.md](./REFERENCE.md).

Environment variables: `OCTANE_HOST` (default `127.0.0.1`), `OCTANE_PORT` (default `51022`).

---

## Further Reading

- [REFERENCE.md](./REFERENCE.md) — Pin layouts, node type IDs, attribute enums, material presets
- [BUILD.md](./BUILD.md) — Build protocols — DRESS (rehearsal) and SHOW (performance)
- [CREATIVE.md](./CREATIVE.md) — Lighting, materials, composition, OTOY Studio pipeline
