# Octane Build Guide

How to construct scenes via MCP. For values, see `REFERENCE.md`.

## Who This Doc Is For

This document describes the **step-by-step build workflow** — the exact sequence of tool calls and verification gates an AI agent follows to construct an Octane scene. If you want to understand **what the system does conceptually**, read [Art Direction System](../ADSYSTEM.md) first.

If you're directing the AI builder (telling Claude what to create), here's what your scene goes through:

1. **Plan** — Analyze reference images, compute spatial layout, set artistic mood. No rendering yet — pure math and intent.
2. **Frame** — Build the first object, start the render, frame the camera. Get something on screen fast.
3. **Dress** — Materials, lighting, environment. Apply SEGA-driven values for mood consistency.
4. **Critique** — Vision model scores the render. Fix the weakest dimension. Re-render. Loop until good.

Each phase has hard gates — you don't move forward until the current phase passes. This prevents the common failure mode of polishing materials on a badly framed scene.

---

## §1 Core Principle: Human View First

**A human is watching.** Get an interesting render on screen as fast as possible. Every MCP call should be driving toward the first visible result. Don't build backstage — build on stage.

> **⚠️ AD TRANSPARENCY: Every VLM/AI call MUST show its full prompt, image paths, and raw response in the tool output.** No silent AI calls. If it talks to a model, the conversation is visible. See [ADSYSTEM.md §Transparency](../ADSYSTEM.md) for the full spec and labeled-block format.

**Priority order:** RT → first geometry + material wired to RT → `start_render` → `fit_camera()` → contrasting environment. Use `fit_camera` after geometry to auto-frame the scene from bounds. Everything else comes after the human has something to look at.

**Check Octane is running** before every build. If gRPC is down, nothing works and the human sees nothing. Verify with `powershell -Command "Get-NetTCPConnection -LocalPort 51022"`.

---

## §2 Build Modes

**SCRATCH (Clean Start):** Required before any clean test run, after MCP restart, or infra changes.

1. Kill all processes (`taskkill //F //IM octane.exe`, `taskkill //F //IM octaneServGrpc.exe`)
2. Stop preview server (`preview_stop`)
3. Reset MCP (must fully kill, not just disconnect):
   - `taskkill //F //IM node.exe` — kill ALL node processes
   - Wait 3 seconds for ports to release
   - Verify port 51023 is free: `powershell Get-NetTCPConnection -LocalPort 51023` — must return empty
   - Trigger MCP restart: call any MCP tool (e.g. `get_octane_version`). Claude auto-restarts the MCP process.
   - Check port 51023 — **must be listening now**
   - **Race condition warning:** If you only kill the PID on 51023 (not all node processes), the port may not release fast enough. The new MCP starts, sees 51023 still in use, skips the relay, and the viewport stays dead forever (relay check only runs once at startup).
4. Verify port 51022 AND 51023 both free
5. Start octaneServGrpc, wait for port 51022
6. Check `log_serv.log` for startup
7. Wait a few seconds for the project MCP to auto-restart and connect to the new server
8. Start dev server + preview (`preview_start`)
9. `get_octane_version` — verify version + API detection
10. Check `log_mcp.log` — must show `API version:` line AND `Callback streaming started` AND NO `Port 51023 in use`
11. Check `log_grpc.log` — clean startup, no errors
12. Preview screenshot — verify viewport is live (not grey/blank)

Only after all 12 steps pass: proceed to DRESS or SHOW.

### Build Gotchas

| Problem                              | Fix                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `tsc -p mcp/tsconfig.json` OOMs      | **NEVER use tsc for MCP builds.** Use `cd mcp && npm run build` (esbuild, 10ms). |
| MCP server running stale code        | `cd mcp && npm run build`, then `taskkill //F //IM node.exe` + restart           |
| GrpcProxyServer changes not compiled | Always use `npm run build` (full build includes `build:grpc-server` step)        |

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

### Scene Complexity

- **Standard:** Daylight/HDRI env, solid materials, no volumetrics. Use for pipeline tests.
- **Advanced:** Water surfaces, reflective/refractive materials, fog.
- **Very Advanced:** Underwater, volumetric scattering, custom RGB environments, caustics.

For pipeline tests, always use Standard complexity scenes.

---

## Scene Folders

- **Real scenes** → `aigenerated/{scene-name}/` (concept_art.png, recipe.md, scene.orbx, assets/, renders/)
- **Test/smoke scenes** → `temp/` subfolders (disposable, no recipe needed)
- **Renders always go in scene folder** — `aigenerated/{scene}/renders/`, NOT `temp/renders/`

---

## §3 DRESS Protocol

Every step produces a visible change. The human should see a render update within the first 4-5 MCP calls.

**On failure: FULL STOP.** Read the server error message — it tells you exactly what's wrong. Read all 4 log files (`log_serv.log`, `log_grpc.log`, `log_mcp.log`, `log_client.log`). Do not push forward. Fix → verify → then resume.

### ⛔ Autonomous Mode — Mandatory Phase Gates

When running autonomously (multi-scene, unattended), these gates are **non-negotiable**. Each gate HALTS the build if not met. No "I'll do it later" — if you skip a gate, the scene fails.

| Gate   | Check                                                                | If Skipped                                                                          |
| ------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **G0** | `analyze_reference` was called on concept art                        | Scene has no composition data — layout will be random                               |
| **G1** | `set_artistic_intent` was called with preset or vector               | `suggest_lighting`/`suggest_material` have no mood context — values will be generic |
| **G2** | Every mesh ran through `analyze_geo` before `place_geo`              | Orientation will be wrong — wasted iterations                                       |
| **G3** | `critique_render` returned Sonnet grade (not self-critique fallback) | You have no external validation — self-grading is unreliable                        |
| **G4** | `evaluate_semantics` ran at least once per scene                     | No SEGA gap measurement — you can't know what's wrong                               |
| **G5** | Orchestrator (you) read render + concept art at C3                   | Single-critic blind spot — Sonnet misses context you have                           |
| **G6** | `fit_camera` called after every geometry add                         | Camera may not frame all objects                                                    |
| **G7** | Logs checked (all 3 files) after each phase                          | Silent errors accumulate                                                            |

**If `critique_render` returns a self-critique prompt instead of a Sonnet grade:** STOP. Pass `reference_image_path` pointing to concept art. If Sonnet still fails, investigate the error — do NOT self-grade and move on.

**Common autonomous drift patterns (observed failures):**

- Substituting primitives for 3D meshes "to save time" → flat, CG-looking scenes
- Skipping Phase 0/0b "because I know what I want" → no SEGA context, generic lighting
- Running `critique_render` without `reference_image_path` → self-critique fallback, inflated grades
- Batching 3+ objects without intermediate `fit_camera` + render → framing breaks, objects lost
- Optimizing scene count over quality → every scene suffers
- **Skipping creative review** → 3 objects on a floor is never a finished scene. Walls, textures, HDRI = mandatory
- **Concept/scope mismatch** → generating a full-room interior concept then building a product shot. Match concept art to buildable scope.
- **Falling back to manual node wiring** when `place_geo` errors → diagnose the error, don't work around it
- **Soft orchestrator self-critique** → grading your own render D when it's clearly F. Be harsh on framing.
- **No parallel work** → waiting idle during 3-min mesh generation instead of building scene infrastructure

### Pre-Phase: analyze_geo (BLOCKING — before ANY placement)

> **⛔ HARD GATE: Do NOT call `import_geo` on any mesh until `analyze_geo` has run on it.** MCP will warn if you skip this. Placing a mesh without analysis wastes entire iterations on wrong orientation.

Run `analyze_geo` on every mesh asset BEFORE building the scene. This is a pre-pass — no Octane calls in the scene yet.

**Lean 2-pass VLM protocol (default):**

| Pass              | Views                                                  | Mode                              | Purpose                                                                      |
| ----------------- | ------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------- |
| Pass 1 — Diagnose | 3 (front, side, top)                                   | Color clay (mode 2), raw rotation | VLM identifies upright axis + facing direction → maps to rotation correction |
| Pass 2 — Verify   | 2 (front, side) with correction applied, loop up to 4× | Color clay (mode 2)               | VLM confirms correction or requests adjustment                               |
| Hero              | 1 (yaw 22°, elevation 25°)                             | Textured (clay off), tight margin | Reference thumbnail for human review                                         |

- **⚠️ Never skip mugshots.** Every mesh runs the full 2-pass VLM protocol — no exceptions. The `source_endpoint` parameter is deprecated and ignored.
- **Configuration mode:** `analyze_geo(configuration=true)` renders all 8 MUGSHOT_VIEWS as a 4×2 contact sheet and benchmarks every VLM model. Use `benchmark_vlm_models` to rank accuracy.
- **Sidecar:** `.mesh_info.json` v5 — geometry, semantic, source, visual_check (pass1 + pass2 arrays), final_suggestion.
- **Autonomous:** Proceeds without human input. Flags `verified: false` only if Pass 2 fails after 4 attempts.

**Related tools:**

- `place_geo` (Phase 1) — Import + place in one call. Reads sidecar, applies orientation/scale/offset, wires placement→geo group→RT.
- `benchmark_vlm_models` — Score VLM models from configuration runs, set ground truth, rank by accuracy.

```
❌ import_geo("gargoyle.obj") → guess rotation → wrong → waste iterations
✅ analyze_geo("gargoyle.obj") → read sidecar → place_geo or import_geo with correction → correct first try
```

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

**CLAY MODE ON.** Call `set_clay_mode(2)` (color clay) before first render. All Phase 1 renders are clay — no materials, no lighting tuning. The only goal is correct composition: right objects, right framing, right camera. Color clay preserves diffuse textures for better visibility than grey clay (mode 1), which washes out against bright environments.

| Step | Action                                                                                                                                    | Result                                                                                                                                                                                                                                                               |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `create_node(NT_RENDERTARGET)` + `set_clay_mode(2)`                                                                                       | RT handle + clay mode active                                                                                                                                                                                                                                         |
| 2    | Import mesh via `import_geo(file_path)` → placement → geo group → RT `pin_index:3`                                                        | **Object exists**. `import_geo` handles OBJ/GLB, creates mesh+placement+material, returns all handles including transform. Apply `mesh_info` rotation/scale from cached sidecar.                                                                                     |
| 3    | `start_render` → `fit_camera(yaw, elevation, margin)` (auto-frames scene bounds)                                                          | **FIRST VISUAL — human sees something.** `fit_camera` computes camera position from scene bounds. Params: `elevation` (degrees above horizon, default 20), `yaw` (orbit degrees, default 0 = front), `margin` (fraction, default 0.3). No manual camera math needed. |
| 4    | Create environment → `connect_nodes(env, RT, pin_name:"environment")`. Create PT kernel → `connect_nodes(kernel, RT, pin_name:"kernel")`. | Sky appears (but clay mode — no lighting effects yet). Use `NT_KERN_PATHTRACING` (type ID 25).                                                                                                                                                                       |
| 5    | Add remaining scene objects (ground, props) → `fit_camera()` after EACH                                                                   | Verify all objects visible in clay. **GATE: `critique_render` must pass composition before Phase 2.**                                                                                                                                                                |

**Hard rules for Phase 1:**

- **Clay mode stays ON** until `critique_render` passes. `critique_render` warns if clay is off during early iterations.
- **`critique_render` IN CLAY is the gate** — do NOT eyeball the clay render and move on. You MUST call `critique_render` while still in clay mode. **Clay uses a composition-only scale:** Sonnet is told it's a clay render and grades framing/composition only (ignoring materials, lighting, mood). Pass = `composition_match >= 3`. When passed, `framing_verified` is set automatically and the response tells you to proceed to Phase 2. **This gate is enforced mechanically** — you cannot rationalize past a failing composition score.
- **Only `fit_camera`** — NEVER `set_camera` to work around framing problems. If `fit_camera` frames wrong, the geometry is wrong — fix the geometry (position, scale, floor plane size). `set_camera` is for Phase 4 hero shots only.
- **No infinite floor planes.** A floor plane at scale 30 creates 300-unit bounds and makes `fit_camera` useless. Use scene-appropriate ground geometry (hills, platforms) that fits the composition. If you need a ground plane, keep it small (scale ≤ 3x the scene width).
- **No lighting tuning.** Don't touch sundir, turbidity, sun size, or materials. That's Phase 2.
- **Apply `mesh_info` transforms** — every imported mesh must use the rotation/scale from its `.mesh_info.json` sidecar (generated by `analyze_geo`). Never guess orientation.
- **HDRI environment is standard** for art scenes. Use daylight or texture environment only for testing.
- **Primitives via `place_geo`** — ground planes, hills, backdrops, pedestals → `place_geo(type:"primitive", shape:"box")`. Never `analyze_geo`/`place_geo` on a flat quad.

**HDRI Generation (for any scene with concept art):**

1. Generate via OTOY Studio REST API: `POST /r2/otoy-studio/flux-pro/new`
   Prompt: `"360 degree equirectangular panorama, [scene description from concept], high dynamic range, seamless horizon, photorealistic, landscape 16:9"`
2. Poll `status_url` → download result PNG
3. Save to `aigenerated/{scene}/assets/hdri_{scene}.png`
4. Create `NT_ENV_TEXTURE` → create `NT_TEX_IMAGE` with HDRI file → **set sphere projection** on the image texture node → connect texture to env, env to RT environment pin
5. Sphere projection is REQUIRED for equirectangular HDRIs to wrap correctly as a sky dome

### ⛔ Creative Review Pass (MANDATORY before critique)

**After placing all objects but BEFORE running `critique_render`**, stop and ask yourself:

1. **"What else does this scene need?"** — Walls for mounted objects? A backdrop? Environmental context?
2. **"Is anything floating?"** — Objects must be grounded. Mounted objects need a surface behind them.
3. **"Does the floor have character?"** — Textured floor (stone, wood, metal) >> flat grey primitive.
4. **"Is there depth?"** — Foreground/midground/background layers. Not everything on the same Z plane.
5. **"Does the concept art match what I built?"** — If concept shows a room and you built a product shot, either add environment or regenerate a matching concept.

Add 1-3 supporting elements based on answers. THEN run `critique_render`.

### Framing Quality Checklist (verify before ANY critique call)

Read the render image and check:

- [ ] Hero object clearly visible and occupying >15% of frame
- [ ] No objects floating in mid-air (unless intentionally flying)
- [ ] Ground plane visible with shadows
- [ ] All objects within frame bounds (nothing cropped off edges)
- [ ] Camera distance appropriate (not absurdly far back)
- [ ] Scene has visual depth (not all objects on same plane)

If ANY check fails, fix geometry/camera BEFORE running `critique_render`. Don't waste Sonnet calls on obviously broken framing.

```
❌ WRONG Phase 1:
  import_geo → set_camera({manually tweaked}) → eyeball clay render → set_clay_mode(0) → dress

✅ RIGHT Phase 1:
  import_geo → apply mesh_info rotation/scale → fit_camera() → save_render → critique_render (clay)
  → Sonnet grade C+? → YES → set_clay_mode(0) → Phase 2
  → Sonnet grade D/F? → fix geometry → fit_camera() → critique_render again
```

### Phase 2: Materials & Lighting (ONLY after Phase 1 critique passes)

| Step | Action                                                                | Notes                                                     |
| ---- | --------------------------------------------------------------------- | --------------------------------------------------------- |
| 5    | `set_clay_mode(0)` — turn off clay                                    | Materials become visible                                  |
| 6    | `setup_lighting(mood)` — full 3-point + env dim in ONE call           | Reads SEGA intent for temps/ratios. Creates key+fill+rim. |
| 7    | `suggest_material(surface_type)` → apply PBR properties               | Respect .mtl textures — don't override albedo             |
| 8    | Fine-tune: `set_daylight(power, turbidity)` or individual light attrs | Use `create_light` for additional accent/practical lights |
| 9    | Render + save                                                         | Checkpoint                                                |

**Use `setup_lighting` for the full 3-point rig** — it reads SEGA intent, computes positions from subject bounds, creates emissive planes, and dims the environment automatically. Use `create_light` for individual lights (accents, practicals, glowing objects). Use `set_daylight` to adjust environment without pin-chasing. Use `suggest_lighting` only if you need the recipe without creating nodes.

**Ground planes and simple shapes** — use `place_geo(type:"primitive", shape:"plane")`, not `place_geo(type:"mesh")` with OBJ files. Never `analyze_geo` on a flat quad.

### Phase 3: Assembly

For each additional object:

1. `suggest_placement(object_name, bounds)` — get collision-free position from scene placement DB
2. Create mesh → apply analyze_geo rotation → material → placement at suggested position → connect to geo group
3. `register_scene_object(name, position, bounds)` — update scene DB (warns on overlap)
4. `fit_camera()` → render → verify
5. `get_scene_placement_state()` — inspect DB if placement looks wrong

**`fit_camera` after every geometry add or remove.** The camera must always frame the full scene. Each object = a visible change. Never batch multiple objects without `fit_camera` + render between them.

### Phase 4: Polish (hero camera + final beauty)

Hero camera, fine-tune lighting, final beauty pass `save_render`.

**`set_camera` belongs HERE — Phase 4 only.** During Phases 1-3, `fit_camera` handles framing automatically — it shows you the full scene so you can verify every change. Only in Phase 4 do you compose the final hero shot with `set_camera` (or `plan_composition` camera overrides) for the beauty pass. Using `set_camera` earlier bypasses framing validation and masks geometry problems.

### Critique Loop — Dual-Perspective (run after every save_render in Phases 2-4)

**Requires AD.** Skipped when AD is OFF. When skipped, save the render and move on — no scoring, no corrections. **When AD is ON, both critics run every iteration — never skip one.**

| Step | Action                                                           | Result                                          |
| ---- | ---------------------------------------------------------------- | ----------------------------------------------- |
| C1   | `critique_render(render_path, spec_name, reference_image_path?)` | Sonnet concept-vs-render comparison (A-F grade) |
| C2   | `evaluate_semantics(render_path)`                                | Pixel-level intent gap analysis vs SEGA vector  |
| C3   | Read the saved render image + concept art (Read tool)            | Orchestrator visual review — your own A-F grade |

**Orchestrator grade is MANDATORY.** You MUST state your own A-F grade explicitly before proceeding to C4. "I read it and it looks ok" is NOT a grade. State: `"Orchestrator grade: C+. [1 sentence reason]."` This is non-negotiable.

| C4 | Compare both assessments: Sonnet + orchestrator | Dual-assessment synthesis |
| C5 | `apply_corrections(spec_name, scores, corrections)` | Records score, detects stagnation |
| C6 | If score < 3.5 OR Sonnet grade < C: fix top corrections, re-render, go to C1 | Iteration |
| C7 | If stagnating (2 iterations < 0.3 improvement): redesign plan | Plan change, not tweaking |

### Vision Critic — Sonnet + Orchestrator

`critique_render` runs one automated critic (Sonnet), then the orchestrator (you) adds a second:

1. **Sonnet comparison** (Anthropic API, two images) — concept art + render side-by-side. Holistic A-F grade, mood/density/composition match 1-5, missing elements, top fixes. **This is the primary critic.** Grade A or B = pass.
2. **Orchestrator** (you, main Claude context) — read both images yourself at step C3. Give your own A-F grade. Note whether you agree with Sonnet. You have build context Sonnet doesn't.

Both assessments are logged to `critique_stats.jsonl` per scene for system tuning.

**⛔ `reference_image_path` is MANDATORY** when concept art exists. Without it, Sonnet can't compare — the tool falls back to a self-critique prompt. Self-critique is NOT a substitute for Sonnet judgment. If you see a self-critique prompt returned, you made an error: re-call with the correct path. Never grade yourself and move on.

- Vision module: `mcp/src/vision/` — `critiqueWithReference()` (Sonnet two-image comparison)

### Render Status — Don't Blind Sleep, Always Check Samples

After `start_render` or `set_camera`, call `get_render_status` to check `state: "RSTATE_FINISHED"`. Renders typically finish in 2-9s. If still rendering, wait 2s and check again. Don't `sleep 8` and hope — **`sleep 3` then check is the maximum wait**.

**ALWAYS call `get_render_status` before `save_render`** and record the result:

- `resolution` — actual pixel dimensions (e.g. "1024x512")
- `samples` — how many samples accumulated
- `maxSamples` — target sample count
- `renderTime` — wall clock seconds
- `state` — must be `RSTATE_FINISHED` before saving

Log these alongside every saved render for calibration and debugging. A low-res or noisy render is a data quality issue — knowing the sample count explains it.

**Clay verification renders:** Don't wait for full convergence. 10 samples is sufficient for checking object visibility and framing. Call `get_render_status` immediately after `start_render` — don't sleep first. Full sample counts only matter for beauty/critique renders.

**Polling pattern** (do NOT sleep-then-save):

```
start_render(rt_handle)
loop:
  status = get_render_status()
  if status.state == "RSTATE_FINISHED": break
  sleep 2
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
- **Primitive type changes work** — all 23 types tested (values 1-23). NT_GEO_MESH with .obj files is still recommended for production quality geometry.
- **connect/disconnect auto-flush** — `connect_nodes` and `disconnect_pin` auto-flush `ApiChangeManager::update()`. No manual `flush_changes` needed between connection changes.

Primitive values: see `REFERENCE.md` §7a.

---

## §6 Camera Workflow

**`fit_camera(yaw, elevation, margin)` handles 90% of camera needs.** Use it after every geometry change. For hero shots in Phase 4, use `set_camera(position, target)` or `plan_composition` for precise framing.

### 3D Asset Orientation

Generated meshes have unknown orientation. **Never guess — use `analyze_geo`** for reliable orientation via VLM mugshot. OTOY Studio GLBs are Z-up → rotate +90° on X. Set film aspect BEFORE framing.

### Manual Camera Math (rare — only when fit_camera insufficient)

`D_z = W * 0.662` (subject width to distance, 15% margin). Proven tabletop: {0, 4.2, 7.5} → {0, 0, 0}, 29°. Pull-back debug: {0, 5, 20} → {0, 0, 0}. Always verify with render.

---

## §7 Scene Clear (FRESH)

Two separate clear operations — Octane scene vs AD state:

1. `reset_ad(confirm: true)` — clears all AD state: specs, SEGA vector, scores, placement DB. Does NOT touch Octane.
2. `reset_project()` — clears the Octane scene, invalidates all handles. Does NOT touch AD state.
3. Verify: `get_scene_tree` → count: 0, `get_art_direction_state` → specs: []

**For a new scene build, call both:** `reset_ad` first (clear stale AD from previous scene), then `reset_project` (clear Octane scene). Order matters — `reset_project` triggers `clearScene()` which preserves AD specs/SEGA, so calling `reset_ad` after would be needed anyway.

**⚠️ `reset_project` preserves AD state intentionally** — specs and SEGA vector survive so you can rebuild the same scene. If you want a completely fresh start for a different scene, you MUST call `reset_ad` explicitly.

**⚠️ MCP restart wipes all in-memory state** — killing node.exe destroys AD state, SEGA vector, placement DB. After MCP restart, all AD state starts empty. This is expected — `reset_ad` is for clearing stale state within a running session.

**FRESH vs SCRATCH vs MINIS:**

- **FRESH** — `reset_ad` + `reset_project` clears everything. Every new scene starts with FRESH.
- **SCRATCH** — Kill all processes, restart everything. Required after MCP restart or infra changes.
- **MINIS** — `load_project("ORBX/smoketest.orbx")` loads a pre-built smoke test scene. Quick validation that Octane + MCP are working without building from scratch.

---

## §8 3D Asset Pipeline

**Generate concept:** `generate_image_pro` → reference image (save to `aigenerated/{scene}/concept_art.png`)

**Generate mesh** via queue API (`que.otoy.studio`, requires `OTOY_API_KEY` in env):

```
POST https://que.otoy.studio/r2/otoy-studio/hunyuan-3d/v3.1/pro/image-to-3d
Headers: ai: {OTOY_API_KEY}, X-Signed-URL: 3600, Content-Type: application/json
Body: { "input_image_url": "<url>", "enable_pbr": true }
```

Response: `request_id` + `status_url` + `response_url`. Poll `status_url` until `COMPLETED` (~2-3 min). Fetch `response_url` → pre-signed download URLs for OBJ, MTL, textures, thumbnail.

**Or use CLI:** `otoy-studio-auth image-to-3d <image-url> --output-dir aigenerated/{scene}/meshes/`

**28 image-to-3d models available** — `hunyuan-3d/v3.1/pro/image-to-3d` is default (best quality + PBR). Full list: `curl https://que.otoy.studio/api/endpoints?category=image-to-3d`

**Load in Octane:**

1. `analyze_geo(obj_path)` — mandatory, full VLM mugshot verification. Do NOT pass `source_endpoint`.
2. `place_geo(obj_path, position, role)` — preferred, reads sidecar, applies transforms, wires to geo group + RT in one call
3. `fit_camera` after each placement

**⚠️ `place_geo` troubleshooting:**

- **"pin index 0 out of range (pinCount is 0)"** — geo group exists but has no pins. Ensure RT is created first and geo group is connected to RT pin 3 BEFORE calling `place_geo`. The tool needs an existing RT+geo group chain.
- **If `place_geo` fails, diagnose the error.** Don't fall back to manual `create_node(NT_GEO_MESH)` + `set_attribute(A_FILENAME)` + `create_node(NT_GEO_PLACEMENT)` + manual transform + manual connections. That path skips sidecar transforms and is error-prone.

**Parallel work during mesh generation (~3 min):**
While image-to-3D jobs are processing, build scene infrastructure:

- Create RT + PT kernel + connect
- Create and configure environment (HDRI or daylight)
- Create and position ground plane with material
- Set up `preview_screenshot` so user sees progress
- Set artistic intent (if not done)

### Texture Prompt Templates

**Diffuse:** `[material] surface, seamless tileable texture, flat orthographic top-down material scan, evenly lit diffuse studio lighting, no shadows no highlights no reflections, PBR albedo map, photorealistic, square 1:1`

**Environment:** `360 degree equirectangular panorama, [scene], high dynamic range, seamless horizon, photorealistic, landscape 16:9`
