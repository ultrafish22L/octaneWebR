# The Beacon (Scene 9)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A tall glass pillar standing on a dark mirror floor against a starfield backdrop. The pillar glows from within — a single light source embedded inside it refracts through the glass, casting intricate caustic patterns on the mirror floor below. The pillar IS the light. A luminous beacon in the void of space.

**The mirror floor doubles everything.** The pillar's glow extends downward into the reflection — a luminous column that appears to stretch both up into the stars and down into an infinite mirror dimension. This doubling transforms a single object into a compositional axis that divides the image vertically.

**Portrait orientation matches the subject.** A tall, narrow pillar demands a vertical frame. 1080x1920 (9:16) gives the pillar room to breathe vertically while keeping the starfield backdrop tight on the sides. The vertical format emphasizes the beacon's height and the column-of-light effect in the floor reflection.

**Low angle hero shot.** Camera at y=0.4, looking up at mid-pillar height. This makes the pillar feel monumental — a structure, not a prop. The offset right position breaks symmetry. The starfield is visible above and around the pillar, grounding it in deep space.

**The light-through-glass trade-off.** A quad light inside the pillar will show as a refracted rectangle through the glass. In this scene, that's acceptable — even desirable. The refracted shape becomes part of the beacon's glow, a burning core visible through translucent glass. The warm-tinted transmission `(1.0, 0.95, 0.85)` softens the refracted light with warmth.

**Environment at low power** — just enough for visible stars and subtle ambient fill, not enough to compete with the internal glow. The beacon should be the brightest thing in the scene by far.

## Reference Values

| Element         | Setting                                                           | Value                                                               |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Environment** | Texture                                                           | `ORBX/assets/starfield.jpg`, power 1.0-1.5                          |
| **Floor**       | Mesh                                                              | `floor.obj`, scale 10x                                              |
|                 | Material                                                          | Glossy — diffuse `(0.02, 0.02, 0.03)`, specular 0.9, roughness 0.01 |
| **Pillar**      | Mesh                                                              | `pillar.obj`, tall/narrow, center                                   |
|                 | Material                                                          | Specular — IOR 1.5, transmission `(1.0, 0.95, 0.85)`, smooth on     |
| **Light**       | Quad inside pillar, position `(0, 1, 0)`                          |
|                 | 4000K warm white, power 3000-5000, size 0.3                       |
| **Camera**      | Position `(1, 0.4, 3)` → Target `(0, 1.5, 0)`, 1080x1920 portrait |
