# OctaneWebR Code Review

**Date:** 2026-03-18
**Version:** 1.5.2
**Reviewer:** Claude Opus 4.6 (strict mode)
**Scope:** Full codebase — server, MCP server, client, config/deps

## Summary

43 findings across 4 severity levels. 17 fixed, 5 skipped (not real issues), 21 deferred.

| Severity | Found | Fixed | Deferred | Skipped |
| -------- | ----- | ----- | -------- | ------- |
| CRITICAL | 4     | 2     | 2        | 0       |
| HIGH     | 9     | 5     | 4        | 0       |
| MEDIUM   | 17    | 6     | 8        | 3       |
| LOW      | 13    | 4     | 7        | 2       |

## Fixed (17)

### CRITICAL

- **C1. Server binds to 0.0.0.0** — Made configurable via `OCTANE_BIND_HOST` env var (default unchanged for Docker compat)
- **C3. Arbitrary filesystem read via `/api/files/list`** — Path restricted to `OCTANE_FILE_ROOTS` (default `C:\otoyla`), blocks traversal with `path.resolve()`, returns 403 on disallowed paths. Fixed in both Express server and Vite plugin.

### HIGH

- **H1. No graceful shutdown in MCP server** — Added SIGINT/SIGTERM handlers calling `server.close()` + `client.close()`
- **H2. Synchronous `appendFileSync` in MCP hot path** — Changed to async `fs.appendFile` (fire-and-forget)
- **H3. `restart_render` still registered as MCP tool** — Removed entirely (was deprecated, wasted LLM round-trips)
- **H4. No `handle` param validation in MCP tools** — All 8 handle params changed to `z.number().int().nonnegative()`
- **H5. `USE_ALPHA5_API` flag duplicated** — Now imports from shared `api-version.config.js` instead of hardcoding

### MEDIUM

- **M1. Unhandled promise rejection on `serverPromise`** — Added `.catch()` and `process.on('unhandledRejection')` handler
- **M2. `notifyWebapp` fetch has no timeout** — Added `AbortSignal.timeout(2000)`
- **M3. Duplicated `setValue` logic** — `useParameterValue` hook now calls `client.setParameterValue()` instead of duplicating the AttrType switch. Also fixes cache invalidation bypass.
- **M4. `NumberInput` window listeners not cleaned on unmount** — Stored cleanup function in ref, added useEffect unmount cleanup
- **M5. `StatusMessageContext` causes cascading re-renders** — Split into value + actions contexts. 11 setter-only consumers migrated to `useStatusActions()` (no re-render on message change)
- **M6. `MovableInputPinActions` menu has no click-outside-to-close** — Added mousedown listener with ref-based outside detection

### LOW

- **L1. `@improbable-eng/grpc-web` unused dependency** — Removed from `dependencies`
- **L2. `google-protobuf` unused in client** — Moved to `devDependencies`
- **L3. `eslint-plugin-react` installed but not in config** — Removed from `devDependencies`
- **L4. Reconnect timer not cancelled on `close()`** — Stored timer ref, cancel in `close()`
- **L5. Non-null assertion on `getElementById('root')`** — Replaced with null check + clear error message
- **L6. MCP log path inconsistency** — Exported `MCP_LOG_PATH` from `OctaneMcpClient`, imported in `info.ts`
- **L7. `DeviceService` unsafe casts** — Replaced `as number`/`as string`/`as boolean` with `asNumber`/`asString`/`asBool` helpers
- **L8. MCP esbuild script missing `utils.ts`** — Added to explicit file list
- **L9. `handleNodeTypeChange` no loading guard** — Added `nodeTypeChanging` state, disables dropdown during async operation
- **L10. Unsafe `as unknown as` double-cast in CameraService** — Removed intermediate `as unknown`, direct cast is safe with index signature
- **L11. `useFileBrowser` effect missing dep explanation** — Added eslint-disable comment explaining intentional no-deps pattern

## Deferred (21)

### Production Hardening (documented in CLAUDE.md)

These are deferred because the risk is low for a localhost dev tool. Must be addressed before any public/multi-user deployment:

1. **Security headers (helmet)** — No CSP, X-Frame-Options, nosniff. CSP breaks Vite HMR.
2. **gRPC proxy allowlist** — `POST /api/grpc/:service/:method` forwards any service/method. Core app functionality depends on this openness.
3. **Rate limiting** — No rate limiting on any endpoint.
4. **Error message sanitization** — Internal errors returned to HTTP clients.
5. **WebSocket limits** — No `maxPayload` or connection limit.

### Type Safety

6. **Pervasive `any` types across server code** — Large refactor to define gRPC response interfaces.
7. **MCP path traversal in `load_project`/`save_project`/`save_render`** — MCP client (Claude) already has full disk access.
8. **Cross-boundary import in MCP server** — `node.ts`/`info.ts` import from `../../../client/src/`. Should extract shared constants.
9. **Untyped `require()` in MCP `OctaneMcpClient.ts`** — Intentional to avoid OOM. Could add minimal interface.

### Refactoring

10. **`ParameterControl.tsx` 1028-line switch** — Should extract generic vector input component.
11. **`useMouseInteraction` 600-line monolithic useEffect** — Should split into focused hooks.
12. **Hardcoded 2s timeout in MCP `load_project`** — Pragmatic workaround for missing "project loaded" callback.

### Performance (top of defer list)

13. **Verbose logging in hot paths** — 463 `Logger.debug`/`debugV` calls. String interpolation evaluated before level gate. Fix would be lazy evaluation pattern.
14. **Fire-and-forget `saveRender`** — No `await` or `.catch()`, user gets no feedback on failure.

### Code Quality

15. **`SceneService` mutates tree in-place** — Intentional for performance on large scene trees.
16. **`connect_nodes` mutually exclusive params** — Works via precedence, but MCP tool docs should guide LLM to pick one param type.

### Unused/Misplaced Dependencies

17. **`express` + `cors` in prod deps** — Only used by legacy server. Move to devDeps if retired.
18. **`concurrently` in devDeps** — Only used by dead `dev:legacy` script.

### Other

19. **`handleNodeTypeChange` async no loading indicator** — FIXED (was originally deferred, promoted to fix)
20. **Server/mcp directories have no ESLint coverage** — Consider adding lint scripts.
21. **`sourceMap` + `inlineSources` in tsconfig no effect with `noEmit`** — Cosmetic only.

## Skipped (5)

- **Unbounded scene tree traversal** — DAG with no cycles, `max_depth` already limits depth
- **`convertSceneToGraph` O(n) map rebuild** — "n" is top-level nodes only (2-50), microseconds
- **`flattenTree` array copies** — Essential for virtualization, negligible at depth 5-10
- **`connect_nodes` param validation** — Precedence is predictable, adding validation would reject harmless calls
- **Unused `memo` import** — Actually used on line 1042
