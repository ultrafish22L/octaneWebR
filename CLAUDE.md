## v2.4.1

### Known Issues

1. Connection LED shows green when Octane offline
2. Console spam: 136+ ECONNREFUSED on startup
3. LiveDB disabled (gRPC "invalid pointer type" bug)

All temp files go in `temp/`. Never pollute project root.

---

## Rules

### Version Checking (MANDATORY after code changes)

1. Bump `MCP_BUILD` in `mcp/src/tools/info.ts`
2. `cd mcp && npm run build`
3. Kill node.exe (Claude auto-restarts MCP)
4. `get_octane_version()` — **mcp_build must match**

If mismatch: check for stale `.js` shadowing `.ts` in `mcp/src/`, or MCP not restarted.

### Startup

1. `octaneServGrpc/build/Release/octaneServGrpc.exe` (wait ~6s, port 51022)
2. `preview_start("octaneWebR")` — **immediately after serv, before anything else**
3. `get_octane_version()` — verify mcp_build + serv_build

### Scene Building

1. **Concept art first** — `generate_image` → source of truth
2. **recipe.md** — from `analyze_reference(concept_art)`. Objects, positions, scales, lighting.
3. **analyze_mesh** on each OBJ (pre-pass, runs mugshot VLM on first call)
4. Build RT infrastructure (RT, camera, kernel, env, geo group)
5. Place objects using tool suggestions + recipe. **`fit_camera()` after EVERY placement.**
6. `register_scene_object` after each placement
7. Render → `save_render` → AD critique loop (never skip, stop when exhausted)
8. Save .orbx at milestones

### Hard Rules

- **`fit_camera()`** after every geo placement — only way to verify all geo visible
- **AD critique on every scene** in DRESS/SHOW — never skip. When exhausted → move on.
- **`semantic_critique`** alongside `critique_render` for dual perspective
- **Never build without preview running**

---

## gRPC API Quick Reference

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

---

## Tools

### Mesh Placement (run BEFORE building scene)

| Tool                        | What                                                                           |
| --------------------------- | ------------------------------------------------------------------------------ |
| `analyze_mesh`              | Bounds + orientation + VLM mugshot check. Caches `.mesh_info.json` v2 sidecar. |
| `suggest_placement`         | Collision-free position given scene DB. Advisory.                              |
| `register_scene_object`     | Update scene DB after placing. Warns on penetration/overlap.                   |
| `get_scene_placement_state` | Inspect DB + warnings.                                                         |

**analyze_mesh v2** runs 3 tiers: geometric (trimesh) → semantic (filename) → visual mugshot (6 renders → VLM haiku). Mugshot is the only reliable orientation method. Cached after first run. `force_reanalyze=true` to re-run.

Sidecar: `{version, geometry{bounds,extents}, semantic{category,height}, visual_check{vlm_response{is_upright,correction_rotation}}, final_suggestion{rotation_deg,ground_offset_y,scale_factor}}`

### AD Composition

| Tool                | What                                                               |
| ------------------- | ------------------------------------------------------------------ |
| `plan_composition`  | Spatial layout + camera math (Phase 0)                             |
| `validate_layout`   | Frustum, depth, proximity, grid checks                             |
| `analyze_reference` | Extract composition from reference image                           |
| `critique_render`   | Vision model scores (framing/depth/composition/lighting/placement) |
| `apply_corrections` | Record scores, detect stagnation                                   |
| `semantic_critique` | Pixel-level render vs intent gap analysis                          |

### SEGA (Artistic Intent)

| Tool                     | What                                    |
| ------------------------ | --------------------------------------- |
| `set_artistic_intent`    | Mood via preset/vector/NL. 25+ presets. |
| `adjust_artistic_intent` | Fine-tune one of 15 dimensions          |
| `suggest_lighting`       | 3-point recipe from mood + bounds       |
| `suggest_material`       | PBR values for 28+ surface types        |

---

## Project Structure

Scenes: `octaneWebR/aigenerated/`. Reference: `mycelium-court/recipe.md`.

```
aigenerated/scene-name/
  concept_art.png    recipe.md    scene.orbx
  assets/            temp/        renders/
```

## Build & Debug

- **MCP build:** `cd mcp && npm run build` (esbuild)
- **MCP log:** `log_mcp.log` — use `clear_log` before test runs
- **SCRATCH:** kill all → restart serv → preview → reset_project
- **Viewport grey?** Stale `.js` in `mcp/src/`, wrong mcp_build, or CallbackStreamManager
- **Docs:** `docs/mcp/BUILD.md`, `docs/mcp/TROUBLESHOOTING.md`, `docs/mcp/REFERENCE.md`
- **SEGA:** `docs/project/SEGA_SYSTEM_DESIGN.md`, `docs/project/SEGA_USER_GUIDE.md`
