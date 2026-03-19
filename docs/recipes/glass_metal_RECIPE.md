# Glass & Metal (Scene 1)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

> **Before building:** Read `CLAUDE.md` (Current Session + MCP Rules) and look up values in `docs/mcp/REFERENCE.md`. Don't improvise what's already documented.

## The Vision

Three spheres on a reflective floor at golden hour — gold, glass, and matte red. This is a material showcase, but it should feel like a photograph, not a product render.

The golden hour sun comes from behind and to the left, painting everything warm. The gold sphere catches it with rich metallic fire. The blue glass sphere bends the world inside itself — the sky distorts, caustic light patterns scatter across the floor beneath it. The red matte sphere is the quiet anchor — no reflections, no tricks, just pure color holding its ground between two show-offs.

The floor isn't just a surface — it's a canvas. Reflections of all three spheres stretch across it, sunset colors pool in the glossy surface, and the glass sphere's caustics paint abstract light patterns.

**Composition**: Three spheres = rule of odds. V-formation: gold and red pushed FORWARD (closer to camera), glass RECESSED at center. This creates a depth triangle — the two flanking spheres frame the glass, which sits behind and between them. The camera is offset left, not centered — asymmetric framing creates tension and interest. The glass sphere is slightly larger, occupying the dominant center position (primary focal point via caustics and refraction). Gold is secondary (warm metallic pop), red is tertiary (matte counterpoint).

**Lighting ratio**: This is a daylight scene (~2:1 ratio) — the sun is key, the sky is fill. Not dramatic, but not flat either. The warm/cool contrast between direct sun and blue sky fill does the heavy lifting.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value                |
| ---------- | -------------------- |
| Position   | (-2, 1.2, 5.5)       |
| Target     | (0, 0.2, 0)          |
| Resolution | 1024x576 interactive |
| Beauty     | 1280x720             |

### Environment (Daylight)

| Setting      | Value           | Notes                                         |
| ------------ | --------------- | --------------------------------------------- |
| Hour         | 19.5            | Late golden hour — deeper warmth than 19.0    |
| Turbidity    | 8               | Atmospheric haze                              |
| North offset | 0.35            | Sun behind-left — visible sunset + front fill |
| Sky color    | (0.7, 0.5, 0.4) | Warm amber — critical for gold sphere         |
| Sunset color | (1, 0.35, 0.08) | Deep orange-red                               |
| Sun size     | 5               | Soft shadows                                  |

### Floor

| Setting   | Value            |
| --------- | ---------------- |
| Shape     | Flat box or quad |
| Scale     | (10, 0.01, 10)   |
| Material  | Glossy           |
| Diffuse   | (0.7, 0.7, 0.7)  |
| Specular  | 1.0              |
| Roughness | 0.02             |

### Gold Sphere (left, forward)

| Setting   | Value            |
| --------- | ---------------- |
| Position  | (-1.5, 0.5, 0.8) |
| Scale     | (0.5, 0.5, 0.5)  |
| Material  | Glossy           |
| Diffuse   | (1, 0.84, 0)     |
| Specular  | 1.0              |
| Roughness | 0.15             |
| IOR       | 30               |

### Glass Sphere (center, recessed)

| Setting      | Value           |
| ------------ | --------------- |
| Position     | (0, 0.6, -0.6)  |
| Scale        | (0.6, 0.6, 0.6) |
| Material     | Specular        |
| Transmission | (0.3, 0.5, 1.0) |
| IOR          | 1.5             |

### Red Sphere (right, forward)

| Setting  | Value             |
| -------- | ----------------- |
| Position | (1.5, 0.5, 0.6)   |
| Scale    | (0.5, 0.5, 0.5)   |
| Material | Diffuse           |
| Diffuse  | (0.8, 0.05, 0.05) |

### Render

| Setting | Value        |
| ------- | ------------ |
| Samples | 5000         |
| Kernel  | Path tracing |
