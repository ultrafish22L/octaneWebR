# OctaneWebR

## Current Session (agent updates this at session end)

**Phase 30: Electron production build fixes + human-like UI testing**

**What happened this session:**

- **Human-like UI testing** — Pre-flight checks (281 tests pass, lint clean, MCP build OK), Vite dev server verified with screenshots and interactive testing via Claude Preview tools. Confirmed 5-column grid layout, menu interactions, panel headers, connection status all working.
- **Electron build: log_grpc.log ENOENT fix** — Production build crashed on launch because log file tried to write inside read-only asar. Fixed to use writable `app.getPath('userData')` directory.
- **Electron build: icon fix** — Added `octane_window_icon.ico` (Octane gear logo) for taskbar/titlebar. Previously used default Electron icon.
- **Electron build: broken icons fix** — All icons with spaces in filenames (e.g. `PLAY window.png`, `RENDER TARGET node.png`) failed to load in production. Root cause: `GrpcProxyServer` static file serving didn't `decodeURIComponent(pathname)` — URL-encoded `%20` didn't match filesystem filenames with actual spaces.
- **Electron build: GrpcProxyServer compilation** — Was excluded from `server/tsconfig.json` (cross-boundary import from `mcp/src/shared/`). Previous builds had a manually compiled copy that was lost. Added `build:grpc-server` npm script that compiles it separately and copies to correct output path.
- **MCP metal+glass test run** — Built scene via MCP tools (RT, camera, kernel, daylight env, sphere meshes with silver and glass materials, floor). Confirmed NT_GEO_OBJECT primitive type 20 (sphere) still crashes Octane non-deterministically. Scene rendered successfully using NT_GEO_MESH + sphere_hd.obj.
- **Octane path correction** — Actual path is `C:/otoyla/GRPC/octaneGRPC-2026.1-Alpha5/octane.exe` (not in `dev/`).
- **Version**: 2.2.3

### TODO for Next Session

1. **Load ORBX scenes** — Test with teapot.orbx first (small), then keloid/chess/forest. Verify callback streaming prevents crashes on large scenes.
2. **Phase B calibration** — Load ORBX → render → VLM analyze baseline → apply SEGA preset → re-render → measure gap → iterate.
3. **Connection LED bug** — Shows "Connected" (green) even when Octane is offline. Investigate `ConnectionStatus` component.
4. **Console error spam** — 136+ ECONNREFUSED errors on startup when Octane is offline. Should be suppressed or rate-limited.
5. **Re-test LiveDB** after Octane update.

## #0 Rule: Read Before Doing

**The "Current Session" section above IS your briefing.** Read it and **summarize to the user** before any action. At session end, update it for the next conversation.

## #1 Rule: Docs Live in the Repo

ALL docs go in `docs/`. Never store project knowledge in memory files or local-only locations.

## Quick Start

| What         | How                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Dev server   | `npm run dev` (port 43929)                                                                       |
| Test scene   | `ORBX/teapot.orbx`                                                                               |
| MCP server   | auto-starts via `.mcp.json` — never run manually                                                 |
| Octane       | `"C:/otoyla/GRPC/octaneGRPC-2026.1-Alpha5/octane.exe" &` with `dangerouslyDisableSandbox: true`  |
| Tests        | `npm test` (281 tests), `npm run lint`, `npm run build`                                          |
| MCP build    | `cd mcp && npm run build` — uses **esbuild** (9ms). Do NOT use `tsc -p mcp/tsconfig.json` (OOM). |
| Octane check | `powershell -Command "Get-NetTCPConnection -LocalPort 51022"`                                    |
| Electron     | `npm run electron:build` — NSIS installer + portable exe in `dist/electron-build/`               |
| Fresh start  | See `docs/mcp/TROUBLESHOOTING.md` — servers die first, Octane dies last                          |

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
GEOMETRY:    Prefer NT_GEO_MESH + .obj for non-box shapes (sphere_hd.obj, floor.obj). NT_GEO_OBJECT primitive type changes are unstable.
```

**Restarting MCP server** (after code changes):

```
cd mcp && npm run build                    # esbuild, 10ms
# Find and kill MCP processes:
powershell -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe' AND CommandLine LIKE '%mcp/dist/index.js%'\" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
# MCP auto-restarts via Claude Code — verify with any MCP tool call
```

**Critical gotchas** (full list in `docs/mcp/TROUBLESHOOTING.md`):

- `set_camera` — ALWAYS pass `up:{0,1,0}`. Default `{0,0,0}` = broken render.
- DOF ON by default (aperture=0.893) — set to 0.
- Emission efficiency defaults to 0.025 — set to 1.0 (40× dimmer otherwise).
- Use `pin_index` not `pin_id` for connections — pin_id silently fails.
- `reset_project` pops blocking dialog — use delete-all-nodes instead.

## Status

- **Version**: 2.2.4 — 82 active tools, 4 disabled (LiveDB), 281 tests, 3 themes
- **MCP**: 15 tool modules (incl. SEGA), 9 resources, 4 prompts, SceneCache, ApiCache, ArtDirectionState, SemanticState, VisionCritic, CallbackStreamManager
- **SEGA**: 6 tools (`set/get/adjust_artistic_intent`, `semantic_critique`, `get_vlm_estimation_prompt`, `save_user_preset`), 15 dimensions, 25 presets, NLParser, PixelAnalyzer, SemanticCritic
- **Architecture**: MCP is a thin gRPC wrapper using Beta 2 method names. Constants in `mcp/src/shared/OctaneConstants.ts`.

## Vocabulary

| Term            | Meaning                                                                              |
| --------------- | ------------------------------------------------------------------------------------ |
| **DRESS**       | Demo build — 1 node at a time, render after each step. Default mode. See `BUILD.md`. |
| **SPEED**       | Batch build — all nodes, wire all, render once. For testing.                         |
| **AA/CM/MA/TA** | Art/Camera/Math/Tech agents — sub-roles for scene building. See `BUILD.md`.          |
| **MEET**        | Multi-role review protocol (CA → BA → ES).                                           |
