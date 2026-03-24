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
  // File chooser
  ApiFileChooser: 'apifilechooser.proto',
  // LiveLink (camera control)
  LiveLink: 'livelink.proto',
  // Change manager (scene evaluation)
  ApiChangeManager: 'apichangemanager.proto',
  // Callbacks — Alpha 5 has StreamCallbackService in callback.proto,
  // 2026.2/octaneServGrpc has it in callbackstream.proto.
  // getProtoDir() already selects the right proto dir, but the filename differs too.
  get StreamCallbackService() {
    const { getProtoDir } = require('./api-version.config.js');
    return getProtoDir() === 'proto_old' ? 'callback.proto' : 'callbackstream.proto';
  },
  CallbackHandler: 'callback.proto',
  // Selection manager
  ApiSelectionManager: 'apiselectionmanager.proto',
  // Geometry/scene export
  ApiGeometryExporter: 'apigeometryexporter.proto',
  ApiSceneExporter: 'apisceneexporter.proto',
  // MaterialX
  ApiMaterialXGlobal: 'apimaterialx.proto',
  // OCIO color management
  ApiOcioConfig: 'apiocioconfig.proto',
  ApiOcioConfigLoader: 'apiocioconfigloader.proto',
  ApiOcioContextManager: 'apiociocontextmanager.proto',
  // System
  ApiDiagnostics: 'apidiagnostics.proto',
  ApiCaches: 'apicaches.proto',
  ApiLogManager: 'apilogmanager.proto',
  // Time sampling / animation
  ApiTimeSampling: 'apitimesampling.proto',
  ApiRootNodeGraph: 'apinodesystem_8.proto',
  ApiAnimationTimeTransform: 'apianimationtimetransform.proto',
  ApiLinearTimeTransform: 'apianimationtimetransform.proto',
  // Render view
  ApiRenderView: 'apirenderview.proto',
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
