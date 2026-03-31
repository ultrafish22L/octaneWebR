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
import { ArtDirectionState } from './ArtDirectionState';
import { AttributeId, AttrType, RT_PINS, RenderPassId } from './shared/OctaneConstants';
import { PRESETS } from './sega/presets';
import { DIMENSIONS } from './sega/registry';
import * as fs from 'fs';
import * as path from 'path';

// ── Doc section parser ──────────────────────────────────────────────

interface DocSection {
  number: string; // "1", "2", "0b", etc.
  title: string;
  content: string;
}

/** Parse `## §N Title` sections from a markdown file. Returns map of section number → content. */
function parseDocSections(filePath: string): Map<string, DocSection> {
  const sections = new Map<string, DocSection>();
  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    const lines = text.split('\n');
    const sectionRegex = /^## §(\S+)\s+(.+)$/;

    let current: { number: string; title: string; startLine: number } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(sectionRegex);
      if (match) {
        // Close previous section
        if (current) {
          sections.set(current.number, {
            number: current.number,
            title: current.title,
            content: lines.slice(current.startLine, i).join('\n').trim(),
          });
        }
        current = { number: match[1], title: match[2], startLine: i };
      }
    }
    // Close final section
    if (current) {
      sections.set(current.number, {
        number: current.number,
        title: current.title,
        content: lines.slice(current.startLine).join('\n').trim(),
      });
    }
  } catch {
    // File not found — return empty map
  }
  return sections;
}

// Resolve docs path relative to this file's location (mcp/src/ → ../../docs/mcp/)
const DOCS_DIR = path.resolve(__dirname, '..', '..', 'docs', 'mcp');

/** Known doc files with their short aliases */
const DOC_FILES: Record<string, string> = {
  build: path.join(DOCS_DIR, 'BUILD.md'),
  reference: path.join(DOCS_DIR, 'REFERENCE.md'),
  creative: path.join(DOCS_DIR, 'CREATIVE.md'),
  testing: path.join(DOCS_DIR, 'TESTING.md'),
  compat: path.join(DOCS_DIR, 'ALPHA5_COMPAT.md'),
};

/** Lazy-loaded section cache */
let docCache: Map<string, Map<string, DocSection>> | null = null;

function getDocCache(): Map<string, Map<string, DocSection>> {
  if (!docCache) {
    docCache = new Map();
    for (const [alias, filePath] of Object.entries(DOC_FILES)) {
      docCache.set(alias, parseDocSections(filePath));
    }
  }
  return docCache;
}

export function registerResources(
  server: McpServer,
  client: OctaneMcpClient,
  cache: ApiCache | null,
  artState?: ArtDirectionState
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

  // ── Constants Resource (replaces inline tables in tool descriptions) ─

  server.resource(
    'constants',
    'octane://constants',
    {
      description:
        'Attribute IDs, type codes, RT pin layout, render pass IDs, and image formats. Reference for set_attribute/get_attribute/connect_nodes calls. Replaces inline constant tables in tool descriptions.',
    },
    async () => ({
      contents: [
        {
          uri: 'octane://constants',
          text: JSON.stringify(
            {
              attribute_ids: AttributeId,
              attr_types: AttrType,
              rt_pins: RT_PINS,
              render_pass_ids: {
                BEAUTY: RenderPassId.BEAUTY,
                DIFFUSE: RenderPassId.DIFFUSE,
                REFLECTION: RenderPassId.REFLECTION,
                Z_DEPTH: RenderPassId.Z_DEPTH,
                GEOMETRIC_NORMAL: RenderPassId.GEOMETRIC_NORMAL,
                POSITION: RenderPassId.POSITION,
                MATERIAL_ID: RenderPassId.MATERIAL_ID,
                AMBIENT_OCCLUSION: RenderPassId.AMBIENT_OCCLUSION,
              },
              notes: {
                rotation: 'A_ROTATION values are in DEGREES (not radians)',
                transforms:
                  'A_TRANSLATION/A_ROTATION/A_SCALE must be set on the TRANSFORM CHILD (pin 3 connected_handle on NT_GEO_PLACEMENT), NOT on the geo object itself',
                float4_wrapping:
                  'Scalar numbers auto-wrap to {x:val,y:0,z:0,w:0} for float4/int4 types',
                filename: 'A_FILENAME validates path exists — bad paths hang gRPC for 30s',
                dof: 'DOF aperture defaults to 0.893 on old RTs — set to 0 to disable',
                emission:
                  'Emission efficiency defaults to 0.025 (40x dim) — set to 1.0 for correct brightness',
              },
            },
            null,
            2
          ),
        },
      ],
    })
  );

  // ── SEGA Presets Resource ─────────────────────────────────────────

  server.resource(
    'sega-presets',
    'octane://sega/presets',
    {
      description:
        'All 25 SEGA presets with name, category, description, and full semantic vector. Use with set_artistic_intent(preset:"name"). Categories: mood, artist, film, genre.',
    },
    async () => ({
      contents: [
        {
          uri: 'octane://sega/presets',
          text: JSON.stringify(
            PRESETS.map(p => ({
              name: p.name,
              category: p.category,
              description: p.description,
              vector: p.vector,
              tags: p.tags,
            })),
            null,
            2
          ),
        },
      ],
    })
  );

  // ── SEGA Dimensions Resource ──────────────────────────────────────

  server.resource(
    'sega-dimensions',
    'octane://sega/dimensions',
    {
      description:
        'All 15 SEGA semantic dimensions with name, description, range [-1,+1], positive/negative labels, and NL aliases. Use with set_artistic_intent(vector:{dimension:value}) or adjust_artistic_intent(dimension, value).',
    },
    async () => ({
      contents: [
        {
          uri: 'octane://sega/dimensions',
          text: JSON.stringify(
            DIMENSIONS.map(d => ({
              name: d.name,
              source: d.source,
              description: d.description,
              positiveLabel: d.positiveLabel,
              negativeLabel: d.negativeLabel,
              aliases: d.aliases.slice(0, 4),
              negativeAliases: d.negativeAliases.slice(0, 4),
            })),
            null,
            2
          ),
        },
      ],
    })
  );

  // ── Workflow Phases Resource ───────────────────────────────────────

  server.resource(
    'workflow-phases',
    'octane://workflow/phases',
    {
      description:
        'AD workflow phases (0 → 4) with required tools, gates, and progression rules. Query to understand phase order and which tools belong to which phase.',
    },
    async () => ({
      contents: [
        {
          uri: 'octane://workflow/phases',
          text: JSON.stringify(
            {
              workflow: 'DRESS',
              phases: [
                {
                  phase: '0',
                  name: 'Plan',
                  description: 'Composition planning before any Octane node creation',
                  tools: [
                    'analyze_reference',
                    'plan_composition',
                    'validate_layout',
                    'analyze_geo',
                  ],
                  gate: 'validate_layout passes with 0 errors',
                },
                {
                  phase: '0b',
                  name: 'Intent',
                  description:
                    'Set SEGA mood before geometry — drives suggest_lighting/suggest_material values',
                  tools: ['set_artistic_intent', 'get_artistic_intent'],
                  gate: 'SEGA vector initialized',
                },
                {
                  phase: '1',
                  name: 'Frame',
                  description: 'Clay mode ON. Import geometry, frame camera, verify composition',
                  tools: [
                    'set_clay_mode',
                    'place_geo',
                    'fit_camera',
                    'register_scene_object',
                    'start_render',
                    'save_render',
                    'critique_render',
                  ],
                  gate: 'critique_render grade >= C in clay mode',
                  rules: [
                    'Clay mode stays ON until critique passes',
                    'fit_camera after EVERY geo add — no exceptions',
                    'NEVER use set_camera to fix framing — fix geometry instead',
                    'Creative review before critique: "What else does this scene need?"',
                  ],
                },
                {
                  phase: '2',
                  name: 'Style',
                  description: 'Materials + lighting. Clay mode OFF.',
                  tools: [
                    'set_clay_mode',
                    'setup_lighting',
                    'create_light',
                    'set_daylight',
                    'suggest_lighting',
                    'suggest_material',
                    'set_artistic_intent',
                  ],
                  gate: 'Materials and lighting applied to all surfaces',
                },
                {
                  phase: '3',
                  name: 'Critique',
                  description: 'Dual-critic evaluation loop (Sonnet + orchestrator)',
                  tools: ['critique_render', 'evaluate_semantics', 'apply_corrections'],
                  gate: 'Sonnet grade B+ or stagnation detected',
                  rules: [
                    'reference_image_path is MANDATORY for critique',
                    'framing >= 3 required BEFORE lighting/mood scores matter',
                    'If stagnating (2 iterations < 0.3 improvement): redesign, do not tweak',
                  ],
                },
                {
                  phase: '4',
                  name: 'Beauty',
                  description: 'Hero camera, final beauty render, save and cleanup',
                  tools: ['set_camera', 'save_render', 'save_project', 'reset_project'],
                  gate: 'Hero render saved, 0 errors in all 3 log files',
                },
              ],
              utility_tools:
                'These tools are used across all phases: create_node, connect_nodes, set_attribute, get_attribute, get_node_info, get_scene_tree, delete_node',
            },
            null,
            2
          ),
        },
      ],
    })
  );

  // ── AD Mode Resource ─────────────────────────────────────────────

  server.resource(
    'ad-mode',
    'octane://ad/mode',
    {
      description:
        'Current AD (Art Direction) state: build mode (SHOP/DRESS/SHOW), AD flag (on/off), and mode descriptions. Read to check if structured build is active.',
    },
    async () => ({
      contents: [
        {
          uri: 'octane://ad/mode',
          text: JSON.stringify(
            {
              build_mode: artState?.buildMode ?? null,
              ad_active: artState?.isActive ?? false,
              description: artState?.isActive
                ? `${(artState.buildMode ?? 'custom').toUpperCase()} — AD active. Phases enforced, critique loop active.`
                : artState?.buildMode
                  ? `${artState.buildMode.toUpperCase()} — AD inactive. Tools work freely.`
                  : 'No build mode set. Freeform — all tools available without phase enforcement.',
              modes: {
                shop: { purpose: 'Workshop / quick test', ad_default: false },
                dress: { purpose: 'Rehearsal / dev build', ad_default: true },
                show: { purpose: 'Live demo', ad_default: true },
              },
            },
            null,
            2
          ),
        },
      ],
    })
  );

  // ── Documentation Section Resources ──────────────────────────────

  server.resource(
    'docs-index',
    'octane://docs',
    {
      description:
        'Index of all documentation sections. Lists available files (build, reference, creative, testing, compat) and their § sections. Use octane://docs/{file}/{section} to read a specific section.',
    },
    async () => {
      const cache = getDocCache();
      const index: Record<string, { sections: Array<{ number: string; title: string }> }> = {};
      for (const [alias, sections] of cache) {
        index[alias] = {
          sections: Array.from(sections.values()).map(s => ({
            number: s.number,
            title: s.title,
          })),
        };
      }
      return {
        contents: [{ uri: 'octane://docs', text: JSON.stringify(index, null, 2) }],
      };
    }
  );

  server.resource(
    'docs-section',
    new ResourceTemplate('octane://docs/{file}/{section}', { list: undefined }),
    {
      description:
        'Read a specific § section from MCP docs. Files: build, reference, creative, testing, compat. Example: octane://docs/reference/6 → §6 Coordinate System.',
    },
    async (uri, variables) => {
      const file = String(variables.file).toLowerCase();
      const sectionNum = String(variables.section);
      const uriStr = uri.toString();
      const cache = getDocCache();
      const fileSections = cache.get(file);

      if (!fileSections) {
        const available = Array.from(cache.keys()).join(', ');
        return {
          contents: [
            {
              uri: uriStr,
              text: JSON.stringify({
                error: `Unknown doc file: "${file}". Available: ${available}`,
              }),
            },
          ],
        };
      }

      const section = fileSections.get(sectionNum);
      if (!section) {
        const available = Array.from(fileSections.values())
          .map(s => `§${s.number} ${s.title}`)
          .join(', ');
        return {
          contents: [
            {
              uri: uriStr,
              text: JSON.stringify({
                error: `No §${sectionNum} in ${file}. Available: ${available}`,
              }),
            },
          ],
        };
      }

      return {
        contents: [{ uri: uriStr, text: section.content }],
      };
    }
  );
}
