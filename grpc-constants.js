/**
 * Shared gRPC Constants
 *
 * Single source of truth for service-to-proto mappings and proto loader options.
 * Both the Vite plugin and Express server import from this file.
 *
 * Uses CommonJS to match api-version.config.js pattern.
 */

/**
 * Maps Octane service names to their proto file names.
 * Used by both loadServiceProto() implementations.
 */
const SERVICE_TO_PROTO_MAP = {
  // Core node system
  ApiProjectManager: 'apiprojectmanager.proto',
  ApiItemService: 'apinodesystem_3.proto',
  ApiItem: 'apinodesystem_3.proto',
  ApiItemGetter: 'apinodesystem_3.proto',
  ApiItemGetterService: 'apinodesystem.proto',
  ApiItemSetter: 'apinodesystem_3.proto',
  ApiItemSetterService: 'apinodesystem.proto',
  ApiNodeGraphService: 'apinodesystem_6.proto',
  ApiNodeGraph: 'apinodesystem_6.proto',
  ApiItemArrayService: 'apinodesystem_1.proto',
  ApiItemArray: 'apinodesystem_1.proto',
  ApiNodeService: 'apinodesystem_7.proto',
  ApiNode: 'apinodesystem_7.proto',
  ApiNodeArray: 'apinodesystem_5.proto',
  ApiNodePinInfoEx: 'apinodepininfohelper.proto',
  // Render
  ApiRenderEngine: 'apirender.proto',
  ApiRenderEngineService: 'apirender.proto',
  // Info
  ApiInfo: 'apiinfo.proto',
  ApiInfoService: 'apiinfo.proto',
  // Scene
  ApiSceneOutliner: 'apisceneoutliner.proto',
  // LiveDB
  ApiDBMaterialManager: 'apidbmaterialmanager.proto',
  ApiDBMaterialManager_DBCategoryArray: 'apidbmaterialmanager.proto',
  ApiDBMaterialManager_DBMaterialArray: 'apidbmaterialmanager.proto',
  // LocalDB
  ApiLocalDB: 'apilocaldb.proto',
  ApiLocalDB_Category: 'apilocaldb.proto',
  ApiLocalDB_Package: 'apilocaldb.proto',
  // Callbacks
  StreamCallbackService: 'callback.proto',
  CallbackHandler: 'callback.proto',
};

/**
 * Proto loader options shared by both gRPC clients.
 */
const PROTO_LOADER_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

/**
 * Namespace patterns to search when resolving a service constructor
 * from the proto descriptor. Tried in order.
 */
const SERVICE_NAMESPACE_PATTERNS = [
  'octaneapi.{name}Service',
  'octaneapi.{name}',
  'livelinkapi.{name}Service',
  'livelinkapi.{name}',
  '{name}Service',
  'OctaneEngine.Livelink.{name}',
  'Octane.{name}',
  '{name}',
];

module.exports = {
  SERVICE_TO_PROTO_MAP,
  PROTO_LOADER_OPTIONS,
  SERVICE_NAMESPACE_PATTERNS,
};
