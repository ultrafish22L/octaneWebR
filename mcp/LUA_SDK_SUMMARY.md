# Lua API vs C++ Plugin SDK — Executive Summary

> Verified 2026-03-12. Cross-referenced 112 C++ SDK headers against the Lua API (30 modules, 470+ functions) via octane-docs MCP, web research, and per-function verification.

The C++ SDK is a superset of Lua, but the gap is narrower than you'd expect. Out of 112 SDK headers, only ~17 capability domains have no or partial Lua equivalent.

## Where the SDK Pulls Ahead

### High Impact — No Lua Equivalent

1. **Scene picking** (ray-cast, cryptomatte, white balance) — the entire interactive picking pipeline is SDK-only
2. **Scene world bounds** — no bounding box query exists in Lua
3. **Render farm daemons** — Lua has RNDR cloud (`rendercloudmanager`) but no LAN daemon discovery, binding, or farm orchestration
4. **OCS scene bundles** for RNDR submission — distinct from Lua's geometry export pipeline

### Medium Impact — Partial Lua Coverage

5. **OCIO config management** — Lua can _use_ OCIO color spaces on render output, but cannot load/switch the config file or enumerate available spaces
6. **LiveDB materials** — GUI browse dialog only, no programmatic search/download
7. **OOC memory** — Lua can _query_ usage (`getMemoryUsage()` reports `outOfCoreMemory`), but cannot _configure_ limits or headroom
8. **VDB voxel sampling** — constants exist, no sampling functions
9. **FPS / render priority** — not exposed to Lua

### Low Impact / By Design

10. Threading (Lua is single-threaded), plugin module registration (DLL only), workspace layout, embeddable native UI panels, licensing/auth, AABB math, base64 encode, node plugin data/`storeToDb`/`createInternal`

## Where Lua Holds Its Own (Full Parity)

- **Node operations** — creation, connection, attribute get/set (40+ functions)
- **Rendering** — start/stop/pause, devices, passes, image save (56 functions)
- **Per-pixel image access** — `getPixel`/`setPixel`/`getRawPixels`, filters, format conversion (25 functions)
- **Selection** — `select`/`deselect`/`getSelection`/`setSelection`/`clearSelection`
- **Change tracking** — `octane.changemanager` with event-driven observers, per-attribute/pin granularity, 12 event types
- **Animated geometry export** — `geometryexporter` with `setTimeSampling()` + `writeFrame()` (Alembic/FBX)
- **GUI construction** (80+ widgets), MaterialX, cloud rendering, project management, file I/O, JSON

## Bottom Line

Lua covers node operations, rendering, pixel manipulation, selection, change tracking, and animated export at full parity with the SDK. The SDK's real advantage is interactive tools (picking, bounds), infrastructure (farm daemons, OOC config, threading), and host integration (shared surfaces, embeddable panels, plugin modules).

See [LUA_SDK_REVIEW.md](LUA_SDK_REVIEW.md) for the full line-by-line comparison.
