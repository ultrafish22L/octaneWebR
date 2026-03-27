# Art Direction System

OctaneWebR's Art Direction (AD) system plans compositions mathematically, sets artistic mood through semantic vectors, places assets collision-free, then iterates with external vision critics until the render matches the intent. It runs automatically during scene builds or can be used piece by piece.

---

## Why Art Direction Exists

When you say "I want moody Caravaggio lighting," a dozen parameters need to change: color temperature, fill ratio, environment power, atmosphere density, and more. Without a system, that intent gets lost the moment it's translated to numbers. Next iteration, nobody remembers _why_ the fill ratio is 6:1 — was it deliberate or accidental?

AD solves this by keeping three concerns separate:

1. **Spatial correctness** — Are objects in frame? Do depth layers separate properly? Any collisions?
2. **Artistic intent** — What mood, style, and atmosphere are we targeting? (Stored as a measurable vector, not just words.)
3. **Visual validation** — Does the actual render match the intent? Where are the gaps?

Each concern has its own subsystem. They share data but don't overlap — spatial math never decides color temperature, and the mood system never moves objects.

---

## The Five Subsystems

### 1. Composition Planning

Before any 3D node exists, the composition planner works out the spatial layout using pure math. Given a list of objects with their sizes and roles (hero, secondary, accent, ground), it computes:

- **Object positions** in 3D space with proper depth layering
- **Camera position and orientation** to frame everything correctly
- **Focal point hierarchy** — where the viewer's eye should go first, second, third

The planner then validates the layout automatically:

| Check                | What It Catches                                                   |
| -------------------- | ----------------------------------------------------------------- |
| **Frustum**          | Objects outside the camera's view                                 |
| **Depth separation** | Layers too close together (< 15% of scene depth)                  |
| **Proximity**        | Objects overlapping or nearly touching (< 0.5 units)              |
| **Grid alignment**   | Focal points missing rule-of-thirds or golden ratio intersections |
| **Lighting angle**   | Key light too close to camera axis (< 15 degrees)                 |
| **Hero coverage**    | Hero too small (< 5%) or too large (> 85%) in frame               |

If you have a reference image — concept art, a photograph, a painting — you can feed it to the reference analyzer. A vision model extracts the composition: object positions, scales, depth layers, and lighting mood. This bootstraps the composition plan from a visual rather than from scratch.

No rendering happens in this phase. The output is a validated spatial blueprint that the build phases execute.

> **Details:** [BUILD.md Phase 0](mcp/BUILD.md#phase-0-composition-planning-before-any-octane-calls) for the step-by-step tool workflow.

---

### 2. Mesh Analysis & Scene Placement

3D meshes from external sources (AI-generated, downloaded, hand-modeled) arrive with unknown orientation, scale, and proportions. Placing them blind wastes entire build iterations.

**The Mugshot Protocol** solves this. Before a mesh enters the scene, the system:

1. Loads the mesh in isolation on a neutral ground plane
2. Renders six views: front, right, and top — each in both clay (untextured) and textured mode
3. Sends the six images to a vision model that checks: Is it upright? Sideways? Upside down?
4. Records the verdict: geometry bounds, recommended rotation correction, natural height estimate, and a semantic description ("a fairy figure standing on a mushroom, facing forward")

Results are cached in a sidecar file next to the mesh. Subsequent loads skip the analysis entirely.

**Scene Placement** maintains an awareness database of every object in the scene — its position, bounding box, and role. When you add a new object, the placement system:

- Suggests a collision-free position based on the object's role and the existing scene layout
- Warns if the suggested position would overlap or penetrate another object
- Updates the database after placement so the next object gets accurate suggestions

This prevents the common problem of objects stacking on top of each other or drifting into overlapping positions during iterative builds.

> **Details:** [BUILD.md Pre-Phase](mcp/BUILD.md#pre-phase-analyze_mesh-before-any-placement) for the mesh analysis workflow.

---

### 3. SEGA — Semantic Artistic Guidance

SEGA is a mixing board with 15 sliders. Each slider represents a perceptual dimension of your scene's look and feel, ranging from -1.0 to +1.0. Together they form a _semantic vector_ that captures artistic intent as numbers, not just words.

```
Natural Language  -->  Semantic Vector  -->  Parameters  -->  Scene Changes
"moody and warm"      { warmth: 0.7,       key_temp: 3200K    (Octane attributes
                        contrast: 0.6 }     fill_ratio: 5:1     get updated)
```

#### The 15 Dimensions

| #   | Dimension          | At -1                  | At +1                   | What Changes                            |
| --- | ------------------ | ---------------------- | ----------------------- | --------------------------------------- |
| 1   | **pleasure**       | Harsh, unpleasant      | Beautiful, pleasing     | Saturation, harmony, surface smoothness |
| 2   | **arousal**        | Calm, serene           | Energized, intense      | Contrast, edge sharpness, saturation    |
| 3   | **dominance**      | Intimate, enclosed     | Vast, powerful          | Camera distance, FOV, environment scale |
| 4   | **warmth**         | Cool blue bias         | Warm amber bias         | Color temperature, environment tint     |
| 5   | **contrast**       | Flat, even lighting    | Hard shadows, drama     | Key-to-fill ratio, environment power    |
| 6   | **complexity**     | Minimal, clean         | Dense, detailed         | Object count, texture detail            |
| 7   | **atmosphere**     | Clear, crisp           | Hazy, foggy             | Fog density, scatter                    |
| 8   | **surface_detail** | Smooth, pristine       | Weathered, textured     | Roughness variation, bump strength      |
| 9   | **saturation**     | Muted, desaturated     | Vivid, punchy           | Albedo saturation, environment color    |
| 10  | **shot_scale**     | Extreme close-up       | Extreme wide            | Camera distance, FOV                    |
| 11  | **camera_angle**   | Low angle (worm's eye) | High angle (bird's eye) | Camera elevation                        |
| 12  | **depth_spread**   | Flat, compressed       | Deep, layered           | Depth layer separation, fog gradient    |
| 13  | **key_direction**  | Front-lit              | Back/rim-lit            | Key light position relative to camera   |
| 14  | **groundedness**   | Floating, abstract     | Grounded, physical      | Contact shadows, floor texture          |
| 15  | **intimacy**       | Distant, observational | Close, personal         | Camera distance, DOF, aperture          |

The dimensions come from established frameworks: PAD emotional model (psychology), Itten color theory, ASC cinematography manual, CineTechBench (film analysis), and Berlyne aesthetics. Most scenes only activate 6-12 dimensions — the rest stay at zero (neutral).

#### Presets

Instead of setting dimensions manually, you can start from one of 25 named presets:

**Mood** (7) — aligned with the lighting system:

| Preset        | Feel                                         |
| ------------- | -------------------------------------------- |
| `dramatic`    | High contrast, hard shadows, intense energy  |
| `ethereal`    | Soft warm backlight, dreamy atmosphere       |
| `natural`     | Balanced daylight, neutral, realistic        |
| `studio`      | Clean 3-point, controlled, professional      |
| `noir`        | Single hard light, deep blacks, mystery      |
| `golden_hour` | Extreme warmth, low sun, long golden shadows |
| `moonlit`     | Cool blue key, warm practicals, very dark    |

**Artist** (6) — named after visual signatures:

| Preset       | Feel                                                          |
| ------------ | ------------------------------------------------------------- |
| `vermeer`    | Warm side-lit intimacy, soft shadows, domestic tranquility    |
| `caravaggio` | Extreme chiaroscuro, single dramatic source, theatrical       |
| `hopper`     | Isolated light pools, melancholic warmth, geometric emptiness |
| `kubrick`    | Symmetrical, cold precision, clinical beauty, wide lenses     |
| `villeneuve` | Vast scale, muted desaturation, atmospheric grandeur          |
| `fincher`    | Dark desaturated palette, clinical precision, uneasy beauty   |

**Film** (5) — inspired by specific visual identities:

| Preset           | Feel                                                       |
| ---------------- | ---------------------------------------------------------- |
| `blade_runner`   | Neon-soaked cyberpunk, high saturation, hazy, dark         |
| `moonlight_film` | Soft intimate lighting, warm-cool duality, emotional       |
| `grand_budapest` | Pastel palette, symmetrical, whimsical, high pleasure      |
| `mad_max`        | Extreme warmth, high contrast, intense energy, desert epic |
| `her_film`       | Warm pastels, soft focus, gentle intimacy, quiet           |

**Genre** (7) — photography and CG production styles:

| Preset                 | Feel                                                     |
| ---------------------- | -------------------------------------------------------- |
| `product_clean`        | White background, even lighting, crisp, no atmosphere    |
| `product_luxury`       | Dark background, dramatic rim light, rich, elegant       |
| `landscape_epic`       | Wide shot, deep layers, atmospheric depth, grandeur      |
| `portrait_editorial`   | Close framing, shallow DOF, side light, editorial beauty |
| `still_life_dutch`     | Dark background, warm side light, rich textures          |
| `architectural_modern` | Clean lines, neutral light, minimal, geometric           |
| `macro_nature`         | Extreme close-up, shallow DOF, rich detail, organic      |

#### Natural Language

You don't have to think in numbers. Say what you want:

| You Say                  | System Interprets                           |
| ------------------------ | ------------------------------------------- |
| "make it dramatic"       | contrast +0.7, arousal +0.5, warmth -0.2    |
| "warmer"                 | warmth +0.2 (relative shift)                |
| "Vermeer lighting"       | Loads the `vermeer` preset                  |
| "too dark, pull it back" | contrast -0.3, arousal -0.2 (relative)      |
| "calm but grand"         | arousal -0.6, dominance +0.7, pleasure +0.4 |

The parser understands absolute ("make it warm"), relative ("warmer"), negation ("less contrast"), and compound ("moody and warm") instructions.

#### Berlyne Warnings

When any dimension exceeds |0.85|, the system warns that extreme values often reduce aesthetic appeal — this comes from Berlyne's inverted-U theory of aesthetic pleasure, which peaks at moderate complexity/intensity. The warning is advisory, never blocking. Sometimes you genuinely want the slider at 0.95.

> **Details:** [SEGA System Design](project/SEGA_SYSTEM_DESIGN.md) for the full technical spec — mapping engine, convergence math, calibration, per-object overrides.

---

### 4. Vision Critique Loop

After rendering, two independent critics evaluate the image:

**Vision Critic** — An external vision model (not self-assessment) scores the render on five dimensions, each 1-5:

| Dimension       | What It Measures                                                     |
| --------------- | -------------------------------------------------------------------- |
| **Framing**     | Is the composition well-framed? Subjects in view, good use of space? |
| **Depth**       | Do layers separate? Is there foreground/midground/background?        |
| **Composition** | Rule of thirds, balance, focal point hierarchy?                      |
| **Lighting**    | Does lighting match the mood? Good key/fill/rim ratios?              |
| **Placement**   | Are objects positioned well? Grounded, not floating?                 |

Framing is weighted 2x and gates everything else — if framing scores below 3, the system returns "FRAMING FAILURE" and sends you back to fix the camera before touching lighting or materials. This prevents the common mistake of polishing a badly framed scene.

**Semantic Critic** — Compares the actual render against the SEGA intent vector. Some dimensions can be measured from pixels (contrast via histogram, warmth via color temperature, saturation via chroma). Others require the vision model (pleasure, complexity, groundedness). The output is a _gap vector_ showing exactly where the render diverges from intent and by how much.

**Convergence:** The critique loop runs iteratively:

1. Render the scene
2. Both critics score it
3. If scores pass (overall >= 3.5, framing >= 3, no dimension below 2) — done
4. If not — fix the weakest dimension, re-render, go to step 2
5. If two consecutive iterations improve by less than 0.3 — stagnation detected, redesign the approach rather than continuing to tweak

The loop prevents one-shot critiques (which miss issues) and endless tweaking (which wastes time).

> **Details:** [BUILD.md Critique Loop](mcp/BUILD.md#critique-loop--dual-perspective-run-after-every-save_render-in-phases-2-4) for the step-by-step workflow.

---

### 5. Creative Knowledge

Two knowledge tools provide ready-made recipes that work with or without the rest of the AD system:

**Lighting Recipes** — Given a mood and the scene's bounding box, the system computes a full 3-point lighting setup: key light position, power, and color temperature; fill light at the correct ratio; rim light behind the subject. Seven moods are available: dramatic, ethereal, natural, studio, noir, golden hour, and moonlit. When SEGA intent is active, the recipes adapt to the semantic vector automatically.

**Material Recipes** — PBR (physically-based rendering) values for 30+ real-world surface types: gold, glass, chrome, wood, fabric, ceramic, leather, marble, moss, mushroom cap, and more. Each recipe provides albedo color, roughness, metallic, specular, and IOR values calibrated for Octane's material system.

These are starting points, not final values. The critique loop may suggest adjustments after seeing the rendered result.

> **Details:** [Creative Guide](mcp/CREATIVE.md) for lighting ratios, color theory, composition rules, and environment types.

---

## Asset Generation Pipeline

OctaneWebR supports an end-to-end pipeline from idea to rendered scene:

```
Idea  -->  Concept Art  -->  3D Mesh  -->  Analysis  -->  Scene  -->  Critique
  |            |                |             |            |            |
  |     AI image gen      AI mesh gen    Mugshot      Import +     Vision +
  |    (OTOY Studio)     (OTOY Studio)  protocol     placement   semantic
  |                                     (6 views,                 scoring
  |                                      cached)
  v
Recipe (objects, positions, mood, lighting)
```

1. **Concept art** — Generate a reference image from a text description using OTOY Studio's AI image generation
2. **Reference analysis** — Feed the concept art to the composition analyzer to extract object positions, scales, and lighting mood into a structured recipe
3. **3D mesh generation** — Generate meshes using OTOY Studio's image-to-3D pipeline, producing GLB files
4. **Format conversion** — Convert GLB to OBJ + textures (trimesh handles this automatically)
5. **Mesh analysis** — Run the mugshot protocol on each mesh to determine orientation, scale, and placement recommendations
6. **Scene build** — Import meshes into Octane, apply materials and lighting from the SEGA intent, place using the collision-free placement system
7. **Critique and iterate** — Run the vision critique loop until the render matches the intent

Each step is optional. You can skip AI generation and import your own meshes. You can skip SEGA and set lighting manually. The pipeline is a complete workflow, but every piece works standalone.

> **Details:** [BUILD.md §8](mcp/BUILD.md#8-3d-asset-pipeline) for the detailed asset pipeline.

---

## How It All Fits Together

A full AD-enabled build flows through four phases:

```
Phase 0 — PLAN                    Phase 1 — FRAME
  Reference image analysis          Build first object
  Composition planning              Start render (first visual)
  Spatial validation                Frame camera
  Set artistic intent (SEGA)        Place remaining objects
  Mesh analysis (mugshots)          Gate: everything in frame?
         |                                  |
         v                                  v
Phase 2 — DRESS                   Phase 3 — CRITIQUE
  Apply materials                   Vision critic scores render
  Build lights (from recipes)       Semantic critic measures gaps
  Set environment                   Fix weakest dimension
  Apply SEGA-driven values          Re-render, re-critique
                                    Loop until pass or exhausted
```

Each phase has a hard gate — you don't move forward until the current phase passes. This prevents polishing materials on a scene that isn't properly framed.

**AD can be disabled.** For quick tests, experiments, or debugging, you can skip all art direction phases and build mechanically from direct values. The lighting and material recipe tools still work without AD — they just use sensible defaults instead of SEGA-driven values.

---

## Further Reading

| Document                                            | What's In It                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| [BUILD.md](mcp/BUILD.md)                            | Step-by-step build workflow — tool calls, phases, verification gates    |
| [SEGA System Design](project/SEGA_SYSTEM_DESIGN.md) | Full SEGA spec — mapping engine, convergence math, per-object overrides |
| [Creative Guide](mcp/CREATIVE.md)                   | Lighting recipes, material values, composition rules, color theory      |
| [Reference](mcp/REFERENCE.md)                       | Pin layouts, node types, attribute IDs, material presets                |
| [MCP User Guide](mcp/README.md)                     | All 78 tools, setup, tips, troubleshooting                              |
