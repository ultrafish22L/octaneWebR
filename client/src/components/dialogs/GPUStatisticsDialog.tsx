/**
 * GPUStatisticsDialog.tsx
 * Displays comprehensive GPU resource statistics
 * Invoked by right-clicking on render progress indicator or GPU quick information bar
 */

import { Logger } from '../../utils/Logger';
import React, { useState, useEffect } from 'react';
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
  const [octaneVersion, setOctaneVersion] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !connected) return;

    const fetchStatistics = async () => {
      setLoading(true);

      try {
        // Get Octane version
        const version = await client.getOctaneVersion();
        setOctaneVersion(version);

        // Get device count
        const deviceCount = await client.getDeviceCount();
        Logger.debug(`📊 Found ${deviceCount} GPU device(s)`);

        // Fetch statistics for each device
        const deviceStats: DeviceStatistics[] = [];

        for (let i = 0; i < deviceCount; i++) {
          const name = await client.getDeviceName(i);
          const memory = await client.getMemoryUsage(i);
          const resources = await client.getResourceStatistics(i);
          const geometry = await client.getGeometryStatistics(i);
          const textures = await client.getTexturesStatistics(i);

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
      } catch (error: any) {
        Logger.error('❌ Failed to fetch GPU statistics:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, [isOpen, connected, client]);

  if (!isOpen) return null;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="gpu-statistics-backdrop" onClick={onClose} />

      {/* Dialog */}
      <div
        className="gpu-statistics-dialog"
        style={position ? { top: position.y, left: position.x } : undefined}
      >
        <div className="gpu-statistics-header">
          <h2>GPU Resource Statistics</h2>
          <button className="gpu-statistics-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="gpu-statistics-content">
          {/* Octane Version */}
          <div className="gpu-statistics-section">
            <h3>Octane Version</h3>
            <div className="gpu-statistics-value">{octaneVersion}</div>
          </div>

          {loading ? (
            <div className="gpu-statistics-loading">Loading GPU statistics...</div>
          ) : devices.length === 0 ? (
            <div className="gpu-statistics-empty">No GPU devices found</div>
          ) : (
            devices.map(device => (
              <div key={device.index} className="gpu-statistics-device">
                <h3>
                  Device {device.index}: {device.name}
                </h3>

                {/* Memory Usage */}
                {device.memory && (
                  <div className="gpu-statistics-section">
                    <h4>Memory Usage</h4>
                    <table className="gpu-statistics-table">
                      <tbody>
                        <tr>
                          <td>Used Memory:</td>
                          <td>{formatBytes(device.memory.used)}</td>
                        </tr>
                        <tr>
                          <td>Free Memory:</td>
                          <td>{formatBytes(device.memory.free)}</td>
                        </tr>
                        <tr>
                          <td>Total Memory:</td>
                          <td>{formatBytes(device.memory.total)}</td>
                        </tr>
                        <tr>
                          <td>Usage:</td>
                          <td>
                            {device.memory.total > 0
                              ? ((device.memory.used / device.memory.total) * 100).toFixed(1) + '%'
                              : 'N/A'}
                          </td>
                        </tr>
                        {device.memory.outOfCore > 0 && (
                          <tr>
                            <td>Out-of-Core:</td>
                            <td>{formatBytes(device.memory.outOfCore)}</td>
                          </tr>
                        )}
                        {device.memory.peerToPeer > 0 && (
                          <tr>
                            <td>Peer-to-Peer:</td>
                            <td>{formatBytes(device.memory.peerToPeer)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Resource Statistics */}
                {device.resources && (
                  <div className="gpu-statistics-section">
                    <h4>Resource Breakdown</h4>
                    <table className="gpu-statistics-table">
                      <tbody>
                        <tr>
                          <td>Runtime Data:</td>
                          <td>{formatBytes(device.resources.runtime)}</td>
                        </tr>
                        <tr>
                          <td>Film Data:</td>
                          <td>{formatBytes(device.resources.film)}</td>
                        </tr>
                        <tr>
                          <td>Geometry Data:</td>
                          <td>{formatBytes(device.resources.geometry)}</td>
                        </tr>
                        <tr>
                          <td>Node System Data:</td>
                          <td>{formatBytes(device.resources.nodeSystem)}</td>
                        </tr>
                        <tr>
                          <td>Images Data:</td>
                          <td>{formatBytes(device.resources.images)}</td>
                        </tr>
                        <tr>
                          <td>Compositor Data:</td>
                          <td>{formatBytes(device.resources.compositor)}</td>
                        </tr>
                        <tr>
                          <td>Denoiser Data:</td>
                          <td>{formatBytes(device.resources.denoiser)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Geometry Statistics */}
                {device.geometry && (
                  <div className="gpu-statistics-section">
                    <h4>Geometry Statistics</h4>
                    <table className="gpu-statistics-table">
                      <tbody>
                        <tr>
                          <td>Triangles:</td>
                          <td>{formatNumber(device.geometry.triangles)}</td>
                        </tr>
                        {device.geometry.dispTriangles > 0 && (
                          <tr>
                            <td>Displaced Triangles:</td>
                            <td>{formatNumber(device.geometry.dispTriangles)}</td>
                          </tr>
                        )}
                        {device.geometry.hairSegments > 0 && (
                          <tr>
                            <td>Hair Segments:</td>
                            <td>{formatNumber(device.geometry.hairSegments)}</td>
                          </tr>
                        )}
                        {device.geometry.voxels > 0 && (
                          <tr>
                            <td>Voxels:</td>
                            <td>{formatNumber(device.geometry.voxels)}</td>
                          </tr>
                        )}
                        {device.geometry.gaussianSplats > 0 && (
                          <tr>
                            <td>Gaussian Splats:</td>
                            <td>{formatNumber(device.geometry.gaussianSplats)}</td>
                          </tr>
                        )}
                        {device.geometry.spheres > 0 && (
                          <tr>
                            <td>Spheres:</td>
                            <td>{formatNumber(device.geometry.spheres)}</td>
                          </tr>
                        )}
                        <tr>
                          <td>Instances:</td>
                          <td>{formatNumber(device.geometry.instances)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Texture Statistics */}
                {device.textures && (
                  <div className="gpu-statistics-section">
                    <h4>Texture Statistics</h4>
                    <table className="gpu-statistics-table">
                      <tbody>
                        <tr>
                          <td>RGBA32 Textures:</td>
                          <td>{formatNumber(device.textures.rgba32)}</td>
                        </tr>
                        <tr>
                          <td>RGBA64 Textures:</td>
                          <td>{formatNumber(device.textures.rgba64)}</td>
                        </tr>
                        <tr>
                          <td>Y8 Textures:</td>
                          <td>{formatNumber(device.textures.y8)}</td>
                        </tr>
                        <tr>
                          <td>Y16 Textures:</td>
                          <td>{formatNumber(device.textures.y16)}</td>
                        </tr>
                        <tr>
                          <td>Virtual Textures:</td>
                          <td>{formatNumber(device.textures.virtual)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

export const GPUStatisticsDialogMemoized = React.memo(GPUStatisticsDialog);
export { GPUStatisticsDialogMemoized as GPUStatisticsDialog };
