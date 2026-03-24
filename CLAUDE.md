## Last Session

### Pending

1. Connection LED bug — green even when Octane offline
2. Console error spam — 136+ ECONNREFUSED on startup
3. Re-test LiveDB after Octane update
4. ORBX loading — test callback streaming with large scenes
5. SEGA Phase B calibration

**ALL temp files → `temp/`** — renders, test scripts, debug output, scratch. Never pollute project root.

## Reference

### MCP

**Run**

- `cd mcp && npm run build` (esbuild, NOT tsc)
- Octane: `octane.exe &`
- Check: `powershell -Command "Get-NetTCPConnection -LocalPort 51022"`
- `QUICKSTART.md` §4 build, §5 launch, §7 MCP setup

**Debug**

- `docs/mcp/TROUBLESHOOTING.md` §1 crashes, §4 silent failures, §5 render issues
- `docs/mcp/TROUBLESHOOTING.md` §8 logs, §9 fresh start

**Test**

- `docs/mcp/TEST_PLAN.md` §2 SMOKE (red sphere build), §3 full sweep
- Assets: `docs/mcp/REFERENCE.md` §1 paths, `docs/mcp/BUILD.md` §8 asset pipeline

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
