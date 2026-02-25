/**
 * File Node Toolbar Component
 * Embedded toolbar for nodes that have a file path (mesh, texture, etc.)
 * showing file operations and the currently loaded file path.
 */

import { SceneNode } from '../../services/OctaneClient';
import { Logger } from '../../utils/Logger';

interface FileNodeToolbarProps {
  node: SceneNode;
}

export function FileNodeToolbar({ node }: FileNodeToolbarProps) {
  // Toolbar button handlers
  const handleLoadFile = () => {
    Logger.debug('Load file clicked for node:', node.name);
    // TODO: Open file chooser (ApiFileChooser) and call the appropriate load API
  };

  const handleReloadMesh = () => {
    Logger.debug('Reload File clicked for node:', node.name);
    // TODO: Reload from node.filePath via the geometry reload API
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
      </div>
    </div>
  );
}
