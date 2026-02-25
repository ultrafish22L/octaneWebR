/**
 * useSceneTree - Scene tree loading and event handling
 * Manages scene tree state, loading, and incremental updates.
 *
 * Loading modes:
 * - Traditional: Load entire scene synchronously, then render
 * - Progressive P: Single-pass loading with clean UI events at natural breakpoints
 *
 * Progressive P strategy:
 * - scene:nodeAdded fires once per level-1 node → Outliner shows immediately
 * - scene:childrenLoaded fires once per level-1 node (children fully loaded)
 *   → structural-sharing clone so Outliner expands subtree cleanly
 * - scene:structureComplete / scene:complete → final propagation to App/NodeGraph
 * - NO per-pin events, NO batching, NO deep-load queue
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

      if (!FEATURES.PROGRESSIVE_LOADING_P) {
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
      if (!FEATURES.PROGRESSIVE_LOADING_P) {
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
    } catch (error) {
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
    // PROGRESSIVE LOADING EVENTS (SceneServiceP)
    // =================================================================

    /**
     * Level-0 node added during load.
     * Only updates the Outliner's local tree state — does NOT propagate to
     * App/NodeGraph via onSceneTreeChange (that happens at milestones only).
     * This keeps per-node overhead minimal: one setSceneTree per node.
     *
     * If the node is a PT_RENDERTARGET, select it and activate it in the
     * render engine so the viewport + NodeInspector populate right away.
     */
    // Mutable flag captured in the event handler closure — NOT state, intentionally.
    // React state updates are async; a flag ensures we select exactly one render target
    // even if multiple PT_RENDERTARGET nodes arrive before the next render cycle.
    let hasSelectedRenderTarget = false;
    const handleProgressiveNodeAdded = ({ node, level }: { node: SceneNode; level: number }) => {
      if (level === 0) {
        setSceneTree(prev => {
          const updated = [...prev, node];
          // Propagate to App/NodeGraph so all panels update as nodes arrive
          setTimeout(() => onSceneTreeChange?.(updated), 0);
          return updated;
        });

        // Select the first RenderTarget as soon as it arrives
        if (!hasSelectedRenderTarget && node.type === 'PT_RENDERTARGET') {
          hasSelectedRenderTarget = true;
          onNodeSelect?.(node);

          // Activate in render engine (fire-and-forget)
          if (node.handle && node.handle !== -1 && client) {
            client
              .setRenderTargetNode(node.handle)
              .then(success => {
                if (success) {
                  Logger.debug(
                    `🎯 RenderTarget auto-selected: "${node.name}" (handle: ${node.handle})`
                  );
                }
              })
              .catch(err => {
                Logger.error('❌ Error activating render target:', err);
              });
          }
        }
      }
    };

    /**
     * Level 0 complete — all level-1 nodes created.
     * Initialize expansion so SceneRoot + PT_RENDERTARGET are expanded.
     * Propagate to App/NodeGraph now that all top-level nodes exist.
     */
    const handleLevel0Complete = ({ nodes }: { nodes: SceneNode[] }) => {
      setSceneTree(nodes);
      if (nodes.length > 0) initializeExpansion(nodes);
      onSceneTreeChange?.(nodes);
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
     * Only propagates to App for PT_RENDERTARGET (so NodeInspector updates).
     * The full propagation happens at structureComplete/complete.
     */
    const handleChildrenLoaded = ({
      parent,
      children,
    }: {
      parent: SceneNode;
      children: SceneNode[];
    }) => {
      Logger.debug(`📥 Children loaded for "${parent.name}": ${children.length} children`);

      setSceneTree(prev => {
        const updated = parent.handle ? clonePathToHandle(prev, parent.handle) : [...prev];

        // Propagate to App/NodeGraph so all panels update with new children
        setTimeout(() => onSceneTreeChange?.(updated), 0);

        return updated;
      });

      // Re-select the render target so NodeInspector refreshes with the
      // newly-loaded children/pins.
      if (hasSelectedRenderTarget && parent.type === 'PT_RENDERTARGET') {
        onNodeSelect?.(parent);
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

      setSceneTree(prev => {
        const updated = [...prev];
        onSceneTreeChange?.(updated);
        return updated;
      });
    };

    // Register progressive event listeners
    if (FEATURES.PROGRESSIVE_LOADING_P) {
      Logger.debug('🚀 useSceneTree: Registering progressive P event listeners');
      client.on('scene:nodeAdded', handleProgressiveNodeAdded);
      client.on('scene:level0Complete', handleLevel0Complete);
      client.on('scene:childrenLoaded', handleChildrenLoaded);
      client.on('scene:structureComplete', handleStructureComplete);
      client.on('scene:complete', handleSceneComplete);
      Logger.debug('✅ useSceneTree: Progressive P event listeners registered');
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
      Logger.debug('🌲 nodeDeleted handle:', event.handle);
      setSceneTree(prev => {
        // Optimized delete with structural sharing
        // Only creates new objects in the path to the deleted node
        // Keeps all other nodes unchanged (same reference) for React optimization
        const filterDeleted = (nodes: SceneNode[]): { updated: SceneNode[]; changed: boolean } => {
          let changed = false;
          const filtered: SceneNode[] = [];

          for (const node of nodes) {
            // If this is the node to delete, skip it
            if (node.handle === event.handle) {
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
          return prev; // Return same reference if nothing changed
        }

        // Schedule parent callback after state update completes
        setTimeout(() => onSceneTreeChange?.(result.updated), 0);
        return result.updated;
      });
    };

    const handleSceneTreeUpdated = (scene: { tree?: SceneNode[] }) => {
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
      if (FEATURES.PROGRESSIVE_LOADING_P) {
        client.off('scene:nodeAdded', handleProgressiveNodeAdded);
        client.off('scene:level0Complete', handleLevel0Complete);
        client.off('scene:childrenLoaded', handleChildrenLoaded);
        client.off('scene:structureComplete', handleStructureComplete);
        client.off('scene:complete', handleSceneComplete);
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
