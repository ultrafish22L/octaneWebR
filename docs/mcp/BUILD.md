# Octane Build Guide

How to construct scenes via MCP. For values, see `REFERENCE.md`. For problems, see `TROUBLESHOOTING.md`.

---

## §1 Core Principle: Human View First

**A human is watching.** Get an interesting render on screen as fast as possible. Every MCP call should be driving toward the first visible result. Don't build backstage — build on stage.

**Priority order:** RT → first geometry + material wired to RT → `start_render` → `fit_camera()` → contrasting environment. Use `fit_camera` after geometry to auto-frame the scene from bounds. Everything else comes after the human has something to look at.

**Check Octane is running** before every build. If gRPC is down, nothing works and the human sees nothing. Verify with `powershell -Command "Get-NetTCPConnection -LocalPort 51022"`.

---

## §2 Build Modes

**SCRATCH (Clean Start):** Kill all processes → restart serv (port 51022) → restart MCP (port 51023) → `preview_start` → `get_octane_version`. Required before any clean test run. **Full 12-step protocol:** `TROUBLESHOOTING.md` §SCRATCH.

### Build Modes (after SCRATCH completes)

| Mode      | Purpose               | AD + SEGA | On Failure             | Default For              |
| --------- | --------------------- | --------- | ---------------------- | ------------------------ |
| **SHOP**  | Workshop / quick test | OFF\*     | Stop, debug, fix       | Testing, experimentation |
| **DRESS** | Rehearsal / dev build | ON\*      | FULL STOP, fix, verify | Scene building (default) |
| **SHOW**  | Live demo             | ON\*      | Skip, keep going       | Audiences, recordings    |

\*AD is a per-run flag. Default ON for DRESS/SHOW, OFF for SHOP. Override with "no AD" or "use AD" in the run command.

**"no AD" flag:** Disables all art direction phases. Skips Phase 0 (composition planning), Phase 0b (artistic intent), and the critique loop (C1-C7). Build proceeds mechanically from recipe positions, materials, and lighting values. `suggest_lighting` and `suggest_material` still work (they don't require AD state). Use when testing pipeline mechanics, debugging wiring, or when speed matters more than composition quality.

**SHOP (Workshop):** Fast workbench mode. AD OFF by default. Build from Phase 1 directly. Use `suggest_lighting` and `suggest_material` for quick values. For quick tests, smoke tests, tool verification, and experimentation where composition quality doesn't matter. The goal is speed, not beauty.

**DRESS (Rehearsal):** Full build pipeline. AD ON by default — Phase 0 composition planning, critique loop after renders, SEGA intent tracking. 1 object at a time, render after each step, hero camera from the start. Stop on any failure — debug, fix, verify, then resume. This is the working mode for serious scene building. **Default — use unless told otherwise.** Say "no AD" to run DRESS without art direction (rote recipe execution).

**SHOW (Performance):** Same as DRESS build order, AD ON by default. Smooth, continuous flow for live demos and VIP audiences. If something breaks mid-show, skip it and keep going — fix it later. Never debug in front of an audience.

---

## §3 DRESS Protocol

Every step produces a visible change. The human should see a render update within the first 4-5 MCP calls.

**On failure: FULL STOP.** Follow the crash protocol in `TROUBLESHOOTING.md` §8. Do not push forward. Do not try "one more thing." Fix → verify → then resume. Stopping is the point — DRESS is where you catch and fix problems.

### Pre-Phase: analyze_mesh (before any placement)

Run `analyze_mesh` on every mesh asset BEFORE building the scene. This is a pre-pass — no Octane calls yet.

| Step | Action                                            | Result                                                                                                               |
| ---- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| M1   | `analyze_mesh(file_path)` for each OBJ/GLB        | Cached v2 sidecar (`.mesh_info.json`) with geometry bounds, semantic description, visual_check, and final_suggestion |
| M2   | Read `final_suggestion` from each sidecar         | Rotation correction (e.g. +90° X for Z-up GLBs), scale recommendation, orientation confidence                        |
| M3   | Apply rotation/scale from suggestion when placing | Ensures meshes are upright and correctly sized                                                                       |

**Mugshot protocol:** analyze_mesh renders 6 views (front/right/top x clay/textured) on an isolated ground plane, sends to VLM for upright verification. Results are cached — subsequent calls return instantly from sidecar.

**Why here:** Placing a mesh without knowing its orientation wastes an entire build iteration. analyze_mesh eliminates guesswork.

---

### Phase 0: Composition Planning (before any Octane calls)

**Requires AD.** Skipped when AD is OFF (SHOP default, or "no AD" flag). When skipped, use recipe positions directly in Phase 3.

Run BEFORE creating any nodes. Pure math — validates layout without touching Octane.

| Step | Action                                                                          | Result                                                                          |
| ---- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 0a   | `analyze_reference(image_path, description)` — if ref image provided            | Structured extraction prompt. Read image + answer prompt → scene data           |
| 0b   | `plan_composition(name, objects, camera, focal_point)`                          | CompositionSpec with computed camera math + auto-validation                     |
| 0c   | `validate_layout(spec_name)` — if plan_composition auto-validation had warnings | Detailed geometric checks: frustum, depth separation, proximity, grid alignment |
| 0d   | Fix any validation errors, re-run plan_composition                              | Clean validated spec                                                            |

**Hard gate:** Do NOT call `create_node` until `validate_layout` passes with 0 errors.

### Phase 0b: Artistic Intent (after composition planning)

**Requires AD.** Skipped when AD is OFF. `suggest_lighting`/`suggest_material` still return reasonable defaults without intent.

| Step | Action                                                           | Result                  |
| ---- | ---------------------------------------------------------------- | ----------------------- |
| 0e   | `set_artistic_intent(preset or vector from recipe mood)`         | SEGA vector initialized |
| 0f   | `get_artistic_intent()` — confirm dimensions match recipe vision | Intent locked           |

**Why here:** SEGA intent drives `suggest_lighting` and `suggest_material` values in Phase 2. Setting it before building ensures mood-consistent choices from the start.

### Phase 1: First Visual (get render on screen ASAP)

| Step | Action                                                                                                                                                               | Result                                                                                                                                                                                                                                                               |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `create_node(NT_RENDERTARGET)`                                                                                                                                       | RT handle + pin handles                                                                                                                                                                                                                                              |
| 2    | Create first mesh (NT_GEO_MESH + .obj or NT_GEO_OBJECT) + LOUD material `{1,0,0}` → placement → geo group → RT `pin_index:3`                                         | **Object exists**. Wiring details: `REFERENCE.md` §5. **Must follow mesh loading pattern** — see `REFERENCE.md` §1. Verify with `get_geometry_stats()` (triCount > 0).                                                                                               |
| 3    | `start_render` → `fit_camera(yaw, elevation, margin)` (auto-frames scene bounds)                                                                                     | **FIRST VISUAL — human sees something.** `fit_camera` computes camera position from scene bounds. Params: `elevation` (degrees above horizon, default 20), `yaw` (orbit degrees, default 0 = front), `margin` (fraction, default 0.3). No manual camera math needed. |
| 4    | Create environment → `connect_nodes(env, RT, pin_id:43)`. **Do not** call `get_node_info` on env children immediately after connecting — wait or sequence carefully. | Sky + lighting appear. DOF is auto-disabled on new RTs.                                                                                                                                                                                                              |

### Phase 2: Materials & Lighting

| Step | Action                                                    | Notes                              |
| ---- | --------------------------------------------------------- | ---------------------------------- |
| 5    | Swap loud material for real material                      | Gold, glass, etc. — visible change |
| 6    | Create PT kernel → `connect_nodes(kernel, RT, pin_id:89)` | Better render quality              |
| 7    | Tune environment (sunset hour, turbidity, etc.)           | Mood change visible immediately    |
| 8    | Render + save                                             | Checkpoint                         |

### Phase 3: Assembly

For each additional object:

1. `suggest_placement(object_name, bounds)` — get collision-free position from scene placement DB
2. Create mesh → apply analyze_mesh rotation → material → placement at suggested position → connect to geo group
3. `register_scene_object(name, position, bounds)` — update scene DB (warns on overlap)
4. `fit_camera()` → render → verify
5. `get_scene_placement_state()` — inspect DB if placement looks wrong

**`fit_camera` after every geometry add or remove.** The camera must always frame the full scene. Each object = a visible change. Never batch multiple objects without `fit_camera` + render between them.

### Phase 4: Polish

Hero camera, floor, fine-tune lighting, final beauty pass `save_render`.

**Hero camera comes at the end.** During Phases 1-3, `fit_camera` handles framing automatically — it shows you the full scene so you can verify every change. Only in Phase 4 do you compose the final hero shot with `set_camera` (or `plan_composition`) for the beauty pass.

### Critique Loop — Dual-Perspective (run after every save_render in Phases 2-4)

**Requires AD.** Skipped when AD is OFF. When skipped, save the render and move on — no scoring, no corrections. **When AD is ON, both critics run every iteration — never skip one.**

| Step | Action                                                                 | Result                                                             |
| ---- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| C1   | `critique_render(render_path, spec_name)`                              | Vision model scores (framing/depth/composition/lighting/placement) |
| C2   | `semantic_critique(render_path)`                                       | Pixel-level intent gap analysis vs SEGA vector                     |
| C3   | Read the saved render image (Read tool)                                | Visual analysis                                                    |
| C4   | Synthesize vision critique (C1) + semantic critique (C2) → JSON scores | Dual-perspective evaluation                                        |
| C5   | `apply_corrections(spec_name, scores, corrections)`                    | Records score, detects stagnation                                  |
| C6   | If score < 3.5: apply priority-1 corrections, re-render, go to C1      | Iteration                                                          |
| C7   | If stagnating (2 iterations < 0.3 improvement): redesign plan          | Plan change, not tweaking                                          |

### Vision Critic

`critique_render` uses an external vision model — not self-critique. Self-critique inflates scores by 1-2 points.

- **Two-image comparison** (reference + render) is most effective
- Vision module: `mcp/src/vision/` with fallback chain

### Render Status — Don't Blind Sleep, Always Check Samples

After `start_render` or `set_camera`, call `get_render_status` to check `state: "RSTATE_FINISHED"`. Renders typically finish in 2-9s. If still rendering, wait 2s and check again. Don't `sleep 8` and hope — **`sleep 3` then check is the maximum wait**.

**ALWAYS call `get_render_status` before `save_render`** and record the result:

- `resolution` — actual pixel dimensions (e.g. "1024x512")
- `samples` — how many samples accumulated
- `maxSamples` — target sample count
- `renderTime` — wall clock seconds
- `state` — must be `RSTATE_FINISHED` before saving

Log these alongside every saved render for calibration and debugging. A low-res or noisy render is a data quality issue — knowing the sample count explains it.

**Polling pattern** (do NOT sleep-then-save):

```
start_render(rt_handle)
loop:
  sleep 2
  status = get_render_status()
  if status.state == "RSTATE_FINISHED": break
save_render(path)
```

---

### Visual Verify — EVERY Mutation (mandatory, no exceptions)

After every visual mutation (geo change, material swap, connect, render start, camera move):

1. **`save_render`** → read the PNG — this is **engine ground truth**
2. **`preview_screenshot`** → read the JPEG — this is **what the user sees**
3. **Compare** — if preview doesn't match render (blank, stale, wrong content), **STOP and diagnose**

This catches almost all bugs and setup errors: dead viewport, stale HMR, websocket disconnect, render not updating, wrong scene state. Logs alone will NOT reveal visual divergences. Both checks, every time. No exceptions.

### Log Check — ALL 3 Log Files, Every Time

After every phase, and on any error, check ALL 3 log files:

| File             | What it catches                                                         |
| ---------------- | ----------------------------------------------------------------------- |
| `log_client.log` | Client JS errors, failed API calls, React errors (batched from browser) |
| `log_grpc.log`   | Vite gRPC proxy errors, raw gRPC call failures, SDK errors              |
| `log_mcp.log`    | MCP tool errors, gate rejections, health failures                       |

All logs go to files — no console-only gaps. "0 errors" means 0 across all 3 files.

---

## §4 Setup Order Variants

**Demos (Hero Camera First):** Create objects, then use `fit_camera()` or `set_camera` to frame. Objects appear immediately.

**Iteration (Wide Camera First):** Start wide (y=2-3, z=5-8), zoom to hero after objects placed.

**Space Scenes (Light First):** No env light → create key light BEFORE geometry or first render is black.

---

## §5 NT_GEO_OBJECT Variant

Primitive shapes — no .obj file needed. Key differences from NT_GEO_MESH:

- **Material pin:** `pin_index: 1` (not 0). Pin 0 is primitive type enum.
- **Transform pin:** Pin 3 (NT_TRANSFORM_VALUE).
- **Auto-wrapping:** Connecting to RT pin 3 auto-creates placement chain. No manual group needed for single objects.
- **Multi-object:** Create NT_GEO_GROUP, connect each geo to group pins (0, 1, 2...), connect group to RT pin_index:3.
- **Primitive type changes work** on SDK server (all 23 types tested (values 1-23), no crashes). NT_GEO_MESH with .obj files is still recommended for production quality geometry.
- **connect/disconnect auto-flush** — `connect_nodes` and `disconnect_pin` auto-flush `ApiChangeManager::update()`. No manual `update_scene` needed between connection changes.

Primitive values: see `REFERENCE.md` §7a.

---

## §6 Camera Workflow

**`fit_camera(yaw, elevation, margin)` handles 90% of camera needs.** Use it after every geometry change. For hero shots in Phase 4, use `set_camera(position, target)` or `plan_composition` for precise framing.

### 3D Asset Orientation

Generated meshes have unknown orientation. **Never guess — use `analyze_mesh`** for reliable orientation via VLM mugshot. OTOY Studio GLBs are Z-up → rotate +90° on X. Set film aspect BEFORE framing.

### Manual Camera Math (rare — only when fit_camera insufficient)

`D_z = W * 0.662` (subject width to distance, 15% margin). Proven tabletop: {0, 4.2, 7.5} → {0, 0, 0}, 29°. Pull-back debug: {0, 5, 20} → {0, 0, 0}. Always verify with render.

---

## §7 Scene Clear (FRESH)

`reset_project` clears the scene safely (`suppressUI` prevents any blocking dialog). Just call it directly:

1. `reset_project()` — clears scene, invalidates all handles
2. Verify: `get_scene_tree` → count: 0

**FRESH vs SCRATCH vs MINIS:**

- **FRESH** — `reset_project` clears the scene. Every test starts with FRESH.
- **SCRATCH** — Kill all processes, restart everything. Required after MCP restart, infra changes, or crashes.
- **MINIS** — `load_project("ORBX/smoketest.orbx")` loads a pre-built smoke test scene. Quick validation that Octane + MCP are working without building from scratch.

---

## §8 3D Asset Pipeline

**CRITICAL:** The only working domain is `https://otoy.studio/`. Navigate to `https://otoy.studio/image-to-3d` for 3D mesh generation. Never click upload buttons (pops OS file dialog) — use "USE URL" toggle + `request_upload_url` instead.

**Generate:** `generate_image_pro` → reference image → OTOY Studio image-to-3D (Chrome UI) → GLB

**Convert:** Python trimesh: `trimesh.load(glb)` → `export('name.obj')` → OBJ + MTL + diffuse PNG

**Load in Octane:**

1. `NT_GEO_MESH` + `A_FILENAME=34` + `A_RELOAD=124`
2. `NT_GEO_PLACEMENT` → connect mesh via `pin_name: "geometry"`
3. `NT_MAT_UNIVERSAL` + `NT_TEX_IMAGE` (diffuse PNG) → mesh `pin_index: 0`
4. Placement → geo group → RT

**Orient:** Set film aspect first → orbit 3 views → fix rotation → scale 2-3x → frame hero shot.

OTOY Studio (MCP server for AI images/3D/video/music/vision) tools available via `mcp__otoy-studio__*`. **3D mesh generation** (Rodin/Hunyuan) requires Chrome MCP — no API exists.

### Texture Prompt Templates

**Diffuse:** `[material] surface, seamless tileable texture, flat orthographic top-down material scan, evenly lit diffuse studio lighting, no shadows no highlights no reflections, PBR albedo map, photorealistic, square 1:1`

**Environment:** `360 degree equirectangular panorama, [scene], high dynamic range, seamless horizon, photorealistic, landscape 16:9`
