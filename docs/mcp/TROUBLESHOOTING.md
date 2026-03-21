# Troubleshooting

All known problems and workarounds. For values, see `REFERENCE.md`. For build workflow, see `BUILD.md`.

---

## Crashes

| Trigger                                | Symptom                                                                                           | Mitigation                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `resetProject`                         | "Save changes?" dialog blocks gRPC                                                                | Delete-all-nodes instead: `get_scene_tree` → `delete_node` each (leaves first, RT last)                                                         |
| Bad `A_FILENAME` (e.g. `:rgba` suffix) | Dialog blocks gRPC ~30s                                                                           | Valid absolute paths only                                                                                                                       |
| Primitive type enum changes            | Non-deterministic ECONNRESET (crashed at 5, 15, or survived 40+)                                  | Use NT_GEO_MESH with .obj file, or `import_glb` for non-box geometry                                                                            |
| `get_node_info` on internal children   | ECONNRESET when querying auto-created float/enum children (e.g. sundir child on NT_ENV_DAYLIGHT)  | Avoid `get_node_info` on internal children immediately after `connect_nodes`. Sequence: connect, wait, then query. Needs further investigation. |
| Silent death during connect chains     | All `connect_nodes` calls return `verified: true`, but Octane is dead at next call (ECONNREFUSED) | Likely caused by evaluation cascades from rapid state mutations. No reliable mitigation — check Octane is alive before critical calls.          |

### nodeInfo Crash Types

These type IDs kill Octane (ECONNRESET): `0, 116, 408, 40000, 50000, 50106, 50107, 50108, 50136, 50137`. Also all `_NT_*` deprecated types. The MCP server and API cache script already skip these.

---

## Silent Failures

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

## Render Issues

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

## MCP-Specific

| Problem                                    | Fix                                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| NT_GEO_MESH has no transform               | Wrap in NT_GEO_PLACEMENT.                                                                           |
| GLB direct load times out                  | Convert to OBJ + PNG. Load OBJ via mesh, texture via NT_TEX_IMAGE.                                  |
| Auto-created materials reject emission     | Create standalone NT_MAT_DIFFUSE, connect emission via `pin_name: "emission"`, then connect to geo. |
| Inspector doesn't refresh after MCP update | Re-select node in octaneWebR.                                                                       |
| `set_camera` resets up vector              | Always (0,1,0). Rotate MODEL, never flip camera up.                                                 |
| MCP server left active during code changes | Stop server, rebuild, restart.                                                                      |

---

## Known Octane API Limitations

| Limitation                       | Details                                                               |
| -------------------------------- | --------------------------------------------------------------------- |
| Render engine calls ignored      | `pauseRendering`, `stopRendering`, etc. return success but do nothing |
| Camera not reset after File→Open | LiveLink camera overrides file's saved state                          |
| Pin value RPCs unimplemented     | `setPinValueByIx/ByPinID/ByName` all return UNIMPLEMENTED             |
| `newStatistics` never fires      | Statistics callback is a stub                                         |
| LiveDB `getCategory` broken      | Returns empty for all categories                                      |
| Quad primitive (type 18)         | No geometry rendered. Use flat Box or quad.obj                        |

---

## Debugging

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

### On Crash (ECONNRESET/ECONNREFUSED)

1. STOP immediately
2. Read `log_mcp.log` — last successful call, first error
3. Isolate the exact gRPC call
4. Stop all servers BEFORE restarting Octane

### Thread Safety

Octane serializes all API calls on a single thread. MCP serializes via mutex. Two gRPC peers (MCP + Vite) can interleave — avoid simultaneous use.

---

## Fresh Start Procedure

**Servers die first, Octane dies last.** Killing Octane while servers are connected causes hangs.

### Shutdown

1. `preview_stop` — FIRST
2. Kill Octane — `cmd /c "taskkill /F /IM octane.exe"`
3. Verify: `tasklist | grep -i octane` → nothing

### Startup

4. Launch Octane with `dangerouslyDisableSandbox: true`: `"C:/otoyla/GRPC/dev/octaneGRPC-2026.1-Alpha5/octane.exe" &`
5. Wait 10-15s. Verify: `powershell -Command "Get-NetTCPConnection -LocalPort 51022 -ErrorAction SilentlyContinue"`
6. `preview_start` — LAST (after gRPC is listening)
