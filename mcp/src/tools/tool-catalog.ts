/**
 * Tool Catalog — full metadata for all MCP tools, powering search_tools + describe_tool.
 *
 * Core tools (38): full schemas registered normally, catalog entry for search only.
 * Long-tail tools (24): slim schemas registered, full param docs stored here.
 */

export interface ToolEntry {
  name: string;
  summary: string; // one-liner for search results
  category: string;
  phase?: string; // AD phase if applicable
  /** Full param docs — only populated for long-tail (slim) tools */
  params?: Record<string, string>;
}

export const TOOL_CATALOG: ToolEntry[] = [
  // ── AD Pipeline ─────────────────────────────────────────────────
  {
    name: 'plan_layout',
    summary: 'Create validated composition plan with camera math',
    category: 'ad',
    phase: '0',
  },
  {
    name: 'validate_layout',
    summary: 'Geometric validation on planned composition',
    category: 'ad',
    phase: '0',
  },
  {
    name: 'analyze_reference',
    summary: 'Extract composition data from reference image via vision',
    category: 'ad',
    phase: '0',
  },
  { name: 'score_render', summary: 'Save and score render via VLM', category: 'ad', phase: '3' },
  {
    name: 'commit_scores',
    summary: 'Record critique scores, detect stagnation, gate iteration',
    category: 'ad',
    phase: '3',
  },
  { name: 'ad_state', summary: 'Get/set AD state, build mode, specs, scores', category: 'ad' },
  { name: 'reset_ad', summary: 'Clear all AD state for fresh build', category: 'ad' },

  // ── SEGA ────────────────────────────────────────────────────────
  {
    name: 'set_sega',
    summary: 'Set mood via preset, vector, or natural language',
    category: 'sega',
    phase: '0b',
  },
  {
    name: 'get_sega',
    summary: 'Read current semantic vector and resolved parameters',
    category: 'sega',
  },
  {
    name: 'adjust_sega',
    summary: 'Fine-tune a single semantic dimension',
    category: 'sega',
    phase: '2',
  },
  {
    name: 'score_sega',
    summary: 'Measure mood/style gap vs SEGA target',
    category: 'sega',
    phase: '3',
  },
  {
    name: 'get_vlm_estimation_prompt',
    summary: 'Get VLM prompt for perceptual dimension estimation',
    category: 'sega',
    params: {}, // no params
  },
  {
    name: 'save_sega_preset',
    summary: 'Save current SEGA vector as named preset (session only)',
    category: 'sega',
    params: {
      name: 'Preset name (e.g. "my_moody_setup")',
      description: 'Short description of this preset',
      tags: 'Search tags for this preset',
    },
  },

  // ── Geometry / Import ───────────────────────────────────────────
  {
    name: 'analyze_geo',
    summary: 'VLM mugshot analysis before mesh placement',
    category: 'geometry',
    phase: '0b',
  },
  {
    name: 'place_geo',
    summary: 'Place primitives or meshes, wire to RT, auto-register',
    category: 'geometry',
    phase: '1',
  },
  {
    name: 'suggest_placement',
    summary: 'Suggest collision-free position/rotation/scale',
    category: 'geometry',
    phase: '1',
  },
  {
    name: 'register_object',
    summary: 'Register placed object in scene awareness DB',
    category: 'geometry',
    phase: '1',
  },
  {
    name: 'get_scene_placement_state',
    summary: 'Read placement database: objects, positions, bounds, roles',
    category: 'geometry',
    params: {}, // no params
  },

  // ── Materials ───────────────────────────────────────────────────
  {
    name: 'apply_material',
    summary: 'Apply PBR recipe to material node in one call',
    category: 'materials',
    phase: '2',
  },
  {
    name: 'suggest_material',
    summary: 'Get PBR values for a surface type',
    category: 'materials',
    phase: '2',
  },

  // ── Camera ──────────────────────────────────────────────────────
  {
    name: 'get_camera',
    summary: 'Read camera position, target, and up vector',
    category: 'camera',
  },
  {
    name: 'set_camera',
    summary: 'Set camera position/target (Phase 4 only)',
    category: 'camera',
    phase: '4',
  },
  {
    name: 'fit_camera',
    summary: 'Frame camera to bounding box, mandatory after place_geo',
    category: 'camera',
    phase: '1',
  },

  // ── Render ──────────────────────────────────────────────────────
  {
    name: 'start_render',
    summary: 'Start rendering, auto-flushes pending changes',
    category: 'render',
  },
  { name: 'stop_render', summary: 'Stop rendering (unsaved samples lost)', category: 'render' },
  {
    name: 'get_render_status',
    summary: 'Sample count, time, resolution, render state',
    category: 'render',
  },
  {
    name: 'save_render',
    summary: 'Save current render to disk (PNG/EXR/HDR/etc)',
    category: 'render',
  },
  {
    name: 'save_render_passes',
    summary: 'Save all enabled AOV passes (multi-layer EXR or separate files)',
    category: 'render',
    params: {
      path: 'Output path. For multi_layer:true → absolute file path (.exr). For multi_layer:false → absolute directory path.',
      multi_layer: 'true = single multi-layer EXR file, false = separate files per pass (default)',
      format: 'Image format for separate files (ignored when multi_layer:true). Default EXR.',
      use_half: 'Use half-float precision for EXR (default true)',
      preserve_layer_names:
        'Preserve layer names in multi-layer EXR (default true). Ignored when multi_layer:false.',
      premultiply_alpha:
        'Premultiply alpha in multi-layer EXR (default false). Ignored when multi_layer:false.',
    },
  },
  {
    name: 'get_enabled_aovs',
    summary: 'List enabled render pass IDs on current RT',
    category: 'render',
    params: {
      render_target_handle: 'RT handle (uses current RT if omitted)',
    },
  },

  // ── Lighting ────────────────────────────────────────────────────
  {
    name: 'create_light',
    summary: 'Create emissive/quad/sphere/spot light in one call',
    category: 'lighting',
    phase: '2',
  },
  {
    name: 'setup_lighting',
    summary: 'Full 3-point rig (key+fill+rim) in one call',
    category: 'lighting',
    phase: '2',
  },
  {
    name: 'set_daylight',
    summary: 'Configure daylight environment attributes',
    category: 'lighting',
  },
  {
    name: 'suggest_lighting',
    summary: 'Get lighting recipe from mood + scene bounds',
    category: 'lighting',
    phase: '2',
  },

  // ── Scene ───────────────────────────────────────────────────────
  {
    name: 'get_scene_tree',
    summary: 'Full scene hierarchy (handle, name, type, children)',
    category: 'scene',
  },
  {
    name: 'get_node_info',
    summary: 'Node details: name, type, all pins with connections',
    category: 'scene',
  },
  { name: 'get_scene_bounds', summary: 'World-space AABB of entire scene', category: 'scene' },

  // ── Project ─────────────────────────────────────────────────────
  { name: 'load_project', summary: 'Load .orbx/.ocs project file', category: 'project' },
  { name: 'save_project', summary: 'Save current project to disk', category: 'project' },
  {
    name: 'reset_project',
    summary: 'Clear scene to blank (invalidates all handles)',
    category: 'project',
  },

  // ── Core Nodes ──────────────────────────────────────────────────
  { name: 'create_node', summary: 'Create Octane node by type name or ID', category: 'nodes' },
  { name: 'delete_node', summary: 'Delete node from scene', category: 'nodes' },
  { name: 'connect_nodes', summary: 'Connect source node to target pin', category: 'nodes' },
  {
    name: 'create_at_pin',
    summary: 'Create node + connect to target pin in one call',
    category: 'nodes',
  },
  {
    name: 'find_nodes',
    summary: 'Search scene graph by type ID or name',
    category: 'nodes',
    params: {
      type_id: 'Node type ID to search for (e.g. 130 for NT_MAT_UNIVERSAL)',
      name: 'Node name to search for (exact match)',
      recurse: 'Search recursively into subgraphs (default true)',
    },
  },
  {
    name: 'clone_node',
    summary: 'Deep-copy node and its subtree',
    category: 'nodes',
    params: { handle: 'Handle of the node to duplicate' },
  },
  {
    name: 'rename_node',
    summary: 'Set display name of a node',
    category: 'nodes',
    params: { handle: 'Node handle', name: 'New display name' },
  },
  {
    name: 'disconnect_pin',
    summary: 'Disconnect a pin (set connection to null)',
    category: 'nodes',
    params: { handle: 'Node handle', pin_index: 'Pin index to disconnect' },
  },
  {
    name: 'cleanup_orphans',
    summary: 'Delete all unconnected nodes in scene',
    category: 'nodes',
    params: {}, // no params
  },

  // ── Attributes ──────────────────────────────────────────────────
  {
    name: 'set_attribute',
    summary: 'Set node attribute by ID (bool/int/float/float3/string)',
    category: 'attributes',
  },
  { name: 'get_attribute', summary: 'Get node attribute value by ID', category: 'attributes' },
  {
    name: 'list_attributes',
    summary: 'Enumerate all attributes on a node ({id, name, type})',
    category: 'attributes',
    params: { handle: 'Node handle' },
  },
  {
    name: 'describe_attribute',
    summary: 'Get attribute metadata: name, type, defaults, description',
    category: 'attributes',
    params: { handle: 'Node handle', attribute_id: 'Attribute ID' },
  },
  {
    name: 'read_pin_value',
    summary: "Read connected node's attribute value in one call",
    category: 'attributes',
    params: {
      handle: 'Node handle',
      pin_index: 'Pin index to read value from',
      attribute_id: 'Attribute ID to read (default: A_VALUE=185)',
      expected_type:
        'AttrType. If omitted, auto-detects. Common: AT_FLOAT4=12, AT_FLOAT3=11, AT_STRING=14.',
    },
  },
  // flush_changes removed in build 75 — server auto-flushes after every mutation

  // ── Render Control ──────────────────────────────────────────────
  {
    name: 'clay_mode',
    summary: 'Get/set clay rendering mode (0=none, 1=grey, 2=color)',
    category: 'render_control',
  },
  {
    name: 'render_priority',
    summary: 'Get/set GPU render priority (0=LOW, 1=MEDIUM, 2=HIGH)',
    category: 'render_control',
    params: { priority: 'Priority to set: 0=LOW, 1=MEDIUM, 2=HIGH. Omit to read current.' },
  },
  {
    name: 'subsample_mode',
    summary: 'Get/set viewport sub-sampling (0=none, 1=2x2, 2=4x4, 3=8x8)',
    category: 'render_control',
    params: { mode: 'Mode to set: 0=none, 1=2x2, 2=4x4, 3=8x8. Omit to read current.' },
  },

  // ── Stats ───────────────────────────────────────────────────────
  {
    name: 'get_stats',
    summary: 'Scene stats: geometry/texture/resource breakdown',
    category: 'stats',
  },
  {
    name: 'get_render_state',
    summary: 'Render pipeline state: compiling, pending, paused, failure',
    category: 'stats',
    params: {}, // no params
  },

  // ── Animation ───────────────────────────────────────────────────
  {
    name: 'animation',
    summary: 'Manage keyframes: range/check/list/get/set/clear',
    category: 'animation',
    params: {
      action: 'Action: range | check | list | get | set | clear',
      handle: 'Node handle (required for all except range)',
      attribute_id: 'Attribute ID (required for check, get, set, clear)',
      expected_type: 'AttrType enum (required for get/set): 1=bool, 3=int, 9=float, 11=float3',
      pattern: 'Time values in seconds for set (e.g. [0, 0.5, 1.0])',
      values: 'Values at each time point for set (same length as pattern)',
      period: 'Period in seconds for set (default 1.0)',
      animation_type: 'For set: 0=LOOPING, 1=PING_PONG, 2=SINGLE_SHOT',
    },
  },

  // ── Color ───────────────────────────────────────────────────────
  {
    name: 'get_ocio_config',
    summary: 'Query current OCIO config: color spaces, displays, views, roles',
    category: 'color',
    params: { config_path: 'Path to OCIO config file. Omit to use OCIO env variable default.' },
  },
  {
    name: 'list_color_spaces',
    summary: 'List OCIO color space names from current config',
    category: 'color',
    params: { config_path: 'OCIO config path (omit for default)' },
  },

  // ── Discovery ────────────────────────────────────────────────────
  { name: 'search_tools', summary: 'Search MCP tools by keyword', category: 'discovery' },
  {
    name: 'describe_tool',
    summary: 'Get detailed parameter docs for a tool',
    category: 'discovery',
  },

  // ── Info / Debug ────────────────────────────────────────────────
  { name: 'get_octane_version', summary: 'Version, license, build info', category: 'info' },
  {
    name: 'list_node_types',
    summary: 'List Octane node types, attribute types, IDs by category',
    category: 'info',
  },
  {
    name: 'get_device_info',
    summary: 'GPU device name and memory usage',
    category: 'info',
    params: { device_index: 'GPU device index (default 0)' },
  },
  {
    name: 'profile',
    summary: '[Debug] Performance profiling: start/end spans, report, reset',
    category: 'debug',
    params: {
      action: 'Action: start | end | report | reset',
      label: 'Span name (required for start/end)',
    },
  },
  {
    name: 'clear_log',
    summary: 'Clear log_mcp.log for fresh debugging session',
    category: 'debug',
    params: {}, // no params
  },
  {
    name: 'refresh_ui',
    summary: 'Force octaneWebR to refresh its scene tree',
    category: 'debug',
    params: {}, // no params
  },
];

// ── Search & describe functions ─────────────────────────────────────

const catalogMap = new Map(TOOL_CATALOG.map(t => [t.name, t]));

/** Search tools by keyword across name, summary, and category. */
export function searchCatalog(query: string): ToolEntry[] {
  const q = query.toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  return TOOL_CATALOG.filter(t => {
    const haystack = `${t.name} ${t.summary} ${t.category} ${t.phase ?? ''}`.toLowerCase();
    return terms.every(term => haystack.includes(term));
  });
}

/** Get full catalog entry for a tool. */
export function getCatalogEntry(name: string): ToolEntry | undefined {
  return catalogMap.get(name);
}

/** Check if a tool is long-tail (has param docs in catalog). */
export function isSlimTool(name: string): boolean {
  const entry = catalogMap.get(name);
  return entry?.params !== undefined;
}
