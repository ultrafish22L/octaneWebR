# Neon Noir (Scene 2)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

The same three spheres from Glass & Metal, but the sun has set and a single warm light remains. This is the noir version — everything the daylight scene hid is now revealed.

In daylight, the glass sphere was pretty. In darkness, it becomes _spectacular_. Chromatic dispersion rings — vivid concentric rainbows — appear where the single warm overhead light enters the glass. These rings are invisible in bright multi-source daylight because the spectral bands overlap and cancel. In controlled single-light darkness, each color separates and burns. This is the physics payoff of noir lighting — Octane's spectral engine showing what it can really do.

The gold sphere catches one warm crescent of metallic fire against shadow. The orange matte sphere (shifted from Scene 1's red to match the warm palette) glows softly like a dying ember. Everything else falls to black.

**This is an 8:1+ lighting ratio scene** — one light, no fill, near-black environment. Maximum drama. The environment isn't zero-black — just enough ambient to keep shadows from becoming absolute voids, to hint that there's a world beyond the light cone.

**Same camera as Scene 1.** That's the point — identical geometry, identical angle, completely different mood. Lighting alone transforms the scene. The viewer gets to compare and understand what lighting does.

**Depth through contrast**: Dark environment = background. Lit surfaces = midground. Floor reflections = foreground layer below. Warm amber against cool near-black = natural warm/cool depth separation.

## Reference Values

| Element           | Setting                                                   | Value                                                                           |
| ----------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Environment**   | Texture color                                             | `(0.02, 0.02, 0.03)` — near-black, slight blue                                  |
| **Floor**         | Material                                                  | Glossy — diffuse `(0.15, 0.1, 0.08)` (warm umber), specular 0.8, roughness 0.03 |
| **Gold sphere**   | Material                                                  | Glossy — diffuse `(1, 0.84, 0)`, specular 1.0, roughness 0.15                   |
| **Glass sphere**  | Material                                                  | Specular — transmission `(0.9, 0.9, 1.0)`, IOR 1.5, dispersion on               |
| **Orange sphere** | Material                                                  | Diffuse — color `(0.9, 0.4, 0.05)`                                              |
| **Light**         | Single quad, position `(0, 2.5, 1)`, rotation `(180,0,0)` |
|                   | 3500K warm amber, power 500-2000, size 3                  |
| **Camera**        | Position `(-3, 1.2, 6)` → Target `(0, 0.2, 0)`, 1280x720  |

### Floor Texture (Recommended)

```
dark polished concrete surface, seamless tileable texture, flat orthographic top-down material scan,
evenly lit diffuse studio lighting, no shadows no highlights no reflections,
PBR albedo map, photorealistic, square 1:1
```

## What Would Elevate This Further

- Bloom on the dispersion rings to make them glow beyond the glass
- Film stock tone mapping (Kodak warm stock) for cinematic amber push
- Vignetting to darken frame edges and compress focus to center
- Try the light more to the side (45°) for rim-lit gold and stronger form shadows
- PMC kernel for cleaner caustic convergence in the glass
