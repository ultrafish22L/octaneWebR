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

import { useState, useEffect } from 'react';
import { OctaneClient } from '../../../services/OctaneClient';
import { Logger } from '../../../utils/Logger';

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
    status: 'finished',
    primitiveCount: 0,
    meshCount: 1,
    gpu: 'NVIDIA GeForce RTX 4090 (RT)',
    version: '1:48.21.2',
    memory: '24.0 GB',
  });

  // GPU Statistics Dialog state
  const [showGPUStatsDialog, setShowGPUStatsDialog] = useState(false);
  const [gpuStatsPosition, setGPUStatsPosition] = useState<{ x: number; y: number } | undefined>(
    undefined
  );

  // Fetch live GPU data on connection
  useEffect(() => {
    if (!connected) return;

    const fetchGPUData = async () => {
      try {
        // Get Octane version
        const version = await client.getOctaneVersion();

        // Get primary GPU device info
        const deviceCount = await client.getDeviceCount();
        let gpuName = 'Unknown GPU';
        let totalMemory = '0 GB';

        if (deviceCount > 0) {
          // Get first device (primary GPU)
          gpuName = await client.getDeviceName(0);

          // Get memory info
          const memoryUsage = await client.getMemoryUsage(0);
          if (memoryUsage) {
            const totalGB = (memoryUsage.totalDeviceMemory / (1024 * 1024 * 1024)).toFixed(1);
            totalMemory = `${totalGB} GB`;
          }
        }

        setRenderStats(prev => ({
          ...prev,
          gpu: gpuName,
          version: version,
          memory: totalMemory,
        }));

        Logger.debug('🖥️ GPU data loaded:', { gpu: gpuName, version, memory: totalMemory });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        Logger.error('❌ Failed to fetch GPU data:', errorMessage);
      }
    };

    fetchGPUData();
  }, [connected, client]);

  // Listen for real-time render statistics from WebSocket callbacks
  useEffect(() => {
    if (!connected) return;

    const handleStatistics = (data: {
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
        // Parse the statistics object from Octane callback
        // RenderResultStatistics proto fields:
        // - beautySamplesPerPixel (uint32) - current samples
        // - denoisedSamplesPerPixel (uint32) - denoised samples
        // - beautyMaxSamplesPerPixel (uint32) - max target samples
        // - beautySamplesPerSecond (double) - samples per second
        // - renderTime (double) - seconds elapsed
        // - estimatedRenderTime (double) - estimated total seconds
        // - state (RenderState enum) - 0=stopped, 1=waiting, 2=rendering, 3=paused, 4=finished
        const stats = data.statistics;
        if (stats) {
          // Parse samples (current/denoised/max)
          const currentSamples =
            stats.beautySamplesPerPixel !== undefined
              ? stats.beautySamplesPerPixel
              : renderStats.currentSamples;
          const denoisedSamples =
            stats.denoisedSamplesPerPixel !== undefined
              ? stats.denoisedSamplesPerPixel
              : renderStats.denoisedSamples;
          const maxSamples =
            stats.beautyMaxSamplesPerPixel !== undefined
              ? stats.beautyMaxSamplesPerPixel
              : renderStats.maxSamples;

          // Calculate progress percentage
          const progressPercent =
            maxSamples > 0 ? Math.min(100, (currentSamples / maxSamples) * 100) : 0;

          // Parse samples per second and convert to mega-samples/sec
          const samplesPerSecond =
            stats.beautySamplesPerSecond !== undefined ? stats.beautySamplesPerSecond : 0;
          const megaSamplesPerSec = samplesPerSecond / 1000000;

          // Format current time (renderTime in seconds) as HH:MM:SS
          let currentTime = renderStats.currentTime;
          if (stats.renderTime !== undefined) {
            const totalSeconds = Math.floor(stats.renderTime);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            currentTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          }

          // Format estimated time (estimatedRenderTime in seconds) as HH:MM:SS
          let estimatedTime = renderStats.estimatedTime;
          if (stats.estimatedRenderTime !== undefined) {
            const totalSeconds = Math.floor(stats.estimatedRenderTime);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            estimatedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          }

          // Parse render state (state enum)
          // RSTATE_STOPPED=0, RSTATE_WAITING_FOR_DATA=1, RSTATE_RENDERING=2, RSTATE_PAUSED=3, RSTATE_FINISHED=4
          let status: 'rendering' | 'finished' | 'paused' | 'stopped' | 'waiting' | 'error' =
            renderStats.status;
          if (stats.state !== undefined) {
            switch (stats.state) {
              case 0:
                status = 'stopped';
                break;
              case 1:
                status = 'waiting';
                break;
              case 2:
                status = 'rendering';
                break;
              case 3:
                status = 'paused';
                break;
              case 4:
                status = 'finished';
                break;
              default:
                status = 'error';
                break;
            }
          }

          // Update render stats with real data from callback
          setRenderStats(prev => ({
            ...prev,
            currentSamples,
            denoisedSamples,
            maxSamples,
            megaSamplesPerSec,
            currentTime,
            estimatedTime,
            progressPercent,
            status,
          }));
        }
      } catch (error) {
        Logger.error('Failed to process render statistics:', error);
      }
    };

    // Subscribe to OnNewStatistics callback
    client.on('OnNewStatistics', handleStatistics);

    return () => {
      client.off('OnNewStatistics', handleStatistics);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, client]);

  return {
    renderStats,
    setRenderStats,
    showGPUStatsDialog,
    setShowGPUStatsDialog,
    gpuStatsPosition,
    setGPUStatsPosition,
  };
}
