# Octane Build Guide

How to construct scenes via MCP. Read before starting any build.

For pin layouts and values, see `REFERENCE.md`.
For rules and crash prevention, see the MCP Rules section in `CLAUDE.md`.
For troubleshooting, see `TROUBLESHOOTING.md`.
For lighting, materials, and composition, see `CREATIVE.md`.

---

## Pre-Build Checklist

Before creating any nodes:

1. **Read the recipe** (if building from one) -- never rely on memory or context summaries.
2. **Read CLAUDE.md rules** -- refresh crash prevention, connection rules, refresh rules.
3. **Read the cheatsheet** -- `REFERENCE.md` for exact pin layouts and values.
4. **Plan the frame FIRST** -- know camera position, object positions, and depth formation BEFORE creating any nodes. If you cannot state the camera position, you do not have a plan. Framing is 70% of the result.
5. **Know your build mode** -- DRESS or SPEED (see below).
6. **Verify Octane is running** -- `get_octane_version` should return a valid response.

---

## Build Modes

### DRESS (Demo Mode)

For boss demos and presentations. Maximum visual impact per second.

- Build 1 object at a time
- Render after each step
- Every step produces a visible change
- Pause between phases for effect
- Hero camera from the start (viewer sees objects pop into the final composed frame)

### SPEED (Batch Mode)

For testing and iteration. Minimize overhead.

- Create ALL nodes quickly (no renders between)
- Set ALL attributes (always evaluated immediately — no batching option via MCP)
- Wire ALL connections (always evaluated immediately)
- `start_render` → `set_camera` → `save_render`
- Single render at end

---

## DRESS Protocol (19 Steps, 4 Phases)

Every step produces a visible change. Every step tests something specific. Never skip verification.

### Phase 1: Foundation (viewport goes from black to sky)

**Step 1. Create RT** -- `create_node(NT_RENDERTARGET)`

- _Verify:_ `get_node_info(RT)` returns valid handle. Pins 0-6 exist.
- _Visual:_ Nothing yet -- viewport is black or unchanged.
- _Tests:_ Node creation, RT structure.

**Step 2. Create PT kernel, connect to RT** -- `create_node(NT_KERN_PATHTRACING)` then `connect_nodes(kernel, RT, pin_id:89)`

- _Verify:_ `get_node_info(RT)` -- pin 6 (kernel) has `connected_handle != 0`.
- _Visual:_ Still nothing -- no render started yet.
- _Tests:_ pin_id connection, kernel swap from default DL.

**Step 3. Create environment, connect to RT** -- Daylight or texture env then `connect_nodes(env, RT, pin_id:43)`

- For daylight: set sun direction low (sunset angle) so horizon is visible and sky has color gradient, not flat white.
- For texture env: load HDR/JPG with absolute path, `A_RELOAD`.
- _Verify:_ `get_node_info(RT)` -- pin 1 (environment) has `connected_handle != 0`.
- _Visual:_ Still no render -- but environment is wired.
- _Tests:_ Environment connection, texture loading if applicable.

**Step 4. `start_render`** -- viewport goes LIVE

- _Verify:_ `get_render_status()` returns active. Screenshot shows sky/environment -- NOT black.
- _Visual:_ **First big moment** -- viewport floods with color. Sunset sky, horizon line, ground plane from env. The audience sees something for the first time.
- _Tests:_ Render pipeline, environment rendering, camera defaults.

**Step 5. Disable DOF immediately** -- RT pin 0 then camera then pin 14 then aperture child then `set_attribute(handle, 185, AT_FLOAT=9, 0)`

- _Verify:_ `get_node_info` on aperture child confirms value is 0.
- _Visual:_ Sky should sharpen slightly (default aperture 0.893 causes mild blur).
- _Tests:_ Nested pin traversal, float attribute write.

### Phase 2: First Object (sky gets an occupant)

**Step 6. Create first mesh** -- `create_node(NT_GEO_MESH)` then load .obj with absolute path + `A_RELOAD`

- Pick something with clear silhouette: teapot, torus, diamond. NOT cube (hard to distinguish from artifacts).
- _Verify:_ Node exists, filename attribute set.
- _Visual:_ Nothing yet -- mesh is floating unconnected.
- _Tests:_ Mesh creation, file loading.

**Step 7. Create a LOUD material** -- `create_node(NT_MAT_DIFFUSE)` then set diffuse color to saturated red `[1, 0, 0]` or bright orange.

- _Verify:_ Material node exists with correct color value.
- _Visual:_ Nothing -- material not connected.
- _Why loud:_ A subtle material (grey, glass, specular) makes it impossible to tell "is the object there but transparent, or did connection fail?" Saturated color removes all ambiguity.

**Step 8. Wire material to mesh** -- `connect_nodes(material, mesh, pin_index:0)`

- _Verify:_ `get_node_info(mesh)` -- pin 0 has material handle.
- _Visual:_ Still nothing -- mesh not in RT yet.
- _Tests:_ Material-to-mesh connection (pin_index:0 -- pin_id:30 silently fails!).

**Step 9. Create placement, wire mesh to placement** -- `create_node(NT_GEO_PLACEMENT)` then `connect_nodes(mesh, placement, pin_name:"geometry")`

- _Verify:_ Placement has mesh connected.
- _Visual:_ Still nothing.

**Step 10. Create geo group, wire placement to group, wire group to RT, `set_camera`** -- `create_node(NT_GEO_GROUP)` then `connect_nodes(placement, group, pin_index:0)` then `connect_nodes(group, RT, pin_index:3)` then `set_camera` to refresh geometry tree.

- CRITICAL: `start_render` does NOT refresh the geometry tree. `set_camera` is the ONLY way to force geometry re-evaluation after connecting new objects to RT.
- _Verify:_ `get_node_info(RT)` -- pin 3 (geometry) has `connected_handle != 0`. pin_id:59 SILENTLY FAILS, only pin_index:3 works.
- _Visual:_ **Second big moment** -- bright red/orange object appears against sunset sky. Clear, unmistakable.
- _Tests:_ RT geometry connection, `set_camera` refresh, full geo chain.

**Step 11. Frame camera on object** -- `set_camera` with target at object position, pull camera back to frame it.

- _Verify:_ Screenshot shows object centered, well-framed, right-side up.
- _Visual:_ Object snaps to center of viewport, fills frame nicely.
- _Tests:_ Camera positioning, target trick, up vector (must stay 0,1,0).

### Phase 3: Incremental Assembly (scene populates object by object)

**Step 12. Swap to real material** -- replace loud red with intended material (glossy, metallic, etc.)

- _Verify:_ Screenshot shows material change -- reflections, roughness, color shift.
- _Visual:_ Object transforms from flat matte red to realistic surface. **Satisfying moment** -- same shape, completely different feel.

**Step 13. Add second geo** -- new mesh then material then placement then connect to geo group `pin_index: 1`

- Use contrasting shape (if first was organic/round, use angular; if small, use large).
- Give it a visually distinct material -- different color or different material type.
- _Verify:_ Screenshot shows two objects. Both visible, both have correct materials.
- _Visual:_ Scene gains depth and composition.

**Step 14. Transform second geo** -- `set_attribute` for A_TRANSLATION, A_ROTATION, A_SCALE on its placement.

- Move it to a deliberate position relative to first object. Rotate it interestingly. Scale if needed.
- _Verify:_ Screenshot shows object in new position/orientation.
- _Visual:_ Composition starts to feel intentional, not random.

**Step 15. Repeat steps 13-14** for remaining objects, one at a time.

- Each addition should be verified with a screenshot.
- Re-frame camera as composition grows.

### Phase 4: Refinement (polish pass)

**Step 16. Add floor/ground** -- `floor.obj` mesh with appropriate material, placed at y=0.

- _Verify:_ Objects now sit ON something instead of floating in void.
- _Visual:_ Scene instantly looks grounded and real. Shadows appear on floor.

**Step 17. Adjust lighting** -- tweak environment intensity, sun direction, or add emissive mesh for accent light.

- _Verify:_ Screenshot shows lighting change -- shadows shift, mood changes.
- _Visual:_ Scene goes from "lit" to "dramatically lit."

**Step 18. Hero camera position** -- final framing with considered composition.

- _Verify:_ Screenshot shows final composition.
- _Visual:_ The "money shot." Everything comes together.

**Step 19. Save render** -- `save_render("renders/scene_name.png")`

- _Verify:_ File exists on disk at expected path.
- _Visual:_ Final image captured.

---

## Setup Order Variants

### Demos (Hero Camera First)

The viewer sees objects pop into the final composed frame -- much more cinematic than building in overview and jump-cutting. Know the camera position BEFORE you create the first node.

1. Clear scene (delete method)
2. `create_node(NT_RENDERTARGET)` -- RT handle + pin handles from response
3. `start_render(RT)` + `set_camera(HERO_POSITION, HERO_TARGET)` -- the FINAL camera, not a placeholder
4. `create_node(NT_ENV_DAYLIGHT)` -- connect to RT `pin_id: 43` -- `set_camera` to refresh
5. Film: `get_node_info(film_settings_handle)` -- pin 0 -- "Image resolution" child -- `set_attribute(child, 185, AT_INT2=4, {1024,576})`
6. `create_node(NT_KERN_PATHTRACING)` -- connect to RT `pin_id: 89` -- `set_camera` to refresh
7. Connect geo to RT `pin_index: 3` (geo group OR direct geo objects -- NOT pin_id:59!)
8. VERIFY: `get_node_info(RT)` -- confirm pin 1 (env), pin 3 (geo), pin 6 (kernel) all have `connected_handle != 0`. If any is 0, the connection silently failed -- fix before proceeding.

### Iteration (Wide Camera First)

Same as demos but start camera wide/back/above. Iterate on framing after objects are in.

### Space Scenes (Light First, No Ambient)

Space scenes have no environment light (texture env at low power provides stars but minimal illumination). Create at least one light source and connect it to the geo group BEFORE adding geometry. Otherwise the first render will be pure black and you will not know if geo is correctly placed.

1. RT -- hero camera -- geo group (connect to RT)
2. **Key light** -- set position/power/size -- connect to geo group -- start render
3. First geo object -- connect to geo group -- quick render (now visible!)
4. Remaining objects one at a time
5. Environment (starfield) last -- it is backdrop, not illumination

---

## NT_GEO_OBJECT Variant

NT_GEO_OBJECT (geometric primitive) can be used instead of NT_GEO_MESH + .obj files.

**Key differences from NT_GEO_MESH:**

- **Auto-wrapping:** When connected to RT pin 3, auto-creates NT_OUT_GEOMETRY, NT_GEO_PLACEMENT, NT_OBJECTLAYER_MAP chain. No manual placement/group needed for single objects.
- **Material pin:** Use `pin_index: 1` (not 0 like NT_GEO_MESH). Pin 0 is the primitive type enum.
- **Transform pin:** Pin 3 on the geo object (NT_TRANSFORM_VALUE).
- **Multi-object:** For multiple NT_GEO_OBJECT nodes, create NT_GEO_GROUP, connect each geo to group pins (0, 1, 2...), connect group to RT pin_index:3.
- **Default is Box.** No set_attribute needed for a box.

**Primitive type change:** Setting primitive types 1-17, 19-23 is safe -- works while connected to RT/group, no disconnect needed. After setting type + connecting to RT, call `set_camera` to refresh the geometry tree.

Primitive values: Box=1, Capsule=2, Cone=3, Cylinder=4, Sphere=20, Torus=22 (see `REFERENCE.md` for full list).

---

## Camera Workflow

### Pull-Back Rule

**Always pull camera WAY back first** to see the full scene, place/orient objects, THEN zoom in. Never guess framing up close.

When lost, confused about placement, or starting a new build phase:

1. Pull camera far back (e.g., Z=50 or more)
2. Place and orient objects while viewing from this wide shot
3. Verify positions and rotations make sense
4. THEN zoom back in toward the hero framing

### Target Trick

Set `set_camera(target: {x, y, z})` to the centroid or center of interest. The camera then orbits around that point naturally.

1. **Set target to scene centroid** -- center of bounding box of all objects
2. **Compute zoom from bounds** -- derive camera distance from bounding box extents + FOV/focal length. Do not guess pull-back distance.
3. **Pull back from target** -- move camera position far away, keeping target fixed
4. **Orbit by moving position** -- raise Y for elevated angle, shift X/Z for side views
5. **Zoom = change distance from target** -- predictable, no guessing

### Single-Mesh Framing Workflow (8 Steps)

1. Set all mesh transforms to zero -- rotation (0,0,0), translation (0,0,0)
2. Compute mesh centroid -- parse OBJ vertices, bounding box, centroid = (min+max)/2
3. Set camera target to centroid -- stable orbit pivot
4. **CRITICAL: Verify up vector = (0,1,0)** -- camera pin 22 defaults to (0,0,0) which SILENTLY BREAKS orientation (random roll, no error). Always set explicitly or use `set_camera` (resets up to 0,1,0).
5. Back camera way up -- full mesh visible
6. Orbit up slightly -- raise Y for natural elevated angle
7. Fine-tune target for best framing
8. Zoom in -- reduce distance until mesh fills frame

### 3D Asset Orientation

Generated 3D meshes have unknown orientation until you check. **Never guess — orbit to discover.**

**Discovery protocol (MANDATORY for any new mesh):**

1. Load mesh, connect to scene, scale to roughly visible size
2. Back camera WAY out (8-10 units) to see the whole thing
3. Render 3 orbit views:
   - **Front**: camera at (0, Y, +Z) — what does the mesh face?
   - **Right**: camera at (+X, Y, 0) — is it lying down or standing?
   - **Top**: camera at (0, +Y, +Z small) — where is the base plate?
4. From the 3 views, determine: which axis is up, which way it faces, where the base is
5. THEN apply rotation to fix orientation

**Common orientation issues:**

- **OTOY Studio GLB exports are Z-up** — Octane is Y-up. Fix: rotate placement +90° on X (`A_ROTATION=137, {90,0,0}`)
- **Front face varies** — rotate on Y until 3/4 hero angle faces camera. Test: 0°, 45°, 90°, 135°, 180°
- **Base plate creates a large flat face** — if you see a dark wall, you're looking at the base plate edge-on
- **Scale is unpredictable** — OTOY Studio meshes are typically ~0.5-1 unit tall. Scale 2-3x for Octane scenes

**Never flip the camera up vector** to compensate for model orientation — always rotate the MODEL (A_ROTATION=137).

**Film aspect matters:** Portrait (720x1280) for standing figures, landscape for wide scenes. Set film resolution BEFORE framing — changing aspect after framing invalidates your composition.

---

## Camera Math

CM learns from live renders. These are calibrated values -- do not re-derive what is already proven.

### Calibrated FOV Values (v2)

| Parameter           | Calibrated (v2) |
| ------------------- | --------------- |
| Horizontal half-FOV | ~41 degrees     |
| Vertical half-FOV   | ~24 degrees     |
| Horizontal FOV      | ~82 degrees     |
| Vertical FOV        | ~48 degrees     |

### Formulas (v2 calibrated)

```
visible_half_width_at_Z  = Z * tan(41) = Z * 0.869
visible_half_height_at_Z = Z * tan(24) = Z * 0.445
```

**Distance from scene width (conservative):**

```
D_z = (half_visible_width_needed) / tan(41)
D_z = (6.5) / 0.869 = 7.5  (for 13-unit visible width)
```

**Position from elevation + distance:**

```
Y = target_Y + D_z * tan(elevation)
Z = D_z
X = 0  (center for symmetric subjects)
```

**Quick reference -- subject W units wide, all objects visible with 15% margin:**

```
D_z = (W/2 * 1.15) / tan(41) = W * 0.662
```

### Proven Frames

**Tabletop Product Shot** (7 objects on plank):

- Scene: Plank X=[-6,6] Z=[-3,3]. 7 items spread across surface.
- Proven frame: Position {0, 4.2, 7.5}, target {0, 0, 0}, elevation 29 degrees.
- 29 degrees elevation is the sweet spot for tabletop shots -- shows surface AND edge.
- 55 degrees is too overhead -- spreadsheet look.
- Center the camera (X=0) for symmetric subjects -- ANY X offset causes asymmetric clipping at tight frames.
- Plank bleeding off left/right is GOOD -- feels like a real surface, not a floating tile.
- Target at origin works better than target at object height -- more natural perspective.

### Key Camera Math Rule

**Start far, inch forward.** When computed FOV does not match observations, check aspect ratio and camera offset before recalibrating. When in doubt, start at 1.5x the computed distance and inch forward. Theory has failed repeatedly -- always verify with a render.

---

## Scene Management

### Scene Clear (Delete Method)

`reset_project` triggers a "Save changes?" dialog in Octane, blocking autonomous work. Instead, delete all nodes:

1. `get_scene_tree(max_depth: 1)` -- list of top-level node handles
2. `delete_node(handle)` for each -- leaf nodes first (emissions, textures, materials), then geo, then infra (group, env, kernel), then RT last
3. Verify: `get_scene_tree` -- `count: 0`
4. Build new scene from scratch

Order matters -- delete leaves before parents to minimize risk of the "destroy connected node" crash pattern.

### Recipe Format

Recipes are creative briefs, not build scripts. Each has two sections:

- **Vision** -- prose creative direction. Composition, mood, lighting intent, material character. What the scene should feel like.
- **Ingredients** -- living values (camera, env, materials, positions). Refined each time the scene is built. Tables of numbers, no API calls or pin indices.

Implementation details (node types, pin indices, build order, crash prevention) belong in `REFERENCE.md` and `REFERENCE.md` -- never in recipes.

### OTOY Studio Tool Capabilities

OTOY Studio (https://otoy.studio/) has two access methods with different capabilities.
The user is already authenticated in Chrome -- no login step needed.

**`mcp__otoy-studio__*` MCP API (16 tools) -- 2D media only:**

| Category         | Tools                                                                                   | Notes                    |
| ---------------- | --------------------------------------------------------------------------------------- | ------------------------ |
| Image gen        | `generate_image` (flux/schnell), `generate_image_pro` (flux/pro), `generate_image_nano` | Text-to-image            |
| Image edit       | `edit_image` (flux kontext), `edit_image_nano` (multi-ref)                              | Needs image_url          |
| Upscale          | `upscale_image`, `upscale_video` (seedvr)                                               | 1-4x                     |
| Video gen        | `generate_video_veo3`, `generate_video_kling`, `generate_video_seedance`                | Text-to-video            |
| Video from image | `image_to_video_kling`                                                                  | Animate a still          |
| Music            | `generate_music`                                                                        | Lyrics + reference audio |
| LLM              | `chat_completion`                                                                       | Gemini Flash             |
| Utility          | `check_job`, `list_jobs`, `forget_job`, `request_upload_url`                            | Job mgmt + upload        |

**Chrome MCP only (`mcp__Claude_in_Chrome__*`) -- 3D geometry + browser UI:**

- **3D mesh generation** (Hunyuan-3d v3.1 etc.) -- NO MCP API exists
- Image-to-3D at `https://otoy.studio/image-to-3d`
- Gallery browsing, credit balance, model selection
- Downloading assets (intercept download URLs via JS to avoid OS file dialogs)

**Key rule: never click upload/download buttons** -- they pop OS file dialogs that block automation.
Use the "USE URL" toggle and `request_upload_url` instead. See `feedback_ots_pipeline.md` in memory
for the full Chrome 3D workflow (navigate → USE URL → upload → generate → download GLB → convert OBJ).

### 3D Asset Pipeline (OTOY Studio to Octane)

**Phase 1 — Generate & Download:**

1. **Generate reference image** — `generate_image_pro` (MCP API) for front-facing, isolated-on-black view
2. **Image-to-3D** — Chrome UI at `otoy.studio/image-to-3d`: toggle "USE URL", paste MCP image URL, add prompt, click Create (56 credits, ~3-5 min)
3. **Download GLB** — click Download in Generation Details panel. File saves to `~/Downloads/`

**Phase 2 — Convert:**

4. **GLB → OBJ** — Python trimesh: `trimesh.load(glb)` → concatenate geometry → `export('name.obj')`. Extracts OBJ + MTL + diffuse PNG automatically
5. **Copy to project** — `assets/<name>/` folder (OBJ + textures together, MTL references are relative)

**Phase 3 — Load in Octane:**

6. **Create mesh** — `NT_GEO_MESH`, set `A_FILENAME=34` to OBJ path
7. **Create placement** — `NT_GEO_PLACEMENT`, connect mesh via `pin_name: "geometry"`
8. **Create material** — `NT_MAT_UNIVERSAL` + `NT_TEX_IMAGE` with diffuse PNG → connect to mesh `pin_index: 0`
9. **Connect to scene** — placement → geo group (next available `pin_index`)

**Phase 4 — Orient & Frame (CRITICAL — do this BEFORE final composition):**

10. **Set film aspect FIRST** — portrait (720x1280) for standing figures. Changing aspect later invalidates framing
11. **Discover orientation** — orbit 3 views (front/right/top), see "3D Asset Orientation" above
12. **Fix rotation** — typically +90° X for Z-up→Y-up, then rotate Y for facing direction
13. **Scale to scene** — OTOY meshes are ~0.5-1 unit. Scale 2-3x to match Octane scene units
14. **Frame hero shot** — start far, zoom in. Portrait + low angle = dramatic for standing figures

**File loading pattern** (meshes AND textures):

```
set_attribute(handle, A_FILENAME=34, AT_STRING=14, "C:\\otoyla\\...\\assets\\file.obj")
set_attribute(handle, A_RELOAD=124, AT_BOOL=1, true)   # force reload after path change
```

---

## Build Principles

1. **One object at a time -- verify each.** Every piece of geometry must be visually verified after connecting to the scene. No batching multiple geo objects into a single render check. Exception: setup infrastructure (RT, env, kernel, geo group) can batch.

2. **Loud material first, swap to real later.** Start with saturated primary colors so you can confirm geometry exists. Swap to final materials only after confirming the shape is there. A subtle material (grey, glass, specular) makes it impossible to tell "is the object there but transparent, or did connection fail?"

3. **Materials from geo 1.** Every geometry object gets a material from the moment it is created -- even in test scenes. Default grey is never acceptable. Use color variants at minimum, or apply distinct material types where relevant. 22 grey boxes = useless; 22 colored shapes = instant visual ID.

4. **Geo before lighting.** Place geometry BEFORE setting lighting. Geometry (all objects placed and positioned with materials) first, then lighting (environment, emitters).

5. **Every render gets evaluated.** Screenshot after every structural change. If the screenshot does not show the expected change, STOP and debug before proceeding.

6. **Biggest visual delta first.** The audience should never stare at a black viewport for more than one step. Get sky up fast (step 4), get an object in fast (step 10).

7. **Never trust `success:true`.** The RT geometry pin (pin_id:59) and mesh material pin (pin_id:30) both report success while silently failing. Always verify connections with `get_node_info` and confirm `connected_handle != 0`.

8. **Build order is test order.** Each step implicitly tests the previous step's output. If step 10 fails (no object visible), the bug could be in steps 6-10 -- but because you verified each intermediate step, you know exactly where it broke.

9. **Trust the recipe.** When building from a recipe, all values are pre-calculated. Do not re-engineer lighting or fiddle with values during build. Iterate AFTER the full scene is assembled.

---

## AA/CM Team Workflow

AA (Artistic Agent) and CM (Camera Math) work as a team during scene builds.

### How They Work Together

1. **AA reviews every render** -- flags clipping, bad framing, ugly lighting, wrong materials.
2. **CM computes camera positions** using calibrated FOV values from the Camera Math section above.
3. **Start far, inch forward** -- pure math framing has failed repeatedly. Always verify with a render.
4. **AA gives CM HARD requirements** -- "ALL objects visible, zero clipping, 10% margin" not "pull back a bit."
5. **Cache what works** -- proven camera positions and FOV calibrations go in BUILD.md.
6. **AA directs lighting and materials** -- sunset environment should be set early, not after all geo is placed. Grey boxes on white background = immediate AA fail.

### AA Quick Checklist (Every Render)

- All objects fully visible? (no clipping)
- Lighting creates mood? (not flat/grey)
- Materials readable? (not default grey)
- Background interesting? (not white void)
- Composition balanced? (not skewed/asymmetric)

### Demo Restarts

Before every demo restart, list all current lessons learned. This scrolls the chat and refreshes context.
