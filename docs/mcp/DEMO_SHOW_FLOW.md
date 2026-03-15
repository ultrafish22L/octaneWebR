# Demo Show Flow — Space Cat

Two-act demo: Act 1 fakes the OTOY Studio asset pipeline, Act 2 builds the scene live in Octane via MCP.

---

## Act 1 — OTOY Studio Walkthrough (Chrome MCP)

### Setup

- otoy.studio must be open and logged in
- Cat astronaut assets are the **first 2 items** in history sorted "Newest First"
  - Item 1: Text-to-Image result (Seedream v4.5) — cat astronaut, 2048x2048
  - Item 2: Image-to-3D result (Hunyuan-3D v3.1 Pro) — 500K face textured mesh

### Flow

1. Navigate to otoy.studio → Text to Image page
2. Type prompt into box: "Cute cartoon cat astronaut floating in space, wearing NASA-style spacesuit with helmet, orange tabby cat, white background, 3D character render, full body, clean isolated subject for 3D conversion"
3. Narrate: "Seedream v4.5, Square HD, ready to generate"
4. Click the first history image (top-left) — "the result"
5. Show Generation Details panel — narrate the output
6. Close details → navigate to Image to 3D page
7. Show cat image loaded as input, Hunyuan-3D v3.1 Pro selected
8. Click the first 3D history result → wait for 3D preview (~4s)
9. Narrate: "500K faces, textured mesh, ready for Octane"
10. Transition: "Assets are downloaded and ready. Now let's build the scene in OctaneRender."

### Narration style

- Casual, confident, showcase tone
- "Here's OTOY Studio — neural art tools for image, video, and 3D generation"
- "Powered by Seedream v4.5" / "Hunyuan-3D converted the 2D image into a full 3D model"
- Don't mention "pretend" or "fake" — just narrate as if it's happening live

---

## Act 2 — Live MCP Scene Build (DRESS Mode)

### Pre-build checklist

- User must have restarted Octane and given the OK
- Start dev server (`preview_start`)
- Reset profiler (`profile_reset` + `profile_start`)
- Verify clean scene (`get_scene_tree`)
- Read recipe values from `recipes/space_cat_RECIPE.md`

### Build order (one object at a time, render after each)

1. **Geo group** — create, set pin count to 8
2. **Connect geo group to RT** — `pin_id:59` (P_GEOMETRY), fallback `pin_index:3`
3. **Key light** — FIRST in space (no ambient → need light to see anything)
   - Quad light, pos (10, 18, -15), power 15000, size 3
   - object layer camera_visibility=false
   - Connect to geo group "Input 1"
4. **Set hero camera** — pos (8.17, 13.3, 2.82), target (-1.07, 2.72, 6.52)
5. **Start render** → dark space with a point of light
6. **Cat astronaut** — mesh, pos (0.03, 2.16, 4.09), rot (66.6, 140.4, 16.5)°, scale (5,5,5), universal mat + texture → "Input 2"
7. **Earth** — sphere mesh, pos (2, -18, 5), rot (314.2, 109.8, 44.5)°, scale (30,30,30), diffuse + earth texture → "Input 3"
8. **Fill light** — pos (-2, 12, -5), power 15000, size 5, camera-invisible → "Input 4"
9. **Backlight** — pos (2, -10, 4), power 50000, size 8, camera-invisible → "Input 5" ← **THE shot**
10. **Starfield env** — texture env, starfield.jpg, power 0.4 → RT `pin_id:43`
11. **PT kernel** (optional) — swap for final quality → RT `pin_id:89`
12. **Final render** — save to `renders/space_cat_final.png`

### Critical rules during build

- NEVER `evaluate:false`
- NEVER parallel `create_node`
- Always A_RELOAD (124) after A_FILENAME (34)
- Always ABSOLUTE paths
- A_ROTATION uses DEGREES (not radians)
- Geo group pins → `pin_index` (0, 1, 2, …) — ⚠ `pin_name` silently fails
- RT connections → `pin_id` (59=geo, 89=kernel, 43=env)
- `get_render_status` after every render — report timing

### Narration style

- "Let me set up the deep space environment first"
- "There's our cat astronaut — floating weightless in the void"
- "Earth curves into frame below — massive, blue, beautiful"
- "Now the backlight — this is THE shot. Rim light on the spacesuit edges"
- Keep it cinematic, not technical
