# OctaneWebR

## Current Session (agent updates this at session end)

**Phase 9: Doc Consolidation + MCP Integration Test — v2.0.0**

**What happened this session:**

- MCP integration test: glass metal recipe build via MCP tools
- Fixed MCP server bundling: esbuild needs `--bundle` for cross-package imports from client/src
- Generated programmatic OBJ assets: sphere_hd.obj (32×16 UV sphere), floor.obj (quad plane)
- Built glass metal scene v5: 3 smooth spheres on floor at golden hour, materials in progress
- Full doc consolidation: 8 MCP docs → 4 (REFERENCE.md, BUILD.md, CREATIVE.md, TROUBLESHOOTING.md)
- Inline MCP rules in CLAUDE.md — 18 gate rules, no pointers to other files
- Recipe style guide enforced: all 8 recipes converted to creative briefs (Vision + Ingredients only)
- All cross-references updated to new doc names
- Debugging lessons captured: disable MCP before breaking changes, stop-and-debug after 2 failures
- QUICKSTART.md updated to v1.5.9, IMPROVEMENTS.md #32 corrected

### TODO for Next Session

1. Complete glass metal recipe materials (floor glossy, gold glossy, glass specular, red diffuse) — scene handles exist in summary
2. See `docs/project/IMPROVEMENTS.md` for remaining backlog (32 items)
3. Custom tooltip component (yellow Octane-style, not native browser `title=`)
4. File → Recent Projects menu

For all known problems and workarounds (web + MCP), see `docs/mcp/TROUBLESHOOTING.md`.

## Project Vocabulary

| Term      | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **MEET**  | Structured multi-role review: Code Agent reviews → CA reviews the review → BA reviews everything → ES to user. See `docs/project/MEET_*.md` for examples.                                                                                                                                                                                                                                                                                                                                                                                  |
| **CA**    | Code Agent — first-pass technical reviewer in a MEET                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **BA**    | Business Analyst — final reviewer in a MEET (strategic view, communication grades, fumble report, verdict)                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **ES**    | Executive Summary — final deliverable to the user after a MEET                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **DRESS** | Demo build mode — 1 node at a time, render after each step, max visual change per second. For boss demos. See `docs/mcp/BUILD.md`                                                                                                                                                                                                                                                                                                                                                                                                          |
| **SPEED** | Batch build mode — create all nodes fast, wire all, render once at end. For testing.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **AA**    | Artistic Agent — responsible for visual quality at every stage. Ensures the render looks cool throughout the build, not just at the end. Guides camera framing, lighting mood, material readability. If AA wouldn't approve the current viewport, fix it before moving on. Owns **CM** and **TA** as sub-agents.                                                                                                                                                                                                                           |
| **CM**    | Camera Math — AA's sub-agent for computing camera positions, FOV coverage, framing distances, and scene bounds. Does real trig instead of guessing. Reports position/target vectors AA can apply directly. **Learns from live:** after each set_camera, CM checks the actual render against its prediction — if chips are clipped, framing is off, or composition is wrong, CM revises its model (FOV, aspect ratio, scene bounds) and retries. Caches proven formulas and scene-specific corrections in `docs/mcp/BUILD.md`.              |
| **MA**    | Math Agent — AA's sub-agent for computing ALL scene positions from mesh bounds. Primary input: world-space bounding box of subject. Calculates camera position/target, light positions, object spacing, composition. Never guesses — always derives from geometry. Reports exact {x,y,z} vectors AA can apply directly.                                                                                                                                                                                                                    |
| **TA**    | Tech Agent — AA's sub-agent for deep CG technical problems. Has full web search, octane-docs MCP, and OTOY forum (render.otoy.com) access. Researches shader math, procedural texture tuning, noise function parameters, physically-based material properties, and renderer-specific quirks. When AA needs a procedural texture to match a real-world reference (e.g., species-accurate wood grain), TA does the deep dive: web research, OTOY forum threads, octane-docs API, parameter sweeps. Reports actionable settings AA can apply. |

## #1 Rule: Docs Live in the Repo

ALL documentation, reference sheets, protocols, and cheat sheets MUST be saved to repo-backed folders (e.g., `docs/`, `mcp/`, `recipes/`). NEVER store project-useful docs only in local/user memory folders. This is a shareable project — if it's useful, it belongs in the repo.

**Doc update order:** When a finding changes a rule, update the relevant doc in `docs/mcp/` and this file's MCP Rules section. Don't wait for user to ask — scan all docs immediately after any rule-changing finding.

## #0 Rule: Read Before Doing (HARD GATE)

**The "Current Session" section above IS your briefing.** Read it and **summarize what you found to the user** before taking any action. This is not optional — the summary forces you to actually process the instructions instead of scanning past them. Short user requests ("wow me with X", "do the wood chips") reference the plan already written there.

**Before MCP scene building**, read the MCP Rules section below. Look up values in `docs/mcp/REFERENCE.md` during the build — don't memorize, don't guess.

**At session end**, update the "Current Session" section to reflect the next session's task. This is your responsibility — don't leave stale instructions for the next conversation.

## Quick Start

- **Dev server**: `npm run dev` (port 43929)
- **Test scene**: `ORBX/teapot.orbx` — load via File→Open
- **Smoke test**: Toggle Orthographic on Camera node → verify `setByAttrID` in `grpc-debug.log`
- **MCP server**: `cd mcp && npm run build && npm run mcp:start`

### Environment Variables

| Variable            | Default     | Purpose                                                                                                                                         |
| ------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `OCTANE_BIND_HOST`  | `0.0.0.0`   | Network bind address for Vite dev server. Default exposes to LAN for Docker/sandbox/Claude Code. Set to `127.0.0.1` on open/untrusted networks. |
| `OCTANE_FILE_ROOTS` | `C:\otoyla` | Comma-separated allowed roots for the file browser. Prevents path traversal. Set to `*` for unrestricted access.                                |
| `OCTANE_HOST`       | `127.0.0.1` | Octane gRPC host (auto-detects `host.docker.internal` in containers)                                                                            |
| `OCTANE_PORT`       | `51022`     | Octane gRPC port                                                                                                                                |
| `WORKER_1`          | `43929`     | Vite dev server port                                                                                                                            |

## Key Docs

All docs live under `docs/` in subfolders:

- `docs/project/` — ARCHITECTURE, IMPROVEMENTS, TEST_PLAN, CHANGELOG, QUICKSTART
- `docs/mcp/` — MCP and scene-building (4 docs):
  - `REFERENCE.md` — lookup tables: pin layouts, node types, materials, primitives, values. Don't read front-to-back.
  - `BUILD.md` — build workflow: DRESS protocol, camera workflow, setup order, scene management
  - `CREATIVE.md` — lighting, materials, composition, OTOY Studio pipeline, anti-CG
  - `TROUBLESHOOTING.md` — all known problems + workarounds (web + MCP), fresh start procedure
- `docs/ui/UI_IMPLEMENTATION.md` — inspector depth shading, float formatting, movable inputs
- `docs/recipes/` — scene recipes (prose creative briefs with reference values, see README.md for style guide)

## Testing Rules

All in `docs/project/TEST_PLAN.md`. Key points:

- Fix one, verify, then next. No batching.
- Fresh state per test — restart dev server and reload scene.
- Detect Octane crashes immediately — check for `ECONNRESET`/`ECONNREFUSED`.
- Lint and build before push — `npm run lint` + `npm run build`.

## Interaction Mode

- **Default: use octaneWebR web UI** via preview tools (click, fill, eval, snapshot, screenshot) for all testing, debugging, and scene interaction — like a human user would.
- **MCP tools only** when working on MCP server features or when the web UI can't do something yet (e.g., no create-node dialog).
- **Octane launch**: `"C:/otoyla/GRPC/dev/octaneGRPC-2026.1-Alpha5/octane.exe" &` with `dangerouslyDisableSandbox: true`. NEVER use `cmd /c start` (fails silently). NEVER use any other Octane exe (launching the wrong one disables gRPC for the correct one).
- **Node inspector refresh**: when MCP updates a node that's currently selected in octaneWebR, re-select the node to refresh the inspector (or implement smarter code).

## Fresh Start Rule (BIG RULE)

When starting after a long delay, or when anything is unstable: **kill everything and start fresh**.

**⚠ SERVERS DIE FIRST, OCTANE DIES LAST.** Killing Octane while servers are connected causes hangs and zombie processes.

1. `preview_stop` — **MUST be first**
2. `cmd /c "taskkill /F /IM octane.exe"` (if resists: `powershell -Command "Stop-Process -Name octane -Force"`)
3. Verify: `tasklist | grep -i octane` → nothing
4. Launch: `"C:/otoyla/GRPC/dev/octaneGRPC-2026.1-Alpha5/octane.exe" &` with `dangerouslyDisableSandbox: true`
5. Wait ~10-15s. Verify: `powershell -Command "Get-NetTCPConnection -LocalPort 51022 -ErrorAction SilentlyContinue"`
6. `preview_start` — MUST start AFTER Octane gRPC is listening

NEVER kill Octane while servers are running. NEVER start servers before Octane is ready.

## MCP Rules (READ EVERY SESSION — these are the rules, not pointers to other files)

### Crash Prevention

1. **NEVER `evaluate:false`** — always evaluate immediately. Deferred batches crash Octane.
2. **NEVER parallel `create_node`** — sequential only. 4× simultaneous = ECONNRESET.
3. **Primitive type 18 (Quad) crashes Octane** — use flat Box (scale Y≈0.001) or quad.obj.
4. **`restart_render` was REMOVED** — it crashed Octane. Use `start_render` (keeps render live).
5. **`reset_project` pops blocking dialog** — `save_project` to a temp path first, or use delete-all-nodes method.
6. **Bad A_FILENAME pops Octane dialog** — blocks gRPC for 30s. Use valid absolute paths only.

### Connection Gotchas (silent failures — no error, just doesn't work)

7. **RT geometry: use `pin_index: 3`** — `pin_id: 59` silently fails.
8. **Mesh material: use `pin_index: 0`** — `pin_id: 30` silently fails.
9. **Geo group inputs: use `pin_index: N` (0-based)** — `pin_name: "Input N"` silently fails.
10. **Geo group needs `A_PIN_COUNT` (attr 113) set BEFORE connecting children** — fresh groups have 0 pins.
11. **Always verify connections** — `get_node_info(RT)` → check pins 1, 3, 6 have `connected_handle != 0`. Never trust `success:true` alone.

### Render Pipeline

12. **`start_render` does NOT refresh geometry** — after connections, call `update_scene()` THEN `set_camera`. Both required.
13. **DOF is ON by default** (aperture=0.893) — disable immediately: RT→pin0(camera)→pin14(aperture)→set value to 0.
14. **Emission efficiency defaults to 0.025** — set to 1.0 or lights will be 40× dimmer than expected.

### Workflow Gates

15. **Plan the frame BEFORE creating nodes** — know camera position, object positions, depth formation. If you can't state the camera position, you don't have a plan.
16. **Render after every object** — `save_render` → Read PNG → evaluate. Never batch multiple objects without checking.
17. **Disable MCP server before making MCP code changes** — it auto-starts with Claude Code and will crash Octane with broken calls.
18. **After 2 failures of the same kind, STOP** — don't add retries or pacing. Step back, list alternatives, try a different approach entirely.

### Key Values (don't hallucinate — look up the rest in `docs/mcp/REFERENCE.md`)

```
TRANSFORMS:  A_TRANSLATION=172  A_ROTATION=137 (DEGREES!)  A_SCALE=139  (all AT_FLOAT3=11)
KEY ATTRS:   A_VALUE=185  A_FILENAME=34  A_RELOAD=124
WIRING:      material → mesh (pin 0), mesh → placement (pin_name "geometry"), placement → geo group (pin_index N)
RT PINS:     0=camera  1=environment  3=geometry  4=film  6=kernel
```

## Status

- **Version**: 2.0.0
- **32 open items** (1 easy, 20 medium, 9 hard, 2 Octane API bugs) — see `docs/project/IMPROVEMENTS.md`
- **5 known Octane API limitations** (render engine calls ignored, camera not reset after File→Open, newStatistics never fires, LiveDB getCategory broken, Quad primitive type 18 crashes)
- **MCP server**: 27 tools, API cache, incremental webapp sync
- **Themes**: 3 themes — vibe (default), octane, debug
- **UI**: Octane-style scrollbars (theme-aware), Octane-style number controls (arrows, scrub bar)

Production hardening items (security headers, rate limiting, etc.) are in `docs/mcp/TROUBLESHOOTING.md`.
