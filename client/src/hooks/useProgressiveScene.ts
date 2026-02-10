/**
 * useProgressiveScene - Hook for progressive scene loading
 * 
 * Listens to progressive scene loading events and manages incremental state updates.
 * Only active when PROGRESSIVE_LOADING feature flag is enabled.
 * 
 * Events listened to:
 * - scene:nodeAdded: Individual node added (level 0 or nested)
 * - scene:level0Complete: All level 0 nodes loaded
 * - scene:buildProgress: Progress updates during load
 * - scene:pinsComplete: Pins loaded for level 0
 * - scene:connectionsComplete: Connections loaded
 * - scene:deepNodesComplete: Deep nodes loaded
 * - scene:complete: Entire scene loaded
 * 
 * Sprint 1: Progressive Scene Loading
 * Created: 2025-02-03
 */

import { useState, useEffect, useCallback } from 'react';
import { Logger } from '../utils/Logger';
import { useOctane } from './useOctane';
import { SceneNode } from '../services/OctaneClient';
import { FEATURES } from '../config/features';

interface ProgressiveSceneState {
  sceneTree: SceneNode[];
  loading: boolean;
  stage: string;
  progress: number;
  message: string;
  nodesLoaded: number;
}

interface NodeAddedEvent {
  node: SceneNode;
  level: number;
  parent?: number;
}

interface Level0CompleteEvent {
  nodes: SceneNode[];
}

interface ProgressEvent {
  stage: string;
  progress: number;
  message: string;
  nodesLoaded: number;
}

interface CompleteEvent {
  totalNodes: number;
  topLevelCount: number;
}

interface ChildrenLoadedEvent {
  parent: SceneNode;
  children: SceneNode[];
}

/**
 * Hook for managing progressive scene loading state
 * Returns scene tree that updates incrementally as nodes load
 */
export function useProgressiveScene() {
  const { client, connected } = useOctane();
  const [state, setState] = useState<ProgressiveSceneState>({
    sceneTree: [],
    loading: false,
    stage: 'idle',
    progress: 0,
    message: '',
    nodesLoaded: 0
  });

  // Listen for progressive scene events
  useEffect(() => {
    if (!client || !FEATURES.PROGRESSIVE_LOADING) {
      return;
    }

    Logger.debug('🚀 useProgressiveScene: Registering progressive event listeners');

    /**
     * Handle individual node additions (level 0 during initial load)
     */
    const handleNodeAdded = ({ node, level }: NodeAddedEvent) => {
      Logger.debug(`🌲 Progressive: Node added at level ${level}: "${node.name}" (handle: ${node.handle})`);
      
      // Only add level 0 nodes incrementally during initial load
      // Nested nodes are added via childrenLoaded event
      if (level === 0) {
        setState(prev => ({
          ...prev,
          sceneTree: [...prev.sceneTree, node],
          nodesLoaded: prev.nodesLoaded + 1
        }));
      }
    };

    /**
     * Handle level 0 completion - replace tree with complete level 0 nodes
     * This ensures consistent state after all level 0 nodes are loaded
     */
    const handleLevel0Complete = ({ nodes }: Level0CompleteEvent) => {
      Logger.info(`✅ Progressive: Level 0 complete (${nodes.length} nodes)`);
      setState(prev => ({
        ...prev,
        sceneTree: nodes,
        message: `Level 0 loaded: ${nodes.length} nodes`,
        nodesLoaded: nodes.length
      }));
    };

    /**
     * Handle progress updates (stage, percentage, message)
     */
    const handleProgress = (event: ProgressEvent) => {
      Logger.debug(`📊 Progressive: ${event.message} (${event.progress.toFixed(0)}%)`);
      setState(prev => ({
        ...prev,
        stage: event.stage,
        progress: event.progress,
        message: event.message,
        nodesLoaded: event.nodesLoaded
      }));
    };

    /**
     * Handle pins loaded completion
     */
    const handlePinsComplete = () => {
      Logger.debug('✅ Progressive: Pins loaded');
    };

    /**
     * Handle connections loaded completion
     */
    const handleConnectionsComplete = () => {
      Logger.debug('✅ Progressive: Connections loaded');
    };

    /**
     * Handle children loaded for a parent node
     * Updates the tree to add children to their parent
     */
    const handleChildrenLoaded = ({ parent, children }: ChildrenLoadedEvent) => {
      Logger.debug(`🌲 Progressive: Children loaded for "${parent.name}": ${children.length} children`);
      
      setState(prev => {
        // Recursively update the node with new children
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
        
        return {
          ...prev,
          sceneTree: updateNodeWithChildren(prev.sceneTree)
        };
      });
    };

    /**
     * Handle deep nodes completion
     */
    const handleDeepNodesComplete = () => {
      Logger.info('✅ Progressive: Deep nodes loaded');
    };

    /**
     * Handle scene load completion
     */
    const handleComplete = ({ totalNodes, topLevelCount }: CompleteEvent) => {
      Logger.info(`✅ Progressive: Scene complete (${totalNodes} total nodes, ${topLevelCount} top-level)`);
      setState(prev => ({
        ...prev,
        loading: false,
        progress: 100,
        message: `Scene loaded: ${totalNodes} nodes`,
        stage: 'complete'
      }));
    };

    // Register all event listeners
    client.on('scene:nodeAdded', handleNodeAdded);
    client.on('scene:level0Complete', handleLevel0Complete);
    client.on('scene:buildProgress', handleProgress);
    client.on('scene:pinsComplete', handlePinsComplete);
    client.on('scene:connectionsComplete', handleConnectionsComplete);
    client.on('scene:childrenLoaded', handleChildrenLoaded);
    client.on('scene:deepNodesComplete', handleDeepNodesComplete);
    client.on('scene:complete', handleComplete);

    Logger.debug('✅ useProgressiveScene: Event listeners registered');

    // Cleanup
    return () => {
      Logger.debug('🔇 useProgressiveScene: Removing event listeners');
      client.off('scene:nodeAdded', handleNodeAdded);
      client.off('scene:level0Complete', handleLevel0Complete);
      client.off('scene:buildProgress', handleProgress);
      client.off('scene:pinsComplete', handlePinsComplete);
      client.off('scene:connectionsComplete', handleConnectionsComplete);
      client.off('scene:childrenLoaded', handleChildrenLoaded);
      client.off('scene:deepNodesComplete', handleDeepNodesComplete);
      client.off('scene:complete', handleComplete);
    };
  }, [client]);

  /**
   * Load scene - initiates progressive loading
   */
  const loadScene = useCallback(async () => {
    if (!connected || !client) {
      Logger.warn('⚠️ useProgressiveScene: Cannot load scene - not connected');
      return;
    }

    Logger.info('🚀 useProgressiveScene: Starting progressive scene load');
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      sceneTree: [], 
      nodesLoaded: 0,
      progress: 0,
      stage: 'loading',
      message: 'Loading scene...'
    }));

    try {
      await client.buildSceneTree();
    } catch (error) {
      Logger.error('❌ useProgressiveScene: Failed to load scene:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false,
        message: 'Failed to load scene',
        stage: 'error'
      }));
    }
  }, [connected, client]);

  /**
   * Abort current scene load
   */
  const abortLoad = useCallback(() => {
    if (!client) return;
    
    Logger.debug('🚫 useProgressiveScene: Aborting scene load');
    client.abortSceneLoad();
    setState(prev => ({ 
      ...prev, 
      loading: false,
      message: 'Load cancelled',
      stage: 'idle'
    }));
  }, [client]);

  return {
    ...state,
    loadScene,
    abortLoad,
    isEnabled: FEATURES.PROGRESSIVE_LOADING
  };
}
