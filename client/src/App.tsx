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
import { useEffect, useState, useRef } from 'react';
import { OctaneProvider, useOctane } from './hooks/useOctane';
import { useResizablePanels } from './hooks/useResizablePanels';
import { EditActionsProvider } from './contexts/EditActionsContext';
import { MenuBar } from './components/MenuBar';
import { ConnectionStatus } from './components/ConnectionStatus';
import { CallbackRenderViewport, CallbackRenderViewportHandle } from './components/CallbackRenderViewport';
import { RenderToolbar } from './components/RenderToolbar';
import { SceneOutliner } from './components/SceneOutliner';
import { NodeInspector } from './components/NodeInspector';
import { NodeInspectorControls } from './components/NodeInspector/NodeInspectorControls';
import { NodeGraphEditor } from './components/NodeGraph';
import { NodeGraphToolbar } from './components/NodeGraph/NodeGraphToolbar';
import { MaterialDatabase } from './components/MaterialDatabase';
import { SaveRenderDialog } from './components/dialogs/SaveRenderDialog';
import { ExportPassesDialog } from './components/dialogs/ExportPassesDialog';
import { SceneNode, NodeDeletedEvent } from './services/OctaneClient';

function AppContent() {
  const { client, connect, connected } = useOctane();
  const [selectedNode, setSelectedNode] = useState<SceneNode | null>(null);
  const [sceneTree, setSceneTree] = useState<SceneNode[]>([]);
  const [sceneRefreshTrigger, setSceneRefreshTrigger] = useState(0);
  const [_isSyncing, setIsSyncing] = useState(false);
  const [showWorldCoord, setShowWorldCoord] = useState(true); // Display world coordinate axis
  const [viewportLocked, setViewportLocked] = useState(false); // Lock viewport controls
  const [pickingMode, setPickingMode] = useState<'none' | 'focus' | 'whiteBalance' | 'material' | 'object' | 'cameraTarget' | 'renderRegion' | 'filmRegion'>('none');
  const [materialDatabaseVisible, setMaterialDatabaseVisible] = useState(false);
  const [saveRenderDialogOpen, setSaveRenderDialogOpen] = useState(false);
  const [exportPassesDialogOpen, setExportPassesDialogOpen] = useState(false);
  
  // Panel visibility state
  const [panelVisibility, setPanelVisibility] = useState({
    renderViewport: true,
    nodeInspector: true,
    graphEditor: true,
    sceneOutliner: true
  });

  // Node Graph Editor toolbar state (Figure 10 buttons)
  const [gridVisible, setGridVisible] = useState(false); // Grid off by default
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [recenterViewCallback, setRecenterViewCallback] = useState<(() => void) | null>(null);
  
  const { panelSizes, handleSplitterMouseDown, containerRef, isDragging, resetPanelSizes } = useResizablePanels();
  const viewportRef = useRef<CallbackRenderViewportHandle>(null);

  // Scene tree change handler
  const handleSceneTreeChange = (tree: SceneNode[]) => {
    Logger.debug('🔄 App.tsx: handleSceneTreeChange called with', tree.length, 'nodes');
    setSceneTree(tree);
  };

  // Scene sync state handler
  const handleSyncStateChange = (syncing: boolean) => {
    setIsSyncing(syncing);
    Logger.debug(syncing ? '🔄 Scene sync started...' : '✅ Scene sync complete');
  };

  // Scene refresh handler for MenuBar
  const handleSceneRefresh = () => {
    setSceneRefreshTrigger(prev => prev + 1);
  };

  // Add Node button handler - creates geometric plane primitive (reserved for future use)
  // Commented out - not currently used but kept for future reference
  /*
  const handleAddNode = async () => {
    if (!connected || !client) {
      Logger.debug('⚠️ Cannot create node: not connected to Octane');
      return;
    }

    if (isSyncing) {
      Logger.debug('⚠️ Cannot create node: scene is currently syncing');
      return;
    }

    Logger.debug('➕ Creating geometric plane primitive...');
    
    try {
      const createdHandle = await client.createNode('NT_GEO_PLANE', NodeType.NT_GEO_PLANE);
      if (createdHandle) {
        Logger.debug('✅ Geometric plane created with handle:', createdHandle);
        // Note: UI will auto-refresh via sceneUpdated event listener
      } else {
        Logger.error('❌ Failed to create geometric plane');
      }
    } catch (error) {
      Logger.error('❌ Error creating node:', error);
    }
  };
  */

  // Copy render to clipboard handler
  const handleCopyToClipboard = async () => {
    if (!viewportRef.current) {
      Logger.warn('⚠️ Viewport not available for clipboard copy');
      return;
    }

    try {
      await viewportRef.current.copyToClipboard();
    } catch (error) {
      Logger.error('❌ Failed to copy to clipboard:', error);
    }
  };

  // Save render to disk handler - opens dialog for format selection
  const handleSaveRender = () => {
    setSaveRenderDialogOpen(true);
  };

  // Export render passes handler - opens dialog
  const handleExportPasses = () => {
    setExportPassesDialogOpen(true);
  };

  // Viewport lock change handler
  const handleViewportLockChange = (locked: boolean) => {
    setViewportLocked(locked);
    Logger.debug(`🔒 App.tsx: Viewport lock ${locked ? 'enabled' : 'disabled'}`);
  };

  // Toggle viewport lock handler (for context menu)
  const handleToggleLockViewport = () => {
    setViewportLocked(prev => !prev);
    Logger.debug(`🔒 App.tsx: Viewport lock toggled to ${!viewportLocked ? 'enabled' : 'disabled'}`);
  };

  // Set background image handler (for context menu)
  const handleSetBackgroundImage = () => {
    Logger.debug('🖼️  Set Background Image - TODO: Implement file picker');
    // TODO: Implement file picker and set background image
    alert('Set Background Image: Feature coming soon!\n\nThis will allow you to set a background image visible through alpha channel.');
  };

  // Picking mode change handler
  const handlePickingModeChange = (mode: 'none' | 'focus' | 'whiteBalance' | 'material' | 'object' | 'cameraTarget' | 'renderRegion' | 'filmRegion') => {
    setPickingMode(mode);
    Logger.debug(`🎯 App.tsx: Picking mode changed to: ${mode}`);
  };

  // Recenter view handler - resets 2D canvas pan/zoom
  const handleRecenterView = () => {
    Logger.debug('⌖ App.tsx: Recenter view requested');
    viewportRef.current?.recenterView();
  };

  // Material Database handlers
  const handleMaterialDatabaseOpen = () => {
    Logger.debug('💎 Opening Material Database');
    setMaterialDatabaseVisible(true);
  };

  const handleMaterialDatabaseClose = () => {
    Logger.debug('💎 Closing Material Database');
    setMaterialDatabaseVisible(false);
  };

  // Panel visibility toggle handler
  const handleTogglePanelVisibility = (panel: 'renderViewport' | 'nodeInspector' | 'graphEditor' | 'sceneOutliner') => {
    setPanelVisibility(prev => ({
      ...prev,
      [panel]: !prev[panel]
    }));
    Logger.debug(`👁️ Toggled ${panel} visibility`);
  };

  // Reset layout handler - resets all panels to visible and default sizes
  const handleResetLayout = () => {
    Logger.debug('↺ Resetting layout to defaults');
    
    // Reset all panels to visible
    setPanelVisibility({
      renderViewport: true,
      nodeInspector: true,
      graphEditor: true,
      sceneOutliner: true
    });
    
    // Reset panel sizes to defaults
    resetPanelSizes();
  };

  useEffect(() => {
    // Auto-connect on mount
    Logger.debug('🚀 OctaneWebR starting...');
    connect().then(success => {
      if (success) {
        Logger.debug('✅ Auto-connected to server');
      } else {
        Logger.debug('⚠️ Could not connect to server');
      }
    }).catch(error => {
      Logger.error('❌ App.tsx: connect() threw error:', error);
    });
  }, [connect]);

  // Listen for node deletion events
  useEffect(() => {
    if (!client) return;

    const handleNodeDeleted = (event: NodeDeletedEvent) => {
      Logger.debug('🗑️ App: Node deleted event received:', event.handle);
      
      // If selected node was deleted, clear selection (Node Inspector behavior)
      setSelectedNode(current => {
        if (current && current.handle === event.handle) {
          Logger.debug('⚠️ Selected node was deleted - clearing selection');
          return null;
        }
        return current;
      });
    };

    const handleRenderFailure = (data: any) => {
      Logger.error('❌ Render failure detected:', data);
      // TODO: Show user-facing error notification
      alert('Render Failed: Octane encountered an error during rendering. Check console for details.');
    };

    const handleProjectManagerChanged = (data: any) => {
      Logger.debug('📁 Project manager changed:', data);
      // Refresh scene tree when project changes
      setSceneRefreshTrigger(prev => prev + 1);
    };

    // Listen for node deletion (emitted by deleteNodeOptimized)
    // NOTE: nodeAdded is handled by SceneOutliner, which propagates via onSceneTreeChange
    client.on('nodeDeleted', handleNodeDeleted);
    client.on('OnRenderFailure', handleRenderFailure);
    client.on('OnProjectManagerChanged', handleProjectManagerChanged);
    
    Logger.debug('✅ Listening for callback events (nodeDeleted, OnRenderFailure, OnProjectManagerChanged)');

    // Cleanup listener on unmount
    return () => {
      client.off('nodeDeleted', handleNodeDeleted);
      client.off('OnRenderFailure', handleRenderFailure);
      client.off('OnProjectManagerChanged', handleProjectManagerChanged);
      Logger.debug('🔇 Stopped listening for callback events');
    };
  }, [client]); // Only re-register when client changes, not on every selection

  return (
    <div className="app-container">
      {/* Top Menu Bar */}
      <header className="menu-bar">
        <MenuBar 
          onSceneRefresh={handleSceneRefresh}
          onMaterialDatabaseOpen={handleMaterialDatabaseOpen}
          panelVisibility={panelVisibility}
          onTogglePanelVisibility={handleTogglePanelVisibility}
          onResetLayout={handleResetLayout}
        />
        
        {/* Connection Status & Controls */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <ConnectionStatus />
        </div>
      </header>

      {/* Main Application Layout */}
      <main 
        ref={containerRef}
        className={`app-layout ${isDragging ? 'resizing' : ''}`}
        style={{
          gridTemplateColumns: panelVisibility.sceneOutliner && panelVisibility.nodeInspector
            ? `${panelSizes.left}px 4px 1fr 4px ${panelSizes.right}px`
            : panelVisibility.sceneOutliner
            ? `${panelSizes.left}px 4px 1fr`
            : panelVisibility.nodeInspector
            ? `1fr 4px ${panelSizes.right}px`
            : '1fr',
          gridTemplateRows: panelVisibility.renderViewport && panelVisibility.graphEditor
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
                <SceneOutliner 
                  key={sceneRefreshTrigger}
                  selectedNode={selectedNode}
                  onNodeSelect={setSelectedNode}
                  onSceneTreeChange={handleSceneTreeChange}
                  onSyncStateChange={handleSyncStateChange}
                />
              </div>
            </aside>

            {/* Left Splitter - spans ALL rows (full height) */}
            <div 
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
                <button className="viewport-btn" title="Fit to Window">⊞</button>
                <button className="viewport-btn" title="Actual Size">1:1</button>
                <button className="viewport-btn" title="Zoom In">🔍+</button>
                <button className="viewport-btn" title="Zoom Out">🔍-</button>
              </div>
            </div>
            
            <div className="viewport-container">
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
            </div>
            
            {/* Render Toolbar - Official Octane viewport controls */}
            <RenderToolbar 
              onToggleWorldCoord={() => setShowWorldCoord(!showWorldCoord)} 
              onCopyToClipboard={handleCopyToClipboard}
              onSaveRender={handleSaveRender}
              onExportPasses={handleExportPasses}
              onRecenterView={handleRecenterView}
              onViewportLockChange={handleViewportLockChange}
              onPickingModeChange={handlePickingModeChange}
            />
          </section>
        )}

        {/* Center-Right Splitter & Right Panel: Node Inspector - spans ALL rows (full height) */}
        {panelVisibility.nodeInspector && (
          <>
            <div 
              className="panel-splitter vertical center-right-splitter"
              onMouseDown={() => handleSplitterMouseDown('right')}
              style={{ gridRow: '1 / -1' }}
            />

            <aside className="right-panel panel" style={{ gridRow: '1 / -1' }}>
              <div className="panel-header">
                <h3>Node inspector</h3>
              </div>
              <div className="panel-content">
                <div className="node-inspector-layout">
                  <NodeInspectorControls 
                    sceneTree={sceneTree}
                    onNodeSelect={setSelectedNode}
                  />
                  <div className="node-inspector-main">
                    <NodeInspector node={selectedNode} />
                  </div>
                </div>
              </div>
            </aside>
          </>
        )}

        {/* Horizontal Splitter & Bottom Panel: Node Graph Editor - ROW 2 & 3, COLUMN 3 ONLY */}
        {panelVisibility.graphEditor && (
          <>
            {panelVisibility.renderViewport && (
              <div 
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
                <NodeGraphToolbar
                  gridVisible={gridVisible}
                  setGridVisible={setGridVisible}
                  snapToGrid={snapToGrid}
                  setSnapToGrid={setSnapToGrid}
                  onRecenterView={recenterViewCallback || undefined}
                />
                <div className="node-graph-tabgraph">
                  {/* Node Graph Tabs */}
                  <div className="node-graph-tabs">
                    <button 
                      className="node-graph-tab active" 
                      title="Scene node graph"
                    >
                      Scene
                    </button>
                  </div>
                  {/* Node Graph Toolbar - Figure 10 vertical buttons, docked left */}                
                  <NodeGraphEditor 
                    sceneTree={sceneTree} 
                    selectedNode={selectedNode}
                    onNodeSelect={setSelectedNode}
                    gridVisible={gridVisible}
                    setGridVisible={setGridVisible}
                    snapToGrid={snapToGrid}
                    setSnapToGrid={setSnapToGrid}
                    onRecenterViewReady={(callback) => setRecenterViewCallback(() => callback)}
                  />
                </div>
              </div>
            </section>
          </>
        )}
        
      </main>

      {/* Status Bar */}
      <footer className="status-bar">
        <div className="status-left">
          <span className="status-item">OctaneWebR - React TypeScript + Node.js gRPC</span>
        </div>
        <div className="status-center">
        </div>
        <div className="status-right">
          <span className="status-item">OctaneLive: <span id="octane-status">{connected ? 'connected' : 'disconnected'}</span></span>
        </div>
      </footer>

      {/* Material Database Modal */}
      <MaterialDatabase
        visible={materialDatabaseVisible}
        onClose={handleMaterialDatabaseClose}
      />

      {/* Save Render Dialog */}
      <SaveRenderDialog
        isOpen={saveRenderDialogOpen}
        onClose={() => setSaveRenderDialogOpen(false)}
      />

      {/* Export Passes Dialog */}
      <ExportPassesDialog
        isOpen={exportPassesDialogOpen}
        onClose={() => setExportPassesDialogOpen(false)}
      />
    </div>
  );
}

function App() {
  return (
    <OctaneProvider>
      <EditActionsProvider>
        <AppContent />
      </EditActionsProvider>
    </OctaneProvider>
  );
}

export default App;
