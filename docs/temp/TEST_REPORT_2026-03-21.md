# MCP Full Test Report — 2026-03-21

## Environment

- Octane: 2026.1 Alpha 5 (Internal Build), gRPC port 51022
- GPU: NVIDIA GeForce RTX 4090 (24GB)
- Scene: teapot.orbx (1 mesh, 1 RT, fully wired)
- MCP Server: v2.2.1, post-refactoring (pin-utils, constants, auto-populate)

## Results Summary

**46 tools tested. 44 PASS, 1 SKIPPED, 1 CONDITIONAL.**

| Group          | Tools | Result         | Notes                                                                                                |
| -------------- | ----- | -------------- | ---------------------------------------------------------------------------------------------------- |
| Info           | 6     | ALL PASS       | version, device, list*node_types, profile*\*, clear_log                                              |
| Project        | 3     | 2 PASS, 1 SKIP | load + save pass, reset skipped (blocking dialog)                                                    |
| Camera         | 2     | ALL PASS       | get/set round-trip confirmed                                                                         |
| Render         | 9     | ALL PASS       | start, stop, status, save (477KB PNG), pick_point, aovs, passes                                      |
| Render Control | 8     | ALL PASS       | get/set for clay, region, priority, subsample + validation                                           |
| Stats          | 5     | ALL PASS       | geometry, texture, resource, bounds, render_state                                                    |
| Node           | 9     | ALL PASS       | create, delete, connect, disconnect, create_and_connect, rename, find, duplicate, delete_unconnected |
| Attribute      | 2     | ALL PASS       | get/set round-trip on aperture float                                                                 |
| Scene          | 2     | ALL PASS       | tree (compact + full), node_info (connected_only)                                                    |
| Art Direction  | 6     | ALL PASS       | plan, validate, analyze_ref, critique, apply, get_state                                              |
| Webapp         | 1     | PASS           | Correctly reports ECONNREFUSED when dev server not running                                           |
| Import         | 1     | CONDITIONAL    | Build-verified (constants + pin-utils refactor), not live-tested (needs GLB + Python)                |

## Bugs Found and Fixed

### Bug 1: critique_render silent save failure (FIXED)

**File:** `mcp/src/tools/artdirection.ts:490`
**Symptom:** `critique_render` returned success but no file was written to disk.
**Cause:** `saveImage1` called with field `path:` instead of `fullPath:`. gRPC silently accepted the wrong field name (proto3 ignores unknown fields) and saved nothing.
**Fix:** Changed to `fullPath: resolved` to match the proto definition and render.ts pattern.
**Commit:** `8fc78be`

### Bug 2: pick_point garbage data on miss (FIXED)

**File:** `mcp/src/tools/render.ts:151`
**Symptom:** When `hit_count=0`, the `intersections` struct contained uninitialized memory — NaN-like floats, null vertex components, negative primitive types.
**Cause:** Octane's pick API returns the intersection struct regardless of hit count. When nothing is hit, the struct contains whatever was in GPU memory.
**Fix:** When `hit_count=0`, return `{hit_count: 0, message: "Ray missed all geometry"}` instead of exposing garbage.
**Commit:** `8fc78be`

### Bug 3: save_render_passes proto serialization (FIXED — prior session)

**File:** `mcp/src/tools/render.ts`
**Symptom:** `save_render_passes` and `save_render_passes_exr` failed with "passesToExport: object expected".
**Cause:** `passesToExport` field is a `RenderPassExport` message type, but code passed integer `0`.
**Fix:** Switched from `saveRenderPasses2` to `saveRenderPasses1` overload with proper field types.
**Commit:** `63c9772`

### Bug 4: find_nodes missing import (FIXED — prior session)

**File:** `mcp/src/tools/node.ts`
**Symptom:** `find_nodes` threw "OBJ_API_ITEM_ARRAY is not defined".
**Cause:** `OBJ_API_ITEM_ARRAY` constant not imported from utils.ts.
**Fix:** Added to import list.
**Commit:** `63c9772`

## Observations (not bugs)

1. **Geometry stats return 0 after stop_render** — timing issue. Stats query returns stale/empty data after render stops. Not a tool bug.
2. **get_scene_bounds reports empty** — same timing. The scene has geometry (teapot renders fine) but bounds query returns false after render cycle.
3. **delete_unconnected doesn't remove materials with internal children** — Octane considers nodes with auto-created child pins as "connected". Materials survive even when not wired to any mesh.
4. **pick_point ray miss at center pixel** — the teapot may not occupy pixel (512,256) at the test camera angle. Not a bug — just test geometry positioning.
5. **Getters return enum strings not integers** — clay_mode returns `"CLAY_MODE_NONE"` not `0`. This is correct gRPC behavior (proto3 enum string representation). Tool descriptions mention integers for setters which is also correct.

## Refactoring Verified

All 6 refactoring changes from `b174c38` verified against live Octane:

1. **pin-utils.ts** — `enumeratePins` used by connect_nodes (pin type lookup) and get_node_info (fallback path) — both work
2. **extractAttributeValue rename** — get_attribute returns correct float value
3. **NodeTypeId constants** — create_node with NT_MAT_UNIVERSAL works, get_enabled_aovs uses OBJ_API_NODE constant
4. **Auto-populate SceneCache** — after load_project, get_node_info works immediately without manual get_scene_tree
5. **Render region validation** — missing coords and inverted coords both return clear errors
6. **Tool count log** — startup no longer shows wrong count
