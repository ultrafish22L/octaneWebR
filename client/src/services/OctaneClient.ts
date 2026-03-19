/**
 * OctaneWebR gRPC Client
 * TypeScript React implementation of Octane gRPC communication
 * Refactored to use modular service architecture
 */

import { Logger } from '../utils/Logger';
import { EventEmitter } from '../utils/EventEmitter';
import {
  ApiService,
  ConnectionService,
  CameraService,
  RenderService,
  DeviceService,
  SceneService,
  NodeService,
  MaterialDatabaseService,
  RenderExportService,
  ItemService,
  ProjectService,
  FileChooserService,
  RenderState,
  SceneNode,
  Scene,
  NodeAddedEvent,
  NodeDeletedEvent,
  RenderRegion,
  MaterialCategory,
  Material,
  CameraState,
} from './octane';
import type { ParameterRawValue, ParameterValue, ReferencePackageSettings } from './octane';

/** Validate that all numeric arguments are finite (not NaN or ±Infinity). */
function assertFinite(...values: number[]): void {
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(`Invalid coordinate value: ${v} (expected finite number)`);
    }
  }
}

// Re-export types for backward compatibility
export type {
  RenderState,
  SceneNode,
  Scene,
  NodeAddedEvent,
  NodeDeletedEvent,
  RenderRegion,
  MaterialCategory,
  Material,
  CameraState,
  ParameterRawValue,
  ParameterValue,
  ReferencePackageSettings,
};

/**
 * OctaneClient - Main orchestrator for Octane services
 * Delegates operations to specialized service modules
 */
export class OctaneClient extends EventEmitter {
  private serverUrl: string;

  // Service modules
  private apiService: ApiService;
  private connectionService: ConnectionService;
  private cameraService: CameraService;
  private renderService: RenderService;
  private deviceService: DeviceService;
  private sceneService: SceneService;
  private nodeService: NodeService;
  private materialDatabaseService: MaterialDatabaseService;
  private renderExportService: RenderExportService;
  private itemService: ItemService;
  private projectService: ProjectService;
  private fileChooserService: FileChooserService;

  constructor(serverUrl?: string) {
    super();
    this.serverUrl = serverUrl || window.location.origin;
    Logger.debug('OctaneClient initialized:', this.serverUrl);

    // Initialize services (progressive events enabled by default)
    this.apiService = new ApiService(this, this.serverUrl);
    this.connectionService = new ConnectionService(this, this.serverUrl, this.apiService);
    this.cameraService = new CameraService(this, this.serverUrl, this.apiService);
    this.renderService = new RenderService(this, this.serverUrl, this.apiService);
    this.deviceService = new DeviceService(this, this.serverUrl, this.apiService);
    this.sceneService = new SceneService(this, this.serverUrl, this.apiService, true);
    this.nodeService = new NodeService(this, this.serverUrl, this.apiService, this.sceneService);
    this.materialDatabaseService = new MaterialDatabaseService(
      this,
      this.serverUrl,
      this.apiService,
      this.sceneService
    );
    this.renderExportService = new RenderExportService(this, this.serverUrl, this.apiService);
    this.itemService = new ItemService(this, this.serverUrl, this.apiService);
    this.projectService = new ProjectService(this, this.serverUrl, this.apiService);
    this.fileChooserService = new FileChooserService(this, this.serverUrl, this.apiService);
  }

  // ==================== Connection Methods ====================

  async connect(): Promise<boolean> {
    const result = await this.connectionService.connect();
    if (result) {
      // Capture initial camera state
      await this.cameraService.captureOriginalCameraState();
    }
    return result;
  }

  async disconnect(): Promise<void> {
    return this.connectionService.disconnect();
  }

  isConnected(): boolean {
    return this.connectionService.isConnected();
  }

  // ==================== API Methods ====================

  /**
   * @internal Transport escape hatch — do not call from UI code.
   * Use the typed service methods on this class instead.
   */
  async callApi(
    service: string,
    method: string,
    handle?: string | number | Record<string, unknown> | null,
    params: Record<string, unknown> = {},
    timeoutMs?: number
  ): Promise<import('./octane/ApiService').ApiCallResult> {
    return this.apiService.callApi(service, method, handle, params, timeoutMs);
  }

  // ==================== Camera Methods ====================

  async getCamera(): Promise<CameraState> {
    return this.cameraService.getCamera();
  }

  async setCameraPosition(x: number, y: number, z: number): Promise<void> {
    assertFinite(x, y, z);
    return this.cameraService.setCameraPosition(x, y, z);
  }

  async setCameraTarget(x: number, y: number, z: number): Promise<void> {
    assertFinite(x, y, z);
    return this.cameraService.setCameraTarget(x, y, z);
  }

  async setCameraPositionAndTarget(
    posX: number,
    posY: number,
    posZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    silent = false
  ): Promise<void> {
    assertFinite(posX, posY, posZ, targetX, targetY, targetZ);
    return this.cameraService.setCameraPositionAndTarget(
      posX,
      posY,
      posZ,
      targetX,
      targetY,
      targetZ,
      silent
    );
  }

  async resetCamera(): Promise<void> {
    return this.cameraService.resetCamera();
  }

  async frameScene(elevation?: number, margin?: number): Promise<boolean> {
    return this.cameraService.frameScene(elevation, margin);
  }

  // ==================== Scene Methods ====================

  async buildSceneTree(newNodeHandle?: number): Promise<SceneNode[]> {
    return this.sceneService.buildSceneTree(newNodeHandle);
  }

  abortSceneLoad(): void {
    this.sceneService.abort();
  }

  /**
   * Wait for the current scene build to fully complete (including in-flight gRPC calls).
   * Call after abortSceneLoad() to ensure no gRPC calls are active before loadProject.
   */
  async waitForSceneIdle(): Promise<void> {
    return this.sceneService.waitForIdle();
  }

  /**
   * Unblock scene builds after loadProject completes.
   * Must be called before triggering a scene refresh.
   */
  unblockSceneLoad(): void {
    this.sceneService.unblock();
  }

  /**
   * Load attrInfo on-demand for lazy loading
   */
  async loadAttrInfo(handle: number): Promise<Record<string, unknown> | null> {
    const node = this.sceneService.getNodeByHandle(handle);
    return node?.attrInfo || null;
  }

  /**
   * Build a single new node's metadata without aborting any in-flight builds.
   * Safe to call concurrently for multiple handles (MCP rapid-fire adds).
   */
  async buildNewNode(handle: number): Promise<SceneNode | null> {
    return this.sceneService.buildNewNode(handle);
  }

  /**
   * Refresh an existing node's children (pin connections) in-place.
   * Call when MCP connect_nodes / disconnect_pin changes wiring.
   */
  async refreshNodeChildren(handle: number): Promise<boolean> {
    return this.sceneService.refreshNodeChildren(handle);
  }

  lookupItem(handle: number): SceneNode | null {
    return this.sceneService.lookupItem(handle);
  }

  removeFromScene(handle: number): void {
    this.sceneService.removeFromScene(handle);
  }

  getNodeByHandle(handle: number): SceneNode | undefined {
    return this.sceneService.getNodeByHandle(handle);
  }

  async setNodeVisibility(handle: number, visible: boolean): Promise<void> {
    return this.sceneService.setNodeVisibility(handle, visible);
  }

  getScene(): Scene {
    return this.sceneService.getScene();
  }

  // ==================== Render Control Methods ====================

  async startRender(): Promise<void> {
    return this.renderService.startRender();
  }

  async stopRender(): Promise<void> {
    return this.renderService.stopRender();
  }

  async pauseRender(): Promise<void> {
    return this.renderService.pauseRender();
  }

  async restartRender(): Promise<void> {
    return this.renderService.restartRender();
  }

  async getClayMode(): Promise<string> {
    return this.renderService.getClayMode();
  }

  async setClayMode(mode: number): Promise<void> {
    return this.renderService.setClayMode(mode);
  }

  async getSubSampleMode(): Promise<string> {
    return this.renderService.getSubSampleMode();
  }

  async setSubSampleMode(mode: number): Promise<void> {
    return this.renderService.setSubSampleMode(mode);
  }

  async getRenderPriority(): Promise<string> {
    return this.renderService.getRenderPriority();
  }

  async getRealTime(): Promise<boolean> {
    return this.renderService.getRealTime();
  }

  async getRenderStatistics(): Promise<Record<string, unknown> | null> {
    return this.renderService.getRenderStatistics();
  }

  async getRenderRegion(): Promise<RenderRegion> {
    return this.renderService.getRenderRegion();
  }

  async setRenderRegion(
    active: boolean,
    regionMin: { x: number; y: number },
    regionMax: { x: number; y: number },
    featherWidth: number = 0
  ): Promise<void> {
    return this.renderService.setRenderRegion(active, regionMin, regionMax, featherWidth);
  }

  async getViewportResolutionLock(): Promise<boolean> {
    return this.renderService.getViewportResolutionLock();
  }

  async setViewportResolutionLock(locked: boolean): Promise<void> {
    return this.renderService.setViewportResolutionLock(locked);
  }

  async setRenderTargetNode(nodeHandle: number | null): Promise<boolean> {
    return this.renderService.setRenderTargetNode(nodeHandle);
  }

  async getRenderTargetNode(): Promise<number | null> {
    return this.renderService.getRenderTargetNode();
  }

  getRenderState(): RenderState {
    return this.renderService.getRenderState();
  }

  // ==================== Device Methods ====================

  async getDeviceCount(): Promise<number> {
    return this.deviceService.getDeviceCount();
  }

  async getDeviceName(deviceIndex: number): Promise<string> {
    return this.deviceService.getDeviceName(deviceIndex);
  }

  async getMemoryUsage(deviceIndex: number): Promise<{
    usedDeviceMemory: number;
    freeDeviceMemory: number;
    totalDeviceMemory: number;
    outOfCoreMemory: number;
    peerToPeerBytesUsed: number;
  } | null> {
    return this.deviceService.getMemoryUsage(deviceIndex);
  }

  async getResourceStatistics(deviceIndex: number): Promise<{
    runtimeDataSize: number;
    filmDataSize: number;
    geometryDataSize: number;
    nodeSystemDataSize: number;
    imagesDataSize: number;
    compositorDataSize: number;
    denoiserDataSize: number;
  } | null> {
    return this.deviceService.getResourceStatistics(deviceIndex);
  }

  async getGeometryStatistics(deviceIndex: number): Promise<{
    triCount: number;
    dispTriCount: number;
    hairSegCount: number;
    voxelCount: number;
    gaussianSplatCount: number;
    sphereCount: number;
    instanceCount: number;
    emitPriCount: number;
    emitInstanceCount: number;
    analyticLiCount: number;
  } | null> {
    return this.deviceService.getGeometryStatistics(deviceIndex);
  }

  async getTexturesStatistics(deviceIndex: number): Promise<{
    usedRgba32Textures: number;
    usedRgba64Textures: number;
    usedY8Textures: number;
    usedY16Textures: number;
    usedVirtualTextures: number;
  } | null> {
    return this.deviceService.getTexturesStatistics(deviceIndex);
  }

  async getOctaneVersion(): Promise<string> {
    return this.deviceService.getOctaneVersion();
  }

  async getOctaneInfo(): Promise<{
    name: string;
    isDemo: boolean;
    isSubscription: boolean;
    tier: number;
  }> {
    return this.deviceService.getOctaneInfo();
  }

  // ==================== Viewport Methods ====================

  async pick(x: number, y: number): Promise<Record<string, unknown>[]> {
    assertFinite(x, y);
    return this.renderService.pick(x, y);
  }

  async pickWhitePoint(x: number, y: number): Promise<{ x: number; y: number; z: number } | null> {
    assertFinite(x, y);
    return this.renderService.pickWhitePoint(x, y);
  }

  async pickSceneInfo(x: number, y: number): Promise<Record<string, unknown>> {
    assertFinite(x, y);
    return this.renderService.pickSceneInfo(x, y);
  }

  async setRenderPriority(priority: number): Promise<void> {
    return this.renderService.setRenderPriority(priority);
  }

  // ==================== Item Methods ====================

  async getParameterValue(handle: string, expectedType: number): Promise<ParameterValue | null> {
    return this.itemService.getParameterValue(handle, expectedType);
  }

  async setParameterValue(
    handle: string,
    expectedType: number,
    newValue: ParameterRawValue
  ): Promise<void> {
    return this.itemService.setParameterValue(handle, expectedType, newValue);
  }

  async reloadFileNode(handle: string): Promise<void> {
    return this.itemService.reloadFileNode(handle);
  }

  // ==================== Project Methods ====================

  async saveProjectAsReferencePackage(
    path: string,
    settings: ReferencePackageSettings
  ): Promise<boolean> {
    return this.projectService.saveProjectAsReferencePackage(path, settings);
  }

  // ==================== Node Methods ====================

  async createNode(nodeType: string, nodeTypeId: number): Promise<number | null> {
    return this.nodeService.createNode(nodeType, nodeTypeId);
  }

  async deleteNode(nodeHandle: string): Promise<boolean> {
    return this.nodeService.deleteNode(nodeHandle);
  }

  async deleteNodeOptimized(nodeHandle: number): Promise<boolean> {
    return this.nodeService.deleteNodeOptimized(nodeHandle);
  }

  async copyNode(nodeHandle: number): Promise<number | null> {
    return this.nodeService.copyNode(nodeHandle);
  }

  async copyNodes(nodeHandles: number[]): Promise<number[]> {
    return this.nodeService.copyNodes(nodeHandles);
  }

  async groupNodes(nodeHandles: number[]): Promise<number | null> {
    return this.nodeService.groupNodes(nodeHandles);
  }

  async ungroupNode(groupNodeHandle: number): Promise<number[]> {
    return this.nodeService.ungroupNode(groupNodeHandle);
  }

  async expandNode(nodeHandle: number): Promise<boolean> {
    return this.nodeService.expandNode(nodeHandle);
  }

  async collapseNode(nodeHandle: number): Promise<boolean> {
    return this.nodeService.collapseNode(nodeHandle);
  }

  async getNodePosition(nodeHandle: number): Promise<{ x: number; y: number } | null> {
    return this.nodeService.getNodePosition(nodeHandle);
  }

  async setNodePosition(nodeHandle: number, x: number, y: number): Promise<boolean> {
    return this.nodeService.setNodePosition(nodeHandle, x, y);
  }

  async replaceNode(
    oldNodeHandle: number,
    newNodeType: string,
    nodeTypeId: number
  ): Promise<number | null> {
    return this.nodeService.replaceNode(oldNodeHandle, newNodeType, nodeTypeId);
  }

  async createNodeForPin(
    parentHandle: number,
    pinIdx: number,
    nodeType: string,
    nodeTypeId: number
  ): Promise<number | null> {
    return this.nodeService.createNodeForPin(parentHandle, pinIdx, nodeType, nodeTypeId);
  }

  async addMovableInput(nodeHandle: number): Promise<boolean> {
    return this.nodeService.addMovableInput(nodeHandle);
  }

  async deleteMovableInput(nodeHandle: number, pinIdx: number): Promise<boolean> {
    return this.nodeService.deleteMovableInput(nodeHandle, pinIdx);
  }

  async moveMovableInput(
    nodeHandle: number,
    pinIdx: number,
    direction: 'up' | 'down'
  ): Promise<boolean> {
    return this.nodeService.moveMovableInput(nodeHandle, pinIdx, direction);
  }

  async connectPinByIndex(
    targetNodeHandle: number,
    pinIdx: number,
    sourceNodeHandle: number,
    evaluate: boolean = true
  ): Promise<void> {
    return this.nodeService.connectPinByIndex(targetNodeHandle, pinIdx, sourceNodeHandle, evaluate);
  }

  async disconnectPin(nodeHandle: number, pinIdx: number, evaluate: boolean = true): Promise<void> {
    return this.nodeService.disconnectPin(nodeHandle, pinIdx, evaluate);
  }

  async handlePinConnectionCleanup(oldSourceHandle: number | null): Promise<void> {
    return this.nodeService.handlePinConnectionCleanup(oldSourceHandle);
  }

  // ==================== Material Database Methods ====================

  async getLocalDBRoot(): Promise<number | null> {
    return this.materialDatabaseService.getLocalDBRoot();
  }

  async getCategoryName(categoryHandle: number): Promise<string> {
    return this.materialDatabaseService.getCategoryName(categoryHandle);
  }

  async getSubCategoryCount(categoryHandle: number): Promise<number> {
    return this.materialDatabaseService.getSubCategoryCount(categoryHandle);
  }

  async getSubCategory(categoryHandle: number, index: number): Promise<number | null> {
    return this.materialDatabaseService.getSubCategory(categoryHandle, index);
  }

  async getPackageCount(categoryHandle: number): Promise<number> {
    return this.materialDatabaseService.getPackageCount(categoryHandle);
  }

  async getPackage(categoryHandle: number, index: number): Promise<number | null> {
    return this.materialDatabaseService.getPackage(categoryHandle, index);
  }

  async getPackageName(packageHandle: number): Promise<string> {
    return this.materialDatabaseService.getPackageName(packageHandle);
  }

  async packageHasThumbnail(packageHandle: number): Promise<boolean> {
    return this.materialDatabaseService.packageHasThumbnail(packageHandle);
  }

  async loadPackage(packageHandle: number, destinationGraphHandle?: number): Promise<boolean> {
    return this.materialDatabaseService.loadPackage(packageHandle, destinationGraphHandle);
  }

  async getLiveDBCategories(): Promise<MaterialCategory[]> {
    return this.materialDatabaseService.getLiveDBCategories();
  }

  async getLiveDBMaterials(categoryId: number): Promise<Material[]> {
    return this.materialDatabaseService.getLiveDBMaterials(categoryId);
  }

  async getLiveDBMaterialPreview(
    materialId: number,
    requestedSize: number = 256,
    view: number = 0
  ): Promise<string | null> {
    return this.materialDatabaseService.getLiveDBMaterialPreview(materialId, requestedSize, view);
  }

  async downloadLiveDBMaterial(
    materialId: number,
    destinationGraphHandle?: number
  ): Promise<number | null> {
    return this.materialDatabaseService.downloadLiveDBMaterial(materialId, destinationGraphHandle);
  }

  async getMaterialCategoriesForDbType(dbType: 'livedb' | 'localdb'): Promise<MaterialCategory[]> {
    return this.materialDatabaseService.getMaterialCategoriesForDbType(dbType);
  }

  async getMaterialsForDbType(
    categoryId: number,
    dbType: 'livedb' | 'localdb'
  ): Promise<Material[]> {
    return this.materialDatabaseService.getMaterialsForDbType(categoryId, dbType);
  }

  async downloadMaterialForDbType(materialId: number, dbType: 'livedb' | 'localdb'): Promise<void> {
    return this.materialDatabaseService.downloadMaterialForDbType(materialId, dbType);
  }

  // ==================== Render Export Methods ====================

  async saveRender(
    filePath: string,
    format: 'PNG' | 'JPG' | 'EXR' | 'TIFF' = 'PNG',
    renderPassId: number = 0
  ): Promise<boolean> {
    return this.renderExportService.saveRender(filePath, format, renderPassId);
  }

  async grabRenderForClipboard(): Promise<string | null> {
    return this.renderExportService.grabRenderForClipboard();
  }

  async exportRenderPasses(
    basePath: string,
    format: 'PNG' | 'JPG' | 'EXR' | 'TIFF' = 'PNG'
  ): Promise<boolean> {
    return this.renderExportService.exportRenderPasses(basePath, format);
  }

  async downloadRender(filename?: string): Promise<boolean> {
    return this.renderExportService.downloadRender(filename);
  }

  // ==================== File Chooser Methods ====================

  async listDirectory(
    dirPath: string
  ): Promise<import('./octane/FileChooserService').DirectoryListing | null> {
    return this.fileChooserService.listDirectory(dirPath);
  }
}

// Singleton instance
let octaneClient: OctaneClient | null = null;

export function getOctaneClient(): OctaneClient {
  if (!octaneClient) {
    octaneClient = new OctaneClient();
  }
  return octaneClient;
}
