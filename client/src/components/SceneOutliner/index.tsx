/**
 * Scene Outliner Component (React TypeScript)
 * Hierarchical tree view of Octane scene with virtual scrolling
 */

import React, { useState, useCallback } from 'react';
import { List } from 'react-window';
import { useOctane } from '../../hooks/useOctane';
import { SceneNode } from '../../services/OctaneClient';
import { SceneOutlinerContextMenu } from './SceneOutlinerContextMenu';
import { VirtualTreeRow } from './VirtualTreeRow';
import { LiveDBTreeItem } from './LiveDBTreeItem';
import { LocalDBTreeItem } from './LocalDBTreeItem';
import { useSceneTree } from './hooks/useSceneTree';
import { useLocalDB } from './hooks/useLocalDB';
import { useLiveDB } from './hooks/useLiveDB';
import { useContextMenuActions } from './hooks/useContextMenuActions';
import { useTreeExpansion } from './hooks/useTreeExpansion';
import { SkeletonTree } from '../Skeleton';

interface SceneOutlinerProps {
  selectedNode?: SceneNode | null;
  onNodeSelect?: (node: SceneNode | null) => void;
  onSceneTreeChange?: (sceneTree: SceneNode[]) => void;
  onSyncStateChange?: (syncing: boolean) => void;
}

type TabType = 'scene' | 'livedb' | 'localdb';

export const SceneOutliner = React.memo(function SceneOutliner({
  selectedNode,
  onNodeSelect,
  onSceneTreeChange,
  onSyncStateChange,
}: SceneOutlinerProps) {
  const { connected } = useOctane();
  const [activeTab, setActiveTab] = useState<TabType>('scene');
  
  // List ref for forcing re-renders
  const listRef = React.useRef<any>(null);
  const [listKey, setListKey] = React.useState(0);

  // Context menu actions
  const contextMenu = useContextMenuActions({ onNodeSelect });

  // Stable no-op callback for initializeExpansion (prevents useEffect re-runs)
  const handleInitializeExpansion = useCallback(() => {
    // No-op, auto-initialization happens in useTreeExpansion now
  }, []);

  // 🎯 Use ref to break circular dependency between useSceneTree and useTreeExpansion
  const expandNodesRef = React.useRef<((handles: number[]) => void) | null>(null);
  
  // Stable callback that uses ref (so useSceneTree can call it without depending on expandNodes)
  const handleExpandNodes = useCallback((handles: number[]) => {
    if (expandNodesRef.current) {
      expandNodesRef.current(handles);
    }
  }, []);

  // Scene tree management
  const { sceneTree, loading, loadPhase: _loadPhase, updateVisibleHandles, loadSceneTree } = useSceneTree({
    onSceneTreeChange,
    onSyncStateChange,
    onNodeSelect,
    initializeExpansion: handleInitializeExpansion,
    onExpandNodes: handleExpandNodes, // Stable callback that uses ref
  });

  // Tree expansion management (auto-initializes when sceneTree loads)
  const { flattenedNodes, rowProps, handleExpandAll, handleCollapseAll, expandNodes } = useTreeExpansion({
    sceneTree,
    selectedNode,
    onNodeSelect,
    onNodeContextMenu: contextMenu.handleNodeContextMenu,
  });
  
  // V2: Track visible rows for priority loading
  // react-window v2 uses onRowsRendered with startIndex/stopIndex
  const handleRowsRendered = useCallback(
    (visibleRows: { startIndex: number; stopIndex: number }) => {
      const visibleHandles = flattenedNodes
        .slice(visibleRows.startIndex, visibleRows.stopIndex + 1)
        .map(n => n.node.handle) // FlattenedNode has .node.handle
        .filter((h): h is number => typeof h === 'number' && h !== 0);
      
      updateVisibleHandles(visibleHandles);
    },
    [flattenedNodes, updateVisibleHandles]
  );
  
  // Update ref when expandNodes changes
  React.useEffect(() => {
    expandNodesRef.current = expandNodes;
  }, [expandNodes]);
  
  // 🎯 Force List re-render when flattenedNodes change
  // This ensures virtual scrolling cache is invalidated
  React.useEffect(() => {
    setListKey(prev => prev + 1);
  }, [flattenedNodes.length]);

  // LocalDB management
  const localDB = useLocalDB({ activeTab });

  // LiveDB management
  const liveDB = useLiveDB({ activeTab });

  return (
    <div className="scene-outliner">
      {/* Scene Outliner Button Bar (above tabs) */}
      <div className="scene-outliner-button-bar">
        <button
          className="outliner-btn"
          title="Expand all nodes"
          data-action="expand-tree"
          onClick={handleExpandAll}
          disabled={loading || !connected || sceneTree.length === 0}
        >
          <img
            src="/icons/UNCOLLAPSE NODES window.png"
            alt="Expand all"
            width={16}
            height={16}
            style={{
              filter: loading || !connected || sceneTree.length === 0 ? 'opacity(0.4)' : 'none',
            }}
          />
        </button>
        <button
          className="outliner-btn"
          title="Collapse all nodes"
          data-action="collapse-tree"
          onClick={handleCollapseAll}
          disabled={loading || !connected || sceneTree.length === 0}
        >
          <img
            src="/icons/COLLAPSE NODES window.png"
            alt="Collapse all"
            width={16}
            height={16}
            style={{
              filter: loading || !connected || sceneTree.length === 0 ? 'opacity(0.4)' : 'none',
            }}
          />
        </button>
        <button
          className="outliner-btn refresh-tree-btn"
          title="Refresh tree"
          data-action="refresh-tree"
          onClick={loadSceneTree}
          disabled={loading || !connected}
        >
          <img
            src="/icons/RELOAD general.png"
            alt="Refresh"
            width={16}
            height={16}
            style={{
              filter: loading || !connected ? 'opacity(0.4)' : 'none',
              animation: loading ? 'spin 1s linear infinite' : 'none',
            }}
          />
        </button>
      </div>

      {/* Scene Outliner Tabs */}
      <div className="scene-outliner-tabs">
        <button
          className={`scene-tab ${activeTab === 'scene' ? 'active' : ''}`}
          data-tab="scene"
          title="Scene hierarchy view"
          onClick={() => setActiveTab('scene')}
        >
          Scene
        </button>
        <button
          className={`scene-tab ${activeTab === 'livedb' ? 'active' : ''}`}
          data-tab="livedb"
          title="Live database materials"
          onClick={() => setActiveTab('livedb')}
        >
          Live DB
        </button>
        <button
          className={`scene-tab ${activeTab === 'localdb' ? 'active' : ''}`}
          data-tab="localdb"
          title="Local database materials"
          onClick={() => setActiveTab('localdb')}
        >
          Local DB
        </button>
      </div>

      {/* Tab Content: Scene */}
      <div
        className={`scene-tab-content ${activeTab === 'scene' ? 'active' : ''}`}
        data-content="scene"
      >
        <div className="scene-tree">
          {!connected ? (
            <div className="scene-loading">Not connected</div>
          ) : sceneTree.length > 0 ? (
            // Show tree as soon as we have data (even during progressive loading)
            <div className="scene-mesh-list">
              {/* Virtual scrolling: Only render visible nodes */}
              <List
                key={listKey}
                listRef={listRef}
                rowCount={flattenedNodes.length}
                rowHeight={20}
                rowComponent={VirtualTreeRow}
                rowProps={rowProps}
                onRowsRendered={handleRowsRendered}
              />
            </div>
          ) : loading ? (
            // Only show skeleton if loading AND no data yet
            <SkeletonTree count={12} />
          ) : (
            <div className="scene-loading">Click refresh to load scene</div>
          )}
        </div>
      </div>

      {/* Tab Content: Live DB */}
      <div
        className={`scene-tab-content ${activeTab === 'livedb' ? 'active' : ''}`}
        data-content="livedb"
      >
        <div className="db-content">
          {liveDB.liveDBLoading && <SkeletonTree count={8} />}
          {!liveDB.liveDBLoading && liveDB.liveDBCategories.length === 0 && (
            <div className="db-status">
              Live DB - No online materials available
              <br />
              <small>Check your internet connection or Octane account</small>
            </div>
          )}
          {!liveDB.liveDBLoading && liveDB.liveDBCategories.length > 0 && (
            <div className="scene-tree">
              {liveDB.liveDBCategories.map(category => (
                <LiveDBTreeItem
                  key={category.id}
                  category={category}
                  depth={0}
                  onToggleCategory={liveDB.handleLiveDBCategoryToggle}
                  onDownloadMaterial={liveDB.handleLiveDBMaterialDownload}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tab Content: Local DB */}
      <div
        className={`scene-tab-content ${activeTab === 'localdb' ? 'active' : ''}`}
        data-content="localdb"
      >
        <div className="db-content">
          {localDB.localDBLoading && <SkeletonTree count={8} />}
          {!localDB.localDBLoading && !localDB.localDBRoot && (
            <div className="db-status">
              Local DB - No materials found
              <br />
              <small>Add materials to your LocalDB directory to see them here</small>
            </div>
          )}
          {!localDB.localDBLoading && localDB.localDBRoot && (
            <div className="scene-tree">
              <LocalDBTreeItem
                category={localDB.localDBRoot}
                depth={0}
                onLoadCategory={async cat => {
                  await localDB.loadCategoryChildren(cat);
                  // Force re-render by updating state
                  if (localDB.localDBRoot) {
                    localDB.setLocalDBRoot({ ...localDB.localDBRoot });
                  }
                }}
                onLoadPackage={localDB.handlePackageLoad}
              />
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.contextMenuVisible && (
        <SceneOutlinerContextMenu
          x={contextMenu.contextMenuPosition.x}
          y={contextMenu.contextMenuPosition.y}
          onRender={contextMenu.handleRender}
          onSave={contextMenu.handleSave}
          onCut={contextMenu.handleCut}
          onCopy={contextMenu.handleCopy}
          onPaste={contextMenu.handlePaste}
          onFillEmptyPins={contextMenu.handleFillEmptyPins}
          onDelete={contextMenu.handleDelete}
          onShowInGraphEditor={contextMenu.handleShowInGraphEditor}
          onShowInLuaBrowser={contextMenu.handleShowInLuaBrowser}
          onClose={contextMenu.handleContextMenuClose}
        />
      )}
    </div>
  );
});
