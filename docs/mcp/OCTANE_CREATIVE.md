# Octane Creative Guide

How to make scenes look _good_, not just work. Companion to `OCTANE_MCP.md` (technical/API reference).

## What You're Working With

**OctaneRender** — spectrally correct GPU path tracer. Full spectral dispersion, caustics, and blackbody emission are physically accurate by default. The viewport IS the final render. Trust the physics — set real-world IOR, dispersion, emission temperature and let the spectral renderer do its thing.

**Your toolkit:** 28 MCP tools, OTOY Studio (Seedream v4.5 text-to-image, Seed3D image-to-3D), Poly Haven (free HDRIs/textures/models), and the full Octane node graph.

---

## 1. OTOY Studio Asset Pipeline

### Texture Prompt Templates (Copy-Paste Ready)

**Diffuse/Albedo**

```
[material] surface, seamless tileable texture, flat orthographic top-down material scan,
evenly lit diffuse studio lighting, no shadows no highlights no reflections,
PBR albedo map, photorealistic, square 1:1
```

**Bump/Height Map**

```
bump height map for [material] surface, grayscale only, white is raised black is recessed,
seamless tileable, flat orthographic top-down scan, evenly lit, no color, square 1:1
```

**Roughness Map**

```
roughness map for [material] surface, grayscale only, white is smooth polished
black is rough matte, seamless tileable, flat orthographic scan, square 1:1
```

**Environment / HDRI**

```
360 degree equirectangular panorama, [scene description], high dynamic range,
seamless horizon, photorealistic, landscape 16:9
```

**Starfield**

```
360 degree equirectangular deep space panorama, thousands of tiny stars,
colorful nebula clouds, milky way galaxy band, high dynamic range,
seamless horizon, landscape 16:9
```

**Seed3D Reference Image**

```
[object description] isolated on pure black background, clean silhouette,
soft studio lighting, single centered object, high detail, square 1:1
```

### Asset Workflow

1. Generate on otoy.studio → Download (lands in `C:/Users/johnc/Downloads/`)
2. Copy to `ORBX/assets/` with descriptive name
3. `create_node(NT_TEX_IMAGE)` → `set_attribute(A_FILENAME=34, path)` → connect to material
4. Use absolute forward-slash paths: `C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/texture.jpg`

### Other Asset Sources

| Source                              | What                       | Cost        |
| ----------------------------------- | -------------------------- | ----------- |
| [Poly Haven](https://polyhaven.com) | HDRIs, textures, 3D models | Free (CC0)  |
| [ambientCG](https://ambientcg.com)  | PBR textures               | Free (CC0)  |
| [Sketchfab](https://sketchfab.com)  | 3D models                  | Free + paid |

### AI Image Warnings

- **AI "panoramas" are NOT equirectangular** — don't use as spherical env maps. Use as backdrop planes or material textures instead.
- **Baked lighting in textures** — always request "no shadows, no highlights, no reflections"
- **Perspective angle** — always request "flat orthographic top-down" for textures
- For proper 360° environments, use real HDRIs from Poly Haven.

---

## 2. Lighting

### Three-Light Setup (Quad Lights)

| Light    | Role              | Position               | Power          | Temperature               |
| -------- | ----------------- | ---------------------- | -------------- | ------------------------- |
| **Key**  | Main illumination | 45° from camera, above | 100-500        | 4500-5500K (neutral-warm) |
| **Fill** | Soften shadows    | Opposite side, lower   | 30-50% of key  | 6500-8000K (cool)         |
| **Rim**  | Edge separation   | Behind subject         | 50-100% of key | Match key or warmer       |

### Lighting Ratios (Key Concept)

The key:fill ratio is the **single most important factor controlling mood**.

| Key:Fill | Mood                | Use Case                         |
| -------- | ------------------- | -------------------------------- |
| **2:1**  | Natural, even       | Outdoor daylight, casual scenes  |
| **4:1**  | Dramatic, cinematic | Most scenes, studio portraits    |
| **8:1+** | Noir, mystery       | Single-light setups, deep shadow |

**Shadow softness** = light SIZE × DISTANCE. Larger light + farther from receiver = softer shadows.

**Focal control**: The viewer's eye goes to the **brightest, highest-contrast area first**. Light your focal point brightest.

### Mood Lighting Quick Ref

| Mood         | Environment                     | Light                              | Temperature |
| ------------ | ------------------------------- | ---------------------------------- | ----------- |
| **Noir**     | Near-black `(0.02, 0.02, 0.03)` | Single warm overhead, 500-2000     | 3000-3500K  |
| **Studio**   | Medium grey `(0.3, 0.3, 0.35)`  | 2-3 quad lights, 50-200 each       | 5500K       |
| **Dramatic** | Dark `(0.01, 0.01, 0.02)`       | Single strong side light, 500-1000 | Warm        |
| **Ethereal** | Cool `(0.05, 0.05, 0.1)`        | Soft overhead, 50-100              | 7000-9000K  |

### Blackbody Quick Ref

| Temperature | Color              | Mood               |
| ----------- | ------------------ | ------------------ |
| 1800K       | Deep orange/candle | Intimate, warm     |
| 2700K       | Warm amber         | Cozy, tungsten     |
| 5500K       | Neutral white      | Daylight           |
| 7000K       | Cool blue-white    | Overcast, clinical |
| 10000K+     | Deep blue          | Moonlight, alien   |

**Setup**: Efficiency pin 0 → set to 1.0 (defaults to 0.025). Power on pin 1 child.

### Environment as Lighting

| Approach       | Power | Best For                                 |
| -------------- | ----- | ---------------------------------------- |
| Env fill only  | 1-2   | Supplement quad lights                   |
| Env as primary | 3-5   | Space scenes, floating objects           |
| Env + HDRI     | 1-2   | Realistic reflections + natural lighting |

### Lights Through Glass — Avoid

Light sources visible through glass show as refracted shapes. Move lights out of frame, or use environment-only lighting for glass-heavy scenes.

---

## 3. Materials

### IOR Reference

| Material | IOR     | Notes                 |
| -------- | ------- | --------------------- |
| Water    | 1.33    | Use with transmission |
| Glass    | 1.5     | Standard clear glass  |
| Crystal  | 1.8-2.0 | Quartz, gemstones     |
| Diamond  | 2.4     | Maximum sparkle       |

### Material Recipes (Universal Material)

**Gold**: Albedo `(1.0, 0.78, 0.34)` (pin 2), metallic 1.0 (pin 4), roughness 0.15 (pin 8)

**Chrome/Mirror**: Albedo `(0.9, 0.9, 0.9)` (pin 2), metallic 1.0 (pin 4), roughness 0.02 (pin 8)

**Polished Marble**: Albedo `(0.9, 0.88, 0.85)` (pin 2), metallic 0 (pin 4), roughness 0.03-0.08 (pin 8)

**Glass**: Transmission type 1/specular (pin 1), IOR 1.5 (pin 15), albedo `(0.85, 0.95, 1.0)` (pin 2)

### Glass Visibility Decision Tree

| Want This          | Key Settings                                     |
| ------------------ | ------------------------------------------------ |
| Tinted glass       | Transmission color on albedo (pin 2), IOR 1.5    |
| Rainbow dispersion | IOR 1.8+, dispersion on, fake shadows off        |
| Frosted glass      | Roughness 0.1-0.3 (pin 8), transmission white    |
| Gold metallic      | Albedo `(1.0, 0.78, 0.34)`, metallic 1.0 (pin 4) |

### Key Material Rules

- **Use Universal Material for everything** — simpler, one type covers metals and glass
- Clear glass is **invisible** in uniform lighting — always tint transmission
- Amber glass absorbs cool light — pair with warm lighting
- Roughness: 0.01=mirror, 0.1=polished, 0.2=brushed, 0.3=satin, 0.5+=rough

---

## 4. Camera & Composition

### Framing is 70% of the Deal

**Camera position and object placement determine 70% of the final result.** Materials and lighting are the other 30%.

Before creating any nodes:

1. Study the recipe — describe the depth formation, margins, how objects fill the frame
2. Know the exact camera position. If you can't state it, you don't have a visual plan.
3. Know every object's position in 3D space, including Z-depth relationships.
4. For demos: set the hero camera FIRST. Objects pop into the composed frame one by one.

### Composition Rules

- **Never dead-center straight-on** — looks flat and CG. Offset camera X by 1-3 units.
- **Rule of thirds** — place focal points at grid intersections, not center.
- **Rule of odds** — groups of 3 or 5 are more dynamic than 2 or 4.
- **Leading lines** — use edges and curves to guide the eye to your focal point.
- **Negative space** — empty areas isolate the focal point and create elegance.
- **Don't put objects in a flat line** — real Z-depth creates parallax that no material work can fake.

### Focal Point Hierarchy

Every scene needs a clear reading order:

1. **Primary** — highest contrast, brightest, most detailed. Eye goes here first.
2. **Secondary** — supports primary, draws the eye next.
3. **Tertiary** — background interest, rewards exploration.

Use contrast, brightness, and detail to establish this. The eye travels primary → secondary → tertiary.

### Camera Angle Vocabulary

| Angle            | Camera Y      | Target Y      | Effect                    |
| ---------------- | ------------- | ------------- | ------------------------- |
| **Hero shot**    | Low (0.3-0.5) | Object center | Imposing, powerful        |
| **Eye-level**    | 0.5-0.8       | 0.3-0.5       | Natural, relatable        |
| **Overview**     | 1.2-1.8       | 0.2-0.3       | Shows layout, reflections |
| **Dramatic low** | 0.2-0.3       | 0.5-0.8       | Looking up, dramatic      |

### Camera Rules

1. **Offset camera X** by 1-3 units for natural asymmetry
2. **Elevate camera** to y=1.0-1.5 for tabletop scenes
3. **Use target position** — shift target X to center subjects in frame
4. **Verify zero cropping** on all objects before saving
5. **Show the environment** — include sky/background, not just floor
6. **Low camera = monumental** — y=0.3-0.5 makes objects feel massive

### Depth & Dimensionality

The difference between flat CG and scenes with presence:

- **Three layers**: foreground (dark, frames), midground (bright, subject), background (light, atmosphere)
- **Warm colors advance, cool colors recede** — warm key + cool fill creates natural depth
- **Floor reflections** create a "below" layer even in minimal scenes
- **Atmospheric haze** (environment medium) makes distant objects lose contrast — huge depth cue
- **Camera angle showing both floor and sky** creates natural FG/BG split

### Scale Cues

- **Low camera = massive** — y=0.2-0.5 looking up makes objects monumental
- **High camera = miniature** — y=1.5+ looking down makes objects feel small
- **Wide lens (24-35mm)** = exaggerated depth, things feel bigger and farther apart
- **Telephoto (85mm+)** = compressed depth, things feel flatter and closer
- **1 unit = 1 meter** in Octane. Human eye height ~1.5, table ~0.75, door ~2.0

### Framing Checklist

- [ ] All objects fully visible (no clipping at frame edges)
- [ ] Camera offset from center
- [ ] Horizon/sky visible
- [ ] Objects grounded (not floating)
- [ ] Floor reflections visible
- [ ] Clear focal point (brightest/highest-contrast area)

---

## 5. Color & Mood

### Complementary Color Pairs

| Pair                 | Mood                | Use Case                      |
| -------------------- | ------------------- | ----------------------------- |
| **Blue + Orange**    | Cinematic, dramatic | Noir, sunsets, most versatile |
| **Gold + Deep Blue** | Luxury, elegance    | Product shots, jewelry        |
| **Red + Cyan**       | Sci-fi, tension     | Technology, drama             |
| **Purple + Gold**    | Royal, mystical     | Fantasy, luxury               |

### Scene Mood Palettes

**Noir**: Black, dark grey, warm amber accent. Dark env + single warm light.
**Ethereal**: Deep blue, white, silver. Cool env + soft overhead.
**Luxury**: Gold, black, deep red. Dark floor + warm rim + gold materials.
**Sci-fi**: Cyan, purple, black. Dark env + cool colored lights.

---

## 6. Anti-CG Checklist

Run before saving any final beauty render.

- [ ] **Textured floor** — never plain white/grey. Use image texture or at least glossy with color.
- [ ] **Reflective floor** — specular > 0.3, roughness < 0.1
- [ ] **Objects grounded** — sitting ON the floor, not floating
- [ ] **Offset camera** — not dead center
- [ ] **Warm/cool contrast** in lighting
- [ ] **Visible shadows** grounding objects
- [ ] **Lighting ratio** — not flat 1:1
- [ ] **Clear focal point** — one area draws the eye first
- [ ] **All objects fully in frame** with breathing room

---

## 7. Environment Types

| Type                      | When to Use                    | Orbitable?     | Provides Lighting? |
| ------------------------- | ------------------------------ | -------------- | ------------------ |
| **Flat color**            | Dark/noir, controlled lighting | Yes            | Minimal            |
| **Daylight**              | Outdoor, natural               | Yes            | Excellent          |
| **Real HDRI** (.hdr/.exr) | Studio, product                | Yes            | Good               |
| **AI image on env**       | Avoid — distorted seams        | Distorted      | Poor               |
| **Backdrop plane**        | Dramatic static background     | One angle only | None               |

### Flat Color Values

- Near-black `(0.01, 0.01, 0.02)` — noir, dramatic
- Medium grey `(0.3, 0.3, 0.35)` — studio neutral
- Deep blue `(0.02, 0.02, 0.08)` — night, ethereal

### Real HDRIs

- **Gamma**: 1.0 for pre-baked HDRIs (default 2.2 is too bright)
- **Power**: Start at 1.0. Default 2.0 often too bright.
- **Source**: [Poly Haven](https://polyhaven.com/hdris) — free CC0

---

## 8. Kernel & Render

### Kernel Selection

| Kernel                | Best For                | Caustics                    | Speed   |
| --------------------- | ----------------------- | --------------------------- | ------- |
| **Path Tracing (PT)** | General, most work      | Okay (noisy at low samples) | Fast    |
| **PMC**               | Glass-heavy, dispersion | Better convergence          | ~2x PT  |
| **Direct Lighting**   | Quick exterior previews | None                        | Fastest |

Default: PT for everything. PMC only for caustic/dispersion hero scenes.

### Caustics Tips

- PMC converges caustics faster than PT
- Small light sources = sharper caustics
- Increase specular depth for multi-layer glass
- **Disable "fake shadows"** on specular materials — essential for real dispersion
- Tilt receiving surface so light hits at less acute angle — improves caustic brightness

### Denoiser

- OFF during scene building. ON for final renders only.
- Minimum 500-700 samples before enabling.
- PMC + Spectral AI denoiser = incompatible — use OIDN with PMC.

### Post-Processing (RT → pin 11)

- **Bloom** (pin 2): glow around bright sources
- **Glare** (pin 3): star/ray lens flare
- **Vignetting**: darkens corners, draws eye to center
- Enable first: set pin 0 = true

Post should enhance a good render, never rescue a bad one.

---

## 9. Scene Building Workflow

### Build Order

1. Infrastructure (RT, kernel, env, geo group, film settings)
2. Set lighting BEFORE adding objects — verify with empty floor render
3. Add objects one at a time, render after each
4. Apply materials AFTER mesh reload (mesh reload overwrites material pin)

### Camera Workflow

1. **Demos**: Set HERO camera first. Objects pop into the final frame one by one.
2. **Iteration**: Start wide/back/above (y=2-3, z=5-8). See full scene. Then zoom to hero angles.
3. **Finalize**: The angle that makes you say _wow_ is the beauty shot. Scene should also look great from wide overview.

### Before Saving

1. Run Anti-CG Checklist (Section 6)
2. Run Framing Checklist (Section 4)
3. Let render accumulate enough samples
4. Save PNG for review, show to user
5. Iterate on feedback before saving .ocs

---

## 10. Scene Wisdom

- **Disable "fake shadows"** on specular materials for proper dispersion.
- **Engine corrupts after ~50+ create/delete cycles** — restart Octane.
- **Save .ocs during iteration**, .orbx for final delivery.
- **Be an honest critic** — if it looks like a dark blob, say "dark blob."
- **Recipes are creative direction, not scripts** — improve, adapt, deviate.
- **Assets are never a blocker** — OTOY Studio, Poly Haven, web search.

---

## 11. Demo Presentation (DRESS Mode)

Build order for live demos: mood first, shapes second, beauty last.

1. **Environment** — lighting/mood visible from the first frame
2. **Bare geometry** — objects appear one by one in default white
3. **Materials** — each object "dresses up" one by one

Every step gets a render. Every render is a visible, meaningful change.

**Voice**: Minimal creative director. Short, visual, confident. Zero tech language.

- "Sunset sky. Sets the whole mood." — not "NT_ENV_DAYLIGHT with turbidity 8"
- "That's the shot." — not "Scene complete, 5000 samples at 1024x576"
