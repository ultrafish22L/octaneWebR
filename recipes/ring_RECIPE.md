# The Ring (Scene 12)

A large polished gold ring floats above a dark mirror floor, with a crystal sphere at its center refracting the stars behind it.

## Environment

Starfield texture environment (starfield.jpg) at moderate power (~3.5). Provides a deep space backdrop with a visible purple nebula. Stars reflect faintly in the mirror floor and gold ring surface.

## Floor

A large flat mirror floor (floor.obj, scaled 10x). Glossy material — very dark diffuse (0.02), bright specular (0.9), near-zero roughness (0.01). Reflects the ring, sphere, and starfield.

## The Ring

A large gold ring (mesh: ring.obj) floating above the floor, tilted 15 degrees forward. Glossy metallic material — warm gold diffuse (0.95, 0.7, 0.05), gold-tinted specular (1, 0.85, 0.35), very low roughness (0.03). Scaled 1.5x, positioned at center (0, 1.2, 0). The gold catches the directional warm light on one side, fading to shadow on the other.

## The Crystal Sphere

A crystal glass sphere (mesh: sphere_hd.obj) sitting at the center of the ring. Specular glass with high IOR (2.0) for strong refraction — the starfield and nebula appear beautifully distorted through it. Scale 0.55, positioned at the ring center (0, 1.2, 0). Clear transmission, smooth surface.

## Lighting

A quad light positioned far to the upper-left behind the scene (-6, 3, -4), angled to graze the ring's surface. Size 1.5, warm emission (4500K, power 30000). Creates directional warm highlights on the left side of the ring and a caustic spot on the floor below the crystal sphere. Positioned out of camera frame.

## Camera

Overhead three-quarter angle from slightly right of center (0.3, 2, 3.8), looking down at the ring center (0, 0.95, 0). Shows the full ring face with the crystal sphere at center. Portrait orientation (1080x1920).

## The Look

A floating gold ring in deep space, its polished surface catching warm directional light. A crystal sphere at its center acts as a lens, refracting the starfield and purple nebula behind it into a swirling miniature cosmos. The dark mirror floor reflects the entire composition. Sculptural, cosmic, elegant.
