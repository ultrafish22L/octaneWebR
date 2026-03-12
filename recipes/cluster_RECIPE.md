# The Cluster (Scene 10)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

Five colored glass marbles clustered together on a dark reflective floor. Each marble transmits its own jewel color — ruby, sapphire, emerald, amber, amethyst — and each casts its color as caustic light onto the dark floor below. A celebration of colored glass and Octane's spectral rendering.

**Five marbles = rule of odds.** The grouping feels natural and dynamic because odd numbers prevent the brain from pairing objects into static couples. Arrange them as a loose, organic cluster — some touching, some with small gaps — not a grid, not a line, not a perfect pentagon. Natural randomness sells realism.

**The dark floor is the gallery wall.** Each marble projects its transmission color onto the dark surface as caustic light — five distinct pools of jewel-toned color. Ruby red, sapphire blue, emerald green, amber gold, amethyst purple. The dark mirror surface also reflects each marble from below, creating a jewel-box-within-a-jewel-box doubling effect.

**Colored transmission solves the invisible glass problem.** Clear glass is invisible in uniform lighting — only caustic shadows reveal it. These saturated transmission colors ensure each marble is immediately visible, distinct, and vivid. The colors aren't painted on — they're the result of wavelength-selective absorption through the glass, physically accurate in Octane's spectral engine.

**Daylight at low power for natural illumination.** Not too bright — intimate, not overexposed. Daylight provides enough warm+cool spectrum to illuminate all five colors. Note: amber glass absorbs blue/green wavelengths, so the amber marble may appear darker than the others under cool-dominant light. That's correct physics.

**Elevated three-quarter view.** Camera above and to the side, looking down into the cluster. This angle shows each marble's color clearly and reveals the caustic light patterns on the floor between and around the group. Portrait orientation (1080x1920) emphasizes the cluster's vertical depth when viewed at this angle.

## Reference Values

| Element         | Setting                                                         | Value                                                               |
| --------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Environment** | Daylight, power ~0.3                                            |
| **Floor**       | Mesh                                                            | `floor.obj`, scale 10x                                              |
|                 | Material                                                        | Glossy — diffuse `(0.05, 0.05, 0.06)`, specular 0.8, roughness 0.02 |
| **Marbles**     | Mesh                                                            | `sphere_hd.obj`, scale ~0.6 each, tight cluster, on floor           |
|                 | All Specular, IOR 1.5, smooth on                                |
|                 | Ruby                                                            | transmission `(1, 0.1, 0.1)`                                        |
|                 | Sapphire                                                        | transmission `(0.1, 0.2, 1)`                                        |
|                 | Emerald                                                         | transmission `(0.1, 0.8, 0.2)`                                      |
|                 | Amber                                                           | transmission `(1, 0.7, 0.1)`                                        |
|                 | Amethyst                                                        | transmission `(0.6, 0.1, 0.8)`                                      |
| **Camera**      | Position `(2, 2, 3)` → Target `(0, 0.2, 0)`, 1080x1920 portrait |
