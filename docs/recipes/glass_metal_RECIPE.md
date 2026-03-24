# Glass & Metal (Scene 1)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

> **Before building:** Read `CLAUDE.md` (Current Session + MCP Rules) and look up values in `docs/mcp/REFERENCE.md`. Don't improvise what's already documented.

## The Vision

Three spheres on a reflective floor at golden hour — gold, glass, and matte red. This is a material showcase, but it should feel like a photograph, not a product render.

The golden hour sun comes from behind and to the left, painting everything warm. The gold sphere catches it with rich metallic fire. The blue glass sphere bends the world inside itself — the sky distorts, caustic light patterns scatter across the floor beneath it. The red matte sphere is the quiet anchor — no reflections, no tricks, just pure color holding its ground between two show-offs.

The floor isn't just a surface — it's a canvas. Reflections of all three spheres stretch across it, sunset colors pool in the glossy surface, and the glass sphere's caustics paint abstract light patterns.

**Composition**: Three spheres = rule of odds. V-formation: gold and red pushed FORWARD (closer to camera), glass RECESSED at center. This creates a depth triangle — the two flanking spheres frame the glass, which sits behind and between them. The camera is offset left, not centered — asymmetric framing creates tension and interest. The glass sphere is slightly larger, occupying the dominant center position (primary focal point via caustics and refraction). Gold is secondary (warm metallic pop), red is tertiary (matte counterpoint).

**Lighting ratio**: This is a daylight scene (~2:1 ratio) — the sun is key, the sky is fill. Not dramatic, but not flat either. The warm/cool contrast between direct sun and blue sky fill does the heavy lifting.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value                |
| ---------- | -------------------- |
| Position   | (-2, 1.2, 5.5)       |
| Target     | (0, 0.2, 0)          |
| Resolution | 1024x576 interactive |
| Beauty     | 1280x720             |

### Environment (Daylight)

| Setting      | Value           | Notes                                         |
| ------------ | --------------- | --------------------------------------------- |
| Hour         | 19.5            | Late golden hour — deeper warmth than 19.0    |
| Turbidity    | 8               | Atmospheric haze                              |
| North offset | 0.35            | Sun behind-left — visible sunset + front fill |
| Sky color    | (0.7, 0.5, 0.4) | Warm amber — critical for gold sphere         |
| Sunset color | (1, 0.35, 0.08) | Deep orange-red                               |
| Sun size     | 5               | Soft shadows                                  |

### Floor

| Setting   | Value            |
| --------- | ---------------- |
| Shape     | Flat box or quad |
| Scale     | (10, 0.01, 10)   |
| Material  | Glossy           |
| Diffuse   | (0.7, 0.7, 0.7)  |
| Specular  | 1.0              |
| Roughness | 0.02             |

### Gold Sphere (left, forward)

| Setting   | Value            |
| --------- | ---------------- |
| Position  | (-1.5, 0.5, 0.8) |
| Scale     | (0.5, 0.5, 0.5)  |
| Material  | Glossy           |
| Diffuse   | (1, 0.84, 0)     |
| Specular  | 1.0              |
| Roughness | 0.15             |
| IOR       | 30               |

### Glass Sphere (center, recessed)

| Setting      | Value           |
| ------------ | --------------- |
| Position     | (0, 0.6, -0.6)  |
| Scale        | (0.6, 0.6, 0.6) |
| Material     | Specular        |
| Transmission | (0.3, 0.5, 1.0) |
| IOR          | 1.5             |

### Red Sphere (right, forward)

| Setting  | Value             |
| -------- | ----------------- |
| Position | (1.5, 0.5, 0.6)   |
| Scale    | (0.5, 0.5, 0.5)   |
| Material | Diffuse           |
| Diffuse  | (0.8, 0.05, 0.05) |

### Render

| Setting | Value        |
| ------- | ------------ |
| Samples | 5000         |
| Kernel  | Path tracing |

---

## Proven Build Sequence (DRESS Protocol)

_Validated 2026-03-22. Two spheres (silver + glass) on floor with daylight. All steps use NT_GEO_MESH — never NT_GEO_OBJECT for non-box geometry (primitive type changes crash)._

### Infrastructure (steps 1-2)

```
1. create_node(NT_RENDERTARGET) → rt (handle + auto-created pin children)
2. set_camera(position:{0,1.5,4}, target:{0,0,0}, up:{0,1,0})  ← BEFORE geometry
```

### First Object — Loud Material (steps 3-4)

```
3a. create_node(NT_GEO_MESH) → mesh1
    set_attribute(mesh1, A_FILENAME=34, AT_STRING=14, "path/to/sphere_hd.obj")
    set_attribute(mesh1, A_RELOAD=124, AT_BOOL=1, true)
    update_scene()  ← MANDATORY — mesh won't load without this
3b. create_node(NT_MAT_UNIVERSAL) → mat1
    set_attribute(albedo_child, A_VALUE=185, AT_FLOAT3=11, {1,0,0})  ← LOUD red
3c. create_node(NT_GEO_PLACEMENT) → place1
3d. create_node(NT_GEO_GROUP) → group
3e. Wire chain:
    connect mat1 → mesh1 (pin_index: 0)
    connect mesh1 → place1 (pin_name: "geometry")
    connect place1 → group (pin_index: 0)
    connect group → rt (pin_index: 3)
4.  start_render(rt) + set_camera(same position)  ← FIRST VISUAL
```

### Environment + DOF (steps 5-6)

```
5. create_node(NT_ENV_DAYLIGHT) → env
   connect env → rt (pin_index: 1)
6. get_node_info(rt) → find camera child (pin 0 connected_handle)
   get_node_info(camera) → find aperture child (pin 14 connected_handle)
   set_attribute(aperture_child, A_VALUE=185, AT_FLOAT=9, 0)  ← DOF off
```

### Material Swap (step 7)

```
7. Batch with skip_evaluate:true:
   set_attribute(albedo_child, 185, AT_FLOAT3, {0.95, 0.95, 0.95})
   set_attribute(metallic_child, 185, AT_FLOAT, 1.0)
   set_attribute(roughness_child, 185, AT_FLOAT, 0.1)
   set_attribute(specular_child, 185, AT_FLOAT, 1.0)
   update_scene()  ← flush all at once
```

### Second Object (step 8)

```
8a. create_node(NT_GEO_MESH) → mesh2
    set_attribute(mesh2, A_FILENAME, "sphere_hd.obj")
    set_attribute(mesh2, A_RELOAD=124, AT_BOOL=1, true)
    update_scene()
8b. create_node(NT_MAT_UNIVERSAL) → mat2
    Batch skip_evaluate:true:
      transmissionType child → 2 (specular)
      albedo child → {0.98, 0.98, 0.98}
      roughness child → 0
      specular child → 1.0
      index child → 1.52 (IOR)
    update_scene()
8c. create_node(NT_GEO_PLACEMENT) → place2
8d. Wire: mat2→mesh2(pin 0), mesh2→place2("geometry"), place2→group(pin_index: 1)
8e. Position via transforms on placement children:
    set_attribute(place1_transform, A_TRANSLATION=172, AT_FLOAT3, {-1.5, 0, 0})
    set_attribute(place2_transform, A_TRANSLATION=172, AT_FLOAT3, {1.5, 0, 0})
```

### Floor (step 9)

```
9a. create_node(NT_GEO_MESH) → floor_mesh
    set_attribute(floor_mesh, A_FILENAME, "floor.obj")
    set_attribute(floor_mesh, A_RELOAD=124, AT_BOOL=1, true)
    update_scene()
9b. create_node(NT_MAT_UNIVERSAL) → floor_mat
    albedo → {0.7, 0.7, 0.7}, roughness → 0.8
9c. create_node(NT_GEO_PLACEMENT) → floor_place
9d. Wire: floor_mat→floor_mesh(pin 0), floor_mesh→floor_place("geometry"), floor_place→group(pin_index: 2)
9e. Transform: translation {0, -1, 0}, scale {10, 10, 10}
```

### Final Camera + Render (step 10)

```
10. set_camera(position:{2, 2, 6}, target:{0, -0.3, 0}, up:{0,1,0})
    sleep 3 → get_render_status → verify RSTATE_FINISHED
    save_render(path)
    save_project(path.orbx)  ← checkpoint
```

### Key Handles to Track

| Node        | What                           | Pins You Need                                                                                                           |
| ----------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| rt          | Render target                  | pin 0 (camera), pin 1 (env), pin 3 (geo)                                                                                |
| camera      | From rt pin 0 connected_handle | pin 14 (aperture child → DOF)                                                                                           |
| mat         | Universal material             | pin 2 (albedo child), pin 4 (metallic child), pin 6 (specular child), pin 8 (roughness child), pin 15 (index/IOR child) |
| mat (glass) | Also needs                     | pin 1 (transmissionType child → set to 2)                                                                               |
| placement   | Geo placement                  | pin 0 (transform child → A_TRANSLATION, A_SCALE)                                                                        |
