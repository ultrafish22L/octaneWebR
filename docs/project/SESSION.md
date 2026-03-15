# Session Briefing — Autonomous Debug (2026-03-14)

## Goal

Full codebase autonomous debug session in 2 phases. Start with wood chips demo (warm-up + proof of procedural materials), then MCP debug, then UI debug.

## Phase 0: Wood Chips Demo (Warm-Up)

Build a procedural wood sample display scene — proves MCP scene building works end-to-end before diving into bug fixes. Also a colleague challenge (zero-shot procedural materials).

**Scene:** Sunset-lit pine plank with 7 procedural wood chip samples (red oak, white oak, purpleheart, ebony, maple, walnut, zebrawood). All materials procedural — no texture images.

**Build order (follow CHEATSHEET render pipeline):**

1. Read OCTANE_CHEATSHEET.md (HARD RULE — not optional)
2. Fresh start protocol (CLAUDE.md)
3. Create RT + pine plank geo → connect to RT pin 3 → `start_render(rt_handle)` → `update_scene()` → `set_camera` — get visible FAST
4. Verify render with `save_render`
5. Create 7 chip geos, position in row on plank
6. Create 7 procedural wood materials (2x RGB + marble + mix → universal mat each)
7. Connect materials to chips
8. Set sunset environment (hour 17.5, turbidity 4.0)
9. Frame camera from bounds
10. Final render + save

**Node count:** ~41 nodes. Reference: CHEATSHEET "Procedural Textures" section has pin layouts and oak wood recipe.

## Phase 1: MCP Server Debug

Work through MCP bugs and resilience items. Use MCP tools directly (not web UI) for testing.

### Bugs (fix and verify)

| #   | Item                                    | Difficulty | Approach                                                                              |
| --- | --------------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| 29  | Context menu fails on empty scene       | Medium     | Test right-click with no scene loaded. Find the guard that fails.                     |
| 34  | RT auto-select doesn't expand outliner  | Easy       | Find outliner select handler, add expand-on-select.                                   |
| 35  | MCP-created nodes pile at (0,0)         | Medium     | Either pass position hints in webapp refresh, or trigger auto-arrange after MCP adds. |
| 43  | Inspector incomplete after MCP add      | Easy       | `buildNewNode` doesn't recurse deep enough. Compare with progressive loader depth.    |
| 45  | Inspector doesn't update on MCP changes | Medium     | Detect incoming updates affecting selected node, re-fetch properties.                 |
| 46  | Empty nodes not selectable in outliner  | Easy       | Nodes without children/connections should still appear and be clickable.              |
| 47  | connect_nodes doesn't trigger re-render | Medium     | Add `update_scene` + camera trigger after connect operations in MCP.                  |

### Resilience (implement)

| #   | Item                                 | Difficulty | Approach                                                                     |
| --- | ------------------------------------ | ---------- | ---------------------------------------------------------------------------- |
| 31  | Crash detection + recovery guidance  | Medium     | Detect ECONNRESET/ECONNREFUSED, return structured error.                     |
| 36  | Add `up` param to `set_camera`       | Easy       | `mcp/src/tools/camera.ts:57`                                                 |
| 37  | Add timeout to `notifyWebapp` fetch  | Easy       | 3-5s AbortController. `mcp/src/tools/webapp.ts:29`                           |
| 38  | Remove or guard `reset_project`      | Easy       | `mcp/src/tools/project.ts:65`                                                |
| 39  | `save_render` path validation        | Easy       | Check parent dir exists, warn on `ORBX/` path. `mcp/src/tools/render.ts:120` |
| 40  | `load_project` wait-for-ready        | Medium     | Replace hardcoded 2s sleep. `mcp/src/tools/project.ts:33`                    |
| 41  | Track auto-created children in cache | Medium     | `mcp/src/tools/node.ts:199`                                                  |

### Investigate (from BUGLIST.md)

| #   | Item                              | Action                                                                          |
| --- | --------------------------------- | ------------------------------------------------------------------------------- |
| 3   | P_DIFFUSE=30 retest               | Build mesh, connect material via pin_id:30. If works → remove IMPROVEMENTS #48. |
| 1-2 | Gold/Glass material type decision | Pick Universal or Glossy/Specular as default. Align CHEATSHEET + OCTANE_MCP.    |
| 5   | Camera framing from bounds        | Add centroid+extents formula to DRESS_BUILD_PROTOCOL.                           |
| 6   | "Materials from geo 1" rule       | Add to OCTANE_MCP source of truth.                                              |

## Phase 2: octaneWebR UI Debug

Work through UI improvements using preview tools (web UI). Ordered easy → hard.

### Easy (CSS / one-file)

| #   | Item                                    | File hint                 |
| --- | --------------------------------------- | ------------------------- |
| 1   | GPU stats: remove "selected" border     | Delete one CSS rule       |
| 2   | Dialog dimming                          | CSS toggle                |
| 3   | Tooltip yellow background               | Add CSS vars              |
| 4   | Panel title menu icon                   | Add icon element + CSS    |
| 6   | Inspector expanded/collapsed icon shape | Conditional border-radius |
| 7   | Save render shared path memory          | Single state variable     |
| 8   | RequestQueue max size                   | Add constant              |
| 9   | GPU dialog on render bar right-click    | Add onContextMenu handler |

### Medium

| #   | Item                                   |
| --- | -------------------------------------- |
| 10  | Modal dialog stacking policy           |
| 11  | Toolbar button style unification       |
| 12  | CSS cleanup                            |
| 13  | Fix all icons in node-add context menu |
| 14  | Export render passes dialog            |
| 15  | FileBrowserDialog file type filter     |
| 16  | Tooltip audit                          |
| 17  | Suppress edits during sync             |
| 18  | PreferencesDialog wiring               |
| 30  | Audit FILE_NODE_TYPES via offline API  |

### Hard (skip unless time permits)

| #   | Item                             |
| --- | -------------------------------- |
| 21  | Multi-connect selected nodes     |
| 22  | Viewport axis rotation           |
| 23  | Automated test suite             |
| 24  | Event queuing during load        |
| 25  | Node Inspector for grouped nodes |

## Protocol

1. **Fresh start** — follow CLAUDE.md protocol exactly (stop preview → kill Octane → verify → launch → wait → start preview)
2. **Read docs first** — SESSION.md (this file), CLAUDE.md, OCTANE_MCP.md, BUGLIST.md
3. **Fix one, verify, then next** — no batching fixes
4. **After any rule-changing finding** — update OCTANE_MCP.md FIRST, then propagate
5. **Lint + build before push** — `npm run lint` + `npm run build`
6. **MCP testing** — use MCP tools directly for Phase 1
7. **UI testing** — use preview tools (screenshot, snapshot, click) for Phase 2

## What Changed Session 2026-03-14 (v7 Hybrid — Scene Comparison)

### Scene Dump & Comparison

- Dumped full v5 (100 nodes) and v6 rebuild (64 nodes) to structured markdown for side-by-side comparison
- Discovered 36 missing nodes: roughness-by-grain (18), falloff map (1), multiply textures (7), supporting nodes (~10)
- **Key finding: marble Z-scale was the #1 visual quality driver** — v5 had Z=20-45 (grain bands), v6 had Z=0.015-0.04 (flat)
- Warm-tinted coating colors `{0.45, 0.3, 0.3}` vs neutral gray — gives lacquer warmth
- Coating roughness 0.003-0.008 vs 0.02-0.04 — lower = shinier = realistic lacquer

### v7 Hybrid Created

- Applied all v5 material values to v6 scene via batched `set_attribute` calls
- Marble Z-scales, coating colors/roughness, bump heights, turbulence params, species albedo colors
- Fixed backdrop emission flags (illumination OFF, castShadows OFF)
- Saved as `ORBX/woodchips_demo_v7_hybrid.orbx`, rendered to `renders/woodchips_v7_hybrid.png`
- Detailed session log: `docs/project/SESSION_2026-03-14_v7_hybrid.md`

### Docs Updated

- CLAUDE.md: Current Session → v7 hybrid, scene version history table
- OCTANE_CHEATSHEET.md: species tables replaced with "v5 FINAL — validated via scene dump comparison"
- SCENE_DUMP_v6_rebuild.md: full dump + DIFFERENCES vs V5 section

## What Changed Session 2026-03-14 (Wood Chips Demo — earlier)

### Phase 0 Complete

- Built sunset-lit pine plank + 7 procedural wood chip samples (red oak, white oak, purpleheart, ebony, maple, walnut, zebrawood)
- All materials procedural with species-accurate colors from web research (Wood Database, SchemeColor, PhysicallyBased.info)
- Each species has unique grain stretch, octaves, roughness, and coating values
- OTOY Studio workshop background via texture environment
- Saved as `ORBX/woodchips_demo.orbx`

### AA/CM Team Established

- **AA (Artistic Agent)** reviews every render for visual quality, directs improvements
- **CM (Camera Math)** computes camera positions with calibrated FOV, caches proven frames
- CM calibrated Octane Thin Lens FOV: half-HFOV ≈ 41° (not the assumed 45.75°)
- Proven hero frame for tabletop product shots: `{0, 4.2, 7.5}` → `{0, 0, 0}` at 29° elevation
- Key lesson: start far, inch forward — pure math framing failed repeatedly

### Geo Group Connection Fix

- `pin_name: "Input N"` on NT_GEO_GROUP **silently fails** — connections report success but don't stick
- Must use `pin_index: N` instead (0-based)
- Added to OCTANE_MCP.md pin connection gotchas

### Sunset Environment Tuning

- Hour 17.5 / turbidity 4.0 from cheatsheet was too cool (blue sky reflection)
- What worked: hour 16.5, turbidity 6.0, latitude 40°, north offset 45° — warm directional raking light

## What Changed Session 2026-03-14 (Earlier)

- CHEATSHEET: Added "Render Pipeline — From Scratch" (8 steps, RT pin layout, common mistakes, save-first rule)
- CHEATSHEET: Added "Procedural Textures" section (available nodes, Mix/Marble/RGB pin layouts, oak wood recipe)
- CHEATSHEET: Added "user sees render live in viewport" note
- CLAUDE.md: Fixed `taskkill` syntax — must use `cmd /c` wrapper in bash
- CLAUDE.md: Added `reset_project` save-first rule
- Memory: `feedback_render_pipeline.md` upgraded to HARD RULE — must Read cheatsheet before any MCP build
- CA Review: 9 fumbles documented in MEET_CA_REVIEW.md, root cause = didn't read docs first
- User tips captured: camera framing from bounds + extents, flat Box for quad workaround

### Lesson Learned

**Reading the docs is not optional.** Every fumble in 2026-03-14 was caused by skipping the read step. The docs had the answer. The memory had "read docs first." The agent ignored both. Next session MUST start with reading, not doing.

## What Changed Session 2026-03-13

- Updated "Refresh After Structural Changes" in OCTANE_MCP.md: connections need `update_scene()` + camera change
- Updated CLAUDE.md rule #3 to match
- Added IMPROVEMENTS #49: test rig for connection refresh requirements
- Chrome roughness aligned to 0.02 across docs
- ARCHITECTURE.md: fixed stale paths, recipe count
- Placement pin comment clarified
- IMPROVEMENTS #48 marked misdiagnosed, moved to BUGLIST for retest
- Added BUGLIST.md to CLAUDE.md key docs index
- Quad workaround updated: flat Box preferred, quad.obj as fallback
- `get_attribute` read-back noted as debug feature (can optimize out with production flag)

### MEET Review Decisions (2026-03-13)

- **Universal Material is the default** for gold, glass, chrome, all metals — CREATIVE aligned to CHEATSHEET
- **Fresh start wait time** — "typically ~5s, use 15s if unsure, experiment" in both docs
- **P_DIFFUSE=30** — retest in Phase 1, user unsure if it's a real issue
- **execute_batch (#42)** — deferred, not this session
- **Cache invalidation** — added as IMPROVEMENTS #50 (High), likely selected node delete issue
- **Dead CRASH_INVESTIGATION.md reference** — removed from attribute.ts
- **Revalidate old findings** — added as feedback memory (backup rule)
- **Build order docs** — defer to next session
- BUGLIST #1, #2, #4 resolved. #3, #5, #6 remain open for Phase 1.
