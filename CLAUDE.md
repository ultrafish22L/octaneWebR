# OctaneWebR

## Current Session (agent updates this at session end)

**Phase 27: SEGA system design — semantic artistic guidance research & architecture**

**What happened this session:**

- **Deep research** — Academic and industry sources: SEGA (Brack et al. 2023), PAD model (Mehrabian & Russell 1974), Berlyne aesthetics, CineTechBench (Wu et al. 2025), ASC Manual, Itten color theory, Stanford 3D scene graphs, BYU DARCI.
- **SEGA system designed** — Semantic vector layer (S-space) between natural language and DCC commands. ~15 seed dimensions from PAD, CineTechBench, Itten, ASC, CG craft. Open registry for more. Weighted parameter mapping, NL parsing, preset system, pixel+VLM hybrid measurement, semantic gap critique loop.
- **Gemini suggestions analyzed** — Adopted: scene graph semantics, relationship mapping, style-as-constraints, mood boarding, DARCI-style evaluation, feedback loops. Skipped: latent-space SEGA (no diffusion model), portfolio style transfer. Deferred: sketch steering.
- **5 design decisions locked** — LLM-generated presets + review; pixel+VLM hybrid measurement; no forced orthogonality; 6-12 active dims per scene; global default + per-object overrides.
- **Existing spatial math unchanged** — `projectToScreen()`, `validateComposition()`, frustum/depth/grid checks stay as-is. SEGA handles artistic intent, spatial math handles correctness. Separate concerns, no overlap.
- **2 docs written** — `docs/project/SEGA_SYSTEM_DESIGN.md` (full architecture + implementation plan), `docs/project/SEGA_USER_GUIDE.md` (research foundations + Gemini analysis + user interaction patterns).
- **Version**: 2.2.3

### TODO for Next Session

1. **SEGA Phase 1 implementation** — Start with dimension registry data file (1.1), then SemanticState class (1.2), then mapping engine (1.3). Read `docs/project/SEGA_SYSTEM_DESIGN.md` section 11 for full plan.
2. **Fix aspect ratio in `projectToScreen()`** — Accept ratio parameter instead of assuming square. Only remaining code fix from review.
3. **Scene building demo** — full DRESS build with art direction loop.
4. **Re-test LiveDB** after Octane update.

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
| Tests        | `npm test` (150 tests), `npm run lint`, `npm run build`                                             |
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

- **Version**: 2.2.3 — 67 active tools, 4 disabled (LiveDB), 150 tests, 3 themes
- **MCP**: 14 tool modules, 9 resources, 4 prompts, SceneCache, ApiCache, ArtDirectionState, VisionCritic
- **Architecture**: MCP is a thin gRPC wrapper using Beta 2 method names. Constants in `shared/OctaneConstants.ts`.

## Vocabulary

| Term            | Meaning                                                                              |
| --------------- | ------------------------------------------------------------------------------------ |
| **DRESS**       | Demo build — 1 node at a time, render after each step. Default mode. See `BUILD.md`. |
| **SPEED**       | Batch build — all nodes, wire all, render once. For testing.                         |
| **AA/CM/MA/TA** | Art/Camera/Math/Tech agents — sub-roles for scene building. See `BUILD.md`.          |
| **MEET**        | Multi-role review protocol (CA → BA → ES).                                           |
