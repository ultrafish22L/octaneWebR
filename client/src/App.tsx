/**
 * OctaneWebR - React TypeScript Main Application
 * Port of octaneWeb with identical UI and functionality
 *
 * Layout Structure (matching octaneWeb exactly):
 * - Menu Bar (top)
 * - App Layout (5-column x 3-row grid):
 *   - Column 1 (full height): Scene Outliner
 *   - Column 2 (full height): Left vertical splitter
 *   - Column 3 (2 rows): Render Viewport (top) + horizontal splitter + Node Graph Editor (bottom)
 *   - Column 4 (full height): Right vertical splitter
 *   - Column 5 (full height): Node Inspector
 * - Status Bar (bottom)
 */

import { Logger } from './utils/Logger';
import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { OctaneProvider, useOctane } from './hooks/useOctane';
import { useResizablePanels } from './hooks/useResizablePanels';
import { EditActionsProvider } from './contexts/EditActionsContext';
import { StatusMessageProvider, useStatusMessage } from './contexts/StatusMessageContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingFallback } from './components/LoadingFallback';
import { MenuBar } from './components/MenuBar';
import { ConnectionStatus } from './components/ConnectionStatus';
import { SyncIndicator } from './components/SyncIndicator';
import {
  CallbackRenderViewport,
  CallbackRenderViewportHandle,
} from './components/CallbackRenderViewport';
import { RenderToolbar } from './components/RenderToolbar';
import { SceneOutliner } from './components/SceneOutliner';
import { NodeInspector } from './components/NodeInspector';
import { NodeInspectorControls } from './components/NodeInspector/NodeInspectorControls';
import { NodeGraphToolbar } from './components/NodeGraph/NodeGraphToolbar';
import { FileBrowserDialog } from './components/dialogs/FileBrowserDialog';
import { useFileBrowser } from './hooks/useFileBrowser';
import { SceneNode, NodeDeletedEvent } from './services/OctaneClient';
import './styles/error-boundary.css';

// Lazy load heavy components
const LazyNodeGraphEditor = lazy(() =>
  import('./components/NodeGraph/index').then(module => ({ default: module.NodeGraphEditor }))
);
const LazyMaterialDatabase = lazy(() =>
  import('./components/MaterialDatabase/index').then(module => ({
    default: module.MaterialDatabase,
  }))
);

function AppContent() {
  const { client, connect, connected } = useOctane();
  const { statusMessage, setStatusMessage, setTemporaryStatus } = useStatusMessage();
  const [selectedNode, setSelectedNode] = useState<SceneNode | null>(null);
  const [sceneTree, setSceneTree] = useState<SceneNode[]>([]);
  const [sceneRefreshTrigger, setSceneRefreshTrigger] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showWorldCoord, setShowWorldCoord] = useState(true); // Display world coordinate axis
  const [viewportLocked, setViewportLocked] = useState(false); // Lock viewport controls
  const [pickingMode, setPickingMode] = useState<
    | 'none'
    | 'focus'
    | 'whiteBalance'
    | 'material'
    | 'object'
    | 'cameraTarget'
    | 'renderRegion'
    | 'filmRegion'
  >('none');
  const [materialDatabaseVisible, setMaterialDatabaseVisible] = useState(false);
  const [exportFormat, setExportFormat] = useState<'PNG' | 'JPG' | 'EXR' | 'TIFF'>('PNG');

  // Panel visibility state
  const [panelVisibility, setPanelVisibility] = useState({
    renderViewport: true,
    nodeInspector: true,
    graphEditor: true,
    sceneOutliner: true,
  });

  // Node Graph Editor toolbar state (Figure 10 buttons)
  const [gridVisible, setGridVisible] = useState(false); // Grid off by default
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [recenterViewCallback, setRecenterViewCallback] = useState<(() => void) | null>(null);
  const [autoLayoutCallback, setAutoLayoutCallback] = useState<(() => void) | null>(null);

  const { panelSizes, handleSplitterMouseDown, containerRef, isDragging, resetPanelSizes } =
    useResizablePanels();
  const viewportRef = useRef<CallbackRenderViewportHandle>(null);
  const exportFormatRef = useRef(exportFormat);
  useEffect(() => {
    exportFormatRef.current = exportFormat;
  }, [exportFormat]);
  const renderPathRef = useRef<string>('');

  // Save render file browser (shares path memory with export passes)
  const { browse: browseSaveRender, dialogProps: saveRenderDialogProps } = useFileBrowser(
    useCallback(
      (path: string | null) => {
        if (!path) return;
        // Infer format from extension
        const ext = path.split('.').pop()?.toLowerCase() || '';
        const formatMap: Record<string, 'PNG' | 'JPG' | 'EXR' | 'TIFF'> = {
          png: 'PNG',
          jpg: 'JPG',
          jpeg: 'JPG',
          exr: 'EXR',
          tiff: 'TIFF',
          tif: 'TIFF',
        };
        const format = formatMap[ext] || 'PNG';
        Logger.debug(`Saving render: ${path} (format: ${format})`);
        client.saveRender(path, format, 0);
      },
      [client]
    ),
    renderPathRef
  );

  // Export passes file browser (shares path memory with save render)
  const { browse: browseExportPasses, dialogProps: exportPassesDialogProps } = useFileBrowser(
    useCallback(
      (path: string | null) => {
        if (!path) return;
        // Strip extension to get base path — exportRenderPasses appends _passname.ext
        const dotIdx = path.lastIndexOf('.');
        const basePath = dotIdx > 0 ? path.slice(0, dotIdx) : path;
        Logger.debug(`Exporting render passes: ${basePath} (format: ${exportFormatRef.current})`);
        client.exportRenderPasses(basePath, exportFormatRef.current);
      },
      [client]
    ),
    renderPathRef
  );

  // Scene tree change handler — stable identity (useCallback) to prevent listener churn
  // in useSceneTree's event registration useEffect.
  const handleSceneTreeChange = useCallback((tree: SceneNode[]) => {
    setSceneTree(tree);
    // Use functional updater to avoid capturing selectedNode in closure
    setSelectedNode(current => {
      if (!current || !current.handle) return current;
      const updatedNode = tree.find(n => n.handle === current.handle);
      return updatedNode && updatedNode !== current ? updatedNode : current;
    });
  }, []);

  // Node selection handler.
  // Wrapped in useCallback so downstream useEffects don't re-register on every render.
  const handleNodeSelect = useCallback((node: SceneNode | null) => {
    setSelectedNode(node);
  }, []);

  // Stable callback handlers for LazyNodeGraphEditor
  const handleRecenterViewReady = useCallback(
    (cb: (() => void) | null) => setRecenterViewCallback(() => cb),
    []
  );
  const handleAutoLayoutReady = useCallback(
    (cb: (() => void) | null) => setAutoLayoutCallback(() => cb),
    []
  );

  // Scene sync state handler
  const handleSyncStateChange = (syncing: boolean) => {
    setIsSyncing(syncing);
    Logger.debug(syncing ? 'Scene sync started...' : 'Scene sync complete');
  };

  // Scene refresh handler for MenuBar
  const handleSceneRefresh = () => {
    setSceneRefreshTrigger(prev => prev + 1);
  };

  // Copy render to clipboard handler
  const handleCopyToClipboard = async () => {
    if (!viewportRef.current) {
      Logger.warn('Viewport not available for clipboard copy');
      return;
    }

    try {
      await viewportRef.current.copyToClipboard();
      setTemporaryStatus('Render copied to clipboard', 2000);
    } catch (error) {
      Logger.error('Failed to copy to clipboard:', error);
      setTemporaryStatus('Failed to copy render to clipboard', 3000);
    }
  };

  // Save render to disk handler - opens file browser for save location
  const handleSaveRender = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    browseSaveRender({
      mode: 'save',
      title: 'Save Render',
      filePatterns: '*.png;*.jpg;*.exr;*.tiff',
      defaultFilename: `octane-render-${timestamp}.png`,
    });
  };

  // Export render passes handler - opens file browser for save-style selection
  const handleExportPasses = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    browseExportPasses({
      mode: 'save',
      title: 'Export Render Passes',
      filePatterns: '*.png;*.jpg;*.exr;*.tiff',
      defaultFilename: `render-passes-${timestamp}`,
      extraContent: (
        <div className="form-group" style={{ padding: '0 12px' }}>
          <label htmlFor="export-format">Format:</label>
          <select
            id="export-format"
            className="form-control"
            value={exportFormat}
            onChange={e => setExportFormat(e.target.value as 'PNG' | 'JPG' | 'EXR' | 'TIFF')}
            name="export-format"
          >
            <option value="PNG">PNG</option>
            <option value="JPG">JPG</option>
            <option value="EXR">EXR</option>
            <option value="TIFF">TIFF</option>
          </select>
        </div>
      ),
    });
  };

  // Viewport lock change handler
  const handleViewportLockChange = (locked: boolean) => {
    setViewportLocked(locked);
    Logger.debug(`App.tsx: Viewport lock ${locked ? 'enabled' : 'disabled'}`);
  };

  // Toggle viewport lock handler (for context menu)
  const handleToggleLockViewport = () => {
    setViewportLocked(prev => {
      Logger.debug(`App.tsx: Viewport lock toggled to ${!prev ? 'enabled' : 'disabled'}`);
      return !prev;
    });
  };

  // Set background image handler (for context menu)
  const handleSetBackgroundImage = () => {
    Logger.debug('Set Background Image - TODO: Implement file picker');
    // TODO: Implement file picker and set background image
    Logger.warn(
      'Set Background Image: Feature coming soon! This will allow you to set a background image visible through alpha channel.'
    );
  };

  // Picking mode change handler
  const handlePickingModeChange = (
    mode:
      | 'none'
      | 'focus'
      | 'whiteBalance'
      | 'material'
      | 'object'
      | 'cameraTarget'
      | 'renderRegion'
      | 'filmRegion'
  ) => {
    setPickingMode(mode);
    Logger.debug(`App.tsx: Picking mode changed to: ${mode}`);
  };

  // Recenter view handler - resets 2D canvas pan/zoom
  const handleRecenterView = () => {
    Logger.debug(' App.tsx: Recenter view requested');
    viewportRef.current?.recenterView();
  };

  // Material Database handlers
  const handleMaterialDatabaseOpen = () => {
    Logger.debug('Opening Material Database');
    setMaterialDatabaseVisible(true);
  };

  const handleMaterialDatabaseClose = () => {
    Logger.debug('Closing Material Database');
    setMaterialDatabaseVisible(false);
  };

  // Panel visibility toggle handler
  const handleTogglePanelVisibility = (
    panel: 'renderViewport' | 'nodeInspector' | 'graphEditor' | 'sceneOutliner'
  ) => {
    setPanelVisibility(prev => ({
      ...prev,
      [panel]: !prev[panel],
    }));
    Logger.debug(`Toggled ${panel} visibility`);
  };

  // Reset layout handler - resets all panels to visible and default sizes
  const handleResetLayout = () => {
    Logger.debug('↺ Resetting layout to defaults');

    // Reset all panels to visible
    setPanelVisibility({
      renderViewport: true,
      nodeInspector: true,
      graphEditor: true,
      sceneOutliner: true,
    });

    // Reset panel sizes to defaults
    resetPanelSizes();
  };

  useEffect(() => {
    // Auto-connect on mount
    Logger.debug('OctaneWebR starting...');

    connect()
      .then(success => {
        if (success) {
          Logger.debug('Auto-connected to server');
        } else {
          Logger.debug('Could not connect to server');
        }
      })
      .catch(error => {
        Logger.error('App.tsx: connect() threw error:', error);
      });
  }, [connect]);

  // Global context menu prevention (safety net)
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // Listen for node deletion events
  useEffect(() => {
    if (!client) return;

    const handleNodeDeleted = (event: NodeDeletedEvent) => {
      Logger.debug('App: Node deleted event received:', event.handle);

      // If selected node was deleted, clear selection (Node Inspector behavior)
      setSelectedNode(current => {
        if (current && current.handle === event.handle) {
          Logger.debug('Selected node was deleted - clearing selection');
          return null;
        }
        return current;
      });
    };

    const handleRenderFailure = (data: unknown) => {
      Logger.error('Render failure detected:', data);
      setTemporaryStatus('Render failed — check Octane console', 5000);
    };

    const handleProjectManagerChanged = (data: unknown) => {
      Logger.debug('Project manager changed:', data);
      // Refresh scene tree when project changes
      setSceneRefreshTrigger(prev => prev + 1);
    };

    // Listen for node deletion (emitted by deleteNodeOptimized)
    // NOTE: nodeAdded is handled by SceneOutliner, which propagates via onSceneTreeChange
    client.on('nodeDeleted', handleNodeDeleted);
    client.on('OnRenderFailure', handleRenderFailure);
    client.on('OnProjectManagerChanged', handleProjectManagerChanged);

    Logger.debug(
      'Listening for callback events (nodeDeleted, OnRenderFailure, OnProjectManagerChanged)'
    );

    // Cleanup listener on unmount
    return () => {
      client.off('nodeDeleted', handleNodeDeleted);
      client.off('OnRenderFailure', handleRenderFailure);
      client.off('OnProjectManagerChanged', handleProjectManagerChanged);
      Logger.debug('Stopped listening for callback events');
    };
  }, [client, setTemporaryStatus]);

  // Listen for scene build events and update status bar
  useEffect(() => {
    if (!client) return;

    const handleBuildStart = () => {
      setStatusMessage('Building scene tree...');
    };

    const handleBuildProgress = (data: { step?: string; message?: string; progress?: number }) => {
      // Support both traditional and progressive progress events
      const message = data.message || data.step || 'Loading scene...';
      const progressText = data.progress !== undefined ? ` (${Math.round(data.progress)}%)` : '';
      setStatusMessage(`Building scene: ${message}${progressText}`);
    };

    const handleBuildComplete = (data: {
      nodeCount: number;
      topLevelCount: number;
      elapsedTime: string;
    }) => {
      setTemporaryStatus(
        `Scene loaded: ${data.nodeCount} nodes (${data.topLevelCount} top-level) in ${data.elapsedTime}s`,
        5000
      );
    };

    const handleNodeAdded = () => {
      setTemporaryStatus('Node created', 2000);
    };

    const handleNodeDeletedStatus = () => {
      setTemporaryStatus('Node deleted', 2000);
    };

    const handleConnectionChanged = (connectionData: { connected: boolean }) => {
      if (connectionData.connected) {
        setTemporaryStatus('Connected to Octane', 3000);
      } else {
        setStatusMessage('Disconnected from Octane');
      }
    };

    client.on('scene:buildStart', handleBuildStart);
    client.on('scene:buildProgress', handleBuildProgress);
    client.on('scene:buildComplete', handleBuildComplete);
    client.on('nodeAdded', handleNodeAdded);
    client.on('nodeDeleted', handleNodeDeletedStatus);
    client.on('connection:changed', handleConnectionChanged);

    const handleLevel0Complete = (data: { nodes?: SceneNode[] }) => {
      setTemporaryStatus(`Structure loaded: ${data.nodes?.length || 0} nodes`, 2000);
    };
    client.on('scene:level0Complete', handleLevel0Complete);

    // Surface service-layer errors in the status bar
    const handleUserError = (message: string) => {
      setTemporaryStatus(message, 5000);
    };
    client.on('status:error', handleUserError);

    return () => {
      client.off('scene:buildStart', handleBuildStart);
      client.off('scene:buildProgress', handleBuildProgress);
      client.off('scene:buildComplete', handleBuildComplete);
      client.off('nodeAdded', handleNodeAdded);
      client.off('nodeDeleted', handleNodeDeletedStatus);
      client.off('connection:changed', handleConnectionChanged);
      client.off('scene:level0Complete', handleLevel0Complete);
      client.off('status:error', handleUserError);
    };
  }, [client, setStatusMessage, setTemporaryStatus]);

  return (
    <div className="app-container">
      {/* Top Menu Bar */}
      <header className="menu-bar">
        <ErrorBoundary>
          <MenuBar
            onSceneRefresh={handleSceneRefresh}
            onMaterialDatabaseOpen={handleMaterialDatabaseOpen}
            panelVisibility={panelVisibility}
            onTogglePanelVisibility={handleTogglePanelVisibility}
            onResetLayout={handleResetLayout}
          />
        </ErrorBoundary>

        {/* Sync Indicator & Connection Status */}
        <div className="header-indicators">
          <SyncIndicator syncing={isSyncing} />
          <ConnectionStatus />
        </div>
      </header>

      {/* Main Application Layout */}
      <main
        ref={containerRef}
        className={`app-layout ${isDragging ? 'resizing' : ''}`}
        style={{
          gridTemplateColumns:
            panelVisibility.sceneOutliner && panelVisibility.nodeInspector
              ? `${panelSizes.left}px 4px 1fr 4px ${panelSizes.right}px`
              : panelVisibility.sceneOutliner
                ? `${panelSizes.left}px 4px 1fr`
                : panelVisibility.nodeInspector
                  ? `1fr 4px ${panelSizes.right}px`
                  : '1fr',
          gridTemplateRows:
            panelVisibility.renderViewport && panelVisibility.graphEditor
              ? `${panelSizes.top}px 4px 1fr`
              : panelVisibility.renderViewport
                ? '1fr'
                : panelVisibility.graphEditor
                  ? '1fr'
                  : '1fr',
        }}
      >
        {/* Left Panel: Scene Outliner - spans ALL rows (full height to bottom) */}
        {panelVisibility.sceneOutliner && (
          <>
            <aside className="left-panel panel" style={{ gridRow: '1 / -1' }}>
              <div className="panel-header">
                <h3>Scene outliner</h3>
              </div>
              <div className="panel-content">
                <ErrorBoundary>
                  <SceneOutliner
                    key={sceneRefreshTrigger}
                    selectedNode={selectedNode}
                    onNodeSelect={handleNodeSelect}
                    onSceneTreeChange={handleSceneTreeChange}
                    onSyncStateChange={handleSyncStateChange}
                  />
                </ErrorBoundary>
              </div>
            </aside>

            {/* Left Splitter - spans ALL rows (full height) */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
            <div
              role="separator"
              aria-label="Resize scene outliner panel"
              className="panel-splitter vertical left-splitter"
              onMouseDown={() => handleSplitterMouseDown('left')}
              style={{ gridRow: '1 / -1' }}
            />
          </>
        )}

        {/* Center Panel: Render Viewport - ROW 1, COLUMN 3 (top section of center column) */}
        {panelVisibility.renderViewport && (
          <section className="center-panel" style={{ gridColumn: '3 / 4', gridRow: '1 / 2' }}>
            <div className="viewport-header">
              <div className="viewport-title">Render viewport - Render target @ 100%</div>
              <div className="viewport-controls">
                <button className="viewport-btn" title="Fit to Window">
                  ⊞
                </button>
                <button className="viewport-btn" title="Actual Size">
                  1:1
                </button>
                <button className="viewport-btn" title="Zoom In">
                  +
                </button>
                <button className="viewport-btn" title="Zoom Out">
                  -
                </button>
              </div>
            </div>

            <div className="viewport-container">
              <ErrorBoundary>
                {connected ? (
                  <CallbackRenderViewport
                    ref={viewportRef}
                    showWorldCoord={showWorldCoord}
                    viewportLocked={viewportLocked}
                    pickingMode={pickingMode}
                    onExportPasses={handleExportPasses}
                    onSetBackgroundImage={handleSetBackgroundImage}
                    onToggleLockViewport={handleToggleLockViewport}
                  />
                ) : (
                  <div className="viewport-overlay">
                    <div className="viewport-info">
                      <h2>Connecting to Octane...</h2>
                      <p>Ensure Octane LiveLink is enabled (Help → LiveLink)</p>
                    </div>
                  </div>
                )}
              </ErrorBoundary>
            </div>

            {/* Render Toolbar - Official Octane viewport controls */}
            <ErrorBoundary>
              <RenderToolbar
                onToggleWorldCoord={() => setShowWorldCoord(!showWorldCoord)}
                onCopyToClipboard={handleCopyToClipboard}
                onSaveRender={handleSaveRender}
                onExportPasses={handleExportPasses}
                onRecenterView={handleRecenterView}
                onViewportLockChange={handleViewportLockChange}
                onPickingModeChange={handlePickingModeChange}
              />
            </ErrorBoundary>
          </section>
        )}

        {/* Center-Right Splitter & Right Panel: Node Inspector - spans ALL rows (full height) */}
        {panelVisibility.nodeInspector && (
          <>
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
            <div
              role="separator"
              aria-label="Resize node inspector panel"
              className="panel-splitter vertical center-right-splitter"
              onMouseDown={() => handleSplitterMouseDown('right')}
              style={{ gridRow: '1 / -1' }}
            />

            <aside className="right-panel panel" style={{ gridRow: '1 / -1' }}>
              <div className="panel-header">
                <h3>Node inspector</h3>
              </div>
              <div className="panel-content">
                <ErrorBoundary>
                  <div className="node-inspector-layout">
                    <NodeInspectorControls sceneTree={sceneTree} onNodeSelect={handleNodeSelect} />
                    <div className="node-inspector-main">
                      <NodeInspector node={selectedNode} />
                    </div>
                  </div>
                </ErrorBoundary>
              </div>
            </aside>
          </>
        )}

        {/* Horizontal Splitter & Bottom Panel: Node Graph Editor - ROW 2 & 3, COLUMN 3 ONLY */}
        {panelVisibility.graphEditor && (
          <>
            {panelVisibility.renderViewport && (
              // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
              <div
                role="separator"
                aria-label="Resize viewport and node graph panels"
                className="panel-splitter horizontal top-bottom-splitter"
                onMouseDown={() => handleSplitterMouseDown('top')}
                style={{ gridColumn: '3 / 4' }}
              />
            )}

            <section className="bottom-panel panel" style={{ gridColumn: '3 / 4' }}>
              <div className="node-graph-header">
                <h3>Node graph editor</h3>
              </div>
              <div className="node-graph-container">
                {/* Node Graph Toolbar - Figure 10 vertical buttons, docked left */}
                <ErrorBoundary>
                  <NodeGraphToolbar
                    gridVisible={gridVisible}
                    setGridVisible={setGridVisible}
                    snapToGrid={snapToGrid}
                    setSnapToGrid={setSnapToGrid}
                    onRecenterView={recenterViewCallback || undefined}
                    onAutoLayout={autoLayoutCallback || undefined}
                  />
                </ErrorBoundary>
                <div className="node-graph-tabgraph">
                  {/* Node Graph Tabs */}
                  <div className="node-graph-tabs">
                    <button className="node-graph-tab active" title="Scene node graph">
                      Scene
                    </button>
                  </div>
                  {/* Node Graph Toolbar - Figure 10 vertical buttons, docked left */}
                  <ErrorBoundary>
                    <Suspense fallback={<LoadingFallback name="Node Graph" />}>
                      <LazyNodeGraphEditor
                        sceneTree={sceneTree}
                        selectedNode={selectedNode}
                        onNodeSelect={handleNodeSelect}
                        gridVisible={gridVisible}
                        setGridVisible={setGridVisible}
                        snapToGrid={snapToGrid}
                        setSnapToGrid={setSnapToGrid}
                        onRecenterViewReady={handleRecenterViewReady}
                        onAutoLayoutReady={handleAutoLayoutReady}
                      />
                    </Suspense>
                  </ErrorBoundary>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Status Bar */}
      <footer className="status-bar">
        <div className="status-left">
          <span className="status-item">{statusMessage}</span>
        </div>
        <div className="status-center"></div>
        <div className="status-right"></div>
      </footer>

      {/* Material Database Modal */}
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback name="Material Database" />}>
          <LazyMaterialDatabase
            visible={materialDatabaseVisible}
            onClose={handleMaterialDatabaseClose}
          />
        </Suspense>
      </ErrorBoundary>

      {/* Save Render File Browser */}
      {saveRenderDialogProps && <FileBrowserDialog {...saveRenderDialogProps} />}

      {/* Export Passes File Browser */}
      {exportPassesDialogProps && <FileBrowserDialog {...exportPassesDialogProps} />}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <OctaneProvider>
        <StatusMessageProvider>
          <EditActionsProvider>
            <AppContent />
          </EditActionsProvider>
        </StatusMessageProvider>
      </OctaneProvider>
      {/* React Query DevTools - only included in development builds */}
    </QueryClientProvider>
  );
}

export default App;
