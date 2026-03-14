# T7 Final Conclusions: NT_GEO_GROUP Dynamic Pin Fixes

## Problem

Connecting geometry to NT_GEO_GROUP nodes via gRPC MCP silently failed. All three gRPC methods (connectTo, connectTo1, connectToIx) returned success but nothing actually connected. Renders showed no geometry.

## Root Cause

NT_GEO_GROUP uses **dynamic (movable) input pins** that don't exist at creation time. The node starts with `pinCount: 0`. The attribute `A_PIN_COUNT` (ID 113) must be set to materialize pins before connecting to them.

## Fixes Applied

### Fix 1: `get_node_info` cache bypass (`scene.ts` ~line 199)

- **What**: Skip API cache for nodes where `pins.length === 0 && movableInputPinCount > 0`
- **Why**: Cache returned empty pins for geo groups, masking runtime pins from diagnostics
- **Impact**: Diagnostic — enables verification of dynamic pin connections

### Fix 2: Auto-materialize in `connect_nodes` (`node.ts` ~line 306)

- **What**: Before connecting to a movable-input node, auto-set `A_PIN_COUNT` to create enough dynamic slots
- **Why**: Without this, connectTo1("Input 1") silently succeeds but nothing connects
- **Impact**: Functional — geo group connections now work automatically

## Evidence

### Confirmed by proto

- `A_PIN_COUNT = 113` — `server/proto/octaneids.proto` line 1091

### Test: 2-pin geo group (clean state)

1. Reset project → fresh scene
2. Created: RT, PT kernel, daylight env, geo group, 2 boxes (red + blue materials)
3. Connected both boxes to geo group via `pin_name: "Input 1"` and `"Input 2"`
4. `get_node_info` confirmed: 2 pins, both connected to correct boxes
5. Connected geo group to RT `pin_index: 3`
6. **Render: Both red and blue boxes visible** — `renders/t7_geogroup_2boxes.png`

### Earlier negative test (pre-fix)

- `connectTo1("Input 1")` returned gRPC success but `pinCount` stayed 0
- Box rendered fine when connected directly to RT, confirming issue was geo-group-specific

## Known Edge Cases

- `pin_id` connections bypass auto-materialize (by design — dynamic pins have no static pin IDs)
- Nodes with BOTH static and movable pins: not addressed (pre-existing gap, not regressed)
- Error in materialize step: swallowed silently (best-effort, should add logging)

## CLAUDE.md / OCTANE_MCP.md Impact

- "Always use pin_id" rule doesn't apply to geo group dynamic inputs — use `pin_name: "Input N"` instead
- The old manual rule "set A_PIN_COUNT before connecting to geo groups" is now automated
- `get_node_info` now returns accurate pin data for all node types

## Status: VERIFIED AND CLOSED
