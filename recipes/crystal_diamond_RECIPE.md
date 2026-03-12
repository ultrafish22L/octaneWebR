# Crystal Diamond (Scene 3)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A single diamond on a light floor, surrounded by darkness. One dramatic light. Pure luxury.

Diamond has the highest IOR of any common transparent material — 2.4. Combined with Octane's spectral path tracing, each facet becomes a tiny prism, splitting white light into vivid rainbow fire inside the stone. Reds, greens, and blues should flicker through the crystal faces, and prismatic caustics should scatter across the floor like fallen jewels of light.

**This scene is about absolute isolation.** Dark background, single subject, no distractions. Jeweler's photography on black velvet — let the stone do the talking. The light floor provides contrast from below and catches the caustic rainbows. Every element exists to serve the diamond: the dark background isolates it, the light floor catches its fire, the side light reveals its soul.

**Low camera = monumental gemstone.** At y=0.4, looking slightly up, the diamond feels larger than life. Higher angles make it feel like a trinket on a table. The offset right position breaks symmetry for a natural, photographic composition.

**Sharp, small light source.** Smaller lights create sharper, more defined caustics and more vivid spectral fire. A large soft light turns the rainbow into mush. One strong light from above-right, hitting at an angle that maximizes internal refraction — that's where the magic happens.

---

## Directions

_6 renders. Single subject, every step counts._

### Prep

Clear the scene. Create render target + path tracing kernel. Connect kernel BEFORE starting render. Set resolution to 1024x576.

### 1. Set the mood

> "Near-black void. Jeweler's velvet."

Create texture environment with near-black color (0.03, 0.02, 0.04). Connect to RT. Start render. Set hero camera. First thing visible: darkness with a hint of purple.

### 2. Lay the table

> "Light floor. The diamond's stage."

Create geo group (8 slots). Floor mesh at 10x scale, no material yet. A pale surface in the darkness.

### 3. The diamond

> "Diamond on the floor. Faceted geometry."

Bare white diamond mesh in position. The faceted shape reads even without material.

### 4. Dress the floor

> "Light stone surface. Catches the caustic fire."

Glossy light material on the floor. Pale enough to show rainbow caustics, slight sheen for reflections.

### 5. Dress the diamond

> "IOR 2.4, dispersion on. Prismatic fire."

Specular material with diamond IOR and dispersion. Light splits into rainbow fire inside the facets.

### 6. Key light

> "One sharp light from above-right. That's the shot."

Single quad light, small and bright. Sharp caustics scatter across the floor. Scene complete.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value                |
| ---------- | -------------------- |
| Position   | (1.5, 0.4, 3)        |
| Target     | (0, 0.3, 0)          |
| Resolution | 1024x576 interactive |
| Beauty     | 1280x720             |

### Environment

| Setting | Value              | Notes                   |
| ------- | ------------------ | ----------------------- |
| Color   | (0.03, 0.02, 0.04) | Near-black, purple hint |

### Floor

| Setting   | Value              |
| --------- | ------------------ |
| Mesh      | floor.obj, 10x     |
| Material  | Glossy             |
| Diffuse   | (0.85, 0.85, 0.88) |
| Specular  | 0.7                |
| Roughness | 0.05               |

### Diamond

| Setting    | Value       |
| ---------- | ----------- |
| Mesh       | diamond.obj |
| Material   | Specular    |
| IOR        | 2.4         |
| Dispersion | on          |
| Smooth     | on          |

### Light

| Setting     | Value      |
| ----------- | ---------- |
| Type        | Quad       |
| Position    | (2, 3, -1) |
| Temperature | 5500K      |
| Power       | 2000–5000  |
| Size        | 1.5        |

### Render

| Setting | Value           |
| ------- | --------------- |
| Samples | 5000            |
| Time    | ~20s @ 1024x576 |

---

## Handle Map

_Fill as you build. Reference for camera tweaks and material iteration._

| Object  | Mesh | Placement | Transform | Material | Geo Group Slot |
| ------- | ---- | --------- | --------- | -------- | -------------- |
| Floor   | —    | —         | —         | Glossy   | Input 1        |
| Diamond | —    | —         | —         | Specular | Input 2        |

---

### Floor Texture (Optional)

```
polished light grey stone surface, seamless tileable texture, flat orthographic top-down material scan,
evenly lit diffuse studio lighting, no shadows no highlights no reflections,
PBR albedo map, photorealistic, square 1:1
```
