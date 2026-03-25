# Octane MCP User Guide

Control Octane Render from AI agents. **78 active tools, 4 disabled** (LiveDB). Build scenes, set materials, position cameras, and render — all through natural language.

## What Is This?

**MCP** (Model Context Protocol) is a standard that lets AI assistants use external tools. The Octane MCP server wraps Octane's gRPC LiveLink API into 78 tools that Claude can call. The AI becomes your 3D scene builder — you describe what you want, it creates nodes, wires them together, sets materials, frames the camera, and renders.

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

| Server        | Purpose                                              |
| ------------- | ---------------------------------------------------- |
| `octane`      | Scene control — create nodes, set attributes, render |
| `octane-docs` | Octane Lua API documentation and examples            |
| `otoy-studio` | MCP server for AI images/3D/video/music/vision       |

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

## Tool Reference

| Category            | Tools                                                                                                                                                                       | What They Do                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Project**         | `load_project`, `save_project`, `reset_project`                                                                                                                             | Open/save/clear scenes                                       |
| **Camera**          | `get_camera`, `set_camera`, `fit_camera`                                                                                                                                    | Read/set camera, auto-frame scene (elevation/yaw/margin)     |
| **Render**          | `start_render`, `stop_render`, `get_render_status`, `save_render`, `save_render_passes`, `save_render_passes_exr`                                                           | Control rendering, export images and AOV passes              |
| **Scene**           | `get_scene_tree`, `list_node_types`, `update_scene`                                                                                                                         | Query hierarchy, 755+ node types, flush pending changes      |
| **Nodes**           | `create_node`, `delete_node`, `get_node_info`, `connect_nodes`, `disconnect_pin`, `create_and_connect`, `find_nodes`, `duplicate_node`, `rename_node`, `delete_unconnected` | Build and manage the node graph                              |
| **Attributes**      | `set_attribute`, `get_attribute`, `get_all_attributes`, `get_attribute_info`, `get_pin_value`, `is_animated`, `is_node_animated`                                            | Read/write node properties and metadata                      |
| **Import**          | `import_glb`, `import_materialx`                                                                                                                                            | GLB/MaterialX → Octane nodes + wiring                        |
| **Mesh Placement**  | `analyze_mesh`, `suggest_placement`, `register_scene_object`, `get_scene_placement_state`                                                                                   | Pre-build mesh analysis, collision-free placement            |
| **AD Composition**  | `plan_composition`, `validate_layout`, `analyze_reference`, `critique_render`, `apply_corrections`, `semantic_critique`, `get_art_direction_state`                          | Spatial layout, camera math, vision critique loop            |
| **SEGA**            | `set_artistic_intent`, `adjust_artistic_intent`, `get_artistic_intent`                                                                                                      | Mood via preset, vector, or natural language (15 dimensions) |
| **Creative**        | `suggest_lighting`, `suggest_material`                                                                                                                                      | 3-point lighting recipe, PBR values for 28+ surfaces         |
| **Stats**           | `get_geometry_stats`, `get_texture_stats`, `get_resource_stats`, `get_scene_bounds`, `get_render_state`                                                                     | Scene complexity and resource usage                          |
| **Animation**       | `set_animation_data`, `get_animation_data`, `is_node_animated`, `get_animation_range`, `clear_animation`                                                                    | Keyframe control                                             |
| **Color/MaterialX** | `get_ocio_config`, `list_color_spaces`, `list_materialx_nodes`                                                                                                              | Color management and MaterialX browsing                      |
| **Viewport**        | `refresh_webapp`, `set_clay_mode`, `get_clay_mode`, `set_render_priority`, `get_render_priority`, `set_subsample_mode`, `get_subsample_mode`                                | Interactive rendering and octaneWebR sync                    |
| **Info**            | `get_octane_version`, `get_device_info`, `get_enabled_aovs`                                                                                                                 | System info, build tracking, AOV status                      |
| **Debug/Profile**   | `clear_log`, `profile_start`, `profile_end`, `profile_report`, `profile_reset`                                                                                              | Logging and performance timing                               |

### MCP Resources (9 read-only)

Besides tools, the MCP server exposes 9 resources for type system discovery — no side effects, safe to query anytime:

| Resource              | URI                                           | What It Returns                                      |
| --------------------- | --------------------------------------------- | ---------------------------------------------------- |
| Node types            | `octane://node-types`                         | All 755+ types with id, category, pin count          |
| Types by category     | `octane://node-types/{category}`              | Filter by MAT, TEX, GEO, LIGHT, etc.                 |
| Pin layout            | `octane://pin-layout/{typeName}`              | All pins: index, id, name, type, defaults            |
| Compatibility         | `octane://compatibility/{pinType}`            | What nodes can connect to a pin type                 |
| Primitive types       | `octane://primitive-types`                    | NT_GEO_OBJECT shapes (Box=1, Sphere=20, etc.)        |
| Node info (live)      | `octane://node-info/{typeName}`               | Full metadata from Octane (cached after first query) |
| Pin info (live)       | `octane://pin-info/{typeName}/{pinIndex}`     | Deep pin metadata: ranges, enum values, defaults     |
| Attribute info (live) | `octane://attribute-info/{typeName}/{attrId}` | Type, defaults, min/max, description                 |
| Scene snapshot        | `octane://scene`                              | Current scene: all nodes, connections, staleness     |

These are especially useful when working with unfamiliar node types — query `pin-layout` instead of guessing pin indices.

---

## Companion MCP Servers

The `.mcp.json` config also registers two companion servers that work alongside the Octane MCP:

### Octane Docs MCP

Search Octane's Lua scripting API, browse modules, look up function signatures, and find code examples. Useful when Claude needs to understand Octane node types or attribute semantics.

### OTOY Studio — MCP server for AI images/3D/video/music/vision

Generate AI assets for your Octane scenes:

| Tool                   | What It Does                             |
| ---------------------- | ---------------------------------------- |
| `generate_image`       | Text-to-image (Flux)                     |
| `generate_image_pro`   | Higher quality image generation          |
| `edit_image`           | Modify existing images with text prompts |
| `generate_video_veo3`  | Text-to-video (Google Veo3)              |
| `generate_video_kling` | Text-to-video (Kling)                    |
| `image_to_video_kling` | Animate a still image                    |
| `generate_music`       | AI music generation                      |
| `upscale_image`        | Upscale resolution                       |
| `chat_completion`      | General AI chat                          |

**Workflow example:** Generate a texture in OTOY Studio → download → apply as image texture in Octane via MCP.

---

## Scene Building Concepts

### The Node Graph

Octane scenes are directed graphs. Everything is a node connected by pins:

```
Render Target (RT)
  ├── pin 0: Camera
  ├── pin 1: Environment (sky/lighting)
  ├── pin 3: Geometry (your objects)  ← use pin_index, not pin_id!
  ├── pin 4: Film (resolution)
  └── pin 6: Kernel (render engine)
```

### Connection Chain for Objects

To get an object into a scene:

```
Material → Mesh (pin 0)
Mesh → Placement (pin "geometry")
Placement → Geometry Group (pin_index N)
Geometry Group → Render Target (pin_index 3)
```

### Node Types You'll Use Most

| Type Key              | What It Is                                  |
| --------------------- | ------------------------------------------- |
| `NT_RENDERTARGET`     | Scene root — everything connects here       |
| `NT_GEO_MESH`         | Loads .obj files                            |
| `NT_GEO_OBJECT`       | Primitive shapes (box, sphere, torus, etc.) |
| `NT_GEO_PLACEMENT`    | Wrapper that gives meshes a transform       |
| `NT_GEO_GROUP`        | Groups geometry for the RT                  |
| `NT_MAT_UNIVERSAL`    | Versatile PBR material                      |
| `NT_MAT_GLOSSY`       | Glossy/metallic material                    |
| `NT_MAT_SPECULAR`     | Glass and transparent materials             |
| `NT_TEX_IMAGE`        | Image texture (PNG, JPG, EXR)               |
| `NT_ENV_DAYLIGHT`     | Physical sun and sky                        |
| `NT_KERN_PATHTRACING` | Path tracing render kernel                  |
| `NT_LIGHT_SPHERE`     | Sphere area light                           |
| `NT_EMIS_BLACKBODY`   | Light emission by temperature               |

### Key Attribute IDs

| ID  | Name          | Type   | Notes                                  |
| --- | ------------- | ------ | -------------------------------------- |
| 172 | A_TRANSLATION | float3 | Position {x, y, z}                     |
| 137 | A_ROTATION    | float3 | Rotation in **degrees** (not radians!) |
| 139 | A_SCALE       | float3 | Scale {x, y, z}                        |
| 185 | A_VALUE       | varies | General value attribute                |
| 34  | A_FILENAME    | string | File path for meshes, textures         |
| 124 | A_RELOAD      | bool   | Trigger reload after setting filename  |

---

## Common Pitfalls

These are real issues discovered through extensive testing. They'll save you hours.

### Silent Connection Failures

Some connections report success but don't actually work:

- **RT geometry pin:** Always use `pin_index: 3`, never `pin_id: 59`
- **Mesh material pin:** Always use `pin_index: 0`, never `pin_id: 30`
- **Auto-created children:** You can replace internal nodes by connecting a standalone node to the parent's pin directly.
- **Always verify:** After connecting, call `get_node_info` on the target and check that `connected_handle != 0`.

### Render Gotchas

- **DOF is auto-disabled on new RTs** (aperture set to 0). For loaded scenes, set aperture to 0 if render is blurry.
- **Lights are 40x dimmer than expected** — emission efficiency defaults to 0.025. Set it to 1.0.
- **`start_render` auto-flushes** pending scene changes before rendering. No manual `update_scene` needed.
- **`connect_nodes` and `disconnect_pin` auto-flush** `ApiChangeManager::update()`. No manual `update_scene` needed between connection changes.

### Known Crash Triggers

- `import_materialx` — can crash Octane on certain .mtlx files. Save scene first.

### Transform Gotchas

- **Set transforms on the child handle** (pin 3 of placement/object), not the parent node.
- **Rotations are in degrees**, not radians.
- **NT_GEO_MESH has no transform** — wrap it in an NT_GEO_PLACEMENT first.

---

## Environment Variables

See [QUICKSTART.md](../../QUICKSTART.md) for the full environment variables table. Key ones: `OCTANE_HOST` (default `127.0.0.1`), `OCTANE_PORT` (default `51022`), `GRPC_DEBUG_LOG` (set `0` to disable logging).

---

## Troubleshooting

### MCP server won't connect

1. Is Octane running? Check that port 51022 is listening.
2. Did you build the MCP server? Run `cd mcp && npm run build`.
3. Is `.mcp.json` present in the project root?

### Commands succeed but nothing happens

Connection gotcha — see [Silent Connection Failures](#silent-connection-failures) above. Always verify with `get_node_info`.

### Octane stops responding

On the SDK server, `suppressUI` prevents most dialogs and bad file paths are handled gracefully. If truly hung, kill and restart:

```bash
taskkill /F /IM octane.exe        # Windows
pkill -f octane                    # Linux/macOS
```

### Scene looks wrong

- All white? Check RT connections — geometry, kernel, and environment must all be wired.
- All black? No light sources. Add an environment or emission node.
- Blurry? DOF is auto-disabled on new RTs. For old/loaded RTs, set camera aperture to 0.
- Mesh invisible? `A_RELOAD` should be triggered automatically. If not, set `A_RELOAD=124` to true after `A_FILENAME=34`.

### octaneWebR not updating

Run `refresh_webapp` via MCP to force a sync. If a node is selected, re-select it to refresh the inspector.

---

## Further Reading

- [REFERENCE.md](./REFERENCE.md) — Pin layouts, node type IDs, attribute enums, material presets
- [BUILD.md](./BUILD.md) — Build protocols — DRESS (rehearsal) and SHOW (performance)
- [CREATIVE.md](./CREATIVE.md) — Lighting, materials, composition, OTOY Studio pipeline
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — All known problems and workarounds
