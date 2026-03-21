# Scene Build Test Run — 2026-03-21

Full MCP tool exercise: build a gold sphere scene from scratch, testing every tool category with render verification.

## Environment

- Octane: 2026.1 Alpha 5 (Internal Build)
- GPU: NVIDIA GeForce RTX 4090 (24GB)
- MCP: v2.3.1, 67 active tools (4 LiveDB disabled, 4 viewport tools removed)

## Crashes & Bugs

| #   | Tool                     | Error                        | Severity | Notes                                                                                       |
| --- | ------------------------ | ---------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| 1   | import_materialx         | Octane CRASH (ECONNRESET)    | HIGH     | Crashed Octane after importing standard_surface_gold.mtlx. Recovered by relaunching Octane. |
| 2   | get_subsample_mode       | Returns NONE after set to 1  | LOW      | Setter succeeds but getter reads stale state. Viewport-only behavior.                       |
| 3   | list_color_spaces        | "Failed to load OCIO config" | EXPECTED | No OCIO config loaded — tool works, just needs config.                                      |
| 4   | get_camera (empty scene) | Returns {}                   | EXPECTED | No RT = no camera to query.                                                                 |

## Tool Coverage — 55 unique tools exercised

### Info & System (8 tools)

| Tool               | Result | Render-Verified |
| ------------------ | ------ | --------------- |
| get_octane_version | PASS   | —               |
| get_device_info    | PASS   | —               |
| list_node_types    | PASS   | —               |
| profile_start      | PASS   | —               |
| profile_end        | PASS   | —               |
| profile_report     | PASS   | —               |
| profile_reset      | PASS   | —               |
| clear_log          | PASS   | —               |

### Project (3 tools)

| Tool          | Result  | Render-Verified          |
| ------------- | ------- | ------------------------ |
| load_project  | PASS    | —                        |
| save_project  | PASS    | —                        |
| reset_project | SKIPPED | Destructive, pops dialog |

### Camera (2 tools)

| Tool       | Result | Render-Verified                  |
| ---------- | ------ | -------------------------------- |
| get_camera | PASS   | —                                |
| set_camera | PASS   | Yes — low angle render confirmed |

### Node CRUD (9 tools)

| Tool               | Result | Render-Verified                            |
| ------------------ | ------ | ------------------------------------------ |
| create_node        | PASS   | Yes — sphere, ground, light all rendered   |
| delete_node        | PASS   | —                                          |
| connect_nodes      | PASS   | Yes — material on sphere visible in render |
| disconnect_pin     | PASS   | —                                          |
| create_and_connect | PASS   | Yes — material wired and rendered          |
| rename_node        | PASS   | —                                          |
| find_nodes         | PASS   | —                                          |
| duplicate_node     | PASS   | —                                          |
| delete_unconnected | PASS   | —                                          |

### Attributes (6 tools)

| Tool               | Result | Render-Verified                                    |
| ------------------ | ------ | -------------------------------------------------- |
| get_attribute      | PASS   | —                                                  |
| set_attribute      | PASS   | Yes — gold color, metallic, roughness all rendered |
| get_all_attributes | PASS   | —                                                  |
| get_attribute_info | PASS   | —                                                  |
| get_pin_value      | PASS   | —                                                  |
| is_animated        | PASS   | —                                                  |

### Scene (2 tools)

| Tool           | Result | Render-Verified |
| -------------- | ------ | --------------- |
| get_scene_tree | PASS   | —               |
| get_node_info  | PASS   | —               |

### Render (7 tools)

| Tool                   | Result | Render-Verified                  |
| ---------------------- | ------ | -------------------------------- |
| start_render           | PASS   | Yes                              |
| stop_render            | PASS   | —                                |
| get_render_status      | PASS   | —                                |
| save_render            | PASS   | Yes — 6 renders saved and viewed |
| get_enabled_aovs       | PASS   | —                                |
| save_render_passes     | PASS   | —                                |
| save_render_passes_exr | PASS   | —                                |

### Render Control (6 tools)

| Tool                | Result | Render-Verified                                          |
| ------------------- | ------ | -------------------------------------------------------- |
| set_clay_mode       | PASS   | Yes — grey clay render confirmed                         |
| get_clay_mode       | PASS   | —                                                        |
| set_render_priority | PASS   | —                                                        |
| get_render_priority | PASS   | —                                                        |
| set_subsample_mode  | PASS   | Yes — saved render still full-res (viewport-only effect) |
| get_subsample_mode  | QUIRK  | Returns stale value after set                            |

### Stats (5 tools)

| Tool               | Result | Render-Verified                      |
| ------------------ | ------ | ------------------------------------ |
| get_geometry_stats | PASS   | — (248 tris, 3 instances, 1 emitter) |
| get_texture_stats  | PASS   | —                                    |
| get_resource_stats | PASS   | —                                    |
| get_scene_bounds   | PASS   | —                                    |
| get_render_state   | PASS   | —                                    |

### Animation (5 tools)

| Tool                | Result | Render-Verified                     |
| ------------------- | ------ | ----------------------------------- |
| set_animation_data  | PASS   | — (sphere at t=0, same position)    |
| get_animation_data  | PASS   | — (5 keyframes read back correctly) |
| get_animation_range | PASS   | —                                   |
| is_node_animated    | PASS   | —                                   |
| clear_animation     | PASS   | —                                   |

### Color & MaterialX (4 tools)

| Tool                 | Result        | Render-Verified             |
| -------------------- | ------------- | --------------------------- |
| get_ocio_config      | PASS          | — (needs OCIO config)       |
| list_color_spaces    | EXPECTED FAIL | No OCIO config loaded       |
| import_materialx     | CRASH         | Octane crashed after import |
| list_materialx_nodes | PASS          | 125 categories returned     |

### Art Direction (6 tools)

| Tool                    | Result     | Render-Verified                   |
| ----------------------- | ---------- | --------------------------------- |
| plan_composition        | PASS       | —                                 |
| validate_layout         | PASS       | —                                 |
| critique_render         | PASS       | Yes — external Haiku scored 2.6/5 |
| apply_corrections       | PASS       | —                                 |
| get_art_direction_state | PASS       | —                                 |
| analyze_reference       | NOT TESTED | Needs reference image input       |

### Creative (2 tools)

| Tool             | Result | Render-Verified                            |
| ---------------- | ------ | ------------------------------------------ |
| suggest_material | PASS   | Yes — gold recipe applied and rendered     |
| suggest_lighting | PASS   | Yes — dramatic recipe applied and rendered |

### Webapp (1 tool)

| Tool           | Result     | Render-Verified        |
| -------------- | ---------- | ---------------------- |
| refresh_webapp | NOT TESTED | Dev server not running |

## Summary

| Category        | Tested | Pass   | Fail       | Crash | Skip  |
| --------------- | ------ | ------ | ---------- | ----- | ----- |
| Info/System     | 8      | 8      | 0          | 0     | 0     |
| Project         | 2      | 2      | 0          | 0     | 1     |
| Camera          | 2      | 2      | 0          | 0     | 0     |
| Node CRUD       | 9      | 9      | 0          | 0     | 0     |
| Attributes      | 6      | 6      | 0          | 0     | 0     |
| Scene           | 2      | 2      | 0          | 0     | 0     |
| Render          | 7      | 7      | 0          | 0     | 0     |
| Render Control  | 6      | 5      | 1 quirk    | 0     | 0     |
| Stats           | 5      | 5      | 0          | 0     | 0     |
| Animation       | 5      | 5      | 0          | 0     | 0     |
| Color/MaterialX | 4      | 2      | 1 expected | 1     | 0     |
| Art Direction   | 5      | 5      | 0          | 0     | 1     |
| Creative        | 2      | 2      | 0          | 0     | 0     |
| Webapp          | 0      | 0      | 0          | 0     | 1     |
| **TOTAL**       | **63** | **60** | **2**      | **1** | **3** |

## Renders Produced

1. `test_baseline.png` — Gold sphere + dark ground + key light (baseline)
2. `test_clay.png` — Grey clay mode (materials stripped)
3. `test_subsample4x4.png` — Subsample mode (viewport-only, save is full-res)
4. `test_lowangle.png` — Low angle camera
5. `test_animated.png` — With animation set (at t=0)

## Key Findings

1. **import_materialx crashes Octane** — importing a standard_surface gold .mtlx file caused ECONNRESET. MaterialX import may need specific node category support. Workaround: save scene before importing.
2. **get_subsample_mode reads stale state** — setter reports success but getter returns previous value. Low priority since subsample is viewport-only.
3. **Subsample doesn't affect save_render** — confirmed: viewport optimization only, saved renders are always full resolution.
4. **Profiling shows gRPC is fast** — 26 calls in 0.6s wire time. Most time is mutex waits and MCP transport overhead.
5. **Scene save/load as crash recovery** — saving periodically lets you recover the scene after Octane crashes.

## gRPC Profile

26 calls, 0.6s total wire time. Heaviest: saveImage1 (210ms/5 calls), saveProjectAs (117ms), setRenderTargetNode (71ms).
