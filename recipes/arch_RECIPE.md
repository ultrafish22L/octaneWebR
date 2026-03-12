# The Arch (Scene 13)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A sci-fi gateway — two tall gold pillars connected by a chrome ring at the top, with a glowing orb floating at center. Ancient architecture meets cosmic technology. A portal to somewhere.

**The gateway is a framing device.** The two pillars and connecting ring create a physical frame — the viewer looks _through_ the arch at whatever lies beyond. The starfield visible between the pillars becomes the destination. The glowing orb at center is the activation point, the power source, the mystery. This is classic leading-lines composition: the pillars draw the eye upward to the ring, then inward to the orb, then through to the stars.

**Two-tone metallic creates visual hierarchy.** Gold pillars (warm, ancient, monumental) contrasted with a chrome ring (cool, technological, precise). Warm metal for the structural elements, cool metal for the connecting element. This warm/cool material split reinforces the sense of two different civilizations or eras meeting in one structure.

**The emissive orb provides inner illumination.** A small sphere at the arch center with blackbody emission (4500K, 500-1000 power). It illuminates the inner surfaces of the pillars and ring from within — warm light painting the gold surfaces closest to it, creating an intimate glow that contrasts with the overhead key light's broader illumination. The orb is both decoration and functional light source.

**Architectural scale through camera height.** Eye-level camera (y=1.0), looking slightly upward into the gateway. This is how you'd experience a monumental doorway — standing before it, looking up. The slight upward gaze makes the arch feel tall and imposing. Too high and it's a diorama; too low and the proportions distort.

**Starfield at low power for depth.** The environment is deep space — visible stars, but subdued. The key light and emissive orb provide the main illumination. The starfield acts as the deep background layer, creating depth behind the arch structure. The mirror floor reflects the entire arch downward, doubling the gateway into an infinite corridor.

---

## Directions

_10 renders. Each one a visible change. Brisk, not rushed._

### Prep

Clear the scene. Create render target + path tracing kernel. Connect kernel BEFORE starting render. Set resolution to 1000x563.

### 1. Set the mood

> "Starfield. Deep space backdrop."

Create texture environment with starfield image, power 1.5. Connect to RT. Start render. Set hero camera. First thing visible: stars through the void at the final camera angle.

### 2. Lay the table

> "Mirror floor. The gateway doubles downward."

Create geo group (8 slots). Floor mesh at 10x scale, no material yet. The starfield reflects faintly off the bare floor.

### 3. Left pillar

> "First pillar rises. Scale and presence."

Bare white pillar on the left side. Tall, narrow, monumental.

### 4. Right pillar

> "Second pillar. The gateway frame takes shape."

Mirror pillar on the right. The arch doorway is now readable even without materials.

### 5. Chrome ring

> "Ring spans the top. The arch is complete."

Ring mesh connecting the two pillars at the top. The structural form is all there.

### 6. Orb

> "Glowing orb at center. The power source."

Small sphere at the arch center. Still default white for now — the emission comes with its material.

### 7. Dress the floor

> "Black mirror. The arch reflects infinitely downward."

Glossy near-black material on the floor. Deep reflections of the pillars stretch below.

### 8. Dress the pillars

> "Gold pillars. Ancient warmth."

Glossy metallic gold on both pillars. The starfield catches in the gold surfaces.

### 9. Dress the ring

> "Chrome ring. Cool tech against warm gold."

Glossy chrome on the ring. The warm/cool material split reads immediately.

### 10. Dress the orb

> "Orb glows. That's the shot."

Diffuse material with blackbody emission on the orb. Warm light paints the inner arch surfaces. Scene complete.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value                |
| ---------- | -------------------- |
| Position   | (0.3, 1, 5)          |
| Target     | (0, 1.2, 0)          |
| Resolution | 1000x563 interactive |
| Beauty     | 1280x720             |

### Environment

| Setting | Value                       | Notes                 |
| ------- | --------------------------- | --------------------- |
| Texture | `ORBX/assets/starfield.jpg` | Deep space backdrop   |
| Power   | 1.5                         | Subdued, not dominant |

### Floor

| Setting   | Value              |
| --------- | ------------------ |
| Mesh      | floor.obj, 10x     |
| Material  | Glossy             |
| Diffuse   | (0.02, 0.02, 0.03) |
| Specular  | 0.9                |
| Roughness | 0.01               |

### Left Pillar

| Setting   | Value          |
| --------- | -------------- |
| Mesh      | pillar.obj     |
| Position  | symmetric left |
| Material  | Glossy         |
| Diffuse   | (1, 0.84, 0)   |
| Specular  | 1.0            |
| Roughness | 0.1            |

### Right Pillar

| Setting   | Value           |
| --------- | --------------- |
| Mesh      | pillar.obj      |
| Position  | symmetric right |
| Material  | Glossy          |
| Diffuse   | (1, 0.84, 0)    |
| Specular  | 1.0             |
| Roughness | 0.1             |

### Chrome Ring

| Setting   | Value            |
| --------- | ---------------- |
| Mesh      | ring.obj         |
| Position  | top of pillars   |
| Material  | Glossy           |
| Diffuse   | (0.9, 0.9, 0.92) |
| Specular  | 1.0              |
| Roughness | 0.01             |

### Orb (center)

| Setting  | Value              |
| -------- | ------------------ |
| Mesh     | sphere_hd.obj      |
| Position | center of arch     |
| Scale    | small              |
| Material | Diffuse + emission |
| Emission | Blackbody 4500K    |
| Power    | 500–1000           |

### Light

| Setting     | Value     |
| ----------- | --------- |
| Type        | Quad      |
| Position    | (0, 4, 2) |
| Temperature | 4500K     |
| Power       | 2000–5000 |
| Size        | 3         |

### Render

| Setting | Value           |
| ------- | --------------- |
| Samples | 5000            |
| Time    | ~20s @ 1000x563 |

---

## Handle Map

_Fill as you build. Reference for camera tweaks and material iteration._

| Object       | Mesh | Placement | Transform | Material | Geo Group Slot |
| ------------ | ---- | --------- | --------- | -------- | -------------- |
| Floor        | —    | —         | —         | Glossy   | Input 1        |
| Left Pillar  | —    | —         | —         | Glossy   | Input 2        |
| Right Pillar | —    | —         | —         | Glossy   | Input 3        |
| Ring         | —    | —         | —         | Glossy   | Input 4        |
| Orb          | —    | —         | —         | Diffuse  | Input 5        |
