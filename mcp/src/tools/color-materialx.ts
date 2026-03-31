/**
 * Color Management & MaterialX Tools
 *
 * OCIO: query loaded config for color spaces, displays, views
 * MaterialX: import .mtlx files, list available node categories
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient, mcpLog, mcpLogLazy } from '../OctaneMcpClient';
import {
  jsonResult,
  errorResult,
  extractHandle,
  validateFilePath,
  OBJ_API_NODE_GRAPH,
} from './utils';

// ObjectRef type for OcioConfig handles
const OBJ_OCIO_CONFIG = 41; // from common.proto ObjectType enum

export function registerColorMaterialXTools(server: McpServer, client: OctaneMcpClient) {
  // ── OCIO Color Management ───────────────────────────────────────────

  server.registerTool(
    'get_ocio_config',
    {
      title: 'OCIO Config',
      description: 'Query current OCIO config. Call describe_tool("get_ocio_config") for params.',
      inputSchema: {
        config_path: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ config_path }) => {
      try {
        // Create/load OCIO config
        const createResult = await client.callMethod('ApiOcioConfig', 'create', {
          filename: config_path ?? '',
        });
        const configHandle = extractHandle(createResult);
        if (!configHandle) {
          return errorResult(
            'Failed to load OCIO config. Ensure OCIO is configured or provide a valid config file path.'
          );
        }

        const objPtr = { handle: String(configHandle), type: OBJ_OCIO_CONFIG };

        try {
          // Query all config data
          const [roleCountR, csCountR, displayCountR, lookCountR] = await Promise.all([
            client
              .callMethod('ApiOcioConfig', 'getRoleCount', { objectPtr: objPtr })
              .catch(() => ({ result: 0 })),
            client
              .callMethod('ApiOcioConfig', 'getColorSpaceCount', { objectPtr: objPtr })
              .catch(() => ({ result: 0 })),
            client
              .callMethod('ApiOcioConfig', 'getDisplayCount', { objectPtr: objPtr })
              .catch(() => ({ result: 0 })),
            client
              .callMethod('ApiOcioConfig', 'getLookCount', { objectPtr: objPtr })
              .catch(() => ({ result: 0 })),
          ]);

          const roleCount = Number(roleCountR?.result ?? 0);
          const csCount = Number(csCountR?.result ?? 0);
          const displayCount = Number(displayCountR?.result ?? 0);
          const lookCount = Number(lookCountR?.result ?? 0);

          // Enumerate color spaces (limit to first 50 to avoid huge responses)
          const colorSpaces: string[] = [];
          for (let i = 0; i < Math.min(csCount, 50); i++) {
            try {
              const nameR = await client.callMethod('ApiOcioConfig', 'getColorSpaceName', {
                objectPtr: objPtr,
                colorSpaceIndex: i,
              });
              colorSpaces.push(String(nameR?.result ?? ''));
            } catch (e: any) {
              mcpLogLazy('verbose', () => `[color:ocio:colorSpaceName:${i}] ${e?.message ?? e}`);
              break;
            }
          }

          // Enumerate displays + views
          const displays: { name: string; views: string[] }[] = [];
          for (let d = 0; d < Math.min(displayCount, 20); d++) {
            try {
              const dNameR = await client.callMethod('ApiOcioConfig', 'getDisplayName', {
                objectPtr: objPtr,
                displayIndex: d,
              });
              const dName = String(dNameR?.result ?? '');

              const viewCountR = await client.callMethod('ApiOcioConfig', 'getDisplayViewCount', {
                objectPtr: objPtr,
                displayIndex: d,
              });
              const viewCount = Number(viewCountR?.result ?? 0);

              const views: string[] = [];
              for (let v = 0; v < Math.min(viewCount, 20); v++) {
                try {
                  const vNameR = await client.callMethod('ApiOcioConfig', 'getDisplayViewName', {
                    objectPtr: objPtr,
                    displayIndex: d,
                    viewIndex: v,
                  });
                  views.push(String(vNameR?.result ?? ''));
                } catch (e: any) {
                  mcpLogLazy('verbose', () => `[color:ocio:viewName:${d}:${v}] ${e?.message ?? e}`);
                  break;
                }
              }

              displays.push({ name: dName, views });
            } catch (e: any) {
              mcpLogLazy('verbose', () => `[color:ocio:display:${d}] ${e?.message ?? e}`);
              break;
            }
          }

          // Enumerate roles
          const roles: { name: string; color_space: string }[] = [];
          for (let r = 0; r < Math.min(roleCount, 20); r++) {
            try {
              const [rNameR, rCsR] = await Promise.all([
                client.callMethod('ApiOcioConfig', 'getRoleName', {
                  objectPtr: objPtr,
                  roleIndex: r,
                }),
                client.callMethod('ApiOcioConfig', 'getRoleColorSpaceName', {
                  objectPtr: objPtr,
                  roleIndex: r,
                }),
              ]);
              roles.push({
                name: String(rNameR?.result ?? ''),
                color_space: String(rCsR?.result ?? ''),
              });
            } catch (e: any) {
              mcpLogLazy('verbose', () => `[color:ocio:role:${r}] ${e?.message ?? e}`);
              break;
            }
          }

          // Enumerate looks
          const looks: string[] = [];
          for (let l = 0; l < Math.min(lookCount, 20); l++) {
            try {
              const lNameR = await client.callMethod('ApiOcioConfig', 'getLookName', {
                objectPtr: objPtr,
                lookIndex: l,
              });
              looks.push(String(lNameR?.result ?? ''));
            } catch (e: any) {
              mcpLogLazy('verbose', () => `[color:ocio:look:${l}] ${e?.message ?? e}`);
              break;
            }
          }

          return jsonResult({
            success: true,
            config_path: config_path ?? '(default)',
            color_space_count: csCount,
            color_spaces: colorSpaces,
            display_count: displayCount,
            displays,
            role_count: roleCount,
            roles,
            look_count: lookCount,
            looks,
          });
        } finally {
          // Always destroy the config handle
          try {
            await client.callMethod('ApiOcioConfig', 'destroy', { objectPtr: objPtr });
          } catch (e: any) {
            mcpLogLazy('verbose', () => `[color:ocio:destroy] ${e?.message ?? e}`);
            // Non-critical
          }
        }
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'list_color_spaces',
    {
      title: 'List Color Spaces',
      description:
        'List OCIO color space names. Call describe_tool("list_color_spaces") for params.',
      inputSchema: {
        config_path: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ config_path }) => {
      try {
        const createResult = await client.callMethod('ApiOcioConfig', 'create', {
          filename: config_path ?? '',
        });
        const configHandle = extractHandle(createResult);
        if (!configHandle) {
          return errorResult('Failed to load OCIO config.');
        }

        const objPtr = { handle: String(configHandle), type: OBJ_OCIO_CONFIG };

        try {
          const countR = await client.callMethod('ApiOcioConfig', 'getColorSpaceCount', {
            objectPtr: objPtr,
          });
          const count = Number(countR?.result ?? 0);

          const names: string[] = [];
          for (let i = 0; i < count; i++) {
            try {
              const nameR = await client.callMethod('ApiOcioConfig', 'getColorSpaceName', {
                objectPtr: objPtr,
                colorSpaceIndex: i,
              });
              names.push(String(nameR?.result ?? ''));
            } catch (e: any) {
              mcpLogLazy('verbose', () => `[color:list_color_spaces:name:${i}] ${e?.message ?? e}`);
              break;
            }
          }

          return jsonResult({ color_space_count: count, color_spaces: names });
        } finally {
          try {
            await client.callMethod('ApiOcioConfig', 'destroy', { objectPtr: objPtr });
          } catch (e: any) {
            mcpLogLazy('verbose', () => `[color:list_color_spaces:destroy] ${e?.message ?? e}`);
          }
        }
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  // ── MaterialX — DISABLED: ApiMaterialXGlobal RPC not implemented in octaneServGrpc ──
  // Re-enable when gRPC server adds MaterialX support.
  //
  // server.registerTool('import_materialx', ...);
  // server.registerTool('list_materialx_nodes', ...);
}
