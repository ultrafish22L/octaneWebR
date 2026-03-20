# Octane Reference

Lookup tables for MCP scene building. Don't read front-to-back — find what you need.

**Live type system discovery**: Use MCP resources instead of memorizing values. See [MCP Resources](#mcp-resources) at the end of this file.

Hardcoded protocol constants (AttrType, AttributeId, CRASH_TYPE_IDS, PIN_TYPE_NAMES, RT_PINS) live in `shared/OctaneConstants.ts`.

---

## Paths

| Path                                         | Purpose             |
| -------------------------------------------- | ------------------- |
| `C:/otoyla/GRPC/dev/octaneWebR/renders/`     | Render output       |
| `C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/` | Meshes and textures |

Always use absolute paths for `A_FILENAME`. Relative paths depend on Octane's working dir.

### File Loading Pattern

```
set_attribute(handle, A_FILENAME=34, AT_STRING=14, "C:/otoyla/.../file.obj")
set_attribute(handle, A_RELOAD=124, AT_BOOL=1, true)   # CRITICAL for meshes
```

Image textures don't need A_RELOAD — they load on connect.

---

## Attributes

### Transform (all AT_FLOAT3=11)

| Attribute     | ID  | Notes               |
| ------------- | --- | ------------------- |
| A_TRANSLATION | 172 | World units         |
| A_ROTATION    | 137 | DEGREES not radians |
| A_SCALE       | 139 | Uniform = {1,1,1}   |

### Other Key Attributes

| Attribute   | ID  | Notes                                        |
| ----------- | --- | -------------------------------------------- |
| A_VALUE     | 185 | General value                                |
| A_FILENAME  | 34  | File path                                    |
| A_RELOAD    | 124 | Force file reload                            |
| A_PIN_COUNT | 113 | Set on geo groups BEFORE connecting children |

### Attribute Types

AT_BOOL=1, AT_INT=3, AT_INT2=4, AT_FLOAT=9, AT_FLOAT2=90, AT_FLOAT3=11, AT_STRING=14

---

## RT Pin Layout (NT_RENDERTARGET)

| Pin | Name        | Type            | Notes                                            |
| --- | ----------- | --------------- | ------------------------------------------------ |
| 0   | camera      | PT_CAMERA       | Auto-created (Thin lens)                         |
| 1   | environment | PT_ENVIRONMENT  | Auto-created. Connect via `pin_id:43`            |
| 3   | **mesh**    | **PT_GEOMETRY** | **pin_index:3 ONLY** (pin_id:59 silently fails!) |
| 4   | film        | PT_FILM         | Auto-created, resolution on grandchild           |
| 6   | kernel      | PT_KERNEL       | Auto-created (DL). Connect via `pin_id:89`       |

**DOF off:** RT→pin0→camera→pin14→aperture child→`set_attribute(child, 185, 9, 0)`. Default 0.893.

**Film resolution:** `get_node_info(film)`→pin0→child→`set_attribute(child, 185, AT_INT2=4, {1024,576})`

---

## Node Types (common)

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
|              | `NT_MAT_SPECULAR`        | 18  | Glass/transparent         |
| Textures     | `NT_TEX_RGB`             | 33  | Solid color               |
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

| Pin   | Name      | Child Type | Notes                                                                       |
| ----- | --------- | ---------- | --------------------------------------------------------------------------- |
| 0     | primitive | Enum       | `set_attribute(child, 185, 3, N)` — Box(1) default. Type 18 (Quad) crashes. |
| 1     | material  | Diffuse    | Auto-created. Color: `get_node_info(mat)`→pin0→RGB child                    |
| 3     | transform | Transform  | A_TRANSLATION/ROTATION/SCALE on **child handle, NOT parent**                |
| 4/5/6 | W/H/D     | Float      | `set_attribute(child, 185, 9, value)`                                       |

## NT_GEO_PLACEMENT Pin Layout

| Pin | Name      | Notes                                                             |
| --- | --------- | ----------------------------------------------------------------- |
| 0   | transform | A_TRANSLATION=172, A_ROTATION=137, A_SCALE=139 (all AT_FLOAT3=11) |
| 1   | geometry  | Connect mesh via `pin_name: "geometry"`                           |

---

## Connection Patterns

### Wiring Chain

```
material → mesh (pin_index: 0)
mesh → placement (pin_name: "geometry")
placement → geo group (pin_index: N, 0-based)
geo group → RT (pin_index: 3)
```

### What Works vs What Fails

| Target            | Works                       | Silently fails                       |
| ----------------- | --------------------------- | ------------------------------------ |
| RT geometry       | `pin_index: 3`              | `pin_id: 59`                         |
| Mesh material     | `pin_index: 0`              | `pin_id: 30`                         |
| Geo group inputs  | `pin_index: N` (0-based)    | `pin_name: "Input N"`                |
| RT kernel         | `pin_id: 89`                | —                                    |
| RT environment    | `pin_id: 43`                | —                                    |
| Geo group (fresh) | Set `A_PIN_COUNT=113` first | Connect to 0-pin group = silent fail |

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
set_attribute(TEX, A_FILENAME=34, AT_STRING=14, "C:/absolute/path/image.jpg")
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

## Material Presets

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

## Emission (NT_EMIS_BLACKBODY)

| Pin | Name        | Type  | Notes                                          |
| --- | ----------- | ----- | ---------------------------------------------- |
| 0   | efficiency  | Float | **MUST set to 1.0** (defaults 0.025 = 40x dim) |
| 1   | power       | Float | 200 for close-up, 4000+ for rooms              |
| 5   | temperature | Float | Kelvin (see CREATIVE.md for temps)             |

---

## Primitive Types (NT_GEO_OBJECT pin 0)

| Val | Shape         | Val | Shape          |
| --- | ------------- | --- | -------------- |
| 1   | Box (default) | 13  | Icosahedron    |
| 2   | Capsule       | 14  | Octahedron     |
| 3   | Cone          | 20  | Sphere         |
| 4   | Cylinder      | 22  | Torus          |
| 6   | Disc          | 23  | Truncated cone |

Type 18 (Quad) crashes. Full list: 1-17, 19-23 (alphabetical). Workaround: flat Box or quad.obj.

**Primitive type changes are non-deterministic crash risk** — see TROUBLESHOOTING.md.

---

## Daylight Presets

### Sunset

env→pin0(sundir)→pin4(hour)→child: `16.5`. env→pin1(turbidity)→child: `6.0`. sundir→pin0(latitude)→child: `40.0`.

Setting A_VALUE on sundir directly does NOT work. Must navigate to hour child.

### Noon

Hour: `12.0`. Turbidity: `2.4` (default).

---

## Camera Presets

| Scenario        | Position       | Target       |
| --------------- | -------------- | ------------ |
| Hero 3-object   | {1.25, 1.5, 8} | {1.25, 0, 0} |
| Single object   | {0, 0.5, 4}    | {0, 0, 0}    |
| Pull-back debug | {0, 5, 20}     | {0, 0, 0}    |

Up vector: pin 22, defaults (0,1,0). `set_camera` resets to (0,1,0). NEVER set to (0,0,0).

---

## Render Pipeline — Minimum Sequence

1. `create_node(NT_RENDERTARGET)` → RT handle
2. `create_node(NT_GEO_OBJECT)` → geometry (default Box)
3. `connect_nodes(geo → RT, pin_index: 3)`
4. `start_render(render_target_handle: RT)`
5. `set_camera(position, target)` — **required** to refresh geometry tree
6. Wait 3-5s for samples
7. `save_render(path)`

**Geometry refresh:** `set_camera` is the ONLY way to force geometry re-evaluation after connecting new objects. `start_render` does NOT refresh geometry.

---

## .obj Assets

Path prefix: `C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/`

**Available:** `sphere_hd.obj`, `floor.obj`

**Also in directory (textures/images):** `art_cyber.jpg`, `art_surreal.jpg`, `gallery_env.jpg`, `hdri_sunset_ocean.png`, `lava_env.jpg`, `space_env.jpg`

**Not available (listed previously but missing):** sphere.obj, sphere_uv.obj, cube.obj, torus.obj, teapot.obj, diamond.obj, ring.obj, monolith.obj, prism.obj, pillar.obj, quad.obj. Use `sphere_hd.obj` as the only sphere mesh, or use NT_GEO_OBJECT (crash risk) or NT_GEO_PLANE for flat surfaces.

---

## Coordinate System

+X=right, -X=left, +Y=up, -Y=down, +Z=toward camera, -Z=into scene.

1 unit = 1 meter. Human eye: Y=1.5. Table: Y=0.75.

---

## Procedural Textures

### NT_TEX_MIX (blend workhorse)

Pin 0=amount (mask), pin 1=texture1, pin 2=texture2.

### NT_TEX_MARBLE

Pin 2=octaves (more=finer), pin 5=transform (stretch for grain).

### NT_TEX_TURBULENCE

Pin 2=octaves (6-12), pin 3=omega (0.35-0.65), pin 4=transform (stretch for direction), pin 8=gamma (1.0-2.0).

### NT_TEX_RGB

`set_attribute(handle, A_VALUE=185, AT_FLOAT3=11, {r,g,b})`

---

## ApiInfo Methods

| Method                                    | Returns                                 |
| ----------------------------------------- | --------------------------------------- |
| `getNodeTypes()`                          | All node types (755+)                   |
| `nodeInfo(type)`                          | Pins, attributes, category, description |
| `getCompatibleTypes(pinType)`             | What nodes can connect to a pin type    |
| `getAttributeId(name)` / `getPinId(name)` | Name → ID reverse lookups               |

---

## MCP Resources

9 read-only resources for live type system discovery. Use these instead of hardcoded values when exploring unfamiliar node types.

### Static (from ApiCache — instant)

| Resource                 | URI                                | Use For                                                                                                  |
| ------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `node-types`             | `octane://node-types`              | Full catalog: name, id, category, pinCount for all 755+ types                                            |
| `node-types-by-category` | `octane://node-types/{category}`   | Filter by category (MAT, TEX, GEO, LIGHT, KERN, etc.)                                                    |
| `pin-layout`             | `octane://pin-layout/{typeName}`   | All pins for a type: index, id, name, type, defaultNodeType. **Resolves pin_index vs pin_id confusion.** |
| `compatibility`          | `octane://compatibility/{pinType}` | What nodes can connect to a pin type (PT_TEXTURE, PT_MATERIAL, etc.)                                     |
| `primitive-types`        | `octane://primitive-types`         | NT_GEO_OBJECT enum values (Box=1, Sphere=20, etc.) with crash warnings                                   |

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

### When to Use Resources vs Hardcoded Values

- **Known patterns** (RT pins, transforms, materials): use hardcoded values in this doc — they're proven and faster.
- **Unfamiliar node types**: query `pin-layout` and `node-info-dynamic` to discover pin names, indices, and compatible connections.
- **"What can connect here?"**: query `compatibility` with the pin type.
- **Debugging silent failures**: query `pin-layout` to verify you're using the right pin_index vs pin_id.

---

## Discovery Workflow

**Fresh nodes:** `create_node` returns handle + pins array with all child handles. Set attributes directly.

**Material color:** `get_node_info(material)`→pin 0→RGB child→`set_attribute`.

**Unknown nodes:** Query `octane://pin-layout/{typeName}` resource, or `get_node_info`→see all pins→`set_attribute`/`connect_nodes` on discovered handles.
