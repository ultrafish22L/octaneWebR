# Octane MCP Reference

Best practices, observed patterns, and reference info for building scenes via the Octane MCP server. This is the single source of truth — recipes reference this file for all technical knowledge.

**Note**: Octane's gRPC API is **pre-alpha**. We are the engineering team testing it. **Assume crashes are our fault until proven otherwise.** Patterns and workarounds here are current findings — the API will evolve and updates may change any of this.

---

## ⚡ CHEAT SHEET — READ THIS FIRST

**DO NOT HALLUCINATE THESE VALUES. They are exact.**

```
MESH PATH PREFIX:  C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/
MESH FILES:        floor.obj, sphere_hd.obj, sphere.obj, sphere_uv.obj,
                   cube.obj, torus.obj, ring.obj, teapot.obj, quad.obj,
                   diamond.obj, monolith.obj, prism.obj, pillar.obj

TRANSFORM ATTRS:   A_TRANSLATION = 172   A_ROTATION = 137   A_SCALE = 139
                   All AT_FLOAT3 (type 11).  NOT 140/141!

OTHER KEY ATTRS:   A_VALUE = 185   A_FILENAME = 34   A_RELOAD = 92

ATTR TYPES:        AT_BOOL=1  AT_INT=3  AT_INT2=4  AT_FLOAT=9
                   AT_FLOAT2=90  AT_FLOAT3=11  AT_STRING=14

WIRING PATTERN:    material → mesh (pin 0)
                   mesh → placement (pin_name "geometry")
                   placement → geo group (pin_name "Input N")
                   NOT: material → placement. NEVER.

RT PIN LAYOUT:     0=camera  1=environment  3=geometry  4=film  6=kernel

BUILD MODES:       DRESS = demo for boss (1-by-1, max visual change/sec)
                   SPEED = batch everything, minimize round-trips

DRESS BUILD:       RT + PT kernel (connect BEFORE start_render!)
                   → final env (all values) → start_render → hero camera
                   → geo group (8 slots) → bare geo 1-by-1 (renders)
                   → materials 1-by-1 (renders) → refinement

SPEED BUILD:       create ALL nodes in parallel batches
                   → set ALL attrs with evaluate:false
                   → wire ALL chains → update_scene flush
                   → start_render → set_camera → save_render

CRASH RULE:        Connect PT kernel to RT BEFORE start_render().
                   Swapping kernels on a live render → ECONNRESET crash.

REFRESH RULE:      set_camera is the ONLY way to force re-render.
                   start_render/restart_render do NOT refresh geometry.

TIMING RULE:       Call get_render_status after EVERY render.
                   Report: samples, seconds, resolution. Track build time too.
```

---

## Scene Building Workflow

### Two Knowledge Sources

| Source        | File                        | Purpose                                                                    |
| ------------- | --------------------------- | -------------------------------------------------------------------------- |
| **Recipe**    | `recipes/*_RECIPE.md`       | Creative direction — prose vision + reference values. Not rigid.           |
| **Technical** | `OCTANE_MCP.md` (this file) | API rules, pin layouts, crash prevention, MCP patterns.                    |
| **Creative**  | `OCTANE_CREATIVE.md`        | Lighting, materials, composition, depth, scale — how to make it look good. |

### Session Start Rules

1. **Read the recipe** — never rely on memory or context summaries
2. **Read this file's critical rules** — refresh technical knowledge
3. **Plan the frame FIRST** — know the camera position, object positions, and depth formation BEFORE creating any nodes. If you can't state the camera position, you don't have a plan. Framing is 70% of the result.
4. **Render after every object** — save_render → Read PNG → evaluate → show to human
5. **Never trust session continuations** for scene state — verify or start fresh

### Recipe Format

Each recipe has three sections:

- **Vision** — prose creative direction. What the scene should feel like. Not rigid.
- **Directions** — DRESS mode build steps with commentary cues. 1 render per step, each a visible change.
- **Ingredients** — living values (camera, env, materials, positions). Refined each time the scene is built and improved. These are the current best, not the original.

No separate "cooked" files. Directions live inside the recipe.

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

## Critical Rules (observed patterns)

### Must-Do

| Rule                               | Why                                                                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Create NT_KERN_PATHTRACING**     | Default DL kernel renders all-white for interior scenes. Connect to RT pin 6.                                                     |
| **Film resolution on grandchild**  | RT → pin 4 (film settings) → get_node_info → pin 0 ("Image resolution") → `set_attribute(child, 185, AT_INT2=4, {x,y})`           |
| **Geo group pin count first**      | `set_attribute(group, A_PIN_COUNT=113, AT_INT=3, N)` BEFORE connecting children.                                                  |
| **Geo group uses pin_name**        | `connectToIx` silently fails on dynamic geo group pins. Must use `pin_name: "Input 1"`, `"Input 2"`, etc.                         |
| **Handles are opaque**             | Never guess. Only use values from `create_node` or `get_node_info`.                                                               |
| **All 24 primitive types work**    | Types 0-23 all tested and verified. Set via `set_attribute(enum_handle, 185, AT_INT=3, N)`. See primitive type table below.       |
| **RT pin layout varies**           | Don't assume RT pin indices. Always `get_node_info(RT)` — kernel may be pin 0 or 6, mesh may be pin 2 or 3.                       |
| **Blackbody efficiency=0.025**     | New NT_EMIS_BLACKBODY nodes default efficiency to ~0.025, not 1.0. Always set pin 0 child to 1.0 or emission is 40x weak.         |
| **Mesh A_RELOAD after A_FILENAME** | After `set_attribute(mesh, 34, 14, path)`, MUST also `set_attribute(mesh, 124, 1, true)` or mesh loads no geometry.               |
| **Save .ocs NOT .orbx for MCP**    | .orbx embeds assets with relative paths that break on reload. .ocs keeps absolute disk paths. Only .orbx for final delivery.      |
| **PT kernel BEFORE start_render**  | Connect NT_KERN_PATHTRACING to RT pin 6 BEFORE calling start_render(). Swapping kernels on a live render causes ECONNRESET crash. |

### Confirmed Crashes

| Trigger                                                 | Result                                              | Mitigation                                     |
| ------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------- |
| `resetProject` (any variant)                            | Triggers "Save changes?" dialog — blocks autonomous | Use delete-all-nodes pattern                   |
| `set_attribute(filename)` on ORBX-packaged texture node | DEADLINE_EXCEEDED — Octane hangs resolving path     | Rebuild fresh with absolute paths, or use .ocs |

### Under Investigation

| Trigger                                       | Observation                                                        | Status                |
| --------------------------------------------- | ------------------------------------------------------------------ | --------------------- |
| Heavy structural ops (destroy connected node) | Previously reported as crash — not yet reproduced with current MCP | Unverified conjecture |
| `update_scene()` in complex scene             | Previously reported as crash — not yet reproduced with current MCP | Unverified conjecture |
| NT_GEO_MESH batched build + `set_camera`      | Previously not reproducible                                        | Unverified conjecture |

**Resolved:** Primitive type changes on NT_GEO_OBJECT — all 24 types (0-23) work. Previous Quad(18) crashes were due to post-crash Octane state, not the type value itself.

**Don't batch with evaluate:false + update_scene()**: The crash pattern is `connect_nodes(evaluate:false)` × N → `update_scene()`, which forces a heavy synchronous evaluation on the gRPC message thread. In complex scenes (5+ emissive objects, PT kernel), this crashes. **Instead: use `evaluate:true` (default) so each call evaluates incrementally.** Then `set_camera()` to refresh the render. This is also better for human viewers watching the live viewport — they see each change appear. `update_scene()` is safe for small flushes but avoid it for batched structural changes.

### Refresh Pattern — CRITICAL

**`restart_render` / `start_render` do NOT refresh the viewport after structural changes** (connections, new geometry). Tested and confirmed 2026-03-07.

**`set_camera` is the ONLY reliable AND SAFE way to force a re-render.** Even setting it to the exact same position works. After every structural change:

```
connect_nodes(...)
set_camera(current_position, current_target)   # forces re-render
```

### Connection Rules

- **RT pins (0-11)**: `pin_index` works fine
- **Geo group dynamic pins**: `pin_index` SILENTLY FAILS. Must use `pin_name: "Input N"` (e.g. "Input 1", "Input 2")
- **Material emission pin 14**: Use `pin_name: "emission"` (pin_index may silently fail)
- **General rule**: If a connection returns success but `get_node_info` shows handle=0, switch to `pin_name`

### One Object at a Time — RULE

Every piece of geometry must be visually verified after connecting to the scene. No batching multiple geo objects into a single render check.

1. Build one object (create node, set attributes, connect material)
2. Connect to geo group → `set_camera()` → `save_render()` → `Read` PNG → verify
3. Only then start the next object

**Exceptions**: Setup infrastructure (RT, env, kernel, geo group) can batch. The first wall can batch with its geo group connection. But once objects are going in, each one renders individually.

**Why**: If something crashes or looks wrong, you know exactly which object caused it.

### Scene Clear — Delete Method (no dialog) — PROVEN

`reset_project` triggers a "Save changes?" dialog in Octane, blocking autonomous work. Instead, delete all nodes:

1. `get_scene_tree(max_depth: 1)` → list of top-level node handles
2. `delete_node(handle)` for each — leaf nodes first (emissions, textures, materials), then geo, then infra (group, env, kernel), then RT last
3. Verify: `get_scene_tree` → `count: 0`
4. Build new scene from scratch

Proven 2026-03-08: deleted 21 connected nodes from full ARCTIC scene, zero crashes. Order matters — delete leaves before parents to minimize risk of the "destroy connected node" crash pattern.

### Setup Order (for demos)

**Hero camera from the start.** The viewer sees objects pop into the final composed frame — much more cinematic than building in overview and jump-cutting. Know the camera position BEFORE you create the first node.

RT → hero camera → env → film → kernel → geo group. Start rendering right after RT creation. Env/daylight is peripheral context — get it in FAST so the human always reviews objects in a lit, atmospheric frame.

1. Clear scene (delete method or `reset_project` if user is present)
2. `create_node(NT_RENDERTARGET)` → RT handle + pin handles from response
3. `start_render(RT)` + `set_camera(HERO_POSITION → HERO_TARGET)` — the FINAL camera, not a placeholder
4. `create_node(NT_ENV_DAYLIGHT)` → connect to RT pin 1 → `set_camera` to refresh
5. Film: `get_node_info(film_settings_handle)` → pin 0 → "Image resolution" child → `set_attribute(child, 185, AT_INT2=4, {1024,576})`
6. `create_node(NT_KERN_PATHTRACING)` → connect to RT pin 6 → `set_camera` to refresh
7. `create_node(NT_GEO_GROUP)` → `set_attribute(group, 113, AT_INT=3, 8)` → connect to RT pin 3 → `set_camera`

### Setup Order (for iteration)

Same as demos but start camera wide/back/above. Iterate on framing after objects are in.

### 3D Asset Pipeline (OTOY Studio → Octane)

**OTOY Studio** (otoy.studio) provides AI-powered 3D generation:

1. **Text-to-Image**: Seedream v4.5 — generate concept art
2. **Image-to-3D**: Hunyuan-3d v3.1 [Pro] Image — 56 credits, needs front image, optional back/left/right views
3. **Download**: OBJ + texture PNG → save to `ORBX/assets/`
4. **Load in Octane**: `NT_GEO_MESH` → set `A_FILENAME` → material with `NT_TEX_IMAGE` for texture

**Model orientation — CRITICAL**:

- 3D models from Image-to-3D have a fixed facing direction determined by the source image
- **ALWAYS determine the model's facing direction BEFORE placing the camera** — do a test render from multiple angles if needed
- Anticipate orientation from the source image: if the subject faces the viewer in the 2D image, it likely faces +Z or -Z in the OBJ
- **Never place a default camera and hope** — have a complete composition plan (camera position, model facing, framing) before creating any nodes
- If the model faces the wrong way: rotate it (A_ROTATION=137) or reposition the camera

**Wiring pattern for external meshes**:

```
NT_TEX_IMAGE (texture file) → material albedo pin
NT_MAT_UNIVERSAL (material) → NT_GEO_MESH pin 0
NT_GEO_MESH (OBJ file) → NT_GEO_PLACEMENT pin "geometry"
NT_GEO_PLACEMENT (transform) → NT_GEO_GROUP pin "Input N"
```

### Emission Workaround

Auto-created child materials on NT_GEO_OBJECT **silently reject** emission connections. Create a **standalone** NT_MAT_DIFFUSE, connect emission to it via `pin_name: "emission"`, then connect to the geo object's material pin (1).

### Primitive Default

NT_GEO_OBJECT defaults to primitive=1 (Pill). Must explicitly set to 0 (Box) for box shapes.

---

## create_node Returns Pins

`create_node` returns `pins: [{index, handle}, ...]` — the handles of all auto-created pin children. This eliminates the need for `get_node_info` on freshly created nodes.

```
create_node(NT_GEO_OBJECT) → {
  handle: H, pins: [
    {index:0, handle:P0},  // primitive (Enum)
    {index:1, handle:P1},  // material (Diffuse)
    {index:2, handle:P2},  // objectLayer
    {index:3, handle:P3},  // transform
    {index:4, handle:P4},  // Width (Float)
    {index:5, handle:P5},  // Height (Float)
    {index:6, handle:P6},  // Depth (Float)
    {index:7, handle:P7},  // Subdivision (Int)
  ]
}
```

**Use `get_node_info` only when you need pin names or deeper children** (e.g. material → RGB color child on pin 0).

---

## Node Types (common)

| Category         | Type Key                 | ID  | Description                                                         |
| ---------------- | ------------------------ | --- | ------------------------------------------------------------------- |
| **Render**       | `NT_RENDERTARGET`        | 56  | Scene root                                                          |
| **Geometry**     | `NT_GEO_GROUP`           | 3   | Geometry container                                                  |
|                  | `NT_GEO_OBJECT`          | 153 | Geometric primitive (supports all primitive types — see pin 0 enum) |
|                  | `NT_GEO_MESH`            | 1   | Mesh from file (.obj/.fbx/.stl)                                     |
|                  | `NT_GEO_PLACEMENT`       | 4   | Placement wrapper (transform/scale)                                 |
|                  | `NT_GEO_PLANE`           | 110 | Infinite plane                                                      |
|                  | `NT_GEO_SCATTER`         | 5   | Scatter instances on surface                                        |
|                  | `NT_GEO_VOLUME`          | 115 | OpenVDB volume (.vdb)                                               |
| **Materials**    | `NT_MAT_UNIVERSAL`       | 130 | PBR material (recommended default)                                  |
|                  | `NT_MAT_DIFFUSE`         | 17  | Matte material                                                      |
|                  | `NT_MAT_GLOSSY`          | 16  | Glossy/reflective                                                   |
|                  | `NT_MAT_SPECULAR`        | 18  | Glass/transparent (IOR-based)                                       |
|                  | `NT_MAT_METAL`           | 120 | Metal (complex IOR)                                                 |
|                  | `NT_MAT_MIX`             | 19  | Blend two materials                                                 |
| **Textures**     | `NT_TEX_RGB`             | 33  | Solid color                                                         |
|                  | `NT_TEX_FLOAT`           | 31  | Solid float                                                         |
|                  | `NT_TEX_IMAGE`           | 34  | Image file                                                          |
|                  | `NT_TEX_CHECKS`          | 45  | Checkerboard                                                        |
|                  | `NT_TEX_NOISE`           | 87  | Noise                                                               |
| **Emission**     | `NT_EMIS_BLACKBODY`      | 53  | Thermal emission (power + temperature)                              |
|                  | `NT_EMIS_TEXTURE`        | 54  | Textured emission                                                   |
| **Environments** | `NT_ENV_DAYLIGHT`        | 14  | Physical sun + sky                                                  |
|                  | `NT_ENV_TEXTURE`         | 37  | HDRI environment                                                    |
| **Cameras**      | `NT_CAM_THINLENS`        | 13  | Standard camera                                                     |
|                  | `NT_CAM_UNIVERSAL`       | 157 | Multi-mode camera                                                   |
| **Kernels**      | `NT_KERN_PATHTRACING`    | 25  | Path tracing (use this!)                                            |
|                  | `NT_KERN_DIRECTLIGHTING` | 24  | Direct lighting (fast preview)                                      |
|                  | `NT_KERN_PMC`            | 23  | PMC (difficult caustics)                                            |
| **Lights**       | `NT_LIGHT_QUAD`          | 148 | Rectangular area light                                              |
|                  | `NT_LIGHT_SPHERE`        | 149 | Sphere area light                                                   |

## Attribute IDs

| ID  | Name            | Type           | Used For                                |
| --- | --------------- | -------------- | --------------------------------------- |
| 185 | `A_VALUE`       | varies         | Generic value (color, float, bool, int) |
| 34  | `A_FILENAME`    | AT_STRING (14) | File path for mesh/texture              |
| 113 | `A_PIN_COUNT`   | AT_INT (3)     | Pin count on groups                     |
| 172 | `A_TRANSLATION` | AT_FLOAT3 (11) | Position {x,y,z}                        |
| 137 | `A_ROTATION`    | AT_FLOAT3 (11) | Rotation degrees {x,y,z}                |
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

**Current workflow**: `create_node` → use pin handles from response → `set_attribute` on child handles. Use `get_node_info` only for deeper children.

---

## NT_GEO_OBJECT Pin Layout (always the same)

`create_node` returns all child handles. Pin indices are fixed:

| Pin | Name        | Child Type       | Notes                                                                                                                                       |
| --- | ----------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | primitive   | Enum value       | `set_attribute(child, 185, AT_INT=3, N)` — Box(0) default. Types 0-17 tested OK. Under investigation for crash on rapid sequential changes. |
| 1   | material    | Diffuse material | Auto-created. Has RGB child on its pin 0.                                                                                                   |
| 2   | objectLayer | Object layer     |                                                                                                                                             |
| 3   | transform   | Transform value  | `A_TRANSLATION=172` for position, `A_ROTATION=137` for rotation, `A_SCALE=139` for scale                                                    |
| 4   | Width       | Float value      | `set_attribute(child, 185, AT_FLOAT=9, 2.0)`                                                                                                |
| 5   | Height      | Float value      |                                                                                                                                             |
| 6   | Depth       | Float value      |                                                                                                                                             |
| 7   | Subdivision | Int value        | Keep low. High values may crash.                                                                                                            |

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

| Pin | Name     | Type           | Example                                                             |
| --- | -------- | -------------- | ------------------------------------------------------------------- |
| 0   | diffuse  | AT_FLOAT3 (11) | `set_attribute(child, 185, 11, {0.9, 0.9, 0.9})` -> white           |
| 10  | smooth   | AT_BOOL (1)    | `set_attribute(child, 185, 1, true)`                                |
| 14  | emission | —              | Use `connect_nodes` with `pin_name: "emission"` (NT_EMIS_BLACKBODY) |

## NT_EMIS_BLACKBODY Pin Layout (thermal emission)

| Pin | Name              | Type         | Example                                                                |
| --- | ----------------- | ------------ | ---------------------------------------------------------------------- |
| 0   | efficiency        | AT_FLOAT (9) | `set_attribute(child, 185, 9, 1.0)` — **MUST SET! Defaults to ~0.025** |
| 1   | power             | AT_FLOAT (9) | `set_attribute(child, 185, 9, 200)`                                    |
| 5   | temperature       | AT_FLOAT (9) | `set_attribute(child, 185, 9, 6500)` (Kelvin)                          |
| 2   | surfaceBrightness | AT_BOOL (1)  |                                                                        |
| 4   | doubleSided       | AT_BOOL (1)  |                                                                        |

## NT_GEO_PLACEMENT Pin Layout (mesh wrapper)

| Pin | Name      | Type            | Notes                                                                   |
| --- | --------- | --------------- | ----------------------------------------------------------------------- |
| 0   | transform | Transform value | `A_TRANSLATION=172`, `A_ROTATION=137`, `A_SCALE=139` (all AT_FLOAT3=11) |
| 1   | geometry  | —               | Connect mesh here via `pin_name: "geometry"` (NOT pin_index 0!)         |

**OBJ scale is multiplicative**: If the .obj defines 0.3×3×0.3 geometry, placement scale (0.3, 3, 0.3) = 0.09×9×0.09. Check the mesh's native size before scaling.

### Setting Material Color on Auto-Created Materials

NT_GEO_OBJECT auto-creates a diffuse material on pin 1. To set its color you need one `get_node_info` to find the RGB child:

```
get_node_info(material_handle) → pin 0 → RGB_child_handle
set_attribute(RGB_child, 185, AT_FLOAT3=11, {0.65, 0.05, 0.05})  → red
```

## Primitive Types (NT_GEO_OBJECT pin 0 enum)

Set via: `set_attribute(enum_child_handle, 185, AT_INT=3, N)`

| Val | Shape         | Val | Shape          |
| --- | ------------- | --- | -------------- |
| 0   | Box (DEFAULT) | 12  | Hyperboloid    |
| 1   | Pill          | 13  | Icosahedron    |
| 2   | Capsule       | 14  | Octahedron     |
| 3   | Cone          | 15  | Plane          |
| 4   | Cylinder      | 16  | Pentagon       |
| 5   | Dreidel       | 17  | Prism          |
| 6   | Disc          | 18  | Quad           |
| 7   | Dodecahedron  | 19  | Saddle         |
| 8   | Hemisphere    | 20  | Sphere         |
| 9   | Ellipsoid     | 21  | Tetrahedron    |
| 10  | Torus (fat)   | 22  | Torus          |
| 11  | Hourglass     | 23  | Truncated Cone |

All 24 primitive types (0-23) tested and verified working.

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
- **Image texture → material diffuse pin 0** (replaces auto-created RGB child)
- Blackbody emission → standalone material `pin_name: "emission"`
- Geometry objects → geo group `pin_name: "Input N"`
- Geo group → RT pin 3 (pin_index works)
- PT kernel → RT pin 6 (pin_index works)
- Specular material → geo mesh pin 0 (pin_index works)

### Image Texture on Material

To use an image file instead of a flat color on any material's diffuse:

```
create_node(NT_TEX_IMAGE) → TEX
set_attribute(TEX, A_FILENAME=34, AT_STRING=14, "C:/absolute/path/to/image.jpg")
connect_nodes(TEX → material, pin_index: 0)   # replaces auto-created RGB child
```

Works on auto-created materials (NT_GEO_OBJECT pin 1) and standalone materials. The image texture node uses A_FILENAME=34 (same as NT_GEO_MESH). No A_RELOAD needed — the texture loads on connect. Proven 2026-03-08 with OTOY Studio-generated ice texture on Cornell box floor.

### Sphere via .obj Mesh

For high-detail spheres or when you need UV mapping, use this mesh chain:

```
NT_GEO_MESH (load sphere.obj via A_FILENAME=34)
  → NT_GEO_PLACEMENT pin 1 (geometry)
    → placement transform child: A_TRANSLATION=172 for position, A_SCALE=139 for size
NT_MAT_SPECULAR → NT_GEO_MESH pin 0 (material)
NT_GEO_PLACEMENT → geo_group pin_name "Input N"
```

Files (must be **absolute paths** — relative paths don't resolve):

- `C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/sphere.obj` — low-poly sphere
- `C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/sphere_hd.obj` — high-detail sphere (used in Scene 1, radius ≈ 0.5)
- `C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/sphere_uv.obj` — UV-mapped sphere

---

## Materials

### Quick Recipes

All require `get_node_info` to discover child handles first, then `set_attribute(child, 185, type, value)`.

| Material       | Type                  | Key Attributes                                                                     |
| -------------- | --------------------- | ---------------------------------------------------------------------------------- |
| **White wall** | NT_MAT_DIFFUSE (auto) | RGB child → `(185, 11, {0.9, 0.9, 0.9})`                                           |
| **Red wall**   | NT_MAT_DIFFUSE (auto) | RGB child → `(185, 11, {0.65, 0.05, 0.05})`                                        |
| **Green wall** | NT_MAT_DIFFUSE (auto) | RGB child → `(185, 11, {0.12, 0.45, 0.15})`                                        |
| **Glass**      | NT_MAT_SPECULAR       | IOR child → `(185, 9, 1.5)` + smooth child → `(185, 1, true)`                      |
| **Gold**       | NT_MAT_GLOSSY         | Diffuse=(1, 0.84, 0), Specular=1.0, Roughness=0.15, **IOR=100** (metallic Fresnel) |
| **Chrome**     | NT_MAT_UNIVERSAL      | Metallic=1, Roughness=0, Albedo=white                                              |
| **Plastic**    | NT_MAT_UNIVERSAL      | Metallic=0, Roughness=0.2, Specular=0.5                                            |
| **Fabric**     | NT_MAT_UNIVERSAL      | Metallic=0, Roughness=0.9, Sheen=0.7                                               |
| **Textured**   | NT_MAT_DIFFUSE (auto) | NT_TEX_IMAGE → diffuse pin 0 (replaces RGB child)                                  |

### Metallic Fresnel — CRITICAL

NT_MAT_GLOSSY defaults to IOR 1.5 (glass). At low IOR, specular reflections only appear at grazing angles — the material looks like painted plastic, not metal. **For any metallic material (gold, chrome, copper, etc.), set IOR to 100** on the glossy material's `index` pin (pin 12). This flattens the Fresnel curve so it reflects at all angles, giving proper metallic behavior. The diffuse color then acts as the metallic tint.

For IOR values and material creative guidance, see `OCTANE_CREATIVE.md` Section 3.

---

## Lighting (MCP Pattern)

### Area Light (Emission Panel)

```
NT_GEO_OBJECT (thin box: H=0.01)
  → pin 1: standalone NT_MAT_DIFFUSE
              → pin_name "emission": NT_EMIS_BLACKBODY (power=200)
  → connect to geo_group via pin_name "Input N"
```

For lighting design, mood recipes, and environment strategy, see `OCTANE_CREATIVE.md` Sections 2 and 8.

---

## Kernels

| Kernel              | Type ID | Notes                                              |
| ------------------- | ------- | -------------------------------------------------- |
| **Path Tracing**    | 25      | ALWAYS use for interiors. DL kernel renders white. |
| **Direct Lighting** | 24      | No bounced light. Only for open/exterior scenes.   |
| **PMC**             | 23      | Slow but handles difficult glass caustics.         |

For kernel selection strategy, caustics tips, and denoiser settings, see `OCTANE_CREATIVE.md` Section 9.

---

---

## Discovery Workflow

### Fresh nodes — use create_node pins

1. `create_node` → handle + pins array with all child handles
2. `set_attribute` directly on child handles (primitive, W/H/D, transform)
3. For material color: `get_node_info(material_handle)` → pin 0 → RGB child → `set_attribute`

### Unknown nodes — full discovery

1. `create_node` → get handle + pin handles
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

## Scene Wisdom

> **Full creative wisdom is in `OCTANE_CREATIVE.md`** — glass/transparency rules, environment strategy, lighting design, material recipes, camera composition, AI generation tips, and session health. This section retains only technical/API-specific notes.

### Project File Workflow

- **.ocs** = scene file referencing assets by **absolute disk paths**. **Reloadable** — use during iteration and camera work. Asset paths survive reload.
- **.orbx** = packaged scene with **embedded assets** (copies textures/meshes inside the package). Portable for delivery, but **breaks MCP workflows** on reload:
  - Texture/mesh paths become **relative** (e.g. `assets\space_panorama.jpg`) — Octane resolves these inside the ORBX package, NOT from disk. You **cannot** simply re-point them to absolute paths; `set_attribute(filename)` may DEADLINE_EXCEEDED as Octane tries to reload from the broken internal path.
  - Placement/geo group connections may shift or disconnect.
  - All node handles reset (must re-query with `get_scene_tree`).
- **ORBX is NOT a resumable checkpoint for MCP**. If you save .orbx and reload later, you **cannot** patch individual paths — the packaged asset references are internal. Your options:
  1. **Rebuild fresh** — fastest for MCP. Delete all nodes, recreate with absolute paths. Scene 1 rebuilds in ~8 MCP rounds.
  2. **Unpack the .orbx** — use `octane.project.unpackPackage()` Lua API to extract assets to disk, then reload the .ocs inside.
  3. **Use .ocs instead** — save as .ocs during development (assets stay as absolute disk paths). Only package to .orbx for final delivery.
- **Recommended MCP workflow**: Always save `.ocs` during iteration. Only `.orbx` for final archival.

### Crash Debugging Protocol

- **On any crash**: Isolate the exact gRPC call from `mcp-debug.log`. Compare data format with octaneWebR's equivalent call in `grpc-debug.log`. Octane is stable — crashes are almost certainly malformed MCP data. Don't speculate — investigate.
- **Eclipse/backlight impossible without bloom**: Matte sphere + backlight produces no visible corona in path tracing. Needs post-processing bloom.

---

## Debug

### Common Failures

| Symptom                                     | Cause                                                 | Fix                                                 |
| ------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| Render all white                            | DL kernel (need PT), or camera outside scene          | Create PT kernel, connect to RT pin 6               |
| Render doesn't update after connect         | Used restart_render instead of set_camera             | Call `set_camera` after every structural change     |
| Connect returns success but nothing changed | Used pin_index on geo group (silently fails)          | Use `pin_name: "Input N"` for geo group             |
| Wrong aspect ratio                          | Film resolution set with AT_INT=3                     | Use AT_INT2=4 on Image resolution grandchild        |
| Film resolution won't change                | Set on Film Settings node, not Image Resolution child | get_node_info(film) → pin 0 → child → set_attribute |
| ECONNRESET/ECONNREFUSED                     | Octane crashed. STOP. User must restart.              | Avoid primitive changes, heavy structural ops       |
| Render grey/blue                            | Camera looking at sky through open wall               | Check wall positions and camera angle               |
| Mesh loads but invisible                    | Missing A_RELOAD after setting A_FILENAME             | `set_attribute(mesh, 124, AT_BOOL=1, true)`         |
| Emission very dim (40x weaker)              | Blackbody efficiency defaults to 0.025                | Set pin 0 child to 1.0                              |
| Mesh renders impossibly fast, no geo        | Engine corruption from excessive create/delete cycles | Restart Octane completely                           |
| Glass sphere invisible                      | Clear glass in uniform lighting                       | Use colored transmission for visibility             |

### Thread Safety

- Octane processes ALL API calls on a single "message thread"
- The MCP client serializes calls via a mutex — no parallel gRPC calls
- `ApiRenderEngine` is the only exception (thread-safe for render control/stats)
- Two gRPC peers (MCP + Vite plugin) can still interleave — avoid using both simultaneously

### Scale Reference

- 1 unit = 1 meter. Human eye height: Y=1.0-1.7. Table: Y=0.75. Room: 2.5-3.0 tall.

### Log Files

- `grpc-debug.log` — Vite plugin traffic (needs `DEBUG_FILE_LOG = true`)
- `mcp-debug.log` — MCP server traffic

---

## Pin Type Validation

`connect_nodes` validates pin types before connecting. If the source node's output type doesn't match the target pin's expected type, the connection is rejected with an error message. Types are queried via `ApiItem.outType` and `ApiNode.pinTypeIx`, cached per handle.

`get_node_info` now returns a `type` field on each pin (e.g. `PT_GEOMETRY`, `PT_MATERIAL`, `PT_KERNEL`). Use this to know what a pin accepts before connecting.

---

## ApiInfo — Octane's Type System Introspection

`ApiInfo` (gRPC service `ApiInfoService`) exposes Octane's complete type system — the same data OctaneSE uses internally. This is the foundation for making octaneWebR type-aware.

### Available Methods

| Method                                                              | Returns                                                   | Purpose                                                                        |
| ------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `getNodeTypes()`                                                    | All ~300 node types                                       | Complete node catalog                                                          |
| `nodeInfo(NodeType)`                                                | `ApiNodeInfo`                                             | outType, category, description, pinInfoCount, attributeInfoCount per node type |
| `nodePinInfo(NodeType, pinIx)`                                      | `ObjectRef` → `getApiNodePinInfo(ref)` → `ApiNodePinInfo` | Pin id, type, name, label, description, defaultNodeType                        |
| `attributeInfo(NodeType, AttrId)`                                   | `ApiAttributeInfo`                                        | Attribute type, isArray, description, defaults                                 |
| `attributeInfo1(NodeType, attrIx)`                                  | Same, by index                                            | Enumerate all attributes for a node type                                       |
| `getCompatibleTypes(PinType)`                                       | Compatible node types + graph types                       | Authoritative pin compatibility map                                            |
| `getPinTypes()`                                                     | All pin types                                             | Complete pin type catalog                                                      |
| `getPinTypeName(type)` / `getPinTypeColor(type)`                    | Name, ARGB color                                          | Pin type metadata                                                              |
| `getAttributeTypes()`                                               | All attribute types                                       | Complete attribute type catalog                                                |
| `getNodeTypeName(type)` / `getAttributeName(id)` / `getPinName(id)` | Name strings                                              | Forward lookups                                                                |
| `getAttributeId(name)` / `getPinId(name)`                           | IDs                                                       | Reverse lookups (name → ID)                                                    |

### Key Data Structures

**`ApiNodeInfo`** (from `octaneinfos.proto`):

```
type, outType, category, defaultName, description, pinInfoCount, attributeInfoCount,
movableInputCountAttribute, movableInputPinCount, movableInputFormat, movableInputName,
isHidden, isCreatableByApi, isLinker, texNodeTypeInfo, compatibilityModeInfos
```

**`ApiNodePinInfo`** (from `octaneinfos.proto`):

```
id (PinId), type (NodePinType), staticName, staticLabel, description, groupName,
defaultNodeType, pinColor, isTypedTexturePin, minVersion, endVersion,
boolInfo, floatInfo, intInfo, enumInfo, texInfo, transformInfo, stringInfo, ...
```

**`ApiAttributeInfo`** (from `octaneinfos.proto`):

```
id, type, isArray, description, defaultInts, defaultLongs, defaultFloats, defaultString
```

### API Cache (Built)

The API cache (`mcp/data/octane-api-cache.json`) contains 704 node types, 3362 pins, 45 pin types, and 43 compatibility maps (1.5 MB). Generated via `node scripts/fetch-cache-interactive.js`. The MCP server loads it on startup to:

- Skip pin enumeration gRPC calls on `create_node` (~90% fewer calls)
- Validate connection types from cache (0 gRPC calls for `connect_nodes`)
- Provide pin names/types from cache for `get_node_info` (2 fewer calls per pin)

---

## Asset Paths

Save assets to: `C:\otoyla\GRPC\dev\octaneWebR\ORBX\assets\`

Octane requires **absolute paths** with forward slashes: `C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/file.obj`

For asset sources, generation pipelines, and texture prompts, see `OCTANE_CREATIVE.md` Section 1.
