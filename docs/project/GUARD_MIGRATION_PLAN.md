# Guard Migration Plan: Centralize Validation in octaneServGrpc

## Context

Bug: `ApiItem.attrInfo` returns raw numeric attribute types (e.g. `32759`) for nodes with exotic/internal types. The C++ proxy passes these through unvalidated. The webapp client receives `type: "32759"` (protobuf stringifies unknown enum values as raw integers), fails to map it to a known `AT_*` key, and calls `getValueByAttrID` with `expected_type: undefined` — producing 56 errors per scene load.

Root cause: validation is scattered across three layers (serv, MCP, client) instead of being centralized at the proxy. The proxy is the single choke point — every request and response flows through it. All validation belongs there.

## Architecture

```
Browser (octaneWebR/client) → HTTP → octaneServGrpc (Node.js proxy) → gRPC → Octane C++ SDK
```

- **octaneServGrpc** = the wall. Validates requests in, normalizes responses out.
- **octaneWebR/mcp** = MCP tools for AI. Should trust serv responses.
- **octaneWebR/client** = webapp UI. Should trust serv responses.

## Current State

### octaneServGrpc (C++ proxy) — already validates:

- Handle zero/stale/type-downcast checks (requireItem/requireGraph/requireNode)
- Bounds checking (pin/array/device/attribute indices)
- String empty checks (paths, pin names)
- Enum range checks (clay mode 0-3, render priority 0-2)
- Attribute type dispatch in getValueByAttrID (AT\_\* → proto field)
- Camera up vector normalization
- Exception wrapping on all RPCs (GRPC_SAFE_BEGIN/END)
- **MISSING: Response enum normalization** (raw SDK enum values pass through unchecked)

### octaneWebR/mcp — guards that should migrate to serv:

- hasAttr pre-checks before get/set (attribute.ts)
- buildValueParams type→proto field mapping (duplicates serv dispatch)
- Pin type mismatch detection on connect (node.ts)

### octaneWebR/client — defensive checks that become unnecessary once serv hardened:

- AttrType enum membership check in SceneService.ts (the band-aid fix)
- asObject/asNumber/asBool/asString coercion on every response
- Oneof field detection (trying 8+ field names per response)
- Response shape validation everywhere

## Migration Plan

Each step: move one guard → validate at serv → confirm client/MCP version is redundant → remove. One change, one verify, then next.

### Phase 1: Response Normalization (the bug that started this)

**Step 1.1** — Normalize `attrInfo` response enum values in grpc_server.cpp

- In the `attrInfo` RPC handler, validate `mType` against known `AttributeType` values
- Unknown values → map to `AT_UNKNOWN` before serializing to proto
- File: `octaneServGrpc/src/grpc_server.cpp`, attrInfo handler
- Verify: reload webapp, create Daylight environment, check 0 console errors

**Step 1.2** — Normalize all enum fields in responses (NodePinType, NodeGraphType, NodeType)

- Audit every response that includes enum fields
- Add normalization for pin types, node types, graph types
- Unknown values → map to respective \_UNKNOWN variant

**Step 1.3** — Remove client-side band-aid

- Revert SceneService.ts `attrType in AttrType` check back to simple `!== 'AT_UNKNOWN'`
- The serv now guarantees only valid enum strings reach the client
- Keep the `Logger.warn` for unsupported types as defense-in-depth

### Phase 2: Request Validation (guards on the way in)

**Step 2.1** — ~~Validate `expected_type` in getValueByAttrID~~ SKIPPED

- Serv dispatches from SDK's own `info.mType`, not client's `expected_type` — field is advisory/unused
- Already handles unknown attrs via `hasAttr()` → empty OK
- Already catches SDK exceptions → empty OK
- No change needed — dispatch-from-SDK pattern is correct

**Step 2.2** — ~~Validate attribute_id in get/set calls~~ SKIPPED

- Already handled: `hasAttr()` returns false for unknown IDs → empty OK response
- SDK also rejects invalid IDs in its own exception handler

**Step 2.3** — Validate node_type in create calls ✅ DONE

- Added `NodeType_IsValid(rawType)` + reject NT_UNKNOWN(0) before `ApiNode::create`
- Returns INVALID_ARGUMENT with clear message for unknown types
- Previously: unknown type → SDK null return → vague "failed to create" error

### Phase 3: Migrate MCP Guards to Serv

**Step 3.1** — hasAttr pre-check in serv ✅ DONE

- `getValueByAttrID` already checks `hasAttr()` internally → empty OK for missing attrs
- Added `hasAttr()` check to `setValueByAttrID` → INVALID_ARGUMENT for missing attrs
- MCP hasAttr round-trips now redundant (can remove later, saves 1 gRPC call per get/set)

**Step 3.2** — ~~Move pin type mismatch check into serv~~ DEFERRED

- Would require extra SDK calls (source->outType + node->pinTypeIx) on every connect
- SDK already handles mismatches (silent no-op or exception, caught by GRPC_SAFE)
- MCP advisory check provides clearer error messages to the AI agent
- Leave in MCP as defense-in-depth — not worth the perf cost in serv

**Step 3.3** — ~~Move buildValueParams type mapping into serv~~ SKIPPED

- Serv dispatches on proto oneof case, not expected_type — mapping is a client concern
- Client/MCP must set the correct oneof field in the proto message regardless
- No serv change needed — proto schema enforces correctness

### Phase 4: Simplify Client

**Step 4.1** — Remove redundant client-side coercion ✅ DONE (partial)

- Removed `attrType in AttrType` membership check (Step 1.3) — serv guarantees valid enums
- Kept asObject/asNumber/asBool/asString helpers — good TypeScript type narrowing, not guards
- Kept `AT_UNKNOWN` exclusion — semantically correct (don't load values for unknown types)
- Error downgrade in ApiService.ts + useParameterValue.ts already done (Step 1.1 era)

**Step 4.2** — ~~Simplify oneof field detection~~ DEFERRED

- Would require proto schema change (add value_type indicator field to getValueResponse)
- Larger refactor — not justified by current bug count (0 errors after Phase 1-3)
- Current 8-field oneof detection works correctly, just verbose

## Verification

After each step — check ALL 3 log files, no exceptions:

1. FRESH reset_project
2. Create scene with Daylight environment (triggers exotic types)
3. `log_client.log` — 0 errors
4. `log_grpc.log` — no ERR lines
5. `log_mcp.log` — clean
6. Full DRESS build: no regressions
