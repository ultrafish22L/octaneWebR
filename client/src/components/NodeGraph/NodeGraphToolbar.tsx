/**
 * Node Graph Editor Toolbar Component
 * Matches Octane SE Manual Figure 10 - The Graph Editor buttons
 * https://docs.otoy.com/standaloneSE/TheGraphEditor.html
 *
 * Documented buttons (converted to vertical layout, docked left):
 * 1. Recenter View
 * 2. Re-arrange Graph with Sub-graph
 * 3. Re-arrange Graph
 * 4. View/Hide Render Target Preview Scene
 * 5. View/Hide Mesh Preview Scene
 * 6. View/Hide Material Preview Scene
 * 7. View/Hide Texture Preview Scene
 * 8. Snap Items To Grid
 * 9. View/Hide Graph Editor Grid
 */

import { Logger } from '../../utils/Logger';
import { useCallback, useState } from 'react';
import { getWindowControlIcon, getPreviewModeIcon } from '../../constants/UIIconMapping';

interface NodeGraphToolbarProps {
  gridVisible: boolean;
  setGridVisible: (visible: boolean) => void;
  snapToGrid: boolean;
  setSnapToGrid: (snap: boolean) => void;
  onRecenterView?: () => void; // Optional callback for recenter (from ReactFlow fitView)
  /** Triggers the DAG auto-layout algorithm on the current graph. */
  onAutoLayout?: () => void;
}

export function NodeGraphToolbar({
  gridVisible,
  setGridVisible,
  snapToGrid,
  setSnapToGrid,
  onRecenterView,
  onAutoLayout,
}: NodeGraphToolbarProps) {
  // Toggle states for preview scenes (managed locally)
  const [renderTargetPreview, setRenderTargetPreview] = useState(true);
  const [meshPreview, setMeshPreview] = useState(false);
  const [materialPreview, setMaterialPreview] = useState(false);
  const [texturePreview, setTexturePreview] = useState(false);

  // 1. Recenter View
  const handleRecenterView = useCallback(() => {
    Logger.debug('Recenter View');
    if (onRecenterView) {
      onRecenterView();
    }
  }, [onRecenterView]);

  // 2. Re-arrange Graph with Sub-graph
  // Note: the current graph shows only top-level nodes; sub-graph expansion is not
  // yet implemented, so this runs the same layout as button 3.
  const handleRearrangeWithSubgraph = useCallback(() => {
    Logger.debug('Re-arrange Graph with Sub-graph');
    onAutoLayout?.();
  }, [onAutoLayout]);

  // 3. Re-arrange Graph
  const handleRearrangeGraph = useCallback(() => {
    Logger.debug('Re-arrange Graph');
    onAutoLayout?.();
  }, [onAutoLayout]);

  // 4. View/Hide Render Target Preview Scene
  const handleToggleRenderTargetPreview = useCallback(() => {
    setRenderTargetPreview(prev => {
      const newState = !prev;
      Logger.debug(`Render Target Preview: ${newState ? 'SHOW' : 'HIDE'}`);
      return newState;
    });
    // Future: wire to Octane render target preview toggle
  }, []);

  // 5. View/Hide Mesh Preview Scene
  const handleToggleMeshPreview = useCallback(() => {
    setMeshPreview(prev => {
      const newState = !prev;
      Logger.debug(`Mesh Preview: ${newState ? 'SHOW' : 'HIDE'}`);
      return newState;
    });
    // Future: wire to Octane mesh preview toggle
  }, []);

  // 6. View/Hide Material Preview Scene
  const handleToggleMaterialPreview = useCallback(() => {
    setMaterialPreview(prev => {
      const newState = !prev;
      Logger.debug(`Material Preview: ${newState ? 'SHOW' : 'HIDE'}`);
      return newState;
    });
    // Future: wire to Octane material preview toggle
  }, []);

  // 7. View/Hide Texture Preview Scene
  const handleToggleTexturePreview = useCallback(() => {
    setTexturePreview(prev => {
      const newState = !prev;
      Logger.debug(`Texture Preview: ${newState ? 'SHOW' : 'HIDE'}`);
      return newState;
    });
    // Future: wire to Octane texture preview toggle
  }, []);

  // 8. Snap Items To Grid
  const handleToggleGridSnap = useCallback(() => {
    const newState = !snapToGrid;
    setSnapToGrid(newState);
    Logger.debug(`Snap Items To Grid: ${newState ? 'ON' : 'OFF'}`);
  }, [snapToGrid, setSnapToGrid]);

  // 9. View/Hide Graph Editor Grid
  const handleToggleGrid = useCallback(() => {
    const newState = !gridVisible;
    setGridVisible(newState);
    Logger.debug(`Graph Editor Grid: ${newState ? 'SHOW' : 'HIDE'}`);
  }, [gridVisible, setGridVisible]);

  return (
    <div className="node-graph-toolbar">
      {/* Layout / Arrange group */}
      <button
        className="toolbar-button"
        onClick={handleRecenterView}
        title="Centers the nodes in the graph editor."
      >
        <img src={getWindowControlIcon('RECENTER')} alt="Recenter view" />
      </button>
      <button
        className="toolbar-button"
        onClick={handleRearrangeGraph}
        title="Rearranges the items in this graph to make it look tidier."
      >
        <img src={getWindowControlIcon('UNFOLD_GRAPH')} alt="Rearrange graph" />
      </button>
      <button
        className="toolbar-button"
        onClick={handleRearrangeWithSubgraph}
        title="Rearranges the items in this graph and all the sub-graphs."
      >
        <img src={getWindowControlIcon('UNFOLD_GRAPH_RECURSIVELY')} alt="Rearrange recursively" />
      </button>

      <div className="controls-spacer-vertical" />

      {/* Preview toggles group */}
      <button
        className={`toolbar-button ${renderTargetPreview ? 'active' : ''}`}
        onClick={handleToggleRenderTargetPreview}
        title="Toggles rendering of render target nodes when selected in the graph editor."
      >
        <img src={getPreviewModeIcon('RENDER_TARGET_PREVIEW')} alt="Render render target" />
      </button>
      <button
        className={`toolbar-button ${meshPreview ? 'active' : ''}`}
        onClick={handleToggleMeshPreview}
        title="Toggles rendering of geometry nodes when selected in the graph editor."
      >
        <img src={getPreviewModeIcon('MESH_PREVIEW')} alt="Render geometry" />
      </button>
      <button
        className={`toolbar-button ${materialPreview ? 'active' : ''}`}
        onClick={handleToggleMaterialPreview}
        title="Toggles rendering of material nodes when selected in the graph editor."
      >
        <img src={getPreviewModeIcon('MATERIAL_PREVIEW')} alt="Render materials" />
      </button>
      <button
        className={`toolbar-button ${texturePreview ? 'active' : ''}`}
        onClick={handleToggleTexturePreview}
        title="Toggles rendering of texture nodes when selected in the graph editor."
      >
        <img src={getPreviewModeIcon('TEXTURE_PREVIEW')} alt="Render textures" />
      </button>

      <div className="controls-spacer-vertical" />

      {/* Grid group */}
      <button
        className={`toolbar-button ${snapToGrid ? 'active' : ''}`}
        onClick={handleToggleGridSnap}
        title="Toggles snapping of items to the grid in the graph editor."
      >
        <img src={getWindowControlIcon('SNAP_TO_GRID')} alt="Snap grid" />
      </button>
      <button
        className={`toolbar-button ${gridVisible ? 'active' : ''}`}
        onClick={handleToggleGrid}
        title="Toggles displaying of the grid in the node graph editor."
      >
        <img src={getWindowControlIcon('GRID_TOGGLE')} alt="Show grid" />
      </button>
    </div>
  );
}
