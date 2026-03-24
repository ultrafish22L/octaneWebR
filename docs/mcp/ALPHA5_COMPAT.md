# Alpha 5 Compatibility Notes

Quirks and differences when running against Team Octane Alpha 5 (version 15000005) vs octaneServGrpc (2026.2).

---

## §1 Auto-Detection

The MCP auto-detects Alpha 5 at startup from the version response:

- Version number: `15000005`
- Version name: contains "Alpha"
- Sets `USE_ALPHA5_API = true`, proto dir → `proto_old/`
- Compat layer activates in `OctaneGrpcClientBase.ts`

Check `log_mcp.log` for: `API version: alpha5 (...) — compat layer updated`

If it still shows `2026.2` after switching backends, the MCP process needs a full restart (not just reconnect). See `BUILD.md` §2 SCRATCH step 3.

---

## §2 Mesh Loading (A_RELOAD)

**On serv (2026.2):** `set_attribute(A_FILENAME)` + `set_attribute(A_RELOAD=124, true)` works — mesh loads immediately.

**On Alpha 5:** `A_RELOAD` reports success but **silently fails** without an explicit `update_scene()` after it. The mesh stays empty (triCount=0, instanceCount=0) with no error.

**Required sequence on Alpha 5:**

```
set_attribute(mesh, A_FILENAME=34, AT_STRING=14, "path.obj")
set_attribute(mesh, A_RELOAD=124, AT_BOOL=1, true)
update_scene()   ← MANDATORY on Alpha 5
get_geometry_stats()  ← verify triCount > 0
```

**Meshes can silently unload** during scene changes (connecting new objects, flushing batched attributes). After any major scene mutation, re-reload all meshes and verify with `get_geometry_stats()`.

---

## §3 Handle Numbering

- **Serv (2026.2):** Handles start at ~5100 (e.g. RT=5107, camera=5108)
- **Alpha 5:** Handles start at ~1000000 (e.g. RT=1000003, camera=1000004)
- **Type field:** Serv returns `"type":"ApiFileName"`, Alpha 5 returns `"type":"ApiNode"`

Handle values are opaque — never hardcode them. Always discover via `create_node`, `get_node_info`, or `get_scene_tree`.

---

## §4 Pin Differences

Alpha 5's `NT_MAT_UNIVERSAL` has an extra pin not present on serv:

- **Pin 21: `coatingIndex`** (PT_FLOAT) — coating layer IOR

All other pin indices and names are identical between serv and Alpha 5 for tested node types (NT_RENDERTARGET, NT_GEO_MESH, NT_GEO_PLACEMENT, NT_GEO_GROUP, NT_MAT_UNIVERSAL, NT_ENV_DAYLIGHT, NT_CAM_THINLENS).

---

## §5 Compat Layer Transforms

The compat layer in `OctaneGrpcClientBase.ts` handles these differences transparently:

| What                         | Serv (2026.2)        | Alpha 5                              |
| ---------------------------- | -------------------- | ------------------------------------ |
| Value set method             | `setValueByAttrID`   | `setByAttrID`                        |
| Value get method             | `getValueByAttrID`   | `getByAttrID`                        |
| Handle field (value methods) | `objectPtr`          | `item_ref`                           |
| Pin value method             | `getPinValueByPinID` | `getPinValue1`, `getPinValue3`, etc. |
| Proto directory              | `proto/`             | `proto_old/`                         |

These transforms are automatic — MCP tool calls use the same API regardless of backend. The compat layer is tested by the glass metal DRESS test.

---

## §6 Render Differences

- **Render time:** Alpha 5 is slightly slower (~12s vs ~11s for 5000 samples at 1024x512)
- **Render quality:** Structurally identical output. Not pixel-exact due to different Octane versions, random seeds, and kernel defaults.
- **Callback streaming:** Works identically on both backends.

---

## §7 gRPC Log Gaps

The `log_grpc.log` on Alpha 5 does not capture all call types. Specifically, `ApiItem.setValueByAttrID` / `setByAttrID` calls were not visible in the log during testing. This makes it harder to verify compat transforms via log inspection. The MCP log (`log_mcp.log`) is more reliable for verifying tool calls succeeded.

---

## §8 Test Results (2026-03-24)

Full glass metal DRESS test passed on both backends:

| Step                       | Serv | Alpha5                                   |
| -------------------------- | ---- | ---------------------------------------- |
| RT + camera                | PASS | PASS                                     |
| LOUD RED sphere            | PASS | PASS (needs update_scene after A_RELOAD) |
| Environment + DOF off      | PASS | PASS                                     |
| Gold material swap         | PASS | PASS                                     |
| Glass sphere               | PASS | PASS (mesh unloaded, re-reload needed)   |
| Red matte sphere           | PASS | PASS                                     |
| Floor                      | PASS | PASS                                     |
| Beauty render + checkpoint | PASS | PASS                                     |

Renders saved: `temp/renders/glass_metal_serv.png`, `temp/renders/glass_metal_alpha5.png`
Projects saved: `temp/renders/glass_metal_serv.orbx`, `temp/renders/glass_metal_alpha5.orbx`
