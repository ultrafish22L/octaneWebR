# Octane MCP User Guide

Control Octane Render from AI agents over gRPC. Build scenes, set materials, position cameras, and render — all through natural language or programmatic tool calls.

## What Is This?

The Octane MCP server wraps Octane's gRPC LiveLink API into 28 tools that any MCP-compatible AI client (Claude Code, Claude Desktop, etc.) can call. The AI becomes your 3D scene builder — you describe what you want, it creates nodes, wires them together, sets materials, frames the camera, and renders.

Two ways to use it:

1. **MCP alone** — Claude controls Octane directly. You see results in Octane's viewport or as saved render images.
2. **MCP + octaneWebR** — Claude controls Octane while octaneWebR shows the scene tree, node graph, inspector, and live render in your browser. This is the best experience — you see every change as it happens.

```
┌─────────────┐     stdio      ┌────────────┐     gRPC      ┌─────────┐
│ Claude Code │ ◄────────────► │ MCP Server │ ◄────────────► │ Octane  │
└─────────────┘                └────────────┘                └────┬────┘
                                                                  │ gRPC
                                                             ┌────┴────┐
                                                             │octaneWebR│
                                                             │ Browser  │
                                                             └─────────┘
```

## Prerequisites

| Requirement          | Version | Notes                                                  |
| -------------------- | ------- | ------------------------------------------------------ |
| Octane Render Studio | 2026.1+ | gRPC must be enabled (Preferences > GRPC API > Enable) |
| Node.js              | 18+     | For MCP server and octaneWebR dev server               |
| Claude Code          | Latest  | Or any MCP-compatible client                           |

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
| `otoy-studio` | AI-generated 3D assets, textures, video, music       |

If you're using a different MCP client, point it to `node mcp/dist/index.js` with stdio transport.

### 4. Launch Octane

Octane must be running before the MCP server connects.

```bash
# Launch Octane (adjust path to your installation)
"C:/path/to/octane.exe" &
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

With Octane running and Claude Code open in the project directory, you can start building scenes immediately. Claude reads `.mcp.json` and connects to the MCP server automatically.

### Your First Scene

Ask Claude something like:

> "Create a scene with a red sphere on a grey floor, lit by warm daylight. Frame it nicely and render."

Behind the scenes, Claude will:

1. Create a Render Target (the scene root)
2. Create a Path Tracing kernel and connect it
3. Set up a daylight environment
4. Create a sphere mesh with a red material
5. Position the camera
6. Start a render and save the image

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

1. Start Octane
2. Run `npm run dev` (octaneWebR on port 43929)
3. Open http://localhost:43929 in your browser
4. Open Claude Code in the project directory
5. Start asking Claude to build your scene

You interact through Claude in your terminal while watching the results in the browser. It's like having a 3D artist working in real time while you direct.

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

## Tool Reference (28 tools)

| Category       | Tools                                                                                                  | What They Do                                                |
| -------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **Project**    | `load_project`, `save_project`, `reset_project`                                                        | Open/save/clear scenes                                      |
| **Camera**     | `get_camera`, `set_camera`                                                                             | Read/set camera position and target                         |
| **Render**     | `start_render`, `stop_render`, `get_render_status`, `save_render`                                      | Control rendering, export images (PNG/EXR/HDR/TGA/TIFF/JPG) |
| **Scene**      | `get_scene_tree`, `list_node_types`                                                                    | Query hierarchy and 755+ node types                         |
| **Nodes**      | `create_node`, `delete_node`, `get_node_info`, `connect_nodes`, `disconnect_pin`, `create_and_connect` | Build the node graph                                        |
| **Attributes** | `set_attribute`, `get_attribute`                                                                       | Read/write node properties                                  |
| **Import**     | `import_glb`                                                                                           | GLB → OBJ + textures + material + wiring                    |
| **Webapp**     | `refresh_webapp`                                                                                       | Sync octaneWebR UI                                          |
| **Info**       | `get_octane_version`, `get_device_info`                                                                | System info                                                 |
| **Debug**      | `clear_log`                                                                                            | Clear MCP log                                               |
| **Profiling**  | `profile_start`, `profile_end`, `profile_report`, `profile_reset`                                      | Performance timing                                          |

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

### OTOY Studio MCP

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
- **Auto-created children:** You can't replace internal nodes (camera, env, kernel) by connecting to their pins. Create a standalone node and connect it to the parent's pin instead.
- **Always verify:** After connecting, call `get_node_info` on the target and check that `connected_handle != 0`.

### Render Gotchas

- **DOF is on by default** — aperture is 0.893. Set it to 0 immediately or everything will be blurry.
- **Lights are 40x dimmer than expected** — emission efficiency defaults to 0.025. Set it to 1.0.
- **`start_render` doesn't evaluate the scene** — any `set_attribute`, `connect_nodes`, or `set_camera` call triggers evaluation. `start_render` just renders whatever was last evaluated.

### Crash Triggers

- **`reset_project`** pops a save dialog if there are unsaved changes, blocking gRPC for 30+ seconds.
- **Invalid file paths** in `A_FILENAME` pop an Octane dialog that blocks gRPC.
- **Certain node type IDs** crash Octane: `0, 116, 408, 40000, 50000, 50106, 50107, 50108, 50136, 50137`. The MCP server already filters these.

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

Likely a blocking dialog (unsaved changes, bad file path). Check the Octane window. If it's truly hung, kill and restart:

```bash
taskkill /F /IM octane.exe        # Windows
pkill -f octane                    # Linux/macOS
```

### Scene looks wrong

- All white? Check RT connections — geometry, kernel, and environment must all be wired.
- All black? No light sources. Add an environment or emission node.
- Blurry? DOF is on. Set camera aperture to 0.
- Mesh invisible? Set `A_RELOAD` to true after setting `A_FILENAME`.

### octaneWebR not updating

Run `refresh_webapp` via MCP to force a sync. If a node is selected, re-select it to refresh the inspector.

---

## Further Reading

- [REFERENCE.md](./REFERENCE.md) — Pin layouts, node type IDs, attribute enums, material presets
- [BUILD.md](./BUILD.md) — DRESS/SPEED build protocols, camera workflow, setup order
- [CREATIVE.md](./CREATIVE.md) — Lighting, materials, composition, OTOY Studio pipeline
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — All known problems and workarounds
