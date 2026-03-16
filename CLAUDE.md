# OctaneWebR

## Current Session (agent updates this at session end)

**Phase 4: AA-Directed Cinematic Marathon — Full OTOY Studio Pipeline**

**Directive:** AA (Artistic Agent) directs every scene as creative director. No scene ships without AA approval. CM computes camera, TA researches materials. Autonomous all night — no asking permission.

**OTOY Studio Full Pipeline (use for EVERY scene):**

1. `generate_image_pro` → hero textures + environment art
2. `edit_image` → refine ("make gold veins thicker", "add more detail")
3. `upscale_image` → 4x resolution for crisp materials
4. Apply to Octane → NT_TEX_IMAGE on materials + environment
5. Render in Octane → photorealistic 3D with path tracing
6. `save_render` → PNG
7. `request_upload_url` → upload the render
8. `image_to_video_kling` → animate render into cinematic clip
9. `generate_music` → original soundtrack
10. Output: render + video + music = **complete cinematic package**

**AA Quality Standard:**

- Every render gets honest grade (A/B/C/D). Below B = iterate or pivot.
- Concept must match geometry — don't force wrong shapes into wrong roles
- Light for mood FIRST, materials second
- Environment is a character, not wallpaper
- If 3 iterations don't hit B+, pivot the concept

**Scene history (30 scenes across prior sessions):**

- Scenes 1-7: Early experiments (teapot, primitives)
- Scenes 8-14: Multi-object compositions (Space Cat, Monolith, Crystal Forge, etc.)
- Scenes 15-17: Transform breakthrough (A_TRANSLATION=172)
- Scenes 18-22: NT_MAT_SPECULAR breakthrough (gems, glass, chrome)
- Scenes 23-30: Metallic materials, scene repurposing pipeline, colored gems
- Scene 31: "20,000 Leagues Under the Sea" (in progress — OTOY Studio textures, multi-object underwater scene)
- Scene 32: "The Jeweler's Sanctum" (in progress — diamond on black marble, OTOY Studio env)

**Known MCP limitations:**

- `camera_visibility` bool on Object Layer doesn't stick
- `transparentEmission` on blackbody doesn't hide geo from camera
- Flat AI images don't work as equirectangular env maps
- **NT_GEO_MESH has no transform pins** — meshes render at .obj coordinates
- **Primitive type changes crash Octane** — Box-only + .obj meshes
- **Sphere light transforms need A_TRANSLATION=172** (not A_VALUE=185)
- **Universal material transmissionType unreliable** — use NT_MAT_SPECULAR for glass
- **reset_project can crash Octane** — use load_project + repurpose instead
- **Changing mesh filename after load_project doesn't reload geo** — create new mesh node instead

**Next session:** Continue Phase 4 cinematic marathon. Finish Jeweler's Sanctum, then keep building with full AA direction + OTOY Studio pipeline. Every scene = render + animated video + music. Target: portfolio-quality cinematic moments.

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
- **Octane launch**: `C:/otoyla/GRPC/dev/octaneGRPC-2026.1-Alpha5/octane.exe` — NEVER use any other Octane exe (launching the wrong one disables gRPC for the correct one).
- **Node inspector refresh**: when MCP updates a node that's currently selected in octaneWebR, re-select the node to refresh the inspector (or implement smarter code).

## Fresh Start Rule (BIG RULE)

When starting after a long delay, or when anything is unstable: **kill everything and start fresh**. The EXACT order matters:

**⚠ SERVERS DIE FIRST, OCTANE DIES LAST.** Killing Octane while servers are connected causes hangs and zombie processes that resist `taskkill`. Always stop preview/dev server before touching Octane.

1. **Stop preview** (`preview_stop`) — **MUST be first**
2. **Kill dev server** (stops with preview)
3. **Kill Octane** (`cmd /c "taskkill /F /IM octane.exe"` — must use `cmd /c` wrapper in bash shell. If it resists, use `powershell -Command "Stop-Process -Name octane -Force"`)
4. **Verify clean** — `tasklist | grep -i octane` should return nothing
5. **Launch Octane** — `start octane.exe` from the correct path (see Interaction Mode)
6. **Wait for Octane gRPC** — typically ~5s, use 15s if unsure, experiment
7. **Start preview** (`preview_start` — this starts both dev server and browser)

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
- **0 open bugs** — 5 known Octane API limitations (render engine calls ignored, camera not reset after File→Open, newStatistics never fires, LiveDB getCategory broken, Quad primitive type 18 crashes Octane)
- **Testing**: R1+R2+R3 complete. 181 tests, 16 bugs fixed and verified.
- **MCP server**: 28 tools, API cache (704 node types), incremental webapp sync
- **Themes**: 3 themes — vibe (default), octane, debug
- **UI**: Octane-style scrollbars (theme-aware), Octane-style number controls (arrows, scrub bar)
