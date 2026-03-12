# Neon Noir (Scene 2)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

The same three spheres from Glass & Metal, but the sun has set and a single warm light remains. This is the noir version — everything the daylight scene hid is now revealed.

In daylight, the glass sphere was pretty. In darkness, it becomes _spectacular_. Chromatic dispersion rings — vivid concentric rainbows — appear where the single warm overhead light enters the glass. These rings are invisible in bright multi-source daylight because the spectral bands overlap and cancel. In controlled single-light darkness, each color separates and burns. This is the physics payoff of noir lighting — Octane's spectral engine showing what it can really do.

The gold sphere catches one warm crescent of metallic fire against shadow. The orange matte sphere (shifted from Scene 1's red to match the warm palette) glows softly like a dying ember. Everything else falls to black.

**This is an 8:1+ lighting ratio scene** — one light, no fill, near-black environment. Maximum drama. The environment isn't zero-black — just enough ambient to keep shadows from becoming absolute voids, to hint that there's a world beyond the light cone.

**Same camera as Scene 1.** That's the point — identical geometry, identical angle, completely different mood. Lighting alone transforms the scene. The viewer gets to compare and understand what lighting does.

**Depth through contrast**: Dark environment = background. Lit surfaces = midground. Floor reflections = foreground layer below. Warm amber against cool near-black = natural warm/cool depth separation.

---

## Directions

_10 renders. Same spheres, opposite mood. Brisk, not rushed._

### Prep

Clear the scene. Create render target + path tracing kernel. Connect kernel BEFORE starting render. Set resolution to 1280x720.

### 1. Set the mood

> "Near-black void. One warm light overhead."

Create texture environment with near-black color. Create the overhead quad light with warm amber color. Connect env to RT. Start render. Set hero camera. First frame: darkness with a single pool of warm light hitting the floor.

### 2. Lay the table

> "Dark polished floor. Warm light pooling on it."

Create geo group (8 slots). Floor mesh at 10x scale, default white material. The overhead light paints a warm circle on the bare floor.

### 3. Gold sphere

> "Gold sphere, left side. Same spot as daylight."

Bare white sphere in the left-forward position. Shape only — the single light carves a crescent on it.

### 4. Glass sphere

> "Glass sphere, center back. White for now."

Second white sphere, center and recessed. Same V-formation as Scene 1.

### 5. Orange sphere

> "Orange sphere, right. All three placed."

Third white sphere completes the trio. Geometry matches Scene 1 exactly.

### 6. Dress the floor

> "Dark warm concrete. Noir stage."

Glossy material — warm umber diffuse, high specular, near-mirror. The light pool tightens and deepens.

### 7. Dress the gold

> "Gold crescent against shadow."

Glossy metallic gold. Only the lit crescent catches the overhead light — the rest falls to black.

### 8. Dress the glass

> "Glass with dispersion. Watch the rainbow rings."

Specular glass with near-clear transmission and dispersion ON. The overhead light enters and splits into concentric spectral rings. The physics payoff.

### 9. Dress the orange

> "Warm ember glow. That's noir."

Diffuse orange. Soft and warm against the darkness. Scene complete.

### 10. Refine

> "Final framing. Check the dispersion rings."

Tweak light power if needed. Ensure the dispersion rings are vivid. Beauty render.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value                |
| ---------- | -------------------- |
| Position   | (-3, 1.2, 6)         |
| Target     | (0, 0.2, 0)          |
| Resolution | 1280x720 interactive |
| Beauty     | 1920x1080            |

### Environment

| Setting       | Value                        |
| ------------- | ---------------------------- |
| Texture color | (0.02, 0.02, 0.03)           |
| Notes         | Near-black, slight blue tint |

### Floor

| Setting   | Value             |
| --------- | ----------------- |
| Mesh      | floor.obj, 10x    |
| Material  | Glossy            |
| Diffuse   | (0.15, 0.1, 0.08) |
| Specular  | 0.8               |
| Roughness | 0.03              |
| Notes     | Warm umber        |

### Gold Sphere (left, forward)

| Setting   | Value            |
| --------- | ---------------- |
| Mesh      | sphere_hd.obj    |
| Position  | (-0.9, 0.3, 0.4) |
| Scale     | 0.6              |
| Material  | Glossy           |
| Diffuse   | (1, 0.84, 0)     |
| Specular  | 1.0              |
| Roughness | 0.15             |

### Glass Sphere (center, recessed)

| Setting      | Value           |
| ------------ | --------------- |
| Mesh         | sphere_hd.obj   |
| Position     | (0, 0.38, -0.3) |
| Scale        | 0.75            |
| Material     | Specular        |
| Transmission | (0.9, 0.9, 1.0) |
| IOR          | 1.5             |
| Dispersion   | ON              |

### Orange Sphere (right, forward)

| Setting  | Value            |
| -------- | ---------------- |
| Mesh     | sphere_hd.obj    |
| Position | (0.9, 0.3, 0.3)  |
| Scale    | 0.6              |
| Material | Diffuse          |
| Diffuse  | (0.9, 0.4, 0.05) |

### Light

| Setting  | Value            |
| -------- | ---------------- |
| Type     | Quad             |
| Position | (0, 2.5, 1)      |
| Rotation | (180, 0, 0)      |
| Color    | 3500K warm amber |
| Power    | 500–2000         |
| Size     | 3                |

### Render

| Setting | Value           |
| ------- | --------------- |
| Samples | 5000            |
| Time    | ~25s @ 1280x720 |

---

## Handle Map

_Fill as you build. Reference for camera tweaks and material iteration._

| Object | Mesh | Placement | Transform | Material | Geo Group Slot |
| ------ | ---- | --------- | --------- | -------- | -------------- |
| Floor  | —    | —         | —         | Glossy   | Input 1        |
| Gold   | —    | —         | —         | Glossy   | Input 2        |
| Glass  | —    | —         | —         | Specular | Input 3        |
| Orange | —    | —         | —         | Diffuse  | Input 4        |

---

### Floor Texture (Recommended)

```
dark polished concrete surface, seamless tileable texture, flat orthographic top-down material scan,
evenly lit diffuse studio lighting, no shadows no highlights no reflections,
PBR albedo map, photorealistic, square 1:1
```
