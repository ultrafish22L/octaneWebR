# OctaneWebR

## Current Session (agent updates this at session end)

**Phase 25: Docs cleanup, MCP tool pruning (pick/region/display removed), full scene build test**

**What happened this session:**

- **Doc cleanup** — deleted legacy `.claude/MEMORY.md` (166 lines, v1.4.6 era). Migrated 13 unique items to repo docs. Deleted all 5 memory files — everything lives in the repo now.
- **MCP tool pruning** — removed 4 viewport-only tools (pick_point, render_region get/set, display_pass). Not MCP-useful.
- **Scene build test** — built gold sphere scene from scratch exercising 55+ tools. 1 crash (import_materialx), 1 quirk (get_subsample_mode stale). See `docs/mcp/SCENE_BUILD_LOG.md`.
- **CLAUDE.md restructured** — cut from 206 to ~100 lines. Heavy content moved to docs where it belongs.
- **Version**: 2.2.2

### TODO for Next Session

1. **Scene building demo** — full DRESS build with art direction loop.
2. **Re-test LiveDB** after Octane update.
3. **OCIO testing** — requires OCIO config loaded.

## #0 Rule: Read Before Doing

**The "Current Session" section above IS your briefing.** Read it and **summarize to the user** before any action. At session end, update it for the next conversation.

## #1 Rule: Docs Live in the Repo

ALL docs go in `docs/`. Never store project knowledge in memory files or local-only locations.

## Quick Start

| What         | How                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Dev server   | `npm run dev` (port 43929)                                                                          |
| Test scene   | `ORBX/teapot.orbx`                                                                                  |
| MCP server   | auto-starts via `.mcp.json` — never run manually                                                    |
| Octane       | `"C:/otoyla/GRPC/dev/octaneGRPC-2026.1-Alpha5/octane.exe" &` with `dangerouslyDisableSandbox: true` |
| Tests        | `npm test` (88 tests), `npm run lint`, `npm run build`                                              |
| Octane check | `powershell -Command "Get-NetTCPConnection -LocalPort 51022"`                                       |
| Fresh start  | See `docs/mcp/TROUBLESHOOTING.md` — servers die first, Octane dies last                             |

## Docs Index (read on-demand by task)

**When building scenes / MCP work** → read these:

- `docs/mcp/BUILD.md` — DRESS protocol, setup order, camera workflow, art direction, vision critic
- `docs/mcp/REFERENCE.md` — lookup tables: pin layouts, node types, primitives, key values
- `docs/mcp/CREATIVE.md` — lighting, materials, composition, anti-CG checklist
- `docs/mcp/TROUBLESHOOTING.md` — crashes, silent failures, debugging, fresh start procedure

**When debugging / testing** → read these:

- `docs/mcp/TROUBLESHOOTING.md` — all known problems + workarounds
- `docs/mcp/TEST_PLAN.md` — tool test matrix, smoke tests
- `docs/temp/` — test run results, scene build logs

**When developing web UI** → read these:

- `docs/project/ARCHITECTURE.md` — three-tier design, services, gRPC proxy
- `docs/ui/UI_IMPLEMENTATION.md` — inspector, number controls, themes

**When planning / reviewing** → read these:

- `docs/project/IMPROVEMENTS.md` — backlog
- `docs/project/CHANGELOG.md` — version history

**Scene recipes**: `docs/recipes/` — prose creative briefs with reference values

## Interaction Style

- **No snap judgments** — present findings and options, let the user decide.
- **If mid-task, KEEP GOING** — never stop with "No response requested."
- **No time estimates** — just do the work.
- **Demo mode** — minimal tech info, frequent renders, narrate like a showcase.
- **Both must agree to lock** — stop for user review after meaningful iterations.

## Problem Solving

- Try MULTIPLE genuinely different approaches before declaring something broken.
- If same failure happens twice, STOP and rethink.
- Before acting on findings older than 1 session, retest them empirically.

## MCP Essentials (full rules in `docs/mcp/BUILD.md`)

**Key values** (look up everything else in `docs/mcp/REFERENCE.md`):

```
TRANSFORMS:  A_TRANSLATION=172  A_ROTATION=137 (DEGREES!)  A_SCALE=139  (all AT_FLOAT3=11)
KEY ATTRS:   A_VALUE=185  A_FILENAME=34  A_RELOAD=124
RT PINS:     0=camera  1=environment  3=geometry  4=film  6=kernel
WIRING:      material → mesh (pin 0), mesh → placement (pin "geometry"), placement → geo group (pin_index N)
```

**Critical gotchas** (full list in `docs/mcp/TROUBLESHOOTING.md`):

- `set_camera` — ALWAYS pass `up:{0,1,0}`. Default `{0,0,0}` = broken render.
- DOF ON by default (aperture=0.893) — set to 0.
- Emission efficiency defaults to 0.025 — set to 1.0 (40× dimmer otherwise).
- Use `pin_index` not `pin_id` for connections — pin_id silently fails.
- `reset_project` pops blocking dialog — use delete-all-nodes instead.

## Status

- **Version**: 2.2.2 — 67 active tools, 4 disabled (LiveDB), 88 tests, 3 themes
- **MCP**: 14 tool modules, 9 resources, 4 prompts, SceneCache, ApiCache, ArtDirectionState, VisionCritic
- **Architecture**: MCP is a thin gRPC wrapper using Beta 2 method names. Constants in `shared/OctaneConstants.ts`.

## Vocabulary

| Term            | Meaning                                                                              |
| --------------- | ------------------------------------------------------------------------------------ |
| **DRESS**       | Demo build — 1 node at a time, render after each step. Default mode. See `BUILD.md`. |
| **SPEED**       | Batch build — all nodes, wire all, render once. For testing.                         |
| **AA/CM/MA/TA** | Art/Camera/Math/Tech agents — sub-roles for scene building. See `BUILD.md`.          |
| **MEET**        | Multi-role review protocol (CA → BA → ES).                                           |
