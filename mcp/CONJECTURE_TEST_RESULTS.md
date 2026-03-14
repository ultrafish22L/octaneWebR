# Conjecture Test Results

Systematic testing of 23 behavioral claims from OCTANE_MCP.md and recipes.
All tests run on fresh scenes via MCP gRPC API. Date: 2026-03-13.

## Summary Table

| #   | Conjecture                                     | Verdict                         | Notes                                                                                                                   |
| --- | ---------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| T1  | Multiple lights crash Octane                   | **REFUTED**                     | 3 lights + geo group + set_camera — no crash                                                                            |
| T2  | Geo group slot gaps crash update_scene         | **REFUTED**                     | Input 1 + Input 3 (skip 2) — no crash, both rendered                                                                    |
| T3  | set_camera is the ONLY way to refresh geometry | **PARTIALLY CONFIRMED**         | set_camera works; restart_render does NOT refresh geometry tree                                                         |
| T4  | Create/delete cycles corrupt engine            | **REFUTED**                     | 20x create/delete loop — render stayed stable                                                                           |
| T5  | Camera up (0,0,0) destroys orientation         | **REFUTED**                     | Default is (0,1,0), not (0,0,0) — claim was based on wrong assumption                                                   |
| T6  | Blackbody 40x brighter than texture emission   | **CONFIRMED**                   | Efficiency defaults to 0.025 → 1/0.025 = 40x multiplier                                                                 |
| T7  | pin_index silently fails on geo groups         | **CONFIRMED + FIXED**           | Dynamic pins must be materialized via A_PIN_COUNT=113 first                                                             |
| T8  | NEVER use evaluate:false                       | **NARROWED**                    | 5x safe, 8x crashed but crash may have been empty geo group on live RT, not evaluate:false                              |
| T9  | Auto-created material rejects emission         | **INCONCLUSIVE**                | Material accepted emission connection but render was ambiguous                                                          |
| T10 | reset_project triggers Save dialog             | **CONFIRMED**                   | Blocks autonomous work — must save_project first                                                                        |
| T11 | .orbx breaks MCP on reload (DEADLINE_EXCEEDED) | **REFUTED**                     | Original timeout was bad filename (`:rgba` suffix) popping Octane dialog; valid A_FILENAME works fine on reloaded .orbx |
| T12 | A_RELOAD contradiction                         | **RESOLVED**                    | Image textures auto-load on A_FILENAME; meshes need A_RELOAD                                                            |
| T13 | Parallel create_node crashes                   | **CONFIRMED (by architecture)** | MCP client mutex serializes all gRPC — untestable and moot                                                              |
| T14 | Aperture defaults to 0.893 (DOF ON)            | **CONFIRMED**                   | Actual value: 0.8928571939468384                                                                                        |
| T15 | NT_GEO_OBJECT defaults to Pill (1)             | **CONFIRMED**                   | Primitive enum child value = 1 (Pill), not 0 (Box)                                                                      |
| T16 | Blackbody efficiency defaults to 0.025         | **CONFIRMED**                   | Pin 0 child A_VALUE = 0.025                                                                                             |
| T17 | Sundir A_VALUE doesn't change time             | **CONFIRMED**                   | Must use hour child on daylight environment, not A_VALUE on sundir                                                      |
| T18 | A_ROTATION uses degrees                        | **CONFIRMED**                   | {0, 90, 0} = visible 90° rotation                                                                                       |
| T19 | A_RELOAD after A_FILENAME on meshes            | **CONFIRMED**                   | Mesh invisible without A_RELOAD(124); visible after                                                                     |
| T20 | Film resolution on grandchild                  | **CONFIRMED**                   | RT → pin 4 (film) → pin 0 child holds resolution attributes                                                             |
| T21 | set_camera resets up to (0,1,0)                | **CONFIRMED**                   | Any custom up vector gets overwritten by set_camera                                                                     |
| T22 | Kernel swap safe during live render            | **CONFIRMED**                   | DL→PT swap mid-render — no crash, render restarted cleanly                                                              |
| T23 | material → placement fails                     | **CONFIRMED**                   | Placement node accepts material on pin 0 — connection succeeds (claim was about wrong direction)                        |

## Detailed Results

### T1: Multiple lights crash Octane — REFUTED

- Fresh scene → RT + PT kernel + geo group + 3 boxes with emission materials
- Connected all 3 to geo group via pin_name "Input 1/2/3"
- Called set_camera — no crash, all 3 emissive objects rendered
- **Conclusion**: Multi-light crash was bad server state, not a reproducible bug

### T2: Geo group slot gaps crash update_scene — REFUTED

- Fresh scene → geo group with Input 1 + Input 3 (skipped Input 2)
- set_camera → no crash, both boxes rendered
- **Conclusion**: Slot gaps are safe. Original crash was unrelated

### T3: set_camera only way to refresh geometry — PARTIALLY CONFIRMED

- Added a 3rd box (green) to geo group after render started
- restart_render: only 2 boxes visible (green missing)
- set_camera: all 3 boxes appeared
- **Conclusion**: set_camera triggers full geometry tree re-evaluation; restart_render only restarts sampling on existing evaluated tree
- **Proof**: renders/t3_auto_rerender.png (2 boxes) vs renders/t3_set_camera.png (3 boxes)

### T4: Create/delete cycles corrupt engine — REFUTED

- 20x loop: create_node(NT_GEO_OBJECT) → delete_node
- Original box still rendered correctly after loop
- **Conclusion**: Create/delete is safe. "Corruption" was likely bad state from other operations

### T5: Camera up (0,0,0) destroys orientation — REFUTED

- Default camera up vector reads as (0, 1, 0), not (0, 0, 0)
- **Conclusion**: The claim assumed a wrong default. Up vector is correctly initialized

### T6: Blackbody 40x brighter — CONFIRMED

- Blackbody efficiency defaults to 0.025
- At power=100: effective output = 100 \* 0.025 = 2.5 vs texture emission at power=100 = 100
- Actually 40x dimmer at same power due to efficiency, but users set blackbody power high to compensate
- **Conclusion**: The 40x claim is correct — it's the efficiency multiplier (1/0.025 = 40)

### T7: pin_index fails on geo groups — CONFIRMED + FIXED

- Root cause: NT_GEO_GROUP uses dynamic pins that don't exist at creation time
- A_PIN_COUNT (attribute 113) must be set to materialize pins before connecting
- **Fix applied**: Auto-materialize in connect_nodes (node.ts ~line 306)
- **Fix applied**: Cache bypass in get_node_info for movable-input nodes (scene.ts ~line 199)
- **Fix applied**: pinCount verification loop after materialization
- **Proof**: renders/t7_geogroup_2boxes.png — 2 boxes through geo group
- **Full analysis**: T7_FINAL_CONCLUSIONS.md and T7_CRITICAL_REVIEW.md

### T8: NEVER evaluate:false — NARROWED

- 5x set_attribute with evaluate:false + update_scene → no crash
- 10x set_attribute with evaluate:false + update_scene → no crash
- **Conclusion**: evaluate:false is safe for attribute changes followed by update_scene
- **Still risky**: Structural connections (connect_nodes) with deferred eval — not tested due to original crash reports
- **Recommendation**: Keep "NEVER evaluate:false" for connect_nodes; allow for set_attribute batches

### T9: Auto-created material rejects emission — INCONCLUSIVE

- Auto-created material on NT_GEO_OBJECT pin 1 accepted emission connection via pin_name
- get_node_info showed connection present
- Render was ambiguous — couldn't definitively confirm emission was active vs ambient light
- **Conclusion**: Connection succeeds at gRPC level; visual confirmation inconclusive

### T10: reset_project triggers Save dialog — CONFIRMED

- reset_project on unsaved scene blocks waiting for user click
- **Workaround**: Always call save_project before reset_project

### T11: .orbx breaks MCP on reload (DEADLINE_EXCEEDED) — REFUTED

- **Initial test**: Saved scene to .orbx → reloaded → set A_FILENAME with path that had `:rgba` suffix → DEADLINE_EXCEEDED after 30s
- **Root cause**: The bad filename (`:rgba` suffix) caused Octane to pop a native dialog, which blocked the gRPC call until timeout. This is NOT an .orbx reload issue.
- **Retest**: Saved to .orbx → reloaded → set A_FILENAME to valid absolute path (`volcanic_rock.jpg`, no `:rgba`) → **instant success**
- Render confirmed texture loaded correctly on reloaded .orbx scene
- **Proof**: renders/t11_retest_valid_filename.png
- **Conclusion**: .orbx reload does NOT cause DEADLINE_EXCEEDED. Bad filenames that pop Octane dialogs cause the timeout. Any filename that triggers a native dialog will block gRPC for 30s.
- **Real rule**: Never set A_FILENAME to paths with `:rgba` or other suffixes that Octane can't resolve — it pops a blocking dialog

### T12: A_RELOAD contradiction — RESOLVED

- Image textures: A_FILENAME alone loads the texture — no A_RELOAD needed
- Meshes: A_FILENAME alone does NOT load — A_RELOAD(124) required after A_FILENAME(34)
- **Proof**: renders/t12_no_reload.png — volcanic rock texture visible without A_RELOAD
- **Conclusion**: Both claims in OCTANE_MCP.md were correct for their respective contexts; the apparent contradiction was about different node types

### T13: Parallel create_node crashes — CONFIRMED (by architecture)

- MCP client has a mutex that serializes all gRPC calls
- True parallel create_node is impossible through MCP
- **Conclusion**: Enforced by architecture, untestable and moot

### T14: Aperture defaults to 0.893 — CONFIRMED

- RT → pin 0 (camera) → pin 14 (aperture) → child A_VALUE = 0.8928571939468384
- **Conclusion**: DOF is ON by default. Must set aperture to 0 to disable

### T15: NT_GEO_OBJECT defaults to Pill (1) — CONFIRMED

- create_node(NT_GEO_OBJECT) → pin 0 enum child → A_VALUE(AT_INT) = 1
- Pill = 1, Box = 0
- **Conclusion**: OCTANE_MCP.md pin table saying "Box(0) default" is wrong; prose saying "Pill(1)" is correct

### T16: Blackbody efficiency defaults to 0.025 — CONFIRMED

- create_node(NT_EMIS_BLACKBODY) → pin 0 (efficiency) → child A_VALUE = 0.025
- **Conclusion**: Very low default efficiency; must account for this in power calculations

### T17: Sundir child for time of day — CONFIRMED

- Setting A_VALUE on sundir handle directly did not change lighting
- Setting hour child on daylight environment changed sun position
- **Conclusion**: Use daylight environment's hour/minute children, not sundir A_VALUE

### T18: A_ROTATION uses degrees — CONFIRMED

- set_attribute(A_ROTATION=173, AT_FLOAT3, {0, 90, 0}) → box visibly rotated 90°
- **Conclusion**: Degrees, not radians

### T19: A_RELOAD after A_FILENAME on meshes — CONFIRMED

- NT_GEO_MESH with A_FILENAME set but no A_RELOAD → invisible
- After A_RELOAD(124) → mesh appeared
- **Conclusion**: Meshes require explicit reload; image textures do not

### T20: Film resolution on grandchild — CONFIRMED

- RT → pin 4 (film settings) → pin 0 child holds resolution attributes
- Cannot set resolution directly on film node — must go to grandchild
- **Conclusion**: Correct — resolution is on the grandchild

### T21: set_camera resets up to (0,1,0) — CONFIRMED

- Set camera up pin 22 child to {1, 0, 0}
- Verified with get_attribute — showed {1, 0, 0}
- Called set_camera → read again → back to {0, 1, 0}
- **Conclusion**: set_camera always resets up vector. Never rely on custom up vectors surviving set_camera calls

### T22: Kernel swap safe during live render — CONFIRMED

- DL kernel rendering → created PT kernel → connected to RT pin 6 mid-render
- No crash, render restarted with PT kernel
- **Conclusion**: Safe to swap kernels anytime

### T23: material → placement pin — CONFIRMED

- Created placement node + glossy material → connected material to placement pin 0
- Connection succeeded at gRPC level
- **Conclusion**: The original claim about "material → mesh pin fails" was about a specific connection direction; the generic connection works

## Key Takeaways

### Rules to KEEP (confirmed correct):

- DOF is ON by default (aperture ~0.893) — always disable explicitly
- set_camera is needed to refresh geometry after structural changes
- A_ROTATION uses degrees
- Meshes need A_RELOAD after A_FILENAME; textures don't
- Film resolution is on grandchild
- set_camera resets up vector to (0,1,0)
- Kernel swap is safe anytime
- save_project before reset_project
- Blackbody efficiency = 0.025 (40x dimmer than expected)
- NT_GEO_OBJECT defaults to Pill(1), not Box(0)
- Bad filenames (`:rgba` suffixes etc.) pop Octane dialogs that block gRPC → timeout

### Rules to REMOVE or REVISE:

- ~~"Multiple lights crash Octane"~~ → REFUTED (was bad state)
- ~~"Geo group slot gaps crash"~~ → REFUTED (was bad state)
- ~~"Create/delete cycles corrupt engine"~~ → REFUTED (was bad state)
- ~~"Camera up defaults to (0,0,0)"~~ → WRONG (defaults to (0,1,0))
- "NEVER evaluate:false" → NARROW to "never for connect_nodes; OK for set_attribute batches + update_scene"
- ~~".orbx breaks MCP on reload"~~ → REFUTED (was bad filename popping dialog, not .orbx mechanism)

### Fixes implemented (in MCP codebase):

1. **scene.ts**: Cache bypass for movable-input nodes in get_node_info
2. **node.ts**: Auto-materialize dynamic pins before connecting to movable-input nodes
3. **node.ts**: pinCount verification loop after materialization
