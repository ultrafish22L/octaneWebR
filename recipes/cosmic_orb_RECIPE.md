# Cosmic Orb (Scene 4) — LOCKED

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A large glass sphere suspended in deep space, refracting the cosmos with rainbow dispersion. No floor, no lights, no distractions — just a crystal ball floating in the void with the universe bending through it.

The starfield wraps around the sphere — the milky way band refracts through the glass, splitting into prismatic rainbow rings at the equator. This is Octane's spectral rendering superpower on full display: real chromatic dispersion across the continuous visible spectrum, not an RGB approximation. The sphere is simultaneously transparent and transformative — a lens that warps the universe into rainbows.

**Negative space is the composition**. The orb sits in vast darkness with breathing room on all sides. This isn't a crop-it-tight product shot — it's a lone object in infinity. The emptiness makes the sphere feel significant, almost sacred. Pull the camera back further than feels natural.

**Environment IS the lighting**. No artificial lights — the starfield at moderate power provides all illumination. This was a deliberate choice: any quad light or mesh emitter visible through glass creates ugly refracted shapes. Environment-only lighting gives clean, even illumination that lets the dispersion physics shine without distracting artifacts. The purple/blue nebula tones provide natural color contrast against the clear glass.

**Scale**: The camera is slightly low and offset, looking slightly up at the orb. This isn't dramatic — just enough elevation change to suggest the orb has presence, that it matters. A 45° FOV keeps the perspective natural for interactive orbiting.

## Reference Values

| Element         | Setting    | Value                                                              |
| --------------- | ---------- | ------------------------------------------------------------------ |
| **Environment** | Texture    | `ORBX/assets/starfield.jpg` (Seedream v4)                          |
|                 | Power      | 3.5                                                                |
| **Orb**         | Mesh       | `sphere_hd.obj`, placement scale 2.0, position `(0, 1, 0)`         |
|                 | Material   | Specular — IOR 1.9, dispersion 0.12, transmission clear, smooth on |
| **Camera**      | Position   | `(1, 1.5, 7)` — offset, pulled back                                |
|                 | Target     | `(0, 1, 0)` — sphere center                                        |
|                 | FOV        | 45°                                                                |
|                 | Resolution | 1280x720 landscape                                                 |

## What Didn't Work (Proven)

- **Floor**: Felt wrong for floating-in-space. Removed.
- **Quad light**: Refracted rectangles through glass at every position/power. Unavoidable.
- **Gold tint**: Amber transmission absorbed too much in dark env — opaque dark blob.
- **FLUX starfield**: Too much nebula, not enough dark void. No power setting looked right.
- **Close camera**: Sphere crammed against edges. Needed breathing room for orbiting.
