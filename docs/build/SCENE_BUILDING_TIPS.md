# Scene Building Tips

Hard-won lessons from building Octane scenes via MCP. These complement the [DRESS BUILD PROTOCOL](DRESS_BUILD_PROTOCOL.md) and [OCTANE_CHEATSHEET](OCTANE_CHEATSHEET.md).

---

## Camera Workflow

### Pull-Back Rule

**Always pull camera WAY back first** to see the full scene, place/orient objects, THEN zoom in. Never guess framing up close.

When lost, confused about placement, or starting a new build phase:
1. Pull camera far back (e.g., Z=50 or more)
2. Place and orient objects while viewing from this wide shot
3. Verify positions and rotations make sense
4. THEN zoom back in toward the hero framing

### Target Trick

Set `set_camera(target: {x, y, z})` to the centroid or center of interest. The camera then orbits around that point naturally.

1. **Set target to scene centroid** — center of bounding box of all objects
2. **Compute zoom from bounds** — derive camera distance from bounding box extents + FOV/focal length. Don't guess pull-back distance.
3. **Pull back from target** — move camera position far away, keeping target fixed
4. **Orbit by moving position** — raise Y for elevated angle, shift X/Z for side views
5. **Zoom = change distance from target** — predictable, no guessing

### Single-Mesh Framing Workflow

1. Set all mesh transforms to zero — rotation (0,0,0), translation (0,0,0)
2. Compute mesh centroid — parse OBJ vertices, bounding box, centroid = (min+max)/2
3. Set camera target to centroid — stable orbit pivot
4. **CRITICAL: Verify up vector = (0,1,0)** — camera pin 22 defaults to (0,0,0) which SILENTLY BREAKS orientation (random roll, no error). Always set explicitly or use `set_camera` (resets up to 0,1,0).
5. Back camera way up — full mesh visible
6. Orbit up slightly — raise Y for natural elevated angle
7. Fine-tune target for best framing
8. Zoom in — reduce distance until mesh fills frame

### 3D Asset Orientation

When loading 3D models from OTOY Studio or any source:
- Model facing direction is set by the generation pipeline — not random
- Plan camera position relative to the model's front face BEFORE creating nodes
- OTOY Studio preview shows the model at identity rotation — use it to determine facing direction
- If model faces +Z, camera at +Z sees the back — rotate model or move camera to -Z

**General rule:** Have a complete composition plan (camera, object orientation, framing) BEFORE creating any nodes.

---

## Build Order

### Geo Before Lighting

Place geometry BEFORE setting lighting:
1. Geometry (all objects placed and positioned)
2. Materials (dress the geo)
3. Lighting (environment, emitters, etc.)

This ensures clear preview during the build process.

### Recipe Assembly

When building from a recipe, all values are pre-calculated. Assemble ASAP:
- Don't re-engineer lighting or fiddle with values during build
- Trust the recipe
- Iterate AFTER the full scene is assembled

---

## Visual Debugging

- Use **1920x1080 preview screenshots** for verification, not the default small viewport
- For a second opinion, send screenshots to `mcp__otoy-studio__chat_completion` for visual comparison
- After any CSS/layout change: resize preview → screenshot → verify

---

## Demo Restarts

Before every demo restart, list all current lessons learned. This scrolls the chat and refreshes context.
