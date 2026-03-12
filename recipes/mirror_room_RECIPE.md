# The Mirror Room (Scene 8)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A large glass sphere in total darkness, lit from directly above. The overhead light creates perfect concentric rainbow dispersion rings through the glass — red, yellow, green, cyan, blue, magenta — radiating outward like a bullseye of pure spectrum. Hypnotic, scientific, mesmerizing.

**This is the one scene where dead-center composition is correct.** The dispersion rings are radially symmetric — concentric circles emanating from the light source through the sphere. Off-center framing would fight the natural geometry. The camera looks straight at the sphere, front-on, at sphere-center height. Square aspect ratio (1:1) matches the circular symmetry of the rings.

**The sphere fills the frame.** Scale it large (2.0) and get close. This isn't a sphere-in-a-room — it's a sphere that IS the room, that IS the image. The viewer should feel like they're looking into a crystal ball. The overhead light source appears as a bright white rectangle reflected at the top of the sphere, surrounded by rainbow halos from the dispersion.

**Total darkness is the point.** The environment is near-zero brightness. No ambient, no fill, nothing. The only light is the quad directly overhead, and it enters the sphere and gets split into a spectrum. The darkness acts as a dark room — a controlled environment for a physics experiment rendered as art.

**High IOR (2.0) for maximum dispersion effect.** More refraction = wider spectral separation = more vivid, distinct color bands. This combined with Octane's spectral rendering produces rings that are physically correct — not a texture, not a shader, actual wavelength-dependent refraction.

---

## Directions

_6 renders. One sphere, one light, pure dispersion. Brisk, not rushed._

### Prep

Clear the scene. Create render target + path tracing kernel. Connect kernel BEFORE starting render. Set resolution to 1080x1080 (square — matches the radial symmetry).

### 1. Set the mood

> "Total darkness. One overhead light."

Create texture environment with near-zero color. Create the overhead quad light — neutral white, directly above center. Connect env to RT. Start render. Set hero camera (front-on, centered). First frame: darkness with a rectangle of light from above.

### 2. Place the sphere

> "Large glass sphere, fills the frame."

Create geo group (8 slots). Sphere mesh at 2x scale, center. Default white material. The overhead light paints the top of the sphere.

### 3. Dress the sphere

> "High-IOR glass with dispersion. Rainbow rings."

Specular glass — IOR 2.0, dispersion ON, clear transmission, smooth ON. The overhead light enters and splits into concentric spectral rings. The physics payoff.

### 4. Tune the light

> "Adjust power and size. Vivid bands."

Tweak light power and size for the most vivid, distinct spectral bands. The bright rectangle should be visible reflected at the top of the sphere.

### 5. Check framing

> "Crystal ball filling the frame."

Adjust camera distance if needed. The sphere should dominate — this is a macro shot of physics. The rings should be visible radiating outward.

### 6. Final

> "Bullseye of pure spectrum. That's the shot."

Beauty render. Maximum samples for clean spectral detail.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value                                           |
| ---------- | ----------------------------------------------- |
| Position   | (0, 0.5, 3)                                     |
| Target     | (0, 0.5, 0)                                     |
| Resolution | 1080x1080 interactive                           |
| Beauty     | 1080x1080                                       |
| Notes      | Front-on, centered — radial symmetry demands it |

### Environment

| Setting       | Value                      |
| ------------- | -------------------------- |
| Texture color | (0.005, 0.005, 0.005)      |
| Notes         | Near-zero — total darkness |

### Sphere (center)

| Setting      | Value         |
| ------------ | ------------- |
| Mesh         | sphere_hd.obj |
| Position     | (0, 0, 0)     |
| Scale        | 2.0           |
| Material     | Specular      |
| IOR          | 2.0           |
| Dispersion   | ON            |
| Transmission | Clear         |
| Smooth       | ON            |

### Light

| Setting  | Value               |
| -------- | ------------------- |
| Type     | Quad                |
| Position | (0, 3, 0)           |
| Rotation | (180, 0, 0)         |
| Color    | 5500K neutral white |
| Power    | 3000–5000           |
| Size     | 2–3                 |

### Render

| Setting | Value            |
| ------- | ---------------- |
| Samples | 5000             |
| Time    | ~25s @ 1080x1080 |

---

## Handle Map

_Fill as you build. Reference for camera tweaks and material iteration._

| Object | Mesh | Placement | Transform | Material | Geo Group Slot |
| ------ | ---- | --------- | --------- | -------- | -------------- |
| Sphere | —    | —         | —         | Specular | Input 1        |
