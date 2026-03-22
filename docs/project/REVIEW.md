# OctaneWebR — Repository Review

_March 21, 2026 — Version 2.2.2_

---

## What This Project Is

OctaneWebR is a browser-based front end for OTOY's Octane Render Studio. It connects to a running Octane instance over gRPC, giving you a full scene editor — node graph, inspector, outliner, real-time render viewport — all inside a browser tab. Alongside the web UI sits a standalone MCP server with 67 tools, designed so that an AI agent can build, light, and iterate on Octane scenes through natural language.

The two halves share a single gRPC client library and the same set of protocol definitions, so everything that works in the UI also works through MCP, and vice versa. The project is written entirely in TypeScript (strict mode), uses React 18 for the client, Vite 5 for the dev server, and esbuild for the MCP bundle.

---

## Architecture

The system has three layers, plus a parallel MCP path.

The **React client** runs in the browser. It renders the viewport, the ReactFlow node graph, the virtualized scene outliner, and the parameter inspector. It talks to the middle tier over HTTP and WebSocket — never directly to Octane. The client is wrapped in four nested context providers: `QueryClientProvider` (React Query), `OctaneProvider` (connection and service access), `StatusMessageProvider` (global status bar), and `EditActionsProvider` (cut/copy/paste dispatch). Shared scene state — the selected node, the full scene tree, and sync flags — lives in `AppContent` and is threaded through props rather than additional context, which avoids unnecessary re-renders of unrelated panels.

The **Vite plugin** (`vite-plugin-octane-grpc.ts`, 1,040 lines) is the middle tier. Rather than spinning up a separate Express server, a custom Vite plugin embeds a gRPC proxy and a WebSocket relay. REST endpoints at `/api/grpc/{service}/{method}` translate JSON into gRPC calls. A WebSocket channel streams render frames back to the client in real time (OnNewImage callbacks). The plugin also serves a trimmed API metadata cache (`/api/cache`) that the client fetches at startup to populate node-type colors, pin layouts, and attribute metadata without waiting for live gRPC calls. This keeps the dev setup to a single `npm run dev`. The plugin has its own leveled logger (NONE through DEBUGV) with ANSI-colored terminal output, independent of the client's Logger utility — a minor inconsistency but appropriate since the plugin runs in Node, not the browser.

The **shared gRPC base** (`OctaneGrpcClientBase`) lives in `server/src/grpc/` and handles proto loading, service resolution, method invocation, and an API compatibility layer that translates between Beta 2 (current) and Alpha 5 (legacy) method names. Both the Vite plugin and the MCP server import this same class, so there's no duplicated gRPC logic.

The **MCP server** runs as a separate stdio process (launched by Claude Code via `.mcp.json`). It wraps the same gRPC base in a Model Context Protocol interface: 67 tools, 9 resources, 4 prompts. It maintains its own in-memory SceneCache and ArtDirectionState for tracking scene graph handles and iterative composition workflows.

At the bottom of the stack, **Octane Render Studio** listens on `127.0.0.1:51022`, speaking gRPC over 96 protobuf service definitions.

---

## The Web UI

The client is roughly 27,400 lines of TypeScript/TSX spread across 19 component directories, 12 services, 20+ hooks, and 6,400 lines of CSS. The layout is a CSS Grid shell: a 5-column, 3-row grid with resizable splitters (implemented via `usePanelLayout` with mousedown/mousemove handlers, not a library). Panels can be toggled on and off, and the grid template recalculates dynamically.

The **viewport** is the centerpiece — a canvas that decodes HDR image buffers streamed over WebSocket. Five custom hooks manage camera sync, canvas rendering, image buffer processing, mouse interaction (orbit, pan, zoom), and viewport actions. Camera controls work by sending position/target/up vectors back to Octane through the gRPC proxy. The viewport component is wrapped in `React.memo` and exposed via `forwardRef` with an imperative handle (`recenterView`), so the parent can trigger actions without re-rendering the canvas.

The **node graph** uses ReactFlow v12 (`@xyflow/react`). It supports 755+ Octane node types, drag-and-drop from the outliner, context menus for creating and connecting nodes, copy-paste, and a search dialog. The graph editor (920 lines) is split into an inner `React.memo` component and an outer wrapper, and is lazy-loaded via `React.lazy` with a `Suspense` fallback — one of only two lazy-loaded components (the other is the Material Database modal).

The **node inspector** (1,001 lines in `index.tsx` plus 1,042 in `ParameterControl.tsx`) renders type-specific editors — bools, ints, floats, vectors, colors, enums, strings, collapsible groups — for whichever node is selected. Parameter values are fetched individually per-node via the `useParameterValue` hook, which queues gRPC calls through a `RequestQueue` (capped at 4 concurrent requests) to avoid exhausting the browser's connection pool. The `ParameterControl` component uses a custom `React.memo` comparator that deep-compares vector values (`{x, y, z, w}`) to avoid re-renders from structurally-equal but referentially-different objects. A `DeferredInput` sub-component delays gRPC writes until blur or Enter, preventing a network call on every keystroke. A `NumberInput` sub-component provides Octane-style scrub-drag interaction with arrow buttons, ResizeObserver-based responsive layout, and a visual fill bar.

The **scene outliner** virtualizes the tree with `react-window` v2 for performance. It has three tabs (Scene, LiveDB, LocalDB), visibility toggles, and selection sync with the graph and inspector. Progressive loading keeps the initial render fast even for large scenes. The `VirtualTreeRow` component has its own custom `React.memo` comparator. A bridge-ref pattern resolves a circular dependency between `useSceneTree` (which produces the tree) and `useTreeExpansion` (which needs the tree to compute expansion state but is also needed by the tree loader to initialize expansion).

The **service layer** follows a consistent pattern: every service extends `BaseService` (a thin wrapper around a custom typed `EventEmitter` with error handling), and `OctaneClient` acts as the facade that aggregates 12 services. The client is a singleton obtained via `getOctaneClient()` and stored in React state (not a ref), so connection changes propagate through the `OctaneProvider` context. Services are loosely coupled — `NodeService` handles CRUD, `CameraService` handles position math, `RenderService` handles the pipeline, and so on. A `CommandHistory` service provides undo/redo with branching (50-action cap, discards redo stack only after successful execute). React Query (`@tanstack/react-query` v5) is integrated with a well-structured query key factory and three configuration presets (realtime at 0ms stale, stable at 10min, on-demand at infinity), though its usage appears concentrated in the material database rather than spread across all data fetching — most scene data still flows through the imperative service/event-emitter path.

Three CSS themes (Octane, Vibe, Debug) are implemented through CSS custom properties, with 6 depth-shading levels for inspector nesting. The themes are small (~210 lines each) because they only define variable values; the 5,750 lines of component CSS in `styles/` consume them. All three theme files are imported at startup. Octane is the default (its CSS targets both `:root` and `[data-theme='octane']`). Runtime switching is available via File > Preferences > Theme, which sets a `data-theme` attribute on `<html>` and persists the choice to localStorage.

**React StrictMode is not enabled.** The `main.tsx` entry point renders `<App />` directly without `<React.StrictMode>`. The `OctaneProvider` does include manual double-mount protection for its event listeners (tracking them in a ref and removing stale ones), which suggests Strict Mode was tested at some point and caused duplicate listener issues with the singleton `OctaneClient`. This is a pragmatic choice given the imperative gRPC event model, but it means the app does not benefit from Strict Mode's development-time warnings about unsafe lifecycle patterns or impure renders.

**Accessibility** is partially addressed. The ESLint config includes `eslint-plugin-jsx-a11y` with its recommended ruleset, and dialogs consistently use `role="dialog"`, `aria-modal`, and `aria-labelledby`. Splitters have `role="separator"` with aria-labels. However, the global context menu handler in `AppContent` calls `e.preventDefault()` on every right-click across the entire document, which disables the browser's native context menu everywhere — including places where no custom menu is provided. Ten `eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions` comments suppress warnings on dialog overlays and splitters. Keyboard navigation within the node graph and the outliner tree is not fully implemented — arrow-key traversal of the virtual tree is absent, and focus management after node selection relies on mouse interaction.

---

## The MCP Server

The MCP server totals roughly 7,900 lines of TypeScript across tool modules (~4,600 lines in 17 files under `mcp/src/tools/`), core infrastructure (~1,200 lines: `OctaneMcpClient`, `SceneCache`, `ArtDirectionState`, `ApiCache`), and subsystems (~1,400 lines: vision, creative, resources, prompts). An additional ~700 lines of tests live in `mcp/src/__tests__/`. Its 67 tools are organized into 14 modules by domain: nodes, attributes, render, camera, animation, scene, stats, art direction, import, color/MaterialX, render control, project management, system info, and a webapp sync tool.

Every tool follows the same registration pattern — a `registerXTools(server, client, cache?)` function using Zod schemas for input validation and standardized `jsonResult()`/`errorResult()` helpers for output. A monkey-patch wrapper in `index.ts` intercepts `server.tool()` to log every invocation with timing, args (truncated to 300 chars), and elapsed milliseconds. This is done by replacing the handler function at registration time rather than at call time, so there is zero per-call overhead beyond the logging itself. The wrapper uses four `as any` casts — the only ones in the MCP codebase — because the MCP SDK does not export the variadic handler type.

**OctaneMcpClient** (`OctaneMcpClient.ts`, 501 lines) wraps the shared gRPC base with three MCP-specific concerns. First, a **promise-based mutex** serializes all gRPC calls — Octane's message thread processes requests sequentially, so concurrent requests only risk race conditions. Each `callMethod` awaits the previous call's promise before proceeding. Second, a **health check** pings Octane (`ApiProjectManager.getPing`) if the connection has been idle for 30+ seconds, detecting manual Octane kills that would not trigger an `ECONNRESET`. On failure it resets gRPC channels but deliberately preserves the SceneCache — a subtlety that prevents spurious `GATED` rejections after a transient connection hiccup. Third, a **crash detector** (`enhanceCrashError`) pattern-matches five gRPC error signatures (ECONNRESET, ECONNREFUSED, Stream removed, Connection dropped, socket hang up) and transforms them into structured error messages with recovery steps for the AI agent, clearing all cached handles since they are invalid after a crash.

The client also maintains a **two-tier metadata cache**: a static `ApiCache` loaded from `mcp/data/octane-api-cache.json` (generated offline, covering 724 node types and their pin layouts), and a dynamic cache backed by four in-memory Maps for `ApiInfo` query results (node info, pin info, attribute info, compatible types). The static cache eliminates hundreds of gRPC round-trips per scene build — `create_node` can look up type IDs and pin layouts instantly. The dynamic cache fills gaps on demand and persists for the session. Both are cleared on crash/load/reset.

A **built-in profiler** (`profileStart`/`profileEnd`/`profileReport`) auto-instruments every gRPC call and can report wall-clock time, per-method call counts, total gRPC time, and overhead breakdown. Profile spans are stored in a ring buffer capped at 10,000 entries with automatic compaction.

**SceneCache** (`SceneCache.ts`, 328 lines) is more than a simple lookup table — it tracks three parallel data structures: nodes (handle → name, typeName, typeId, timestamp), connections (target:pinIndex → sourceHandle), and children (graphHandle → childHandles[]). Its primary role is crash prevention: `gateHandle()` in `utils.ts` validates every handle parameter before it reaches Octane by checking against a `_knownHandles` Set that accumulates every handle ever returned by any MCP tool response. An unpopulated cache with no tracked handles permits any handle through (the bypass avoids a chicken-and-egg problem at session start); once any handle is tracked, unknown handles are rejected with a structured error message that tells the AI agent to call `get_scene_tree` to discover valid handles. Entries have a 5-minute staleness threshold exposed via `isNodeStale()` and `staleNodeCount`, though staleness is currently advisory — no tool automatically refuses stale handles. The `removeNode()` method recursively cleans up children, connections referencing the deleted handle, and the known-handles set.

**ArtDirectionState** (`ArtDirectionState.ts`, 206 lines) is a pure state container with no gRPC dependencies, making it fully testable. It tracks composition specs (name → camera, objects, depth layers, focal point, lighting mood), critique history with per-dimension scores (framing, depth, composition, lighting, placement), and object-to-Octane-handle mappings. Stagnation detection flags when the last two iterations improved by less than 0.3 points. An exhaustion check stops iteration after 5 attempts (configurable via `MAX_ITERATIONS`). The passing threshold is 3.5 overall with no individual dimension below 2.0. Note: unlike SceneCache, ArtDirectionState is not currently cleared on project load or crash — see issue 14.

The **art direction tools** (`artdirection.ts`, 719 lines) are the most architecturally interesting module. Three tools are pure math with no Octane calls: `plan_composition` computes camera placement from object layouts and validates the result through a geometric analyzer that checks frustum containment, depth layer separation (warns below 15% of scene depth), object proximity (warns below 0.5 units), composition grid alignment (rule-of-thirds, golden ratio, centered, diagonal), and lighting angles (warns when key light is within 15 degrees of camera axis). `validate_layout` re-runs this analysis on an existing spec. `analyze_reference` extracts structured composition data from a reference image. Two tools use gRPC: `critique_render` saves the current render and delegates scoring to the vision subsystem, and `apply_corrections` records scores and emits iteration guidance (focus on weakest dimension, stagnation warning, exhaustion stop). `get_art_direction_state` is read-only inspection.

The **vision subsystem** (`mcp/src/vision/`, 732 lines across 5 files) implements a fallback chain: Anthropic API (via `ANTHOPIC_CLAUDE_KEY` or `ANTHROPIC_API_KEY` environment variables, defaulting to `claude-haiku-4-5-20251001`), then Gemini API (via `GEMINI_API_KEY`, defaulting to `gemini-2.0-flash`), then self-critique (returns a structured prompt for the calling Claude to answer). Both vision clients use Node's built-in `fetch` with zero npm dependencies. Images are loaded as base64 with mime-type detection. A JSON repair pipeline in `analyzeReference` handles truncated VLM responses by closing unclosed brackets/braces — a practical defense against token-limit truncation. The OTOY Studio module (`otoy-studio.ts`) provides image upload to R2 storage via the OTOY Studio MCP worker but is not yet integrated into the critique flow as a vision backend. Note: the Anthropic key environment variable has a typo (`ANTHOPIC_CLAUDE_KEY`) that has been preserved for backwards compatibility alongside the corrected `ANTHROPIC_API_KEY`.

The **creative subsystem** (`mcp/src/creative/`, 714 lines across 3 files) provides two pure-knowledge tools. `suggest_lighting` computes 3-point lighting positions from scene bounds using trigonometric placement (azimuth + elevation angles relative to subject center), with 7 mood presets that vary key/fill/rim ratios, color temperatures, and power levels. `suggest_material` returns physically-based attribute values (albedo, roughness, metallic, specular, IOR, plus optional sheen, coating, transmission, and emission) for 30+ surface types. Both tools return JSON recipes with `instruction` strings that tell the AI agent how to apply the recipe using existing MCP tools — they never create Octane nodes themselves.

**MCP Resources** (`resources.ts`, 264 lines) expose 9 read-only endpoints organized in three tiers. Static resources (from `ApiCache`): `octane://node-types` (full catalog), `octane://node-types/{category}` (filtered by prefix like MAT, TEX, GEO), `octane://pin-layout/{typeName}` (all pins for a node type), `octane://compatibility/{pinType}` (compatible node types for a pin), and `octane://primitive-types` (hardcoded enum table including the crash-causing Quad type 18). Dynamic resources (from live Octane, cached after first hit): `octane://node-info/{typeName}`, `octane://pin-info/{typeName}/{pinIndex}`, `octane://attribute-info/{typeName}/{attrId}`. Scene resource: `octane://scene` (serializable SceneCache snapshot with per-node staleness data). Resources degrade gracefully — static resources return a `{ error: "API cache not loaded" }` JSON when the cache file is missing, rather than throwing.

**MCP Prompts** (`prompts.ts`, 223 lines) encode four workflow templates: `setup-scene` (RT creation through first render, covering the 8-step critical path), `add-material` (PBR material with texture connections), `build-lit-object` (complete geometry + material + placement + lighting chain), and `troubleshoot-render` (diagnostic guide for 7 common failure modes). These prompts embed the same hard-won gotcha knowledge from `CLAUDE.md` and `docs/mcp/TROUBLESHOOTING.md` — DOF defaults, emission efficiency, pin_index vs pin_id, crash type IDs — so that any MCP client gets the domain knowledge, not just Claude Code sessions with CLAUDE.md loaded. The prompts use imperative second-person instructions with specific tool names and parameter values, which makes them directly actionable rather than merely informational.

The **webapp sync module** (`webapp.ts`, 79 lines) bridges MCP and the web UI by POSTing scene events (nodeAdded, nodeDeleted, nodeChanged, sceneChanged) to octaneWebR's `/api/scene-event` endpoint. Notifications are fire-and-forget with a 2-second timeout — the webapp may not be running. A `liveSyncEnabled` flag allows toggling notifications off for batch operations.

Four LiveDB tools (browse, search, preview, download) are currently disabled because they hit an "invalid pointer type" bug in the Octane gRPC API. The code is preserved in `mcp/src/tools/materials-db.ts` (200 lines) and the import is commented out in `index.ts` with a clear note. They will be re-enabled after an Octane update.

---

## Code Quality

TypeScript strict mode is on (`strict: true` plus `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`). The codebase is consistent — tool modules follow the same shape, services follow the same base class, Zod validates all MCP inputs at runtime. ESLint (flat config, `eslint.config.mjs`) enforces `@typescript-eslint`, `react-hooks`, `react-refresh`, and `jsx-a11y` rules. Prettier and Husky + lint-staged run on commit, catching formatting and lint errors before they land. Notably, the ESLint config explicitly ignores `server/`, `mcp/`, and the Vite plugin itself — only `client/src/` is linted.

Error handling is standardized: every MCP tool wraps its gRPC call in try/catch and returns through `errorResult()`. The defense is layered — `gateHandle()` validates handles against the SceneCache's known-handles set, `CRASH_TYPE_IDS` blocks 10 known crash-causing node type IDs at creation time, `validateFilePath()` restricts file operations to configured roots (defaulting to `C:\otoyla`), and `set_attribute` pre-checks `ApiItem.hasAttr` before writing (returning a specific error message instead of an opaque gRPC failure). The `connect_nodes` tool auto-verifies every connection by reading back the pin's connected handle after writing, catching Octane's common silent-failure pattern where `connectTo1` returns success but the pin remains disconnected. The `set_attribute` tool also validates `A_FILENAME` paths — checking both that the path is absolute and that the file exists — because non-existent paths cause Octane to pop a blocking dialog that hangs gRPC for 30 seconds. Expected-failure catch blocks throughout the tool modules (pin queries, attribute reads, connection verification) log at verbose level via `mcpLogLazy` so that debugging is possible without noise at normal log levels. On the client side, `ErrorBoundary` components (backed by `react-error-boundary`) wrap every major panel individually — the outliner, viewport, graph, inspector, toolbar, and each dialog all get their own boundary, so a crash in one panel does not take down the others. The default recovery action is a full page reload, which is reasonable given the stateful gRPC connection.

The custom `EventEmitter` is well-implemented: it iterates a snapshot of handlers during emit (so `off()` inside a handler is safe), wraps each handler in try-catch (one failing listener does not block others), and warns at 20 listeners per event to surface leaks early.

The weak spots are in type safety around gRPC responses. Because proto-loader returns untyped objects, there is a `Record<string, any>` boundary at every gRPC call site. In the MCP codebase specifically, four `as any` casts exist — two in `index.ts` (the `server.tool` monkey-patch wrapper that the MCP SDK's types do not accommodate) and two in `vision/index.ts` (accessing `observations` and `differences` fields from a parsed critique response whose type does not declare them). The `OctaneMcpClient.callMethod` returns `Promise<any>`, and every tool module destructures results with optional-chaining patterns like `result?.result?.handle ?? result?.handle` — functional but invisible to the compiler. The `extractHandle()` and `extractValue()` utilities in `tools/utils.ts` centralize this extraction but return `number | undefined` and `unknown` respectively, so type narrowing is pushed to each call site. The `extractAttributeValue()` function in `attribute.ts` has a 10-branch chain checking for `bool_value`, `int_value`, `float_value`, `string_value`, `float3_value`, etc. — a proto oneof dispatch that could be typed via a discriminated union if response types existed. On the client side, `useParameterValue` casts gRPC responses to `Record<string, unknown>` and manually extracts fields — a pattern repeated across services. The `OctaneClient.callApi` escape hatch (`@internal` tagged but used from component hooks) returns an untyped `ApiCallResult`, which propagates the `any` boundary into React component logic. The project's own IMPROVEMENTS.md acknowledges this — item #6 calls for typed gRPC response interfaces.

Security is clean. No hardcoded credentials anywhere. API keys for the vision subsystem come strictly from environment variables. The default file root (`C:\otoyla`) is overridable via `OCTANE_FILE_ROOTS`. The Vite dev server binds to `0.0.0.0` by default (for Docker compatibility) but CORS is restricted to localhost origins via regex, and `OCTANE_BIND_HOST` can override the bind address to `127.0.0.1` for open networks.

---

## Testing

There are 133 tests across 6 Vitest files in `mcp/src/__tests__/`, covering the MCP server's stateful subsystems, utilities, and tool logic:

- **SceneCache.test.ts** (276 lines, 32 tests): covers handle validation (including the unpopulated-cache bypass), node CRUD, staleness tracking, connection management, children operations, the `clear()` lifecycle, and the `snapshot()` serialization. Tests the critical `gateHandle` interaction — verifying that unknown handles are rejected after tracking begins but allowed through an empty cache.
- **tools.test.ts** (45 tests): covers the critical tool logic paths without a live Octane instance. Tests `create_node` crash type blocking (CRASH_TYPE_IDS rejection of known-bad IDs, allowance of safe IDs) and cache tracking (addNode + trackHandle, auto-created pin children). Tests `connect_nodes` handle gating (reject unknown handles in strict mode, allow in bypass mode), type mismatch detection (mismatched pin types rejected, PT_UNKNOWN skipped, matching types allowed), and connection tracking round-trips. Tests `delete_node` cache cleanup (handle removal from known set, connection cleanup for deleted handles). Tests `set_camera` up vector guard (zero-length detection, valid vectors). Tests `parseCritiqueResponse` — all four parsing strategies (direct JSON, markdown code block, bare JSON in prose, missing fields) plus edge cases (empty corrections, objectId preservation, pretty-printed JSON). Tests `gateHandle` comprehensively (bypass mode, strict mode, handle 0 rejection, tool name in error). Tests `extractHandle`/`extractValue` edge cases and result helper formatting.
- **ArtDirectionState.test.ts** (168 lines, 14 tests): covers spec storage/retrieval, critique history accumulation, score tracking, stagnation detection (two consecutive iterations improving <0.3), exhaustion detection (5 iterations without passing), handle mapping, and the `clear()` lifecycle.
- **artdirection-validation.test.ts** (168 lines, 15 tests): exercises the geometric validator — frustum containment, behind-camera detection, depth layer separation warnings, object proximity warnings, composition grid alignment, and the `projectToScreen()` pinhole math.
- **utils.test.ts** (131 lines, 20 tests): covers `jsonResult`/`errorResult` MCP response formatting, `gateHandle` integration with SceneCache, `extractHandle`/`extractValue` response parsing (including edge cases like `0`, `"0"`, null, nested structures), and `validateFilePath` against `OCTANE_FILE_ROOTS`.
- **OctaneConstants.test.ts** (77 lines, 7 tests): sanity-checks that shared constants (`AttrType`, `AttributeId`, `CRASH_TYPE_IDS`, `PIN_TYPE_NAMES`, object type constants) have expected values and are not accidentally mutated.

The tests are well-written — thorough edge case coverage, proper assertion patterns, good BDD-style structure with descriptive nesting. The SceneCache and ArtDirectionState tests validate the full state machine lifecycle, and the tools.test.ts file covers the critical decision points in the most important tools (crash blocking, type validation, handle gating, vision response parsing).

What remains untested: the full tool handler functions (which require mocking `callMethod` to test the gRPC interaction flow end-to-end), the vision API clients (anthropic.ts, gemini.ts — network-dependent), the creative subsystem's trigonometric lighting placement math, and the `enumeratePins` utility in `pin-utils.ts`. There are no UI component tests (React Testing Library is not in `devDependencies`), no end-to-end tests (no Cypress or Playwright), and no visual regression tests. The 27,400 lines of client code are validated entirely by manual inspection. The most recent full MCP validation was a manual test sweep on March 21 — 75 tools exercised, 303 gRPC calls, results documented in `docs/temp/TEST_REPORT_2026-03-21.md`.

---

## Documentation

Documentation is a genuine strength. There are 24 markdown files totaling over 3,400 lines, all living in the repo under `docs/`.

CLAUDE.md serves as the session briefing and task-oriented index — it points you to the right doc for each activity (scene building, debugging, UI work, planning). The MCP docs are particularly deep: BUILD.md covers the DRESS and SPEED build protocols, camera math, and the full art direction loop. REFERENCE.md is a lookup table for pin layouts, node types, primitives, and attribute IDs. TROUBLESHOOTING.md catalogs 16 known crashes, 12 silent failures, 8 render issues, and 8 MCP-specific problems, each with symptoms, causes, and workarounds.

Four creative recipes (hardwood, glass-metal, space cat, mycelium court) provide mood descriptions and ingredient tables without prescribing build steps — a deliberate choice to prevent staleness.

The changelog runs back to v0.1.0 (January 2025) with granular entries. Recent versions include specific gRPC test results (e.g., v2.3.1 documents 303 calls across 75 tools).

---

## Project Health

The project is actively maintained by a single developer. Nine commits landed in the past 48 hours, covering doc cleanup, tool pruning, test sweeps, and bug fixes. The version history shows a pattern of feature bursts followed by polishing passes — healthy cadence for a solo project.

Dependencies are modern and current: React 18.2, TypeScript 5.3, Vite 5, Vitest 4, gRPC-js 1.14, React Query 5.90, ReactFlow 12.10. No known security vulnerabilities in the dependency tree. The MCP SDK is at 1.11.0, which is recent. The production dependency footprint is lean — only 6 runtime packages (react, react-dom, react-error-boundary, react-window, @xyflow/react, @tanstack/react-query).

There is no CI/CD pipeline — no GitHub Actions, no automated test runs on push. A `docker-compose.yml` exists (481 bytes) for local orchestration but it's minimal. Testing relies on manual runs (`npm test` for unit tests, manual MCP sweeps for integration).

---

## What Works Well

The **architecture is clean**. One shared gRPC client, one compatibility layer, two consumers (web UI and MCP) that don't duplicate logic. The Vite plugin approach eliminates the need for a separate server process during development.

The **MCP tool surface is comprehensive and well-layered**. 67 tools cover the full Octane workflow — scene setup, materials, lighting, camera, rendering, animation, art direction — but the design goes beyond "one tool per gRPC call." Composite tools like `create_and_connect` reduce round-trips for common patterns. The `connect_nodes` tool auto-materializes dynamic pins on geo groups (reads current pin count, sets `A_PIN_COUNT`, polls for confirmation) and auto-verifies connections after writing. Resources and prompts encode domain knowledge so that any MCP client benefits, not just Claude Code sessions with CLAUDE.md loaded. The three-tier metadata cache (static ApiCache, dynamic ApiInfo queries, SceneCache) means the server can resolve pin layouts and type compatibility without blocking on Octane in the common case.

The **state management design is sound**. SceneCache and ArtDirectionState are pure state containers with no gRPC dependencies, making them independently testable (and they are — 64 test blocks between them). The SceneCache tracks handles at multiple granularities (node metadata, connections, children, known-handles set) and provides a serializable `snapshot()` for the `octane://scene` resource. The ArtDirectionState cleanly separates composition planning (pure math) from critique execution (gRPC + vision), with stagnation and exhaustion detection that prevents infinite loops.

The **documentation is unusually good** for a project this size. It is task-oriented, specific about gotchas, and actively curated (13 legacy files were just deleted in the latest cleanup pass).

The **error prevention layer** is multi-layered and reflects hard-won experience with Octane's gRPC quirks. Handle gating (`gateHandle` + SceneCache's known-handles set) rejects fabricated handles before they reach Octane. Crash type ID blocking (`CRASH_TYPE_IDS` set of 10 known-bad IDs) prevents `create_node` from sending types that crash Octane. File path validation prevents blocking dialogs. Attribute existence pre-checks (`hasAttr`) prevent silent writes to wrong handles. Connection auto-verification catches Octane's silent-failure pattern. The crash detector (`enhanceCrashError`) transforms opaque `ECONNRESET` errors into structured recovery instructions. The health-check ping detects dead connections without clearing valid cache state. Together, these layers mean the AI agent almost never causes an unrecoverable Octane crash.

The **React patterns** are solid. The `StatusMessageContext` is split into a value context and an actions context so that the 11+ components that only write status messages never re-render when the message changes — a textbook application of context splitting. `React.memo` with custom comparators is used where it matters most (ParameterControl, VirtualTreeRow, NodeGraphEditor). Lazy loading, virtualization for large trees, error boundaries around every panel, progressive scene loading, and a request queue that caps concurrent gRPC fetches at 4 all demonstrate attention to real-world performance. The `OctaneProvider` carefully handles React Strict Mode's double-mount by tracking listeners in a ref and cleaning up stale ones before attaching new ones — a detail that prevents a class of subtle event-duplication bugs.

---

## Issues

Each issue below is described with its location, impact, and severity.

---

### 1. Untyped gRPC Responses

**Severity: Medium** | **Location:** `OctaneMcpClient.callMethod()` returns `Promise<any>`; every tool in `mcp/src/tools/` destructures responses with optional-chaining guesses

Proto-loader returns plain JavaScript objects with no TypeScript types. The entire MCP response chain passes through `Promise<any>` from `callMethod`, through `extractHandle()` / `extractValue()` (which return `number | undefined` and `unknown`), into tool-specific destructuring. Each tool re-invents its own extraction pattern: `node.ts` uses `result?.result?.handle ?? result?.list?.handle ?? result?.handle`, `camera.ts` returns the raw result untouched, `attribute.ts` has a 10-branch `extractAttributeValue()` chain, and `scene.ts` manually walks `listHandle → size → get(i)` arrays. A property name typo in any of these chains — say `result.results` instead of `result.result` — compiles without error and silently returns `undefined` at runtime.

The highest-value fix would be typed interfaces for the 5-6 response shapes that cover 80% of calls: handle-returning responses (`{result: {handle: string}}`), value-returning responses (`{result: number|string|boolean}`), array-returning responses (`{list: {handle: string}} + size/get`), attribute value responses (the proto oneof), and render statistics. Assert these at the `callMethod` boundary in `OctaneMcpClient` using a generic like `callMethod<T>(...): Promise<T>`, and the 4,600 lines of tool code get compile-time checking for free. The IMPROVEMENTS.md backlog (item #6) already identifies this.

---

### 2. Oversized Components

**Severity: Medium** | **Location:** `client/src/components/NodeInspector/ParameterControl.tsx` (1,042 lines), `client/src/components/CallbackRenderViewport/hooks/useMouseInteraction.ts` (649 lines), `client/src/components/NodeInspector/index.tsx` (1,001 lines), `client/src/components/NodeGraph/index.tsx` (920 lines), `client/src/components/MenuBar/index.tsx` (777 lines)

The size issue extends beyond the two files originally noted. Five components exceed 600 lines, and three exceed 900.

`ParameterControl.tsx` has a ~600-line switch statement that handles every Octane attribute type (AT_BOOL through AT_STRING, plus AT_FLOAT2/3/4 with per-dimension-count sub-cases). The AT_FLOAT3 and AT_FLOAT4 branches are structurally identical — each produces the same `NumberInput` or `DeferredInput` pattern with minor variation in which components (`x`, `y`, `z`, `w`) are included. Extracting a `VectorInput` component that takes a dimension count and renders the appropriate number of fields would eliminate roughly 200 lines of near-duplicate JSX.

`useMouseInteraction.ts` (649 lines, not 500+) packs orbit, pan, zoom, 2D canvas transform, five picker modes, render region selection, and context menu logic into a single hook. Each interaction mode has its own mousedown/mousemove/mouseup chain, but they share mutable refs for drag state. Splitting into per-mode hooks would make each independently testable, though the shared drag-state refs would need to be lifted into a common container.

`NodeInspector/index.tsx` (1,001 lines) does double duty: it defines the parameter grouping/rendering logic (ParameterGroup, AddInputButton, NodeParameter) and the top-level inspector layout. The inline `NodeParameter` component — already wrapped in `React.memo` — could be extracted to its own file.

`MenuBar/index.tsx` (777 lines) defines the full menu structure as deeply nested data and includes all menu action handlers inline. Separating the menu data (structure, labels, shortcuts) from the action handlers would make both easier to maintain.

---

### 3. No End-to-End MCP Tool Tests

**Severity: Medium** | **Location:** `mcp/src/tools/` (17 files, ~4,600 lines), `mcp/src/vision/` (5 files, 732 lines), `mcp/src/creative/` (3 files, 714 lines)

The critical decision logic in tool handlers is now covered (crash type blocking, handle gating, type mismatch detection, cache tracking, vision response parsing — 45 tests in `tools.test.ts`). What remains untested is the full handler flow end-to-end: pin discovery, auto-materialization of dynamic pins, connection auto-verification, and SceneCache mutation side effects during `create_node` / `connect_nodes` / `set_attribute`. These require mocking `callMethod` to simulate gRPC responses. The vision API clients (anthropic.ts, gemini.ts) are network-dependent and untested. The creative subsystem's trigonometric lighting placement math is untested. The `enumeratePins` utility is untested. The mocking boundary is clean (`OctaneMcpClient.callMethod`) — a mock returning canned responses would unlock full handler-level tests without a live Octane instance.

---

### 4. No UI or Integration Tests

**Severity: Medium** | **Location:** `client/src/components/` (19 directories, untested), `client/src/hooks/` (16 hooks, untested)

There are no component tests (React Testing Library is not installed), no end-to-end tests (Cypress, Playwright), and no visual regression tests. The UI is validated entirely by manual inspection. For a project with 27,400 lines of client code, 19 component directories, 16 custom hooks, a virtualized tree with custom memo comparators, and a real-time render viewport, this means regressions in layout, interaction, or data flow go undetected until a human notices.

The highest-value targets for first tests would be: `ParameterControl` (the type-dispatch switch can be tested with mock ParameterValue objects and no gRPC), `DeferredInput`/`NumberInput` (pure UI behavior — blur-to-commit, scrub-drag, arrow-key stepping), `RequestQueue` (already a plain class, easy to unit test with async mocks), and `CommandHistory` (pure logic, no DOM). These are all testable without mocking the Octane connection.

---

### 5. Disabled LiveDB Tools

**Severity: Low (external)** | **Location:** `mcp/src/tools/materials-db.ts` (200 lines, 4 tools), disabled via commented import in `mcp/src/index.ts` line 27

All four material database tools (get_material_libraries, search_materials, get_material_attributes, apply_material) are disabled because they trigger an "invalid pointer type" error in Octane's gRPC API. The code is preserved and the disable is clearly documented. This is an upstream bug — nothing to fix in this repo — but it removes a significant workflow (browsing and applying materials from OTOY's library) from the MCP surface. The `suggest_material` creative tool partially compensates by providing hand-authored PBR attribute values for 30+ surface types, but it cannot match the breadth of OTOY's material library.

---

### 6. No LICENSE File

**Severity: Low (legal)** | **Location:** Repository root

The README footer contains an OTOY copyright notice, but there is no LICENSE file. For an internal/personal project this is fine, but if the code is ever shared, forked, or open-sourced, the absence of explicit license terms creates legal ambiguity about usage rights.

---

### 7. Unimplemented Dialog Features

**Severity: Medium** | **Location:** `client/src/components/dialogs/` — BatchRenderingDialog (373 lines), TurntableAnimationDialog (257 lines), DaylightAnimationDialog

Eight TODO comments mark features that are stubbed but not implemented: batch rendering, turntable animation, daylight animation, folder selection, and file path selection. These dialogs render complete, polished UI — BatchRenderingDialog has 16 controlled form fields including frame range, format selection, filename templates, and multi-select render targets — but the submit handlers only call `Logger.debug()`. The "Start Batch Render" and "Start Animation" buttons do nothing and show no feedback. A user can fill out every field and click the primary action button with zero visible result.

The fix should either disable the submit button with a "Not yet implemented" tooltip, or — since the gRPC proxy already supports arbitrary method calls — wire the handlers to the Octane render API. The BatchRenderingDialog in particular is close to functional: it already captures all the parameters that `RenderExportService` would need.

---

### 8. No CI/CD Pipeline

**Severity: Medium** | **Location:** Repository root (no `.github/workflows/`)

There are no GitHub Actions, no automated test runs on push, and no build verification on pull requests. The 133 unit tests and the linter only run when someone remembers to invoke `npm test` or `npm run lint` locally. For a solo project this is manageable, but it means regressions can merge silently.

---

### 9. Cache Coherence Risk

**Severity: Low-Medium** | **Location:** `mcp/src/SceneCache.ts`, `mcp/src/OctaneMcpClient.ts`

SceneCache entries have a 5-minute staleness threshold, but staleness is currently advisory only — `isNodeStale()` and `staleNodeCount` are exposed via the `octane://scene` resource and the `snapshot()` method, but no tool actually refuses to use a stale handle or triggers a refresh. The `gateHandle()` check validates against the known-handles set (has-this-handle-ever-been-seen), not against age. In long MCP sessions — especially ones that create, delete, and reconnect nodes — the cache can accumulate stale entries. If Octane reassigns a handle number after a delete/recreate cycle, the cached type name for that handle is wrong, and `connect_nodes` type validation may incorrectly reject a valid connection or permit an invalid one.

There are also two caches that do not participate in the staleness lifecycle: `OctaneMcpClient.sessionInfo` (version, name, device names) never expires, and the four dynamic metadata caches (`dynamicNodeInfo`, `dynamicPinInfo`, `dynamicAttrInfo`, `dynamicCompatTypes`) are cleared only on crash/reset/load via `clearDynamicCache()`. These are low-risk since metadata is immutable per Octane session, but they would go stale if Octane is updated mid-session without a load/reset.

The IMPROVEMENTS.md backlog (item #40) proposes auto-refreshing the cache on a miss (call `get_scene_tree` automatically when a handle lookup fails). A lighter fix would be to add an `isStale` check to `gateHandle` that emits a warning (not a rejection) when a handle's cached metadata is older than the TTL, prompting the AI agent to refresh voluntarily.

---

### 10. Global Context Menu Suppression

**Severity: Low** | **Location:** `client/src/App.tsx` (lines 217-227)

A `useEffect` in `AppContent` attaches a document-level `contextmenu` listener that calls `preventDefault()` and `stopPropagation()` on every right-click. This is intended as a "safety net" to prevent the browser's default context menu from appearing, but it is unconditional — it fires everywhere, including on text inputs, the status bar, and any panel that does not provide a custom right-click menu. Users cannot use the browser's native "Inspect Element", "Copy", or spell-check context menus anywhere in the app. A more targeted approach would be to attach `onContextMenu` handlers only to the specific panels that have custom menus (viewport, node graph, outliner, inspector) rather than blanket-suppressing at the document level.

---

### 11. gRPC Call Serialization Limits Throughput

**Severity: Low** | **Location:** `mcp/src/OctaneMcpClient.ts` lines 284-331 (the `callMethod` mutex)

All gRPC calls are serialized through a promise-based mutex — each `callMethod` awaits the previous call's completion before starting. This is correct for Octane's single-threaded message processing, but it also serializes read-only calls that could safely run concurrently (e.g., `get_camera` while `get_render_status` is in-flight). During `create_node`, the serialized pin enumeration loop makes N+2 sequential gRPC calls (pin count + N pin queries + name query) that could theoretically be batched. For a node type with 49 pins (e.g., a path tracing kernel), this means 51 sequential round-trips at ~5ms each, adding 250ms+ of latency. The `ApiCache` fast path avoids most of this for known types, but the gRPC fallback path is noticeably slow. Relaxing the mutex to allow concurrent reads while still serializing writes would improve throughput, though it requires confidence that Octane handles concurrent read RPCs safely.

---

### 12. MCP Server Not Linted

**Severity: Low** | **Location:** ESLint config (`eslint.config.mjs`), which explicitly ignores `server/`, `mcp/`, and the Vite plugin

The ESLint configuration only covers `client/src/`. The entire MCP codebase (~7,900 lines), the shared gRPC base, and the Vite plugin are excluded from linting. This means the MCP code does not benefit from `@typescript-eslint` rules, unused variable detection, or consistent style enforcement. The four `eslint-disable` comments in `OctaneMcpClient.ts` (for `require()` usage) suggest linting was attempted at some point but disabled rather than configured. Since the MCP code is pure Node.js (no React, no JSX), a minimal ESLint config with just `@typescript-eslint/recommended` would catch real issues without fighting framework-specific rules.

---

### 13. Vision API Key Typo

**Severity: Low** | **Location:** `mcp/src/vision/anthropic.ts` line 103

The primary environment variable for the Anthropic vision API key is `ANTHOPIC_CLAUDE_KEY` (missing the 'R' in ANTHROPIC). A fallback to the correctly-spelled `ANTHROPIC_API_KEY` exists, so the functionality is not broken. But the typo is in the documented primary key name, which means users who set `ANTHROPIC_API_KEY` may not realize the code checks the misspelled version first. This should be inverted — check the correct spelling first, fall back to the typo for backwards compatibility, and add a deprecation log when the typo is used.

---

### 14. ArtDirectionState Not Cleared on Project Load/Reset

**Severity: Low** | **Location:** `mcp/src/index.ts` — `artState` is created once at line 132 and never cleared

SceneCache is cleared on crash/load/reset via `client.clearRootGraphCache()`, which calls `sceneCache.clear()`. But `ArtDirectionState` is a separate object created in `index.ts` and passed to `registerArtDirectionTools`. No tool or lifecycle hook calls `artState.clear()` when a project is loaded or Octane crashes. This means composition specs and critique history from a previous scene persist into a new scene, with stale object-to-handle mappings that reference handles that no longer exist. The `project.ts` tools (`load_project`, `reset_project`, `save_project`) clear the SceneCache via `client.clearRootGraphCache()` but have no reference to `artState`. The fix is to either pass `artState` to `registerProjectTools` and clear it alongside the cache, or to register a lifecycle callback in `OctaneMcpClient` that clears both.
