# Octane Reference

Lookup tables for MCP scene building. Don't read front-to-back — find what you need.

**Live type system discovery**: Use MCP resources instead of memorizing values (§11).

Hardcoded protocol constants (AttrType, AttributeId, PIN_TYPE_NAMES, RT_PINS) live in `shared/OctaneConstants.ts`.

---

## §1 Paths

| Path                           | Purpose                          |
| ------------------------------ | -------------------------------- |
| `aigenerated/{scene}/renders/` | Render output (real scenes)      |
| `temp/renders/`                | Render output (smoke tests only) |
| `ORBX/assets_test/`            | Built-in meshes and textures     |

Always use absolute paths for `A_FILENAME`. Relative paths depend on Octane's working dir.

### File Loading Pattern

```
set_attribute(handle, A_FILENAME=34, AT_STRING=14, "/absolute/path/to/file.obj")
set_attribute(handle, A_RELOAD=124, AT_BOOL=1, true)   # MANDATORY — mesh won't load without this
update_scene()                                          # MANDATORY — flush to trigger actual load
get_geometry_stats()                                    # VERIFY — triCount must be > 0
```

**Without A_RELOAD:** A_FILENAME succeeds silently but the mesh stays empty (triCount=0). Render shows nothing — no error, just invisible geometry.

**Without update_scene():** A_RELOAD may report success without actually loading the mesh. Always flush after reload.

Image textures don't need A_RELOAD — they load on connect.

For compat-mode quirks (mesh unloading, etc.) see `ALPHA5_COMPAT.md`.

---

## §2 Attributes

### Transform (all AT_FLOAT3=11)

| Attribute     | ID  | Notes               |
| ------------- | --- | ------------------- |
| A_TRANSLATION | 172 | World units         |
| A_ROTATION    | 137 | DEGREES not radians |
| A_SCALE       | 139 | Uniform = {1,1,1}   |

### Other Key Attributes

| Attribute   | ID  | Notes                                                  |
| ----------- | --- | ------------------------------------------------------ |
| A_VALUE     | 185 | General value                                          |
| A_FILENAME  | 34  | File path                                              |
| A_RELOAD    | 124 | Force file reload                                      |
| A_PIN_COUNT | 113 | Geo group pin count (auto-expanded by `connect_nodes`) |

### Attribute Types

AT_BOOL=1, AT_INT=3, AT_INT2=4, AT_FLOAT=9, AT_FLOAT2=90, AT_FLOAT3=11, AT_STRING=14

---

## §3 RT Pin Layout

| Pin | Name        | Type            | Notes                                            |
| --- | ----------- | --------------- | ------------------------------------------------ |
| 0   | camera      | PT_CAMERA       | Auto-created (Thin lens)                         |
| 1   | environment | PT_ENVIRONMENT  | Auto-created. Connect via `pin_id:43`            |
| 3   | **mesh**    | **PT_GEOMETRY** | **pin_index:3 ONLY** (pin_id:59 silently fails!) |
| 4   | film        | PT_FILM         | Auto-created, resolution on grandchild           |
| 6   | kernel      | PT_KERNEL       | Auto-created (DL). Connect via `pin_id:89`       |

**DOF off:** Auto-disabled on new RTs (`create_node(NT_RENDERTARGET)` sets aperture to 0). To re-enable: RT→pin0→camera→pin14→aperture child→`set_attribute(child, 185, 9, 0.893)`.

**Film resolution:** `get_node_info(film)`→pin0→child→`set_attribute(child, 185, AT_INT2=4, {1024,576})`

---

## §4 Node Types

| Category     | Type Key                 | ID  | Description               |
| ------------ | ------------------------ | --- | ------------------------- |
| Render       | `NT_RENDERTARGET`        | 56  | Scene root                |
| Geometry     | `NT_GEO_GROUP`           | 3   | Geometry container        |
|              | `NT_GEO_OBJECT`          | 153 | Primitive shapes          |
|              | `NT_GEO_MESH`            | 1   | Mesh from .obj file       |
|              | `NT_GEO_PLACEMENT`       | 4   | Transform wrapper         |
|              | `NT_GEO_PLANE`           | 110 | Infinite plane            |
| Materials    | `NT_MAT_UNIVERSAL`       | 130 | PBR (recommended default) |
|              | `NT_MAT_DIFFUSE`         | 17  | Matte                     |
|              | `NT_MAT_GLOSSY`          | 16  | Glossy/reflective         |
|              | `NT_MAT_TOON`            | 121 | Toon/cel shading          |
|              | `NT_MAT_SPECULAR`        | 18  | Glass/transparent         |
| Textures     | `NT_TEX_RGB`             | 33  | Solid color               |
|              | `NT_TEX_FLOAT`           | 31  | Float value               |
|              | `NT_TEX_IMAGE`           | 34  | Image file                |
|              | `NT_TEX_CHECKS`          | 45  | Checkerboard              |
|              | `NT_TEX_NOISE`           | 87  | Noise                     |
|              | `NT_TEX_MARBLE`          | 47  | Marble procedural         |
|              | `NT_TEX_MIX`             | 38  | Blend two textures        |
| Emission     | `NT_EMIS_BLACKBODY`      | 53  | Thermal (power + temp)    |
|              | `NT_EMIS_TEXTURE`        | 54  | Textured emission         |
| Environments | `NT_ENV_DAYLIGHT`        | 14  | Physical sun + sky        |
|              | `NT_ENV_TEXTURE`         | 37  | HDRI environment          |
| Kernels      | `NT_KERN_PATHTRACING`    | 25  | Path tracing (use this!)  |
|              | `NT_KERN_PMC`            | 23  | PMC (difficult caustics)  |
|              | `NT_KERN_DIRECTLIGHTING` | 24  | Fast preview              |
| Lights       | `NT_LIGHT_QUAD`          | 148 | Rectangular area light    |
|              | `NT_LIGHT_SPHERE`        | 149 | Sphere area light         |
| Camera       | `NT_CAM_THINLENS`        | 13  | Standard camera           |

---

## NT_GEO_OBJECT Pin Layout

| Pin   | Name      | Child Type | Notes                                                                                     |
| ----- | --------- | ---------- | ----------------------------------------------------------------------------------------- |
| 0     | primitive | Enum       | `set_attribute(child, 185, 3, N)` — Box(1) default. All 23 types supported (values 1-23). |
| 1     | material  | Diffuse    | Auto-created. Color: `get_node_info(mat)`→pin0→RGB child                                  |
| 3     | transform | Transform  | A_TRANSLATION/ROTATION/SCALE on **child handle, NOT parent**                              |
| 4/5/6 | W/H/D     | Float      | `set_attribute(child, 185, 9, value)`                                                     |

## NT_GEO_PLACEMENT Pin Layout

| Pin | Name      | Notes                                                             |
| --- | --------- | ----------------------------------------------------------------- |
| 0   | transform | A_TRANSLATION=172, A_ROTATION=137, A_SCALE=139 (all AT_FLOAT3=11) |
| 1   | geometry  | Connect mesh via `pin_name: "geometry"`                           |

---

## §5 Connection Patterns

### Wiring Chain

```
material → NT_GEO_MESH (pin_index: 0) or NT_GEO_OBJECT (pin_index: 1)
mesh → placement (pin_name: "geometry")
placement → geo group (pin_index: N, 0-based)
geo group → RT (pin_index: 3)
```

### What Works vs What Fails

| Target            | Works                             | Silently fails                       |
| ----------------- | --------------------------------- | ------------------------------------ |
| RT geometry       | `pin_index: 3`                    | `pin_id: 59`                         |
| Mesh material     | `pin_index: 0`                    | `pin_id: 30`                         |
| Geo group inputs  | `pin_index: N` (0-based)          | `pin_name: "Input N"`                |
| RT kernel         | `pin_id: 89`                      | —                                    |
| RT environment    | `pin_id: 43` OR `pin_index: 1`    | — (both work, prefer `pin_id: 43`)   |
| Geo group (fresh) | `connect_nodes` auto-expands pins | Finds first empty slot automatically |

### Verified Connections

```
RGB/Image texture → material diffuse pin_id: 30
Blackbody emission → material pin_id: 41 (P_EMISSION)
Geometry → geo group pin_index: N
Geo group → RT pin_index: 3
Geo object → RT pin_index: 3 (auto-creates group)
PT kernel → RT pin_id: 89
Environment → RT pin_id: 43
```

### Image Texture on Material

```
create_node(NT_TEX_IMAGE) → TEX
set_attribute(TEX, A_FILENAME=34, AT_STRING=14, "/absolute/path/image.jpg")
connect_nodes(TEX → material, pin_index: 0)   # replaces auto-created RGB child
```

No A_RELOAD needed for textures.

### Sphere Light Wiring

```
NT_EMIS_BLACKBODY → NT_MAT_DIFFUSE via pin_id: 41
NT_MAT_DIFFUSE → NT_LIGHT_SPHERE pin_index: 1
```

Transform uses `A_TRANSLATION=172`, NOT `A_VALUE=185`.

### Emission Workaround

Auto-created materials on NT_GEO_OBJECT reject emission. Create standalone NT_MAT_DIFFUSE, connect emission via `pin_name: "emission"`, then connect to geo pin 1.

---

## §6 Material Presets

All use `get_node_info` to find child handles, then `set_attribute(child, 185, type, value)`.

### Universal Material (NT_MAT_UNIVERSAL)

| Material    | Albedo (pin 2)    | Metallic (pin 4) | Roughness (pin 8) |
| ----------- | ----------------- | ---------------- | ----------------- |
| **Gold**    | {1.0, 0.78, 0.34} | 1.0              | 0.15              |
| **Chrome**  | {0.9, 0.9, 0.9}   | 1.0              | 0.02              |
| **Plastic** | any color         | 0                | 0.2               |
| **Fabric**  | any color         | 0                | 0.9               |

### Glossy Material (NT_MAT_GLOSSY) — set IOR to 100 for metallic Fresnel

| Material | Diffuse (pin 0) | Specular | Roughness | IOR (pin 12) |
| -------- | --------------- | -------- | --------- | ------------ |
| **Gold** | {1, 0.84, 0}    | 1.0      | 0.15      | 100          |

### Specular Material (NT_MAT_SPECULAR) — glass

| Property          | Pin                 | Value                             |
| ----------------- | ------------------- | --------------------------------- |
| Transmission type | pin 1 child         | 1 (specular)                      |
| IOR               | pin 7 (index) child | 1.5                               |
| Albedo            | pin 0 child         | {0.85, 0.95, 1.0} light blue tint |

### Quick Color Recipes (auto-created diffuse)

RGB child on pin 0: `set_attribute(child, 185, 11, {r,g,b})`

White={0.9, 0.9, 0.9}, Red={0.65, 0.05, 0.05}, Green={0.12, 0.45, 0.15}, Loud Red={1.0, 0.1, 0.05}

Roughness scale: 0.01=mirror, 0.1=polished, 0.2=brushed, 0.3=satin, 0.5+=rough

---

## §7 Emission

| Pin | Name        | Type  | Notes                                          |
| --- | ----------- | ----- | ---------------------------------------------- |
| 0   | efficiency  | Float | **MUST set to 1.0** (defaults 0.025 = 40x dim) |
| 1   | power       | Float | 200 for close-up, 4000+ for rooms              |
| 5   | temperature | Float | Kelvin (see CREATIVE.md for temps)             |

---

## §7a Primitive Types

| Val | Shape         | Val | Shape          |
| --- | ------------- | --- | -------------- |
| 1   | Box (default) | 13  | Icosahedron    |
| 2   | Capsule       | 14  | Octahedron     |
| 3   | Cone          | 20  | Sphere         |
| 4   | Cylinder      | 22  | Torus          |
| 6   | Disc          | 23  | Truncated cone |

All types 1-23 work on SDK server. Full list: 1-23 (alphabetical).

Primitive type changes work on SDK server — all 23 types tested (values 1-23).

---

## §7b Daylight Presets

### Sunset

env→pin0(sundir)→pin4(hour)→child: `16.5`. env→pin1(turbidity)→child: `6.0`. sundir→pin0(latitude)→child: `40.0`.

Setting A_VALUE on sundir directly does NOT work. Must navigate to hour child.

### Noon

Hour: `12.0`. Turbidity: `2.4` (default).

---

## §7c Camera Presets

| Scenario        | Position       | Target       |
| --------------- | -------------- | ------------ |
| Hero 3-object   | {1.25, 1.5, 8} | {1.25, 0, 0} |
| Single object   | {0, 0.5, 4}    | {0, 0, 0}    |
| Pull-back debug | {0, 5, 20}     | {0, 0, 0}    |

Up vector: pin 22, defaults (0,1,0). `set_camera` resets to (0,1,0). NEVER set to (0,0,0).

---

## §7d Render Pipeline

See `BUILD.md` Phase 1 for the full setup sequence. Key points:

- Use `fit_camera(elevation, yaw, margin)` AFTER geometry — auto-frames from bounds.
- `get_art_direction_state` — inspect SEGA vector + critique history mid-build.
- `start_render` auto-flushes `ApiChangeManager::update()`.
- NT_GEO_OBJECT works on SDK server.

---

## §7e Assets

Path prefix: `ORBX/assets_test/`

**Available:** `sphere_hd.obj`, `floor.obj`

**Also in directory (textures/images):** `art_cyber.jpg`, `art_surreal.jpg`, `gallery_env.jpg`, `hdri_sunset_ocean.png`, `lava_env.jpg`, `space_env.jpg`

Only these two .obj files exist. For other shapes use NT_GEO_OBJECT or NT_GEO_PLANE.

---

## §8 Coordinate System

+X=right, -X=left, +Y=up, -Y=down, +Z=toward camera, -Z=into scene.

1 unit = 1 meter. Human eye: Y=1.5. Table: Y=0.75.

---

## §9 Procedural Textures

### NT_TEX_MIX (blend workhorse)

Pin 0=amount (mask), pin 1=texture1, pin 2=texture2.

### NT_TEX_MARBLE

Pin 2=octaves (more=finer), pin 5=transform (stretch for grain).

### NT_TEX_TURBULENCE

Pin 2=octaves (6-12), pin 3=omega (0.35-0.65), pin 4=transform (stretch for direction), pin 8=gamma (1.0-2.0).

### NT_TEX_RGB

`set_attribute(handle, A_VALUE=185, AT_FLOAT3=11, {r,g,b})`

---

## §10 ApiInfo Methods

| Method                                    | Returns                                 |
| ----------------------------------------- | --------------------------------------- |
| `getNodeTypes()`                          | All node types (755+)                   |
| `nodeInfo(type)`                          | Pins, attributes, category, description |
| `getCompatibleTypes(pinType)`             | What nodes can connect to a pin type    |
| `getAttributeId(name)` / `getPinId(name)` | Name → ID reverse lookups               |

---

## §11 MCP Resources

9 read-only resources for live type system discovery. Use these instead of hardcoded values when exploring unfamiliar node types.

### Static (from ApiCache — instant)

| Resource                 | URI                                | Use For                                                                                                  |
| ------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `node-types`             | `octane://node-types`              | Full catalog: name, id, category, pinCount for all 755+ types                                            |
| `node-types-by-category` | `octane://node-types/{category}`   | Filter by category (MAT, TEX, GEO, LIGHT, KERN, etc.)                                                    |
| `pin-layout`             | `octane://pin-layout/{typeName}`   | All pins for a type: index, id, name, type, defaultNodeType. **Resolves pin_index vs pin_id confusion.** |
| `compatibility`          | `octane://compatibility/{pinType}` | What nodes can connect to a pin type (PT_TEXTURE, PT_MATERIAL, etc.)                                     |
| `primitive-types`        | `octane://primitive-types`         | NT_GEO_OBJECT enum values (Box=1, Sphere=20, etc.)                                                       |

### Dynamic (live gRPC query — cached after first hit)

| Resource                 | URI                                           | Use For                                                     |
| ------------------------ | --------------------------------------------- | ----------------------------------------------------------- |
| `node-info-dynamic`      | `octane://node-info/{typeName}`               | Full metadata: attribute count, movable inputs, description |
| `pin-info-dynamic`       | `octane://pin-info/{typeName}/{pinIndex}`     | Deep pin metadata: float ranges, enum values, defaults      |
| `attribute-info-dynamic` | `octane://attribute-info/{typeName}/{attrId}` | Attribute type, defaults, min/max, description              |

### Scene (from SceneCache)

| Resource | URI              | Use For                                                             |
| -------- | ---------------- | ------------------------------------------------------------------- |
| `scene`  | `octane://scene` | Current scene snapshot: all nodes, connections, children, staleness |

---

## §12 GLB Pipeline

### Convert GLB → OBJ + Textures

```python
import trimesh
scene = trimesh.load('model.glb')
scene.export('model.obj')  # OBJ + MTL
# Extract baked texture (trimesh OBJ export strips it):
scene.geometry[mesh_name].visual.material.baseColorTexture.save('model_diffuse.png')
```

### Load in Octane

1. `NT_GEO_MESH` + `A_FILENAME` + `A_RELOAD` (see §1 File Loading Pattern)
2. `NT_TEX_IMAGE` with diffuse PNG → connect to material `pin_index: 0` (replaces auto-created RGB child)
3. No `A_RELOAD` needed for image textures — they load on connect

### Orientation

OTOY Studio GLBs are Z-up → rotate +90° on X. Use `analyze_mesh` for reliable orientation via VLM mugshot (see `BUILD.md` Pre-Phase).
