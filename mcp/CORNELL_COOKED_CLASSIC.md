# Cornell Box — Cooked

Proven 2026-03-08. Zero crashes.

`→ VAR` = store handle. `VAR.pins[N]` = pin child handle at index N. `ASSETS` = project assets dir.

## Setup

```
reset_project()

create_node(NT_RENDERTARGET) → RT
start_render(RT)
set_camera({0,1,3.2}, {0,1,0})

create_node(NT_ENV_DAYLIGHT) → ENV
connect_nodes(ENV → RT, pin_index: 1, evaluate: false)
set_camera(...)

get_node_info(RT.pins[4]) → pin 0 → RESOLUTION
set_attribute(RESOLUTION, 185, AT_INT2=4, {1024, 1024})

create_node(NT_KERN_PATHTRACING) → KERNEL
connect_nodes(KERNEL → RT, pin_index: 6, evaluate: false)
set_camera(...)

create_node(NT_GEO_GROUP) → GROUP
set_attribute(GROUP, 113, AT_INT=3, 8)
connect_nodes(GROUP → RT, pin_index: 3, evaluate: false)
set_camera(...)
```

## Left Wall (red)

```
create_node(NT_GEO_OBJECT) → LWALL
set_attribute(LWALL.pins[0], 185, AT_INT=3, 0)                    # primitive = box
set_attribute(LWALL.pins[4], 185, AT_FLOAT=9, 0.01)               # W
set_attribute(LWALL.pins[5], 185, AT_FLOAT=9, 2.0)                # H
set_attribute(LWALL.pins[6], 185, AT_FLOAT=9, 2.0)                # D
set_attribute(LWALL.pins[3], 172, AT_FLOAT3=11, {-1, 1, 0})       # position
get_node_info(LWALL.pins[1]) → pin 0 → LWALL_RGB
set_attribute(LWALL_RGB, 185, AT_FLOAT3=11, {0.65, 0.05, 0.05})   # red
connect_nodes(LWALL → GROUP, pin_name: "Input 1", evaluate: false)
set_camera(...)
```

## Right Wall (green)

```
create_node(NT_GEO_OBJECT) → RWALL
set_attribute(RWALL.pins[0], 185, AT_INT=3, 0)                    # primitive = box
set_attribute(RWALL.pins[4], 185, AT_FLOAT=9, 0.01)               # W
set_attribute(RWALL.pins[5], 185, AT_FLOAT=9, 2.0)                # H
set_attribute(RWALL.pins[6], 185, AT_FLOAT=9, 2.0)                # D
set_attribute(RWALL.pins[3], 172, AT_FLOAT3=11, {1, 1, 0})        # position
get_node_info(RWALL.pins[1]) → pin 0 → RWALL_RGB
set_attribute(RWALL_RGB, 185, AT_FLOAT3=11, {0.12, 0.45, 0.15})   # green
connect_nodes(RWALL → GROUP, pin_name: "Input 2", evaluate: false)
set_camera(...)
```

## Floor (white)

```
create_node(NT_GEO_OBJECT) → FLOOR
set_attribute(FLOOR.pins[0], 185, AT_INT=3, 0)                    # primitive = box
set_attribute(FLOOR.pins[4], 185, AT_FLOAT=9, 2.0)                # W
set_attribute(FLOOR.pins[5], 185, AT_FLOAT=9, 0.01)               # H
set_attribute(FLOOR.pins[6], 185, AT_FLOAT=9, 2.0)                # D
set_attribute(FLOOR.pins[3], 172, AT_FLOAT3=11, {0, 0, 0})        # position
get_node_info(FLOOR.pins[1]) → pin 0 → FLOOR_RGB
set_attribute(FLOOR_RGB, 185, AT_FLOAT3=11, {0.9, 0.9, 0.9})      # white
connect_nodes(FLOOR → GROUP, pin_name: "Input 3", evaluate: false)
set_camera(...)
```

## Ceiling (white)

```
create_node(NT_GEO_OBJECT) → CEIL
set_attribute(CEIL.pins[0], 185, AT_INT=3, 0)                     # primitive = box
set_attribute(CEIL.pins[4], 185, AT_FLOAT=9, 2.0)                 # W
set_attribute(CEIL.pins[5], 185, AT_FLOAT=9, 0.01)                # H
set_attribute(CEIL.pins[6], 185, AT_FLOAT=9, 2.0)                 # D
set_attribute(CEIL.pins[3], 172, AT_FLOAT3=11, {0, 2, 0})         # position
get_node_info(CEIL.pins[1]) → pin 0 → CEIL_RGB
set_attribute(CEIL_RGB, 185, AT_FLOAT3=11, {0.9, 0.9, 0.9})       # white
connect_nodes(CEIL → GROUP, pin_name: "Input 4", evaluate: false)
set_camera(...)
```

## Back Wall (white)

```
create_node(NT_GEO_OBJECT) → BACK
set_attribute(BACK.pins[0], 185, AT_INT=3, 0)                     # primitive = box
set_attribute(BACK.pins[4], 185, AT_FLOAT=9, 2.0)                 # W
set_attribute(BACK.pins[5], 185, AT_FLOAT=9, 2.0)                 # H
set_attribute(BACK.pins[6], 185, AT_FLOAT=9, 0.01)                # D
set_attribute(BACK.pins[3], 172, AT_FLOAT3=11, {0, 1, -1})        # position
get_node_info(BACK.pins[1]) → pin 0 → BACK_RGB
set_attribute(BACK_RGB, 185, AT_FLOAT3=11, {0.9, 0.9, 0.9})       # white
connect_nodes(BACK → GROUP, pin_name: "Input 5", evaluate: false)
set_camera(...)
```

## Ceiling Light

```
create_node(NT_GEO_OBJECT) → LIGHT
set_attribute(LIGHT.pins[0], 185, AT_INT=3, 0)                    # primitive = box
set_attribute(LIGHT.pins[4], 185, AT_FLOAT=9, 0.47)               # W
set_attribute(LIGHT.pins[5], 185, AT_FLOAT=9, 0.01)               # H
set_attribute(LIGHT.pins[6], 185, AT_FLOAT=9, 0.38)               # D
set_attribute(LIGHT.pins[3], 172, AT_FLOAT3=11, {0, 1.99, 0})     # position

create_node(NT_MAT_DIFFUSE) → LIGHTMAT                            # standalone, not auto-created
create_node(NT_EMIS_BLACKBODY) → EMIS
set_attribute(EMIS.pins[1], 185, AT_FLOAT=9, 200)                 # power
set_attribute(EMIS.pins[5], 185, AT_FLOAT=9, 6500)                # temperature
connect_nodes(EMIS → LIGHTMAT, pin_name: "emission", evaluate: false)
connect_nodes(LIGHTMAT → LIGHT, pin_index: 1, evaluate: false)

connect_nodes(LIGHT → GROUP, pin_name: "Input 6", evaluate: false)
set_camera(...)
```

## Tall Box (white, rotated)

```
create_node(NT_GEO_OBJECT) → BOX
set_attribute(BOX.pins[0], 185, AT_INT=3, 0)                      # primitive = box
set_attribute(BOX.pins[4], 185, AT_FLOAT=9, 0.59)                 # W
set_attribute(BOX.pins[5], 185, AT_FLOAT=9, 1.19)                 # H
set_attribute(BOX.pins[6], 185, AT_FLOAT=9, 0.59)                 # D
set_attribute(BOX.pins[3], 172, AT_FLOAT3=11, {0.29, 0.59, 0.33}) # position
set_attribute(BOX.pins[3], 137, AT_FLOAT3=11, {0, 22, 0})         # rotation
get_node_info(BOX.pins[1]) → pin 0 → BOX_RGB
set_attribute(BOX_RGB, 185, AT_FLOAT3=11, {0.9, 0.9, 0.9})        # white
connect_nodes(BOX → GROUP, pin_name: "Input 7", evaluate: false)
set_camera(...)
```

## Glass Sphere

```
create_node(NT_GEO_MESH) → MESH
set_attribute(MESH, 34, AT_STRING=14, "${ASSETS}/sphere.obj")
set_attribute(MESH, 124, AT_BOOL=1, true)                          # reload

create_node(NT_GEO_PLACEMENT) → PLACE
create_node(NT_MAT_SPECULAR) → SPEC
set_attribute(SPEC.pins[0], 185, AT_FLOAT3=11, {1, 1, 1})         # reflection (CRITICAL)
set_attribute(SPEC.pins[1], 185, AT_FLOAT3=11, {1, 1, 1})         # transmission (CRITICAL)
set_attribute(SPEC.pins[7], 185, AT_FLOAT=9, 1.5)                 # IOR
set_attribute(SPEC.pins[22], 185, AT_BOOL=1, true)                # smooth

connect_nodes(SPEC → MESH, pin_index: 0, evaluate: false)
connect_nodes(MESH → PLACE, pin_index: 1, evaluate: false)

set_attribute(PLACE.pins[0], 172, AT_FLOAT3=11, {-0.33, 0.30, -0.16})  # position
set_attribute(PLACE.pins[0], 139, AT_FLOAT3=11, {0.59, 0.59, 0.59})    # scale

connect_nodes(PLACE → GROUP, pin_name: "Input 8", evaluate: false)
set_camera(...)
```

## Beauty

```
save_render → show
```
