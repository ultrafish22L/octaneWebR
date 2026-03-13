# Scene Ideas

Creative concepts for MCP demo builds and gallery scenes.

---

## Cat Astronaut in Space — THE DEMO SCENE

- **Concept**: Cat astronaut spacewalking near a cat-shaped spaceship, orbiting Earth, backlit with sun peeking behind. Sparse elegant starfield.
- **Mood**: Cinematic space — think 2001/Gravity. Sun corona behind Earth/ship silhouette. Dramatic backlighting.
- **Key elements**: Cat astronaut (OTOY Studio Hunyuan-3d), Earth sphere (blue diffuse), backlit sun, sparse starfield, dark space env
- **Assets on disk**:
  - `ORBX/assets/cat_astronaut.obj` — 3D model
  - `ORBX/assets/cat_astronaut_tex.png` — texture
  - `ORBX/assets/starfield.jpg` — starfield environment
  - `ORBX/assets/earth_daymap_8k.jpg` — Earth texture
- **Status**: Recipe LOCKED (`recipes/space_cat_RECIPE.md`). Demo scene. DRESS build tested.
- **Composition plan**:
  1. Determine cat_astronaut.obj facing direction FIRST (test render multiple angles)
  2. Place camera to see the cat's FACE, not its back
  3. Earth = huge sphere (scale 30+) below/behind, textured
  4. Sun direction = behind cat for backlight rim
  5. Sky power very low (0.01–0.03), sun intensity high (8+), size large (5+) for soft corona
  6. DOF off (aperture=0) — everything sharp

---

## Future Scene Ideas

(Add more here as they come up)
