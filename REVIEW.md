# OctaneWebR — Code Review

**Date**: 2026-03-04

OctaneWebR is a React/TypeScript web frontend for OTOY's Octane Render engine. It communicates with a running Octane instance over gRPC, proxied through either a Vite dev plugin or a Node.js Express server. The codebase spans roughly 26,000 lines of TypeScript across 100 source files, 5,500 lines of CSS across 10 stylesheets, and 1,300 lines of server-side TypeScript — plus a 600-line Vite plugin that doubles as the dev-mode gRPC bridge.

---

## Architecture

The project is cleanly layered. The client separates transport (`ApiService`), domain logic (11 specialized services like `SceneService`, `NodeService`, `CameraService`), React state management (hooks and contexts), and presentation (components organized by feature). An `OctaneClient` facade composes the services and exposes a typed public API, keeping components from reaching directly into transport details. A developer familiar with either React or Octane's API can navigate this code quickly — each file has an obvious role, and the service architecture maps directly to Octane's API surface.

The server side mirrors this separation. The Express server handles HTTP routing, CORS, and graceful shutdown. A gRPC client layer handles proto loading, service resolution, and reconnection. A callback manager wires gRPC stream events to WebSocket forwarding. The Vite plugin replicates this stack for dev mode, intercepting `/api/grpc/*` requests before they reach the network.

The dual-server design — Vite plugin for development, Express for production — is pragmatic but carries a maintenance cost. The two implementations share proto-loading logic and parameter transformation functions, but their WebSocket handling, request parsing, and callback management are written independently. When a fix is applied to one, it can easily be missed in the other. A shared library extracting the common gRPC and callback logic would reduce this drift risk, though it may not be worth the complexity for a project of this size.

The service layer's constructor pattern is worth noting. `OctaneClient` instantiates 11 services, passing `this` (as an EventEmitter), the server URL, and the `ApiService` to each. Some services take additional dependencies — `NodeService` depends on `SceneService`, `MaterialDatabaseService` depends on both `ApiService` and `SceneService`. The manual wiring works but is fragile; adding a twelfth service means editing the constructor. A factory or registry pattern would scale better, though the current size doesn't demand it.

---

## React Patterns

The React code is well-structured and follows modern conventions. Hooks are the primary abstraction for stateful logic: `useParameterValue` handles the async fetch-and-cache cycle for node parameters, `useResizablePanels` encapsulates the drag-to-resize math, `useSceneTree` manages the event-driven scene hierarchy. Components are organized by feature — `CallbackRenderViewport`, `NodeGraph`, `NodeInspector`, `SceneOutliner` — each with their own hooks subdirectory.

`App.tsx` is the main orchestrator and the largest component at ~670 lines. It manages 15+ pieces of state (selected node, scene tree, sync status, panel visibility, picking mode, dialog visibility, grid/snap settings, viewport lock) and passes them down as props through the component tree. Several child components receive 7–10 callback props each. This is functional but makes the component hard to read. Extracting a `useAppState` hook or splitting some state into dedicated contexts would improve readability without changing behavior.

Memoization is applied thoughtfully where it matters. `NodeParameter` (the component rendered hundreds of times in the inspector) uses `React.memo`. Scene tree rows use `react-window` for virtual scrolling. Lazy loading with `Suspense` defers the heavy `NodeGraphEditor` and `MaterialDatabase` components. Dependency arrays on `useCallback` and `useEffect` are generally correct — the codebase avoids the common mistake of omitting dependencies, and uses functional state updaters where needed to avoid capturing stale closures.

Event listener management follows two patterns. The `useEmitterEvent` hook provides automatic subscription and cleanup with a stable ref-based handler, eliminating a class of potential leaks. Some components have adopted this pattern (e.g., `useGPUData`), while others still use manual `on()`/`off()` pairs in `useEffect` blocks. Migrating the remaining manual listeners to the hook would reduce boilerplate and improve consistency.

---

## TypeScript

TypeScript is used competently throughout. Service method signatures are fully typed. Domain types (`SceneNode`, `RenderState`, `CameraState`, `Material`) are well-defined. The `ApiService` defines `GrpcValue`, `GrpcObject`, and `GrpcArray` as recursive union types, providing a typed alternative to `any` for dynamic gRPC responses. Helper functions like `asObject`, `asNumber`, `asBool`, and `getHandle` provide safe runtime access into these untyped response shapes.

gRPC responses arrive as untyped objects and are accessed via these helper functions rather than validated against interfaces. This is a reasonable trade-off given the responses come from a local Octane instance with a known API, but it does mean that API version changes surface as silent fallbacks rather than explicit errors.

---

## Error Handling

Error handling follows a two-tier pattern. At the service layer, operations catch exceptions, log them via `Logger.error`, and emit a `status:error` event through the shared `EventEmitter` so the UI can display a brief status bar message. This covers the core user-facing operations: node creation, deletion, copying, grouping, ungrouping, replacement, render saving, clipboard export, and render pass export. Scene tree build failures and render failures are also surfaced. At the component level, viewport interactions (picking, render region) call `setTemporaryStatus` directly in their catch blocks.

The status bar approach works well for transient errors but has limits. There is no persistent error state — if the user isn't watching the status bar when an error flashes for 3–5 seconds, they miss it. A more robust approach would be to combine the status bar with visual indicators on the affected UI element (e.g., a red outline on a parameter that failed to load, or a retry button on a failed scene tree load). Parameter fetch failures in `useParameterValue` still leave the value as null without any visual cue.

The gRPC reconnection logic is well-engineered: exponential backoff with a cap, a cooldown mechanism that resets the counter after 60 seconds of quiet, and proper state tracking to prevent concurrent reconnect attempts. This handles the unpredictable lifecycle of a local Octane instance that may be started, stopped, and restarted during a session.

---

## CSS and Theming

The styling system is built on a comprehensive set of CSS custom properties — over 100 variables covering colors, spacing, typography, borders, shadows, z-index, and opacity. The dark theme matching Octane Render Studio's appearance is defined in one place (`theme-octane.css`), and components reference variables consistently. A debug theme variant exists for development. The variable discipline is strong — spacing, font sizes, and colors are defined as variables and used throughout.

Accessibility is solid for a professional desktop tool. `prefers-reduced-motion` and `prefers-contrast: high` media queries are present. Focus-visible states cover interactive controls across all panels — buttons, tabs, checkboxes, tree nodes, toolbar icons, and context menu items all show visible outlines for keyboard navigation. Disabled text meets WCAG AA contrast requirements. The main gap is that status indicators rely on color alone without shape or icon differentiation for colorblind users.

The main stylesheet (`app.css`, ~840 lines) has grown to contain layout, shared components, ReactFlow overrides, scrollbar customization, and media queries. It would benefit from splitting along the boundaries its own comments already suggest.

Responsiveness is minimal, which is appropriate for a professional desktop tool. Breakpoints exist for narrower windows, but the application is fundamentally designed for wide monitors with three-panel layouts.

---

## Server and WebSocket Layer

The Express server is compact (~220 lines) and does its job. Routing is clear: health check, device info, generic gRPC proxy. CORS is restricted to localhost via regex. Graceful shutdown closes WebSocket clients before the server, with a timeout fallback. The gRPC client handles proto loading with fallback strategies and caches service stubs.

The WebSocket layer forwards gRPC callback events (new image, statistics, render failure, project changes) to connected browser clients. Both the Express server and the Vite plugin validate WebSocket origins against localhost, preventing cross-origin connections. Both implementations enforce backpressure — checking `bufferedAmount` before sending and dropping frames when the 10 MB buffer limit is reached, preventing memory exhaustion in long-running sessions with backgrounded tabs.

The Vite plugin throttles statistics polling to a 250 ms interval, avoiding a gRPC round-trip on every frame at high render rates. Its request body parsing is manual (string concatenation rather than middleware), which works but is less robust than the Express middleware approach.

---

## Testing

There are no automated tests. The application is tested manually through the dev server — the standard procedure is to toggle the Orthographic checkbox on the Camera node and verify that the render updates end-to-end.

This is understandable for a tool tightly coupled to a running Octane instance, but the service layer, utility functions, and state management hooks are all testable in isolation. The `ColorUtils` module, the `EventEmitter`, the `CacheManager`, the request queue, and the parameter value parsing logic could all have unit tests without mocking Octane.

---

## Strengths

The codebase's greatest strength is its clarity of purpose. Each file has an obvious role. The React component tree mirrors the visual layout. The service layer maps cleanly to Octane's API surface.

The custom property system for theming, the virtual scrolling in the scene tree, the request queue throttling concurrent API calls, the lazy loading of heavy components, and the WebSocket backpressure handling all demonstrate practical engineering judgment — solving real problems without over-engineering.

The `EventEmitter` pattern for cross-cutting concerns (connection state changes, scene updates, render callbacks, user-facing errors) avoids the complexity of a full state management library while keeping components decoupled from transport details. The `useEmitterEvent` hook builds on this by automating subscription lifecycle.

---

## Weaknesses

The dual-server architecture (Vite plugin and Express) creates a maintenance burden where fixes must be applied in two places. This has already caused real bugs — the statistics WebSocket forwarding was commented out in the Vite plugin while working in the Express server.

`App.tsx` concentrates too much state and too many callbacks in one component, making it the hardest file in the codebase to modify confidently. Splitting its state into a dedicated hook or additional contexts would help.

There are no automated tests of any kind.

---

## Summary

OctaneWebR is a well-organized, competently written application that faithfully replicates Octane Render Studio's interface in the browser. Its architecture is clean, its React patterns are modern and appropriate, and its TypeScript usage provides meaningful safety. Error handling surfaces failures to users through the status bar for all major operations. The styling system is well-structured with comprehensive theming and keyboard accessibility. The main areas for improvement are the dual-server maintenance burden, the concentration of state in `App.tsx`, and test coverage. None of these are architectural problems — they're the kind of incremental improvements that follow naturally from a codebase that has its fundamentals right.
