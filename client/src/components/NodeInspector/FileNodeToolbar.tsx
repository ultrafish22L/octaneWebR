/**
 * File Node Toolbar Component
 * Embedded toolbar for nodes that have a file path (mesh, texture, etc.)
 * showing file operations and relevant metadata
 *
 * Displays:
 * - Toolbar with load/reload/save icons
 * - File path of loaded file
 * - Polygon count information (for geometry nodes)
 */

import { useState } from 'react';
import { SceneNode } from '../../services/OctaneClient';
import { Logger } from '../../utils/Logger';

interface FileNodeToolbarProps {
  node: SceneNode;
}

export function FileNodeToolbar({ node }: FileNodeToolbarProps) {
  const [polygonCount] = useState<number | undefined>(undefined);

  // Toolbar button handlers
  const handleLoadFile = () => {
    Logger.debug('Load file clicked for node:', node.name);
    // TODO: Open file dialog to load mesh
    // This would call client.geometry.loadMesh() or similar
  };

  const handleReloadMesh = () => {
    Logger.debug('Reload File clicked for node:', node.name);
    // TODO: Reload mesh from current file path
    // This would call client.geometry.reloadMesh() or similar
  };

  // Format polygon count with thousands separator
  const formatPolygonCount = (count: number | undefined): string => {
    if (count === undefined) return '';
    return count.toLocaleString();
  };

  return (
    <div className="filenode-toolbar">
      {/* Toolbar buttons */}
      <div className="filenode-toolbar-buttons">
        <button className="filenode-toolbar-btn" onClick={handleLoadFile} title="Load mesh file">
          <img src="/icons/LOAD general.png" alt="Load new" width={16} height={16} />
        </button>
        <button
          className="filenode-toolbar-btn"
          onClick={handleReloadMesh}
          title="Reload mesh"
          disabled={!node.filePath}
        >
          <img src="/icons/RELOAD general.png" alt="Reload" width={16} height={16} />
        </button>
        <button
          className="filenode-toolbar-btn"
          //          onClick={handleSaveMesh}
          title="Edit settings for this file"
        >
          <img
            src="/icons/CUSTOMIZE general.png"
            alt="Edit Settings for this geometry file"
            width={16}
            height={16}
          />
        </button>

        {/* File path display */}
        <div className="geometry-file-path" title={node.filePath || 'No file loaded'}>
          {node.filePath || 'No file'}
        </div>

        {/* Polygon count info */}
        {polygonCount !== undefined && (
          <div className="geometry-polygon-count">{formatPolygonCount(polygonCount)} polygons</div>
        )}
      </div>
    </div>
  );
}
