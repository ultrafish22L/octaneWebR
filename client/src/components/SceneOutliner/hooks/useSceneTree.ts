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
import { requestQueue } from '../../../utils/RequestQueue';
import { cacheManager } from '../../../services/CacheManager';

/**
 * Deep-clone a SceneNode tree, breaking shared object references from the
 * scene map.  Tracks visited handles to break cycles — if the same handle
 * appears twice in a traversal path, its children are omitted on the second
 * visit (the node itself is still included so the outliner can show it).
 */
function deepCloneNode(node: SceneNode, visited?: Set<number | undefined>): SceneNode {
  const seen = visited ?? new Set<number | undefined>();
  if (node.handle != null && seen.has(node.handle)) {
    // Cycle detected — return a shallow copy with no children to break the loop
    return { ...node, children: [] };
  }
  if (node.handle != null) seen.add(node.handle);
  return {
    ...node,
    children: node.children ? node.children.map(c => deepCloneNode(c, seen)) : [],
  };
}

interface UseSceneTreeProps {
  onSceneTreeChange?: (sceneTree: SceneNode[]) => void;
  onSyncStateChange?: (syncing: boolean) => void;
  onNodeSelect?: (node: SceneNode | null) => void;
  selectedNode?: SceneNode | null;
  initializeExpansion: (tree: SceneNode[]) => void;
}

export function useSceneTree({
  onSceneTreeChange,
  onSyncStateChange,
  onNodeSelect,
  selectedNode,
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
  const selectedNodeRef = useRef(selectedNode);
  selectedNodeRef.current = selectedNode;
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

  // Load scene tree from Octane (retries if server protos aren't ready yet)
  const loadSceneTree = useCallback(async () => {
    if (!connected || !client) {
      return;
    }

    Logger.debug('Loading scene tree from Octane...');
    setLoading(true);
    onSyncStateChangeRef.current?.(true);

    // Cancel any pending inspector queries from previous selections.
    // Without this, hundreds of stale getByAttrID calls can run concurrently
    // with the tree build and overwhelm Octane (BUG-R3-2).
    requestQueue.clear();
    cacheManager.clear();

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
    // Deferred render target: activate in render engine immediately (for viewport),
    // but delay inspector selection until tree build is complete (BUG-R3-2).
    // This prevents hundreds of getByAttrID calls from firing during tree build.
    let pendingRenderTarget: SceneNode | null = null;

    const handleProgressiveNodeAdded = ({ node, level }: { node: SceneNode; level: number }) => {
      if (level === 0) {
        // Append each node so it pops into the outliner progressively.
        // The listKey fix (no lastKey check) keeps the List mounted —
        // react-window handles rowCount increases natively, no flash.
        setSceneTree(prev => [...prev, node]);

        // Activate the first RenderTarget in the render engine immediately
        // so the viewport shows the render, but DON'T select it in the
        // inspector yet — that triggers hundreds of getByAttrID calls.
        if (!hasSelectedRenderTarget && node.type === 'PT_RENDERTARGET') {
          hasSelectedRenderTarget = true;
          pendingRenderTarget = node;

          // Activate in render engine (fire-and-forget)
          if (node.handle && node.handle !== -1 && client) {
            client
              .setRenderTargetNode(node.handle)
              .then(success => {
                if (success) {
                  Logger.debug(`RenderTarget activated: "${node.name}" (handle: ${node.handle})`);
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
     * This is the single commit point for all top-level nodes.
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
    const clonePathToHandle = (
      nodes: SceneNode[],
      targetHandle: number,
      visited?: Set<number | undefined>
    ): SceneNode[] => {
      const seen = visited ?? new Set<number | undefined>();
      return nodes.map(node => {
        // Cycle detection: skip children if we've already visited this handle
        if (node.handle != null && seen.has(node.handle)) return node;
        if (node.handle != null) seen.add(node.handle);

        if (node.handle === targetHandle) {
          return { ...node, children: node.children ? [...node.children] : [] };
        }
        if (node.children && node.children.length > 0) {
          const cloned = clonePathToHandle(node.children, targetHandle, seen);
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
     * Batched: collect parent handles for 200ms then flush once, cloning
     * all affected paths in a single setState. Without this, each of hundreds
     * of childrenLoaded events triggers a separate re-render.
     */
    let childrenHandleBuffer: Set<number> = new Set();
    let childrenFlushTimer: ReturnType<typeof setTimeout> | null = null;
    const flushChildrenBuffer = () => {
      childrenFlushTimer = null;
      if (childrenHandleBuffer.size === 0) return;
      const handles = childrenHandleBuffer;
      childrenHandleBuffer = new Set();
      setSceneTree(prev => {
        let result = prev;
        for (const handle of handles) {
          result = clonePathToHandle(result, handle);
        }
        return result;
      });
    };

    const handleChildrenLoaded = ({
      parent,
      children,
    }: {
      parent: SceneNode;
      children: SceneNode[];
    }) => {
      Logger.debug(`Children loaded for "${parent.name}": ${children.length} children`);

      if (parent.handle) {
        childrenHandleBuffer.add(parent.handle);
        if (!childrenFlushTimer) {
          childrenFlushTimer = setTimeout(flushChildrenBuffer, 200);
        }
      }

      // Update pending render target with the fully-loaded version (has children/pins).
      // Don't select in inspector yet — wait for structureComplete (BUG-R3-2).
      if (hasSelectedRenderTarget && parent.type === 'PT_RENDERTARGET') {
        pendingRenderTarget = parent;
      }
    };

    /**
     * Structure complete — entire tree built.
     * Flush any pending batched children, then force a new reference
     * so useEffect propagates to App → NodeGraph rebuilds edges.
     */
    const handleStructureComplete = () => {
      Logger.debug('Structure complete');
      // Flush pending children batch before final propagation
      if (childrenFlushTimer) {
        clearTimeout(childrenFlushTimer);
        childrenFlushTimer = null;
      }
      if (childrenHandleBuffer.size > 0) {
        const handles = childrenHandleBuffer;
        childrenHandleBuffer = new Set();
        setSceneTree(prev => {
          let result = prev;
          for (const handle of handles) {
            result = clonePathToHandle(result, handle);
          }
          return [...result];
        });
      } else {
        setSceneTree(prev => [...prev]);
      }

      // Now that the tree is fully built, select the render target in the
      // inspector. This is when inspector getByAttrID queries are safe to run
      // because the tree build is done and Octane is no longer being hammered
      // with concurrent structure queries (BUG-R3-2).
      if (pendingRenderTarget) {
        onNodeSelectRef.current?.(pendingRenderTarget);
        pendingRenderTarget = null;
      }
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
        // Uses visited set to prevent infinite recursion from shared SceneNode refs
        const filterDeleted = (
          nodes: SceneNode[],
          visited?: Set<number | undefined>
        ): { updated: SceneNode[]; changed: boolean } => {
          const seen = visited ?? new Set<number | undefined>();
          let changed = false;
          const filtered: SceneNode[] = [];

          for (const node of nodes) {
            if (node.handle === event.handle) {
              changed = true;
              continue;
            }

            // Cycle detection: if we've already visited this handle, keep node as-is
            if (node.handle != null && seen.has(node.handle)) {
              filtered.push(node);
              continue;
            }
            if (node.handle != null) seen.add(node.handle);

            if (node.children && node.children.length > 0) {
              const childResult = filterDeleted(node.children, seen);

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
      const newTree = scene.tree || [];
      setSceneTree(newTree);

      // Re-resolve selectedNode from the new tree so the inspector
      // gets the fresh (complete) node object instead of a stale reference.
      const selHandle = selectedNodeRef.current?.handle;
      if (selHandle) {
        const findByHandle = (
          nodes: SceneNode[],
          visited?: Set<number | undefined>
        ): SceneNode | null => {
          const seen = visited ?? new Set<number | undefined>();
          for (const n of nodes) {
            if (n.handle === selHandle) return n;
            if (n.handle != null && seen.has(n.handle)) continue;
            if (n.handle != null) seen.add(n.handle);
            if (n.children) {
              const found = findByHandle(n.children, seen);
              if (found) return found;
            }
          }
          return null;
        };
        const fresh = findByHandle(newTree);
        if (fresh) {
          Logger.debug(`Re-selecting node ${selHandle} from rebuilt tree`);
          onNodeSelectRef.current?.(fresh);
        }
      }
    };

    client.on('nodeAdded', handleNodeAdded);
    client.on('nodeDeleted', handleNodeDeleted);
    client.on('sceneTreeUpdated', handleSceneTreeUpdated);

    // MCP live sync: external MCP tools modify the scene via a separate gRPC connection.
    // Strategy: incremental add/delete (instant), debounced rebuild for connects only.

    // Structural sharing delete helper (reused by MCP delete + post-load delete)
    // Uses visited set to prevent infinite recursion from shared SceneNode refs
    const filterDeleted = (
      nodes: SceneNode[],
      targetHandle: number,
      visited?: Set<number | undefined>
    ): { updated: SceneNode[]; changed: boolean } => {
      const seen = visited ?? new Set<number | undefined>();
      let changed = false;
      const filtered: SceneNode[] = [];
      for (const node of nodes) {
        if (node.handle === targetHandle) {
          changed = true;
          continue;
        }
        // Cycle detection: if we've already visited this handle, keep node as-is
        if (node.handle != null && seen.has(node.handle)) {
          filtered.push(node);
          continue;
        }
        if (node.handle != null) seen.add(node.handle);

        if (node.children && node.children.length > 0) {
          const childResult = filterDeleted(node.children, targetHandle, seen);
          if (childResult.changed) {
            filtered.push({ ...node, children: childResult.updated });
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

    // ─── MCP live sync handlers ──────────────────────────────────────
    // Uses buildNewNode() which does NOT abort other in-flight builds,
    // so rapid-fire MCP adds (RT, kernel, env in parallel) all succeed.

    // nodeAdded: build just this node, append to tree
    const handleMcpNodeAdded = async ({ handle }: { handle: number }) => {
      if (!handle || !client) return;
      Logger.info('MCP sync: incremental add', handle);
      try {
        const node = await client.buildNewNode(handle);
        if (node) {
          // Deep-clone to break shared references from the scene map.
          // Without this, the same SceneNode object can appear at multiple
          // levels in the React tree, creating cycles that crash filterDeleted.
          const cloned = deepCloneNode(node);
          setSceneTree(prev => [...prev, cloned]);

          // Auto-select RenderTarget: activate in render engine AND select in UI
          if (cloned.type === 'PT_RENDERTARGET' && cloned.handle && cloned.handle !== -1) {
            client
              .setRenderTargetNode(cloned.handle)
              .then(success => {
                if (success) {
                  Logger.debug(
                    `MCP: RenderTarget auto-activated: "${cloned.name}" (handle: ${cloned.handle})`
                  );
                  // Select in inspector/outliner so the UI reflects the active RT
                  onNodeSelectRef.current?.(cloned);
                }
              })
              .catch(err => {
                Logger.error('MCP: Error auto-activating render target:', err);
              });
          }
        }
      } catch (err) {
        Logger.error('MCP incremental add failed, falling back to full reload', err);
        loadSceneTree();
      }
    };

    // nodeDeleted: incremental — remove from map + filter from React tree
    const handleMcpNodeDeleted = ({ handle }: { handle: number }) => {
      if (!handle || !client) return;
      Logger.info('MCP sync: incremental delete', handle);
      client.removeFromScene(handle);
      setSceneTree(prev => {
        const result = filterDeleted(prev, handle);
        return result.changed ? result.updated : prev;
      });
    };

    // nodeChanged: connect/disconnect — refresh the node's children (pin connections)
    // so the NodeGraph editor can rebuild edges. Uses structural sharing to trigger
    // React re-render without a full tree rebuild.
    const handleMcpNodeChanged = async ({ handle }: { handle: number }) => {
      if (!handle || !client) return;
      Logger.debug('MCP sync: refreshing connections for', handle);
      const refreshed = await client.refreshNodeChildren(handle);
      if (refreshed) {
        const updatedNode = client.lookupItem(handle);
        if (updatedNode) {
          // Deep-clone to break shared references from the scene map.
          // A shallow spread of updatedNode would keep children pointing
          // into the scene map, creating cycles when those children are
          // also top-level nodes in the React tree.
          const cloned = deepCloneNode(updatedNode);
          setSceneTree(prev => prev.map(n => (n.handle === handle ? cloned : n)));
        }
      }
    };

    // refreshScene: MCP refresh_webapp() triggers a full reload
    const handleRefreshScene = () => {
      Logger.info('MCP sync: refresh_webapp → full scene reload');
      loadSceneTree();
    };

    client.on('OnMcpNodeAdded', handleMcpNodeAdded);
    client.on('OnMcpNodeDeleted', handleMcpNodeDeleted);
    client.on('OnMcpNodeChanged', handleMcpNodeChanged);
    client.on('OnRefreshScene', handleRefreshScene);

    return () => {
      // Clean up batch timer
      if (childrenFlushTimer) clearTimeout(childrenFlushTimer);
      client.off('scene:nodeAdded', handleProgressiveNodeAdded);
      client.off('scene:level0Complete', handleLevel0Complete);
      client.off('scene:childrenLoaded', handleChildrenLoaded);
      client.off('scene:structureComplete', handleStructureComplete);
      client.off('scene:complete', handleSceneComplete);
      client.off('nodeAdded', handleNodeAdded);
      client.off('nodeDeleted', handleNodeDeleted);
      client.off('sceneTreeUpdated', handleSceneTreeUpdated);
      client.off('OnMcpNodeAdded', handleMcpNodeAdded);
      client.off('OnMcpNodeDeleted', handleMcpNodeDeleted);
      client.off('OnMcpNodeChanged', handleMcpNodeChanged);
      client.off('OnRefreshScene', handleRefreshScene);
    };
  }, [client, loadSceneTree]);

  return {
    sceneTree,
    loading,
    loadSceneTree,
  };
}
