# T7: Geo Group Dynamic Pin Test Results

**Date**: 2026-03-12
**Test**: NT_GEO_GROUP connections via gRPC/MCP
**Status**: PASS (with caveats)

## Root Cause

NT_GEO_GROUP (and 4 other "pure movable" node types) start with **0 runtime pins**.
The C API requires `A_PIN_COUNT` (attribute ID 113, AT_INT) to be set to N to
materialize N dynamic input slots ("Input 1", "Input 2", etc.) before any
connection can stick.

Without this, `connectTo1("Input 1")` returns success but silently does nothing
because the pin doesn't exist yet.

## Fixes Applied

### Fix 1: `mcp/src/tools/scene.ts` (get_node_info)

**Problem**: Cache fast path iterates `cachedNodeInfo.pins` which is `[]` for
movable-input nodes. Always returned `pins: []` without querying gRPC.

**Fix**: Added `useCache` check at line 199:

```typescript
const useCache =
  cachedNodeInfo && !(cachedNodeInfo.pins.length === 0 && cachedNodeInfo.movableInputPinCount > 0);
```

When false, falls through to gRPC fallback which discovers runtime pins via
`ApiNode.pinCount` / `pinNameIx` / `pinTypeIx`.

### Fix 2: `mcp/src/tools/node.ts` (connect_nodes)

**Problem**: Connecting to a movable-input node returns "success" but the pin
doesn't exist yet, so nothing actually connects.

**Fix**: Added auto-materialize block at lines 306-344. Before connecting:

1. Detect movable-input target via cache (`movableInputPinCount > 0 && pins.length === 0`)
2. Parse needed pin count from `pin_name` ("Input N" → N) or `pin_index` (index+1)
3. Read current `ApiNode.pinCount`
4. If insufficient, set `A_PIN_COUNT` (113) via `setByAttrID` + `ApiChangeManager.update()`

## Test Evidence (Visual Proof)

All tests run on a clean scene (reset_project), fresh node creation.

| Test | Description                        | Render                                  | Result                            |
| ---- | ---------------------------------- | --------------------------------------- | --------------------------------- |
| 1    | Red box → Input 1 → geo group → RT | `renders/t7_test1_input1_red_box.png`   | PASS - red box visible            |
| 2    | + Green box at x=3 → Input 2       | `renders/t7_test2_input2_green_box.png` | PASS - red + green visible        |
| 3    | + Blue box at z=-3 → Input 3       | `renders/t7_test3_three_inputs.png`     | PASS - red + green + blue visible |

Scene saved: `ORBX/t7_three_inputs_pass.orbx`

## Key Discoveries

- **A_PIN_COUNT = 113** controls dynamic pin materialization on movable-input nodes
- **A_TRANSLATION = 172** (AT_FLOAT3) on NT_TRANSFORM_VALUE moves geo objects
- **pin_index: 3** works for RT mesh pin; `pin_id: 59` (P_GEOMETRY) was unreliable in earlier tests (inconclusive)
- **connectTo1("Input N")** works for geo group connections once pins are materialized
- **get_node_info** correctly reports runtime pins after the cache-skip fix

## Critical Audit Findings (from independent agent review)

### What works

- The fixes are correct for the 5 "pure movable" node types (pins=[] + movableInputPinCount>0)
- Test evidence is legitimate — 3 distinct objects with distinct colors at distinct positions

### Known limitations

1. **Mixed movable-input nodes NOT covered**: 19 node types have BOTH static AND dynamic pins (e.g. NT_MAT_COMPOSITE, NT_TEX_GRADIENT). Neither fix handles these because their `pins.length > 0`. Their dynamic pins will be missed by get_node_info and not auto-materialized by connect_nodes.

2. **pin_id exclusion is correct but undocumented**: Auto-materialize is skipped when `pin_id` is used (line 310: `pin_id === undefined`). This is correct because movable pins don't have static pin IDs. But CLAUDE.md says "always use pin_id" which conflicts. Callers must use `pin_name` or `pin_index` for movable-input nodes.

3. **No fallback without cache/handleToTypeName**: If the cache is null or the target handle isn't tracked (e.g. node from a loaded scene), auto-materialization is skipped entirely.

4. **No post-materialization verification**: Code trusts that `A_PIN_COUNT` + `update()` creates pins synchronously. If Octane evaluates asynchronously, a race condition could occur.

5. **Silent failure on A_PIN_COUNT error**: Wrapped in try/catch, proceeds to connect anyway with no indication to caller.

## Affected Node Types

### Pure movable (pins=[], fixed by these changes):

- NT_GEO_GROUP
- NT_MAT_LAYER_GROUP
- NT_RENDER_JOB_GROUP
- NT_TRACE_SET_VISIBILITY_RULE_GROUP
- NT_VERTEX_DISPLACEMENT_MIXER

### Mixed movable (have static + dynamic pins, NOT fixed):

- NT_MAT_COMPOSITE, NT_TEX_GRADIENT, NT_GEO_DECAL, and ~16 others

## Previous Test Failure Explained

The earlier session's failure (Input 2 appeared connected in get_node_info but
didn't render) was caused by:

1. No `A_PIN_COUNT` set — pins weren't materialized
2. `connectTo1("Input 1")` returned "success" but did nothing (pin didn't exist)
3. get_node_info's cache bug returned `pins: []`, hiding the problem
4. The test was running on stale/bad server state from multiple failed attempts

The "geo groups are broken via gRPC" conclusion was wrong — they work fine once
pins are materialized first.
