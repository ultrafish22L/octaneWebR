# Cornell Box — SPICYOTOY Cooked

Proven 2026-03-08. Zero crashes (torus via mesh workaround).

`-> VAR` = store handle. `VAR.pins[N]` = pin child handle at index N. `ASSETS` = `C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets`.

## Setup

```
reset_project()

create_node(NT_RENDERTARGET) -> RT
start_render(RT)
set_camera({0,1,3.2}, {0,1,0})

create_node(NT_ENV_DAYLIGHT) -> ENV
connect_nodes(ENV -> RT, pin_index: 1, evaluate: false)
set_camera(...)

get_node_info(RT.pins[4]) -> pin 0 -> RESOLUTION
set_attribute(RESOLUTION, 185, AT_INT2=4, {1024, 1024})

create_node(NT_KERN_PATHTRACING) -> KERNEL
connect_nodes(KERNEL -> RT, pin_index: 6, evaluate: false)
set_camera(...)

create_node(NT_GEO_GROUP) -> GROUP
set_attribute(GROUP, 113, AT_INT=3, 9)                          # 9 inputs total
connect_nodes(GROUP -> RT, pin_index: 3, evaluate: false)
set_camera(...)
```

## Left Wall (blazing orange)

```
create_node(NT_GEO_OBJECT) -> LWALL
set_attribute(LWALL.pins[0], 185, AT_INT=3, 0)                  # primitive = box
set_attribute(LWALL.pins[4], 185, AT_FLOAT=9, 0.01)             # W
set_attribute(LWALL.pins[5], 185, AT_FLOAT=9, 2.0)              # H
set_attribute(LWALL.pins[6], 185, AT_FLOAT=9, 2.0)              # D
set_attribute(LWALL.pins[3], 172, AT_FLOAT3=11, {-1, 1, 0})     # position
get_node_info(LWALL.pins[1]) -> pin 0 -> LWALL_RGB
set_attribute(LWALL_RGB, 185, AT_FLOAT3=11, {1, 0.3, 0})        # blazing orange
connect_nodes(LWALL -> GROUP, pin_name: "Input 1", evaluate: false)
set_camera(...)
```

## Right Wall (electric hot magenta)

```
create_node(NT_GEO_OBJECT) -> RWALL
set_attribute(RWALL.pins[0], 185, AT_INT=3, 0)                  # primitive = box
set_attribute(RWALL.pins[4], 185, AT_FLOAT=9, 0.01)             # W
set_attribute(RWALL.pins[5], 185, AT_FLOAT=9, 2.0)              # H
set_attribute(RWALL.pins[6], 185, AT_FLOAT=9, 2.0)              # D
set_attribute(RWALL.pins[3], 172, AT_FLOAT3=11, {1, 1, 0})      # position
get_node_info(RWALL.pins[1]) -> pin 0 -> RWALL_RGB
set_attribute(RWALL_RGB, 185, AT_FLOAT3=11, {0.85, 0, 0.45})    # hot magenta
connect_nodes(RWALL -> GROUP, pin_name: "Input 2", evaluate: false)
set_camera(...)
```

## Floor (near-black obsidian)

```
create_node(NT_GEO_OBJECT) -> FLOOR
set_attribute(FLOOR.pins[0], 185, AT_INT=3, 0)                  # primitive = box
set_attribute(FLOOR.pins[4], 185, AT_FLOAT=9, 2.0)              # W
set_attribute(FLOOR.pins[5], 185, AT_FLOAT=9, 0.01)             # H
set_attribute(FLOOR.pins[6], 185, AT_FLOAT=9, 2.0)              # D
set_attribute(FLOOR.pins[3], 172, AT_FLOAT3=11, {0, 0, 0})      # position
get_node_info(FLOOR.pins[1]) -> pin 0 -> FLOOR_RGB
set_attribute(FLOOR_RGB, 185, AT_FLOAT3=11, {0.05, 0.05, 0.05}) # near-black
connect_nodes(FLOOR -> GROUP, pin_name: "Input 3", evaluate: false)
set_camera(...)
```

## Ceiling (near-black)

```
create_node(NT_GEO_OBJECT) -> CEIL
set_attribute(CEIL.pins[0], 185, AT_INT=3, 0)                   # primitive = box
set_attribute(CEIL.pins[4], 185, AT_FLOAT=9, 2.0)               # W
set_attribute(CEIL.pins[5], 185, AT_FLOAT=9, 0.01)              # H
set_attribute(CEIL.pins[6], 185, AT_FLOAT=9, 2.0)               # D
set_attribute(CEIL.pins[3], 172, AT_FLOAT3=11, {0, 2, 0})       # position
get_node_info(CEIL.pins[1]) -> pin 0 -> CEIL_RGB
set_attribute(CEIL_RGB, 185, AT_FLOAT3=11, {0.05, 0.05, 0.05})  # near-black
connect_nodes(CEIL -> GROUP, pin_name: "Input 4", evaluate: false)
set_camera(...)
```

## Back Wall (near-black)

```
create_node(NT_GEO_OBJECT) -> BACK
set_attribute(BACK.pins[0], 185, AT_INT=3, 0)                   # primitive = box
set_attribute(BACK.pins[4], 185, AT_FLOAT=9, 2.0)               # W
set_attribute(BACK.pins[5], 185, AT_FLOAT=9, 2.0)               # H
set_attribute(BACK.pins[6], 185, AT_FLOAT=9, 0.01)              # D
set_attribute(BACK.pins[3], 172, AT_FLOAT3=11, {0, 1, -1})      # position
get_node_info(BACK.pins[1]) -> pin 0 -> BACK_RGB
set_attribute(BACK_RGB, 185, AT_FLOAT3=11, {0.05, 0.05, 0.05})  # near-black
connect_nodes(BACK -> GROUP, pin_name: "Input 5", evaluate: false)
set_camera(...)
```

## Ceiling Light (warm golden-amber)

```
create_node(NT_GEO_OBJECT) -> LIGHT
set_attribute(LIGHT.pins[0], 185, AT_INT=3, 0)                  # primitive = box
set_attribute(LIGHT.pins[4], 185, AT_FLOAT=9, 0.6)              # W (slightly larger than classic)
set_attribute(LIGHT.pins[5], 185, AT_FLOAT=9, 0.01)             # H
set_attribute(LIGHT.pins[6], 185, AT_FLOAT=9, 0.5)              # D
set_attribute(LIGHT.pins[3], 172, AT_FLOAT3=11, {0, 1.99, 0})   # position

create_node(NT_MAT_DIFFUSE) -> LIGHTMAT                          # standalone
create_node(NT_EMIS_BLACKBODY) -> EMIS
set_attribute(EMIS.pins[1], 185, AT_FLOAT=9, 1500)              # power (high for dark room)
set_attribute(EMIS.pins[5], 185, AT_FLOAT=9, 2800)              # temperature (warm amber)
connect_nodes(EMIS -> LIGHTMAT, pin_name: "emission", evaluate: false)
connect_nodes(LIGHTMAT -> LIGHT, pin_index: 1, evaluate: false)

connect_nodes(LIGHT -> GROUP, pin_name: "Input 6", evaluate: false)
set_camera(...)
```

## Chrome Torus (mirror finish, mesh workaround)

**NOTE**: Primitive=22 (Torus) CRASHES Octane. Must use NT_GEO_MESH + torus.obj.

```
create_node(NT_GEO_MESH) -> TORUS_MESH
set_attribute(TORUS_MESH, 34, AT_STRING=14, "${ASSETS}/torus.obj")
set_attribute(TORUS_MESH, 124, AT_BOOL=1, true)                  # reload

create_node(NT_GEO_PLACEMENT) -> TORUS_PLACE
create_node(NT_MAT_GLOSSY) -> GLOSSY
set_attribute(GLOSSY.pins[0], 185, AT_FLOAT3=11, {0, 0, 0})     # diffuse = black (pure mirror)
set_attribute(GLOSSY.pins[1], 185, AT_FLOAT=9, 1.0)             # specular = full
set_attribute(GLOSSY.pins[4], 185, AT_FLOAT=9, 0.0)             # roughness = 0 (mirror)
set_attribute(GLOSSY.pins[19], 185, AT_BOOL=1, true)             # smooth

connect_nodes(GLOSSY -> TORUS_MESH, pin_index: 0, evaluate: false)
connect_nodes(TORUS_MESH -> TORUS_PLACE, pin_index: 1, evaluate: false)

set_attribute(TORUS_PLACE.pins[0], 172, AT_FLOAT3=11, {0.35, 0.15, -0.3})   # position
set_attribute(TORUS_PLACE.pins[0], 139, AT_FLOAT3=11, {0.6, 0.6, 0.6})      # scale
set_attribute(TORUS_PLACE.pins[0], 137, AT_FLOAT3=11, {15, 30, 0})          # rotation

connect_nodes(TORUS_PLACE -> GROUP, pin_name: "Input 7", evaluate: false)
set_camera(...)
```

## Hot Glass Sphere (red-amber tinted)

```
create_node(NT_GEO_MESH) -> SPHERE_MESH
set_attribute(SPHERE_MESH, 34, AT_STRING=14, "${ASSETS}/sphere.obj")
set_attribute(SPHERE_MESH, 124, AT_BOOL=1, true)                 # reload

create_node(NT_GEO_PLACEMENT) -> SPHERE_PLACE
create_node(NT_MAT_SPECULAR) -> SPEC
set_attribute(SPEC.pins[0], 185, AT_FLOAT3=11, {1, 1, 1})       # reflection
set_attribute(SPEC.pins[1], 185, AT_FLOAT3=11, {1, 0.3, 0.15})  # transmission (red-amber tint)
set_attribute(SPEC.pins[7], 185, AT_FLOAT=9, 1.5)               # IOR
set_attribute(SPEC.pins[22], 185, AT_BOOL=1, true)              # smooth

connect_nodes(SPEC -> SPHERE_MESH, pin_index: 0, evaluate: false)
connect_nodes(SPHERE_MESH -> SPHERE_PLACE, pin_index: 1, evaluate: false)

set_attribute(SPHERE_PLACE.pins[0], 172, AT_FLOAT3=11, {-0.35, 0.3, -0.1})  # position
set_attribute(SPHERE_PLACE.pins[0], 139, AT_FLOAT3=11, {0.6, 0.6, 0.6})     # scale

connect_nodes(SPHERE_PLACE -> GROUP, pin_name: "Input 8", evaluate: false)
set_camera(...)
```

## Glowing Ember (hot coal on the floor)

```
create_node(NT_GEO_OBJECT) -> EMBER
set_attribute(EMBER.pins[0], 185, AT_INT=3, 0)                  # primitive = box
set_attribute(EMBER.pins[4], 185, AT_FLOAT=9, 0.12)             # W
set_attribute(EMBER.pins[5], 185, AT_FLOAT=9, 0.06)             # H
set_attribute(EMBER.pins[6], 185, AT_FLOAT=9, 0.08)             # D
set_attribute(EMBER.pins[3], 172, AT_FLOAT3=11, {0, 0.03, 0.1}) # position (between torus & sphere)
set_attribute(EMBER.pins[3], 137, AT_FLOAT3=11, {10, 25, 5})    # rotation (natural angle)

create_node(NT_MAT_DIFFUSE) -> EMBER_MAT                         # standalone
create_node(NT_EMIS_BLACKBODY) -> EMBER_EMIS
set_attribute(EMBER_EMIS.pins[1], 185, AT_FLOAT=9, 15)          # power (warm glow, not spotlight)
set_attribute(EMBER_EMIS.pins[5], 185, AT_FLOAT=9, 1800)        # temperature (deep orange)
connect_nodes(EMBER_EMIS -> EMBER_MAT, pin_name: "emission", evaluate: false)
connect_nodes(EMBER_MAT -> EMBER, pin_index: 1, evaluate: false)

connect_nodes(EMBER -> GROUP, pin_name: "Input 9", evaluate: false)
set_camera(...)
```

## Beauty

```
save_render -> show
```

## Key Differences from CLASSIC

| Aspect          | CLASSIC                | SPICYOTOY                             |
| --------------- | ---------------------- | ------------------------------------- |
| Left wall       | Red {0.65,0.05,0.05}   | Blazing orange {1,0.3,0}              |
| Right wall      | Green {0.12,0.45,0.15} | Hot magenta {0.85,0,0.45}             |
| Floor/Ceil/Back | White {0.9,0.9,0.9}    | Near-black obsidian {0.05,0.05,0.05}  |
| Light temp      | 6500K (daylight)       | 2800K (warm amber)                    |
| Light power     | 200                    | 1500 (compensates dark walls)         |
| Light size      | 0.47 x 0.38            | 0.6 x 0.5 (slightly larger)           |
| Object 1        | Tall white box         | Chrome mirror torus (mesh workaround) |
| Object 2        | Clear glass sphere     | Red-amber tinted glass sphere         |
| Object 3        | —                      | Glowing ember (1800K emissive)        |
| Geo group pins  | 8                      | 9                                     |
