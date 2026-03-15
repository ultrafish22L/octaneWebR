# CA Review — Session 2026-03-14b (Memory Amnesia)

## Fumble Report

This session attempted the Phase 0 Wood Chips Demo. It exposed the same amnesia pattern as the previous session despite all rules being documented and auto-injected.

### Fumbles (in order of occurrence)

| #   | Fumble                                                                          | Rule Violated                 | Where Documented         |
| --- | ------------------------------------------------------------------------------- | ----------------------------- | ------------------------ |
| 1   | Didn't read Current Session in CLAUDE.md — improvised "wood chips" from scratch | Rule #0                       | CLAUDE.md line 41-47     |
| 2   | Didn't read SESSION.md                                                          | feedback_session_start.md     | Memory                   |
| 3   | Didn't read CHEATSHEET before MCP build                                         | feedback_render_pipeline.md   | Memory                   |
| 4   | Tried to launch Octane without `dangerouslyDisableSandbox`                      | feedback_octane_sandbox.md    | Memory                   |
| 5   | Killed Octane before stopping servers                                           | Fresh Start Rule              | CLAUDE.md line 90-98     |
| 6   | Connected geo to RT pin 3 repeatedly (overwrites, only last shows)              | Wiring pattern: geo group     | OCTANE_MCP.md line 37-40 |
| 7   | Built 20+ nodes before first render                                             | feedback_scene_build_order.md | Memory                   |
| 8   | Didn't know what MEET meant                                                     | Project Vocabulary table      | CLAUDE.md line 24-33     |
| 9   | Forgot OTOY Studio existed for texture generation                               | OCTANE_CREATIVE.md section 1  | Docs                     |

### Root Cause Analysis

**All 9 fumbles share one root cause: memory files are write-only.**

The agent saves feedback diligently (write works). It never loads it (read fails). CLAUDE.md and MEMORY.md are auto-injected but the agent scans headers without processing content. Under action pressure ("wow me"), the agent skips all preflight and improvises.

### Structural Fix (implemented this session)

**Problem:** Individual memory files require the agent to choose to read them. It never does.

**Fix 1:** MEMORY.md converted from pointer-only index to **inline rules sheet**. The 10 most-violated rules are now one-liners at the top of MEMORY.md, which is auto-injected every conversation. Detailed memory files still exist for context.

**Fix 2:** CLAUDE.md Rule #0 now requires the agent to **summarize Current Session to the user** before taking any action. This forces processing, not just scanning.

### Score

- **Protocol compliance: 1/10** — violated 9 documented rules
- **Self-awareness: 4/10** — recognized problems when user pointed them out, never proactively
- **Recovery: 8/10** — MEET was thorough, structural fix is sound
- **Net session value: 7/10** — no scene built, but the memory architecture fix is the highest-leverage improvement possible
