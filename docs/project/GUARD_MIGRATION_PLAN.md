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

**Step 2.1** — Validate `expected_type` in getValueByAttrID

- Reject requests with unknown/missing expected_type before forwarding to SDK
- Return INVALID_ARGUMENT with clear message instead of cryptic SDK error
- File: grpc_server.cpp, getValueByAttrID handler

**Step 2.2** — Validate attribute_id in get/set calls

- Check attribute_id is in known range before forwarding
- Return clear error for unknown attribute IDs

**Step 2.3** — Validate node_type in create calls

- Check node_type against known NodeType enum before forwarding
- Currently done in MCP (ApiCache.getNodeTypeId) — move to serv

### Phase 3: Migrate MCP Guards to Serv

**Step 3.1** — Move hasAttr pre-check into serv

- serv already has attrInfo — can check hasAttr internally
- get/set calls that reference missing attributes → INVALID_ARGUMENT from serv
- MCP can remove hasAttr round-trip (saves 1 gRPC call per set_attribute)

**Step 3.2** — Move pin type mismatch check into serv

- connectToIx/connectTo1 should validate source output type vs target pin type
- Return INVALID_ARGUMENT on mismatch instead of silent connection
- MCP can remove its pin type validation code

**Step 3.3** — Move buildValueParams type mapping into serv

- serv already has the AT\_\* → proto field dispatch
- If client sends wrong field for the type, serv should reject or auto-correct
- MCP/client can simplify their set calls

### Phase 4: Simplify Client

**Step 4.1** — Remove redundant client-side coercion

- With serv guaranteeing clean responses, client can trust enum strings
- Remove defensive String() coercion, type membership checks
- Keep asObject/asNumber helpers (good practice) but remove enum validation

**Step 4.2** — Simplify oneof field detection

- serv should standardize response format (always include `value` indicator field)
- Client can use single-path extraction instead of trying 8+ field names

## Verification

After each step — check ALL 3 log files, no exceptions:

1. FRESH reset_project
2. Create scene with Daylight environment (triggers exotic types)
3. `log_client.log` — 0 errors
4. `log_grpc.log` — no ERR lines
5. `log_mcp.log` — clean
6. Full DRESS build: no regressions
