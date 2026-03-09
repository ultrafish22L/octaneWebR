# Glass & Metal (Scene 1)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

Three spheres on a reflective floor at golden hour — gold, glass, and matte red. This is a material showcase, but it should feel like a photograph, not a product render.

The golden hour sun comes from behind and to the left, painting everything warm. The gold sphere catches it with rich metallic fire. The blue glass sphere bends the world inside itself — the sky distorts, caustic light patterns scatter across the floor beneath it. The red matte sphere is the quiet anchor — no reflections, no tricks, just pure color holding its ground between two show-offs.

The floor isn't just a surface — it's a canvas. Reflections of all three spheres stretch across it, sunset colors pool in the glossy surface, and the glass sphere's caustics paint abstract light patterns. Consider a marble or polished stone texture instead of flat grey — it's the difference between "CG ground plane" and "real surface."

**Composition**: Three spheres = rule of odds. V-formation: gold and red pushed FORWARD (closer to camera), glass RECESSED at center. This creates a depth triangle — the two flanking spheres frame the glass, which sits behind and between them. The camera is offset left, not centered — asymmetric framing creates tension and interest. The glass sphere is slightly larger, occupying the dominant center position (primary focal point via caustics and refraction). Gold is secondary (warm metallic pop), red is tertiary (matte counterpoint). The eye travels: glass caustics → gold highlights → red warmth → floor reflections → sunset sky.

**Depth**: The V-formation creates real Z-depth between objects, not just perspective tricks. Warm foreground (sunset-lit gold and red) against cool blue sky gradient = natural depth separation. The recessed glass sphere adds a mid-layer. The floor reflections create a "below" layer, doubling the depth. The visible sky gives a "beyond" layer.

**Lighting ratio**: This is a daylight scene (~2:1 ratio) — the sun is key, the sky is fill. Not dramatic, but not flat either. The warm/cool contrast between direct sun and blue sky fill does the heavy lifting.

## Reference Values

| Element          | Setting        | Value                                                                                         |
| ---------------- | -------------- | --------------------------------------------------------------------------------------------- |
| **Environment**  | Daylight, hour | 19.0 (golden hour)                                                                            |
|                  | Turbidity      | 8 (atmospheric haze)                                                                          |
|                  | Sun size       | 5 (soft shadows)                                                                              |
|                  | Sunset color   | `(1, 0.4, 0.15)`                                                                              |
| **Floor**        | Mesh           | `floor.obj`, scale 10x                                                                        |
|                  | Material       | Glossy — diffuse `(0.7, 0.7, 0.7)`, specular 1.0, roughness 0.02                              |
| **Gold sphere**  | Position       | `(-0.9, 0.3, 0.4)` — left, FORWARD                                                            |
|                  | Scale          | 0.6                                                                                           |
|                  | Material       | Glossy — diffuse `(1, 0.84, 0)`, specular 1.0, roughness 0.15, **IOR 100** (metallic Fresnel) |
| **Glass sphere** | Position       | `(0, 0.38, -0.3)` — center, RECESSED                                                          |
|                  | Scale          | 0.75                                                                                          |
|                  | Material       | Specular — transmission `(0.3, 0.5, 1.0)`, IOR 1.5, smooth on                                 |
| **Red sphere**   | Position       | `(0.9, 0.3, 0.3)` — right, FORWARD                                                            |
|                  | Scale          | 0.6                                                                                           |
|                  | Material       | Diffuse — color `(0.8, 0.05, 0.05)`                                                           |
| **Spheres**      | Mesh           | `sphere_hd.obj`, sitting on floor (y = scale × 0.5)                                           |
| **Camera**       | Position       | `(-1.5, 0.9, 4.2)` — tight framing, offset left                                               |
|                  | Target         | `(0, 0.15, 0)` — sphere centers                                                               |
|                  | Resolution     | 1024x576 interactive, 1280x720 beauty                                                         |

### Texture Upgrade (Optional)

```
polished white marble surface, seamless tileable texture, flat orthographic top-down material scan,
evenly lit diffuse studio lighting, no shadows no highlights no reflections,
PBR albedo map, photorealistic, square 1:1
```

## What Would Elevate This Further

- A polished marble or concrete floor texture instead of flat grey diffuse
- Subtle DOF to soften the background sky and foreground floor edges
- Film stock tone mapping to shift from clinical CG to cinematic warmth
- V-formation is proven — gold+red forward, glass recessed. Don't flatten to z=0.
