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
import { OctaneMcpClient, mcpLog } from '../OctaneMcpClient';
import { ApiCache } from '../ApiCache';
import { jsonResult, errorResult, validateFilePath } from './utils';
import { notifyWebapp } from './webapp';

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
        const meshResult = await client.callMethod('ApiNodeGraph', 'createNode', {
          node_graph: { handle: String(rootGraph), type: 20 },
          type: 1, // NT_GEO_MESH
        });
        const meshHandle = Number(meshResult?.result?.handle ?? meshResult?.handle ?? 0);
        if (!meshHandle) throw new Error('Failed to create NT_GEO_MESH node');

        // Set OBJ filename
        await client.callMethod('ApiItem', 'setByAttrID', {
          item_ref: { handle: String(meshHandle), type: 16 },
          attribute_id: 34, // A_FILENAME
          string_value: conv.objPath.replace(/\//g, '\\'),
          evaluate: false,
        });

        // Reload mesh
        await client.callMethod('ApiItem', 'setByAttrID', {
          item_ref: { handle: String(meshHandle), type: 16 },
          attribute_id: 124, // A_RELOAD
          bool_value: true,
          evaluate: false,
        });

        client.sceneCache.addNode(meshHandle, 'Mesh', 'NT_GEO_MESH', 1);
        notifyWebapp({ type: 'nodeAdded', handle: meshHandle });

        // Phase 3: Create NT_GEO_PLACEMENT and connect mesh
        const placementResult = await client.callMethod('ApiNodeGraph', 'createNode', {
          node_graph: { handle: String(rootGraph), type: 20 },
          type: 4, // NT_GEO_PLACEMENT
        });
        const placementHandle = Number(
          placementResult?.result?.handle ?? placementResult?.handle ?? 0
        );
        if (!placementHandle) throw new Error('Failed to create NT_GEO_PLACEMENT node');

        client.sceneCache.addNode(placementHandle, 'Placement', 'NT_GEO_PLACEMENT', 4);
        notifyWebapp({ type: 'nodeAdded', handle: placementHandle });

        // Connect mesh → placement pin "geometry" (pin index 1)
        await client.callMethod('ApiNode', 'connectTo', {
          node: { handle: String(placementHandle), type: 17 },
          input_index: 1,
          connectedNode: { handle: String(meshHandle), type: 17 },
          evaluate: false,
        });

        // Get placement transform handle (pin 0)
        const placementInfo = await client.callMethod('ApiNode', 'pinCount', {
          node: { handle: String(placementHandle), type: 17 },
        });
        const pinCount = Number(placementInfo?.count ?? placementInfo?.result?.count ?? 0);
        let transformHandle = 0;
        for (let i = 0; i < pinCount; i++) {
          const pinInfo = await client.callMethod('ApiNode', 'pinInfo', {
            node: { handle: String(placementHandle), type: 17 },
            pin_index: i,
          });
          const connHandle = Number(pinInfo?.connected_node?.handle ?? 0);
          const pinName = pinInfo?.name ?? '';
          if (pinName === 'transform' && connHandle) {
            transformHandle = connHandle;
            break;
          }
        }

        // Phase 4: Create material with texture
        const matResult = await client.callMethod('ApiNodeGraph', 'createNode', {
          node_graph: { handle: String(rootGraph), type: 20 },
          type: 130, // NT_MAT_UNIVERSAL
        });
        const matHandle = Number(matResult?.result?.handle ?? matResult?.handle ?? 0);
        if (!matHandle) throw new Error('Failed to create NT_MAT_UNIVERSAL node');

        client.sceneCache.addNode(matHandle, 'Material', 'NT_MAT_UNIVERSAL', 130);
        notifyWebapp({ type: 'nodeAdded', handle: matHandle });

        // Connect material → mesh pin 0
        await client.callMethod('ApiNode', 'connectTo', {
          node: { handle: String(meshHandle), type: 17 },
          input_index: 0,
          connectedNode: { handle: String(matHandle), type: 17 },
          evaluate: false,
        });

        let texHandle = 0;
        // If textures were exported, create NT_TEX_IMAGE and connect to albedo
        if (conv.texturePaths.length > 0) {
          const texResult = await client.callMethod('ApiNodeGraph', 'createNode', {
            node_graph: { handle: String(rootGraph), type: 20 },
            type: 34, // NT_TEX_IMAGE
          });
          texHandle = Number(texResult?.result?.handle ?? texResult?.handle ?? 0);

          if (texHandle) {
            client.sceneCache.addNode(texHandle, 'Texture', 'NT_TEX_IMAGE', 34);
            notifyWebapp({ type: 'nodeAdded', handle: texHandle });

            // Set texture filename
            await client.callMethod('ApiItem', 'setByAttrID', {
              item_ref: { handle: String(texHandle), type: 16 },
              attribute_id: 34,
              string_value: conv.texturePaths[0].replace(/\//g, '\\'),
              evaluate: false,
            });

            // Connect texture → material albedo (pin 2 on NT_MAT_UNIVERSAL)
            await client.callMethod('ApiNode', 'connectTo', {
              node: { handle: String(matHandle), type: 17 },
              input_index: 2, // albedo pin
              connectedNode: { handle: String(texHandle), type: 17 },
              evaluate: false,
            });
          }
        }

        // Set metallic and roughness on material child pins
        // Need to find them via pinInfo
        const matPinCount = Number(
          (
            await client.callMethod('ApiNode', 'pinCount', {
              node: { handle: String(matHandle), type: 17 },
            })
          )?.count ?? 0
        );
        let metallicHandle = 0;
        let roughnessHandle = 0;
        for (let i = 0; i < matPinCount && (!metallicHandle || !roughnessHandle); i++) {
          const pinInfo = await client.callMethod('ApiNode', 'pinInfo', {
            node: { handle: String(matHandle), type: 17 },
            pin_index: i,
          });
          const connHandle = Number(pinInfo?.connected_node?.handle ?? 0);
          const pinName = pinInfo?.name ?? '';
          if (pinName === 'metallic' && connHandle) metallicHandle = connHandle;
          if (pinName === 'roughness' && connHandle) roughnessHandle = connHandle;
        }

        const metallicVal = metallic ?? 0.3;
        const roughnessVal = roughness ?? 0.4;

        if (metallicHandle) {
          await client.callMethod('ApiItem', 'setByAttrID', {
            item_ref: { handle: String(metallicHandle), type: 16 },
            attribute_id: 185,
            float3_value: { x: metallicVal, y: metallicVal, z: metallicVal },
            evaluate: false,
          });
        }
        if (roughnessHandle) {
          await client.callMethod('ApiItem', 'setByAttrID', {
            item_ref: { handle: String(roughnessHandle), type: 16 },
            attribute_id: 185,
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
            `Set transform rotation: set_attribute(${transformHandle}, 137, 11, {90, Y_rotation, 0})`,
            `Set transform position: set_attribute(${transformHandle}, 172, 11, {x, y, z})`,
            `Set transform scale: set_attribute(${transformHandle}, 139, 11, {s, s, s})`,
          ],
        });
      } catch (error: any) {
        mcpLog(`import_glb FAILED: ${error.message}`, 'error');
        return errorResult(error);
      }
    }
  );
}
