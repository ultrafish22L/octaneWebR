# Octane Reference

Lookup tables for MCP scene building. Don't read front-to-back — find what you need.

**Prefer high-level tools** (`place_geo`, `setup_lighting`, `create_light`, `suggest_material`) over manual wiring. These tables are for understanding what those tools do and for edge cases they don't cover.

**Live type system discovery**: Use MCP resources instead of memorizing values (§8).

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
flush_changes()                                          # MANDATORY — flush to trigger actual load
get_stats(type:"geometry")                               # VERIFY — triCount must be > 0
```

**Without A_RELOAD:** A_FILENAME succeeds silently but the mesh stays empty (triCount=0). Render shows nothing — no error, just invisible geometry.

**Without flush_changes():** A_RELOAD may report success without actually loading the mesh. Always flush after reload.

Image textures don't need A_RELOAD — they load on connect.

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

| Type      | ID  | Notes                                                    |
| --------- | --- | -------------------------------------------------------- |
| AT_BOOL   | 1   |                                                          |
| AT_INT    | 3   | Scalar int (auto-extracts .x from int4 responses)        |
| AT_INT2   | 4   |                                                          |
| AT_INT3   | 5   |                                                          |
| AT_INT4   | 6   | **Used by int value nodes** (pass scalar → auto-wraps)   |
| AT_FLOAT  | 9   | Scalar float (auto-extracts .x from float4 responses)    |
| AT_FLOAT2 | 90  | Note: 90 not 10                                          |
| AT_FLOAT3 | 11  | Transform, color {x,y,z}                                 |
| AT_FLOAT4 | 12  | **Used by float value nodes** (pass scalar → auto-wraps) |
| AT_STRING | 14  |                                                          |

**Float/int value nodes** (children of daylight, sun direction, etc.) use `AT_FLOAT4`/`AT_INT4` internally, even for logically-scalar values. You can pass a plain number to `set_attribute` with `expected_type=12` and it auto-wraps to `{x:val,y:0,z:0,w:0}`. Reading with `expected_type=9` (AT_FLOAT) auto-extracts the `.x` component.

---

## §3 RT Pin Layout

| Pin | Name        | Type            | Notes                                  |
| --- | ----------- | --------------- | -------------------------------------- |
| 0   | camera      | PT_CAMERA       | Auto-created (Thin lens)               |
| 1   | environment | PT_ENVIRONMENT  | Auto-created                           |
| 3   | **mesh**    | **PT_GEOMETRY** | **pin_index:3 ONLY**                   |
| 4   | film        | PT_FILM         | Auto-created, resolution on grandchild |
| 6   | kernel      | PT_KERNEL       | Auto-created (DL)                      |

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

## §5 Material Presets

All use `suggest_material(surface_type)` for recommended values. These tables are for manual overrides.

### Universal Material (NT_MAT_UNIVERSAL)

| Material    | Albedo (pin 2)    | Metallic (pin 4) | Roughness (pin 8) |
| ----------- | ----------------- | ---------------- | ----------------- |
| **Gold**    | {1.0, 0.78, 0.34} | 1.0              | 0.15              |
| **Chrome**  | {0.9, 0.9, 0.9}   | 1.0              | 0.02              |
| **Plastic** | any color         | 0                | 0.2               |
| **Fabric**  | any color         | 0                | 0.9               |

### Quick Color Recipes

RGB child on pin 0: `set_attribute(child, 185, 11, {r,g,b})`

White={0.9, 0.9, 0.9}, Red={0.65, 0.05, 0.05}, Green={0.12, 0.45, 0.15}

Roughness scale: 0.01=mirror, 0.1=polished, 0.2=brushed, 0.3=satin, 0.5+=rough

---

## §6 Coordinate System

+X=right, -X=left, +Y=up, -Y=down, +Z=toward camera, -Z=into scene.

1 unit = 1 meter. Human eye: Y=1.5. Table: Y=0.75.

---

## §7 Procedural Textures

### NT_TEX_MIX (blend workhorse)

Pin 0=amount (mask), pin 1=texture1, pin 2=texture2.

### NT_TEX_MARBLE

Pin 2=octaves (more=finer), pin 5=transform (stretch for grain).

### NT_TEX_TURBULENCE

Pin 2=octaves (6-12), pin 3=omega (0.35-0.65), pin 4=transform (stretch for direction), pin 8=gamma (1.0-2.0).

### NT_TEX_RGB

`set_attribute(handle, A_VALUE=185, AT_FLOAT3=11, {r,g,b})`

---

## §8 MCP Resources

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

## §9 Assets

Path prefix: `ORBX/assets_test/`

**Available meshes:** `sphere_hd.obj`, `floor.obj`

Only these two .obj files exist. For other shapes use NT_GEO_OBJECT or NT_GEO_PLANE.
