## v2.4.1

All temp files go in `temp/`. Never pollute project root.

Known issues: Connection LED false-green when offline, ECONNREFUSED spam on startup, LiveDB disabled.

---

## Read These Docs

- **Scene builds** → read `docs/mcp/BUILD.md` (phases + wiring) + `docs/mcp/REFERENCE.md` §1-§5 (values)
- **Aesthetics** → `docs/mcp/CREATIVE.md` (lighting, composition) — `suggest_lighting`/`suggest_material` tools handle most of this automatically
- **SEGA intent** → `docs/project/SEGA_SYSTEM_DESIGN.md` for dimension details
- **Debugging** → `docs/mcp/TROUBLESHOOTING.md`

---

## Startup

1. `octaneServGrpc/build/Release/octaneServGrpc.exe` (wait ~6s, port 51022)
2. `preview_start("octaneWebR")` — **immediately after serv, before anything else**
3. `get_octane_version()` — verify mcp_build + serv_build

## Scene Building

1. **Concept art first** — `generate_image` → source of truth
2. **recipe.md** — from `analyze_reference(concept_art)`. Objects, positions, scales, lighting.
3. **`set_artistic_intent`** — from recipe mood. Presets: `dramatic`, `ethereal`, `natural`, `studio`, `noir`, `golden_hour`, `moonlit`, `vermeer`, `caravaggio`, `kubrick`, `villeneuve`, or any natural language description.
4. **analyze_mesh** on each OBJ (pre-pass, orientation + bounds via VLM mugshot)
5. Build RT → first mesh + loud material `{1,0,0}` → `start_render` → `fit_camera()` → environment. **Read `BUILD.md` Phase 1 for wiring details.**
6. Place objects using `suggest_placement` + recipe. **`fit_camera()` after EVERY placement.**
7. `register_scene_object` after each placement
8. Render → `save_render` → critique loop: `critique_render` + `semantic_critique` → `apply_corrections` (never skip in DRESS/SHOW, stop when exhausted)
9. Save .orbx at milestones

### Hard Rules

- **`fit_camera()`** after every geo placement — only way to verify all geo visible
- **AD critique on every scene** in DRESS/SHOW — never skip. When exhausted → move on.
- **`semantic_critique`** alongside `critique_render` for dual perspective
- **Never build without preview running**
- **Renders go in scene folder** — `aigenerated/{scene}/renders/`, NOT `temp/renders/` (temp is for smoke tests only)

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

Reference: `aigenerated/mycelium-court/recipe.md`.

```
aigenerated/scene-name/
  concept_art.png    recipe.md    scene.orbx
  assets/            temp/        renders/
```

## Build & Debug

- **MCP build:** `cd mcp && npm run build` (esbuild)
- **Version check (after MCP code changes):** Bump `MCP_BUILD` in `mcp/src/tools/info.ts`, rebuild, kill node.exe, verify `get_octane_version()` mcp_build matches
- **MCP log:** `log_mcp.log` — use `clear_log` before test runs
- **SCRATCH:** kill all → restart serv → preview → reset_project. Full protocol: `TROUBLESHOOTING.md` §SCRATCH
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
