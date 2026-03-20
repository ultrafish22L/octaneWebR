# OctaneWebR MCP Server — Critical Review

## Executive Summary

Your MCP is a **1,631-line TypeScript server wrapping 27 tools** over Octane's gRPC API via STDIO transport. The architecture is fundamentally sound — thin wrapper, single responsibility, sequential mutex, crash detection. But measured against MCP best practices (Anthropic spec, Striim framework, GitHub Copilot learnings, OWASP), there are structural gaps that limit agent effectiveness and safety.

**Verdict: solid foundation, needs a second pass focused on agent ergonomics, not just API coverage.**

---

## Grade Card

| Category            | Grade  | Notes                                                                         |
| ------------------- | ------ | ----------------------------------------------------------------------------- |
| Architecture        | **A-** | Clean module split, correct transport, single gRPC connection, crash recovery |
| Tool Granularity    | **C+** | Too imperative — maps 1:1 to gRPC ops, forces multi-step for basic tasks      |
| Tool Descriptions   | **C**  | Functional but missing domain knowledge, examples, preconditions              |
| Error Handling      | **B**  | Crash detection is excellent; silent failures not caught at MCP layer         |
| Input Validation    | **B-** | Zod schemas present but don't enforce crash-prevention rules                  |
| Security            | **D+** | Localhost assumption is fine for now, but no path enforcement in MCP layer    |
| State Management    | **B**  | Handle cache + root graph cache; no scene graph cache                         |
| Observability       | **A-** | Debug log + profiling system; missing structured audit trail                  |
| Documentation       | **A**  | Extensive external docs; should be IN the tool descriptions                   |
| Response Efficiency | **C**  | Full JSON dumps waste context window tokens                                   |

---

## Critical Findings

### 1. Tool Descriptions Don't Encode Domain Knowledge (HIGH IMPACT)

Your CLAUDE.md has 15+ hard-won rules (pin_index vs pin_id, crash type IDs, DOF default, emission efficiency). **None of this is in the tool descriptions.** Every new AI session must rely on CLAUDE.md being loaded — which only works in Claude Code. Any other MCP client (Cursor, Windsurf, a custom agent) gets zero domain knowledge.

**The fix:** Tool descriptions ARE prompts. Embed the critical rules:

```typescript
// CURRENT (connect_nodes)
'Connect a source node to a target node pin';

// SHOULD BE
'Connect a source node to a target node pin. IMPORTANT: Always use pin_index, never pin_id (pin_id silently fails on RT geometry pin 59 and mesh material pin 30). For RT: pin_index 0=camera, 1=environment, 3=geometry, 4=film, 6=kernel. Always verify connections after with get_node_info — success:true does not guarantee the connection worked.';
```

This single change would prevent the most common failure mode in your MCP.

### 2. Missing Compound/Workflow Tools (HIGH IMPACT)

GitHub Copilot found that **fewer, smarter tools outperform many granular ones**. Your 27 tools require 4-7 calls for basic operations:

**Create a material on a mesh today:**

1. `create_node` (material)
2. `set_attribute` (diffuse color)
3. `set_attribute` (roughness)
4. `connect_nodes` (material → mesh pin 0)
5. `get_node_info` (verify)

Each call is a round-trip through the LLM → MCP → gRPC → Octane chain. Each is a failure point.

**Recommended compound tools:**

- **`create_and_connect`** — create node + wire it in one call (covers 80% of create_node usage)
- **`setup_material`** — create material, set properties, connect to mesh
- **`setup_light`** — create light, set emission/power/position, connect to RT
- **`build_object`** — create mesh + material + placement, wire everything, connect to geo group

Keep all 27 atomic tools for edge cases. Add 3-4 compound tools for the happy path.

### 3. Silent Failures Not Caught at MCP Layer (HIGH IMPACT)

The `connect_nodes` tool returns `success: true` from gRPC even when connections silently fail. Your docs say "always verify connections" — but the tool itself doesn't verify. **Post-mutation verification should be automatic:**

```typescript
// After connect_nodes succeeds, auto-verify:
const nodeInfo = await client.callMethod('OctaneEngine', 'nodeInfo', { handle: target_handle });
const pin = nodeInfo.pins[pin_index];
if (pin.connected_handle === 0) {
  return errorResult(
    `Connection appeared to succeed but pin ${pin_index} shows no connection. ` +
      `Try pin_index instead of pin_id, or check pin type compatibility.`
  );
}
```

### 4. Crash-Causing Inputs Not Blocked at MCP Layer (MEDIUM)

You document 10 node type IDs that crash Octane on `nodeInfo`, and `reset_project` that pops a blocking dialog. But these are only documented — they're not blocked in code:

- `create_node` should reject crash type IDs `[0, 116, 408, 40000, 50000, 50106-50108, 50136-50137]`
- `reset_project` should warn/block without prior `save_project`
- `set_attribute` with `A_FILENAME` should validate path exists before sending to gRPC

The MCP server should be the **enforcement layer**, not just a passthrough with documentation.

### 5. Response Bloat (MEDIUM)

`get_scene_tree` and `get_node_info` dump full JSON into the context window. Every extra field the agent doesn't need is wasted context budget.

- `get_node_info` returns all pins even when the agent only needs connected ones
- `get_scene_tree` returns full subtrees when the agent often just needs handle + type + name
- `list_node_types` returns 724 types when the agent typically needs a filtered subset

Consider: compact response formats, connected-only pin filtering, and progressive disclosure (summary first, details on request).

### 6. No MCP Resources (LOW-MEDIUM)

The MCP spec defines three primitives: **Tools** (actions), **Resources** (read-only data), **Prompts** (instruction templates). You only use Tools.

Node type catalogs, pin layout tables, material presets, and camera presets are **Resources** — safe, idempotent, cacheable reads. Exposing them as Resources signals to the LLM that these are safe to call freely without side effects.

### 7. No `OCTANE_FILE_ROOTS` Enforcement in MCP (LOW)

The web server enforces `OCTANE_FILE_ROOTS` for path traversal prevention. The MCP server doesn't. `load_project`, `save_project`, and `save_render` pass paths directly to gRPC. Since MCP runs via STDIO (trusted local process), this is low risk — but it's an inconsistency.

---

## Strengths Worth Keeping

1. **Mutex serialization** — Correct for Octane's single-threaded message pump. Don't remove.
2. **Crash detection + recovery** — `enhanceCrashError()` with pattern matching and state clearing is excellent.
3. **ApiCache** — Static metadata for 724 node types avoids runtime gRPC overhead. Good pattern.
4. **Profiling system** — Built-in performance tracking with per-method breakdown is rare for MCP servers.
5. **Deferred eval warning** — Tracking pending evaluations and warning at threshold prevents a real crash scenario.
6. **Module organization** — 9 tool files by domain (info, project, camera, render, scene, node, attribute, webapp, utils) is clean.

---

## Comparison to Industry Benchmarks

| Benchmark               | OctaneWebR                      | Best Practice                                                                                                      |
| ----------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Tool count**          | 27                              | GitHub Copilot: 13 core + dynamic loading. Blender MCP: 51. You're in range but could benefit from compound tools. |
| **Description quality** | Basic ("Connect a source node") | Should include examples, preconditions, failure modes, domain-specific warnings                                    |
| **Error recovery**      | `isError: true` + message       | Should include actionable next steps ("call X to fix")                                                             |
| **Input guardrails**    | Zod type validation             | Should also enforce domain rules (crash IDs, path validation, pin_index preference)                                |
| **State caching**       | Root graph + handle map         | Should add scene graph cache with invalidation on mutations                                                        |
| **Primitives used**     | Tools only                      | Tools + Resources + Prompts (full MCP spec)                                                                        |
| **Response format**     | Raw JSON                        | Should be compact, agent-optimized, with progressive disclosure                                                    |

---

## Prioritized Action Items

| #   | Item                                                                        | Impact | Effort | Notes                                       |
| --- | --------------------------------------------------------------------------- | ------ | ------ | ------------------------------------------- |
| 1   | **Enrich tool descriptions** with domain knowledge, examples, failure modes | HIGH   | LOW    | Biggest bang for buck — just string changes |
| 2   | **Auto-verify connections** in `connect_nodes`                              | HIGH   | LOW    | ~20 lines of code                           |
| 3   | **Block crash-causing inputs** (type IDs, bad paths, reset_project)         | HIGH   | LOW    | Validation guards                           |
| 4   | **Add `create_and_connect` compound tool**                                  | HIGH   | MED    | Most common 2-call pattern                  |
| 5   | **Compact response formats** for scene tree and node info                   | MED    | MED    | Filter unused fields                        |
| 6   | **Add MCP Resources** for node type catalog, pin layouts, presets           | MED    | MED    | New capability type                         |
| 7   | **Enforce file path roots** in MCP layer                                    | LOW    | LOW    | Port from web server                        |
| 8   | **Add MCP Prompts** for common workflows (setup scene, build material)      | LOW    | MED    | Nice-to-have                                |

---

## Implementation Status (v2.1.0 Upgrade)

All 8 prioritized items complete (Phases 0-4).

| #   | Item                       | Status   | What Changed                                                                                                                                                       |
| --- | -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Enrich tool descriptions   | **DONE** | All 28 tool descriptions rewritten with domain knowledge, pin layouts, crash warnings, defaults                                                                    |
| 2   | Auto-verify connections    | **DONE** | `connect_nodes` and `create_and_connect` verify via `connectedNodeIx` after every connect                                                                          |
| 3   | Block crash-causing inputs | **DONE** | Crash type ID guard in `create_node`, A_FILENAME path validation in `set_attribute`                                                                                |
| 4   | `create_and_connect` tool  | **DONE** | New compound tool: create + connect + verify in one call (28 tools total)                                                                                          |
| 5   | Compact response formats   | **DONE** | `get_scene_tree(compact:true)` → tuples; `get_node_info(connected_only:true)` → filtered pins                                                                      |
| 6   | MCP Resources              | **DONE** | 8 resources: node-types, node-types-by-category, pin-layout, compatibility (static); node-info, pin-info, attribute-info (dynamic/cached); scene (live SceneCache) |
| 7   | File path roots in MCP     | **DONE** | `validateFilePath()` in utils.ts, enforced in load_project, save_project, save_render via OCTANE_FILE_ROOTS                                                        |
| 8   | MCP Prompts                | **DONE** | 4 prompts: setup-scene, add-material, build-lit-object, troubleshoot-render                                                                                        |

### New: SceneCache (Phase 0)

`mcp/src/SceneCache.ts` — lightweight in-memory scene graph cache that replaces the old `handleToTypeName` Map. Tracks:

- **Nodes:** `Map<handle, {name, typeName, typeId}>` — populated by `create_node`, `get_scene_tree`, `get_node_info`
- **Connections:** `Map<"target:pin", sourceHandle>` — populated by auto-verify in `connect_nodes`, `get_node_info`
- **Children:** `Map<graphHandle, childHandles[]>` — populated by `get_scene_tree`
- **Cleared on:** crash detection, `load_project`, `reset_project`

Design: hint layer, not source of truth. Critical ops verify against live gRPC. Works standalone without web UI.

### New: Phase 4 — Resources, Prompts, Dynamic Cache, File Path Roots

**`mcp/src/resources.ts`** — 8 MCP Resources exposing the Octane type system as safe, idempotent reads:

- **Static (ApiCache):** `octane://node-types`, `octane://node-types/{category}`, `octane://pin-layout/{typeName}`, `octane://compatibility/{pinType}`
- **Dynamic (ApiInfo gRPC, cached):** `octane://node-info/{typeName}`, `octane://pin-info/{typeName}/{pinIndex}`, `octane://attribute-info/{typeName}/{attrId}`
- **Scene (SceneCache):** `octane://scene` — live snapshot of nodes, connections, children

**`mcp/src/prompts.ts`** — 4 workflow prompts encoding domain knowledge:

- `setup-scene` — full scene creation from scratch (RT, DOF, camera, geometry, lighting)
- `add-material` — PBR material with texture connections
- `build-lit-object` — complete object with geometry, material, placement, lighting
- `troubleshoot-render` — diagnose white renders, blur, darkness, crashes, silent failures

**`mcp/src/OctaneMcpClient.ts`** — Dynamic ApiInfo queries (Tier 2 cache):

- `queryNodeInfo(typeName)` — full node metadata, cached after first call
- `queryPinInfo(typeName, pinIndex)` — deep pin metadata with ranges/defaults
- `queryAttributeInfo(typeName, attrId)` — attribute metadata with type/min/max
- `queryCompatibleTypes(pinType)` — compatible nodes for a pin type
- All cleared on crash/load_project/reset_project

**`mcp/src/tools/utils.ts`** — `validateFilePath()` enforcing OCTANE_FILE_ROOTS. Applied in load_project, save_project, save_render.

---

## Research Sources

### Striim Whitepaper

- MCP as "USB-C for AI" — universal connector replacing bespoke integrations
- Three-step flow: handshake → tool discovery → request/response
- Key insight: 95% of agentic AI initiatives fail due to brittle integrations, not model quality
- MCP needs a governed, real-time data layer underneath

### Gemini Framework (User-Provided)

- Standardize API spec (OpenAPI 3.1+)
- Enrich with semantic metadata and natural language summaries
- Define invocation guardrails (timeouts, retries, rate limits)
- Implement dynamic access control and observability
- Register in MCP-compatible catalogue

### Industry References

- **GitHub Copilot**: Cut from 40 to 13 tools → 2-5pp benchmark improvement + 400ms latency reduction
- **Blender MCP**: 51 tools, thread-safe execution, result caching, arbitrary Python escape hatch
- **MCP-Unity** (SIGGRAPH Asia 2025): Structured commands > code generation, state-aware dialogue
- **OWASP MCP Security**: Input validation on every field, path traversal prevention, rate limiting
- **Anthropic MCP Spec**: Tools + Resources + Prompts as three primitives; STDIO for single-client
- **Docker MCP Analysis**: Don't wrap your entire API as tools; offloading orchestration to LLM is an anti-pattern
- **arXiv Tool Description Research**: Descriptions serve as both specification and prompt — include examples, preconditions, failure modes
