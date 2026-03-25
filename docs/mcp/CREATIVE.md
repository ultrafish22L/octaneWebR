# Octane Creative Guide

How to make scenes look good. For values and pin layouts, see `REFERENCE.md`. For build workflow, see `BUILD.md`.

**`suggest_lighting` and `suggest_material` tools compute mood-correct values automatically.** Use them as the starting point, then use the manual values below to understand and fine-tune.

---

## §1 Lighting

### Three-Light Setup

| Light    | Position               | Power          | Temperature               |
| -------- | ---------------------- | -------------- | ------------------------- |
| **Key**  | 45° from camera, above | 100-500        | 4500-5500K (neutral-warm) |
| **Fill** | Opposite side, lower   | 30-50% of key  | 6500-8000K (cool)         |
| **Rim**  | Behind subject         | 50-100% of key | Match key or warmer       |

### Lighting Ratios

| Key:Fill | Mood                | Use Case                  |
| -------- | ------------------- | ------------------------- |
| **2:1**  | Natural, even       | Outdoor, casual           |
| **4:1**  | Dramatic, cinematic | Most scenes               |
| **8:1+** | Noir, mystery       | Single-light, deep shadow |

**Shadow softness** = light SIZE x DISTANCE. Larger + farther = softer.

**Focal control:** Eye goes to brightest, highest-contrast area first. Light your focal point brightest.

### Mood Presets

| Mood         | Environment color             | Light power | Temperature |
| ------------ | ----------------------------- | ----------- | ----------- |
| **Noir**     | Near-black (0.02, 0.02, 0.03) | 500-2000    | 3000-3500K  |
| **Studio**   | Medium grey (0.3, 0.3, 0.35)  | 50-200 each | 5500K       |
| **Dramatic** | Dark (0.01, 0.01, 0.02)       | 500-1000    | Warm        |
| **Ethereal** | Cool (0.05, 0.05, 0.1)        | 50-100      | 7000-9000K  |

### Blackbody Temperatures

1800K=candle, 2700K=tungsten, 5500K=daylight, 7000K=overcast, 10000K+=moonlight.

### Environment as Lighting

Env fill only (power 1-2) supplements quad lights. Env as primary (3-5) for floating objects. Real HDRI: gamma 1.0, power 1.0. Source: Poly Haven (free CC0).

### HDRI Backlight Trick

Set rotation `{0, Y, 0}` on the spherical projection's transform to position the sun/bright area behind the scene for golden hour backlight. Requires NT_PROJ_SPHERICAL connected to image texture pin 6.

### Lights Through Glass — Avoid

Light through glass shows refracted shapes. Move lights out of frame or use env-only lighting for glass scenes.

### Underwater Scenes

Volumetric medium FIRST: NT_MED_SCATTERING on env + NT_KERN_PATHTRACING. Simple RGB env color, NOT flat images. Calibrate density before building any scene.

---

## §2 Quality Bar

- Below B+ → REJECT. "Would a stranger stop scrolling?" is the bar.
- Two meshes in empty void = F-tier regardless of texture quality. Build the STAGE first (environment, depth, atmosphere), then place heroes.
- Before any camera adjustment: "Is this scene worth rendering at any angle?" If no, add content first.

---

## §3 Camera & Composition

**Framing is 70% of the result.** Camera + object placement >> materials + lighting.

### Before Creating Nodes

1. Know every object's position in 3D space (from `plan_composition` or recipe)
2. Know Z-depth relationships
3. Camera: `fit_camera` handles framing during build. Hero camera comes in Phase 4 polish.

### Scene Complexity Rules

- **Simple scenes** (few objects): framing carries everything. Depth arrangements matter most because there's nothing else to look at.
- **Complex scenes**: focus on PRIMARY subject with good PERIPHERAL context. Peripherals support, don't compete. Usually env/daylight — set up early so every object appears in a lit, atmospheric frame.
- **Animation**: all of the above plus FLOW — how the eye moves through the scene over time.

### Composition Rules

- **Never dead-center straight-on** — offset camera X by 1-3 units
- **Rule of thirds** — focal points at grid intersections
- **Rule of odds** — groups of 3 or 5 > groups of 2 or 4
- **Z-depth** — real depth creates parallax no material work can fake
- **Negative space** — empty areas isolate focal point

### Focal Point Hierarchy

1. **Primary** — brightest, highest contrast. Eye goes here first.
2. **Secondary** — supports primary.
3. **Tertiary** — background interest.

### Camera Angles

| Angle            | Camera Y             | Effect               |
| ---------------- | -------------------- | -------------------- |
| **Hero shot**    | 0.3-0.5 (looking up) | Imposing, powerful   |
| **Eye-level**    | 0.5-0.8              | Natural, relatable   |
| **Overview**     | 1.2-1.8              | Shows layout         |
| **Dramatic low** | 0.2-0.3              | Looking up, dramatic |

### Depth

- Three layers: foreground (dark), midground (bright, subject), background (light)
- Warm colors advance, cool recede
- Floor reflections create a "below" layer
- Camera showing floor AND sky = natural FG/BG split

### Scale

Low camera = massive. High camera = miniature. 1 unit = 1 meter. Human eye ~1.5, table ~0.75.

---

## §4 Color & Mood

| Pair             | Mood                      |
| ---------------- | ------------------------- |
| Blue + Orange    | Cinematic, most versatile |
| Gold + Deep Blue | Luxury, elegance          |
| Red + Cyan       | Sci-fi, tension           |
| Purple + Gold    | Royal, mystical           |

### CG Craft Notes

- **Gold metal**: IOR 30 is the sweet spot — IOR 1.5 = painted plastic, IOR 100 = pure mirror that reflects cool sky and looks silver. Gold reflects its environment, so the environment must be warm (warm sky_color, sunset_color) or it won't read as gold.
- **Eclipse/backlight effects**: A matte sphere with backlight produces no visible corona. Needs bloom/glare post-processing to sell the effect.

---

## §5 Anti-CG Checklist

Run before saving final renders:

- Textured floor (never plain white/grey)
- Reflective floor (specular > 0.3, roughness < 0.1)
- Objects grounded (not floating)
- Offset camera (not dead center)
- Warm/cool contrast in lighting
- Visible shadows
- Lighting ratio (not flat 1:1)
- Clear focal point
- All objects fully in frame

---

## §6 Environment Types

| Type                  | Provides Lighting? | Notes                                        |
| --------------------- | ------------------ | -------------------------------------------- |
| Flat color            | Minimal            | Noir/dramatic. Near-black (0.01, 0.01, 0.02) |
| Daylight              | Excellent          | Outdoor/natural                              |
| Real HDRI (.hdr/.exr) | Good               | Studio/product. Gamma 1.0, power 1.0         |
| AI image on env       | Poor               | Distorted seams — avoid as spherical map     |

---

## §7 Kernel Selection

| Kernel              | Best For                          | Speed                     |
| ------------------- | --------------------------------- | ------------------------- |
| **Path Tracing**    | General, most work                | Fast                      |
| **PMC**             | Glass-heavy, dispersion, caustics | ~2x slower                |
| **Direct Lighting** | Quick preview, exterior           | Fastest, no bounced light |

PMC + Spectral AI denoiser = incompatible — use OIDN. Denoiser OFF during building, ON for finals (500+ samples).

### Caustics

PMC for better convergence. Small lights = sharper caustics. Disable "fake shadows" on specular materials for real dispersion.
