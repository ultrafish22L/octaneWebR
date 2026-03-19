# OctaneWebR Code Review

**Date:** 2026-03-18 | **Version:** 1.5.8 | **Reviewer:** Claude Opus 4.6

A strict review of the full OctaneWebR codebase: Vite plugin, MCP server, React client, and project configuration.

---

## Architecture

OctaneWebR is a browser-based UI for Octane Render Studio, communicating with Octane via its gRPC LiveLink API. The architecture has three tiers: a Vite dev server with an embedded gRPC plugin that proxies API calls and manages WebSocket callbacks; an MCP server (27 tools) that exposes the same gRPC API to AI agents via stdio; and a React/TypeScript client that renders the scene tree, node graph, parameter inspector, and live viewport.

The Vite plugin and MCP server share a single gRPC client implementation (`server/src/grpc/OctaneGrpcClientBase.ts`) but are otherwise independent processes. The client communicates with the Vite plugin over HTTP and WebSocket — there is no direct gRPC from the browser.

This is a clean separation for a dev tool. The main architectural tension is that `OctaneGrpcClientBase.ts` lives under `server/src/` despite being shared infrastructure, and the MCP server imports client-side constants via fragile relative paths (`../../../client/src/constants/OctaneTypes`). Both work but would break silently if either directory is reorganized.

---

## Security

The file browser endpoint restricts access to directories under `OCTANE_FILE_ROOTS` (defaulting to `C:\otoyla`), with `path.resolve()` normalization and 403 responses for disallowed paths. The server bind address is configurable via `OCTANE_BIND_HOST`. CORS is restricted to localhost origins.

Five items would need attention before any public deployment. The generic gRPC proxy (`POST /api/grpc/:service/:method`) forwards any service and method name with no allowlist — this is by design for a dev tool but would be dangerous on an open network. There are no security response headers (CSP, X-Frame-Options, nosniff), no rate limiting, no WebSocket message size limits, and internal error messages (including gRPC error details and filesystem paths) are returned verbatim to HTTP clients. These are all acceptable tradeoffs for a localhost-only tool behind CORS, but they are documented in `CLAUDE.md` under "Production Hardening" as a checklist for future hardening.

The MCP server accepts file paths for `load_project`, `save_project`, and `save_render` with no validation. This is a non-issue in practice because the MCP client (Claude) already has full filesystem access through other tools.

---

## TypeScript Quality

The client code is compiled under `strict: true` with `noUnusedLocals` and `noUnusedParameters` enabled — this is good. The React components and hooks are generally well-typed with proper use of generics, discriminated unions, and explicit return types where they matter.

The weak spot is the gRPC boundary. `OctaneGrpcClientBase` returns `any` from every method, and this propagates through the entire call chain: the Vite plugin's API proxy, the MCP server's tool handlers, and the client's service layer all work with untyped gRPC responses. The `DeviceService` uses typed helper functions (`asNumber`, `asString`, `asBool`) to safely extract values from responses, which is the right pattern — but most other services cast directly with `as`. Defining interfaces for even the ten most common response shapes (render status, camera state, node info, scene tree) would catch a class of bugs that currently only surface at runtime.

The MCP server loads `OctaneGrpcClientBase` via `require()` to avoid pulling the full server type graph into TypeScript compilation (which caused OOM). The loaded module is typed as `any`. A minimal interface covering the four methods actually called (`initialize`, `callMethod`, `checkHealth`, `close`) would preserve the OOM workaround while adding compile-time safety.

---

## React Patterns

The component architecture follows standard React patterns: context providers for global state, custom hooks for API integration, `React.memo` for expensive components, and `react-window` for virtualized lists.

The `StatusMessageContext` is well-structured as a split context — setter-only consumers use `useStatusActions()` and don't re-render when the message changes, while only the status bar reads the value. This is a good pattern that other contexts in the codebase could adopt.

Two components stand out for their size. `ParameterControl.tsx` is 1028 lines, dominated by a switch statement where each numeric vector type (int2 through float4) repeats nearly identical JSX with minor variations. A generic `VectorInput` component parameterized by dimension count would eliminate hundreds of lines of duplication. `useMouseInteraction.ts` contains a single `useEffect` spanning 500+ lines that registers six event listeners for orbit, pan, zoom, and picking — splitting this into focused hooks would improve readability and make the dependency arrays more precise.

The `useParameterValue` hook delegates to `ItemService.setParameterValue()` for writes, which handles the AttrType-to-protobuf mapping, cache invalidation, and scene update in one place. The hook adds optimistic local state and error toasts on top. This is a clean separation of concerns.

One subtle pattern worth noting: the `useFileBrowser` hook uses a `useEffect` with no dependency array to keep a ref in sync with the latest callback. This is intentional (the ref must update every render to avoid stale closures) and is annotated with an eslint-disable comment. The alternative — assigning the ref during render — would change the hook count and break HMR hot-swapping.

---

## MCP Server

The MCP server is well-organized with tool definitions split by domain (project, camera, render, scene, node, attribute, webapp). Input validation uses Zod schemas with handle parameters constrained to non-negative integers. The gRPC mutex prevents concurrent calls, and crash detection flags ECONNRESET errors clearly.

The `restart_render` tool has been removed (it crashed Octane). The remaining 27 tools cover the full Octane API surface needed for scene building.

Areas for improvement: the `connect_nodes` tool accepts three mutually exclusive pin specifier parameters (`pin_index`, `pin_name`, `pin_id`) but doesn't validate that exactly one is provided — it silently uses whichever has highest precedence. Better tool descriptions would help the LLM pick the right parameter on the first try. The scene tree traversal function has no cap on total nodes visited (only depth is limited), which could result in thousands of sequential gRPC calls on very wide scenes — though in practice Octane scenes rarely have more than a few hundred top-level nodes.

The `notifyWebapp` fetch has a 2-second timeout, and the debug logger is async — both important for preventing the gRPC mutex from being held by slow I/O.

---

## Performance

The client handles large parameter trees (100+ parameters on a Render Target) by queuing API calls through a `RequestQueue` with a concurrency limit of 4. The `SceneOutliner` uses `react-window` for virtualized rendering. The `NodeInspector` does not — all parameter components mount simultaneously, each firing a `useParameterValue` hook. For scenes with very large parameter counts, lazy-loading values only for expanded/visible groups would reduce initial API traffic.

The logging system has 463 `Logger.debug`/`debugV` calls across 52 files. While gated by a level check inside the Logger, the string interpolation and `JSON.stringify` at each call site are evaluated before the check. This is the highest-priority performance improvement remaining — a lazy evaluation pattern (passing a callback instead of a pre-built string) would eliminate the overhead when debug logging is disabled, which is the common case.

The `SceneService` mutates the scene tree in place with `splice` and `filter`, then re-emits the modified object. This is intentional for performance (avoiding deep-clone on every structural change) but fragile — any React component that captures a reference to a subtree could see it mutated under its feet. The current code works because mutations are always followed by an event emission that triggers a re-render, but it's a pattern that requires careful attention when adding new consumers.

---

## Configuration and Dependencies

The project uses Vite 5, React 18, TypeScript in strict mode, ESLint with flat config, Prettier, and Husky pre-commit hooks running lint-staged. The toolchain is modern and well-configured.

The dependency list is clean. All production dependencies are actively used by the client (`react`, `react-dom`, `@tanstack/react-query`, `@xyflow/react`, `react-error-boundary`, `react-window`). gRPC packages live in devDependencies (correct, since they're used by the Vite plugin at dev time, not shipped to the browser). The `google-protobuf` package is in devDependencies for proto codegen tools.

The ESLint config covers the client but ignores `server/` and `mcp/`. Since the server directory now contains only one shared file, this is acceptable. The MCP server has its own build pipeline via esbuild.

One configuration oddity: `tsconfig.json` sets `sourceMap: true` and `inlineSources: true`, but also `noEmit: true` — the source map options have no effect since TypeScript never produces output files (Vite's esbuild handles compilation). These are harmless but misleading.

---

## What's Good

The codebase demonstrates several strong patterns worth preserving:

- **Split context for StatusMessage** — setters and readers use separate contexts, preventing unnecessary re-renders across 11 consumer components
- **Request queue with concurrency limit** — prevents browser connection pool exhaustion when hundreds of parameter hooks fire simultaneously
- **Single source of truth for API version** — `api-version.config.js` controls Alpha5/Beta2 switching across client, server, and MCP
- **Crash detection and recovery** — the gRPC client detects ECONNRESET, reports it clearly, and implements exponential backoff reconnection with a configurable attempt limit
- **File browser path restriction** — configurable roots with `path.resolve()` normalization, 403 on violation, parent navigation stops at boundary
- **Graceful shutdown** — both the Vite plugin and MCP server clean up gRPC channels on SIGINT/SIGTERM
- **Virtualized scene outliner** — `react-window` with proper tree flattening for indent line rendering

---

## Priority Improvements

If I were to spend a day improving this codebase, in order:

1. **Lazy logging** — Change Logger to accept `() => string` callbacks. Eliminates `JSON.stringify` and template literal evaluation on 463 call sites when debug logging is off. Biggest perf win for the least risk.

2. **Extract `VectorInput` component** — Replace the 600-line switch in `ParameterControl.tsx` with a generic component parameterized by dimension. Cuts the file in half and makes adding new numeric types trivial.

3. **Split `useMouseInteraction`** — Break the 500-line useEffect into `useOrbitControls`, `usePanControls`, `useZoomControls`, and `usePickerMode`. Each gets a focused dependency array and can be tested independently.

4. **Extract shared constants** — Move `OctaneTypes.ts` (or the subset the MCP server needs) to a shared location, eliminating the `../../../client/src/` cross-boundary imports.

5. **Add gRPC response interfaces** — Define TypeScript interfaces for the ten most common response shapes. Apply them at the service layer boundaries. Doesn't require changing the `any`-returning base client — just type the consumers.
