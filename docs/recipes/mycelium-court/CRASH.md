# Bug Report: Scene Build Session 2026-03-20

## Crash #1: HDRI Load Crash

- **Time**: ~16:37 local
- **Action**: Connected 4k HDR file (29.7MB, `forest_hdri_4k.hdr`) as environment texture to RT, then called `save_render`
- **Error**: `ECONNREFUSED 127.0.0.1:51022` — Octane process terminated
- **Likely cause**: 4k HDR file too large or format issue during scene evaluation
- **Resolution**: Restart Octane, use 2k HDR (7.6MB) instead
- **Log state**: `log_grpc.log` and `log_mcp.log` were not being captured (dev server not running)

## Crash #2: Setting primitive type on NT_GEO_OBJECT enum

- **Time**: ~17:50 local
- **Action**: Created NT_GEO_OBJECT, got enum child handle 1000311 for primitive type. Set `A_VALUE=185, AT_INT=3, value=20` (Sphere). Simultaneously tried setting transform scale and position on same object.
- **Error**: `ECONNRESET` on `setValueByAttrID` — Octane process terminated
- **Likely cause**: Either the primitive type value 20 is wrong for this enum, or the parallel calls to set_attribute on the same object caused a race. NT_GEO_OBJECT primitive types: Sphere=20 per docs, but this is the REFERENCE.md value — may differ for the enum child node.
- **Resolution**: Restart Octane, load saved project `mushroom_garden_v1.orbx`. Avoid parallel set_attribute calls on the same object. Verify primitive enum values from REFERENCE.md before setting.

## Crash #3: Setting FOV on stale handle after project load

- **Time**: ~18:15 local
- **Action**: Called `set_attribute(1000037, 185, 9, 85)` to set FOV. Handle 1000037 was from the camera pin layout discovered BEFORE a project save/load cycle. After `load_project`, handles were re-mapped but 1000037 was assumed still valid for FOV.
- **Error**: `ECONNRESET` on `setValueByAttrID` — Octane process terminated
- **Likely cause**: Handle 1000037 pointed to a different node after project reload, or the handle was never properly re-validated. Setting a float value on a wrong node type crashes Octane.
- **Resolution**: After EVERY `load_project`, MUST re-discover ALL handles via `get_scene_tree` + `get_node_info`. NEVER reuse handles from before a load. The save/load cycle completely remaps the handle space.
- **Rule added**: "Rebuild from scratch is faster than debugging broken project loads with stale handles."

## Crash #4: set_attribute on ground plane transform — parallel calls

- **Time**: ~18:40 local
- **Action**: Created NT_GEO_OBJECT for ground plane (handle 1000310). Called 3 `set_attribute` in parallel on its transform child (1000314): primitive type, scale, position.
- **Error**: `ECONNRESET` on first `setValueByAttrID` — remaining calls got `ECONNREFUSED`
- **Likely cause**: Parallel `set_attribute` calls on the same node create a race condition in Octane's gRPC handler. The primitive type enum set (value=20) may also be incorrect for this node type.
- **Resolution**: ALWAYS call `set_attribute` SEQUENTIALLY on the same node. Never fire multiple attribute sets in parallel on one handle. Also: leave NT_GEO_OBJECT as default Box — changing primitive type crashes non-deterministically (documented in REFERENCE.md).

## Crash #5: connectTo on NT_TEX_IMAGE power pin — RGB over Grayscale swap

- **Time**: ~21:30 local (session 2, v3 rebuild)
- **Action**: Had `Grayscale color` (1000318) connected to RGB image (1000005) power pin 0. Created `RGB color` (1000327), set value to `{0.5, 0.35, 0.38}`, then called `connect_nodes(1000327 → 1000005, pin_index 0)` to replace the grayscale with the RGB color on the same pin.
- **Error**: `ECONNRESET` on `ApiNode.connectToIx` — Octane terminated
- **Likely cause**: Swapping a Grayscale child with an RGB child on the power pin mid-render may cause a type mismatch crash in Octane's internal texture evaluation. The power pin accepts PT_TEXTURE (both grayscale and RGB are valid), but the hot-swap while the render is active may hit an uninitialized code path.
- **Resolution**: When changing the power pin from grayscale to RGB (or vice versa), **disconnect the existing pin first** (`disconnect_pin`), wait, then connect the new node. Never hot-swap texture types on the same pin. Alternatively, set the RGB color value BEFORE connecting (which was done here — the crash happened on connect, not on set_attribute).
- **Rule added**: "Disconnect before reconnecting a different texture type to the same pin — never hot-swap."

## Summary of Rules Derived

1. **Never use 4k HDR** — stick to 2k or lower for environment textures
2. **Never change NT_GEO_OBJECT primitive type** — leave as default Box, scale flat for ground planes
3. **After `load_project`, ALL handles are invalid** — must rediscover via `get_scene_tree`
4. **Never parallel `set_attribute` on the same node** — always sequential
5. **`save_project` before `reset_project`** — prevents blocking save dialog
6. **Rebuild > reload** — rebuilding from scratch is faster and safer than fixing broken project loads
7. **Disconnect before reconnecting different texture type** — never hot-swap grayscale↔RGB on the same pin while rendering
