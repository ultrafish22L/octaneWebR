# Changelog

All notable changes to octaneWebR.

---

## [2.1.1] - 2026-03-19

### Changed - gRPC Debug Logging & Cleanup

- **gRPC debug file logging**: Added to `OctaneGrpcClientBase.callMethod()` — on by default, `GRPC_DEBUG_LOG=0` to disable. Logs mutating calls only (create, set, connect, destroy) to `grpc-debug.log`.
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
