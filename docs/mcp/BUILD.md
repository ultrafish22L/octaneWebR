# Octane Build Guide

How to construct scenes via MCP. For values, see `REFERENCE.md`. For problems, see `TROUBLESHOOTING.md`.

---

## §1 Core Principle: Human View First

**A human is watching.** Get an interesting render on screen as fast as possible. Every MCP call should be driving toward the first visible result. Don't build backstage — build on stage.

**Priority order:** RT → `set_camera` to known good frame → first geometry + material wired to RT → `start_render` → contrasting environment. Set camera BEFORE connecting geometry so the object appears framed instantly. Everything else comes after the human has something to look at.

**Check Octane is running** before every build. If gRPC is down, nothing works and the human sees nothing. Verify with `powershell -Command "Get-NetTCPConnection -LocalPort 51022"`.

---

## §2 Build Modes

**SCRATCH (Clean Start):** Kill everything, restart fresh. Required before any clean test run.

1. Kill all Octane processes (`taskkill //F //IM octane.exe`, `taskkill //F //IM octaneServGrpc.exe`)
2. Stop preview server (`preview_stop`)
3. Reset MCP (must fully kill, not just disconnect):
   - `taskkill //F //IM node.exe` — kill ALL node processes. The relay port check only runs at MCP startup, so a reconnect won't fix a missed relay.
   - Wait 3 seconds for ports to release
   - Verify port 51023 is free: `powershell Get-NetTCPConnection -LocalPort 51023` — must return empty
   - Trigger MCP restart: call any MCP tool (e.g. `get_octane_version`). Claude auto-restarts the MCP process.
   - Check port 51023 again — **must be listening now**
   - **If it came back** → project-level MCP auto-restarted with relay, move on
   - **If still free** → no project MCP configured, start one: `cd octaneWebR/mcp && node dist/index.js`
   - **NEVER start a second MCP** if one is already running. That creates duplicate processes and breaks the relay.
   - **Race condition warning:** If you only kill the PID on 51023 (not all node processes), the port may not release fast enough. The new MCP starts, sees 51023 still in use, skips the relay, and the viewport stays dead forever (relay check only runs once at startup).
4. Verify port 51022 AND 51023 both free
5. Start the target server (octaneServGrpc or octane.exe), wait for port 51022
6. Check `log_serv.log` for startup
7. Wait a few seconds for the project MCP to auto-restart and connect to the new server
8. Start dev server + preview (`preview_start`)
9. `get_octane_version` — verify version + API detection
10. Check `log_mcp.log` — must show `API version:` line AND `Callback streaming started` AND NO `Port 51023 in use`
11. Check `log_grpc.log` — clean startup, no errors
12. Preview screenshot — verify viewport is live (not grey/blank)

Only after all 12 steps pass: proceed to DRESS or SHOW.

**Why port 51023 matters:** The MCP relay streams render images to the web UI over WebSocket on port 51023. If a stale MCP process holds that port, the new MCP silently skips the relay and the viewport stays dead. The octane MCP is registered in the **project-level** `.mcp.json` (`C:\otoyla\dev\.mcp.json`) — Claude auto-starts and auto-restarts it when working in this directory. Killing it is safe. Starting a second one in bash is not.

**DRESS (Rehearsal):** 1 object at a time, render after each step, hero camera from the start. Stop on any failure — debug, fix, verify, then resume. This is the working mode for development and testing. **Default — use unless told otherwise.**

**SHOW (Performance):** Same DRESS build order, but no stopping. Smooth, continuous flow for live demos and VIP audiences. If something breaks mid-show, skip it and keep going — fix it later. Never debug in front of an audience.

---

## §3 DRESS Protocol

Every step produces a visible change. The human should see a render update within the first 4-5 MCP calls.

**On failure: FULL STOP.** Follow MEMORY.md crash protocol. Do not push forward. Do not try "one more thing." Fix → verify → then resume. Stopping is the point — DRESS is where you catch and fix problems.

### Phase 0: Composition Planning (before any Octane calls)

Run BEFORE creating any nodes. Pure math — validates layout without touching Octane.

| Step | Action                                                                          | Result                                                                          |
| ---- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 0a   | `analyze_reference(image_path, description)` — if ref image provided            | Structured extraction prompt. Read image + answer prompt → scene data           |
| 0b   | `plan_composition(name, objects, camera, focal_point)`                          | CompositionSpec with computed camera math + auto-validation                     |
| 0c   | `validate_layout(spec_name)` — if plan_composition auto-validation had warnings | Detailed geometric checks: frustum, depth separation, proximity, grid alignment |
| 0d   | Fix any validation errors, re-run plan_composition                              | Clean validated spec                                                            |

**Hard gate:** Do NOT call `create_node` until `validate_layout` passes with 0 errors.

### Critique Loop (after every save_render)

| Step | Action                                                            | Result                                            |
| ---- | ----------------------------------------------------------------- | ------------------------------------------------- |
| C1   | `critique_render(render_path, spec_name)`                         | Saves render + returns structured critique prompt |
| C2   | Read the saved render image (Read tool)                           | Visual analysis                                   |
| C3   | Answer the critique prompt → JSON with 5 dimension scores         | Structured evaluation                             |
| C4   | `apply_corrections(spec_name, scores, corrections)`               | Records score, detects stagnation                 |
| C5   | If score < 3.5: apply priority-1 corrections, re-render, go to C1 | Iteration                                         |
| C6   | If stagnating (2 iterations < 0.3 improvement): redesign plan     | Plan change, not tweaking                         |

### Vision Critic

`critique_render` uses an external vision model (Anthropic Haiku 4.5 via `ANTHROPIC_CLAUDE_KEY` env var in `.mcp.json`) for render quality assessment. **Self-critique is unreliable** — Claude rating its own renders inflates scores by 1-2 points because it's judging its own work.

- **Two-image comparison** (reference + render) is most effective — harder to inflate when the diff is visible
- **Standalone critique** (render only) is still too generous — Haiku called a mediocre scene "enchanting"
- Vision module: `mcp/src/vision/` with `anthropic.ts`, `gemini.ts`, `index.ts` (fallback chain), `prompts.ts`
- `maxTokens` must be ≥4000 for `analyze_reference` (1500 truncates structured JSON)
- Truncation-resilient JSON parsing added: closes unclosed brackets/braces

### Phase 1: First Visual (get render on screen ASAP)

| Step | Action                                                                                                                                                                 | Result                                                                                                                                                                                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `create_node(NT_RENDERTARGET)`                                                                                                                                         | RT handle + pin handles                                                                                                                                                                                                                                                      |
| 2    | `set_camera(position:{0,1.5,4}, target:{0,0,0})`                                                                                                                       | Camera ready BEFORE geo — known good wide frame, slightly elevated, off-center Z. Adjust target to geo centroid if not at origin.                                                                                                                                            |
| 3    | Create first mesh (NT_GEO_MESH + .obj) + LOUD material `{1,0,0}` → placement → geo group → RT `pin_index:3`                                                            | **Object exists**. Use NT_GEO_MESH (not NT_GEO_OBJECT — primitive type changes crash). Only `sphere_hd.obj` and `floor.obj` available. **Must follow mesh loading pattern** — see `REFERENCE.md` §1 File Loading Pattern. Verify with `get_geometry_stats()` (triCount > 0). |
| 4    | `start_render` + `set_camera` again (triggers geo eval)                                                                                                                | **FIRST VISUAL — human sees something**                                                                                                                                                                                                                                      |
| 5    | Create environment → `connect_nodes(env, RT, pin_index:1)`. **Do not** call `get_node_info` on env children immediately after connecting — wait or sequence carefully. | Sky + lighting appear                                                                                                                                                                                                                                                        |
| 6    | Disable DOF: RT→pin0→camera→pin14→aperture→`set_attribute(child, 185, 9, 0)`                                                                                           | Sharp render                                                                                                                                                                                                                                                                 |

### Phase 2: Materials & Lighting

| Step | Action                                                    | Notes                              |
| ---- | --------------------------------------------------------- | ---------------------------------- |
| 7    | Swap loud material for real material                      | Gold, glass, etc. — visible change |
| 8    | Create PT kernel → `connect_nodes(kernel, RT, pin_id:89)` | Better render quality              |
| 9    | Tune environment (sunset hour, turbidity, etc.)           | Mood change visible immediately    |
| 10   | Render + save                                             | Checkpoint                         |

### Phase 3: Assembly

For each additional object: create mesh → material → placement → connect to geo group `pin_index: N` → `set_camera` → render → verify.

Each object = a visible change. Never batch multiple objects without rendering between them.

### Phase 4: Polish

Floor, fine-tune lighting, hero camera, final `save_render`.

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

### GLB Texture Extraction

trimesh OBJ export strips baked textures. Extract baseColorTexture as PNG immediately after conversion:

```python
scene.geometry[name].visual.material.baseColorTexture.save('name_diffuse.png')
```

Apply as NT_TEX_IMAGE on material albedo pin.

---

## §4 Setup Order Variants

**Demos (Hero Camera First):** Set final camera BEFORE creating objects. Objects pop into the composed frame.

**Iteration (Wide Camera First):** Start wide (y=2-3, z=5-8), zoom to hero after objects placed.

**Space Scenes (Light First):** No env light → create key light BEFORE geometry or first render is black.

---

## §5 NT_GEO_OBJECT Variant

Primitive shapes — no .obj file needed. Key differences from NT_GEO_MESH:

- **Material pin:** `pin_index: 1` (not 0). Pin 0 is primitive type enum.
- **Transform pin:** Pin 3 (NT_TRANSFORM_VALUE).
- **Auto-wrapping:** Connecting to RT pin 3 auto-creates placement chain. No manual group needed for single objects.
- **Multi-object:** Create NT_GEO_GROUP, connect each geo to group pins (0, 1, 2...), connect group to RT pin_index:3.
- **Primitive type change is UNSAFE** — non-deterministic ECONNRESET crash. Use NT_GEO_MESH with .obj files for non-box geometry. Only `sphere_hd.obj` and `floor.obj` are available in `ORBX/assets_test/`.
- **Silent death during connect chains** — Octane can die silently during rapid state mutations even when all calls report success. Check Octane is alive before `start_render`.

Primitive values: Box=1, Sphere=20, Torus=22, Cylinder=4, Cone=3 (full list in `REFERENCE.md`).

---

## §6 Camera Workflow

### Pull-Back Rule

Always pull camera WAY back first to see full scene. When lost: Z=50+, verify positions, then zoom in.

### Target Trick

Set `set_camera(target: centroid)`. Camera orbits that point. Derive distance from bounding box extents + FOV — don't guess.

### Single-Mesh Framing (8 steps)

1. Zero all mesh transforms
2. Compute mesh centroid from OBJ bounding box
3. Set camera target to centroid
4. **Set up vector = (0,1,0)** — default (0,0,0) silently breaks orientation
5. Back camera way out — full mesh visible
6. Orbit up slightly (raise Y)
7. Fine-tune target
8. Zoom in (reduce distance)

### 3D Asset Orientation

Generated meshes have unknown orientation. **Never guess — orbit to discover:**

1. Back camera WAY out (8-10 units)
2. Render 3 views: front (0,Y,+Z), right (+X,Y,0), top (0,+Y,+Z small)
3. Determine: which axis is up, facing direction, base location
4. Fix with rotation on the MODEL (`A_ROTATION=137`), never flip camera up

- OTOY Studio GLB exports are Z-up → rotate +90° on X
- Set film aspect BEFORE framing — changing after invalidates composition

### Camera Math (Calibrated v2)

| Parameter           | Value            |
| ------------------- | ---------------- |
| Horizontal half-FOV | ~41° (tan=0.869) |
| Vertical half-FOV   | ~24° (tan=0.445) |

```
D_z = (W/2 * 1.15) / tan(41) = W * 0.662    # distance for W-unit-wide subject with 15% margin
Y = target_Y + D_z * tan(elevation)
```

**Proven tabletop frame:** Position {0, 4.2, 7.5}, target {0, 0, 0}, elevation 29°.

**Rule:** Start at 1.5x computed distance, inch forward. Always verify with render.

---

## §7 Scene Clear

`reset_project` triggers save dialog. Instead:

1. `get_scene_tree(max_depth: 1)`
2. `delete_node` each handle — leaves first, RT last
3. Verify: `get_scene_tree` → count: 0

---

## §8 3D Asset Pipeline

**CRITICAL:** The only working domain is `https://otoy.studio/` (NOT `studio.otoy.com`). Navigate to `https://otoy.studio/image-to-3d` for 3D mesh generation. Never click upload buttons (pops OS file dialog) — use "USE URL" toggle + `request_upload_url` instead.

**Generate:** `generate_image_pro` → reference image → OTOY Studio image-to-3D (Chrome UI) → GLB

**Convert:** Python trimesh: `trimesh.load(glb)` → `export('name.obj')` → OBJ + MTL + diffuse PNG

**Load in Octane:**

1. `NT_GEO_MESH` + `A_FILENAME=34` + `A_RELOAD=124`
2. `NT_GEO_PLACEMENT` → connect mesh via `pin_name: "geometry"`
3. `NT_MAT_UNIVERSAL` + `NT_TEX_IMAGE` (diffuse PNG) → mesh `pin_index: 0`
4. Placement → geo group → RT

**Orient:** Set film aspect first → orbit 3 views → fix rotation → scale 2-3x → frame hero shot.

OTOY Studio tools available via `mcp__otoy-studio__*`. **3D mesh generation** (Rodin/Hunyuan) requires Chrome MCP — no API exists.

### Texture Prompt Templates

**Diffuse:** `[material] surface, seamless tileable texture, flat orthographic top-down material scan, evenly lit diffuse studio lighting, no shadows no highlights no reflections, PBR albedo map, photorealistic, square 1:1`

**Environment:** `360 degree equirectangular panorama, [scene], high dynamic range, seamless horizon, photorealistic, landscape 16:9`
