# OctaneWebR

## Current Session (agent updates this at session end)

**Phase 6: Nemo Trailer v3 — COMPLETE + St. Patrick's Poster**

**What happened in Phase 5f→6:**

- **Writers Room** — 4 specialized agents (Narrative, Cat, World, Emotion) pitched scene beats in parallel
- **AA/Showrunner synthesis** — merged best elements into locked script v3: "The Deep Purrs Back"
- **Story spine:** Nemo searches for Patala (Hindu underworld). Catraken is its guardian. The twist: the treasure was never there — the journey was the point. Two outcasts recognize each other. The slow blink is the climax.
- **18 keyframes generated** — all AA-reviewed (avg grade A, 4x A+ on critical frames)
- **17 video clips** — 10 Veo3 (with generated audio!), 7 Kling i2v animations
- **85-second trailer assembled** via moviepy (Python) — `renders/storyboard/v3/trailer_v3.mp4`
- **St. Patrick's Day poster** — Captain, crew, and Catraken celebrating as friends (A+ grade, 4x upscaled)
- **Gallery page** at `renders/storyboard/v3/gallery.html` — 4 tabs (Trailer, Storyboard, Video, St. Patrick's)

**Key story beats (script v3):**

1. The Shrine (Nemo praying at mother's portrait) → 2. Descent (purple ocean pulses) → 3. Bridge (crew ears rotate) → 4. Whisker Forest (the ocean IS the creature) → 5. Graveyard (centuries of failed seekers) → 6. The Eye (mirror moment) → 7. Eruption (Catraken reveal) → 8. Curiosity Tap (BONG — intelligent predator) → 9. Battle (turmeric rockets! kitten in crate! belly trap!) → 10. Caught → 11. The Turn (Nemo kills engines — first seeker wise enough to STOP) → 12. The Slow Blink (climax — trust) → 13. Release → 14. Ascent → 15. "Nothing." (Nemo + kitten) → 16. Title card

**Cat behaviors are load-bearing, not decoration:**

- Curiosity tap (terrifying intelligent investigation)
- Kneading the helm (self-soothing under stress)
- Belly trap recognition ("No. It wants us to.")
- Claws on wet steel (survival instinct)
- Kitten in supply crate (unbothered through apocalypse)
- The slow blink (emotional climax — highest cat trust signal)

**Key assets saved:**

- `renders/storyboard/v3/` — 18 keyframes (PNG), trailer (MP4), poster (PNG + 4x)
- `renders/storyboard/v3/video/` — 17 clips (10 Veo3, 7 Kling)
- `docs/recipes/NEMO_TRAILER_SCRIPT_v3.md` — locked 16-beat script with AA notes
- `renders/storyboard/v3/assemble_trailer.py` — moviepy assembly script
- Previous assets in `renders/storyboard/` still intact

### TODO for Next Session

1. **Octane 3D production scene** — build the hero frame ("The Turn" — Nemo's paw on glass, Catraken eye beyond) in Octane with full volumetric purple medium, pathtracing kernel, hero lighting. All 3D assets ready in `ORBX/assets/`.
2. **Refine trailer** — swap Ken Burns frames for more Kling animations, add crossfades, music track.
3. **Upscale hero trailer frames** — 4x upscale the 6 critical keyframes for print/poster use.
4. **Video chain continuity** — re-generate clips using end-frame→start-frame technique for seamless transitions.

### Proven Purple Medium Values (UPDATED — old values were wrong!)

- **Scale:** 0.007 (0.002=invisible, 0.015=opaque)
- **Absorption:** {0.3, 0.3, 0.3} NEUTRAL — do NOT use colored absorption, it's unintuitive with invertAbsorption
- **invertAbsorption:** true (default)
- **Scattering:** {0.3, 0.05, 0.4} (purple scatter — R+B heavy, low G)
- **Env color:** {0.45, 0.05, 0.5} (saturated purple)
- **Env power:** 35
- **mediumRadius:** 5000 (default 1 = nothing visible!)
- **Kernel:** NT_KERN_PATHTRACING (type_id 25)

**Key insight:** Purple comes from env color + scattering color, NOT from absorption. Keep absorption neutral.

### Sphere Light Power in Medium (efficiency=1.0, surfaceBrightness=false)

| Role         | Power | Temp       | Notes                        |
| ------------ | ----- | ---------- | ---------------------------- |
| Overhead key | 10-20 | 2800-5500K | Warm for underwater contrast |
| Fill         | 6-8   | 8000-9000K | Cool blue, opposite side     |

### Assets Ready (in ORBX/assets/)

**Hero meshes:** nautilus.obj (40MB), cat_captain_hindu.obj (40MB), catraken.obj (39MB) ✅
**Textures:** nautilus_diffuse.png, cat_captain_hindu_diffuse.png, catraken_diffuse.png — all 4096×4096 ✅
**Primitives:** sphere.obj, pillar.obj, monolith.obj, ring.obj, torus.obj, prism.obj, floor.obj
**Composition plan:** `docs/recipes/NEMO_STORYBOARD_PLAN.md` — 3 frames (Kraken Wakes, Battle, Captain's Stand).

### Known MCP Limitations (carried forward)

- `load_project` creates stale nodes — ALWAYS create fresh mesh+placement with absolute paths
- NT_GEO_MESH has no transform pins → use NT_GEO_PLACEMENT
- Geo group: set A_PIN_COUNT (attr 113) BEFORE connecting children. Use pin_index (0-based), NOT pin_name
- Primitive type 18 (Quad) crashes Octane
- reset_project needs save_project first or Octane pops blocking dialog
- GLB direct load times out — must use OBJ + separate texture
- transparentEmission=true on blackbody does NOT reliably hide sphere lights from camera — use tiny radius or position behind subjects

## Project Vocabulary

| Term      | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **MEET**  | Structured multi-role review: Code Agent reviews → CA reviews the review → BA reviews everything → ES to user. See `docs/project/MEET_*.md` for examples.                                                                                                                                                                                                                                                                                                                                                                                  |
| **CA**    | Code Agent — first-pass technical reviewer in a MEET                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **BA**    | Business Analyst — final reviewer in a MEET (strategic view, communication grades, fumble report, verdict)                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **ES**    | Executive Summary — final deliverable to the user after a MEET                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **DRESS** | Demo build mode — 1 node at a time, render after each step, max visual change per second. For boss demos. See `docs/build/DRESS_BUILD_PROTOCOL.md`                                                                                                                                                                                                                                                                                                                                                                                         |
| **SPEED** | Batch build mode — create all nodes fast, wire all, render once at end. For testing.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **AA**    | Artistic Agent — responsible for visual quality at every stage. Ensures the render looks cool throughout the build, not just at the end. Guides camera framing, lighting mood, material readability. If AA wouldn't approve the current viewport, fix it before moving on. Owns **CM** and **TA** as sub-agents.                                                                                                                                                                                                                           |
| **CM**    | Camera Math — AA's sub-agent for computing camera positions, FOV coverage, framing distances, and scene bounds. Does real trig instead of guessing. Reports position/target vectors AA can apply directly. **Learns from live:** after each set_camera, CM checks the actual render against its prediction — if chips are clipped, framing is off, or composition is wrong, CM revises its model (FOV, aspect ratio, scene bounds) and retries. Caches proven formulas and scene-specific corrections in `docs/build/CAMERA_MATH.md`.      |
| **MA**    | Math Agent — AA's sub-agent for computing ALL scene positions from mesh bounds. Primary input: world-space bounding box of subject. Calculates camera position/target, light positions, object spacing, composition. Never guesses — always derives from geometry. Reports exact {x,y,z} vectors AA can apply directly.                                                                                                                                                                                                                    |
| **TA**    | Tech Agent — AA's sub-agent for deep CG technical problems. Has full web search, octane-docs MCP, and OTOY forum (render.otoy.com) access. Researches shader math, procedural texture tuning, noise function parameters, physically-based material properties, and renderer-specific quirks. When AA needs a procedural texture to match a real-world reference (e.g., species-accurate wood grain), TA does the deep dive: web research, OTOY forum threads, octane-docs API, parameter sweeps. Reports actionable settings AA can apply. |

## #1 Rule: Docs Live in the Repo

ALL documentation, reference sheets, protocols, and cheat sheets MUST be saved to repo-backed folders (e.g., `docs/`, `mcp/`, `recipes/`). NEVER store project-useful docs only in local/user memory folders. This is a shareable project — if it's useful, it belongs in the repo.

**Doc update order:** When a finding changes a rule, update `docs/mcp/OCTANE_MCP.md` FIRST (single source of truth), then propagate to other docs (CHEATSHEET, DRESS_BUILD_PROTOCOL, CLAUDE.md, IMPROVEMENTS.md). Don't wait for user to ask — scan all docs immediately after any rule-changing finding.

## #0 Rule: Read Before Doing (HARD GATE)

**The "Current Session" section above IS your briefing.** Read it and **summarize what you found to the user** before taking any action. This is not optional — the summary forces you to actually process the instructions instead of scanning past them. Short user requests ("wow me with X", "do the wood chips") reference the plan already written there.

**Before MCP scene building**, also read `docs/build/OCTANE_CHEATSHEET.md` for exact values and pin layouts.

**At session end**, update the "Current Session" section to reflect the next session's task. This is your responsibility — don't leave stale instructions for the next conversation.

## Quick Start

- **Dev server**: `npm run dev` (port 57341)
- **Test scene**: `ORBX/teapot.orbx` — load via File→Open
- **Smoke test**: Toggle Orthographic on Camera node → verify `setByAttrID` in `grpc-debug.log`
- **MCP server**: `cd mcp && npm run build && npm run mcp:start`

### Environment Variables

| Variable            | Default     | Purpose                                                                                                                                                |
| ------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OCTANE_BIND_HOST`  | `0.0.0.0`   | Network bind address for dev server and Express. Default exposes to LAN for Docker/sandbox/Claude Code. Set to `127.0.0.1` on open/untrusted networks. |
| `OCTANE_FILE_ROOTS` | `C:\otoyla` | Comma-separated allowed roots for the file browser. Prevents path traversal. Set to `*` for unrestricted access.                                       |
| `OCTANE_HOST`       | `127.0.0.1` | Octane gRPC host (auto-detects `host.docker.internal` in containers)                                                                                   |
| `OCTANE_PORT`       | `51022`     | Octane gRPC port                                                                                                                                       |
| `SERVER_PORT`       | `45769`     | Express server port                                                                                                                                    |
| `WORKER_1`          | `43929`     | Vite dev server port                                                                                                                                   |

## Key Docs

All docs live under `docs/` in subfolders:

- `docs/project/` — ARCHITECTURE, IMPROVEMENTS, BUGLIST, TEST_PLAN, CHANGELOG, QUICKSTART
- `docs/mcp/OCTANE_MCP.md` — MCP technical reference: pin layouts, crash prevention, API patterns
- `docs/mcp/OCTANE_CREATIVE.md` — creative guide: lighting, materials, composition, anti-CG
- `docs/mcp/DEMO_SHOW_FLOW.md` — demo script
- `docs/build/DRESS_BUILD_PROTOCOL.md` — rigorous MCP scene build protocol (19 steps, 4 phases)
- `docs/build/OCTANE_CHEATSHEET.md` — living quick-reference: sunset, materials, camera, pins, transforms
- `docs/build/SCENE_BUILDING_TIPS.md` — camera workflow, framing, build order, visual debugging
- `docs/ui/UI_IMPLEMENTATION.md` — inspector depth shading, float formatting, leaf nodes, movable inputs
- `docs/recipes/` — 6 scene recipes (prose creative briefs with reference values)

## Testing Rules

All in `docs/project/TEST_PLAN.md`. Key points:

- Fix one, verify, then next. No batching.
- Fresh state per test — restart dev server and reload scene.
- Detect Octane crashes immediately — check for `ECONNRESET`/`ECONNREFUSED`.
- Lint and build before push — `npm run lint` + `npm run build`.

## Interaction Mode

- **Default: use octaneWebR web UI** via preview tools (click, fill, eval, snapshot, screenshot) for all testing, debugging, and scene interaction — like a human user would.
- **MCP tools only** when working on MCP server features or when the web UI can't do something yet (e.g., no create-node dialog).
- **Octane launch**: `"C:/otoyla/GRPC/dev/octaneGRPC-2026.1-Alpha5/octane.exe" &` with `dangerouslyDisableSandbox: true`. NEVER use `cmd /c start` (fails silently). NEVER use any other Octane exe (launching the wrong one disables gRPC for the correct one).
- **Node inspector refresh**: when MCP updates a node that's currently selected in octaneWebR, re-select the node to refresh the inspector (or implement smarter code).

## Fresh Start Rule (BIG RULE)

When starting after a long delay, or when anything is unstable: **kill everything and start fresh**. The EXACT order matters:

**⚠ SERVERS DIE FIRST, OCTANE DIES LAST.** Killing Octane while servers are connected causes hangs and zombie processes that resist `taskkill`. Always stop preview/dev server before touching Octane.

1. **Stop preview** (`preview_stop`) — **MUST be first**
2. **Kill dev server** (stops with preview)
3. **Kill Octane** (`cmd /c "taskkill /F /IM octane.exe"` — must use `cmd /c` wrapper in bash shell. If it resists, use `powershell -Command "Stop-Process -Name octane -Force"`)
4. **Verify clean** — `tasklist | grep -i octane` should return nothing
5. **Launch Octane** — MUST use bash background syntax with `dangerouslyDisableSandbox: true`:
   ```
   "C:/otoyla/GRPC/dev/octaneGRPC-2026.1-Alpha5/octane.exe" &
   ```
   `cmd /c start` does NOT work from the sandbox. Only `"<path>" &` reliably launches Octane.
6. **Wait for Octane gRPC** — typically ~10-15s. Verify with: `powershell -Command "Get-NetTCPConnection -LocalPort 51022 -ErrorAction SilentlyContinue"`
7. **Start preview** (`preview_start` — this starts both dev server and browser). MUST start AFTER Octane gRPC is listening or the Vite plugin won't connect.

**NEVER** skip steps or reorder. Especially: NEVER kill Octane while servers/preview are still running. NEVER start servers before Octane is ready. Always check for already-running Octane instances before launching a new one (`tasklist | grep -i octane`).

## MCP Scene Building Rules

**Full rules in `docs/mcp/OCTANE_MCP.md`.** The 3 hardest-learned rules:

- **NEVER `evaluate:false`** — always evaluate immediately. Deferred batches crash Octane.
- **NEVER `restart_render`** — crashes Octane. Use `start_render` (keeps render live).
- **Connections need `update_scene()` + camera change** — `start_render` does NOT refresh the geometry tree. After connections, call `update_scene()` then `set_camera` — both are required.
- **`reset_project` needs save first** — without saving, Octane pops a system dialog that blocks gRPC. Always `save_project` to a temp path before `reset_project`.

Also see: `docs/build/DRESS_BUILD_PROTOCOL.md` (build order), `docs/build/OCTANE_CHEATSHEET.md` (values), `docs/build/SCENE_BUILDING_TIPS.md` (camera/framing).

## Status

- **Version**: 1.5.2
- **2 open items** (#5 camera framing from bounds, #6 materials-from-geo-1 rule) — see `docs/project/IMPROVEMENTS.md`
- **5 known Octane API limitations** (render engine calls ignored, camera not reset after File→Open, newStatistics never fires, LiveDB getCategory broken, Quad primitive type 18 crashes)
- **MCP server**: 28 tools, API cache, incremental webapp sync
- **Themes**: 3 themes — vibe (default), octane, debug
- **UI**: Octane-style scrollbars (theme-aware), Octane-style number controls (arrows, scrub bar)

### Production Hardening (deferred — not needed for local dev)

These items were identified in `review.md` code review and deferred because the risk is low for a localhost dev tool. **Must be addressed before any public/multi-user deployment:**

1. **Security headers (helmet)** — No CSP, X-Frame-Options, or nosniff headers. Deferred because CSP breaks Vite HMR in dev.
2. **gRPC proxy allowlist** — `POST /api/grpc/:service/:method` forwards any service/method with no validation. Core app functionality depends on this openness. Add a service/method allowlist before exposing to untrusted networks.
3. **Rate limiting** — No rate limiting on any endpoint. Add `express-rate-limit` or equivalent before public deployment.
4. **Error message sanitization** — Internal error messages (gRPC errors, paths, stack traces) are returned to HTTP clients. Replace with generic errors in production.
5. **WebSocket limits** — No `maxPayload` or connection limit on WebSocket server. Add `maxPayload: 1048576` and a connection cap.
