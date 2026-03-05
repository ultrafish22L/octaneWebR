/**
 * useSceneStatusEvents Hook
 * Subscribes to scene/connection/error events and updates the status bar.
 * Extracted from App.tsx to reduce state concentration.
 */

import { useCallback } from 'react';
import { EventEmitter } from '../utils/EventEmitter';
import { useEmitterEvent } from './useEmitterEvent';
import { useStatusMessage } from '../contexts/StatusMessageContext';
import { Logger } from '../utils/Logger';
import { SceneNode } from '../services/OctaneClient';

export function useSceneStatusEvents(client: EventEmitter): void {
  const { setStatusMessage, setTemporaryStatus } = useStatusMessage();

  useEmitterEvent(
    client,
    'OnRenderFailure',
    useCallback(
      (data: unknown) => {
        Logger.error('Render failure detected:', data);
        setTemporaryStatus('Render failed — check Octane console', 5000);
      },
      [setTemporaryStatus]
    )
  );

  useEmitterEvent(
    client,
    'scene:buildStart',
    useCallback(() => {
      setStatusMessage('Building scene tree...');
    }, [setStatusMessage])
  );

  useEmitterEvent(
    client,
    'scene:buildProgress',
    useCallback(
      (data: { step?: string; message?: string; progress?: number }) => {
        const message = data.message || data.step || 'Loading scene...';
        const progressText = data.progress !== undefined ? ` (${Math.round(data.progress)}%)` : '';
        setStatusMessage(`Building scene: ${message}${progressText}`);
      },
      [setStatusMessage]
    )
  );

  useEmitterEvent(
    client,
    'scene:buildComplete',
    useCallback(
      (data: { nodeCount: number; topLevelCount: number; elapsedTime: string }) => {
        setTemporaryStatus(
          `Scene loaded: ${data.nodeCount} nodes (${data.topLevelCount} top-level) in ${data.elapsedTime}s`,
          5000
        );
      },
      [setTemporaryStatus]
    )
  );

  useEmitterEvent(
    client,
    'nodeAdded',
    useCallback(() => {
      setTemporaryStatus('Node created', 2000);
    }, [setTemporaryStatus])
  );

  useEmitterEvent(
    client,
    'nodeDeleted',
    useCallback(() => {
      setTemporaryStatus('Node deleted', 2000);
    }, [setTemporaryStatus])
  );

  useEmitterEvent(
    client,
    'connection:changed',
    useCallback(
      (connectionData: { connected: boolean }) => {
        if (connectionData.connected) {
          setTemporaryStatus('Connected to Octane', 3000);
        } else {
          setStatusMessage('Disconnected from Octane');
        }
      },
      [setTemporaryStatus, setStatusMessage]
    )
  );

  useEmitterEvent(
    client,
    'scene:level0Complete',
    useCallback(
      (data: { nodes?: SceneNode[] }) => {
        setTemporaryStatus(`Structure loaded: ${data.nodes?.length || 0} nodes`, 2000);
      },
      [setTemporaryStatus]
    )
  );

  useEmitterEvent(
    client,
    'status:error',
    useCallback(
      (message: string) => {
        setTemporaryStatus(message, 5000);
      },
      [setTemporaryStatus]
    )
  );
}
