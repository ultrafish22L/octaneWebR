# The Hourglass (Scene 11)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

Two spheres stacked vertically — polished gold on the bottom, blue glass on top. A single warm side-light. The warm and cool materials together in one vertical composition, each transforming the same light differently.

**This is a material contrast study.** The gold sphere is opaque, reflective, warm — it catches the side-light as a rich metallic streak, a crescent of fire. The blue glass sphere above is semi-transparent — the gold sphere below is visible distorted through it, refracted and shifted blue. The same warm light creates completely different effects on each material. Metal reflects; glass refracts. Warm absorbs; cool transmits.

**The mirror floor creates three things, not two.** The reflection doubles the stacked pair into a column of four — gold-blue-blue-gold stretching from reflection to reality to glass to gold. The warm light streak reflects too, becoming a luminous band cutting across the dark mirror surface.

**Warm side-light, no fill.** Single warm amber light from the side (3500K, 3000-5000 power). The warm temperature favors the gold sphere — it blazes. The blue glass absorbs some of the warm light and transmits it cooler — the natural filtering creates the warm/cool contrast without needing two different colored lights. Lighting ratio is 4:1+ — dramatic but not noir-level black.

**Low camera on the warm side.** Position on the lit side, at y=0.4, looking slightly up at the stacked pair. This makes the composition feel tall and sculptural. The warm-lit faces of both spheres are presented to the camera while the shadow sides fall away. Portrait orientation matches the vertical stack.

**Quad light through glass warning.** The light will be visible through the blue glass sphere as a refracted rectangle. Position it so the refraction is either out of the glass sphere's direct transmission path, or accept it as part of the warm glow. The glass will warp and color-shift the refracted shape — sometimes this looks intentional and beautiful.

## Reference Values

| Element         | Setting                                                           | Value                                                               |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Environment** | Texture color                                                     | `(0.02, 0.02, 0.03)`, power ~0.25                                   |
| **Floor**       | Mesh                                                              | `floor.obj`, scale 10x                                              |
|                 | Material                                                          | Glossy — diffuse `(0.03, 0.03, 0.04)`, specular 0.9, roughness 0.01 |
| **Gold sphere** | Mesh                                                              | `sphere_hd.obj`, scale ~0.6, on floor                               |
|                 | Material                                                          | Glossy — diffuse `(1, 0.84, 0)`, specular 1.0, roughness 0.02       |
| **Blue glass**  | Mesh                                                              | `sphere_hd.obj`, scale ~0.6, on top of gold                         |
|                 | Material                                                          | Specular — transmission `(0.3, 0.5, 1.0)`, IOR 1.5, smooth on       |
| **Light**       | Single quad, position `(3, 2, 1)` — side, elevated                |
|                 | 3500K warm amber, power 3000-5000, size 2-3                       |
| **Camera**      | Position `(2, 0.4, 3)` → Target `(0, 0.5, 0)`, 1080x1920 portrait |
