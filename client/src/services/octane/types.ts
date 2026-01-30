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
