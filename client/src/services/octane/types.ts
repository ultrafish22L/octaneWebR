/**
 * Shared types for Octane services
 */

/**
 * Current render state information
 */
export interface RenderState {
  isRendering: boolean;
  progress: number;
  samples: number;
  renderTime: number;
  resolution: { width: number; height: number };
}

/**
 * Graph information for a node (from API)
 * Note: Using 'any' for index signature to maintain compatibility with dynamic API data
 */
export interface GraphInfo {
  id?: number;
  type?: string;
  position?: { x: number; y: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Node-specific information (from API)
 * Note: Using 'any' for index signature to maintain compatibility with dynamic API data
 */
export interface NodeInfo {
  handle?: number;
  name?: string;
  type?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Pin information for node connections (from API)
 * Note: Using 'any' for index signature to maintain compatibility with dynamic API data
 */
export interface PinInfo {
  id?: number;
  name?: string;
  type?: string;
  connected?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Attribute information for a node (from API)
 * Note: Using 'any' for index signature to maintain compatibility with dynamic API data
 */
export interface AttrInfo {
  id?: number;
  name?: string;
  value?: any;
  type?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Node connection information
 */
export interface NodeConnection {
  from: number;
  to: number;
  pin?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Scene node in the hierarchy tree
 * Note: Using 'any' for index signature to maintain compatibility with dynamic API data
 */
export interface SceneNode {
  handle?: number;  // Optional: will be undefined for unconnected pins
  name: string;
  type: string;  // String type like 'PT_GEOMETRY' from API
  typeEnum?: number;  // Legacy numeric enum (deprecated)
  outType?: string | number;  // Raw API value (octaneWeb uses outType)
  visible?: boolean;
  level?: number;
  children?: SceneNode[];
  graphInfo?: GraphInfo;
  nodeInfo?: NodeInfo;
  pinInfo?: PinInfo;
  attrInfo?: AttrInfo;
  icon?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Complete scene structure
 */
export interface Scene {
  tree: SceneNode[];
  map: Map<number, SceneNode>;
  connections: Map<number, NodeConnection>;
}

export interface NodeAddedEvent {
  node: SceneNode;
  handle: number;
}

export interface NodeDeletedEvent {
  handle: number;
  collapsedChildren: number[];
}

export interface DeviceMemoryUsage {
  total: number;
  used: number;
  free: number;
}

export interface DeviceResourceStatistics {
  textures: number;
  geometry: number;
  nodes: number;
}

export interface DeviceGeometryStatistics {
  meshes: number;
  vertices: number;
  triangles: number;
}

export interface DeviceTexturesStatistics {
  count: number;
  memory: number;
}

export interface RenderRegion {
  active: boolean;
  regionMin: { x: number; y: number };
  regionMax: { x: number; y: number };
  featherWidth: number;
}

export interface PickResult {
  nodeHandle: number;
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
}

export interface MaterialCategory {
  id: number;
  name: string;
  parentID: number;
  typeID: number;
}

export interface Material {
  id: number;
  name: string;
  nickname: string;
  copyright: string;
}

/**
 * Camera state information
 */
export interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  up?: { x: number; y: number; z: number };
  fov?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Progressive Scene Loading Types
 * Added 2025-02-03 for Sprint 1: Progressive Scene Loading optimization
 */

/**
 * Stages of progressive scene loading
 */
export enum SceneLoadStage {
  IDLE = 'idle',
  ROOT = 'root',
  LEVEL_0 = 'level_0',
  PINS = 'pins',
  CONNECTIONS = 'connections',
  DEEP_NODES = 'deep_nodes',
  COMPLETE = 'complete'
}

/**
 * Progressive load progress event data
 */
export interface ProgressiveLoadEvent {
  stage: SceneLoadStage;
  progress: number;        // 0-100
  message: string;
  nodesLoaded: number;
  totalEstimate?: number;
}

/**
 * Result from loading a level of the scene tree
 */
export interface LevelLoadResult {
  level: number;
  nodes: SceneNode[];
  hasMore: boolean;
}

/**
 * Incremental scene update delta
 */
export interface SceneUpdateDelta {
  added: SceneNode[];
  updated: Array<{ handle: number; changes: Partial<SceneNode> }>;
  removed: number[];
}

/**
 * Configuration for progressive loading
 */
export interface ProgressiveConfig {
  enabled: boolean;
  maxParallelRequests: number;
  yieldInterval: number;      // ms between yields to UI
  batchSize: number;          // nodes per batch
  deepLoadDelay: number;      // ms before starting deep load
}

/**
 * Scene node with loading state tracking
 * Extends SceneNode with progressive loading metadata
 */
export interface SceneNodeWithState extends SceneNode {
  loadState?: 'pending' | 'loading' | 'loaded' | 'error';
  pinsLoaded?: boolean;
  connectionsLoaded?: boolean;
  childrenLoaded?: boolean;
}

/**
 * Progressive Scene Loading V2 Types
 * Added 2025-02-11 for visibility-aware progressive loading
 */

/**
 * Skeleton node - minimal data for instant UI feedback
 * Contains only essential info, full details loaded on-demand
 */
export interface SkeletonNode {
  handle: number;
  name: string;
  level: number;
  loadState: 'skeleton' | 'loading' | 'loaded' | 'error';
  estimatedChildCount?: number;
  children?: SkeletonNode[];
}

/**
 * V2 Loading phases
 */
export enum LoadPhase {
  IDLE = 'idle',
  SKELETON = 'skeleton',        // Phase 1: Basic structure
  VISIBLE_FIRST = 'visible',    // Phase 2: Visible nodes details
  BACKGROUND = 'background',    // Phase 3: Non-visible nodes
  COMPLETE = 'complete'
}

/**
 * V2 Progress event data
 */
export interface V2ProgressEvent {
  phase: LoadPhase;
  progress: number;           // 0-100 within phase
  overallProgress: number;    // 0-100 overall
  message: string;
  nodesLoaded: number;
  totalNodes: number;
  visibleNodesLoaded: number;
}

/**
 * V2 Node details loaded event
 */
export interface V2DetailsLoadedEvent {
  handle: number;
  node: SceneNode;
  phase: LoadPhase;
}

/**
 * V2 Children loaded event
 */
export interface V2ChildrenLoadedEvent {
  parentHandle: number;
  children: SceneNode[];
  isVisible: boolean;
}

/**
 * Visibility range from virtual scroll
 */
export interface VisibleRange {
  startIndex: number;
  stopIndex: number;
  handles: number[];
}

/**
 * Loading scheduler item
 */
export interface LoadItem {
  handle: number;
  priority: 'high' | 'normal' | 'low';
  type: 'details' | 'children' | 'attrInfo';
  addedAt: number;
}

/**
 * V2 Configuration options
 */
export interface ProgressiveConfigV2 {
  enabled: boolean;
  parallelLimit: number;        // Max concurrent API calls
  skeletonDelay: number;        // MS between skeleton emissions (for visual effect)
  visibleBatchSize: number;     // Load visible nodes in batches
  backgroundPauseOnScroll: boolean;
  lazyAttrInfo: boolean;        // Load attrInfo only on selection
  debugMode: boolean;
}
