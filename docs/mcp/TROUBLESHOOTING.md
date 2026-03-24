# Troubleshooting

All known problems and workarounds. For values, see `REFERENCE.md`. For build workflow, see `BUILD.md`.

---

## §1 Crashes

| Trigger                                | Symptom                                                                                                                                                                                                                                             | Mitigation                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resetProject`                         | "Save changes?" dialog blocks gRPC                                                                                                                                                                                                                  | Delete-all-nodes instead: `get_scene_tree` → `delete_node` each (leaves first, RT last)                                                                                                                                                                                                                                                                       |
| Bad `A_FILENAME` (e.g. `:rgba` suffix) | Dialog blocks gRPC ~30s                                                                                                                                                                                                                             | Valid absolute paths only                                                                                                                                                                                                                                                                                                                                     |
| Primitive type enum changes            | Non-deterministic ECONNRESET (~10% per build with 3 sphere changes, ~50% without mitigations). Race condition in Octane's internal geometry rebuild during `setValueByAttrID`. Cumulative across process lifetime — `reset_project` doesn't fix it. | **MITIGATED** — use `skip_evaluate:true` on all primitive enum `set_attribute` calls, set all primitives sequentially before connecting to scene graph, use fresh Octane restart per build. For 100% reliability, use NT_GEO_MESH + .obj files instead. Tested: ~50% crash rate standard, ~10-20% with skip_evaluate, ~90% success with fresh Octane restart. |
| Deleting connected nodes               | ECONNRESET                                                                                                                                                                                                                                          | **GUARDED** — `delete_node` checks `getConnectionsInvolving()`. Disconnect all pins first.                                                                                                                                                                                                                                                                    |
| `get_scene_tree` on large loaded ORBX  | Traversing nodes before Octane finishes internal loading                                                                                                                                                                                            | **FIXED** — `load_project` now waits for `projectManagerChanged` callback via `CallbackStreamManager`. Traversal also skips dangerous type IDs and aborts on first connection loss.                                                                                                                                                                           |

### nodeInfo Crash Types

These type IDs kill Octane (ECONNRESET): `0, 116, 408, 40000, 50000, 50106, 50107, 50108, 50136, 50137`. Also all `_NT_*` deprecated types. The MCP server and API cache script already skip these. Scene traversal also skips any node with `typeId <= 0`.

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

| Symptom                              | Cause                             | Fix                                                        |
| ------------------------------------ | --------------------------------- | ---------------------------------------------------------- |
| Geo connected to RT but invisible    | Used `pin_id: 59`                 | Use `pin_index: 3`. Always verify `connected_handle != 0`. |
| Material connected but default color | Used `pin_id: 30`                 | Use `pin_index: 0` for mesh material.                      |
| Can't replace auto-created children  | Internal nodes reject `connectTo` | Create standalone node, connect to parent pin.             |
| Volumetric medium invisible          | `mediumRadius` defaults to 1      | Set env pin 5 to 1000+.                                    |
| Geo group rejects children           | Fresh groups have 0 pins          | Set `A_PIN_COUNT=113` to 4+ BEFORE connecting.             |

### Attributes

| Symptom                      | Cause                              | Fix                                                                    |
| ---------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| Render blurry                | DOF on (aperture=0.893)            | RT→pin0→pin14→child: `set_attribute(child, 185, 9, 0)`                 |
| Emission 40x dim             | Efficiency defaults 0.025          | Set pin 0 child to 1.0                                                 |
| Sundir hour won't change     | Set on sundir, not hour child      | env→pin0(sundir)→pin4(hour)→child→`set_attribute`                      |
| Transform reads {0,0,0}      | Set on parent, not transform child | `get_node_info(geo)`→pin3→child→`set_attribute(child, 172, 11, ...)`   |
| Sphere light transform fails | Used `A_VALUE=185`                 | Use `A_TRANSLATION=172` on NT_TRANSFORM_VALUE child                    |
| Film resolution won't change | Set on Film, not child             | `get_node_info(film)`→pin0→child→`set_attribute(child, 185, 4, {w,h})` |
| Wrong aspect ratio           | Used `AT_INT=3`                    | Use `AT_INT2=4` on Image Resolution grandchild                         |

---

## §5 Render Issues

| Symptom                             | Fix                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| All white                           | Verify RT connections: pins 1, 3, 6 all need `connected_handle != 0`. Switch kernel to PT. |
| All black                           | No light sources. Add env or emission before geometry.                                     |
| Blurry                              | DOF — set aperture to 0.                                                                   |
| Mesh invisible                      | Missing `A_RELOAD=124` after `A_FILENAME=34`.                                              |
| Glass invisible                     | Clear glass in uniform light. Tint transmission `{0.85, 0.95, 1.0}`.                       |
| Objects not appearing               | Not connected to RT pin 3 (via geo group or direct).                                       |
| Render doesn't update after connect | `set_camera` forces geometry re-evaluation. `start_render` alone does NOT.                 |
| Black save_render                   | Called before `start_render`. Start render first, wait for samples.                        |

---

## §6 MCP-Specific

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
| Quad primitive (type 18)         | No geometry rendered. Use flat Box or quad.obj                                                                                                                                                                                                                             |

---

## §8 Debugging

### Logs

All log files are controlled by the global `LOG_LEVEL` env var (default: `debug`).

| Level     | `log_grpc.log`                                                                                                                         | `log_mcp.log`                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `verbose` | ALL REQ/RES (firehose — 150K+ lines for large scenes)                                                                                  | Per-gRPC-call timings + REQ/RES                   |
| `debug`   | Mutating + lifecycle + curated reads (device, RT, camera). Filters inspector enumeration + stats polling. ~77 lines for 2-sphere scene | Tool calls with args + timing + health + profiles |
| `info`    | Mutating + lifecycle only (create/set/connect/render/camera/save)                                                                      | Tool calls with args only                         |
| `warn`+   | Errors only                                                                                                                            | Health failures, gate rejections, crashes         |

| File             | Source               | Notes                                                               |
| ---------------- | -------------------- | ------------------------------------------------------------------- |
| `log_grpc.log`   | OctaneGrpcClientBase | `GRPC_DEBUG_LOG=0` to disable entirely. Cleared on dev server start |
| `log_mcp.log`    | MCP server           | `MCP_LOG_LEVEL` overrides global. Cleared on MCP server start       |
| `log_client.log` | Browser (via Vite)   | Client-side logs posted to server. Cleared on dev server start      |

### On Crash — follow MEMORY.md FULL STOP protocol

1. STOP — do not continue current task
2. Read ALL logs — `log_mcp.log`, `log_grpc.log`, console
3. Read the error message carefully — the answer is usually in the text
4. Trace to root cause — don't chase symptoms
5. One fix → verify logs + render → repeat until resolved
6. Stop all servers BEFORE restarting Octane (§9)

### Key Rules

- Disable MCP before code changes — auto-start spawns broken processes that crash Octane.
- Always `evaluate: true` (default) — deferred eval means subsequent calls operate on stale state.
- Same failure twice → STOP, try fundamentally different approach.

---

## §9 Fresh Start

**Servers die first, octaneServGrpc dies last.** Killing the gRPC server while clients are connected causes hangs.

### Shutdown

1. `preview_stop` — FIRST
2. Kill octaneServGrpc — `cmd /c "taskkill /F /IM octaneServGrpc.exe"`
3. Verify: `tasklist | grep -i octaneServGrpc` → nothing

### Startup

4. Launch octaneServGrpc: `octaneServGrpc/build/Release/octaneServGrpc.exe &`
5. Wait ~5s. Verify: `powershell -Command "Get-NetTCPConnection -LocalPort 51022 -ErrorAction SilentlyContinue"`
6. `preview_start` — LAST (after gRPC is listening)
