# T7 Critical Review: NT_GEO_GROUP Fixes

Independent verification of Fix 1 (get_node_info cache bypass) and Fix 2 (auto-materialize dynamic pins in connect_nodes).

---

## 1. Fix 1: get_node_info cache bypass (scene.ts line 199-201)

### Code Review

```typescript
const useCache =
  cachedNodeInfo && !(cachedNodeInfo.pins.length === 0 && cachedNodeInfo.movableInputPinCount > 0);
```

**Verdict: CORRECT and COMPLETE.**

- The condition is logically sound. It uses cache for all nodes EXCEPT those with zero static pins AND movable input pins > 0.
- The fallback path (lines 251-329) enumerates pins via gRPC (`pinCount` + `pinNameIx` + `pinTypeIx` + `connectedNodeIx`), which correctly discovers runtime-materialized dynamic pins.
- Covers all 5 affected node types in the cache (NT_GEO_GROUP and 4 others with `pins: []` + `movableInputPinCount > 0`).

**Potential issue:** Nodes that have BOTH static pins and movable pins (e.g. curve nodes with `pinInfoCount: 6` and `movableInputPinCount: 2`) are NOT affected by this fix because `pins.length > 0`. For those nodes, the cache fast path runs and returns only the 6 static pins, missing any runtime-added movable pins. This is a pre-existing limitation, not a regression from this fix, but worth noting.

---

## 2. Fix 2: Auto-materialize dynamic pins (node.ts lines 306-344)

### Code Review

The auto-materialize block:

1. Checks `targetTypeName && cache && pin_id === undefined`
2. Checks `targetInfo.movableInputPinCount > 0 && targetInfo.pins.length === 0`
3. Parses needed count from `pin_name` regex `/(\d+)$/` or `pin_index + 1`
4. Queries current `pinCount` via gRPC
5. If insufficient, calls `setByAttrID(113, AT_INT, neededCount)` + `ApiChangeManager.update()`

**Verdict: CORRECT with identified edge cases.**

### Confirmed correct:

- **A_PIN_COUNT = 113 is verified** in `server/proto/octaneids.proto` line 1091: `A_PIN_COUNT = 113`. This is the canonical Octane attribute ID.
- **AT_INT = 3** matches the expected_type enum used throughout the codebase.
- The `ApiChangeManager.update()` call after `setByAttrID` is essential --- without it, the attribute change is not evaluated and pins don't materialize. This pattern is consistent with how `set_attribute` works elsewhere.
- **Evaluate:false on the setByAttrID call is intentional** --- it defers evaluation to the explicit `update()` call, avoiding the double-evaluation crash documented for `setByAttrID`.

### Edge cases:

**2a. pin_name not matching "Input N" pattern.**
If `pin_name` is e.g. "diffuse" or "geometry", the regex `/(\d+)$/` returns no match and `neededCount` stays at default 1. This is SAFE: the code materializes 1 pin, then `connectTo1("diffuse")` either finds that pin name or fails naturally. For NT_GEO_GROUP, pin names are "Input 1", "Input 2", etc., so the pattern matches. For other movable-input nodes with `movableInputName: "rule"` or `"layer"` or `"render job"`, the runtime names would be "Rule 1", "Layer 1", etc. --- these DO match the regex (trailing digit). **No bug here.**

**2b. pin_id connections bypass auto-materialize entirely.**
Line 310: `pin_id === undefined` means the whole block is skipped when using `pin_id`. This is correct because movable pins don't have static pin IDs. However, CLAUDE.md instructs "always use pin_id for connections," which conflicts. If a caller follows that rule literally for NT_GEO_GROUP, they would need to manually set A_PIN_COUNT first. The test used `pin_name` for geo group inputs and `pin_index` for the RT connection, which worked. **This is a documentation gap, not a code bug.**

**2c. pin_index path.**
If `pin_index: 0` is used, `neededCount = 0 + 1 = 1`. If `pin_index: 5` is used, `neededCount = 6`. This is correct --- pin indices are 0-based, so pin_index N requires at least N+1 pins.

**2d. Silent failure on error.**
The entire auto-materialize block is wrapped in `try/catch` with no error propagation (line 339). If `setByAttrID` fails, the code proceeds to `connectTo1` which will silently fail. This is a pragmatic choice (best-effort) but means a transient gRPC error could cause a confusing "success but nothing renders" scenario. **Acceptable for now but should log a warning.**

**2e. Race condition risk.**
The code calls `setByAttrID(113, ...)` then `ApiChangeManager.update()` then immediately proceeds to `connectTo1`. It assumes pins are synchronously materialized after `update()`. The test passed, and Octane's gRPC API is synchronous (request-response), so `update()` returning means evaluation is complete. **No race condition in practice.**

---

## 3. Render Image Verification

The render at `renders/t7_geogroup_2boxes.png` shows:

- One red box (left, slightly elevated)
- One blue box (right, slightly lower)
- Light grey/white background (daylight environment)
- Both boxes are clearly visible with proper shading

**This confirms both geometry objects passed through the geo group to the render target.**

---

## 4. Causation Analysis

### Can we be sure Fix 2 caused the success?

**Strong evidence FOR causation:**

- The proto file confirms `A_PIN_COUNT = 113` is the correct attribute.
- Earlier test (documented in T7_GEO_GROUP_TEST_RESULTS.md) showed `connectTo1("Input 1")` returned gRPC success but `pinCount` remained 0 --- proving the connection was silently ignored when pins didn't exist.
- After Fix 2, `get_node_info` showed 2 pins with correct connections, and both boxes rendered.
- The recipes (titan_ruin, sword, space_cat, leviathan) all previously required MANUAL `set_attribute(group, 113, AT_INT, 8)` --- this fix automates what was already known to be necessary.

**Alternative explanations considered and rejected:**

- "Maybe something else changed between runs" --- The test was run on a clean `reset_project`, creating all nodes fresh. No other code changes were made between the failing and passing runs.
- "Maybe Octane auto-creates pins on connect" --- Disproven by the earlier test where `connectTo1` succeeded but `pinCount` stayed 0.
- "Maybe the render showed boxes from a different source" --- The test explicitly used geo group as the only geometry path to RT (connected to pin 3). If geo group didn't work, nothing would render.

**Verdict: Causation is well-established.** The fix automates a step that was already documented as required in recipes and confirmed as necessary by the failing test.

### Can we be sure Fix 1 was necessary?

**Moderate evidence:**

- Fix 1 only affects `get_node_info` output (diagnostic tool). It does NOT affect `connect_nodes` behavior.
- Without Fix 1, `get_node_info` would return `pins: []` for geo group even after pins are materialized, making it impossible to verify connections.
- Fix 1 is independently valuable for debugging but is NOT required for the connection to succeed.

**Verdict: Fix 1 is correct and useful but was not necessary for the render to succeed.** It was necessary for the diagnostic step (verifying 2 pins showed up) to work.

---

## 5. Broader Impact Assessment

### Affected node types (pins: [] AND movableInputPinCount > 0):

| Node Type           | movableInputName | movableInputPinCount |
| ------------------- | ---------------- | -------------------- |
| NT_GEO_GROUP        | "input"          | 1                    |
| (render job queue)  | "render job"     | 1                    |
| (layer composite)   | "layer"          | 1                    |
| (some texture node) | "input"          | 2                    |
| (trace set rules)   | "rule"           | 1                    |

All 5 benefit from both fixes. The auto-materialize pattern should work for all of them since their runtime pin names follow "Name N" convention (matching the regex).

### Node types with BOTH static and movable pins:

These (e.g. curve nodes with `pinInfoCount: 6, movableInputPinCount: 2`) have a gap: Fix 1 uses cache (static pins only) because `pins.length > 0`. Fix 2 skips them because `targetInfo.pins.length === 0` is false. If someone adds movable pins to these nodes, the auto-materialize won't trigger. **This is a pre-existing limitation, not introduced by these fixes.**

---

## 6. Summary

| Aspect                               | Verdict                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------- |
| Fix 1 correctness                    | CORRECT --- proper cache bypass for dynamic-pin-only nodes                |
| Fix 2 correctness                    | CORRECT --- A_PIN_COUNT=113 confirmed, logic sound                        |
| Render evidence                      | CONFIRMED --- both boxes visible through geo group                        |
| Causation (Fix 2)                    | STRONG --- multiple lines of evidence, alternative explanations ruled out |
| Causation (Fix 1)                    | MODERATE --- necessary for diagnostics, not for rendering                 |
| Edge case: non-numeric pin_name      | SAFE --- defaults to 1 pin                                                |
| Edge case: pin_id bypass             | CORRECT but undocumented conflict with CLAUDE.md guidance                 |
| Edge case: mixed static+movable pins | PRE-EXISTING GAP --- not addressed, not regressed                         |
| Edge case: error in materialize      | ACCEPTABLE --- best-effort, should add logging                            |

**Overall assessment: Both fixes are correct, well-targeted, and adequately tested. The test evidence supports the conclusions with minor caveats noted above.**
