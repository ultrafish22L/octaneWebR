# Octane Reference

Lookup tables for MCP scene building. Don't read front-to-back — find what you need.

For rules and crash prevention, see the MCP Rules section in `CLAUDE.md`.
For build workflow, see `BUILD.md`.
For troubleshooting, see `TROUBLESHOOTING.md`.

---

## Paths

| Path                                         | Purpose                                     |
| -------------------------------------------- | ------------------------------------------- |
| `C:/otoyla/GRPC/dev/octaneWebR/renders/`     | Render output. NEVER save renders to ORBX/. |
| `C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/` | Asset path for meshes and textures.         |

ALWAYS use absolute paths for `A_FILENAME` on meshes AND textures. Relative paths are fragile (depend on Octane working dir).

### File Loading Pattern (meshes AND textures)

```
set_attribute(handle, A_FILENAME=34, AT_STRING=14, "C:\\otoyla\\...\\assets\\file.obj")
set_attribute(handle, A_RELOAD=124, AT_BOOL=1, true)   # CRITICAL — always reload!
```

---

## Attributes

### Transform Attributes

| Attribute     | ID  | Type           | Notes               |
| ------------- | --- | -------------- | ------------------- |
| A_TRANSLATION | 172 | AT_FLOAT3 (11) | World units         |
| A_ROTATION    | 137 | AT_FLOAT3 (11) | DEGREES not radians |
| A_SCALE       | 139 | AT_FLOAT3 (11) | Uniform = {1,1,1}   |

NOT 140/141!

### Other Key Attributes

| Attribute  | ID  | Notes                         |
| ---------- | --- | ----------------------------- |
| A_VALUE    | 185 | General value attribute       |
| A_FILENAME | 34  | File path for meshes/textures |
| A_RELOAD   | 124 | Trigger file reload           |

### Attribute Types

| Type      | ID  |
| --------- | --- |
| AT_BOOL   | 1   |
| AT_INT    | 3   |
| AT_INT2   | 4   |
| AT_FLOAT  | 9   |
| AT_FLOAT2 | 90  |
| AT_FLOAT3 | 11  |
| AT_STRING | 14  |

---

## RT Pin Layout (NT_RENDERTARGET)

| Pin | Name              | Type            | Notes                                                            |
| --- | ----------------- | --------------- | ---------------------------------------------------------------- |
| 0   | camera            | PT_CAMERA       | Auto-created (Thin lens)                                         |
| 1   | environment       | PT_ENVIRONMENT  | Auto-created (Texture env)                                       |
| 2   | cameraEnvironment | PT_ENVIRONMENT  | Optional                                                         |
| 3   | **mesh**          | **PT_GEOMETRY** | **Connect geo here via pin_index:3** (pin_id:59 silently fails!) |
| 4   | film              | PT_FILM         | Auto-created, has resolution child                               |
| 6   | kernel            | PT_KERNEL       | Auto-created (Direct lighting)                                   |

Camera pin 14 = aperture child. DEFAULT = 0.893 (DOF ON!).
Set to 0 immediately after start_render to disable DOF:

```
get_node_info(RT) → pin 0 → camera handle
get_node_info(camera) → pin 14 → aperture child handle
set_attribute(aperture_handle, 185, AT_FLOAT=9, 0)
```

Film resolution: `get_node_info(film)` → pin 0 → "Image resolution" child → `set_attribute(child, 185, AT_INT2=4, {1024,576})`

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
|                  | `NT_TEX_MIX`             | 38  | Mix/blend two textures                                              |
|                  | `NT_TEX_MULTIPLY`        | 39  | Multiply two textures                                               |
|                  | `NT_TEX_ADD`             | 106 | Add two textures                                                    |
|                  | `NT_TEX_SUBTRACT`        | 108 | Subtract two textures                                               |
|                  | `NT_TEX_MARBLE`          | 47  | Marble procedural                                                   |
|                  | `NT_TEX_TURBULENCE`      | 22  | Turbulence procedural                                               |
|                  | `NT_TEX_GRADIENT`        | 49  | Gradient                                                            |
|                  | `NT_TEX_FALLOFF`         | 50  | Falloff                                                             |
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
| **Medium**       | `NT_MED_SCATTERING`      | —   | Scattering medium (volumetric)                                      |
| **Transform**    | `NT_TRANSFORM_VALUE`     | —   | Transform node (on placements, lights)                              |
| **Sun**          | `NT_SUN_DIRECTION`       | —   | Sun direction (children: lat, lon, month, day, hour, gmtoffset)     |

---

## NT_GEO_OBJECT Pin Layout

`create_node` returns all child handles. Pin indices are fixed:

| Pin | Name        | Child Type       | Notes                                                                                                             |
| --- | ----------- | ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| 0   | primitive   | Enum value       | `set_attribute(child, 185, AT_INT=3, N)` — Box(1) default. Types 1-17, 19-23 safe. Type 18 (Quad) crashes Octane. |
| 1   | material    | Diffuse material | Auto-created. Has RGB child on its pin 0.                                                                         |
| 2   | objectLayer | Object layer     |                                                                                                                   |
| 3   | transform   | Transform value  | `A_TRANSLATION=172` for position, `A_ROTATION=137` for rotation, `A_SCALE=139` for scale                          |
| 4   | Width       | Float value      | `set_attribute(child, 185, AT_FLOAT=9, 2.0)`                                                                      |
| 5   | Height      | Float value      |                                                                                                                   |
| 6   | Depth       | Float value      |                                                                                                                   |
| 7   | Subdivision | Int value        | Keep low. High values may crash.                                                                                  |

### Setting Material Color on Auto-Created Materials

NT_GEO_OBJECT auto-creates a diffuse material on pin 1. To set its color you need one `get_node_info` to find the RGB child:

```
get_node_info(material_handle) → pin 0 → RGB_child_handle
set_attribute(RGB_child, 185, AT_FLOAT3=11, {0.65, 0.05, 0.05})  → red
```

---

## NT_GEO_PLACEMENT Pin Layout

| Pin | Name      | Type            | Notes                                                                                  |
| --- | --------- | --------------- | -------------------------------------------------------------------------------------- |
| 0   | transform | Transform value | `A_TRANSLATION=172`, `A_ROTATION=137`, `A_SCALE=139` (all AT_FLOAT3=11)                |
| 1   | geometry  | —               | Connect mesh here via `pin_name: "geometry"` (pin_index 1, not 0 — pin 0 is transform) |

**OBJ scale is multiplicative**: If the .obj defines 0.3x3x0.3 geometry, placement scale (0.3, 3, 0.3) = 0.09x9x0.09. Check the mesh's native size before scaling.

---

## NT_MAT_SPECULAR Pin Layout (glass/transparent)

Use `get_node_info(specular)` to discover child handles, then `set_attribute(child, 185, type, value)`.

| Pin | Name         | Type           | Example                                  |
| --- | ------------ | -------------- | ---------------------------------------- |
| 0   | reflection   | AT_FLOAT3 (11) | `set_attribute(child, 185, 11, {1,1,1})` |
| 1   | transmission | AT_FLOAT3 (11) | `set_attribute(child, 185, 11, {1,1,1})` |
| 3   | roughness    | AT_FLOAT (9)   | `set_attribute(child, 185, 9, 0)`        |
| 7   | index (IOR)  | AT_FLOAT (9)   | `set_attribute(child, 185, 9, 1.5)`      |
| 22  | smooth       | AT_BOOL (1)    | `set_attribute(child, 185, 1, true)`     |

---

## NT_MAT_DIFFUSE Pin Layout (matte)

| Pin | Name     | Type           | Example                                                             |
| --- | -------- | -------------- | ------------------------------------------------------------------- |
| 0   | diffuse  | AT_FLOAT3 (11) | `set_attribute(child, 185, 11, {0.9, 0.9, 0.9})` -> white           |
| 10  | smooth   | AT_BOOL (1)    | `set_attribute(child, 185, 1, true)`                                |
| 14  | emission | —              | Use `connect_nodes` with `pin_name: "emission"` (NT_EMIS_BLACKBODY) |

---

## NT_EMIS_BLACKBODY Pin Layout (thermal emission)

| Pin | Name              | Type         | Example                                                                |
| --- | ----------------- | ------------ | ---------------------------------------------------------------------- |
| 0   | efficiency        | AT_FLOAT (9) | `set_attribute(child, 185, 9, 1.0)` — **MUST SET! Defaults to ~0.025** |
| 1   | power             | AT_FLOAT (9) | `set_attribute(child, 185, 9, 200)`                                    |
| 5   | temperature       | AT_FLOAT (9) | `set_attribute(child, 185, 9, 6500)` (Kelvin)                          |
| 2   | surfaceBrightness | AT_BOOL (1)  |                                                                        |
| 4   | doubleSided       | AT_BOOL (1)  |                                                                        |

---

## Primitive Types (NT_GEO_OBJECT pin 0 enum)

Set via: `set_attribute(enum_child_handle, 185, AT_INT=3, N)` then `update_scene()`.

`update_scene()` is REQUIRED after setting primitive type — without it the render won't update.

| Val | Shape          | Val | Shape                        |
| --- | -------------- | --- | ---------------------------- |
| 1   | Box (DEFAULT)  | 13  | Icosahedron                  |
| 2   | Capsule        | 14  | Octahedron                   |
| 3   | Cone           | 15  | Plane                        |
| 4   | Cylinder       | 16  | Polygon                      |
| 5   | Ding dong      | 17  | Prism                        |
| 6   | Disc           | 18  | Quad **CRASHES — NEVER USE** |
| 7   | Dodecahedron   | 19  | Saddle                       |
| 8   | Dome           | 20  | Sphere                       |
| 9   | Ellipsoid      | 21  | Tetrahedron                  |
| 10  | Elliptic torus | 22  | Torus                        |
| 11  | Figure eight   | 23  | Truncated cone               |
| 12  | Hyperboloid    |     |                              |

IDs are 1-indexed alphabetical (0 is invalid, defaults to Box). Workaround for Quad: flat Box (A_SCALE Y near 0.001) or NT_GEO_MESH + `quad.obj`.

---

## Connection Patterns

### Wiring Pattern

```
material → mesh (pin 0)
mesh → placement (pin_name "geometry")
placement → geo group (pin_index N, 0-based)
NOT: material → placement. NEVER.
```

### Pin IDs for Connections

| Pin ID | Constant      | Target                                     |
| ------ | ------------- | ------------------------------------------ |
| 89     | P_KERNEL      | RT kernel                                  |
| 43     | P_ENVIRONMENT | RT environment                             |
| 111    | P_MESH        | Mesh slot                                  |
| 30     | P_DIFFUSE     | Material diffuse                           |
| 41     | P_EMISSION    | Material emission                          |
| 59     | P_GEOMETRY    | Geometry (but NOT on RT — use pin_index:3) |

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
- Geometry objects → geo group `pin_index: N` (0-based)
- Geo group → RT `pin_index: 3`
- Geo objects → RT `pin_index: 3` directly (Octane auto-creates a geometry group)
- PT kernel → RT `pin_id: 89` (P_KERNEL)
- Environment → RT `pin_id: 43` (P_ENVIRONMENT)
- Specular material → geo mesh pin 0 (pin_index works for mesh material slot)

### Image Texture on Material

```
create_node(NT_TEX_IMAGE) → TEX
set_attribute(TEX, A_FILENAME=34, AT_STRING=14, "C:/absolute/path/to/image.jpg")
connect_nodes(TEX → material, pin_index: 0)   # replaces auto-created RGB child
```

No A_RELOAD needed — the texture loads on connect.

### Sphere via .obj Mesh

```
NT_GEO_MESH (load sphere.obj via A_FILENAME=34)
  → NT_GEO_PLACEMENT pin 1 (geometry)
    → placement transform child: A_TRANSLATION=172 for position, A_SCALE=139 for size
NT_MAT_SPECULAR → NT_GEO_MESH pin 0 (material)
NT_GEO_PLACEMENT → geo_group pin_index N (0-based)
```

Files (absolute paths):

- `C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/sphere.obj` — low-poly sphere
- `C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/sphere_hd.obj` — high-detail sphere (radius ~0.5)
- `C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/sphere_uv.obj` — UV-mapped sphere

### Wiring Pattern for External Meshes

```
NT_TEX_IMAGE (texture file) → material albedo pin
NT_MAT_UNIVERSAL (material) → NT_GEO_MESH pin 0
NT_GEO_MESH (OBJ file) → NT_GEO_PLACEMENT pin "geometry"  (pin_index 1)
NT_GEO_PLACEMENT (transform) → NT_GEO_GROUP pin "Input N"
```

### Sphere Light Wiring

```
NT_EMIS_BLACKBODY → NT_MAT_DIFFUSE via pin_id: 41 (P_EMISSION)
NT_MAT_DIFFUSE → NT_LIGHT_SPHERE pin_index: 1 (material1)
```

Sphere light transform uses `A_TRANSLATION=172`, NOT `A_VALUE=185`! The transform child on NT_LIGHT_SPHERE is an NT_TRANSFORM_VALUE node.

### Area Light (Emission Panel)

```
NT_GEO_OBJECT (thin box: H=0.01)
  → pin 1: standalone NT_MAT_DIFFUSE
              → pin_name "emission": NT_EMIS_BLACKBODY (power=200)
  → connect to geo_group via pin_index N (0-based)
```

### Emission Workaround

Auto-created child materials on NT_GEO_OBJECT silently reject emission connections. Create a **standalone** NT_MAT_DIFFUSE, connect emission to it via `pin_name: "emission"`, then connect to the geo object's material pin (1).

---

## Pin Connection Gotchas

| Target                | What works                                                                                                         | What silently fails                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| RT geometry           | `pin_index: 3`                                                                                                     | `pin_id: 59`                                                 |
| Mesh material         | `pin_index: 0`                                                                                                     | `pin_id: 30`                                                 |
| **Geo group inputs**  | **`pin_index: N` (0-based)**                                                                                       | **`pin_name: "Input N"`**                                    |
| RT kernel             | `pin_id: 89`                                                                                                       | —                                                            |
| RT environment        | `pin_id: 43`                                                                                                       | —                                                            |
| **Env medium pin**    | **Create standalone `NT_ENV_TEXTURE`, connect medium FIRST, then connect env to RT**                               | `pin_index: 4` on auto-created env (pin not materialized)    |
| **Env mediumRadius**  | **Set to 1000+ (default is 1!)** — medium only extends this many units from origin. At default 1, nothing visible. | —                                                            |
| **Geo group (fresh)** | **Set `A_PIN_COUNT=113` to 4+ BEFORE connecting children** — fresh groups have 0 pins                              | `connect_nodes` to pin 0 reports success but nothing happens |

---

## Materials — Presets

### Glass (specular transmission)

| Property          | Pin                      | Handle path | Value                               |
| ----------------- | ------------------------ | ----------- | ----------------------------------- |
| Transmission type | pin 1 (transmissionType) | enum child  | `1` (specular)                      |
| IOR               | pin 15 (index)           | float child | `1.5` (glass)                       |
| Albedo            | pin 2                    | RGB child   | `{0.85, 0.95, 1.0}` light blue tint |

### Gold Metal

| Property  | Pin   | Handle path | Value                         |
| --------- | ----- | ----------- | ----------------------------- |
| Metallic  | pin 4 | float child | `1.0`                         |
| Roughness | pin 8 | float child | `0.15`                        |
| Albedo    | pin 2 | RGB child   | `{1.0, 0.78, 0.34}` warm gold |

### Chrome

| Property  | Pin   | Handle path | Value                        |
| --------- | ----- | ----------- | ---------------------------- |
| Metallic  | pin 4 | float child | `1.0`                        |
| Roughness | pin 8 | float child | `0.02`                       |
| Albedo    | pin 2 | RGB child   | `{0.9, 0.9, 0.9}` near-white |

### Loud Red (debugging/test)

| Property | Pin   | Value                            |
| -------- | ----- | -------------------------------- |
| Albedo   | pin 2 | `{1.0, 0.1, 0.05}` saturated red |

### Quick Recipes

All require `get_node_info` to discover child handles first, then `set_attribute(child, 185, type, value)`.

| Material       | Type                  | Key Attributes                                                                     |
| -------------- | --------------------- | ---------------------------------------------------------------------------------- |
| **White wall** | NT_MAT_DIFFUSE (auto) | RGB child → `(185, 11, {0.9, 0.9, 0.9})`                                           |
| **Red wall**   | NT_MAT_DIFFUSE (auto) | RGB child → `(185, 11, {0.65, 0.05, 0.05})`                                        |
| **Green wall** | NT_MAT_DIFFUSE (auto) | RGB child → `(185, 11, {0.12, 0.45, 0.15})`                                        |
| **Glass**      | NT_MAT_SPECULAR       | IOR child → `(185, 9, 1.5)` + smooth child → `(185, 1, true)`                      |
| **Gold**       | NT_MAT_GLOSSY         | Diffuse=(1, 0.84, 0), Specular=1.0, Roughness=0.15, **IOR=100** (metallic Fresnel) |
| **Chrome**     | NT_MAT_UNIVERSAL      | Metallic=1, Roughness=0.02, Albedo={0.9,0.9,0.9}                                   |
| **Plastic**    | NT_MAT_UNIVERSAL      | Metallic=0, Roughness=0.2, Specular=0.5                                            |
| **Fabric**     | NT_MAT_UNIVERSAL      | Metallic=0, Roughness=0.9, Sheen=0.7                                               |
| **Textured**   | NT_MAT_DIFFUSE (auto) | NT_TEX_IMAGE → diffuse pin 0 (replaces RGB child)                                  |

### Metallic Fresnel

NT_MAT_GLOSSY defaults to IOR 1.5 (glass). At low IOR, specular reflections only appear at grazing angles — looks like plastic, not metal. **For any metallic material (gold, chrome, copper, etc.), set IOR to 100** on the glossy material's `index` pin (pin 12). This flattens the Fresnel curve so it reflects at all angles.

---

## Daylight Presets

### Sunset

| Property      | Handle path                                 | Value  | Notes                                                                   |
| ------------- | ------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| **Hour**      | env → pin 0 (sundir) → pin 4 (hour) → child | `16.5` | 4:30 PM = warm golden hour (17.5 was too cool/blue)                     |
| Turbidity     | env → pin 1 (turbidity) → child             | `6.0`  | Heavy haze = warm scattering. 4.0 still too blue. Default 2.4 too clean |
| Latitude      | sundir → pin 0 (latitude) → child           | `40.0` | Mid-latitude for natural sun angle                                      |
| North offset  | env → pin 4 (northOffset) → child           | `45.0` | Rotates sun direction for raking side light                             |
| Power         | env → pin 2                                 | `1.0`  | Default is fine                                                         |
| Sun intensity | env → pin 3                                 | `1.0`  | Default is fine                                                         |

Setting A_VALUE on sundir handle directly does NOT work. Must use hour child.

Sundir node (NT_SUN_DIRECTION) children: latitude(0), longitude(1), month(2), day(3), **hour(4)**, gmtoffset(5)

### Noon (bright, flat)

| Property  | Handle path                   | Value  | Notes              |
| --------- | ----------------------------- | ------ | ------------------ |
| Hour      | sundir → pin 4 (hour) → child | `12.0` | Noon, high sun     |
| Turbidity | env → pin 1 → child           | `2.4`  | Default, clean sky |

---

## Camera Presets

| Scenario        | Position         | Target         | Notes                      |
| --------------- | ---------------- | -------------- | -------------------------- |
| Hero 3-object   | `{1.25, 1.5, 8}` | `{1.25, 0, 0}` | 3 objects spread on X axis |
| Single object   | `{0, 0.5, 4}`    | `{0, 0, 0}`    | Centered, slightly above   |
| Pull-back debug | `{0, 5, 20}`     | `{0, 0, 0}`    | Way back, see everything   |

**DOF off:** camera → pin 14 (aperture) → child handle → `set_attribute(handle, 185, AT_FLOAT=9, 0)`

**Framing technique:** Set `target` to scene centroid (center of bounding box of all objects). Then compute camera `position` distance based on bounding box extents — pull back far enough to fit the full extent in frame, accounting for FOV/focal length. Don't guess zoom; derive it from bounds.

**Up vector:** Camera pin 22 (up Float3 node) defaults to (0,1,0). `set_camera` resets up to (0,1,0). NEVER set up to (0,0,0).

---

## Lighting

### Product Photography Setup

- **Key light:** NT_EMIS_BLACKBODY, 4000K warm, power 60-100, positioned above/behind scene
- **Fill light:** NT_EMIS_BLACKBODY, 5500K neutral, power 20-30, opposite side
- **Environment:** Neutral gray RGB (0.28-0.32) as env texture for calibration. Low env power (0.4-0.6) so area light dominates.

### Cinematic Two-Light Setup (sphere lights)

**Emission defaults that kill output:**

- `efficiency` (pin 0) defaults to 0.025 — set to 1.0 or lights will be 40x dimmer than expected
- `surfaceBrightness` (pin 2) normalizes by area — disable for small spheres (set to false)

**Power ranges (with efficiency=1.0, surfaceBrightness=false):**

| Scenario         | Key power | Fill power | Notes                         |
| ---------------- | --------- | ---------- | ----------------------------- |
| Product/close-up | 200-400   | 100-200    | Lights 3-5 units from subject |
| Room/enclosed    | 4000-8000 | 2000-4000  | Lights far from surfaces      |

**Temperatures:** Warm key 2800-3500K, cool fill 7000-9000K. Or neutral key 4500K + cool fill 8500K.

---

## Underwater Volumetric Medium — Purple Ocean

| Property         | Handle/Node         | Value               | Notes                                                               |
| ---------------- | ------------------- | ------------------- | ------------------------------------------------------------------- |
| Medium type      | NT_MED_SCATTERING   | —                   | Must use path tracing kernel                                        |
| Scale            | pin 0 child         | `0.007`             | 0.002 = invisible, 0.015 = opaque                                   |
| Absorption       | pin 8 (RGB)         | `{0.3, 0.3, 0.3}`   | Neutral! Don't rely on absorption for color                         |
| invertAbsorption | pin 9               | `true` (default)    | With invert=true, values→transmittance. {low_G}→green. Unintuitive! |
| Scattering       | pin 10 (RGB)        | `{0.3, 0.05, 0.4}`  | Purple scatter (R+B heavy, low G)                                   |
| Env color        | env pin 0 (RGB)     | `{0.45, 0.05, 0.5}` | Saturated purple                                                    |
| Env power        | env pin 1           | `35`                | Balances with sphere lights                                         |
| mediumRadius     | env pin 5           | `5000`              | Default 1 = nothing visible!                                        |
| Kernel           | NT_KERN_PATHTRACING | —                   | Required for volumetric                                             |

**Sphere light power in medium (efficiency=1.0, surfaceBrightness=false):**

| Role           | Power | Temp       | Notes                        |
| -------------- | ----- | ---------- | ---------------------------- |
| Overhead key   | 10-20 | 2800-5500K | Warm for underwater contrast |
| Fill           | 6-8   | 8000-9000K | Cool blue, opposite side     |
| Accent (red)   | 8-20  | 1800K      | Bioluminescence              |
| Accent (amber) | 3-8   | 2800K      | Running lights               |

---

## Procedural Textures

Node types: NT_TEX_MARBLE (47), NT_TEX_TURBULENCE (22), NT_TEX_NOISE (87), NT_TEX_CHECKS (45), NT_TEX_GRADIENT (49), NT_TEX_FALLOFF (50), NT_TEX_MIX (38), NT_TEX_MULTIPLY (39), NT_TEX_ADD (106), NT_TEX_SUBTRACT (108), NT_TEX_RGB (33), NT_TEX_FLOAT (31)

### NT_TEX_MIX — the workhorse

| Pin | Name     | Type       | Notes                                  |
| --- | -------- | ---------- | -------------------------------------- |
| 0   | amount   | PT_TEXTURE | Blend mask (connect noise/marble here) |
| 1   | texture1 | PT_TEXTURE | Color A                                |
| 2   | texture2 | PT_TEXTURE | Color B                                |

### NT_TEX_MARBLE

| Pin | Name      | Type         | Notes                  |
| --- | --------- | ------------ | ---------------------- |
| 0   | power     | PT_TEXTURE   |                        |
| 1   | offset    | PT_TEXTURE   |                        |
| 2   | octaves   | PT_INT       | More = finer detail    |
| 3   | omega     | PT_TEXTURE   |                        |
| 4   | variance  | PT_TEXTURE   |                        |
| 5   | transform | PT_TRANSFORM | Stretch for wood grain |

### NT_TEX_TURBULENCE — organic noise, NOT banded

| Pin | Name       | Type          | Notes                           |
| --- | ---------- | ------------- | ------------------------------- |
| 0   | power      | PT_TEXTURE    | Brightness/intensity            |
| 1   | offset     | PT_TEXTURE    | 3D offset                       |
| 2   | octaves    | PT_INT        | Detail scale (6-12)             |
| 3   | omega      | PT_TEXTURE    | Fractal detail (0.35-0.65)      |
| 4   | transform  | PT_TRANSFORM  | **Stretch for grain direction** |
| 5   | projection | PT_PROJECTION |                                 |
| 6   | turbulence | PT_BOOL       | Toggle turbulent noise          |
| 7   | invert     | PT_BOOL       |                                 |
| 8   | gamma      | PT_FLOAT      | Luminance control (1.0-2.0)     |

### NT_TEX_RGB

Set color via `set_attribute(handle, A_VALUE=185, AT_FLOAT3=11, {r,g,b})`

---

## Render Pipeline — Minimum Sequence

1. `create_node(NT_RENDERTARGET)` — handle is your RT
2. `create_node(NT_GEO_OBJECT)` — your geometry (defaults to Box)
3. `connect_nodes(geo → RT, pin_index: 3)` — pin 3 = "mesh" (PT_GEOMETRY)
4. `start_render(render_target_handle: RT)` — sets RT on render API
5. `update_scene()` — flush connections
6. `set_camera(position, target)` — triggers geometry evaluation
7. Wait 3-5s for samples
8. `save_render(path)` — grab the image

---

## Render Refresh

| Method               | Refreshes geometry? | Notes                                                                        |
| -------------------- | ------------------- | ---------------------------------------------------------------------------- |
| **`set_camera`**     | **YES**             | The ONLY way to force geometry re-evaluation. Even same position works.      |
| `start_render`       | NO                  | Only starts sampling. New objects won't appear.                              |
| ~~`restart_render`~~ | **REMOVED**         | Removed from MCP — crashed Octane.                                           |
| `set_attribute`      | Partial             | Triggers re-render of existing objects but doesn't add new geometry to tree. |

After connections: `update_scene()` then `set_camera` — both required.

---

## .obj Assets

Absolute path prefix: `C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/`

**Primitives:** sphere.obj, sphere_hd.obj, sphere_uv.obj, cube.obj, torus.obj, teapot.obj, diamond.obj, ring.obj, monolith.obj, prism.obj, pillar.obj, floor.obj, quad.obj

**Hero meshes:** nautilus.obj (40MB), cat_captain_hindu.obj (40MB), catraken.obj (39MB)

**Textures:** nautilus_diffuse.png, cat_captain_hindu_diffuse.png, catraken_diffuse.png (all 4096x4096)

---

## Coordinate System

- **+X = RIGHT**, **-X = LEFT**
- **+Y = UP**, **-Y = DOWN**
- **+Z = toward camera**, **-Z = into scene**

---

## Scale Reference

1 unit = 1 meter. Human eye height: Y=1.0-1.7. Table: Y=0.75. Room: 2.5-3.0 tall.

---

## Kernels

| Kernel              | Type ID | Notes                                              |
| ------------------- | ------- | -------------------------------------------------- |
| **Path Tracing**    | 25      | ALWAYS use for interiors. DL kernel renders white. |
| **Direct Lighting** | 24      | No bounced light. Only for open/exterior scenes.   |
| **PMC**             | 23      | Slow but handles difficult glass caustics.         |

---

## ApiInfo — Type System Introspection

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

---

## Octane Docs MCP

Connect: `npx -y mcp-remote https://octane-mcp.otoy.ai/sse`

| Tool                    | Purpose                    |
| ----------------------- | -------------------------- |
| `search_octane_api`     | Search Lua API functions   |
| `get_octane_function`   | Detailed function docs     |
| `get_octane_properties` | Node type properties       |
| `list_octane_constants` | Enum values (NT*, P*, A\_) |
| `search_examples`       | Find example scripts       |

---

## External Resources

| Resource            | URL                                                | Use For                             |
| ------------------- | -------------------------------------------------- | ----------------------------------- |
| **OTOY Forum**      | https://render.otoy.com/forum/index.php            | Community knowledge, scene tips     |
| **Octane Docs**     | https://docs.otoy.com/                             | Official plugin/standalone docs     |
| **Octane Docs MCP** | `npx -y mcp-remote https://octane-mcp.otoy.ai/sse` | Lua API search, constants, examples |
| **Octane Live DB**  | https://render.otoy.com/livedb/                    | Community materials and assets      |
| **Poly Haven**      | https://polyhaven.com/                             | Free HDRI, textures, models         |

---

## Pin Value RPCs — UNIMPLEMENTED

The proto defines `setPinValueByIx`, `setPinValueByPinID`, `setPinValueByName` (and get variants) but Octane's gRPC server returns UNIMPLEMENTED for all 6. These are future API stubs.

Current workflow: `create_node` → use pin handles from response → `set_attribute` on child handles. Use `get_node_info` only for deeper children.

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
