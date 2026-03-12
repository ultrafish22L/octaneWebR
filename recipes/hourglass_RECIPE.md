# The Hourglass (Scene 11)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

Two spheres stacked vertically — polished gold on the bottom, blue glass on top. A single warm side-light. The warm and cool materials together in one vertical composition, each transforming the same light differently.

**This is a material contrast study.** The gold sphere is opaque, reflective, warm — it catches the side-light as a rich metallic streak, a crescent of fire. The blue glass sphere above is semi-transparent — the gold sphere below is visible distorted through it, refracted and shifted blue. The same warm light creates completely different effects on each material. Metal reflects; glass refracts. Warm absorbs; cool transmits.

**The mirror floor creates three things, not two.** The reflection doubles the stacked pair into a column of four — gold-blue-blue-gold stretching from reflection to reality to glass to gold. The warm light streak reflects too, becoming a luminous band cutting across the dark mirror surface.

**Warm side-light, no fill.** Single warm amber light from the side (3500K, 3000-5000 power). The warm temperature favors the gold sphere — it blazes. The blue glass absorbs some of the warm light and transmits it cooler — the natural filtering creates the warm/cool contrast without needing two different colored lights. Lighting ratio is 4:1+ — dramatic but not noir-level black.

**Low camera on the warm side.** Position on the lit side, at y=0.4, looking slightly up at the stacked pair. This makes the composition feel tall and sculptural. The warm-lit faces of both spheres are presented to the camera while the shadow sides fall away. Portrait orientation matches the vertical stack.

**Quad light through glass warning.** The light will be visible through the blue glass sphere as a refracted rectangle. Position it so the refraction is either out of the glass sphere's direct transmission path, or accept it as part of the warm glow. The glass will warp and color-shift the refracted shape — sometimes this looks intentional and beautiful.

---

## Directions

_7 renders. Each one a visible change. Brisk, not rushed._

### Prep

Clear the scene. Create render target + path tracing kernel. Connect kernel BEFORE starting render. Set resolution to 1080x1920 (portrait).

### 1. Set the mood

> "Dark studio. Single warm side-light. Dramatic."

Create texture environment with near-black color. Create quad light — warm amber, side position, elevated. Connect to RT. Start render. Set hero camera. First frame: dark void with a warm glow from the side.

### 2. Lay the table

> "Mirror floor. That warm streak already cutting across."

Create geo group (8 slots). Floor mesh at 10x scale, no material yet. The quad light reflects as a bright streak across the default floor.

### 3. Gold sphere

> "Gold sphere on the floor. Catching the side-light."

Bare white sphere in the bottom position. Shape and placement only.

### 4. Blue glass sphere

> "Glass on top. Stacked pair."

Second white sphere resting on the gold sphere. The vertical composition reads immediately.

### 5. Dress the floor

> "Dark mirror. The light streak sharpens."

Near-black glossy material on the floor. High specular, near-zero roughness. The warm light becomes a luminous band.

### 6. Dress the gold

> "Gold material. Metallic fire on the lit side."

Glossy metallic gold. The side-light paints a crescent of warm metallic fire across the sphere.

### 7. Dress the glass

> "Blue glass on top. Warm below, cool above. That's the shot."

Specular glass with blue transmission on the top sphere. The gold sphere distorts through it, shifted blue. Warm and cool in one vertical stack.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value              |
| ---------- | ------------------ |
| Position   | (2, 0.4, 3)        |
| Target     | (0, 0.5, 0)        |
| Resolution | 1080x1920 portrait |
| Beauty     | 1080x1920          |

### Environment

| Setting       | Value              | Notes             |
| ------------- | ------------------ | ----------------- |
| Texture color | (0.02, 0.02, 0.03) | Near-black studio |
| Power         | ~0.25              | Minimal ambient   |

### Floor

| Setting   | Value              |
| --------- | ------------------ |
| Mesh      | floor.obj, 10x     |
| Material  | Glossy             |
| Diffuse   | (0.03, 0.03, 0.04) |
| Specular  | 0.9                |
| Roughness | 0.01               |

### Gold Sphere (bottom)

| Setting   | Value            |
| --------- | ---------------- |
| Mesh      | sphere_hd.obj    |
| Scale     | ~0.6             |
| Position  | On floor (y=0.3) |
| Material  | Glossy           |
| Diffuse   | (1, 0.84, 0)     |
| Specular  | 1.0              |
| Roughness | 0.02             |

### Blue Glass Sphere (top)

| Setting      | Value           |
| ------------ | --------------- |
| Mesh         | sphere_hd.obj   |
| Scale        | ~0.6            |
| Position     | On top of gold  |
| Material     | Specular        |
| Transmission | (0.3, 0.5, 1.0) |
| IOR          | 1.5             |
| Smooth       | On              |

### Light

| Setting  | Value                      |
| -------- | -------------------------- |
| Type     | Single quad                |
| Position | (3, 2, 1) — side, elevated |
| Color    | 3500K warm amber           |
| Power    | 3000–5000                  |
| Size     | 2–3                        |

### Render

| Setting | Value        |
| ------- | ------------ |
| Samples | 5000         |
| Kernel  | Path tracing |

---

## Handle Map

_Fill as you build. Reference for camera tweaks and material iteration._

| Object     | Mesh | Placement | Transform | Material | Geo Group Slot |
| ---------- | ---- | --------- | --------- | -------- | -------------- |
| Floor      | —    | —         | —         | Glossy   | Input 1        |
| Gold       | —    | —         | —         | Glossy   | Input 2        |
| Blue Glass | —    | —         | —         | Specular | Input 3        |
