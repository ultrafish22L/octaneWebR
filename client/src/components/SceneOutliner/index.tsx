/**
 * Scene Outliner Component (React TypeScript)
 * Hierarchical tree view of Octane scene with virtual scrolling
 */

import React, { useState } from 'react';
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

  // Context menu actions
  const contextMenu = useContextMenuActions({ onNodeSelect });

  // Tree expansion management (temporary initialization)
  const treeExpansionInit = useTreeExpansion({
    sceneTree: [],
    selectedNode,
    onNodeSelect,
    onNodeContextMenu: contextMenu.handleNodeContextMenu,
  });

  // Scene tree management
  const { sceneTree, loading, loadSceneTree } = useSceneTree({
    onSceneTreeChange,
    onSyncStateChange,
    onNodeSelect,
    initializeExpansion: treeExpansionInit.initializeExpansion,
  });

  // Update tree expansion with current sceneTree
  const { flattenedNodes, rowProps, handleExpandAll, handleCollapseAll } = useTreeExpansion({
    sceneTree,
    selectedNode,
    onNodeSelect,
    onNodeContextMenu: contextMenu.handleNodeContextMenu,
  });

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
          ) : loading ? (
            <div className="scene-loading">
              <div className="loading-spinner"></div>
              <div className="scene-loading-text">Loading scene...</div>
            </div>
          ) : sceneTree.length > 0 ? (
            <div className="scene-mesh-list">
              {/* Virtual scrolling: Only render visible nodes */}
              <List
                rowCount={flattenedNodes.length}
                rowHeight={20}
                rowComponent={VirtualTreeRow}
                rowProps={rowProps}
              />
            </div>
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
          {liveDB.liveDBLoading && <div className="scene-loading">Loading LiveDB...</div>}
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
          {localDB.localDBLoading && <div className="scene-loading">Loading LocalDB...</div>}
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
