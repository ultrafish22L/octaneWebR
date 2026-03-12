# The Beacon (Scene 9)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A tall glass pillar standing on a dark mirror floor against a starfield backdrop. The pillar glows from within — a single light source embedded inside it refracts through the glass, casting intricate caustic patterns on the mirror floor below. The pillar IS the light. A luminous beacon in the void of space.

**The mirror floor doubles everything.** The pillar's glow extends downward into the reflection — a luminous column that appears to stretch both up into the stars and down into an infinite mirror dimension. This doubling transforms a single object into a compositional axis that divides the image vertically.

**Portrait orientation matches the subject.** A tall, narrow pillar demands a vertical frame. 1080x1920 (9:16) gives the pillar room to breathe vertically while keeping the starfield backdrop tight on the sides. The vertical format emphasizes the beacon's height and the column-of-light effect in the floor reflection.

**Low angle hero shot.** Camera at y=0.4, looking up at mid-pillar height. This makes the pillar feel monumental — a structure, not a prop. The offset right position breaks symmetry. The starfield is visible above and around the pillar, grounding it in deep space.

**The light-through-glass trade-off.** A quad light inside the pillar will show as a refracted rectangle through the glass. In this scene, that's acceptable — even desirable. The refracted shape becomes part of the beacon's glow, a burning core visible through translucent glass. The warm-tinted transmission `(1.0, 0.95, 0.85)` softens the refracted light with warmth.

**Environment at low power** — just enough for visible stars and subtle ambient fill, not enough to compete with the internal glow. The beacon should be the brightest thing in the scene by far.

---

## Directions

_8 renders. One pillar, one internal light, deep space. Brisk, not rushed._

### Prep

Clear the scene. Create render target + path tracing kernel. Connect kernel BEFORE starting render. Set resolution to 1080x1920 (portrait 9:16).

### 1. Set the mood

> "Starfield. Deep space void."

Create texture environment with starfield image at low power. Connect env to RT. Start render. Set hero camera (low angle, offset right, looking up). First frame: stars and darkness.

### 2. Lay the table

> "Dark mirror floor. Stars reflected below."

Create geo group (8 slots). Floor mesh at 10x scale, default white. The starfield reflects faintly in the bare floor.

### 3. Place the pillar

> "Glass pillar, center. Tall and narrow."

Pillar mesh at center, default white material. The vertical form anchors the composition.

### 4. Embed the light

> "Light inside the pillar. The beacon ignites."

Create quad light inside the pillar — warm white, positioned at mid-pillar height. The pillar immediately begins to glow from within.

### 5. Dress the floor

> "Near-black mirror. Pillar glow doubles downward."

Glossy material — very dark diffuse, high specular, near-mirror. The pillar's glow extends into the reflection below.

### 6. Dress the pillar

> "Warm glass. Caustics on the floor."

Specular glass — IOR 1.5, warm-tinted transmission, smooth ON. Light refracts through the glass, caustic patterns scatter across the mirror floor.

### 7. Tune the light

> "Balance beacon glow vs. starfield."

Adjust light power so the beacon dominates but stars remain visible. The internal glow should be the brightest element by far.

### 8. Final

> "Luminous column stretching into infinity. That's the shot."

Final framing. Check the reflection doubles the pillar downward. Beauty render.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value                                            |
| ---------- | ------------------------------------------------ |
| Position   | (1, 0.4, 3)                                      |
| Target     | (0, 1.5, 0)                                      |
| Resolution | 1080x1920 interactive                            |
| Beauty     | 1080x1920                                        |
| Notes      | Low angle, offset right, looking up — monumental |

### Environment

| Setting | Value                                                |
| ------- | ---------------------------------------------------- |
| Texture | ORBX/assets/starfield.jpg                            |
| Power   | 1.0–1.5                                              |
| Notes   | Low power — stars visible, not competing with beacon |

### Floor

| Setting   | Value              |
| --------- | ------------------ |
| Mesh      | floor.obj, 10x     |
| Material  | Glossy             |
| Diffuse   | (0.02, 0.02, 0.03) |
| Specular  | 0.9                |
| Roughness | 0.01               |
| Notes     | Near-black mirror  |

### Pillar (center)

| Setting      | Value                               |
| ------------ | ----------------------------------- |
| Mesh         | pillar.obj                          |
| Position     | (0, 0, 0) center                    |
| Material     | Specular                            |
| IOR          | 1.5                                 |
| Transmission | (1.0, 0.95, 0.85)                   |
| Smooth       | ON                                  |
| Notes        | Warm tint — softens refracted light |

### Light

| Setting  | Value                                      |
| -------- | ------------------------------------------ |
| Type     | Quad                                       |
| Position | (0, 1, 0) inside pillar                    |
| Color    | 4000K warm white                           |
| Power    | 3000–5000                                  |
| Size     | 0.3                                        |
| Notes    | Embedded inside pillar — the beacon's core |

### Render

| Setting | Value            |
| ------- | ---------------- |
| Samples | 5000             |
| Time    | ~30s @ 1080x1920 |

---

## Handle Map

_Fill as you build. Reference for camera tweaks and material iteration._

| Object | Mesh | Placement | Transform | Material | Geo Group Slot |
| ------ | ---- | --------- | --------- | -------- | -------------- |
| Floor  | —    | —         | —         | Glossy   | Input 1        |
| Pillar | —    | —         | —         | Specular | Input 2        |
