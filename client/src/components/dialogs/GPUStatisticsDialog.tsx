/**
 * GPUStatisticsDialog.tsx
 * Displays GPU resource statistics in Octane SE style
 * Invoked by right-clicking on render progress indicator or GPU quick information bar
 */

import { Logger } from '../../utils/Logger';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOctane } from '../../hooks/useOctane';

interface DeviceStatistics {
  index: number;
  name: string;
  memory: {
    used: number;
    free: number;
    total: number;
    outOfCore: number;
    peerToPeer: number;
  } | null;
  resources: {
    runtime: number;
    film: number;
    geometry: number;
    nodeSystem: number;
    images: number;
    compositor: number;
    denoiser: number;
  } | null;
  geometry: {
    triangles: number;
    dispTriangles: number;
    hairSegments: number;
    voxels: number;
    gaussianSplats: number;
    spheres: number;
    instances: number;
  } | null;
  textures: {
    rgba32: number;
    rgba64: number;
    y8: number;
    y16: number;
    virtual: number;
  } | null;
}

interface GPUStatisticsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  position?: { x: number; y: number };
}

function GPUStatisticsDialog({ isOpen, onClose, position }: GPUStatisticsDialogProps) {
  const { client, connected } = useOctane();
  const [devices, setDevices] = useState<DeviceStatistics[]>([]);
  const [loading, setLoading] = useState(true);
  const [sceneSize, setSceneSize] = useState<number>(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !connected) return;
    let cancelled = false;

    const fetchStatistics = async () => {
      setLoading(true);

      try {
        const deviceCount = await client.getDeviceCount();
        if (cancelled) return;
        Logger.debug(`Found ${deviceCount} GPU device(s)`);

        const deviceStats: DeviceStatistics[] = [];

        for (let i = 0; i < deviceCount; i++) {
          const name = await client.getDeviceName(i);
          if (cancelled) return;
          const memory = await client.getMemoryUsage(i);
          if (cancelled) return;
          const resources = await client.getResourceStatistics(i);
          if (cancelled) return;
          const geometry = await client.getGeometryStatistics(i);
          if (cancelled) return;
          const textures = await client.getTexturesStatistics(i);
          if (cancelled) return;

          deviceStats.push({
            index: i,
            name,
            memory: memory
              ? {
                  used: memory.usedDeviceMemory,
                  free: memory.freeDeviceMemory,
                  total: memory.totalDeviceMemory,
                  outOfCore: memory.outOfCoreMemory,
                  peerToPeer: memory.peerToPeerBytesUsed,
                }
              : null,
            resources: resources
              ? {
                  runtime: resources.runtimeDataSize,
                  film: resources.filmDataSize,
                  geometry: resources.geometryDataSize,
                  nodeSystem: resources.nodeSystemDataSize,
                  images: resources.imagesDataSize,
                  compositor: resources.compositorDataSize,
                  denoiser: resources.denoiserDataSize,
                }
              : null,
            geometry: geometry
              ? {
                  triangles: geometry.triCount,
                  dispTriangles: geometry.dispTriCount,
                  hairSegments: geometry.hairSegCount,
                  voxels: Number(geometry.voxelCount),
                  gaussianSplats: Number(geometry.gaussianSplatCount),
                  spheres: geometry.sphereCount,
                  instances: geometry.instanceCount,
                }
              : null,
            textures: textures
              ? {
                  rgba32: textures.usedRgba32Textures,
                  rgba64: textures.usedRgba64Textures,
                  y8: textures.usedY8Textures,
                  y16: textures.usedY16Textures,
                  virtual: textures.usedVirtualTextures,
                }
              : null,
          });
        }

        setDevices(deviceStats);

        if (deviceStats.length > 0 && deviceStats[0].resources) {
          const r = deviceStats[0].resources;
          setSceneSize(
            r.runtime + r.film + r.geometry + r.nodeSystem + r.images + r.compositor + r.denoiser
          );
        }
      } catch (error) {
        if (cancelled) return;
        Logger.error(
          'Failed to fetch GPU statistics:',
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStatistics();
    return () => {
      cancelled = true;
    };
  }, [isOpen, connected, client]);

  if (!isOpen || !document.body) return null;

  const formatGB = (bytes: number): string => {
    if (bytes <= 0) return '0';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2);
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="gpu-statistics-backdrop" role="presentation" onClick={onClose} />

      {/* Dialog — Octane SE style compact tooltip panel */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        className="gpu-statistics-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gpu-statistics-title"
        onKeyDown={e => {
          if (e.key === 'Escape') onClose();
        }}
        tabIndex={-1}
        style={position ? { top: position.y, left: position.x, transform: 'none' } : undefined}
      >
        <span id="gpu-statistics-title" className="sr-only">
          GPU Statistics
        </span>

        <div className="gpu-statistics-content">
          {loading ? (
            <div className="gpu-statistics-loading">Loading GPU statistics...</div>
          ) : devices.length === 0 ? (
            <div className="gpu-statistics-empty">No GPU devices found</div>
          ) : (
            <>
              {/* Geometry statistics */}
              {devices[0].geometry && (
                <div className="gpu-stats-section">
                  <div className="gpu-stats-label">Geometry statistics:</div>
                  <div className="gpu-stats-bullets">
                    <div>&#8226; Triangles: {formatNumber(devices[0].geometry.triangles)}</div>
                    {devices[0].geometry.dispTriangles > 0 && (
                      <div>
                        &#8226; Displaced triangles:{' '}
                        {formatNumber(devices[0].geometry.dispTriangles)}
                      </div>
                    )}
                    {devices[0].geometry.hairSegments > 0 && (
                      <div>
                        &#8226; Hair segments: {formatNumber(devices[0].geometry.hairSegments)}
                      </div>
                    )}
                    {devices[0].geometry.voxels > 0 && (
                      <div>&#8226; Voxels: {formatNumber(devices[0].geometry.voxels)}</div>
                    )}
                    {devices[0].geometry.gaussianSplats > 0 && (
                      <div>
                        &#8226; Gaussian splats: {formatNumber(devices[0].geometry.gaussianSplats)}
                      </div>
                    )}
                    {devices[0].geometry.spheres > 0 && (
                      <div>&#8226; Spheres: {formatNumber(devices[0].geometry.spheres)}</div>
                    )}
                    <div>&#8226; Meshes: {formatNumber(devices[0].geometry.instances)}</div>
                  </div>
                </div>
              )}

              {/* Textures used */}
              {devices[0].textures && (
                <div className="gpu-stats-section">
                  <div className="gpu-stats-label">Textures used:</div>
                  <div className="gpu-stats-bullets">
                    <div>&#8226; LDR RGB: {formatNumber(devices[0].textures.rgba32)}</div>
                    <div>&#8226; HDR RGB: {formatNumber(devices[0].textures.rgba64)}</div>
                    <div>&#8226; LDR grayscale: {formatNumber(devices[0].textures.y8)}</div>
                    <div>&#8226; HDR grayscale: {formatNumber(devices[0].textures.y16)}</div>
                  </div>
                </div>
              )}

              {/* Scene size */}
              <div className="gpu-stats-section">
                <div>Scene size: {formatGB(sceneSize)} GB</div>
              </div>

              {/* Per-device info */}
              {devices.map(device => (
                <div key={device.index} className="gpu-stats-section">
                  <div className="gpu-stats-label">{device.name}:</div>
                  {device.memory && (
                    <div className="gpu-stats-bullets">
                      <div>
                        &#8226; Used: {formatGB(device.memory.used)} GB
                        {' \u2022 '}
                        Available: {formatGB(device.memory.free)} GB
                      </div>
                      <div>&#8226; Total: {formatGB(device.memory.total)} GB</div>
                      <div>&#8226; HW ray-tracing: On</div>
                    </div>
                  )}
                </div>
              ))}

              {/* Out-of-core memory */}
              {devices[0].memory && (
                <div className="gpu-stats-section">
                  <div>
                    Out-of-core memory used: {formatGB(devices[0].memory.outOfCore)}/
                    {formatGB(4 * 1024 * 1024 * 1024)} GB
                  </div>
                </div>
              )}

              {/* Display color profile */}
              <div className="gpu-stats-section">
                <div>Display color profile: sRGB</div>
              </div>
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

export const GPUStatisticsDialogMemoized = React.memo(GPUStatisticsDialog);
export { GPUStatisticsDialogMemoized as GPUStatisticsDialog };
