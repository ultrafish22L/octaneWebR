# Cornell Box — SPICYOTOY

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

A fiery reimagining of the classic Cornell box. Same room, completely different energy. The room feels like peering into a furnace — dark walls absorb light while two blazing accent walls throw fire-orange and electric magenta across every surface.

## The Room

A 2-meter cube, open at the front.

- **Left wall** — blazing orange, like glowing embers. Paper-thin, full height.
- **Right wall** — electric hot magenta. Paper-thin, full height.
- **Floor** — near-black obsidian. Absorbs light, makes reflections dramatic.
- **Ceiling** — near-black, same as floor.
- **Back wall** — near-black, same. The room is a dark cave with two walls of fire.

## Lighting

A ceiling light panel, centered, slightly larger than the classic. It emits warm golden-amber light — like candlelight or molten metal. Generous power so the warm glow reaches every surface and makes the orange and magenta walls bleed color into the dark floor.

## Objects

**Chrome torus** — A polished mirror-finish torus sitting on the floor, right of center, slightly toward the back. About 0.6 meters across. Its chrome surface reflects both the orange and magenta walls, creating a swirl of hot colors in the reflections. Rotated slightly to catch both walls.

**Hot glass sphere** — A tinted red-amber glass sphere sitting on the floor, left of center. About 0.6 meters in diameter. Not clear glass — warm red-tinted, like a hot marble pulled from a furnace. You see the room distorted through it in warm tones, with amber caustics on the dark floor.

**Glowing ember** — A small glowing object on the floor between the torus and sphere. It emits its own warm orange light, casting a pool of fire-colored light on the dark floor around it. Like a hot coal or ember sitting on obsidian.

## Camera

Same as classic — looking straight in from the front at eye height. Frames the whole room.

## The Look

When properly lit, the dark room amplifies every color. Orange bleeds from the left, magenta from the right, and they mix on the dark floor in rich warm tones. The chrome torus becomes a distorted mirror of fire colors. The red glass sphere glows warm and refracts the scene in amber. The small ember on the floor creates a bright accent and a pool of warm light on the obsidian floor. It should feel hot just looking at it.

## Handle Map

| Object           | Handle | Material                 | Notes                       |
| ---------------- | ------ | ------------------------ | --------------------------- |
| Render Target    |        |                          |                             |
| Geo Group        |        |                          | 8 input slots               |
| Left wall        |        | Diffuse orange           | Blazing embers              |
| Right wall       |        | Diffuse magenta          | Electric hot                |
| Floor            |        | Diffuse near-black       | Obsidian                    |
| Ceiling          |        | Diffuse near-black       |                             |
| Back wall        |        | Diffuse near-black       |                             |
| Light panel      |        | Emissive warm amber      | Generous power              |
| Chrome torus     |        | Glossy mirror            | Rotated to catch both walls |
| Hot glass sphere |        | Specular, red-amber tint | IOR 1.5                     |
| Glowing ember    |        | Emissive warm orange     | Small, floor accent         |
