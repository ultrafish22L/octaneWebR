# The Sword (Rune Blade)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

> **Before building:** Read `CLAUDE.md` (Current Session + MCP Rules) and `docs/mcp/REFERENCE.md`. Don't improvise what's already documented. Don't improvise what's already documented.

## The Vision

A legendary fantasy sword floating in darkness. The blade glows with electric blue runes — the only light source in the scene. No ground, no background, just the weapon suspended in void, radiating cold power. Museum lighting meets arcane artifact. Think how a magic item feels in concept art before it becomes a game asset — mysterious, dangerous, beautiful.

**This is a product shot turned into fine art.** The sword is the only subject. Everything exists to reveal its form and the glow of the runes. No environment, no context — just the object and the light it creates.

**Rune glow is THE look.** The blue energy on the blade should be the primary light source. Rim light from above to reveal the golden crossguard and jeweled pommel. Deep shadow everywhere else. The void makes the blade feel weightless and dangerous.

**Camera: low angle, looking up the blade.** The sword is angled — tip toward the camera at roughly 45 degrees. We're looking up from just below the crossguard level. The pommel hangs in shadow. The tip catches light. Creates the feeling of enormous scale even on a small object.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value                          |
| ---------- | ------------------------------ |
| Position   | (0, 2, 8) — adjust after model |
| Target     | (0, 1, 0)                      |
| Up         | (0, 1, 0)                      |
| Resolution | 1000x1000                      |
| DOF        | Off (aperture=0)               |

Pull camera WAY back first to see full model orientation. Then move in close.

### Environment

None — pure black void.

### Sword

| Setting  | Value                                        |
| -------- | -------------------------------------------- |
| Mesh     | sword.obj (from OTOY Studio Hunyuan-3d v3.1) |
| Texture  | sword_tex.png                                |
| Rotation | Tune after checking model facing direction   |
| Scale    | ~(5, 5, 5) — adjust to fill frame            |
| Material | Universal + image texture                    |

Check OBJ orientation before placing camera. The sword may face any direction from Hunyuan export.

### Lights

| Light     | Position   | Power | Size | Color              | Notes           |
| --------- | ---------- | ----- | ---- | ------------------ | --------------- |
| Key rim   | (0, 8, -6) | 8000  | 1.5  | White              | Top-rear, hard  |
| Rune fill | (2, 1, 3)  | 3000  | 4    | Blue (0.2, 0.5, 1) | Front soft fill |

### Render

| Setting | Value           |
| ------- | --------------- |
| Kernel  | Direct Lighting |
| Samples | 5000            |

---

## Creative Notes

- **Rune glow from texture vs lighting**: The blue on the blade in the source image is texture — Hunyuan may or may not capture it. If not, the blue fill light creates the effect.
- **Orientation**: Sword likely needs rotation to angle tip toward camera at ~45 degrees.
- **Scale**: Sword may be tiny by default. Scale up until it fills the frame.
