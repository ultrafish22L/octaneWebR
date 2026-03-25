/**
 * MCP Resources — read-only Octane type system + scene state
 *
 * Resources signal to agents that these are safe, idempotent, side-effect-free reads.
 * Three tiers:
 *   - Static: from ApiCache (724 cached node types; 755+ in full Octane API including hidden types)
 *   - Dynamic: from ApiInfo gRPC queries (cached after first hit)
 *   - Scene: from SceneCache (current scene state)
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { OctaneMcpClient } from './OctaneMcpClient';
import { ApiCache } from './ApiCache';

export function registerResources(
  server: McpServer,
  client: OctaneMcpClient,
  cache: ApiCache | null
) {
  // ── Static Resources (Tier 1 — ApiCache) ──────────────────────────

  server.resource(
    'node-types',
    'octane://node-types',
    {
      description:
        'Full catalog of all Octane node types: name, id, category, outType, pinCount, isHidden. Use for discovering available node types.',
    },
    async () => {
      if (!cache) {
        return {
          contents: [
            { uri: 'octane://node-types', text: JSON.stringify({ error: 'API cache not loaded' }) },
          ],
        };
      }
      const types = cache.getNodeTypeNames().map(name => {
        const info = cache.getNodeType(name);
        const id = cache.getNodeTypeId(name);
        return {
          name,
          id,
          category: info?.category,
          outType: info?.outType,
          pinCount: info?.pinInfoCount,
          isHidden: info?.isHidden,
          isCreatable: info?.isCreatableByApi,
        };
      });
      return {
        contents: [{ uri: 'octane://node-types', text: JSON.stringify(types, null, 2) }],
      };
    }
  );

  server.resource(
    'node-types-by-category',
    new ResourceTemplate('octane://node-types/{category}', { list: undefined }),
    {
      description:
        'Node types filtered by category prefix (e.g. MAT, TEX, GEO, LIGHT, KERN). Returns name, id, outType for matching types.',
    },
    async (uri, variables) => {
      const category = String(variables.category).toUpperCase();
      const uriStr = uri.toString();
      if (!cache) {
        return {
          contents: [{ uri: uriStr, text: JSON.stringify({ error: 'API cache not loaded' }) }],
        };
      }
      const types = cache
        .getNodeTypeNames()
        .filter(name => {
          const info = cache.getNodeType(name);
          return info?.category?.toUpperCase() === category || name.startsWith(`NT_${category}_`);
        })
        .map(name => ({
          name,
          id: cache.getNodeTypeId(name),
          outType: cache.getNodeType(name)?.outType,
          defaultName: cache.getNodeType(name)?.defaultName,
        }));
      return {
        contents: [{ uri: uriStr, text: JSON.stringify(types, null, 2) }],
      };
    }
  );

  server.resource(
    'pin-layout',
    new ResourceTemplate('octane://pin-layout/{typeName}', { list: undefined }),
    {
      description:
        'All pins for a node type: index, id, name, type, defaultNodeType. Resolves pin_index vs pin_id vs pin_name confusion. Example: octane://pin-layout/NT_RENDERTARGET',
    },
    async (uri, variables) => {
      const typeName = String(variables.typeName);
      const uriStr = uri.toString();
      if (!cache) {
        return {
          contents: [{ uri: uriStr, text: JSON.stringify({ error: 'API cache not loaded' }) }],
        };
      }
      const pins = cache.getPins(typeName);
      if (!pins) {
        return {
          contents: [{ uri: uriStr, text: JSON.stringify({ error: `Unknown type: ${typeName}` }) }],
        };
      }
      const layout = pins.map(p => ({
        index: p.index,
        id: p.id,
        name: p.staticName,
        label: p.staticLabel,
        type: p.type,
        defaultNodeType: p.defaultNodeType || null,
      }));
      return {
        contents: [{ uri: uriStr, text: JSON.stringify(layout, null, 2) }],
      };
    }
  );

  server.resource(
    'compatibility',
    new ResourceTemplate('octane://compatibility/{pinType}', { list: undefined }),
    {
      description:
        'All node types compatible with a pin type (e.g. PT_TEXTURE, PT_MATERIAL, PT_GEOMETRY). Returns arrays of compatible nodes and graphs.',
    },
    async (uri, variables) => {
      const pinType = String(variables.pinType);
      const uriStr = uri.toString();
      if (!cache) {
        return {
          contents: [{ uri: uriStr, text: JSON.stringify({ error: 'API cache not loaded' }) }],
        };
      }
      const nodes = cache.getCompatibleNodes(pinType);
      return {
        contents: [
          { uri: uriStr, text: JSON.stringify({ pinType, compatibleNodes: nodes }, null, 2) },
        ],
      };
    }
  );

  server.resource(
    'primitive-types',
    'octane://primitive-types',
    {
      description:
        'NT_GEO_OBJECT primitive type enum values. Set via set_attribute(enum_child_handle, 185, AT_INT=3, N). All 23 types supported (values 1-23).',
    },
    async () => {
      const types = [
        { value: 1, shape: 'Box', notes: 'DEFAULT' },
        { value: 2, shape: 'Capsule' },
        { value: 3, shape: 'Cone' },
        { value: 4, shape: 'Cylinder' },
        { value: 5, shape: 'Ding dong' },
        { value: 6, shape: 'Disc' },
        { value: 7, shape: 'Dodecahedron' },
        { value: 8, shape: 'Dome' },
        { value: 9, shape: 'Ellipsoid' },
        { value: 10, shape: 'Elliptic torus' },
        { value: 11, shape: 'Figure eight' },
        { value: 12, shape: 'Hyperboloid' },
        { value: 13, shape: 'Icosahedron' },
        { value: 14, shape: 'Octahedron' },
        { value: 15, shape: 'Plane' },
        { value: 16, shape: 'Polygon' },
        { value: 17, shape: 'Prism' },
        { value: 18, shape: 'Quad' },
        { value: 19, shape: 'Saddle' },
        { value: 20, shape: 'Sphere' },
        { value: 21, shape: 'Tetrahedron' },
        { value: 22, shape: 'Torus' },
        { value: 23, shape: 'Truncated cone' },
      ];
      return {
        contents: [{ uri: 'octane://primitive-types', text: JSON.stringify(types, null, 2) }],
      };
    }
  );

  // ── Dynamic Resources (Tier 2 — ApiInfo gRPC, cached after first hit) ─

  server.resource(
    'node-info-dynamic',
    new ResourceTemplate('octane://node-info/{typeName}', { list: undefined }),
    {
      description:
        'Full node type metadata from live Octane via ApiInfo.nodeInfo. Includes attribute count, movable inputs, description. Cached after first query. Use when static cache lacks details.',
    },
    async (uri, variables) => {
      const typeName = String(variables.typeName);
      const uriStr = uri.toString();
      try {
        const info = await client.queryNodeInfo(typeName);
        return { contents: [{ uri: uriStr, text: JSON.stringify(info, null, 2) }] };
      } catch (e: any) {
        return { contents: [{ uri: uriStr, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.resource(
    'pin-info-dynamic',
    new ResourceTemplate('octane://pin-info/{typeName}/{pinIndex}', { list: undefined }),
    {
      description:
        'Deep pin metadata from live Octane via ApiInfo.nodePinInfo. Includes float ranges, enum values, defaults, UI flags. Cached after first query.',
    },
    async (uri, variables) => {
      const typeName = String(variables.typeName);
      const pinIndex = Number(variables.pinIndex);
      const uriStr = uri.toString();
      try {
        const info = await client.queryPinInfo(typeName, pinIndex);
        return { contents: [{ uri: uriStr, text: JSON.stringify(info, null, 2) }] };
      } catch (e: any) {
        return { contents: [{ uri: uriStr, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.resource(
    'attribute-info-dynamic',
    new ResourceTemplate('octane://attribute-info/{typeName}/{attrId}', { list: undefined }),
    {
      description:
        'Attribute metadata from live Octane via ApiInfo.attributeInfo. Includes type, defaults, min/max, description. Cached after first query.',
    },
    async (uri, variables) => {
      const typeName = String(variables.typeName);
      const attrId = Number(variables.attrId);
      const uriStr = uri.toString();
      try {
        const info = await client.queryAttributeInfo(typeName, attrId);
        return { contents: [{ uri: uriStr, text: JSON.stringify(info, null, 2) }] };
      } catch (e: any) {
        return { contents: [{ uri: uriStr, text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  // ── Scene Resources (from SceneCache) ──────────────────────────────

  server.resource(
    'scene',
    'octane://scene',
    {
      description:
        'Current scene snapshot from MCP SceneCache: all known nodes, connections, and children. Updated by get_scene_tree, create_node, connect_nodes, etc. Not authoritative — verify critical data with get_node_info.',
    },
    async () => {
      const snapshot = client.sceneCache.snapshot();
      return {
        contents: [{ uri: 'octane://scene', text: JSON.stringify(snapshot, null, 2) }],
      };
    }
  );
}
