/**
 * Geometry Toolbar Component
 * Embedded toolbar for geometry/mesh nodes showing file operations and mesh info
 * 
 * Displays:
 * - Toolbar with load/reload/save icons
 * - File path of loaded mesh
 * - Polygon count information
 */

import { useState, useEffect } from 'react';
import { SceneNode } from '../../services/OctaneClient';
import { useOctane } from '../../hooks/useOctane';
import { Logger } from '../../utils/Logger';
import { requestQueue } from '../../utils/RequestQueue';
import { AttributeId, AttrType } from '../../constants/OctaneTypes';

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

    const response = requestQueue.enqueue(() =>
      client.callApi(
        'ApiItem',
        "getByAttrID",
        node.handle, 
        {
          attribute_id: AttributeId.A_FILENAME,
          expected_type: AttrType.AT_STRING,
        }
      )
    );

    if (response) {
      // Extract the actual value from the response
      // API returns format like: {float_value: 2, value: "float_value"}
      // We need to get the value from the field indicated by response.value
      const valueField = Object.keys(response)[0];
      filePath = Object(response)[valueField];
    }

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

  // Format polygon count with thousands separator
  const formatPolygonCount = (count: number | undefined): string => {
    if (count === undefined) return '';
    return count.toLocaleString();
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
          <img src="/icons/load geometry.png" alt="Load new mesh" width={16} height={16} />
        </button>
        <button
          className="geometry-toolbar-btn"
          onClick={handleReloadMesh}
          title="Reload mesh"
          disabled={!meshInfo.filePath}
        >
          <img src="/icons/RELOAD general.png" alt="Reload mesh" width={16} height={16} />
        </button>
        <button
          className="geometry-toolbar-btn"
//          onClick={handleSaveMesh}
          title="Save/export mesh"
        >
          <img src="/icons/CUSTOMIZE general.png" alt="Edit Settings for this geometry file" width={16} height={16} />
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
