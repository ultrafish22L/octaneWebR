## v2.4.5 (MCP_BUILD 70)

Known issues: Connection LED false-green when offline, LiveDB disabled.

## Startup

**Step 0 — Kill duplicates (EVERY new session):**

```bash
tasklist | grep octaneServGrpc   # must be 0 or 1
netstat -ano | grep -E "51022|51023"  # must be 0 or 1 listener per port
```

If >1 instance: kill ALL (`taskkill //F //IM octaneServGrpc.exe`), verify ports free, then proceed.

1. `octaneServGrpc/build/Release/octaneServGrpc.exe` (wait ~6s, port 51022)
2. Verify single instance: `tasklist | grep octaneServGrpc` → exactly 1 row
3. `preview_start("octaneWebR")`
4. `get_octane_version()` — verify mcp_build 70

## What to call

| Task                   | Do this                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| **Build a scene**      | `getPrompt("dress-workflow")` — full DRESS phases 0→4                   |
| **Import a mesh**      | `getPrompt("mesh-pipeline")` — analyze → place → fit                    |
| **Set up lighting**    | `getPrompt("setup-lighting")` — HDRI + 3-point from recipe              |
| **Before critique**    | `getPrompt("scene-checklist")` — pre-flight checks                      |
| **Run critique loop**  | `getPrompt("critique-loop")` — C1-C7 dual-critic                        |
| **Debug a problem**    | `getPrompt("troubleshoot-scene")` — render + workflow issues            |
| **Look up constants**  | `ReadMcpResource("octane://constants")` — attr IDs, type codes, RT pins |
| **Look up primitives** | `ReadMcpResource("octane://primitive-types")` — shape enum              |
| **Look up pins**       | `ReadMcpResource("octane://pin-layout/{typeName}")` — pin names/indices |
| **Browse presets**     | `ReadMcpResource("octane://sega/presets")` — 25 SEGA presets            |
| **Check phase**        | `ReadMcpResource("octane://workflow/phases")` — tools per phase         |

## Cardinal Rules

These are hard constraints that apply regardless of which prompt you're following:

1. **`analyze_mesh` before `place_mesh`** — always, no exceptions
2. **`place_mesh` over manual `create_node` chains** — diagnose errors, don't work around
3. **`fit_camera(framing_mode:"subjects")`** — always pass this, never bare `fit_camera()`
4. **`set_camera` is Phase 4 ONLY** — wrong framing = wrong geometry
5. **Visual verify EVERY change** — `save_render` + `preview_screenshot`

## Build & Debug

> **vite server NEVER run `tsc` — OOMs. Use `npm run build` (esbuild) ONLY. tsc is ok for electron build**

| Command                   | What               |
| ------------------------- | ------------------ |
| `cd mcp && npm run build` | MCP server build   |
| `npm test` (root)         | All tests (vitest) |

- **Version bump:** `MCP_BUILD` in `mcp/src/tools/info.ts` → rebuild → kill node.exe → verify
- **MCP log:** `log_mcp.log` — use `clear_log` before test runs
- **SCRATCH:** Full restart → `TROUBLESHOOTING.md` §SCRATCH
