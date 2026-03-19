# Octane Quick-Reference Values

**This file is a living cheat sheet. Update it every time you discover or refine a value.**

## Daylight Environment — Sunset

**IMPORTANT:** Setting A_VALUE on sundir handle directly does NOT work (T17 confirmed). Must use hour child.

| Property      | Handle path                                 | Value  | Notes                                                                   |
| ------------- | ------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| **Hour**      | env → pin 0 (sundir) → pin 4 (hour) → child | `16.5` | 4:30 PM = warm golden hour (17.5 was too cool/blue)                     |
| Turbidity     | env → pin 1 (turbidity) → child             | `6.0`  | Heavy haze = warm scattering. 4.0 still too blue. Default 2.4 too clean |
| Latitude      | sundir → pin 0 (latitude) → child           | `40.0` | Mid-latitude for natural sun angle                                      |
| North offset  | env → pin 4 (northOffset) → child           | `45.0` | Rotates sun direction for raking side light                             |
| Power         | env → pin 2                                 | `1.0`  | Default is fine                                                         |
| Sun intensity | env → pin 3                                 | `1.0`  | Default is fine                                                         |

Sundir node (NT_SUN_DIRECTION) children: latitude(0), longitude(1), month(2), day(3), **hour(4)**, gmtoffset(5)

## Daylight Environment — Noon (bright, flat)

| Property  | Handle path                   | Value  | Notes              |
| --------- | ----------------------------- | ------ | ------------------ |
| Hour      | sundir → pin 4 (hour) → child | `12.0` | Noon, high sun     |
| Turbidity | env → pin 1 → child           | `2.4`  | Default, clean sky |

## Materials — Presets

### Glass (specular transmission)

| Property          | Pin                      | Handle path | Value                               |
| ----------------- | ------------------------ | ----------- | ----------------------------------- |
| Transmission type | pin 1 (transmissionType) | enum child  | `1` (specular)                      |
| IOR               | pin 15 (index)           | float child | `1.5` (glass)                       |
| Albedo            | pin 2                    | RGB child   | `{0.85, 0.95, 1.0}` light blue tint |

### Gold Metal

| Property  | Pin   | Handle path | Value                         |
| --------- | ----- | ----------- | ----------------------------- |
| Metallic  | pin 4 | float child | `1.0`                         |
| Roughness | pin 8 | float child | `0.15`                        |
| Albedo    | pin 2 | RGB child   | `{1.0, 0.78, 0.34}` warm gold |

### Chrome

| Property  | Pin   | Handle path | Value                        |
| --------- | ----- | ----------- | ---------------------------- |
| Metallic  | pin 4 | float child | `1.0`                        |
| Roughness | pin 8 | float child | `0.02`                       |
| Albedo    | pin 2 | RGB child   | `{0.9, 0.9, 0.9}` near-white |

### Loud Red (debugging/test)

| Property | Pin   | Value                            |
| -------- | ----- | -------------------------------- |
| Albedo   | pin 2 | `{1.0, 0.1, 0.05}` saturated red |

## Camera

| Scenario        | Position         | Target         | Notes                      |
| --------------- | ---------------- | -------------- | -------------------------- |
| Hero 3-object   | `{1.25, 1.5, 8}` | `{1.25, 0, 0}` | 3 objects spread on X axis |
| Single object   | `{0, 0.5, 4}`    | `{0, 0, 0}`    | Centered, slightly above   |
| Pull-back debug | `{0, 5, 20}`     | `{0, 0, 0}`    | Way back, see everything   |

**Framing technique:** Set `target` to scene centroid (center of bounding box of all objects). Then compute camera `position` distance based on bounding box extents — pull back far enough to fit the full extent in frame, accounting for FOV/focal length. Don't guess zoom; derive it from bounds.

**DOF off:** camera → pin 14 (aperture) → child handle → `set_attribute(handle, 185, AT_FLOAT=9, 0)`

## Transforms (on Placement or NT_TRANSFORM_VALUE)

| Attribute     | ID  | Type           | Notes               |
| ------------- | --- | -------------- | ------------------- |
| A_TRANSLATION | 172 | AT_FLOAT3 (11) | World units         |
| A_ROTATION    | 137 | AT_FLOAT3 (11) | DEGREES not radians |
| A_SCALE       | 139 | AT_FLOAT3 (11) | Uniform = {1,1,1}   |

## Render Pipeline — From Scratch

**This is the minimum sequence to get a render from an empty scene:**

1. `create_node(NT_RENDERTARGET)` — handle is your RT
2. `create_node(NT_GEO_OBJECT)` — your geometry (defaults to Box)
3. `connect_nodes(geo → RT, pin_index: 3)` — pin 3 = "mesh" (PT_GEOMETRY)
4. `start_render(render_target_handle: RT)` — sets RT on render API
5. `update_scene()` — flush connections
6. `set_camera(position, target)` — triggers geometry evaluation
7. Wait 3-5s for samples
8. `save_render(path)` — grab the image

**The user sees the render live in Octane's viewport after steps 4-6.** Don't wait until save_render — they're watching.

**Common mistakes:**

- Calling `save_render` before `start_render` → saves empty/black image
- Forgetting to connect geo to RT pin 3 → render runs but nothing visible
- Forgetting `start_render(render_target_handle)` → render never starts (RSTATE_STOPPED)
- Calling `reset_project` without `save_project` first → Octane pops "Save?" dialog, blocks gRPC

**RT pin layout (NT_RENDERTARGET):**
| Pin | Name | Type | Notes |
|-----|------|------|-------|
| 0 | camera | PT_CAMERA | Auto-created (Thin lens) |
| 1 | environment | PT_ENVIRONMENT | Auto-created (Texture env) |
| 2 | cameraEnvironment | PT_ENVIRONMENT | Optional |
| 3 | **mesh** | **PT_GEOMETRY** | **Connect geo here** |
| 6 | kernel | PT_KERNEL | Auto-created (Direct lighting) |

## Render Refresh

**CRITICAL (T3 confirmed):** `start_render` does NOT refresh the geometry tree. It only starts/continues sampling on the already-evaluated tree.

| Method               | Refreshes geometry? | Notes                                                                        |
| -------------------- | ------------------- | ---------------------------------------------------------------------------- |
| **`set_camera`**     | **YES**             | The ONLY way to force geometry re-evaluation. Even same position works.      |
| `start_render`       | NO                  | Only starts sampling. New objects won't appear.                              |
| ~~`restart_render`~~ | **REMOVED**         | Removed from MCP — crashed Octane (ECONNRESET).                              |
| `set_attribute`      | Partial             | Triggers re-render of existing objects but doesn't add new geometry to tree. |

**After connections:** call `update_scene()` then `set_camera` — both required. Connections need an extra trigger beyond just update_scene.

**After connecting new geometry to RT:** always call `set_camera` to make it visible.

## Pin Connection Gotchas

| Target                | What works                                                                                                         | What silently fails                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| RT geometry           | `pin_index: 3`                                                                                                     | `pin_id: 59`                                                 |
| Mesh material         | `pin_index: 0`                                                                                                     | `pin_id: 30`                                                 |
| **Geo group inputs**  | **`pin_index: N` (0-based)**                                                                                       | **`pin_name: "Input N"`**                                    |
| RT kernel             | `pin_id: 89`                                                                                                       | —                                                            |
| RT environment        | `pin_id: 43`                                                                                                       | —                                                            |
| **Env medium pin**    | **Create standalone `NT_ENV_TEXTURE`, connect medium FIRST, then connect env to RT**                               | `pin_index: 4` on auto-created env (pin not materialized)    |
| **Env mediumRadius**  | **Set to 1000+ (default is 1!)** — medium only extends this many units from origin. At default 1, nothing visible. | —                                                            |
| **Geo group (fresh)** | **Set `A_PIN_COUNT=113` to 4+ BEFORE connecting children** — fresh groups have 0 pins                              | `connect_nodes` to pin 0 reports success but nothing happens |

## Primitive Types (NT_GEO_OBJECT enum pin 0)

Types 1-17, 19-23 all work. **Type 18 (Quad) crashes Octane — NEVER use it.** Workarounds: use a very flat Box (scale Y near zero), or `NT_GEO_MESH` + `quad.obj`.

## Procedural Textures

**Node types available:** NT_TEX_MARBLE (47), NT_TEX_TURBULENCE (22), NT_TEX_NOISE (87), NT_TEX_CHECKS (45), NT_TEX_GRADIENT (49), NT_TEX_FALLOFF (50), NT_TEX_MIX (38), NT_TEX_MULTIPLY (39), NT_TEX_ADD (106), NT_TEX_SUBTRACT (108), NT_TEX_RGB (33), NT_TEX_FLOAT (31)

### NT_TEX_MIX (Mix texture) — the workhorse

| Pin | Name     | Type       | Notes                                  |
| --- | -------- | ---------- | -------------------------------------- |
| 0   | amount   | PT_TEXTURE | Blend mask (connect noise/marble here) |
| 1   | texture1 | PT_TEXTURE | Color A                                |
| 2   | texture2 | PT_TEXTURE | Color B                                |

### NT_TEX_MARBLE (Marble texture)

| Pin | Name      | Type         | Notes                  |
| --- | --------- | ------------ | ---------------------- |
| 0   | power     | PT_TEXTURE   |                        |
| 1   | offset    | PT_TEXTURE   |                        |
| 2   | octaves   | PT_INT       | More = finer detail    |
| 3   | omega     | PT_TEXTURE   |                        |
| 4   | variance  | PT_TEXTURE   |                        |
| 5   | transform | PT_TRANSFORM | Stretch for wood grain |

### NT_TEX_TURBULENCE (Turbulence texture) — organic noise, NOT banded

| Pin | Name       | Type          | Notes                           |
| --- | ---------- | ------------- | ------------------------------- |
| 0   | power      | PT_TEXTURE    | Brightness/intensity            |
| 1   | offset     | PT_TEXTURE    | 3D offset                       |
| 2   | octaves    | PT_INT        | Detail scale (6-12)             |
| 3   | omega      | PT_TEXTURE    | Fractal detail (0.35-0.65)      |
| 4   | transform  | PT_TRANSFORM  | **Stretch for grain direction** |
| 5   | projection | PT_PROJECTION |                                 |
| 6   | turbulence | PT_BOOL       | Toggle turbulent noise          |
| 7   | invert     | PT_BOOL       |                                 |
| 8   | gamma      | PT_FLOAT      | Luminance control (1.0-2.0)     |

### NT_TEX_RGB — set color via `set_attribute(handle, A_VALUE=185, AT_FLOAT3=11, {r,g,b})`

### Procedural Hardwood Recipe

**Moved to `docs/recipes/HARDWOOD_RECIPE.md`** — full species tables, coating values, turbulence params, critical lessons. Too large for a cheatsheet.

## Lighting — Product Photography Setup

**Key + fill + env recipe for wood/material demos:**

- **Key light:** NT_EMIS_BLACKBODY, 4000K warm, power 60-100, positioned above/behind scene
- **Fill light:** NT_EMIS_BLACKBODY, 5500K neutral, power 20-30, opposite side. Set `camera_visibility: false` on object layer (NOTE: MCP can't reliably set this bool — disconnect fill geo if it shows in frame)
- **Environment:** Use neutral gray RGB (0.28-0.32) as env texture for calibration. Low env power (0.4-0.6) so area light dominates. High env power washes out coating reflections.

## Lighting — Cinematic Two-Light Setup (sphere lights)

**Sphere light pipeline:** NT_EMIS_BLACKBODY → connect to NT_MAT_DIFFUSE via `pin_id: 41` (P_EMISSION) → connect diffuse to NT_LIGHT_SPHERE `pin_index: 1` (material1)

**CRITICAL: Sphere light transform uses A_TRANSLATION=172, NOT A_VALUE=185!**
The transform child on NT_LIGHT_SPHERE is an NT_TRANSFORM_VALUE node. Set position with:
`set_attribute(transform_handle, A_TRANSLATION=172, AT_FLOAT3=11, {x, y, z})`
Using A_VALUE=185 silently fails — the value appears to set but reads back as {0,0,0}.

**Emission defaults that kill output:**

- `efficiency` (pin 0) defaults to 0.025 — set to 1.0 or lights will be 40x dimmer than expected
- `surfaceBrightness` (pin 2) normalizes by area — disable for small spheres (set to false)

**Power ranges (with efficiency=1.0, surfaceBrightness=false):**
| Scenario | Key power | Fill power | Notes |
|----------|-----------|------------|-------|
| Product/close-up | 200-400 | 100-200 | Lights 3-5 units from subject |
| Room/enclosed | 4000-8000 | 2000-4000 | Lights far from surfaces |

**Temperatures:** Warm key 2800-3500K, cool fill 7000-9000K. Or neutral key 4500K + cool fill 8500K.

**Ebony/dark material trick:** Dark environment + bright key light. Dark env means coating reflects dark = material reads as black. Bright neutral env makes dark glossy surfaces look gray (physically correct but not desired).

**Calibration workflow:** Switch env between neutral gray (for tuning materials) and workshop IBL (for final beauty). Neutral reveals true material response; IBL adds production mood.

**Known MCP limitation:** `camera_visibility` bool on Object Layer does not stick when set via MCP (reverts to true). `transparentEmission` on blackbody also doesn't hide geo from camera. Workaround: disconnect from geo group or position behind camera.

## Underwater Volumetric Medium — Purple Ocean

**Working recipe (Phase 5d confirmed):**

| Property         | Handle/Node         | Value               | Notes                                                               |
| ---------------- | ------------------- | ------------------- | ------------------------------------------------------------------- |
| Medium type      | NT_MED_SCATTERING   | —                   | Must use path tracing kernel                                        |
| Scale            | pin 0 child         | `0.007`             | 0.002 = invisible, 0.015 = opaque                                   |
| Absorption       | pin 8 (RGB)         | `{0.3, 0.3, 0.3}`   | Neutral! Don't rely on absorption for color                         |
| invertAbsorption | pin 9               | `true` (default)    | With invert=true, values→transmittance. {low_G}→green. Unintuitive! |
| Scattering       | pin 10 (RGB)        | `{0.3, 0.05, 0.4}`  | Purple scatter (R+B heavy, low G)                                   |
| Env color        | env pin 0 (RGB)     | `{0.45, 0.05, 0.5}` | Saturated purple                                                    |
| Env power        | env pin 1           | `35`                | Balances with sphere lights                                         |
| mediumRadius     | env pin 5           | `5000`              | Default 1 = nothing visible!                                        |
| Kernel           | NT_KERN_PATHTRACING | —                   | Required for volumetric                                             |

**Key insight:** Medium absorption color is counterintuitive with `invertAbsorption`. Keep absorption NEUTRAL ({0.3,0.3,0.3}) and use scattering color + env color for the purple look. The purple comes from: (1) purple env emitting purple light, (2) purple scattering coefficients tinting the fog.

**Sphere light power in medium (efficiency=1.0, surfaceBrightness=false):**
| Role | Power | Temp | Notes |
|------|-------|------|-------|
| Overhead key | 10-20 | 2800-5500K | Warm for underwater contrast |
| Fill | 6-8 | 8000-9000K | Cool blue, opposite side |
| Accent (red) | 8-20 | 1800K | Catraken bioluminescence |
| Accent (amber) | 3-8 | 2800K | Nautilus running lights |

**⚠ transparentEmission does NOT reliably hide sphere lights from camera.** Workaround: use tiny radius (0.05) but then power drops (area scales). Best: position lights behind subjects or behind camera.

## .obj Assets (absolute path prefix: `C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/`)

**Primitives:** sphere.obj, sphere_hd.obj, sphere_uv.obj, cube.obj, torus.obj, teapot.obj, diamond.obj, ring.obj, monolith.obj, prism.obj, pillar.obj, floor.obj, quad.obj
**Hero meshes:** nautilus.obj (40MB), cat_captain_hindu.obj (40MB), catraken.obj (39MB)
**Textures:** nautilus_diffuse.png, cat_captain_hindu_diffuse.png, catraken_diffuse.png (all 4096×4096)
