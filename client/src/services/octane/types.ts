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
 */
export interface GraphInfo {
  id?: number;
  type?: string;
  position?: { x: number; y: number };
  [key: string]: unknown;
}

/**
 * Node-specific information (from API)
 */
export interface NodeInfo {
  handle?: number;
  name?: string;
  type?: string;
  nodeTypeName?: string;
  nodeColor?: number;
  defaultName?: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Pin information for node connections (from API)
 */
export interface DimInfo {
  sliderStep?: number;
  min?: number;
  max?: number;
  [key: string]: unknown;
}

export interface FloatInfo {
  useSliders?: boolean;
  dimCount?: number;
  isColor?: boolean;
  dimInfos?: DimInfo[];
  [key: string]: unknown;
}

export interface IntInfo {
  useSliders?: boolean;
  dimCount?: number;
  dimInfos?: DimInfo[];
  [key: string]: unknown;
}

export interface EnumInfo {
  values?: { id?: number; name?: string; value?: number; label?: string; [key: string]: unknown }[];
  [key: string]: unknown;
}

export interface PinInfo {
  id?: number;
  name?: string;
  type?: string; // Pin type string e.g. 'PT_GEOMETRY'
  connected?: boolean;
  pinColor?: number | string | null;
  staticLabel?: string;
  staticName?: string;
  description?: string;
  groupName?: string | null;
  pinId?: number;
  pinOwner?: { handle?: number; [key: string]: unknown };
  floatInfo?: FloatInfo;
  intInfo?: IntInfo;
  enumInfo?: EnumInfo;
  [key: string]: unknown;
}

/**
 * Attribute information for a node (from API)
 */
export interface AttrInfo {
  id?: number;
  name?: string;
  value?: unknown;
  type?: string;
  description?: string;
  useSliders?: boolean;
  dimCount?: number;
  dimInfos?: unknown[];
  isColor?: boolean;
  values?: unknown[];
  [key: string]: unknown;
}

/**
 * Node connection information
 */
export interface NodeConnection {
  from: number;
  to: number;
  pin?: string;
  [key: string]: unknown;
}

/**
 * Scene node in the hierarchy tree
 */
export interface SceneNode {
  handle?: number; // Optional: will be undefined for unconnected pins
  name: string;
  type: string; // String type like 'PT_GEOMETRY' from API
  typeEnum?: number; // Legacy numeric enum (deprecated)
  outType?: string | number; // Raw API value (octaneWeb uses outType)
  visible?: boolean;
  level?: number;
  children?: SceneNode[];
  graphInfo?: GraphInfo;
  nodeInfo?: NodeInfo;
  pinInfo?: PinInfo;
  attrInfo?: AttrInfo;
  icon?: string;
  position?: { x: number; y: number };
  staticLabel?: string;
  staticName?: string;
  isAtTopLevel?: boolean;
  filePath?: string;
  polygonCount?: number;
  vertsPerPoly?: number[];
  [key: string]: unknown;
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
  [key: string]: unknown;
}
