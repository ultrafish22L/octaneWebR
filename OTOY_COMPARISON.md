# OctaneWebR vs Octane Standalone SE — Feature Comparison

Comparison of OctaneWebR (v1.4.3) against the official OTOY Octane Standalone Edition documentation at https://docs.otoy.com/standaloneSE/CoverPage.html.

Date: 2026-03-06

---

## Summary

OctaneWebR implements the **core workflow** of Octane Standalone: scene loading, node graph editing, parameter inspection, real-time viewport rendering, camera control, material browsing, and render export. The app covers the primary interactive loop well.

**Estimated coverage: ~40-45% of Octane Standalone's full feature surface.**

Key strengths:

- Full node graph editor with 755 node types, connections, grouping, copy/paste
- Real-time callback-based viewport with camera orbit/pan/zoom
- Complete render toolbar with all picking modes, clay mode, sub-sampling
- Node Inspector with recursive parameter editing
- Material Database (LiveDB + LocalDB) browsing and downloading
- Batch rendering, daylight animation, turntable animation dialogs
- File operations (New, Open, Save, Save As, Save As Package)
- Scene Outliner with virtual scrolling

Key gaps:

- No object placement/transform gizmos (translate/rotate/scale buttons exist but gizmos not rendered)
- No animation timeline or playback controls
- No Lua/OSL script editor
- No AOV/render pass viewer or compositor
- Many dialog UIs are stubs (not wired to Octane backend)
- No undo/redo integration with Octane
- No USD stage editor, log window, or multi-viewport

---

## Implemented Features

### Render Viewport (TheRenderViewport.html)

| Feature                         | Status | Notes                                   |
| ------------------------------- | ------ | --------------------------------------- |
| Real-time render display        | DONE   | Callback-based streaming via OnNewImage |
| Camera orbit (left-drag)        | DONE   | Spherical coordinate camera model       |
| Camera pan (right-drag)         | DONE   |                                         |
| Camera zoom (scroll wheel)      | DONE   |                                         |
| Recenter View                   | DONE   | Button + keyboard shortcut              |
| Reset Camera                    | DONE   | Restores original camera state          |
| Camera View Presets             | DONE   | Front/Back/Left/Right/Top/Bottom        |
| Stop/Start/Pause/Restart Render | DONE   | Full render control via ApiRenderEngine |
| Clay Mode                       | DONE   | Toggle via toolbar                      |
| Sub-Sampling (2x2, 4x4)         | DONE   | Navigation smoothness settings          |
| Auto Focus Picking              | DONE   | Click to focus camera                   |
| White Balance Picking           | DONE   | Select white point color                |
| Material Picker                 | DONE   | Inspect material at click point         |
| Object Picker                   | DONE   | Select objects to inspect               |
| Camera Target Picker            | DONE   | Set rotation center                     |
| Render Region Picker            | DONE   | Drag to specify render region           |
| Film Region Picker              | DONE   | Set film region parameters              |
| Copy to Clipboard               | DONE   | Grab render as image                    |
| Save Render                     | DONE   | PNG/JPG/EXR/TIFF via saveImage1         |
| Export Render Passes            | DONE   | Basic export (beauty pass only)         |
| Lock Viewport                   | DONE   | Prevent accidental changes              |
| Render Priority                 | DONE   | Low/Normal/High GPU priority            |
| Display World Coordinate        | DONE   | Rotates with camera orientation         |
| Context Menu                    | DONE   | Copy/Save/Export/Background/Lock        |

### Node Graph Editor (TheGraphEditor.html)

| Feature                        | Status | Notes                           |
| ------------------------------ | ------ | ------------------------------- |
| Display scene nodes            | DONE   | ReactFlow-based graph           |
| Node selection (single/multi)  | DONE   | Click + Shift/Ctrl selection    |
| Node connections (drag edges)  | DONE   | useConnectionOperations hook    |
| Add nodes (right-click menu)   | DONE   | 755 node types in 26 categories |
| Delete nodes                   | DONE   | Del key + context menu          |
| Copy/Paste nodes               | DONE   | Ctrl+C/V                        |
| Cut nodes                      | DONE   | Ctrl+X                          |
| Group nodes                    | DONE   | Combine into node graph group   |
| Expand/Collapse groups         | DONE   | Via context menu                |
| Recenter View                  | DONE   | Fit all nodes                   |
| Auto-layout (re-arrange graph) | DONE   | DAG layout algorithm            |
| Grid display toggle            | DONE   | Show/hide background grid       |
| Snap to grid                   | DONE   | Snap node positions             |
| Search nodes (Ctrl+F)          | DONE   | SearchDialog component          |
| Context menu (right-click)     | DONE   | Full menu matching Octane SE    |
| Show in Outliner               | DONE   | Navigate to node in outliner    |
| Node drag/reposition           | DONE   | Drag nodes with mouse           |

### Node Inspector

| Feature                 | Status | Notes                                 |
| ----------------------- | ------ | ------------------------------------- |
| Display node parameters | DONE   | Recursive tree rendering              |
| Edit parameter values   | DONE   | Float, int, bool, enum, color, string |
| Parameter grouping      | DONE   | Collapsible sections                  |
| Pin connections display | DONE   | Shows connected/unconnected pins      |
| File node toolbar       | DONE   | Browse/Reload for file nodes          |
| Color picker            | DONE   | RGB color editing                     |

### Scene Outliner

| Feature                | Status | Notes                             |
| ---------------------- | ------ | --------------------------------- |
| Hierarchical tree view | DONE   | Virtual scrolling for performance |
| Node selection         | DONE   | Click to select, syncs with graph |
| Context menu           | DONE   | Node operations                   |
| LiveDB tab             | DONE   | Browse OTOY material library      |
| LocalDB tab            | DONE   | Browse local material packages    |
| Material download      | DONE   | Double-click to download          |

### File Operations (LoadingandSavingaScene.html)

| Feature                | Status  | Notes                           |
| ---------------------- | ------- | ------------------------------- |
| New scene              | DONE    | File > New (Ctrl+N)             |
| Open scene (ORBX/OCS)  | DONE    | File browser dialog             |
| Save scene             | DONE    | File > Save (Ctrl+S)            |
| Save As                | DONE    | File browser dialog             |
| Save As Package (ORBX) | DONE    | SavePackageDialog with settings |
| Recent files           | DONE    | Persistent recent file list     |
| Preferences dialog     | PARTIAL | UI exists, not wired to Octane  |

### Render Settings

| Feature              | Status | Notes                                                                                                                 |
| -------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| Kernel selection     | DONE   | All 6 kernel types in node types (Direct Lighting, Path Tracing, PMC, Photon Tracing, Info Channel, Material Preview) |
| Render Target node   | DONE   | Visible in graph with all pins                                                                                        |
| Film Settings node   | DONE   | Resolution parameters editable                                                                                        |
| Imager node          | DONE   | Editable via Node Inspector                                                                                           |
| Post-Processing node | DONE   | Editable via Node Inspector                                                                                           |

### Materials

| Feature                    | Status | Notes                                                                                                                                                                           |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All 16 material types      | DONE   | Creatable via context menu (Diffuse, Glossy, Specular, Metallic, Universal, Mix, Toon, Hair, Layered, Clipping, Null, Portal, Shadow Catcher, Standard Surface, Composite, OSL) |
| Material Database          | DONE   | LiveDB + LocalDB browsing                                                                                                                                                       |
| Material parameter editing | DONE   | Via Node Inspector                                                                                                                                                              |

### Camera Types

| Feature               | Status | Notes                 |
| --------------------- | ------ | --------------------- |
| Thin Lens camera      | DONE   | NT_CAM_THINLENS       |
| Universal camera      | DONE   | NT_CAM_UNIVERSAL      |
| Panoramic camera      | DONE   | NT_CAM_PANORAMIC      |
| Baking camera         | DONE   | NT_CAM_BAKING         |
| OSL camera            | DONE   | NT_CAM_OSL            |
| OSL Baking camera     | DONE   | NT_CAM_OSL_BAKING     |
| Simulated Lens camera | DONE   | NT_CAM_SIMULATED_LENS |

### Environments

| Feature               | Status | Notes                                |
| --------------------- | ------ | ------------------------------------ |
| Daylight Environment  | DONE   | NT_ENV_DAYLIGHT, parameters editable |
| Texture Environment   | DONE   | NT_ENV_TEXTURE                       |
| Planetary Environment | DONE   | NT_ENV_PLANETARY                     |

### GPU / Device Management

| Feature             | Status | Notes                                        |
| ------------------- | ------ | -------------------------------------------- |
| GPU statistics      | DONE   | Memory, version, device info                 |
| Resource statistics | DONE   | Runtime, film, geometry, textures data sizes |
| Geometry statistics | DONE   | Triangle count, instances, emitters          |
| Render statistics   | DONE   | Samples/sec, time, progress                  |

### Keyboard Shortcuts

| Feature                      | Status | Notes           |
| ---------------------------- | ------ | --------------- |
| File operations (Ctrl+N/O/S) | DONE   |                 |
| Edit operations (Ctrl+X/C/V) | DONE   |                 |
| Find (Ctrl+F)                | DONE   |                 |
| Fullscreen (F11)             | DONE   |                 |
| Help (F1)                    | DONE   | Opens OTOY docs |
| Refresh (F5)                 | DONE   | Refresh scene   |

---

## Not Yet Implemented

### 1. Object Placement / Transform Gizmos

- **Description**: In Octane SE, the Placement Translation, Rotation, and Scale tools render interactive 3D gizmos overlaid on the viewport. Users drag axis handles to translate, rotate, or scale objects directly in the viewport.
- **Doc page**: [TheRenderViewport.html](https://docs.otoy.com/standaloneSE/TheRenderViewport.html) — "Placement Translation Tool", "Placement Rotation Tool", "Placement Scale Tool"
- **Current state**: Toolbar buttons exist and toggle modes, but no actual gizmo rendering or interaction in the viewport canvas.
- **Complexity**: Hard
- **Priority**: High — fundamental for scene editing workflow

### 2. Animation Timeline and Playback

- **Description**: Octane SE has an animation timeline slider at the bottom of the viewport for scrubbing through animated geometry, FBX timelines, and image sequences. Includes play/pause/frame stepping controls.
- **Doc page**: [TheRenderViewport.html](https://docs.otoy.com/standaloneSE/TheRenderViewport.html) — "Time Slider"
- **Current state**: IMPROVEMENTS.md item #9 ("Animation bar below render bar") acknowledged as missing. No timeline component exists.
- **Complexity**: Medium
- **Priority**: Medium — needed for animated scene workflows

### 3. Undo/Redo Integration

- **Description**: Octane SE supports undo/redo for node graph operations (create, delete, connect, disconnect, move, parameter changes). OctaneWebR has a CommandHistory service but it is not integrated with Octane's internal undo system.
- **Doc page**: General Octane workflow — standard Ctrl+Z/Ctrl+Y
- **Current state**: Menu items exist (disabled). CommandHistory class exists but undo/redo shortcuts are commented out in MenuBar.tsx.
- **Complexity**: Hard
- **Priority**: High — critical for usable editing

### 4. Lua Script Editor

- **Description**: Octane SE includes a built-in Lua script editor for workflow automation, animation scripting, and custom tools. Scripts can create nodes, modify parameters, render, and access the full Octane API.
- **Doc page**: [LUAScriptinginOctaneRender.html](https://docs.otoy.com/standaloneSE/LUAScriptinginOctaneRender.html) — Script editor, Lua API browser
- **Current state**: Menu items exist (Window > Create script editor, Create Lua API browser) but all disabled. No script execution capability.
- **Complexity**: Hard
- **Priority**: Low — power-user feature, not essential for basic workflow

### 5. OSL Editor

- **Description**: Octane SE has an OSL (Open Shading Language) editor for creating custom textures, materials, cameras, and geometry procedurally.
- **Doc page**: [OSLTexture.html](https://docs.otoy.com/standaloneSE/OSLTexture.html), [OSLCameraNode.html](https://docs.otoy.com/standaloneSE/OSLCameraNode.html)
- **Current state**: Menu item exists (Window > Create OSL editor) but disabled. OSL node types are defined (NT_MAT_OSL, NT_CAM_OSL, NT_PROJ_OSL, etc.) but no code editing UI.
- **Complexity**: Hard
- **Priority**: Low — advanced feature

### 6. AOV / Render Pass Viewer

- **Description**: Octane SE allows viewing individual render passes (AOVs) directly in the viewport. Users can select which AOV to display (beauty, diffuse, normals, depth, motion vectors, etc.) and see it in real-time.
- **Doc page**: [RenderAOVs.html](https://docs.otoy.com/standaloneSE/RenderAOVs.html), [BeautyAOVs.html](https://docs.otoy.com/standaloneSE/BeautyAOVs.html)
- **Current state**: All 60+ AOV node types are defined in NodeTypes.ts but there is no UI to switch the viewport display between passes. Export is beauty-pass only.
- **Complexity**: Medium
- **Priority**: High — essential for professional compositing workflow

### 7. Output AOV Compositor

- **Description**: Octane SE can composite AOVs directly inside the application using Output AOV nodes (blend, color correct, apply LUT, mix light passes, etc.). The Output AOV system is a full node-based compositor.
- **Doc page**: [AOVsandCompositing.html](https://docs.otoy.com/standaloneSE/AOVsandCompositing.html), [OutputAOV.html](https://docs.otoy.com/standaloneSE/OutputAOV.html)
- **Current state**: Output AOV node types exist in NodeTypes.ts (40+ Output AOV layer types). Nodes can be created in graph, but no dedicated compositor UI or preview.
- **Complexity**: Hard
- **Priority**: Medium — advanced compositing feature

### 8. Light Mixer

- **Description**: The Light Mixer allows post-render adjustment of individual light intensities and tints without re-rendering. Each light emitter is assigned a Light Pass ID, and the mixer provides per-light controls.
- **Doc page**: [LightMixer.html](https://docs.otoy.com/standaloneSE/LightMixer.html)
- **Current state**: Light Mixer blend node type exists (NT_OUTPUT_AOV_LIGHT_MIXING) but no dedicated Light Mixer UI panel.
- **Complexity**: Medium
- **Priority**: Medium — useful for lighting artists

### 9. Multi-pass Render Export

- **Description**: Export all render passes as individual files or layered EXR. Octane SE supports choosing which passes to export, naming templates, and layered EXR output.
- **Doc page**: [BatchRendering.html](https://docs.otoy.com/standaloneSE/BatchRendering.html), [RenderAOVs.html](https://docs.otoy.com/standaloneSE/RenderAOVs.html)
- **Current state**: Export is hardcoded to beauty pass only (IMPROVEMENTS.md item #2). No pass selection UI. No layered EXR support.
- **Complexity**: Medium
- **Priority**: High — needed for professional output

### 10. Material Preview Scenes

- **Description**: Octane SE shows internal material preview spheres when a material node is selected in the graph editor. Toolbar buttons toggle render target, mesh, material, and texture previews.
- **Doc page**: [TheGraphEditor.html](https://docs.otoy.com/standaloneSE/TheGraphEditor.html) — "Material Previews"
- **Current state**: Preview toggle buttons exist in NodeGraphToolbar.tsx but are marked with `// TODO: Show/hide preview`. No preview rendering is implemented.
- **Complexity**: Medium
- **Priority**: Medium — helpful for material editing workflow

### 11. Node Graph Sub-graph Navigation

- **Description**: In Octane SE, double-clicking a group node opens it in a new tab, allowing drill-down into nested sub-graphs. The graph editor supports tabbed navigation between graph levels.
- **Doc page**: [TheGraphEditor.html](https://docs.otoy.com/standaloneSE/TheGraphEditor.html) — "Grouping"
- **Current state**: Group/ungroup operations work. Expand/collapse works. But no tabbed sub-graph navigation — grouped nodes show as collapsed in the main graph.
- **Complexity**: Medium
- **Priority**: Medium — needed for complex scene organization

### 12. Connection Cutter Tool

- **Description**: Hold Ctrl and drag a line across multiple connections to cut them all at once, enabling batch disconnection.
- **Doc page**: [TheGraphEditor.html](https://docs.otoy.com/standaloneSE/TheGraphEditor.html) — "Connection Cutter"
- **Current state**: Individual pin disconnection works. Ctrl+click disconnect on single connections works. No cross-line batch cutter.
- **Complexity**: Easy
- **Priority**: Low — convenience feature

### 13. Multi-Connect (Selected Nodes to Pin)

- **Description**: Hold Ctrl while connecting to a pin to connect all currently selected nodes simultaneously to that single pin.
- **Doc page**: [TheGraphEditor.html](https://docs.otoy.com/standaloneSE/TheGraphEditor.html) — "Multi-Connect"
- **Current state**: IMPROVEMENTS.md item #6 acknowledges this gap. Only first selected node connects.
- **Complexity**: Easy
- **Priority**: Low — convenience feature

### 14. Denoiser Controls

- **Description**: Octane SE has integrated AI denoiser (Spectral AI and OIDN) with controls for denoiser method, blend, completion percentage, volume denoising, and interval.
- **Doc page**: [Denoiser.html](https://docs.otoy.com/standaloneSE/Denoiser.html), [ImagerSettings.html](https://docs.otoy.com/standaloneSE/ImagerSettings.html)
- **Current state**: Denoiser parameters are exposed via the Imager node in the Node Inspector (as generic parameters). No dedicated denoiser UI or toggle button on the toolbar.
- **Complexity**: Easy
- **Priority**: Medium — denoising is heavily used in practice

### 15. Geometry Exporter

- **Description**: Export scene geometry as FBX or Alembic (ABC) format via a Geometry Exporter node.
- **Doc page**: [GeometryExporter.html](https://docs.otoy.com/standaloneSE/GeometryExporter.html)
- **Current state**: NT_GEO_EXPORTER node type defined. Can be created in graph. Parameters editable in inspector. No dedicated export workflow UI.
- **Complexity**: Easy
- **Priority**: Low — niche feature

### 16. Viewport Resolution Lock

- **Description**: Toggle that makes the rendered image resolution match the viewport panel size, auto-adjusting as the viewport resizes.
- **Doc page**: [TheRenderViewport.html](https://docs.otoy.com/standaloneSE/TheRenderViewport.html) — "Viewport Resolution Lock"
- **Current state**: API methods exist (`getViewportResolutionLock`, `setViewportResolutionLock` in OctaneClient.ts). No UI toggle connected to it.
- **Complexity**: Easy
- **Priority**: Medium — useful for preview vs final resolution switching

### 17. Real-Time Rendering Mode

- **Description**: A toggle that uses more GPU memory for a more interactive rendering experience with faster response to scene changes.
- **Doc page**: [TheRenderViewport.html](https://docs.otoy.com/standaloneSE/TheRenderViewport.html) — "Real Time Rendering"
- **Current state**: Toolbar button exists. No backend implementation to toggle this mode via gRPC.
- **Complexity**: Easy
- **Priority**: Medium

### 18. Decal Wireframe Display

- **Description**: Toggle wireframe visualization along decal boundaries in the viewport.
- **Doc page**: [TheRenderViewport.html](https://docs.otoy.com/standaloneSE/TheRenderViewport.html) — "Decal Wireframe Boundaries"
- **Current state**: Toolbar button exists. No backend implementation.
- **Complexity**: Easy
- **Priority**: Low

### 19. Set Background Image

- **Description**: Place a reference background image behind the rendered viewport for compositing alignment.
- **Doc page**: [TheRenderViewport.html](https://docs.otoy.com/standaloneSE/TheRenderViewport.html) — "Set Background Image"
- **Current state**: Toolbar button and context menu item exist. Handler is a stub.
- **Complexity**: Easy
- **Priority**: Low

### 20. Workspace Layout Management

- **Description**: Octane SE allows saving, loading, and resetting workspace panel layouts. Users can save custom arrangements and switch between them.
- **Doc page**: General Octane UI — Window menu
- **Current state**: Menu items exist (Window > Reset/Save/Load workspace layout) but all disabled. Panel resizing works but layout persistence is not implemented.
- **Complexity**: Medium
- **Priority**: Low

### 21. Log Window

- **Description**: Octane SE has a dedicated log window showing render engine messages, warnings, errors, and script output.
- **Doc page**: General Octane UI — Window > Create log window
- **Current state**: Menu item exists (disabled). No log panel component. Client logging goes to browser console.
- **Complexity**: Easy
- **Priority**: Low

### 22. Multi-Viewport

- **Description**: Octane SE supports multiple viewport windows, each potentially showing a different render target.
- **Doc page**: General Octane UI — Window > Create scene viewport
- **Current state**: Single viewport only. Menu item disabled. Multiple render targets can be selected via API but only one viewport exists.
- **Complexity**: Hard
- **Priority**: Low

### 23. USD Stage Editor

- **Description**: Octane SE includes a USD Stage Editor for browsing and editing Universal Scene Description hierarchies.
- **Doc page**: General Octane UI — Window > Create USD stage editor
- **Current state**: Menu item exists (disabled). No USD editor component.
- **Complexity**: Hard
- **Priority**: Low

### 24. OCIO Color Management UI

- **Description**: Octane SE has OCIO (OpenColorIO) view, look, and color space selection in the Imager settings. While parameters are editable generically, there is no dedicated OCIO configuration UI.
- **Doc page**: [ImagerSettings.html](https://docs.otoy.com/standaloneSE/ImagerSettings.html) — "OCIO Color Management"
- **Current state**: OCIO-related output node types exist (NT_OUT_OCIO_COLOR_SPACE, NT_OUT_OCIO_LOOK, NT_OUT_OCIO_VIEW). Parameters editable via inspector but no dedicated OCIO UI.
- **Complexity**: Medium
- **Priority**: Low

### 25. Render for VR

- **Description**: Octane SE supports rendering for VR with cube maps, equirectangular, and stereo output modes via the Panoramic camera.
- **Doc page**: [RenderingforVR.html](https://docs.otoy.com/standaloneSE/RenderingforVR.html)
- **Current state**: Panoramic camera node exists. Parameters editable. No dedicated VR rendering workflow or stereo preview.
- **Complexity**: Medium
- **Priority**: Low

### 26. Render Network / Cloud Rendering

- **Description**: Octane SE can connect to OTOY's cloud render network for distributed GPU rendering.
- **Doc page**: Cloud menu in Octane SE
- **Current state**: Menu items exist (Cloud > Upload/Render/Open Render Network) but all disabled with "not yet implemented" messages.
- **Complexity**: Hard
- **Priority**: Low — depends on OTOY cloud infrastructure

### 27. MaterialX Support

- **Description**: Octane SE supports MaterialX import for industry-standard material definitions.
- **Doc page**: [MaterialX.html](https://docs.otoy.com/standaloneSE/MaterialX.html), [MaterialXPreferences.html](https://docs.otoy.com/standaloneSE/MaterialXPreferences.html)
- **Current state**: Import preferences node type exists (NT_IMPORT_MATERIALX_PREFS). No dedicated MaterialX import workflow UI.
- **Complexity**: Medium
- **Priority**: Low

### 28. Scene Graph Export

- **Description**: Octane SE can export the scene graph as a visual/data representation.
- **Doc page**: General Octane UI — Window > Create scene graph export
- **Current state**: Menu item exists (disabled). No implementation.
- **Complexity**: Medium
- **Priority**: Low

### 29. Toon Shading Dedicated Lights

- **Description**: Toon shading in Octane uses dedicated toon light sources (Toon Directional Light, Toon Point Light) that are independent from mesh emitters and produce sharp shading boundaries.
- **Doc page**: [ToonShading.html](https://docs.otoy.com/standaloneSE/ToonShading.html)
- **Current state**: Toon light node types defined (NT_TOON_DIRECTIONAL_LIGHT, NT_TOON_POINT_LIGHT). Can be created. Parameters editable. No dedicated toon shading preview or setup workflow.
- **Complexity**: Easy (already works through generic node system)
- **Priority**: Low

### 30. Batch Rendering Backend Execution

- **Description**: The batch rendering dialog should actually execute rendering of each frame sequentially, saving output to disk.
- **Doc page**: [BatchRendering.html](https://docs.otoy.com/standaloneSE/BatchRendering.html)
- **Current state**: BatchRenderingDialog UI exists with all settings. The "Start Render" button logs settings but does not execute. Same for DaylightAnimationDialog and TurntableAnimationDialog.
- **Complexity**: Medium
- **Priority**: High — dialogs exist but don't do anything

### 31. Import Preferences UI

- **Description**: Octane SE has detailed import preferences for each format (OBJ, FBX, Alembic, USD, VDB, etc.) covering units, smoothing, subdivision, coordinate system, etc.
- **Doc page**: [OBJImportPreferences.html](https://docs.otoy.com/standaloneSE/OBJImportPreferences.html)
- **Current state**: Import preference node types exist (NT_IMPORT_OBJ_PREFS, NT_IMPORT_FBX_PREFS, etc.). Parameters editable through inspector but no dedicated import settings dialog.
- **Complexity**: Easy
- **Priority**: Low

### 32. Paste Operations

- **Description**: Paste nodes that were previously copied/cut.
- **Doc page**: [TheGraphEditor.html](https://docs.otoy.com/standaloneSE/TheGraphEditor.html) — "Copying and Pasting"
- **Current state**: Menu item exists but marked `enabled: false`. Cut and copy work but paste is not implemented.
- **Complexity**: Medium
- **Priority**: Medium — completes the copy/paste workflow

### 33. Save as Macro / LocalDB

- **Description**: Save selected nodes as reusable macro files or to the LocalDB for later use.
- **Doc page**: [TheGraphEditor.html](https://docs.otoy.com/standaloneSE/TheGraphEditor.html) — Context menu "Save..."
- **Current state**: Context menu "Save..." button exists. Handler is a stub (onSaveAsMacro).
- **Complexity**: Medium
- **Priority**: Low

### 34. Render Node from Context Menu

- **Description**: Right-click a Render Target node and select "Render" to render that specific target.
- **Doc page**: [TheGraphEditor.html](https://docs.otoy.com/standaloneSE/TheGraphEditor.html) — Context menu "Render"
- **Current state**: Context menu "Render" button exists. Handler calls setRenderTargetNode but no dedicated render-this-node flow.
- **Complexity**: Easy
- **Priority**: Low

### 35. Preferences Wiring to Octane Backend

- **Description**: The Preferences dialog should read and write Octane application preferences (geometry import settings, device selection, shortcuts, etc.).
- **Doc page**: General Octane UI — File > Preferences
- **Current state**: PreferencesDialog UI exists with Application/Shortcuts/Devices tabs. Not connected to Octane's ApiProjectManager.applicationPreferences().
- **Complexity**: Medium
- **Priority**: Medium — IMPROVEMENTS.md item #1

### 36. Out-of-Core Rendering Settings

- **Description**: Octane SE has out-of-core texture and geometry settings that allow rendering scenes larger than GPU memory by using system RAM.
- **Doc page**: [TheOutofCoreSettings.html](https://docs.otoy.com/standaloneSE/TheOutofCoreSettings.html)
- **Current state**: No dedicated UI. May be accessible through generic parameter editing on kernel nodes.
- **Complexity**: Easy
- **Priority**: Low

### 37. Render Layers

- **Description**: Render Layers isolate objects into separate primary renders using Render Layer IDs set in Object Layer nodes.
- **Doc page**: [RenderLayers.html](https://docs.otoy.com/standaloneSE/RenderLayers.html)
- **Current state**: Render layer node types exist. No dedicated render layer management UI.
- **Complexity**: Medium
- **Priority**: Low

### 38. Object Layer Node Configuration

- **Description**: Object Layer nodes control per-object render settings including visibility, shadow casting, light pass ID, render layer ID, and random color ID.
- **Doc page**: [ObjectLayerNode.html](https://docs.otoy.com/standaloneSE/ObjectLayerNode.html)
- **Current state**: Node type exists, parameters editable through inspector. No dedicated object layer UI.
- **Complexity**: Easy (already works through generic system)
- **Priority**: Low

### 39. Upsampler / AI Upsampling

- **Description**: Octane SE supports rendering at lower resolution and upsampling using AI, significantly reducing render times while maintaining quality.
- **Doc page**: [ImagerSettings.html](https://docs.otoy.com/standaloneSE/ImagerSettings.html) — "Upsampler Settings"
- **Current state**: Accessible through Imager node parameters in inspector. No dedicated toggle or UI.
- **Complexity**: Easy
- **Priority**: Medium — popular feature for interactive workflows

### 40. Deep Render AOVs

- **Description**: Deep renders store multiple depth samples per pixel for advanced compositing (deep EXR).
- **Doc page**: [DeepRenderAOVs.html](https://docs.otoy.com/standaloneSE/DeepRenderAOVs.html)
- **Current state**: Not implemented. No deep render AOV support.
- **Complexity**: Hard
- **Priority**: Low — advanced compositing feature

---

## Feature Gap Summary by Priority

### High Priority (6 items)

| #   | Feature                           | Complexity | Notes                             |
| --- | --------------------------------- | ---------- | --------------------------------- |
| 1   | Object Placement/Transform Gizmos | Hard       | Fundamental for scene editing     |
| 3   | Undo/Redo Integration             | Hard       | Critical for usable editing       |
| 6   | AOV/Render Pass Viewer            | Medium     | Essential for compositing         |
| 9   | Multi-pass Render Export          | Medium     | Needed for professional output    |
| 30  | Batch Rendering Backend           | Medium     | Dialog exists but doesn't execute |
| 32  | Paste Operations                  | Medium     | Completes copy/paste workflow     |

### Medium Priority (10 items)

| #   | Feature                  | Complexity |
| --- | ------------------------ | ---------- |
| 2   | Animation Timeline       | Medium     |
| 8   | Light Mixer              | Medium     |
| 10  | Material Preview Scenes  | Medium     |
| 11  | Sub-graph Navigation     | Medium     |
| 14  | Denoiser Controls        | Easy       |
| 16  | Viewport Resolution Lock | Easy       |
| 17  | Real-Time Rendering Mode | Easy       |
| 35  | Preferences Wiring       | Medium     |
| 39  | AI Upsampling UI         | Easy       |

### Low Priority (24 items)

| #   | Feature               | Complexity |
| --- | --------------------- | ---------- |
| 4   | Lua Script Editor     | Hard       |
| 5   | OSL Editor            | Hard       |
| 7   | Output AOV Compositor | Hard       |
| 12  | Connection Cutter     | Easy       |
| 13  | Multi-Connect         | Easy       |
| 15  | Geometry Exporter UI  | Easy       |
| 18  | Decal Wireframe       | Easy       |
| 19  | Background Image      | Easy       |
| 20  | Workspace Layout      | Medium     |
| 21  | Log Window            | Easy       |
| 22  | Multi-Viewport        | Hard       |
| 23  | USD Stage Editor      | Hard       |
| 24  | OCIO UI               | Medium     |
| 25  | VR Rendering          | Medium     |
| 26  | Cloud Rendering       | Hard       |
| 27  | MaterialX Import      | Medium     |
| 28  | Scene Graph Export    | Medium     |
| 29  | Toon Light Setup      | Easy       |
| 31  | Import Preferences UI | Easy       |
| 33  | Save as Macro/LocalDB | Medium     |
| 34  | Render Node (context) | Easy       |
| 36  | Out-of-Core Settings  | Easy       |
| 37  | Render Layers UI      | Medium     |
| 38  | Object Layer UI       | Easy       |
| 40  | Deep Render AOVs      | Hard       |

---

## Notes

- **Node types are comprehensive**: All 755 Octane node types from the proto file are defined and can be created via the right-click context menu. The gap is not in node creation but in specialized workflows and previews.
- **Parameter editing works generically**: Most features that appear "not implemented" actually work through the Node Inspector's generic parameter editing. The gap is in dedicated, purpose-built UI (e.g., a denoiser toggle button, a light mixer panel, an AOV viewer dropdown).
- **Desktop-only features excluded**: GPU driver management, plugin installation, CUDA/OptiX device selection, window management (detachable panels), and OS-level file associations are inherently desktop features and were excluded from this comparison.
- **gRPC API coverage**: The server-side gRPC API (Beta 2 protos) exposes most Octane functionality. Many "not implemented" items could be wired up by calling existing API methods — the gap is primarily on the frontend/UI side.
