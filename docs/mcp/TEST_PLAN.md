# MCP Server — Test Plan

## §1 Rules

**Every test run starts with SCRATCH.** Kill all servers, stop preview, restart fresh. See `BUILD.md` §2.

**MCP restart = SCRATCH.** If the MCP server process dies, gets killed, or restarts for any reason (including after `npm run build`), you MUST run the full SCRATCH protocol before resuming tests. An MCP restart invalidates all cached handles, clears the relay, and resets session state. Resuming mid-test after an MCP restart produces false results — stale handles get gated, the relay may be dead, and the preview viewport may be disconnected. No shortcuts.

**Testing is always DRESS mode.** Stop on failure, debug, fix, verify, resume. See `BUILD.md` §2.

**The dev server and preview window MUST be running for ALL tests.** No exceptions — not for smoke tests, not for gotcha verification, not for "quick checks". The preview viewport is how you confirm Octane is alive and rendering. Without it you are testing blind.

**Every test follows this cycle — no deviation.** This applies to ALL tests: full sweep, smoke tests, gotcha verification, regression checks, one-off experiments — everything. There is no "lightweight" test mode.

1. **Act** — one change only
2. **Log** — read `log_mcp.log` (and `log_grpc.log` if visual)
3. **Render** — `save_render` → read PNG. Also `preview_screenshot` → compare preview vs render. Both must show the expected change. Differences between preview and render indicate a real problem (broken viewport streaming, stale UI, geometry not loaded).
4. **Pass/Fail** — don't rationalize. No change visible = FAIL. `{}` response = FAIL. Preview grey/blank when render has content = FAIL (viewport streaming broken).
5. **Next** — only after 2-4 confirm success

**No test without visual confirmation.** If a test changes geometry, material, camera, or lighting — you MUST render and visually confirm. If a test only returns data (stats, attribute values) — you still check logs. "It returned success" is not a pass criterion when the change should be visible.

**Testing uses 256 samples.** Set kernel maxSamples to 256 for all test renders. This is fast enough for visual verification (~1s) and avoids wasting time on 5000-sample beauty renders during testing. Only use higher samples for final beauty passes.

**Between tests:** `load_project(ORBX/teapot.orbx)` for destructive tests. `save_project` after each major phase.

**Before push:** `npm test` + `npm run lint` + `cd mcp && npm run build`.

### On Error — FULL STOP

1. Note which tool/call caused it
2. Check `log_mcp.log` — last success → first error
3. If server disconnected: relaunch octaneServGrpc, wait ~5s, verify gRPC on port 51022
4. `load_project` from last checkpoint
5. Resume from where you left off

### Known Error Triggers

- `import_materialx` — returns gRPC error on certain .mtlx files (standard_surface_gold.mtlx confirmed).

---

## §2 Test Categories

### SMOKE — Full MCP Scene Build (run after any infra change)

Stop everything, start fresh, build a red sphere scene via MCP, check logs at every checkpoint. **SMOKE follows the same Act→Log→Render→Pass/Fail cycle as every other test. The dev server and preview MUST be running.**

1. Stop all servers and preview window
2. Start server (octaneServGrpc or octane.exe)
3. **Start dev server + preview window** (required — not optional)
4. Build red sphere scene with MCP:
   1. Create RT — check logs
   2. Create sphere mesh + red material → placement → RT geometry pin — check logs
   3. `start_render` → `fit_camera()` — check render + preview (sphere visible, properly framed)
   4. Add environment — `fit_camera()` — check render + preview (sky + lighting appear)
   5. Hero camera comes last — only after all geometry verified

**Quick alternative (MINIS):** `load_project("ORBX/smoketest.orbx")` + `start_render` + `save_render` → verify render shows expected scene. Validates Octane + MCP connectivity without building from scratch.

### A. Smoke Test (run at session start)

| #   | Test                                      | Pass Criteria                    |
| --- | ----------------------------------------- | -------------------------------- |
| 1   | `get_octane_version`                      | Returns version string, no error |
| 2   | `get_device_info`                         | Returns GPU name + memory        |
| 3   | `load_project` (ORBX/teapot.orbx)         | Returns success, scene populates |
| 4   | `get_scene_tree`                          | Returns 2+ nodes (mesh + RT)     |
| 5   | `start_render` → `save_render` → read PNG | Teapot visible in render         |

### B. Node Operations (9 tools)

| #   | Test                                    | Pass Criteria                     | Render-Check           |
| --- | --------------------------------------- | --------------------------------- | ---------------------- |
| 1   | `create_node` (NT_GEO_OBJECT)           | Returns handle + pins             | —                      |
| 2   | `rename_node`                           | Name updated                      | —                      |
| 3   | `connect_nodes` (material → mesh pin 0) | verified: true                    | Yes — material visible |
| 4   | `disconnect_pin`                        | Pin disconnected                  | Yes — material gone    |
| 5   | `create_and_connect`                    | Node created + verified           | Yes                    |
| 6   | `find_nodes` (by name)                  | Returns matching handles          | —                      |
| 7   | `find_nodes` (by type_id)               | Returns matching handles          | —                      |
| 8   | `duplicate_node`                        | New handle returned, name matches | —                      |
| 9   | `delete_node` → `delete_unconnected`    | Nodes removed from scene tree     | —                      |

### C. Attributes (6 tools)

| #   | Test                                    | Pass Criteria                           | Render-Check        |
| --- | --------------------------------------- | --------------------------------------- | ------------------- |
| 1   | `get_attribute` (A_VALUE on float node) | Returns numeric value                   | —                   |
| 2   | `set_attribute` (change albedo color)   | Value set                               | Yes — color changed |
| 3   | `get_all_attributes`                    | Returns attribute list with ids + types | —                   |
| 4   | `get_attribute_info` (A_VALUE)          | Returns name, type, default             | —                   |
| 5   | `get_pin_value` (albedo pin)            | Returns connected handle + value        | —                   |
| 6   | `is_animated`                           | Returns false on static attribute       | —                   |

### D. Camera (2 tools)

| #   | Test                          | Pass Criteria                                  | Render-Check          |
| --- | ----------------------------- | ---------------------------------------------- | --------------------- |
| 1   | `set_camera` (known position) | success: true                                  | Yes — framing changed |
| 2   | `get_camera`                  | Returns position/target/up matching set values | —                     |

### E. Render Pipeline (7 tools)

| #   | Test                                            | Pass Criteria                       | Render-Check        |
| --- | ----------------------------------------------- | ----------------------------------- | ------------------- |
| 1   | `start_render`                                  | success: true                       | Yes — render starts |
| 2   | `get_render_status`                             | Returns resolution, samples, state  | —                   |
| 3   | `stop_render`                                   | success: true                       | —                   |
| 4   | `save_render` (PNG)                             | File written, read confirms image   | Yes                 |
| 5   | `save_render` (EXR)                             | File written without error          | —                   |
| 6   | `get_enabled_aovs`                              | Returns pass ID list (may be empty) | —                   |
| 7   | `save_render_passes` / `save_render_passes_exr` | success: true                       | —                   |

### F. Render Control (6 tools)

| #   | Test                                                 | Pass Criteria                          | Render-Check             |
| --- | ---------------------------------------------------- | -------------------------------------- | ------------------------ |
| 1   | `set_clay_mode` (2=color)                            | success: true                          | Yes — color clay render  |
| 2   | `get_clay_mode`                                      | Returns current mode                   | —                        |
| 3   | `set_clay_mode` (0=none)                             | success: true                          | Yes — materials restored |
| 4   | `set_render_priority` (HIGH) → `get_render_priority` | Round-trip matches                     | —                        |
| 5   | `set_subsample_mode` (1) → `get_subsample_mode`      | Set succeeds (getter may return stale) | —                        |
| 6   | Reset all to defaults                                | All back to 0/MEDIUM                   | —                        |

### G. Stats (5 tools)

| #   | Test                 | Pass Criteria                           |
| --- | -------------------- | --------------------------------------- |
| 1   | `get_geometry_stats` | Returns triCount > 0, instanceCount > 0 |
| 2   | `get_texture_stats`  | Returns texture type breakdown          |
| 3   | `get_resource_stats` | Returns memory breakdown                |
| 4   | `get_scene_bounds`   | Returns valid bbox (min < max)          |
| 5   | `get_render_state`   | Returns 5 boolean flags                 |

### H. Animation (5 tools)

| #   | Test                                           | Pass Criteria                    | Render-Check |
| --- | ---------------------------------------------- | -------------------------------- | ------------ |
| 1   | `set_animation_data` (Y rotation, 3 keyframes) | keyframe_count: 3                | —            |
| 2   | `is_animated`                                  | Returns true                     | —            |
| 3   | `get_animation_data`                           | Returns matching keyframe values | —            |
| 4   | `get_animation_range`                          | Returns time span                | —            |
| 5   | `clear_animation` → `is_animated`              | Returns false after clear        | —            |

### I. Art Direction (6 tools)

| #   | Test                             | Pass Criteria                         | Render-Check       |
| --- | -------------------------------- | ------------------------------------- | ------------------ |
| 1   | `plan_composition`               | Returns spec + validation             | —                  |
| 2   | `validate_layout`                | Returns issues list                   | —                  |
| 3   | `critique_render`                | Returns A-F grade + comparison scores | Yes — render saved |
| 4   | `apply_corrections`              | Records score history                 | —                  |
| 5   | `get_art_direction_state`        | Returns specs + scores                | —                  |
| 6   | `analyze_reference` (with image) | Returns composition data or prompt    | —                  |

### J. Creative (2 tools)

| #   | Test                          | Pass Criteria                                 | Render-Check                       |
| --- | ----------------------------- | --------------------------------------------- | ---------------------------------- |
| 1   | `suggest_material` (gold)     | Returns recipe with albedo/metallic/roughness | Yes — apply recipe, verify render  |
| 2   | `suggest_lighting` (dramatic) | Returns light positions + temperature + power | Yes — create lights, verify render |

### K. Color & MaterialX (4 tools)

| #   | Test                   | Pass Criteria                                               |
| --- | ---------------------- | ----------------------------------------------------------- |
| 1   | `get_ocio_config`      | Returns config data or "no config" error                    |
| 2   | `list_color_spaces`    | Returns color space list or "no config" error               |
| 3   | `list_materialx_nodes` | Returns 100+ categories                                     |
| 4   | `import_materialx`     | CAUTION — may return error on some files. Save scene first. |

### L. Project (3 tools)

| #   | Test                          | Pass Criteria                          |
| --- | ----------------------------- | -------------------------------------- |
| 1   | `load_project`                | Scene loads, SceneCache auto-populates |
| 2   | `save_project` (to temp path) | File written                           |
| 3   | `reset_project`               | Scene clears, count: 0, no dialog      |

### M. System (9 tools)

| #   | Test                                                                 | Pass Criteria                         |
| --- | -------------------------------------------------------------------- | ------------------------------------- |
| 1   | `get_octane_version`                                                 | Returns version + name                |
| 2   | `get_device_info`                                                    | Returns GPU + memory                  |
| 3   | `list_node_types` (category filter)                                  | Returns filtered types                |
| 4   | `profile_reset` → `profile_start` → `profile_end` → `profile_report` | Full profiling lifecycle              |
| 5   | `clear_log`                                                          | Returns old line count                |
| 6   | `refresh_webapp`                                                     | Returns client count or "not running" |

---

## §3 Full Sweep

Run all categories A–M in order. Expected: ~65 tool calls, ~15 render checks, ~5 minutes wall time.

| Category           | Tools                                                                            | Expected                           |
| ------------------ | -------------------------------------------------------------------------------- | ---------------------------------- |
| A. Smoke           | 5                                                                                | All pass                           |
| B. Nodes           | 9                                                                                | All pass                           |
| C. Attributes      | 6                                                                                | All pass                           |
| D. Camera          | 2                                                                                | All pass                           |
| E. Render          | 7                                                                                | All pass                           |
| F. Render Control  | 6                                                                                | 5 pass, 1 quirk (subsample getter) |
| G. Stats           | 5                                                                                | All pass                           |
| H. Animation       | 5                                                                                | All pass                           |
| I. Art Direction   | 6                                                                                | 5 pass, 1 needs image input        |
| J. Creative        | 2                                                                                | All pass                           |
| K. Color/MaterialX | 4                                                                                | 3 pass, 1 error risk               |
| L. Project         | 3                                                                                | All pass                           |
| M. System          | 9                                                                                | All pass                           |
| **Total**          | **69** (67 unique tools, `is_animated` in C+H, profile\_\* as 4 tools in 1 test) | **~63 pass**                       |

---

## §4 Known Issues

| Tool                 | Issue                                                | Severity |
| -------------------- | ---------------------------------------------------- | -------- |
| `import_materialx`   | Returns gRPC error on certain .mtlx files            | HIGH     |
| `get_subsample_mode` | Returns stale value after set                        | LOW      |
| `list_color_spaces`  | Fails without loaded OCIO config                     | EXPECTED |
| `reset_project`      | `suppressUI` prevents blocking dialog — not an issue | N/A      |
| LiveDB tools (4)     | Octane gRPC "invalid pointer type" bug — disabled    | HIGH     |
