# The Prism (Scene 7)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A dark glass prism splitting a beam of white light into warm and cool color fans. _The Dark Side of the Moon_ as a path-traced scene. Minimal, focused, iconic.

The prism sits on a dark reflective floor. White light enters one face from a small, intense side light. It exits the other face split into spectral components — warm orange and golden light spilling from one side, cool blue and teal from the other. The dark-tinted glass makes the prism appear nearly black, almost monolithic, but it's alive with refracted light moving through it.

**This is a two-tone composition: warm vs. cool, literally split by physics.** The floor catches both sides — warm spectral tones on one side of the prism, cool on the other. Blue + orange is the most cinematic complementary color pair, and this scene creates it through pure optics. The prism is the dividing line between two color worlds.

**Small light source is critical.** The smaller the light, the sharper the spectral separation. A large area light produces diffused, mushy color bands that blend together. A tight source creates distinct, vivid spectral lines — the Pink Floyd album cover look. Position it at prism height, directly to the side, so the beam enters cleanly through one face.

**Noir lighting ratio (8:1+).** Near-black environment, single side light, no fill. The scene exists in darkness with only the spectral color providing illumination beyond the direct beam. The prism and its light are the only things that matter.

**Elevated close-up camera.** Slightly above and offset, looking down at the prism. Close enough to see both warm and cool beams emerging from the prism faces, far enough to see the spectral light painting the floor on both sides.

## Reference Values

| Element         | Setting                                                   | Value                                                                                      |
| --------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Environment** | Texture color                                             | `(0.01, 0.01, 0.02)` — near-black                                                          |
| **Floor**       | Mesh                                                      | `floor.obj`, scale 10x                                                                     |
|                 | Material                                                  | Glossy — diffuse `(0.08, 0.08, 0.1)`, specular 0.8, roughness 0.02                         |
| **Prism**       | Mesh                                                      | `prism.obj`, on floor center                                                               |
|                 | Material                                                  | Specular — IOR 1.8, dispersion on, transmission `(0.15, 0.15, 0.2)` (dark tint), smooth on |
| **Light**       | Single quad, position `(-3, 0.5, 0)` — side, prism height |
|                 | 5500K neutral white, power 3000-5000, size 0.5-1          |
| **Camera**      | Position `(0.5, 1.2, 3)` → Target `(0, 0.3, 0)`, 1280x720 |
