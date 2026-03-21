# The Mycelium Court

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

> **Before building:** Read `CLAUDE.md` (Current Session + MCP Rules) and look up values in `docs/mcp/REFERENCE.md`. Don't improvise what's already documented.

> **Reference shots:** `ref_wide_forest.jpg` (wide establishing shot), `ref_closeup_fairy.jpg` (intimate fairy angle). Study these before every iteration.

## The Vision

A fairy sits in a vast bioluminescent mushroom garden at twilight. Giant teal-blue mushrooms tower overhead like ancient trees — their translucent caps glow softly from within, casting pools of warm cyan light onto the mossy rocks and dark earth below. The viewer is low to the ground, looking up through a forest of mushroom stalks that recede into the misty background. The feeling is awe and wonder — the fairy is tiny in a vast magical world.

**Composition.** Ultra-wide angle (65-75 deg FOV, ~20mm equivalent). Camera at ground level (y=0.1-0.3), slightly off-center, looking up at the mushroom canopy. The hero mushroom dominates the upper-center frame. Secondary mushrooms frame left and right at varying depths. The fairy sits mid-ground among mossy rocks, small but clearly visible. Foreground flowers and small mushroom clusters create depth. Background mushrooms fade into HDRI forest haze.

**Lighting.** The scene is predominantly lit by the mushrooms themselves. The HDRI provides dim ambient fill (forest at dusk, NOT midday) and a visible canopy backdrop — it should never overpower the emissive mushrooms. The key light comes from the hero mushroom's cap glow casting downward. Secondary mushrooms act as practicals at various distances. The overall mood is dark with pools of bioluminescent color — NOT evenly lit, NOT blown out.

**Materials.** Mushroom caps: subsurface-scattering feel via the baked texture driving both albedo and emission. The emission should be subtle (power 0.3-0.5) — enough to cast light but the caps shouldn't look like light bulbs. Stalks should stay in shadow, catching only indirect bounce from the caps above. Rocks: rough, dark, mossy — they ground the scene. The ground plane is dark earth/forest floor with a moss texture, mostly hidden by 3D rocks and flower clusters.

**Scale hierarchy.** The mushrooms must feel ENORMOUS. The fairy (scale ~1.0) is the human-scale reference. Hero mushroom: 3-4x fairy height. Background mushrooms: up to 6x. Small mushroom clusters: 0.5-0.8x fairy height. This scale contrast is what makes the scene feel like a world, not a diorama.

**Anti-patterns.** No glossy floors. No uniform spacing. No symmetry. No mushrooms growing perfectly vertical — slight tilts (2-6 degrees) in varied directions. No uniform scaling — each mushroom should have different width/depth/height ratios. No visible ground plane from the hero camera angle.

---

## Ingredients

_Living values — refined each time the scene is built._

### 3D Assets (OTOY Studio Hunyuan-3d v3.1 Pro)

| Asset               | Reference Prompt                                                                                                     | File                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Giant mushroom      | Giant fantasy mushroom, thick textured stalk, wide glowing teal-blue cap with bioluminescent spots, white background | `giant_mushroom.glb`   |
| Fairy character     | Cute fairy sitting pose, green leaf dress, translucent butterfly wings, long flowing hair, white background          | `fairy.glb`            |
| Mushroom cluster    | Cluster of small fantasy mushrooms growing from a mossy rock, red and orange spotted caps, white background          | `mushroom_cluster.glb` |
| Mossy rocks         | Cluster of mossy forest rocks with small ferns, rounded boulders, green moss, white background                       | `mossy_rocks.glb`      |
| Fern/flower cluster | Small cluster of fantasy forest ferns and bioluminescent purple-blue wildflowers, ground cover, white background     | `ferns_flowers.glb`    |

All GLBs are Z-up — require rotation {90, Y_vary, 0} on placement transform.

### Camera (proven v23)

| Setting  | Value           | Notes                                                               |
| -------- | --------------- | ------------------------------------------------------------------- |
| Position | {0.8, 0.2, 5.5} | Low, slightly right of center                                       |
| Target   | {-0.2, 1.5, -2} | Looking up at mushroom canopy — caps should extend off top of frame |
| Up       | {0, 1, 0}       | ALWAYS — never omit                                                 |
| FOV      | 80              | Ultra-wide, ~18mm equivalent. Makes mushrooms feel massive          |
| Aperture | 0               | DOF disabled for sharp everything                                   |
| Film     | 1280x720 (16:9) | Match concept art aspect ratio                                      |

### Environment (HDRI)

| Setting             | Value                                    | Notes                                                                                       |
| ------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| HDRI file           | `forest_hdri_2k.hdr`                     | Poly Haven "mossy_forest" — CC0. Never use 4k (crashed Octane)                              |
| Power               | 0.7                                      | Dim dusk fill. Forest canopy visible but mushroom emission is the main light source         |
| Projection          | NT_PROJ_SPHERICAL on image texture pin 6 | MUST create standalone spherical node and connect — default UV mapping won't wrap correctly |
| HDRI rotation       | {0, 120, 0} on projection transform      | Rotates warm backlight behind mushrooms for golden hour feel                                |
| Importance sampling | true                                     | Default                                                                                     |

### Hero Mushroom (center)

| Setting          | Value                                                |
| ---------------- | ---------------------------------------------------- |
| Position         | {0, 0, 0}                                            |
| Scale            | {2.5, 3.0, 5.0} (non-uniform, Z=height stretched 2x) |
| Rotation         | {88, 5, 3} (slight tilt)                             |
| Emission power   | 0.4                                                  |
| Emission texture | Same as albedo (baked diffuse texture drives glow)   |

### Big Mushrooms (6+ instances of same mesh)

| #   | Position      | Scale (x,y,z)   | Rotation (x,y,z) | Role                              |
| --- | ------------- | --------------- | ---------------- | --------------------------------- |
| 1   | {-5, 0, -2}   | {3.5, 2.8, 6.0} | {82, 45, 8}      | Tallest, back left, leaning right |
| 2   | {4.5, 0, -4}  | {4.0, 3.5, 7.5} | {85, -30, -6}    | Giant, back right, leaning left   |
| 3   | {-2.5, 0, 2}  | {1.5, 1.8, 2.5} | {94, 120, 4}     | Short stubby, mid left            |
| 4   | {5.5, 0, 2.5} | {2.8, 2.2, 4.8} | {87, -65, 7}     | Tall medium, right side           |
| 5   | {-6, 0, -5}   | {3.2, 3.8, 5.5} | {83, 90, -5}     | Wide cap, far back left           |
| 6   | {2, 0, -7}    | {4.5, 3.5, 8.0} | {88, -15, 3}     | Biggest, deep background          |
| 7   | {3.5, 0, 1}   | {2.2, 2.6, 4.0} | {85, -45, -4}    | Right side balance                |

Key: Z scale IS height (after 90-deg X rotation). Range 2.5-8.0 gives huge variation. X rotation varies 82-94 for organic tilt. Z rotation adds lean. NEVER uniform scale — every axis different.

### Small Mushroom Clusters (8-10 instances, proven v23)

| #   | Position       | Scale (x,y,z)   | Rotation Y | Notes                                |
| --- | -------------- | --------------- | ---------- | ------------------------------------ |
| 1   | {-0.5, 0, 1.5} | {0.8, 0.8, 0.7} | 30         | Near hero base                       |
| 2   | {1.5, 0, 0.5}  | {1.0, 1.0, 0.9} | -50        | Right of hero                        |
| 3   | {-2, 0, -0.5}  | {0.6, 0.6, 0.5} | 110        | Between big mushrooms                |
| 4   | {2.5, 0, -1}   | {0.9, 0.9, 0.8} | -80        | Right mid-ground                     |
| 5   | {-3.5, 0, -1}  | {0.7, 0.7, 0.6} | 160        | Far left                             |
| 6   | {0.5, 0, 3}    | {1.2, 1.2, 1.0} | -20        | Near camera path                     |
| 7   | {3.5, 0, 1}    | {0.5, 0.5, 0.4} | 70         | Small right accent                   |
| 8   | {-1, 0, 3.5}   | {1.0, 1.0, 0.8} | 200        | Left foreground                      |
| 9   | {1, 0, 2.8}    | {0.5, 0.5, 0.4} | 10         | Fairy's gaze — tiny, don't block her |

Emission power: 0.3 (dimmer than big mushrooms). All rotations include x=90 for Z-up fix.

### Mossy Rocks (8 instances, proven v23)

Scattered z=-2 to z=3.5. Scale 0.6-1.5, varied Y rotation. Keep rocks SMALL near camera (0.3-0.6 scale) — giant foreground boulders block the shot.

### Flower/Fern Clusters (8 instances, proven v23)

| #   | Position       | Scale (x,y,z)    | Notes                   |
| --- | -------------- | ---------------- | ----------------------- |
| 1   | {-1.5, 0, 4.5} | {0.7, 0.7, 0.5}  | Left foreground framing |
| 2   | {0.3, 0, 5}    | {0.5, 0.5, 0.4}  | Center foreground       |
| 3   | {2, 0, 4.8}    | {0.5, 0.5, 0.4}  | Right foreground        |
| 4   | {-0.8, 0, 3.5} | {0.4, 0.4, 0.3}  | Near fairy path         |
| 5   | {0.2, 0, 2.3}  | {0.2, 0.2, 0.15} | Tiny near fairy         |
| 6   | {-2.5, 0, 4}   | {0.5, 0.5, 0.4}  | Far left                |
| 7   | {3, 0, 5.2}    | {0.5, 0.5, 0.4}  | Far right               |
| 8   | {1.5, 0, 3.8}  | {0.4, 0.4, 0.3}  | Mid-right               |

Key: flowers near camera should be SMALL (0.4-0.7) — they frame the shot but must not block the fairy or dominate the frame. The concept art shows them as a carpet, not individual objects.

### Ground Plane

| Setting       | Value                                          | Notes                                                                  |
| ------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| Type          | Flat box (default NT_GEO_OBJECT, leave as Box) | NEVER change primitive type — crashes Octane                           |
| Scale         | {30, 0.01, 30}                                 | Paper-thin, covers entire scene                                        |
| Position      | {0, -0.01, 0}                                  | Just below mesh bases at y=0                                           |
| Material      | Dark diffuse                                   | Use `tex_moss_ground.jpg` with box projection                          |
| Texture power | RGB ~{0.08, 0.06, 0.04}                        | Darkened — ground should barely register, mostly hidden by 3D elements |

### Render

| Setting     | Value                                                                             |
| ----------- | --------------------------------------------------------------------------------- |
| Kernel      | Path tracing (NOT direct lighting)                                                |
| Max samples | 5000                                                                              |
| Resolution  | 1280x720 (16:9 to match concept art)                                              |
| Check       | `get_render_status` — renders finish in 30-50s at 720p with this scene complexity |

### Iteration Log

Built over 23 render iterations. Key breakthroughs:

- v3: emission on mushrooms (dark mood lighting)
- v10: flowers added, foreground framing
- v13: 7 big mushrooms + 8 small clusters + 8 rocks
- v17: 16:9 aspect, textured ground, non-uniform mushroom scale
- v18: HDRI rotated for warm backlight, spherical projection
- v23: flowers scaled down, fairy unblocked, final composition
