/**
 * Octane gRPC Protocol Constants
 *
 * Protocol-level enums and helpers that match Octane's protobuf definitions.
 * These are immutable protocol values — they come from .proto files, NOT the API cache.
 *
 * For dynamic node/pin type data (names, colors, categories, compatible types),
 * use OctaneCacheService instead.
 */

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

// ─── AttributeId ─────────────────────────────────────────────────────────────

export const AttributeId = {
  A_VALUE: 185,
  A_FILENAME: 34,
  A_VERTICES_PER_POLY: 189,
  A_POLY_OBJECT_INDICES: 116,
  A_PIN_COUNT: 113,
  A_RELOAD: 124,
  A_INPUT_ACTION: 128,
  A_ROTATION_ORDER: 136,
  A_ROTATION: 137,
  A_SCALE: 139,
  A_TRANSLATION: 172,
} as const;

// ─── AttrType ────────────────────────────────────────────────────────────────

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
  AT_FLOAT2: 90, // Note: 90 not 10 — verified in common.proto
  AT_FLOAT3: 11,
  AT_FLOAT4: 12,
  AT_MATRIX: 13,
  AT_STRING: 14,
} as const;

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
