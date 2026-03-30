/**
 * Lighting Tools — create_light, setup_lighting, set_daylight
 *
 * High-level tools that create and configure lights in one call.
 * Replaces the 11+ manual tool calls previously needed per light.
 *
 * create_light: Creates a single light (emissive primitive/mesh, quad, sphere, or spot)
 * setup_lighting: Full 3-point lighting from mood or SEGA intent
 * set_daylight: Configure daylight environment attributes
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient, mcpLog } from '../OctaneMcpClient';
import { ApiCache } from '../ApiCache';
import { ArtDirectionState, adWorkflow } from '../ArtDirectionState';
import { ScenePlacementState } from '../ScenePlacementState';
import { SemanticState } from '../sega/index';
import { resolveToLightingSummary } from '../sega/MappingEngine';
import { suggestLighting } from '../creative/lighting';
import {
  jsonResult,
  errorResult,
  extractHandle,
  OBJ_API_NODE,
  OBJ_API_NODE_GRAPH,
  OBJ_API_ITEM,
} from './utils';
import { ensureDynamicPin } from './pin-utils';
import { AttributeId } from '../shared/OctaneConstants';

// ── Node type IDs ──────────────────────────────────────────────────

const NT = {
  GEO_OBJECT: 153,
  GEO_GROUP: 3,
  MAT_DIFFUSE: 17,
  EMIS_BLACKBODY: 53,
  EMIS_TEXTURE: 54,
  TEX_RGB: 33,
  TEX_FLOAT: 166,
  LIGHT_QUAD: 148,
  LIGHT_SPHERE: 149,
  LIGHT_VOLUME_SPOT: 152,
  RT: 56,
  ENV_DAYLIGHT: 14,
} as const;

// Primitive shape enum values
const SHAPE_ENUM: Record<string, number> = {
  plane: 15,
  box: 1,
  sphere: 20,
  disc: 6,
};

const Vec3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() });

// ── Helpers (thin gRPC wrappers) ───────────────────────────────────

async function createNodeRaw(client: OctaneMcpClient, typeId: number): Promise<number> {
  const rootHandle = await client.getRootNodeGraph();
  const result = await client.callMethod('ApiNode', 'create', {
    type: typeId,
    ownerGraph: { handle: String(rootHandle), type: OBJ_API_NODE_GRAPH },
    configurePins: true,
  });
  const handle = extractHandle(result);
  if (!handle) throw new Error(`Failed to create node type ${typeId}`);
  return handle;
}

async function connectRaw(
  client: OctaneMcpClient,
  targetHandle: number,
  sourceHandle: number,
  pinIdx: number
): Promise<void> {
  await client.callMethod('ApiNode', 'connectToIx', {
    objectPtr: { handle: String(targetHandle), type: OBJ_API_NODE },
    pinIdx,
    sourceNode: { handle: String(sourceHandle), type: OBJ_API_NODE },
    evaluate: true,
    doCycleCheck: true,
  });
}

async function getConnectedChild(
  client: OctaneMcpClient,
  handle: number,
  pinIx: number
): Promise<number> {
  const result = await client.callMethod('ApiNode', 'connectedNodeIx', {
    objectPtr: { handle: String(handle), type: OBJ_API_NODE },
    pinIx,
    enterWrapperNode: true,
  });
  return Number(result?.result?.handle ?? 0);
}

async function setAttrRaw(
  client: OctaneMcpClient,
  handle: number,
  attrId: number,
  attrType: number,
  value: any
): Promise<void> {
  let valueParams: Record<string, any> = {};
  if (attrType === 1) valueParams = { bool_value: Boolean(value) };
  else if (attrType === 3) valueParams = { int_value: Number(value) };
  else if (attrType === 9) valueParams = { float_value: Number(value) };
  else if (attrType === 11) {
    const v = typeof value === 'object' ? value : { x: 0, y: 0, z: 0 };
    valueParams = { float3_value: { x: v.x, y: v.y, z: v.z } };
  } else if (attrType === 14) valueParams = { string_value: String(value) };
  else throw new Error(`Unsupported attr type ${attrType}`);

  await client.callMethod('ApiItem', 'setValueByAttrID', {
    objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
    attribute_id: attrId,
    ...valueParams,
    evaluate: false,
  });
}

/** Find the active RT's geo group handle. */
async function findGeoGroup(
  client: OctaneMcpClient
): Promise<{ rtHandle: number; geoGroupHandle: number }> {
  // Find RT by searching scene
  const tree = await client.callMethod('ApiRenderEngine', 'getRenderTargetNode', {});
  const rtHandle = extractHandle(tree) ?? 0;
  if (!rtHandle) throw new Error('No active render target found');

  // Pin 3 = geometry
  const geoGroupHandle = await getConnectedChild(client, rtHandle, 3);
  if (!geoGroupHandle) throw new Error('No geometry group on render target pin 3');

  return { rtHandle, geoGroupHandle };
}

/** Find the environment node on the active RT. */
async function findEnvironment(client: OctaneMcpClient, rtHandle?: number): Promise<number> {
  let rt = rtHandle;
  if (!rt) {
    const result = await client.callMethod('ApiRenderEngine', 'getRenderTargetNode', {});
    rt = extractHandle(result) ?? 0;
  }
  if (!rt) throw new Error('No active render target found');
  const envHandle = await getConnectedChild(client, rt, 1);
  if (!envHandle) throw new Error('No environment on render target pin 1');
  return envHandle;
}

// ── Core: create a single emissive light ───────────────────────────

interface CreateEmissiveResult {
  light_handle: number;
  material_handle: number;
  emission_handle: number;
  geo_group_pin: number;
}

async function createEmissiveLight(
  client: OctaneMcpClient,
  params: {
    shape: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
    temperature: number;
    power: number;
    color?: { x: number; y: number; z: number };
    double_sided: boolean;
    name: string;
    geoGroupHandle: number;
  }
): Promise<CreateEmissiveResult> {
  // 1. Create primitive
  const geo = await createNodeRaw(client, NT.GEO_OBJECT);
  client.sceneCache.addNode(geo, params.name, 'NT_GEO_OBJECT', NT.GEO_OBJECT);

  // Set primitive type
  const enumChild = await getConnectedChild(client, geo, 0);
  if (enumChild) {
    const shapeVal = SHAPE_ENUM[params.shape] ?? SHAPE_ENUM.plane;
    await setAttrRaw(client, enumChild, AttributeId.A_VALUE, 3, shapeVal);
  }

  // 2. Create material (NT_MAT_DIFFUSE)
  const mat = await createNodeRaw(client, NT.MAT_DIFFUSE);
  client.sceneCache.addNode(mat, `${params.name}_mat`, 'NT_MAT_DIFFUSE', NT.MAT_DIFFUSE);

  // Set diffuse to black (emissive-only)
  const diffuseChild = await getConnectedChild(client, mat, 0);
  if (diffuseChild) {
    await setAttrRaw(client, diffuseChild, AttributeId.A_VALUE, 11, { x: 0, y: 0, z: 0 });
  }

  // 3. Create emission
  let emis: number;
  if (params.color) {
    // Texture emission with RGB color
    emis = await createNodeRaw(client, NT.EMIS_TEXTURE);
    const texChild = await getConnectedChild(client, emis, 0);
    if (texChild) {
      await setAttrRaw(client, texChild, AttributeId.A_VALUE, 11, params.color);
    }
  } else {
    // Blackbody emission with temperature
    emis = await createNodeRaw(client, NT.EMIS_BLACKBODY);
    // Pin 5 = temperature
    const tempChild = await getConnectedChild(client, emis, 5);
    if (tempChild) {
      await setAttrRaw(client, tempChild, AttributeId.A_VALUE, 9, params.temperature);
    }
  }
  client.sceneCache.addNode(
    emis,
    `${params.name}_emis`,
    params.color ? 'NT_EMIS_TEXTURE' : 'NT_EMIS_BLACKBODY',
    params.color ? NT.EMIS_TEXTURE : NT.EMIS_BLACKBODY
  );

  // Set power (pin 1)
  const powerChild = await getConnectedChild(client, emis, 1);
  if (powerChild) {
    await setAttrRaw(client, powerChild, AttributeId.A_VALUE, 9, params.power);
  }

  // Set efficiency to 1.0 (pin 0) — CRITICAL: default 0.025 = 40x dim
  const effChild = await getConnectedChild(client, emis, 0);
  if (effChild) {
    await setAttrRaw(client, effChild, AttributeId.A_VALUE, 9, 1.0);
  }

  // Set double-sided (pin 4)
  if (params.double_sided) {
    const dsChild = await getConnectedChild(client, emis, 4);
    if (dsChild) {
      await setAttrRaw(client, dsChild, AttributeId.A_VALUE, 1, true);
    }
  }

  // 4. Connect: emission → material emission pin (14 on NT_MAT_DIFFUSE)
  await connectRaw(client, mat, emis, 14);

  // 5. Connect: material → primitive material pin (1)
  await connectRaw(client, geo, mat, 1);

  // 6. Set transform on primitive pin 3
  const xform = await getConnectedChild(client, geo, 3);
  if (xform) {
    await setAttrRaw(client, xform, AttributeId.A_TRANSLATION, 11, params.position);
    await setAttrRaw(client, xform, AttributeId.A_SCALE, 11, params.scale);
    if (params.rotation.x || params.rotation.y || params.rotation.z) {
      await setAttrRaw(client, xform, AttributeId.A_ROTATION, 11, params.rotation);
    }
  }

  // 7. Connect to geo group
  const pin = await ensureDynamicPin(client, params.geoGroupHandle);
  await connectRaw(client, params.geoGroupHandle, geo, pin);

  // 8. Flush
  await client.callMethod('ApiChangeManager', 'update', {});

  mcpLog(
    `create_light: ${params.name} at (${params.position.x.toFixed(2)}, ${params.position.y.toFixed(2)}, ${params.position.z.toFixed(2)}) ${params.temperature}K power=${params.power}`,
    'info'
  );

  return { light_handle: geo, material_handle: mat, emission_handle: emis, geo_group_pin: pin };
}

/** Add emission to an existing material handle. */
async function addEmissionToMaterial(
  client: OctaneMcpClient,
  materialHandle: number,
  temperature: number,
  power: number,
  color?: { x: number; y: number; z: number }
): Promise<number> {
  let emis: number;
  if (color) {
    emis = await createNodeRaw(client, NT.EMIS_TEXTURE);
    const texChild = await getConnectedChild(client, emis, 0);
    if (texChild) await setAttrRaw(client, texChild, AttributeId.A_VALUE, 11, color);
  } else {
    emis = await createNodeRaw(client, NT.EMIS_BLACKBODY);
    const tempChild = await getConnectedChild(client, emis, 5);
    if (tempChild) await setAttrRaw(client, tempChild, AttributeId.A_VALUE, 9, temperature);
  }

  const powerChild = await getConnectedChild(client, emis, 1);
  if (powerChild) await setAttrRaw(client, powerChild, AttributeId.A_VALUE, 9, power);

  const effChild = await getConnectedChild(client, emis, 0);
  if (effChild) await setAttrRaw(client, effChild, AttributeId.A_VALUE, 9, 1.0);

  // Find emission pin on material — try pin_name "emission" via connectTo1
  await client.callMethod('ApiNode', 'connectTo1', {
    objectPtr: { handle: String(materialHandle), type: OBJ_API_NODE },
    pinName: 'emission',
    sourceNode: { handle: String(emis), type: OBJ_API_NODE },
    evaluate: true,
    doCycleCheck: true,
  });

  await client.callMethod('ApiChangeManager', 'update', {});
  mcpLog(
    `create_light: added emission to material ${materialHandle} (${temperature}K, power=${power})`,
    'info'
  );
  return emis;
}

// ── Tool Registration ──────────────────────────────────────────────

export function registerLightingTools(
  server: McpServer,
  client: OctaneMcpClient,
  _cache: ApiCache | null,
  artState: ArtDirectionState | undefined,
  placementState: ScenePlacementState | undefined,
  segaState: SemanticState | undefined
) {
  // ── create_light ───────────────────────────────────────────────

  server.registerTool(
    'create_light',
    {
      title: 'Create Light',
      description:
        '[AD Phase 2] Create a light in one call. Emissive primitives, native lights (quad/sphere/spot), or emission on existing material. Auto-wires with efficiency=1.0.',
      inputSchema: {
        type: z
          .enum(['emissive', 'quad', 'sphere', 'spot'])
          .describe(
            'Light type: "emissive" = emissive geometry (most common), "quad"/"sphere"/"spot" = native Octane lights'
          ),
        position: Vec3Schema.describe('World-space position'),
        temperature: z
          .number()
          .default(5500)
          .describe('Color temperature in Kelvin (default 5500)'),
        power: z.number().default(10).describe('Emission power (default 10)'),
        scale: z
          .union([z.number(), Vec3Schema])
          .default(0.3)
          .describe('Light size — number for uniform, Vec3 for per-axis (default 0.3)'),
        rotation: Vec3Schema.optional().describe('Rotation in degrees (default {0,0,0})'),
        name: z.string().optional().describe('Display name (default: auto from type)'),
        color: Vec3Schema.optional().describe(
          'RGB color (0-1) — overrides temperature with texture emission'
        ),
        shape: z
          .enum(['plane', 'box', 'sphere', 'disc'])
          .default('plane')
          .describe('Primitive shape for type=emissive (default: plane)'),
        material_handle: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe(
            'Add emission to this existing material instead of creating new geometry. Turns any object into a light (e.g. glowing mushrooms).'
          ),
        geo_group_handle: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe('Target geo group (default: auto-find on active RT)'),
        double_sided: z.boolean().default(true).describe('Double-sided emission (default true)'),
      },
      annotations: { destructiveHint: true },
    },
    async params => {
      try {
        const rot = params.rotation ?? { x: 0, y: 0, z: 0 };
        const scaleVec =
          typeof params.scale === 'number'
            ? { x: params.scale, y: params.scale, z: params.scale }
            : params.scale;
        const name = params.name ?? `${params.type}_light`;

        // Mode 1: Add emission to existing material (glowing mushrooms etc.)
        if (params.material_handle !== undefined) {
          const emisHandle = await addEmissionToMaterial(
            client,
            params.material_handle,
            params.temperature,
            params.power,
            params.color
          );
          return jsonResult({
            success: true,
            mode: 'add_emission',
            emission_handle: emisHandle,
            material_handle: params.material_handle,
            temperature: params.color ? undefined : params.temperature,
            power: params.power,
            instruction:
              'Emission added to existing material. The object is now a light source. Use start_render + save_render to verify.',
          });
        }

        // Find geo group
        let geoGroupHandle = params.geo_group_handle;
        if (!geoGroupHandle) {
          const found = await findGeoGroup(client);
          geoGroupHandle = found.geoGroupHandle;
        }

        // Mode 2: Emissive geometry (primitive shape)
        if (params.type === 'emissive') {
          const result = await createEmissiveLight(client, {
            shape: params.shape,
            position: params.position,
            rotation: rot,
            scale: scaleVec,
            temperature: params.temperature,
            power: params.power,
            color: params.color,
            double_sided: params.double_sided,
            name,
            geoGroupHandle,
          });

          // Register as light in placement state
          if (placementState) {
            placementState.addEntry({
              handle: result.light_handle,
              name,
              role: 'light',
              position: params.position,
              rotation: rot,
              scale: scaleVec,
              boundsWorld: {
                min: {
                  x: params.position.x - scaleVec.x / 2,
                  y: params.position.y - scaleVec.y / 2,
                  z: params.position.z - scaleVec.z / 2,
                },
                max: {
                  x: params.position.x + scaleVec.x / 2,
                  y: params.position.y + scaleVec.y / 2,
                  z: params.position.z + scaleVec.z / 2,
                },
              },
            });
          }

          return jsonResult({
            success: true,
            mode: 'emissive',
            shape: params.shape,
            ...result,
            temperature: params.color ? undefined : params.temperature,
            color: params.color,
            power: params.power,
            position: params.position,
            instruction: 'Light created and connected. Use start_render + save_render to verify.',
            ...(artState ? adWorkflow(artState, 'create_light') : {}),
          });
        }

        // Mode 3: Native Octane lights (quad, sphere, spot)
        const lightTypeMap: Record<string, number> = {
          quad: NT.LIGHT_QUAD,
          sphere: NT.LIGHT_SPHERE,
          spot: NT.LIGHT_VOLUME_SPOT,
        };
        const lightTypeId = lightTypeMap[params.type];
        if (!lightTypeId) return errorResult(`Unknown light type: ${params.type}`);

        const lightHandle = await createNodeRaw(client, lightTypeId);
        client.sceneCache.addNode(
          lightHandle,
          name,
          `NT_LIGHT_${params.type.toUpperCase()}`,
          lightTypeId
        );

        // Native lights have material on pin 1 (quad/sphere) or pin 4 (spot)
        const matPin = params.type === 'spot' ? 4 : 1;
        const existingMat = await getConnectedChild(client, lightHandle, matPin);

        // Create emission and attach to the light's material
        if (existingMat) {
          await addEmissionToMaterial(
            client,
            existingMat,
            params.temperature,
            params.power,
            params.color
          );
        } else {
          // Create new material
          const mat = await createNodeRaw(client, NT.MAT_DIFFUSE);
          await addEmissionToMaterial(client, mat, params.temperature, params.power, params.color);
          await connectRaw(client, lightHandle, mat, matPin);
        }

        // Set transform (pin 3 for quad/sphere, pin 7 for spot)
        const xformPin = params.type === 'spot' ? 7 : 3;
        const xform = await getConnectedChild(client, lightHandle, xformPin);
        if (xform) {
          await setAttrRaw(client, xform, AttributeId.A_TRANSLATION, 11, params.position);
          await setAttrRaw(client, xform, AttributeId.A_SCALE, 11, scaleVec);
          if (rot.x || rot.y || rot.z) {
            await setAttrRaw(client, xform, AttributeId.A_ROTATION, 11, rot);
          }
        }

        // Connect to geo group
        const pin = await ensureDynamicPin(client, geoGroupHandle);
        await connectRaw(client, geoGroupHandle, lightHandle, pin);
        await client.callMethod('ApiChangeManager', 'update', {});

        return jsonResult({
          success: true,
          mode: 'native',
          light_type: params.type,
          light_handle: lightHandle,
          geo_group_pin: pin,
          temperature: params.color ? undefined : params.temperature,
          power: params.power,
          position: params.position,
          instruction:
            'Native light created and connected. Use start_render + save_render to verify.',
          ...(artState ? adWorkflow(artState, 'create_light') : {}),
        });
      } catch (error: any) {
        mcpLog(`create_light FAILED: ${error.message}`, 'error');
        return errorResult(error);
      }
    }
  );

  // ── setup_lighting ─────────────────────────────────────────────

  server.registerTool(
    'setup_lighting',
    {
      title: 'Setup Lighting',
      description:
        '[AD Phase 2] Create full 3-point lighting (key + fill + rim) in one call. ' +
        'Uses SEGA artistic intent by default for temperatures and ratios, or falls back to mood-based recipes. ' +
        'Also dims the environment to match. Replaces 30+ manual tool calls.',
      inputSchema: {
        mood: z
          .string()
          .optional()
          .describe(
            'Lighting mood: dramatic, ethereal, natural, studio, noir, golden_hour, moonlit. Optional if SEGA intent is set.'
          ),
        subject_bounds_min: Vec3Schema.optional().describe(
          'Subject bounding box min. Auto-read from placement state if omitted.'
        ),
        subject_bounds_max: Vec3Schema.optional().describe(
          'Subject bounding box max. Auto-read from placement state if omitted.'
        ),
        camera_position: Vec3Schema.optional().describe(
          'Camera position for light angle computation. Auto-read if omitted.'
        ),
        env_power: z
          .number()
          .optional()
          .describe('Override environment power (default: from recipe/SEGA)'),
        geo_group_handle: z.number().int().nonnegative().optional().describe('Target geo group'),
        use_sega: z
          .boolean()
          .default(true)
          .describe('Read SEGA artistic intent for temperatures/ratios (default true)'),
      },
      annotations: { destructiveHint: true },
    },
    async params => {
      try {
        // 1. Resolve subject bounds
        let boundsMin = params.subject_bounds_min;
        let boundsMax = params.subject_bounds_max;
        if (!boundsMin || !boundsMax) {
          if (placementState) {
            const fb = placementState.getFramingBounds();
            if (fb) {
              boundsMin = fb.min;
              boundsMax = fb.max;
            }
          }
          if (!boundsMin || !boundsMax) {
            return errorResult(
              'No subject bounds available. Pass subject_bounds_min/max or register objects with place_geo first.'
            );
          }
        }

        // 2. Resolve camera position
        let camPos = params.camera_position;
        if (!camPos) {
          try {
            const camResult = await client.callMethod('LiveLink', 'GetCamera', {});
            const cr = camResult as any;
            if (cr?.position) camPos = cr.position;
          } catch {
            /* use default */
          }
        }

        // 3. Get SEGA lighting params if available
        let segaLighting: ReturnType<typeof resolveToLightingSummary> | null = null;
        if (params.use_sega && segaState) {
          const vec = segaState.getGlobal();
          if (Object.keys(vec).length > 0) {
            segaLighting = resolveToLightingSummary(vec);
          }
        }

        // 4. Get base recipe from mood
        const mood = params.mood ?? (segaLighting ? 'dramatic' : 'natural');
        const recipe = suggestLighting(mood, { min: boundsMin, max: boundsMax }, camPos);

        // 5. Merge SEGA overrides into recipe
        if (segaLighting) {
          // Override temperatures
          for (const light of recipe.lights) {
            if (light.type === 'key') {
              light.temperature = segaLighting.keyTemperature;
              // Scale power by key:fill ratio
              light.power = (segaLighting.rimPower * segaLighting.keyFillRatio) / 3;
            } else if (light.type === 'fill') {
              light.temperature = segaLighting.fillTemperature;
              light.power = segaLighting.fillPower;
            } else if (light.type === 'rim') {
              light.power = segaLighting.rimPower;
            }
          }
          recipe.environmentPower = segaLighting.envPower;
        }

        // Override env power if explicitly provided
        const envPower = params.env_power ?? recipe.environmentPower;

        // 6. Find geo group
        let geoGroupHandle = params.geo_group_handle;
        let rtHandle = 0;
        if (!geoGroupHandle) {
          const found = await findGeoGroup(client);
          geoGroupHandle = found.geoGroupHandle;
          rtHandle = found.rtHandle;
        }

        // 7. Create all lights
        const lights: Array<{ id: string; type: string; handle: number; pin: number }> = [];
        for (const light of recipe.lights) {
          const result = await createEmissiveLight(client, {
            shape: 'plane',
            position: light.position,
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 0.3, y: 0.3, z: 0.3 },
            temperature: light.temperature,
            power: light.power,
            double_sided: true,
            name: `${light.type}_light`,
            geoGroupHandle,
          });
          lights.push({
            id: light.id,
            type: light.type,
            handle: result.light_handle,
            pin: result.geo_group_pin,
          });
        }

        // 8. Dim environment
        try {
          const envHandle = await findEnvironment(client, rtHandle || undefined);
          // Pin 2 = power
          const powerChild = await getConnectedChild(client, envHandle, 2);
          if (powerChild) await setAttrRaw(client, powerChild, AttributeId.A_VALUE, 9, envPower);
          // Pin 3 = sun intensity (dim to near zero for studio lighting)
          const sunChild = await getConnectedChild(client, envHandle, 3);
          if (sunChild) await setAttrRaw(client, sunChild, AttributeId.A_VALUE, 9, envPower * 0.5);
          await client.callMethod('ApiChangeManager', 'update', {});
        } catch (e: any) {
          mcpLog(`setup_lighting: env adjustment skipped: ${e.message}`, 'warn');
        }

        mcpLog(
          `setup_lighting: ${mood} — ${lights.length} lights created, env power=${envPower.toFixed(3)}`,
          'info'
        );

        return jsonResult({
          success: true,
          mood,
          lights,
          env_power: envPower,
          sega_used: !!segaLighting,
          recipe: {
            ratios: recipe.ratios,
            notes: recipe.notes,
            lights: recipe.lights.map(l => ({
              id: l.id,
              type: l.type,
              temperature: l.temperature,
              power: l.power,
              position: l.position,
            })),
          },
          instruction:
            'Lighting setup complete. Use start_render + save_render to verify. Adjust individual lights with set_attribute if needed.',
          ...(artState ? adWorkflow(artState, 'setup_lighting') : {}),
        });
      } catch (error: any) {
        mcpLog(`setup_lighting FAILED: ${error.message}`, 'error');
        return errorResult(error);
      }
    }
  );

  // ── set_daylight ───────────────────────────────────────────────

  server.registerTool(
    'set_daylight',
    {
      title: 'Set Daylight',
      description:
        'Configure daylight environment attributes without pin-chasing. ' +
        'Finds the daylight env on the active RT and sets any provided parameters.',
      inputSchema: {
        power: z
          .number()
          .optional()
          .describe('Environment power (e.g. 0.1 for dim, 1.0 for bright)'),
        sun_intensity: z.number().optional().describe('Sun intensity multiplier'),
        turbidity: z.number().optional().describe('Sky clarity (1=clear, 10=hazy)'),
        north_offset: z.number().optional().describe('North offset in degrees'),
        sky_color: Vec3Schema.optional().describe('Sky tint RGB (0-1)'),
        ground_color: z.number().optional().describe('Ground color (0=black, 1=white)'),
        render_target_handle: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe('RT to find env on (default: active RT)'),
      },
      annotations: { destructiveHint: true },
    },
    async params => {
      try {
        const envHandle = await findEnvironment(client, params.render_target_handle);
        const changes: string[] = [];

        // Pin 2 = power
        if (params.power !== undefined) {
          const child = await getConnectedChild(client, envHandle, 2);
          if (child) {
            await setAttrRaw(client, child, AttributeId.A_VALUE, 9, params.power);
            changes.push(`power=${params.power}`);
          }
        }

        // Pin 3 = sun intensity
        if (params.sun_intensity !== undefined) {
          const child = await getConnectedChild(client, envHandle, 3);
          if (child) {
            await setAttrRaw(client, child, AttributeId.A_VALUE, 9, params.sun_intensity);
            changes.push(`sun_intensity=${params.sun_intensity}`);
          }
        }

        // Pin 1 = turbidity
        if (params.turbidity !== undefined) {
          const child = await getConnectedChild(client, envHandle, 1);
          if (child) {
            await setAttrRaw(client, child, AttributeId.A_VALUE, 9, params.turbidity);
            changes.push(`turbidity=${params.turbidity}`);
          }
        }

        // Pin 4 = north offset
        if (params.north_offset !== undefined) {
          const child = await getConnectedChild(client, envHandle, 4);
          if (child) {
            await setAttrRaw(client, child, AttributeId.A_VALUE, 9, params.north_offset);
            changes.push(`north_offset=${params.north_offset}`);
          }
        }

        // Pin 6 = sky color
        if (params.sky_color) {
          const child = await getConnectedChild(client, envHandle, 6);
          if (child) {
            await setAttrRaw(client, child, AttributeId.A_VALUE, 11, params.sky_color);
            changes.push('sky_color set');
          }
        }

        // Pin 9 = ground color
        if (params.ground_color !== undefined) {
          const child = await getConnectedChild(client, envHandle, 9);
          if (child) {
            await setAttrRaw(client, child, AttributeId.A_VALUE, 9, params.ground_color);
            changes.push(`ground_color=${params.ground_color}`);
          }
        }

        await client.callMethod('ApiChangeManager', 'update', {});

        return jsonResult({
          success: true,
          env_handle: envHandle,
          changes,
        });
      } catch (error: any) {
        mcpLog(`set_daylight FAILED: ${error.message}`, 'error');
        return errorResult(error);
      }
    }
  );
}
