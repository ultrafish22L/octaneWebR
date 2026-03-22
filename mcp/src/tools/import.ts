/**
 * Import Tools — import_glb
 *
 * Converts external 3D assets (GLB/glTF) to OBJ and loads them into Octane
 * as a fully wired mesh + placement + material, ready to connect to a geo group.
 *
 * Uses Python trimesh for conversion (must be installed: pip install trimesh).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { OctaneMcpClient, mcpLog, mcpLogLazy } from '../OctaneMcpClient';
import { ApiCache } from '../ApiCache';
import {
  jsonResult,
  errorResult,
  validateFilePath,
  extractHandle,
  extractValue,
  OBJ_API_NODE,
  OBJ_API_NODE_GRAPH,
  OBJ_API_ITEM,
} from './utils';
import { notifyWebapp } from './webapp';
import { AttributeId, NodeTypeId } from '../shared/OctaneConstants';
import { enumeratePins } from './pin-utils';

const execFileAsync = promisify(execFile);

/** Default output directory for converted assets */
const ASSETS_DIR = path.resolve(__dirname, '../../assets');

/**
 * Convert GLB to OBJ using Python trimesh.
 * Returns { objPath, texturePaths, vertices, faces, bounds }.
 */
async function convertGlbToObj(
  glbPath: string,
  outDir: string,
  name: string
): Promise<{
  objPath: string;
  texturePaths: string[];
  vertices: number;
  faces: number;
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
}> {
  const script = `
import trimesh, json, os, sys

glb_path = sys.argv[1]
out_dir = sys.argv[2]
name = sys.argv[3]

os.makedirs(out_dir, exist_ok=True)
scene = trimesh.load(glb_path)
if hasattr(scene, 'geometry'):
    mesh = trimesh.util.concatenate(list(scene.geometry.values()))
else:
    mesh = scene

obj_path = os.path.join(out_dir, name + '.obj')
mesh.export(obj_path, file_type='obj')

# Find exported texture files
textures = [f for f in os.listdir(out_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]

result = {
    'objPath': obj_path,
    'texturePaths': [os.path.join(out_dir, t) for t in textures],
    'vertices': len(mesh.vertices),
    'faces': len(mesh.faces),
    'boundsMin': mesh.bounds[0].tolist(),
    'boundsMax': mesh.bounds[1].tolist()
}
print(json.dumps(result))
`;

  const { stdout, stderr } = await execFileAsync('python', ['-c', script, glbPath, outDir, name], {
    timeout: 60000,
  });

  if (stderr && !stdout.trim()) {
    throw new Error(`Conversion failed: ${stderr}`);
  }

  return JSON.parse(stdout.trim());
}

export function registerImportTools(
  server: McpServer,
  client: OctaneMcpClient,
  cache: ApiCache | null
) {
  server.tool(
    'import_glb',
    'Import a GLB/glTF 3D model into the Octane scene. Converts to OBJ, creates mesh + placement + material with texture, and returns all handles. The placement is NOT connected to a geo group — caller must do that. Orientation note: OTOY Studio GLBs are Z-up; apply rotation {90,0,0} on placement transform to stand upright in Octane (Y-up).',
    {
      glb_path: z.string().describe('Absolute path to GLB file (e.g. C:\\Users\\...\\model.glb)'),
      name: z
        .string()
        .optional()
        .describe(
          'Asset name for output folder/files (default: derived from filename). Used as subfolder under assets/.'
        ),
      metallic: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe('Metallic value 0-1 for material (default: 0.3)'),
      roughness: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe('Roughness value 0-1 for material (default: 0.4)'),
    },
    async ({ glb_path, name: assetName, metallic, roughness }) => {
      try {
        // Validate input path
        if (!fs.existsSync(glb_path)) {
          return errorResult(new Error(`File not found: ${glb_path}`));
        }
        if (!glb_path.toLowerCase().endsWith('.glb') && !glb_path.toLowerCase().endsWith('.gltf')) {
          return errorResult(new Error('File must be .glb or .gltf'));
        }

        // Derive name from filename if not provided
        const derivedName =
          assetName ||
          path
            .basename(glb_path, path.extname(glb_path))
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .substring(0, 40);
        const outDir = path.join(ASSETS_DIR, derivedName);

        // Validate output path
        const pathError = validateFilePath(outDir);
        if (pathError) return errorResult(new Error(pathError));

        // Phase 1: Convert GLB → OBJ
        mcpLog(`import_glb: converting ${glb_path} → ${outDir}/${derivedName}.obj`, 'info');
        const conv = await convertGlbToObj(glb_path, outDir, derivedName);
        mcpLog(
          `import_glb: converted ${conv.vertices} verts, ${conv.faces} faces, ${conv.texturePaths.length} textures`,
          'info'
        );

        // Phase 2: Create NT_GEO_MESH and set filename
        const rootGraph = await client.getRootNodeGraph();
        const meshResult = await client.callMethod('ApiNode', 'create', {
          type: NodeTypeId.NT_GEO_MESH,
          ownerGraph: { handle: String(rootGraph), type: OBJ_API_NODE_GRAPH },
          configurePins: true,
        });
        const meshHandle = extractHandle(meshResult) ?? 0;
        if (!meshHandle) throw new Error('Failed to create NT_GEO_MESH node');

        // Set OBJ filename
        await client.callMethod('ApiItem', 'setValueByAttrID', {
          objectPtr: { handle: String(meshHandle), type: OBJ_API_ITEM },
          attribute_id: AttributeId.A_FILENAME,
          string_value: conv.objPath.replace(/\//g, '\\'),
          evaluate: false,
        });

        // Reload mesh
        await client.callMethod('ApiItem', 'setValueByAttrID', {
          objectPtr: { handle: String(meshHandle), type: OBJ_API_ITEM },
          attribute_id: AttributeId.A_RELOAD,
          bool_value: true,
          evaluate: false,
        });

        client.sceneCache.addNode(meshHandle, 'Mesh', 'NT_GEO_MESH', 1);
        notifyWebapp({ type: 'nodeAdded', handle: meshHandle });

        // Phase 3: Create NT_GEO_PLACEMENT and connect mesh
        const placementResult = await client.callMethod('ApiNode', 'create', {
          type: NodeTypeId.NT_GEO_PLACEMENT,
          ownerGraph: { handle: String(rootGraph), type: OBJ_API_NODE_GRAPH },
          configurePins: true,
        });
        const placementHandle = extractHandle(placementResult) ?? 0;
        if (!placementHandle) throw new Error('Failed to create NT_GEO_PLACEMENT node');

        client.sceneCache.addNode(placementHandle, 'Placement', 'NT_GEO_PLACEMENT', 4);
        notifyWebapp({ type: 'nodeAdded', handle: placementHandle });

        // Connect mesh → placement pin "geometry" (pin index 1)
        await client.callMethod('ApiNode', 'connectToIx', {
          objectPtr: { handle: String(placementHandle), type: OBJ_API_NODE },
          pinIdx: 1,
          sourceNode: { handle: String(meshHandle), type: OBJ_API_NODE },
          evaluate: false,
          doCycleCheck: true,
        });

        // Get placement transform handle (pin 0 = transform)
        let transformHandle = 0;
        try {
          const connResult = await client.callMethod('ApiNode', 'connectedNodeIx', {
            objectPtr: { handle: String(placementHandle), type: OBJ_API_NODE },
            pinIx: 0,
            enterWrapperNode: true,
          });
          transformHandle = extractHandle(connResult) ?? 0;
        } catch (e: any) {
          mcpLogLazy('verbose', () => `[import:glb:transform_child] ${e?.message ?? e}`);
          /* no transform child */
        }

        // Phase 4: Create material with texture
        const matResult = await client.callMethod('ApiNode', 'create', {
          type: NodeTypeId.NT_MAT_UNIVERSAL,
          ownerGraph: { handle: String(rootGraph), type: OBJ_API_NODE_GRAPH },
          configurePins: true,
        });
        const matHandle = extractHandle(matResult) ?? 0;
        if (!matHandle) throw new Error('Failed to create NT_MAT_UNIVERSAL node');

        client.sceneCache.addNode(matHandle, 'Material', 'NT_MAT_UNIVERSAL', 130);
        notifyWebapp({ type: 'nodeAdded', handle: matHandle });

        // Connect material → mesh pin 0
        await client.callMethod('ApiNode', 'connectToIx', {
          objectPtr: { handle: String(meshHandle), type: OBJ_API_NODE },
          pinIdx: 0,
          sourceNode: { handle: String(matHandle), type: OBJ_API_NODE },
          evaluate: false,
          doCycleCheck: true,
        });

        let texHandle = 0;
        // If textures were exported, create NT_TEX_IMAGE and connect to albedo
        if (conv.texturePaths.length > 0) {
          const texResult = await client.callMethod('ApiNode', 'create', {
            type: NodeTypeId.NT_TEX_IMAGE,
            ownerGraph: { handle: String(rootGraph), type: OBJ_API_NODE_GRAPH },
            configurePins: true,
          });
          texHandle = extractHandle(texResult) ?? 0;

          if (texHandle) {
            client.sceneCache.addNode(texHandle, 'Texture', 'NT_TEX_IMAGE', 34);
            notifyWebapp({ type: 'nodeAdded', handle: texHandle });

            // Set texture filename
            await client.callMethod('ApiItem', 'setValueByAttrID', {
              objectPtr: { handle: String(texHandle), type: OBJ_API_ITEM },
              attribute_id: AttributeId.A_FILENAME,
              string_value: conv.texturePaths[0].replace(/\//g, '\\'),
              evaluate: false,
            });

            // Connect texture → material albedo (pin 2 on NT_MAT_UNIVERSAL)
            await client.callMethod('ApiNode', 'connectToIx', {
              objectPtr: { handle: String(matHandle), type: OBJ_API_NODE },
              pinIdx: 2, // albedo pin
              sourceNode: { handle: String(texHandle), type: OBJ_API_NODE },
              evaluate: false,
              doCycleCheck: true,
            });
          }
        }

        // Set metallic and roughness on material child pins via shared helper
        const matPins = await enumeratePins(client, matHandle);
        let metallicHandle = 0;
        let roughnessHandle = 0;
        for (const pin of matPins) {
          if (pin.name === 'metallic' && pin.connectedHandle) metallicHandle = pin.connectedHandle;
          if (pin.name === 'roughness' && pin.connectedHandle)
            roughnessHandle = pin.connectedHandle;
          if (metallicHandle && roughnessHandle) break;
        }

        const metallicVal = metallic ?? 0.3;
        const roughnessVal = roughness ?? 0.4;

        if (metallicHandle) {
          await client.callMethod('ApiItem', 'setValueByAttrID', {
            objectPtr: { handle: String(metallicHandle), type: OBJ_API_ITEM },
            attribute_id: AttributeId.A_VALUE,
            float3_value: { x: metallicVal, y: metallicVal, z: metallicVal },
            evaluate: false,
          });
        }
        if (roughnessHandle) {
          await client.callMethod('ApiItem', 'setValueByAttrID', {
            objectPtr: { handle: String(roughnessHandle), type: OBJ_API_ITEM },
            attribute_id: AttributeId.A_VALUE,
            float3_value: { x: roughnessVal, y: roughnessVal, z: roughnessVal },
            evaluate: false,
          });
        }

        mcpLog(
          `import_glb: complete — mesh=${meshHandle} placement=${placementHandle} material=${matHandle}`,
          'info'
        );

        // Compute mesh extents for orientation help
        const extents = [
          conv.boundsMax[0] - conv.boundsMin[0],
          conv.boundsMax[1] - conv.boundsMin[1],
          conv.boundsMax[2] - conv.boundsMin[2],
        ];

        return jsonResult({
          success: true,
          handles: {
            mesh: meshHandle,
            placement: placementHandle,
            transform: transformHandle,
            material: matHandle,
            texture: texHandle || undefined,
          },
          conversion: {
            obj_path: conv.objPath,
            textures: conv.texturePaths,
            vertices: conv.vertices,
            faces: conv.faces,
          },
          bounds: {
            min: conv.boundsMin,
            max: conv.boundsMax,
            extents,
          },
          orientation_hint:
            'OTOY Studio GLBs are Z-up. Set placement transform rotation to {90,0,0} to stand upright in Octane (Y-up). Orbit 3 views (front/right/top) to discover facing direction before framing.',
          next_steps: [
            `Connect placement (${placementHandle}) to geo group via pin_index N`,
            `Set transform rotation: set_attribute(${transformHandle}, ${AttributeId.A_ROTATION}, 11, {90, Y_rotation, 0})`,
            `Set transform position: set_attribute(${transformHandle}, ${AttributeId.A_TRANSLATION}, 11, {x, y, z})`,
            `Set transform scale: set_attribute(${transformHandle}, ${AttributeId.A_SCALE}, 11, {s, s, s})`,
          ],
        });
      } catch (error: any) {
        mcpLog(`import_glb FAILED: ${error.message}`, 'error');
        return errorResult(error);
      }
    }
  );
}
