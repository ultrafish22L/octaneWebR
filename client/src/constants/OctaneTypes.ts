/**
 * Octane gRPC Type Constants
 *
 * Converted from octaneWeb/js/constants/OctaneTypes.js
 * These match the protobuf ObjectRef.ObjectType enum values from common.proto
 */

export const ObjectType = {
  ApiFileName: 0,
  ApiGeometryExporter: 1,
  ApiGuiComponent: 2,
  MetaData: 3,
  ApiImageBuffer: 4,
  ImageType: 5,
  LayerInfo: 6,
  ApiAttributeInfo: 7,
  ApiOcioConfig: 8,
  ApiOctaneModuleInfo: 9,
  ApiOutputColorSpaceInfo: 10,
  ApiSharedSurface: 11,
  ImageExportSettings: 12,
  RenderPassExport: 13,
  RenderResultStatistics: 14,
  ReferencePackageExportSettings: 15,
  ApiItem: 16,
  ApiNode: 17,
  ApiRootNodeGraph: 18,
  ApiReferenceGraph: 19,
  ApiNodeGraph: 20,
  AnimationTimeTransform: 21,
  ApiAnimationTimeTransform: 22,
  ApiLinearTimeTransform: 23,
  SocketAddress: 24,
  TimeSpanT: 25,
  FrameRangeT: 26,
  ApiCustomCurveEditorController: 27,
  DBCategoryArray: 28,
  DBMaterialArray: 29,
  ImageInfo: 30,
  ApiItemArray: 31,
  Package: 32,
  Category: 33,
  ApiNodeArray: 34,
  ApiOcioConfigLoader: 35,
  ApiOcioContextManager: 36,
  ApiPackage: 37,
  ApiRenderImage: 38,
  ApiSceneExporter: 39,
  VdbGridInfo: 40,
  VdbInfo: 41,
  ApiMainWindow: 42,
  ApiProjectWorkspace: 43,
  ApiNodePinInfo: 44,
  ApiCompatibilityModeInfo: 45,
  ApiCompatibilityModeInfoSet: 46,
  ApiNodeInspector: 47,
  ApiRenderView: 48,
  NetRenderStatus: 49,
  VdbGridSampler: 50,
  ApiSceneOutliner: 51,
  ApiNodeGraphEditor: 52,
  ApiLocalDB_Category: 53,
  ApiLocalDB_Package: 54,
  ApiDBMaterialManager_DBCategoryArray: 55,
  ApiDBMaterialManager_DBMaterialArray: 56,
  ApiBinaryTable: 57,
  ApiBinaryGroup: 58,
  ApiLock: 59,
  ApiWorkPaneModuleInfo: 60,
  ApiNodeGraphModuleInfo: 61,
  ApiCommandModuleInfo: 62,
  ApiThread: 63,
  ApiModuleNodeGraph: 64,
  ApiSelectionManager: 65,
  ApiSelectionManager_PinSelection: 66,
  ApiCheckBox: 67,
  ApiCollapsiblePanelStack: 68,
  ApiColorSwatch: 69,
  ApiComboBoxItem: 70,
  ApiComboBox: 71,
  ApiFileChooser: 72,
  ApiGridLayout: 73,
  ApiLabel: 74,
  ApiModalDialog: 75,
  ApiMouseListener: 76,
  ApiNumericBox: 77,
  ApiProgressBar: 78,
  ApiTable: 79,
  ApiTextButton: 80,
  ApiTextEditor: 81,
  ApiTitleComponent: 82,
  ApiWindow: 83,
  ApiImage: 84,
  ApiImageComponent: 85,
  ApiPinSelection: 86,
  ApiMouseEvent: 87,
  ApiRenderEngine_PickIntersection: 88,
  ApiCustomCurveEditorController_Drawer: 89,
  ApiCustomCurveEditorController_Listener: 90,
  ApiTileGridLoader: 91,
  ApiGaussianSplatCloudNode: 92,
  ApiNodePinInfoEx: 44,
} as const;

export type ObjectTypeName = keyof typeof ObjectType;

/**
 * Helper to create properly typed object pointer
 */
export function createObjectPtr(handle: string, type: number) {
  return {
    handle,
    type,
  };
}

/**
 * Get ObjectType value for a service name
 * Used to automatically wrap handles in objectPtr structure
 */
export function getObjectTypeForService(serviceName: string): number | undefined {
  return ObjectType[serviceName as ObjectTypeName];
}

/**
 * Get type name from type value (for debugging)
 */
export function getObjectTypeName(type: number): string {
  const entry = Object.entries(ObjectType).find(([_name, value]) => value === type);
  return entry ? entry[0] : `Unknown(${type})`;
}

/**
 * Attribute IDs for node attributes
 * These match the AttributeId enum from Octane
 */
export const AttributeId = {
  A_VALUE: 185,
  // Add more as needed
} as const;

/**
 * Attribute types for node values
 * These match the AttributeTypeId enum from common.proto
 * AUTO-GENERATED from octaneWeb's AttributeType mapping
 *
 * IMPORTANT: These are the actual protobuf enum values from AttributeTypeId
 * Note: AT_FLOAT2 = 90 (not 10!) - this is correct per the proto definition
 */
export const AttrType = {
  AT_UNKNOWN: 0,
  AT_BOOL: 1,
  AT_BYTE: 2,
  AT_INT: 3,
  AT_INT2: 4,
  AT_INT3: 5,
  AT_INT4: 6,
  AT_LONG: 7,
  AT_LONG2: 8,
  AT_FLOAT: 9,
  AT_FLOAT2: 90, // Note: 90 not 10 - verified in common.proto
  AT_FLOAT3: 11,
  AT_FLOAT4: 12,
  AT_MATRIX: 13,
  AT_STRING: 14,
} as const;

/**
 * Node types for Octane scene graph nodes
 * These match the enum values from octaneids.h
 * Used for node creation via ApiNode.create()
 */
export const NodeType: Record<string, number> = {
  // Cameras
  NT_CAM_BAKING: 94,
  NT_CAM_OSL_BAKING: 128,
  NT_CAM_OSL: 126,
  NT_CAM_PANORAMIC: 62,
  NT_CAM_SIMULATED_LENS: 301,
  NT_CAM_THINLENS: 13,
  NT_CAM_UNIVERSAL: 157,

  // Displacement
  NT_DISPLACEMENT: 80,

  // Emission
  NT_EMIS_BLACKBODY: 53,
  NT_EMIS_TEXTURE: 54,

  // Environments
  NT_ENV_DAYLIGHT: 14,
  NT_ENV_PLANETARY: 129,
  NT_ENV_TEXTURE: 37,

  // Geometry
  NT_GEO_MESH: 1,
  NT_GEO_GROUP: 3,
  NT_GEO_PLACEMENT: 4,
  NT_GEO_SCATTER: 5,
  NT_GEO_PLANE: 110,
  NT_GEO_VOLUME: 91,
  NT_GEO_OBJECT: 153,

  // Input
  NT_BOOL: 11,
  NT_FLOAT: 6,
  NT_INT: 9,
  NT_ENUM: 57,

  // Kernels
  NT_KERN_PMC: 23,
  NT_KERN_DIRECTLIGHTING: 24,
  NT_KERN_PATHTRACING: 25,
  NT_KERN_INFO: 26,

  // Lights
  NT_LIGHT_QUAD: 148,
  NT_LIGHT_SPHERE: 149,
  NT_LIGHT_VOLUME_SPOT: 152,
  NT_LIGHT_DIRECTIONAL: 282,
  NT_LIGHT_ANALYTIC: 294,

  // Materials
  NT_MAT_DIFFUSE: 17,
  NT_MAT_GLOSSY: 16,
  NT_MAT_SPECULAR: 18,
  NT_MAT_MIX: 19,
  NT_MAT_PORTAL: 20,
  NT_MAT_UNIVERSAL: 130,
  NT_MAT_METAL: 120,
  NT_MAT_TOON: 121,

  // Medium
  NT_MED_ABSORPTION: 58,
  NT_MED_SCATTERING: 59,
  NT_MED_VOLUME: 98,
  NT_MED_RANDOMWALK: 146,

  // Textures
  NT_TEX_IMAGE: 34,
  NT_TEX_FLOATIMAGE: 36,
  NT_TEX_ALPHAIMAGE: 35,
  NT_TEX_RGB: 33,
  NT_TEX_FLOAT: 31,
  NT_TEX_NOISE: 87,
  NT_TEX_CHECKS: 45,
  NT_TEX_MARBLE: 47,
  NT_TEX_TURBULENCE: 22,
  NT_TEX_MIX: 38,
  NT_TEX_MULTIPLY: 39,
  NT_TEX_ADD: 106,
  NT_TEX_SUBTRACT: 108,
  NT_TEX_GRADIENT: 49,
  NT_TEX_FALLOFF: 50,

  // Render Target
  NT_RENDERTARGET: 56,
} as const;

/**
 * Pin IDs for Octane scene graph nodes
 * These match the PinId enum values from octaneids.proto
 * Used for pin connections and parameter access
 *
 * NOTE: Add more values as needed from server/proto/octaneids.proto (PinId enum)
 */
export const PinId: Record<string, number> = {
  P_FILM_SETTINGS: 311,
  P_LOCK_RENDER_AOVS: 2672, // Controls viewport resolution lock
} as const;

/**
 * Pin Type IDs for type validation
 * These match the PinTypeId enum values from common.proto
 * Used with getPinValue/setPinValue methods for type validation
 */
export const PinTypeId = {
  PIN_ID_UNDEFINED: 0,
  PIN_ID_BOOL: 1,
  PIN_ID_BYTE: 2,
  PIN_ID_INT: 3,
  PIN_ID_INT2: 4,
  PIN_ID_INT3: 5,
  PIN_ID_INT4: 6,
  PIN_ID_FLOAT: 9,
  PIN_ID_FLOAT2: 90, // Note: 90 not 10
  PIN_ID_FLOAT3: 11,
  PIN_ID_FLOAT4: 12,
  PIN_ID_MATRIX: 13,
  PIN_ID_STRING: 14,
  PIN_ID_FILEPATH: 15,
} as const;
