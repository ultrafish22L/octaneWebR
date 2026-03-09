# The Arch (Scene 13)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A sci-fi gateway — two tall gold pillars connected by a chrome ring at the top, with a glowing orb floating at center. Ancient architecture meets cosmic technology. A portal to somewhere.

**The gateway is a framing device.** The two pillars and connecting ring create a physical frame — the viewer looks _through_ the arch at whatever lies beyond. The starfield visible between the pillars becomes the destination. The glowing orb at center is the activation point, the power source, the mystery. This is classic leading-lines composition: the pillars draw the eye upward to the ring, then inward to the orb, then through to the stars.

**Two-tone metallic creates visual hierarchy.** Gold pillars (warm, ancient, monumental) contrasted with a chrome ring (cool, technological, precise). Warm metal for the structural elements, cool metal for the connecting element. This warm/cool material split reinforces the sense of two different civilizations or eras meeting in one structure.

**The emissive orb provides inner illumination.** A small sphere at the arch center with blackbody emission (4500K, 500-1000 power). It illuminates the inner surfaces of the pillars and ring from within — warm light painting the gold surfaces closest to it, creating an intimate glow that contrasts with the overhead key light's broader illumination. The orb is both decoration and functional light source.

**Architectural scale through camera height.** Eye-level camera (y=1.0), looking slightly upward into the gateway. This is how you'd experience a monumental doorway — standing before it, looking up. The slight upward gaze makes the arch feel tall and imposing. Too high and it's a diorama; too low and the proportions distort.

**Starfield at low power for depth.** The environment is deep space — visible stars, but subdued. The key light and emissive orb provide the main illumination. The starfield acts as the deep background layer, creating depth behind the arch structure. The mirror floor reflects the entire arch downward, doubling the gateway into an infinite corridor.

## Reference Values

| Element         | Setting                                                        | Value                                                                    |
| --------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Environment** | Texture                                                        | `ORBX/assets/starfield.jpg`, power 1.5                                   |
| **Floor**       | Mesh                                                           | `floor.obj`, scale 10x                                                   |
|                 | Material                                                       | Glossy — diffuse `(0.02, 0.02, 0.03)`, specular 0.9, roughness 0.01      |
| **Pillars**     | Mesh                                                           | `pillar.obj` x2, tall/narrow, symmetric left/right                       |
|                 | Material                                                       | Glossy — diffuse `(1, 0.84, 0)`, specular 1.0, roughness 0.1             |
| **Ring**        | Mesh                                                           | `ring.obj`, top of pillars, spanning gap                                 |
|                 | Material                                                       | Glossy — diffuse `(0.9, 0.9, 0.92)` chrome, specular 1.0, roughness 0.01 |
| **Orb**         | Mesh                                                           | `sphere_hd.obj`, small, center of arch                                   |
|                 | Material                                                       | Standalone Diffuse + blackbody emission (4500K, power 500-1000)          |
| **Light**       | Single quad, position `(0, 4, 2)` — high, slightly forward     |
|                 | 4500K neutral-warm, power 2000-5000, size 3                    |
| **Camera**      | Position `(0.3, 1, 5)` → Target `(0, 1.2, 0)`, 1000x563 (16:9) |

## What Would Elevate This Further

- Environment medium (light fog) at ground level — the arch appears to rise out of cosmic mist
- A second orb color option: try cyan/blue emission instead of warm — sci-fi vs. mystical mood
- Subtle bloom on the emissive orb for a glowing halo effect
- Vary the pillar roughness: slightly rougher at the base (weathered/ancient) smoother at the top (reaching toward the chrome ring)
- Try the camera slightly off-axis — not looking straight through the arch, but at a slight angle. This reveals the pillar depth and makes the gateway feel three-dimensional rather than flat
- Consider a tiny second set of pillars visible in the distance through the arch — implying a corridor of gateways
