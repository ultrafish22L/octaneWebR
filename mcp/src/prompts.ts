/**
 * MCP Prompts — workflow knowledge as reusable templates
 *
 * Encodes domain knowledge from CLAUDE.md and docs/mcp/ so any MCP client
 * gets the knowledge, not just Claude Code with CLAUDE.md loaded.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerPrompts(server: McpServer) {
  server.prompt(
    'setup-scene',
    'Create a basic Octane scene from scratch. Covers RT creation, DOF disable, camera setup, geometry wiring, and first render.',
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Set up a basic Octane scene from scratch. Follow these steps exactly:

1. **Create Render Target (RT)**
   - create_node("NT_RENDER_TARGET")
   - This auto-creates camera (pin 0), kernel (pin 6), and other internal children

2. **Disable DOF** (ON by default — aperture=0.893 causes blur)
   - get_node_info(RT) → find camera handle at pin 0
   - get_node_info(camera) → find aperture child at pin 14
   - set_attribute(aperture_handle, attribute_id=185, type=9, value=0.0)

3. **Set Camera Position**
   - set_camera with position=[0, 2, -5], target=[0, 0, 0], up=[0, 1, 0]

4. **Create Geometry Chain**
   - create_node("NT_GEO_GROUP") → geo group
   - create_and_connect("NT_GEO_PLACEMENT", geo_group_handle, pin_index=0)
   - create_and_connect("NT_GEO_OBJECT", placement_handle, pin_name="geometry")
   - connect_nodes(target=RT, pin_index=3, source=geo_group) — wires geometry to RT

5. **Create Basic Material** (optional but recommended)
   - create_and_connect("NT_MAT_UNIVERSAL", mesh_handle, pin_index=0)

6. **Add Environment Lighting**
   - create_and_connect("NT_ENV_DAYLIGHT", RT_handle, pin_index=1) — or NT_ENV_TEXTURE

7. **Set Emission Efficiency** (defaults to 0.025 = 40x dim)
   - For any emissive material: set attribute to 1.0

8. **Render & Verify**
   - start_render(RT_handle)
   - save_render("path/to/output.png")
   - Check render: if all white → missing connections; if blurry → DOF still on

KEY VALUES:
- RT pins: 0=camera, 1=environment, 3=geometry, 4=film, 6=kernel
- Transforms: A_TRANSLATION=172, A_ROTATION=137 (degrees!), A_SCALE=139 (all AT_FLOAT3=11)
- A_VALUE=185, A_FILENAME=34
- Material → mesh (pin 0), mesh → placement (pin_name "geometry"), placement → geo group (pin_index N)`,
          },
        },
      ],
    })
  );

  server.prompt(
    'add-material',
    'Add a PBR material to an existing mesh with texture connections.',
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Add a material to an existing mesh node. Follow these steps:

1. **Create Universal Material**
   - create_and_connect("NT_MAT_UNIVERSAL", mesh_handle, pin_index=0)
   - This creates the material AND connects it to the mesh's material pin

2. **Set Material Properties** (via texture nodes on material pins)
   - Diffuse color: create_and_connect("NT_TEX_RGB", material_handle, pin_name="diffuse")
     → set_attribute(rgb_handle, 185, type=11, value=[R, G, B]) where RGB are 0.0-1.0
   - Roughness: create_and_connect("NT_TEX_FLOAT", material_handle, pin_name="roughness")
     → set_attribute(float_handle, 185, type=9, value=0.5) where 0=mirror, 1=diffuse
   - Specular: create_and_connect("NT_TEX_FLOAT", material_handle, pin_name="specular")
     → set_attribute(float_handle, 185, type=9, value=0.5)

3. **Image Textures** (instead of flat colors)
   - create_and_connect("NT_TEX_IMAGE", material_handle, pin_name="diffuse")
   - set_attribute(image_handle, attribute_id=34, type=14, value="C:/path/to/texture.png")
   - A_FILENAME=34, AT_STRING=14

4. **Verify**
   - get_node_info(material_handle, connected_only=true) → check pins have connections
   - start_render → check material appears correctly

COMMON MATERIAL TYPES:
- NT_MAT_UNIVERSAL — PBR material (most common)
- NT_MAT_TOON — toon/cel shading
- NT_MAT_METALLIC — metallic material
- NT_MAT_SPECULAR — specular workflow
- NT_MAT_MIX — blend two materials`,
          },
        },
      ],
    })
  );

  server.prompt(
    'build-lit-object',
    'Create a complete object with geometry, material, placement, and lighting.',
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
   - Primitives: 0=Box, 1=Cylinder, 2=Sphere, 3=Torus, 4=Plane, 6=Disc
   - NOTE: Quad (5) renders no geometry — Octane API bug

3. **Create & Connect Material**
   - create_and_connect("NT_MAT_UNIVERSAL", mesh_handle, pin_index=0)
   - Set diffuse, roughness, specular via texture nodes (see add-material prompt)

4. **Create Placement + Transform**
   - create_node("NT_GEO_PLACEMENT") → placement_handle
   - connect_nodes(target=placement, pin_name="geometry", source=mesh)
   - set_attribute(placement, A_TRANSLATION=172, AT_FLOAT3=11, value=[x, y, z])
   - set_attribute(placement, A_ROTATION=137, AT_FLOAT3=11, value=[rx, ry, rz]) — DEGREES!
   - set_attribute(placement, A_SCALE=139, AT_FLOAT3=11, value=[sx, sy, sz])

5. **Wire to Render Target**
   - Create or find geo group: create_node("NT_GEO_GROUP")
   - connect_nodes(target=geo_group, pin_index=0, source=placement)
   - connect_nodes(target=RT, pin_index=3, source=geo_group) — geometry pin

6. **Add Lighting**
   - Daylight: create_and_connect("NT_ENV_DAYLIGHT", RT_handle, pin_index=1)
   - Texture env: create_and_connect("NT_ENV_TEXTURE", RT_handle, pin_index=1)
     → connect HDRI image to environment's texture pin
   - Emissive: set emission on material (remember efficiency defaults to 0.025!)

7. **Position Camera**
   - set_camera(position=[x,y,z], target=[x,y,z], up=[0,1,0])
   - Frame the object: camera distance ≈ 2-3x object size

8. **Render & Verify**
   - start_render → save_render → check output
   - Render after EVERY object, not in batch`,
          },
        },
      ],
    })
  );

  server.prompt(
    'troubleshoot-render',
    'Diagnose and fix common Octane render issues: white render, blurry, too dark, no geometry, crashes.',
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Troubleshoot common Octane render issues:

## All White Render
- Missing connections on RT. Check: get_node_info(RT_handle, connected_only=true)
- Pin 0 (camera), pin 3 (geometry), pin 6 (kernel) must all have connections
- If pin 3 is empty: geometry chain is broken (mesh → placement → geo group → RT pin 3)

## Blurry Render
- DOF is ON by default (aperture=0.893)
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
- Quad primitive (type 5) renders no geometry — Octane API bug, use Plane (4) instead

## Octane Crash (ECONNRESET / ECONNREFUSED)
- Octane has terminated. ALL handles are now invalid.
- Recovery: restart Octane, wait 10-15s for gRPC to listen, rebuild scene from scratch
- Never retry the same call — the connection is dead
- Common crash causes:
  - nodeInfo on crash type IDs [0, 116, 408, 40000, 50000, 50106-50108, 50136-50137]
  - reset_project without save_project first (blocking dialog)
  - Bad A_FILENAME path (30s gRPC hang)

## Connection Appears to Succeed but Nothing Changes
- connect_nodes returns success:true even on silent failures
- Auto-verify should catch this (v2.1.0+), but double-check:
  - Use pin_name or pin_index, never pin_id
  - RT geometry: must use pin_index=3 (pin_id=59 silently fails)
  - Mesh material: must use pin_index=0 (pin_id=30 silently fails)
  - Can't connect to auto-created internal children — create standalone node instead

## After 2 Failures of the Same Kind
- STOP. Don't retry or add pacing.
- Step back, list alternatives, try a different approach entirely.`,
          },
        },
      ],
    })
  );
}
