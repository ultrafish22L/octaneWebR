# MCP API Expansion Plan

## Current State (v2.3.1)

**71 tools** (75 built, 4 LiveDB disabled) covering ~200 gRPC methods.
Services used: ApiRenderEngine, ApiNode, ApiItem, ApiNodeGraph, ApiProjectManager, ApiItemArray, ApiChangeManager, LiveLink, ApiDBMaterialManager (broken), ApiMaterialXGlobal, ApiOcioConfig, ApiRootNodeGraph, ApiLinearTimeTransform.

**Full test sweep completed** — 303 gRPC calls, 0 crashes. 67/71 active tools pass. 3 bugs found and fixed. 4 LiveDB tools disabled (Octane API bug).

### What We Have

| Category       | Tools                                                                            | Status |
| -------------- | -------------------------------------------------------------------------------- | ------ |
| Node CRUD      | create, delete, connect, disconnect, create_and_connect                          | Solid  |
| Node query     | get_node_info, get_scene_tree, find_nodes, duplicate, rename, delete_unconnected | Solid  |
| Attributes     | get_attribute, set_attribute                                                     | Solid  |
| Camera         | get_camera, set_camera                                                           | Solid  |
| Render         | start, stop, get_status, save_render                                             | Solid  |
| Render control | clay_mode, render_region, render_priority, subsample_mode (get/set each)         | Solid  |
| Render passes  | get_enabled_aovs, save_render_passes, save_render_passes_exr, pick_point         | Solid  |
| Stats          | geometry, texture, resource, scene_bounds, render_state                          | Solid  |
| Project        | load, save, reset                                                                | Solid  |
| Import         | import_glb                                                                       | Solid  |
| UI sync        | refresh_webapp                                                                   | Solid  |
| Info           | get_version, get_device_info, list_node_types                                    | Solid  |
| Profiling      | profile_start, profile_end, profile_report, profile_reset, clear_log             | Solid  |

---

## Tiered Expansion Plan

### Tier 2: Scene Intelligence (12 tools, ~1 day)

Low-risk, high-value tools that make the AI agent smarter about the scene without modifying it.

#### 2A. Attribute Introspection (4 tools)

- **`get_all_attributes`** — enumerate all attributes on a node (attrCount + attrIdIx + attrInfo for each). Returns list of {id, name, type, value}. Essential for discovering unknown node properties.
- **`get_attribute_info`** — get metadata for a specific attribute: name, type, min/max, default, description. Uses `attrInfo1` or `attrInfoIx`.
- **`get_pin_value`** — read the value from a pin's connected node (shortcut: get pin connection → get attribute). Flattens the common 2-step lookup.
- **`is_animated`** — check if an attribute has an animator attached. Uses `isAnimated` / `isAnimatedIx`.

**gRPC methods:** `attrCount`, `attrIdIx`, `attrInfo1`, `attrInfoIx`, `isAnimated`, `isAnimatedIx`

#### 2B. Selection Management (3 tools)

- **`get_selection`** — get currently selected items and pins. Uses ApiSelectionManager.getSelection/getSelection1.
- **`set_selection`** — select items/pins programmatically. Uses setSelection.
- **`clear_selection`** — clear all selection. Uses clearSelection.

**gRPC methods:** `getSelection`, `getSelection1`, `setSelection`, `clearSelection`

#### 2C. Render Pass Viewport (2 tools)

- **`set_display_pass`** — switch which render pass is shown in viewport (e.g., show Z-depth, normals, or diffuse live). Uses `setDisplayRenderPassId`.
- **`get_display_pass`** — query which pass is currently displayed. Uses `getDisplayRenderPassId`.

**gRPC methods:** `setDisplayRenderPassId`, `getDisplayRenderPassId`

#### 2D. Advanced Picking (2 tools)

- **`pick_white_point`** — pick a pixel as white point reference for tonemapping. Uses `pickWhitePoint`.
- **`pick_cryptomatte`** — pick cryptomatte matte ID from a pixel. Uses `pickCryptomatteMatte`.

**gRPC methods:** `pickWhitePoint`, `pickCryptomatteMatte`

#### 2E. Diagnostics (1 tool)

- **`get_log_entries`** — read Octane's log messages (errors, warnings). Uses ApiLogManager.

**gRPC methods:** ApiLogManager methods

---

### Tier 3: Export & Database (10 tools, ~2 days)

Tools that move data in/out of Octane — export geometry, import materials, manage local packages.

#### 3A. Geometry Export (3 tools)

- **`export_geometry`** — export selected/all geometry to Alembic or FBX. Creates ApiGeometryExporter, adds items, writes frame, destroys.
- **`export_scene_ocs`** — export current scene to .ocs string format. Uses ApiSceneExporter.ocsString.
- **`export_scene_file`** — export scene to .orbx/.ocs file with optional animation time sampling. Uses ApiSceneExporter full pipeline (create → exportSample → finish).

**gRPC methods:** ApiGeometryExporter (create, setAspectRatio, setFbxOptions, addItem, writeFrame, destroy), ApiSceneExporter (create, exportSample, finish, ocsString)

#### 3B. LiveDB Material Browser (4 tools)

- **`browse_material_db`** — list LiveDB categories. Uses `getCategories`. _(NOTE: getCategory flagged as broken — test first)_
- **`search_materials`** — list materials in a category. Uses `getMaterials`.
- **`preview_material`** — download material preview image. Uses `getMaterialPreview`.
- **`download_material`** — download material into current scene graph. Uses `downloadMaterial` / `downloadMaterial1`.

**gRPC methods:** ApiDBMaterialManager (getCategories, getMaterials, getMaterialPreview, downloadMaterial, downloadMaterial1)

#### 3C. Local Database (3 tools)

- **`browse_local_db`** — list local database categories and packages. Uses ApiLocalDB_Category service.
- **`load_local_package`** — load a local package into the scene. Uses ApiLocalDB_Package.loadPackage.
- **`save_to_local_db`** — save a node graph as a local package. Uses ApiLocalDB_Category.savePackage.

**gRPC methods:** ApiLocalDB services (root, categoryByPath, packageByPath, loadPackage, savePackage, etc.)

---

### Tier 4: Animation & Time (8 tools, ~2 days)

Animation in Octane is done through **animator nodes on pins** and **scripted graphs**, not a traditional keyframe timeline.

#### 4A. Animation Query (3 tools)

- **`get_animation_range`** — get the animation time span of a node graph. Uses ApiNodeGraph.getAnimationTimeSpan (via Lua equivalent).
- **`get_animation_data`** — read animation values for an attribute. Uses `getAnimByAttr` / `getAnimByIx`.
- **`is_node_animated`** — check which attributes on a node are animated (bulk check). Iterates `isAnimated` across all pins.

**gRPC methods:** `getAnimByAttr`, `getAnimByIx`, `getAnimByName`, `isAnimated`, `isAnimatedIx`

#### 4B. Animation Authoring (3 tools)

- **`set_animation_data`** — write animation values for an attribute. Uses `setAnimByAttr` / `setAnimByIx`.
- **`clear_animation`** — remove animation from an attribute. Uses `clearAnim` / `clearAnimIx`.
- **`set_time_transform`** — configure animation time transform (delay, speed). Uses ApiAnimationTimeTransform / ApiLinearTimeTransform.

**gRPC methods:** `setAnimByAttr`, `setAnimByIx`, `clearAnim`, `clearAnimIx`, ApiLinearTimeTransformService methods

#### 4C. Frame Rendering (2 tools)

- **`render_frame`** — render a specific frame number (set time → evaluate → render → save). Compound tool.
- **`render_animation`** — render a frame range to disk. Iterates render_frame for each frame. Uses time sampling + save pipeline.

**gRPC methods:** Compound — combines existing time/render/save methods

---

### Tier 5: Color Management & Advanced (8 tools, ~2 days)

#### 5A. OCIO Color Management (4 tools)

- **`get_ocio_config`** — query current OCIO config: color spaces, displays, views, looks. Uses ApiOcioConfig (getRoleCount, getColorSpaceCount, getDisplayCount, etc.).
- **`set_output_color_space`** — set render output color space (sRGB, ACEScg, OCIO space). Modifies RT color space settings.
- **`list_color_spaces`** — enumerate available color spaces from OCIO config.
- **`list_displays_views`** — enumerate OCIO displays and views for viewport color management.

**gRPC methods:** ApiOcioConfig (12+ query methods), ApiOcioContextManager

#### 5B. Advanced Render (2 tools)

- **`save_deep_exr`** — save deep image EXR (per-pixel depth compositing data). Uses `saveDeepImage`.
- **`grab_render_result`** — grab raw render data into memory buffer. Uses `grabRenderResult`. Returns pixel data for programmatic analysis.

**gRPC methods:** `saveDeepImage`, `grabRenderResult`

#### 5C. MaterialX (2 tools)

- **`import_materialx`** — import a MaterialX file and create nodes. Uses ApiMaterialX.importMaterialXFile.
- **`list_materialx_nodes`** — list available MaterialX node categories. Uses ApiMaterialX.getAllMxNodeCategories.

**gRPC methods:** ApiMaterialX (importMaterialXFile, getAllMxNodeCategories, getNodeTypes)

---

### Tier 6: Network & Infrastructure (6 tools, ~1 day)

Lower-priority tools for production environments.

#### 6A. Network Rendering (3 tools)

- **`get_network_status`** — query network render daemon status. Uses ApiNetRenderManager.
- **`start_network_render`** — start network render job.
- **`configure_network`** — set network render configuration (daemons, ports).

**gRPC methods:** ApiNetRenderManager (14 methods)

#### 6B. Cache Management (2 tools)

- **`get_cache_stats`** — query meshlet cache stats, VRAM usage. Uses ApiCaches.
- **`clear_caches`** — force clear compiled shaders, meshlet cache, etc.

**gRPC methods:** ApiCaches methods

#### 6C. Schema Introspection (1 tool)

- **`query_api_schema`** — dynamic introspection: list all node types, pin types, attribute types, render passes, compatibility matrices. Uses ApiInfo (47 methods). Useful for building dynamic UI and validation.

**gRPC methods:** ApiInfo (getNodeTypes, getAttributeTypes, getPinTypes, getRenderPassInfo, etc.)

---

## Summary

| Tier      | Name               | Tools  | Effort          | Status                                    |
| --------- | ------------------ | ------ | --------------- | ----------------------------------------- |
| 1         | Core Expansion     | 18     | Done            | All tested, all pass                      |
| 2         | Scene Intelligence | 7      | Done            | All tested, 2 bugs fixed                  |
| 3         | Material Database  | 4      | Done (disabled) | All 4 hit Octane API bug — disabled       |
| 4         | Animation & Time   | 5      | Done            | 4/5 pass, 1 bug fixed (TimeArrayT)        |
| 5         | Color & MaterialX  | 4      | Done            | All pass (OCIO needs config to be useful) |
| **Total** |                    | **38** |                 | **71 active** (4 disabled)                |

**Deferred** (UI/disk/niche): selection, picking, geometry export, deep EXR, network rendering, cache management, local DB, frame rendering. See plan file for full deferred list.

---

## Implementation Notes

1. **Test each tool against live Octane** — the proto files are auto-generated and method names/field shapes can be wrong. Always verify with actual gRPC calls.
2. **Handle proto message types carefully** — many fields are wrapped message types, not primitives. See the `passesToExport` bug in Tier 1 testing.
3. **LiveDB may be broken** — `getCategory` is flagged as a known Octane API limitation. Test early, fail fast.
4. **Animation is node-based, not keyframe-based** — there's no "set keyframe at frame N". Animation authoring means creating animator nodes and connecting them. Tier 4 tools should abstract this complexity.
5. **OCIO requires a loaded config** — color management tools need an OCIO config file loaded first. Octane ships with a default config.
6. **Observer/callback methods won't work in MCP** — skip `addObserver`, `addCallback`, `addSelectionObserver` etc. MCP is request-response, not event-driven.
7. **Service-to-proto mapping** — new services need entries in `grpc-constants.js` SERVICE_TO_PROTO_MAP. Already mapped: 45 services. Most Tier 2-4 services are already mapped.
