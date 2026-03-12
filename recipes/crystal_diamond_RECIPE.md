# Crystal Diamond (Scene 3)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A single diamond on a light floor, surrounded by darkness. One dramatic light. Pure luxury.

Diamond has the highest IOR of any common transparent material — 2.4. Combined with Octane's spectral path tracing, each facet becomes a tiny prism, splitting white light into vivid rainbow fire inside the stone. Reds, greens, and blues should flicker through the crystal faces, and prismatic caustics should scatter across the floor like fallen jewels of light.

**This scene is about absolute isolation.** Dark background, single subject, no distractions. Jeweler's photography on black velvet — let the stone do the talking. The light floor provides contrast from below and catches the caustic rainbows. Every element exists to serve the diamond: the dark background isolates it, the light floor catches its fire, the side light reveals its soul.

**Low camera = monumental gemstone.** At y=0.4, looking slightly up, the diamond feels larger than life. Higher angles make it feel like a trinket on a table. The offset right position breaks symmetry for a natural, photographic composition.

**Sharp, small light source.** Smaller lights create sharper, more defined caustics and more vivid spectral fire. A large soft light turns the rainbow into mush. One strong light from above-right, hitting at an angle that maximizes internal refraction — that's where the magic happens.

## Reference Values

| Element         | Setting                                                   | Value                                                               |
| --------------- | --------------------------------------------------------- | ------------------------------------------------------------------- |
| **Environment** | Texture color                                             | `(0.03, 0.02, 0.04)` — near-black, purple hint                      |
| **Floor**       | Mesh                                                      | `floor.obj`, scale 10x                                              |
|                 | Material                                                  | Glossy — diffuse `(0.85, 0.85, 0.88)`, specular 0.7, roughness 0.05 |
| **Diamond**     | Mesh                                                      | `diamond.obj`                                                       |
|                 | Material                                                  | Specular — IOR 2.4, dispersion on, transmission clear, smooth on    |
| **Light**       | Single quad, position `(2, 3, -1)`                        |
|                 | 5500K neutral white, power 2000-5000, size 1.5            |
| **Camera**      | Position `(1.5, 0.4, 3)` → Target `(0, 0.3, 0)`, 1280x720 |

### Floor Texture (Optional)

```
polished light grey stone surface, seamless tileable texture, flat orthographic top-down material scan,
evenly lit diffuse studio lighting, no shadows no highlights no reflections,
PBR albedo map, photorealistic, square 1:1
```
