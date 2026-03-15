# Octane Quick-Reference Values

**This file is a living cheat sheet. Update it every time you discover or refine a value.**

## Daylight Environment — Sunset

**IMPORTANT:** Setting A_VALUE on sundir handle directly does NOT work (T17 confirmed). Must use hour child.

| Property | Handle path | Value | Notes |
|----------|-------------|-------|-------|
| **Hour** | env → pin 0 (sundir) → pin 4 (hour) → child | `16.5` | 4:30 PM = warm golden hour (17.5 was too cool/blue) |
| Turbidity | env → pin 1 (turbidity) → child | `6.0` | Heavy haze = warm scattering. 4.0 still too blue. Default 2.4 too clean |
| Latitude | sundir → pin 0 (latitude) → child | `40.0` | Mid-latitude for natural sun angle |
| North offset | env → pin 4 (northOffset) → child | `45.0` | Rotates sun direction for raking side light |
| Power | env → pin 2 | `1.0` | Default is fine |
| Sun intensity | env → pin 3 | `1.0` | Default is fine |

Sundir node (NT_SUN_DIRECTION) children: latitude(0), longitude(1), month(2), day(3), **hour(4)**, gmtoffset(5)

## Daylight Environment — Noon (bright, flat)

| Property | Handle path | Value | Notes |
|----------|-------------|-------|-------|
| Hour | sundir → pin 4 (hour) → child | `12.0` | Noon, high sun |
| Turbidity | env → pin 1 → child | `2.4` | Default, clean sky |

## Materials — Presets

### Glass (specular transmission)
| Property | Pin | Handle path | Value |
|----------|-----|-------------|-------|
| Transmission type | pin 1 (transmissionType) | enum child | `1` (specular) |
| IOR | pin 15 (index) | float child | `1.5` (glass) |
| Albedo | pin 2 | RGB child | `{0.85, 0.95, 1.0}` light blue tint |

### Gold Metal
| Property | Pin | Handle path | Value |
|----------|-----|-------------|-------|
| Metallic | pin 4 | float child | `1.0` |
| Roughness | pin 8 | float child | `0.15` |
| Albedo | pin 2 | RGB child | `{1.0, 0.78, 0.34}` warm gold |

### Chrome
| Property | Pin | Handle path | Value |
|----------|-----|-------------|-------|
| Metallic | pin 4 | float child | `1.0` |
| Roughness | pin 8 | float child | `0.02` |
| Albedo | pin 2 | RGB child | `{0.9, 0.9, 0.9}` near-white |

### Loud Red (debugging/test)
| Property | Pin | Value |
|----------|-----|-------|
| Albedo | pin 2 | `{1.0, 0.1, 0.05}` saturated red |

## Camera

| Scenario | Position | Target | Notes |
|----------|----------|--------|-------|
| Hero 3-object | `{1.25, 1.5, 8}` | `{1.25, 0, 0}` | 3 objects spread on X axis |
| Single object | `{0, 0.5, 4}` | `{0, 0, 0}` | Centered, slightly above |
| Pull-back debug | `{0, 5, 20}` | `{0, 0, 0}` | Way back, see everything |

**Framing technique:** Set `target` to scene centroid (center of bounding box of all objects). Then compute camera `position` distance based on bounding box extents — pull back far enough to fit the full extent in frame, accounting for FOV/focal length. Don't guess zoom; derive it from bounds.

**DOF off:** camera → pin 14 (aperture) → child handle → `set_attribute(handle, 185, AT_FLOAT=9, 0)`

## Transforms (on Placement or NT_TRANSFORM_VALUE)

| Attribute | ID | Type | Notes |
|-----------|----|------|-------|
| A_TRANSLATION | 172 | AT_FLOAT3 (11) | World units |
| A_ROTATION | 137 | AT_FLOAT3 (11) | DEGREES not radians |
| A_SCALE | 139 | AT_FLOAT3 (11) | Uniform = {1,1,1} |

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

| Method | Refreshes geometry? | Notes |
|--------|-------------------|-------|
| **`set_camera`** | **YES** | The ONLY way to force geometry re-evaluation. Even same position works. |
| `start_render` | NO | Only starts sampling. New objects won't appear. |
| `restart_render` | **NEVER USE** | Crashes Octane (ECONNRESET). |
| `set_attribute` | Partial | Triggers re-render of existing objects but doesn't add new geometry to tree. |

**After connections:** call `update_scene()` then `set_camera` — both required. Connections need an extra trigger beyond just update_scene.

**After connecting new geometry to RT:** always call `set_camera` to make it visible.

## Pin Connection Gotchas

| Target | What works | What silently fails |
|--------|-----------|-------------------|
| RT geometry | `pin_index: 3` | `pin_id: 59` |
| Mesh material | `pin_index: 0` | `pin_id: 30` |
| **Geo group inputs** | **`pin_index: N` (0-based)** | **`pin_name: "Input N"`** |
| RT kernel | `pin_id: 89` | — |
| RT environment | `pin_id: 43` | — |

## Primitive Types (NT_GEO_OBJECT enum pin 0)

Types 1-17, 19-23 all work. **Type 18 (Quad) crashes Octane — NEVER use it.** Workarounds: use a very flat Box (scale Y near zero), or `NT_GEO_MESH` + `quad.obj`.

## Procedural Textures

**Node types available:** NT_TEX_MARBLE (47), NT_TEX_TURBULENCE (22), NT_TEX_NOISE (87), NT_TEX_CHECKS (45), NT_TEX_GRADIENT (49), NT_TEX_FALLOFF (50), NT_TEX_MIX (38), NT_TEX_MULTIPLY (39), NT_TEX_ADD (106), NT_TEX_SUBTRACT (108), NT_TEX_RGB (33), NT_TEX_FLOAT (31)

### NT_TEX_MIX (Mix texture) — the workhorse
| Pin | Name | Type | Notes |
|-----|------|------|-------|
| 0 | amount | PT_TEXTURE | Blend mask (connect noise/marble here) |
| 1 | texture1 | PT_TEXTURE | Color A |
| 2 | texture2 | PT_TEXTURE | Color B |

### NT_TEX_MARBLE (Marble texture)
| Pin | Name | Type | Notes |
|-----|------|------|-------|
| 0 | power | PT_TEXTURE | |
| 1 | offset | PT_TEXTURE | |
| 2 | octaves | PT_INT | More = finer detail |
| 3 | omega | PT_TEXTURE | |
| 4 | variance | PT_TEXTURE | |
| 5 | transform | PT_TRANSFORM | Stretch for wood grain |

### NT_TEX_TURBULENCE (Turbulence texture) — organic noise, NOT banded
| Pin | Name | Type | Notes |
|-----|------|------|-------|
| 0 | power | PT_TEXTURE | Brightness/intensity |
| 1 | offset | PT_TEXTURE | 3D offset |
| 2 | octaves | PT_INT | Detail scale (6-12) |
| 3 | omega | PT_TEXTURE | Fractal detail (0.35-0.65) |
| 4 | transform | PT_TRANSFORM | **Stretch for grain direction** |
| 5 | projection | PT_PROJECTION | |
| 6 | turbulence | PT_BOOL | Toggle turbulent noise |
| 7 | invert | PT_BOOL | |
| 8 | gamma | PT_FLOAT | Luminance control (1.0-2.0) |

### NT_TEX_RGB — set color via `set_attribute(handle, A_VALUE=185, AT_FLOAT3=11, {r,g,b})`

### Procedural Hardwood Recipe (PROVEN v3 — coating + anisotropy + roughness-by-grain)

**CRITICAL: Use TURBULENCE for color, MARBLE for bump only.**
Marble creates sine bands = plywood. Turbulence stretched on one axis = organic hardwood grain.

**Base setup:**
1. Two NT_TEX_RGB: species-accurate light + dark colors (see table below)
2. **NT_TEX_TURBULENCE** → NT_TEX_MIX amount (pin 0) — NOT marble!
3. Light → MIX texture1 (pin 1), Dark → MIX texture2 (pin 2)
4. MIX → Universal Mat albedo (pin 2)
5. NT_TEX_MARBLE → Universal Mat bump (pin 36, via pin_name "bump") — surface relief only
6. Stretch turbulence transform: Z scale very small (0.01-0.05), X/Y larger (2-10)

**Pro features (Universal Material):**
7. **Coating** (pin 19): white or partial gray for lacquer. Coating roughness (pin 20): 0.01-0.04. Coating IOR (pin 21): 1.5 (polyurethane)
8. **GGX BRDF** (pin 7 enum): value `2` = GGX. Required for anisotropy.
9. **Anisotropy** (pin 9 float): 0.1 (ebony) to 0.5 (zebrawood). Stretches reflections along grain.
10. **Roughness-by-grain**: NT_TEX_MIX with turbulence as amount, two grayscale floats as min/max roughness → connect to roughness pin 8. Dark grain = rougher, light = smoother.

**Pore structure determines polish level (TA research):**
| Pore Type | Species | Max Polish | Coating Rough | Base Roughness | Bump |
|-----------|---------|------------|---------------|----------------|------|
| Ring-porous (open) | Red Oak | Satin | 0.03 | 0.25-0.45 (grain-driven) | 0.06-0.10 |
| Ring-porous (tyloses) | White Oak | Semi-gloss | 0.03 | 0.20-0.38 (grain-driven) | 0.04-0.07 |
| Diffuse-porous (fine) | Purpleheart | High gloss | 0.02 | 0.12 | 0.015 |
| Diffuse-porous (ultra) | Ebony | Mirror | 0.03 | 0.25 | 0.005 |
| Diffuse-porous (small) | Maple | Very smooth | 0.02 | 0.10 | 0.01-0.05 |
| Semi-ring-porous | Walnut | Moderate-good | 0.03 | 0.15-0.32 (grain-driven) | 0.03-0.06 |
| Diffuse-porous (HUGE) | Zebrawood | Satin | 0.04 | 0.20-0.45 (grain-driven) | 0.07-0.08 |

**Species parameter table (v5 FINAL — validated via scene dump comparison):**

**Turbulence (color grain):**
| Species | Light RGB | Dark RGB | Turb Scale X,Y,Z | Gamma | Omega | Octaves | Aniso |
|---------|-----------|----------|-------------------|-------|-------|---------|-------|
| Red Oak | {0.48, 0.30, 0.20} | {0.30, 0.17, 0.10} | {7, 9, 0.08} | 1.2 | 0.6 | 10 | 0.4 |
| White Oak | {0.42, 0.33, 0.22} | {0.28, 0.20, 0.13} | {5, 7, 0.07} | 1.5 | 0.55 | 10 | 0.35 |
| Purpleheart | {0.20, 0.06, 0.22} | {0.08, 0.015, 0.09} | {5, 5, 0.015} | 1.5 | 0.45 | 8 | 0.3 |
| Ebony | {0.02, 0.018, 0.018} | {0.015, 0.012, 0.012} | {3, 3, 0.01} | 20.0 | 0.5 | 12 | 0.1 |
| Maple | {0.75, 0.65, 0.50} | {0.40, 0.28, 0.15} | {5, 7, 0.06} | 0.8 | 0.5 | 10 | 0.2 |
| Walnut | {0.22, 0.14, 0.08} | {0.10, 0.06, 0.035} | {6, 8, 0.07} | 1.0 | 0.6 | 10 | 0.35 |
| Zebrawood | {0.55, 0.38, 0.12} | {0.05, 0.025, 0.005} | {8, 12, 0.1} | 0.6 | 0.35 | 6 | 0.5 |

**Coating (warm-tinted — NOT neutral gray!):**
| Species | Coating RGB | Coat Rough | Bump Height |
|---------|------------|------------|-------------|
| Red Oak | {0.45, 0.3, 0.3} | 0.005 | 0.04 |
| White Oak | {0.45, 0.3, 0.3} | 0.005 | 0.03 |
| Purpleheart | {0.4, 0.25, 0.25} | 0.003 | 0.008 |
| Ebony | {0.25, 0.15, 0.15} | 0.003 | 0.003 |
| Maple | {0.4, 0.25, 0.25} | 0.003 | 0.02 |
| Walnut | {0.45, 0.3, 0.3} | 0.005 | 0.025 |
| Zebrawood | {0.45, 0.3, 0.3} | 0.008 | 0.03 |

**Marble (bump only — HIGH Z-scale for grain direction):**
| Species | Marble Scale X,Y,Z |
|---------|-------------------|
| Red Oak | {3, 3, 30} |
| White Oak | {2, 2, 35} |
| Purpleheart | {1.5, 1.5, 40} |
| Ebony | {1, 1, 45} |
| Maple | {1.5, 1.5, 35} |
| Walnut | {2.5, 2.5, 30} |
| Zebrawood | {4, 4, 20} |

**⚠ CRITICAL LESSONS (from v5 vs v6 scene dump comparison):**
- **Marble Z-scale must be 20-45** (not 0.015-0.04!) — this is the sine band frequency along grain. Low Z = no visible grain bump.
- **Coating colors must be WARM-TINTED** `{0.45, 0.3, 0.3}` not neutral `{0.3, 0.3, 0.3}`. Warm tint gives lacquer realism.
- **Coating roughness 0.003-0.008** (not 0.02-0.04). Lower = shinier = more realistic lacquer finish.
- **Purpleheart colors are DEEP** — {0.2, 0.06, 0.22} not {0.45, 0.18, 0.5}. Much darker and more saturated.
- **Zebrawood colors need contrast** — light {0.55, 0.38, 0.12} dark {0.05, 0.025, 0.005}. Very dark stripes.
- **Turbulence X/Y must be ASYMMETRIC** — e.g., {7,9} not {8,8}. Breaks up perfectly straight grain lines.

**Roughness-by-grain (v5 had, v6 rebuild missing):**
| Species | Rough Min (light grain) | Rough Max (dark grain) |
|---------|------------------------|----------------------|
| Red Oak | 0.25 | 0.45 |
| White Oak | 0.20 | 0.38 |
| Purpleheart | 0.08 | 0.15 |
| Maple | 0.06 | 0.14 |
| Walnut | 0.15 | 0.32 |
| Zebrawood | 0.20 | 0.45 |
Wire: Mix(same turbulence as albedo → amount, min_rough_grayscale → tex1, max_rough_grayscale → tex2) → mat roughness pin 8.

**Falloff × Marble bump (v5 had, v6 rebuild missing):**
Shared Falloff map (normal=0, grazing=1, index=3) × Marble via Multiply texture → mat bump pin. Gives bump=0 on top faces (flat), bump=1 on side/end faces (grain texture).

**Ebony special:** Gamma 20 crushes grain nearly flat. Coating {0.25, 0.15, 0.15} (warm tint). Base roughness 0.25. Under dark studio env, ebony reads jet black. Under bright/neutral env, coating reflection can make it look gray — use darker env or lower coating.

**Turbulence offsets:** Each species needs dramatically different offsets (50+ apart per axis) to prevent identical noise patterns. E.g., {0,0,0}, {50,30,10}, {100,70,25}, {150,120,40}, {200,160,55}, {250,200,70}, {300,250,85}.

**Pine plank (base surface):** coating RGB(0,0,0) = none, coatRough 0.6, base roughness 0.5 (matte unfinished), bumpH 0.3. Uses marble for BOTH color mix and bump (not turbulence). Colors: {0.68, 0.56, 0.4} / {0.58, 0.46, 0.32}.

### OLD: Procedural Oak Wood Recipe (marble-based — creates plywood look)
1. Two NT_TEX_RGB: light `{0.76, 0.6, 0.42}`, dark `{0.45, 0.28, 0.14}`
2. NT_TEX_MARBLE → NT_TEX_MIX amount (pin 0)
3. Light → MIX texture1 (pin 1), Dark → MIX texture2 (pin 2)
4. MIX → Universal Mat albedo (pin 2)
5. Stretch marble transform on one axis for grain direction
6. **WARNING: This creates plywood bands. Use turbulence recipe above instead.**

## Lighting — Product Photography Setup

**Key + fill + env recipe for wood/material demos:**
- **Key light:** NT_EMIS_BLACKBODY, 4000K warm, power 60-100, positioned above/behind scene
- **Fill light:** NT_EMIS_BLACKBODY, 5500K neutral, power 20-30, opposite side. Set `camera_visibility: false` on object layer (NOTE: MCP can't reliably set this bool — disconnect fill geo if it shows in frame)
- **Environment:** Use neutral gray RGB (0.28-0.32) as env texture for calibration. Low env power (0.4-0.6) so area light dominates. High env power washes out coating reflections.

**Ebony/dark material trick:** Dark environment + bright key light. Dark env means coating reflects dark = material reads as black. Bright neutral env makes dark glossy surfaces look gray (physically correct but not desired).

**Calibration workflow:** Switch env between neutral gray (for tuning materials) and workshop IBL (for final beauty). Neutral reveals true material response; IBL adds production mood.

**Known MCP limitation:** `camera_visibility` bool on Object Layer does not stick when set via MCP (reverts to true). `transparentEmission` on blackbody also doesn't hide geo from camera. Workaround: disconnect from geo group or position behind camera.

## .obj Assets (absolute path prefix: `C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/`)

sphere.obj, sphere_hd.obj, sphere_uv.obj, cube.obj, torus.obj, teapot.obj, diamond.obj, ring.obj, monolith.obj, prism.obj, pillar.obj, floor.obj, quad.obj
