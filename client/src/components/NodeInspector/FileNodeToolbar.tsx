/**
 * File Node Toolbar Component
 * Embedded toolbar for nodes that have a file path (mesh, texture, etc.)
 * showing file operations and the currently loaded file path.
 */
import type { SceneNode } from '../../services/OctaneClient';
import { AttributeId, AttrType } from '../../constants/OctaneTypes';
import { Logger } from '../../utils/Logger';
import { useOctane } from '../../hooks/useOctane';
import { useFileBrowser } from '../../hooks/useFileBrowser';
import { FileBrowserDialog } from '../dialogs/FileBrowserDialog';

interface FileNodeToolbarProps {
  node: SceneNode;
}

export function FileNodeToolbar({ node }: FileNodeToolbarProps) {
  const { client } = useOctane();

  const fileBrowser = useFileBrowser(async path => {
    if (!path) return;
    try {
      await client.callApi('ApiItem', 'setValueByAttrID', node.handle, {
        attribute_id: AttributeId.A_FILENAME,
        expected_type: AttrType.AT_STRING,
        string_value: path,
        evaluate: true,
      });
      Logger.debug('File loaded for node:', node.name, path);
    } catch (error) {
      Logger.error('Failed to load file for node:', error);
    }
  });

  const handleLoadFile = () => {
    Logger.debug('Load file clicked for node:', node.name);
    fileBrowser.browse({
      mode: 'open',
      title: `Load file for ${node.name}`,
    });
  };

  const handleReloadFile = () => {
    Logger.debug('Reload File clicked for node:', node.name);
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

      {/* File browser dialog */}
      {fileBrowser.dialogProps && <FileBrowserDialog {...fileBrowser.dialogProps} />}
    </div>
  );
}
