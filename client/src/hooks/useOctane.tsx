/**
 * React hooks and context for Octane client
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { OctaneClient, getOctaneClient, RenderState, Scene, NodeAddedEvent } from '../services/OctaneClient';

interface OctaneContextValue {
  client: OctaneClient;
  connected: boolean;
  scene: Scene | null;
  renderState: RenderState;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
}

const OctaneContext = createContext<OctaneContextValue | null>(null);

export function OctaneProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => getOctaneClient());
  const [connected, setConnected] = useState(false);
  const [scene, setScene] = useState<Scene | null>(null);
  const [renderState, setRenderState] = useState<RenderState>({
    isRendering: false,
    progress: 0,
    samples: 0,
    renderTime: 0,
    resolution: { width: 1920, height: 1080 }
  });

  useEffect(() => {
    // Setup event listeners for Octane client events
    const handleConnected = () => setConnected(true);
    const handleDisconnected = () => setConnected(false);
    const handleSceneTreeUpdated = (newScene: Scene) => setScene(newScene);
    const handleNodeAdded = (_event: NodeAddedEvent) => {
      // Trigger React re-render with shallow copy
      setScene(prevScene => {
        if (!prevScene) return prevScene;
        return { ...prevScene, tree: [...prevScene.tree] };
      });
    };
    const handleRenderStateChanged = (newState: RenderState) => setRenderState(newState);

    client.on('connected', handleConnected);
    client.on('disconnected', handleDisconnected);
    client.on('sceneTreeUpdated', handleSceneTreeUpdated);
    client.on('nodeAdded', handleNodeAdded);
    client.on('renderStateChanged', handleRenderStateChanged);

    // Cleanup on unmount
    return () => {
      client.off('connected', handleConnected);
      client.off('disconnected', handleDisconnected);
      client.off('sceneTreeUpdated', handleSceneTreeUpdated);
      client.off('nodeAdded', handleNodeAdded);
      client.off('renderStateChanged', handleRenderStateChanged);
    };
  }, [client]);

  const connect = useCallback(async () => {
    return await client.connect();
  }, [client]);

  const disconnect = useCallback(async () => {
    await client.disconnect();
  }, [client]);

  const value: OctaneContextValue = {
    client,
    connected,
    scene,
    renderState,
    connect,
    disconnect
  };

  return <OctaneContext.Provider value={value}>{children}</OctaneContext.Provider>;
}

export function useOctane() {
  const context = useContext(OctaneContext);
  if (!context) {
    throw new Error('useOctane must be used within OctaneProvider');
  }
  return context;
}
