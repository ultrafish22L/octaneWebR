# Octane MCP Crash Log

Raw crash traces. All crashes = ECONNRESET, require full Octane restart, invalidate all handles.

---

## #3 — 2026-03-08 — NT_GEO_MESH sphere (ARCTIC build)

**Context**: 5 walls + ceiling light rendering. Building frosted sphere via NT_GEO_MESH + sphere.obj (the primitive=20 workaround).

**What happened**: Created mesh + placement + specular material with aggressive parallel calls and `evaluate:false`. All 14 operations returned success. Crash on `set_camera` (the evaluation trigger).

```
create_node(NT_GEO_MESH)       → 1000890  ✓
create_node(NT_GEO_PLACEMENT)  → 1000891  ✓
create_node(NT_MAT_SPECULAR)   → 1000893  ✓
set_attribute (filename, reflection, transmission, IOR, smooth) × 5  ✓
set_attribute (A_RELOAD=true)  ✓
set_attribute (roughness)      ✓
connect_nodes × 3 (evaluate:false)  ✓
set_attribute (translation, scale) × 2  ✓
set_camera → ECONNRESET ❌
```

**Note**: The identical node chain (NT_GEO_MESH + sphere.obj + specular + placement → group) succeeded in SPICYOTOY. That build used more sequential calls. Could be timing, could be non-deterministic, could be something else entirely. Octane's gRPC API is not mature — treat all crashes as potential Octane bugs unless proven otherwise.

**Mitigation to test**: Build mesh objects in phases with `update_scene()` between steps.

---

## #2 — 2026-03-08 — Torus primitive=22 (SPICYOTOY build)

**Context**: 5 walls + ceiling light rendering. Setting primitive type on NT_GEO_OBJECT.

```
set_attribute(1000751, 185, AT_INT=3, 22)  → success
ApiChangeManager.update                    → success
set_attribute(1000755, 185, AT_FLOAT=9, 0.6) → NO RESPONSE (ECONNRESET ~500ms later)
```

**Pattern**: Delayed crash. The primitive=22 call returned success, crash hit on the next call.

---

## #1 — 2026-03-07 — Sphere primitive=20 (CLASSIC build)

**Context**: Setting primitive type on NT_GEO_OBJECT.

```
set_attribute(primitive_enum, 185, AT_INT=3, 20) → ECONNRESET (immediate)
```

---

## What We Know

**Confirmed Octane bugs** (reproducible):

- Sphere primitive (20) crashes immediately via gRPC
- Torus primitive (22) crashes with ~500ms delay via gRPC
- `resetProject` without `suppressUI: true` crashes

**Suspected Octane bugs** (not fully understood):

- NT_GEO_MESH build crashed once but the same pattern worked before
- Heavy structural ops (destroy connected nodes, ungroup) can cause delayed crashes
- Root cause unclear — could be malformed data from the MCP layer, race conditions in Octane's gRPC handler, or bugs in the render engine's evaluation pipeline

**The gRPC API is not mature.** Many crashes may be Octane-side bugs that wouldn't occur through the normal Lua scripting API. Be skeptical of any single theory.
