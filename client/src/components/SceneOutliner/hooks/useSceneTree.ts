/**
 * useSceneTree - Scene tree loading and event handling
 * Manages scene tree state, loading, and incremental updates.
 *
 * Progressive loading strategy:
 * - scene:nodeAdded fires once per level-1 node → Outliner shows immediately
 * - scene:childrenLoaded fires once per level-1 node (children fully loaded)
 *   → structural-sharing clone so Outliner expands subtree cleanly
 * - scene:structureComplete / scene:complete → final propagation to App/NodeGraph
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Logger } from '../../../utils/Logger';
import { useOctane } from '../../../hooks/useOctane';
import { SceneNode, NodeAddedEvent, NodeDeletedEvent } from '../../../services/OctaneClient';

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
  // Start with loading=true so the skeleton shows immediately on mount.
  // The hook only mounts when connected (component remounts on refresh),
  // so true is the correct initial state. loadSceneTree() sets it false when done.
  const [loading, setLoading] = useState(true);

  // Stable refs for callback props — prevents event listener re-registration
  // when parent re-renders with new callback references
  const onSceneTreeChangeRef = useRef(onSceneTreeChange);
  onSceneTreeChangeRef.current = onSceneTreeChange;
  const onSyncStateChangeRef = useRef(onSyncStateChange);
  onSyncStateChangeRef.current = onSyncStateChange;
  const onNodeSelectRef = useRef(onNodeSelect);
  onNodeSelectRef.current = onNodeSelect;
  const initializeExpansionRef = useRef(initializeExpansion);
  initializeExpansionRef.current = initializeExpansion;

  // Propagate scene tree changes to parent after render completes.
  // This replaces all setTimeout(0) workarounds — useEffect runs after
  // React commits, so calling parent setState here is safe.
  const prevTreeRef = useRef<SceneNode[]>(sceneTree);
  useEffect(() => {
    if (sceneTree !== prevTreeRef.current) {
      prevTreeRef.current = sceneTree;
      onSceneTreeChangeRef.current?.(sceneTree);
    }
  }, [sceneTree]);

  // Load scene tree from Octane
  const loadSceneTree = useCallback(async () => {
    if (!connected || !client) {
      return;
    }

    Logger.debug('Loading scene tree from Octane...');
    setLoading(true);
    onSyncStateChangeRef.current?.(true);

    try {
      const tree = await client.buildSceneTree();

      // Progressive — tree was already populated via events.
      // Just ensure expansion map is initialized with final tree.
      if (tree.length > 0) {
        initializeExpansionRef.current(tree);
      }

      Logger.debug(`Loaded ${tree.length} top-level items`);
    } catch (error) {
      Logger.error('Failed to load scene tree:', error);
    } finally {
      setLoading(false);
      onSyncStateChangeRef.current?.(false);
    }
  }, [connected, client]);

  // Auto-load on connect
  useEffect(() => {
    if (connected && client) {
      loadSceneTree();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only trigger on connection state change
  }, [connected, client]);

  // Listen for incremental node additions and deletions
  useEffect(() => {
    if (!client) return;

    // =================================================================
    // PROGRESSIVE LOADING EVENTS
    // =================================================================

    /**
     * Level-0 node added during load.
     * Updates Outliner's local tree state. Parent propagation happens
     * automatically via the useEffect above.
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
        setSceneTree(prev => [...prev, node]);

        // Select the first RenderTarget as soon as it arrives
        if (!hasSelectedRenderTarget && node.type === 'PT_RENDERTARGET') {
          hasSelectedRenderTarget = true;
          onNodeSelectRef.current?.(node);

          // Activate in render engine (fire-and-forget)
          if (node.handle && node.handle !== -1 && client) {
            client
              .setRenderTargetNode(node.handle)
              .then(success => {
                if (success) {
                  Logger.debug(
                    `RenderTarget auto-selected: "${node.name}" (handle: ${node.handle})`
                  );
                }
              })
              .catch(err => {
                Logger.error('Error activating render target:', err);
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
      if (nodes.length > 0) initializeExpansionRef.current(nodes);
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
     */
    const handleChildrenLoaded = ({
      parent,
      children,
    }: {
      parent: SceneNode;
      children: SceneNode[];
    }) => {
      Logger.debug(`Children loaded for "${parent.name}": ${children.length} children`);

      setSceneTree(prev => (parent.handle ? clonePathToHandle(prev, parent.handle) : [...prev]));

      // Re-select the render target so NodeInspector refreshes with the
      // newly-loaded children/pins.
      if (hasSelectedRenderTarget && parent.type === 'PT_RENDERTARGET') {
        onNodeSelectRef.current?.(parent);
      }
    };

    /**
     * Structure complete — entire tree built.
     * Force a new reference so useEffect propagates to App → NodeGraph rebuilds edges.
     */
    const handleStructureComplete = () => {
      Logger.debug('Structure complete');
      setSceneTree(prev => [...prev]);
    };

    /**
     * Scene complete — final signal. Ensure consistency.
     */
    const handleSceneComplete = () => {
      Logger.info('Scene load complete');
      setSceneTree(prev => [...prev]);
    };

    // Register progressive event listeners
    client.on('scene:nodeAdded', handleProgressiveNodeAdded);
    client.on('scene:level0Complete', handleLevel0Complete);
    client.on('scene:childrenLoaded', handleChildrenLoaded);
    client.on('scene:structureComplete', handleStructureComplete);
    client.on('scene:complete', handleSceneComplete);

    // =================================================================
    // POST-LOAD EVENTS (nodeAdded/nodeDeleted for runtime operations)
    // =================================================================

    const handleNodeAdded = (event: NodeAddedEvent) => {
      Logger.debug('Adding node incrementally:', event.node.name);
      setSceneTree(prev => [...prev, event.node]);
    };

    const handleNodeDeleted = (event: NodeDeletedEvent) => {
      Logger.debug('nodeDeleted handle:', event.handle);
      setSceneTree(prev => {
        // Optimized delete with structural sharing
        // Only creates new objects in the path to the deleted node
        // Keeps all other nodes unchanged (same reference) for React optimization
        const filterDeleted = (nodes: SceneNode[]): { updated: SceneNode[]; changed: boolean } => {
          let changed = false;
          const filtered: SceneNode[] = [];

          for (const node of nodes) {
            if (node.handle === event.handle) {
              changed = true;
              continue;
            }

            if (node.children && node.children.length > 0) {
              const childResult = filterDeleted(node.children);

              if (childResult.changed) {
                filtered.push({
                  ...node,
                  children: childResult.updated,
                });
                changed = true;
              } else {
                filtered.push(node);
              }
            } else {
              filtered.push(node);
            }
          }

          return { updated: filtered, changed };
        };

        const result = filterDeleted(prev);
        return result.changed ? result.updated : prev;
      });
    };

    const handleSceneTreeUpdated = (scene: { tree?: SceneNode[] }) => {
      Logger.debug('SceneOutliner: Full scene tree update');
      setSceneTree(scene.tree || []);
    };

    client.on('nodeAdded', handleNodeAdded);
    client.on('nodeDeleted', handleNodeDeleted);
    client.on('sceneTreeUpdated', handleSceneTreeUpdated);

    return () => {
      client.off('scene:nodeAdded', handleProgressiveNodeAdded);
      client.off('scene:level0Complete', handleLevel0Complete);
      client.off('scene:childrenLoaded', handleChildrenLoaded);
      client.off('scene:structureComplete', handleStructureComplete);
      client.off('scene:complete', handleSceneComplete);
      client.off('nodeAdded', handleNodeAdded);
      client.off('nodeDeleted', handleNodeDeleted);
      client.off('sceneTreeUpdated', handleSceneTreeUpdated);
    };
  }, [client]);

  return {
    sceneTree,
    loading,
    loadSceneTree,
  };
}
