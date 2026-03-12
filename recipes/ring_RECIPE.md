# The Ring (Scene 12)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A large polished gold ring floating above a dark mirror floor in deep space. A crystal sphere at its center refracts the starfield, bending the cosmos into a miniature universe framed by gold. Luxury meets infinity.

**The ring is a frame within the frame.** The gold ring acts as a compositional device — it literally frames the crystal sphere and the starfield behind it. This creates a frame-within-a-frame composition: the image frame → the gold ring → the distorted cosmos inside the sphere. Three nested levels of containment drawing the eye inward, deeper, smaller.

**The crystal sphere is the window.** Clear glass (IOR 2.0) with the starfield behind it creates a miniature inverted cosmos visible through the glass — nebula clouds swirl, stars distort, the milky way bends. The sphere doesn't just sit inside the ring — it transforms everything behind it into something alien and beautiful.

**Warm gold against cold space = natural tension.** The gold ring catches warm directional light on one side, creating a rich metallic arc that fades to shadow on the other side. This warm crescent sits against the cold blue/purple starfield. The mirror floor reflects everything — ring, sphere, stars — creating a vertical axis of symmetry.

**One strong warm light, far away and out of frame.** High power (20000-30000) compensates for the distance. The light creates directional warm highlights on the left side of the ring while the right falls to shadow — strong form that reveals the ring's three-dimensional shape. Positioned far upper-left behind the scene so it never appears through the crystal sphere.

**Three-quarter overhead camera.** Slightly above and forward, looking down at the ring face. Shows the full ring circle with the crystal sphere at center. Portrait orientation for vertical impact with the floor reflection extending the composition downward.

---

## Directions

_7 renders. Each one a visible change. Brisk, not rushed._

### Prep

Clear the scene. Create render target + path tracing kernel. Connect kernel BEFORE starting render. Set resolution to 1080x1920 (portrait).

### 1. Set the mood

> "Deep space. Starfield fills the void."

Create texture environment with starfield image, power ~3.5. Create quad light — far upper-left behind, neutral-warm, high power. Connect to RT. Start render. Set hero camera. First frame: cosmos with a warm glow from the side.

### 2. Lay the table

> "Dark mirror floor. Stars reflected below."

Create geo group (8 slots). Floor mesh at 10x scale, no material yet. The starfield reflects off the bare floor.

### 3. The ring

> "Gold ring floating in space. Frame within the frame."

Ring mesh floating above floor, tilted ~15° forward. Bare white torus in position.

### 4. Crystal sphere

> "Glass sphere at the ring's center. The cosmos bends."

White sphere centered inside the ring. Two shapes nested — the composition reads immediately.

### 5. Dress the floor

> "Near-black mirror. Stars stretch across it."

Near-black glossy material on the floor. High specular, near-zero roughness. The starfield reflects as a deep pool of light.

### 6. Dress the ring

> "Gold material. Warm crescent against cold space."

Glossy metallic gold. The warm side-light catches one arc of the ring — rich metallic fire fading to shadow.

### 7. Dress the sphere

> "Crystal glass. The cosmos inverts inside it. That's the shot."

Specular glass with high IOR. The starfield refracts through the sphere — an inverted miniature universe framed by gold.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value              |
| ---------- | ------------------ |
| Position   | (0.3, 2, 3.8)      |
| Target     | (0, 0.95, 0)       |
| Resolution | 1080x1920 portrait |
| Beauty     | 1080x1920          |

### Environment

| Setting | Value                     | Notes          |
| ------- | ------------------------- | -------------- |
| Texture | ORBX/assets/starfield.jpg | Starfield HDR  |
| Power   | ~3.5                      | Visible cosmos |

### Floor

| Setting   | Value              |
| --------- | ------------------ |
| Mesh      | floor.obj, 10x     |
| Material  | Glossy             |
| Diffuse   | (0.02, 0.02, 0.02) |
| Specular  | 0.9                |
| Roughness | 0.01               |

### Gold Ring

| Setting   | Value             |
| --------- | ----------------- |
| Mesh      | ring.obj          |
| Scale     | 1.5x              |
| Position  | (0, 1.2, 0)       |
| Rotation  | ~15° forward tilt |
| Material  | Glossy            |
| Diffuse   | (1, 0.84, 0)      |
| Specular  | 1.0               |
| Roughness | 0.03              |

### Crystal Sphere (ring center)

| Setting      | Value         |
| ------------ | ------------- |
| Mesh         | sphere_hd.obj |
| Scale        | 0.55          |
| Position     | (0, 1.2, 0)   |
| Material     | Specular      |
| IOR          | 2.0           |
| Transmission | Clear         |
| Smooth       | On            |

### Light

| Setting  | Value                               |
| -------- | ----------------------------------- |
| Type     | Single quad                         |
| Position | (-6, 3, -4) — far upper-left behind |
| Color    | 4500K neutral-warm                  |
| Power    | 20000–30000                         |
| Size     | 1.5                                 |

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
| Ring   | —    | —         | —         | Glossy   | Input 2        |
| Sphere | —    | —         | —         | Specular | Input 3        |
