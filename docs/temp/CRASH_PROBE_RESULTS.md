# Crash Probe Results

**Started:** 2026-03-21
**Octane build:** 2026.1-Alpha5
**Goal:** Systematically discover crash-causing patterns and define guard rules

---

## Test 1: MaterialX Import

- Reps completed: 10/10
- Crashes: 0
- API verification: gRPC proto matches implementation exactly (service, field names, types)
- `list_materialx_nodes`: works (125 categories)
- `import_materialx(use_native_nodes: true)`: 6/6 success
- `import_materialx(use_native_nodes: false)`: 4/4 success
- File used: `test_data/standard_surface_gold.mtlx` (standard_surface with base_color, specular, metalness)
- Handles: 1000001-1000010 (monotonically increasing)
- **Conclusion:** MaterialX import works reliably with this file and Octane build. Previous crash (session 2026-03-20) was likely a different .mtlx file, different scene state, or different Octane build. NOT a fundamental API issue.
- **Note:** Cannot yet rule out crashes with complex .mtlx files (multi-material, textures, node graphs). Would need more test files to be thorough.

---

## Test 2: Stale Handles After load_project

- Reps completed: 5/5
- Crashes: 0
- API verification: `load_project` calls `clearRootGraphCache()` → `SceneCache.clear()` → wipes `_knownHandles`. `gateHandle()` used on every critical tool (set_attribute, get_node_info, connect_nodes, delete_node).
- Operations tested with stale handles: set_attribute, get_node_info, connect_nodes, delete_node
- All correctly GATED with clear error message including known handle count
- Node types tested: NT_RENDERTARGET, NT_MAT_UNIVERSAL, NT_GEO_OBJECT, NT_GEO_GROUP, NT_TEX_FLOAT, NT_GEO_PLACEMENT
- **Conclusion:** Guard works reliably. `clearRootGraphCache` properly invalidates all pre-load handles. No stale handle can reach Octane.

## Test 3: Cross-Type Connection Forcing

- Reps completed: 6 mismatch attempts + 1 valid + 1 same-node-two-pins
- Crashes: 0
- API verification: `connect_nodes` checks source output type vs target pin type via ApiCache or gRPC fallback. Blocks if both known and different.
- Mismatches blocked: PT_MATERIAL→PT_CAMERA, PT_TEXTURE→PT_GEOMETRY, PT_GEOMETRY→PT_KERNEL, PT_MATERIAL→PT_ENVIRONMENT, PT_TEXTURE→PT_CAMERA, PT_GEOMETRY→PT_TEXTURE — all 6 blocked with clear error
- Valid connection (PT_GEOMETRY→PT_GEOMETRY): correctly allowed
- Same node on two pins (placement→geo_group pin 0 AND pin 1): **allowed and verified** — valid Octane behavior (instancing)
- **Conclusion:** Type validation catches all tested mismatches. No false positives (valid connections still work). Same-node-multi-pin is valid and doesn't crash.

## Test 4: Handle Reuse After Delete

- Reps completed: 2/2 (pattern clear, consistent)
- Crashes: 0
- **FINDING: Octane aggressively reuses deleted handle numbers** — both root node handles AND pin child handles get recycled
- Rep 1 reuse examples: 1000141 (was TEX_FLOAT → became MAT_UNIVERSAL), 1000061 (was GEO_OBJECT → became GEO_OBJECT), plus pin handles 1000142, 1000143, 1000144
- Rep 2 reuse examples: 1000103 (was mat pin → became TEX_RGB root), plus pin handles 1000082, 1000078, 1000098
- SceneCache handles this correctly: `delete_node` removes from `_knownHandles`, `create_node` re-adds with correct type
- Verified via `get_node_info` that reused handles report correct new type
- **Conclusion:** Handle reuse is normal Octane behavior. SceneCache correctly tracks type changes. No guard needed — the existing delete→create flow handles it. However, this means **any handle stored externally (e.g., by the LLM) becomes dangerous after the node is deleted** — the same number may point to a completely different node.

## Test 6: Delete Guard Bypass — **NOT DEPLOYED**

- Reps completed: 4/4 — guard bypassed EVERY time
- Crashes: 0 (Octane survived the unguarded deletes)
- **Root cause found:** The delete guard code (`getConnectionsInvolving` check) is in the **working copy** but NOT committed/deployed. The running MCP server uses the committed version which has NO delete guard. `git diff HEAD -- mcp/src/tools/node.ts` confirms the guard is an uncommitted addition from the review session.
- SceneCache connections Map IS working correctly — verified with `octane://scene` resource showing `connectionCount: 1` after `connect_nodes`. Earlier `connectionCount: 0` was because I had deleted the connected nodes (which correctly cleans up connections via `removeNode`).
- **Action needed:** Commit the working copy changes and restart the MCP server for the delete guard to take effect. Then re-test to confirm it blocks.
- **UPDATE (post-restart):** Delete guard now live and working. Confirmed: `Cannot delete handle 1000001 — 1 active connection(s): target pin 1 ← 1000006`. Guard correctly blocks deletion of connected nodes.

## Test 5: Connection Order Dependency

- Reps completed: 2 per ordering × 3 orderings = 6 total builds
- Crashes: 0
- Connections verified: 24/24
- Order A (bottom-up): mat→geo, geo→plc, plc→grp, grp→RT — 2/2 success
- Order B (top-down): grp→RT, plc→grp, geo→plc, mat→geo — 2/2 success
- Order C (interleaved): mixed order with gaps — 2/2 success
- **Conclusion:** Connection order does NOT matter for stability. Octane handles any wiring order correctly. No order-dependent guard needed.

## Test 7: Orphan Chain Deletion

- Reps completed: 2/2
- Crashes: 0
- Build: geo1→plc1→grp:0, geo2→plc2→grp:1, grp→RT
- Disconnected and deleted branch 1 (geo1+plc1), verified branch 2 (geo2+plc2) intact
- `get_node_info(grp)` confirms pin 1 still connected to plc2 after branch 1 deletion
- `set_attribute` on geo2's transform works after sibling deletion
- **Conclusion:** Deleting one branch of a geo group does not corrupt the remaining branch. Safe pattern.

## Test 8: Rapid Connect/Disconnect Cycling

- Reps completed: 10 rapid connect/disconnect cycles on RT pin 3
- Crashes: 0
- Cache coherence: **PERFECT** — after 10 cycles, SceneCache `1000096:3 → 1000105` matches Octane's `get_node_info` pin 3 `connected_handle: 1000105`
- All 10 connects verified=true, all 10 disconnects succeeded
- Total connections in cache after final connect + get_node_info: 11 (1 explicit + 10 auto-created RT children)
- **Conclusion:** Rapid connect/disconnect does NOT desync SceneCache. Cache tracking is accurate.

## Test 11: get_node_info on Children After Connect

- Reps completed: 5/5
- Crashes: 0
- Node type: NT_ENV_DAYLIGHT (has deep child hierarchy: env → sundir → latitude/hour/etc.)
- Pattern: create env → connect to RT pin 1 → immediately query env children → query sundir children → query leaf children
- Tested both `connected_only: true` and `connected_only: false`
- Deepest query: 3 levels (env → sundir → hour float child)
- **Conclusion:** get_node_info on auto-created children immediately after connect does NOT crash in this Octane build. Previously documented crash may have been build-specific or required specific conditions not reproduced here.

## Test 12: Texture Hot-Swap Under Active Render

- Reps completed: 38 swaps across 10 cycles under active render
- Crashes: 0
- Texture types cycled: NT_TEX_RGB, NT_TEX_FLOAT, NT_TEX_CHECKS (RGB ↔ Grayscale ↔ Procedural)
- Target pin: material albedo (pin 2, type PT_TEXTURE)
- Render was actively running (1024x512, 5000 max samples) during all swaps
- All 38 connect_nodes calls verified=true
- **Conclusion:** Texture hot-swap on material pins during active render does NOT crash in this Octane build. All three texture subtypes (RGB, Float, Checks) are compatible on PT_TEXTURE pins — no type conflict. Previously documented crash may have required different conditions (e.g., image textures with file I/O, or different pin types).

## Test 13: Primitive Enum Cycling — **CRASH CONFIRMED**

- Rep 1: **CRASHED at transition 48** (Plane(14)→Box(0)), cycle 7
  - Failing call: `set_attribute(handle=1000253, attr=185, type=3, value=0)`
  - Error: `ECONNRESET on ApiItem.setValueByAttrID`
- Rep 2: Survived 70 transitions (10 full cycles), 0 crashes
- **Pattern: NON-DETERMINISTIC** — crash is not tied to a specific transition pair or count
  - Rep 1 crashed on Plane→Box at #48
  - Rep 2 survived the same transition and count, continuing to 70
- Primitive types tested: Box(0), Cone(3), Cylinder(4), Disk(6), Plane(14), Sphere(20), Torus(22) — all 7 types, full cycle
- **Root cause:** Almost certainly a race condition or memory corruption inside Octane's geometry subsystem when rapidly changing primitive types. The gRPC mutex serializes our calls, but Octane's internal evaluation may not be complete before the next call arrives.
- **Guard recommendation:** Block primitive type changes on NT_GEO_OBJECT entirely. The docs already recommend using NT_GEO_MESH + .obj files instead. Add a guard in `set_attribute` that detects writes to enum children of NT_GEO_OBJECT and rejects them with a message pointing to NT_GEO_MESH as the alternative.

---

## Under-Render Re-Tests

All tests below ran with an active render (1024x512, 100k max samples, ~550M samples/sec) on a scene with RT + camera + kernel + daylight env + geo group with 2 branches (geo+mat+placement each).

### Test 5R: Connection Order under render

- 3 orderings (bottom-up, top-down, interleaved), all verified, 0 crashes
- Connections into the live render graph work in any order

### Test 7R: Orphan Chain under render

- Added 3rd branch to live geo group, disconnected + deleted it while rendering
- Remaining 2 branches intact, render continued
- 0 crashes

### Test 8R: Rapid Connect/Disconnect under render

- 10 rapid connect/disconnect cycles on geo group pin 1 while rendering
- All verified, cache coherent after cycling
- 0 crashes

### Test 9R: Full Scene Coherence Audit under render

- 86 connections in SceneCache, all match Octane's get_node_info
- 7 explicit connections + 79 auto-created pin connections — all correct
- **PERFECT cache coherence under active render**

### Test 10R: Rapid Attribute Mutations under render

- 20 rapid set_attribute calls (10 translation + 10 interleaved T/R/S) while rendering
- All succeeded, final get_attribute values match last-set values exactly
- 0 crashes, no race conditions

### Test 11R: Child Query under render

- Connected NT_ENV_DAYLIGHT to RT pin 1, immediately queried 3 levels deep (env → sundir → hour)
- All queries returned correct data
- 0 crashes

### Test 13R: Primitive Enum under render

- **70 transitions (10 full cycles) under active render — 0 crashes**
- Passed the previous crash point of 48 (without render)
- Confirms non-deterministic nature — render doesn't make it worse or better
- Still a dangerous operation: 1 of 3 total runs crashed (the original no-render run)

---

## Extended Night Testing (Session 2)

### Phase 1: Image Texture Hot-Swap with File I/O

- 28 swaps between NT_TEX_IMAGE (with real .png files) ↔ NT_TEX_RGB ↔ NT_TEX_FLOAT under render
- Files: world_latlong.png, Background.png (actual disk I/O, not just procedural)
- 0 crashes — file-backed textures are safe to hot-swap

### Phase 3: Circular Graph / Cycle Detection

- Self-connection (geo→own pin): blocked by type mismatch
- Self-connection (grp→own pin, types match): Octane's `doCycleCheck` rejected silently, old connection preserved
- A→B→A cycle (plc↔grp): rejected by doCycleCheck
- 3-node cycle (grp→plc_new→grp): rejected by doCycleCheck
- 0 crashes — Octane handles all cycle types safely

### Phase 4: Delete RT While Rendering

- Created RT2 with geometry, started render on it, then disconnected+deleted mid-render
- Octane survived — fell back to RT1, render stopped gracefully
- Delete guard correctly blocked deletion before disconnect (required manual disconnect first)
- 0 crashes

### Phase 5: Disconnect Mid-Evaluation

- Disconnected every level of render graph while render active (RT←grp, grp←plc, plc←geo, geo←mat — 7 pins)
- Reconnected all 7 while render continued
- Render persisted through full teardown+rebuild
- 0 crashes

### Phase 6: Primitive Enum Stress (339 transitions)

- **339 transitions across 48+ cycles — 0 crashes this session**
- Previous crash (48 transitions) was in a different Octane launch
- **REVISED**: Crash rate is lower than initially estimated. May be session/state-dependent rather than inherent. Original estimate of ~1/50 transitions revised to <1/500+
- Still recommend guard since it crashed once historically, but confidence in crash frequency is much lower

### Phase 7: Loaded .orbx Nodes vs Fresh Nodes

- Loaded teapot.orbx, mixed loaded mesh with freshly created geo in same geo group
- Connected fresh nodes to loaded RT, modified loaded kernel attributes
- Disconnect/reconnect loaded mesh + rapid camera changes mid-render
- Loaded nodes behave identically to fresh nodes
- 0 crashes

### Phase 8: High-Rep Build/Teardown Stress

- **20 full create→connect→disconnect→delete cycles** on same geo group pin
- All 20 cycles completed successfully
- Handle reuse confirmed throughout (aggressive recycling of deleted handle IDs)
- 0 crashes

### Phase 9: Complex Subgraph/Duplicate Operations

- Duplicated NT_MAT_UNIVERSAL (38 pin children) — all children duplicated correctly
- Duplicated NT_RENDERTARGET (10 pin children) — success
- Duplicated NT_GEO_GROUP with connected placements — success
- Connected duplicated material to geo, rendered on duplicated RT — worked
- Duplicate+delete mid-render — no crash
- 0 crashes

---

## Summary of Findings

### Tests Passed (safe operations — no guard needed):

| Test | Operation                         | Total Reps                   | Result                   |
| ---- | --------------------------------- | ---------------------------- | ------------------------ |
| 1    | MaterialX import                  | 10                           | Safe                     |
| 2    | Stale handle rejection            | 5                            | Guards work              |
| 3    | Cross-type connection blocking    | 6                            | Guards work              |
| 4    | Handle reuse tracking             | 2                            | Cache correct            |
| 5    | Connection order (3 orderings)    | 9 (6+3 under render)         | Safe                     |
| 6    | Delete guard                      | 1                            | Guard works              |
| 7    | Orphan chain deletion             | 3 (2+1 under render)         | Safe                     |
| 8    | Rapid connect/disconnect          | 20 (10+10)                   | Cache coherent           |
| 9    | Scene coherence audit             | 86 connections               | PERFECT                  |
| 10   | Rapid attribute mutations         | 20                           | Safe                     |
| 11   | Child query after connect         | 6 (5+1 deep)                 | Safe                     |
| 12   | Texture hot-swap (procedural)     | 38 swaps                     | Safe                     |
| P1   | Image texture hot-swap (file I/O) | 28 swaps                     | Safe                     |
| P3   | Cycle detection (self/2/3-node)   | 4 tests                      | Octane catches all       |
| P4   | Delete RT while rendering         | 1                            | Safe (graceful fallback) |
| P5   | Disconnect mid-evaluation         | 7 disconnects + 7 reconnects | Safe                     |
| P6   | Primitive enum stress             | **339 transitions**          | 0 crashes this session   |
| P7   | Loaded .orbx + fresh node mixing  | 6 operations                 | Safe                     |
| P8   | Build/teardown stress             | 20 full cycles               | Safe                     |
| P9   | Subgraph duplicate operations     | 5 operations                 | Safe                     |

### Crash History:

| Test  | Operation              | Crash Count | Total Attempts   | Rate                 |
| ----- | ---------------------- | ----------- | ---------------- | -------------------- |
| 13/P6 | Primitive enum cycling | 1 crash     | ~460 transitions | <0.2% per transition |

### Proposed Guard Rules:

1. **Warn on primitive type changes on NT_GEO_OBJECT** — crash rate is low (<0.2%) but non-zero. Consider warning instead of blocking, since 339+ transitions survived without issue this session. The crash may be session/state-dependent.
2. **Delete guard (implemented + deployed)** — `getConnectionsInvolving` check before deletion. Confirmed working.

### Key Conclusions:

1. **Active rendering does NOT increase crash risk** for any operation tested
2. **Loaded .orbx nodes behave identically to fresh nodes** — no special handling needed
3. **Cache coherence is perfect** across all tested scenarios (86 connections audited)
4. **Octane's cycle detection works** — self-loops and multi-node cycles are caught
5. **Primitive enum crash is rare** (<0.2% per transition, possibly session-dependent) — previously over-estimated at ~2% based on limited data
6. **All guards (handle validation, type checking, delete protection) are functioning correctly**

---
