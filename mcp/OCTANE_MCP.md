# Octane MCP Reference

Best practices, observed patterns, and reference info for building scenes via the Octane MCP server. This is the single source of truth — recipes reference this file for all technical knowledge.

**Note**: Octane's gRPC API is **pre-alpha**. We are the engineering team testing it. **Assume crashes are our fault until proven otherwise.** Patterns and workarounds here are current findings — the API will evolve and updates may change any of this.

---

## ⚡ CHEAT SHEET — READ THIS FIRST

**DO NOT HALLUCINATE THESE VALUES. They are exact.**

```
RENDER OUTPUT:     C:/otoyla/GRPC/dev/octaneWebR/renders/
                   NEVER save renders to ORBX/. ORBX is for scenes + assets only.

ASSET PATH:        C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/
                   ALWAYS use absolute paths for A_FILENAME on meshes AND textures.
                   Relative paths are fragile (depend on Octane working dir).
MESH FILES:        floor.obj, sphere_hd.obj, sphere.obj, sphere_uv.obj,
                   cube.obj, torus.obj, ring.obj, teapot.obj, quad.obj,
                   diamond.obj, monolith.obj, prism.obj, pillar.obj

TRANSFORM ATTRS:   A_TRANSLATION = 172   A_ROTATION = 137   A_SCALE = 139
                   All AT_FLOAT3 (type 11).  NOT 140/141!
                   A_ROTATION uses DEGREES (90 = 90°, NOT radians!)

OTHER KEY ATTRS:   A_VALUE = 185   A_FILENAME = 34   A_RELOAD = 124

ATTR TYPES:        AT_BOOL=1  AT_INT=3  AT_INT2=4  AT_FLOAT=9
                   AT_FLOAT2=90  AT_FLOAT3=11  AT_STRING=14

WIRING PATTERN:    material → mesh (pin 0)
                   mesh → placement (pin_name "geometry")
                   placement → geo group (pin_name "Input N")
                   NOT: material → placement. NEVER.

RT PIN LAYOUT:     0=camera  1=environment  3=geometry  4=film  6=kernel
                   Camera pin 14 = aperture child. DEFAULT = 0.893 (DOF ON!).
                   Set to 0 immediately after start_render to disable DOF:
                   get_node_info(RT) → pin 0 → camera handle
                   get_node_info(camera) → pin 14 → aperture child handle
                   set_attribute(aperture_handle, 185, AT_FLOAT=9, 0)

BUILD MODES:       DRESS = demo for boss (1-by-1, max visual change/sec)
                   SPEED = batch everything, minimize round-trips

DRESS BUILD:       RT + PT kernel (connect BEFORE start_render!)
                   → final env (all values) → start_render → hero camera
                   → geo group (8 slots) → bare geo 1-by-1 (renders)
                   → materials 1-by-1 (renders) → refinement

SPEED BUILD:       create ALL nodes quickly (no renders between)
                   → set ALL attrs (evaluate:true, the default)
                   → wire ALL chains (evaluate:true)
                   → start_render → set_camera → save_render
                   NEVER use evaluate:false. See CRASH RULES below.

CRASH RULES:       1. NEVER use evaluate:false. Always use evaluate:true
                      (the default). 8× deferred set_attribute crashed Octane.
                   2. Restart ALL servers (dev, preview) before every build
                      run AND after every Octane crash.
                   3. NEVER create nodes in parallel. Sequential only.
                   4. NEVER call restart_render — crashes Octane.
                   5. NEVER set primitive type on NT_GEO_OBJECT — crashes
                      Octane non-deterministically (1-2 calls unconnected,
                      ~10 connected). Use NT_GEO_MESH + .obj files instead.
                      Available .obj: sphere, cube, torus, teapot, ring,
                      diamond, monolith, prism, pillar, quad, sphere_hd,
                      sphere_uv, floor. Default Box (no set_attr) is safe.

KERNEL NOTE:       RT has a default DL kernel. Swap to PT anytime — does NOT
                   crash. Kernel swap is safe even on a live render.

CONNECTION RULE:   Use pin_id for most connections — no ambiguity.
                   P_KERNEL=89, P_ENVIRONMENT=43,
                   P_MESH=111, P_DIFFUSE=30, P_EMISSION=41.
                   ⚠ EXCEPTION: RT geometry pin — use pin_index:3.
                   pin_id:59 (P_GEOMETRY) SILENTLY FAILS on RT
                   (reports success but connected_handle stays 0).
                   Geo group dynamic pins still need pin_name: "Input N".

VERIFY RULE:       ALWAYS call get_node_info(RT) after connecting to RT.
                   Check that pin 3 connected_handle != 0.
                   If 0 → connection silently failed. Fix before proceeding.
                   Also verify pin 1 (env) and pin 6 (kernel) after connecting.
                   NEVER trust "success:true" alone — verify the actual state.

LIVE RENDER:       Most changes (connect, set_attribute) take effect on
                   the live render. Don't stop render unnecessarily.

REFRESH RULE:      set_camera is the ONLY way to force re-render.
                   start_render does NOT refresh geometry.
                   NEVER use restart_render — it crashes Octane.
                   WARNING: set_camera RESETS up vector to (0,1,0).
                   NEVER flip up vector to compensate for model orientation.
                   ALWAYS rotate the MODEL instead (A_ROTATION=137).

⚠️ UP VECTOR:     Camera pin 22 (up Float3 node) DEFAULTS TO (0,1,0).
                   set_camera also resets up to (0,1,0).
                   NEVER set up to (0,0,0) — that destroys orientation.
                   If renders look wrong, verify up is still (0,1,0).

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

### Session Start / Post-Crash Restart Rules

**Exact restart sequence:**

1. **Claude stops servers** — `preview_stop` to shut down dev server / preview
2. **Wait for user** to restart Octane (NEVER try to restart Octane yourself)
3. **User gives the OK** — "go", "ok", "ready", etc.
4. **Claude starts servers** — `preview_start` for dev server
5. **Claude verifies** — `get_octane_version` (gRPC alive?), `preview_screenshot` (webapp live?)
6. **Build** — only then start creating nodes

**Build session rules:**

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
                        ⚠ Camera pin 14 = aperture child. Default = 0.893 (DOF ON).
                        After start_render: get_node_info(camera) → pin 14 → set_attribute(child, 185, AT_FLOAT=9, 0)
  pin 1: Environment     (NT_ENV_TEXTURE — auto-created)
  pin 3: Geometry        (connect geo here via pin_index:3 — pin_id:59 silently fails!)
  pin 4: Film Settings   (auto-created, has resolution child)
  pin 6: Kernel          (auto-creates DL kernel — swap to PT when ready, safe anytime)
```

### Coordinate System

- **+X = RIGHT**, **-X = LEFT**
- **+Y = UP**, **-Y = DOWN**
- **+Z = toward camera**, **-Z = into scene**

---

## Observed Patterns

These patterns supplement the Cheat Sheet with additional detail.

### Confirmed Crashes

| Trigger                                    | Mitigation                                                                                                                                                                                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Primitive type on multiple geo objects** | **Octane Alpha 5 bug.** Setting primitive type enum on >2 DIFFERENT NT_GEO_OBJECT nodes crashes Octane (2-6 objects). Single-object cycling is stable (87+ changes). **Use default Box or accept ~2-5 shapes/session.** See `CRASH_INVESTIGATION.md`. |
| `evaluate:false` × N (any node op)         | **NEVER defer evals** — 8× deferred set_attribute crashed. Always evaluate:true.                                                                                                                                                                      |
| `restart_render`                           | **NEVER use.** Causes ECONNRESET. Use `start_render` once — Octane stays in render mode. All changes are picked up live.                                                                                                                              |
| Parallel `create_node` calls               | Sequential only — 4× simultaneous = ECONNRESET                                                                                                                                                                                                        |
| `resetProject` (any variant)               | Use delete-all-nodes pattern (avoids "Save changes?" dialog)                                                                                                                                                                                          |
| Bad A_FILENAME (e.g. `:rgba` suffix)       | Pops Octane dialog blocking gRPC for 30s. Use valid absolute paths only.                                                                                                                                                                              |

### Refresh After Structural Changes

`start_render` does NOT refresh the viewport. **`set_camera` is the only way** (`restart_render` is deprecated — crashes Octane):

```
connect_nodes(...)
set_camera(current_position, current_target)   # forces re-render
```

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
4. `create_node(NT_ENV_DAYLIGHT)` → connect to RT `pin_id: 43` → `set_camera` to refresh
5. Film: `get_node_info(film_settings_handle)` → pin 0 → "Image resolution" child → `set_attribute(child, 185, AT_INT2=4, {1024,576})`
6. `create_node(NT_KERN_PATHTRACING)` → connect to RT `pin_id: 89` → `set_camera` to refresh
7. Connect geo to RT `pin_index: 3` (geo group OR direct geo objects — NOT pin_id:59!)
8. **⚠ VERIFY** — `get_node_info(RT)` → confirm pin 1 (env), pin 3 (geo), pin 6 (kernel) all have `connected_handle != 0`. If any is 0, the connection silently failed — fix before proceeding.

### Setup Order (for iteration)

Same as demos but start camera wide/back/above. Iterate on framing after objects are in.

### Setup Order (space scenes — no ambient light)

Space scenes have no environment light (texture env at low power provides stars but minimal illumination). **Create at least one light source and connect it to the geo group BEFORE adding geometry.** Otherwise the first render will be pure black and you won't know if geo is correctly placed.

1. RT → hero camera → geo group (connect to RT)
2. **Key light** → set position/power/size → connect to geo group → start render
3. First geo object → connect to geo group → quick render (now visible!)
4. Remaining objects one at a time
5. Environment (starfield) last — it's backdrop, not illumination

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
- If the model faces the wrong way: **rotate the model** (A_ROTATION=137) — NEVER flip the camera up vector

**File loading pattern** (meshes AND textures):

```
set_attribute(handle, A_FILENAME=34, AT_STRING=14, "C:\\otoyla\\...\\assets\\file.obj")
set_attribute(handle, A_RELOAD=124, AT_BOOL=1, true)   # CRITICAL — always reload!
```

**Wiring pattern for external meshes**:

```
NT_TEX_IMAGE (texture file) → material albedo pin
NT_MAT_UNIVERSAL (material) → NT_GEO_MESH pin 0
NT_GEO_MESH (OBJ file) → NT_GEO_PLACEMENT pin "geometry"  (pin_index 1)
NT_GEO_PLACEMENT (transform) → NT_GEO_GROUP pin "Input N"
```

### Emission Workaround

Auto-created child materials on NT_GEO_OBJECT **silently reject** emission connections. Create a **standalone** NT_MAT_DIFFUSE, connect emission to it via `pin_name: "emission"`, then connect to the geo object's material pin (1).

### Primitive Default

NT_GEO_OBJECT defaults to primitive=1 (Box). Value 0 is invalid (silently treated as Box).
All 23 primitive types are 1-indexed alphabetical — see "Primitive Types" table below.

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

## Pin Value RPCs — UNIMPLEMENTED

The proto defines `setPinValueByIx`, `setPinValueByPinID`, `setPinValueByName` (and get variants) but **Octane's gRPC server returns UNIMPLEMENTED for all 6**. These are future API stubs, not yet available. Tested 2026-03-07.

**Current workflow**: `create_node` → use pin handles from response → `set_attribute` on child handles. Use `get_node_info` only for deeper children.

---

## NT_GEO_OBJECT Pin Layout (always the same)

`create_node` returns all child handles. Pin indices are fixed:

| Pin | Name        | Child Type       | Notes                                                                                                      |
| --- | ----------- | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| 0   | primitive   | Enum value       | `set_attribute(child, 185, AT_INT=3, N)` — Box(1) default. Types 1-23 verified. ⚠ See crash warning below. |
| 1   | material    | Diffuse material | Auto-created. Has RGB child on its pin 0.                                                                  |
| 2   | objectLayer | Object layer     |                                                                                                            |
| 3   | transform   | Transform value  | `A_TRANSLATION=172` for position, `A_ROTATION=137` for rotation, `A_SCALE=139` for scale                   |
| 4   | Width       | Float value      | `set_attribute(child, 185, AT_FLOAT=9, 2.0)`                                                               |
| 5   | Height      | Float value      |                                                                                                            |
| 6   | Depth       | Float value      |                                                                                                            |
| 7   | Subdivision | Int value        | Keep low. High values may crash.                                                                           |

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

Set via: `set_attribute(enum_child_handle, 185, AT_INT=3, N)` then `update_scene()`.

**IMPORTANT:** `update_scene()` is REQUIRED after setting primitive type — without it the render won't update.

| Val | Shape          | Val | Shape          |
| --- | -------------- | --- | -------------- |
| 1   | Box (DEFAULT)  | 13  | Icosahedron    |
| 2   | Capsule        | 14  | Octahedron     |
| 3   | Cone           | 15  | Plane          |
| 4   | Cylinder       | 16  | Polygon        |
| 5   | Ding dong      | 17  | Prism          |
| 6   | Disc           | 18  | Quad           |
| 7   | Dodecahedron   | 19  | Saddle         |
| 8   | Dome           | 20  | Sphere         |
| 9   | Ellipsoid      | 21  | Tetrahedron    |
| 10  | Elliptic torus | 22  | Torus          |
| 11  | Figure eight   | 23  | Truncated cone |
| 12  | Hyperboloid    |     |                |

IDs are 1-indexed alphabetical (0 is invalid, defaults to Box). All 23 types (1-23) empirically verified.

---

## Connection Patterns

### Pin Compatibility

| Pin                      | Accepts                     | Rejects              |
| ------------------------ | --------------------------- | -------------------- |
| diffuse (P_DIFFUSE=30)   | Texture nodes (NT*TEX*\*)   | Emissions, materials |
| emission (P_EMISSION=41) | Emission nodes (NT*EMIS*\*) | Raw textures         |
| material (geo pin 0)     | Material nodes (NT*MAT*\*)  | Textures, emissions  |
| geometry (P_GEOMETRY=59) | Geometry (NT*GEO*\*)        | Materials, textures  |

### Verified Connections

- RGB texture → material diffuse `pin_id: 30` (P_DIFFUSE)
- **Image texture → material diffuse `pin_id: 30`** (replaces auto-created RGB child)
- Blackbody emission → material `pin_id: 41` (P_EMISSION)
- Geometry objects → geo group `pin_name: "Input N"` (dynamic pins — pin_name required)
- Geo group → RT `pin_index: 3` (⚠ pin_id:59 silently fails on RT!)
- Geo objects → RT `pin_index: 3` directly (Octane auto-creates a geometry group)
- PT kernel → RT `pin_id: 89` (P_KERNEL)
- Environment → RT `pin_id: 43` (P_ENVIRONMENT)
- Specular material → geo mesh pin 0 (pin_index works for mesh material slot)

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

> Creative guidance (lighting, materials, composition) is in `OCTANE_CREATIVE.md`. This section covers technical/API-specific patterns.

### Project File Workflow

- **.ocs** = absolute disk paths → reloadable, use during MCP iteration
- **.orbx** = embedded assets with relative paths → works fine with MCP. Can reload and set valid A_FILENAME paths.
- **Warning**: Bad filenames (e.g. `:rgba` suffix) pop Octane native dialogs that block gRPC for 30s (DEADLINE_EXCEEDED).
- **Recommended**: `.ocs` during development (absolute paths, faster iteration). `.orbx` for archival/sharing.

### Single-Mesh Framing Workflow

When framing a new mesh for a hero shot, always follow this order:

1. **Set all mesh transforms to zero** — rotation (0,0,0), translation (0,0,0), keep scale as needed
2. **Compute the mesh centroid** — parse OBJ vertices, find bounding box, centroid = (min+max)/2 per axis. Apply scale (no rotation/translation yet).
3. **Set camera target to centroid** — stable orbit pivot
4. **Verify up vector is (0,1,0)** — camera pin 22 defaults to (0,1,0). set_camera resets it. Only check if renders look tilted.
5. **Back the camera way up** — increase Z so the full mesh is visible. Establish orientation.
6. **Orbit up** — raise camera Y slightly above target for a natural elevated angle
7. **Refine target** — once mesh is visible, fine-tune target (doesn't have to be exact centroid)
8. **Zoom in** — reduce Z until mesh fills frame

**Common failure modes:**

- Compound mesh rotations (X+Y+Z) before finding face direction — breaks up alignment
- Target far from centroid — orbit drifts off-subject
- Skipping up vector check — silent roll, random orientation
- Moving camera close before establishing orientation — impossible to recover

### Crash Debugging

On any crash: isolate the exact gRPC call from `mcp-debug.log`, compare with octaneWebR's `grpc-debug.log`. Crashes are almost certainly malformed MCP data — investigate, don't speculate.

---

## Debug

### Common Failures

| Symptom                                      | Cause                                                                                      | Fix                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Render all white                             | DL kernel (need PT), camera outside scene, OR geo/env not actually connected (silent fail) | Verify RT connections first: `get_node_info(RT)` → check pin 1, 3, 6 all have connected_handle != 0      |
| Render doesn't update after connect          | Used restart_render instead of set_camera                                                  | Call `set_camera` after every structural change                                                          |
| Connect returns success but nothing changed  | Used pin_index on geo group (silently fails)                                               | Use `pin_name: "Input N"` for geo group                                                                  |
| Geo connected to RT but render shows nothing | Used pin_id:59 for RT geometry (silently fails)                                            | Use `pin_index: 3` for RT geometry. ALWAYS verify with `get_node_info(RT)` → pin 3 connected_handle != 0 |
| Wrong aspect ratio                           | Film resolution set with AT_INT=3                                                          | Use AT_INT2=4 on Image resolution grandchild                                                             |
| Film resolution won't change                 | Set on Film Settings node, not Image Resolution child                                      | get_node_info(film) → pin 0 → child → set_attribute                                                      |
| ECONNRESET/ECONNREFUSED                      | Octane crashed. STOP. User must restart.                                                   | Common cause: primitive type on >2 geo objects, restart_render, or evaluate:false batching               |
| Render grey/blue                             | Camera looking at sky through open wall                                                    | Check wall positions and camera angle                                                                    |
| Render blurry / soft focus                   | DOF on by default — aperture defaults to 0.893                                             | RT→pin0(camera)→get_node_info→pin14(aperture)→set_attribute(child,185,AT_FLOAT=9,0)                      |
| Mesh loads but invisible                     | Missing A_RELOAD after setting A_FILENAME                                                  | `set_attribute(mesh, 124, AT_BOOL=1, true)`                                                              |
| Emission very dim (40x weaker)               | Blackbody efficiency defaults to 0.025                                                     | Set pin 0 child to 1.0                                                                                   |
| Mesh renders impossibly fast, no geo         | Stale engine state (create/delete cycles tested safe)                                      | Restart Octane completely                                                                                |
| Glass sphere invisible                       | Clear glass in uniform lighting                                                            | Use colored transmission for visibility                                                                  |

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

## External Resources

When in doubt about Octane behavior, search the web or these resources:

| Resource            | URL                                                | Use For                             |
| ------------------- | -------------------------------------------------- | ----------------------------------- |
| **OTOY Forum**      | https://render.otoy.com/forum/index.php            | Community knowledge, scene tips     |
| **Octane Docs**     | https://docs.otoy.com/                             | Official plugin/standalone docs     |
| **Octane Docs MCP** | `npx -y mcp-remote https://octane-mcp.otoy.ai/sse` | Lua API search, constants, examples |
| **Octane Live DB**  | https://render.otoy.com/livedb/                    | Community materials and assets      |
| **Poly Haven**      | https://polyhaven.com/                             | Free HDRI, textures, models         |
