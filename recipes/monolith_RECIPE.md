# The Monolith (Scene 5)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A dark rectangular monolith standing impossibly balanced on top of a glass sphere. _2001: A Space Odyssey_ meets crystal ball. Surreal, mysterious, iconic.

The monolith is an absence — near-black matte, no reflections, no highlights, pure geometric void. It's the anti-material: while the sphere below refracts light into rainbow prismatic rings, the monolith absorbs everything. This contrast IS the scene. Organic roundness vs. geometric austerity. Rainbow light vs. total darkness. Spectral physics vs. matte silence.

**The glass sphere is the pedestal and the show.** High IOR (1.8) crystal glass with dispersion enabled — rainbow concentric rings appear where the side-light enters at a glancing angle. The monolith's dark reflection distorts inside the sphere, visible through the chromatic shimmer. The sphere catches all the light; the monolith rejects it.

**Side/back lighting creates a silhouette composition.** The light comes from the side and slightly behind — it catches the sphere's curved surface at a glancing angle (maximizing dispersion) while the monolith remains a dark silhouette. This is a 4:1+ lighting ratio with the dark environment providing minimal fill. The eye goes to the brightest area first (prismatic sphere) then travels up the dark monolith shape.

**Low camera looking up = monumentality.** At y=0.5, looking slightly upward, the stacked composition feels impossibly tall and alien. The floor catches prismatic caustics and the monolith's shadow. The slight blue undertone in the environment hints at something otherworldly.

---

## Directions

_7 renders. Each one a visible change. Brisk, not rushed._

### Prep

Clear the scene. Create render target + path tracing kernel. Connect kernel BEFORE starting render. Set resolution to 1024x576.

### 1. Set the mood

> "Dark void with a blue undertone. Alien atmosphere."

Create texture environment with dark blue-tinted color. Create quad light — neutral-cool, side/behind position. Connect to RT. Start render. Set hero camera low. First frame: dark space with a single directional light.

### 2. Lay the table

> "Floor down. Catching the side-light."

Create geo group (8 slots). Floor mesh at 10x scale, no material yet. Light reflects off the bare floor.

### 3. Crystal sphere

> "Glass sphere on the floor. The pedestal."

Bare white sphere at center. Shape and placement only.

### 4. The monolith

> "Dark slab balanced on the sphere. Surreal."

Monolith mesh standing on top of the sphere. Two shapes stacked — the impossible balance reads immediately.

### 5. Dress the floor

> "Concrete floor. Subtle, not competing."

Glossy material on the floor — neutral grey, moderate specular. Catches prismatic caustics without stealing focus.

### 6. Dress the sphere

> "Crystal glass. Dispersion on. Rainbow rings where the light hits."

Specular glass with high IOR and dispersion. The side-light enters at a glancing angle and splits into a prismatic spectrum.

### 7. Dress the monolith

> "Near-black matte. Pure void against the rainbow. That's the shot."

Diffuse near-black material. The monolith absorbs everything while the sphere below blazes with spectral color. Maximum contrast.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value                |
| ---------- | -------------------- |
| Position   | (1.2, 0.5, 4)        |
| Target     | (0, 0.8, 0)          |
| Resolution | 1024x576 interactive |
| Beauty     | 1280x720             |

### Environment

| Setting       | Value              | Notes                 |
| ------------- | ------------------ | --------------------- |
| Texture color | (0.05, 0.05, 0.07) | Dark with subtle blue |

### Floor

| Setting   | Value            |
| --------- | ---------------- |
| Mesh      | floor.obj, 10x   |
| Material  | Glossy           |
| Diffuse   | (0.6, 0.6, 0.62) |
| Specular  | 0.5              |
| Roughness | 0.08             |

### Crystal Sphere (bottom)

| Setting    | Value         |
| ---------- | ------------- |
| Mesh       | sphere_hd.obj |
| Scale      | ~1.0          |
| Position   | On floor      |
| Material   | Specular      |
| IOR        | 1.8           |
| Dispersion | On            |
| Smooth     | On            |

### Monolith (top)

| Setting  | Value              |
| -------- | ------------------ |
| Mesh     | monolith.obj       |
| Position | Standing on sphere |
| Material | Diffuse            |
| Diffuse  | (0.02, 0.02, 0.02) |

### Light

| Setting  | Value                      |
| -------- | -------------------------- |
| Type     | Single quad                |
| Position | (3, 2.5, -1) — side/behind |
| Color    | 6000K neutral-cool         |
| Power    | 1000–3000                  |
| Size     | 2                          |

### Render

| Setting | Value        |
| ------- | ------------ |
| Samples | 5000         |
| Kernel  | Path tracing |

---

## Handle Map

_Fill as you build. Reference for camera tweaks and material iteration._

| Object   | Mesh | Placement | Transform | Material | Geo Group Slot |
| -------- | ---- | --------- | --------- | -------- | -------------- |
| Floor    | —    | —         | —         | Glossy   | Input 1        |
| Sphere   | —    | —         | —         | Specular | Input 2        |
| Monolith | —    | —         | —         | Diffuse  | Input 3        |

---

### Floor Texture (Optional)

```
brushed light concrete surface, seamless tileable texture, flat orthographic top-down material scan,
evenly lit diffuse studio lighting, no shadows no highlights no reflections,
PBR albedo map, photorealistic, square 1:1
```
