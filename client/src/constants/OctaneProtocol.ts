/**
 * Octane gRPC Protocol Constants
 *
 * Protocol-level enums and helpers that match Octane's protobuf definitions.
 * These are immutable protocol values — they come from .proto files, NOT the API cache.
 *
 * Core enum values (AttrType, AttributeId) are defined in shared/OctaneConstants.ts
 * and re-exported here for backward compatibility with existing client imports.
 *
 * For dynamic node/pin type data (names, colors, categories, compatible types),
 * use OctaneCacheService instead.
 */

// Re-export shared constants so existing client imports keep working
export { AttrType, AttributeId } from '../../../shared/OctaneConstants';

// ─── ObjectType ──────────────────────────────────────────────────────────────

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
  // ApiNodePinInfoEx reuses value 44 (same as ApiNodePinInfo).
  ApiNodePinInfoEx: 44,
} as const;

export type ObjectTypeName = keyof typeof ObjectType;

export function createObjectPtr(handle: string, type: number) {
  return { handle, type };
}

export function getObjectTypeForService(serviceName: string): number | undefined {
  return ObjectType[serviceName as ObjectTypeName];
}

// ─── InputAction ─────────────────────────────────────────────────────────────

export const InputAction = {
  NONE: 0,
  INSERT: 1,
  DELETE: 2,
  MOVE_UP: 3,
  MOVE_DOWN: 4,
} as const;

// ─── PinId ───────────────────────────────────────────────────────────────────

export const PinId: Record<string, number> = {
  P_FILM_SETTINGS: 311,
  P_LOCK_RENDER_AOVS: 2672,
} as const;

// ─── PinTypeId ───────────────────────────────────────────────────────────────
// From common.proto — used in getPinValueByPinID/setPinValueByPinID expected_type

export const PinTypeId = {
  PIN_ID_UNDEFINED: 0,
  PIN_ID_BOOL: 1,
  PIN_ID_BYTE: 2,
  PIN_ID_INT: 3,
  PIN_ID_INT2: 4,
  PIN_ID_INT3: 5,
  PIN_ID_INT4: 6,
  PIN_ID_FLOAT: 9,
  PIN_ID_FLOAT2: 90,
  PIN_ID_FLOAT3: 11,
  PIN_ID_FLOAT4: 12,
  PIN_ID_MATRIX: 13,
  PIN_ID_STRING: 14,
  PIN_ID_FILEPATH: 15,
} as const;
