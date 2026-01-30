/**
 * MenuBar Component
 * Main application menu bar with dropdowns and file operations
 */

import { Logger } from '../../utils/Logger';
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useFileDialog } from '../../hooks/useFileDialog';
import { useRecentFiles } from '../../hooks/useRecentFiles';
import { useOctane } from '../../hooks/useOctane';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useEditActions } from '../../contexts/EditActionsContext';
import { MenuDropdown } from './MenuDropdown';
import { KeyboardShortcutsDialog } from '../dialogs/KeyboardShortcutsDialog';
import { PreferencesDialog } from '../dialogs/PreferencesDialog';
import { BatchRenderingDialog } from '../dialogs/BatchRenderingDialog';
import { DaylightAnimationDialog } from '../dialogs/DaylightAnimationDialog';
import { TurntableAnimationDialog } from '../dialogs/TurntableAnimationDialog';
import { AboutDialog } from '../dialogs/AboutDialog';
import { SavePackageDialog } from '../dialogs/SavePackageDialog';
import { MenuAction, MenuItem, MenuDefinition } from './types';
import { commandHistory } from '../../services/CommandHistory';

interface PanelVisibility {
  renderViewport: boolean;
  nodeInspector: boolean;
  graphEditor: boolean;
  sceneOutliner: boolean;
}

/**
 * Build menu definitions with current state
 */
function getMenuDefinitions(
  recentFiles: string[] = [],
  _panelVisibility?: PanelVisibility
): MenuDefinition {
  // Build recent files submenu
  const recentFilesSubmenu: MenuItem[] =
    recentFiles.length > 0
      ? [
          ...recentFiles.map(path => ({
            label: path.split(/[\\\/]/).pop() || path,
            action: 'file.openRecent',
            data: path,
          })),
          { type: 'separator' as const },
          { label: 'Clear Recent', action: 'file.clearRecent' },
        ]
      : [{ label: '(No recent files)', enabled: false }];

  return {
    file: [
      { label: 'New', action: 'file.new', shortcut: 'Ctrl+N' },
      { label: 'Open...', action: 'file.open', shortcut: 'Ctrl+O' },
      {
        label: 'Recent projects',
        action: 'file.recent',
        submenu: recentFilesSubmenu,
      },
      { type: 'separator' },
      { label: 'Save', action: 'file.save', shortcut: 'Ctrl+S' },
      { label: 'Save as...', action: 'file.saveAs', shortcut: 'Ctrl+Shift+S' },
      { label: 'Save as package...', action: 'file.saveAsPackage' },
      {
        label: 'Save as package settings...',
        action: 'file.saveAsPackageSettings',
        enabled: false,
      },
      { label: 'Unpack package...', action: 'file.unpackPackage', enabled: false },
      { type: 'separator' },
      { label: 'Load render state...', action: 'file.loadRenderState', enabled: false },
      { label: 'Save render state...', action: 'file.saveRenderState', enabled: false },
      { type: 'separator' },
      { label: 'Save as default', action: 'file.saveAsDefault', enabled: false },
      { type: 'separator' },
      { label: 'Preferences...', action: 'file.preferences', shortcut: 'Ctrl+,' },
      { type: 'separator' },
      { label: 'Activation status...', action: 'file.activationStatus', enabled: false },
      { type: 'separator' },
      { label: 'Quit', action: 'file.quit', enabled: false },
    ],
    edit: [
      { label: 'Cut', action: 'edit.cut', shortcut: 'Ctrl+X' },
      { label: 'Copy', action: 'edit.copy', shortcut: 'Ctrl+C' },
      { label: 'Paste', action: 'edit.paste', shortcut: 'Ctrl+V', enabled: false },
      { type: 'separator' },
      { label: 'Group items', action: 'edit.group' },
      { label: 'Ungroup items', action: 'edit.ungroup' },
      { type: 'separator' },
      { label: 'Delete', action: 'edit.delete', shortcut: 'Del' },
      { type: 'separator' },
      { label: 'Find...', action: 'edit.find', shortcut: 'Ctrl+F' },
      { type: 'separator' },
      { label: 'Undo', action: 'edit.undo', shortcut: 'Ctrl+Z', enabled: false },
      { label: 'Redo', action: 'edit.redo', shortcut: 'Ctrl+Y', enabled: false },
    ],
    script: [
      { label: 'Rescan script folder', action: 'script.rescanFolder', enabled: false },
      {
        label: 'Run last script again',
        action: 'script.runLast',
        shortcut: 'Ctrl+Shift+R',
        enabled: false,
      },
      { type: 'separator' },
      { label: 'Batch rendering', action: 'script.batchRender', enabled: false },
      { label: 'Daylight animation', action: 'script.daylightAnimation', enabled: false },
      { label: 'Turntable animation', action: 'script.turntableAnimation', enabled: false },
    ],
    module: [{ label: 'No modules installed', enabled: false }],
    cloud: [
      { label: 'Upload scene snapshot', action: 'render.uploadSnapshot', enabled: false },
      { label: 'Render', action: 'render.render', enabled: false },
      { label: 'Open Render Network...', action: 'render.openRenderNetwork', enabled: false },
      {
        label: 'Open Render Network (external)...',
        action: 'render.openRenderNetworkExternal',
        enabled: false,
      },
    ],
    window: [
      { label: 'Reset workspace', action: 'window.resetWorkspace', enabled: false },
      { label: 'Save workspace layout...', action: 'window.saveWorkspaceLayout', enabled: false },
      { label: 'Load workspace layout...', action: 'window.loadWorkspaceLayout', enabled: false },
      { label: 'Rescan layout folder', action: 'window.rescanLayoutFolder', enabled: false },
      { label: 'Save as default layout', action: 'window.saveAsDefaultLayout', enabled: false },
      { label: 'Load default layout', action: 'window.loadDefaultLayout', enabled: false },
      { type: 'separator' },
      { label: 'Create log window', action: 'window.createLogWindow', enabled: false },
      { label: 'Create graph editor', action: 'window.createGraphEditor', enabled: false },
      { label: 'Create scene viewport', action: 'window.createSceneViewport', enabled: false },
      { label: 'Create scene outliner', action: 'window.createSceneOutliner', enabled: false },
      { type: 'separator' },
      {
        label: 'Create scene graph export',
        action: 'window.createSceneGraphExport',
        enabled: false,
      },
      { type: 'separator' },
      { label: 'Create script editor', action: 'window.createScriptEditor', enabled: false },
      { label: 'Create OSL editor', action: 'window.createOSLEditor', enabled: false },
      { label: 'Create Lua API browser', action: 'window.createLuaAPIBrowser', enabled: false },
      { label: 'Create USD stage editor', action: 'window.createUSDStageEditor', enabled: false },
    ],
    help: [
      { label: 'Open online manual...', action: 'help.docs', shortcut: 'F1' },
      { label: 'Manage crash reports ...', action: 'help.crashReports', enabled: false },
      { label: 'About OctaneRender...', action: 'help.about' },
      { label: 'Show EULA...', action: 'help.eula' },
    ],
  };
}

interface MenuBarProps {
  onSceneRefresh?: () => void;
  onMaterialDatabaseOpen?: () => void;
  panelVisibility?: PanelVisibility;
  onTogglePanelVisibility?: (
    panel: 'renderViewport' | 'nodeInspector' | 'graphEditor' | 'sceneOutliner'
  ) => void;
  onResetLayout?: () => void;
}

function MenuBar({
  onSceneRefresh,
  onMaterialDatabaseOpen,
  panelVisibility,
  onTogglePanelVisibility,
  onResetLayout,
}: MenuBarProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [activeMenuAnchor, setActiveMenuAnchor] = useState<HTMLElement | null>(null);
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  const [isPreferencesDialogOpen, setIsPreferencesDialogOpen] = useState(false);
  const [isBatchRenderingDialogOpen, setIsBatchRenderingDialogOpen] = useState(false);
  const [isDaylightAnimationDialogOpen, setIsDaylightAnimationDialogOpen] = useState(false);
  const [isTurntableAnimationDialogOpen, setIsTurntableAnimationDialogOpen] = useState(false);
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const [isSavePackageDialogOpen, setIsSavePackageDialogOpen] = useState(false);
  const menuBarRef = useRef<HTMLDivElement>(null);

  const { openFileDialog } = useFileDialog();
  const { recentFiles, addRecentFile, clearRecentFiles, getRecentFilePaths } = useRecentFiles();
  const { client, connected } = useOctane();
  const editActions = useEditActions();

  // Get menu definitions with current recent files and panel visibility
  const menuDefinitions = useMemo(() => {
    return getMenuDefinitions(getRecentFilePaths(), panelVisibility);
  }, [recentFiles, getRecentFilePaths, panelVisibility]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
        setActiveMenuAnchor(null);
      }
    };

    if (activeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeMenu]);

  const handleMenuClick = useCallback(
    (menuName: string, element: HTMLElement) => {
      if (activeMenu === menuName) {
        setActiveMenu(null);
        setActiveMenuAnchor(null);
      } else {
        setActiveMenu(menuName);
        setActiveMenuAnchor(element);
      }
    },
    [activeMenu]
  );

  const handleMenuMouseEnter = useCallback(
    (menuName: string, element: HTMLElement) => {
      if (activeMenu !== null) {
        setActiveMenu(menuName);
        setActiveMenuAnchor(element);
      }
    },
    [activeMenu]
  );

  const closeMenu = useCallback(() => {
    setActiveMenu(null);
    setActiveMenuAnchor(null);
  }, []);

  const showNotification = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      Logger.debug(`[${type.toUpperCase()}] ${message}`);
      // TODO: Implement toast notification system
    },
    []
  );

  const showWarnNotConnected = useCallback(
    (action: string) => {
      showNotification(`Cannot ${action}: Not connected to Octane`, 'error');
    },
    [showNotification]
  );

  // Menu action handlers
  const handleMenuAction = useCallback(
    async (action: MenuAction, data?: any) => {
      Logger.debug('🎯 Menu action:', action, data);
      closeMenu();

      switch (action) {
        // File menu actions
        case 'file.new':
          if (!connected) {
            showWarnNotConnected('create new scene');
            return;
          }
          try {
            const response = await client.callApi('ApiProjectManager', 'resetProject', {});
            if (response) {
              showNotification('New scene created', 'success');
              onSceneRefresh?.();
            }
          } catch (error) {
            Logger.error('Failed to create new scene:', error);
            showNotification('Failed to create new scene', 'error');
          }
          break;

        case 'file.open':
          {
            const files = await openFileDialog({
              accept: '.orbx',
              multiple: false,
            });
            if (files && files.length > 0) {
              const file = files[0];
              Logger.debug('Opening scene file:', file.name);

              if (!connected) {
                showWarnNotConnected('open scene');
                return;
              }

              try {
                // TODO: Implement scene file loading via Octane API
                // This requires reading the file and sending it to Octane
                const response = await client.callApi('ApiProjectManager', 'loadProject', {
                  path: file.name,
                });

                if (response) {
                  addRecentFile(file.name);
                  showNotification(`Loaded: ${file.name}`, 'success');
                  onSceneRefresh?.();
                }
              } catch (error) {
                Logger.error('Failed to open scene:', error);
                showNotification(`Failed to open ${file.name}`, 'error');
              }
            }
          }
          break;

        case 'file.openRecent':
          if (data) {
            Logger.debug('Opening recent file:', data);
            if (!connected) {
              showWarnNotConnected('open recent file');
              return;
            }
            try {
              const response = await client.callApi('ApiProjectManager', 'loadProject', {
                path: data,
              });
              if (response) {
                showNotification(`Loaded: ${data}`, 'success');
                onSceneRefresh?.();
              }
            } catch (error) {
              Logger.error('Failed to open recent file:', error);
              showNotification(`Failed to open ${data}`, 'error');
            }
          }
          break;

        case 'file.clearRecent':
          clearRecentFiles();
          showNotification('Recent files cleared', 'success');
          break;

        case 'file.save':
          if (!connected) {
            showWarnNotConnected('save scene');
            return;
          }
          try {
            const response = await client.callApi('ApiProjectManager', 'saveProject', {});
            if (response) {
              showNotification('Scene saved', 'success');
            }
          } catch (error) {
            Logger.error('Failed to save scene:', error);
            showNotification('Failed to save scene', 'error');
          }
          break;

        case 'file.saveAs':
          {
            const files = await openFileDialog({
              accept: '.orbx',
              multiple: false,
            });
            if (files && files.length > 0) {
              const filename = files[0].name;
              if (!connected) {
                showWarnNotConnected('save scene');
                return;
              }
              try {
                const response = await client.callApi('ApiProjectManager', 'saveProjectAs', {
                  path: filename,
                });
                if (response) {
                  addRecentFile(filename);
                  showNotification(`Saved as: ${filename}`, 'success');
                }
              } catch (error) {
                Logger.error('Failed to save scene as:', error);
                showNotification(`Failed to save as ${filename}`, 'error');
              }
            }
          }
          break;

        case 'file.saveAsPackage':
          setIsSavePackageDialogOpen(true);
          Logger.debug('📦 Opening Save as Package dialog');
          break;

        case 'file.saveAsDefault':
          if (!connected) {
            showWarnNotConnected('save default scene');
            return;
          }
          try {
            // Save current scene as default startup scene
            const defaultScenePath = 'default.ocs';
            const response = await client.callApi('ApiProjectManager', 'saveProjectAs', {
              path: defaultScenePath,
            });
            if (response && response.result) {
              // Store the default scene path in localStorage for future reference
              localStorage.setItem('octaneWebR_defaultScene', defaultScenePath);
              showNotification('Current scene saved as default', 'success');
              Logger.debug('✅ Default scene saved:', defaultScenePath);
            } else {
              showNotification('Failed to save default scene', 'error');
            }
          } catch (error) {
            Logger.error('Failed to save default scene:', error);
            showNotification('Failed to save default scene', 'error');
          }
          break;

        case 'file.preferences':
          setIsPreferencesDialogOpen(true);
          Logger.debug('🔧 Opening Preferences dialog');
          break;

        // Edit menu actions - delegated to active component via EditActionsContext
        case 'edit.cut':
          editActions.cut();
          break;

        case 'edit.copy':
          editActions.copy();
          break;

        case 'edit.paste':
          editActions.paste();
          break;

        case 'edit.group':
          editActions.group();
          break;

        case 'edit.ungroup':
          editActions.ungroup();
          break;

        case 'edit.delete':
          editActions.delete();
          break;

        case 'edit.find':
          editActions.find();
          break;

        case 'edit.undo':
          try {
            const undoDescription = commandHistory.getUndoDescription();
            const success = await commandHistory.undo();
            if (success) {
              showNotification(`Undone: ${undoDescription}`, 'success');
              Logger.debug('↶ Undo successful');
            } else {
              showNotification('Nothing to undo', 'info');
            }
          } catch (error) {
            Logger.error('Undo failed:', error);
            showNotification('Undo failed', 'error');
          }
          break;

        case 'edit.redo':
          try {
            const redoDescription = commandHistory.getRedoDescription();
            const success = await commandHistory.redo();
            if (success) {
              showNotification(`Redone: ${redoDescription}`, 'success');
              Logger.debug('↷ Redo successful');
            } else {
              showNotification('Nothing to redo', 'info');
            }
          } catch (error) {
            Logger.error('Redo failed:', error);
            showNotification('Redo failed', 'error');
          }
          break;

        // Script menu actions
        case 'script.rescanFolder':
          showNotification('Rescanning script folder...', 'info');
          Logger.debug('📂 Rescan script folder');
          break;

        case 'script.runLast':
          showNotification('Run last script not yet implemented', 'info');
          Logger.debug('▶️ Run last script again');
          break;

        case 'script.batchRender':
          setIsBatchRenderingDialogOpen(true);
          Logger.debug('🎬 Opening Batch Rendering dialog');
          break;

        case 'script.daylightAnimation':
          setIsDaylightAnimationDialogOpen(true);
          Logger.debug('☀️ Opening Daylight Animation dialog');
          break;

        case 'script.turntableAnimation':
          setIsTurntableAnimationDialogOpen(true);
          Logger.debug('🔄 Opening Turntable Animation dialog');
          break;

        // Cloud/Render menu actions
        case 'render.uploadSnapshot':
          showNotification('Upload scene snapshot not yet implemented', 'info');
          Logger.debug('☁️ Upload scene snapshot');
          break;

        case 'render.render':
          showNotification('Cloud render not yet implemented', 'info');
          Logger.debug('☁️ Cloud render');
          break;

        case 'render.openRenderNetwork':
          showNotification('Open Render Network not yet implemented', 'info');
          Logger.debug('🌐 Open Render Network');
          break;

        case 'render.openRenderNetworkExternal':
          showNotification('Open Render Network (external) not yet implemented', 'info');
          Logger.debug('🌐 Open Render Network (external)');
          break;

        // View menu actions
        case 'view.renderViewport':
          onTogglePanelVisibility?.('renderViewport');
          Logger.debug('👁️ Toggled Render Viewport visibility');
          break;

        case 'view.nodeInspector':
          onTogglePanelVisibility?.('nodeInspector');
          Logger.debug('👁️ Toggled Node Inspector visibility');
          break;

        case 'view.graphEditor':
          onTogglePanelVisibility?.('graphEditor');
          Logger.debug('👁️ Toggled Graph Editor visibility');
          break;

        case 'view.sceneOutliner':
          onTogglePanelVisibility?.('sceneOutliner');
          Logger.debug('👁️ Toggled Scene Outliner visibility');
          break;

        // Window menu actions
        case 'window.resetWorkspace':
          onResetLayout?.();
          showNotification('Workspace reset to defaults', 'success');
          break;

        case 'view.refresh':
          onSceneRefresh?.();
          showNotification('Scene refreshed', 'success');
          break;

        // Help menu actions
        case 'help.docs':
          window.open('https://docs.otoy.com/standaloneSE/CoverPage.html', '_blank');
          Logger.debug('📖 Opening online manual');
          break;

        case 'help.crashReports':
          showNotification('Crash reports management not yet implemented', 'info');
          Logger.debug('📊 Crash reports management');
          break;

        case 'help.about':
          setIsAboutDialogOpen(true);
          Logger.debug('ℹ️ Opening About dialog');
          break;

        case 'help.eula':
          window.open('/eula.pdf', '_blank');
          Logger.debug('📄 Opening EULA PDF');
          break;

        default:
          Logger.warn('Menu action not yet implemented:', action);
          showNotification(`Action "${action}" not yet implemented`, 'info');
      }
    },
    [
      client,
      connected,
      openFileDialog,
      addRecentFile,
      clearRecentFiles,
      showWarnNotConnected,
      showNotification,
      closeMenu,
      onSceneRefresh,
      onMaterialDatabaseOpen,
      onTogglePanelVisibility,
      onResetLayout,
    ]
  );

  // Global keyboard shortcuts for file and edit operations
  const keyboardShortcuts = useMemo(
    () => [
      {
        key: 'n',
        ctrl: true,
        description: 'New scene',
        handler: () => handleMenuAction('file.new'),
      },
      {
        key: 'o',
        ctrl: true,
        description: 'Open scene',
        handler: () => handleMenuAction('file.open'),
      },
      {
        key: 's',
        ctrl: true,
        description: 'Save scene',
        handler: () => handleMenuAction('file.save'),
      },
      {
        key: 's',
        ctrl: true,
        shift: true,
        description: 'Save scene as',
        handler: () => handleMenuAction('file.saveAs'),
      },
      {
        key: ',',
        ctrl: true,
        description: 'Open preferences',
        handler: () => handleMenuAction('file.preferences'),
      },
      {
        key: 'x',
        ctrl: true,
        description: 'Cut',
        handler: () => handleMenuAction('edit.cut'),
      },
      {
        key: 'c',
        ctrl: true,
        description: 'Copy',
        handler: () => handleMenuAction('edit.copy'),
      },
      {
        key: 'v',
        ctrl: true,
        description: 'Paste',
        handler: () => handleMenuAction('edit.paste'),
      },
      {
        key: 'Delete',
        description: 'Delete',
        handler: () => handleMenuAction('edit.delete'),
      },
      {
        key: 'f',
        ctrl: true,
        description: 'Find',
        handler: () => handleMenuAction('edit.find'),
      },
      // Undo/Redo disabled - not yet integrated with Octane
      // {
      //   key: 'z',
      //   ctrl: true,
      //   description: 'Undo',
      //   handler: () => handleMenuAction('edit.undo')
      // },
      // {
      //   key: 'y',
      //   ctrl: true,
      //   description: 'Redo',
      //   handler: () => handleMenuAction('edit.redo')
      // },
      {
        key: 'r',
        ctrl: true,
        shift: true,
        description: 'Run last script again',
        handler: () => handleMenuAction('script.runLast'),
      },
      {
        key: 'F5',
        description: 'Refresh scene',
        handler: () => handleMenuAction('view.refresh'),
      },
      {
        key: 'F1',
        description: 'Open documentation',
        handler: () => handleMenuAction('help.docs'),
      },
      {
        key: 'F11',
        description: 'Toggle fullscreen',
        handler: () => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
              Logger.error('Failed to enter fullscreen:', err);
            });
          } else {
            document.exitFullscreen();
          }
        },
      },
    ],
    [handleMenuAction]
  );

  // Register keyboard shortcuts
  useKeyboardShortcuts(keyboardShortcuts);

  const menuItems = ['file', 'edit', 'script', 'module', 'cloud', 'window', 'help'];

  return (
    <nav ref={menuBarRef} className="main-menu">
      {menuItems.map(menuName => (
        <div
          key={menuName}
          className={`menu-item ${activeMenu === menuName ? 'active' : ''}`}
          data-menu={menuName}
          onClick={e => handleMenuClick(menuName, e.currentTarget)}
          onMouseEnter={e => handleMenuMouseEnter(menuName, e.currentTarget)}
        >
          {menuName.charAt(0).toUpperCase() + menuName.slice(1)}
        </div>
      ))}

      {/* Render active dropdown */}
      {activeMenu && activeMenuAnchor && menuDefinitions[activeMenu] && (
        <MenuDropdown
          items={menuDefinitions[activeMenu]}
          anchorElement={activeMenuAnchor}
          onItemClick={handleMenuAction}
          onClose={closeMenu}
        />
      )}

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        isOpen={isShortcutsDialogOpen}
        onClose={() => setIsShortcutsDialogOpen(false)}
      />

      {/* Preferences Dialog */}
      <PreferencesDialog
        isOpen={isPreferencesDialogOpen}
        onClose={() => setIsPreferencesDialogOpen(false)}
      />

      {/* Batch Rendering Dialog */}
      <BatchRenderingDialog
        isOpen={isBatchRenderingDialogOpen}
        onClose={() => setIsBatchRenderingDialogOpen(false)}
      />

      {/* Daylight Animation Dialog */}
      <DaylightAnimationDialog
        isOpen={isDaylightAnimationDialogOpen}
        onClose={() => setIsDaylightAnimationDialogOpen(false)}
      />

      {/* Turntable Animation Dialog */}
      <TurntableAnimationDialog
        isOpen={isTurntableAnimationDialogOpen}
        onClose={() => setIsTurntableAnimationDialogOpen(false)}
      />

      {/* About Dialog */}
      <AboutDialog isOpen={isAboutDialogOpen} onClose={() => setIsAboutDialogOpen(false)} />

      {/* Save Package Dialog */}
      <SavePackageDialog
        isOpen={isSavePackageDialogOpen}
        onClose={() => setIsSavePackageDialogOpen(false)}
      />
    </nav>
  );
}

export const MenuBarMemoized = React.memo(MenuBar);
export { MenuBarMemoized as MenuBar };
