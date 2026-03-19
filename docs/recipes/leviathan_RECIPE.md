# Deep Sea Leviathan

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

> **Before building:** Read `CLAUDE.md` (Current Session + MCP Rules) and `docs/mcp/REFERENCE.md`. Don't improvise what's already documented. Don't improvise what's already documented.

## The Vision

A translucent deep-sea horror floating in the abyss. Bioluminescent organs pulse through its body — cyan and blue-green light glowing from within, casting cold light outward into crushing darkness. The creature is terrifying and beautiful simultaneously. Think _Alien_ meets deep-sea documentary, the kind of image that makes you afraid of the ocean.

**Bioluminescence IS the lighting rig.** No external key light. The creature lights itself and the surrounding water. The scene should feel like total darkness broken only by the creature's own cold fire.

**The creature should feel MASSIVE.** Low camera angle, creature filling most of the frame. Small bubbles or particles optional (can skip if they complicate the build). The creature's translucent body should show internal structure — ribs, organs, the lure filament.

**Camera: eye-level, slightly below.** Looking up at the creature slightly. The lure antenna hangs above frame. The jaw/fang array dominates the foreground. The bioluminescent glow creates a halo around the creature against absolute black.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value                        |
| ---------- | ---------------------------- |
| Position   | (0, -1, 10) — slightly below |
| Target     | (0, 0, 0)                    |
| Up         | (0, 1, 0)                    |
| Resolution | 1000x1000                    |
| DOF        | Off (aperture=0)             |

Start pulled WAY back to find and orient the creature first.

### Environment

None — total black abyss.

### Leviathan

| Setting  | Value                                            |
| -------- | ------------------------------------------------ |
| Mesh     | leviathan.obj (from OTOY Studio Hunyuan-3d v3.1) |
| Texture  | leviathan_tex.png                                |
| Position | (0, 0, 0)                                        |
| Rotation | Check facing — should look toward camera         |
| Scale    | ~(5, 5, 5) — creature should fill frame          |
| Material | Universal + image texture                        |

The source image shows a translucent body. Hunyuan will model the silhouette and surface. The translucency effect comes from the lighting — strong internal-feeling glow.

### Lights

| Light            | Position  | Power | Size | Color                      | Notes             |
| ---------------- | --------- | ----- | ---- | -------------------------- | ----------------- |
| Bio fill (large) | (0, 0, 2) | 5000  | 8    | Cyan-green (0.1, 0.9, 0.7) | Soft overall glow |
| Lure point       | Near lure | 20000 | 0.3  | Cold blue (0.3, 0.6, 1.0)  | Hot spot on lure  |

### Render

| Setting | Value           |
| ------- | --------------- |
| Kernel  | Direct Lighting |
| Samples | 5000            |

---

## Creative Notes

- **Creature facing**: Check OBJ forward direction before finalizing camera. Rotate to face camera.
- **Scale**: Deep sea creatures feel bigger when camera is slightly below, looking up.
- **Material fallback**: If Hunyuan texture is missing or sparse, Universal material with a subtle cyan tint can carry the look.
