/**
 * Toolbar Icon Mapping
 * Maps toolbar button IDs to actual Octane UI icon files from /icons/ directory
 */

export interface ToolbarIconMapping {
  [toolbarId: string]: string;
}

/**
 * Mapping of toolbar action IDs to icon file paths
 * These match the actual icons extracted from Octane UI
 */
export const TOOLBAR_ICON_MAP: ToolbarIconMapping = {
  // Render Controls
  'start-render': 'PLAY window.png',
  'pause-render': 'PAUSE window.png',
  'stop-render': 'STOP window.png',
  'restart-render': 'REWIND window.png', // Using STOP as restart placeholder
  
  // Render Modes
  'realtime-mode': 'RENDER TARGET node.png',
  'real-time-render': 'real_time.png',
  'clay-mode': 'CLAY window.png',
  'clay-mode-off': 'CLAY OFF window.png',
  'subsampling-menu': 'SUBSAMPLING window.png',
  'subsample-2x2': '2x.png',
  'subsample-4x4': '4x.png',
  'decal-wireframe': 'draw_decal_wireframe.png',
  
  // Camera Tools
  'pick-focus': 'MOUSE pipette focus.png',
  'focus-picker': 'PICK af.png',
  'pick-white-balance': 'MOUSE pipette color.png',
  'white-balance-picker': 'PICKWB.png',
  'pick-material': 'MOUSE pipette material.png',
  'material-picker': 'PICK material.png',
  'pick-object': 'MOUSE pipette object.png',
  'object-picker': 'PICK object.png',
  'pick-camera-target': 'MOUSE pipette zoom.png',
  'camera-target-picker': 'PICK zoom.png',
  'render-region': 'MOUSE pipette region.png',
  'render-region-picker': 'PICK reg.png',
  'film-region': 'MOUSE pipette film region.png',
  'film-region-picker': 'PICK film region.png',
  'camera-presets': 'camera_view_presets.png',
  'recenter-view': 'RECENTER window.png',
  'reset-camera': 'reset_camera.png', 
  
  // Export and Save
  'copy-clipboard': 'COPY TO CLIPBOARD image.png',
  'save-render': 'SAVE RENDER general.png',
  'export-passes': 'render_passes_export.png',
  'background-image': 'Background.png',
  
  // Viewport Controls
  'viewport-resolution-lock': 'LOCK_RES-3 window.png',
  'lock-viewport': 'LOCK window.png',
  'unlock-viewport': 'UNLOCK window.png',
  
  // Object Manipulation (Gizmos)
  'object-control-alignment-world': 'GIZMO world mode.png',
  'object-control-alignment-local': 'GIZMO local mode.png',
  'object-control-alignment': 'GIZMO world mode.png', // Default to world
  'translate-gizmo': 'GIZMO move frame.png',
  'rotate-gizmo': 'GIZMO rotate frame.png',
  'scale-gizmo': 'GIZMO scale frame.png',
  'world-coordinate': 'GIZMO world indicator.png',
  
  // Render Priority
  'render-priority-low': 'PRIORITY low.png',
  'render-priority-normal': 'PRIORITY med.png',
  'render-priority-high': 'PRIORITY high.png',
  'render-priority': 'PRIORITY med.png', // Default
};

/**
 * Get icon path for a toolbar action
 * @param toolbarId Toolbar button ID
 * @returns path to icon file, or undefined if no mapping exists
 */
export function getToolbarIconPath(toolbarId: string): string | undefined {
  const iconFile = TOOLBAR_ICON_MAP[toolbarId];
  if (iconFile) {
    return `/icons/${iconFile}`;
  }
  return undefined;
}

/**
 * Check if a toolbar action has an icon mapping
 */
export function hasToolbarIcon(toolbarId: string): boolean {
  return toolbarId in TOOLBAR_ICON_MAP;
}
