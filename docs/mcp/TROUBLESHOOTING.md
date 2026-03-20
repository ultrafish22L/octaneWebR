# Troubleshooting

All known problems and workarounds — web UI and MCP. Check here when something breaks.

For pin layouts and values, see `REFERENCE.md`.
For build workflow, see `BUILD.md`.
For the single source of truth on API patterns, see `REFERENCE.md`.

---

## Crashes — Things That Kill Octane

### Confirmed Octane Crashes

| Trigger                                    | Symptom                                         | Mitigation                                                                                                                                                      |
| ------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`resetProject` (any variant)**           | "Save changes?" dialog blocks gRPC indefinitely | Use delete-all-nodes pattern: `get_scene_tree` then `delete_node` each handle (leaves first, RT last). Or `save_project` to a temp path before `reset_project`. |
| **Bad `A_FILENAME` (e.g. `:rgba` suffix)** | Octane pops a dialog, blocking gRPC for ~30s    | Use valid absolute paths only. No suffixes, no relative paths.                                                                                                  |
| ~~High subdivision on `NT_GEO_OBJECT`~~    | Disproven — see `DISPROVEN_ISSUES.md`           | Untestable via MCP (pin 7 not exposed). Likely never a real crash.                                                                                              |

### nodeInfo Crashes

Calling `nodeInfo(type)` with certain type IDs kills Octane (ECONNRESET). Tested against OctaneRender Studio+ 2026.1 Alpha 5.

| Type ID | Name                     | Notes                                     |
| ------- | ------------------------ | ----------------------------------------- |
| 0       | NT_UNKNOWN               | Always first in `getNodeTypes()` response |
| 116     | NT_MAT_OSL               | OSL material                              |
| 408     | NT_AOV_TIME              | AOV pass                                  |
| 40000   | NT_SWITCH_OFFSET         | Switch node                               |
| 50000   | NT_MATERIALX_RANGE_START | MaterialX range marker                    |
| 50106   | NT_TEX_MX_SEPARATE2      | MaterialX texture                         |
| 50107   | NT_TEX_MX_SEPARATE3      | MaterialX texture                         |
| 50108   | NT_TEX_MX_SEPARATE4      | MaterialX texture                         |
| 50136   | NT_TEX_MX_FRACTAL2D      | MaterialX texture                         |
| 50137   | NT_TEX_MX_LATLONGIMAGE   | MaterialX texture                         |

**Also crashes: all `_NT_*` deprecated types.** `getNodeTypes()` returns deprecated `_NT_*` types (e.g., `_NT_CAMERARESPONSE` id=21). Calling `nodeInfo` on any of these crashes Octane.

**Prevention rules for the API cache fetch script (`scripts/fetch-api-cache.js`):**

1. Skip `id === 0` (NT_UNKNOWN)
2. Skip names starting with `_NT_`
3. Skip IDs in the crash list above
4. Detect ECONNRESET and stop immediately — retrying a crash type just crashes again

---

## Silent Failures — Things That Look Like They Work But Don't

### Pin Connection Failures

| Symptom                                                      | Cause                                                                                                                                              | Fix                                                                                                                                                                                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Geo connected to RT but render shows nothing                 | Used `pin_id: 59` (P_GEOMETRY) on RT                                                                                                               | Use `pin_index: 3` for RT geometry pin. ALWAYS verify: `get_node_info(RT)` then check pin 3 `connected_handle != 0`.                                                                                                                  |
| Material connected but mesh still default color              | Used `pin_id: 30` on mesh material pin                                                                                                             | Use `pin_index: 0` for mesh material.                                                                                                                                                                                                 |
| Can't connect to pins on auto-created (internal) child nodes | Auto-created children are **internal nodes** (owned by parent via `createInternal`). `connectTo` can't replace internal children — silently fails. | Create a standalone node of the needed type, wire it up, then connect to the parent. Or use `createInternal`/`createInternalIx` gRPC call to create a node inside the pin. See SDK: `ApiNode::createInternal()` in `apinodesystem.h`. |
| Volumetric medium invisible                                  | `mediumRadius` defaults to 1 unit                                                                                                                  | Set `mediumRadius` (env pin 5) to 1000+ — default 1 means medium only extends 1 unit from origin.                                                                                                                                     |

### Attribute Failures

| Symptom                                                                | Cause                                                                                                                                      | Fix                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `success:true` but nothing visually changed                            | Value didn't actually land                                                                                                                 | Verify with `get_node_info` or `get_attribute` after every critical `set_attribute`. NEVER trust `success:true` alone.                                                                                                                       |
| Render blurry / soft focus                                             | DOF on by default — camera aperture defaults to 0.893                                                                                      | RT pin 0 (camera) -> `get_node_info` -> pin 14 (aperture) -> `set_attribute(child, 185, AT_FLOAT=9, 0)`.                                                                                                                                     |
| Emission very dim (40x weaker than expected)                           | Blackbody efficiency defaults to 0.025                                                                                                     | Set pin 0 (efficiency) child to `1.0`.                                                                                                                                                                                                       |
| `A_VALUE` on sundir node doesn't work                                  | Must set hour on child, not sundir directly                                                                                                | Navigate: env -> pin 0 (sundir) -> pin 4 (hour) -> child handle -> `set_attribute`.                                                                                                                                                          |
| `camera_visibility` bool doesn't stick via MCP                         | Was: absent `evaluate` field ≠ explicit `false`. Proto `optional bool` treated absent as server-default (true), causing double evaluation. | Fixed in v2.1.0: MCP now sends `evaluate: false` explicitly then flushes via `ApiChangeManager.update()`, matching web UI pattern. If still seen, try workaround: disconnect fill geo from group, or position lights behind camera/subjects. |
| `transparentEmission` on blackbody doesn't reliably hide sphere lights | MCP limitation — value may not persist                                                                                                     | Workaround: use tiny radius (0.05) or position lights behind subjects/camera.                                                                                                                                                                |
| Sphere light transform set but reads back {0,0,0}                      | Used `A_VALUE=185` instead of `A_TRANSLATION=172`                                                                                          | NT_LIGHT_SPHERE transform child is NT_TRANSFORM_VALUE — use `A_TRANSLATION=172`, NOT `A_VALUE=185`.                                                                                                                                          |
| Film resolution won't change                                           | Set on Film Settings node, not Image Resolution child                                                                                      | `get_node_info(film)` -> pin 0 -> child -> `set_attribute(child, 185, AT_INT2=4, {w, h})`.                                                                                                                                                   |
| Wrong aspect ratio                                                     | Used `AT_INT=3` for resolution                                                                                                             | Use `AT_INT2=4` on Image Resolution grandchild.                                                                                                                                                                                              |

---

## Render Issues

| Symptom                                       | Cause                                                                        | Fix                                                                                                                                                                                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Render all white**                          | DL kernel (need PT), camera outside scene, or geo/env not actually connected | Verify RT connections: `get_node_info(RT)` -> check pins 1, 3, 6 all have `connected_handle != 0`. Switch kernel to PT.                                                                                                                                |
| **Render doesn't update after connect**       | `start_render` does NOT evaluate the scene                                   | Use `evaluate: true` (default) on every `set_attribute` / `connect_nodes` call. Never batch with `evaluate: false` — stale state causes wrong data on the wire. `start_render` just renders current state; any evaluated change upstream refreshes it. |
| **Render grey/blue**                          | Camera looking at sky (open walls, wrong camera angle)                       | Check wall positions and camera angle.                                                                                                                                                                                                                 |
| **Render blurry**                             | DOF enabled by default (aperture 0.893)                                      | Set aperture to 0 — see Attribute Failures above.                                                                                                                                                                                                      |
| **Mesh loads but invisible**                  | Missing `A_RELOAD` after `A_FILENAME`                                        | After setting filename: `set_attribute(mesh, A_RELOAD=124, AT_BOOL=1, true)`.                                                                                                                                                                          |
| **Glass sphere invisible**                    | Clear glass in uniform lighting — physically correct but nothing to refract  | Use colored transmission (`{0.85, 0.95, 1.0}`) for visibility.                                                                                                                                                                                         |
| **Mesh renders impossibly fast, no geometry** | Stale engine state                                                           | Restart Octane completely.                                                                                                                                                                                                                             |
| **Black render (space scene)**                | No light sources — environment alone is insufficient                         | Create at least one light source and connect to geo group BEFORE adding geometry.                                                                                                                                                                      |
| **Render black image from `save_render`**     | Called `save_render` before `start_render`                                   | Always `start_render` first, wait for samples, then `save_render`.                                                                                                                                                                                     |
| **Objects not appearing**                     | Forgot to connect geo to RT pin 3                                            | Connect geo (or geo group) to RT via `pin_index: 3`.                                                                                                                                                                                                   |

---

## MCP-Specific Issues

**Architecture note (v2.1.1):** MCP and web UI share the same gRPC interface. Both use Beta 2 method names. `OctaneGrpcClientBase.callMethod()` handles all API version translation (method names + param transforms) — one code path, one compat layer. MCP tools should never use Alpha 5 method names directly.

| Problem                                         | Cause                                                                      | Fix                                                                                                                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `load_project` creates stale nodes              | Loaded scene nodes conflict with MCP-created ones                          | ALWAYS create fresh mesh + placement with absolute paths. Don't rely on `load_project` for building.                                                                    |
| NT_GEO_MESH has no transform pins               | By design — mesh is just geometry data                                     | Wrap in `NT_GEO_PLACEMENT` for transforms (translation, rotation, scale).                                                                                               |
| GLB direct load times out                       | Octane can't handle GLB via gRPC in time                                   | Convert to OBJ + separate texture PNG. Load OBJ via `NT_GEO_MESH`, texture via `NT_TEX_IMAGE`.                                                                          |
| `reset_project` pops blocking dialog            | Unsaved changes trigger "Save?" prompt                                     | `save_project` to a temp path first. Or use delete-all-nodes pattern (no dialog).                                                                                       |
| MCP server left active during code changes      | Broken calls from stale MCP server crash Octane                            | Always stop MCP server before making code changes. Rebuild and restart after changes.                                                                                   |
| Auto-created child materials reject emission    | NT_GEO_OBJECT's auto-created diffuse silently ignores emission connections | Create standalone `NT_MAT_DIFFUSE`, connect emission to it via `pin_name: "emission"`, then connect to geo object material pin.                                         |
| Node inspector doesn't refresh after MCP update | Web UI doesn't know MCP changed a node                                     | Re-select the node in octaneWebR to refresh the inspector.                                                                                                              |
| `set_camera` resets up vector                   | `set_camera` always resets up to `(0,1,0)`                                 | Never rely on custom up vectors. If model faces wrong way, rotate the MODEL (`A_ROTATION=137`), never flip camera up. Never set up to `(0,0,0)` — destroys orientation. |

---

## Known Octane API Limitations

These are Octane bugs or unimplemented features — cannot be worked around in our code.

| Limitation                            | Details                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Render engine calls ignored**       | `pauseRendering`, `stopRendering`, `continueRendering`, `setClayMode`, `setRenderPriority` return success but do nothing.                               |
| **Camera not reset after File->Open** | LiveLink camera overrides the file's saved camera state.                                                                                                |
| **Pin value RPCs unimplemented**      | `setPinValueByIx`, `setPinValueByPinID`, `setPinValueByName` (and get variants) all return UNIMPLEMENTED. Use `set_attribute` on child handles instead. |
| **`newStatistics` never fires**       | Statistics callback is a stub — no data returned.                                                                                                       |
| **LiveDB `getCategory` broken**       | Returns empty/error for all categories.                                                                                                                 |
| **Quad primitive (type 18)**          | Doesn't crash but renders no visible geometry. Use flat Box or `quad.obj` instead. See `DISPROVEN_ISSUES.md`.                                           |

---

## Web UI Issues

| Problem                                            | Fix                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| Handle-0 selection bug in SceneOutliner            | Fixed in v1.5.9 — was using `\|\|` instead of `??` for handle comparison. |
| Number input window listeners leak on unmount      | Fixed in v1.5.9 — cleanup added.                                          |
| Inspector shows stale data after rapid node clicks | Wait for inspector to settle. F5 forces full refresh.                     |
| Dropdown menus clipped by panel overflow           | Fixed in v1.5.9 — dropdowns use fixed positioning.                        |

---

## Debugging

### Thread Safety

- Octane processes ALL API calls on a single "message thread" — calls are serialized internally.
- The MCP client serializes calls via a mutex — no parallel gRPC calls from MCP.
- `ApiRenderEngine` is the only exception (thread-safe for render control/stats).
- Two gRPC peers (MCP server + Vite dev plugin) can still interleave — avoid using both simultaneously.

### Crash Debugging Workflow

1. On any crash (ECONNRESET/ECONNREFUSED): **STOP immediately**.
2. Read `mcp-debug.log` for the last successful call and first error.
3. Compare with `grpc-debug.log` (Vite plugin traffic).
4. Isolate the exact gRPC call that caused the crash.
5. Crashes are almost certainly malformed MCP data — investigate, don't speculate.
6. Stop all servers BEFORE user restarts Octane (see Fresh Start Procedure below).

### Verification Read-Back

Use `get_attribute` after `set_attribute` to confirm values actually landed. This applies to any attribute: transforms, material properties, camera settings. Useful for debugging silent failures.

Use `get_node_info(RT)` after connecting to RT to verify `connected_handle != 0` on pins 1 (env), 3 (geo), and 6 (kernel).

### Log Files

| File                    | Source               | Notes                                                                    |
| ----------------------- | -------------------- | ------------------------------------------------------------------------ |
| `grpc-debug.log`        | OctaneGrpcClientBase | On by default (`GRPC_DEBUG_LOG=0` to disable). Logs mutating calls only. |
| `mcp-debug.log`         | MCP server           | All MCP tool calls and responses                                         |
| `octaneWebR_client.log` | Browser client       | Client-side logging                                                      |

### Detecting Crashes

Check logs for `ECONNRESET` or `ECONNREFUSED` after any risky action. If either appears, Octane has crashed. Stop all work and follow the Fresh Start Procedure.

---

## Fresh Start Procedure

When anything is unstable, or starting after a long delay: kill everything and start fresh. **The exact order matters.**

**SERVERS DIE FIRST, OCTANE DIES LAST.** Killing Octane while servers are connected causes hangs and zombie processes that resist `taskkill`.

### Shutdown

1. **Stop preview** — `preview_stop` — MUST be first
2. **Kill dev server** — stops with preview
3. **Kill Octane** — `cmd /c "taskkill /F /IM octane.exe"` (if it resists: `powershell -Command "Stop-Process -Name octane -Force"`)
4. **Verify clean** — `tasklist | grep -i octane` should return nothing

### Startup

5. **Launch Octane** — MUST use bash background syntax with `dangerouslyDisableSandbox: true`:
   ```
   "C:/otoyla/GRPC/dev/octaneGRPC-2026.1-Alpha5/octane.exe" &
   ```
   `cmd /c start` does NOT work from the sandbox. NEVER use any other Octane exe (launching the wrong one disables gRPC for the correct one).
6. **Wait for gRPC** — typically ~10-15s. Verify: `powershell -Command "Get-NetTCPConnection -LocalPort 51022 -ErrorAction SilentlyContinue"`
7. **Start preview** — `preview_start` (starts both dev server and browser). MUST start AFTER Octane gRPC is listening or the Vite plugin won't connect.

### Rules

- NEVER skip steps or reorder.
- NEVER kill Octane while servers/preview are still running.
- NEVER start servers before Octane is ready.
- Always check for already-running Octane instances before launching a new one (`tasklist | grep -i octane`).

---

## Production Hardening (deferred)

These items are from the `review.md` code review and deferred because the risk is low for a localhost dev tool. **Must be addressed before any public/multi-user deployment.**

| Item                           | Risk   | Details                                                                                                                                                 |
| ------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Security headers**           | Medium | No CSP, X-Frame-Options, or nosniff headers. Deferred because CSP breaks Vite HMR in dev. Add `helmet` middleware before public deployment.             |
| **gRPC proxy allowlist**       | High   | `POST /api/grpc/:service/:method` forwards any service/method with no validation. Add a service/method allowlist before exposing to untrusted networks. |
| **Rate limiting**              | Medium | No rate limiting on any endpoint. Add `express-rate-limit` or equivalent.                                                                               |
| **Error message sanitization** | Medium | Internal error messages (gRPC errors, paths, stack traces) are returned to HTTP clients. Replace with generic errors in production.                     |
| **WebSocket limits**           | Medium | No `maxPayload` or connection limit on WebSocket server. Add `maxPayload: 1048576` and a connection cap.                                                |
