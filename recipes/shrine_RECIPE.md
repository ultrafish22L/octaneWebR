# The Shrine (Scene 6)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

An inverted glass cone floating above a mirror floor. A single bright overhead light enters the cone's flat top and disperses through the glass into a full rainbow spectrum, painting the floor in vivid color. A shrine to chromatic dispersion.

**The floor is the canvas.** This scene isn't really about the cone — it's about what the cone does to the light. The mirror floor should be alive with spectral color: greens, pinks, yellows, purples radiating outward from beneath the floating cone like a mandala of pure physics. The cone itself shows rainbow gradients across its surfaces, but the real spectacle is below.

**Maximum dispersion, minimum distraction.** Near-black environment, single overhead light, mirror floor. Three elements. The dark environment means zero ambient competition — every photon of color on the floor comes from the prism effect. The smaller the light source, the sharper the spectral separation. This is surgical lighting for a physics demonstration.

**Low angle hero shot looking up.** Camera at y=0.3, offset for asymmetry. The rainbow floor fills the lower third, the floating cone dominates the center, and the bright overhead light is visible above. This creates a natural reading order: floor color (wow) → floating cone (how?) → overhead light (ah). Three-layer depth from ground to sky.

**This is Octane's spectral engine showcase.** High IOR (1.8-2.0) with dispersion coefficient means physically correct spectrum splitting. RGB renderers can't do this — they fake it with color gradients. This is real wavelength-dependent refraction across the continuous visible spectrum.

## Reference Values

| Element         | Setting                                                   | Value                                                                |
| --------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| **Environment** | Texture color                                             | `(0.01, 0.01, 0.02)` — near-black                                    |
| **Floor**       | Mesh                                                      | `floor.obj`, scale 10x                                               |
|                 | Material                                                  | Glossy — diffuse `(0.05, 0.05, 0.06)`, specular 1.0, roughness 0.01  |
| **Cone**        | Mesh                                                      | `prism.obj`, inverted (rotation 180,0,0), floating above floor       |
|                 | Material                                                  | Specular — IOR 1.8-2.0, dispersion on, transmission clear, smooth on |
| **Light**       | Single quad, position `(0, 4, 0)`, rotation `(180,0,0)`   |
|                 | 5500K neutral white, power 5000-10000, size 1-2           |
| **Camera**      | Position `(1.5, 0.3, 3)` → Target `(0, 1.0, 0)`, 1280x720 |

## What Would Elevate This Further

- PMC kernel for faster caustic convergence (this scene is ALL caustics)
- Slightly tilt the cone off-vertical for asymmetric dispersion patterns — more organic, less "CG centered"
- Try a very slightly warm-tinted floor instead of neutral grey — warm undertones make spectral colors pop more
- Bloom post-processing to make the brightest spectral bands glow
- Consider two smaller cones instead of one — creates interaction between their dispersion patterns
