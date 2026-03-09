# OctaneWebR Project Memory

## Project Overview

React/TypeScript web frontend for Octane renderer, communicating via gRPC through a Vite dev plugin (dev) or Node.js Express server (prod). Located at `c:\otoyla\GRPC\dev\octaneWebR`.

## Current Status (v1.4.6)

- **0 open bugs** — 4 known Octane API limitations
- **MCP server**: 23 tools in `mcp/`. Run: `npm run mcp:start`. Build: `cd mcp && npm run build`
- **Scene gallery**: 16 recipes in `recipes/` (13 scenes + 3 Cornell variants). Scene 1 LOCKED (rebuilt). Rest pending.

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
  - Gold sphere (LEFT): pos(-0.9, 0.3, 0.4), scale(0.6) — Glossy metallic, diffuse (1, 0.84, 0), **IOR 100** for metallic Fresnel
  - Glass sphere (CENTER): pos(0, 0.38, -0.3), scale(0.75) — Specular, IOR 1.5, transmission (0.3, 0.5, 1.0)
  - Red sphere (RIGHT): pos(0.9, 0.3, 0.3), scale(0.6) — Diffuse, color (0.8, 0.05, 0.05)
  - Mesh: `sphere_hd.obj` (radius ≈ 0.5 in object space). Y = scale × 0.5 = sits on floor
  - Floor: `floor.obj`, Glossy — diffuse (0.7, 0.7, 0.7), specular 1.0, roughness 0.02
  - **Glossy metallic = high IOR**: Default IOR 1.5 makes gold look like painted plastic. IOR 100 = proper metallic Fresnel.
- **Be critically honest about renders**: Never sugarcoat. "Flat brown" is not "golden hour sky." Evaluate what you actually see, not what you intended.
- **Recipes are prose creative briefs**: Not rigid. Prose vision + reference values + "what would elevate." Goal = render to wow.
- **Both must agree to lock**: Stop for user review after each meaningful iteration. Present critical self-review, then pause.

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

1. Clear scene (delete-all-nodes method, not reset_project)
2. Test render: create RT → `start_render(RT)` → env → connect → `set_camera` → `save_render` → verify
3. `set_camera` is the ONLY way to force re-render after structural changes

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

## Lessons Learned (NOT in OCTANE_MCP.md)

- **MCP crash root cause**: "mcp wip" commit broke 3 things — removed auto-update, flipped evaluate, lost continueRendering. All reverted.
- **Don't batch deferred changes**: `connect_nodes(evaluate:false)` × N → `update_scene()` crashes complex scenes. Use `evaluate:true` (default).
- **Eclipse/backlight impossible without bloom**: Matte sphere + backlight = no visible corona. Needs post-processing.
- **Render engine corrupts after ~50+ create/delete cycles**: Only fix = restart Octane.

## Testing Rules

See `TEST_PLAN.md`. Key: smoke test, detect crashes immediately, visual proof for everything, lint+build before push.
