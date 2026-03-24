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

---

## §9 Guards That May Be Needed on Alpha 5

The following gotchas were **debunked on the SDK server (octaneServGrpc 2026.2)** — the SDK handles them gracefully. But they were originally reported on Alpha 5 / older Octane versions and may still be real there. If Alpha 5 compat is re-enabled, these guards may need to be added to the compat layer.

| #   | Gotcha                                        | Serv (2026.2) Status                                                                 | Alpha 5 Risk                             | Guard If Needed                                                                         |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| 9   | Deleting connected nodes crashes (ECONNRESET) | **Debunked** — SDK auto-disconnects, no crash                                        | HIGH — Alpha 5 may not handle gracefully | Auto-disconnect all pins before `ApiItem.destroy`, or block deletion of connected nodes |
| 16  | Primitive type changes crash (NT_GEO_OBJECT)  | **Debunked** — all 24 prim types work, no crashes                                    | HIGH — reported as 10-50% crash rate     | Block prim type changes, return error "Use NT_GEO_MESH + .obj for non-box geometry"     |
| 17  | Crash-prone type IDs (0, 116, 408, 40000+)    | **Debunked** — SDK returns graceful FAILED_PRECONDITION errors, guard removed v2.4.0 | HIGH — Alpha 5 may crash on nodeInfo     | Block in `create_node`, skip during scene traversal in `get_scene_tree`                 |
| 18  | A_FILENAME bad path hangs gRPC 30s            | **Debunked** — SDK handles bad paths gracefully, guard removed v2.4.0                | HIGH — Alpha 5 pops blocking dialog      | Validate path exists before passing to Octane                                           |
| 7   | Quad primitive (type 18) renders nothing      | **Debunked** — renders fine on SDK server                                            | UNKNOWN — may be version-specific        | Warn when setting prim type to 18                                                       |
| 8   | reset_project pops blocking dialog            | **Debunked** — `suppressUI: true` on SDK server prevents dialog                      | HIGH — Alpha 5 may not honor suppressUI  | Auto-save to temp before reset, or use delete-all-nodes approach                        |
| 19  | Overlapping scene evaluations crash           | **Discarded** — SDK server serializes evals                                          | MEDIUM — Alpha 5 may not serialize       | Make `skip_evaluate:true` the default, require explicit `update_scene()`                |
| 22  | Auto-created children reject connectTo        | **Debunked** — SDK allows replacing auto-created children via connect, v2.4.0        | MEDIUM — Alpha 5 may reject              | Detect pattern, return "Create standalone node and connect to parent pin instead"       |

### How to Re-enable Guards

Guards are implemented in the MCP tool handlers (`mcp/src/tools/*.ts`). To add Alpha 5 guards:

1. Check `client.isAlpha5` (or similar flag from auto-detection)
2. Conditionally apply the guard only on Alpha 5
3. On serv (2026.2), skip the guard — SDK handles it

Example pattern:

```typescript
// In delete_node handler:
if (client.isAlpha5) {
  // Alpha 5 crashes on connected-node deletion — auto-disconnect first
  const conns = client.sceneCache.getConnectionsInvolving(handle);
  for (const c of conns) {
    await client.callMethod('ApiNode', 'connectToIx', {
      objectPtr: { handle: String(c.target), type: OBJ_API_NODE },
      pinIdx: c.pinIndex,
      sourceNode: { handle: 0, type: OBJ_API_NODE },
      evaluate: true,
      doCycleCheck: false,
    });
  }
}
// Then proceed with deletion on both backends
```
