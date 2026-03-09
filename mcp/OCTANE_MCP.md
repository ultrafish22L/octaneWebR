# Octane MCP Reference

Best practices, observed patterns, and reference info for building scenes via the Octane MCP server. This is the single source of truth — recipes reference this file for all technical knowledge.

**Note**: Octane's gRPC API is **pre-alpha**. We are the engineering team testing it. **Assume crashes are our fault until proven otherwise.** Patterns and workarounds here are current findings — the API will evolve and updates may change any of this.

---

## Demo Workflow

### Three Layers

| Layer         | File                             | Purpose                                                                                              |
| ------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Recipe**    | e.g. `CORNELL_RECIPE.md`         | Pure prose — what the scene should look like. No tech.                                               |
| **Knowledge** | `OCTANE_MCP.md` (this file)      | All technical rules, attribute IDs, crash prevention.                                                |
| **Cooked**    | e.g. `CORNELL_COOKED_CLASSIC.md` | Recipe compiled to literal MCP calls. Variant suffix required (e.g. `_CLASSIC`, `_WARM`, `_CHROME`). |

### Three Phases

1. **Recipe** — Human writes/approves a prose scene description.
2. **Test & Refine** — Build from recipe + this file's knowledge. Render after EVERY object. Critically evaluate each render (shape? color? position? material?). If wrong, STOP and fix. Iterate until perfect.
3. **Cook** — Compile the proven working sequence into literal MCP calls. Review in critical persona. Human approves. Future runs execute mechanically.

### Session Start Rules

1. **Read the recipe file** — never rely on memory or context summaries
2. **Read this file's critical rules** — refresh knowledge
3. **Read or generate the cooked file** if one exists
4. **Render after every change** — save_render → Read PNG → evaluate → show to human (both Phase 2 and replay)
5. **Never trust session continuation summaries** for MCP scene state — verify or start fresh

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

| Rule                               | Why                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Create NT_KERN_PATHTRACING**     | Default DL kernel renders all-white for interior scenes. Connect to RT pin 6.                                             |
| **Film resolution on grandchild**  | RT → pin 4 (film settings) → get_node_info → pin 0 ("Image resolution") → `set_attribute(child, 185, AT_INT2=4, {x,y})`   |
| **Geo group pin count first**      | `set_attribute(group, A_PIN_COUNT=113, AT_INT=3, N)` BEFORE connecting children.                                          |
| **Geo group uses pin_name**        | `connectToIx` silently fails on dynamic geo group pins. Must use `pin_name: "Input 1"`, `"Input 2"`, etc.                 |
| **Handles are opaque**             | Never guess. Only use values from `create_node` or `get_node_info`.                                                       |
| **Sphere primitive=20 CRASHES**    | Confirmed 2026-03-07. Immediate ECONNRESET. Use NT_GEO_MESH + sphere.obj instead.                                         |
| **Torus primitive=22 CRASHES**     | Confirmed 2026-03-08. Delayed ECONNRESET. Use NT_GEO_MESH + torus.obj instead.                                            |
| **ALL primitive changes suspect**  | Cone(3) also crashed. Box(0) works only because it's the DEFAULT. For any non-box shape, use NT_GEO_MESH + .obj.          |
| **RT pin layout varies**           | Don't assume RT pin indices. Always `get_node_info(RT)` — kernel may be pin 0 or 6, mesh may be pin 2 or 3.               |
| **Blackbody efficiency=0.025**     | New NT_EMIS_BLACKBODY nodes default efficiency to ~0.025, not 1.0. Always set pin 0 child to 1.0 or emission is 40x weak. |
| **Mesh A_RELOAD after A_FILENAME** | After `set_attribute(mesh, 34, 14, path)`, MUST also `set_attribute(mesh, 124, 1, true)` or mesh loads no geometry.       |

### Confirmed Crashes

| Trigger                                                     | Result                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------- |
| `set_attribute(primitive_enum, 185, AT_INT=3, 20)` (Sphere) | Immediate ECONNRESET                                     |
| `set_attribute(primitive_enum, 185, AT_INT=3, 22)` (Torus)  | Delayed ECONNRESET                                       |
| `resetProject` without `suppressUI: true`                   | Crash from gRPC thread UI sync                           |
| `resetProject` (any variant)                                | Triggers "Save changes?" dialog — blocks autonomous work |
| Heavy structural ops (destroy connected node, ungroup)      | Delayed ECONNRESET 5-9s after success                    |
| NT_GEO_MESH batched build + `set_camera` eval               | ECONNRESET (not fully reproducible)                      |
| `set_attribute(primitive_enum, 185, AT_INT=3, 3)` (Cone)    | Immediate ECONNRESET (non-deterministic)                 |
| `update_scene()` in complex emissive scene (5+ lights + PT) | Immediate ECONNRESET (confirmed)                         |

**Mesh build mitigation**: Build mesh objects in phases — create + set filename + reload → `set_camera()` → connect material/placement → `set_camera()`.

**Don't batch with evaluate:false + update_scene()**: The crash pattern is `connect_nodes(evaluate:false)` × N → `update_scene()`, which forces a heavy synchronous evaluation on the gRPC message thread. In complex scenes (5+ emissive objects, PT kernel), this crashes. **Instead: use `evaluate:true` (default) so each call evaluates incrementally.** Then `set_camera()` to refresh the render. This is also better for human viewers watching the live viewport — they see each change appear. `update_scene()` is safe for small flushes but avoid it for batched structural changes.

### Refresh Pattern — CRITICAL

**`restart_render` / `start_render` do NOT refresh the viewport after structural changes** (connections, new geometry). Tested and confirmed 2026-03-07.

**`set_camera` is the ONLY reliable AND SAFE way to force a re-render.** Even setting it to the exact same position works. After every structural change:

```
connect_nodes(...)
set_camera(current_position, current_target)   # forces re-render
```

**Avoid batching deferred changes** — using `connect_nodes(evaluate:false)` × N then `update_scene()` forces a heavy synchronous eval that crashed "The Summoning" (5th emissive object, 2026-03-08). Instead, use `evaluate:true` (default) so each connection evaluates incrementally, then `set_camera` to refresh. `update_scene()` is fine for small flushes but dangerous for large batched structural changes in complex scenes.

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

RT → camera → env → film → kernel → geo group. Start rendering right after RT creation.

1. Clear scene (delete method or `reset_project` if user is present)
2. `create_node(NT_RENDERTARGET)` → RT handle + pin handles from response
3. `start_render(RT)` + `set_camera(0, 1, 3.2 → 0, 1, 0)`
4. `create_node(NT_ENV_DAYLIGHT)` → connect to RT pin 1 → `set_camera` to refresh
5. Film: `get_node_info(film_settings_handle)` → pin 0 → "Image resolution" child → `set_attribute(child, 185, AT_INT2=4, {1024,1024})`
6. `create_node(NT_KERN_PATHTRACING)` → connect to RT pin 6 → `set_camera` to refresh
7. `create_node(NT_GEO_GROUP)` → `set_attribute(group, 113, AT_INT=3, 8)` → connect to RT pin 3 → `set_camera`

### Camera (Cornell Box)

```
position: (0, 1, 3.2)  target: (0, 1, 0)
```

Interior view from front, frames entire 2x2x2 box.

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

| Category         | Type Key                 | ID  | Description                                     |
| ---------------- | ------------------------ | --- | ----------------------------------------------- |
| **Render**       | `NT_RENDERTARGET`        | 56  | Scene root                                      |
| **Geometry**     | `NT_GEO_GROUP`           | 3   | Geometry container                              |
|                  | `NT_GEO_OBJECT`          | 153 | Geometric primitive (box/cone/etc — NOT sphere) |
|                  | `NT_GEO_MESH`            | 1   | Mesh from file (.obj/.fbx/.stl)                 |
|                  | `NT_GEO_PLACEMENT`       | 4   | Placement wrapper (transform/scale)             |
|                  | `NT_GEO_PLANE`           | 110 | Infinite plane                                  |
|                  | `NT_GEO_SCATTER`         | 5   | Scatter instances on surface                    |
|                  | `NT_GEO_VOLUME`          | 115 | OpenVDB volume (.vdb)                           |
| **Materials**    | `NT_MAT_UNIVERSAL`       | 130 | PBR material (recommended default)              |
|                  | `NT_MAT_DIFFUSE`         | 17  | Matte material                                  |
|                  | `NT_MAT_GLOSSY`          | 16  | Glossy/reflective                               |
|                  | `NT_MAT_SPECULAR`        | 18  | Glass/transparent (IOR-based)                   |
|                  | `NT_MAT_METAL`           | 120 | Metal (complex IOR)                             |
|                  | `NT_MAT_MIX`             | 19  | Blend two materials                             |
| **Textures**     | `NT_TEX_RGB`             | 33  | Solid color                                     |
|                  | `NT_TEX_FLOAT`           | 31  | Solid float                                     |
|                  | `NT_TEX_IMAGE`           | 34  | Image file                                      |
|                  | `NT_TEX_CHECKS`          | 45  | Checkerboard                                    |
|                  | `NT_TEX_NOISE`           | 87  | Noise                                           |
| **Emission**     | `NT_EMIS_BLACKBODY`      | 53  | Thermal emission (power + temperature)          |
|                  | `NT_EMIS_TEXTURE`        | 54  | Textured emission                               |
| **Environments** | `NT_ENV_DAYLIGHT`        | 14  | Physical sun + sky                              |
|                  | `NT_ENV_TEXTURE`         | 37  | HDRI environment                                |
| **Cameras**      | `NT_CAM_THINLENS`        | 13  | Standard camera                                 |
|                  | `NT_CAM_UNIVERSAL`       | 157 | Multi-mode camera                               |
| **Kernels**      | `NT_KERN_PATHTRACING`    | 25  | Path tracing (use this!)                        |
|                  | `NT_KERN_DIRECTLIGHTING` | 24  | Direct lighting (fast preview)                  |
|                  | `NT_KERN_PMC`            | 23  | PMC (difficult caustics)                        |
| **Lights**       | `NT_LIGHT_QUAD`          | 148 | Rectangular area light                          |
|                  | `NT_LIGHT_SPHERE`        | 149 | Sphere area light                               |

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

| Pin | Name        | Child Type       | Notes                                                                                     |
| --- | ----------- | ---------------- | ----------------------------------------------------------------------------------------- |
| 0   | primitive   | Enum value       | `set_attribute(child, 185, AT_INT=3, 0)` for Box. **Never set to 20 (Sphere) — crashes!** |
| 1   | material    | Diffuse material | Auto-created. Has RGB child on its pin 0.                                                 |
| 2   | objectLayer | Object layer     |                                                                                           |
| 3   | transform   | Transform value  | `A_TRANSLATION=172` for position, `A_ROTATION=137` for rotation, `A_SCALE=139` for scale  |
| 4   | Width       | Float value      | `set_attribute(child, 185, AT_FLOAT=9, 2.0)`                                              |
| 5   | Height      | Float value      |                                                                                           |
| 6   | Depth       | Float value      |                                                                                           |
| 7   | Subdivision | Int value        | Keep low. High values may crash.                                                          |

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

## Primitive Types

| Val | Shape          | Val    | Shape                       |
| --- | -------------- | ------ | --------------------------- |
| 0   | Box            | 12     | Hyperboloid                 |
| 1   | Pill (default) | 13     | Icosahedron                 |
| 2   | Capsule        | 14     | Octahedron                  |
| 3   | Cone           | 15     | Plane                       |
| 4   | Cylinder       | 16     | Pentagon                    |
| 5   | Dreidel        | 17     | Prism                       |
| 6   | Disc           | 18     | Quad                        |
| 7   | Dodecahedron   | 19     | Saddle                      |
| 8   | Hemisphere     | **20** | **Sphere — CRASHES Octane** |
| 9   | Ellipsoid      | 21     | Tetrahedron                 |
| 10  | Torus (fat)    | **22** | **Torus — CRASHES Octane**  |
| 11  | Hourglass      | 23     | Truncated Cone              |

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

Primitive=20 crashes. Use this chain instead:

```
NT_GEO_MESH (load sphere.obj via A_FILENAME=34)
  → NT_GEO_PLACEMENT pin 1 (geometry)
    → placement transform child: A_TRANSLATION=172 for position, A_SCALE=139 for size
NT_MAT_SPECULAR → NT_GEO_MESH pin 0 (material)
NT_GEO_PLACEMENT → geo_group pin_name "Input N"
```

File: `C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/sphere.obj` (must be **absolute path** — relative paths don't resolve)

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
| **Textured**   | NT_MAT_DIFFUSE (auto) | NT_TEX_IMAGE → diffuse pin 0 (replaces RGB child)             |

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
              → pin_name "emission": NT_EMIS_BLACKBODY (power=200)
  → connect to geo_group via pin_name "Input N"
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
- **Film resolution**: Set on Image resolution grandchild of RT

---

## Cornell Box Build Order

Wall order: left (red) → right (green) → floor → ceiling → back. Then light, tall box, sphere.

| Group Pin | Object       | Dimensions      | Position                      | Material               |
| --------- | ------------ | --------------- | ----------------------------- | ---------------------- |
| Input 1   | Left wall    | 0.01x2.0x2.0    | (-1,1,0)                      | red (0.65,0.05,0.05)   |
| Input 2   | Right wall   | 0.01x2.0x2.0    | (1,1,0)                       | green (0.12,0.45,0.15) |
| Input 3   | Floor        | 2.0x0.01x2.0    | (0,0,0)                       | white                  |
| Input 4   | Ceiling      | 2.0x0.01x2.0    | (0,2,0)                       | white                  |
| Input 5   | Back wall    | 2.0x2.0x0.01    | (0,1,-1)                      | white                  |
| Input 6   | Light panel  | 0.47x0.01x0.38  | (0,1.99,0)                    | blackbody power=200    |
| Input 7   | Tall box     | 0.59x1.19x0.59  | (0.29,0.59,0.33) rotY=22      | white (0.9,0.9,0.9)    |
| Input 8   | Glass sphere | mesh sphere.obj | (-0.33,0.30,-0.16) scale=0.59 | specular IOR=1.5       |

For each object: create → set attributes → connect to geo group via `pin_name` → `set_camera` to refresh viewport.

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

## Scene Wisdom (proven the hard way)

### Glass & Transparency

- **Clear glass is invisible in uniform lighting**: Proven in Cluster and Eclipse scenes. Clear glass spheres in daylight/uniform env are completely invisible — only caustic shadows on the floor show evidence. Use colored transmission (e.g. amber, blue) for visibility.
- **Quad lights always visible through glass**: Even tiny (0.1) quad lights with extreme power show as refracted rectangles through transparent glass. Only fix: move lights out of frame or disconnect.
- **Amber glass absorbs cool light**: Amber transmission (1, 0.6, 0.1) absorbs blue/green wavelengths completely. Cool-toned light can't illuminate amber glass — sphere appears black on the cool-lit side. Use glossy metallic gold instead of amber glass if you need warm tones.

### Render Engine Stability

- **Engine corrupts after ~50+ create/delete cycles**: After extensive node creation/deletion in a single session, the render engine may stop rendering mesh geometry (shows only environment + built-in geo, renders at impossible speed). Loading .orbx files also fails. Requires full Octane restart.
- **Eclipse/backlight impossible without bloom**: A matte black sphere with a bright light behind it produces no visible corona in path tracing. Would need volumetrics or post-processing bloom.

### Project File Workflow

- **.ocs** = scene file referencing assets by disk path. **Reloadable** — use during iteration and camera work.
- **.orbx** = packaged scene with embedded assets. **Portable** — use for final delivery. But external file references break on reload (textures look inside package, not on disk).
- **Workflow**: Save .ocs during development, .orbx for final delivery. Unpack .orbx with `octane.project.unpackPackage()` Lua API if needed.
- **.orbx reload loses mesh connections**: After save/load .orbx, placement nodes may change pin layout. Meshes on late geo group pins may disconnect. External OBJ paths also lost. Verify and reconnect after reload.

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

## Asset Sources

- **3D Models**: Sketchfab, TurboSquid (free), Poly Haven
- **HDRIs**: [Poly Haven](https://polyhaven.com/hdris) — .hdr/.exr for NT_ENV_TEXTURE
- **Textures**: [Poly Haven](https://polyhaven.com/textures), [ambientCG](https://ambientcg.com)
- **OTOY Studio**: https://otoy.studio/ — AI text-to-image + image-to-3D (see workflow below)
- **Formats**: .obj, .fbx, .stl, .ply, .abc | .png, .jpg, .exr, .hdr | .vdb | .orbx, .ocs

Save to: `C:\otoyla\GRPC\dev\octaneWebR\ORBX\assets\`

Cooked files use `${ASSETS}` — resolve to the absolute path above at runtime (Octane requires absolute paths).

### OTOY Studio → Octane Pipeline (proven 2026-03-08)

**Text-to-Image** (Seedream v4):

1. Navigate to https://otoy.studio/ (user must be logged in)
2. Enter prompt, select aspect ratio, click Create (~10s generation)
3. Click thumbnail in gallery → Generation Details panel
4. Click Download button (use `find("Download button")` + ref-click — coordinate clicks unreliable)
5. File lands in `C:/Users/johnc/Downloads/otoy_studio_image_{prompt}_{timestamp}.jpg`
6. Copy to `ORBX/assets/` → use as NT_TEX_IMAGE filename

**Image-to-3D** (Seed3D): Navigate to `/image-to-3d`, upload reference image, 2 credits per generation. Not yet tested end-to-end.

**Full pipeline proven**: OTOY Studio generate → download → NT_TEX_IMAGE → material diffuse → render. Used for ice texture on ARCTIC Cornell box floor.
