## v2.4.0 — Current State

### Completed

- **Gotcha sweep** — Crash guards debunked and removed on SDK server (octaneServGrpc 2026.2). Alpha 5 gotchas documented in `docs/mcp/ALPHA5_COMPAT.md` for reference only.
- **fit_camera tool** — Computes camera position/target from bounding box with elevation, yaw, and margin controls.
- **FRESH / SCRATCH concepts** — FRESH clears the scene (`reset_project`). SCRATCH kills all processes and restarts (session start or after crashes). See `docs/mcp/BUILD.md` §7.
- **DOF auto-disable** — `create_node` for RT now sets camera aperture to 0 automatically. No more blurry-by-default renders.
- **Proto consolidation** — Beta 2 proto files cleaned up. `proto_old/` retained for Alpha 5 compat only.
- **Build version tracking** — Root and MCP `package.json` both at 2.4.0.
- **SetCamera fix** — gRPC `SetCamera` now persists to both LiveLink and node graph attributes.

### Known Issues

1. Connection LED — shows green even when Octane is offline
2. Console error spam — 136+ ECONNREFUSED on startup
3. LiveDB — disabled (Octane gRPC "invalid pointer type" bug on all 4 tools)

**ALL temp files → `temp/`** — renders, test scripts, debug output, scratch. Never pollute project root.

## Reference

### MCP

**Run**

- `cd mcp && npm run build` (esbuild, NOT tsc)
- **Server: `octaneServGrpc/build/Release/octaneServGrpc.exe`** — start it yourself if not running. Check port 51022 first, launch if nothing listening.
- Check: `powershell -Command "Get-NetTCPConnection -LocalPort 51022"`
- `QUICKSTART.md` §4 build, §5 launch, §7 MCP setup
- For clean test runs: follow SCRATCH protocol in `docs/mcp/BUILD.md` §2

**Debug**

- `docs/mcp/TROUBLESHOOTING.md` §1 crashes, §4 silent failures, §5 render issues
- `docs/mcp/TROUBLESHOOTING.md` §8 logs, §9 fresh start

**Test**

- `docs/mcp/TEST_PLAN.md` §2 SMOKE (red sphere build), §3 full sweep
- Assets: `docs/mcp/REFERENCE.md` §1 paths, `docs/mcp/BUILD.md` §8 asset pipeline

**Alpha 5 compat**

- `docs/mcp/ALPHA5_COMPAT.md` — quirks, mesh reload, handle numbering, compat transforms

**Build scenes**

- `docs/mcp/BUILD.md` §1 human-view-first, §3 DRESS phases, §6 camera math
- `docs/mcp/REFERENCE.md` §2-§7 (attrs, pins, types, wiring, materials, emission)
- `docs/mcp/CREATIVE.md` §1 lighting, §3 composition, §5 anti-CG, §7 kernels

### Web

**Run**

- `npm run dev` :43929
- `QUICKSTART.md` §5 launch, §8 web-only mode

**Debug**

- `docs/mcp/TROUBLESHOOTING.md` §2 build errors, §3 electron

**Test**

- `npm test`, `npm run lint`, `npm run build`
- `docs/project/TEST_PLAN.md` (181 browser UI tests)

**Dev**

- `docs/project/ARCHITECTURE.md` — three-tier, services, components
- `docs/ui/UI_IMPLEMENTATION.md` — inspector, themes
