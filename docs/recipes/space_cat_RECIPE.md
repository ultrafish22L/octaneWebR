# Space Cat (Demo Scene)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

> **Before building:** Read `CLAUDE.md` (Current Session + MCP Rules) and `docs/mcp/REFERENCE.md`. Don't improvise what's already documented. Don't improvise what's already documented.

## The Vision

A cat astronaut floating in deep space, backlit by a distant sun. Earth curves below, massive and blue. The cat's spacesuit catches rim light — a bright corona outlining the figure against the void. Cinematic space photography. Think 2001, think Gravity, think that one shot everyone remembers.

**This is a hero portrait in space.** The cat astronaut is THE subject — everything else exists to frame it. Earth provides scale and color contrast (warm suit against cool blue planet). The sun provides drama (backlight rim). The starfield provides depth. Three supporting elements, one star.

**Backlight is THE look.** Sun behind the cat, toward the camera. Low ambient, strong rim highlights on the spacesuit edges. The figure reads as a silhouette with glowing edges — the classic astronaut-in-space shot. Front fill comes from Earth's reflected light (blue bounce) and the starfield environment at low power.

**Earth is a set piece, not a subject.** A huge sphere (scale 30+) filling part of the background, slightly below. Blue diffuse or textured. It's there for scale and color — don't center it, don't feature it. The cat is the subject. Earth is the backdrop.

**Off-axis camera, face the cat.** Check the OBJ orientation FIRST — don't shoot the cat's back. Place camera to see the face/helmet. The cat should feel like it's looking at us (or past us) while floating weightless.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value               |
| ---------- | ------------------- |
| Position   | (8.17, 13.30, 2.82) |
| Target     | (-1.07, 2.72, 6.52) |
| Up         | (0, 1, 0)           |
| FOV        | 39.598 degrees      |
| Resolution | 1000x1000 (square)  |
| DOF        | Off (aperture=0)    |

Camera above and to the right, looking down at cat — dramatic hero angle.

### Environment

| Setting | Value         | Notes                    |
| ------- | ------------- | ------------------------ |
| Texture | starfield.jpg | Sparse starfield         |
| Power   | 0.4           | Very low — space is dark |

### Cat Astronaut

| Setting  | Value                                                      |
| -------- | ---------------------------------------------------------- |
| Mesh     | cat_astronaut.obj                                          |
| Texture  | cat_astronaut_tex.png                                      |
| Position | (0.03, 2.16, 4.09)                                         |
| Rotation | (66.6, 140.4, 16.5) degrees — tuned for face-toward-camera |
| Scale    | (5, 5, 5)                                                  |
| Material | Universal + image texture                                  |

Cat faces +Y natively. Rotation values are degrees, not radians.

### Earth

| Setting  | Value                                                   |
| -------- | ------------------------------------------------------- |
| Mesh     | sphere_hd.obj                                           |
| Texture  | earth_daymap_8k.jpg                                     |
| Position | (2, -18, 5)                                             |
| Rotation | (314.2, 109.8, 44.5) degrees — tuned for continent view |
| Scale    | (30, 30, 30)                                            |
| Material | Diffuse + earth texture                                 |

### Lights

| Light | Position      | Power | Size | Notes                   |
| ----- | ------------- | ----- | ---- | ----------------------- |
| Key   | (10, 18, -15) | 15000 | 3    | White, texture emission |

One light only. Positioned outside camera frame.

### Render

| Setting | Value           |
| ------- | --------------- |
| Kernel  | Direct Lighting |
| Samples | 5000            |

---

## Creative Notes

- **OBJ orientation**: ALWAYS check facing direction before placing camera.
- **Daylight environment = wrong**: Ground gradient visible means it doesn't read as space. Use texture environment with starfield.
- **Don't flip camera up vector**: Cat faces +Y, so the temptation is to flip camera up to (0, -1, 0) — this breaks camera refresh and causes 180-degree flips. Instead, rotate the cat model to face the camera with standard up vector.
- **Earth inversion**: Was caused by flipped camera up vector. Standard up vector (0, 1, 0) renders Earth correctly with Asia visible and properly oriented.
- **Texture emission, not blackbody**: Blackbody at same power values is 40x+ brighter than texture emission. Always use texture emission for quad lights.
- **Atmosphere shell glow**: Emissive thin shell around Earth didn't produce visible horizon glow at this camera distance. Needs volumetric medium or post-processing bloom.
- **Build timing**: Full DRESS build from empty scene takes roughly 4 minutes wall clock.
