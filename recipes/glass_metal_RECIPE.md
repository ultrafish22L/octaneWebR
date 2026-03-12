# Glass & Metal (Scene 1)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

Three spheres on a reflective floor at golden hour — gold, glass, and matte red. This is a material showcase, but it should feel like a photograph, not a product render.

The golden hour sun comes from behind and to the left, painting everything warm. The gold sphere catches it with rich metallic fire. The blue glass sphere bends the world inside itself — the sky distorts, caustic light patterns scatter across the floor beneath it. The red matte sphere is the quiet anchor — no reflections, no tricks, just pure color holding its ground between two show-offs.

The floor isn't just a surface — it's a canvas. Reflections of all three spheres stretch across it, sunset colors pool in the glossy surface, and the glass sphere's caustics paint abstract light patterns. Consider a marble or polished stone texture instead of flat grey — it's the difference between "CG ground plane" and "real surface."

**Composition**: Three spheres = rule of odds. V-formation: gold and red pushed FORWARD (closer to camera), glass RECESSED at center. This creates a depth triangle — the two flanking spheres frame the glass, which sits behind and between them. The camera is offset left, not centered — asymmetric framing creates tension and interest. The glass sphere is slightly larger, occupying the dominant center position (primary focal point via caustics and refraction). Gold is secondary (warm metallic pop), red is tertiary (matte counterpoint). The eye travels: glass caustics → gold highlights → red warmth → floor reflections → sunset sky.

**Depth**: The V-formation creates real Z-depth between objects, not just perspective tricks. Warm foreground (sunset-lit gold and red) against cool blue sky gradient = natural depth separation. The recessed glass sphere adds a mid-layer. The floor reflections create a "below" layer, doubling the depth. The visible sky gives a "beyond" layer.

**Lighting ratio**: This is a daylight scene (~2:1 ratio) — the sun is key, the sky is fill. Not dramatic, but not flat either. The warm/cool contrast between direct sun and blue sky fill does the heavy lifting.

---

## Directions

_9 renders. Each one a visible change. Brisk, not rushed._

### Prep

Clear the scene. Create render target + path tracing kernel. Connect kernel BEFORE starting render. Set resolution to 1024x576.

### 1. Set the mood

> "Sunset sky. Sets the whole mood."

Create daylight environment with final values. Connect to RT. Start render. Set hero camera. First thing the boss sees: warm golden hour sky at the final camera angle.

### 2. Lay the table

> "Floor down. Already catching reflections."

Create geo group (8 slots). Floor mesh at 10x scale, no material yet — default white is fine. The sunset sky reflects off the bare floor.

### 3. Gold sphere

> "Gold sphere, left side."

Bare white sphere in the left-forward position. Shape and placement only.

### 4. Glass sphere

> "Glass sphere, center back. V-formation."

Second white sphere, center and recessed. The depth triangle starts to read.

### 5. Red sphere

> "Red sphere, right. All three placed."

Third white sphere completes the trio. All geometry in position, all default white.

### 6. Dress the floor

> "Mirror floor. Watch those sunset reflections."

Glossy material on the floor. Near-mirror finish. The sunset blooms across the surface.

### 7. Dress the gold

> "Gold material. Warm metallic."

Glossy metallic gold. The sphere catches the warm sky and lights up.

### 8. Dress the glass

> "Glass. Blue tint, caustics on the floor."

Specular glass with blue transmission. Light bends through it, caustic patterns scatter below.

### 9. Dress the red

> "Matte red. That's the shot."

Diffuse red. The quiet anchor. Scene complete.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value                |
| ---------- | -------------------- |
| Position   | (-1.5, 0.9, 4.2)     |
| Target     | (0, 0.15, 0)         |
| Resolution | 1024x576 interactive |
| Beauty     | 1280x720             |

### Environment

| Setting      | Value           | Notes                                 |
| ------------ | --------------- | ------------------------------------- |
| Hour         | 19.0            | Golden hour sunset                    |
| Turbidity    | 8               | Atmospheric haze                      |
| Sky color    | (0.7, 0.5, 0.4) | Warm amber — critical for gold sphere |
| Sunset color | (1, 0.35, 0.08) | Deep orange-red                       |
| Sun size     | 5               | Soft shadows                          |

### Floor

| Setting   | Value           |
| --------- | --------------- |
| Mesh      | floor.obj, 10x  |
| Material  | Glossy          |
| Diffuse   | (0.7, 0.7, 0.7) |
| Specular  | 1.0             |
| Roughness | 0.02            |

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
| IOR       | 30               |

### Glass Sphere (center, recessed)

| Setting      | Value           |
| ------------ | --------------- |
| Mesh         | sphere_hd.obj   |
| Position     | (0, 0.38, -0.3) |
| Scale        | 0.75            |
| Material     | Specular        |
| Transmission | (0.3, 0.5, 1.0) |

### Red Sphere (right, forward)

| Setting  | Value             |
| -------- | ----------------- |
| Mesh     | sphere_hd.obj     |
| Position | (0.9, 0.3, 0.3)   |
| Scale    | 0.6               |
| Material | Diffuse           |
| Diffuse  | (0.8, 0.05, 0.05) |

### Render

| Setting | Value           |
| ------- | --------------- |
| Samples | 5000            |
| Time    | ~20s @ 1024x576 |

---

## Handle Map

_Fill as you build. Reference for camera tweaks and material iteration._

| Object | Mesh | Placement | Transform | Material | Geo Group Slot |
| ------ | ---- | --------- | --------- | -------- | -------------- |
| Floor  | —    | —         | —         | Glossy   | Input 1        |
| Gold   | —    | —         | —         | Glossy   | Input 2        |
| Glass  | —    | —         | —         | Specular | Input 3        |
| Red    | —    | —         | —         | Diffuse  | Input 4        |
