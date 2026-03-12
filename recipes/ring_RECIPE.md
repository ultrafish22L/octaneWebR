# The Ring (Scene 12)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A large polished gold ring floating above a dark mirror floor in deep space. A crystal sphere at its center refracts the starfield, bending the cosmos into a miniature universe framed by gold. Luxury meets infinity.

**The ring is a frame within the frame.** The gold ring acts as a compositional device — it literally frames the crystal sphere and the starfield behind it. This creates a frame-within-a-frame composition: the image frame → the gold ring → the distorted cosmos inside the sphere. Three nested levels of containment drawing the eye inward, deeper, smaller.

**The crystal sphere is the window.** Clear glass (IOR 2.0) with the starfield behind it creates a miniature inverted cosmos visible through the glass — nebula clouds swirl, stars distort, the milky way bends. The sphere doesn't just sit inside the ring — it transforms everything behind it into something alien and beautiful.

**Warm gold against cold space = natural tension.** The gold ring catches warm directional light on one side, creating a rich metallic arc that fades to shadow on the other side. This warm crescent sits against the cold blue/purple starfield. The mirror floor reflects everything — ring, sphere, stars — creating a vertical axis of symmetry.

**One strong warm light, far away and out of frame.** High power (20000-30000) compensates for the distance. The light creates directional warm highlights on the left side of the ring while the right falls to shadow — strong form that reveals the ring's three-dimensional shape. Positioned far upper-left behind the scene so it never appears through the crystal sphere.

**Three-quarter overhead camera.** Slightly above and forward, looking down at the ring face. Shows the full ring circle with the crystal sphere at center. Portrait orientation for vertical impact with the floor reflection extending the composition downward.

## Reference Values

| Element            | Setting                                                              | Value                                                               |
| ------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Environment**    | Texture                                                              | `ORBX/assets/starfield.jpg`, power ~3.5                             |
| **Floor**          | Mesh                                                                 | `floor.obj`, scale 10x                                              |
|                    | Material                                                             | Glossy — diffuse `(0.02, 0.02, 0.02)`, specular 0.9, roughness 0.01 |
| **Ring**           | Mesh                                                                 | `ring.obj`, scale 1.5x, position `(0, 1.2, 0)`, tilted ~15° forward |
|                    | Material                                                             | Glossy — diffuse `(1, 0.84, 0)`, specular 1.0, roughness 0.03       |
| **Crystal sphere** | Mesh                                                                 | `sphere_hd.obj`, scale 0.55, position `(0, 1.2, 0)` (ring center)   |
|                    | Material                                                             | Specular — IOR 2.0, transmission clear, smooth on                   |
| **Light**          | Single quad, position `(-6, 3, -4)` — far upper-left behind          |
|                    | 4500K neutral-warm, power 20000-30000, size 1.5                      |
| **Camera**         | Position `(0.3, 2, 3.8)` → Target `(0, 0.95, 0)`, 1080x1920 portrait |
