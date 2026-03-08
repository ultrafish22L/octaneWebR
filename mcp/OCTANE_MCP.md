# Octane MCP Reference

Best practices, crash prevention rules, and reference info for building scenes via the Octane MCP server. This is the single source of truth — recipes (like CORNELL_RECIPE.md) reference this file.

---

## How Octane Works

GPU-accelerated unbiased path tracer. Everything is a **node** in a DAG. You create nodes, connect them via **pins**, set attributes, and render.

### RenderTarget — Root of Every Scene

```
RenderTarget
  pin 0: Camera         (NT_CAM_THINLENS — auto-created)
  pin 1: Environment     (NT_ENV_TEXTURE — auto-created)
  pin 3: Geometry        (connect NT_GEO_GROUP here)
  pin 4: Film Settings   (auto-created, has resolution child)
  pin 6: Kernel          (auto-creates DL kernel — MUST replace with PT!)
```

### Coordinate System

- **+X = RIGHT**, **-X = LEFT**
- **+Y = UP**, **-Y = DOWN**
- **+Z = toward camera**, **-Z = into scene**

---

## Critical Rules (crash prevention)

### Must-Do

| Rule                               | Why                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| **Create NT_KERN_PATHTRACING**     | Default DL kernel renders all-white for interior scenes. Connect to RT pin 6.                 |
| **Film resolution uses AT_INT2=4** | `set_attribute(res, 185, 4, {x:1024, y:1024})`. AT_INT=3 only sets X.                         |
| **Geo group pin count first**      | `set_attribute(group, A_PIN_COUNT=113, AT_INT=3, N)` BEFORE connecting children. Starts at 0. |
| **start_render(RT) after geo**     | Must re-select RT after connecting geo group.                                                 |
| **Handles are opaque**             | Never guess. Only use values from `create_node` or `get_node_info`.                           |

### Needs Re-testing

These were observed when the MCP code had 3 regressions (no auto-update, evaluate=false, missing continueRendering). May not be real issues with working code.

| Rule                             | Status                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------- |
| **Sphere primitive=20 crashes**  | Never re-tested after code fix. Crash may have been from deferred batching bug. |
| **Subdivision <= 2 bluescreens** | Not confirmed with working code. May be fine now.                               |

### Evaluation & Update Pattern

- **set_attribute**: Auto-flushes `ApiChangeManager.update()` after every call. Safe to call in parallel for independent attributes.
- **connect_nodes**: Defaults to `evaluate: true` (immediate). Use `evaluate: false` only for batch connects followed by `update_scene`.
- **update_scene**: Rarely needed. Use after batch connects with evaluate=false.
- **After EVERY connect to geo group**: `update_scene` → `restart_render` → `start_render(RT)`. Each object must pop in to the viewport immediately.

### Setup Order (for demos)

RT → env → film → kernel → geo group. Start rendering right after RT creation.

1. `reset_project`
2. `create_node(NT_RENDERTARGET)` → RT, then `start_render(RT)` immediately
3. `create_node(NT_ENV_DAYLIGHT)` → connect to RT pin 1 → update/restart/start
4. Film: `get_node_info(RT)` → film (pin 4) → resolution child → `set_attribute(res, 185, AT_INT2=4, {1024,1024})`
5. `create_node(NT_KERN_PATHTRACING)` → connect to RT pin 6 → update/restart/start
6. `create_node(NT_GEO_GROUP)` → set pin count → connect to RT pin 3 → update/restart/start

### Camera (Cornell Box)

```
position: (0, 1, 3.2)  target: (0, 1, 0)
```

Interior view from front, frames entire 2×2×2 box. Set once at start, never move.

### Emission Workaround

Auto-created child materials on NT_GEO_OBJECT **silently reject** emission connections. Create a **standalone** NT_MAT_DIFFUSE, connect emission to it, then connect to the geo object's material pin (1).

### Primitive Default

NT_GEO_OBJECT defaults to primitive=1 (Pill). Must explicitly set to 0 (Box) for box shapes.

---

## Node Types (common)

| Category         | Type Key                 | ID  | Description                            |
| ---------------- | ------------------------ | --- | -------------------------------------- |
| **Render**       | `NT_RENDERTARGET`        | 56  | Scene root                             |
| **Geometry**     | `NT_GEO_GROUP`           | 3   | Geometry container                     |
|                  | `NT_GEO_OBJECT`          | 153 | Geometric primitive (box/sphere/etc)   |
|                  | `NT_GEO_MESH`            | 1   | Mesh from file (.obj/.fbx/.stl)        |
|                  | `NT_GEO_PLACEMENT`       | 4   | Placement wrapper (transform/scale)    |
|                  | `NT_GEO_PLANE`           | 110 | Infinite plane                         |
|                  | `NT_GEO_SCATTER`         | 5   | Scatter instances on surface           |
|                  | `NT_GEO_VOLUME`          | 115 | OpenVDB volume (.vdb)                  |
| **Materials**    | `NT_MAT_UNIVERSAL`       | 130 | PBR material (recommended default)     |
|                  | `NT_MAT_DIFFUSE`         | 17  | Matte material                         |
|                  | `NT_MAT_GLOSSY`          | 16  | Glossy/reflective                      |
|                  | `NT_MAT_SPECULAR`        | 18  | Glass/transparent (IOR-based)          |
|                  | `NT_MAT_METAL`           | 120 | Metal (complex IOR)                    |
|                  | `NT_MAT_MIX`             | 19  | Blend two materials                    |
| **Textures**     | `NT_TEX_RGB`             | 33  | Solid color                            |
|                  | `NT_TEX_FLOAT`           | 31  | Solid float                            |
|                  | `NT_TEX_IMAGE`           | 34  | Image file                             |
|                  | `NT_TEX_CHECKS`          | 45  | Checkerboard                           |
|                  | `NT_TEX_NOISE`           | 87  | Noise                                  |
| **Emission**     | `NT_EMIS_BLACKBODY`      | 53  | Thermal emission (power + temperature) |
|                  | `NT_EMIS_TEXTURE`        | 54  | Textured emission                      |
| **Environments** | `NT_ENV_DAYLIGHT`        | 14  | Physical sun + sky                     |
|                  | `NT_ENV_TEXTURE`         | 37  | HDRI environment                       |
| **Cameras**      | `NT_CAM_THINLENS`        | 13  | Standard camera                        |
|                  | `NT_CAM_UNIVERSAL`       | 157 | Multi-mode camera                      |
| **Kernels**      | `NT_KERN_PATHTRACING`    | 25  | Path tracing (use this!)               |
|                  | `NT_KERN_DIRECTLIGHTING` | 24  | Direct lighting (fast preview)         |
|                  | `NT_KERN_PMC`            | 23  | PMC (difficult caustics)               |
| **Lights**       | `NT_LIGHT_QUAD`          | 148 | Rectangular area light                 |
|                  | `NT_LIGHT_SPHERE`        | 149 | Sphere area light                      |

## Attribute IDs

| ID  | Name            | Type           | Used For                                |
| --- | --------------- | -------------- | --------------------------------------- |
| 185 | `A_VALUE`       | varies         | Generic value (color, float, bool, int) |
| 34  | `A_FILENAME`    | AT_STRING (14) | File path for mesh/texture              |
| 113 | `A_PIN_COUNT`   | AT_INT (3)     | Pin count on groups                     |
| 172 | `A_TRANSLATION` | AT_FLOAT3 (11) | Position {x,y,z}                        |
| 141 | `A_ROTATION`    | AT_FLOAT3 (11) | Rotation degrees {x,y,z}                |
| 139 | `A_SCALE`       | AT_FLOAT3 (11) | Scale factors {x,y,z}                   |
| 124 | `A_RELOAD`      | AT_BOOL (1)    | Reload file node                        |

## Attribute Types

| ID  | Name      | Format                              |
| --- | --------- | ----------------------------------- |
| 1   | AT_BOOL   | true/false                          |
| 3   | AT_INT    | integer                             |
| 4   | AT_INT2   | {x, y} — resolution                 |
| 9   | AT_FLOAT  | number                              |
| 11  | AT_FLOAT3 | {x, y, z} — colors (0-1), positions |
| 14  | AT_STRING | "string" — file paths               |

## Pin Value RPCs — UNIMPLEMENTED

The proto defines `setPinValueByIx`, `setPinValueByPinID`, `setPinValueByName` (and get variants) but **Octane's gRPC server returns UNIMPLEMENTED for all 6**. These are future API stubs, not yet available. Tested 2026-03-07.

**Current workflow**: `create_node` → `get_node_info` → `set_attribute` on child handles. No shortcut available yet.

---

## NT_GEO_OBJECT Pin Layout (always the same)

Use `get_node_info` to discover child handles, then `set_attribute` on them.

| Pin | Name        | Child Type       | Notes                                                             |
| --- | ----------- | ---------------- | ----------------------------------------------------------------- |
| 0   | primitive   | Enum value       | Set via `set_attribute(child, 185, AT_INT=3, 0)` for Box          |
| 1   | material    | Diffuse material | Auto-created. Has RGB child on its pin 0.                         |
| 2   | objectLayer | Object layer     |                                                                   |
| 3   | transform   | Transform value  | Use `set_attribute(child, A_TRANSLATION=172, AT_FLOAT3, {x,y,z})` |
| 4   | Width       | Float value      | `set_attribute(child, 185, AT_FLOAT=9, 2.0)`                      |
| 5   | Height      | Float value      |                                                                   |
| 6   | Depth       | Float value      |                                                                   |
| 7   | Subdivision | Int value        | High values may crash (needs re-testing)                          |

## NT_MAT_SPECULAR Pin Layout (glass/transparent)

Use `get_node_info(specular)` to discover child handles, then `set_attribute(child, 185, type, value)`.

| Pin | Name         | Type           | Example                                  |
| --- | ------------ | -------------- | ---------------------------------------- |
| 0   | reflection   | AT_FLOAT3 (11) | `set_attribute(child, 185, 11, {1,1,1})` |
| 1   | transmission | AT_FLOAT3 (11) | `set_attribute(child, 185, 11, {1,1,1})` |
| 3   | roughness    | AT_FLOAT (9)   | `set_attribute(child, 185, 9, 0)`        |
| 7   | index (IOR)  | AT_FLOAT (9)   | `set_attribute(child, 185, 9, 1.5)`      |
| 22  | smooth       | AT_BOOL (1)    | `set_attribute(child, 185, 1, true)`     |

## NT_MAT_DIFFUSE Pin Layout (matte)

| Pin | Name     | Type           | Example                                                  |
| --- | -------- | -------------- | -------------------------------------------------------- |
| 0   | diffuse  | AT_FLOAT3 (11) | `set_attribute(child, 185, 11, {0.9, 0.9, 0.9})` → white |
| 10  | smooth   | AT_BOOL (1)    | `set_attribute(child, 185, 1, true)`                     |
| 14  | emission | —              | Use `connect_nodes` (NT_EMIS_BLACKBODY)                  |

## NT_EMIS_BLACKBODY Pin Layout (thermal emission)

| Pin | Name              | Type         | Example                                       |
| --- | ----------------- | ------------ | --------------------------------------------- |
| 1   | power             | AT_FLOAT (9) | `set_attribute(child, 185, 9, 200)`           |
| 5   | temperature       | AT_FLOAT (9) | `set_attribute(child, 185, 9, 6500)` (Kelvin) |
| 2   | surfaceBrightness | AT_BOOL (1)  |                                               |
| 4   | doubleSided       | AT_BOOL (1)  |                                               |

### Setting Material Color on Auto-Created Materials

NT_GEO_OBJECT auto-creates a diffuse material on pin 1. To set its color:

```
# Get the material child handle, then its RGB child
get_node_info(geo) → pin 1 → material_handle
get_node_info(material_handle) → pin 0 → RGB_child
set_attribute(RGB_child, 185, AT_FLOAT3=11, {0.65, 0.05, 0.05})  → red
```

## Primitive Types

| Val | Shape          | Val | Shape                     |
| --- | -------------- | --- | ------------------------- |
| 0   | Box            | 12  | Hyperboloid               |
| 1   | Pill (default) | 13  | Icosahedron               |
| 2   | Capsule        | 14  | Octahedron                |
| 3   | Cone           | 15  | Plane                     |
| 4   | Cylinder       | 16  | Pentagon                  |
| 5   | Dreidel        | 17  | Prism                     |
| 6   | Disc           | 18  | Quad                      |
| 7   | Dodecahedron   | 19  | Saddle                    |
| 8   | Hemisphere     | 20  | Sphere (needs re-testing) |
| 9   | Ellipsoid      | 21  | Tetrahedron               |
| 10  | Torus (fat)    | 22  | Torus                     |
| 11  | Hourglass      | 23  | Truncated Cone            |

---

## Connection Patterns

### Pin Compatibility

| Pin                   | Accepts                     | Rejects              |
| --------------------- | --------------------------- | -------------------- |
| diffuse (mat pin 0)   | Texture nodes (NT*TEX*\*)   | Emissions, materials |
| emission (mat pin 14) | Emission nodes (NT*EMIS*\*) | Raw textures         |
| material (geo pin 1)  | Material nodes (NT*MAT*\*)  | Textures, emissions  |
| mesh (RT pin 3)       | Geometry (NT*GEO*\*)        | Materials, textures  |

### Verified Connections

- RGB texture → material diffuse pin 0
- Blackbody emission → standalone material emission pin 14
- Geometry objects → geo group pins
- Geo group → RT pin 3
- PT kernel → RT pin 6

### Sphere via .obj Mesh

Alternative to primitive=20 (which needs re-testing — may work fine with current code). Use this chain for mesh-based spheres:

```
NT_GEO_MESH (load sphere.obj via A_FILENAME=34)
  → NT_GEO_PLACEMENT pin 1 (geometry)
    → placement transform child: A_TRANSLATION=172 for position, A_SCALE=139 for size
NT_MAT_SPECULAR → NT_GEO_MESH pin 0 (material)
NT_GEO_PLACEMENT → geo_group pin N
```

File: `C:\otoyla\GRPC\dev\octaneWebR\ORBX\assets\sphere.obj`

---

## Materials

### Quick Recipes

All require `get_node_info` to discover child handles first, then `set_attribute(child, 185, type, value)`.

| Material       | Type                  | Key Attributes                                                |
| -------------- | --------------------- | ------------------------------------------------------------- |
| **White wall** | NT_MAT_DIFFUSE (auto) | RGB child → `(185, 11, {0.9, 0.9, 0.9})`                      |
| **Red wall**   | NT_MAT_DIFFUSE (auto) | RGB child → `(185, 11, {0.65, 0.05, 0.05})`                   |
| **Green wall** | NT_MAT_DIFFUSE (auto) | RGB child → `(185, 11, {0.12, 0.45, 0.15})`                   |
| **Glass**      | NT_MAT_SPECULAR       | IOR child → `(185, 9, 1.5)` + smooth child → `(185, 1, true)` |
| **Gold**       | NT_MAT_UNIVERSAL      | Metallic=1, Roughness=0.15, Albedo=(1.0, 0.84, 0.0)           |
| **Chrome**     | NT_MAT_UNIVERSAL      | Metallic=1, Roughness=0, Albedo=white                         |
| **Plastic**    | NT_MAT_UNIVERSAL      | Metallic=0, Roughness=0.2, Specular=0.5                       |
| **Fabric**     | NT_MAT_UNIVERSAL      | Metallic=0, Roughness=0.9, Sheen=0.7                          |

### IOR Reference

| Material      | IOR  | Material      | IOR  |
| ------------- | ---- | ------------- | ---- |
| Air           | 1.0  | Water         | 1.33 |
| Glass (crown) | 1.52 | Glass (flint) | 1.62 |
| Diamond       | 2.42 | Acrylic       | 1.49 |
| Ice           | 1.31 | Crystal       | 2.00 |

---

## Lighting

### Area Light (Emission Panel)

```
NT_GEO_OBJECT (thin box: H=0.01)
  → pin 1: standalone NT_MAT_DIFFUSE
              → pin 14 (emission): NT_EMIS_BLACKBODY (power=200)
  → connect to geo_group
```

### Environment

- **Daylight**: Best for outdoors. Connect to RT pin 1.
- **Texture**: HDRI-based. Good for studio/product shots.

### Tips

- Interior scenes: emission panels + PT kernel (DL kernel won't bounce light)
- Larger area lights = softer shadows
- Power 100-300 for room-scale panels

---

## Kernels

| Kernel              | Use           | Notes                                              |
| ------------------- | ------------- | -------------------------------------------------- |
| **Path Tracing**    | Most scenes   | ALWAYS use for interiors. DL kernel renders white. |
| **Direct Lighting** | Quick preview | No bounced light. Only for open/exterior scenes.   |
| **PMC**             | Caustics      | Slow but handles difficult glass caustics.         |

- **Samples**: 256 preview, 1000 clean, 5000+ final
- **Film resolution**: Set on Image resolution child of Film settings

---

## Cornell Box Build Order

Wall order: left (red) → right (green) → floor → ceiling → back. Then light, tall box, sphere.

| Pin | Object             | Notes                                                           |
| --- | ------------------ | --------------------------------------------------------------- |
| 0   | Left wall (red)    | 0.01×2.0×2.0 at (-1,1,0)                                        |
| 1   | Right wall (green) | 0.01×2.0×2.0 at (1,1,0)                                         |
| 2   | Floor              | 2.0×0.01×2.0 at (0,0,0)                                         |
| 3   | Ceiling            | 2.0×0.01×2.0 at (0,2,0)                                         |
| 4   | Back wall          | 2.0×2.0×0.01 at (0,1,-1)                                        |
| 5   | Light panel        | 0.47×0.01×0.38 at (0,1.99,0), blackbody power=200               |
| 6   | Tall box           | 0.59×1.19×0.59 at (0.29,0.59,0.33), rotY=+22, primitive=0 (Box) |
| 7   | Glass sphere       | .obj mesh at (-0.24,0.30,-0.46), scale 0.59, specular IOR=1.5   |

For each object: create → get_node_info → set attributes → connect to geo group → update_scene → restart_render → start_render(RT).

---

## Speed Patterns

### Max Parallelism Build (~5 messages)

All pin values require `get_node_info` → child handle → `set_attribute`. Batch `get_node_info` calls to minimize round-trips.

1. **Message 1**: `reset_project` + `set_camera` + create ALL nodes in parallel
2. **Message 2**: Batch `get_node_info` on ALL nodes (geos, RT, specular, emission) + wire connections + load sphere.obj
3. **Message 3**: Second `get_node_info` round for material RGB children (need mat handles from Message 2)
4. **Message 4**: ALL `set_attribute` calls (W/H/D/primitive/positions/colors/IOR/power) + connect geos to group + film res
5. **Message 5**: `update_scene` + `restart_render` + `start_render(RT)` + `save_render`

### evaluate=false for Batch Connects

Safe for geo_group connects. Use `evaluate: false` on all, then `update_scene` once at end. Saves ~1s per connect.

---

## Discovery Workflow

### All pin values — discover child handles first

1. `create_node` → get handle
2. `get_node_info(handle)` → see all pins with names and child handles
3. `set_attribute` / `connect_nodes` using discovered handles/pins
4. For unknowns: `list_node_types`, Octane Docs MCP, or web search

### Octane Docs MCP

Connect: `npx -y mcp-remote https://octane-mcp.otoy.ai/sse`

| Tool                    | Purpose                    |
| ----------------------- | -------------------------- |
| `search_octane_api`     | Search Lua API functions   |
| `get_octane_function`   | Detailed function docs     |
| `get_octane_properties` | Node type properties       |
| `list_octane_constants` | Enum values (NT*, P*, A\_) |
| `search_examples`       | Find example scripts       |

---

## Debug

### Common Failures

| Symptom                                        | Cause                                                  |
| ---------------------------------------------- | ------------------------------------------------------ |
| Render all white                               | DL kernel (need PT), or camera outside scene           |
| Connection returns success but nothing changed | Wrong node type for pin (silently rejected)            |
| ECONNRESET/ECONNREFUSED                        | Octane crashed. STOP. User must restart.               |
| Render grey/blue                               | Camera looking at sky through open wall                |
| Wrong aspect ratio                             | Film resolution set with AT_INT=3 instead of AT_INT2=4 |

### Thread Safety

- Octane processes ALL API calls on a single "message thread"
- The MCP client serializes calls via a mutex — no parallel gRPC calls
- `ApiRenderEngine` is the only exception (thread-safe for render control/stats)
- Two gRPC peers (MCP + Vite plugin) can still interleave — avoid using both simultaneously

### Enum Discovery

When Octane has undocumented enums, brute-force test: create object → get_node_info for enum child → loop values 0-N rendering each → document results. Used to discover all 24 primitive types.

### Scale Reference

- 1 unit ≈ 1 meter. Human eye height: Y=1.0–1.7. Table: Y=0.75. Room: 2.5–3.0 tall.

### Log Files

- `grpc-debug.log` — Vite plugin traffic (needs `DEBUG_FILE_LOG = true`)
- `mcp-debug.log` — MCP server traffic

---

## Asset Sources

- **3D Models**: Sketchfab, TurboSquid (free), Poly Haven
- **HDRIs**: [Poly Haven](https://polyhaven.com/hdris) — .hdr/.exr for NT_ENV_TEXTURE
- **Textures**: [Poly Haven](https://polyhaven.com/textures), [ambientCG](https://ambientcg.com)
- **OTOY Studio**: https://otoy.studio/ — AI image-to-3D, text-to-image
- **Formats**: .obj, .fbx, .stl, .ply, .abc | .png, .jpg, .exr, .hdr | .vdb | .orbx, .ocs

Save to: `C:\otoyla\GRPC\dev\octaneWebR\ORBX\assets\`
