# MCP Docs & Tools Review — Glass & Metal Recipe Test

**Date:** 2026-03-20
**Recipe:** `docs/recipes/glass_metal_RECIPE.md`
**Result:** 3 Octane crashes in ~15 minutes, scene never completed

## Crash Log

| #   | Call                                                                                                             | Error                       | Documented?                          |
| --- | ---------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------ |
| 1   | `set_attribute(enum, A_VALUE=185, AT_INT=3, 20)` — changing NT_GEO_OBJECT primitive to Sphere                    | ECONNRESET                  | Yes — "non-deterministic crash risk" |
| 2   | `get_node_info(1000066)` on sundir PT_FLOAT child of NT_ENV_DAYLIGHT, immediately after `connect_nodes(env→RT)`  | ECONNRESET                  | No                                   |
| 3   | `start_render(RT)` after full connect chain (mesh→placement→geoGroup→RT), all connects reported `verified: true` | ECONNREFUSED (silent death) | No                                   |

## What Worked Well

1. **Tool descriptions are excellent.** `create_node`, `connect_nodes`, `set_attribute`, `set_camera` all have clear parameter docs, common values inline, and warnings about gotchas (DOF default, emission efficiency, transform child handles). Never had to guess what a parameter meant.

2. **`verified: true` connection verification** gives confidence that wiring succeeded without needing a separate `get_node_info` check.

3. **File path validation** on `set_attribute(A_FILENAME)` caught `sphere.obj` not existing before sending to Octane — saved from the 30-second blocking dialog hang.

4. **Crash type ID blocklist** works — never hit those IDs. Good preventive measure.

5. **CLAUDE.md rules and DRESS protocol** are clear about build order (camera first, geo second, render after each step). Intent is solid.

## What Didn't Work

1. **REFERENCE.md lists assets that don't exist.** It says `sphere.obj, sphere_uv.obj, cube.obj, torus.obj` but only `sphere_hd.obj` and `floor.obj` are actually in `ORBX/assets/`. Sends you down a dead path immediately.

2. **NT_GEO_OBJECT primitive type change is documented as crash risk but still the primary recommended method.** If it crashes, the docs should lead with the .obj mesh approach. The recipe says "sphere" with no guidance on which method to use.

3. **Crash #2 (get_node_info on float child) is undocumented.** TROUBLESHOOTING.md lists crash type IDs but doesn't warn about `get_node_info` on internal float/enum children of environment nodes. The daylight workflow requires drilling into `sundir→pin4→hour→child` but `get_node_info` on the sundir child crashed Octane.

4. **Crash #3 (silent death during connect chain) is the scariest.** All connects reported `verified: true`, then `start_render` got ECONNREFUSED. Octane died silently mid-chain with no error on any individual call. No doc covers this.

5. **Mesh wiring chain is tedious and fragile.** For one sphere: create mesh → set filename → reload → create placement → connect mesh→placement → create geo group → set pin count → connect placement→group → connect group→RT. **8 calls** per object, each a crash opportunity.

6. **No safe daylight configuration path.** Docs say to set hour/turbidity/north offset but navigating the nested pin hierarchy requires `get_node_info` calls on child nodes that crash Octane.

## Priority Issues

| Priority | Issue                                                  | Details                                                                                                                                                           |
| -------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0-1** | No mesh assets in repo                                 | Only `sphere_hd.obj` and `floor.obj` exist. 11 of 13 listed primitives are missing. Blocks all recipes.                                                           |
| **P1-1** | Silent Octane death during state updates / connections | Crash #3 — all connects `verified: true`, Octane dead at next call. Not primitive-specific. Root cause is likely evaluation cascades during rapid state mutation. |
| **P1-2** | REFERENCE.md asset list is inaccurate                  | Docs list files that don't exist, sending builders into immediate errors.                                                                                         |

## Bottom Line

The docs are well-written and tool descriptions are genuinely helpful. But **Octane's gRPC stability is the bottleneck, not the docs.** 3 crashes in 15 minutes means you can't reliably build a 4-object scene. The docs describe workflows that require operations Octane can't survive.

The biggest gap is between what the docs _promise_ (a step-by-step build workflow) and what Octane _delivers_ (random crashes on routine API calls).

Recipes are nice creative briefs but they assume a stable build path that doesn't exist yet. A recipe should probably include a "tested build order" section with the exact calls that succeeded, not just ingredient values.
