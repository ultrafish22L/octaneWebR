## v2.4.4

Known issues: Connection LED false-green when offline, LiveDB disabled.

### v2.4.4 changes (MCP_BUILD 63)

- Deleted dead `renderMugshots` (~270 lines) — all rendering via `renderViews`
- Extracted constants: `MUGSHOT_FILM_RESOLUTION`, `MUGSHOT_SAMPLES`, `MUGSHOT_ENV_POWER`, `DEFAULT_MUGSHOT_MARGIN`, `PANCAKE_HEIGHT_THRESHOLD`
- Extracted helpers: `isPancakeMesh()`, `writePlaneOBJ()`
- `fit_camera` queries actual film resolution for aspect ratio (no more hardcoded 2:1)
- Hero shot now renders on known-source fast path (was missing)
- Default mugshot margin 0.05 → 0.1
- `try/finally` safety for clay mode restoration + node cleanup in `renderViews`
- Error logging in all catch blocks (no silent swallows)

---

## Docs (read only what you need)

| Task                | Read                                                     |
| ------------------- | -------------------------------------------------------- |
| Art run (scene)     | `docs/mcp/BUILD.md`                                      |
| Art run (lighting)  | `docs/mcp/CREATIVE.md`                                   |
| Art run (mood/SEGA) | `docs/project/SEGA_SYSTEM_DESIGN.md`                     |
| AD overview         | `docs/ADSYSTEM.md`                                       |
| Values / pin layout | `docs/mcp/REFERENCE.md`                                  |
| MCP server dev      | `docs/project/ARCHITECTURE.md` + `docs/mcp/REFERENCE.md` |
| Debugging           | `docs/mcp/TROUBLESHOOTING.md`                            |
| Testing (MCP tools) | `docs/mcp/TEST_PLAN.md`                                  |
| Testing (UI)        | `docs/project/TEST_PLAN.md`                              |
| UI changes          | `docs/ui/UI_IMPLEMENTATION.md`                           |
| Render pipeline     | `docs/RENDER_PIPE.md`                                    |
| Alpha 5 compat      | `docs/mcp/ALPHA5_COMPAT.md`                              |
| gRPC C++ API        | `octaneServGrpc/docs/REFERENCE.md`                       |

---

## Startup

1. `octaneServGrpc/build/Release/octaneServGrpc.exe` (wait ~6s, port 51022)
2. `preview_start("octaneWebR")` — immediately after serv, before anything else
3. `get_octane_version()` — verify mcp_build + serv_build

## Cardinal Rules

1. **`analyze_mesh` before `import_geo`** — always, no exceptions. Mugshots reveal orientation.
2. **Color clay (mode 2) for Phase 1** → `critique_render` gate ≥ 3 before `set_clay_mode(0)`. No lighting/materials in clay.
3. **`fit_camera` only** — never `set_camera` to fix framing. Wrong framing = wrong geometry. `set_camera` is Phase 4 only.
4. **Visual verify EVERY mutation** — `save_render` + `preview_screenshot`, compare both.
5. **Critique loop iterates** — `critique_render` → `apply_corrections` → fix → re-render → loop until `passed=true` or `exhausted=true`.

Full workflow, phases, and hard rules: `docs/mcp/BUILD.md`

---

## Build & Debug

> **NEVER run `tsc` or `tsc --noEmit` — OOMs on this project. Build with `npm run build` (esbuild) ONLY.**

| Command                   | What                                               |
| ------------------------- | -------------------------------------------------- |
| `cd mcp && npm run build` | MCP server build (esbuild) — **THE build command** |
| `npm test` (root)         | Run all tests (vitest, 281 tests)                  |
| `npm run lint` (root)     | ESLint client code                                 |

- **Version bump:** `MCP_BUILD` in `mcp/src/tools/info.ts` → rebuild → kill node.exe → verify `get_octane_version()`
- **MCP log:** `log_mcp.log` — use `clear_log` before test runs
- **SCRATCH:** Full restart protocol → `TROUBLESHOOTING.md` §SCRATCH
- **Viewport grey?** Stale `.js` in `mcp/src/`, wrong mcp_build, or CallbackStreamManager
