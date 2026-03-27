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

1. `generate_image` → concept art (source of truth)
2. `analyze_reference(concept_art)` → recipe.md (objects, positions, scales, lighting)
3. `analyze_mesh` on each OBJ (pre-pass, orientation + bounds via VLM mugshot)
4. `plan_composition` → validated layout → then `validate_layout` to confirm geometry
5. `suggest_placement` for each object → collision-free positions

**Phase 1 — Frame** (geometry + camera ONLY) 6. Build RT → first mesh + loud material `{1,0,0}` → `start_render`. **Read `BUILD.md` Phase 1 for wiring details.** 7. `fit_camera()` → `save_render` + `preview_screenshot` → verify framing visually 8. Place remaining objects → `fit_camera()` after EACH → `register_scene_object` for each 9. **GATE: render + verify ALL objects visible and properly framed. Do NOT proceed to Phase 2 until framing is correct.**

**Phase 2 — Dress** (materials, lighting, mood — ONLY after Phase 1 gate passes) 10. `set_artistic_intent` (preset or NL from recipe mood) 11. `suggest_lighting` → build lights (depends on camera-subject geometry from Phase 1) 12. `suggest_material` → apply PBR properties. **TEXTURE RULE: if mesh has .mtl textures, do NOT override albedo — only apply roughness/metallic/specular/IOR.** 13. Environment setup (HDRI or sky)

**Phase 3 — Critique** (ITERATE — do not run once and stop) 14. `critique_render` + `semantic_critique` — framing score must be ≥3 or critique returns FRAMING FAILURE 15. If framing < 3 → go back to Phase 1 (fix camera, not lighting) 16. `apply_corrections` → fix worst dimension → re-render → `critique_render` again 17. If `semantic_critique` shows gaps → `adjust_artistic_intent` to close them → re-render 18. **LOOP 16-17 until passed=true or exhausted=true. Do NOT stop after one critique.** 19. Save .orbx at milestones.

### Hard Rules

- **Visual verify EVERY mutation** — `save_render` (engine truth) + `preview_screenshot` (user viewport), COMPARE both. No exceptions.
- **`fit_camera()`** after every geo placement — only way to verify all geo visible
- **Framing before aesthetics** — never adjust lighting/mood until camera framing is confirmed
- **Preserve mesh textures** — if OBJ has .mtl + .png textures, do NOT replace albedo with flat colors. `suggest_material` albedo is for untextured meshes only.
- **Critique loop ITERATES** — run critique_render → apply_corrections → fix → re-render → critique_render again. Do NOT stop after one critique. Loop until passed=true or exhausted=true.
- **`semantic_critique`** alongside `critique_render` — if gaps found, call `adjust_artistic_intent` to close them
- **Never build without preview running**
- **Renders go in scene folder** — `aigenerated/{scene}/renders/`, NOT `temp/renders/`

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

| Command                      | What                              |
| ---------------------------- | --------------------------------- |
| `cd mcp && npm run build`    | MCP server build (esbuild)        |
| `npm test` (root)            | Run all tests (vitest, 277 tests) |
| `npm run lint` (root)        | ESLint client code                |
| `npx tsc --noEmit` (root)    | Type-check server + vite plugin   |
| `cd mcp && npx tsc --noEmit` | Type-check MCP server             |

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
