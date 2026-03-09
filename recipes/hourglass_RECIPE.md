# The Hourglass (Scene 11)

Two spheres stacked vertically — polished gold on the bottom, blue glass on top — sitting on a dark mirror floor with warm side-lighting.

## Environment

Dark texture environment, very low power (~0.25). Provides minimal ambient fill. The scene is primarily lit by the area light.

## Floor

A large flat mirror floor with glossy material. Dark diffuse, high specular reflection, very low roughness. Should clearly reflect both spheres and the warm light.

## The Spheres

Two spheres (mesh: `sphere_hd.obj`) stacked vertically at center:

**Bottom sphere — Polished Gold**: Glossy metallic material. Warm gold diffuse (0.95, 0.7, 0.05), gold-tinted specular (1, 0.85, 0.35), very low roughness (0.02). Sits on the floor. Scale ~0.6.

**Top sphere — Blue Glass**: Specular glass material. Blue transmission (0.3, 0.5, 1.0), very low reflection (0.05), IOR 1.5, smooth. Rests on top of the gold sphere. Same scale. Slightly transparent — you can see the gold sphere distorted through it.

## Lighting

A single warm quad light positioned to the side, slightly elevated. High power (~5000). Illuminates the warm side of both spheres, leaving the opposite side in shadow. No cool fill light — the environment provides subtle ambient only.

## Camera

Low angle, positioned on the warm-lit side. Looking slightly up at the sphere pair. Close enough to see material detail. Portrait orientation (1080x1920).

## The Look

A warm/cool material study. The gold sphere catches the warm side-light with rich metallic highlights. The blue glass sphere above it is semi-transparent, refracting the gold sphere below and the warm light. The mirror floor reflects the entire composition. Moody, warm-dominant lighting with the blue glass providing cool contrast.
