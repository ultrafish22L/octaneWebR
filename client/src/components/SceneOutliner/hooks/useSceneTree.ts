/**
 * useSceneTree - Scene tree loading and event handling
 * Manages scene tree state, loading, and incremental updates.
 *
 * Loading modes:
 * - Traditional: Load entire scene synchronously, then render
 * - Progressive P: Single-pass loading with clean UI events at natural breakpoints
 * - Progressive V3: Two-pass loading with per-pin emission (legacy)
 *
 * Progressive P strategy:
 * - scene:nodeAdded fires once per level-1 node → Outliner shows immediately
 * - scene:childrenLoaded fires once per level-1 node (children fully loaded)
 *   → structural-sharing clone so Outliner expands subtree cleanly
 * - scene:structureComplete / scene:complete → final propagation to App/NodeGraph
 * - NO per-pin events, NO batching, NO deep-load queue
 *
 * Pin update strategy (V3 legacy):
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

/** True when either progressive mode is active */
const PROGRESSIVE_ACTIVE = FEATURES.PROGRESSIVE_LOADING_P || FEATURES.PROGRESSIVE_LOADING_V3;

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

      if (!PROGRESSIVE_ACTIVE) {
        // Traditional synchronous loading — set tree from result
        setSceneTree(tree);
        onSceneTreeChange?.(tree);
        initializeExpansion(tree);
      } else if (tree.length > 0) {
        // Progressive (P or V3) — tree was already populated via events.
        // Just ensure expansion map is initialized with final tree.
        initializeExpansion(tree);
      }

      Logger.debug(`✅ Loaded ${tree.length} top-level items`);

      // Auto-select render target node after scene is loaded.
      // For progressive loading, this already happened in handleProgressiveNodeAdded
      // as soon as the RT node arrived. Only run for traditional loading.
      if (!PROGRESSIVE_ACTIVE) {
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
    // PROGRESSIVE LOADING EVENTS (shared by P and V3)
    // Both services emit the same event names. Handlers are identical
    // except V3 also needs scene:pinAdded (no-op) and scene:nodeUpdated
    // (batched). P doesn't emit those so the handlers are never called.
    // =================================================================

    /**
     * Level-0 node added during load.
     * Uses flushSync so top-level nodes appear in the Outliner immediately.
     * If the node is a PT_RENDERTARGET, select it and activate it in the
     * render engine so the viewport + NodeInspector populate right away.
     */
    let hasSelectedRenderTarget = false;
    const handleProgressiveNodeAdded = ({ node, level }: any) => {
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
     * Level 0 complete — all level-1 nodes created.
     * Initialize expansion so SceneRoot + PT_RENDERTARGET are expanded.
     */
    const handleLevel0Complete = ({ nodes }: { nodes: SceneNode[] }) => {
      setSceneTree(nodes);
      if (nodes.length > 0) initializeExpansion(nodes);
      setTimeout(() => onSceneTreeChange?.(nodes), 0);
    };

    /**
     * Structural sharing helper: clone only the path from root to the target node.
     * React sees new references along the path → re-renders only affected subtrees.
     * All sibling nodes keep their original references (no re-render).
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
     * All direct children loaded for a parent node.
     * Children are already attached to parent.children by the service.
     * We create new node references along the path so React detects the change
     * and the Outliner re-renders only the affected subtree.
     *
     * For SceneServiceP: this fires once per level-1 node after ALL its children
     * (recursive) are fully loaded. Clean, single update — no flashing.
     *
     * For V3: this fires per-parent after immediate children are done.
     * We do NOT call onSceneTreeChange here for V3 — NodeGraph only needs
     * updates at milestones (structureComplete, complete).
     */
    const handleChildrenLoaded = ({ parent, children }: { parent: SceneNode; children: SceneNode[] }) => {
      Logger.debug(`📥 Children loaded for "${parent.name}": ${children.length} children`);

      setSceneTree(prev => {
        const updated = parent.handle
          ? clonePathToHandle(prev, parent.handle)
          : [...prev];

        // For SceneServiceP: the children are FULLY loaded (recursive), so it's
        // safe to propagate to App now. The render target's pins will show in the
        // NodeInspector as soon as its children are loaded — no waiting for
        // structureComplete.
        if (FEATURES.PROGRESSIVE_LOADING_P) {
          setTimeout(() => onSceneTreeChange?.(updated), 0);
        }

        return updated;
      });

      // Re-select the render target so NodeInspector refreshes with the
      // newly-loaded children/pins. This gives immediate feedback as
      // the selected RT's data becomes available.
      if (FEATURES.PROGRESSIVE_LOADING_P && hasSelectedRenderTarget && parent.type === 'PT_RENDERTARGET') {
        onNodeSelect?.(parent);
      }
    };

    /**
     * V3 only: Per-pin progressive update (no-op).
     * SceneServiceP doesn't emit this event.
     */
    const handlePinAdded = () => {
      // No-op: pin updates are batched into scene:childrenLoaded
    };

    /**
     * V3 only: Node updated with attrInfo.
     * Batches rapid updates into one Outliner refresh per 300ms.
     * SceneServiceP loads attrInfo during the recursive pass so this isn't needed.
     */
    let nodeUpdatedTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleNodeUpdated = ({ node: _node }: { node: SceneNode }) => {
      if (nodeUpdatedTimeout === null) {
        nodeUpdatedTimeout = setTimeout(() => {
          nodeUpdatedTimeout = null;
          setSceneTree(prev => [...prev]); // shallow copy for Outliner only
        }, 300);
      }
    };

    /**
     * Structure complete — entire tree built (P) or Pass 1 done (V3).
     * Propagate to App → NodeGraph rebuilds edges.
     */
    const handleStructureComplete = () => {
      Logger.debug('✅ Structure complete');

      setSceneTree(prev => {
        const updated = [...prev];
        onSceneTreeChange?.(updated);
        return updated;
      });
    };

    /**
     * Scene complete — final signal. Ensure consistency.
     */
    const handleSceneComplete = () => {
      Logger.info('✅ Scene load complete');

      // Flush any pending V3 nodeUpdated batch
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

    // Register progressive event listeners (both P and V3 use same event names)
    if (PROGRESSIVE_ACTIVE) {
      const mode = FEATURES.PROGRESSIVE_LOADING_P ? 'P' : 'V3';
      Logger.debug(`🚀 useSceneTree: Registering PROGRESSIVE ${mode} event listeners`);
      client.on('scene:nodeAdded', handleProgressiveNodeAdded);
      client.on('scene:level0Complete', handleLevel0Complete);
      client.on('scene:childrenLoaded', handleChildrenLoaded);
      client.on('scene:structureComplete', handleStructureComplete);
      client.on('scene:complete', handleSceneComplete);

      // V3-only events (harmless to register for P — they just won't fire)
      if (FEATURES.PROGRESSIVE_LOADING_V3) {
        client.on('scene:pinAdded', handlePinAdded);
        client.on('scene:nodeUpdated', handleNodeUpdated);
      }

      Logger.debug(`✅ useSceneTree: Progressive ${mode} event listeners registered`);
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
      // Remove progressive event listeners
      if (PROGRESSIVE_ACTIVE) {
        client.off('scene:nodeAdded', handleProgressiveNodeAdded);
        client.off('scene:level0Complete', handleLevel0Complete);
        client.off('scene:childrenLoaded', handleChildrenLoaded);
        client.off('scene:structureComplete', handleStructureComplete);
        client.off('scene:complete', handleSceneComplete);

        if (FEATURES.PROGRESSIVE_LOADING_V3) {
          client.off('scene:pinAdded', handlePinAdded);
          client.off('scene:nodeUpdated', handleNodeUpdated);
          if (nodeUpdatedTimeout !== null) clearTimeout(nodeUpdatedTimeout);
        }
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
