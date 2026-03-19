/**
 * useGPUData Hook
 *
 * Manages GPU information and render statistics for RenderToolbar:
 * - Fetches GPU data (version, device name, memory) from Octane
 * - Listens for real-time render statistics via WebSocket callbacks
 * - Formats render stats (samples, time, progress, status)
 * - Manages GPU statistics dialog state
 *
 * Part of RenderToolbar component refactoring (Phase 1)
 */

import { useState, useEffect, useCallback } from 'react';
import { OctaneClient } from '../../../services/OctaneClient';
import { Logger } from '../../../utils/Logger';
import { useEmitterEvent } from '../../../hooks/useEmitterEvent';

export interface RenderStats {
  currentSamples: number; // 1304
  denoisedSamples: number; // 2720
  maxSamples: number; // 5000
  megaSamplesPerSec: number; // 695 Ms/sec
  currentTime: string; // 00:00:02
  estimatedTime: string; // 00:00:03
  progressPercent: number; // 0-100 for progress bar
  status: 'rendering' | 'finished' | 'paused' | 'stopped' | 'waiting' | 'error';
  primitiveCount: number; // 4032 pri
  meshCount: number; // 1 mesh
  gpu: string; // GPU name
  version: string; // Version string
  memory: string; // Memory string
  usedMemoryGB: number; // Used GPU memory in GB
  freeMemoryGB: number; // Free GPU memory in GB
  totalMemoryGB: number; // Total GPU memory in GB
}

interface UseGPUDataProps {
  connected: boolean;
  client: OctaneClient;
}

export function useGPUData({ connected, client }: UseGPUDataProps) {
  const [renderStats, setRenderStats] = useState<RenderStats>({
    currentSamples: 0,
    denoisedSamples: 0,
    maxSamples: 5000,
    megaSamplesPerSec: 0,
    currentTime: '00:00:00',
    estimatedTime: '00:00:00',
    progressPercent: 0,
    status: 'rendering',
    primitiveCount: 0,
    meshCount: 1,
    gpu: 'NVIDIA GeForce RTX 4090 (RT)',
    version: '1:48.21.2',
    memory: '24.0 GB',
    usedMemoryGB: 0,
    freeMemoryGB: 0,
    totalMemoryGB: 24.0,
  });

  // GPU Statistics Dialog state
  const [showGPUStatsDialog, setShowGPUStatsDialog] = useState(false);
  const [gpuStatsPosition, setGPUStatsPosition] = useState<{ x: number; y: number } | undefined>(
    undefined
  );

  // Fetch live GPU data on connection
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;

    const fetchGPUData = async () => {
      try {
        const version = await client.getOctaneVersion();
        if (cancelled) return;

        const deviceCount = await client.getDeviceCount();
        if (cancelled) return;

        let gpuName = 'Unknown GPU';
        let totalMemory = '0 GB';
        let usedMemoryGB = 0;
        let freeMemoryGB = 0;
        let totalMemoryGB = 0;

        if (deviceCount > 0) {
          const rawName = await client.getDeviceName(0);
          if (cancelled) return;
          // Append (RT) for HW ray-tracing capable GPUs, matching Octane SE display
          gpuName = rawName.includes('(RT)') ? rawName : `${rawName} (RT)`;

          const memoryUsage = await client.getMemoryUsage(0);
          if (cancelled) return;

          if (memoryUsage) {
            usedMemoryGB = memoryUsage.usedDeviceMemory / (1024 * 1024 * 1024);
            totalMemoryGB = memoryUsage.totalDeviceMemory / (1024 * 1024 * 1024);
            // Match Octane: show (total - used) not freeDeviceMemory (which excludes OS/driver memory)
            freeMemoryGB = totalMemoryGB - usedMemoryGB;
            totalMemory = `${usedMemoryGB.toFixed(2)}/${freeMemoryGB.toFixed(1)}/${totalMemoryGB.toFixed(1)} GB`;
          }
        }

        setRenderStats(prev => ({
          ...prev,
          gpu: gpuName,
          version: version,
          memory: totalMemory,
          usedMemoryGB,
          freeMemoryGB,
          totalMemoryGB,
        }));

        Logger.info('GPU data loaded:', { gpu: gpuName, version, memory: totalMemory });
      } catch (error) {
        if (cancelled) return;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        Logger.error('Failed to fetch GPU data:', errorMessage);
      }
    };

    fetchGPUData();
    return () => {
      cancelled = true;
    };
  }, [connected, client]);

  // Listen for real-time render statistics from WebSocket callbacks
  useEmitterEvent(
    connected ? client : null,
    'OnNewStatistics',
    useCallback(
      (data: {
        statistics?: {
          beautySamplesPerPixel?: number;
          denoisedSamplesPerPixel?: number;
          beautyMaxSamplesPerPixel?: number;
          beautySamplesPerSecond?: number;
          renderTime?: number;
          estimatedRenderTime?: number;
          state?: number;
        };
      }) => {
        try {
          const stats = data.statistics;
          if (!stats) return;

          setRenderStats(prev => {
            const currentSamples = stats.beautySamplesPerPixel ?? prev.currentSamples;
            const denoisedSamples = stats.denoisedSamplesPerPixel ?? prev.denoisedSamples;
            const maxSamples = stats.beautyMaxSamplesPerPixel ?? prev.maxSamples;
            const progressPercent =
              maxSamples > 0 ? Math.min(100, (currentSamples / maxSamples) * 100) : 0;

            const samplesPerSecond = stats.beautySamplesPerSecond ?? 0;
            const megaSamplesPerSec = samplesPerSecond / 1000000;

            let currentTime = prev.currentTime;
            if (stats.renderTime !== undefined) {
              const t = Math.floor(stats.renderTime);
              currentTime = `${Math.floor(t / 3600)
                .toString()
                .padStart(2, '0')}:${Math.floor((t % 3600) / 60)
                .toString()
                .padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`;
            }

            let estimatedTime = prev.estimatedTime;
            if (stats.estimatedRenderTime !== undefined) {
              const t = Math.floor(stats.estimatedRenderTime);
              estimatedTime = `${Math.floor(t / 3600)
                .toString()
                .padStart(2, '0')}:${Math.floor((t % 3600) / 60)
                .toString()
                .padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`;
            }

            let status = prev.status;
            if (stats.state !== undefined) {
              // Proto enums may arrive as integers or string names (e.g. "RSTATE_RENDERING")
              const stateMap: Record<string | number, typeof status> = {
                0: 'stopped',
                1: 'waiting',
                2: 'rendering',
                3: 'paused',
                4: 'finished',
                RSTATE_STOPPED: 'stopped',
                RSTATE_WAITING_FOR_DATA: 'waiting',
                RSTATE_RENDERING: 'rendering',
                RSTATE_PAUSED: 'paused',
                RSTATE_FINISHED: 'finished',
              };
              status = stateMap[stats.state] ?? 'error';
            }

            return {
              ...prev,
              currentSamples,
              denoisedSamples,
              maxSamples,
              megaSamplesPerSec,
              currentTime,
              estimatedTime,
              progressPercent,
              status,
            };
          });
        } catch (error) {
          Logger.error('Failed to process render statistics:', error);
        }
      },
      []
    )
  );

  return {
    renderStats,
    setRenderStats,
    showGPUStatsDialog,
    setShowGPUStatsDialog,
    gpuStatsPosition,
    setGPUStatsPosition,
  };
}
