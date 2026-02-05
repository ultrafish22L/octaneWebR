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
  ViewportService,
  SceneService,
  NodeService,
  MaterialDatabaseService,
  RenderExportService,
  RenderState,
  SceneNode,
  Scene,
  NodeAddedEvent,
  NodeDeletedEvent,
  RenderRegion,
  MaterialCategory,
  Material
} from './octane';
import { ProgressiveSceneService } from './octane/ProgressiveSceneService';
import { FEATURES } from '../config/features';

// Re-export types for backward compatibility
export type {
  RenderState,
  SceneNode,
  Scene,
  NodeAddedEvent,
  NodeDeletedEvent,
  RenderRegion,
  MaterialCategory,
  Material
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
  private viewportService: ViewportService;
  private sceneService: SceneService;
  private nodeService: NodeService;
  private materialDatabaseService: MaterialDatabaseService;
  private renderExportService: RenderExportService;
  
  // Optimization services (Sprint 1+)
  private progressiveSceneService: ProgressiveSceneService;

  constructor(serverUrl?: string) {
    super();
    this.serverUrl = serverUrl || window.location.origin;
    Logger.debug('🎬 OctaneClient initialized:', this.serverUrl);
    
    // Initialize services
    this.apiService = new ApiService(this, this.serverUrl);
    this.connectionService = new ConnectionService(this, this.serverUrl, this.apiService);
    this.cameraService = new CameraService(this, this.serverUrl, this.apiService);
    this.renderService = new RenderService(this, this.serverUrl, this.apiService);
    this.deviceService = new DeviceService(this, this.serverUrl, this.apiService);
    this.viewportService = new ViewportService(this, this.serverUrl, this.apiService);
    this.sceneService = new SceneService(this, this.serverUrl, this.apiService);
    this.nodeService = new NodeService(this, this.serverUrl, this.apiService, this.sceneService);
    this.materialDatabaseService = new MaterialDatabaseService(this, this.serverUrl, this.apiService, this.sceneService);
    this.renderExportService = new RenderExportService(this, this.serverUrl, this.apiService);
    
    // Initialize optimization services (Sprint 1+)
    this.progressiveSceneService = new ProgressiveSceneService(this, this.serverUrl, this.apiService);
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
  
  async callApi(service: string, method: string, handle?: any, params: any = {}): Promise<any> {
    return this.apiService.callApi(service, method, handle, params);
  }

  // ==================== Camera Methods ====================
  
  async getCamera(): Promise<any> {
    return this.cameraService.getCamera();
  }

  async setCameraPosition(x: number, y: number, z: number): Promise<void> {
    return this.cameraService.setCameraPosition(x, y, z);
  }

  async setCameraTarget(x: number, y: number, z: number): Promise<void> {
    return this.cameraService.setCameraTarget(x, y, z);
  }

  async setCameraPositionAndTarget(
    posX: number, posY: number, posZ: number,
    targetX: number, targetY: number, targetZ: number,
    silent = false
  ): Promise<void> {
    return this.cameraService.setCameraPositionAndTarget(posX, posY, posZ, targetX, targetY, targetZ, silent);
  }
  
  async resetCamera(): Promise<void> {
    return this.cameraService.resetCamera();
  }

  // ==================== Scene Methods ====================
  
  /**
   * Build scene tree with optional progressive loading
   * Uses ProgressiveSceneService if PROGRESSIVE_LOADING feature flag is enabled
   * Falls back to traditional sequential loading otherwise
   */
  async buildSceneTree(newNodeHandle?: number): Promise<SceneNode[]> {
    // Incremental update (add single node) - always use traditional service
    if (newNodeHandle !== undefined) {
      return this.sceneService.buildSceneTree(newNodeHandle);
    }
    
    // Full scene load - use progressive if enabled
    if (FEATURES.PROGRESSIVE_LOADING) {
      Logger.info('🚀 Using progressive scene loading');
      return this.progressiveSceneService.buildSceneProgressive();
    }
    
    // Fallback to traditional sequential loading
    Logger.debug('📦 Using traditional scene loading');
    return this.sceneService.buildSceneTree();
  }
  
  /**
   * Abort current scene loading operation
   * Only effective when progressive loading is enabled
   */
  abortSceneLoad(): void {
    if (FEATURES.PROGRESSIVE_LOADING) {
      this.progressiveSceneService.abort();
    }
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

  /**
   * Get current scene
   * Returns scene from progressive service if it was used, otherwise from traditional service
   */
  getScene(): Scene {
    if (FEATURES.PROGRESSIVE_LOADING && this.progressiveSceneService.getScene().tree.length > 0) {
      return this.progressiveSceneService.getScene();
    }
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

  async getClayMode(): Promise<number> {
    return this.renderService.getClayMode();
  }

  async setClayMode(mode: number): Promise<void> {
    return this.renderService.setClayMode(mode);
  }

  async getSubSampleMode(): Promise<number> {
    return this.renderService.getSubSampleMode();
  }

  async setSubSampleMode(mode: number): Promise<void> {
    return this.renderService.setSubSampleMode(mode);
  }

  async getRenderStatistics(): Promise<any> {
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

  // ==================== Viewport Methods ====================
  
  async pick(x: number, y: number): Promise<any[]> {
    return this.viewportService.pick(x, y);
  }

  async pickWhitePoint(x: number, y: number): Promise<{ x: number; y: number; z: number } | null> {
    return this.viewportService.pickWhitePoint(x, y);
  }

  async pickSceneInfo(x: number, y: number): Promise<any> {
    return this.viewportService.pickSceneInfo(x, y);
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

  async replaceNode(oldNodeHandle: number, newNodeType: string): Promise<number | null> {
    return this.nodeService.replaceNode(oldNodeHandle, newNodeType);
  }

  async connectPinByIndex(
    targetNodeHandle: number,
    pinIdx: number,
    sourceNodeHandle: number,
    evaluate: boolean = true
  ): Promise<void> {
    return this.nodeService.connectPinByIndex(targetNodeHandle, pinIdx, sourceNodeHandle, evaluate);
  }

  async disconnectPin(
    nodeHandle: number,
    pinIdx: number,
    evaluate: boolean = true
  ): Promise<void> {
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

  async getLiveDBMaterialPreview(materialId: number, requestedSize: number = 256, view: number = 0): Promise<string | null> {
    return this.materialDatabaseService.getLiveDBMaterialPreview(materialId, requestedSize, view);
  }

  async downloadLiveDBMaterial(materialId: number, destinationGraphHandle?: number): Promise<number | null> {
    return this.materialDatabaseService.downloadLiveDBMaterial(materialId, destinationGraphHandle);
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
    outputDirectory: string,
    filenamePrefix: string = 'render',
    format: 'PNG' | 'JPG' | 'EXR' | 'TIFF' = 'PNG'
  ): Promise<boolean> {
    return this.renderExportService.exportRenderPasses(outputDirectory, filenamePrefix, format);
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
