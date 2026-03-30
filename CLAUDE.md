## v2.4.5

Known issues: Connection LED false-green when offline, LiveDB disabled.

### v2.4.5 changes (MCP_BUILD 70)

- **Electron dist build with dxSS shared surface rendering** — full DirectX 11 shared surface pipeline for the standalone Electron app. Octane renders to a DXGI shared texture, `octaneServGrpc` clones and `DuplicateHandle`s it to the Electron process, the native addon (`dx_shared_surface.node`) maps it to CPU via GPU DMA, and pixels stream over WebSocket to the canvas. Zero protobuf serialization on the hot path.
- **Native addon** (`native/src/dx_shared_surface.cpp`) — D3D11 device creation matched to Octane's GPU adapter (LUID), cached staging texture, `mapSurface` hot path with optional keyed mutex
- **GrpcProxyServer dxSS integration** — `enableSharedSurface()` 3-step init (device check, async tonemap passes, SS output type), `grabSharedFrame()` RPC with 0x0 frame guard, in-flight handle tracking with 10s stale cleanup, `destroySsDevice()` on shutdown
- **octaneServGrpc `SharedSurfaceFrameService`** — `grabSharedFrame` falls back to render statistics for frame dimensions when `ApiRenderImage.mSize` is `{0,0}` (SS mode), 30s TTL purge for orphaned cloned surfaces
- **Callback conflict fix** — GrpcProxyServer no longer overwrites MCP's callback registration; uses own gRPC stream instead of MCP relay to avoid dead-stream masking by heartbeats
- **Vite SS cleanup** — dev mode explicitly disables shared surface output (`setSharedSurfaceOutputType(0)`) on startup; removed dead `extractSharedSurfaceMetadata` async code
- **CallbackStreamManager reconnect fix** — `end` handler uses `scheduleReconnect` when disconnected to prevent tight reconnect loops after serv restart
- **Electron build** — `api-version.config.js` reads `OCTANE_PROTO_DIR` env var for packaged builds; proto field name fix (`realtime` → `realTime`)

### v2.4.4 changes (MCP_BUILD 69)

- **Sonnet-only AD vision** — all AD vision calls (critique, reference analysis, calibration) use Anthropic API (Sonnet). Moondream3/otoy-studio only for mugshots.
- `critiqueWithReference()` sends concept art + render as two images to Sonnet → A-F grade
- `callVision()` / `callVisionPair()` — unified single/dual-image Sonnet calls
- Trimmed VLM prompts to ~3 lines (from 40+)
- Per-scene `critique_stats.jsonl` audit trail for system tuning
- `ComparisonScores` / `OrchestratorAssessment` on CritiqueRecord
- Deleted dead `renderMugshots` (~270 lines) — all rendering via `renderViews`
- Extracted constants: `MUGSHOT_FILM_RESOLUTION`, `MUGSHOT_SAMPLES`, `MUGSHOT_ENV_POWER`, `DEFAULT_MUGSHOT_MARGIN`, `PANCAKE_HEIGHT_THRESHOLD`
- Extracted helpers: `isPancakeMesh()`, `writePlaneOBJ()`
- `fit_camera` queries actual film resolution for aspect ratio (no more hardcoded 2:1)
- Hero shot now renders on known-source fast path (was missing)
- Default mugshot margin 0.05 → 0.1
- `try/finally` safety for clay mode restoration + node cleanup in `renderViews`
- Error logging in all catch blocks (no silent swallows)

---

## Docs — read ONLY what your task needs

**⚠️ Token budget matters.** Don't read all docs upfront. Pick ONE row based on your task.

| Task                  | Read FIRST                                                        | Read IF NEEDED                                                             |
| --------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **AD scene build**    | `docs/mcp/BUILD.md` §3 (DRESS protocol)                           | `docs/mcp/OTOY_STUDIO.md` (REST API), `docs/mcp/REFERENCE.md` (pin layout) |
| **Quick test / SHOP** | `docs/mcp/BUILD.md` §1-§2 only                                    | `docs/mcp/REFERENCE.md`                                                    |
| **Debug / fix**       | `docs/mcp/TROUBLESHOOTING.md`                                     | `docs/mcp/BUILD.md` §7 (log check)                                         |
| **MCP server dev**    | `docs/project/ARCHITECTURE.md`                                    | `docs/mcp/REFERENCE.md`                                                    |
| **UI changes**        | `docs/ui/UI_IMPLEMENTATION.md`                                    | —                                                                          |
| **AD system design**  | `docs/ADSYSTEM.md`                                                | `docs/project/SEGA_SYSTEM_DESIGN.md`                                       |
| **Testing**           | `docs/mcp/TEST_PLAN.md` (MCP) or `docs/project/TEST_PLAN.md` (UI) | —                                                                          |
| **Render pipeline**   | `docs/RENDER_PIPE.md`                                             | —                                                                          |
| Art lighting/mood     | `docs/mcp/CREATIVE.md`                                            | `docs/project/SEGA_SYSTEM_DESIGN.md`                                       |
| OTOY Studio API       | `docs/mcp/OTOY_STUDIO.md`                                         |
| SSO JWT auth          | `docs/mcp/SSO_JWT.md`                                             |
| gRPC C++ API          | `octaneServGrpc/docs/REFERENCE.md`                                |

---

## Startup

1. `octaneServGrpc/build/Release/octaneServGrpc.exe` (wait ~6s, port 51022)
2. `preview_start("octaneWebR")` — immediately after serv, before anything else
3. `get_octane_version()` — verify mcp_build + serv_build

## Cardinal Rules

1. **`analyze_mesh` before `import_mesh`** — always, no exceptions. Mugshots reveal orientation.
2. **`place_mesh` is preferred** over manual node wiring. If it errors, diagnose — don't fall back to manual `create_node` chains.
3. **Color clay (mode 2) for Phase 1** → `critique_render` gate ≥ C before `set_clay_mode(0)`. No lighting/materials in clay.
4. **`fit_camera` only** — never `set_camera` to fix framing. Wrong framing = wrong geometry. `set_camera` is Phase 4 only.
5. **Visual verify EVERY mutation** — `save_render` + `preview_screenshot`, compare both.
6. **Creative review before critique** — ALWAYS ask "what else does this scene need?" before calling `critique_render`. Walls, textures, HDRI, depth. 3 objects on a floor = automatic fail.
7. **Framing is #1 failure mode** — verify framing visually before critique. Objects grounded, hero visible, camera distance sane.
8. **Sonnet is the critic, not you** — `critique_render` with `reference_image_path` = Sonnet grades. Without it = self-critique fallback. Be HARSH in your orchestrator C3 review.
9. **Concept art must match scope** — product shot concept for product shot scene. Full room concept for full room scene. Mismatch = guaranteed F.
10. **Hero meshes from image-to-3D** — REST API: `que.otoy.studio/r2/otoy-studio/hunyuan-3d/v3.1/pro/image-to-3d`. See `docs/mcp/OTOY_STUDIO.md`.
11. **HDRI environment is standard** for art scenes. Daylight/flat color only for testing.
12. **Parallel work** — use mesh generation wait time (~3 min) to build scene infrastructure.
13. **Use suggest_lighting / suggest_material** — they read SEGA intent. Don't manually guess values.

Full workflow, phases, and hard rules: `docs/mcp/BUILD.md`

---

## Build & Debug

> **NEVER run `tsc` or `tsc --noEmit` — OOMs on this project. Build with `npm run build` (esbuild) ONLY.**

| Command                   | What                                               |
| ------------------------- | -------------------------------------------------- |
| `cd mcp && npm run build` | MCP server build (esbuild) — **THE build command** |
| `npm test` (root)         | Run all tests (vitest, 289 tests)                  |
| `npm run lint` (root)     | ESLint client code                                 |

- **Version bump:** `MCP_BUILD` in `mcp/src/tools/info.ts` → rebuild → kill node.exe → verify `get_octane_version()`
- **MCP log:** `log_mcp.log` — use `clear_log` before test runs
- **SCRATCH:** Full restart protocol → `TROUBLESHOOTING.md` §SCRATCH
- **Viewport grey?** Stale `.js` in `mcp/src/`, wrong mcp_build, or CallbackStreamManager
