/**
 * File Node Toolbar Component
 * Embedded toolbar for nodes that have a file path (mesh, texture, etc.)
 * showing file operations and the currently loaded file path.
 */
import type { SceneNode, OctaneClient } from '../../services/OctaneClient';
import { AttributeId, AttrType } from '../../constants/OctaneTypes';
import { Logger } from '../../utils/Logger';

interface FileNodeToolbarProps {
  node: SceneNode;
}

export function FileNodeToolbar({ node }: FileNodeToolbarProps, client: OctaneClient) {
  // Toolbar button handlers
  const handleLoadFile = () => {
    Logger.debug('Load file clicked for node:', node.name);
    // TODO: Open file chooser (ApiFileChooser) and call the appropriate load API
  };

  const handleReloadFile = () => {
    Logger.debug('Reload File clicked for node:', node.name);
    // Call setValueByAttrID to force a reload in Octane
    client.callApi('ApiItem', 'setValueByAttrID', node.handle, {
      attribute_id: AttributeId.A_VALUE,
      expected_type: AttrType.AT_BOOL,
      ['bool_value']: true,
      evaluate: true,
    });
  };

  return (
    <div className="filenode-toolbar">
      {/* Toolbar buttons */}
      <div className="filenode-toolbar-buttons">
        <button className="filenode-toolbar-btn" onClick={handleLoadFile} title="Load file">
          <img src="/icons/LOAD general.png" alt="Load new" width={16} height={16} />
        </button>
        <button
          className="filenode-toolbar-btn"
          onClick={handleReloadFile}
          title="Reload file"
          disabled={!node.filePath}
        >
          <img src="/icons/RELOAD general.png" alt="Reload" width={16} height={16} />
        </button>
        <button
          className="filenode-toolbar-btn"
          onClick={handleReloadFile}
          title="Edit settings for this file"
        >
          <img
            src="/icons/CUSTOMIZE general.png"
            alt="Edit Settings for this file"
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
