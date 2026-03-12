# OctaneWebR

## Quick Start

- **Dev server**: `npm run dev` (port 57341)
- **Test scene**: `ORBX/teapot.orbx` — load via File→Open
- **Smoke test**: Toggle Orthographic on Camera node → verify `setByAttrID` in `grpc-debug.log`
- **MCP server**: `cd mcp && npm run build && npm run mcp:start`

## Key Docs

- `ARCHITECTURE.md` — architecture, service layer, gRPC, theming
- `TEST_PLAN.md` — 181 tests, testing rules (gold standard)
- `IMPROVEMENTS.md` — 42-item backlog (includes MCP resilience items)
- `mcp/OCTANE_MCP.md` — MCP technical reference: pin layouts, crash prevention, API patterns
- `mcp/OCTANE_CREATIVE.md` — creative guide: lighting, materials, composition, depth, scale, environments, anti-CG
- `recipes/` — 17 scene recipes (prose creative briefs with reference values)

## Testing Rules

All in `TEST_PLAN.md`. Key points:

- Fix one, verify, then next. No batching.
- Fresh state per test — restart dev server and reload scene.
- Detect Octane crashes immediately — check for `ECONNRESET`/`ECONNREFUSED`.
- Lint and build before push — `npm run lint` + `npm run build`.

## MCP Scene Building Rules

Hard rules for building scenes via MCP (see `mcp/OCTANE_MCP.md` for full details):

- **NEVER use `evaluate:false`** — always evaluate immediately. Deferred batches crash Octane.
- **Restart ALL servers** (dev, preview) before every build run and after every crash.
- **PT kernel BEFORE `start_render`** — swapping kernels on a live render crashes Octane.
- **NEVER flip camera up vector** — rotate the model instead. `set_camera` resets up to (0,1,0).
- **Renders go in `renders/`** — NEVER save renders to `ORBX/`.

## Status

- **Version**: 1.5.1
- **0 open bugs** — 4 known Octane API limitations (render engine calls ignored, camera not reset after File→Open, newStatistics never fires, LiveDB getCategory broken)
- **Testing**: R1+R2+R3 complete. 181 tests, 16 bugs fixed and verified.
- **MCP server**: 28 tools, API cache (704 node types), incremental webapp sync
- **Themes**: 3 themes — vibe (default), octane, debug
- **UI**: Octane-style scrollbars (theme-aware), Octane-style number controls (arrows, scrub bar)
