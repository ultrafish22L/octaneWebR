## v2.4.1

Known issues: Connection LED false-green when offline, LiveDB disabled.

---

## Docs (read only what you need)

| Task                | Read                                                  |
| ------------------- | ----------------------------------------------------- |
| AD concepts         | `docs/ADSYSTEM.md`                                    |
| Scene building      | `docs/mcp/BUILD.md` + `docs/mcp/REFERENCE.md`         |
| Aesthetics/lighting | `docs/mcp/CREATIVE.md`                                |
| SEGA/mood           | `docs/project/SEGA_SYSTEM_DESIGN.md`                  |
| Debugging           | `docs/mcp/TROUBLESHOOTING.md`                         |
| MCP server dev      | `docs/mcp/README.md` + `docs/project/ARCHITECTURE.md` |
| UI changes          | `docs/ui/UI_IMPLEMENTATION.md`                        |
| Render pipeline     | `docs/RENDER_PIPE.md`                                 |
| Alpha 5 compat      | `docs/mcp/ALPHA5_COMPAT.md`                           |

---

## Startup

1. `octaneServGrpc/build/Release/octaneServGrpc.exe` (wait ~6s, port 51022)
2. `preview_start("octaneWebR")` — **immediately after serv, before anything else**
3. `get_octane_version()` — verify mcp_build + serv_build

## Scene Building Phases

**Phase 0 — Plan** (no Octane calls)

1. `analyze_mesh` on EVERY OBJ — **BLOCKING.** Renders 6 mugshots (front/right/top × clay/textured), VLM verifies orientation. Cached in `.mesh_info.json` sidecar. **Do NOT skip. Do NOT import a mesh you haven't analyzed.**
2. `analyze_reference(concept_art)` → extract composition from reference image
3. `plan_composition` → validated layout → then `validate_layout` → gate: 0 errors before building
4. `suggest_placement` for each object → collision-free positions

**Phase 1 — Frame** (geometry + camera in CLAY MODE)

5. `set_clay_mode(1)` → Build RT → `import_geo(file_path)` → apply mesh_info rotation/scale from sidecar → `start_render`. **Read `BUILD.md` Phase 1 for wiring details.**
6. `fit_camera()` → `save_render` + `preview_screenshot` → verify framing visually
7. Place remaining objects → `fit_camera()` after EACH → `register_scene_object` for each
8. **GATE: `critique_render` IN CLAY MODE must score framing ≥ 3. Do NOT call `set_clay_mode(0)` until this passes. Do NOT touch lighting or materials. Clay stays ON until the gate passes.**

> **⛔ `set_camera` is FORBIDDEN in Phase 1.** Use only `fit_camera`. If framing is wrong, the geometry is wrong (bad position, bad scale, oversized floor plane). Fix the geometry, don't hack the camera. `set_camera` is Phase 4 only (hero shot).

**Phase 2 — Dress** (materials, lighting, mood — ONLY after Phase 1 gate passes)

9. `set_clay_mode(0)` → `set_artistic_intent` (preset or NL from recipe mood)
10. `suggest_lighting` → apply lighting setup (uses SEGA intent — don't manually poke sundir)
11. `suggest_material` → apply PBR properties. **TEXTURE RULE: if mesh has .mtl textures, do NOT override albedo — only apply roughness/metallic/specular/IOR.**
12. Environment setup (HDRI or sky)

**Phase 3 — Critique** (ITERATE — do not run once and stop)

13. `critique_render` + `semantic_critique` — framing score must be ≥3 or critique returns FRAMING FAILURE
14. If framing < 3 → go back to Phase 1 (fix camera, not lighting)
15. `apply_corrections` → fix worst dimension → re-render → `critique_render` again
16. If `semantic_critique` shows gaps → `adjust_artistic_intent` to close them → re-render
17. **LOOP 15-16 until passed=true or exhausted=true. Do NOT stop after one critique.**
18. Save .orbx at milestones.

### Hard Rules

- **`analyze_mesh` BEFORE `import_geo`** — NEVER import a mesh without analyzing it first. Mugshots (6 views: front/right/top × clay/textured) reveal orientation. Without them you are guessing rotation and wasting iterations. MCP will warn if you skip this.
- **Visual verify EVERY mutation** — `save_render` (engine truth) + `preview_screenshot` (user viewport), COMPARE both. No exceptions.
- **Clay mode for Phase 1** — `set_clay_mode(1)` before first render. Keep clay ON until `critique_render` composition passes. No lighting/material work in clay.
- **`critique_render` IN CLAY before Phase 2** — run `critique_render` while still in clay mode. Gate: framing ≥ 3. If it fails, fix geometry/camera in clay. Do NOT turn off clay and "hope lighting fixes it."
- **`fit_camera()` only in Phase 1** — NEVER `set_camera` to work around framing problems. If `fit_camera` frames wrong, the geometry is wrong (bad position, bad scale, oversized floor plane). Fix the geometry. `set_camera` is Phase 4 only (hero shot).
- **No infinite floor planes** — floor at scale 30 = 300-unit bounds = useless `fit_camera`. Keep ground geometry scene-sized (≤3x scene width).
- **`fit_camera()`** after every geo placement — only way to verify all geo visible
- **Framing before aesthetics** — never adjust lighting/mood until camera framing is confirmed via `critique_render` in clay
- **Use `suggest_lighting`/`suggest_material`** — don't manually poke sundir children or material pin floats. The suggest tools use SEGA intent.
- **Preserve mesh textures** — if OBJ has .mtl + .png textures, do NOT replace albedo with flat colors. `suggest_material` albedo is for untextured meshes only.
- **Critique loop ITERATES** — run critique_render → apply_corrections → fix → re-render → critique_render again. Do NOT stop after one critique. Loop until passed=true or exhausted=true.
- **`semantic_critique`** alongside `critique_render` — if gaps found, call `adjust_artistic_intent` to close them
- **Never build without preview running**
- **Renders go in scene folder** — `aigenerated/{scene}/renders/`, NOT `temp/renders/`

### ❌ WRONG vs ✅ RIGHT

```
❌ import_geo("gargoyle.obj") → set transforms from recipe → eyeball clay → set_clay_mode(0) → dress
✅ analyze_mesh("gargoyle.obj") → read mesh_info.json → import_geo → apply mesh_info rotation/scale → fit_camera → critique_render (clay) → gate ≥ 3 → set_clay_mode(0) → dress

❌ set_camera({...}) to fix framing in Phase 1
✅ fit_camera() — if framing wrong, fix geometry (position/scale/floor plane size)

❌ critique_render once → "3.0, stagnating" → save and move on
✅ critique_render → apply_corrections → fix worst dimension → re-render → critique_render → loop until passed=true or exhausted=true
```

---

## Tools

### Mesh Placement (run BEFORE building scene)

| Tool                        | What                                                   |
| --------------------------- | ------------------------------------------------------ |
| `analyze_mesh`              | Bounds + orientation + VLM mugshot. Cached v2 sidecar. |
| `suggest_placement`         | Collision-free position given scene DB. Advisory.      |
| `register_scene_object`     | Update scene DB after placing. Warns on overlap.       |
| `get_scene_placement_state` | Inspect DB + warnings.                                 |

### AD Composition

| Tool                      | What                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| `plan_composition`        | Spatial layout + camera math (Phase 0)                             |
| `validate_layout`         | Frustum, depth, proximity, grid checks                             |
| `analyze_reference`       | Extract composition from reference image                           |
| `critique_render`         | Vision model scores (framing/depth/composition/lighting/placement) |
| `apply_corrections`       | Record scores, detect stagnation                                   |
| `semantic_critique`       | Pixel-level render vs intent gap analysis                          |
| `get_art_direction_state` | Inspect specs, score history, stagnation status                    |

### SEGA (Semantic Intent — 15 dimensions)

| Tool                     | What                                               |
| ------------------------ | -------------------------------------------------- |
| `set_artistic_intent`    | Mood via preset, vector, or natural language.      |
| `adjust_artistic_intent` | Fine-tune one dimension at a time                  |
| `get_artistic_intent`    | Read current semantic vector + resolved parameters |

### Creative Suggestions

| Tool               | What                                          |
| ------------------ | --------------------------------------------- |
| `suggest_lighting` | 3-point recipe from mood + bounds (use first) |
| `suggest_material` | PBR values for 28+ surface types (use first)  |

---

## Project Structure

- **Real scenes** → `aigenerated/{scene-name}/` (concept art, recipe, assets, renders, .orbx)
- **Test/smoke scenes** → `temp/` subfolders (disposable, no recipe needed)

```
aigenerated/scene-name/
  concept_art.png    recipe.md    scene.orbx
  assets/            temp/        renders/
```

## Build & Debug

> **⛔ NEVER run `tsc` or `tsc --noEmit` — it OOMs on this project (4GB heap exhaustion). Build and verify with `npm run build` (esbuild) ONLY.**

| Command                   | What                                               |
| ------------------------- | -------------------------------------------------- |
| `cd mcp && npm run build` | MCP server build (esbuild) — **THE build command** |
| `npm test` (root)         | Run all tests (vitest, 277 tests)                  |
| `npm run lint` (root)     | ESLint client code                                 |

- **Version bump:** `MCP_BUILD` in `mcp/src/tools/info.ts` → rebuild → kill node.exe → verify `get_octane_version()`
- **MCP log:** `log_mcp.log` — use `clear_log` before test runs
- **SCRATCH:** kill all → restart serv → preview → reset_project. Full: `TROUBLESHOOTING.md` §SCRATCH
- **Viewport grey?** Stale `.js` in `mcp/src/`, wrong mcp_build, or CallbackStreamManager

### gRPC API (for MCP server development only)

| Service          | Method           | Key Fields                                             |
| ---------------- | ---------------- | ------------------------------------------------------ |
| ApiItem          | setValueByAttrID | objectPtr (type=16), attribute_id, \*\_value, evaluate |
| ApiNode          | create           | type, ownerGraph (type=20), configurePins              |
| ApiNode          | connectToIx      | objectPtr (17), **pinIdx**, sourceNode, evaluate       |
| ApiNode          | connectedNodeIx  | objectPtr (17), **pinIx**, enterWrapperNode            |
| LiveLink         | SetCamera        | position, target, up                                   |
| ApiRenderEngine  | getSceneBounds   | → bboxMin, bboxMax                                     |
| ApiRenderEngine  | setClayMode      | mode (0/1/2)                                           |
| ApiRenderEngine  | saveImage1       | renderPassId, fullPath, imageSaveFormat                |
| ApiChangeManager | update           | flush pending changes                                  |

**`connectToIx` = pinIdx. `connectedNodeIx` = pinIx.** Different fields.
