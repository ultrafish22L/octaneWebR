# Titan Ruin (Fallen Robot Head)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

> **Before building:** Read `CLAUDE.md` (Current Session + MCP Rules) and `docs/mcp/REFERENCE.md`. Don't improvise what's already documented. Don't improvise what's already documented.

## The Vision

A colossal fallen robot head, half-buried in earth, overgrown with vines and moss. Cracked face plate, rusted metal, ancient machinery reclaimed by nature. Golden hour light cuts across the scene from low angle — warm sun catching rusted metal edges while cool shadow fills the crevices. The scale is cathedral. This was a giant. Now it's a hill.

**Scale and decay are everything.** The robot head should feel the size of a building — achieved through camera placement (close, low, looking up) and the density of the overgrowth. This is environmental storytelling: a civilization fell here.

**Golden hour is THE look.** Warm directional sunlight from one side, raking across the rusted surface, catching every edge and crevice. Cool blue-sky fill from the opposite side. Deep shadows in the eye sockets and cracks. Classic two-light portrait but with a planet-sized subject.

**Camera: ground level, looking up.** We're in the dirt at the robot's level, slightly to one side. The cracked face plate looms over us. Vines cascade down. One cracked eye socket is visible. The horizon line cuts the robot roughly in half — bottom half buried, top half against sky.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value                                    |
| ---------- | ---------------------------------------- |
| Position   | (3, 1, 8) — ground level, slightly right |
| Target     | (0, 2, 0) — looking up at face           |
| Up         | (0, 1, 0)                                |
| Resolution | 1000x1000                                |
| DOF        | Off (aperture=0)                         |

Pull WAY back first to find model orientation. Then move to ground-level hero angle.

### Environment

| Setting | Value     | Notes                                    |
| ------- | --------- | ---------------------------------------- |
| Type    | Texture   | Dim ambient, not daylight                |
| Color   | Blue-grey | Just enough to fill deep shadows         |
| Power   | ~0.3      | Low — golden hour contrast needs shadows |

### Robot Head

| Setting  | Value                                             |
| -------- | ------------------------------------------------- |
| Mesh     | titan_ruin.obj (from OTOY Studio Hunyuan-3d v3.1) |
| Texture  | titan_ruin_tex.png                                |
| Position | (0, -2, 0) — partially buried                     |
| Rotation | (0, 15, -5) degrees — slight tilt, fallen         |
| Scale    | ~(5, 5, 5) — adjust to fill frame                 |
| Material | Universal + image texture                         |

The source image shows heavy rust, moss, and vine overgrowth baked into the texture. Hunyuan should capture this surface detail well.

### Lights

| Light    | Position    | Power | Size | Color                     | Notes               |
| -------- | ----------- | ----- | ---- | ------------------------- | ------------------- |
| Sun key  | (12, 5, -8) | 30000 | 2    | Warm gold (1.0, 0.8, 0.4) | Low angle, hard     |
| Sky fill | (-10, 8, 5) | 5000  | 10   | Cool blue (0.4, 0.6, 1.0) | Soft, opposite side |

### Render

| Setting | Value           |
| ------- | --------------- |
| Kernel  | Direct Lighting |
| Samples | 5000            |

---

## Creative Notes

- **Scale illusion**: Tight FOV + low camera angle + slight upward tilt = massive scale feeling.
- **Buried look**: Setting Y translation to -2 or lower sells the half-buried effect.
- **Texture richness**: This model lives or dies by the baked rust/moss detail. If Hunyuan texture is clean, add a subtle grunge overlay texture multiplied into the albedo.
- **Golden hour shadows**: Sun key should produce long shadows across the face. Rotate X slightly (try 10-15 degrees) to rake across surface features.
