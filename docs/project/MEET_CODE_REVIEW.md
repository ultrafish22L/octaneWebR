# Code Agent Review — 2026-03-13

Focus: code quality and docs readiness for autonomous debug session.

---

## Code Assessment

### MCP Server (mcp/src/)

**Architecture: SOLID.** 28 tools, clean separation in tools/ subfolder, single entry point in index.ts.

| Finding                                         | Severity | File         | Line    |
| ----------------------------------------------- | -------- | ------------ | ------- |
| No fetch timeout on notifyWebapp                | Medium   | webapp.ts    | 30      |
| Hardcoded 2s sleep after load_project           | Medium   | project.ts   | 21      |
| reset_project still exposed (crash trigger)     | Medium   | project.ts   | 53-66   |
| No path validation on save_render               | Low      | render.ts    | 105-122 |
| No `up` parameter on set_camera                 | Low      | camera.ts    | 36-38   |
| Auto-created children not persistently tracked  | Low      | node.ts      | 194-245 |
| Reference to nonexistent CRASH_INVESTIGATION.md | Low      | attribute.ts | 136-137 |

**Verdict:** Functional and well-organized. 4 easy fixes (#36-39 in IMPROVEMENTS) should be done in Phase 1. The hardcoded sleep (#40) and child tracking (#41) are medium effort.

### Client (client/src/)

**Architecture: 7/10.** Clean service layer, good React patterns, proper memoization.

| Finding                                               | Severity | File                                     |
| ----------------------------------------------------- | -------- | ---------------------------------------- |
| Inspector doesn't re-fetch on MCP changes             | High     | NodeInspector/hooks/useParameterValue.ts |
| MCP-created nodes land at (0,0) — no positioning      | High     | NodeService.ts:29-72                     |
| Cache invalidation missing after MCP updates          | Medium   | CacheManager.ts                          |
| Error handling inconsistent (Logger vs emitUserError) | Medium   | ApiService.ts, BaseService.ts            |
| RequestQueue bottleneck (max 4 concurrent)            | Low      | useParameterValue.ts:70                  |

**Verdict:** The two HIGH items (#35 node positioning, #45 inspector refresh) are the most impactful bugs for MCP workflow. Should be Phase 1 priorities.

---

## Docs Assessment

### Readiness for Autonomous Session: 8/10

**What's solid:**

- SESSION.md has a clear 2-phase plan with specific bug numbers and file hints
- IMPROVEMENTS.md is well-organized, ordered easy→hard
- BUGLIST.md has open investigation items separated from fixed items
- CLAUDE.md is accurate and concise
- OCTANE_MCP.md is comprehensive (single source of truth)

**Gaps:**

- DRESS_BUILD_PROTOCOL step 8 still says "pin_id:30 silently fails" — should be updated pending BUGLIST #3 retest
- Gold/Glass material types differ between CHEATSHEET and OCTANE_MCP/CREATIVE (BUGLIST #1-2)
- Fresh start wait time: 15s (CLAUDE.md) vs 30s (OCTANE_MCP.md) — BUGLIST #4
- Camera framing from bounds not in DRESS_BUILD_PROTOCOL — BUGLIST #5
- "Materials from geo 1" rule not in OCTANE_MCP source of truth — BUGLIST #6

**Verdict:** Docs are 90% aligned. The 6 BUGLIST items are the remaining gaps — 3 are decisions (material types, wait time) and 3 are additions (retest, framing, materials rule). All should be resolved early in Phase 1 before the actual debug work starts.

---

## Recommendation

Phase 1 should start with BUGLIST investigation items (30 min), then tackle bugs in this order: #47 (connect_nodes re-render), #45 (inspector refresh), #35 (node positioning), #43 (incomplete inspector), then resilience items easiest-first.
