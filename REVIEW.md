# OctaneWebR Code Review Report

**Date**: 2026-03-05
**Version**: 1.4.1
**Reviewer**: Claude (automated strict review)
**Scope**: Full codebase — client components, services, hooks, utilities, server, Vite plugin, CSS, configuration

---

## Executive Summary

OctaneWebR is a well-structured React/TypeScript frontend for the Octane renderer, communicating through a gRPC proxy layer. The codebase has already been through eight review passes and a weakness remediation cycle, and it shows: error handling is thorough in most paths, WebSocket connections have origin validation and backpressure guards, and the component architecture cleanly separates concerns through custom hooks and a service layer.

That said, a strict review still surfaces a number of issues. The most serious are concentrated in two areas: resource lifecycle management (event listeners, timers, and reconnection loops that can leak under certain conditions) and type safety at system boundaries (gRPC responses that pass through `toObject()` without validation, float precision loss in parameter controls, and a few `as any` casts that suppress null checks). None of these are likely to cause immediate failures in normal use, but they represent reliability risks during long sessions, disconnection/reconnection cycles, and edge-case Octane responses.

Below, findings are grouped by severity and then by subsystem. Each entry includes the file, line numbers, a description of the issue, the risk it poses, and a recommended fix.

---

## Critical Issues

### 1. Vite Plugin Callback Registration Race Condition

**File**: `vite-plugin-octane-grpc.ts`, lines 135-165

The `registerOctaneCallbacks()` method sets `this.isCallbackRegistered = true` before attempting the actual gRPC registration calls. If `setOnNewImageCallback()` or `startCallbackStreaming()` throws, the flag remains true and blocks all future retry attempts. The callback system silently dies with no path to recovery short of restarting the dev server.

The flag was originally placed early to prevent concurrent registration attempts, which is a valid concern. The fix is to use a separate `isRegistering` mutex flag for concurrency control and only set `isCallbackRegistered` after all setup calls succeed. The existing catch block already resets the flag, but a failure between the flag set and the first await creates a window where the flag is wrong.

### 2. Event Listener Accumulation in App.tsx

**File**: `client/src/App.tsx`, lines 346-391

The main useEffect registers multiple event listeners on the `client` object (`nodeDeleted`, `OnRenderFailure`, `OnProjectManagerChanged`, and others). The cleanup function removes them correctly, but `client` is in the dependency array. If the client reference changes — which happens during reconnection — the effect re-runs, adding new listeners before the old cleanup fires. In practice this creates a brief window of double-subscribed handlers, and if the cleanup races against a reconnection event, listeners can accumulate.

The recommended fix is to extract the callback handlers into stable refs (via `useRef`) so that the effect only subscribes once on mount, or migrate these subscriptions to the `useEmitterEvent` hook which already handles this lifecycle correctly.

### 3. Float Precision Loss in ParameterControl

**File**: `client/src/components/NodeInspector/ParameterControl.tsx`, line 46

The `parseFloatValue()` function applies `.toFixed(6)` then `parseFloat()`, which silently truncates values beyond six decimal places. If a user enters `0.1234567`, the UI displays `0.123457` but Octane may have received the original value on a previous edit. Over multiple edits this creates a drift where the displayed value diverges from the actual Octane parameter. For a renderer where precision in material and lighting values matters, this is a data integrity issue.

The simplest fix is to return the parsed number directly without the toFixed/parseFloat round-trip, or to use it only for display formatting while keeping the full-precision value for API calls.

### 4. Type-Unsafe gRPC Response Handling

**File**: `server/src/grpc/client.ts`, lines 184-188; `vite-plugin-octane-grpc.ts` (same pattern)

Response objects from gRPC calls are assumed to have a `toObject()` method, but this is checked only via `typeof response.toObject === 'function'` with no try/catch. If Octane returns a malformed protobuf or an unexpected response type, `toObject()` could throw, crash the request handler, and leave the client with no error feedback. Both the Express server and Vite plugin share this vulnerability.

Wrapping the `toObject()` call in a try/catch and returning a structured error response when conversion fails would make the gRPC proxy resilient to unexpected Octane behavior.

### 5. WebSocket Reconnection Timer Leak in ConnectionService

**File**: `client/src/services/octane/ConnectionService.ts`, lines 143-148

The `onclose` handler schedules a reconnection attempt via `setTimeout`, but the timer ID is not stored or tracked. If `disconnect()` is called immediately after a connection drops, the scheduled reconnect still fires because there is no mechanism to cancel it. This can produce zombie reconnection attempts that interfere with intentional disconnection, and in rapid connect/disconnect cycles, timers stack up.

Storing the timeout ID in an instance property and clearing it in `disconnect()` resolves this completely.

---

## Moderate Issues

### 6. Stale Closure in SceneOutliner Structural Change Detection

**File**: `client/src/components/SceneOutliner/index.tsx`, lines 83-99

The scene list uses `firstKey`, `lastKey`, and `len` to detect structural changes that should trigger a react-window remount. This heuristic misses reordering: if nodes are rearranged during a scene rebuild but the first and last keys remain the same, the list does not remount, and stale row rendering can appear briefly until the next full refresh. A lightweight hash of the key sequence (or comparing more than just endpoints) would catch reorders.

### 7. Unhandled Promise in NodeGraph Auto-Layout

**File**: `client/src/components/NodeGraph/index.tsx`, lines 176-178

Inside a `setTimeout` callback, `setNodePosition()` is called with `.catch()` for error logging, but if the component unmounts before the promise settles, the catch handler runs against a stale component context. More importantly, individual position-save failures are logged but don't stop the auto-layout operation, so nodes can end up partially persisted. Wrapping the layout persist in an async function with a mounted-check guard would be cleaner.

### 8. Missing Health Check Timeout in Vite Plugin

**File**: `vite-plugin-octane-grpc.ts`, lines 459-484

The `/api/health` endpoint calls `grpcClient.checkHealth()` without any timeout. If Octane is hung or the gRPC channel is stuck, this request blocks indefinitely, tying up a Vite server thread. Adding a 5-second timeout (matching the heartbeat interval) would prevent hanging health checks.

### 9. CSS Variable Typo

**File**: `client/src/styles/render-viewport.css`, line 19

References `--font-weight-bold7`, which is not defined in `variables.css`. The browser falls back to its default font weight, making the render viewport header inconsistent with the rest of the UI. Should be `--font-weight-bold`.

### 10. Silent Stats Polling Failure

**File**: `vite-plugin-octane-grpc.ts`, lines 232-250

When `pollRenderStatistics()` fails (e.g., Octane becomes unavailable), the error is logged at debug level and swallowed. The client continues displaying the last-known statistics with no indication that polling has stopped. Emitting a status event or sending a WebSocket message to the client would let the UI show a stale-data indicator.

### 11. Callback Stream Reconnect Without Unregister Check

**File**: `vite-plugin-octane-grpc.ts`, lines 271-289

When the callback stream errors, the handler schedules a reconnect after 5 seconds. It checks `isCallbackRegistered` but does not check whether an unregistration is in progress. If the server is shutting down and `unregisterOctaneCallbacks()` is running concurrently, the reconnect attempt races against cleanup and can produce spurious errors.

### 12. Incomplete Viewport Error Surfacing

**File**: `client/src/components/CallbackRenderViewport/hooks/useImageBufferProcessor.ts`, lines 265-268

If `scheduleRender` or `convertBufferToCanvas` throws, the error is logged but the viewport silently goes blank. The user sees no indication that rendering failed. Calling `onStatusUpdate` with a user-visible message would surface the problem.

### 13. API Timeout Not Configurable Per Call

**File**: `client/src/services/octane/ApiService.ts`, line 12

`API_TIMEOUT_MS = 30_000` is hardcoded. While the method signature accepts an optional timeout parameter, most callers (including scene tree loading, which can be slow with large scenes) don't override it. Long-running operations like `buildSceneTree` with deep node hierarchies may hit the 30-second wall. Making the default configurable or increasing it for known-slow operations would improve reliability with complex scenes.

### 14. nodeColor Falsy Check Misses Black

**File**: `client/src/components/NodeGraph/OctaneNode.tsx`, lines 194-197

The ternary `sceneNode.nodeInfo?.nodeColor ? formatColorValue(...) : '#666'` uses truthiness to check for color presence. In Octane, a color value of `0` represents black, but JavaScript treats `0` as falsy. Nodes that should render black will instead show the `#666` fallback. The check should be `!== undefined && !== null` instead of a bare truthiness test.

### 15. CacheManager Stampede Protection Race

**File**: `client/src/services/CacheManager.ts`, lines 128-141

The inflight promise coalescing in `get()` deletes the inflight entry on error (`this.inflight.delete(key)`). If a second caller coalesced on the same key while the first request was in-flight, both receive the rejected promise. But the deletion happens before all consumers have processed the rejection, so a third caller arriving at just the wrong moment could start a new request instead of receiving the cached rejection. This is a narrow window but could cause thundering-herd behavior under load.

---

## Minor Issues

### 16. Hardcoded Colors in GPU Statistics Dialog

**File**: `client/src/styles/node-graph.css`, lines 629-640

The GPU statistics dialog uses hardcoded hex values (`#404040`, `#222`, `#ccc`) instead of CSS variables, so it doesn't respond to theme changes. Replacing with `var(--bg-primary)`, `var(--border-color)`, and `var(--text-primary)` would maintain visual consistency.

### 17. Dead VERBOSE Flag in Express gRPC Client

**File**: `server/src/grpc/client.ts`, line 19

`const VERBOSE = false` is never toggled and cannot be changed at runtime. Making this configurable via an environment variable (`OCTANE_GRPC_VERBOSE`) would allow debugging production issues without code changes.

### 18. Duplicate WebSocket Buffer Constant

**File**: `server/src/api/websocket.ts`, line 29; `vite-plugin-octane-grpc.ts`, line 386

`MAX_WS_BUFFER = 10 * 1024 * 1024` is defined identically in both servers with no shared source. If one is updated, the other must be manually synchronized. Extracting to a shared constants file (or at minimum adding a comment cross-referencing the other definition) would prevent drift.

### 19. Unused Import in CallbackRenderViewport

**File**: `client/src/components/CallbackRenderViewport/index.tsx`, line 14

`useStatusMessage` is imported but not used; status is managed locally. Should be removed.

### 20. Missing Arrow Key Navigation in SceneOutliner

**File**: `client/src/components/SceneOutliner/VirtualTreeRow.tsx`, lines 80-83

Tree rows have `role="button"` with Enter/Space keyboard handling, but tree navigation typically expects arrow keys for moving between nodes. This is an accessibility gap for keyboard-only users. Adding `role="treeitem"` with arrow key handling would align with WAI-ARIA tree view patterns.

### 21. EventEmitter Uses console.warn Instead of Logger

**File**: `client/src/utils/EventEmitter.ts`, line 24

The max-listeners warning bypasses the centralized Logger, so it won't appear in `octaneWebR_client.log`. Should use `Logger.warn()` for consistency.

### 22. Implicit String Coercion in Spinner Step

**File**: `client/src/components/NodeInspector/ParameterControl.tsx`, line 176

The spinner step value comes from `floatInfo?.dimInfos?.[0]?.sliderStep ?? 0.001`. If the API returns this as a string (which can happen with certain protobuf configurations), the addition `floatValue + step` silently coerces and produces NaN. Wrapping in `Number()` would be defensive.

### 23. Unsafe `as any` Cast in Shutdown Handler

**File**: `vite-plugin-octane-grpc.ts`, line 714

`grpcClient = null as any` suppresses TypeScript's null check, allowing subsequent code to dereference null without a compile error. Using `grpcClient = null!` or restructuring to use optional chaining (`grpcClient?.method()`) would preserve type safety during the shutdown sequence.

### 24. Dead CSS Comments and Rules

**File**: `client/src/styles/app.css`, various lines

Several commented-out rules and stale removal notes remain from earlier refactoring passes. These add noise without value and should be cleaned up.

---

## Architectural Observations

These are not bugs but structural characteristics worth noting for future planning.

**Dual-server maintenance burden.** The Express production server and Vite dev plugin share core gRPC logic through `OctaneGrpcClientBase` (proto loading, service resolution, method invocation, health checks). The Express `client.ts` extends it; the Vite plugin uses it via composition. The remaining duplication is at the HTTP/WebSocket layer: origin validation patterns, backpressure constants, and response serialization. Cross-reference comments have been added for shared constants like `MAX_WS_BUFFER`. Further extraction is possible but may not be worth it given the different middleware stacks.

**App.tsx state concentration.** _(Resolved.)_ App.tsx was decomposed from 712 to 327 lines by extracting five hooks: `useSceneStatusEvents` (9 status-bar event listeners), `useViewportControls` (world coord, lock, picking mode), `useNodeGraphToolbar` (grid, snap, callbacks), `useRenderOutput` (clipboard, save, export + file browsers), and `usePanelLayout` (visibility, material DB, resizable panels). Only scene state (selectedNode, sceneTree, refreshTrigger) and two app-level event listeners remain in AppContent.

**No automated tests.** The codebase has no unit or integration tests. Given the complexity of the gRPC proxy layer, the scene tree builder, and the node graph coordinate conversion system, even a small test suite covering these core paths would catch regressions early. The `estimateNodeWidth` and position conversion functions in `NodeLayoutUtils.ts` are particularly good candidates — they are pure functions with well-defined inputs and outputs.

**RequestQueue concurrency limit.** API calls can optionally go through a `RequestQueue` with configurable concurrency. The `MAX_CONCURRENT_REQUESTS` constant (default `0` = no queuing) controls this globally. If connection pool exhaustion becomes an issue with large scenes, increasing this to 4–6 will throttle concurrent requests while leaving room for UI traffic.

---

## Summary

| Severity  | Count  |
| --------- | ------ |
| Critical  | 5      |
| Moderate  | 10     |
| Minor     | 9      |
| **Total** | **24** |

**All 24 findings have been fixed.** The App.tsx state concentration architectural observation has also been resolved via hook extraction. The remaining architectural items (dual-server duplication, no automated tests, RequestQueue tuning) are future improvements, not bugs.
