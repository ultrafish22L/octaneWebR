## v2.4.6 (MCP_BUILD 72)

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
4. `get_octane_version()` — verify mcp_build 72

## What to call

### Scene building (read the prompt, it has the full workflow)

| Task                  | Action                                          | If stuck, read                    |
| --------------------- | ----------------------------------------------- | --------------------------------- |
| **New scene build**   | `reset_ad(confirm:true)` then `reset_project()` | Clears AD state + Octane scene    |
| **Build a scene**     | `getPrompt("dress-workflow")`                   | `BUILD.md` §3 (DRESS phases)      |
| **Import a mesh**     | `getPrompt("mesh-pipeline")`                    | `BUILD.md` Pre-Phase + §5         |
| **Set up lighting**   | `setup_lighting(mood)` — ONE call, SEGA-aware   | `CREATIVE.md` §1 (temps, ratios)  |
| **Create one light**  | `create_light(type, position, temp, power)`     | `REFERENCE.md` §7 (emission pins) |
| **Adjust daylight**   | `set_daylight(power, turbidity, ...)`           | `REFERENCE.md` §7b (presets)      |
| **Before critique**   | `getPrompt("scene-checklist")`                  | `CREATIVE.md` §5 (anti-CG)        |
| **Run critique loop** | `getPrompt("critique-loop")`                    | `BUILD.md` Critique Loop section  |

### Debugging

The server validates all inputs and returns descriptive gRPC errors. Read the error message — it tells you exactly what's wrong.

| Symptom                     | Action                                                                        |
| --------------------------- | ----------------------------------------------------------------------------- |
| gRPC error with description | Read the error — it includes the fix (e.g. "pin 3 has no geometry connected") |
| Build / compile error       | `BUILD.md` § Build Gotchas                                                    |
| Full restart needed         | `BUILD.md` § SCRATCH                                                          |
| SDK limitation              | `octaneServGrpc/docs/TODO.md` § SDK Limitations                               |
| Log files                   | `octaneServGrpc/docs/BUILD.md` § Logging                                      |

### Reference lookup (MCP resources — no file reads needed)

| Need                      | Resource                         |
| ------------------------- | -------------------------------- |
| Attribute IDs, type codes | `octane://constants`             |
| Primitive shape enum      | `octane://primitive-types`       |
| Pin names for a node type | `octane://pin-layout/{typeName}` |
| SEGA mood presets         | `octane://sega/presets`          |
| Phase → allowed tools     | `octane://workflow/phases`       |

### Deep reference (only when resources above aren't enough)

| Topic               | File + section     |
| ------------------- | ------------------ |
| Node types + IDs    | `REFERENCE.md` §4  |
| Connection patterns | `REFERENCE.md` §5  |
| Material presets    | `REFERENCE.md` §6  |
| Camera presets      | `REFERENCE.md` §7c |
| Coordinate system   | `REFERENCE.md` §8  |
| Composition rules   | `CREATIVE.md` §3   |
| Color theory        | `CREATIVE.md` §4   |
| Kernel selection    | `CREATIVE.md` §7   |

## Cardinal Rules

These are hard constraints that apply regardless of which prompt you're following:

1. **`analyze_geo` before `place_geo`** — always, no exceptions. Never skip mugshot VLM verification. Do NOT pass `source_endpoint`.
2. **`place_geo` over manual `create_node` chains** — diagnose errors, don't work around
3. **`fit_camera(framing_mode:"subjects")`** — always pass this, never bare `fit_camera()`
4. **`set_camera` is Phase 4 ONLY** — wrong framing = wrong geometry
5. **Visual verify EVERY change** — `save_render` + `preview_screenshot`
6. **Primitives via `place_geo`** — ground planes, backdrops, pedestals → `place_geo(type:"primitive", shape:"box")`. Never run `analyze_geo` on a flat quad.
7. **MCP restart = `taskkill //F //IM node.exe`** — MCP is a Claude project-level server. Kill ALL node.exe, wait 3s, call any MCP tool → Claude auto-restarts with fresh tool discovery. Never start MCP manually.
8. **HDRI from concept art** — any art scene with concept art → generate equirectangular HDRI via OTOY Studio, apply with sphere projection.
9. **Orchestrator grade is MANDATORY** — at critique step C3, state your own A-F grade explicitly. Not optional.

## Build & Debug

> **vite server NEVER run `tsc` — OOMs. Use `npm run build` (esbuild) ONLY. tsc is ok for electron build**

| Command                   | What               |
| ------------------------- | ------------------ |
| `cd mcp && npm run build` | MCP server build   |
| `npm test` (root)         | All tests (vitest) |

- **Version bump:** `MCP_BUILD` in `mcp/src/tools/info.ts` → rebuild → kill node.exe → verify
- **MCP log:** `log_mcp.log` — use `clear_log` before test runs
- **SCRATCH:** Full restart → `BUILD.md` §2 SCRATCH
