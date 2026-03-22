# Changelog

All notable changes to octaneWebR.

---

## [2.2.3] - 2026-03-21

### Added — Crash Probe Testing & Guard Deployment

- **Systematic crash probe** — 19 test categories executed against live Octane with 460+ primitive enum transitions. Only 1 crash found (<0.2% rate on primitive enum cycling). All other operations confirmed safe.
- **Delete guard deployed** — `getConnectionsInvolving` check in `delete_node` now live. Prevents deletion of connected nodes.
- **Under-render testing** — all tests re-run with active GPU render (1024x512, 100k samples). No crash-rate difference.
- **New test coverage:** image texture hot-swap with file I/O, cycle detection (self/2-node/3-node), RT deletion mid-render, disconnect mid-evaluation, subgraph duplication, loaded .orbx + fresh node interop, 20-cycle build/teardown stress.
- **SceneCache coherence audit** — 86 connections audited, perfect match between cache and Octane state.

### Fixed

- **Delete guard (code review)** — `getConnectionsInvolving` method added to SceneCache, delete_node now checks for active connections before reaching Octane.
- **Version sync** — root and MCP `package.json` both at 2.2.3.

### Docs Cleanup

- Deleted 6 obsolete files: 2 stale test reports (docs/temp/), 4 research docs (SEGA*\*, SEMANTIC_MODEL*\*).
- Updated TROUBLESHOOTING.md with crash probe findings.
- Updated CLAUDE.md session info for Phase 26.

---

## [2.3.1] - 2026-03-21

### Tested — Full MCP Test Sweep (75 tools, 303 gRPC calls)

- **67/71 active tools pass** against live Octane. 0 crashes.
- **3 bugs fixed:**
  - `set_animation_data` — TimeArrayT.data needs `{value: float}` objects, not raw floats
  - `get_all_attributes` — attrIdIx returns enum string, not number
  - `get_pin_value` — discovered handles not tracked in SceneCache
- **LiveDB disabled** — all 4 tools (`browse_material_db`, `search_materials`, `preview_material`, `download_material`) hit Octane gRPC "invalid pointer type" bug. Code preserved, registration commented out.
- **Profiling data:** 5.5s gRPC time across 303 calls. Slowest: LiveDB preview (1.3s), getCategories (1.2s), saveImage (206ms avg).

---

## [2.3.0] - 2026-03-21

### Added — MCP API Expansion (Tiers 1-5)

- **Tier 1 (18 tools):** render-control (clay mode, render region, priority, subsample), stats (geometry, texture, resource, scene bounds, render state), render passes (AOVs, save passes, pick point), node management (find, rename, duplicate, delete_unconnected).
- **Tier 2 (5 tools):** attribute introspection (get_all_attributes, get_attribute_info, get_pin_value, is_animated), display pass (get_display_pass).
- **Tier 3 (4 tools):** LiveDB material browser (browse, search, preview, download) — all disabled due to Octane API bug.
- **Tier 4 (5 tools):** animation (get_animation_range, get/set_animation_data, is_node_animated, clear_animation).
- **Tier 5 (4 tools):** OCIO color management (get_ocio_config, list_color_spaces), MaterialX (import_materialx, list_materialx_nodes).

### Refactored

- **pin-utils.ts** — shared pin enumeration replacing 3 duplicated implementations across node.ts, scene.ts, import.ts.
- **NodeTypeId constants** — replaced 5 magic numbers in import.ts and render.ts.
- **extractAttributeValue rename** — eliminated naming collision with utils.ts extractValue.
- **Auto-populate SceneCache** — load_project now auto-populates cache so tools work immediately.
- **Render region validation** — set_render_region now validates coords when active=true.

### Fixed

- `save_render_passes` / `save_render_passes_exr` — passesToExport proto serialization (switched to v1 overloads).
- `find_nodes` — missing OBJ_API_ITEM_ARRAY import.

---

## [2.1.6] - 2026-03-20

### Fixed — Deep Code Review

- **import.ts: Beta 2 method names** — 5 `callMethod` sites used Alpha 5 `setByAttrID` + `item_ref` param instead of Beta 2 `setValueByAttrID` + `objectPtr`. Worked by accident (Alpha 5 API active) but bypassed compat layer. Now goes through same translation path as all other tools.
- **import.ts: hardcoded `type: 16`** → `OBJ_API_ITEM` constant (already imported).
- **import.ts: hardcoded attribute IDs** — `34`, `124`, `185` replaced with `AttributeId.A_FILENAME`, `A_RELOAD`, `A_VALUE`. Next-steps strings now use `AttributeId.A_ROTATION/A_TRANSLATION/A_SCALE`.
- **info.ts: wrong import path** — imported `AttrType`, `AttributeId`, `ObjectType` from `client/src/constants/OctaneProtocol` instead of `shared/OctaneConstants`. Replaced `ObjectType.ApiItem/ApiNode` with `OBJ_API_ITEM/OBJ_API_NODE`.
- **node.ts: `A_PIN_COUNT` constant** — replaced hardcoded `113` with `AttributeId.A_PIN_COUNT`.
- **node.ts: error message showed `undefined`** — pin type mismatch error for unresolved `pin_name` now says "not found" instead of "index undefined".
- **scene.ts: `console.error` → `mcpLog`** — 2 instances in `traverseGraph()` polluted stdio transport. Now uses `mcpLog()` with warn/error levels.
- **index.ts: WriteStream resource leak** — `mcpLogReset()` now called in shutdown handler before `process.exit()`.
- **useRenderOutput.tsx: export format select** — bound to `exportFormatRef.current` (ref, no re-render) instead of `exportFormat` (state). Fixed + added `exportFormat` to useCallback deps.
- **ItemService: don't cache transient errors** — `getParameterValue` catch block returned `null`, which CacheManager stored for 30s. Now re-throws so cache doesn't store failures.
- **render.ts: parent dir check** — replaced regex with `path.dirname()`, fixes edge case where filename-only paths skipped validation.
- **SavePackageDialog: lint fix** — removed broken eslint-disable directive (`—` vs `--` separator, rule not configured).
- **Versions synced**: Root and MCP `package.json` bumped to 2.1.6.

---

## [2.1.5] - 2026-03-20

### Added — Code Review Hardening

- **Shared constants** (`shared/OctaneConstants.ts`): Single source of truth for `AttrType`, `AttributeId`, `OBJ_API_*`, `CRASH_TYPE_IDS`, `PIN_TYPE_NAMES`, `RT_PINS`. Eliminates constant duplication between `client/src/constants/OctaneProtocol.ts` and `mcp/src/tools/attribute.ts`/`node.ts`. Client re-exports from shared for backward compatibility.
- **Typed gRPC interface** (`mcp/src/types/GrpcClientTypes.ts`): `IGrpcClientBase` interface + `GrpcModule` type annotation replaces `any` on `OctaneMcpClient.base`. Dynamic `require()` retained (esbuild OOM constraint) but now type-checked via `as GrpcModule`.
- **SceneCache TTL/staleness**: Each `CachedNode` carries `updatedAt` timestamp. New API: `touchNode()`, `getNodeAge()`, `isNodeStale()`, `staleNodeCount`, `timeSinceLastSyncMs`. `markPopulated()` refreshes all node timestamps. Snapshot includes `ageMs`/`stale` per entry. Default TTL: 5 minutes. Configurable via constructor.
- **First test suite** (59 tests, 3 files):
  - `SceneCache.test.ts` — 32 tests: handle validation, node CRUD, connections, children, staleness, snapshots
  - `utils.test.ts` — 20 tests: jsonResult, errorResult, gateHandle, extractHandle, extractValue, validateFilePath
  - `OctaneConstants.test.ts` — 7 tests: value correctness for all shared constants
- **Vitest config**: Now includes `mcp/src/__tests__/**/*.test.ts` alongside client tests.
- **MCP tsconfig**: Includes `shared/` directory for cross-project imports.
- **Versions synced**: Root and MCP `package.json` bumped to 2.1.5.

---

## [2.1.4] - 2026-03-20

### Fixed — gRPC Connection Lifecycle

- **Stale MCP channels after Octane restart**: When Octane was killed without an in-flight gRPC call, the MCP server never detected the death — kept stale channels, `create_node` returned handle 0 silently. Added `ensureConnection()` health check that pings Octane after 30s idle and resets all channels/caches on failure.
- **Octane shutdown hang**: Closing Octane while the dev server was connected caused Octane to hang indefinitely. Root cause: the callback stream was an infinite server-streaming RPC — Octane's graceful shutdown waited for it to finish, creating a deadlock. Fixed by adding a 60s deadline to the callback stream with auto-reconnect on expiry.
- **Callback stream reconnect on crash**: Stream error handler no longer retries when Octane is gone (ECONNRESET/ECONNREFUSED/CANCELLED). Previously retried every 5s, holding connections open.
- **gRPC keepalive**: All gRPC channels now use HTTP/2 keepalive pings (10s interval, 5s timeout) to detect dead connections faster.
- **`close()` cancels callback stream**: `OctaneGrpcClient.close()` now cancels the callback stream before closing service stubs, ensuring clean teardown.
- **TROUBLESHOOTING.md**: Corrected primitive type crash data (non-deterministic threshold, not fixed at 6). Documented stale channel fix.
- **Versions synced**: Root and MCP `package.json` bumped to 2.1.4.

---

## [2.1.3] - 2026-03-19

### Fixed — MCP Cache Integrity (full code review)

- **`get_scene_tree` wrong node type**: Was calling `ApiItem.outType()` (returns pin output type like `PT_MATERIAL=7`) instead of `ApiNode.type()` (returns node type ID like `NT_MAT_UNIVERSAL=130`). Poisoned SceneCache with wrong types for ALL scene-tree-discovered nodes, silently disabling `connect_nodes` type validation.
- **`create_and_connect` verification**: Used `enterWrapperNode: true` (same v2.1.2 bug already fixed in `connect_nodes`). Caused false-negative verification on geo→placement connections.
- **`create_node` child caching**: Auto-created pin children tracked in `_knownHandles` but never added to `nodes` Map. `getTypeName()` returned undefined for all children, disabling type validation.
- **`get_scene_tree` compact count**: `count` field was `tree.length` (top-level only), not total flattened node count.
- **`SceneCache.removeNode` orphans**: Now recursively removes cached children and cleans `_knownHandles`, preventing stale handle accumulation after mass deletes.
- **`buildHasGroupMap` infinite recursion** (web UI): Added `visited` Set cycle guard — shared materials connected to multiple geo objects caused `Maximum call stack size exceeded` in NodeInspector.
- **`grpc-constants.js`**: Added `LiveLink` and `ApiChangeManager` to `SERVICE_TO_PROTO_MAP` (were relying on fragile filename guessing fallback).
- **CLAUDE.md**: Corrected stale claim that MCP log level default was `'debug'` (actual: `'warn'`).
- **Stale comment**: scene.ts header referenced non-existent `update_scene` tool.
- **Versions synced**: Root and MCP `package.json` bumped to 2.1.3.

---

## [2.1.2] - 2026-03-20

### Fixed — Verification, Logging, Attribute Guards

- **Connection verification false negatives**: Changed `enterWrapperNode: true` → `false` in `connect_nodes` auto-verify (`node.ts`). Was returning wrapper handles instead of source handles, causing every geo→placement connection to report FAILED despite succeeding.
- **Camera init warnings**: Downgraded `Logger.warn` → `Logger.debug` in `CameraService.captureOriginalCameraState()` and `useCameraSync.initializeCamera()` — expected on empty scenes (no RT/camera), not a real warning.
- **hasAttr pre-check**: `set_attribute` and `get_attribute` now call `ApiItem.hasAttr()` before operating. Blocks invalid attribute access with actionable error message instead of silent success-but-no-effect.
- **Log file renames**: `grpc-debug.log` → `log_grpc.log`, `mcp-debug.log` → `log_mcp.log`, `octaneWebR_client.log` → `log_client.log`
- **MCP log level default**: Changed from `'off'` to `'debug'` — `log_mcp.log` was never created because all log calls were filtered out.
- **Transform guard**: `set_attribute` tool description now explicitly warns that A_TRANSLATION/A_ROTATION/A_SCALE must target the transform CHILD handle (pin 3), not the geo object itself.
- **Version queryable**: `get_octane_version` returns `octaneweb_version` field. Root and MCP `package.json` synced to 2.1.2.
- **`[object Object]` in set_attribute response**: Fixed `String(value)` → `value` for float3 attribute responses.

---

## [2.1.1] - 2026-03-19

### Changed - gRPC Debug Logging & Cleanup

- **gRPC debug file logging**: Added to `OctaneGrpcClientBase.callMethod()` — on by default, `GRPC_DEBUG_LOG=0` to disable. Logs mutating calls only (create, set, connect, destroy) to `log_grpc.log`.
- **Vite plugin file logging removed**: REQ/RES/ERR file logging stripped from `vite-plugin-octane-grpc.ts` — all gRPC logging now centralized in the base class.
- **`expected_type` removed from SET calls**: Web UI no longer sends `expected_type` in `setByAttrID`/`setValueByAttrID` — the proto doesn't define it for set operations.
- **Compat layer fix**: `getPinValueByPinID` → `getPinValue` translation now correctly transforms `item_ref` → `objectPtr` for Alpha 5.
- **RT-dependent settings gated**: Viewport resolution lock in `useRenderSettings` now waits for `sceneReady` before accessing RT node, preventing errors on initial load.
- **Abort noise suppressed**: "Failed to fetch" errors from `AbortError` (browser tab switch, navigation) downgraded to `Logger.debug` in `ApiService`, `SceneService`, and `useParameterValue`.
- **Logger default level**: Changed from `DEBUG` to `INFO` in dev mode — reduces console noise while keeping important messages visible.

---

## [2.1.0] - 2026-03-19

### Changed - Unified API Compat Layer

- **Single compat path**: Moved method name translation + param transforms into `OctaneGrpcClientBase.callMethod()`. Both web UI and MCP now share one code path — no duplicate compat logic.
- **Bool revert fix**: MCP `set_attribute` now sends explicit `evaluate: false` then flushes via `ApiChangeManager.update()`, matching web UI's `ItemService.setParameterValue()` pattern. Fixes bool values reverting after set.
- **No deferred batching**: `evaluate: true` (default) on every call. Batching with `evaluate: false` causes stale Octane state.
- **Removed**: `getCompatibleMethodName()`, `transformRequestParams()`, `METHOD_NAME_MAP` from `apiVersionConfig.ts` (moved to base)
- **Removed**: Compat calls from `ApiService.callApi()` (base handles translation)
- **Removed**: Hardcoded Alpha 5 method names from MCP tools (`attribute.ts`, `node.ts`)
- **Verified**: Glass metal scene built end-to-end via MCP, all material types + bool attributes confirmed working

---

## [2.0.0] - 2026-03-19

### Changed - Doc Consolidation + MCP Integration Test

- **Doc consolidation**: 8 MCP docs → 4 (REFERENCE.md, BUILD.md, CREATIVE.md, TROUBLESHOOTING.md)
- **Inline MCP rules**: 18 gate rules in CLAUDE.md — crash prevention, connection gotchas, workflow gates
- **Recipe style guide**: all 8 recipes converted to creative briefs (Vision + Ingredients only, no build steps)
- MCP server bundling: esbuild `--bundle` for cross-package imports from client/src
- Generated OBJ assets: sphere_hd.obj (32×16 UV sphere), floor.obj (quad plane)
- Glass metal scene v5 built via MCP (3 smooth spheres on floor, golden hour)

### Deleted

- OCTANE_MCP.md, OCTANE_CHEATSHEET.md, SCENE_BUILDING_TIPS.md, CAMERA_MATH.md, GRPC_CRASHES.md, DRESS_BUILD_PROTOCOL.md, DEMO_SHOW_FLOW.md (all absorbed into new docs)

---

## [Unreleased]

### Changed - Beta 2 Proto Cleanup + ESLint Fix (2026-02-24)

- Beta 2 proto files cleaned up — deleted all old/unused `.proto` files from `server/proto/`
- ESLint config fix — added `globals.node` override for `api-version.config.js`
- MaterialDatabaseService — corrected handle extraction for `getLiveDBCategories`/`getLiveDBMaterials`
- Server/plugin — updated service/proto mappings for current Beta 2 layout

### Added - Progressive Scene Loading (SceneServiceP) (2026-02-24)

- **SceneServiceP** — clean-room progressive loader replacing V1/V2/V3
- **SyncIndicator** — visual spinner during scene builds
- Removed `ProgressiveSceneServiceV3.ts` and all feature flags

### Added - File Node Toolbar (2026-02-21)

- **FileNodeToolbar** — handles file-bearing nodes (images, geometry) with load/reload/save/clear
- Replaced `GeometryToolbar.tsx` (merged into FileNodeToolbar)

### Changed - Large Lint Cleanup (2026-02-21)

- Lint fixes across ~70 files: jsx-a11y, setState-in-render, refs-during-render, unused vars, hooks deps
- Logger usage and type safety improvements in service layer

### Performance - Viewport Canvas Optimization (2025-02-03)

Four-phase optimization of the render viewport:

- **Phase 1**: Conditional canvas resize (50x reduction), throttled status updates (96% fewer re-renders), memoized canvas style
- **Phase 2**: RAF-based rendering loop (`useCanvasRenderer.ts`) — frame coalescing, 60 FPS sync, proper cleanup
- **Phase 3**: Input-side throttling — 30 FPS during drag (70% reduction), `isDragging` state tracking
- **Phase 4**: Progressive render flush — clear stale RAF frames on camera change, eliminated camera lag (300ms→<33ms)

### Bug Fix - Camera State Synchronization (2025-02-03)

- Event-driven camera sync — `camera:reset` event on programmatic camera changes, viewport re-syncs local state
- Prevents jump/snap after Reset Camera or Camera Presets

### Added - Status Message System (2025-02-03)

- `StatusMessageContext` — centralized status bar messages with auto-clear
- Scene build progress, node create/delete, connection state updates

### Added - React 18 Modernization (2025-02-03)

- **P2C**: `React.memo` on ParameterControl, MaterialCard, VirtualTreeRow with custom comparators; `useCallback`/`useMemo` optimizations
- **P2B**: React Query integration — `useMaterialCategories`, `useMaterialsForCategory`, `useDownloadMaterial` hooks
- **P2A**: Skeleton loaders (tree, parameters, viewport, materials), LoadingBoundary with delayed fallback
- **P1**: Error boundaries (`react-error-boundary`), code splitting (lazy-loaded NodeGraphEditor + MaterialDatabase), accessibility improvements

### Fixed - Regressions (2025-02-01)

- Color picker visibility — `useParameterValue` now handles AT_FLOAT3+PT_TEXTURE hybrid pins
- Scene Outliner auto-expansion — fixed dual `useTreeExpansion` hook instance bug

### Added - Render Target Management (2025-02-01)

- Auto-select first render target on scene load
- Right-click "Render" context menu on render target nodes

### Changed - CSS Theme System (2025-02-01)

- Removed `octane-` prefix from all 753 theme variable occurrences
- Dead CSS cleanup: removed unused variables, dead selectors, duplicate definitions
- All hardcoded colors replaced with CSS variables

### Fixed - UI Issues (2025-02-01)

- React Flow container sizing, browser context menu suppression, tooltip simplification

---

## API Version Compatibility (2025-01-31)

- Centralized `api-version.config.js` — single source of truth for Alpha 5/Beta 2
- ES module conversion, TypeScript strict typing fixes

---

## Code Quality (2025-01-30)

- Logger system — centralized multi-level logging (670+ calls across codebase)
- Command History — full undo/redo with branching (50-action history)
- Logging conversion — 400+ `console.*` → `Logger.*`
- Comment cleanup across 33 files — removed obvious "what" comments, kept "why" comments

---

## [1.0.1] - 2025-01-29

- OpenHands skills system (5 skill files)
- Refactored AGENTS.md (595→315 lines)
- Scene Outliner tabs with slanted overlap effect matching Octane SE
- Node Graph Editor tab bar with vertical toolbar

---

## [1.0.0] - 2025-01-22

Production-ready release with:

- **Node Graph Editor** — ReactFlow-based, 755+ node types, 25 categories, connections, multi-select, copy/paste, search (Ctrl+F), minimap
- **Scene Outliner** — hierarchical tree, virtual scrolling, LiveDB/LocalDB tabs, selection sync
- **Node Inspector** — full parameter editing (bool, int, float, vector, color, enum, string), collapsible groups, node type dropdown
- **Render Viewport** — real-time streaming, camera orbit/pan/zoom, HDR, picker tools (material, object, focus, target, white balance)
- **Menu System** — File, Edit, Script, View, Window, Help with platform-aware shortcuts
- **Service Layer** — 11 modular services extending BaseService, event-driven architecture
- **gRPC Integration** — Vite plugin proxy, WebSocket callbacks, full type safety
- **Theme System** — 134 CSS variables, Octane SE dark theme, no inline styles

---

## Version History

| Version   | Date       | Milestone                |
| --------- | ---------- | ------------------------ |
| **1.0.0** | 2025-01-22 | Production-ready release |
| 0.9.0     | 2025-01-20 | Beta with core features  |
| 0.5.0     | 2025-01-15 | Alpha prototype          |
| 0.1.0     | 2025-01-10 | Initial setup            |

---

**Status**: Active Development
**Last Updated**: 2026-03-19
