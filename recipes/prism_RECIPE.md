# The Prism (Scene 7)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A dark glass prism splitting a beam of white light into warm and cool color fans. _The Dark Side of the Moon_ as a path-traced scene. Minimal, focused, iconic.

The prism sits on a dark reflective floor. White light enters one face from a small, intense side light. It exits the other face split into spectral components — warm orange and golden light spilling from one side, cool blue and teal from the other. The dark-tinted glass makes the prism appear nearly black, almost monolithic, but it's alive with refracted light moving through it.

**This is a two-tone composition: warm vs. cool, literally split by physics.** The floor catches both sides — warm spectral tones on one side of the prism, cool on the other. Blue + orange is the most cinematic complementary color pair, and this scene creates it through pure optics. The prism is the dividing line between two color worlds.

**Small light source is critical.** The smaller the light, the sharper the spectral separation. A large area light produces diffused, mushy color bands that blend together. A tight source creates distinct, vivid spectral lines — the Pink Floyd album cover look. Position it at prism height, directly to the side, so the beam enters cleanly through one face.

**Noir lighting ratio (8:1+).** Near-black environment, single side light, no fill. The scene exists in darkness with only the spectral color providing illumination beyond the direct beam. The prism and its light are the only things that matter.

**Elevated close-up camera.** Slightly above and offset, looking down at the prism. Close enough to see both warm and cool beams emerging from the prism faces, far enough to see the spectral light painting the floor on both sides.

---

## Directions

_7 renders. One prism, one light, pure physics. Brisk, not rushed._

### Prep

Clear the scene. Create render target + path tracing kernel. Connect kernel BEFORE starting render. Set resolution to 1280x720.

### 1. Set the mood

> "Near-black void. Tight white light from the side."

Create texture environment with near-black color. Create the side quad light — small, neutral white, at prism height. Connect env to RT. Start render. Set hero camera. First frame: darkness with a tight beam of white light.

### 2. Lay the table

> "Dark mirror floor. Light skims across it."

Create geo group (8 slots). Floor mesh at 10x scale, default white. The side light rakes across the bare floor.

### 3. Place the prism

> "Dark prism, center stage."

Prism mesh on the floor at center. Bare white material. The light hits the triangular form.

### 4. Dress the floor

> "Near-black mirror. Sets the void."

Glossy material on the floor — very dark, high specular, near-mirror finish. The prism's silhouette reflects below.

### 5. Dress the prism

> "Dark glass with dispersion. Watch the spectrum split."

Specular glass — high IOR for wide spectral separation, dark tint transmission, dispersion ON. The white beam enters one face and fans out into warm and cool on opposite sides.

### 6. Tune the light

> "Tighten the beam. Sharper spectral lines."

Adjust light size and power. Smaller = sharper color bands. The floor should show distinct warm/cool zones on each side of the prism.

### 7. Final

> "Pink Floyd on the floor. That's the shot."

Final framing. Ensure both warm and cool spectral fans are visible. Beauty render.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value                |
| ---------- | -------------------- |
| Position   | (0.5, 1.2, 3)        |
| Target     | (0, 0.3, 0)          |
| Resolution | 1280x720 interactive |
| Beauty     | 1920x1080            |

### Environment

| Setting       | Value              |
| ------------- | ------------------ |
| Texture color | (0.01, 0.01, 0.02) |
| Notes         | Near-black         |

### Floor

| Setting   | Value             |
| --------- | ----------------- |
| Mesh      | floor.obj, 10x    |
| Material  | Glossy            |
| Diffuse   | (0.08, 0.08, 0.1) |
| Specular  | 0.8               |
| Roughness | 0.02              |

### Prism (center)

| Setting      | Value                            |
| ------------ | -------------------------------- |
| Mesh         | prism.obj                        |
| Position     | (0, 0, 0) on floor               |
| Material     | Specular                         |
| IOR          | 1.8                              |
| Dispersion   | ON                               |
| Transmission | (0.15, 0.15, 0.2)                |
| Smooth       | ON                               |
| Notes        | Dark tint — appears nearly black |

### Light

| Setting  | Value                                               |
| -------- | --------------------------------------------------- |
| Type     | Quad                                                |
| Position | (-3, 0.5, 0)                                        |
| Color    | 5500K neutral white                                 |
| Power    | 3000–5000                                           |
| Size     | 0.5–1                                               |
| Notes    | Side, at prism height. Small = sharp spectral lines |

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
| Prism  | —    | —         | —         | Specular | Input 2        |
