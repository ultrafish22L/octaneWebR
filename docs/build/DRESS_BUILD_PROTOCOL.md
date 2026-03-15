# DRESS BUILD PROTOCOL — Scene construction order for MCP

Every step produces a visible change. Every step tests something specific. Never skip verification.

## Phase 1: Foundation (viewport goes from black to sky)

1. **Create RT** — `create_node(NT_RENDERTARGET)`
   - *Verify:* `get_node_info(RT)` returns valid handle. Pins 0-6 exist.
   - *Visual:* Nothing yet — viewport is black or unchanged.
   - *Tests:* Node creation, RT structure.

2. **Create PT kernel → connect to RT** — `create_node(NT_KERN_PATHTRACING)` → `connect_nodes(kernel, RT, pin_id:89)`
   - *Verify:* `get_node_info(RT)` → pin 6 (kernel) has `connected_handle != 0`.
   - *Visual:* Still nothing — no render started yet.
   - *Tests:* pin_id connection, kernel swap from default DL.

3. **Create environment → connect to RT** — Daylight or texture env → `connect_nodes(env, RT, pin_id:43)`
   - For daylight: set sun direction low (sunset angle) so horizon is visible and sky has color gradient, not flat white.
   - For texture env: load HDR/JPG with absolute path, `A_RELOAD`.
   - *Verify:* `get_node_info(RT)` → pin 1 (environment) has `connected_handle != 0`.
   - *Visual:* Still no render — but environment is wired.
   - *Tests:* Environment connection, texture loading if applicable.

4. **`start_render`** — viewport goes LIVE
   - *Verify:* `get_render_status()` returns active. Screenshot shows sky/environment — NOT black.
   - *Visual:* **First big moment** — viewport floods with color. Sunset sky, horizon line, ground plane from env. The audience sees something for the first time.
   - *Tests:* Render pipeline, environment rendering, camera defaults.

5. **Disable DOF immediately** — RT pin 0 → camera → pin 14 → aperture child → `set_attribute(handle, 185, AT_FLOAT=9, 0)`
   - *Verify:* `get_node_info` on aperture child confirms value is 0.
   - *Visual:* Sky should sharpen slightly (default aperture 0.893 causes mild blur).
   - *Tests:* Nested pin traversal, float attribute write.

## Phase 2: First Object (sky gets an occupant)

6. **Create first mesh** — `create_node(NT_GEO_MESH)` → load .obj with absolute path + `A_RELOAD`
   - Pick something with clear silhouette: teapot, torus, diamond. NOT cube (hard to distinguish from artifacts).
   - *Verify:* Node exists, filename attribute set.
   - *Visual:* Nothing yet — mesh is floating unconnected.
   - *Tests:* Mesh creation, file loading.

7. **Create a LOUD material** — `create_node(NT_MAT_DIFFUSE)` → set diffuse color to saturated red `[1, 0, 0]` or bright orange.
   - *Verify:* Material node exists with correct color value.
   - *Visual:* Nothing — material not connected.
   - *Tests:* Material creation, color attribute.
   - *Why loud:* A subtle material (grey, glass, specular) makes it impossible to tell "is the object there but transparent, or did connection fail?" Saturated color removes all ambiguity.

8. **Wire material → mesh** — `connect_nodes(material, mesh, pin_index:0)`
   - *Verify:* `get_node_info(mesh)` → pin 0 has material handle.
   - *Visual:* Still nothing — mesh not in RT yet.
   - *Tests:* Material-to-mesh connection (pin_index:0 — pin_id:30 silently fails!).

9. **Create placement → wire mesh → placement** — `create_node(NT_GEO_PLACEMENT)` → `connect_nodes(mesh, placement, pin_name:"geometry")`
   - *Verify:* Placement has mesh connected.
   - *Visual:* Still nothing.
   - *Tests:* Placement wiring.

10. **Create geo group → wire placement → group → wire group → RT → `set_camera`** — `create_node(NT_GEO_GROUP)` → `connect_nodes(placement, group, pin_index:0)` → `connect_nodes(group, RT, pin_index:3)` → **`set_camera`** to refresh geometry tree
    - **CRITICAL:** `start_render` does NOT refresh the geometry tree. `set_camera` is the ONLY way to force geometry re-evaluation after connecting new objects to RT.
    - *Verify:* `get_node_info(RT)` → pin 3 (geometry) has `connected_handle != 0`. pin_id:59 SILENTLY FAILS, only pin_index:3 works.
    - *Visual:* **Second big moment** — bright red/orange object appears against sunset sky. Clear, unmistakable.
    - *Tests:* RT geometry connection, `set_camera` refresh, full geo chain.

11. **Frame camera on object** — `set_camera` with target at object position, pull camera back to frame it.
    - *Verify:* Screenshot shows object centered, well-framed, right-side up.
    - *Visual:* Object snaps to center of viewport, fills frame nicely.
    - *Tests:* Camera positioning, target trick, up vector (must stay 0,1,0).

## Phase 3: Incremental Assembly (scene populates object by object)

12. **Swap to real material** — replace loud red with intended material (glossy, metallic, etc.)
    - *Verify:* Screenshot shows material change — reflections, roughness, color shift.
    - *Visual:* Object transforms from flat matte red to realistic surface. **Satisfying moment** — same shape, completely different feel.
    - *Tests:* Material attribute changes on live render, auto-refresh.

13. **Add second geo** — new mesh → material → placement → connect to geo group `pin_index: 1`
    - Use contrasting shape (if first was organic/round, use angular; if small, use large).
    - Give it a visually distinct material — different color or different material type.
    - *Verify:* Screenshot shows two objects. Both visible, both have correct materials.
    - *Visual:* Scene gains depth and composition. No longer a single floating object.
    - *Tests:* Multi-object geo group, second Input pin.

14. **Transform second geo** — `set_attribute` for A_TRANSLATION, A_ROTATION, A_SCALE on its placement.
    - Move it to a deliberate position relative to first object. Rotate it interestingly. Scale if needed.
    - *Verify:* Screenshot shows object in new position/orientation.
    - *Visual:* Composition starts to feel intentional, not random.
    - *Tests:* Transform attributes (172, 137, 139), AT_FLOAT3, degrees for rotation.

15. **Repeat steps 13-14** for remaining objects, one at a time.
    - Each addition should be verified with a screenshot.
    - Re-frame camera as composition grows.
    - *Tests:* Stability under repeated node creation, geo group scaling.

## Phase 4: Refinement (polish pass)

16. **Add floor/ground** — `floor.obj` mesh with appropriate material, placed at y=0.
    - *Verify:* Objects now sit ON something instead of floating in void.
    - *Visual:* Scene instantly looks grounded and real. Shadows appear on floor.
    - *Tests:* Large-scale mesh, shadow catching.

17. **Adjust lighting** — tweak environment intensity, sun direction, or add emissive mesh for accent light.
    - *Verify:* Screenshot shows lighting change — shadows shift, mood changes.
    - *Visual:* Scene goes from "lit" to "dramatically lit."
    - *Tests:* Live environment parameter changes.

18. **Hero camera position** — final framing with considered composition.
    - *Verify:* Screenshot shows final composition.
    - *Visual:* The "money shot." Everything comes together.
    - *Tests:* Camera precision.

19. **Save render** — `save_render("renders/scene_name.png")`
    - *Verify:* File exists on disk at expected path.
    - *Visual:* Final image captured.
    - *Tests:* Render output pipeline, correct directory.

---

## Key Principles

- **One change, one screenshot.** Every step that should produce a visible difference gets verified with a screenshot. If the screenshot doesn't show the expected change, STOP and debug before proceeding.
- **Loud before subtle.** Start with saturated primary colors so you can confirm geometry exists. Swap to final materials only after confirming the shape is there.
- **Biggest visual delta first.** The audience should never stare at a black viewport for more than one step. Get sky up fast (step 4), get an object in fast (step 10).
- **Never trust `success:true`.** The RT geometry pin (pin_id:59) and mesh material pin (pin_id:30) both report success while silently failing. Always verify connections with `get_node_info` and confirm `connected_handle != 0`.
- **Build order is test order.** Each step implicitly tests the previous step's output. If step 10 fails (no object visible), the bug could be in steps 6-10 — but because you verified each intermediate step, you know exactly where it broke.
- **Maintain the cheat sheet.** Common values (sunset params, material presets, camera positions, pin gotchas) live in `docs/build/OCTANE_CHEATSHEET.md`. Consult it before every build. Update it whenever you discover or refine a value. Never re-derive what you've already figured out.

## How to Apply

Follow this exact sequence for every MCP scene build. The protocol works for both demo (DRESS) mode and bug hunting. In demo mode, pause between phases for effect. In test mode, screenshot every step and diff against expectations.

---

## NT_GEO_OBJECT Variant

NT_GEO_OBJECT (geometric primitive) can be used instead of NT_GEO_MESH + .obj files. Key differences:

- **Auto-wrapping:** When connected to RT pin 3, auto-creates NT_OUT_GEOMETRY → NT_GEO_PLACEMENT → NT_OBJECTLAYER_MAP chain. No manual placement/group needed for single objects.
- **Material pin:** Use `pin_index: 1` (not 0 like NT_GEO_MESH). Pin 0 is the primitive type enum.
- **Transform pin:** Pin 3 on the geo object (NT_TRANSFORM_VALUE).
- **Multi-object:** For multiple NT_GEO_OBJECT nodes, create NT_GEO_GROUP, connect each geo to group pins (0, 1, 2...), connect group to RT pin_index:3.
- **Default is Box.** No set_attribute needed for a box.

### Primitive Type Change

Setting primitive types 1-17, 19-23 is **safe** — works while connected to RT/group, no disconnect needed (verified 2026-03-14 with 22 distinct shapes in a grid).

**Type 18 (Quad) crashes Octane — NEVER use it.** Workaround: flat Box (A_SCALE Y≈0.001) or NT_GEO_MESH + `quad.obj`.

After setting type + connecting to RT, call `set_camera` to refresh the geometry tree.

Primitive values: Box=1, Capsule=2, Cone=3, Cylinder=4, Sphere=20, Torus=22 (see `docs/build/OCTANE_CHEATSHEET.md` for full list).
