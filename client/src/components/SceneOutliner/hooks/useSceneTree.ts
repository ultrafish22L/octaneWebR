/**
 * useSceneTree - Scene tree loading and event handling
 * Manages scene tree state, loading, and incremental updates
 * 
 * Supports both traditional and progressive scene loading:
 * - Traditional: Load entire scene, then render
 * - Progressive: Render nodes as they load (level 0 → pins → connections → deep nodes)
 * 
 * Updated: 2025-02-03 - Added progressive loading support
 */

import { useState, useEffect, useCallback } from 'react';
import { Logger } from '../../../utils/Logger';
import { useOctane } from '../../../hooks/useOctane';
import { SceneNode, NodeAddedEvent, NodeDeletedEvent } from '../../../services/OctaneClient';
import { FEATURES } from '../../../config/features';

interface UseSceneTreeProps {
  onSceneTreeChange?: (sceneTree: SceneNode[]) => void;
  onSyncStateChange?: (syncing: boolean) => void;
  onNodeSelect?: (node: SceneNode | null) => void;
  initializeExpansion: (tree: SceneNode[]) => void;
}

export function useSceneTree({
  onSceneTreeChange,
  onSyncStateChange,
  onNodeSelect,
  initializeExpansion,
}: UseSceneTreeProps) {
  const { client, connected } = useOctane();
  const [sceneTree, setSceneTree] = useState<SceneNode[]>([]);
  const [loading, setLoading] = useState(false);

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

      setSceneTree(tree);
      onSceneTreeChange?.(tree);

      // Initialize expansion map for virtual scrolling
      initializeExpansion(tree);

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
    const handleProgressiveNodeAdded = ({ node, level, parent }: any) => {
      if (!FEATURES.PROGRESSIVE_LOADING) return;
      
      Logger.debug(`🚀 Progressive: Node added at level ${level}: "${node.name}" (handle: ${node.handle})`);
      
      // Level 0 nodes: Add to root of tree
      if (level === 0) {
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
      }
      // Nested nodes: Will be handled by childrenLoaded event
    };

    /**
     * Progressive: Level 0 complete - replace tree with complete level 0 nodes
     * This ensures consistent state after all level 0 nodes are loaded
     */
    const handleLevel0Complete = ({ nodes }: { nodes: SceneNode[] }) => {
      if (!FEATURES.PROGRESSIVE_LOADING) return;
      
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
      if (!FEATURES.PROGRESSIVE_LOADING) return;
      
      Logger.debug(`🌲 Progressive: Children loaded for "${parent.name}": ${children.length} children`);
      
      setSceneTree(prev => {
        // Recursively find and update parent node with children
        const updateNodeWithChildren = (nodes: SceneNode[]): SceneNode[] => {
          return nodes.map(node => {
            if (node.handle === parent.handle) {
              // Found the parent - add children
              return { ...node, children };
            }
            if (node.children && node.children.length > 0) {
              // Recursively check children
              return { ...node, children: updateNodeWithChildren(node.children) };
            }
            return node;
          });
        };
        
        const updated = updateNodeWithChildren(prev);
        setTimeout(() => onSceneTreeChange?.(updated), 0);
        return updated;
      });
    };

    // Register progressive event listeners
    if (FEATURES.PROGRESSIVE_LOADING) {
      Logger.debug('🚀 useSceneTree: Registering PROGRESSIVE event listeners');
      client.on('scene:nodeAdded', handleProgressiveNodeAdded);
      client.on('scene:level0Complete', handleLevel0Complete);
      client.on('scene:childrenLoaded', handleChildrenLoaded);
      Logger.debug('✅ useSceneTree: Progressive event listeners registered');
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
      // Remove progressive event listeners (if they were registered)
      if (FEATURES.PROGRESSIVE_LOADING) {
        Logger.debug('🔇 useSceneTree: Removing progressive event listeners');
        client.off('scene:nodeAdded', handleProgressiveNodeAdded);
        client.off('scene:level0Complete', handleLevel0Complete);
        client.off('scene:childrenLoaded', handleChildrenLoaded);
      }
      
      // Remove traditional event listeners
      client.off('nodeAdded', handleNodeAdded);
      client.off('nodeDeleted', handleNodeDeleted);
      client.off('sceneTreeUpdated', handleSceneTreeUpdated);
    };
  }, [client, onSceneTreeChange, initializeExpansion]);

  return {
    sceneTree,
    loading,
    loadSceneTree,
  };
}
