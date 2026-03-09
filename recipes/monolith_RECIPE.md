# The Monolith (Scene 5)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A dark rectangular monolith standing impossibly balanced on top of a glass sphere. _2001: A Space Odyssey_ meets crystal ball. Surreal, mysterious, iconic.

The monolith is an absence — near-black matte, no reflections, no highlights, pure geometric void. It's the anti-material: while the sphere below refracts light into rainbow prismatic rings, the monolith absorbs everything. This contrast IS the scene. Organic roundness vs. geometric austerity. Rainbow light vs. total darkness. Spectral physics vs. matte silence.

**The glass sphere is the pedestal and the show.** High IOR (1.8) crystal glass with dispersion enabled — rainbow concentric rings appear where the side-light enters at a glancing angle. The monolith's dark reflection distorts inside the sphere, visible through the chromatic shimmer. The sphere catches all the light; the monolith rejects it.

**Side/back lighting creates a silhouette composition.** The light comes from the side and slightly behind — it catches the sphere's curved surface at a glancing angle (maximizing dispersion) while the monolith remains a dark silhouette. This is a 4:1+ lighting ratio with the dark environment providing minimal fill. The eye goes to the brightest area first (prismatic sphere) then travels up the dark monolith shape.

**Low camera looking up = monumentality.** At y=0.5, looking slightly upward, the stacked composition feels impossibly tall and alien. The floor catches prismatic caustics and the monolith's shadow. The slight blue undertone in the environment hints at something otherworldly.

## Reference Values

| Element         | Setting                                                   | Value                                                             |
| --------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| **Environment** | Texture color                                             | `(0.05, 0.05, 0.07)` — dark, subtle blue                          |
| **Floor**       | Mesh                                                      | `floor.obj`, scale 10x                                            |
|                 | Material                                                  | Glossy — diffuse `(0.6, 0.6, 0.62)`, specular 0.5, roughness 0.08 |
| **Sphere**      | Mesh                                                      | `sphere_hd.obj`, scale ~1.0, on floor                             |
|                 | Material                                                  | Specular — IOR 1.8, dispersion on, transmission clear, smooth on  |
| **Monolith**    | Mesh                                                      | `monolith.obj`, standing on sphere                                |
|                 | Material                                                  | Diffuse — color `(0.02, 0.02, 0.02)` (near-black matte)           |
| **Light**       | Single quad, position `(3, 2.5, -1)` — side/behind        |
|                 | 6000K neutral-cool, power 1000-3000, size 2               |
| **Camera**      | Position `(1.2, 0.5, 4)` → Target `(0, 0.8, 0)`, 1280x720 |

### Floor Texture (Optional)

```
brushed light concrete surface, seamless tileable texture, flat orthographic top-down material scan,
evenly lit diffuse studio lighting, no shadows no highlights no reflections,
PBR albedo map, photorealistic, square 1:1
```

## What Would Elevate This Further

- A very subtle blue rim light from behind to give the monolith edge separation from the dark background
- Environment medium (light fog) between the camera and the objects for atmospheric depth
- The monolith slightly off-center on the sphere — perfectly centered feels too stable, a slight offset adds tension
- PMC kernel for better dispersion convergence on the sphere
- Consider a slight tilt to the monolith — not quite vertical — for unsettling surrealism
