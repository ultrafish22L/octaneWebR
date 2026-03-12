# The Cluster (Scene 10)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

Five colored glass marbles clustered together on a dark reflective floor. Each marble transmits its own jewel color — ruby, sapphire, emerald, amber, amethyst — and each casts its color as caustic light onto the dark floor below. A celebration of colored glass and Octane's spectral rendering.

**Five marbles = rule of odds.** The grouping feels natural and dynamic because odd numbers prevent the brain from pairing objects into static couples. Arrange them as a loose, organic cluster — some touching, some with small gaps — not a grid, not a line, not a perfect pentagon. Natural randomness sells realism.

**The dark floor is the gallery wall.** Each marble projects its transmission color onto the dark surface as caustic light — five distinct pools of jewel-toned color. Ruby red, sapphire blue, emerald green, amber gold, amethyst purple. The dark mirror surface also reflects each marble from below, creating a jewel-box-within-a-jewel-box doubling effect.

**Colored transmission solves the invisible glass problem.** Clear glass is invisible in uniform lighting — only caustic shadows reveal it. These saturated transmission colors ensure each marble is immediately visible, distinct, and vivid. The colors aren't painted on — they're the result of wavelength-selective absorption through the glass, physically accurate in Octane's spectral engine.

**Daylight at low power for natural illumination.** Not too bright — intimate, not overexposed. Daylight provides enough warm+cool spectrum to illuminate all five colors. Note: amber glass absorbs blue/green wavelengths, so the amber marble may appear darker than the others under cool-dominant light. That's correct physics.

**Elevated three-quarter view.** Camera above and to the side, looking down into the cluster. This angle shows each marble's color clearly and reveals the caustic light patterns on the floor between and around the group. Portrait orientation (1080x1920) emphasizes the cluster's vertical depth when viewed at this angle.

---

## Directions

_9 renders. Each one a visible change. Brisk, not rushed._

### Prep

Clear the scene. Create render target + path tracing kernel. Connect kernel BEFORE starting render. Set resolution to 1024x1024 (square, crop to portrait later or use 576x1024).

### 1. Set the mood

> "Low daylight. Intimate, not bright."

Create daylight environment with low power (~0.3). Connect to RT. Start render. Set hero camera. First thing visible: subdued daylight from above at the final angle.

### 2. Lay the table

> "Dark mirror floor. The gallery wall."

Create geo group (8 slots). Floor mesh at 10x scale, no material yet. Faint daylight reflects off the bare surface.

### 3. Ruby marble

> "Ruby, front left. First jewel down."

Bare white sphere in position. The cluster starts.

### 4. Sapphire marble

> "Sapphire, right. Second jewel."

Second white sphere. Two down, the grouping begins to read.

### 5. Emerald marble

> "Emerald, back center. Triangle forms."

Third white sphere. The cluster has depth now.

### 6. Amber marble

> "Amber, tucked left. Organic scatter."

Fourth white sphere. The cluster feels natural, not gridded.

### 7. Amethyst marble

> "Amethyst completes the five. All placed."

Fifth white sphere. All geometry positioned in a loose, organic cluster.

### 8. Dress the floor

> "Dark mirror. The caustics need this surface."

Glossy near-black material on the floor. Dark enough to show caustic color pools.

### 9. Dress all five marbles

> "Five jewel colors. That's the shot."

Specular glass materials on all five marbles — ruby, sapphire, emerald, amber, amethyst. Each marble lights up with its transmission color, caustics scatter onto the dark floor. Scene complete.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value                 |
| ---------- | --------------------- |
| Position   | (2, 2, 3)             |
| Target     | (0, 0.2, 0)           |
| Resolution | 1024x1024 interactive |
| Beauty     | 1080x1920 portrait    |

### Environment

| Setting | Value    | Notes                               |
| ------- | -------- | ----------------------------------- |
| Type    | Daylight | Warm+cool spectrum for all 5 colors |
| Power   | ~0.3     | Intimate, not overexposed           |

### Floor

| Setting   | Value              |
| --------- | ------------------ |
| Mesh      | floor.obj, 10x     |
| Material  | Glossy             |
| Diffuse   | (0.05, 0.05, 0.06) |
| Specular  | 0.8                |
| Roughness | 0.02               |

### Ruby Marble (front left)

| Setting      | Value         |
| ------------ | ------------- |
| Mesh         | sphere_hd.obj |
| Scale        | ~0.6          |
| Material     | Specular      |
| IOR          | 1.5           |
| Transmission | (1, 0.1, 0.1) |
| Smooth       | on            |

### Sapphire Marble (right)

| Setting      | Value         |
| ------------ | ------------- |
| Mesh         | sphere_hd.obj |
| Scale        | ~0.6          |
| Material     | Specular      |
| IOR          | 1.5           |
| Transmission | (0.1, 0.2, 1) |
| Smooth       | on            |

### Emerald Marble (back center)

| Setting      | Value           |
| ------------ | --------------- |
| Mesh         | sphere_hd.obj   |
| Scale        | ~0.6            |
| Material     | Specular        |
| IOR          | 1.5             |
| Transmission | (0.1, 0.8, 0.2) |
| Smooth       | on              |

### Amber Marble (tucked left)

| Setting      | Value         |
| ------------ | ------------- |
| Mesh         | sphere_hd.obj |
| Scale        | ~0.6          |
| Material     | Specular      |
| IOR          | 1.5           |
| Transmission | (1, 0.7, 0.1) |
| Smooth       | on            |

### Amethyst Marble (back right)

| Setting      | Value           |
| ------------ | --------------- |
| Mesh         | sphere_hd.obj   |
| Scale        | ~0.6            |
| Material     | Specular        |
| IOR          | 1.5             |
| Transmission | (0.6, 0.1, 0.8) |
| Smooth       | on              |

### Render

| Setting | Value            |
| ------- | ---------------- |
| Samples | 5000             |
| Time    | ~25s @ 1024x1024 |

---

## Handle Map

_Fill as you build. Reference for camera tweaks and material iteration._

| Object   | Mesh | Placement | Transform | Material | Geo Group Slot |
| -------- | ---- | --------- | --------- | -------- | -------------- |
| Floor    | —    | —         | —         | Glossy   | Input 1        |
| Ruby     | —    | —         | —         | Specular | Input 2        |
| Sapphire | —    | —         | —         | Specular | Input 3        |
| Emerald  | —    | —         | —         | Specular | Input 4        |
| Amber    | —    | —         | —         | Specular | Input 5        |
| Amethyst | —    | —         | —         | Specular | Input 6        |
