# Disproven / Suspect Issues

Issues that were documented as crashes/bugs but failed verification. Kept here to rethink root causes later.

## Disproven

### Quad Primitive Type 18 Crashes Octane

- **Original claim**: Setting NT_GEO_OBJECT primitive enum to 18 (Quad) crashes Octane
- **Test result**: Created Quad, set type 18, connected to geo group, positioned at Y=2 Z=3, aimed camera at it, rendered — no crash, renders a visible flat square plane with default material. Works perfectly.
- **Likely real cause**: The crash was from something else happening concurrently. Same Octane version (2026.1-Alpha5) has been used since day 1 — nothing changed.

### Parallel create_node (4× Simultaneous) Causes ECONNRESET

- **Original claim**: Sending 4 create_node calls simultaneously crashes Octane with ECONNRESET
- **Test result**: Fired 4 create_node in one message — all succeeded, Octane stable, all 4 nodes in scene tree
- **Likely real cause**: MCP tool calls are blocking/serialized — true simultaneous calls can't happen through MCP. "Parallel" was never actually parallel. The ECONNRESET was from something else entirely.

### evaluate:false Batching Causes Crashes

- **Original claim**: Batching 8+ deferred evaluations then flushing crashes Octane with ECONNRESET
- **Test result**: 10 deferred set_attribute calls + update_scene flush — no immediate crash in isolation
- **Real root cause**: Not a crash per se, but stale state. With `evaluate: false`, Octane's internal state doesn't update between calls. Subsequent calls operate against a scene that doesn't reflect prior changes — sending wrong data on the wire. This can cause unpredictable behavior including crashes.
- **Resolution (v2.1.0)**: Always use `evaluate: true` (default) on every call. No batching. One call, one eval, always-current state. The MCP deferred eval warning is now moot.

### restart_render Crashes Octane

- **Original claim**: The `restart_render` gRPC call crashes Octane — tool was removed from MCP server entirely
- **Test result**: Not retested (tool removed)
- **Likely real cause**: Bad error handling in our MCP server code, not an Octane crash. The tool was removed as a workaround for our own bug. Could be restored with proper error handling.

### Geo Group pin_name "Input N" Silently Fails

- **Original claim**: Connecting to a geo group via `pin_name: "Input 5"` returns success but doesn't connect. Must use `pin_index`.
- **Test result**: Connected geo object to geo group via `pin_name: "Input 5"` — worked correctly, verified with get_node_info showing connected_handle on pin index 4.
- **Likely real cause**: Incorrect gRPC usage in our connect_nodes code at the time. The pin_name path works fine when the API is called correctly. Same root cause as pin_id:59 and pin_id:30 silent failures — our code, not Octane.

### Fresh Geo Group Needs A_PIN_COUNT Set Before Connecting

- **Original claim**: Fresh geo groups have 0 pins. Must set `A_PIN_COUNT` (attr 113) before connecting children, or connections silently fail.
- **Test result**: Created fresh geo group (0 pins), connected a geo object via `pin_index: 0` — worked. Octane auto-expanded the pin count to 1. No A_PIN_COUNT needed.
- **Likely real cause**: Incorrect gRPC usage. Octane handles pin expansion automatically.

### High Subdivision on NT_GEO_OBJECT Crashes Octane

- **Original claim**: Setting high subdivision values on NT_GEO_OBJECT causes crash or hang
- **Test result**: Untestable via MCP — `get_node_info` doesn't expose pin 7 (subdivision) because it only returns connected pins. The pin exists (pinCount=8) but has no child handle accessible via MCP tools.
- **Likely real cause**: Never verified. Vague "potential crash" with no reproduction steps. Likely just slow rendering with high poly counts, not a crash.
