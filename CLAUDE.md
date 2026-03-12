# OctaneWebR

## Quick Start

- **Dev server**: `npm run dev` (port 57341)
- **Test scene**: `ORBX/teapot.orbx` — load via File→Open
- **Smoke test**: Toggle Orthographic on Camera node → verify `setByAttrID` in `grpc-debug.log`
- **MCP server**: `cd mcp && npm run build && npm run mcp:start`

## Key Docs

- `.claude/MEMORY.md` — accumulated project knowledge, MCP workflows, crash prevention, lessons learned
- `ARCHITECTURE.md` — architecture, service layer, gRPC, theming
- `TEST_PLAN.md` — 181 tests, testing rules (gold standard)
- `IMPROVEMENTS.md` — 33-item backlog (includes MCP resilience items)
- `mcp/OCTANE_MCP.md` — MCP technical reference: pin layouts, crash prevention, API patterns
- `mcp/OCTANE_CREATIVE.md` — creative guide: lighting, materials, composition, depth, scale, environments, anti-CG
- `recipes/` — all scene recipes (13 scenes + 3 Cornell variants, prose creative briefs with reference values)

## Testing Rules

All in `TEST_PLAN.md`. Key points:

- Fix one, verify, then next. No batching.
- Fresh state per test — restart dev server and reload scene.
- Detect Octane crashes immediately — check for `ECONNRESET`/`ECONNREFUSED`.
- Lint and build before push — `npm run lint` + `npm run build`.

## Status

- **Version**: 1.5.1
- **0 open bugs** — 4 known Octane API limitations (render engine calls ignored, camera not reset after File→Open, newStatistics never fires, LiveDB getCategory broken)
- **Testing**: R1+R2+R3 complete. 181 tests, 16 bugs fixed and verified.
- **Current priority**: MCP bug fixing until stable → demo for bosses.
