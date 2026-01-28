/**
 * Menu System Type Definitions
 */

export interface MenuItem {
  type?: 'item' | 'separator';
  label?: string;
  action?: string;
  shortcut?: string;
  icon?: string;
  enabled?: boolean;
  checked?: boolean;  // For toggle menu items (e.g., panel visibility)
  submenu?: MenuItem[];
  data?: any;
}

export interface MenuDefinition {
  [key: string]: MenuItem[];
}

export type MenuAction = 
  | 'file.new'
  | 'file.open'
  | 'file.openRecent'
  | 'file.clearRecent'
  | 'file.save'
  | 'file.saveAs'
  | 'file.saveAsPackage'
  | 'file.saveAsPackageSettings'
  | 'file.unpackPackage'
  | 'file.loadRenderState'
  | 'file.saveRenderState'
  | 'file.saveAsDefault'
  | 'file.preferences'
  | 'file.activationStatus'
  | 'file.quit'
  | 'edit.cut'
  | 'edit.copy'
  | 'edit.paste'
  | 'edit.group'
  | 'edit.ungroup'
  | 'edit.delete'
  | 'edit.find'
  | 'edit.undo'
  | 'edit.redo'
  | 'render.uploadSnapshot'
  | 'render.render'
  | 'render.openRenderNetwork'
  | 'render.openRenderNetworkExternal'
  | 'script.rescanFolder'
  | 'script.runLast'
  | 'script.batchRender'
  | 'script.daylightAnimation'
  | 'script.turntableAnimation'
  | 'view.renderViewport'
  | 'view.nodeInspector'
  | 'view.graphEditor'
  | 'view.sceneOutliner'
  | 'view.refresh'
  | 'window.resetWorkspace'
  | 'window.saveWorkspaceLayout'
  | 'window.loadWorkspaceLayout'
  | 'window.rescanLayoutFolder'
  | 'window.saveAsDefaultLayout'
  | 'window.loadDefaultLayout'
  | 'window.createLogWindow'
  | 'window.createGraphEditor'
  | 'window.createSceneViewport'
  | 'window.createSceneOutliner'
  | 'window.createSceneGraphExport'
  | 'window.createScriptEditor'
  | 'window.createOSLEditor'
  | 'window.createLuaAPIBrowser'
  | 'window.createUSDStageEditor'
  | 'help.docs'
  | 'help.crashReports'
  | 'help.about'
  | 'help.eula';

export interface MenuActionHandler {
  (action: MenuAction, data?: any): void | Promise<void>;
}
