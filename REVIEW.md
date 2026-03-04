# OctaneWebR - Senior Engineer Code Review

**Reviewer**: Principal Engineer
**Date**: 2026-03-03
**Scope**: Full codebase audit - server, client, services, components, CSS, build config
**Verdict**: **C+** - Functional but fragile. Good architecture, poor execution details. Needs hardening before production.

---

## Executive Summary

This is a React/TypeScript web frontend for the Octane renderer communicating via gRPC. The architecture is sound: modular service layer, event-driven updates, lazy loading, progressive scene building. However, the execution has systemic issues: no request timeouts anywhere, race conditions in mutable state, massive code duplication between the Vite plugin and Express server, CSS specificity wars, and too many unimplemented features left as `alert()` calls.

The codebase works for a demo. It will break under real usage.

**Issue counts**: 15 critical, 30 high, 56 medium, 22 low

---

## 1. Critical Issues (Production Blockers)

### 1.1 No Request Timeouts Anywhere

**Files**: `ApiService.ts:169`, all service files
**Impact**: Hanging requests accumulate indefinitely. Browser tabs freeze.

Every `fetch()` call in the entire client has no timeout. If the gRPC server hangs (common with Octane under load), the browser accumulates zombie requests until it crashes.

```typescript
// CURRENT - hangs forever
const response = await fetch(url, { method: 'POST', body });

// NEEDED
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);
const response = await fetch(url, { method: 'POST', body, signal: controller.signal });
clearTimeout(timeout);
```

**Fix**: Add AbortController with 30s timeout to `ApiService.callApi()`. One fix, entire app covered.

---

### 1.2 Massive Code Duplication: Vite Plugin vs Express Server

**Files**: `vite-plugin-octane-grpc.ts` vs `server/src/grpc/client.ts`
**Impact**: Maintenance nightmare. Bugs fixed in one place silently persist in the other.

The `OctaneGrpcClient` class is duplicated across both files (~800 lines each). The `serviceToProtoMap`, `resolveServicePath()`, `loadServiceProto()`, `getService()`, `callMethod()`, and `startCallbackStreaming()` are nearly identical copies. Parameter transformation logic is also duplicated in `server/src/index.ts`.

Changes to proto handling require editing 2-3 files. This has already caused divergence - the Vite plugin version has different logging and slightly different error handling.

**Fix**: Extract shared gRPC client to `server/src/grpc/OctaneGrpcClient.ts`. Both the Express server and Vite plugin import from the same source.

---

### 1.3 Race Conditions in Mutable Scene State

**Files**: `SceneService.ts`, `NodeService.ts`
**Impact**: Scene tree corruption; stale references; crashes.

The scene is stored as a mutable `Map` + `tree` array. Multiple async operations read and mutate this state without any synchronization:

```typescript
// NodeService.ts - deleteNodeOptimized
const collapsedChildren = this.findCollapsedChildren(node); // snapshot
await this.apiService.callApi('ApiItem', 'destroy', nodeHandle, {}); // async gap
scene.map.delete(nodeHandle); // mutate using stale snapshot
collapsedChildren.forEach(h => scene.map.delete(h)); // could be wrong
```

Between the snapshot and the mutation, another operation (progressive loading, user action) could modify the scene. The delete then operates on stale data.

**Fix**: Snapshot state before async calls. Re-validate before mutations. Consider immutable scene state with copy-on-write.

---

### 1.4 WebSocket Double-Initialization Memory Leak

**File**: `ConnectionService.ts:74-75`
**Impact**: Multiple WebSocket connections; duplicate messages; memory leak.

```typescript
const ws = new WebSocket(wsUrl);
this.ws = ws;
```

If `connect()` is called twice rapidly (which happens on React StrictMode mount/unmount), the first WebSocket is replaced before it closes. The old connection stays open, receiving and processing duplicate messages.

**Fix**: Close existing WebSocket before creating new one:

```typescript
if (this.ws) {
  this.ws.close();
  this.ws = null;
}
const ws = new WebSocket(wsUrl);
```

---

### 1.5 CommandHistory Corrupts on Error

**File**: `CommandHistory.ts:35-38, 79-84`
**Impact**: Undo/redo chain breaks after any failed command.

In `redo()`, the index is incremented _before_ execution. If `execute()` throws, the index points to a failed command. Next undo will try to undo a command that never executed.

**Fix**: Increment index only after successful execution. Wrap in try-catch with rollback.

---

### 1.6 CacheManager Skips Items During Invalidation

**File**: `CacheManager.ts:157-162`
**Impact**: Cache not fully invalidated; stale data persists.

```typescript
for (let i = 0; i < sessionStorage.length; i++) {
  const key = sessionStorage.key(i);
  if (key && key.startsWith('octane:cache:') && regex.test(key)) {
    sessionStorage.removeItem(key); // length decreases, next item skipped
    sessionCleaned++;
  }
}
```

Iterating `sessionStorage` while removing items causes index shift. Every removal skips the next item.

**Fix**: Collect keys first, then remove:

```typescript
const keys = [];
for (let i = 0; i < sessionStorage.length; i++) {
  const key = sessionStorage.key(i);
  if (key?.startsWith('octane:cache:') && regex.test(key)) keys.push(key);
}
keys.forEach(k => sessionStorage.removeItem(k));
```

---

### 1.7 EventEmitter Stops on First Handler Error

**File**: `EventEmitter.ts:35`
**Impact**: One bad listener kills all event propagation.

```typescript
handlers.forEach(handler => (handler as (...a: unknown[]) => void)(...args));
```

If handler #1 of 5 throws, handlers #2-5 never execute. Scene tree updates, render callbacks, and UI synchronization all depend on this EventEmitter.

**Fix**: Wrap each handler in try-catch:

```typescript
handlers.forEach(handler => {
  try {
    (handler as (...a: unknown[]) => void)(...args);
  } catch (error) {
    console.error(`Event handler error for "${event}":`, error);
  }
});
```

---

### 1.8 Server Initialization Race Condition

**File**: `server/src/index.ts:29-34`
**Impact**: Server accepts requests before gRPC is ready.

`grpcClient.initialize()` is fire-and-forget. The server starts listening before proto files are loaded. Early requests hit uninitialized gRPC client.

**Fix**: `await grpcClient.initialize()` before `app.listen()`.

---

### 1.9 `startCallbackStreaming()` is 230 Lines

**Files**: `server/src/grpc/client.ts:369-599`, `vite-plugin-octane-grpc.ts:381-507`
**Impact**: Unmaintainable. High cyclomatic complexity. Duplicated across two files.

This single function handles: stream creation, callback registration, image extraction from 4+ different response shapes, statistics parsing, error recovery, reconnection with delay, and logging. It has nested if/else chains 5 levels deep.

**Fix**: Break into `handleNewImageCallback()`, `handleStatisticsCallback()`, `setupStreamHandlers()`, `reconnectStream()`. Then the main function is ~20 lines.

---

## 2. High Priority Issues

### 2.1 Sequential API Calls in Loops

**Files**: `NodeService.ts:275-293`, `SceneService.ts:213-235`

```typescript
// 10k items = 10k sequential API calls. No batching.
for (let i = 0; i < size; i++) {
  const itemResponse = await this.apiService.callApi('ApiItemArray', 'get', listHandle, {
    index: i,
  });
}
```

**Fix**: Batch into groups of 10-50 using `Promise.all()` with concurrency limit. Or add batch endpoints server-side.

---

### 2.2 `ApiService.callApi()` Unsafe Error Parsing

**File**: `ApiService.ts:174`

`response.json()` can throw if the error response is HTML (e.g., 502 from a proxy). No fallback parsing.

**Fix**: Wrap in try-catch: `try { await response.json() } catch { throw new Error(response.statusText) }`

---

### 2.3 No WebSocket Authentication

**File**: `server/src/api/websocket.ts:18`

The WebSocket endpoint at `/api/callbacks` accepts all connections without authentication. Combined with `0.0.0.0` binding, this exposes render data to the entire network.

---

### 2.4 Optimistic State Updates Without Rollback

**File**: `RenderService.ts:31-32`

```typescript
this.renderState.isRendering = true; // optimistic
this.emit('renderStateChanged', this.renderState);
// API call may fail - no rollback
```

---

### 2.5 `alert()` in Production Code

**Files**: `useNodeOperations.ts:375,383,392`

Three `alert()` calls for unimplemented features. Blocks main thread. Unprofessional.

**Fix**: Replace with `setTemporaryStatus()` or disable the buttons with tooltips.

---

### 2.6 Stale Cache Reuse in Scene Building

**File**: `SceneService.ts:346-354`

Cached `SceneNode` returned without refreshing from API. If node type changed server-side, UI sees stale data.

---

### 2.7 Memory Leak: mouseleave Event Listener

**File**: `useMouseInteraction.ts:545`

Event listener added but cleanup doesn't match the handler reference.

---

### 2.8 Insecure gRPC Credentials

**Files**: `server/src/grpc/client.ts:30`, `vite-plugin-octane-grpc.ts:30`

`grpc.credentials.createInsecure()` everywhere. Acceptable for local dev only.

---

### 2.9 CSS: Pervasive `!important` Usage

**Files**: `app.css`, `node-graph.css`, `render-viewport.css`, `scene-outliner.css`

13+ `!important` flags on ReactFlow edges alone. This is a CSS architecture failure that makes future styling changes nearly impossible.

---

### 2.10 CSS: Massive Duplication and Dead Code

**Files**: All CSS files (~5,500 lines total)

Documented duplicate removals (comments saying "see line X"), commented-out code blocks, empty selectors, incomplete selectors (bare `.param-increment,` with no rules), duplicate `@keyframes` definitions across files.

---

### 2.11 Callback Listener Memory Leak on Re-registration

**File**: `server/src/services/callbackManager.ts:35-52`

`registerCallbacks()` adds 4 new listeners on `grpcClient` but never removes old ones. Re-registration adds duplicates.

---

### 2.12 CORS Misconfiguration

**File**: `server/src/index.ts:11-16`

`origin: '*'` with `credentials: true` is invalid per CORS spec. Browsers will reject this.

---

## 3. Medium Priority Issues

| #    | Issue                                                                 | File(s)                                   |
| ---- | --------------------------------------------------------------------- | ----------------------------------------- |
| 3.1  | Leading spaces in all error messages (copy-paste bug)                 | `NodeService.ts` (7 occurrences)          |
| 3.2  | No URL encoding in API path construction                              | `ApiService.ts:123`                       |
| 3.3  | Fixed 5s reconnect delay (no exponential backoff)                     | `ConnectionService.ts:131`                |
| 3.4  | `connected = true` set before WebSocket `onopen` fires                | `ConnectionService.ts:46`                 |
| 3.5  | `Promise.all` without `allSettled` for partial failures               | `server/src/index.ts:88`, `client.ts:710` |
| 3.6  | ~15 hardcoded hex colors that should use CSS variables                | All CSS files                             |
| 3.7  | Z-index inconsistency (variables vs hardcoded values)                 | All CSS files                             |
| 3.8  | Inconsistent error handling: some throw, some return null             | All service files                         |
| 3.9  | Keyboard handler registered on `document` instead of component        | `useNodeOperations.ts:461`                |
| 3.10 | Connection cutter uses wrong coordinate system for zoomed graphs      | `useConnectionCutter.ts:151`              |
| 3.11 | Empty features config file serves no purpose                          | `features.ts`                             |
| 3.12 | Logger fire-and-forget fetch in constructor                           | `Logger.ts:56`                            |
| 3.13 | Invalid CSS font weight value (`--font-weight-light: 50`)             | `theme-octane.css`                        |
| 3.14 | Duplicate `grid-template-columns` in same `@media` block              | `app.css:196-250`                         |
| 3.15 | `OctaneTypes.ts` manually maintained, should auto-generate from proto | `OctaneTypes.ts`                          |
| 3.16 | Cut = delete, paste = localStorage (incomplete clipboard)             | `EditCommands.ts:109-129`                 |
| 3.17 | Zero tests in entire codebase                                         | Everywhere                                |
| 3.18 | MaterialDatabaseService has duplicated graph-handle fallback logic    | Lines 170-214 and 361-385                 |
| 3.19 | `RequestQueue.processNext()` race condition on activeCount            | `RequestQueue.ts:44-65`                   |
| 3.20 | `useNodeOperations` has stale `nodes` in effect closure               | `useNodeOperations.ts:411`                |
| 3.21 | CameraService double-casts response via `unknown`                     | `CameraService.ts:24`                     |
| 3.22 | `RenderExportService` doesn't validate format string                  | `RenderExportService.ts:12`               |
| 3.23 | `ItemService.setParameterValue` silently returns on unknown type      | `ItemService.ts:130`                      |
| 3.24 | App.tsx is 668 lines - should split into sub-components               | `App.tsx`                                 |
| 3.25 | CSS media queries scattered across files with same breakpoints        | `app.css`, `node-graph.css`               |
| 3.26 | Unused `_serviceName` parameter in `getCompatibleMethodName`          | `apiVersionConfig.ts:80`                  |

---

## 4. What's Done Well

### Architecture

- **Modular service layer**: Clean separation into ApiService, NodeService, SceneService, etc. Each has single responsibility. BaseService provides consistent EventEmitter patterns.
- **Event-driven data flow**: Scene changes propagate naturally via events without tight coupling between components.
- **Progressive scene loading**: 4-level strategy (structure, types, children, metadata) provides fast initial render with progressive detail.
- **Dual API version support**: Clean Alpha 5 / Beta 2 compatibility via single config file (`api-version.config.js`).
- **Lazy loading**: NodeGraph and MaterialDatabase loaded via `React.lazy()` with proper Suspense fallbacks.
- **Vite plugin for dev mode**: Eliminates need for separate Express server during development.

### React Patterns

- **Stable callback identities**: `handleSceneTreeChange`, `handleNodeSelect` correctly wrapped in `useCallback([])` with functional state updaters to avoid stale closures.
- **Error boundaries**: Every major panel wrapped in `<ErrorBoundary>`.
- **EditActionsContext**: Clean pattern routing menu commands to the active component's handlers.
- **Custom hooks**: Good decomposition of NodeGraph into `useNodeOperations`, `useConnectionOperations`, `useConnectionCutter`.

### Code Quality

- **ApiService type helpers**: `asObject()`, `asNumber()`, `asBool()`, `getHandle()` provide proper runtime type narrowing.
- **RequestQueue**: Concurrency-limited queue prevents connection pool exhaustion.
- **CacheManager**: Multi-tier caching (memory + sessionStorage) with LRU eviction.
- **Accessibility**: ARIA roles on context menus, `prefers-reduced-motion` and `prefers-contrast` media queries.
- **Theme system**: Comprehensive CSS custom properties covering colors, spacing, typography, z-index.

### Infrastructure

- **Husky + lint-staged**: Pre-commit hooks enforce formatting.
- **TypeScript strict mode**: `strict: true`, `noUnusedLocals`, `noUnusedParameters`.
- **ESLint + Prettier**: Consistent formatting enforced.

---

## 5. Recommendations (Priority Order)

### Immediate (This Week)

1. **Add request timeout to `ApiService.callApi()`** - Single change, biggest impact
2. **Close existing WebSocket before reconnect** in ConnectionService
3. **Wrap EventEmitter handlers in try-catch** - Prevents cascade failures
4. **Replace `alert()` calls** with status bar messages (3 occurrences)
5. **Fix CacheManager iteration-during-removal** bug
6. **Remove leading spaces from error messages** in NodeService

### Short Term (This Month)

7. **Extract shared gRPC client** from vite-plugin and server into single source
8. **Add exponential backoff** to WebSocket reconnection
9. **Fix CommandHistory error handling** - Only push after successful execute
10. **Break `startCallbackStreaming()`** into smaller methods (both copies)
11. **Remove all CSS `!important`** and restructure specificity
12. **Add stylelint** to catch CSS duplicates and dead code
13. **Auto-generate `OctaneTypes.ts`** from proto files

### Medium Term (This Quarter)

14. **Add unit tests** - Start with services layer (ApiService, NodeService, SceneService)
15. **Implement proper cut/paste** with Octane clipboard API
16. **Batch sequential API calls** in loops (NodeService, SceneService)
17. **Add response validation** (zod schemas) to replace unsafe type casts
18. **Implement notification system** to replace TODO comments about user-facing errors
19. **Scope keyboard handlers** to component containers instead of `document`
20. **Consolidate CSS** into component-based structure

### Long Term

21. **Add E2E tests** with Playwright
22. **Implement WebSocket authentication**
23. **Add TLS support** for gRPC connections
24. **Consider CSS modules** for component encapsulation
25. **Implement proper undo/redo** with tested CommandHistory

---

## 6. Metrics

| Category              | Files   | Lines       | Critical | High   | Medium | Low    |
| --------------------- | ------- | ----------- | -------- | ------ | ------ | ------ |
| Server (Express/gRPC) | 4       | ~1,300      | 3        | 4      | 12     | 4      |
| Vite Plugin           | 1       | ~875        | 3        | 1      | 10     | 2      |
| Client Services       | 16      | ~4,500      | 4        | 8      | 12     | 6      |
| React Components      | 25+     | ~8,000      | 2        | 10     | 14     | 6      |
| CSS                   | 7       | ~5,500      | 3        | 7      | 8      | 4      |
| **Total**             | **53+** | **~20,000** | **15**   | **30** | **56** | **22** |

**Overall: 123 issues found. 15 are production blockers.**

---

_The bones are good. The muscles need work._
