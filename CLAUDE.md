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
- **Use `pin_id` for connections** — `pin_id: 59` (P_GEOMETRY), `pin_id: 89` (P_KERNEL), `pin_id: 43` (P_ENVIRONMENT). No ambiguity, no silent failures.
- **Connect nodes, don't just create them** — creating a node without connecting it does nothing. Always follow `create_node` with `connect_nodes`.
- **Don't stop render unnecessarily** — most changes (connect, set_attribute) take effect on the live render. Octane picks them up automatically.
- **Kernel swap is safe anytime** — RT has a default DL kernel. Swap to PT whenever needed, even during a live render.
- **NEVER flip camera up vector** — rotate the model instead. `set_camera` resets up to (0,1,0).
- **Renders go in `renders/`** — NEVER save renders to `ORBX/`.
- **Absolute paths for file loading** — always use full paths for A_FILENAME on meshes and textures. Always A_RELOAD after A_FILENAME.
- **A_ROTATION uses DEGREES** — 90 means 90°, NOT radians.
- **Light before geo in space scenes** — no ambient light = black render. Add a light first.
- **DOF is ON by default** — camera aperture defaults to 0.893. Set to 0 after `start_render`: RT pin 0 → camera → pin 14 → aperture child → `set_attribute(child, 185, AT_FLOAT=9, 0)`.

## Status

- **Version**: 1.5.2
- **0 open bugs** — 4 known Octane API limitations (render engine calls ignored, camera not reset after File→Open, newStatistics never fires, LiveDB getCategory broken)
- **Testing**: R1+R2+R3 complete. 181 tests, 16 bugs fixed and verified.
- **MCP server**: 28 tools, API cache (704 node types), incremental webapp sync
- **Themes**: 3 themes — vibe (default), octane, debug
- **UI**: Octane-style scrollbars (theme-aware), Octane-style number controls (arrows, scrub bar)
