# Octane Creative Guide

How to make scenes look _good_, not just work. Companion to `OCTANE_MCP.md` (technical/API reference).

## What You're Working With

**OctaneRender** is the world's first and fastest unbiased, spectrally correct GPU renderer. It's used by Beeple (the $69M NFT, Louis Vuitton, Super Bowl halftime visuals), Elastic (Emmy-nominated Westworld/The Crown/Altered Carbon title sequences), and OTOY's own Star Trek production. OTOY's advisory board includes J.J. Abrams and Ari Emanuel. Their LightStage technology won a Scientific & Engineering Academy Award and was used in Avatar, The Irishman, Rogue One, Spider-Man 2, and Benjamin Button.

**Your creative toolkit:**

- **Full spectral path tracing** — physically accurate dispersion, caustics, and blackbody emission. Most renderers fake this with RGB math. Octane traces light across the continuous visible spectrum. This means rainbow prism effects, glass caustics, and color mixing are correct by default — a superpower.
- **Real-time GPU rendering** — the viewport IS the final render. Every material, light, and camera change is visible instantly. No waiting.
- **Camera LensFX** — simulate real lenses from Zeiss, Canon, Nikon, Cooke, Angenieux. Authentic chromatic aberration, bokeh, distortion, and vignetting per lens model.
- **Film stock tone mapping** — response curves based on real Kodak/Fuji film stocks. Color-grade in real-time without re-rendering.
- **AI generation** — OTOY Studio (Seedream v4.5 text-to-image, Seed3D image-to-3D), plus full web access for HDRIs, textures, reference images from anywhere.
- **28 MCP tools** — direct control over every node, attribute, material, light, camera, kernel, and post-processing setting in a live Octane scene.

Think like a cinematographer with an infinite budget and instant results.

---

## 1. OTOY Studio Asset Pipeline

### Model Selection

| Model       | Use For                                  | Size                                         | Credits |
| ----------- | ---------------------------------------- | -------------------------------------------- | ------- |
| Seedream v4 | Textures, environments, reference images | Square 1:1 (textures), Landscape 16:9 (envs) | 5       |
| Seed3D      | 3D meshes with PBR materials             | N/A (upload reference image)                 | 2       |

### Texture Prompt Rules

AI image generators produce _photographs_, not textures. You must explicitly override their defaults:

- **Camera**: "flat orthographic top-down material scan" or "flatbed scanner macro"
- **Lighting**: "evenly lit diffuse studio lighting, no shadows, no highlights, no reflections"
- **Format**: "seamless tileable, square 1:1, PBR albedo map"
- **Never include**: perspective, narrative elements, objects, backgrounds, dramatic lighting

### Prompt Templates (Copy-Paste Ready)

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

**Starfield Environment**

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

### Common Mistakes

| Mistake            | Why It's Bad                                          | Fix                                                                 |
| ------------------ | ----------------------------------------------------- | ------------------------------------------------------------------- |
| Baked lighting     | Octane adds its own lighting — baked highlights clash | Request "no shadows, no highlights, no reflections"                 |
| Perspective angle  | Texture distorts when mapped to flat geometry         | Request "flat orthographic top-down"                                |
| Narrative elements | Objects/backgrounds contaminate the texture           | Keep prompts to material surface only                               |
| Wrong aspect ratio | Non-square textures tile unevenly                     | Always use Square 1:1 for textures                                  |
| Wrong model        | Seedream isn't optimized for flat scans               | Consider dedicated PBR tools (Polycam, Meshy) for critical textures |

### Other Asset Sources

| Source                               | What                       | Format                     | Cost        |
| ------------------------------------ | -------------------------- | -------------------------- | ----------- |
| [Poly Haven](https://polyhaven.com)  | HDRIs, textures, 3D models | .hdr/.exr, .png, .obj/.fbx | Free (CC0)  |
| [ambientCG](https://ambientcg.com)   | PBR textures               | .png, .jpg                 | Free (CC0)  |
| [Sketchfab](https://sketchfab.com)   | 3D models                  | .obj, .fbx, .glb           | Free + paid |
| [TurboSquid](https://turbosquid.com) | 3D models                  | Various                    | Free + paid |

### Asset Workflow

1. Generate on otoy.studio → Download (lands in `C:/Users/johnc/Downloads/`)
2. Copy to `ORBX/assets/` with descriptive name
3. In Octane: `create_node(NT_TEX_IMAGE)` → `set_attribute(A_FILENAME=34, path)` → connect to material pin 0
4. Use absolute forward-slash paths: `C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/texture.jpg`

### Seed3D Workflow

1. Generate reference image (Seedream, isolated object on black)
2. Upload to Seed3D on otoy.studio
3. Download OBJ export
4. Copy to `ORBX/assets/`, use with `NT_GEO_MESH` + `A_FILENAME` + `A_RELOAD`
5. PBR textures from Seed3D can be applied as `NT_TEX_IMAGE` on material channels

### ⚠️ AI-Generated "Panoramas" Are NOT Equirectangular

AI models (Seedream, FLUX, etc.) generate **perspective images**, not true equirectangular projections:

- Left/right edges won't seamlessly wrap around a sphere
- Vertical distortion is wrong for spherical environment mapping
- Result: visible seams, stretching at poles, broken reflections

**Do NOT use AI-generated images as spherical environment maps.** Use them as:

- **Backdrop planes** (physical geometry behind the scene — see Section 8)
- **AI cube maps** (6 perspective faces composed into a cube map — see Section 8)
- **Material textures** (applied to flat geometry like floors/walls)

For proper 360° environments, use real HDRIs from Poly Haven or similar.

---

## 2. Lighting Design

### Three-Light Setup (Quad Lights)

| Light    | Role              | Position               | Power          | Temperature               |
| -------- | ----------------- | ---------------------- | -------------- | ------------------------- |
| **Key**  | Main illumination | 45° from camera, above | 100-500        | 4500-5500K (neutral-warm) |
| **Fill** | Soften shadows    | Opposite side, lower   | 30-50% of key  | 6500-8000K (cool)         |
| **Rim**  | Edge separation   | Behind subject         | 50-100% of key | Match key or warmer       |

### Quad Light Orientation

- Default faces **+Y** (upward)
- **Face down**: rotation `(180, 0, 0)`
- **Face forward (-Z)**: rotation `(90, 0, 0)`
- **Face camera**: calculate angle from light position to camera

### Lighting Ratios (Key Concept)

The ratio between key and fill light intensity is the **single most important factor controlling mood**. This matters more than color temperature, light position, or any other setting.

| Key:Fill Ratio | Mood                  | Use Case                                      |
| -------------- | --------------------- | --------------------------------------------- |
| **1:1**        | Flat, shadowless      | Product shots, UI previews (rarely desirable) |
| **2:1**        | Natural, even         | Outdoor daylight, casual scenes               |
| **4:1**        | Dramatic, cinematic   | Most narrative scenes, studio portraits       |
| **8:1+**       | Noir, horror, mystery | Single-light setups, deep shadow scenes       |

**How to apply**: Set key light power, then set fill to key/ratio. E.g., key=1000, fill=250 → 4:1 ratio.

**Shadow softness** depends on two things: light SIZE (larger = softer) and DISTANCE between shadow caster and receiver (farther = softer). A small light close to the floor creates hard shadows; a large light far above creates soft ones.

**Focal control via lighting**: The viewer's eye goes to the **brightest, highest-contrast area first**. Use this deliberately — light your focal point brightest, let secondary elements fall into shadow.

### Mood Lighting Recipes

**Noir / Cinematic Dark**

- Environment: near-black `(0.02, 0.02, 0.03)`
- Single warm overhead quad light, power 500-2000
- Temperature: 3000-3500K (warm amber)
- Size: 2-4 (larger = softer shadows)
- Position: `(0, 2.5, 1)`, rotation `(180, 0, 0)` (facing down)

**Golden Hour / Sunset**

- Daylight environment, hour 18.5-19.0
- Turbidity: 6-8 (atmospheric haze)
- North offset: rotate sun behind camera
- Sun size: 3-5 (larger = softer)
- Sunset color: `(1, 0.4, 0.15)`

**Studio Clean**

- Texture environment, medium grey `(0.3, 0.3, 0.35)`
- 2-3 quad lights, power 50-200 each
- Temperature: 5500K (neutral daylight)
- Even illumination from multiple angles

**Dramatic Side-Lit**

- Dark environment `(0.01, 0.01, 0.02)`
- Single strong side light, power 500-1000
- Position far to one side: `(4, 2, 0)`
- Creates deep shadows, strong form definition

**Ethereal / Dreamy**

- Cool-toned environment `(0.05, 0.05, 0.1)`
- Soft overhead fill, power 50-100
- Temperature: 7000-9000K (cool blue)
- Add subtle warm accent from below/behind

### Blackbody Emission Quick Ref

| Temperature | Color              | Mood                |
| ----------- | ------------------ | ------------------- |
| 1800K       | Deep orange/candle | Intimate, warm      |
| 2700K       | Warm amber         | Cozy, tungsten bulb |
| 3500K       | Warm white         | Tungsten studio     |
| 5500K       | Neutral white      | Daylight            |
| 7000K       | Cool blue-white    | Overcast, clinical  |
| 10000K+     | Deep blue          | Moonlight, alien    |

**Setup reminders**: Efficiency pin 0 → set to 1.0 (defaults to 0.025). Power on pin 1 child, not A_VALUE on emission node.

### Environment as Lighting

Not every scene needs quad lights. The environment texture itself can light the scene:

| Approach       | Power Range | Best For                                           |
| -------------- | ----------- | -------------------------------------------------- |
| Env fill only  | 1-2         | Subtle ambient, supplement quad lights             |
| Env as primary | 3-5         | Space scenes, floating objects, soft even lighting |
| Env + HDRI     | 1-2         | Realistic reflections + natural lighting           |

- **Space/floating scenes**: Environment-only lighting often looks better than artificial quad lights. No floor shadows needed.
- **HDRI environments**: Real HDRIs provide both lighting AND reflections — sometimes no extra lights needed.
- **Dark scenes**: Keep env power very low (0.01-0.1) and let quad lights do the work.

### Lights Through Glass — Avoid

Any light source visible through transparent glass shows as a **refracted shape** — quad lights become distorted rectangles, mesh emitters show their geometry, etc. This is physically accurate but often visually distracting.

**Solutions:**

- Move lights out of frame (behind camera, far to the side)
- Use environment-only lighting for glass-heavy scenes
- Position lights so no glass object sits between the light source and camera
- Accept the refraction if it adds to the scene (e.g., a visible light source IS the subject)

---

## 3. Material Recipes

### IOR Reference

| Material | IOR     | Notes                 |
| -------- | ------- | --------------------- |
| Air      | 1.0     | —                     |
| Water    | 1.33    | Use with transmission |
| Ice      | 1.31    | Similar to water      |
| Glass    | 1.5     | Standard clear glass  |
| Crystal  | 1.8-2.0 | Quartz, gemstones     |
| Diamond  | 2.4     | Maximum sparkle       |
| Plastic  | 1.46    | Acrylic/PMMA          |

### Material Settings

**Gold (Glossy)**

- Diffuse: `(1, 0.84, 0)` — NOT yellow `(1,1,0)`
- Specular: 1.0
- Roughness: 0.1-0.2 (polished) or 0.3 (brushed)
- **IOR: 100** — this is critical. Default IOR 1.5 makes gold look like painted plastic. High IOR flattens the Fresnel curve so the material reflects at all angles, giving proper metallic behavior. The diffuse color becomes the metallic tint. This applies to ALL metallic glossy materials (gold, copper, bronze, etc.).

**Chrome/Mirror (Glossy)**

- Diffuse: `(0.9, 0.9, 0.92)`
- Specular: 1.0
- Roughness: 0.01 (mirror) or 0.05 (polished)
- IOR: 100 (metallic Fresnel)

**Matte Plastic (Diffuse)**

- Single color, no specular needed
- Examples: red `(0.8, 0.05, 0.05)`, orange `(0.9, 0.4, 0.05)`

**Polished Concrete (Glossy)**

- Diffuse: textured or `(0.3, 0.3, 0.3)`
- Specular: 0.3-0.5
- Roughness: 0.15-0.3

**Polished Marble (Glossy)**

- Diffuse: textured or `(0.9, 0.88, 0.85)`
- Specular: 0.6-0.8
- Roughness: 0.03-0.08

**Blue Glass (Specular)**

- Transmission: `(0.3, 0.5, 1.0)`
- IOR: 1.5
- Smooth: enabled (pin 19)
- Clear glass is invisible in uniform light — always tint transmission

**Skin (Advanced — requires subsurface scattering)**

- Use Universal Material with SSS medium
- Diffuse: warm skin tone
- Subsurface: Random Walk or Diffusion medium
- Not yet tested via MCP

### Glass Visibility Decision Tree

| Want This Look                      | Material               | Key Settings                                      | Lighting Requirement                            |
| ----------------------------------- | ---------------------- | ------------------------------------------------- | ----------------------------------------------- |
| Tinted glass (blue, green, red)     | Specular               | Transmission color, IOR 1.5                       | Any — color shows in all lighting               |
| Clear glass with rainbow dispersion | Specular               | IOR 1.8+, dispersion on, fake shadows off         | Strong directional light (quad or mesh emitter) |
| Frosted/translucent glass           | Specular               | Roughness 0.1-0.3, transmission white             | Any                                             |
| Golden/warm metallic                | **Glossy** (NOT glass) | Diffuse `(1, 0.84, 0)`, specular 1.0, **IOR 100** | Any                                             |
| Amber glass                         | Specular               | Transmission `(1, 0.6, 0.1)`                      | **Warm light only** — cool light gets absorbed  |
| Crystal clear (invisible!)          | Specular               | Transmission white, IOR 1.5                       | ❌ Won't be visible in uniform light            |

**Glass traps to avoid:**

- Gold tint on glass needs ambient light to transmit — **invisible in dark environments**
- Amber transmission absorbs blue/green — sphere appears **black** under cool lighting
- Clear glass only shows via refraction distortion and caustic shadows — often invisible

### Key Material Rules

- Clear glass is **invisible** in uniform lighting — use colored transmission
- Amber glass absorbs cool light — pair with warm lighting or use glossy gold instead
- Gold tint on glass needs ambient light — doesn't work in dark/noir environments
- Metal = **Glossy** material, never Specular (Specular is for glass/transmission)
- Roughness scale: 0.01=mirror, 0.1=polished, 0.2=brushed, 0.3=satin, 0.5+=rough

---

## 4. Camera & Composition

### Framing is 70% of the Deal

**The camera position and object placement determine 70% of the final result.** Materials and lighting are the other 30%. Before creating any nodes:

1. Study the reference — describe what you see (depth formation, margins, how objects fill the frame)
2. Know the exact camera position. If you can't state it, you don't have a visual plan.
3. Know every object's position in 3D space, including Z-depth relationships.
4. For demos: set the hero camera FIRST. Objects pop into the composed frame one by one.

**Framing strategy scales with scene complexity:**

- **Simple scenes** (few objects): Framing carries everything — depth arrangements, spacing, and margins matter most because there's nothing else to lean on. Use specific formations (V, diagonal, staggered) to create dimension.
- **Complex scenes** (many objects): Frame the PRIMARY subject clearly, surround with peripheral context that supports but doesn't compete. The eye should know exactly where to go. Peripheral context is usually env/daylight — set it up early and fast so every object appears in a lit, atmospheric frame from the moment it's created.
- **Animation**: All of the above plus FLOW — how the eye travels through the scene over time.

**Don't put objects in a flat line.** Real Z-depth between objects creates parallax and dimension that no amount of material work can fake.

### Composition Fundamentals

These are universal principles used across all visual arts. Apply them to every scene.

**Rule of Thirds**: Divide the frame into a 3x3 grid. Place focal points at the **intersections**, not dead center. Off-center subjects create dynamic, engaging compositions.

**Golden Ratio / Phi Grid**: Like rule of thirds but with 1:1.618 spacing — creates unequal divisions with more visual tension. Use for scenes with strong geometric lines (architecture, structured layouts).

**Leading Lines**: Use edges, curves, and geometry to guide the viewer's eye toward your focal point. A curving line is better than a straight one — it leads the eye on a longer journey through the frame.

**Rule of Odds**: Groups of **3 or 5** objects are more dynamic than 2 or 4. Odd numbers create asymmetry and prevent the brain from pairing objects off. If you have 4 objects, cluster them as 3+1.

**Visual Weight**: Larger, brighter, more saturated, or higher-contrast elements carry more visual weight. Use this for **asymmetrical balance** — a small bright object can balance a large dark one across the frame.

**Negative Space**: Empty areas around subjects are not wasted — they isolate the focal point and create elegance. Strategic voids create breathing room and make the main subject more prominent.

**Focal Point Hierarchy**: Every scene needs a clear reading order:

1. **Primary** — highest contrast, brightest, most detailed. Where the eye goes first.
2. **Secondary** — supports the primary, draws the eye next.
3. **Tertiary** — background interest, rewards exploration.

Use contrast, brightness, saturation, and detail density to establish this hierarchy. The eye travels from primary → secondary → tertiary.

### Camera Rules

1. **Never use dead-center straight-on angles** — looks cheap and CG
2. **Offset camera X** by 1-3 units for natural asymmetry
3. **Elevate camera** to y=1.0-1.5 for tabletop scenes (looking slightly down)
4. **Use target position for framing** — shift target X to center subjects in frame
5. **Verify zero cropping** on all objects before saving final render
6. **Show the environment** — camera should include sky/background, not just floor

### Camera Angle Vocabulary

| Angle            | Camera Y      | Target Y      | Effect                           |
| ---------------- | ------------- | ------------- | -------------------------------- |
| **Hero shot**    | Low (0.3-0.5) | Object center | Subjects feel imposing, powerful |
| **Eye-level**    | 0.5-0.8       | 0.3-0.5       | Natural, relatable               |
| **Overview**     | 1.2-1.8       | 0.2-0.3       | Shows layout, floor reflections  |
| **Dramatic low** | 0.2-0.3       | 0.5-0.8       | Looking up, dramatic             |

### Focal Length Guide (When Camera Attributes Accessible)

| Focal Length | Use Case                                       |
| ------------ | ---------------------------------------------- |
| 24-35mm      | Wide establishing shots, interiors, landscapes |
| 50mm         | Natural perspective (closest to human eye)     |
| 85mm         | Product/portrait isolation, shallow DOF        |
| 135mm+       | Compressed telephoto, flattened perspective    |

### Orbiting vs Beauty Shot

Scenes in the gallery get **orbited** — someone loads the .orbx and rotates around. Design for orbit FIRST, then find beauty angles.

|                      | Orbiting (Interactive)        | Beauty Shot (Static)    |
| -------------------- | ----------------------------- | ----------------------- |
| **Object placement** | Center at origin              | Can be off-center       |
| **Camera distance**  | Pull back, show full scene    | Can be close, cropped   |
| **Lighting**         | Symmetrical or env-only       | Dramatic, asymmetric OK |
| **Environment**      | Flat color, HDRI, or daylight | Backdrop plane OK       |
| **FOV**              | ~45° (natural)                | Any                     |

**Key insight**: Camera position doesn't change what you see of the environment map — the environment is infinitely far away. Only FOV changes the visible portion. Moving the camera only changes object perspectives.

### Framing Checklist

- [ ] All objects fully visible (no clipping at frame edges)
- [ ] Camera offset from center (not dead-on)
- [ ] Horizon/sky visible in frame
- [ ] Objects grounded (not floating above floor)
- [ ] Floor reflections visible (camera not too high)

---

## 5. Color & Mood

### Complementary Color Pairs

| Pair                 | Mood                | Use Case                             |
| -------------------- | ------------------- | ------------------------------------ |
| **Blue + Orange**    | Cinematic, dramatic | Noir scenes, sunsets, most versatile |
| **Gold + Deep Blue** | Luxury, elegance    | Product shots, jewelry, premium feel |
| **Red + Cyan**       | Sci-fi, tension     | Technology, drama, contrast          |
| **Green + Magenta**  | Alien, nature       | Organic, otherworldly                |
| **Purple + Gold**    | Royal, mystical     | Fantasy, luxury                      |

### Warm/Cool Depth Trick

- **Warm colors advance** (feel closer to viewer)
- **Cool colors recede** (feel farther away)
- Use warm key light + cool fill to naturally create depth
- Place warm-colored objects in foreground, cool in background

### Scene Mood Palettes

**Noir**: Black, dark grey, warm amber accent. Dark environment + single warm light.
**Ethereal**: Deep blue, white, silver. Cool environment + soft overhead fill.
**Luxury**: Gold, black, deep red. Dark floor + warm rim light + gold materials.
**Nature**: Green, brown, warm white. Daylight environment + earth tones.
**Sci-fi**: Cyan, purple, black. Dark environment + cool colored lights.

---

## 6. Anti-CG Checklist

Run this before saving any final beauty render. If any item fails, fix it first.

### Scene Setup

- [ ] **Textured floor** — never plain white/grey diffuse. Use image texture or procedural pattern.
- [ ] **Reflective floor** — glossy material, specular > 0.3, roughness < 0.1
- [ ] **Objects grounded** — sitting ON the floor, not floating
- [ ] **Depth layers** — foreground, midground, background all present (see Section 11)
- [ ] **Interesting environment** — sky/background has color, gradient, or texture

### Composition

- [ ] **Offset camera** — not dead center. Shift X by 1-3 units.
- [ ] **Intentional palette** — colors chosen for mood, not random defaults
- [ ] **Zero cropping** — all objects fully in frame with breathing room
- [ ] **Clear focal point** — one area draws the eye first via contrast/brightness (see Section 4)

### Lighting

- [ ] **Warm/cool contrast** — lighting mixes warm and cool tones
- [ ] **Visible shadows** — objects cast shadows that ground them in the scene
- [ ] **Lighting ratio** — key:fill ratio is intentional, not flat 1:1 (see Section 2)
- [ ] **No point lights** — always use area lights (quad lights, mesh emitters) for natural soft shadows

### Realism (The Details That Kill CG)

- [ ] **Surface imperfections** — roughness varies across surfaces. Nothing in reality is perfectly uniform. Add micro-scratches, dust in crevices, fingerprints near grip areas. Use texture maps on roughness channels.
- [ ] **Edge treatment** — hard edges have at least a tiny bevel/chamfer. Sharp 90-degree edges catch zero highlights and scream CG. Use beveled OBJ meshes.
- [ ] **Camera imperfections** — Octane has these built in: vignetting (post-processing node), DOF/bokeh (camera aperture), film stock tone mapping (Imager response curves), and LensFX (real lens simulation). Even very subtle settings make a huge difference. See Section 9.
- [ ] **Atmospheric depth** — distant objects should lose contrast, shift cooler, softer. Use environment medium (fog) or color-temperature separation across layers. See Section 11.
- [ ] **Get it right in the render** — if you need heavy post-processing to make it look good, fix the scene instead. Post should enhance, never rescue.

---

## 7. Scene Building Workflow

### Before Building

1. Read the recipe
2. Choose a **mood palette** from Section 5
3. Choose a **lighting recipe** from Section 2
4. Plan which materials need **textures from OTOY Studio** (generate them first)

### During Building

1. Build infrastructure (RT, kernel, env, group, film)
2. Set lighting BEFORE adding objects — verify light direction with empty floor render
3. Add objects one at a time, render after each
4. Apply materials AFTER mesh reload (mesh reload overwrites material pin)
5. **Start camera wide, back, and above** — this is the "orbiting overview" angle. It's the best view for a human watching the build process live. Evaluate the whole scene from this vantage first.

### Camera Workflow (Critical)

1. **Build in overview mode** — camera wide, pulled back, elevated (y=2-3, z=5-8). See the full scene, all objects, floor, environment. This is also the default orbiting experience for someone loading the .orbx.
2. **Then zoom to hero angles** — once the scene is complete, move the camera to 2-3 interesting close-up positions. Evaluate each. Look for the "wow" angle.
3. **Finalize on the best angle** — the one that makes you say _wow_ becomes the beauty shot. But the scene should ALSO look great from the wide overview (the orbiting default).

### Before Saving

1. Run Anti-CG Checklist (Section 6)
2. Run Framing Checklist (Section 4)
3. Let render accumulate enough samples for clean image
4. Save PNG for review, show to user
5. Iterate on feedback before saving .orbx

---

## 8. Environment & Backdrop Strategy

The environment is the single biggest creative decision in a scene. It determines background, reflections, and (optionally) lighting. Choose the right type before building anything else.

### Environment Types Decision Matrix

| Type                              | When to Use                            | Orbitable?        | Provides Lighting?               |
| --------------------------------- | -------------------------------------- | ----------------- | -------------------------------- |
| **Flat color** (RGB on env pin 0) | Dark/noir, controlled lighting         | ✅ Yes            | Minimal (ambient fill only)      |
| **Daylight**                      | Outdoor, natural scenes                | ✅ Yes            | Excellent (physical sun + sky)   |
| **Real HDRI** (.hdr/.exr)         | Studio, product, realistic reflections | ✅ Yes            | Good (captured real-world light) |
| **AI image on env**               | ⚠️ Avoid — distorted, seams visible    | ⚠️ Distorted      | Poor (LDR, wrong projection)     |
| **Backdrop plane**                | Dramatic static background             | ❌ One angle only | None (visual only)               |
| **AI cube map** (6 faces)         | Custom environment, AI-generated       | ✅ Yes            | Decent (proper projections)      |

### Flat Color Environment

The default. Set RGB on the environment texture's color child:

- Near-black `(0.01, 0.01, 0.02)` — noir, dramatic, controlled lighting
- Medium grey `(0.3, 0.3, 0.35)` — studio neutral
- Deep blue `(0.02, 0.02, 0.08)` — night, ethereal
- Always orbitable, always predictable. Pair with quad lights or mesh emitters for actual illumination.

### Real HDRIs — Best Practice

Real HDRIs from [Poly Haven](https://polyhaven.com/hdris) give physically accurate lighting and reflections:

- **Gamma**: Set to **1.0** for pre-baked HDRIs (default 2.2 makes them too bright/washed)
- **Power**: 1.0-2.0 typical. Default 2.0 often too bright — start at 1.0 and adjust.
- **Resolution**: Minimum 3000-4000px wide for sharp reflections. 8K+ for hero shots.
- **Format**: .hdr or .exr for true HDR lighting. JPG/PNG work but are LDR — limited dynamic range.
- **Caveat**: Real HDRIs are photographs of real places — may look too terrestrial for abstract/space scenes.

### Backdrop Plane Technique

For dramatic static backgrounds (beauty shots, presentations):

1. Create a large plane (`floor.obj` scaled 10-20x, or `NT_GEO_OBJECT` primitive 15/18)
2. Apply image texture to diffuse material on the plane
3. Position behind the scene facing camera (e.g., z=-5 to z=-10)
4. Combine with flat-color environment for ambient fill
5. **Trade-off**: Looks great from one angle. Breaks completely when orbiting.

Best for: final beauty renders, presentation screenshots, specific compositions.

### AI-Generated Cube Map (Experimental)

Instead of trying to make AI generate a single equirectangular panorama (which it can't do properly), generate **6 perspective faces** of a cube map:

1. **Generate 6 images** with consistent style/lighting:
   - Front, Back, Left, Right, Top, Bottom
   - Use the same prompt base with direction-specific details
   - Example: "dark gothic cathedral interior, view looking [forward/left/right/up/down/behind], deep shadows, stone arches, dramatic lighting, square 1:1"
2. **Compose into cube map layout** (cross pattern or horizontal strip)
3. **Load as environment** with cube map projection in Octane

**Why this works**: Each face IS a proper perspective projection — exactly what AI generates naturally. No seam distortion, no pole stretching. The challenge is maintaining visual consistency across all 6 faces.

### What NOT to Do

- ❌ Generate a "360 panorama" with AI and use as spherical environment — it's not equirectangular
- ❌ Assume AI can generate seamlessly wrapping images — it can't
- ❌ Use JPG/PNG as environment expecting HDR lighting quality — it's LDR

---

## 9. Kernel, Camera & Render Strategy

### Spectral Rendering — Your Superpower

Octane is a **full spectral** path tracer. Most renderers (Arnold, V-Ray, Redshift) operate in RGB color space — they approximate light as three channels. Octane traces light across the **continuous visible spectrum**. This means:

- **Dispersion is physically correct** — prisms and glass produce real rainbow splitting, not a shader trick
- **Caustics are physically correct** — complex light-glass interactions need no cheating
- **Blackbody emission follows Planck's law** — temperature-based light colors are accurate
- **Color mixing is physically correct** — under saturated lighting, RGB renderers produce monochromatic results; spectral rendering captures the true physics

**What this means for scene building**: Don't fake things that Octane does naturally. Set IOR, dispersion coefficient, and emission temperature to real-world values — the spectral renderer will produce physically correct results automatically. Trust the physics.

### Kernel Selection

Available via gRPC API (no Photon Tracing in our version):

| Kernel                   | Type ID | Best For                                  | Caustics                    | Speed         |
| ------------------------ | ------- | ----------------------------------------- | --------------------------- | ------------- |
| **Path Tracing (PT)**    | 25      | General scenes, lookdev, most work        | Okay (noisy at low samples) | Fast          |
| **PMC**                  | 23      | Glass-heavy, dispersion, complex caustics | Better convergence          | Slow (~2x PT) |
| **Direct Lighting (DL)** | 24      | Quick exterior previews only              | None                        | Fastest       |

**Default choice**: Path Tracing for everything. Switch to PMC only for caustic/dispersion hero scenes.

**DL warning**: Direct Lighting renders interiors as pure white — only useful for exterior/outdoor previews.

### Caustics Tips

From Octane forum and hard-won experience:

- **PMC converges caustics faster** than PT, but both reach the same final result (unbiased engines)
- **Small light sources** = sharper, more defined caustics. Large/area lights = soft, diffuse caustics.
- **Disable environment lighting** for caustic-focused scenes — use mesh emitters instead for control
- **Increase Specular depth** in kernel settings for multi-layer glass (light needs to bounce through)
- **Tilt the receiving surface** so light hits at a less acute angle — dramatically improves caustic brightness
- **Disable "Fake shadows"** on specular materials — essential for real dispersion to work
- **Expect long render times** for complex glass caustics (hundreds to thousands of samples)

### Denoiser

| Setting | MCP Location           | Notes                            |
| ------- | ---------------------- | -------------------------------- |
| Enable  | Imager → pin 20 (Bool) | OFF during lookdev, ON for final |
| Type    | Imager → pin 21 (Enum) | Spectral AI for PT, OIDN for PMC |
| Quality | Imager → pin 24 (Enum) | Higher = cleaner but slower      |

- **When**: Final stage only. Keep OFF during scene building — it masks noise issues and adds computation.
- **Minimum samples**: Let the scene accumulate 500-700+ samples before enabling, especially for noisy scenes.
- **PMC + Spectral AI denoiser = incompatible** — switch to OIDN type when using PMC kernel.

### Camera Effects — Make It Photographic

The virtual camera is mathematically perfect by default. Real cameras aren't. Adding these effects is one of the fastest ways to make a render feel like a photograph instead of a CG image.

**Depth of Field (DOF)**:

- Controlled by aperture value on the camera node (0 = pinhole/infinite DOF)
- Stronger DOF: larger aperture, closer focus distance, longer focal length
- Creates natural foreground/background blur that isolates the subject
- Bokeh shape is customizable — different aperture shapes produce different blur patterns

**Vignetting**:

- Darkens corners of the frame — mimics real optical behavior
- Built into Octane's post-processing (no external tool needed)
- Even very subtle vignetting (barely perceptible) draws the eye to center

**Film Stock Tone Mapping**:

- Octane has response curves based on **real film stocks** (Kodak, Fuji, etc.)
- Apply in real-time without re-rendering via the Imager
- This alone can transform a clinical CG render into a cinematic image
- Combine with ACES tone mapping for proper color management

**Camera LensFX** (if available in the API):

- Simulate real lens characteristics from Zeiss, Canon, Nikon, Cooke, Angenieux
- Authentic chromatic aberration, barrel/pincushion distortion, field curvature
- Each lens model produces unique bokeh shapes and optical artifacts
- This is the ultimate anti-CG tool — the camera itself becomes imperfect

### Post-Processing

Found on RT → pin 11 (post-processing node):

- **Bloom** (pin 2): Enhances bright light sources — glow around emission panels, light beams
- **Glare** (pin 3): Adds star/ray patterns to bright spots — cinematic lens flare effect
- **Vignetting**: Darkens corners, draws eye to center
- **Enable first**: Set pin 0 = true on the post-processing node before adjusting values

**Philosophy**: Post-processing should **enhance** a good render, never rescue a bad one. Get the lighting, materials, and composition right first. Then add subtle bloom, vignetting, or film stock curves to push it from "good CG" to "photographic."

---

## 10. Scene Wisdom

Hard-won lessons. Items covered in earlier sections (glass §3, lighting §2, camera §4, environments §8, AI §1) are not repeated here.

### Technical Gotchas

- **Disable "fake shadows"** on specular materials for proper dispersion and caustics.
- **Seedream v4/v4.5 > FLUX.2 [Dev]** for starfields — FLUX produces too-heavy nebulae with no dark void.
- **Engine corrupts after ~50+ create/delete cycles** — restart Octane completely. Loading .orbx won't fix it.
- **Save .ocs during iteration**, .orbx for final delivery. Don't trust session continuations for scene state.

### Creative Process

- **Be an honest critic** — if a render looks like a dark blob, say "dark blob." The user trusts honest assessment.
- **Recipes are creative direction, not scripts** — improve, adapt, deviate. The only goal is a render that wows.
- **Don't re-add what was rejected** — when the user says something is bad, move forward.
- **Assets are never a blocker** — OTOY Studio, Poly Haven, web search. Create what doesn't exist.

---

## 11. Depth & Dimensionality

The difference between a flat CG image and a scene with presence. Apply the three-layer system to every scene.

### The Three Layers

Every strong composition has three distinct spatial planes:

| Layer          | Role                                                   | Lighting                    | Detail Level                                          |
| -------------- | ------------------------------------------------------ | --------------------------- | ----------------------------------------------------- |
| **Foreground** | Frame/context. Often partially cropped or silhouetted. | Darker (frames the scene)   | High — sells the illusion that everything is detailed |
| **Midground**  | The subject. Where the story happens.                  | Brightest, highest contrast | Highest — this is what the viewer examines            |
| **Background** | Atmosphere, context, world-building.                   | Lightest, lowest contrast   | Lowest — atmospheric fade, soft edges                 |

**The Dark-Light-Light Pattern**: The most common professional lighting pattern is dark foreground → lit midground → lighter background. This is standard in concept art, film, and environment design. It naturally frames the subject and creates depth.

### Atmospheric Perspective

Objects farther from the camera should have:

- **Lower contrast** — darks get lighter, lights get darker
- **Lower saturation** — colors wash out toward grey
- **Blue/grey color shift** — warm colors cool down with distance
- **Softer edges** — detail dissolves into haze

This mimics how real atmosphere scatters light. It's one of the strongest depth cues available — even a subtle blue-grey fade on distant objects dramatically increases the sense of space.

### Color-Based Depth Separation

Use **different light temperatures across layers** to create visual separation:

- Warm foreground + cool background = natural depth (warm advances, cool recedes)
- Cool foreground + warm midground = subject pops against cool frame
- Vary temperatures across 2-3 layers for maximum spatial separation

**Warning**: This can look artificial if overdone. Use subtle shifts (200-500K temperature difference), not dramatic ones.

### Octane Tools for Atmospheric Depth

Octane has built-in tools that directly implement atmospheric perspective:

**Environment Medium** (global fog):

- Adds volumetric fog/haze to the entire scene
- Distant objects naturally lose contrast and shift toward the fog color
- This is the easiest way to add atmospheric perspective — one node, huge impact
- Use subtle density for realism; heavy density for dramatic/mystical mood

**DOF (Depth of Field)**:

- Blurs foreground and background, keeping the subject sharp
- Creates natural depth separation between layers
- Combined with atmospheric fog, produces extremely convincing depth

**Color-temperature lighting across layers**:

- Warm key light on the subject (midground)
- Cool fill or environment on the background
- This creates color-based depth separation that reinforces the spatial layers

### Applying to Minimal Scenes

Even abstract scenes with 1-3 objects can use depth principles:

- Floor reflections create a "below" layer (depth below the midground)
- Environment gradient creates background recession
- Shadow patterns on the floor add ground-plane depth
- Camera angle showing both floor and sky creates natural FG/BG split

---

## 12. Scale & Proportion

How to make objects feel the right size and make scenes feel like real spaces.

### Camera Height Sells Scale

| Camera Position                  | Perceived Scale                    | Use For                       |
| -------------------------------- | ---------------------------------- | ----------------------------- |
| **Low (Y=0.2-0.5)** + look up    | Objects feel **massive**, imposing | Monuments, hero shots, drama  |
| **Eye level (Y=0.8-1.2)**        | Natural, human-scale               | Most scenes, relatable feel   |
| **High (Y=1.5-3.0)** + look down | Miniature, overview, god's-eye     | Dioramas, architectural plans |

### Lens Choice and Scale

| Focal Length             | Effect on Scale                                            | Best For                                           |
| ------------------------ | ---------------------------------------------------------- | -------------------------------------------------- |
| **24-35mm** (wide)       | Exaggerates depth — near objects huge, far objects tiny    | Imposing architecture, dramatic interiors          |
| **50mm**                 | Natural perspective — closest to human eye                 | General scenes, natural feel                       |
| **85-135mm** (telephoto) | Compresses/flattens depth — objects appear closer together | Product isolation, portraits, stacked compositions |

**Rule**: Wide lenses make things feel bigger and farther apart. Telephoto lenses make things feel smaller and closer together. Choose based on the emotion you want.

### Detail Density = Perceived Size

More fine details on a surface make it feel **larger**:

- A wall with hundreds of tiny bricks reads as a large building
- A smooth featureless monolith could be any size — ambiguous
- Fine scratches, pores, and grain on a surface = large real object
- Clean, smooth, uniform surface = small or CG

### Atmospheric Haze for Scale

Haze/fog between the camera and distant objects is the most powerful natural scale cue:

- Objects losing contrast with distance = large space
- Even a subtle blue-grey shift on background objects sells scale
- Height-based fog (denser near the ground) mimics real atmospheric density

### Proportion Rules

- **Use real-world measurements**: 1 unit = 1 meter in Octane. Human eye height Y=1.0-1.7. Table Y=0.75. Door height 2.0. Room ceiling 2.5-3.0.
- **Wrong proportions register as "fake" instantly** — even slightly off scale relationships make the brain reject the image
- **Scale relationships matter**: A coffee mug should be ~0.1m, a chair seat ~0.45m, a doorframe ~2.0m. If any of these are wrong relative to each other, the scene feels CG.

---

## 13. Demo Presentation (DRESS Mode)

When building a scene for an audience — the boss, a client, a demo — the build itself IS the presentation. DRESS mode optimizes for maximum visual change per second.

### Build Order

Mood first, shapes second, beauty last.

1. **Environment** — the lighting/mood is the first thing the viewer sees. Set it final from the start.
2. **Bare geometry** — objects appear one by one in default white. The composition assembles before their eyes.
3. **Materials** — each object "dresses up" one by one. Each material swap is a dramatic visual transformation.

Every step gets a render. Every render is a visible, meaningful change.

### Voice

Minimal creative director. Short, visual, confident. Zero tech language.

- "Sunset sky. Sets the whole mood." — not "NT_ENV_DAYLIGHT with turbidity 8"
- "Gold material. Warm metallic." — not "Glossy, IOR 30 for metallic Fresnel"
- "That's the shot." — not "Scene complete, 5000 samples at 1024x576"

One sentence per step. Two max for hero moments (first render, final render). Not a product presenter — no "Now watch as..." or "Notice how..." Feels like someone casually narrating while they work.

### Pacing

Brisk, not rushed. Each render is a moment, but don't linger. The viewer should feel momentum — things are happening, the scene is alive, building toward the final image.

### Ingredients Are Living

Recipe ingredient values get refined each time the scene is built and improved. They're the current best, not the original. When a build produces better values, update the recipe.
