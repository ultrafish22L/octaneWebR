# Octane Build Guide

How to construct scenes via MCP. For values, see `REFERENCE.md`. For problems, see `TROUBLESHOOTING.md`.

---

## Core Principle: Human View First

**A human is watching.** Get an interesting render on screen as fast as possible. Every MCP call should be driving toward the first visible result. Don't build backstage — build on stage.

**Priority order:** RT → `set_camera` to known good frame → first geometry + material wired to RT → `start_render` → contrasting environment. Set camera BEFORE connecting geometry so the object appears framed instantly. Everything else comes after the human has something to look at.

**Check Octane is running** before every build. If gRPC is down, nothing works and the human sees nothing. Verify with `powershell -Command "Get-NetTCPConnection -LocalPort 51022"`.

---

## Build Modes

**DRESS (Demo):** 1 object at a time, render after each step, hero camera from the start. For presentations. **Default mode** — always use unless told otherwise.

**SPEED (Batch):** Create all nodes → set all attributes → wire all → single render. For testing only.

---

## DRESS Protocol

Every step produces a visible change. The human should see a render update within the first 4-5 MCP calls.

### Phase 1: First Visual (get render on screen ASAP)

| Step | Action                                                                                                                                                               | Result                                                                                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `create_node(NT_RENDERTARGET)`                                                                                                                                       | RT handle + pin handles                                                                                                                |
| 2    | `set_camera(position:{0,1.5,4}, target:{0,0,0})`                                                                                                                     | Camera ready BEFORE geo — known good wide frame, slightly elevated, off-center Z. Adjust target to geo centroid if not at origin.      |
| 3    | Create first mesh (NT_GEO_MESH + .obj) + LOUD material `{1,0,0}` → placement → geo group → RT `pin_index:3`                                                          | **Object exists**. Use NT_GEO_MESH (not NT_GEO_OBJECT — primitive type changes crash). Only `sphere_hd.obj` and `floor.obj` available. |
| 4    | `start_render` + `set_camera` again (triggers geo eval)                                                                                                              | **FIRST VISUAL — human sees something**                                                                                                |
| 5    | Create environment → `connect_nodes(env, RT, pin_id:43)`. **Do not** call `get_node_info` on env children immediately after connecting — wait or sequence carefully. | Sky + lighting appear                                                                                                                  |
| 6    | Disable DOF: RT→pin0→camera→pin14→aperture→`set_attribute(child, 185, 9, 0)`                                                                                         | Sharp render                                                                                                                           |

**Why camera before geometry:** `set_camera` is needed to evaluate geometry anyway. Setting it early means the object appears framed the instant it's wired — no black viewport, no lost object, no "where is it?" moment.

**Why geometry before kernel/env:** A sphere with a red material on default DL kernel is more interesting to watch than an empty sky. The human wants to see objects, not infrastructure.

### Phase 2: Materials & Lighting

| Step | Action                                                    | Notes                              |
| ---- | --------------------------------------------------------- | ---------------------------------- |
| 7    | Swap loud material for real material                      | Gold, glass, etc. — visible change |
| 8    | Create PT kernel → `connect_nodes(kernel, RT, pin_id:89)` | Better render quality              |
| 9    | Tune environment (sunset hour, turbidity, etc.)           | Mood change visible immediately    |
| 10   | Render + save                                             | Checkpoint                         |

### Phase 3: Assembly

For each additional object: create mesh → material → placement → connect to geo group `pin_index: N` → `set_camera` → render → verify.

Each object = a visible change. Never batch multiple objects without rendering between them.

### Phase 4: Polish

Floor, fine-tune lighting, hero camera, final `save_render`.

---

## Setup Order Variants

**Demos (Hero Camera First):** Set final camera BEFORE creating objects. Objects pop into the composed frame.

**Iteration (Wide Camera First):** Start wide (y=2-3, z=5-8), zoom to hero after objects placed.

**Space Scenes (Light First):** No env light → create key light BEFORE geometry or first render is black.

---

## NT_GEO_OBJECT Variant

Primitive shapes — no .obj file needed. Key differences from NT_GEO_MESH:

- **Material pin:** `pin_index: 1` (not 0). Pin 0 is primitive type enum.
- **Transform pin:** Pin 3 (NT_TRANSFORM_VALUE).
- **Auto-wrapping:** Connecting to RT pin 3 auto-creates placement chain. No manual group needed for single objects.
- **Multi-object:** Create NT_GEO_GROUP, connect each geo to group pins (0, 1, 2...), connect group to RT pin_index:3.
- **Primitive type change is UNSAFE** — non-deterministic ECONNRESET crash. Use NT_GEO_MESH with .obj files for non-box geometry. Only `sphere_hd.obj` and `floor.obj` are available in `ORBX/assets/`.
- **Silent death during connect chains** — Octane can die silently during rapid state mutations even when all calls report success. Check Octane is alive before `start_render`.

Primitive values: Box=1, Sphere=20, Torus=22, Cylinder=4, Cone=3 (full list in `REFERENCE.md`).

---

## Camera Workflow

### Pull-Back Rule

Always pull camera WAY back first to see full scene. When lost: Z=50+, verify positions, then zoom in.

### Target Trick

Set `set_camera(target: centroid)`. Camera orbits that point. Derive distance from bounding box extents + FOV — don't guess.

### Single-Mesh Framing (8 steps)

1. Zero all mesh transforms
2. Compute mesh centroid from OBJ bounding box
3. Set camera target to centroid
4. **Set up vector = (0,1,0)** — default (0,0,0) silently breaks orientation
5. Back camera way out — full mesh visible
6. Orbit up slightly (raise Y)
7. Fine-tune target
8. Zoom in (reduce distance)

### 3D Asset Orientation

Generated meshes have unknown orientation. **Never guess — orbit to discover:**

1. Back camera WAY out (8-10 units)
2. Render 3 views: front (0,Y,+Z), right (+X,Y,0), top (0,+Y,+Z small)
3. Determine: which axis is up, facing direction, base location
4. Fix with rotation on the MODEL (`A_ROTATION=137`), never flip camera up

- OTOY Studio GLB exports are Z-up → rotate +90° on X
- Set film aspect BEFORE framing — changing after invalidates composition

### Camera Math (Calibrated v2)

| Parameter           | Value            |
| ------------------- | ---------------- |
| Horizontal half-FOV | ~41° (tan=0.869) |
| Vertical half-FOV   | ~24° (tan=0.445) |

```
D_z = (W/2 * 1.15) / tan(41) = W * 0.662    # distance for W-unit-wide subject with 15% margin
Y = target_Y + D_z * tan(elevation)
```

**Proven tabletop frame:** Position {0, 4.2, 7.5}, target {0, 0, 0}, elevation 29°.

**Rule:** Start at 1.5x computed distance, inch forward. Always verify with render.

---

## Scene Clear (Delete Method)

`reset_project` triggers save dialog. Instead:

1. `get_scene_tree(max_depth: 1)`
2. `delete_node` each handle — leaves first, RT last
3. Verify: `get_scene_tree` → count: 0

---

## 3D Asset Pipeline (OTOY Studio → Octane)

**Generate:** `generate_image_pro` → reference image → OTOY Studio image-to-3D (Chrome UI) → GLB

**Convert:** Python trimesh: `trimesh.load(glb)` → `export('name.obj')` → OBJ + MTL + diffuse PNG

**Load in Octane:**

1. `NT_GEO_MESH` + `A_FILENAME=34` + `A_RELOAD=124`
2. `NT_GEO_PLACEMENT` → connect mesh via `pin_name: "geometry"`
3. `NT_MAT_UNIVERSAL` + `NT_TEX_IMAGE` (diffuse PNG) → mesh `pin_index: 0`
4. Placement → geo group → RT

**Orient:** Set film aspect first → orbit 3 views → fix rotation → scale 2-3x → frame hero shot.

### OTOY Studio MCP Tools

| Category   | Tools                                                                    | Notes               |
| ---------- | ------------------------------------------------------------------------ | ------------------- |
| Image gen  | `generate_image`, `generate_image_pro`, `generate_image_nano`            | Text-to-image       |
| Image edit | `edit_image`, `edit_image_nano`                                          | Needs image_url     |
| Upscale    | `upscale_image`, `upscale_video`                                         | 1-4x                |
| Video gen  | `generate_video_veo3`, `generate_video_kling`, `generate_video_seedance` | Text-to-video       |
| Animate    | `image_to_video_kling`                                                   | Animate still image |
| Music      | `generate_music`                                                         | Lyrics + reference  |
| Utility    | `check_job`, `list_jobs`, `forget_job`, `request_upload_url`             | Job mgmt            |

**3D mesh generation** (Rodin/Hunyuan) requires Chrome MCP — no API exists.

### Texture Prompt Templates

**Diffuse:** `[material] surface, seamless tileable texture, flat orthographic top-down material scan, evenly lit diffuse studio lighting, no shadows no highlights no reflections, PBR albedo map, photorealistic, square 1:1`

**Environment:** `360 degree equirectangular panorama, [scene], high dynamic range, seamless horizon, photorealistic, landscape 16:9`

**Seed3D reference:** `[object] isolated on pure black background, clean silhouette, soft studio lighting, single centered object, high detail, square 1:1`

**Warning:** AI "panoramas" are NOT equirectangular — use as backdrops, not spherical env maps. Use real HDRIs from Poly Haven.
