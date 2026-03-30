# OctaneWebR — Improvement Backlog

Ordered easy → hard within each section. Done items purged.

## Easy

| #   | Item                      | Notes                                                                                                                                                                                                   |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 43  | Info bar: MCP + AD status | Thin bar in octaneWebR showing connection state (MCP connected/disconnected), current build mode (SHOP/DRESS/SHOW), and AD on/off status. Replaces guesswork about what mode the agent is operating in. |

## Medium

| #   | Item                                                   | Notes                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3   | Extract VectorInput component                          | Pull out of ParameterControl.tsx (1028 lines)                                                                                                                                                                                                                                               |
| 4   | Split useMouseInteraction into focused hooks           | 500+ line useEffect → orbit/pan/zoom/pick hooks                                                                                                                                                                                                                                             |
| 14  | Export render passes dialog rework                     | File name input instead of "select folder"                                                                                                                                                                                                                                                  |
| 15  | FileBrowserDialog file type filter dropdown            | User-facing dropdown for file types. Infrastructure (filePatterns prop) exists, dropdown UI missing.                                                                                                                                                                                        |
| 19  | PreferencesDialog wiring                               | Connect stub to ApiProjectManager.applicationPreferences(). Currently theme-only via localStorage.                                                                                                                                                                                          |
| 20  | Save render passes: multi-pass export                  | Discover all passes, export with pass name + extension                                                                                                                                                                                                                                      |
| 21  | React 19 upgrade                                       | @xyflow/react 12.x and react-error-boundary 6.x support R19                                                                                                                                                                                                                                 |
| 36  | Add createInternal support to MCP connect_nodes        | `connectTo` silently fails on internal (auto-created) child pins. Need `createInternal`/`createInternalIx` gRPC call to create nodes inside pins. See SDK `ApiNode::createInternal()`. Would fix medium-on-env and similar issues.                                                          |
| 37  | Use createInternal for node inspector dropdown changes | When user changes a pin's node type via inspector dropdown, use `createInternal()` instead of create+connect. This is the correct API for replacing internal child nodes.                                                                                                                   |
| 38  | Add more static MCP resources                          | Missing: `octane://attribute-ids` (A_VALUE, A_FILENAME, etc.), `octane://attribute-types` (AT_BOOL, AT_INT, etc.), `octane://wiring-patterns` (common node connection recipes). 8 other resources already implemented.                                                                      |
| 40  | **GATED error auto-refreshes scene cache**             | When any tool hits the GATED unknown-handle guard, auto-call `get_scene_tree(compact, max_depth=3)` to repopulate the cache before returning the error. Currently requires manual rediscovery after every cache miss. High-impact for long build sessions where handles drift out of cache. |

## Hard

| #   | Item                                         | Notes                                                                                                                                                                                                                                                                                                        |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 41  | ~~DXGI shared surface rendering (Electron)~~ | **DONE v2.4.5.** Native addon (`dx_shared_surface.node`) maps shared textures via D3D11 DMA. `SharedSurfaceFrameService` in octaneServGrpc handles clone + DuplicateHandle. GrpcProxyServer orchestrates the full flow. ~2ms/frame vs ~10ms pixel path.                                                      |
| 42  | In-memory render → OTOY Studio upload        | Use `grabRenderResult` → encode PNG in-memory → `request_upload_url` → PUT blob. Skips disk I/O for MCP vision critic and Studio workflows. OTOY Studio currently only accepts file uploads via signed URL (`--data-binary @file`), not raw buffers — needs Studio API change or client-side encode-to-file. |

## Octane API Bugs (not fixable by us)

_Items #31 and #32 removed — disproven via testing._
