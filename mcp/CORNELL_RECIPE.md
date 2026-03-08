# Cornell Box

A classic radiosity test scene used to validate global illumination. Everything is built inside a simple open-front room.

## The Room

A 2-meter cube, open at the front so the camera can look in.

- **Left wall** — deep red, paper-thin, full height
- **Right wall** — rich green, paper-thin, full height
- **Floor** — white, flat on the ground
- **Ceiling** — white, flat at the top
- **Back wall** — white, paper-thin, full height, closing off the back

## Lighting

A small rectangular light panel sits flush against the ceiling, centered. About half a meter wide, slightly less deep. It emits warm white light at moderate power — bright enough to fill the room with soft bounced light and color bleeding from the walls.

## Objects

**Tall box** — A white rectangular box, roughly 0.6 meters wide and deep, about 1.2 meters tall. Positioned right of center, slightly toward the back, rotated about 20 degrees on the vertical axis. Plain white matte material.

**Glass sphere** — A transparent glass sphere sitting on the floor, left of center, slightly toward the back. About 0.6 meters in diameter. Clear glass — you should see the room distorted through it, with caustic light patterns on the floor.

## Camera

Looking straight into the room from the front, at eye height (about 1 meter up). The camera frames the entire room — both colored walls visible, ceiling and floor, all objects in view.

## The Look

When properly lit, you see red light bleeding onto the white surfaces near the left wall, green bleeding from the right. The glass sphere refracts the scene behind it and casts subtle caustics. The tall box casts a soft shadow on the floor. The ceiling light creates gentle gradients across all surfaces.
