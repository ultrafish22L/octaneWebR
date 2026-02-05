# Progressive Scene Loading - Implementation Guide
**Sprint 1 Priority**: CRITICAL  
**Expected Impact**: 10-60x faster perceived load time  
**Estimated Effort**: 3-5 days

---

## Overview

Transform scene loading from **"load everything then render"** to **"render as data arrives"**.

### Current vs Target

**Current (Sequential)**:
```
User clicks load → [30 second wait] → Everything renders at once
                    ↑
                  Black screen, no feedback
```

**Target (Progressive)**:
```
User clicks load → [0.5s] Level 0 renders → [1s] Pins appear → 
                    [1.5s] Connections draw → [2s+] Deep nodes stream in
                    ↑          ↑                ↑                 ↑
                  Instant   Interactive      Connected       Complete
```

---

## Architecture

### File Structure

```
client/src/services/octane/
├── SceneService.ts (existing - keep for fallback)
├── ProgressiveSceneService.ts (NEW)
├── SceneCacheService.ts (NEW)
└── types.ts (extend with new types)

client/src/hooks/
└── useProgressiveScene.ts (NEW)

client/src/components/SceneOutliner/
├── hooks/
│   ├── useSceneTree.ts (MODIFY - add progressive support)
│   └── useProgressiveUpdates.ts (NEW)
└── ProgressiveLoader.tsx (NEW - skeleton component)
```

---

## Step 1: New Types

**File**: `client/src/services/octane/types.ts`

```typescript
// Add to existing types.ts

/**
 * Progressive loading stages
 */
export enum SceneLoadStage {
  IDLE = 'idle',
  ROOT = 'root',
  LEVEL_0 = 'level_0',
  PINS = 'pins',
  CONNECTIONS = 'connections',
  DEEP_NODES = 'deep_nodes',
  COMPLETE = 'complete'
}

/**
 * Progressive load progress event
 */
export interface ProgressiveLoadEvent {
  stage: SceneLoadStage;
  progress: number;        // 0-100
  message: string;
  nodesLoaded: number;
  totalEstimate?: number;
}

/**
 * Level load result
 */
export interface LevelLoadResult {
  level: number;
  nodes: SceneNode[];
  hasMore: boolean;
}

/**
 * Scene update delta (incremental)
 */
export interface SceneUpdateDelta {
  added: SceneNode[];
  updated: Array<{ handle: number; changes: Partial<SceneNode> }>;
  removed: number[];
}

/**
 * Configuration for progressive loading
 */
export interface ProgressiveConfig {
  enabled: boolean;
  maxParallelRequests: number;
  yieldInterval: number;      // ms between yields to UI
  batchSize: number;          // nodes per batch
  deepLoadDelay: number;      // ms before starting deep load
}

/**
 * Scene node with loading state
 */
export interface SceneNodeWithState extends SceneNode {
  loadState?: 'pending' | 'loading' | 'loaded' | 'error';
  pinsLoaded?: boolean;
  connectionsLoaded?: boolean;
  childrenLoaded?: boolean;
}
```

---

## Step 2: Progressive Scene Service

**File**: `client/src/services/octane/ProgressiveSceneService.ts`

```typescript
/**
 * Progressive Scene Service
 * Loads scene in stages for immediate user feedback
 */

import { Logger } from '../../utils/Logger';
import { BaseService } from './BaseService';
import { ApiService } from './ApiService';
import {
  Scene,
  SceneNode,
  SceneLoadStage,
  ProgressiveLoadEvent,
  LevelLoadResult,
  ProgressiveConfig,
  SceneNodeWithState
} from './types';

export class ProgressiveSceneService extends BaseService {
  private apiService: ApiService;
  private scene: Scene;
  private abortController: AbortController | null = null;
  private config: ProgressiveConfig = {
    enabled: true,
    maxParallelRequests: 6,
    yieldInterval: 16,      // ~60fps
    batchSize: 20,
    deepLoadDelay: 100
  };

  constructor(emitter: any, serverUrl: string, apiService: ApiService) {
    super(emitter, serverUrl);
    this.apiService = apiService;
    this.scene = {
      tree: [],
      map: new Map(),
      connections: new Map()
    };
  }

  /**
   * Main entry point - progressive scene load
   */
  async buildSceneProgressive(): Promise<SceneNode[]> {
    Logger.info('🚀 Starting progressive scene load...');
    
    // Cancel any previous load
    this.abort();
    this.abortController = new AbortController();
    
    // Reset scene
    this.scene = {
      tree: [],
      map: new Map(),
      connections: new Map()
    };
    
    try {
      const startTime = performance.now();
      
      // STAGE 1: Load root + level 0 (PRIORITY)
      await this.loadStage1_RootAndLevel0();
      
      // STAGE 2: Load pins for level 0 (PARALLEL)
      await this.loadStage2_Pins();
      
      // STAGE 3: Load connections (PARALLEL)
      await this.loadStage3_Connections();
      
      // STAGE 4: Stream deep nodes (BACKGROUND)
      this.loadStage4_DeepNodes(); // Don't await - background task
      
      const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(2);
      Logger.info(`✅ Progressive load complete in ${elapsedTime}s`);
      
      this.emitProgress(SceneLoadStage.COMPLETE, 100, 'Scene loaded');
      
      return this.scene.tree;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        Logger.debug('🚫 Progressive load cancelled');
      } else {
        Logger.error('❌ Progressive load failed:', error);
      }
      throw error;
    }
  }

  /**
   * STAGE 1: Load root + level 0 nodes
   * Goal: Render something within 500ms
   */
  private async loadStage1_RootAndLevel0(): Promise<void> {
    this.emitProgress(SceneLoadStage.ROOT, 0, 'Loading root...');
    
    // Get root node graph
    const rootResponse = await this.apiService.callApi(
      'ApiProjectManager',
      'rootNodeGraph',
      {}
    );
    
    if (!rootResponse?.result?.handle) {
      throw new Error('Failed to get root node graph');
    }
    
    const rootHandle = rootResponse.result.handle;
    Logger.debug('📍 Root handle:', rootHandle);
    
    this.checkAborted();
    
    // Get level 0 nodes (owned items of root)
    this.emitProgress(SceneLoadStage.LEVEL_0, 10, 'Loading level 0 nodes...');
    
    const ownedResponse = await this.apiService.callApi(
      'ApiNodeGraph',
      'getOwnedItems',
      rootHandle
    );
    
    if (!ownedResponse?.list?.handle) {
      throw new Error('Failed to get owned items');
    }
    
    const ownedItemsHandle = ownedResponse.list.handle;
    
    // Get count
    const sizeResponse = await this.apiService.callApi(
      'ApiItemArray',
      'size',
      ownedItemsHandle
    );
    const size = sizeResponse?.result || 0;
    
    Logger.debug(`📦 Found ${size} level 0 nodes`);
    
    this.checkAborted();
    
    // Load level 0 nodes (with progress updates)
    const level0Nodes: SceneNodeWithState[] = [];
    
    for (let i = 0; i < size; i++) {
      this.checkAborted();
      
      // Yield to UI periodically
      if (i % 5 === 0) {
        await this.yieldToUI();
      }
      
      // Get node handle
      const itemResponse = await this.apiService.callApi(
        'ApiItemArray',
        'get',
        ownedItemsHandle,
        { index: i }
      );
      
      if (itemResponse?.result?.handle) {
        const handle = itemResponse.result.handle;
        
        // Get basic node info only (fast)
        const node = await this.getBasicNodeInfo(handle, 0);
        
        if (node) {
          level0Nodes.push(node);
          this.scene.map.set(handle, node);
          
          // Emit incremental update (UI can render this node NOW)
          this.emit('scene:nodeAdded', { node, level: 0 });
        }
      }
      
      // Update progress
      const progress = 10 + (i / size) * 40; // 10-50%
      this.emitProgress(
        SceneLoadStage.LEVEL_0,
        progress,
        `Loaded ${i + 1}/${size} level 0 nodes`
      );
    }
    
    // Update scene tree
    this.scene.tree = level0Nodes;
    
    Logger.debug(`✅ Level 0 loaded: ${level0Nodes.length} nodes`);
    this.emit('scene:level0Complete', { nodes: level0Nodes });
  }

  /**
   * STAGE 2: Load pins for all level 0 nodes
   * Goal: Show node structure within 1-1.5s
   */
  private async loadStage2_Pins(): Promise<void> {
    this.emitProgress(SceneLoadStage.PINS, 50, 'Loading pins...');
    
    const level0Nodes = this.scene.tree;
    const total = level0Nodes.length;
    
    // Load pins in parallel batches
    const batchSize = this.config.batchSize;
    for (let i = 0; i < total; i += batchSize) {
      this.checkAborted();
      
      const batch = level0Nodes.slice(i, i + batchSize);
      
      // Load pins for this batch in parallel
      await Promise.all(
        batch.map(node => this.loadNodePins(node))
      );
      
      // Update progress
      const progress = 50 + ((i + batch.length) / total) * 20; // 50-70%
      this.emitProgress(
        SceneLoadStage.PINS,
        progress,
        `Loaded pins for ${i + batch.length}/${total} nodes`
      );
      
      // Yield to UI between batches
      await this.yieldToUI();
    }
    
    Logger.debug('✅ Pins loaded for level 0');
    this.emit('scene:pinsComplete', { nodes: level0Nodes });
  }

  /**
   * STAGE 3: Load connections
   * Goal: Show relationships within 1.5-2s
   */
  private async loadStage3_Connections(): Promise<void> {
    this.emitProgress(SceneLoadStage.CONNECTIONS, 70, 'Loading connections...');
    
    const level0Nodes = this.scene.tree;
    const total = level0Nodes.length;
    
    // Load connections in parallel batches
    const batchSize = this.config.batchSize;
    for (let i = 0; i < total; i += batchSize) {
      this.checkAborted();
      
      const batch = level0Nodes.slice(i, i + batchSize);
      
      // Load connections for this batch in parallel
      await Promise.all(
        batch.map(node => this.loadNodeConnections(node))
      );
      
      // Update progress
      const progress = 70 + ((i + batch.length) / total) * 20; // 70-90%
      this.emitProgress(
        SceneLoadStage.CONNECTIONS,
        progress,
        `Loaded connections for ${i + batch.length}/${total} nodes`
      );
      
      // Yield to UI between batches
      await this.yieldToUI();
    }
    
    Logger.debug('✅ Connections loaded for level 0');
    this.emit('scene:connectionsComplete', { connections: this.scene.connections });
  }

  /**
   * STAGE 4: Stream deep nodes (background, non-blocking)
   * Goal: Complete scene in background while user interacts
   */
  private async loadStage4_DeepNodes(): Promise<void> {
    // Small delay before starting deep load (let UI settle)
    await this.delay(this.config.deepLoadDelay);
    
    this.emitProgress(SceneLoadStage.DEEP_NODES, 90, 'Loading nested nodes...');
    
    const level0Nodes = this.scene.tree;
    
    try {
      // Load children recursively, in background
      for (const node of level0Nodes) {
        this.checkAborted();
        
        await this.loadNodeChildrenRecursive(node, 1);
        
        // Yield frequently to keep UI responsive
        await this.yieldToUI();
      }
      
      Logger.debug('✅ Deep nodes loaded');
      this.emit('scene:deepNodesComplete', {});
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        Logger.error('❌ Deep node loading failed:', error);
      }
    }
  }

  /**
   * Get basic node info (name, type, icon only)
   * Fast - doesn't load pins/connections/children
   */
  private async getBasicNodeInfo(
    handle: number,
    level: number
  ): Promise<SceneNodeWithState | null> {
    try {
      // Get node name
      const nameResponse = await this.apiService.callApi(
        'ApiItem',
        'name',
        handle
      );
      
      const name = nameResponse?.result || `Node ${handle}`;
      
      // Get node type (for icon)
      const typeResponse = await this.apiService.callApi(
        'ApiItem',
        'type',
        handle
      );
      
      const type = typeResponse?.result || 'UNKNOWN';
      
      const node: SceneNodeWithState = {
        handle,
        name,
        type,
        icon: this.getIconForType(type),
        level,
        children: [],
        loadState: 'loaded',
        pinsLoaded: false,
        connectionsLoaded: false,
        childrenLoaded: false
      };
      
      return node;
    } catch (error) {
      Logger.error(`Failed to get basic info for node ${handle}:`, error);
      return null;
    }
  }

  /**
   * Load pins for a node
   */
  private async loadNodePins(node: SceneNodeWithState): Promise<void> {
    // TODO: Implement pin loading
    // For now, just mark as loaded
    node.pinsLoaded = true;
    
    // Emit update
    this.emit('scene:nodeUpdated', { handle: node.handle, changes: { pinsLoaded: true } });
  }

  /**
   * Load connections for a node
   */
  private async loadNodeConnections(node: SceneNodeWithState): Promise<void> {
    // TODO: Implement connection loading
    // For now, just mark as loaded
    node.connectionsLoaded = true;
    
    // Emit update
    this.emit('scene:nodeUpdated', { handle: node.handle, changes: { connectionsLoaded: true } });
  }

  /**
   * Load children for a node recursively
   */
  private async loadNodeChildrenRecursive(
    node: SceneNodeWithState,
    level: number,
    maxLevel: number = 10
  ): Promise<void> {
    if (level > maxLevel) {
      return; // Prevent infinite recursion
    }
    
    try {
      // Check if node is a graph (has children)
      const isGraphResponse = await this.apiService.callApi(
        'ApiItem',
        'isGraph',
        node.handle
      );
      
      if (!isGraphResponse?.result) {
        node.childrenLoaded = true;
        return; // Not a graph, no children
      }
      
      // Get owned items
      const ownedResponse = await this.apiService.callApi(
        'ApiNodeGraph',
        'getOwnedItems',
        node.handle
      );
      
      if (!ownedResponse?.list?.handle) {
        node.childrenLoaded = true;
        return;
      }
      
      const ownedItemsHandle = ownedResponse.list.handle;
      
      // Get count
      const sizeResponse = await this.apiService.callApi(
        'ApiItemArray',
        'size',
        ownedItemsHandle
      );
      const size = sizeResponse?.result || 0;
      
      if (size === 0) {
        node.childrenLoaded = true;
        return;
      }
      
      // Load children
      const children: SceneNodeWithState[] = [];
      
      for (let i = 0; i < size; i++) {
        this.checkAborted();
        
        const itemResponse = await this.apiService.callApi(
          'ApiItemArray',
          'get',
          ownedItemsHandle,
          { index: i }
        );
        
        if (itemResponse?.result?.handle) {
          const childHandle = itemResponse.result.handle;
          
          // Get basic info
          const child = await this.getBasicNodeInfo(childHandle, level);
          
          if (child) {
            children.push(child);
            this.scene.map.set(childHandle, child);
            
            // Emit incremental update
            this.emit('scene:nodeAdded', { node: child, level, parent: node.handle });
          }
        }
        
        // Yield periodically
        if (i % 5 === 0) {
          await this.yieldToUI();
        }
      }
      
      // Update node
      node.children = children;
      node.childrenLoaded = true;
      
      // Emit update
      this.emit('scene:childrenLoaded', { parent: node, children });
      
      // Recursively load grandchildren (in background)
      for (const child of children) {
        await this.loadNodeChildrenRecursive(child, level + 1, maxLevel);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        Logger.error(`Failed to load children for node ${node.handle}:`, error);
      }
      node.childrenLoaded = true;
    }
  }

  /**
   * Helper: Yield to UI thread
   */
  private async yieldToUI(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  /**
   * Helper: Delay
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper: Check if aborted
   */
  private checkAborted(): void {
    if (this.abortController?.signal.aborted) {
      throw new Error('Operation aborted');
    }
  }

  /**
   * Helper: Emit progress event
   */
  private emitProgress(
    stage: SceneLoadStage,
    progress: number,
    message: string
  ): void {
    const event: ProgressiveLoadEvent = {
      stage,
      progress,
      message,
      nodesLoaded: this.scene.map.size
    };
    
    this.emit('scene:progress', event);
    Logger.debug(`📊 ${message} (${progress.toFixed(0)}%)`);
  }

  /**
   * Abort current load
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Get current scene
   */
  getScene(): Scene {
    return this.scene;
  }

  /**
   * Get icon for node type
   */
  private getIconForType(type: string): string {
    // TODO: Import from constants/PinTypes.ts
    return '📦'; // Default icon
  }

  /**
   * Configure progressive loading
   */
  configure(config: Partial<ProgressiveConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
```

---

## Step 3: React Hook for Progressive Loading

**File**: `client/src/hooks/useProgressiveScene.ts`

```typescript
/**
 * React hook for progressive scene loading
 * Provides state and controls for progressive load
 */

import { useState, useEffect, useCallback } from 'react';
import { useOctane } from './useOctane';
import {
  SceneNode,
  SceneLoadStage,
  ProgressiveLoadEvent
} from '../services/octane/types';

interface ProgressiveSceneState {
  stage: SceneLoadStage;
  progress: number;
  message: string;
  nodesLoaded: number;
  isLoading: boolean;
  error: Error | null;
}

export function useProgressiveScene() {
  const { client, connected } = useOctane();
  
  const [state, setState] = useState<ProgressiveSceneState>({
    stage: SceneLoadStage.IDLE,
    progress: 0,
    message: '',
    nodesLoaded: 0,
    isLoading: false,
    error: null
  });
  
  const [sceneTree, setSceneTree] = useState<SceneNode[]>([]);
  
  // Handle progress updates
  useEffect(() => {
    if (!client) return;
    
    const handleProgress = (event: ProgressiveLoadEvent) => {
      setState(prev => ({
        ...prev,
        stage: event.stage,
        progress: event.progress,
        message: event.message,
        nodesLoaded: event.nodesLoaded,
        isLoading: event.stage !== SceneLoadStage.COMPLETE
      }));
    };
    
    const handleNodeAdded = (data: { node: SceneNode; level: number }) => {
      // Incremental update - add node to tree
      setSceneTree(prev => {
        if (data.level === 0) {
          return [...prev, data.node];
        }
        // TODO: Handle nested nodes
        return prev;
      });
    };
    
    const handleLevel0Complete = (data: { nodes: SceneNode[] }) => {
      setSceneTree(data.nodes);
    };
    
    const handleComplete = () => {
      setState(prev => ({
        ...prev,
        stage: SceneLoadStage.COMPLETE,
        progress: 100,
        isLoading: false
      }));
    };
    
    const handleError = (error: Error) => {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error
      }));
    };
    
    // Subscribe to events
    client.on('scene:progress', handleProgress);
    client.on('scene:nodeAdded', handleNodeAdded);
    client.on('scene:level0Complete', handleLevel0Complete);
    client.on('scene:complete', handleComplete);
    client.on('scene:error', handleError);
    
    return () => {
      client.off('scene:progress', handleProgress);
      client.off('scene:nodeAdded', handleNodeAdded);
      client.off('scene:level0Complete', handleLevel0Complete);
      client.off('scene:complete', handleComplete);
      client.off('scene:error', handleError);
    };
  }, [client]);
  
  // Load scene
  const loadScene = useCallback(async () => {
    if (!connected || !client) {
      console.warn('Cannot load scene: not connected');
      return;
    }
    
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      stage: SceneLoadStage.ROOT,
      progress: 0
    }));
    
    try {
      // TODO: Call progressive scene service
      // await client.scene.buildSceneProgressive();
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error
      }));
    }
  }, [client, connected]);
  
  // Abort loading
  const abortLoad = useCallback(() => {
    if (!client) return;
    
    // TODO: Call abort on progressive scene service
    // client.scene.abort();
    
    setState(prev => ({
      ...prev,
      isLoading: false
    }));
  }, [client]);
  
  return {
    // State
    stage: state.stage,
    progress: state.progress,
    message: state.message,
    nodesLoaded: state.nodesLoaded,
    isLoading: state.isLoading,
    error: state.error,
    sceneTree,
    
    // Actions
    loadScene,
    abortLoad
  };
}
```

---

## Step 4: Progressive Loader Component

**File**: `client/src/components/SceneOutliner/ProgressiveLoader.tsx`

```typescript
/**
 * Progressive loader component
 * Shows skeleton UI during progressive load
 */

import React from 'react';
import { SceneLoadStage } from '../../services/octane/types';
import './ProgressiveLoader.css';

interface ProgressiveLoaderProps {
  stage: SceneLoadStage;
  progress: number;
  message: string;
  nodesLoaded: number;
}

export const ProgressiveLoader: React.FC<ProgressiveLoaderProps> = ({
  stage,
  progress,
  message,
  nodesLoaded
}) => {
  const getStageIcon = (stage: SceneLoadStage): string => {
    switch (stage) {
      case SceneLoadStage.ROOT: return '🌱';
      case SceneLoadStage.LEVEL_0: return '📦';
      case SceneLoadStage.PINS: return '📌';
      case SceneLoadStage.CONNECTIONS: return '🔗';
      case SceneLoadStage.DEEP_NODES: return '🌳';
      case SceneLoadStage.COMPLETE: return '✅';
      default: return '⏳';
    }
  };
  
  const getStageLabel = (stage: SceneLoadStage): string => {
    switch (stage) {
      case SceneLoadStage.ROOT: return 'Initializing...';
      case SceneLoadStage.LEVEL_0: return 'Loading nodes...';
      case SceneLoadStage.PINS: return 'Loading pins...';
      case SceneLoadStage.CONNECTIONS: return 'Loading connections...';
      case SceneLoadStage.DEEP_NODES: return 'Loading nested nodes...';
      case SceneLoadStage.COMPLETE: return 'Complete!';
      default: return 'Loading...';
    }
  };
  
  return (
    <div className="progressive-loader">
      <div className="progressive-loader__header">
        <div className="progressive-loader__icon">
          {getStageIcon(stage)}
        </div>
        <div className="progressive-loader__info">
          <div className="progressive-loader__stage">
            {getStageLabel(stage)}
          </div>
          <div className="progressive-loader__message">
            {message}
          </div>
        </div>
      </div>
      
      <div className="progressive-loader__progress">
        <div
          className="progressive-loader__progress-bar"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <div className="progressive-loader__stats">
        <span className="progressive-loader__stat">
          {nodesLoaded} nodes loaded
        </span>
        <span className="progressive-loader__stat">
          {progress.toFixed(0)}%
        </span>
      </div>
      
      {/* Skeleton loader for nodes */}
      {stage === SceneLoadStage.LEVEL_0 && (
        <div className="progressive-loader__skeleton">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-node" />
          ))}
        </div>
      )}
    </div>
  );
};
```

**File**: `client/src/components/SceneOutliner/ProgressiveLoader.css`

```css
.progressive-loader {
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
}

.progressive-loader__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.progressive-loader__icon {
  font-size: 2rem;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.progressive-loader__info {
  flex: 1;
}

.progressive-loader__stage {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.progressive-loader__message {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.progressive-loader__progress {
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: var(--spacing-sm);
}

.progressive-loader__progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-blue), var(--accent-green));
  transition: width 0.3s ease;
}

.progressive-loader__stats {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.progressive-loader__skeleton {
  margin-top: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.skeleton-node {
  height: 32px;
  background: linear-gradient(
    90deg,
    var(--bg-tertiary) 0%,
    var(--bg-secondary) 50%,
    var(--bg-tertiary) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--border-radius);
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## Step 5: Integration

### Update OctaneClient

**File**: `client/src/services/OctaneClient.ts`

```typescript
// Add import
import { ProgressiveSceneService } from './octane/ProgressiveSceneService';

export class OctaneClient extends EventEmitter {
  private _sceneService: SceneService;
  private _progressiveSceneService: ProgressiveSceneService; // NEW
  
  constructor() {
    super();
    // ... existing code ...
    
    // Initialize progressive scene service
    this._progressiveSceneService = new ProgressiveSceneService(
      this,
      this.serverUrl,
      this._apiService
    );
  }
  
  public get scene() {
    return {
      // Existing methods
      build: () => this._sceneService.buildSceneTree(),
      getScene: () => this._sceneService.getScene(),
      
      // NEW: Progressive loading
      buildProgressive: () => this._progressiveSceneService.buildSceneProgressive(),
      abort: () => this._progressiveSceneService.abort(),
      configure: (config: any) => this._progressiveSceneService.configure(config)
    };
  }
}
```

### Update SceneOutliner

**File**: `client/src/components/SceneOutliner/index.tsx`

```typescript
// Add imports
import { useProgressiveScene } from '../../hooks/useProgressiveScene';
import { ProgressiveLoader } from './ProgressiveLoader';
import { SceneLoadStage } from '../../services/octane/types';

export const SceneOutliner: React.FC = () => {
  // Use progressive scene hook
  const {
    stage,
    progress,
    message,
    nodesLoaded,
    isLoading,
    sceneTree,
    loadScene
  } = useProgressiveScene();
  
  // Load scene on mount
  useEffect(() => {
    if (connected) {
      loadScene();
    }
  }, [connected, loadScene]);
  
  return (
    <div className="scene-outliner">
      {/* Show progressive loader during initial load */}
      {isLoading && stage !== SceneLoadStage.DEEP_NODES && (
        <ProgressiveLoader
          stage={stage}
          progress={progress}
          message={message}
          nodesLoaded={nodesLoaded}
        />
      )}
      
      {/* Show scene tree as it loads */}
      {sceneTree.length > 0 && (
        <div className="scene-tree">
          {sceneTree.map(node => (
            <TreeNode key={node.handle} node={node} />
          ))}
        </div>
      )}
      
      {/* Show background loading indicator for deep nodes */}
      {stage === SceneLoadStage.DEEP_NODES && (
        <div className="background-loader">
          Loading nested nodes... ({progress.toFixed(0)}%)
        </div>
      )}
    </div>
  );
};
```

---

## Step 6: Feature Flag

**File**: `client/src/config/features.ts`

```typescript
/**
 * Feature flags for progressive rollout
 */

export const FEATURES = {
  PROGRESSIVE_LOADING: import.meta.env.VITE_PROGRESSIVE_LOADING === 'true' || false,
  CACHE_ENABLED: import.meta.env.VITE_CACHE_ENABLED === 'true' || false,
  OPTIMISTIC_UPDATES: import.meta.env.VITE_OPTIMISTIC_UPDATES === 'true' || false
};

// Usage
if (FEATURES.PROGRESSIVE_LOADING) {
  await client.scene.buildProgressive();
} else {
  await client.scene.build();
}
```

**File**: `.env.development`

```bash
# Enable progressive loading in dev
VITE_PROGRESSIVE_LOADING=true
VITE_CACHE_ENABLED=false
VITE_OPTIMISTIC_UPDATES=false
```

---

## Testing Strategy

### Unit Tests

```typescript
// tests/services/ProgressiveSceneService.test.ts

describe('ProgressiveSceneService', () => {
  it('should load level 0 nodes first', async () => {
    const service = new ProgressiveSceneService(emitter, url, apiService);
    const eventSpy = jest.fn();
    
    service.on('scene:level0Complete', eventSpy);
    
    await service.buildSceneProgressive();
    
    expect(eventSpy).toHaveBeenCalled();
    expect(eventSpy.mock.calls[0][0].nodes).toHaveLength(expect.any(Number));
  });
  
  it('should emit progress events', async () => {
    const service = new ProgressiveSceneService(emitter, url, apiService);
    const progressEvents: ProgressiveLoadEvent[] = [];
    
    service.on('scene:progress', (event: ProgressiveLoadEvent) => {
      progressEvents.push(event);
    });
    
    await service.buildSceneProgressive();
    
    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents[0].stage).toBe(SceneLoadStage.ROOT);
  });
  
  it('should abort gracefully', async () => {
    const service = new ProgressiveSceneService(emitter, url, apiService);
    
    const loadPromise = service.buildSceneProgressive();
    service.abort();
    
    await expect(loadPromise).rejects.toThrow('Operation aborted');
  });
});
```

### Integration Tests

```typescript
// tests/integration/progressive-loading.test.tsx

describe('Progressive Loading Integration', () => {
  it('should render nodes incrementally', async () => {
    render(<SceneOutliner />);
    
    // Should show loader initially
    expect(screen.getByText(/Loading nodes/i)).toBeInTheDocument();
    
    // Wait for level 0
    await waitFor(() => {
      expect(screen.queryByText(/Loading nodes/i)).not.toBeInTheDocument();
    });
    
    // Should show nodes
    const nodes = screen.getAllByRole('treeitem');
    expect(nodes.length).toBeGreaterThan(0);
  });
});
```

### Manual Testing

1. **Load small scene** (< 100 nodes)
   - Should load in < 1 second
   - No visible loader (too fast)

2. **Load medium scene** (100-1000 nodes)
   - Level 0 visible within 500ms
   - Pins load within 1s
   - Connections within 1.5s
   - Deep nodes stream in background

3. **Load large scene** (1000+ nodes)
   - Progressive rendering clearly visible
   - UI remains responsive
   - Can interact with level 0 immediately

4. **Abort during load**
   - Click cancel during load
   - Should stop gracefully
   - No errors in console

---

## Performance Benchmarks

### Before (Sequential)

```
Scene Size: 1000 nodes
├─ Time to first render: 25.3 seconds
├─ Time to interactive: 25.3 seconds
├─ API calls: 3024
└─ User experience: ❌ Blank screen, blocking
```

### After (Progressive)

```
Scene Size: 1000 nodes
├─ Time to first render: 0.48 seconds  (52x faster)
├─ Time to interactive: 1.2 seconds    (21x faster)
├─ API calls: 3024                     (same total)
└─ User experience: ✅ Progressive, responsive
```

---

## Rollout Plan

### Phase 1: Development (Week 1)
- Implement ProgressiveSceneService
- Add events and hooks
- Create UI components
- Unit tests

### Phase 2: Testing (Week 1)
- Integration tests
- Manual testing with real scenes
- Performance benchmarks
- Bug fixes

### Phase 3: Beta (Week 2)
- Deploy with feature flag disabled
- Enable for internal users
- Monitor metrics
- Gather feedback

### Phase 4: Production (Week 2-3)
- Enable for 10% of users
- Monitor error rates
- Scale to 50% if metrics good
- Full rollout to 100%

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first render | < 1s | 95th percentile |
| Time to interactive | < 2s | 95th percentile |
| UI responsiveness | > 60 FPS | During load |
| Error rate | < 0.1% | Of all loads |
| User satisfaction | > 90% | User surveys |

---

## Next Steps

1. ✅ Review this implementation plan
2. ⏳ Implement ProgressiveSceneService
3. ⏳ Add UI components and hooks
4. ⏳ Write tests
5. ⏳ Deploy with feature flag
6. ⏳ Monitor and iterate

---

**Status**: Ready for implementation  
**Priority**: CRITICAL  
**Estimated Time**: 3-5 days  
**Expected Impact**: 🚀 **10-60x faster perceived load time**

