/**
 * MCP Prompts — workflow knowledge as reusable templates
 *
 * Encodes domain knowledge from CLAUDE.md and docs/mcp/ so any MCP client
 * gets the knowledge, not just Claude Code with CLAUDE.md loaded.
 *
 * 9 prompts:
 *   4 original: setup-scene, add-material, build-lit-object, troubleshoot-scene
 *   5 new: ad-workflow, mesh-pipeline, setup-lighting, critique-loop, scene-checklist
 *
 * v3.0.2: Tool renames (set_sega, score_render, etc.), phase-selectable ad-workflow, text concept briefs.
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
            text: `Set up a basic Octane scene from scratch.

1. **Place geometry** — place_geo handles RT creation, geo wiring, and registration automatically:
   - Primitive: place_geo(type:"primitive", shape:"sphere", position:{x:0,y:1,z:0}, role:"hero")
   - Mesh: analyze_geo(obj_path) first, then place_geo(type:"mesh", obj_path, role:"hero")
   - Creates RT + geo group on first call. Subsequent calls reuse the existing RT.

2. **Apply material** — suggest_material(surface_type) → apply_material(material_handle, ...recipe):
   - suggest_material("gold") → returns roughness, metallic, specular, IOR, albedo
   - apply_material(material_handle, albedo:{x:1,y:0.77,z:0.34}, roughness:0.15, metallic:1)
   - Skip albedo with skip_albedo:true if mesh has .mtl textures

3. **Frame camera** — fit_camera(framing_mode:"subjects") after every geo add

4. **Render & verify** — start_render() → save_render(path) → check output
   - All white → missing geometry connections (check RT pin 3)
   - Blurry → DOF on (set aperture to 0 on camera child pin 14)

5. **Environment** — for quick setup, the daylight env auto-created by RT is sufficient.
   For HDRI: create_at_pin("NT_ENV_TEXTURE", RT_handle, pin_index=1) + image texture.

Query octane://constants for attribute IDs and type codes.
Query octane://docs/reference/3 for RT pin layout.`,
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
            text: `Add a PBR material to an existing mesh.

## Quick path (recommended)
1. suggest_material(surface_type) → returns PBR recipe (roughness, metallic, specular, IOR, albedo)
2. apply_material(material_handle, ...recipe values) → applies all properties in one call
   - Set skip_albedo:true if mesh has .mtl textures (preserves existing texture colors)
   - Call with surface_type:"list" to see all 30+ available types

## Manual path (when you need fine control)
1. Create: create_at_pin("NT_MAT_UNIVERSAL", mesh_handle, pin_index=0) for NT_GEO_MESH, pin_index=1 for NT_GEO_OBJECT
2. Query octane://pin-layout/NT_MAT_UNIVERSAL for pin names and indices, then set_attribute on pin children
   See octane://docs/reference/5 for material presets.

## Image textures
   create_at_pin("NT_TEX_IMAGE", material_handle, pin_name="albedo")
   set_attribute(image_handle, 34, AT_STRING=14, "C:/path/to/texture.png")

## Verify
   start_render → save_render → check material appears correctly`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'build-lit-object',
    {
      title: 'Build Lit Object',
      description:
        'Quick-start: place geometry + material + lighting in one workflow. For full AD pipeline, use ad-workflow instead.',
    },
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Build a complete lit object (no AD pipeline).

1. **Place geometry** — place_geo(type:"primitive", shape:"sphere", position:{x:0,y:1,z:0}, role:"hero")
   For mesh: analyze_geo(obj_path) first, then place_geo(type:"mesh", obj_path, role:"hero")
   Ground: place_geo(type:"primitive", shape:"plane", scale:{x:5,y:1,z:5}, role:"ground")

2. **Apply material** — suggest_material("marble") → apply_material(material_handle, ...recipe)

3. **Set up lighting** — setup_lighting(mood:"dramatic") → full 3-point rig in one call

4. **Frame camera** — fit_camera(framing_mode:"subjects") after every geo add

5. **Render & verify** — start_render() → save_render(path) → check output

For full scene builds with AD gates and critique: use getPrompt("ad-workflow") instead.`,
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
- ad_state() → shows current phase and completed gates
- Query octane://workflow/phases for phase tool map

### "fit_camera frames too wide"
- Cause: infinite floor plane (scale 30 = 300-unit bounds)
- Fix: reduce floor scale to <= 3x scene width, or pass explicit bbox to fit_camera

### "suggest_lighting returns generic values"
- Cause: set_sega was not called (no SEGA vector)
- Fix: call set_sega(preset:"...") FIRST, then suggest_lighting

### "score_render returns self-critique prompt instead of Sonnet grade"
- Cause: missing reference_image_path parameter
- Fix: pass reference_image_path pointing to concept art PNG

### "place_geo errors"
- Cause 1: analyze_geo not run → no .mesh_info.json sidecar
- Cause 2: OBJ file path wrong or file doesn't exist
- Fix: run analyze_geo first, verify file path, try again
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

  // ── AD Workflow (phase-selectable) ─────────────────────────────────

  const AD_ACTIVATE = `## Activate
Call ad_state(build_mode:"dress") to enable AD with phased gates.`;

  const AD_PHASES: Record<string, string> = {
    '0': `## Pre-Phase — CLEAR (start fresh, MANDATORY)
0. reset_ad(confirm: true) → clear stale AD state from any previous scene
0b. reset_project() → clear Octane scene. **ALWAYS run this before a new build — stale geometry will corrupt your scene.**

## Phase 0 — CONCEPT + PLAN
**Concept input is REQUIRED** — at least one of:
  - **Image concept:** analyze_reference(image_path, scene_description) → vision extracts mood/composition
  - **Text concept:** analyze_reference(scene_description) → text brief for manual mood/composition

1. analyze_reference(image_path OR scene_description) → concept data
   - Image: OTOY Studio vision extracts composition, mood hints, object list
   - Text-only: returns structured brief. Include mood, objects, composition intent in description.
   - Simple concepts (geometric still life, product shot) → use primitives, skip mesh download
   - Complex concepts → generate meshes via OTOY Studio image-to-3D

2. analyze_geo(obj_path) for EVERY mesh — skip for primitives-only scenes
   - Creates .mesh_info.json sidecar with orientation/scale/offset
   - MUST run before place_geo. No exceptions for meshes.
   - **PARALLEL WORK:** Hunyuan-3D takes ~3 min. Build scene infrastructure in parallel.

3. set_sega(preset or vector) → set mood AFTER concept + assets are known
   - Mood informed by analyze_reference output + asset characteristics
   - Drives suggest_lighting/suggest_material values downstream

4. plan_layout(name, objects, camera, focal_point) → spatial layout
5. validate_layout(spec_name) → geometric checks
   **GATE: validate_layout passes with 0 errors. Do NOT create nodes until this passes.**

5b. Generate HDRI via OTOY Studio: flux-pro/new with equirectangular panorama prompt
   - Save to aigenerated/{scene}/assets/hdri_{scene}.png
   - Apply via NT_ENV_TEXTURE + NT_TEX_IMAGE with SPHERE PROJECTION`,

    '1': `## Phase 1 — FRAME (clay mode)
6. clay_mode(2) → color clay ON
7. create_node("NT_RENDERTARGET") → RT (auto-creates camera + kernel)
8. place_geo(obj_path, role:"hero") → imports, orients, wires, auto-registers in placement state
   For primitives (ground, hills, backdrops): place_geo(type:"primitive", shape:"box", ...) → auto-wires + registers
9. fit_camera(framing_mode:"subjects") → frames hero+secondary, EXCLUDES ground. MANDATORY after every geo add.
10. start_render() → FIRST VISUAL — check get_render_status immediately, 10 samples enough for clay
11. Add remaining objects: place_geo/place_geo → fit_camera(framing_mode:"subjects") → render + VERIFY each object visible after EACH
12. **Creative review** (MANDATORY before critique):
    - "What else does this scene need?" Walls? Backdrop? Environment?
    - "Is anything floating?" Objects must be grounded.
    - "Does the floor have character?" Textured floor >> flat grey.
    - "Is there depth?" Foreground/mid/background layers.
    Add 1-3 supporting elements based on answers.
13. score_render(render_path, spec_name, reference_image_path=concept_art)
    **CLAY GATE (enforced mechanically): composition_match >= 3 = pass.**
    Sonnet is instructed to grade SPATIAL LAYOUT ONLY in clay mode:
    - Only scores whether the right shapes are present in the right positions
    - Does NOT penalize for missing materials, darkness, reflections, lighting, or mood
    - missing_elements should only list missing geometry, never material properties
    - lighting_match, material_match, mood_match, and depth_match are always 3 (neutral) in clay
    When passed, framing_verified is set automatically. Response tells you to proceed.
    If failed: fix geometry/framing, re-render IN CLAY, critique again. Do NOT turn off clay.

### Phase 1 Hard Rules:
- Clay mode stays ON until clay critique passes (composition_match >= 3)
- ONLY fit_camera — NEVER set_camera to fix framing (fix geometry instead)
- Generate HDRI from concept art via OTOY Studio (equirectangular panorama)
- Apply HDRI to NT_ENV_TEXTURE with NT_TEX_IMAGE using SPHERE PROJECTION
- No infinite floor planes (scale <= 3x scene width)
- reference_image_path is MANDATORY for critique`,

    '2': `## Phase 2 — STYLE (materials + lighting)
14. clay_mode(0) → materials visible
15. setup_lighting(mood) → creates full 3-point rig (key+fill+rim) + dims env in ONE call
    - Reads SEGA intent automatically for temperatures and ratios
    - Subject bounds auto-read from placement state
    - For additional lights (accents, practicals, glowing objects): use create_light()
    - For env adjustments: use set_daylight(power, turbidity, ...)
16. suggest_material(type) per surface → returns roughness/metallic/specular/ior/albedo
    **Apply with apply_material(material_handle, ...recipe values):**
    - apply_material(mat_handle, roughness:0.15, metallic:1, specular:1, ior:1.5, albedo:{x:1,y:0.77,z:0.34})
    - Set skip_albedo:true if mesh has .mtl textures
17. Second creative review: "Does the lighting tell a story?"

### Phase 2 Rules:
- **Ground planes = primitives.** Use place_geo(type:"primitive", shape:"plane"), not place_geo(type:"mesh"). Never analyze_geo on a flat quad.
- **setup_lighting for the 3-point rig.** Don't manually create emissive planes — that's what the tool does internally.
- **create_light for individual lights.** Glowing mushrooms, neon signs, accent lights — pass material_handle to add emission to existing objects.`,

    '3': `## Phase 3 — CRITIQUE LOOP
18. score_render(render_path, spec_name, reference_image_path) → Sonnet grade
19. score_sega(render_path) → SEGA gap measurement. **Skip on iteration 1** — gross issues dominate, mood fine-tuning is premature. Run from iteration 2 onward.
20. Read render + concept art yourself → orchestrator grade (be HARSH on framing)
    **MANDATORY: State your own A-F grade explicitly.** Format: "Orchestrator grade: C+. [reason]." Not optional.
21. commit_scores(spec_name, iteration, overall_score, passed, scores)
22. If grade < B+: fix top corrections, re-render, go to 18
23. If stagnating (2 iterations < 0.3 improvement): redesign plan, don't tweak
    **GATE: Sonnet grade B+ or stagnation detected**

### Score Priority:
- framing >= 3 required BEFORE lighting/mood scores matter
- If framing < 3: fix camera/geometry FIRST, don't touch materials`,

    '4': `## Phase 4 — BEAUTY
24. set_camera(position, target) → hero shot composition
25. save_render(path) → beauty render
26. save_project(path) → persist scene
27. Check 3 log files (log_mcp, log_grpc, log_client) — 0 errors
28. reset_ad(confirm:true) + reset_project() → clean AD state + Octane scene for next scene`,
  };

  const AD_HARD_RULES = `## HARD RULES:
- fit_camera only in Phases 1-3. set_camera Phase 4 only.
- 3 objects on a floor = automatic fail. Build the STAGE.
- Concept art must match scope (product shot → product concept, not room interior)
- Quality over quantity — B+ scene beats three C- scenes
- On error: FULL STOP → read logs → trace root cause → fix → verify

Query octane://workflow/phases for structured phase data.
Query octane://sega/presets for available SEGA presets.`;

  server.registerPrompt(
    'ad-workflow',
    {
      title: 'AD Workflow',
      description:
        'Complete AD scene build pipeline from concept to beauty render. Phases 0→4 with gates, tool sequences, and hard rules. Pass phase to load only that phase.',
      argsSchema: {
        concept_image_path: z.string().optional().describe('Path to concept art PNG'),
        spec_name: z.string().optional().describe('Composition spec name'),
        phase: z
          .enum(['0', '1', '2', '3', '4'])
          .optional()
          .describe('Load only this phase. Omit for full workflow.'),
      },
    },
    async ({ concept_image_path, spec_name, phase }) => {
      let text: string;
      if (phase && AD_PHASES[phase]) {
        text = `AD Workflow — Phase ${phase}\n\n${AD_ACTIVATE}\n\n${AD_PHASES[phase]}\n\n${AD_HARD_RULES}`;
      } else {
        // Full workflow (backwards compatible)
        const allPhases = ['0', '1', '2', '3', '4'].map(k => AD_PHASES[k]).join('\n\n');
        text = `AD Workflow — Complete scene build from concept to beauty render.\n\n${AD_ACTIVATE}\n\n${allPhases}\n\n${AD_HARD_RULES}`;
      }
      return {
        messages: [
          {
            role: 'user' as const,
            content: { type: 'text' as const, text },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'mesh-pipeline',
    {
      title: 'Mesh Pipeline',
      description:
        'Import a mesh with correct orientation: analyze → place → fit_camera. The standard mesh import workflow.',
      argsSchema: {
        obj_path: z.string().optional().describe('Path to OBJ/GLB/glTF file'),
      },
    },
    async ({ obj_path }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Import a mesh into the scene with correct orientation and placement.

1. **analyze_geo(obj_path)** — MUST run before place_geo. No exceptions.
   - Caches orientation/scale/offset in .mesh_info.json sidecar
   - Pass target_height to override auto-estimated scale

2. **place_geo(type:"mesh", obj_path, role:"hero")** — reads sidecar, wires to RT, auto-registers.

3. **fit_camera(framing_mode:"subjects")** — MANDATORY after every place_geo call.

4. **start_render() → save_render(path) → verify** — check orientation and grounding.

## GOTCHAS:
- GLB/glTF auto-converted to OBJ (texture paths may need fixing)
- If place_geo errors: DIAGNOSE. Don't fall back to manual create_node chains.
- Scale wrong? Override with target_height on analyze_geo.
- Always check the render — orientation issues are common with new mesh sources.`,
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
            text: `Set up scene lighting with environment and 3-point key/fill/rim.

## Quick path (recommended)
1. set_sega(preset:"dramatic") → initializes SEGA mood (drives lighting values)
2. setup_lighting(mood:"dramatic") → creates full 3-point rig (key+fill+rim) in ONE call
   - Reads SEGA intent for temperatures and ratios automatically
   - Subject bounds auto-read from placement state
   - Also dims environment to match the mood
   - Returns all 3 light handles for fine-tuning

## Individual lights
   create_light(type:"emissive", position:{x:2,y:3,z:1}, power:10, temperature:5500)
   - For accent lights, practicals, glowing objects
   - Pass material_handle to add emission to an existing object

## HDRI environment
   create_at_pin("NT_ENV_TEXTURE", RT_handle, pin_index=1)
   set_attribute(env_handle, 34, AT_STRING=14, "path/to/hdri.hdr")
   HDRI prompt: "360 degree equirectangular panorama, [scene], HDR, seamless"

## Daylight adjustments
   set_daylight(power:0.3, turbidity:3, north_offset:45)

## Reference
   Blackbody: 1800K=candle, 2700K=tungsten, 5500K=daylight, 6500K=overcast
   Key:Fill: 2:1=flat, 4:1=natural, 8:1=dramatic, 16:1+=noir
   Query octane://sega/presets for all mood presets.
   Query octane://docs/creative/1 for full lighting guide.`,
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

## C1. score_render(render_path, spec_name, reference_image_path)
   → Sonnet compares concept art vs render → A-F grade, 1-5 scores, top fixes
   **MANDATORY: reference_image_path must point to concept art.**
   If you get a self-critique prompt back → you forgot the reference path. Re-call.

## C2. score_sega(render_path)
   → Pixel analysis measures gap vs SEGA target vector
   → Returns gap dimensions + correction suggestions
   → **Skip on iteration 1** — gross issues dominate, mood fine-tuning premature. Run from iteration 2+.
   → Only useful AFTER framing is correct

## C3. Read the render image yourself (Read tool on the saved PNG)
   → **MANDATORY: State your own A-F grade explicitly.**
   → Format: "Orchestrator grade: C+. [1 sentence reason]." This is non-negotiable.
   → Be HARSH on framing. Note disagreements with Sonnet.
   → You have build context Sonnet doesn't.

## C4. Synthesize: Sonnet grade + your grade + semantic gaps
   → Identify top 3 corrections by priority

## C5. commit_scores(spec_name, iteration, overall_score, passed, scores)
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
        'Pre-critique quality checklist. Run BEFORE calling score_render to avoid wasting Sonnet calls on obviously broken scenes.',
    },
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Pre-critique quality checklist. Verify ALL checks before calling score_render.

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
- [ ] Clay mode OFF for Phase 2+ renders (clay_mode(0))
- [ ] RT has camera (pin 0), geometry (pin 3), kernel (pin 6) connected
- [ ] All mesh_info.json orientation transforms applied via place_geo
- [ ] No infinite floor planes (scale <= 3x scene width)
- [ ] fit_camera called after last geometry change

## ACTION
If ANY framing check fails → fix geometry/camera BEFORE critique
If ANY composition check fails → add elements BEFORE critique
If ALL checks pass → proceed to score_render with reference_image_path

Don't waste Sonnet calls on obviously broken framing.`,
          },
        },
      ],
    })
  );
}
