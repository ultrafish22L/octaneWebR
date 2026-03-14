# OctaneWebR

## #1 Rule: Docs Live in the Repo

ALL documentation, reference sheets, protocols, and cheat sheets MUST be saved to repo-backed folders (e.g., `docs/`, `mcp/`, `recipes/`). NEVER store project-useful docs only in local/user memory folders. This is a shareable project — if it's useful, it belongs in the repo.

## Quick Start

- **Dev server**: `npm run dev` (port 57341)
- **Test scene**: `ORBX/teapot.orbx` — load via File→Open
- **Smoke test**: Toggle Orthographic on Camera node → verify `setByAttrID` in `grpc-debug.log`
- **MCP server**: `cd mcp && npm run build && npm run mcp:start`

## Key Docs

All docs live under `docs/` in subfolders:

- `docs/project/` — ARCHITECTURE, IMPROVEMENTS, TEST_PLAN, CHANGELOG, QUICKSTART
- `docs/mcp/OCTANE_MCP.md` — MCP technical reference: pin layouts, crash prevention, API patterns
- `docs/mcp/OCTANE_CREATIVE.md` — creative guide: lighting, materials, composition, anti-CG
- `docs/mcp/DEMO_SHOW_FLOW.md` — demo script
- `docs/build/DRESS_BUILD_PROTOCOL.md` — rigorous MCP scene build protocol (19 steps, 4 phases)
- `docs/build/OCTANE_CHEATSHEET.md` — living quick-reference: sunset, materials, camera, pins, transforms
- `docs/build/SCENE_BUILDING_TIPS.md` — camera workflow, framing, build order, visual debugging
- `docs/ui/UI_IMPLEMENTATION.md` — inspector depth shading, float formatting, leaf nodes, movable inputs
- `docs/recipes/` — 6 scene recipes (prose creative briefs with reference values)

## Testing Rules

All in `docs/project/TEST_PLAN.md`. Key points:

- Fix one, verify, then next. No batching.
- Fresh state per test — restart dev server and reload scene.
- Detect Octane crashes immediately — check for `ECONNRESET`/`ECONNREFUSED`.
- Lint and build before push — `npm run lint` + `npm run build`.

## Interaction Mode

- **Default: use octaneWebR web UI** via preview tools (click, fill, eval, snapshot, screenshot) for all testing, debugging, and scene interaction — like a human user would.
- **MCP tools only** when working on MCP server features or when the web UI can't do something yet (e.g., no create-node dialog).
- **Octane launch**: `C:/otoyla/GRPC/dev/octaneGRPC-2026.1-Alpha5/octane.exe` — NEVER use any other Octane exe (launching the wrong one disables gRPC for the correct one).
- **Node inspector refresh**: when MCP updates a node that's currently selected in octaneWebR, re-select the node to refresh the inspector (or implement smarter code).

## Fresh Start Rule (BIG RULE)

When starting after a long delay, or when anything is unstable: **kill everything and start fresh**. The EXACT order matters:

1. **Stop preview** (`preview_stop`)
2. **Kill dev server** (stops with preview)
3. **Kill Octane** (`taskkill //F //IM octane.exe`)
4. **Verify clean** — `tasklist | grep -i octane` should return nothing
5. **Launch Octane** — `start octane.exe` from the correct path (see Interaction Mode)
6. **Wait 15 seconds** — Octane needs time to initialize gRPC
7. **Start preview** (`preview_start` — this starts both dev server and browser)

**NEVER** skip steps or reorder. Especially: NEVER kill Octane while servers/preview are still running. NEVER start servers before Octane is ready. Always check for already-running Octane instances before launching a new one (`tasklist | grep -i octane`).

## MCP Scene Building Rules

**Full rules in `docs/mcp/OCTANE_MCP.md`.** The 3 hardest-learned rules:

- **NEVER `evaluate:false`** — always evaluate immediately. Deferred batches crash Octane.
- **NEVER `restart_render`** — crashes Octane. Use `start_render` (keeps render live).
- **`set_camera` is the ONLY geometry refresh** — `start_render` does NOT refresh the geometry tree. After connecting new geometry to RT, always call `set_camera`.

Also see: `docs/build/DRESS_BUILD_PROTOCOL.md` (build order), `docs/build/OCTANE_CHEATSHEET.md` (values), `docs/build/SCENE_BUILDING_TIPS.md` (camera/framing).

## Status

- **Version**: 1.5.2
- **0 open bugs** — 5 known Octane API limitations (render engine calls ignored, camera not reset after File→Open, newStatistics never fires, LiveDB getCategory broken, Quad primitive type 18 crashes Octane)
- **Testing**: R1+R2+R3 complete. 181 tests, 16 bugs fixed and verified.
- **MCP server**: 28 tools, API cache (704 node types), incremental webapp sync
- **Themes**: 3 themes — vibe (default), octane, debug
- **UI**: Octane-style scrollbars (theme-aware), Octane-style number controls (arrows, scrub bar)
