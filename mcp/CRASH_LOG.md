# Octane gRPC Crash Log

Raw crash traces from pre-alpha gRPC API testing. We are the engineering team. **Assume our fault until proven otherwise.** All crashes = ECONNRESET, require full Octane restart, invalidate all handles.

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

## #4 — 2026-03-08 — update_scene() in complex emissive scene ("The Summoning")

**Context**: Building 5th emissive totem (Candle, Input 10) in dark ritual chamber. Scene had 10 geo objects (5 walls + 4 emissive totems already connected), PT kernel, near-black walls (0.03 albedo). Group had 12 pins, 9 already connected.

**What happened**: Created NT_GEO_OBJECT (box), NT_MAT_DIFFUSE, NT_EMIS_BLACKBODY (1800K, power 50). Connected all 3 with `evaluate:false`. Called `update_scene()` — immediate ECONNRESET.

```
create_node(NT_GEO_OBJECT)    → 1001011  ✓
set_attribute(primitive=0)     → ✓  (Box)
set_attribute(scale)           → ✓  (0.15, 0.6, 0.15)
set_attribute(translation)     → ✓  (0, 0.3, -0.7)
create_node(NT_MAT_DIFFUSE)    → 1001036  ✓
create_node(NT_EMIS_BLACKBODY) → 1001050  ✓
set_attribute(temp=1800)       → ✓
set_attribute(power=50)        → ✓
connect_nodes(emis→mat, "emission", evaluate:false)   ✓
connect_nodes(mat→geo, pin 1, evaluate:false)          ✓
connect_nodes(geo→group, "Input 10", evaluate:false)   ✓
update_scene() → 14 UNAVAILABLE: read ECONNRESET      ❌
get_render_status → ECONNREFUSED (Octane fully dead)   ❌
```

**Critical**: The IDENTICAL pattern succeeded 30 seconds earlier for Star totem (Input 9, 6500K, power 25). Same 3 deferred connections + `update_scene()` → success. The only difference: one more emissive object in the scene.

**Emissive objects at crash:**

- Fire: 1500K, power 40 (front-left)
- Ice: 10000K, power 30 (front-right)
- Ember: 2200K, power 35 (back-left)
- Star: 6500K, power 25 (back-right) — just added successfully
- Candle: 1800K, power 50 (back-center) — being added when crashed

**Root cause analysis**: `update_scene()` calls `ApiChangeManager.update()` synchronously on the gRPC message thread. With 5 emissive objects spanning 1500K-10000K in a near-black (0.03 albedo) closed room under path tracing, the scene evaluation is heavy — BVH rebuild, light sampling table construction, spectral distribution compilation, GPU memory allocation. The message thread can't handle this and crashes the gRPC connection.

`set_camera()` uses a different code path through the thread-safe `ApiRenderEngine` and doesn't have this vulnerability. The OCTANE_MCP.md docs already recommended set_camera over update_scene, but this crash confirms update_scene is an active crash vector — not just "less reliable" but genuinely dangerous in complex scenes.

**Lesson**: The crash vector is **batching deferred changes** (`evaluate:false` × N) then flushing all at once with `update_scene()`. The fix: don't defer — use `evaluate:true` (default) so each connection evaluates incrementally. Then `set_camera()` to refresh the render. Human watchers also benefit from `evaluate:true` since they see each change live in the viewport.

---

## What We Know

**Confirmed Octane bugs** (reproducible):

- Sphere primitive (20) crashes immediately via gRPC
- Torus primitive (22) crashes with ~500ms delay via gRPC
- `resetProject` without `suppressUI: true` crashes

**Confirmed dangerous API calls**:

- Batching deferred changes (`evaluate:false` × N → `update_scene()`) crashes in complex scenes (5+ emissive objects + PT). The heavy synchronous evaluation overwhelms the gRPC message thread. Fix: use `evaluate:true` (default) for incremental evaluation. `update_scene()` is fine for small flushes but dangerous for large batched structural changes.

**Suspected Octane bugs** (not fully understood):

- NT_GEO_MESH build crashed once but the same pattern worked before
- Heavy structural ops (destroy connected nodes, ungroup) can cause delayed crashes
- Root cause unclear — could be malformed data from the MCP layer, race conditions in Octane's gRPC handler, or bugs in the render engine's evaluation pipeline

**The gRPC API is pre-alpha.** We are the test engineers. **Assume our misuse until proven otherwise** — exhaust all explanations before blaming the engine. Workarounds are current best practice and will evolve with API updates.

**Key takeaway from crash #4**: The same API pattern can succeed N times and crash on N+1 as scene complexity grows. The real crash vector is **batching** deferred changes then flushing all at once — not `update_scene()` per se. Use `evaluate:true` (default) for incremental evaluation. `set_camera()` refreshes the render; `update_scene()` is fine for small operations but risky for large batches.
