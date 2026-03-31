# Changelog

All notable changes to octaneWebR.

---

## [3.1.1] - 2026-03-31

### Changed

- **Server auto-flush** — `ApiChangeManager::update()` called unconditionally after every `setValueByAttrID` and `connectToIx` in the C++ server. MCP no longer needs `evaluate: false` or manual `update()` calls.
- **MCP streamlined** — all `evaluate: false` → `evaluate: true`, all manual `ApiChangeManager.update()` calls removed. Zero flush-ordering knowledge required in MCP tools.
- **`flush_changes` tool removed** — server handles flushing automatically.
- **`skip_evaluate` param deprecated** — `set_attribute` ignores it; server always flushes.
- **Bool parsing fix** — `set_attribute` with `value: "false"` (string) no longer coerces to `true` via `Boolean()`.

### Added

- **Pin bounds guard** — `connectToIx` returns `FAILED_PRECONDITION` if `pinIdx >= pinCount()`. Prevents SDK crash from connecting to non-existent pins.
- **`notifyWebapp` for all mutation tools** — `set_attribute`, `create_light`, `setup_lighting`, `set_daylight`, `place_geo` primitive path now notify the web UI.
- **`attributeChanged` event** — new WebSocket event type for attribute value changes (separate from structural `nodeChanged`).
- **Inspector live-refresh** — `useParameterValue` hook subscribes to `OnAttributeChanged` via a global dispatcher pattern (1 listener total, Map-based dispatch by handle). Inspector checkboxes/values update in real-time when MCP changes attributes.

### Fixed

- **`place_geo` crash** — `ApiChangeManager.update: unknown C++ exception` when placing first primitive on an RT with no geo group. Root cause: bulk deferred flush of 10+ operations including geo group creation + RT wiring + pin expansion + geometry attachment. Fixed by server-side auto-flush after every mutation.

---

## [3.0.2] - 2026-03-30

### Changed

- **78 → 65 tools** — consolidated getter/setter pairs into toggle tools, merged utility clusters (profile 4→1, stats 3→1, animation 6→1), disabled 3 broken tools.
- **13 tool renames** — standardized to "score" language (`critique_render` → `score_render`, `evaluate_semantics` → `score_sega`), SEGA brand (`set_artistic_intent` → `set_sega`), toggle pattern (`set_clay_mode` → `clay_mode`), clarity (`create_connected` → `create_at_pin`, `plan_composition` → `plan_layout`). Full table in CLAUDE.md.
- **Tiered tool schemas** — 38 core tools keep full descriptions, 24 long-tail tools have slim schemas with `describe_tool()` pointer. Reduces startup token cost ~1,200 tokens.
- **AD workflow ordering fixed** — `set_sega` moved from Phase 2 to Phase 0 (mood set early, not after framing). `plan_layout` no longer requires `analyze_geo` (primitives-only scenes work).
- **Phase-selectable ad-workflow prompt** — `getPrompt("ad-workflow", phase:"2")` loads only that phase (~300 tokens vs ~2K for full workflow).
- **Text concept briefs** — `analyze_reference(scene_description)` accepts text-only input when no concept image exists. At least one concept input (image or text) is required.
- **Material aliases** — 25 common aliases (chrome→silver, stone→stone_rough, wood→bark, etc.) resolve automatically in `suggest_material`.

### Added

- **`search_tools(query)`** — keyword search across all 65 tools by name, summary, category, phase.
- **`describe_tool(name)`** — full parameter documentation for any tool. Essential for long-tail tools with slim schemas.
- **Tool catalog** (`tool-catalog.ts`) — centralized metadata for all tools, powering discovery.
- **§ section refs in tool descriptions** — 15 tools now point to specific doc sections (e.g., `octane://docs/creative/1`).
- **Prerequisite chains in descriptions** — `analyze_geo` → `place_geo` → `fit_camera`, `score_render` → `commit_scores`, `plan_layout` → `validate_layout`.

### Removed

- **`import_materialx`** — RPC not implemented in octaneServGrpc.
- **`list_materialx_nodes`** — same underlying RPC.
- **`benchmark_vlm_models`** — niche VLM calibration tool, not needed for scene building.
- **`get_clay_mode`** / **`get_render_priority`** / **`get_subsample_mode`** — merged into toggle tools.
- **`check_animated`** — merged into consolidated `animation` tool.

---

## [3.0.1] - 2026-03-31

### Added

- **Unified AD Context** — `artState.context` provides a complete snapshot of all AD state (build mode, SEGA intent, placement, iteration history, clay mode) for any tool. Single source of truth.
- **Build modes on ArtDirectionState** — `BuildMode` type (shop/dress/show/null) with `setBuildMode()`. AD flag auto-set per mode defaults (SHOP=off, DRESS/SHOW=on). Manual override with `setMode()`.
- **`apply_material` tool** — applies PBR recipe (roughness, metallic, specular, IOR, albedo) to material node in one call. Replaces 12-call `read_pin_value` + `set_attribute` dance.
- **Full PBR texture pipeline** — GLB→OBJ conversion now extracts albedo, metallic, roughness, and normal maps from glTF PBR materials. All maps auto-wired to correct NT_MAT_UNIVERSAL pins.
- **`octane://ad/mode` resource** — returns current build mode, AD flag, and mode descriptions.
- **`octane://docs/{file}/{section}` resources** — on-demand access to BUILD.md, REFERENCE.md, CREATIVE.md, TESTING.md sections by § number. Replaces loading full doc files.
- **Context-aware VLM critique prompts** — `buildComparisonCritiquePrompt(ctx)` uses AdContext for phase-appropriate scoring. Clay mode prompt has explicit rules preventing material/lighting penalties. Phase 2+ includes SEGA mood target, iteration history, stagnation warnings.
- **New scoring fields** — `lighting_match`, `material_match`, `depth_match` replace ambiguous `density_match` in critique responses.
- **5 new material types** — marble, marble_dark, concrete, ceramic, plaster added to suggest_material database.

### Changed

- **Phase tags renamed** — `[DRESS Phase N]` → `[AD Phase N]`. Phase tags are advisory (when AD is active), not hard constraints. No tag = always available.
- **`[All phases]` removed** — 10 tools had redundant `[All phases]` tags. Removed — no tag means unrestricted.
- **`dress-workflow` prompt → `ad-workflow`** — workflow name decoupled from build mode name.
- **Phase 2 name** — "Dress" → "Style" to avoid confusion with DRESS build mode.
- **`save_render_passes` merged** — `save_render_passes` + `save_render_passes_exr` merged into single tool with `multi_layer: bool` param.
- **`import_geo` demoted** — no longer exposed as MCP tool. `place_geo` handles all geometry placement.
- **`get_art_direction_state` enhanced** — new `build_mode` param sets SHOP/DRESS/SHOW with auto AD flag. Description leads with mode toggle.
- **`critique_render` compacted** — verbose debug blocks (raw prompt, raw response) now conditional on `verbose: bool` param (default false). `top_fixes` capped to 3, `notes` to 200 chars.
- **Stale prompts updated** — setup-scene, add-material, build-lit-object, setup-lighting, mesh-pipeline, critique-loop, ad-workflow all updated to reference composite tools (place_geo, apply_material, setup_lighting, create_light).
- **`suggest_material` instruction** — now directs to `apply_material` instead of manual pin wiring.

### Fixed

- **MAT_PIN constants swapped** — roughness (pin 4→8) and metallic (pin 9→4) were mapped to wrong NT_MAT_UNIVERSAL pins. Fixed + expanded to include specular(6), IOR(12), coating(19), sheen(26), emission(44).
- **GLB binary parse in place_geo** — passing `.glb` path now auto-resolves to converted OBJ from analyze_geo sidecar directory.
- **MTL path detection** — parses OBJ `mtllib` directive instead of guessing `basename.mtl`. Fixes trimesh exports that use `material.mtl`.
- **Texture fallback contamination** — diagnostic images (mugshots, check renders, hero shots) no longer picked up as textures. Mugshots moved to `mugshots/` subfolder.
- **Always wire textures explicitly** — Octane gRPC OBJ loader does NOT process MTL `map_Kd`. Textures now always created and connected manually.
- **Light panel scale** — `setup_lighting` scale now relative to subject size (8% of extent, clamped 0.02-0.2) instead of fixed 0.3.
- **`setup_lighting` bounds fallback** — falls back to `getSceneBounds` when placement state is empty (e.g., after MCP restart).
- **Material DB annotations** — `browse_material_db`, `search_materials`, `preview_material`, `download_material` migrated to `registerTool` with proper MCP annotations.

### Documentation

- **CLAUDE.md rules 10-12** — `reset_project()` before new builds, OTOY Studio for all assets, parallel work during mesh generation.
- **Never-skip-stale-MCP rule** — added to TESTING.md, CLAUDE.md, BUILD.md. Tool missing = stale MCP = restart, never defer.
- **BUILD.md clay critique rules** — explicit VLM scoring guidance for clay mode (spatial layout only, no material/lighting penalties).
- **serv TODO** — added `saveRenderPasses1`, `saveRenderPassesMultiExr1`, `importFromFile` (OBJ+MTL) as unimplemented RPCs.
- **`[Debug]` tag** — added to 4 profiling tools (profile_start/end/report/reset).

## [2.4.6] - 2026-03-30

### Added

- **`place_geo` tool** — unified geometry placement for primitives and meshes. Creates node, sets shape/transform/material, wires to geo group, auto-registers in placement state. Replaces manual `create_node` + `connect_nodes` for primitives. Mesh path calls `import_geo` internally and reads sidecar.
- **HDRI generation workflow** — documented in BUILD.md, OTOY_STUDIO.md, and dress-workflow prompt. Generate equirectangular panorama via OTOY Studio flux-pro, apply with sphere projection.
- **`clearScene()` on ArtDirectionState and SemanticState** — composition specs and SEGA intent survive `reset_project`. Only scene-specific state (handles, critique history) is cleared.
- **Public API on ArtDirectionState** — `setCalibration()`, `getCalibration()`, `getSpecs()` replace `as any` private field access.

- **`reset_ad` tool** — clears all AD state (specs, SEGA vector, scores, placement DB) without touching Octane scene. Use before `reset_project` when starting a new scene.
- **Clay critique gate** — `critique_render` in clay mode uses composition-only grading scale (composition_match >= 3 = pass). Sonnet is told it's clay and ignores materials/lighting. `framing_verified` set automatically on pass. Mechanically enforced — no orchestrator rationalization.
- **Mugshot VLM always runs** — `source_endpoint` parameter deprecated and ignored. All meshes run full 2-pass VLM mugshot verification. Known-source fast path disabled.
- **Mugshot serv compatibility** — `renderViews` uses shared `createMeshPlacement` helper matching `import_geo` pattern. Fixes `pinCount is 0` errors with serv build 5.
- **`ANTHOPIC_CLAUDE_KEY`** → `ANTHROPIC_CLAUDE_KEY` — fixed env var typo in vision/anthropic.ts.

### Changed

- **MCP_BUILD** — bumped to 72
- **Tool renames** — `analyze_mesh` → `analyze_geo`, `import_mesh` → `import_geo`. `place_mesh` removed (use `place_geo`).
- **Tool description compression** — top 15 tool descriptions reduced ~58% (3,100 chars cut). Phase tags and critical gotchas preserved.
- **Vision MIME detection** — sniffs file header bytes instead of extension. Fixes JPEG-in-PNG from OTOY Studio.
- **`findOrCreateGeoGroup` helper** — wires geo group to existing RT instead of creating duplicate RT.
- **Orchestrator grade** — mandatory at critique step C3. Added to BUILD.md, dress-workflow, and critique-loop prompts.
- **Scene complexity classification** — Standard/Advanced/Very Advanced added to BUILD.md.

### Fixed

- **Null guard on `artState`** in camera.ts `set_camera` — prevented runtime crash when AD state is undefined.
- **Stale tool names** — 66 references to `analyze_mesh`/`import_mesh`/`place_mesh` replaced across 14 files.
- **`semantic_critique` → `evaluate_semantics`** — fixed in ADSYSTEM.md, sega/index.ts, prompts.ts.
- **`score_mugshot_models` → `benchmark_vlm_models`** — fixed in BUILD.md and import.ts.
- **`log_serv` → `log_client`** — fixed in dress-workflow prompt.
- **Phase 2 tools in `octane://workflow/phases`** — added `setup_lighting`, `create_light`, `set_daylight`.
- **Dead imports** — removed unused `path`/`fs` in attribute.ts, unused `enumeratePins` in animation.ts.

---

## [2.4.5] - 2026-03-29

### Added

- **dxSS shared surface rendering** (Electron dist) — DirectX 11 GPU DMA pipeline bypasses protobuf serialization. Native addon (`dx_shared_surface.node`) maps shared textures via `OpenSharedResource1` → `CopyResource` → `Map`. ~2ms total vs ~10ms for pixel path.
- **`GrpcProxyServer` dxSS integration** — 3-step `enableSharedSurface()` init, `grabSharedFrame()` RPC with 0x0 frame guard, in-flight handle tracking with stale cleanup timer (10s), `destroySsDevice()` on shutdown
- **`SharedSurfaceFrameService`** in octaneServGrpc — `grabSharedFrame` clones surfaces and `DuplicateHandle`s into client process; falls back to render statistics for dimensions when `ApiRenderImage.mSize` is zero in SS mode; 30s TTL purge for orphaned clones
- **Electron packaging** — `api-version.config.js` reads `OCTANE_PROTO_DIR` env var for packaged builds; `electron/main.ts` sets proto dir before loading server module

### Changed

- **MCP_BUILD** — Bumped to 70
- Vite dev mode explicitly disables shared surface output on startup (`setSharedSurfaceOutputType(0)`)

### Fixed

- **Callback conflict** — GrpcProxyServer no longer overwrites MCP's gRPC callback registration; uses own callback stream instead of MCP relay
- **Proto field name** — `realtime` → `realTime` in `setSharedSurfaceOutputType` call (matches proto definition)
- **Vite `close()` missing `stopRelayProbe()`** — relay probe timer could fire after close
- **CallbackStreamManager reconnect loop** — `end` handler uses `scheduleReconnect` when disconnected instead of immediate `openStream`, preventing tight loops after serv restart
- **Stale handle cleanup** — stale SS handle sweep collects entries before iterating to avoid map mutation during iteration

### Removed

- Dead `extractSharedSurfaceMetadata` in Vite plugin — async mutation of already-sent payload, SS disabled in Vite mode

---

## [2.4.4] - 2026-03-29

### Added

- **Sonnet-only AD vision** — all AD vision calls (critique, reference analysis, calibration) use Anthropic API (Sonnet). Moondream3/otoy-studio only for mugshots.
- `critiqueWithReference()` sends concept art + render as two images to Sonnet → A-F grade
- `callVision()` / `callVisionPair()` — unified single/dual-image Sonnet calls
- Per-scene `critique_stats.jsonl` audit trail for system tuning
- `ComparisonScores` / `OrchestratorAssessment` on CritiqueRecord
- **Calibration persistence** — `calibrateReference()` saves `.calibration.json` sidecar next to concept art, reloads on future sessions. Skips Sonnet call when cached.

### Changed

- Trimmed VLM prompts to ~3 lines (from 40+)
- Default mugshot margin 0.05 → 0.1
- Hero shot now renders on known-source fast path (was missing)
- `fit_camera` queries actual film resolution for aspect ratio (no more hardcoded 2:1)
- **SceneCache simplified** — removed all validation/staleness tracking (~170 lines). Pure hint layer, server owns all validation.
- **CallbackStreamManager simplified** — removed exponential backoff, replaced with fixed 5s reconnect interval. Removed `isReconnecting` state.
- **OCTANE_FILE_ROOTS** — default changed from hardcoded `C:\otoyla` to user home directory. Works cross-platform.
- **MCP_BUILD** — Bumped to 69

### Fixed

- `try/finally` safety for clay mode restoration + node cleanup in `renderViews`
- Error logging in all catch blocks (no silent swallows)
- **Vision silent fallback** — `callVision()`/`callVisionPair()` now throw on missing API key or Sonnet error instead of returning empty results silently
- **critique_render vision failure** — `visionCompare()` wrapped in try-catch, falls back to self-critique with warning instead of failing the entire tool

### Deleted

- Dead `renderMugshots` (~270 lines) — all rendering via `renderViews`
- `gateHandle()`, `trackHandle()`, `validateHandle()` — all handle validation moved to server
- SceneCache staleness API: `isNodeStale`, `staleNodeCount`, `getNodeAge`, `touchNode`, `markPopulated`, `isPopulated`, `knownHandleCount`
- CallbackStreamManager backoff: `reconnectAttempt`, `BACKOFF_BASE_MS`, `BACKOFF_MAX_MS`, `isReconnecting`

### Docs

- **Autonomous mode guardrails** — BUILD.md §3 adds mandatory phase gates (G0-G7), common drift patterns, and hard rule against self-grading
- **Cardinal rules 6-8** in CLAUDE.md — Sonnet is the critic, hero meshes from image-to-3D, use suggest_lighting/suggest_material
- **ADSYSTEM.md** — "never self-grade" block, DRESS mode steps are non-optional; moondream3 role clarified (mugshot pre-pass only)
- **OCTANE_FILE_ROOTS** documented in README.md and QUICKSTART.md with cross-platform examples
- Extracted constants: `MUGSHOT_FILM_RESOLUTION`, `MUGSHOT_SAMPLES`, `MUGSHOT_ENV_POWER`, `DEFAULT_MUGSHOT_MARGIN`, `PANCAKE_HEIGHT_THRESHOLD`
- Extracted helpers: `isPancakeMesh()`, `writePlaneOBJ()`

---

## [2.4.3] - 2026-03-29

### Added

- **Source endpoint tracking** — `analyze_mesh` accepts `source_endpoint` param. Known endpoints (e.g. "huynan") skip VLM Pass 1 and apply deterministic axis correction. Sidecar records source, axis convention, and known rotation.
- **Endpoint axis map** — `ENDPOINT_AXIS_MAP` config for deterministic Z-up → Y-up correction per endpoint. Currently: huynan → X+90°.

### Fixed

- **Blurry mugshots** — Render wait threshold was 100 samples but max was set to 256. Now waits for 250 samples before saving.
- **Node accumulation** — `renderViews()` now deletes all created nodes (RT, camera, kernel, env, geo group, mesh, placement, ground plane) after rendering. Scene tree stays clean across multiple `analyze_mesh` runs.
- **Washed-out hero shot** — Hero shot now renders with textures (`clay: false`) instead of color clay mode. Diagnostic/check views remain clay for VLM clarity.
- **Loose hero framing** — Hero shot margin reduced from 0.15 (15%) to 0.05 (5%) for tighter framing. `ViewSpec` now supports per-view `margin` and `clay` overrides.
- **Ground plane temp file cleanup** — Generated ground plane OBJ files are deleted after rendering.

### Changed

- **Pass 2 max attempts** — Increased from 3 to 4 iterations for verification loop.
- **Autonomous operation** — `analyze_mesh` proceeds autonomously by default. Human review only flagged when `verified: false` after max Pass 2 attempts. Hero shot always rendered as thumbnail/reference.
- **MCP_BUILD** — Bumped to 61.

---

## [2.4.1] - 2026-03-25

### Added

- **analyze_mesh v2 + Mugshot Protocol** — Visual orientation check via VLM. Renders 6 mugshot views (front/right/top x clay/textured) on isolated ground plane, sends to haiku for upright verification. Caches in `.mesh_info.json` v2 sidecar with geometry, semantic, visual_check, and final_suggestion blocks.
- **Scene placement tools** — `suggest_placement`, `register_scene_object`, `get_scene_placement_state` for collision-free object placement with scene awareness database.
- **Scene project structure** — `aigenerated/` folder convention with concept_art, recipe.md, assets, temp, renders per scene.
- **AD critique rules** — Never skip AD critique, stop when exhausted, run semantic_critique alongside critique_render.
- **fit_camera() hard rule** — Mandatory after every geometry placement.

### Fixed

- **CallbackStreamManager** — newImage events now always emit to relay listeners regardless of `handleNewImage` flag. Fixes viewport grey while save_render worked. Root cause: stale `.js` file shadowing `.ts` source.
- **Mesh orientation** — Z-up models now use +90 X rotation (was -90, which gave upside-down). Ground offset math corrected for post-rotation bounds remapping.
- **gRPC API calls in renderMugshots** — `setAttrRaw` now uses `ApiItem.setValueByAttrID` (was nonexistent `ApiNode.setNodeAttributeFloat`). `connectRaw` uses `pinIdx` (was `pinIx`). Camera uses `LiveLink.SetCamera` (was `ApiRenderEngine.setCamera`). Scene bounds uses `getSceneBounds` (was `getSceneBbox`).
- **Mugshot camera framing** — Uses mesh extents instead of scene bounds (ground plane was dominating the frame).

### Changed

- **Version tracking emphasis** — CLAUDE.md now documents mandatory version checking workflow with `mcp_build` field after every code change.
- **Build number** — MCP_BUILD incremented to 16 during development, tracks code changes.

---

## [2.4.0] - 2026-03-24

### Added

- **Gotcha sweep hardening** — Systematic audit of all MCP tool gotchas; defensive guards added where silent failures were possible.
- **fit_camera tool** — Computes and sets camera to frame a bounding box (explicit or auto from scene bounds). Configurable elevation, yaw, and margin.
- **DOF auto-disable** — Default aperture (0.893) now documented and auto-set to 0 in build workflows to prevent blurry renders.
- **FRESH / MINIS concepts** — Lightweight build patterns for quick scene prototyping and minimal reproducible scenes.
- **Build version tracking** — `get_octane_version` returns `octaneweb_version`; root and MCP `package.json` synced to 2.4.0.

### Changed

- **Proto consolidation** — Protobuf definitions cleaned up; legacy duplicates removed, single source of truth in `server/proto/`.
- **7 guards debunked and removed** — Crash-probe testing disproved 7 overly cautious guards that were blocking valid operations. Guards removed, operations now permitted.

### Fixed

- Various silent-failure paths hardened across MCP tools based on gotcha sweep findings.

---

## [2.3.2] - 2026-03-24

### Added

- **ALPHA5_COMPAT.md** — Dedicated doc for Alpha 5 compatibility (mesh reload quirks, handle numbering, pin differences, compat layer transforms, gRPC log gaps).
- **SCRATCH protocol** in BUILD.md §2 — Clean start procedure: kill servers, reset MCP (port 51023 relay), restart, verify viewport streaming before any scene building.
- **Preview comparison** in TEST_PLAN.md §1 — Test cycle now requires comparing preview viewport vs saved render at every visual step.

### Changed

- **Mesh loading pattern** — A_RELOAD + update_scene() now documented as mandatory in REFERENCE.md §1, BUILD.md §3, and all recipes. Without both, meshes load silently empty.
- **DRESS/SHOW modes** — BUILD.md §2 now defines three modes: SCRATCH (clean start), DRESS (rehearsal, stop on failure), SHOW (demo, no stopping).
- **Alpha 5 references consolidated** — All alpha5/beta2 details moved out of ARCHITECTURE.md, REFERENCE.md, BUILD.md into ALPHA5_COMPAT.md. Main docs now reference serv (2026.2) only.

### Fixed

- **MCP relay race condition** — SCRATCH protocol now kills all node processes (not just the PID on port 51023) to avoid relay port not releasing in time. Documented in BUILD.md §2.

---

## [2.3.1] - 2026-03-21

### Tested — Full MCP Test Sweep

- **67/71 active tools pass** against live Octane. 0 crashes. 3 bugs fixed (animation data format, attribute enum type, pin value cache).
- **LiveDB disabled** — all 4 tools hit Octane gRPC "invalid pointer type" bug. Code preserved, registration commented out.

---

## [2.2.x] - 2026-03-21/22

### Electron Production Build (v2.2.4)

- Fixed log_grpc.log ENOENT crash (asar path), broken icons (URI encoding), GrpcProxyServer compilation (separate build script), app icon.

### Crash Probe Testing & Guard Deployment (v2.2.3)

- 19 test categories, 460+ primitive enum transitions. <0.2% crash rate. Delete guard deployed. SceneCache coherence audit: 86 connections, perfect match.

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

## Pre-2.0.0

See git history for incremental releases (Jan-Feb 2025). Key milestones: v1.0.0 production release (2025-01-22), viewport canvas optimization, React 18 modernization, CSS theme system, API version compatibility layer.

---

**Status**: Active Development
**Last Updated**: 2026-03-29
