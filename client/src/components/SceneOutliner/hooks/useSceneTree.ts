/**
 * useSceneTree - Scene tree loading and event handling
 * Manages scene tree state, loading, and incremental updates.
 *
 * Loading modes:
 * - Traditional: Load entire scene synchronously, then render
 * - Progressive V3: Two-pass loading with per-pin emission (recommended)
 *
 * Pin update strategy (V3):
 * - scene:pinAdded only propagates via onSceneTreeChange (NodeGraph, NodeInspector)
 * - The outliner tree state is NOT re-set on every pin; instead, only
 *   scene:childrenLoaded triggers a structural-sharing clone that React can detect.
 *   This prevents the outliner from re-rendering collapsed subtrees on every pin.
 */

import { useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
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

      if (!FEATURES.PROGRESSIVE_LOADING_V3) {
        // Traditional synchronous loading — set tree from result
        setSceneTree(tree);
        onSceneTreeChange?.(tree);
        initializeExpansion(tree);
      } else if (tree.length > 0) {
        // V3 progressive — tree was already populated via events.
        // Just ensure expansion map is initialized with final tree.
        initializeExpansion(tree);
      }

      Logger.debug(`✅ Loaded ${tree.length} top-level items`);

      // Auto-select render target node after scene is loaded.
      // For V3 progressive loading, this already happened in handleProgressiveNodeAdded
      // as soon as the RT node arrived. Only run for traditional loading.
      if (!FEATURES.PROGRESSIVE_LOADING_V3) {
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
    // PROGRESSIVE LOADING V3 EVENTS (Two-pass with per-pin emission)
    // =================================================================

    /**
     * V3: Individual level-0 node added during initial load.
     * Uses flushSync so top-level nodes appear immediately.
     * If the node is a PT_RENDERTARGET, select it immediately and activate
     * it in the render engine so the NodeInspector populates right away.
     */
    let hasSelectedRenderTarget = false;
    const handleProgressiveNodeAdded = ({ node, level }: any) => {
      if (!FEATURES.PROGRESSIVE_LOADING_V3) return;

      if (level === 0) {
        flushSync(() => {
          setSceneTree(prev => {
            if (prev.some(n => n.handle === node.handle)) return prev;
            const updated = [...prev, node];
            setTimeout(() => onSceneTreeChange?.(updated), 0);
            return updated;
          });
        });

        // Select the first RenderTarget as soon as it arrives
        if (!hasSelectedRenderTarget && node.type === 'PT_RENDERTARGET') {
          hasSelectedRenderTarget = true;
          onNodeSelect?.(node);

          // Activate in render engine (fire-and-forget)
          if (node.handle && node.handle !== -1 && client) {
            client.setRenderTargetNode(node.handle).then(success => {
              if (success) {
                Logger.debug(`🎯 RenderTarget auto-selected: "${node.name}" (handle: ${node.handle})`);
              }
            }).catch(err => {
              Logger.error('❌ Error activating render target:', err);
            });
          }
        }
      }
    };

    /**
     * V3: Level 0 complete — replace tree with complete level-0 nodes.
     * Initialize expansion immediately (not in setTimeout) so SceneRoot +
     * PT_RENDERTARGET are expanded before the next render.
     */
    const handleLevel0Complete = ({ nodes }: { nodes: SceneNode[] }) => {
      if (!FEATURES.PROGRESSIVE_LOADING_V3) return;

      setSceneTree(nodes);
      if (nodes.length > 0) initializeExpansion(nodes);
      setTimeout(() => onSceneTreeChange?.(nodes), 0);
    };

    /**
     * V3: Per-pin progressive update.
     * Service has already pushed the child to parent.children (mutated in place).
     *
     * We do NOT propagate pin-level updates to App.tsx. Doing so would:
     * 1. Cause the Outliner to re-render (flashing) if we call setSceneTree
     * 2. Cause the NodeGraph MiniMap to flash via sceneTree prop changes
     *
     * Instead, the data flow for pin updates is:
     * - scene:childrenLoaded → structural-sharing clone → Outliner + App.tsx update
     * - scene:structureComplete / scene:complete → NodeGraph full rebuild
     * - NodeInspector updates via handleChildrenLoadedV3 propagation
     *
     * This handler is a no-op — the service mutates in place, and we batch
     * the visual update to scene:childrenLoaded.
     */
    const handlePinAdded = () => {
      // No-op: pin updates are batched into scene:childrenLoaded
    };

    /**
     * Structural sharing helper: clone only the path from root to the target node.
     * React sees new references along the path → re-renders only affected subtrees.
     */
    const clonePathToHandle = (nodes: SceneNode[], targetHandle: number): SceneNode[] => {
      return nodes.map(node => {
        if (node.handle === targetHandle) {
          return { ...node, children: node.children ? [...node.children] : [] };
        }
        if (node.children && node.children.length > 0) {
          const cloned = clonePathToHandle(node.children, targetHandle);
          if (cloned !== node.children) {
            return { ...node, children: cloned };
          }
        }
        return node;
      });
    };

    /**
     * V3: All direct children loaded for a parent.
     * Children are already attached to parent.children by the service (mutated in place).
     * We create new node references along the path from root to the changed parent
     * so React detects the change and the Outliner re-renders affected subtrees.
     *
     * We do NOT call onSceneTreeChange here — that would propagate to App.tsx →
     * NodeGraph prop change → MiniMap re-render on every single parent's children.
     * The NodeGraph has its own event listeners and only needs updates at milestones
     * (structureComplete, complete). NodeInspector gets refreshed at those milestones too.
     */
    const handleChildrenLoadedV3 = ({ parent, children }: { parent: SceneNode; children: SceneNode[] }) => {
      if (!FEATURES.PROGRESSIVE_LOADING_V3) return;

      Logger.debug(`📥 V3: Children loaded for "${parent.name}": ${children.length} children`);

      setSceneTree(prev => {
        return parent.handle
          ? clonePathToHandle(prev, parent.handle)
          : [...prev];
      });
    };

    /**
     * V3: Node updated with attrInfo (or other metadata).
     * The service mutated the node in place. We batch these updates and
     * propagate a single shallow copy at most every 300ms so the Outliner
     * picks up any visual changes (e.g. attrInfo-based rendering).
     *
     * We do NOT call onSceneTreeChange here — NodeGraph/MiniMap don't need
     * per-node attrInfo updates. They get refreshed at structureComplete/complete.
     */
    let nodeUpdatedTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleNodeUpdated = ({ node: _node }: { node: SceneNode }) => {
      if (!FEATURES.PROGRESSIVE_LOADING_V3) return;

      // Batch: coalesce rapid attrInfo updates into one Outliner refresh
      if (nodeUpdatedTimeout === null) {
        nodeUpdatedTimeout = setTimeout(() => {
          nodeUpdatedTimeout = null;
          setSceneTree(prev => [...prev]); // shallow copy for Outliner only
        }, 300);
      }
    };

    /**
     * V3: Pass 1 structure complete — rebuild NodeGraph with edges.
     */
    const handleStructureComplete = () => {
      if (!FEATURES.PROGRESSIVE_LOADING_V3) return;
      Logger.debug('✅ V3: Structure complete (Pass 1 done)');

      setSceneTree(prev => {
        const updated = [...prev];
        onSceneTreeChange?.(updated);
        return updated;
      });
    };

    /**
     * V3: Scene complete — final re-render to ensure consistency.
     * Create a shallow copy so that the Outliner picks up any remaining
     * children that were mutated in place during Pass 2.
     */
    const handleSceneComplete = () => {
      if (!FEATURES.PROGRESSIVE_LOADING_V3) return;
      Logger.info('✅ V3: Scene load complete');

      // Flush any pending nodeUpdated batch
      if (nodeUpdatedTimeout !== null) {
        clearTimeout(nodeUpdatedTimeout);
        nodeUpdatedTimeout = null;
      }

      setSceneTree(prev => {
        const updated = [...prev];
        onSceneTreeChange?.(updated);
        return updated;
      });
    };

    // Register V3 event listeners
    if (FEATURES.PROGRESSIVE_LOADING_V3) {
      Logger.debug('🚀 useSceneTree: Registering PROGRESSIVE V3 event listeners');
      client.on('scene:nodeAdded', handleProgressiveNodeAdded);
      client.on('scene:level0Complete', handleLevel0Complete);
      client.on('scene:pinAdded', handlePinAdded);
      client.on('scene:childrenLoaded', handleChildrenLoadedV3);
      client.on('scene:nodeUpdated', handleNodeUpdated);
      client.on('scene:structureComplete', handleStructureComplete);
      client.on('scene:complete', handleSceneComplete);
      Logger.debug('✅ useSceneTree: Progressive V3 event listeners registered');
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
      // Remove V3 progressive event listeners
      if (FEATURES.PROGRESSIVE_LOADING_V3) {
        client.off('scene:nodeAdded', handleProgressiveNodeAdded);
        client.off('scene:level0Complete', handleLevel0Complete);
        client.off('scene:pinAdded', handlePinAdded);
        client.off('scene:childrenLoaded', handleChildrenLoadedV3);
        client.off('scene:nodeUpdated', handleNodeUpdated);
        client.off('scene:structureComplete', handleStructureComplete);
        client.off('scene:complete', handleSceneComplete);
        if (nodeUpdatedTimeout !== null) clearTimeout(nodeUpdatedTimeout);
      }

      // Remove traditional event listeners
      client.off('nodeAdded', handleNodeAdded);
      client.off('nodeDeleted', handleNodeDeleted);
      client.off('sceneTreeUpdated', handleSceneTreeUpdated);
    };
  }, [client, onSceneTreeChange, onNodeSelect, initializeExpansion]);

  return {
    sceneTree,
    loading,
    loadSceneTree,
  };
}
