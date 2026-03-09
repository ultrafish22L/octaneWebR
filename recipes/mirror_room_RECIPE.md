# The Mirror Room (Scene 8)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A large glass sphere in total darkness, lit from directly above. The overhead light creates perfect concentric rainbow dispersion rings through the glass — red, yellow, green, cyan, blue, magenta — radiating outward like a bullseye of pure spectrum. Hypnotic, scientific, mesmerizing.

**This is the one scene where dead-center composition is correct.** The dispersion rings are radially symmetric — concentric circles emanating from the light source through the sphere. Off-center framing would fight the natural geometry. The camera looks straight at the sphere, front-on, at sphere-center height. Square aspect ratio (1:1) matches the circular symmetry of the rings.

**The sphere fills the frame.** Scale it large (2.0) and get close. This isn't a sphere-in-a-room — it's a sphere that IS the room, that IS the image. The viewer should feel like they're looking into a crystal ball. The overhead light source appears as a bright white rectangle reflected at the top of the sphere, surrounded by rainbow halos from the dispersion.

**Total darkness is the point.** The environment is near-zero brightness. No ambient, no fill, nothing. The only light is the quad directly overhead, and it enters the sphere and gets split into a spectrum. The darkness acts as a dark room — a controlled environment for a physics experiment rendered as art.

**High IOR (2.0) for maximum dispersion effect.** More refraction = wider spectral separation = more vivid, distinct color bands. This combined with Octane's spectral rendering produces rings that are physically correct — not a texture, not a shader, actual wavelength-dependent refraction.

## Reference Values

| Element         | Setting                                                            | Value                                                            |
| --------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| **Environment** | Texture color                                                      | `(0.005, 0.005, 0.005)` — near-zero                              |
| **Sphere**      | Mesh                                                               | `sphere_hd.obj`, scale ~2.0                                      |
|                 | Material                                                           | Specular — IOR 2.0, dispersion on, transmission clear, smooth on |
| **Light**       | Single quad, position `(0, 3, 0)`, rotation `(180,0,0)`            |
|                 | 5500K neutral white, power 3000-5000, size 2-3                     |
| **Camera**      | Position `(0, 0.5, 3)` → Target `(0, 0.5, 0)` — front-on, centered |
|                 | Resolution                                                         | 1080x1080 square (1:1)                                           |

## What Would Elevate This Further

- PMC kernel for cleaner dispersion ring convergence
- Experiment with the light size: smaller = sharper rings with more distinct color bands, larger = softer rainbow gradient
- Try slightly offsetting the light from dead-center — asymmetric dispersion patterns can be more visually interesting than perfect symmetry
- A very subtle warm tint to the light (5000K instead of 5500K) might give the spectrum a richer quality
- Film stock tone mapping to deepen the blacks and add subtle color grading
- Consider a second sphere nearby at different scale — the dispersion patterns would interact
