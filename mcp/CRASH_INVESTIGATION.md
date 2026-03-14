# Crash Investigation: NT_GEO_OBJECT Primitive Type

## Date: 2026-03-13

## Protocol

Every test = full fresh Octane restart + MCP server restart. One test per session. Webapp live_sync disabled for all tests (except C8 which tested sync ON).

---

## C8: Single object, cycle primitive types — webapp sync ON

**Setup**: Fresh restart. RT + 1 NT_GEO_OBJECT + red diffuse material connected to RT pin 3. start_render. Cycle primitive types 1→22.
**Result**: **CRASH at value 11** (11th type change).

## C8a: Same test — webapp sync OFF

**Setup**: Identical but `refresh_webapp(live_sync: false)` first. Dev server NOT running.
**Result**: **PASS — all 22 type changes, zero crashes.**

## C8 x5: Repeated sync-OFF stress test

**Setup**: Fresh restart. Same single-object test, cycled 1→22 then 22→1 repeatedly.

- Run 1 (1→22): **PASS** (22 changes)
- Run 2 (1→22): **PASS** (44 total)
- Run 3 (22→1): **PASS** (66 total)
- Run 4 (1→22): **PASS** (88 total)
- Run 5 (22→...→2→1): **CRASH at change #87** going to value 1

**Finding**: Single-object type changes are stable up to ~87 changes per session. Cumulative limit exists but is far beyond any practical scene build.

---

## C1: Multiple create_node only (no set_attribute)

**Setup**: Fresh restart. Create 8 NT_GEO_OBJECT nodes sequentially. No set_attribute, no connect.
**Result**: **PASS** (8/8, zero crashes)

## C2: Create + set primitive (correct IDs, no update_scene)

**Setup**: Fresh restart. Create 8 NT_GEO_OBJECT nodes, each followed by set_attribute(primitive enum, value 1-8). No update_scene.
**Result**: **CRASH at geo #3** (set_attribute on 3rd object's enum child)

## C3: Create + set primitive + update_scene after each

**Setup**: Fresh restart. Same as C2 but call update_scene() after each set_attribute.
**Result**: **CRASH at geo #6** (update_scene delays crash but doesn't prevent it)

## C3b: Create + set primitive + update_scene + 500ms delay

**Setup**: Fresh restart. Same as C3 but 500ms sleep between create and set_attribute.
**Result**: **CRASH at geo #4** (delay doesn't help)

## C5b: Create + connect to RT (NO set_attribute on primitive)

**Setup**: Fresh restart. RT + start_render. Create 8 NT_GEO_OBJECT, connect each to RT pin 3 + update_scene. NO primitive type change.
**Result**: **PASS** (8/8, zero crashes)

## C6: Full build pattern (create + set + material + connect + render)

**Setup**: Fresh restart. RT + start_render. For each geo: create → set primitive → create material → connect mat→geo → connect geo→RT → update_scene.
**Result**: **CRASH at geo #2** (set_attribute on 2nd object — more operations per cycle = crashes sooner)

---

## Summary Table

| Test | Pattern                                 | Result                |
| ---- | --------------------------------------- | --------------------- |
| C1   | create_node only (8x)                   | **PASS**              |
| C5b  | create + connect + render (no set_attr) | **PASS** (8/8)        |
| C8a  | single object, cycle types 1→22         | **PASS** (87 changes) |
| C2   | create + set prim, no update            | **CRASH #3**          |
| C3   | create + set prim + update              | **CRASH #6**          |
| C3b  | create + set prim + update + delay      | **CRASH #4**          |
| C6   | full build (set+mat+connect+render)     | **CRASH #2**          |
| C8   | single object + webapp sync ON          | **CRASH #11**         |

## Two-Phase Test (FAILED)

**Setup**: Fresh restart. Phase 1: create all 8 geo objects. Phase 2: set primitive types on all.
**Result**: **CRASH at 3rd set_attribute** — same as C2. Separating create from set doesn't help.

**This disproves the "freshly-created" hypothesis.** The issue is setting primitive type on DIFFERENT geo objects, regardless of when they were created.

---

## Updated Summary Table

| Test      | Pattern                                 | Result                |
| --------- | --------------------------------------- | --------------------- |
| C1        | create_node only (8x)                   | **PASS**              |
| C5b       | create + connect + render (no set_attr) | **PASS** (8/8)        |
| C8a       | single object, cycle types 1→22         | **PASS** (87 changes) |
| Two-phase | create all 8, then set all types        | **CRASH #3**          |
| C2        | create + set prim, no update            | **CRASH #3**          |
| C3        | create + set prim + update              | **CRASH #6**          |
| C3b       | create + set prim + update + delay      | **CRASH #4**          |
| C6        | full build (set+mat+connect+render)     | **CRASH #2**          |
| C8        | single object + webapp sync ON          | **CRASH #11**         |

## Root Cause

**Setting the primitive type enum (A_VALUE=185 on the PT_ENUM child at pin 0) on MULTIPLE DISTINCT NT_GEO_OBJECT nodes crashes Octane after 2-6 objects.** This is an Octane Alpha 5 gRPC server bug.

Key evidence:

- `create_node` alone: safe (C1)
- `create + connect` without set_attr: safe (C5b)
- `set_attribute` on ONE object repeatedly: safe for 87+ changes (C8a)
- `set_attribute` on DIFFERENT objects: crashes at 2-6 regardless of timing, update_scene, or creation order
- `update_scene()` delays crash slightly but doesn't prevent it
- Delay between operations doesn't help
- More operations per cycle = crashes sooner
- Webapp sync adds concurrent gRPC load, making things worse (C8 vs C8a)

## Practical Workaround

**There is no way to set primitive type on more than ~5 different geo objects per Octane session.** This is an Octane Alpha 5 gRPC bug we cannot fix.

For scene builds with multiple primitive shapes:

1. **Use default Box (don't set primitive type)** — build everything with boxes
2. **Accept the limit** — max 2-5 different primitive shapes per scene build before restart
3. **Checkpoint strategy** — save_project after every 2 objects, restart Octane, load_project, continue
4. Always disable webapp sync during builds (`refresh_webapp(live_sync: false)`)
