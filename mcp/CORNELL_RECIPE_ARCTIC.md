# Cornell Box Recipe — ARCTIC

_The polar opposite of SPICYOTOY. Where that one burns, this one freezes._

## Room

A frozen cave carved from glacial ice.

- **Left wall**: Deep glacial blue — the dense blue of compressed ice deep inside a glacier. Rich, saturated, cold.
- **Right wall**: Pale cyan frost — lighter, airy, like the sky reflected in thin ice. Almost white but unmistakably blue.
- **Floor**: Pale blue-gray — like packed snow under overcast light. Cold but bright enough to bounce light around.
- **Ceiling**: Same pale blue-gray as the floor.
- **Back wall**: Mid blue-gray — slightly darker than floor/ceiling, giving depth. Like the interior of an ice cave.

## Light

A single overhead panel emitting stark, cold light.

- **Temperature**: 8500K — blue-white, like winter daylight filtered through clouds. The opposite of SPICYOTOY's warm amber.
- **Power**: Moderate — the light-colored walls will bounce plenty of light, unlike the obsidian cave. Start at 200, adjust if needed.
- **Size**: Standard Cornell light panel.

## Objects

Three objects on the floor, each playing with ice and light:

1. **Frosted glass sphere** (left of center, slightly forward)
   - Specular material with pale blue transmission tint
   - Slight roughness (0.05-0.1) to simulate frost — not perfectly clear, not fully opaque
   - IOR 1.5 (glass)
   - Should scatter light softly, like looking through frosted window glass

2. **Ice crystal column** (right of center, toward back)
   - Tall thin box (not a primitive that crashes) — like a column of ice
   - Glossy material, very slight blue tint in specular
   - Very low roughness (0.02) — almost mirror but with just enough imperfection to read as ice, not chrome
   - Tall and elegant — maybe 0.2 x 0.7 x 0.2, rotated slightly

3. **Warm candle ember** (center floor, between the two)
   - Tiny emissive box, like a candle flame frozen in the ice cave
   - 2200K blackbody — deep warm orange, the only warm thing in the entire scene
   - Low power — a gentle warm glow contrasting the cold blue everywhere
   - The single point of warmth in a frozen world

## Mood

Serene. Still. The cold blue light wraps everything in frost. The two glass/ice objects refract and scatter the blue light in different ways — the sphere softly, the crystal sharply. And in the center, the tiny warm ember reminds you that somewhere, far away, there's still fire.

The color story is the inverse of SPICYOTOY: where that scene had warm walls with dark absorption, this scene has cool walls with high reflectivity. Where that scene needed 1500W to light up obsidian, this scene needs only 200W because the pale walls bounce light everywhere.
