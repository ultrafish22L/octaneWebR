# The Shrine (Scene 6)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

An inverted glass cone floating above a mirror floor. A single bright overhead light enters the cone's flat top and disperses through the glass into a full rainbow spectrum, painting the floor in vivid color. A shrine to chromatic dispersion.

**The floor is the canvas.** This scene isn't really about the cone — it's about what the cone does to the light. The mirror floor should be alive with spectral color: greens, pinks, yellows, purples radiating outward from beneath the floating cone like a mandala of pure physics. The cone itself shows rainbow gradients across its surfaces, but the real spectacle is below.

**Maximum dispersion, minimum distraction.** Near-black environment, single overhead light, mirror floor. Three elements. The dark environment means zero ambient competition — every photon of color on the floor comes from the prism effect. The smaller the light source, the sharper the spectral separation. This is surgical lighting for a physics demonstration.

**Low angle hero shot looking up.** Camera at y=0.3, offset for asymmetry. The rainbow floor fills the lower third, the floating cone dominates the center, and the bright overhead light is visible above. This creates a natural reading order: floor color (wow) → floating cone (how?) → overhead light (ah). Three-layer depth from ground to sky.

**This is Octane's spectral engine showcase.** High IOR (1.8-2.0) with dispersion coefficient means physically correct spectrum splitting. RGB renderers can't do this — they fake it with color gradients. This is real wavelength-dependent refraction across the continuous visible spectrum.

---

## Directions

_6 renders. Each one a visible change. Brisk, not rushed._

### Prep

Clear the scene. Create render target + path tracing kernel. Connect kernel BEFORE starting render. Set resolution to 1024x576.

### 1. Set the mood

> "Near-black void. Overhead spotlight. Surgical."

Create texture environment with near-black color. Create quad light — directly overhead, neutral white, downward-facing. Connect to RT. Start render. Set hero camera low. First frame: darkness with a bright point of light above.

### 2. Lay the table

> "Mirror floor. The spotlight pools on the surface."

Create geo group (8 slots). Floor mesh at 10x scale, no material yet. The overhead light hits the bare floor as a bright circle.

### 3. The cone

> "Inverted glass cone floating above the floor. The prism."

Cone mesh inverted (rotation 180,0,0), floating above the floor. Bare white shape in position.

### 4. Dress the floor

> "Near-black mirror. Maximum reflection for the spectral paint."

Near-black glossy material on the floor. Maximum specular, near-zero roughness. The floor becomes a dark mirror waiting for color.

### 5. Dress the cone

> "Crystal glass. Dispersion on. The rainbow hits the floor."

Specular glass with high IOR and dispersion. The overhead light enters the cone's flat top, disperses through the glass, and paints the mirror floor with spectral color.

### 6. Final framing

> "Low angle looking up. Rainbow floor, floating prism, light above. That's the shot."

Refine camera position if needed. The composition reads bottom to top: spectral floor → glass cone → overhead light. Three layers.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value                |
| ---------- | -------------------- |
| Position   | (1.5, 0.3, 3)        |
| Target     | (0, 1.0, 0)          |
| Resolution | 1024x576 interactive |
| Beauty     | 1280x720             |

### Environment

| Setting       | Value              | Notes      |
| ------------- | ------------------ | ---------- |
| Texture color | (0.01, 0.01, 0.02) | Near-black |

### Floor

| Setting   | Value              |
| --------- | ------------------ |
| Mesh      | floor.obj, 10x     |
| Material  | Glossy             |
| Diffuse   | (0.05, 0.05, 0.06) |
| Specular  | 1.0                |
| Roughness | 0.01               |

### Cone (inverted, floating)

| Setting    | Value                  |
| ---------- | ---------------------- |
| Mesh       | prism.obj              |
| Rotation   | (180, 0, 0) — inverted |
| Position   | Floating above floor   |
| Material   | Specular               |
| IOR        | 1.8–2.0                |
| Dispersion | On                     |
| Smooth     | On                     |

### Light

| Setting  | Value                         |
| -------- | ----------------------------- |
| Type     | Single quad                   |
| Position | (0, 4, 0) — directly overhead |
| Rotation | (180, 0, 0) — facing down     |
| Color    | 5500K neutral white           |
| Power    | 5000–10000                    |
| Size     | 1–2                           |

### Render

| Setting | Value        |
| ------- | ------------ |
| Samples | 5000         |
| Kernel  | Path tracing |

---

## Handle Map

_Fill as you build. Reference for camera tweaks and material iteration._

| Object | Mesh | Placement | Transform | Material | Geo Group Slot |
| ------ | ---- | --------- | --------- | -------- | -------------- |
| Floor  | —    | —         | —         | Glossy   | Input 1        |
| Cone   | —    | —         | —         | Specular | Input 2        |
