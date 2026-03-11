# Glass & Metal — Cooked Recipe

Exact MCP call sequence. No interpretation. Execute in order.

## Pre-flight — Delete All Nodes

**NEVER use `reset_project`** — it triggers a "Save changes?" dialog that blocks.

```
get_scene_tree(max_depth=1)          → list top-level handles
delete_node(handle) × N              → leaves first, RT last
get_scene_tree(max_depth=1)          → verify count: 0
```

Skip if starting from a fresh Octane launch (scene already empty).

## 1. Render Target + Camera

```
RT        = create_node("NT_RENDERTARGET")          → note pin handles
            start_render(RT)
            set_camera(position={-1.5, 0.9, 4.2}, target={0, 0.15, 0})
                                                     → hero framing, user sees default env
```

## 2. Environment — VISIBLE FIRST

Connect ENV immediately so user sees the sunset sky before any geometry.

```
ENV       = create_node("NT_ENV_DAYLIGHT")
            connect_nodes(ENV → RT, pin_index=1, evaluate=true)
            set_camera(...)                          → RENDER — sunset sky visible!

            get_node_info(ENV.pin[0])                → find "hour" child (pin 4)
            set_attribute(hour_child,    185, AT_FLOAT=9,  19.0)
            set_attribute(ENV.pin[1],    185, AT_FLOAT=9,  8)       — turbidity
            set_attribute(ENV.pin[6],    185, AT_FLOAT3=11, {0.7, 0.5, 0.4})  — sky color (warm amber)
            set_attribute(ENV.pin[7],    185, AT_FLOAT3=11, {1, 0.35, 0.08}) — sunset color (deep orange)
            set_attribute(ENV.pin[8],    185, AT_FLOAT=9,  5)       — sun size
            update_scene()
            set_camera(...)                          → RENDER — warm sunset with tuned sky
save_render(...)                                     — verify mood/sky
```

## 3. Film + Kernel + Geo Group

```
FILM      get_node_info(RT.pin[4])                   → film settings
            get its pin[0] → "Image resolution" child
            set_attribute(res_child, 185, AT_INT2=4, {1024, 576})

KERNEL    = create_node("NT_KERN_PATHTRACING")
            connect_nodes(KERNEL → RT, pin_index=6)
            set_camera(...)                          — refresh

GEO_GRP   = create_node("NT_GEO_GROUP")
            set_attribute(GEO_GRP, 113, AT_INT=3, 8) — 8 input slots
            connect_nodes(GEO_GRP → RT, pin_index=3)
            set_camera(...)                          — refresh
```

## 4. Floor

```
FLOOR_MESH = create_node("NT_GEO_MESH")
FLOOR_PLAC = create_node("NT_GEO_PLACEMENT")      → transform child = pin[0]
FLOOR_MAT  = create_node("NT_MAT_GLOSSY")

set_attribute(FLOOR_MESH, A_FILENAME=34, AT_STRING=14,
              "C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/floor.obj")
set_attribute(FLOOR_MESH, A_RELOAD=92, AT_BOOL=1, true)

set_attribute(FLOOR_MAT.diffuse,   185, AT_FLOAT3=11, {0.7, 0.7, 0.7})
set_attribute(FLOOR_MAT.specular,  185, AT_FLOAT=9,   1.0)
set_attribute(FLOOR_MAT.roughness, 185, AT_FLOAT=9,   0.02)

set_attribute(FLOOR_PLAC.transform, A_SCALE=139, AT_FLOAT3=11, {10, 10, 10})

connect_nodes(FLOOR_MAT  → FLOOR_MESH, pin_index=0)       — material to mesh
connect_nodes(FLOOR_MESH → FLOOR_PLAC, pin_name="geometry") — mesh to placement
connect_nodes(FLOOR_PLAC → GEO_GRP,    pin_name="Input 1")

set_camera(...)   — refresh + render
save_render(...)  — verify floor visible with sunset reflections
```

## 5. Gold Sphere (left, forward)

```
GOLD_MESH = create_node("NT_GEO_MESH")
GOLD_PLAC = create_node("NT_GEO_PLACEMENT")       → transform child = pin[0]
GOLD_MAT  = create_node("NT_MAT_GLOSSY")

set_attribute(GOLD_MESH, A_FILENAME=34, AT_STRING=14,
              "C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/sphere_hd.obj")
set_attribute(GOLD_MESH, A_RELOAD=92, AT_BOOL=1, true)

set_attribute(GOLD_MAT.diffuse,   185, AT_FLOAT3=11, {1, 0.84, 0})   — gold
set_attribute(GOLD_MAT.specular,  185, AT_FLOAT=9,   1.0)
set_attribute(GOLD_MAT.roughness, 185, AT_FLOAT=9,   0.15)
set_attribute(GOLD_MAT.index,     185, AT_FLOAT=9,   30)             — IOR 30 (metallic but not pure mirror)

set_attribute(GOLD_PLAC.transform, A_TRANSLATION=172, AT_FLOAT3=11, {-0.9, 0.3, 0.4})
set_attribute(GOLD_PLAC.transform, A_SCALE=139,       AT_FLOAT3=11, {0.6, 0.6, 0.6})

connect_nodes(GOLD_MAT  → GOLD_MESH, pin_index=0)
connect_nodes(GOLD_MESH → GOLD_PLAC, pin_name="geometry")
connect_nodes(GOLD_PLAC → GEO_GRP,   pin_name="Input 2")

set_camera(...)   — refresh + render
save_render(...)  — verify gold sphere visible, metallic not plastic
```

## 6. Glass Sphere (center, recessed)

```
GLASS_MESH = create_node("NT_GEO_MESH")
GLASS_PLAC = create_node("NT_GEO_PLACEMENT")      → transform child = pin[0]
GLASS_MAT  = create_node("NT_MAT_SPECULAR")

set_attribute(GLASS_MESH, A_FILENAME=34, AT_STRING=14,
              "C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/sphere_hd.obj")
set_attribute(GLASS_MESH, A_RELOAD=92, AT_BOOL=1, true)

set_attribute(GLASS_MAT.transmission, 185, AT_FLOAT3=11, {0.3, 0.5, 1.0})

set_attribute(GLASS_PLAC.transform, A_TRANSLATION=172, AT_FLOAT3=11, {0, 0.38, -0.3})
set_attribute(GLASS_PLAC.transform, A_SCALE=139,       AT_FLOAT3=11, {0.75, 0.75, 0.75})

connect_nodes(GLASS_MAT  → GLASS_MESH, pin_index=0)
connect_nodes(GLASS_MESH → GLASS_PLAC, pin_name="geometry")
connect_nodes(GLASS_PLAC → GEO_GRP,    pin_name="Input 3")

set_camera(...)   — refresh + render
save_render(...)  — verify glass sphere with caustics
```

## 7. Red Sphere (right, forward)

```
RED_MESH = create_node("NT_GEO_MESH")
RED_PLAC = create_node("NT_GEO_PLACEMENT")         → transform child = pin[0]
RED_MAT  = create_node("NT_MAT_DIFFUSE")

set_attribute(RED_MESH, A_FILENAME=34, AT_STRING=14,
              "C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/sphere_hd.obj")
set_attribute(RED_MESH, A_RELOAD=92, AT_BOOL=1, true)

set_attribute(RED_MAT.diffuse, 185, AT_FLOAT3=11, {0.8, 0.05, 0.05})  — red

set_attribute(RED_PLAC.transform, A_TRANSLATION=172, AT_FLOAT3=11, {0.9, 0.3, 0.3})
set_attribute(RED_PLAC.transform, A_SCALE=139,       AT_FLOAT3=11, {0.6, 0.6, 0.6})

connect_nodes(RED_MAT  → RED_MESH, pin_index=0)
connect_nodes(RED_MESH → RED_PLAC, pin_name="geometry")
connect_nodes(RED_PLAC → GEO_GRP,  pin_name="Input 4")

set_camera(...)   — refresh + render
save_render(...)  — verify complete scene, V-formation, all 3 spheres
```

## Handle Map (for reference after build)

| Object | Mesh | Placement | Transform | Material | Geo Group Input |
| ------ | ---- | --------- | --------- | -------- | --------------- |
| Floor  | —    | —         | —         | Glossy   | Input 1         |
| Gold   | —    | —         | —         | Glossy   | Input 2         |
| Glass  | —    | —         | —         | Specular | Input 3         |
| Red    | —    | —         | —         | Diffuse  | Input 4         |

Fill handles as you build. Reference for camera tweaks and material iteration.

## Critical Values (from proven render)

- **Camera**: (-1.5, 0.9, 4.2) → (0, 0.15, 0)
- **V-formation**: gold z=0.4, glass z=-0.3, red z=0.3
- **Gold IOR 30** — metallic reflectivity without being a pure mirror (IOR 100 reflects cool sky, looks silver)
- **Sky color (0.7, 0.5, 0.4)** — warm amber tint so gold sphere reflects warm light
- **Sunset color (1, 0.35, 0.08)** — deep orange-red sunset
- **Floor roughness 0.02** — near-mirror for sunset reflections
- **Resolution**: 1024×576 interactive, 1280×720 beauty
- **Render**: 5000 samples, ~20s @ 1024×576
