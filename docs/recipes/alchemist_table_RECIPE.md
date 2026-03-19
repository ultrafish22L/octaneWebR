# The Alchemist's Table

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

> **Before building:** Read `CLAUDE.md` (Current Session + MCP Rules) and `docs/mcp/REFERENCE.md`. Don't improvise what's already documented. Don't improvise what's already documented.

## The Vision

A cluttered worktable of an obsessed alchemist, lit by the glow of a molten substance in a crucible. Dark, warm, rich — like a Rembrandt still life with magical elements. Chiaroscuro lighting from a diegetic source.

**Mood**: Mysterious luxury. Forbidden knowledge. Dangerous beauty.

**Palette**:

- **Warm gold/amber** — molten glow, gold coins, candlelight temperature
- **Dark brown** — wood table, leather
- **Deep green** — glass flask transmission
- **Gunmetal/iron** — crucible
- **Clear/white** — crystal prism (high IOR for dispersion)
- **Grey stone** — mortar

**Anti-CG techniques**: Diegetic lighting (light source is a scene object), warm/cool color temperature contrast, object variety (different shapes, materials, sizes), slight randomness in coin placement/rotation, reflective table catches warm light pool.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting  | Value                                                     |
| -------- | --------------------------------------------------------- |
| Position | {2.5, 1.8, 3.5} — elevated, offset right                  |
| Target   | {0, 0.15, 0} — just above table surface, near crucible    |
| DOF      | OFF (aperture = 0)                                        |
| Framing  | Rule of thirds: crucible/glow at lower-right intersection |

### Environment

| Setting       | Value                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Daylight fill | Power 0.03 (nearly black — keeps shadows from crushing)                                             |
| Hour          | ~18 (twilight, cool blue ambient fill)                                                              |
| Optional rim  | Sphere light behind/above table, cool white 7000K, power 30 — subtle edge separation on silhouettes |

### Objects

**1. Table Surface**

- Box, scale {3, 0.1, 2}, position {0, 0, 0}
- Glossy material — dark walnut wood texture on diffuse, specular 0.3, roughness 0.15
- Texture: `textures/dark_walnut_wood.jpg`

**2. Crucible (Iron Bowl)**

- Sphere, scale {0.35, 0.35, 0.35}, position {0.3, 0.05, -0.2} (center-right, sunk slightly)
- Glossy material — diffuse {0.15, 0.12, 0.1}, IOR 100, roughness 0.3

**3. Molten Glow Sphere (KEY LIGHT SOURCE)**

- Sphere, scale {0.15, 0.15, 0.15}, position {0.3, 0.2, -0.2} (nestled above crucible rim)
- Diffuse material with blackbody emission — 1800K (deep amber/orange), power 300, efficiency 1.0
- This IS the scene. All warm light comes from here.

**4. Glass Flask**

- Capsule, scale {0.12, 0.4, 0.12}, position {-0.5, 0.2, 0.1} (left of center, tall)
- Specular material — transmission {0.2, 0.8, 0.3}, IOR 1.5, roughness 0.02

**5. Crystal Prism**

- Octahedron, scale {0.15, 0.2, 0.15}, position {-0.05, 0.1, 0.15} (between crucible and flask)
- Specular material — transmission {1, 1, 1}, IOR 2.0, roughness 0.0

**6. Gold Coin 1**

- Box, scale {0.12, 0.02, 0.12}, position {0.55, 0.06, -0.1} (near crucible)
- Glossy material — diffuse {1, 0.84, 0}, IOR 100, roughness 0.1

**7. Gold Coin 2**

- Box, scale {0.1, 0.02, 0.1}, position {0.45, 0.06, 0.05}, rotation {0, 15, 0}
- Same gold Glossy as Coin 1

**8. Mortar (Stone Bowl)**

- Torus, scale {0.18, 0.08, 0.18}, position {-0.7, 0.08, -0.3} (far left, behind flask)
- Diffuse material — volcanic stone texture
- Texture: `textures/volcanic_stone.jpg`

### Textures

- `textures/dark_walnut_wood.jpg` — PBR albedo, dark walnut grain
- `textures/old_parchment.jpg` — aged yellowed paper (reserve for future)
- `textures/volcanic_stone.jpg` — rough grey stone with mineral flecks

### Render

- Path Tracing kernel, 2000 samples
- AI Light enabled for better noise convergence on small emitters
