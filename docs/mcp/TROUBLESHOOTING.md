# Troubleshooting

All known problems and workarounds. For values, see `REFERENCE.md`. For build workflow, see `BUILD.md`.

---

## §1 Known Issues

| Trigger                               | Symptom                                                  | Mitigation                                                                                            |
| ------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `import_materialx`                    | Returns gRPC error on certain .mtlx files                | Save scene before importing. Confirmed on `standard_surface_gold.mtlx`.                               |
| `get_scene_tree` on large loaded ORBX | Traversing nodes before server finishes internal loading | `load_project` waits for `projectManagerChanged` callback. Traversal aborts on first connection loss. |

---

## §2 Build

| Problem                              | Cause                                                              | Fix                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `tsc -p mcp/tsconfig.json` OOMs      | tsc 5.9.3 uses unbounded memory. **NEVER use tsc for MCP builds.** | `cd mcp && npm run build` — uses **esbuild** (10ms).                                |
| `OctaneConstants.ts` not found       | File moved from `shared/` to `mcp/src/shared/`                     | Update import paths: `from '../shared/OctaneConstants'`                             |
| MCP server running stale code        | `mcp/dist/index.js` not rebuilt after source changes               | Run `cd mcp && npm run build`, then kill+restart MCP processes                      |
| GrpcProxyServer changes not compiled | Excluded from `server/tsconfig.json` (cross-boundary mcp/ import)  | Uses separate `build:grpc-server` script in `npm run build`. Always run full build. |

---

## §3 Electron Build

| Problem                            | Cause                                                                | Fix                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| ENOENT crash on `log_grpc.log`     | Log file tried to write inside read-only asar                        | Write to `app.getPath('userData')` instead of `app.getAppPath()`                    |
| Icons show text labels, not images | `GrpcProxyServer` didn't `decodeURIComponent` on URL pathname        | Added `decodeURIComponent(urlObj.pathname)` — filenames have spaces                 |
| Default Electron icon              | No `.ico` configured in build                                        | `build/icon.ico` (Octane gear logo) + `win.icon` in package.json                    |
| GrpcProxyServer module not found   | `server/tsconfig.json` excludes it; no separate compile step existed | Added `build:grpc-server` npm script (standalone tsc + copy to `server/dist/grpc/`) |

---

## §4 Silent Failures

### Connections

| Symptom                              | Cause                        | Fix                                                              |
| ------------------------------------ | ---------------------------- | ---------------------------------------------------------------- |
| Geo connected to RT but invisible    | Used `pin_id: 59`            | Use `pin_index: 3`. Always verify `connected_handle != 0`.       |
| Material connected but default color | Used `pin_id: 30`            | Use `pin_index: 0` for mesh material.                            |
| Volumetric medium invisible          | `mediumRadius` defaults to 1 | Set env pin 5 to 1000+.                                          |
| Geo group rejects children           | Fresh groups have 0 pins     | `connect_nodes` auto-expands pin count. No manual action needed. |

### Attributes

| Symptom                      | Cause                              | Fix                                                                                              |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| Render blurry                | DOF on (aperture=0.893)            | Auto-disabled on new RTs. For loaded RTs: RT→pin0→pin14→child: `set_attribute(child, 185, 9, 0)` |
| Emission 40x dim             | Efficiency defaults 0.025          | Set pin 0 child to 1.0                                                                           |
| Sundir hour won't change     | Set on sundir, not hour child      | env→pin0(sundir)→pin4(hour)→child→`set_attribute`                                                |
| Transform reads {0,0,0}      | Set on parent, not transform child | `get_node_info(geo)`→pin3→child→`set_attribute(child, 172, 11, ...)`                             |
| Sphere light transform fails | Used `A_VALUE=185`                 | Use `A_TRANSLATION=172` on NT_TRANSFORM_VALUE child                                              |
| Film resolution won't change | Set on Film, not child             | `get_node_info(film)`→pin0→child→`set_attribute(child, 185, 4, {w,h})`                           |
| Wrong aspect ratio           | Used `AT_INT=3`                    | Use `AT_INT2=4` on Image Resolution grandchild                                                   |

---

## §5 Render Issues

| Symptom                             | Fix                                                                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All white                           | Verify RT pin 3 (geometry) has `connected_handle != 0`. Pins 0 (camera) and 6 (kernel) are auto-created. Pin 1 missing = black, not white. Switch kernel to PT. |
| All black                           | No light sources. Add env or emission before geometry.                                                                                                          |
| Blurry                              | DOF — **auto-disabled** on new RTs. For old RTs: set aperture to 0.                                                                                             |
| Mesh invisible                      | Missing `A_RELOAD=124` after `A_FILENAME=34`.                                                                                                                   |
| Glass invisible                     | Clear glass in uniform light. Tint transmission `{0.85, 0.95, 1.0}`.                                                                                            |
| Objects not appearing               | Not connected to RT pin 3 (via geo group or direct).                                                                                                            |
| Render doesn't update after connect | `connect_nodes`, `disconnect_pin`, and `start_render` flush `ApiChangeManager::update()` automatically.                                                         |
| Black save_render                   | Called before `start_render`. Start render first, wait for samples.                                                                                             |

---

## §6 MCP-Specific

**MCP is a Claude project-level server.** It auto-starts when Claude Code opens this project. To restart after code changes or stale state:

```bash
taskkill //F //IM node.exe   # kill ALL node processes (MCP relay + vite + everything)
sleep 3                       # wait for ports to release
# Call any MCP tool → Claude auto-restarts MCP with fresh tool discovery
```

Never start MCP manually (`node dist/index.js`). Never start a second instance. New tools added mid-session require this restart to appear in Claude's tool list.

| Problem                                    | Fix                                                                                                                                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NT_GEO_MESH has no transform               | Wrap in NT_GEO_PLACEMENT.                                                                                                                                                                                |
| GLB direct load times out                  | Convert to OBJ + PNG. Load OBJ via mesh, texture via NT_TEX_IMAGE.                                                                                                                                       |
| Auto-created materials reject emission     | Create standalone NT_MAT_DIFFUSE, connect emission via `pin_name: "emission"`, then connect to geo.                                                                                                      |
| Inspector doesn't refresh after MCP update | Re-select node in octaneWebR.                                                                                                                                                                            |
| `set_camera` resets up vector              | Always (0,1,0). Rotate MODEL, never flip camera up.                                                                                                                                                      |
| MCP server left active during code changes | Stop server, rebuild, restart.                                                                                                                                                                           |
| ORBX save resets ALL handles               | After `save_project` to .orbx, re-query scene tree with `get_scene_tree`.                                                                                                                                |
| ORBX embeds assets with relative paths     | `.orbx` packages copy textures/meshes inside. On reload, paths become relative. Use `.ocs` during MCP iteration (keeps absolute paths). Only `.orbx` for final delivery.                                 |
| ORBX mesh node corruption                  | Mesh nodes from ORBX that survived heavy scene surgery (delete siblings, swap filenames) become corrupted. Always create FRESH `NT_GEO_MESH` nodes.                                                      |
| Viewport resolution max ~1100px            | Larger resolutions clip in Octane viewport — human sees cropped image while `save_render` captures full frame. Use 1024x576 or 1024x1024 for interactive work. Bump to 1920x1080 for final renders only. |
| `ApiNode.type` vs `ApiItem.type`           | The `type` RPC (returns NodeType enum) is on `ApiNode` (objectType=17), NOT `ApiItem` (objectType=16). `ApiItem` only has `name`, `outType`, `isGraph`.                                                  |
| Render time diagnostic                     | Env-only render ~3-4s. With 500K face mesh ~8-11s. If render time stays at env-only level, mesh isn't in pipeline.                                                                                       |

---

## §7 Octane API Limitations

| Limitation                       | Details                                                                                                                                                                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Render engine calls ignored      | `pauseRendering`, `stopRendering`, etc. return success but do nothing                                                                                                                                                                                                      |
| Camera not reset after File→Open | LiveLink camera overrides file's saved state                                                                                                                                                                                                                               |
| Pin value RPCs unimplemented     | `setPinValueByIx/ByPinID/ByName` all return UNIMPLEMENTED                                                                                                                                                                                                                  |
| `newStatistics` never fires      | Statistics callback is a stub                                                                                                                                                                                                                                              |
| LiveDB all 4 tools broken        | `getCategories`, `getMaterials`, `getMaterialPreview`, `downloadMaterial` all fail with "3 INVALID_ARGUMENT: invalid pointer type". The gRPC compat layer doesn't handle singleton services (no objectPtr). Tools disabled in index.ts, code preserved in materials-db.ts. |
| Quad primitive (type 18)         | May render nothing on older Octane versions. Works on SDK server (2026.2). Use flat Box or NT_GEO_PLANE as alternatives.                                                                                                                                                   |

---

## §8 Debugging

### Logs

All log files are controlled by the global `LOG_LEVEL` env var (default: `debug`).

| Level     | `log_grpc.log`                                                                                                                         | `log_mcp.log`                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `verbose` | ALL REQ/RES (firehose — 150K+ lines for large scenes)                                                                                  | Per-gRPC-call timings + REQ/RES                   |
| `debug`   | Mutating + lifecycle + curated reads (device, RT, camera). Filters inspector enumeration + stats polling. ~77 lines for 2-sphere scene | Tool calls with args + timing + health + profiles |
| `info`    | Mutating + lifecycle only (create/set/connect/render/camera/save)                                                                      | Tool calls with args only                         |
| `warn`+   | Errors only                                                                                                                            | Health failures, gate rejections, disconnections  |

| File             | Source                             | Notes                                                                              |
| ---------------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| `log_serv.log`   | octaneServGrpc (C++ gRPC server)   | Server-side RPCs. In `build/Release/` next to exe. `--log-level=debug` (default)   |
| `log_grpc.log`   | OctaneGrpcClientBase + Vite plugin | Client-side gRPC calls. `GRPC_DEBUG_LOG=0` to disable. Cleared on dev server start |
| `log_mcp.log`    | MCP server                         | `MCP_LOG_LEVEL` overrides global. Cleared on MCP server start                      |
| `log_client.log` | Browser Logger (via `/api/log`)    | Client-side JS errors batched to server. Cleared on dev server start               |

### On Error — FULL STOP Protocol

1. STOP — do not continue current task
2. Read ALL 4 log files — every one, every time, no exceptions:
   - **`log_serv.log`** — server-side SDK call results, handle lookup failures, exception traces
   - **`log_grpc.log`** — client-side gRPC proxy errors, raw gRPC call failures
   - **`log_mcp.log`** — MCP tool errors, gate rejections
   - **`log_client.log`** — browser JS errors, failed API calls (batched from browser)
3. Read the error message carefully — the answer is usually in the text
4. Trace to root cause — don't chase symptoms
5. One fix → verify all 4 logs + render → repeat until resolved

**Why all 4?** Errors originate at different layers: C++ SDK server, gRPC proxy, MCP tools, or browser JS. The same failure appears differently in each log — the FIX depends on which layer caused it. `log_serv.log` and `log_grpc.log` use the same format and can be diffed side-by-side.

### Key Rules

- Disable MCP before code changes — auto-start spawns broken processes that interfere with the server.
- Always `evaluate: true` (default) — deferred eval means subsequent calls operate on stale state.
- Same failure twice → STOP, try fundamentally different approach.

---

## §9 Fresh Start

**Clients die first, octaneServGrpc dies last.** Killing the gRPC server while clients are connected causes hangs.

### Pre-flight: Kill Duplicates

**On every new session**, check for duplicate servers BEFORE doing anything else:

```bash
tasklist | grep octaneServGrpc          # Must be 0 or 1 instance
netstat -ano | grep -E "51022|51023"    # Must be 0 or 1 listener per port
```

If >1 `octaneServGrpc.exe` is running: **kill ALL**, verify ports free, then start fresh. A stale second instance holds ~1 GB RAM and can cause port conflicts or MCP routing to the wrong server.

### Shutdown

1. `preview_stop` — FIRST
2. Kill octaneServGrpc — `taskkill //F //IM octaneServGrpc.exe`
3. Verify: `tasklist | grep -i octaneServGrpc` → nothing
4. Verify ports: `netstat -ano | grep -E "51022|51023"` → nothing

### Startup

5. Launch octaneServGrpc: `octaneServGrpc/build/Release/octaneServGrpc.exe &`
6. Wait ~5s. Verify: `netstat -ano | grep 51022` → single LISTENING entry
7. Verify single instance: `tasklist | grep octaneServGrpc` → exactly 1 row
8. `preview_start` — LAST (after gRPC is listening)

---

## §SCRATCH: Clean Start Protocol

Full restart. Required before any clean test run, after MCP restart, or infra changes.

1. Kill all processes (`taskkill //F //IM octane.exe`, `taskkill //F //IM octaneServGrpc.exe`)
2. Stop preview server (`preview_stop`)
3. Reset MCP (must fully kill, not just disconnect):
   - `taskkill //F //IM node.exe` — kill ALL node processes. The relay port check only runs at MCP startup, so a reconnect won't fix a missed relay.
   - Wait 3 seconds for ports to release
   - Verify port 51023 is free: `powershell Get-NetTCPConnection -LocalPort 51023` — must return empty
   - Trigger MCP restart: call any MCP tool (e.g. `get_octane_version`). Claude auto-restarts the MCP process.
   - Check port 51023 again — **must be listening now**
   - **If it came back** → project-level MCP auto-restarted with relay, move on
   - **If still free** → no project MCP configured, start one: `cd octaneWebR/mcp && node dist/index.js`
   - **NEVER start a second MCP** if one is already running. That creates duplicate processes and breaks the relay.
   - **Race condition warning:** If you only kill the PID on 51023 (not all node processes), the port may not release fast enough. The new MCP starts, sees 51023 still in use, skips the relay, and the viewport stays dead forever (relay check only runs once at startup).
4. Verify port 51022 AND 51023 both free
5. Start octaneServGrpc, wait for port 51022
6. Check `log_serv.log` for startup
7. Wait a few seconds for the project MCP to auto-restart and connect to the new server
8. Start dev server + preview (`preview_start`)
9. `get_octane_version` — verify version + API detection. Response includes `mcp_build` and `serv_build` for tracking builds.
10. Check `log_mcp.log` — must show `API version:` line AND `Callback streaming started` AND NO `Port 51023 in use`
11. Check `log_grpc.log` — clean startup, no errors
12. Preview screenshot — verify viewport is live (not grey/blank)

Only after all 12 steps pass: proceed to DRESS or SHOW.
