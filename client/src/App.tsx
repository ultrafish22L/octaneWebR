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
import { requestQueue } from './utils/RequestQueue';
import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { OctaneProvider, useOctane } from './hooks/useOctane';
import { useEmitterEvent } from './hooks/useEmitterEvent';
import { useSceneStatusEvents } from './hooks/useSceneStatusEvents';
import { useViewportControls } from './hooks/useViewportControls';
import { useNodeGraphToolbar } from './hooks/useNodeGraphToolbar';
import { useRenderOutput } from './hooks/useRenderOutput';
import { usePanelLayout } from './hooks/usePanelLayout';
import { EditActionsProvider } from './contexts/EditActionsContext';
import { StatusMessageProvider, useStatusMessage } from './contexts/StatusMessageContext';
import { APP_VERSION } from './config/apiVersionConfig';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingFallback } from './components/LoadingFallback';
import { MenuBarMemoized as MenuBar } from './components/MenuBar';
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
  const { statusMessage } = useStatusMessage();

  // Scene state (stays in App — shared across outliner, inspector, graph)
  const [selectedNode, setSelectedNode] = useState<SceneNode | null>(null);
  const [sceneTree, setSceneTree] = useState<SceneNode[]>([]);
  const [sceneRefreshTrigger, setSceneRefreshTrigger] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [octaneInfo, setOctaneInfo] = useState('');

  const viewportRef = useRef<CallbackRenderViewportHandle>(null);

  // Guards: suppress auto-refresh from OnProjectManagerChanged during loadProject
  // or while a sync is already running. Concurrent gRPC calls crash Octane (BUG-R3-2).
  const isLoadingProjectRef = useRef(false);
  const isSyncingRef = useRef(false);

  // Extracted hooks
  useSceneStatusEvents(client);
  const viewport = useViewportControls();
  const nodeGraph = useNodeGraphToolbar();
  const renderOutput = useRenderOutput(client, viewportRef);
  const {
    panelVisibility,
    materialDatabaseVisible,
    panelSizes,
    handleSplitterMouseDown,
    containerRef,
    isDragging,
    handleTogglePanelVisibility,
    handleResetLayout,
    handleMaterialDatabaseOpen,
    handleMaterialDatabaseClose,
  } = usePanelLayout();

  // App-level event listeners (need selectedNode / sceneRefreshTrigger)
  useEmitterEvent(
    client,
    'nodeDeleted',
    useCallback((event: NodeDeletedEvent) => {
      Logger.debug('App: Node deleted event received:', event.handle);
      setSelectedNode(current => {
        if (current && current.handle === event.handle) {
          Logger.debug('Selected node was deleted - clearing selection');
          return null;
        }
        return current;
      });
    }, [])
  );

  useEmitterEvent(
    client,
    'OnProjectManagerChanged',
    useCallback((data: unknown) => {
      Logger.debug('Project manager changed:', data);
      if (isLoadingProjectRef.current) {
        Logger.debug('Suppressing auto-refresh — loadProject in progress');
        return;
      }
      if (isSyncingRef.current) {
        Logger.debug('Suppressing auto-refresh — sync already in progress');
        return;
      }
      setSceneRefreshTrigger(prev => prev + 1);
    }, [])
  );

  // Scene tree change handler — stable identity to prevent listener churn
  const handleSceneTreeChange = useCallback((tree: SceneNode[]) => {
    setSceneTree(tree);
    setSelectedNode(current => {
      if (!current || !current.handle) return current;
      const updatedNode = tree.find(n => n.handle === current.handle);
      return updatedNode && updatedNode !== current ? updatedNode : current;
    });
  }, []);

  const handleNodeSelect = useCallback(
    (node: SceneNode | null) => {
      setSelectedNode(node);
      // Activate render target in the render engine when selected
      if (node && node.type === 'PT_RENDERTARGET') {
        client.setRenderTargetNode(node.handle ?? null);
      }
    },
    [client]
  );

  const handleSyncStateChange = useCallback((syncing: boolean) => {
    isSyncingRef.current = syncing;
    setIsSyncing(syncing);
    Logger.debug(syncing ? 'Scene sync started...' : 'Scene sync complete');
  }, []);

  const handleSceneRefresh = useCallback(() => {
    // Cancel pending inspector queries before rebuilding the tree.
    // Stale getByAttrID calls running concurrently with tree build crash Octane (BUG-R3-2).
    requestQueue.clear();
    setSelectedNode(null);
    setSceneTree([]);
    setSceneRefreshTrigger(prev => prev + 1);
  }, []);

  const handleRecenterView = useCallback(() => {
    Logger.debug(' App.tsx: Recenter view requested');
    viewportRef.current?.recenterView();
  }, []);

  // Auto-connect on mount
  useEffect(() => {
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

  // Fetch Octane product info once connected
  useEffect(() => {
    if (!connected || !client) return;
    client.getOctaneInfo().then(info => {
      const parts: string[] = [];
      if (info.name) parts.push(info.name);
      if (info.isDemo) parts.push('Demo');
      else if (info.isSubscription) parts.push('Subscription');
      if (info.tier >= 0) parts.push(`Tier ${info.tier}`);
      setOctaneInfo(parts.join(' | '));
    });
  }, [connected, client]);

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
            isLoadingProjectRef={isLoadingProjectRef}
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
            </div>

            <div className="viewport-container">
              <ErrorBoundary>
                {connected ? (
                  <CallbackRenderViewport
                    ref={viewportRef}
                    showWorldCoord={viewport.showWorldCoord}
                    viewportLocked={viewport.viewportLocked}
                    pickingMode={viewport.pickingMode}
                    onExportPasses={renderOutput.handleExportPasses}
                    onSetBackgroundImage={viewport.handleSetBackgroundImage}
                    onToggleLockViewport={viewport.handleToggleLockViewport}
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
                onToggleWorldCoord={viewport.toggleWorldCoord}
                onCopyToClipboard={renderOutput.handleCopyToClipboard}
                onSaveRender={renderOutput.handleSaveRender}
                onExportPasses={renderOutput.handleExportPasses}
                onRecenterView={handleRecenterView}
                onViewportLockChange={viewport.handleViewportLockChange}
                onPickingModeChange={viewport.handlePickingModeChange}
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
                    gridVisible={nodeGraph.gridVisible}
                    setGridVisible={nodeGraph.setGridVisible}
                    snapToGrid={nodeGraph.snapToGrid}
                    setSnapToGrid={nodeGraph.setSnapToGrid}
                    onRecenterView={nodeGraph.recenterViewCallback || undefined}
                    onAutoLayout={nodeGraph.autoLayoutCallback || undefined}
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
                        gridVisible={nodeGraph.gridVisible}
                        setGridVisible={nodeGraph.setGridVisible}
                        snapToGrid={nodeGraph.snapToGrid}
                        setSnapToGrid={nodeGraph.setSnapToGrid}
                        onRecenterViewReady={nodeGraph.handleRecenterViewReady}
                        onAutoLayoutReady={nodeGraph.handleAutoLayoutReady}
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
        <div className="status-center">
          <span className="status-item">OctaneWebR v{APP_VERSION}</span>
        </div>
        <div className="status-right">
          {octaneInfo && <span className="status-item">{octaneInfo}</span>}
        </div>
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
      {renderOutput.saveRenderDialogProps && (
        <FileBrowserDialog {...renderOutput.saveRenderDialogProps} />
      )}

      {/* Export Passes File Browser */}
      {renderOutput.exportPassesDialogProps && (
        <FileBrowserDialog {...renderOutput.exportPassesDialogProps} />
      )}
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
