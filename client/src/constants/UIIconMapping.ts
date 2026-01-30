/**
 * UI Icon Mapping
 * Maps UI controls, window elements, editor panels, and interaction tools to Octane icons
 *
 * Icon sources:
 * - Window controls: client/public/icons/*window.png
 * - Editor types: client/public/icons/*editor.png
 * - Preview modes: client/public/icons/*PREVIEW*.png
 * - Mini controls: client/public/icons/MINI*.png
 * - Picker tools: client/public/icons/MOUSE*.png, PICK*.png
 * - Misc UI: client/public/icons/*general.png, *CLIPBOARD*.png
 */

// ============================================================================
// WINDOW CONTROLS
// ============================================================================

export const WindowControlIcons = {
  // Playback controls
  PLAY: 'PLAY window.png',
  PAUSE: 'PAUSE window.png',
  STOP: 'STOP window.png',
  REWIND: 'REWIND window.png',

  // Window size controls
  MINIMIZE: 'MINIMIZE window.png',
  MAXIMIZE: 'MAXIMIZE window.png',

  // View controls
  RECENTER: 'RECENTER window.png',
  RULERS: 'RULERS window.png',
  STEREO: 'STEREO window.png',
  SHOW_HOME: 'SHOW HOME window.png',

  // Lock controls
  LOCK: 'LOCK window.png',
  UNLOCK: 'UNLOCK window.png',
  LOCK_RES: 'LOCK_RES-3 window.png',

  // Node graph controls
  COLLAPSE_NODES: 'COLLAPSE NODES window.png',
  UNCOLLAPSE_NODES: 'UNCOLLAPSE NODES window.png',
  UNFOLD_GRAPH: 'unfold_graph.png',
  UNFOLD_GRAPH_RECURSIVELY: 'unfold_graph_recursively.png',
  SNAP_TO_GRID: 'grid snap.png',
  GRID_TOGGLE: 'toggle grid.png',

  // Network
  NETWORK: 'NETWORK window.png',

  // AF (Adaptive Focus?)
  AF: 'AF window.png',

  // Clay modes
  CLAY: 'CLAY window.png',
  CLAY_OFF: 'CLAY OFF window.png',
  CLAY_COLOUR: 'CLAY COLOUR window.png',
} as const;

// ============================================================================
// EDITOR/PANEL TYPES
// ============================================================================

export const EditorPanelIcons = {
  GRAPH_EDITOR: 'GRAPH editor.png',
  NODE_INSPECTOR: 'NODE INSPECTOR editor.png',
  OSL_EDITOR: 'OSL editor.png',
  OUTLINER: 'OUTLINER editor.png',
} as const;

// ============================================================================
// PREVIEW MODES
// ============================================================================

export const PreviewModeIcons = {
  // Preview windows
  MATERIAL_PREVIEW: 'MATERIAL_PREVIEW window.png',
  MESH_PREVIEW: 'MESH_PREVIEW window.png',
  RENDER_TARGET_PREVIEW: 'RENDER TARGET_PREVIEW window.png',
  TEXTURE_PREVIEW: 'TEXTURE_PREVIEW window.png',

  // Material preview shapes
  MAT_PREVIEW_BALL: 'MAT_PREVIEW_BALL window.png',
  MAT_PREVIEW_BALL_CROP: 'MAT_PREVIEW_BALL_CROP window.png',
  MAT_PREVIEW_PLANE: 'MAT_PREVIEW_PLANE window.png',
  MAT_PREVIEW_PLANE_WITH_ALPHA: 'MAT_PREVIEW_PLANE_WITH_ALPHA window.png',

  // Mini preview toggles
  MINI_PREVIEW_ON: 'MINI PREVIEW ON.png',
  MINI_PREVIEW_OFF: 'MINI PREVIEW OFF.png',
} as const;

// ============================================================================
// MINI/SMALL UI CONTROLS
// ============================================================================

export const MiniControlIcons = {
  // Basic actions
  ADD: 'MINI ADD.png',
  REMOVE: 'MINI REMOVE.png',
  EDIT: 'MINI EDIT.png',
  RUN: 'MINI run.png',

  // Lock controls
  LOCK: 'MINI LOCK.png',
  UNLOCK: 'MINI UNLOCK.png',

  // Tab controls
  TAB_CLOSE: 'MINI TAB CLOSE BRIGHT.png',

  // Distribution modes
  LINEAR_DISTRIBUTION: 'MINI LINEAR DISTRIBUTION.png',
  LOG_DISTRIBUTION: 'MINI LOG DISTRIBUTION.png',

  // Node pins
  NODE_INPUT_PINS: 'mini node inputpins.png',
  NODE_OUTPUT_PINS: 'mini node outputpins.png',
  NODE_OUT_CONNECTION: 'mini node outconnection.png',

  // Other
  COMPATIBILITY: 'mini_compatibility.png',
} as const;

// ============================================================================
// PICKER/INTERACTION TOOLS
// ============================================================================

export const PickerToolIcons = {
  // Mouse pipette tools
  PIPETTE_COLOR: 'MOUSE pipette color.png',
  PIPETTE_FILM_REGION: 'MOUSE pipette film region.png',
  PIPETTE_FOCUS: 'MOUSE pipette focus.png',
  PIPETTE_MATERIAL: 'MOUSE pipette material.png',
  PIPETTE_OBJECT: 'MOUSE pipette object.png',
  PIPETTE_REGION: 'MOUSE pipette region.png',
  PIPETTE_ZOOM: 'MOUSE pipette zoom.png',
  PIPETTE_CRYPTOMATTE_ADD: 'MOUSE_pipette_cryptomatte_add.png',
  PIPETTE_CRYPTOMATTE_REMOVE: 'MOUSE_pipette_cryptomatte_remove.png',

  // Pick tools
  PICK_AF: 'PICK af.png',
  PICK_FILM_REGION: 'PICK film region.png',
  PICK_MATERIAL: 'PICK material.png',
  PICK_OBJECT: 'PICK object.png',
  PICK_ZOOM: 'PICK zoom.png',
} as const;

// ============================================================================
// GIZMO/TRANSFORM CONTROLS
// ============================================================================

export const GizmoIcons = {
  // Transform gizmos
  MOVE_FRAME: 'GIZMO move frame.png',
  ROTATE_FRAME: 'GIZMO rotate frame.png',
  SCALE_FRAME: 'GIZMO scale frame.png',

  // Coordinate space modes
  LOCAL_MODE: 'GIZMO local mode.png',
  WORLD_MODE: 'GIZMO world mode.png',
  WORLD_INDICATOR: 'GIZMO world indicator.png',
} as const;

// ============================================================================
// GENERAL UI ACTIONS
// ============================================================================

export const GeneralUIIcons = {
  // Clipboard operations
  COPY_TO_CLIPBOARD_IMAGE: 'COPY TO CLIPBOARD image.png',
  COPY_TO_CLIPBOARD_TEXT: 'COPY_TO_CLIPBOARD text.png',

  // File operations
  LOAD_GENERAL: 'LOAD general.png',
  LOAD_ALL: 'LOAD_all.png',

  // Settings
  CUSTOMIZE_GENERAL: 'CUSTOMIZE general.png',

  // Other
  CATEGORY: 'CATEGORY.png',
  BACKGROUND: 'Background.png',
} as const;

// ============================================================================
// MESH/GEOMETRY SPECIFIC
// ============================================================================

export const MeshIcons = {
  MESH_ARCHIVE: 'MESH archive.png',
  MESH_TRANSFORM: 'MESH transform.png',
} as const;

// ============================================================================
// EMITTER SPECIFIC (not already in node types)
// ============================================================================

export const EmitterIcons = {
  EMITTER_QUAD: 'EMITTER_QUAD.png',
  EMITTER_SPHERE: 'EMITTER_SPHERE.png',
} as const;

// ============================================================================
// NODE INSPECTOR TOOLBAR
// Based on Octane SE Manual Figure 2
// https://docs.otoy.com/standaloneSE/TheNodeInspector.html
// ============================================================================

export const NodeInspectorIcons = {
  // Quick Access Buttons - allow user to quickly jump to commonly used nodes
  EXPAND_ALL_NODES: 'UNCOLLAPSE NODES window.png',
  RENDER_TARGET: 'RENDER TARGET node.png',
  ENVIRONMENT_SETTINGS: 'ENVIRONMENT node.png',
  CURRENT_GEOMETRY: 'MESH node.png',
  ANIMATION_SETTINGS: 'animation_settings_node.png',
  ACTIVE_RENDER_LAYER: 'render_layer.png',
  AOV_GROUP: 'aov-output-group.png',
  POST_PROCESSING: 'POSTPROC node.png',
  COLLAPSE_ALL_NODES: 'COLLAPSE NODES window.png',
  CAMERA_SETTINGS: 'CAMERA node.png',
  VISIBLE_ENVIRONMENT_SETTINGS: 'ENVIRONMENT node.png',
  FILM_SETTINGS: 'FILM node.png',
  RENDER_PASSES: 'render_passes.png',
  CURRENT_KERNEL: 'RENDER KERNEL node.png',
  RENDER_AOV_NODE: 'aov-output.png',
  CAMERA_IMAGER: 'IMAGER node.png',
} as const;

// ============================================================================
// RENDER TOOLBAR
// Based on Octane SE Manual - The Render Viewport
// ============================================================================

export const RenderToolbarIcons = {
  // Render controls
  SUB_SAMPLING: 'sub-sampling.png',
  RENDER_MODE_PATH_TRACING: 'render mode path tracing.png',
  RENDER_MODE_PMC: 'render mode PMC.png',
  RENDER_MODE_DIRECT_LIGHTING: 'render mode direct lighting.png',
  DECAL_WIREFRAME: 'decal-wireframe.png',

  // Node graph controls (also in WindowControlIcons but here for render toolbar)
  SNAP_GRID: 'grid snap.png',
  TOGGLE_GRID: 'toggle grid.png',
} as const;

// ============================================================================
// COMBINED ICON MAP
// ============================================================================

export const UIIcons = {
  ...WindowControlIcons,
  ...EditorPanelIcons,
  ...PreviewModeIcons,
  ...MiniControlIcons,
  ...PickerToolIcons,
  ...GizmoIcons,
  ...GeneralUIIcons,
  ...MeshIcons,
  ...EmitterIcons,
  ...NodeInspectorIcons,
  ...RenderToolbarIcons,
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get icon path for a UI control
 */
export function getUIIcon(iconKey: keyof typeof UIIcons): string {
  return `/icons/${UIIcons[iconKey]}`;
}

/**
 * Get window control icon
 */
export function getWindowControlIcon(control: keyof typeof WindowControlIcons): string {
  return `/icons/${WindowControlIcons[control]}`;
}

/**
 * Get editor panel icon
 */
export function getEditorPanelIcon(panel: keyof typeof EditorPanelIcons): string {
  return `/icons/${EditorPanelIcons[panel]}`;
}

/**
 * Get preview mode icon
 */
export function getPreviewModeIcon(mode: keyof typeof PreviewModeIcons): string {
  return `/icons/${PreviewModeIcons[mode]}`;
}

/**
 * Get mini control icon
 */
export function getMiniControlIcon(control: keyof typeof MiniControlIcons): string {
  return `/icons/${MiniControlIcons[control]}`;
}

/**
 * Get picker tool icon
 */
export function getPickerToolIcon(tool: keyof typeof PickerToolIcons): string {
  return `/icons/${PickerToolIcons[tool]}`;
}

/**
 * Get gizmo icon
 */
export function getGizmoIcon(gizmo: keyof typeof GizmoIcons): string {
  return `/icons/${GizmoIcons[gizmo]}`;
}

/**
 * Get general UI icon
 */
export function getGeneralUIIcon(icon: keyof typeof GeneralUIIcons): string {
  return `/icons/${GeneralUIIcons[icon]}`;
}

/**
 * Get Node Inspector toolbar icon
 */
export function getNodeInspectorIcon(icon: keyof typeof NodeInspectorIcons): string {
  return `/icons/${NodeInspectorIcons[icon]}`;
}

/**
 * Get render toolbar icon
 */
export function getRenderToolbarIcon(icon: keyof typeof RenderToolbarIcons): string {
  return `/icons/${RenderToolbarIcons[icon]}`;
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UIIconKey = keyof typeof UIIcons;
export type WindowControlIconKey = keyof typeof WindowControlIcons;
export type EditorPanelIconKey = keyof typeof EditorPanelIcons;
export type PreviewModeIconKey = keyof typeof PreviewModeIcons;
export type MiniControlIconKey = keyof typeof MiniControlIcons;
export type PickerToolIconKey = keyof typeof PickerToolIcons;
export type GizmoIconKey = keyof typeof GizmoIcons;
export type GeneralUIIconKey = keyof typeof GeneralUIIcons;
export type NodeInspectorIconKey = keyof typeof NodeInspectorIcons;
export type RenderToolbarIconKey = keyof typeof RenderToolbarIcons;
