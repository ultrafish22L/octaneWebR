# Space Cat (Demo Scene)

> Values below are a starting point — deviate, experiment, improve.

> **Before building:** Read `CLAUDE.md`, `docs/mcp/REFERENCE.md`, `docs/mcp/BUILD.md`.

## The Vision

A cat astronaut floating in deep space, backlit by a distant sun. Earth curves below, massive and blue. The cat's spacesuit catches rim light — a bright corona outlining the figure against the void. Cinematic space photography. Think 2001, think Gravity, think that one shot everyone remembers.

**This is a hero portrait in space.** The cat astronaut is THE subject — everything else exists to frame it. Earth provides scale and color contrast (warm suit against cool blue planet). The sun provides drama (backlight rim). The starfield provides depth. Three supporting elements, one star.

**Backlight is THE look.** Sun behind the cat, toward the camera. Low ambient, strong rim highlights on the spacesuit edges. The figure reads as a silhouette with glowing edges — the classic astronaut-in-space shot. Front fill comes from Earth's reflected light (blue bounce) and the starfield environment at low power.

**Earth is a set piece, not a subject.** A huge sphere (scale 30+) filling part of the background, slightly below. Blue diffuse or textured. It's there for scale and color — don't center it, don't feature it.

**Off-axis camera, face the cat.** Check the mesh orientation FIRST — don't shoot the cat's back. Place camera to see the face/helmet.

---

## Ingredients

_Living values — refined as discovered._

### Camera

| Setting    | Value               |
| ---------- | ------------------- |
| Position   | (8.17, 13.30, 2.82) |
| Target     | (-1.07, 2.72, 6.52) |
| Up         | (0, 1, 0)           |
| Resolution | 1000x1000 (square)  |

Camera above and to the right, looking down at cat — dramatic hero angle.

### Environment

| Setting | Value         | Notes                    |
| ------- | ------------- | ------------------------ |
| Texture | starfield.jpg | Sparse starfield         |
| Power   | 0.4           | Very low — space is dark |

Use texture environment, not daylight. Daylight shows ground gradient = doesn't read as space.

### Cat Astronaut

| Setting  | Value                             |
| -------- | --------------------------------- |
| Mesh     | cat_astronaut.obj                 |
| Texture  | cat_astronaut_tex.png             |
| Position | (0.03, 2.16, 4.09)                |
| Rotation | (66.6, 140.4, 16.5) degrees       |
| Scale    | (5, 5, 5)                         |
| Material | Diffuse + image texture on albedo |

Cat faces +Y natively. Rotation tuned for face-toward-camera.

### Earth

| Setting  | Value                             |
| -------- | --------------------------------- |
| Mesh     | sphere_hd.obj                     |
| Texture  | earth_daymap_8k.jpg               |
| Position | (2, -18, 5)                       |
| Rotation | (314.2, 109.8, 44.5) degrees      |
| Scale    | (30, 30, 30)                      |
| Material | Diffuse + earth texture on albedo |

### Lights

| Light | Position      | Power | Size | Notes            |
| ----- | ------------- | ----- | ---- | ---------------- |
| Key   | (10, 18, -15) | 15000 | 3    | Texture emission |

One light only. Positioned outside camera frame.

### Render

| Setting | Value           |
| ------- | --------------- |
| Kernel  | Direct Lighting |
| Samples | 5000            |

---

## Creative Notes

- **Mesh orientation**: ALWAYS check facing direction before placing camera.
- **Texture emission, not blackbody**: Blackbody at same power values is 40x+ brighter than texture emission. Use texture emission for quad lights.
- **Build timing**: Full DRESS build from empty scene takes roughly 4 minutes wall clock.
