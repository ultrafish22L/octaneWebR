# OctaneWebR Project Memory

## Project Overview

React/TypeScript web frontend for Octane renderer, communicating via gRPC through a Vite dev plugin (dev) or Node.js Express server (prod). Located at `c:\otoyla\GRPC\dev\octaneWebR`.

## Current Status (v1.4.6)

- **PRIORITY: MCP bug fixing until stable** — fixing all crash-causing bugs before demo. Test by building scenes. Goal: crash-free scene building → demo for bosses.
- **0 open bugs** — 4 known Octane API limitations
- **MCP server**: 23 tools in `mcp/`. Run: `npm run mcp:start`. Build: `cd mcp && npm run build`
- **Scene gallery**: 16 recipes in `recipes/` (13 scenes + 3 Cornell variants). Scene 1 LOCKED (rebuilt). Rest pending.
- **Recent fixes (committed 80705fa)**: primitive type safety guard, `evaluate: false` pattern, crash docs updated. Needs validation via scene build.

## Key Docs

- `mcp/OCTANE_MCP.md` — technical MCP reference (pin layouts, crash prevention, API patterns)
- `mcp/OCTANE_CREATIVE.md` — creative guide (12 sections: assets, lighting, materials, composition, color, anti-CG, workflow, environments, rendering, wisdom, depth, scale)
- `recipes/*_RECIPE.md` — all scene recipes (prose vision + reference values)

## User Preferences

- **No snap judgments**: Present findings and options, let the user decide.
- **Show renders inline**: Every MCP scene change → render preview in chat. User CAN see Octane viewport live.
- **Never say "No response requested"**: If mid-task, KEEP GOING.
- **No time estimates**: Just do the work.
- **Demo mode**: Minimal tech info, frequent renders, narrate like a showcase not a debug session.
- **MCP session start**: ALWAYS Read recipe + OCTANE_MCP.md at session start. Never rely on memory.
- **One object at a time**: Each geo object must render individually. No batching.
- **Don't trust session continuations** for MCP scene state — verify or start fresh.
- **Camera workflow (iteration)**: Start wide/back/above (overview). Build in that view. Then zoom to hero angles, evaluate, finalize on the "wow" angle.
- **Camera workflow (demos)**: Set HERO camera FIRST. Objects pop into the already-framed shot one by one — viewer watches the final composition assemble. Much more cinematic than overview→jump-cut.
- **Framing is 70% of the deal**: Study the reference frame BEFORE creating nodes. Describe the composition first — object depth positions, how they fill the frame, margins, formation. Materials are the other 30%.
  - **Simple scenes** (few objects): Framing carries everything. Depth arrangements matter most because there's nothing else. Scene 1's V-formation is specific to that scene.
  - **Complex scenes**: Focus on PRIMARY subject with good PERIPHERAL context. Peripherals support, don't compete. Peripherals are usually env/daylight — set up early and fast so every object appears in a lit, atmospheric frame.
  - **Animation**: All of the above plus FLOW — how the eye moves through the scene over time.
- **Camera off-axis by default**: Off-axis camera almost always better — creates depth, parallax, dimension. Straight-on flattens to 2D. Exceptions: when symmetry IS the point (Mirror Room centered sphere, face-on architecture).
- **Scene 1 proven values** (from reference render — the GOLD STANDARD):
  - **V-formation**: gold+red FORWARD, glass RECESSED center. NOT flat z=0.
  - Camera: position(-1.5, 0.9, 4.2), target(0, 0.15, 0) — tight framing, fills frame
  - Floor: pos(0, 0, 0), scale(10, 10, 10)
  - Gold sphere (LEFT): pos(-0.9, 0.3, 0.4), scale(0.6) — Glossy metallic, diffuse (1, 0.84, 0), **IOR 30** for metallic Fresnel
  - Glass sphere (CENTER): pos(0, 0.38, -0.3), scale(0.75) — Specular, IOR 1.5, transmission (0.3, 0.5, 1.0)
  - Red sphere (RIGHT): pos(0.9, 0.3, 0.3), scale(0.6) — Diffuse, color (0.8, 0.05, 0.05)
  - Mesh: `sphere_hd.obj` (radius ≈ 0.5 in object space). Y = scale × 0.5 = sits on floor
  - Floor: `floor.obj`, Glossy — diffuse (0.7, 0.7, 0.7), specular 1.0, roughness 0.02
  - **Glossy metallic IOR 30**: IOR 1.5 = painted plastic, IOR 100 = pure mirror (reflects cool sky, looks silver). IOR 30 = sweet spot for gold.
  - **Warm sky is critical for gold**: sky_color (0.7, 0.5, 0.4), sunset_color (1, 0.35, 0.08) — gold reflects environment, so env must be warm.
- **Be critically honest about renders**: Never sugarcoat. "Flat brown" is not "golden hour sky." Evaluate what you actually see, not what you intended.
- **Recipes are prose creative briefs**: Not rigid. Prose vision + reference values + "what would elevate." Goal = render to wow.
- **Both must agree to lock**: Stop for user review after each meaningful iteration. Present critical self-review, then pause.
- **Track render times**: Call `get_render_status` after every render and report timing (samples, seconds, resolution). Track wall-clock build time too.

## Creative Philosophy

Full guide in `mcp/OCTANE_CREATIVE.md`. Key principles:

- Think like a cinematographer with infinite budget and instant results
- Recipes are direction, not scripts — improve, adapt, deviate
- Assets are NEVER a blocker — OTOY Studio, Poly Haven, web search
- Iterate until genuinely good — honest evaluation, never sugarcoat
- Octane's spectral rendering is the superpower — trust the physics

## OTOY Studio (otoy.studio)

- **Access**: User works for OTOY, logged in via browser. Claude uses Chrome MCP tools.
- **Text-to-Image**: Seedream v4. Download via `find("Download button")` + ref-click.
- **Image-to-3D**: Seed3D. 2 credits. Not yet tested e2e.
- **Full pipeline proven**: Generate → download → `ORBX/assets/` → NT_TEX_IMAGE → material → render.

## MCP BUILD ORDER (Sacred)

For every scene, this is the rendering order. Each step gets a render + honest critique:

1. **Environment** — render the canvas alone. This IS the mood.
2. **Light(s)** — render light in the void. In noir/dark scenes, the light is the scene.
3. **Floor/ground** — appears already lit by the light. First geometry reveal.
4. **Objects** — one at a time, each rendered individually.
   In dark scenes especially, light MUST come before any geometry so the human sees each object emerge already illuminated.

## MCP PRE-FLIGHT

1. **NEVER use `reset_project`** — it triggers "Save changes?" dialog that blocks autonomous work, even with `suppressUI: true`. Use delete-all-nodes instead:
   - `get_scene_tree(max_depth: 1)` → list top-level handles
   - `delete_node(handle)` for each — leaf nodes first (materials, textures), then geo, then infra, RT last
   - `get_scene_tree(max_depth: 1)` → verify count: 0
2. Test render: create RT → `start_render(RT)` → set hero camera → env → connect → `set_camera` → `save_render` → verify
3. `set_camera` is the ONLY way to force re-render after structural changes

## MCP DEMO BUILD RULES

- **ENV visible IMMEDIATELY**: Connect ENV→RT with `evaluate: true` + `set_camera` right after. User must see the sky/mood BEFORE any geometry. Never batch ENV connection with `evaluate: false`.
- **`set_camera` after every structural connection** — it's the only render refresh trigger
- **`save_render` after each object** — proof for human, honest critique
- **Attributes can batch** with `evaluate: false`, but connections must use `evaluate: true`

## API Cache

- **Cache file**: `mcp/data/octane-api-cache.json` — 704 node types, 3362 pins, 45 pin types, 43 compat maps (1.5 MB)
- **Generator**: `node scripts/fetch-cache-interactive.js` — resumable, saves after each type. Use `--meta` for Phase 1 only, `--batch=N` for N types.
- **Fix IDs**: `node scripts/fix-cache-ids.js` — patches nodeTypesByName to use numeric enum IDs from proto.
- **Loader**: `mcp/src/ApiCache.ts` — `ApiCache.load()` returns null if missing (graceful fallback).
- **Wired into**: `index.ts` loads cache → passes to `registerNodeTools` and `registerSceneTools`. `project.ts` clears rootNodeGraph cache on load/reset.
- **What it saves**: `create_node` skips pin enumeration gRPC (~90% fewer calls). `connect_nodes` validates types from cache (0 gRPC). `get_node_info` gets pin names/types from cache (2 fewer calls per pin).
- **Octane Alpha 5 crashes during cache generation**: Use the interactive script, not the big batch one. Octane is fragile with rapid-fire ApiInfo calls.
- **gRPC deadline pattern**: Use `Date.now() + timeoutMs` (number), NOT `new Date()` objects. Match octaneWebR's pattern in `OctaneGrpcClientBase.ts`.

## Cooked Recipes

- `recipes/glass_metal_COOKED.md` — Scene 1 exact MCP call sequence. No interpretation needed.
- **Speed run benchmark**: Scene 1 from reset → final render in ~8 MCP rounds, 19s Octane render (5000 samples @ 1024×512).

## Architecture Quick Ref

- **callApi**: `client.callApi(service, method, handle?, params?)`
- **Proto loader**: `longs: String`, `enums: String`, `keepCase: true`, `defaults: true`
- **AttrType values**: AT_BOOL=1, AT_INT=3, AT_INT2=4, AT_FLOAT=9, AT_FLOAT2=90, AT_FLOAT3=11, AT_STRING=14
- **Transform attrs**: A_TRANSLATION=172, A_ROTATION=137, A_SCALE=139 (all AT_FLOAT3). NOT 140/141!
- **Mesh attrs**: A_FILENAME=34, A_RELOAD=92. Material connects to MESH pin 0, NOT placement.
- **Mesh path**: Files are in `ORBX/assets/` (floor.obj, sphere_hd.obj, etc.), NOT `ORBX/` root.

## Key Files

- `client/src/services/OctaneClient.ts` — main client facade
- `client/src/services/octane/` — service layer
- `vite-plugin-octane-grpc.ts` — dev gRPC proxy + WebSocket + callbacks
- `server/index.ts` — prod Express server

## Coding Patterns

- **User notifications**: `setTemporaryStatus()` from StatusMessageContext (never `alert()`)
- **Service errors**: `this.emitUserError(message)` → EventEmitter → App.tsx → status bar
- **ESLint**: flat config `eslint.config.js`, `no-undef: 'off'` for TS files
- **Node positions**: Octane=center-based, ReactFlow=top-left. Convert at all 5 boundary crossings.

## Viewport Resolution Rule

- **Interactive resolution max 1100px** on both width and height. Larger resolutions clip in the Octane viewport, so the human sees a cropped image while save_render captures the full frame. This causes misalignment during iteration.
- Use 1024x576 (16:9) or 1024x1024 (square) for interactive work.
- Bump to higher resolution (1280x720, 1920x1080) only for final beauty renders saved to disk.

## MCP Crash Prevention (CRITICAL)

- **NEVER change NT_GEO_OBJECT primitive type**: ALL changes crash Octane (Capsule=2, Cone=3, Sphere=20, Torus=22 confirmed). Box(0) only works because it's the default. MCP `set_attribute` now **blocks these calls automatically**. For non-box shapes: `NT_GEO_MESH` + `.obj` files.
- **NEVER use `reset_project`**: Triggers "Save changes?" dialog. Use delete-all-nodes pattern.
- **NEVER batch with `evaluate:false` + `update_scene()`**: Crashes complex scenes. Use `evaluate:true` (default) for incremental eval.
- **ORBX save resets ALL handles**: After `save_project`, re-query scene tree with `get_scene_tree`.
- **ORBX embeds assets with relative paths**: .orbx packages copy textures/meshes inside. On reload, paths become relative (e.g. `assets\file.jpg`) resolving inside the package, NOT from disk. You CANNOT re-point them — `set_attribute(filename)` hangs with DEADLINE_EXCEEDED. **Save .ocs during MCP iteration** (keeps absolute paths). Only .orbx for final delivery. If stuck with .orbx: rebuild fresh (fastest) or unpack via Lua API.
- **ORBX mesh node corruption**: Mesh nodes from ORBX that survived heavy scene surgery (delete siblings, swap filenames) become corrupted. Always create FRESH `NT_GEO_MESH` nodes.
- **If a crash occurs**: Isolate the exact gRPC call, compare data format with octaneWebR's equivalent call, check grpc-debug.log. Don't blame Octane — almost certainly malformed data. Ask user if no solid path forward.
- **Diagnostic: render time tells you if geometry is in the pipeline**: Env-only ~3-4s. With 500K face mesh, 8-11s. If render time stays at env-only level, mesh isn't rendering.

## Lessons Learned (NOT in OCTANE_MCP.md)

- **MCP set_attribute must send `evaluate: false`**: octaneWebR always sends `evaluate: false` in gRPC params, then calls `ApiChangeManager.update()` separately. MCP was missing this, causing potential double-evaluation crashes. Fixed in attribute.ts.
- **MCP crash root cause**: "mcp wip" commit broke 3 things — removed auto-update, flipped evaluate, lost continueRendering. All reverted.
- **Eclipse/backlight impossible without bloom**: Matte sphere + backlight = no visible corona. Needs post-processing.
- **gRPC `enums: String`**: Proto loader returns enum values as STRING names (e.g. `"PT_TEXTURE"`, `"NT_MAT_UNIVERSAL"`), NOT numbers. Never do `Number(enumValue)` — use the string directly.
- **`ApiNode.type` not `ApiItem.type`**: The `type` RPC (returns NodeType enum) is on `ApiNode` service (objectType=17), NOT `ApiItem` (objectType=16). `ApiItem` has `name`, `outType`, `isGraph` only.
- **MCP server runs from source**: `.mcp.json` uses `npx tsx mcp/src/index.ts`. Changes to source take effect on restart. `npm run build` only updates `dist/` (unused by MCP). Always restart MCP server after edits.

## Testing Rules

See `TEST_PLAN.md`. Key: smoke test, detect crashes immediately, visual proof for everything, lint+build before push.
