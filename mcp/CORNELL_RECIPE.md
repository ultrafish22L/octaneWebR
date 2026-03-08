# Cornell Box Recipe

Classic Cornell box demo. Red left, green right, white room, ceiling light, tall box, glass sphere.

> **All rules, pin layouts, crash prevention, and patterns**: see [OCTANE_MCP.md](OCTANE_MCP.md)

---

## Demo Build

Each object pops in one at a time. After every geo group connect: `update_scene` → `restart_render` → `start_render(RT)`.

### Setup (RT → env → film → kernel → geo)

```
reset_project
create RT → start_render(RT)
set_camera(0, 1, 3.2) target(0, 1, 0)
create env (NT_ENV_DAYLIGHT) → connect RT pin 1 → update/restart/start
get_node_info(RT) → film → resolution → set 1024x1024 (AT_INT2=4)
create PT kernel → connect RT pin 6 → update/restart/start
create geo group → set pin count 8 → connect RT pin 3 → update/restart/start
```

### Walls (left → right → floor → ceiling → back)

For each: create NT_GEO_OBJECT → get_node_info → set W/H/D/pos → (colored: set material RGB) → connect to group pin N → update/restart/start.

```
pin 0: Left wall   — 0.01×2.0×2.0 at (-1, 1, 0)   — red (0.65, 0.05, 0.05)
pin 1: Right wall  — 0.01×2.0×2.0 at (1, 1, 0)    — green (0.12, 0.45, 0.15)
pin 2: Floor       — 2.0×0.01×2.0 at (0, 0, 0)    — white
pin 3: Ceiling     — 2.0×0.01×2.0 at (0, 2, 0)    — white
pin 4: Back wall   — 2.0×2.0×0.01 at (0, 1, -1)   — white
```

### Light (pin 5)

```
create NT_GEO_OBJECT — 0.47×0.01×0.38 at (0, 1.99, 0)
create standalone NT_MAT_DIFFUSE + NT_EMIS_BLACKBODY (power=200)
connect emission → diffuse pin 14, diffuse → light pin 1
connect light → group pin 5 → update/restart/start
```

### Tall Box (pin 6)

```
create NT_GEO_OBJECT — primitive=0 (Box), 0.59×1.19×0.59 at (0.29, 0.59, 0.33), rotY=+22
set material white (0.9, 0.9, 0.9)
connect → group pin 6 → update/restart/start
```

### Glass Sphere (pin 7)

```
create NT_GEO_MESH → load ORBX/assets/sphere.obj (A_FILENAME=34)
create NT_GEO_PLACEMENT + NT_MAT_SPECULAR (IOR=1.5, smooth=true)
connect specular → mesh pin 0, mesh → placement pin 1
set placement pos (-0.24, 0.30, -0.46), scale (0.59, 0.59, 0.59)
connect placement → group pin 7 → update/restart/start
```

### Beauty

```
restart_render (let converge) → save_render → Read PNG
```

---

## Speed Build (~5 messages)

Same scene, max parallelism. See [OCTANE_MCP.md — Speed Patterns](OCTANE_MCP.md#speed-patterns) for the general approach.

1. **Reset + create all 14 nodes** in parallel (RT, env, kernel, group, 7 geos, mesh, placement, specular, emission, diffuse)
2. **Batch get_node_info** on all nodes → discover child handles + wire infrastructure connections + set pin count + load sphere.obj + start_render(RT)
3. **Second get_node_info** round for material RGB children (need mat handles from step 2)
4. **All set_attribute** calls (W/H/D/primitive/positions/colors/IOR/power/film) + connect all 8 geos to group (evaluate=false) + update_scene + restart_render + start_render(RT)
5. **save_render** → Read PNG
