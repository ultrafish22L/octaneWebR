/**
 * Scene Outliner Component (React TypeScript)
 * Hierarchical tree view of Octane scene
 */

import { Logger } from '../../utils/Logger';
import React, { useEffect, useState } from 'react';
import { useOctane } from '../../hooks/useOctane';
import { SceneNode, NodeAddedEvent, NodeDeletedEvent } from '../../services/OctaneClient';
import { getIconForType } from '../../constants/PinTypes';
import { SceneOutlinerContextMenu } from './SceneOutlinerContextMenu';
import { EditCommands } from '../../commands/EditCommands';

const getNodeIcon = (node: SceneNode): string => {
  // Special case: Scene root
  if (node.type === 'SceneRoot' || node.name === 'Scene') {
    return '/icons/SCENE node.png'; // Scene icon for scene root
  }
  
  // Use getIconForType for consistent icon mapping
  const outType = String(node.type || node.outType || 'unknown');
  return getIconForType(outType, node.name);
};

interface SceneTreeItemProps {
  node: SceneNode;
  depth: number;
  onSelect: (node: SceneNode) => void;
  onContextMenu: (node: SceneNode, event: React.MouseEvent) => void;
  selectedHandle: number | null;
  expandAllSignal?: number;
  collapseAllSignal?: number;
}

function SceneTreeItem({ node, depth, onSelect, onContextMenu, selectedHandle, expandAllSignal, collapseAllSignal }: SceneTreeItemProps) {
    // Scene root and Render target start expanded by default
  const [expanded, setExpanded] = useState(
    node.type === 'SceneRoot' || node.type === 'PT_RENDERTARGET'
  );
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedHandle === node.handle;

  // Respond to expand/collapse all signals
  useEffect(() => {
    if (expandAllSignal && expandAllSignal > 0 && hasChildren) {
      setExpanded(true);
    }
  }, [expandAllSignal, hasChildren]);

  useEffect(() => {
    if (collapseAllSignal && collapseAllSignal > 0) {
      // Don't collapse the Scene root
      if (node.type !== 'SceneRoot') {
        setExpanded(false);
      }
    }
  }, [collapseAllSignal, node.type]);

  return (
    <>
      <div
        className={`tree-node level-${depth} ${isSelected ? 'selected' : ''}`}
        data-handle={node.handle}
        onClick={() => {
          // Don't select the synthetic Scene root
          if (node.type !== 'SceneRoot') {
            onSelect(node);
          }
        }}
        onContextMenu={(e) => {
          // Don't show context menu for synthetic Scene root
          if (node.type !== 'SceneRoot') {
            onContextMenu(node, e);
          }
        }}
      >
        <div className="node-content">
          {hasChildren ? (
            <span
              className={`node-toggle ${expanded ? 'expanded' : 'collapsed'}`}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? '−' : '+'}
            </span>
          ) : (
            <span className="node-spacer"></span>
          )}

          <img 
            src={getNodeIcon(node)} 
            alt="" 
            className="node-icon"
            width={16}
            height={16}
            onError={(e) => {
              // Fallback to category icon if specific icon not found
              (e.target as HTMLImageElement).src = '/icons/EMPTY.png';
            }}
          />
          <span className="node-name">{node.name}</span>
        </div>
      </div>
      {expanded && hasChildren && node.children!.map((child, index) => {
        // Generate unique key: use handle + pin index for NO_ITEM nodes (handle=0)
        // Pin index comes from pinInfo.ix, fallback to array index
        const uniqueKey = child.handle !== 0 
          ? child.handle 
          : `${node.handle}_pin${child.pinInfo?.ix ?? index}`;
        
        return (
          <SceneTreeItem
            key={uniqueKey}
            node={child}
            depth={depth + 1}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
            selectedHandle={selectedHandle}
            expandAllSignal={expandAllSignal}
            collapseAllSignal={collapseAllSignal}
          />
        );
      })}
    </>
  );
}

interface SceneOutlinerProps {
  selectedNode?: SceneNode | null;
  onNodeSelect?: (node: SceneNode | null) => void;
  onSceneTreeChange?: (sceneTree: SceneNode[]) => void;
  onSyncStateChange?: (syncing: boolean) => void;
}

type TabType = 'scene' | 'livedb' | 'localdb';

interface LocalDBCategory {
  handle: number;
  name: string;
  subcategories: LocalDBCategory[];
  packages: LocalDBPackage[];
  loaded: boolean;
}

interface LocalDBPackage {
  handle: number;
  name: string;
}

interface LiveDBCategory {
  id: number;
  name: string;
  parentID: number;
  typeID: number;
  expanded: boolean;
  materials: LiveDBMaterial[];
  loaded: boolean;
}

interface LiveDBMaterial {
  id: number;
  name: string;
  nickname: string;
  copyright: string;
  previewUrl?: string;
}

// LiveDB tree item component
interface LiveDBTreeItemProps {
  category: LiveDBCategory;
  depth: number;
  onToggleCategory: (category: LiveDBCategory) => void;
  onDownloadMaterial: (material: LiveDBMaterial) => void;
}

function LiveDBTreeItem({ category, depth, onToggleCategory, onDownloadMaterial }: LiveDBTreeItemProps) {
  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCategory(category);
  };

  return (
    <>
      <div className={`tree-node level-${depth}`}>
        <div className="node-content">
          <span
            className={`node-toggle ${category.expanded ? 'expanded' : 'collapsed'}`}
            onClick={handleToggle}
          >
            {category.expanded ? '−' : '+'}
          </span>
          <span className="node-icon">📁</span>
          <span className="node-name">{category.name}</span>
        </div>
      </div>
      {category.expanded && category.loaded && (
        <>
          {/* Render materials in this category */}
          {category.materials.map((material) => (
            <div
              key={material.id}
              className={`tree-node level-${depth + 1} material-item`}
              onDoubleClick={() => onDownloadMaterial(material)}
              title={`Double-click to download: ${material.name}\n${material.copyright ? `© ${material.copyright}` : ''}`}
            >
              <div className="node-content">
                <span className="node-spacer"></span>
                {material.previewUrl ? (
                  <img 
                    src={material.previewUrl} 
                    alt={material.name}
                    className="material-thumbnail"
                    style={{ width: '16px', height: '16px', objectFit: 'cover', marginRight: '4px' }}
                  />
                ) : (
                  <span className="node-icon">🎨</span>
                )}
                <span className="node-name">{material.name}</span>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}

// LocalDB tree item component
interface LocalDBTreeItemProps {
  category: LocalDBCategory;
  depth: number;
  onLoadCategory: (category: LocalDBCategory) => void;
  onLoadPackage: (pkg: LocalDBPackage) => void;
}

function LocalDBTreeItem({ category, depth, onLoadCategory, onLoadPackage }: LocalDBTreeItemProps) {
  const [expanded, setExpanded] = useState(depth === 0); // Root starts expanded
  const hasChildren = category.subcategories.length > 0 || category.packages.length > 0;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!expanded && !category.loaded) {
      // Load children when expanding for the first time
      await onLoadCategory(category);
    }
    setExpanded(!expanded);
  };

  return (
    <>
      <div className={`tree-node level-${depth}`}>
        <div className="node-content">
          {hasChildren || !category.loaded ? (
            <span
              className={`node-toggle ${expanded ? 'expanded' : 'collapsed'}`}
              onClick={handleToggle}
            >
              {expanded ? '−' : '+'}
            </span>
          ) : (
            <span className="node-spacer"></span>
          )}
          <span className="node-icon">📁</span>
          <span className="node-name">{category.name}</span>
        </div>
      </div>
      {expanded && (
        <>
          {/* Render subcategories */}
          {category.subcategories.map((subcat) => (
            <LocalDBTreeItem
              key={subcat.handle}
              category={subcat}
              depth={depth + 1}
              onLoadCategory={onLoadCategory}
              onLoadPackage={onLoadPackage}
            />
          ))}
          {/* Render packages */}
          {category.packages.map((pkg) => (
            <div
              key={pkg.handle}
              className={`tree-node level-${depth + 1} package-item`}
              onDoubleClick={() => onLoadPackage(pkg)}
              title="Double-click to load package into scene"
            >
              <div className="node-content">
                <span className="node-spacer"></span>
                <span className="node-icon">📦</span>
                <span className="node-name">{pkg.name}</span>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}

export const SceneOutliner = React.memo(function SceneOutliner({ selectedNode, onNodeSelect, onSceneTreeChange, onSyncStateChange }: SceneOutlinerProps) {
  const { client, connected } = useOctane();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('scene');
  const [localDBRoot, setLocalDBRoot] = useState<LocalDBCategory | null>(null);
  const [localDBLoading, setLocalDBLoading] = useState(false);
  const [liveDBCategories, setLiveDBCategories] = useState<LiveDBCategory[]>([]);
  const [liveDBLoading, setLiveDBLoading] = useState(false);
  const [sceneTree, setSceneTree] = useState<SceneNode[]>([]);
  const [expandAllSignal, setExpandAllSignal] = useState(0);
  const [collapseAllSignal, setCollapseAllSignal] = useState(0);
  
  // Context menu state
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuNode, setContextMenuNode] = useState<SceneNode | null>(null);

  const handleNodeSelect = (node: SceneNode) => {
    onNodeSelect?.(node);
  };
  
  // Context menu handler
  const handleNodeContextMenu = (node: SceneNode, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContextMenuNode(node);
    setContextMenuVisible(true);
  };
  
  // Context menu action handlers
  const handleContextMenuClose = () => {
    setContextMenuVisible(false);
    setContextMenuNode(null);
  };
  
  const handleRender = () => {
    Logger.debug('🎬 Render action for node:', contextMenuNode?.name);
    // TODO: Implement render action
  };
  
  const handleSave = () => {
    Logger.debug('💾 Save action for node:', contextMenuNode?.name);
    // TODO: Implement save action
  };
  
  const handleCut = () => {
    Logger.debug('✂️ Cut action for node:', contextMenuNode?.name);
    // TODO: Implement cut action
  };
  
  const handleCopy = () => {
    Logger.debug('📋 Copy action for node:', contextMenuNode?.name);
    // TODO: Implement copy action
  };
  
  const handlePaste = () => {
    Logger.debug('📌 Paste action for node:', contextMenuNode?.name);
    // TODO: Implement paste action
  };
  
  const handleFillEmptyPins = () => {
    Logger.debug('📌 Fill empty pins for node:', contextMenuNode?.name);
    // TODO: Implement fill empty pins action
  };
  
  const handleDelete = async () => {
    if (!contextMenuNode || !client) return;
    
    Logger.debug('🗑️ Delete action for node:', contextMenuNode.name);
    
    // Use unified EditCommands for consistent delete behavior
    await EditCommands.deleteNodes({
      client,
      selectedNodes: [contextMenuNode],
      onSelectionClear: () => {
        // Clear selection via parent callback
        onNodeSelect?.(null);
      },
      onComplete: () => {
        Logger.debug('✅ Delete operation completed from SceneOutliner');
      }
    });
  };
  
  const handleShowInGraphEditor = () => {
    Logger.debug('🔍 Show in Graph Editor:', contextMenuNode?.name);
    // The node is already selected, the graph editor should show it
    // TODO: Add explicit navigation to graph editor tab if needed
  };
  
  const handleShowInLuaBrowser = () => {
    Logger.debug('🔍 Show in Lua Browser:', contextMenuNode?.name);
    // TODO: Implement Lua browser navigation
  };

  const loadSceneTree = async () => {
    if (!connected || !client) {
      return;
    }

    Logger.debug('🔄 Loading scene tree from Octane...');
    setLoading(true);
    onSyncStateChange?.(true);
    
    try {
      const tree = await client.buildSceneTree();
      
      setSceneTree(tree);
      onSceneTreeChange?.(tree);
      
      Logger.debug(`✅ Loaded ${tree.length} top-level items`);

      // Auto-select render target node after scene is loaded
      const findRenderTarget = (nodes: SceneNode[]): SceneNode | null => {
        for (const node of nodes) {
          if (node.type === 'PT_RENDERTARGET') {
            return node;
          }
          if (node.children) {
            const found = findRenderTarget(node.children);
            if (found) return found;
          }
        }
        return null;
      };

      const renderTarget = findRenderTarget(tree);
      if (renderTarget) {
        handleNodeSelect(renderTarget);
      }
    } catch (error: any) {
      Logger.error('❌ Failed to load scene tree:', error);
    } finally {
      setLoading(false);
      onSyncStateChange?.(false);
    }
  };

  // Load LocalDB categories and packages
  const loadLocalDB = async () => {
    if (!client) return;
    
    setLocalDBLoading(true);
    try {
      const rootHandle = await client.getLocalDBRoot();
      if (!rootHandle) {
        Logger.warn('⚠️ LocalDB not available or empty');
        setLocalDBRoot(null);
        return;
      }

      const rootName = await client.getCategoryName(rootHandle);
      const root: LocalDBCategory = {
        handle: rootHandle,
        name: rootName,
        subcategories: [],
        packages: [],
        loaded: false
      };

      // Load root level categories and packages
      await loadCategoryChildren(root);
      setLocalDBRoot(root);
      Logger.debug('✅ LocalDB loaded:', root);
    } catch (error) {
      Logger.error('❌ Failed to load LocalDB:', error);
      setLocalDBRoot(null);
    } finally {
      setLocalDBLoading(false);
    }
  };

  // Load children (subcategories and packages) for a category
  const loadCategoryChildren = async (category: LocalDBCategory) => {
    if (!client || category.loaded) return;

    try {
      // Load subcategories
      const subCatCount = await client.getSubCategoryCount(category.handle);
      for (let i = 0; i < subCatCount; i++) {
        const subCatHandle = await client.getSubCategory(category.handle, i);
        if (subCatHandle) {
          const subCatName = await client.getCategoryName(subCatHandle);
          category.subcategories.push({
            handle: subCatHandle,
            name: subCatName,
            subcategories: [],
            packages: [],
            loaded: false
          });
        }
      }

      // Load packages
      const pkgCount = await client.getPackageCount(category.handle);
      for (let i = 0; i < pkgCount; i++) {
        const pkgHandle = await client.getPackage(category.handle, i);
        if (pkgHandle) {
          const pkgName = await client.getPackageName(pkgHandle);
          category.packages.push({
            handle: pkgHandle,
            name: pkgName
          });
        }
      }

      category.loaded = true;
    } catch (error) {
      Logger.error('❌ Failed to load category children:', error);
    }
  };

  // Handle package double-click to load into scene
  const handlePackageLoad = async (pkg: LocalDBPackage) => {
    if (!client) return;
    
    try {
      Logger.debug(`Loading package: ${pkg.name}`);
      const success = await client.loadPackage(pkg.handle);
      if (success) {
        alert(`✅ Package "${pkg.name}" loaded successfully!\n\nCheck the Node Graph to see the loaded nodes.`);
      } else {
        alert(`❌ Failed to load package "${pkg.name}"`);
      }
    } catch (error) {
      Logger.error('❌ Failed to load package:', error);
      alert(`❌ Error loading package: ${error}`);
    }
  };

  // Load LiveDB categories
  const loadLiveDB = async () => {
    if (!client) return;
    
    setLiveDBLoading(true);
    try {
      const rawCategories = await client.getLiveDBCategories();
      if (!rawCategories || rawCategories.length === 0) {
        Logger.warn('⚠️ LiveDB not available or empty');
        setLiveDBCategories([]);
        return;
      }

      // Convert to LiveDBCategory format
      const categories: LiveDBCategory[] = rawCategories.map(cat => ({
        id: cat.id,
        name: cat.name,
        parentID: cat.parentID,
        typeID: cat.typeID,
        expanded: false,
        materials: [],
        loaded: false
      }));

      setLiveDBCategories(categories);
      Logger.debug(`✅ LiveDB loaded with ${categories.length} categories`);
    } catch (error) {
      Logger.error('❌ Failed to load LiveDB:', error);
      setLiveDBCategories([]);
    } finally {
      setLiveDBLoading(false);
    }
  };

  // Toggle LiveDB category expansion and load materials if needed
  const handleLiveDBCategoryToggle = async (category: LiveDBCategory) => {
    if (!client) return;

    // If not loaded yet, load materials for this category
    if (!category.loaded && !category.expanded) {
      try {
        Logger.debug(`Loading materials for category: ${category.name}`);
        const materials = await client.getLiveDBMaterials(category.id);
        
        // Load preview thumbnails for first few materials (limit to avoid overwhelming the server)
        const materialsWithPreviews = await Promise.all(
          materials.slice(0, 10).map(async (mat) => {
            const preview = await client.getLiveDBMaterialPreview(mat.id, 128, 0);
            return { ...mat, previewUrl: preview || undefined };
          })
        );

        // Update the category
        category.materials = [...materialsWithPreviews, ...materials.slice(10)];
        category.loaded = true;
      } catch (error) {
        Logger.error(`❌ Failed to load materials for category ${category.name}:`, error);
      }
    }

    // Toggle expanded state
    category.expanded = !category.expanded;
    setLiveDBCategories([...liveDBCategories]); // Force re-render
  };

  // Handle LiveDB material download
  const handleLiveDBMaterialDownload = async (material: LiveDBMaterial) => {
    if (!client) return;
    
    try {
      Logger.debug(`Downloading material: ${material.name}`);
      const materialHandle = await client.downloadLiveDBMaterial(material.id);
      if (materialHandle) {
        alert(`✅ Material "${material.name}" downloaded successfully!\n\nCheck the Node Graph to see the material nodes.`);
      } else {
        alert(`❌ Failed to download material "${material.name}"`);
      }
    } catch (error) {
      Logger.error('❌ Failed to download material:', error);
      alert(`❌ Error downloading material: ${error}`);
    }
  };

  // Auto-load on connect (only once when connected becomes true)
  useEffect(() => {
    if (connected && client) {
      loadSceneTree();
    } else if (client && !loading) {
      // Fallback: Force load scene tree even if connected state is false
      loadSceneTree();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, client]);

  // Load LocalDB when Local DB tab becomes active
  useEffect(() => {
    if (activeTab === 'localdb' && !localDBRoot && !localDBLoading && client) {
      loadLocalDB();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, client]);

  // Load LiveDB when Live DB tab becomes active
  useEffect(() => {
    if (activeTab === 'livedb' && liveDBCategories.length === 0 && !liveDBLoading && client) {
      loadLiveDB();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, client]);

  // Listen for incremental node additions
  useEffect(() => {
    if (!client) return;

    const handleNodeAdded = (event: NodeAddedEvent) => {
      Logger.debug('🌲 SceneOutliner: Adding node incrementally:', event.node.name);
      setSceneTree(prev => {
        const updated = [...prev, event.node];
        // Schedule parent callback after state update completes
        setTimeout(() => onSceneTreeChange?.(updated), 0);
        return updated;
      });
    };

    const handleNodeDeleted = (event: NodeDeletedEvent) => {
      Logger.debug('🌲 SceneOutliner: nodeDeleted event received, handle:', event.handle, 'type:', typeof event.handle);
      setSceneTree(prev => {
        Logger.debug('🌲 SceneOutliner: Current tree has', prev.length, 'root nodes');
        Logger.debug('🌲 SceneOutliner: Root handles:', prev.map(n => `${n.handle} (${typeof n.handle})`).join(', '));
        
        // Optimized delete with structural sharing
        // Only creates new objects in the path to the deleted node
        // Keeps all other nodes unchanged (same reference) for React optimization
        const filterDeleted = (nodes: SceneNode[]): { updated: SceneNode[], changed: boolean } => {
          let changed = false;
          const filtered: SceneNode[] = [];
          
          for (const node of nodes) {
            // If this is the node to delete, skip it
            if (node.handle === event.handle) {
              Logger.debug(`🗑️ SceneOutliner: Filtering out node ${node.handle} "${node.name}"`);
              changed = true;
              continue;
            }
            
            // If node has children, check if any children need to be filtered
            if (node.children && node.children.length > 0) {
              const childResult = filterDeleted(node.children);
              
              if (childResult.changed) {
                // Only create a new object if children changed
                filtered.push({
                  ...node,
                  children: childResult.updated
                });
                changed = true;
              } else {
                // Keep the same node reference if children unchanged
                filtered.push(node);
              }
            } else {
              // Leaf node - keep as-is
              filtered.push(node);
            }
          }
          
          return { updated: filtered, changed };
        };
        
        const result = filterDeleted(prev);
        
        if (!result.changed) {
          Logger.debug('⚠️ SceneOutliner: Node not found in tree, no changes made');
          return prev; // Return same reference if nothing changed
        }
        
        Logger.debug('🌲 SceneOutliner: Updated tree has', result.updated.length, 'root nodes (was', prev.length, ')');
        Logger.debug('✅ SceneOutliner: Structural sharing preserved unaffected nodes');
        
        // Schedule parent callback after state update completes
        setTimeout(() => {
          Logger.debug('🌲 SceneOutliner: Calling onSceneTreeChange callback with', result.updated.length, 'nodes');
          onSceneTreeChange?.(result.updated);
        }, 0);
        return result.updated;
      });
    };

    const handleSceneTreeUpdated = (scene: any) => {
      Logger.debug('🌲 SceneOutliner: Full scene tree update');
      const tree = scene.tree || [];
      setSceneTree(tree);
      // Schedule parent callback after state update completes
      setTimeout(() => onSceneTreeChange?.(tree), 0);
    };

    client.on('nodeAdded', handleNodeAdded);
    client.on('nodeDeleted', handleNodeDeleted);
    client.on('sceneTreeUpdated', handleSceneTreeUpdated);

    return () => {
      client.off('nodeAdded', handleNodeAdded);
      client.off('nodeDeleted', handleNodeDeleted);
      client.off('sceneTreeUpdated', handleSceneTreeUpdated);
    };
  }, [client, onSceneTreeChange]);

  const handleExpandAll = () => {
    setExpandAllSignal(prev => prev + 1);
  };

  const handleCollapseAll = () => {
    setCollapseAllSignal(prev => prev + 1);
  };

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
            style={{ filter: loading || !connected || sceneTree.length === 0 ? 'opacity(0.4)' : 'none' }}
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
            style={{ filter: loading || !connected || sceneTree.length === 0 ? 'opacity(0.4)' : 'none' }}
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
              animation: loading ? 'spin 1s linear infinite' : 'none'
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
      <div className={`scene-tab-content ${activeTab === 'scene' ? 'active' : ''}`} data-content="scene">
        <div className="scene-tree">
          {!connected ? (
            <div className="scene-loading">Not connected</div>
          ) : loading ? (
            <div className="scene-loading">Loading scene...</div>
          ) : sceneTree.length > 0 ? (
            <div className="scene-mesh-list">
              {/* Create a synthetic Scene root node with children */}
              <SceneTreeItem
                node={{
                  handle: -1, // Use -1 for synthetic root to avoid collision with NO_ITEM (0)
                  name: 'Scene',
                  type: 'SceneRoot',
                  typeEnum: 0,
                  children: sceneTree
                }}
                depth={0}
                onSelect={handleNodeSelect}
                onContextMenu={handleNodeContextMenu}
                selectedHandle={selectedNode?.handle || null}
                expandAllSignal={expandAllSignal}
                collapseAllSignal={collapseAllSignal}
              />
            </div>
          ) : (
            <div className="scene-loading">Click refresh to load scene</div>
          )}
        </div>
      </div>
      
      {/* Tab Content: Live DB */}
      <div className={`scene-tab-content ${activeTab === 'livedb' ? 'active' : ''}`} data-content="livedb">
        <div className="db-content">
          {liveDBLoading && (
            <div className="scene-loading">Loading LiveDB...</div>
          )}
          {!liveDBLoading && liveDBCategories.length === 0 && (
            <div className="db-status">
              Live DB - No online materials available
              <br />
              <small>Check your internet connection or Octane account</small>
            </div>
          )}
          {!liveDBLoading && liveDBCategories.length > 0 && (
            <div className="scene-tree">
              {liveDBCategories.map((category) => (
                <LiveDBTreeItem
                  key={category.id}
                  category={category}
                  depth={0}
                  onToggleCategory={handleLiveDBCategoryToggle}
                  onDownloadMaterial={handleLiveDBMaterialDownload}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Tab Content: Local DB */}
      <div className={`scene-tab-content ${activeTab === 'localdb' ? 'active' : ''}`} data-content="localdb">
        <div className="db-content">
          {localDBLoading && (
            <div className="scene-loading">Loading LocalDB...</div>
          )}
          {!localDBLoading && !localDBRoot && (
            <div className="db-status">
              Local DB - No materials found
              <br />
              <small>Add materials to your LocalDB directory to see them here</small>
            </div>
          )}
          {!localDBLoading && localDBRoot && (
            <div className="scene-tree">
              <LocalDBTreeItem
                category={localDBRoot}
                depth={0}
                onLoadCategory={async (cat) => {
                  await loadCategoryChildren(cat);
                  // Force re-render by updating state
                  setLocalDBRoot({ ...localDBRoot });
                }}
                onLoadPackage={handlePackageLoad}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Context Menu */}
      {contextMenuVisible && (
        <SceneOutlinerContextMenu
          x={contextMenuPosition.x}
          y={contextMenuPosition.y}
          onRender={handleRender}
          onSave={handleSave}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onFillEmptyPins={handleFillEmptyPins}
          onDelete={handleDelete}
          onShowInGraphEditor={handleShowInGraphEditor}
          onShowInLuaBrowser={handleShowInLuaBrowser}
          onClose={handleContextMenuClose}
        />
      )}
    </div>
  );
});
