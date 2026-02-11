/**
 * useSceneTree - Scene tree loading and event handling
 * Manages scene tree state, loading, and incremental updates
 * 
 * Supports multiple loading modes:
 * - Traditional: Load entire scene, then render
 * - Progressive V1: Render nodes as they load (level 0 → pins → connections → deep nodes)
 * - Progressive V2: Visibility-aware loading (visible first, background completion)
 * 
 * Updated: 2025-02-03 - Added progressive loading support
 * Updated: 2025-02-11 - Added V2 progressive loading support
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Logger } from '../../../utils/Logger';
import { useOctane } from '../../../hooks/useOctane';
import { SceneNode, NodeAddedEvent, NodeDeletedEvent } from '../../../services/OctaneClient';
import { FEATURES } from '../../../config/features';
import { LoadPhase, V2ProgressEvent, V2DetailsLoadedEvent } from '../../../services/octane/types';

interface UseSceneTreeProps {
  onSceneTreeChange?: (sceneTree: SceneNode[]) => void;
  onSyncStateChange?: (syncing: boolean) => void;
  onNodeSelect?: (node: SceneNode | null) => void;
  initializeExpansion: (tree: SceneNode[]) => void;
  onExpandNodes?: (handles: number[]) => void;
  onVisibleRangeChange?: (handles: number[]) => void; // V2: Report visible handles
}

export function useSceneTree({
  onSceneTreeChange,
  onSyncStateChange,
  onNodeSelect,
  initializeExpansion,
  onExpandNodes,
  onVisibleRangeChange,
}: UseSceneTreeProps) {
  const { client, connected } = useOctane();
  const [sceneTree, setSceneTree] = useState<SceneNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadPhase, setLoadPhase] = useState<LoadPhase>(LoadPhase.IDLE);
  
  // Track visible handles for V2
  const visibleHandlesRef = useRef<number[]>([]);

  // Load scene tree from Octane
  const loadSceneTree = useCallback(async () => {
    if (!connected || !client) {
      return;
    }

    Logger.debug('🔄 Loading scene tree from Octane...');
    setLoading(true);
    onSyncStateChange?.(true);

    try {
      const tree = await client.buildSceneTree();

      // V2 Progressive: Tree is already populated via events, don't overwrite
      // V1 Progressive: Also uses events for incremental updates
      // Traditional: Set tree from result
      if (!FEATURES.PROGRESSIVE_LOADING && !FEATURES.PROGRESSIVE_LOADING_V2) {
        // Traditional synchronous loading - set tree from result
        setSceneTree(tree);
        onSceneTreeChange?.(tree);
        initializeExpansion(tree);
      }
      // For progressive loading (V1/V2), tree was already updated via events
      // Just ensure expansion is initialized
      if ((FEATURES.PROGRESSIVE_LOADING || FEATURES.PROGRESSIVE_LOADING_V2) && tree.length > 0) {
        initializeExpansion(tree);
      }

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
      if (renderTarget && onNodeSelect) {
        onNodeSelect(renderTarget);

        // Set this as the active render target in the render engine
        if (renderTarget.handle && renderTarget.handle !== -1) {
          try {
            const success = await client.setRenderTargetNode(renderTarget.handle);
            if (success) {
              Logger.debug(
                `🎯 Render target activated: "${renderTarget.name}" (handle: ${renderTarget.handle})`
              );
            } else {
              Logger.warn(`⚠️ Failed to activate render target: "${renderTarget.name}"`);
            }
          } catch (error) {
            Logger.error('❌ Error setting render target:', error);
          }
        }
      }
    } catch (error: any) {
      Logger.error('❌ Failed to load scene tree:', error);
    } finally {
      setLoading(false);
      onSyncStateChange?.(false);
    }
  }, [connected, client, onSceneTreeChange, onSyncStateChange, onNodeSelect, initializeExpansion]);

  // Auto-load on connect
  useEffect(() => {
    if (connected && client) {
      loadSceneTree();
    } else if (client && !loading) {
      // Fallback: Force load scene tree even if connected state is false
      loadSceneTree();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, client]);

  // Listen for incremental node additions and deletions
  useEffect(() => {
    if (!client) return;

    // =================================================================
    // PROGRESSIVE LOADING EVENTS (Sprint 1)
    // =================================================================
    
    /**
     * Progressive: Individual node added during initial load
     * Only handles level 0 nodes during initial load
     */
    const handleProgressiveNodeAdded = ({ node, level }: any) => {
      if (!FEATURES.PROGRESSIVE_LOADING && !FEATURES.PROGRESSIVE_LOADING_V2) return;
      
      Logger.debug(`🚀 Progressive: Node added at level ${level}: "${node.name}" (handle: ${node.handle})`);
      
      // Level 0 nodes: Add to root of tree
      if (level === 0) {
        // 🎯 CRITICAL: Use flushSync to force immediate DOM update for level 0 nodes
        // This ensures top-level nodes appear immediately, not batched with children
        flushSync(() => {
          setSceneTree(prev => {
            // Check if node already exists (avoid duplicates)
            const exists = prev.some(n => n.handle === node.handle);
            if (exists) {
              Logger.debug('⚠️ Progressive: Node already exists, skipping');
              return prev;
            }
            
            const updated = [...prev, node];
            setTimeout(() => onSceneTreeChange?.(updated), 0);
            return updated;
          });
        });
      }
      // Nested nodes: Will be handled by childrenLoaded event
    };

    /**
     * Progressive: Level 0 complete - replace tree with complete level 0 nodes
     * This ensures consistent state after all level 0 nodes are loaded
     */
    const handleLevel0Complete = ({ nodes }: { nodes: SceneNode[] }) => {
      if (!FEATURES.PROGRESSIVE_LOADING && !FEATURES.PROGRESSIVE_LOADING_V2) return;
      
      Logger.info(`✅ Progressive: Level 0 complete (${nodes.length} nodes)`);
      setSceneTree(nodes);
      setTimeout(() => onSceneTreeChange?.(nodes), 0);
      
      // Initialize expansion AFTER setting tree
      setTimeout(() => {
        if (nodes.length > 0) {
          initializeExpansion(nodes);
        }
      }, 0);
    };

    /**
     * Progressive: Children loaded for a parent node
     * Updates the tree to add children to their parent
     */
    const handleChildrenLoaded = ({ parent, children }: { parent: SceneNode; children: SceneNode[] }) => {
      if (!FEATURES.PROGRESSIVE_LOADING && !FEATURES.PROGRESSIVE_LOADING_V2) return;
      
      Logger.info(`📥 UI: Received scene:childrenLoaded for "${parent.name}" (handle: ${parent.handle}): ${children.length} children`);
      Logger.info(`   Children names: ${children.map(c => c.name).join(', ')}`);
      
      setSceneTree(prev => {
        Logger.info(`   Current tree size: ${prev.length} root nodes`);
        Logger.info(`   Root handles: ${prev.map(n => `${n.handle}:${n.name}`).join(', ')}`);
        
        // Recursively find and update parent node with children
        const updateNodeWithChildren = (nodes: SceneNode[], depth = 0): SceneNode[] => {
          return nodes.map(node => {
            if (node.handle === parent.handle) {
              // Found the parent - add children
              Logger.info(`✅ UI: Found parent at depth ${depth}: "${node.name}" (${node.handle}), adding ${children.length} children`);
              return { ...node, children };
            }
            if (node.children && node.children.length > 0) {
              // Recursively check children
              return { ...node, children: updateNodeWithChildren(node.children, depth + 1) };
            }
            return node;
          });
        };
        
        const updated = updateNodeWithChildren(prev);
        Logger.info(`🔄 UI: Tree updated, new tree size: ${updated.length}, triggering onSceneTreeChange`);
        
        // Log first node's children count
        if (updated.length > 0) {
          Logger.info(`   First node "${updated[0].name}" now has ${updated[0].children?.length || 0} children`);
        }
        
        // 🎯 CRITICAL: Auto-expand parent and children so they're visible
        const childHandles = children
          .map(c => c.handle)
          .filter((h): h is number => typeof h === 'number' && h !== 0);
        const handlesToExpand = [
          ...(parent.handle ? [parent.handle] : []),
          ...childHandles
        ];
        
        if (onExpandNodes && handlesToExpand.length > 0) {
          Logger.info(`🔓 UI: Auto-expanding ${handlesToExpand.length} nodes: ${handlesToExpand.join(', ')}`);
          onExpandNodes(handlesToExpand);
        }
        
        setTimeout(() => onSceneTreeChange?.(updated), 0);
        return updated;
      });
    };

    // Register progressive V1 event listeners
    if (FEATURES.PROGRESSIVE_LOADING && !FEATURES.PROGRESSIVE_LOADING_V2) {
      Logger.debug('🚀 useSceneTree: Registering PROGRESSIVE V1 event listeners');
      client.on('scene:nodeAdded', handleProgressiveNodeAdded);
      client.on('scene:level0Complete', handleLevel0Complete);
      client.on('scene:childrenLoaded', handleChildrenLoaded);
      Logger.debug('✅ useSceneTree: Progressive V1 event listeners registered');
    }

    // =================================================================
    // PROGRESSIVE LOADING V2 EVENTS (Visibility-aware)
    // =================================================================
    
    /**
     * V2: Progress updates with phase tracking
     */
    const handleV2Progress = (event: V2ProgressEvent) => {
      setLoadPhase(event.phase);
      Logger.debug(`📊 V2 Progress: ${event.phase} ${event.overallProgress.toFixed(0)}% - ${event.message}`);
    };
    
    /**
     * V2: Details loaded for a specific node
     */
    const handleV2DetailsLoaded = ({ handle, node, phase }: V2DetailsLoadedEvent) => {
      // Update the node in the tree with full details
      setSceneTree(prev => {
        const updateNode = (nodes: SceneNode[]): SceneNode[] => {
          return nodes.map(n => {
            if (n.handle === handle) {
              // Merge loaded details while preserving children
              return { ...n, ...node, children: n.children || node.children };
            }
            if (n.children?.length) {
              return { ...n, children: updateNode(n.children) };
            }
            return n;
          });
        };
        
        const updated = updateNode(prev);
        
        // Notify parent of tree change
        if (phase === LoadPhase.VISIBLE_FIRST) {
          // For visible nodes, update immediately
          setTimeout(() => onSceneTreeChange?.(updated), 0);
        }
        
        return updated;
      });
    };
    
    /**
     * V2: Scene complete - final update
     */
    const handleV2Complete = ({ totalNodes, elapsedMs }: { totalNodes: number; elapsedMs: number }) => {
      Logger.info(`✅ V2 Complete: ${totalNodes} nodes loaded in ${elapsedMs}ms`);
      setLoadPhase(LoadPhase.COMPLETE);
    };
    
    // Register V2 event listeners
    if (FEATURES.PROGRESSIVE_LOADING_V2) {
      Logger.debug('🚀 useSceneTree: Registering PROGRESSIVE V2 event listeners');
      client.on('scene:nodeAdded', handleProgressiveNodeAdded); // Reuse V1 handler for skeleton nodes
      client.on('scene:level0Complete', handleLevel0Complete);  // Reuse V1 handler
      client.on('scene:childrenLoaded', handleChildrenLoaded);  // Reuse V1 handler
      client.on('scene:v2:progress', handleV2Progress);
      client.on('scene:v2:detailsLoaded', handleV2DetailsLoaded);
      client.on('scene:v2:complete', handleV2Complete);
      Logger.debug('✅ useSceneTree: Progressive V2 event listeners registered');
    }

    // =================================================================
    // TRADITIONAL EVENTS (Always active for post-load operations)
    // =================================================================

    const handleNodeAdded = (event: NodeAddedEvent) => {
      Logger.debug('🌲 Traditional: Adding node incrementally:', event.node.name);
      setSceneTree(prev => {
        const updated = [...prev, event.node];
        // Schedule parent callback after state update completes
        setTimeout(() => onSceneTreeChange?.(updated), 0);
        return updated;
      });
    };

    const handleNodeDeleted = (event: NodeDeletedEvent) => {
      Logger.debug(
        '🌲 SceneOutliner: nodeDeleted event received, handle:',
        event.handle,
        'type:',
        typeof event.handle
      );
      setSceneTree(prev => {
        Logger.debug('🌲 SceneOutliner: Current tree has', prev.length, 'root nodes');
        Logger.debug(
          '🌲 SceneOutliner: Root handles:',
          prev.map(n => `${n.handle} (${typeof n.handle})`).join(', ')
        );

        // Optimized delete with structural sharing
        // Only creates new objects in the path to the deleted node
        // Keeps all other nodes unchanged (same reference) for React optimization
        const filterDeleted = (nodes: SceneNode[]): { updated: SceneNode[]; changed: boolean } => {
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
                  children: childResult.updated,
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

        Logger.debug(
          '🌲 SceneOutliner: Updated tree has',
          result.updated.length,
          'root nodes (was',
          prev.length,
          ')'
        );
        Logger.debug('✅ SceneOutliner: Structural sharing preserved unaffected nodes');

        // Schedule parent callback after state update completes
        setTimeout(() => {
          Logger.debug(
            '🌲 SceneOutliner: Calling onSceneTreeChange callback with',
            result.updated.length,
            'nodes'
          );
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
      // Remove progressive V1 event listeners (if they were registered)
      if (FEATURES.PROGRESSIVE_LOADING && !FEATURES.PROGRESSIVE_LOADING_V2) {
        Logger.debug('🔇 useSceneTree: Removing progressive V1 event listeners');
        client.off('scene:nodeAdded', handleProgressiveNodeAdded);
        client.off('scene:level0Complete', handleLevel0Complete);
        client.off('scene:childrenLoaded', handleChildrenLoaded);
      }
      
      // Remove progressive V2 event listeners
      if (FEATURES.PROGRESSIVE_LOADING_V2) {
        Logger.debug('🔇 useSceneTree: Removing progressive V2 event listeners');
        client.off('scene:nodeAdded', handleProgressiveNodeAdded);
        client.off('scene:level0Complete', handleLevel0Complete);
        client.off('scene:childrenLoaded', handleChildrenLoaded);
        client.off('scene:v2:progress', handleV2Progress);
        client.off('scene:v2:detailsLoaded', handleV2DetailsLoaded);
        client.off('scene:v2:complete', handleV2Complete);
      }
      
      // Remove traditional event listeners
      client.off('nodeAdded', handleNodeAdded);
      client.off('nodeDeleted', handleNodeDeleted);
      client.off('sceneTreeUpdated', handleSceneTreeUpdated);
    };
  }, [client, onSceneTreeChange, initializeExpansion]);

  // V2: Notify service of visible handles
  const updateVisibleHandles = useCallback((handles: number[]) => {
    if (FEATURES.PROGRESSIVE_LOADING_V2 && client) {
      visibleHandlesRef.current = handles;
      client.setVisibleHandles(handles);
      onVisibleRangeChange?.(handles);
    }
  }, [client, onVisibleRangeChange]);

  return {
    sceneTree,
    loading,
    loadPhase,
    updateVisibleHandles,
    loadSceneTree,
  };
}
