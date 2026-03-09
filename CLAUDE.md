# OctaneWebR

## Quick Start

- **Dev server**: `npm run dev` (port 57341)
- **Test scene**: `ORBX/teapot.orbx` — load via File→Open
- **Smoke test**: Toggle Orthographic on Camera node → verify `setByAttrID` in `grpc-debug.log`
- **MCP server**: `cd mcp && npm run build && npm run mcp:start`

## Key Docs

- `ARCHITECTURE.md` — architecture, service layer, gRPC, theming
- `TEST_PLAN.md` — 181 tests, testing rules (gold standard)
- `IMPROVEMENTS.md` — 33-item backlog (includes MCP resilience items)
- `mcp/OCTANE_MCP.md` — MCP rules, pin layouts, crash prevention (single source of truth)
- `mcp/CORNELL_RECIPE.md` — Cornell box demo recipe (+ SPICYOTOY, ARCTIC variants)
- `recipes/` — scene gallery recipes (13 scenes, prose format)

## Testing Rules

All in `TEST_PLAN.md`. Key points:

- Fix one, verify, then next. No batching.
- Fresh state per test — restart dev server and reload scene.
- Detect Octane crashes immediately — check for `ECONNRESET`/`ECONNREFUSED`.
- Lint and build before push — `npm run lint` + `npm run build`.

## Status

- **Version**: 1.4.5
- **0 open bugs** — 4 known Octane API limitations (render engine calls ignored, camera not reset after File→Open, newStatistics never fires, LiveDB getCategory broken)
- **Testing**: R1+R2+R3 complete. 181 tests, 16 bugs fixed and verified.
