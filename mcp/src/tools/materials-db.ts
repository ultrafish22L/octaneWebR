/**
 * Material Database Tools — LiveDB browser + download
 *
 * Browse OTOY's cloud material library and download materials into the scene.
 * NOTE: getCategory is flagged as a known Octane API limitation — may be broken.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient, mcpLog } from '../OctaneMcpClient';
import { jsonResult, errorResult, extractHandle, OBJ_API_NODE_GRAPH } from './utils';

// ObjectRef type constants for LiveDB array handles
const OBJ_DB_CATEGORY_ARRAY = 55;
const OBJ_DB_MATERIAL_ARRAY = 56;

export function registerMaterialDbTools(server: McpServer, client: OctaneMcpClient) {
  server.tool(
    'browse_material_db',
    'List all categories in the OTOY LiveDB material library. Returns category id, name, parentID, typeID. Use category id with search_materials to list materials.',
    {},
    async () => {
      try {
        // Step 1: getCategories returns a handle to a DBCategoryArray
        const catResult = await client.callMethod('ApiDBMaterialManager', 'getCategories', {});
        if (!catResult?.result) {
          return errorResult(
            'LiveDB getCategories returned false — the material database may be unavailable or Octane is not connected to the internet.'
          );
        }
        const listHandle = extractHandle(catResult);
        if (!listHandle) {
          return errorResult('getCategories returned no list handle');
        }

        // Step 2: getCategory on the array handle returns the actual data
        const dataResult = await client.callMethod(
          'ApiDBMaterialManager_DBCategoryArray',
          'getCategory',
          { objectPtr: { handle: String(listHandle), type: OBJ_DB_CATEGORY_ARRAY } }
        );

        const categories = dataResult?.result?.categories ?? [];

        // Step 3: free the array handle
        try {
          await client.callMethod('ApiDBMaterialManager_DBCategoryArray', 'free', {
            objectPtr: { handle: String(listHandle), type: OBJ_DB_CATEGORY_ARRAY },
          });
        } catch {
          // Non-critical
        }

        return jsonResult({
          success: true,
          category_count: categories.length,
          categories: categories.map((c: any) => ({
            id: c.id,
            name: c.name,
            parent_id: c.parentID,
            type_id: c.typeID,
          })),
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'search_materials',
    'List materials in a LiveDB category. Returns material id, name, nickname, copyright. Use the id with download_material to add it to the scene.',
    {
      category_id: z.number().int().describe('Category ID from browse_material_db'),
    },
    async ({ category_id }) => {
      try {
        const matResult = await client.callMethod('ApiDBMaterialManager', 'getMaterials', {
          categoryId: category_id,
        });
        if (!matResult?.result) {
          return errorResult(
            `getMaterials returned false for category ${category_id} — category may not exist or LiveDB is unavailable.`
          );
        }
        const listHandle = extractHandle(matResult);
        if (!listHandle) {
          return errorResult('getMaterials returned no list handle');
        }

        // Get material data
        const dataResult = await client.callMethod(
          'ApiDBMaterialManager_DBMaterialArray',
          'getMaterial',
          { objectPtr: { handle: String(listHandle), type: OBJ_DB_MATERIAL_ARRAY } }
        );

        const materials = dataResult?.result?.materials ?? [];

        // Free array
        try {
          await client.callMethod('ApiDBMaterialManager_DBMaterialArray', 'free1', {
            objectPtr: { handle: String(listHandle), type: OBJ_DB_MATERIAL_ARRAY },
          });
        } catch {
          // Non-critical
        }

        return jsonResult({
          success: true,
          category_id,
          material_count: materials.length,
          materials: materials.map((m: any) => ({
            id: m.id,
            name: m.name,
            nickname: m.nickname,
            copyright: m.copyright,
            category_id: m.categoryID,
          })),
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'preview_material',
    'Get a preview image of a LiveDB material rendered on a material ball. Returns raw image buffer data.',
    {
      material_id: z.number().int().describe('Material ID from search_materials'),
      size: z
        .number()
        .int()
        .optional()
        .default(256)
        .describe('Requested image size in pixels (default 256)'),
    },
    async ({ material_id, size }) => {
      try {
        const result = await client.callMethod('ApiDBMaterialManager', 'getMaterialPreview', {
          materialId: material_id,
          requestedSize: size,
          view: 0, // VIEW_COMBINED
        });
        // Result contains buffer data + size
        const imgSize = result?.size;
        const hasData = result?.result && result.result.length > 0;
        return jsonResult({
          success: hasData,
          material_id,
          image_size: imgSize,
          has_data: hasData,
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'download_material',
    'Download a material from the OTOY LiveDB into the current scene. Creates all necessary nodes (material, textures, etc.) in the scene graph.',
    {
      material_id: z.number().int().describe('Material ID from search_materials'),
    },
    async ({ material_id }) => {
      try {
        // Get root node graph as destination
        const rootHandle = await client.getRootNodeGraph();

        const result = await client.callMethod('ApiDBMaterialManager', 'downloadMaterial', {
          materialId: material_id,
          destinationGraph: { handle: String(rootHandle), type: OBJ_API_NODE_GRAPH },
        });

        if (!result?.result) {
          return errorResult(
            `downloadMaterial failed for material ${material_id} — material may not exist or download failed.`
          );
        }

        const outputHandle = extractHandle(result);
        if (outputHandle) {
          // Track the new node in SceneCache
          client.sceneCache.addNode(outputHandle, `LiveDB_${material_id}`, 'NT_UNKNOWN', 0);
          mcpLog(`download_material: material ${material_id} → handle ${outputHandle}`, 'info');
        }

        return jsonResult({
          success: true,
          material_id,
          output_handle: outputHandle ?? null,
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
