/**
 * Geometry Toolbar Component
 * Embedded toolbar for geometry/mesh nodes showing file operations and mesh info
 * 
 * Displays:
 * - Toolbar with load/reload/save icons
 * - File path of loaded mesh
 * - Polygon count information
 */

import React, { useState, useEffect } from 'react';
import { SceneNode } from '../../services/OctaneClient';
import { useOctane } from '../../hooks/useOctane';
import { Logger } from '../../utils/Logger';

interface GeometryToolbarProps {
  node: SceneNode;
}

interface MeshInfo {
  filePath?: string;
  polygonCount?: number;
}

export function GeometryToolbar({ node }: GeometryToolbarProps) {
  const { client } = useOctane();
  const [meshInfo, setMeshInfo] = useState<MeshInfo>({});

  // Extract mesh info from node parameters
  useEffect(() => {
    if (!node) return;

    // Look for file path and polygon count in node's children/parameters
    let filePath: string | undefined;
    let polygonCount: number | undefined;

    // Recursively search for file path parameter
    const findFileParam = (n: SceneNode): void => {
      if (n.pinInfo?.name === 'File' || n.pinInfo?.name === 'file' || n.pinInfo?.name === 'filename') {
        // File parameter - extract the value if it's a string
        if (n.value && typeof n.value === 'string') {
          filePath = n.value;
        }
      }
      
      if (n.children) {
        n.children.forEach(findFileParam);
      }
    };

    findFileParam(node);

    // For now, we'll need to get polygon count from gRPC
    // This would require a new API call to get mesh statistics
    // Placeholder for now - will be populated via gRPC call
    
    setMeshInfo({ filePath, polygonCount });
  }, [node]);

  // Toolbar button handlers
  const handleLoadMesh = () => {
    Logger.debug('Load mesh clicked for node:', node.name);
    // TODO: Open file dialog to load mesh
    // This would call client.geometry.loadMesh() or similar
  };

  const handleReloadMesh = () => {
    Logger.debug('Reload mesh clicked for node:', node.name);
    // TODO: Reload mesh from current file path
    // This would call client.geometry.reloadMesh() or similar
  };

  const handleSaveMesh = () => {
    Logger.debug('Save mesh clicked for node:', node.name);
    // TODO: Open save dialog to export mesh
  };

  const handleClearMesh = () => {
    Logger.debug('Clear mesh clicked for node:', node.name);
    // TODO: Clear/unload mesh
  };

  // Format polygon count with thousands separator
  const formatPolygonCount = (count: number | undefined): string => {
    if (count === undefined) return '';
    return count.toLocaleString();
  };

  // Extract filename from full path
  const getFilename = (path: string | undefined): string => {
    if (!path) return 'No node';
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1] || path;
  };

  return (
    <div className="geometry-toolbar">
      {/* Toolbar buttons */}
      <div className="geometry-toolbar-buttons">
        <button
          className="geometry-toolbar-btn"
          onClick={handleLoadMesh}
          title="Load mesh file"
        >
          <img src="/icons/load geometry.png" alt="Load" width={16} height={16} />
        </button>
        <button
          className="geometry-toolbar-btn"
          onClick={handleReloadMesh}
          title="Reload mesh"
          disabled={!meshInfo.filePath}
        >
          <img src="/icons/RELOAD general.png" alt="Reload" width={16} height={16} />
        </button>
        <button
          className="geometry-toolbar-btn"
          onClick={handleSaveMesh}
          title="Save/export mesh"
        >
          <img src="/icons/save-general.png" alt="Save" width={16} height={16} />
        </button>
        <button
          className="geometry-toolbar-btn"
          onClick={handleClearMesh}
          title="Clear mesh"
        >
          <img src="/icons/UNLOAD_all.png" alt="Clear" width={16} height={16} />
        </button>
      </div>

      {/* File path display */}
      <div className="geometry-file-path" title={meshInfo.filePath || 'No mesh loaded'}>
        {meshInfo.filePath || 'No node'}
      </div>

      {/* Polygon count info */}
      {meshInfo.polygonCount !== undefined && (
        <div className="geometry-polygon-count">
          {formatPolygonCount(meshInfo.polygonCount)} polygons
        </div>
      )}
    </div>
  );
}
