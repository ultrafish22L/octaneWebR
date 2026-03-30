/**
 * MCP Prompts — workflow knowledge as reusable templates
 *
 * Encodes domain knowledge from CLAUDE.md and docs/mcp/ so any MCP client
 * gets the knowledge, not just Claude Code with CLAUDE.md loaded.
 *
 * 10 prompts total:
 *   4 original (updated): setup-scene, add-material, build-lit-object, troubleshoot-scene
 *   6 new: dress-workflow, mesh-pipeline, setup-lighting, critique-loop,
 *          scene-checklist, troubleshoot-scene (expanded from troubleshoot-render)
 *
 * Tool names updated for v3 renames:
 *   create_and_connect → create_connected
 *   import_geo → import_mesh
 *   attach_mesh → place_mesh
 *   update_scene → flush_changes
 *   delete_unconnected → cleanup_orphans
 *   get_all_attributes → list_attributes
 *   get_attribute_info → describe_attribute
 *   get_pin_value → read_pin_value
 *   refresh_webapp → refresh_ui
 *   is_node_animated → list_animated_attributes
 *   save_user_preset → save_sega_preset
 *   score_mugshot_models → benchmark_vlm_models
 *
 * Constants moved to octane://constants resource — prompts reference it.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPrompts(server: McpServer) {
  // ── Original Prompts (updated for renames + resource refs) ────────

  server.registerPrompt(
    'setup-scene',
    {
      title: 'Setup Scene',
      description:
        'Create a basic Octane scene from scratch. Covers RT creation, DOF disable, camera setup, geometry wiring, and first render.',
    },
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Set up a basic Octane scene from scratch. Follow these steps exactly:

1. **Create Render Target (RT)**
   - create_node("NT_RENDERTARGET")
   - This auto-creates camera (pin 0), kernel (pin 6), and other internal children

2. **DOF is auto-disabled** on new RTs (aperture set to 0). For loaded/old RTs, check aperture:
   - RT → pin 0 (camera) → pin 14 (aperture child) → set_attribute(child, 185, 9, 0.0)

3. **Set Camera Position**
   - set_camera with position=[0, 2, -5], target=[0, 0, 0], up=[0, 1, 0]

4. **Create Geometry Chain**
   - create_node("NT_GEO_GROUP") → geo group
   - create_connected("NT_GEO_PLACEMENT", geo_group_handle, pin_index=0)
   - create_connected("NT_GEO_OBJECT", placement_handle, pin_name="geometry")
   - connect_nodes(target=RT, pin_index=3, source=geo_group) — wires geometry to RT

5. **Create Basic Material** (optional but recommended)
   - create_connected("NT_MAT_UNIVERSAL", mesh_handle, pin_index=1)
   - NOTE: NT_GEO_OBJECT uses pin 1 for material (pin 0 is primitive enum). NT_GEO_MESH uses pin 0.

6. **Add Environment Lighting**
   - create_connected("NT_ENV_DAYLIGHT", RT_handle, pin_index=1) — or NT_ENV_TEXTURE

7. **Set Emission Efficiency** (defaults to 0.025 = 40x dim)
   - For any emissive material: set attribute to 1.0

8. **Render & Verify**
   - start_render(RT_handle)
   - save_render("path/to/output.png")
   - Check render: if all white → missing connections; if blurry → DOF still on

KEY VALUES — query octane://constants for full reference:
- RT pins: camera=0, environment=1, geometry=3, film=4, kernel=6
- Transforms: A_TRANSLATION=172, A_ROTATION=137 (degrees!), A_SCALE=139 (all AT_FLOAT3=11)
- A_VALUE=185, A_FILENAME=34
- Material → NT_GEO_MESH (pin 0) or NT_GEO_OBJECT (pin 1)`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'add-material',
    {
      title: 'Add Material',
      description: 'Add a PBR material to an existing mesh with texture connections.',
      argsSchema: {
        surface_type: z
          .string()
          .optional()
          .describe('Surface type for suggest_material (e.g. "gold", "glass", "wood")'),
      },
    },
    async ({ surface_type }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Add a material to an existing mesh node. Follow these steps:

1. **Create Universal Material**
   - create_connected("NT_MAT_UNIVERSAL", mesh_handle, pin_index=0)  # NT_GEO_MESH
   - For NT_GEO_OBJECT use pin_index=1 (pin 0 is the primitive enum)
   - This creates the material AND connects it to the mesh's material pin

2. **Set Material Properties** (via texture nodes on material pins)
   - Diffuse color: create_connected("NT_TEX_RGB", material_handle, pin_name="diffuse")
     → set_attribute(rgb_handle, 185, type=11, value=[R, G, B]) where RGB are 0.0-1.0
   - Roughness: create_connected("NT_TEX_FLOAT", material_handle, pin_name="roughness")
     → set_attribute(float_handle, 185, type=9, value=0.5) where 0=mirror, 1=diffuse
   - Specular: create_connected("NT_TEX_FLOAT", material_handle, pin_name="specular")
     → set_attribute(float_handle, 185, type=9, value=0.5)

3. **Image Textures** (instead of flat colors)
   - create_connected("NT_TEX_IMAGE", material_handle, pin_name="diffuse")
   - set_attribute(image_handle, attribute_id=34, type=14, value="C:/path/to/texture.png")

4. **Verify**
   - get_node_info(material_handle, connected_only=true) → check pins have connections
   - start_render → check material appears correctly

COMMON MATERIAL TYPES:
- NT_MAT_UNIVERSAL — PBR material (most common)
- NT_MAT_TOON — toon/cel shading
- NT_MAT_SPECULAR — specular workflow
- NT_MAT_MIX — blend two materials

For PBR surface presets, use suggest_material(surface_type) for SEGA-driven values.`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'build-lit-object',
    {
      title: 'Build Lit Object',
      description: 'Create a complete object with geometry, material, placement, and lighting.',
    },
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Build a complete lit object in an Octane scene. This combines geometry, material, placement, and lighting.

1. **Plan the Frame First**
   - Decide camera position, object position, and lighting before creating nodes
   - Know where everything goes — don't improvise positions

2. **Create Mesh + Set Primitive**
   - create_node("NT_GEO_OBJECT") → mesh_handle (defaults to Box)
   - To change primitive: get_node_info(mesh) → pin 0 has enum child
   - set_attribute(enum_child_handle, 185, AT_INT=3, value=primitiveType)
   - Primitives: read octane://primitive-types for the full enum (23 types). Common: 1=Box, 15=Plane, 20=Sphere, 22=Torus

3. **Create & Connect Material**
   - create_connected("NT_MAT_UNIVERSAL", mesh_handle, pin_index=1)  # pin 0 is primitive enum
   - Set diffuse, roughness, specular via texture nodes (see add-material prompt)

4. **Create Placement + Transform**
   - create_node("NT_GEO_PLACEMENT") → placement_handle
   - connect_nodes(target=placement, pin_name="geometry", source=mesh)
   - Transforms on placement handle (see octane://constants for IDs):
     set_attribute(placement, A_TRANSLATION=172, AT_FLOAT3=11, value={x, y, z})
     set_attribute(placement, A_ROTATION=137, AT_FLOAT3=11, value={rx, ry, rz}) — DEGREES!
     set_attribute(placement, A_SCALE=139, AT_FLOAT3=11, value={sx, sy, sz})

5. **Wire to Render Target**
   - Create or find geo group: create_node("NT_GEO_GROUP")
   - connect_nodes(target=geo_group, pin_index=0, source=placement)
   - connect_nodes(target=RT, pin_index=3, source=geo_group) — geometry pin

6. **Add Lighting**
   - Daylight: create_connected("NT_ENV_DAYLIGHT", RT_handle, pin_index=1)
   - Texture env: create_connected("NT_ENV_TEXTURE", RT_handle, pin_index=1)
     → connect HDRI image to environment's texture pin
   - Emissive: set emission on material (remember efficiency defaults to 0.025!)

7. **Position Camera**
   - fit_camera() for automatic framing, or set_camera(position, target, up) for manual
   - Camera distance ≈ 2-3x object size

8. **Render & Verify**
   - start_render → save_render → check output
   - Render after EVERY object, not in batch`,
          },
        },
      ],
    })
  );

  // ── troubleshoot-scene (expanded from troubleshoot-render) ────────

  server.registerPrompt(
    'troubleshoot-scene',
    {
      title: 'Troubleshoot Scene',
      description:
        'Diagnose and fix common Octane render and workflow issues: white render, blurry, too dark, no geometry, crashes, phase problems.',
    },
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Troubleshoot common Octane render and workflow issues:

## All White Render
- Usually means missing geometry. Check: get_node_info(RT_handle, connected_only=true)
- Pin 3 (geometry) must have a connection — this is the most common cause
- Pins 0 (camera) and 6 (kernel) are auto-created and always connected on new RTs
- Pin 1 (environment) missing = all BLACK, not white
- If pin 3 is empty: geometry chain is broken (mesh → placement → geo group → RT pin 3)

## Blurry Render
- DOF is auto-disabled on new RTs (aperture set to 0). For loaded/old RTs, aperture may be 0.893.
- Fix: RT → pin 0 (camera) → pin 14 (aperture child) → set A_VALUE=185, AT_FLOAT=9 to 0.0
- Or set aperture to very small value (0.001) for subtle DOF

## Too Dark / No Lighting
- Emission efficiency defaults to 0.025 (40x dimmer than expected)
- Fix: set emission efficiency to 1.0 on any emissive material/light
- Check RT pin 1 (environment) has a connection — no environment = no light

## No Geometry Visible
- Check full chain: mesh → placement → geo group → RT pin 3
- get_node_info on each node, verify connected pins
- Placement might have wrong transform (object at origin but camera pointing elsewhere)
- All 23 primitive types work (values 1-23) — check type enum value matches expected shape

## Octane Crash (ECONNRESET / ECONNREFUSED)
- Octane has terminated. ALL handles are now invalid.
- Recovery: restart octaneServGrpc, wait ~5s for gRPC on port 51022, rebuild scene from scratch
- Never retry the same call — the connection is dead

## Connection Appears to Succeed but Nothing Changes
- connect_nodes returns success:true even on silent failures
- Auto-verify should catch this (v2.1.0+), but double-check:
  - Use pin_name or pin_index, never pin_id
  - RT geometry: must use pin_index=3 (pin_id=59 silently fails)
  - Mesh material: must use pin_index=0 (pin_id=30 silently fails)
  - Can't connect to auto-created internal children — create standalone node instead

## Phase Workflow Issues

### "Which phase am I in?"
- get_art_direction_state() → shows current phase and completed gates
- Query octane://workflow/phases for phase tool map

### "fit_camera frames too wide"
- Cause: infinite floor plane (scale 30 = 300-unit bounds)
- Fix: reduce floor scale to <= 3x scene width, or pass explicit bbox to fit_camera

### "suggest_lighting returns generic values"
- Cause: set_artistic_intent was not called (no SEGA vector)
- Fix: call set_artistic_intent(preset:"...") FIRST, then suggest_lighting

### "critique_render returns self-critique prompt instead of Sonnet grade"
- Cause: missing reference_image_path parameter
- Fix: pass reference_image_path pointing to concept art PNG

### "place_mesh errors"
- Cause 1: analyze_mesh not run → no .mesh_info.json sidecar
- Cause 2: OBJ file path wrong or file doesn't exist
- Fix: run analyze_mesh first, verify file path, try again
- Do NOT fall back to manual create_node chains — diagnose the error

## After 2 Failures of the Same Kind
- STOP. Don't retry or add pacing.
- Step back, list alternatives, try a different approach entirely.`,
          },
        },
      ],
    })
  );

  // ── NEW PROMPTS ───────────────────────────────────────────────────

  server.registerPrompt(
    'dress-workflow',
    {
      title: 'DRESS Workflow',
      description:
        'Complete DRESS scene build pipeline from concept to beauty render. Phases 0→4 with gates, tool sequences, and hard rules.',
      argsSchema: {
        concept_image_path: z.string().optional().describe('Path to concept art PNG'),
        spec_name: z.string().optional().describe('Composition spec name'),
      },
    },
    async ({ concept_image_path, spec_name }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `DRESS Workflow — Complete scene build from concept to beauty render.

## Phase 0 — PLAN (no Octane calls yet)
1. analyze_reference(concept_art_path) → extract composition data
2. set_artistic_intent(preset or vector) → initialize SEGA mood
3. plan_composition(name, objects, camera, focal_point) → spatial layout
4. validate_layout(spec_name) → geometric checks
   **GATE: validate_layout passes with 0 errors. Do NOT create nodes until this passes.**

## Phase 0.5 — ASSETS
5. analyze_mesh(obj_path, source_endpoint:"huynan") for EVERY mesh
   - Creates .mesh_info.json sidecar with orientation/scale/offset
   - MUST run before place_mesh. No exceptions.
   - While meshes generate (~3 min), build scene infrastructure (RT, kernel, env)

## Phase 1 — FRAME (clay mode)
6. set_clay_mode(2) → color clay ON
7. create_node("NT_RENDERTARGET") → RT (auto-creates camera + kernel)
8. place_mesh(obj_path, role:"hero") → imports, orients, wires, auto-registers in placement state
   If using primitives (not place_mesh): call register_scene_object(handle, name, role, position, bounds) manually
9. fit_camera(framing_mode:"subjects") → frames hero+secondary, EXCLUDES ground. MANDATORY after every geo add.
10. start_render() → FIRST VISUAL
11. Add remaining objects: place_mesh (or create + register_scene_object) → fit_camera(framing_mode:"subjects") → render after EACH
12. **Creative review** (MANDATORY before critique):
    - "What else does this scene need?" Walls? Backdrop? Environment?
    - "Is anything floating?" Objects must be grounded.
    - "Does the floor have character?" Textured floor >> flat grey.
    - "Is there depth?" Foreground/mid/background layers.
    Add 1-3 supporting elements based on answers.
13. critique_render(render_path, spec_name, reference_image_path=concept_art)
    **GATE: Sonnet grade >= C. Do NOT proceed if < C.**

### Phase 1 Hard Rules:
- Clay mode stays ON until critique passes
- ONLY fit_camera — NEVER set_camera to fix framing (fix geometry instead)
- HDRI environment is standard for art scenes (not daylight)
- No infinite floor planes (scale <= 3x scene width)
- reference_image_path is MANDATORY for critique

## Phase 2 — DRESS (materials + lighting)
14. set_clay_mode(0) → materials visible
15. setup_lighting(mood) → creates full 3-point rig (key+fill+rim) + dims env in ONE call
    - Reads SEGA intent automatically for temperatures and ratios
    - Subject bounds auto-read from placement state
    - For additional lights (accents, practicals, glowing objects): use create_light()
    - For env adjustments: use set_daylight(power, turbidity, ...)
16. suggest_material(type) per surface → returns roughness/metallic/specular/ior/albedo
    **YOU MUST APPLY THE VALUES:**
    - For EACH material: read_pin_value to get child handles → set_attribute with recipe values
    - Do NOT override albedo if mesh has .mtl textures
17. Second creative review: "Does the lighting tell a story?"

### Phase 2 Rules:
- **Ground planes = primitives.** Use NT_GEO_OBJECT (Plane=15), not place_mesh with OBJ files. Never analyze_mesh on a flat quad.
- **setup_lighting for the 3-point rig.** Don't manually create emissive planes — that's what the tool does internally.
- **create_light for individual lights.** Glowing mushrooms, neon signs, accent lights — pass material_handle to add emission to existing objects.

## Phase 3 — CRITIQUE LOOP
18. critique_render(render_path, spec_name, reference_image_path) → Sonnet grade
19. semantic_critique(render_path) → SEGA gap measurement
20. Read render + concept art yourself → orchestrator grade (be HARSH on framing)
21. apply_corrections(spec_name, iteration, overall_score, passed, scores)
22. If grade < B+: fix top corrections, re-render, go to 18
23. If stagnating (2 iterations < 0.3 improvement): redesign plan, don't tweak
    **GATE: Sonnet grade B+ or stagnation detected**

### Score Priority:
- framing >= 3 required BEFORE lighting/mood scores matter
- If framing < 3: fix camera/geometry FIRST, don't touch materials

## Phase 4 — BEAUTY
24. set_camera(position, target) → hero shot composition
25. save_render(path) → beauty render
26. save_project(path) → persist scene
27. Check 3 log files (log_mcp, log_grpc, log_serv) — 0 errors
28. reset_project() → clean for next scene

## HARD RULES:
- fit_camera only in Phases 1-3. set_camera Phase 4 only.
- 3 objects on a floor = automatic fail. Build the STAGE.
- Concept art must match scope (product shot → product concept, not room interior)
- Quality over quantity — B+ scene beats three C- scenes
- On error: FULL STOP → read logs → trace root cause → fix → verify

Query octane://workflow/phases for structured phase data.
Query octane://sega/presets for available SEGA presets.`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'mesh-pipeline',
    {
      title: 'Mesh Pipeline',
      description:
        'Import a mesh with correct orientation: analyze → place → fit_camera. The standard mesh import workflow.',
      argsSchema: {
        obj_path: z.string().optional().describe('Path to OBJ/GLB/glTF file'),
        source_endpoint: z
          .string()
          .optional()
          .describe('Origin endpoint (e.g. "huynan") for analyze_mesh'),
      },
    },
    async ({ obj_path, source_endpoint }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Import a mesh into the scene with correct orientation and placement.

1. **analyze_mesh(obj_path, source_endpoint:"huynan")**
   - Renders 8 mugshots, VLM verifies orientation
   - Creates .mesh_info.json sidecar with rotation/scale/offset
   - MUST run before place_mesh. No exceptions.
   - For Hunyuan-generated meshes, pass source_endpoint:"huynan" to skip VLM and apply known correction
   - Pass target_height to override auto-estimated scale

2. **place_mesh(obj_path, role:"hero|secondary|accent|prop|ground")**
   - Reads .mesh_info.json sidecar, applies transforms automatically
   - Wires: placement → geo group → RT (creates RT if none exists)
   - Auto-registers in scene placement state (fit_camera knows about it)
   - Optional: position override, rotation_override, scale_override
   - Optional: geo_group_handle to attach to specific geo group

3. **fit_camera(framing_mode:"subjects")**
   - MANDATORY after every place_mesh call
   - Always pass framing_mode:"subjects" — excludes ground plane from framing
   - Params: elevation (default 20°), yaw (default 0°), margin (default 0.3)

4. **start_render() → save_render(path) → verify**
   - Object should be visible, correctly oriented, grounded

## GOTCHAS:
- GLB/glTF files auto-converted to OBJ (texture paths may need fixing)
- If place_mesh errors: DIAGNOSE the error. Don't fall back to manual create_node chains.
- Scale: analyze_mesh estimates real-world height. Override with target_height if wrong.
- Always check the render — orientation issues are common with new mesh sources.

## PREFER place_mesh over import_mesh:
- place_mesh: reads sidecar, wires to RT, registers in placement state (PREFERRED)
- import_mesh: raw import, no sidecar, no wiring — only for manual control`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'setup-lighting',
    {
      title: 'Setup Lighting',
      description:
        'Set up scene lighting with HDRI environment and 3-point key/fill/rim from SEGA mood.',
    },
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Set up scene lighting with HDRI environment and 3-point key/fill/rim.

## Prerequisites
- Geometry must be placed and framed (Phase 1 complete)
- SEGA intent should be set (set_artistic_intent) — drives suggest_lighting values

## 1. Set Mood via SEGA (if not already done)
   set_artistic_intent(preset:"dramatic"|"ethereal"|"studio"|"noir"|"golden_hour"|"moonlit"|...)
   Query octane://sega/presets for full list with descriptions.

## 2. Get Lighting Recipe
   suggest_lighting(mood, subject_bounds_min, subject_bounds_max, camera_position)
   Returns: positions, colors (Kelvin), power values, key:fill:rim ratios

## 3. Create HDRI Environment
   - create_connected("NT_ENV_TEXTURE", RT_handle, pin_index=1)
   - Load HDRI: set_attribute(env_handle, A_FILENAME=34, AT_STRING=14, "path/to/hdri.hdr")
   - Power: set via power child node (default is fine for real HDRIs)
   - Real HDRIs: gamma 1.0, power ~1.0. Source: Poly Haven or AI-generated.
   - HDRI prompt pattern: "360 degree equirectangular panorama, [scene], HDR, seamless"

## 4. Create Area Lights (from recipe)
   For each light in the recipe:
   - create_node("NT_GEO_OBJECT") → set primitive to Plane (15)
   - Add emissive material: create_connected("NT_MAT_UNIVERSAL", light_mesh, pin_index=1)
   - Set emission: connect blackbody or RGB texture to emission pin
   - **CRITICAL: Set emission efficiency to 1.0** (default 0.025 = 40x dim!)
   - Position each light per recipe coordinates
   - Wire through placement → geo group → RT

## Blackbody Temperature Guide
   1800K=candle, 2700K=tungsten, 3200K=halogen, 4100K=moonlight,
   5500K=daylight, 6500K=overcast, 10000K=blue sky

## Key:Fill Ratios
   - 2:1 = flat/broadcast (even lighting)
   - 4:1 = natural (standard film)
   - 8:1 = dramatic (hard shadows)
   - 16:1+ = noir (extreme contrast)

## Environment as Lighting
   - Env fill only (power 1-2): supplements area lights
   - Env as primary (power 3-5): for floating objects, product shots
   - Real HDRI provides natural light bounce without area lights`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'critique-loop',
    {
      title: 'Critique Loop',
      description:
        'Run the dual-critic evaluation loop (C1-C7): Sonnet + orchestrator grades, SEGA gap, corrections.',
      argsSchema: {
        render_path: z.string().optional().describe('Path to rendered image'),
        reference_image_path: z.string().optional().describe('Path to concept art for comparison'),
      },
    },
    async ({ render_path, reference_image_path }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Run the dual-critic evaluation loop (Phases 2-4).

## C1. critique_render(render_path, spec_name, reference_image_path)
   → Sonnet compares concept art vs render → A-F grade, 1-5 scores, top fixes
   **MANDATORY: reference_image_path must point to concept art.**
   If you get a self-critique prompt back → you forgot the reference path. Re-call.

## C2. semantic_critique(render_path)
   → Pixel analysis measures gap vs SEGA target vector
   → Returns gap dimensions + correction suggestions
   → Only useful AFTER framing is correct

## C3. Read the render image yourself (Read tool on the saved PNG)
   → Give your own A-F grade. Be HARSH on framing.
   → Note disagreements with Sonnet.
   → You have build context Sonnet doesn't.

## C4. Synthesize: Sonnet grade + your grade + semantic gaps
   → Identify top 3 corrections by priority

## C5. apply_corrections(spec_name, iteration, overall_score, passed, scores)
   → Records scores, detects stagnation, gates further iteration
   → scores: {framing, depth, composition, lighting, placement} each 1-5

## C6. If score < 3.5 OR Sonnet grade < C:
   → Fix top corrections:
     Priority 1: Framing (camera, object positions, scale)
     Priority 2: Composition (missing elements, depth, grounding)
     Priority 3: Lighting (mood, contrast, temperature)
     Priority 4: Materials (roughness, color, detail)
   → Re-render → go to C1

## C7. If stagnating (2 iterations with < 0.3 improvement):
   → STOP tweaking. Redesign the plan.
   → Common causes: wrong camera angle, missing depth layer, mood mismatch
   → Try: different yaw, add foreground element, change SEGA preset

## SCORE PRIORITY
   framing >= 3 required BEFORE lighting/mood scores matter.
   If framing < 3: fix camera/geometry FIRST. Don't touch materials.
   This prevents wasting iterations on aesthetics when the frame is broken.

## PASS CRITERIA
   Sonnet grade B+ (or better) = pass.
   Both assessments logged to critique_stats.jsonl per scene.`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'scene-checklist',
    {
      title: 'Scene Checklist',
      description:
        'Pre-critique quality checklist. Run BEFORE calling critique_render to avoid wasting Sonnet calls on obviously broken scenes.',
    },
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Pre-critique quality checklist. Verify ALL checks before calling critique_render.

## FRAMING
- [ ] Hero object clearly visible, occupying >15% of frame
- [ ] No objects floating in mid-air (unless intentionally flying)
- [ ] Ground plane visible with shadows
- [ ] All objects within frame bounds (nothing cropped off edges)
- [ ] Camera distance appropriate (not absurdly far back)
- [ ] Scene has visual depth (foreground/mid/background layers)

## COMPOSITION
- [ ] More than 3 objects (3 objects on a floor = automatic F)
- [ ] Supporting elements present (walls, backdrop, environmental context)
- [ ] Floor has texture/character (not flat grey primitive)
- [ ] Objects grounded on surfaces (mounted objects have wall behind them)
- [ ] Concept art scope matches scene scope (product concept → product scene)

## LIGHTING (Phase 2+ only)
- [ ] HDRI environment connected (not daylight for art scenes)
- [ ] Emission efficiency set to 1.0 on all emissive materials (not default 0.025)
- [ ] Visible shadows present
- [ ] Warm/cool temperature contrast (not everything same Kelvin)

## TECHNICAL
- [ ] Clay mode OFF for Phase 2+ renders (set_clay_mode(0))
- [ ] RT has camera (pin 0), geometry (pin 3), kernel (pin 6) connected
- [ ] All mesh_info.json orientation transforms applied via place_mesh
- [ ] No infinite floor planes (scale <= 3x scene width)
- [ ] fit_camera called after last geometry change

## ACTION
If ANY framing check fails → fix geometry/camera BEFORE critique
If ANY composition check fails → add elements BEFORE critique
If ALL checks pass → proceed to critique_render with reference_image_path

Don't waste Sonnet calls on obviously broken framing.`,
          },
        },
      ],
    })
  );
}
