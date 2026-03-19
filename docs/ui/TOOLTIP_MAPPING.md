# OctaneWebR Tooltip Mapping

Cross-reference between OctaneWebR button IDs and Octane's official strings (from `reference/strings.xml`).

**Format:** `button-id` | Current OctaneWebR tooltip | Octane official text | Status

---

## Render Toolbar — Navigation

| Button ID        | OctaneWebR Current                                                           | Octane Official (strings.xml)                                                   | Status                                                     |
| ---------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `recenter-view`  | Recenter View - Centers the render view display area in the Render Viewport. | Centers the rendered image in the viewport. Use control to also reset the zoom. | **UPDATE** — Octane mentions ctrl+zoom reset               |
| `reset-camera`   | Reset Camera - Resets the camera back to the original position.              | Resets the camera to its initial position and target.                           | **UPDATE** — "initial position and target" is more precise |
| `camera-presets` | Camera View Presets - Provides preset camera views of the scene.             | Presets the camera to a pre-defined viewpoint.                                  | OK — close enough                                          |

## Render Toolbar — Render Controls

| Button ID         | OctaneWebR Current                                                         | Octane Official (strings.xml)                 | Status                           |
| ----------------- | -------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------- |
| `stop-render`     | Stop Render - Aborts the rendering process and frees all resources.        | Stops the current render.                     | **UPDATE** — Octane is simpler   |
| `restart-render`  | Restart Render - Halts and restarts the rendering process at zero samples. | Restarts the current render.                  | **UPDATE** — Octane is simpler   |
| `pause-render`    | Pause Render - Pauses the rendering without losing rendered data.          | Pauses the current render.                    | **UPDATE** — Octane is simpler   |
| `start-render`    | Start Render - Starts or resumes the rendering process.                    | Continues the current render. / Start render. | OK — close enough                |
| `realtime-render` | Real Time Rendering - Uses more GPU memory for interactive experience.     | Toggle real-time rendering.                   | **UPDATE** — should say "toggle" |

## Render Toolbar — Picker Modes

| Button ID         | OctaneWebR Current                                                        | Octane Official (strings.xml)                            | Status                                     |
| ----------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------ |
| `focus-picker`    | Auto Focus Picking Mode - Click on scene to focus camera on that point.   | Toggles the camera focus picker of the render viewport.  | **UPDATE** — "focus pick" not "auto focus" |
| `white-balance`   | White Balance Picking Mode - Select part of scene for white point colors. | Toggles the imager white point picker of the viewport.   | **UPDATE** — "imager white point picker"   |
| `material-picker` | Material Picker - Select rendered scene to inspect material.              | Toggles the material picker of the render viewport.      | **UPDATE** — should say "toggle"           |
| `object-picker`   | Object Picker - Select objects to inspect attributes.                     | Toggles the object picker of the render viewport.        | **UPDATE** — should say "toggle"           |
| `target-picker`   | Camera Target Picker - Set center of rotation and zooming.                | Toggles the camera target picker of the render viewport. | **UPDATE** — should say "toggle"           |
| `render-region`   | Render Region Picker - Specify a region in viewport to view changes.      | Toggles the render region lasso in the viewport.         | **UPDATE** — "lasso" not "picker"          |
| `film-region`     | Film Region Picker - Set region for Film Settings parameters.             | Toggles the film region settings lasso in the viewport.  | **UPDATE** — "lasso" not "picker"          |

## Render Toolbar — Modes

| Button ID         | OctaneWebR Current                                                    | Octane Official (strings.xml)                      | Status                                           |
| ----------------- | --------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| `clay-mode`       | Clay Mode - Shows model details without complex texturing.            | Clay mode rendering                                | OK — ours is more descriptive                    |
| `subsample-2x2`   | Sub-Sampling 2×2 - Smoother navigation by reducing render resolution. | Enabled 2x2 subsampling for the first frame.       | **UPDATE** — "for the first frame" is key detail |
| `subsample-4x4`   | Sub-Sampling 4×4 - Maximum navigation smoothness.                     | Enabled 4x4 subsampling for the first frame.       | **UPDATE** — same                                |
| `render-priority` | Render Priority Settings - Set GPU render priority.                   | Render priority that should be used for rendering. | OK — close enough                                |

## Render Toolbar — Lock/Save/Export

| Button ID          | OctaneWebR Current                                              | Octane Official (strings.xml)                                                      | Status                                                             |
| ------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `lock-viewport`    | Lock Viewport - Prevents accidental changes or render restarts. | Locks the viewport controls to prevent accidental change or restart of the render. | OK — nearly identical                                              |
| `copy-clipboard`   | Copy to Clipboard - Copies current render in LDR format.        | Copy to clipboard                                                                  | **UPDATE** — Octane doesn't mention LDR; our addition may be wrong |
| `save-render`      | Save Render - Saves current render to disk.                     | Saves the current render to disk.                                                  | OK — match                                                         |
| `export-passes`    | Export Render Passes - Brings up Render Passes Export window.   | Shows a dialog to export the render passes.                                        | OK — close enough                                                  |
| `background-image` | Set Background Image - Places background image in viewport.     | Shows a dialog to change the background image of the render viewport.              | **UPDATE** — "change" not "set"                                    |

## Render Toolbar — Gizmos

| Button ID         | OctaneWebR Current                                          | Octane Official (strings.xml)  | Status                                                       |
| ----------------- | ----------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------ |
| `gizmo-toggle`    | Toggle the current gizmo mode                               | Toggle the current gizmo mode. | OK — match                                                   |
| `translate-gizmo` | Placement Translation Tool - Move objects along axes.       | Toggle the move gizmo frame.   | **UPDATE** — Octane says "move gizmo" not "translation tool" |
| `rotate-gizmo`    | Placement Rotation Tool - Rotate objects around axes.       | Toggle the rotate gizmo frame. | **UPDATE** — "rotate gizmo" not "rotation tool"              |
| `scale-gizmo`     | Placement Scale Tool - Scale objects uniformly or per axis. | Toggle the scale gizmo frame.  | **UPDATE** — "scale gizmo" not "scale tool"                  |

## Render Toolbar — Display Options

| Button ID          | OctaneWebR Current                                              | Octane Official (strings.xml) | Status                    |
| ------------------ | --------------------------------------------------------------- | ----------------------------- | ------------------------- |
| `world-coordinate` | Display World Coordinate - Shows world axis in viewport corner. | _(not found in strings.xml)_  | KEEP — no official string |
| `decal-wireframe`  | Decal Wireframe - Toggles wireframe along decal boundaries.     | _(not found in strings.xml)_  | KEEP — no official string |

## Scene Outliner Toolbar

| Button ID      | OctaneWebR Current | Octane Official (strings.xml)              | Status                                |
| -------------- | ------------------ | ------------------------------------------ | ------------------------------------- |
| `expand-all`   | Expand all         | Uncollapses all the items in the outliner. | **UPDATE** — Octane says "uncollapse" |
| `collapse-all` | Collapse all       | Collapses all the items in the outliner.   | OK — match                            |
| `refresh`      | Refresh            | _(not found in strings.xml)_               | KEEP — OctaneWebR-specific            |

## Menu Bar — File Menu

| Item              | Octane Official                                                     | Notes |
| ----------------- | ------------------------------------------------------------------- | ----- |
| New project       | Opens a new, empty project                                          |       |
| Open project      | Opens a new project.                                                |       |
| Open...           | _(file browser)_                                                    |       |
| Save project      | Saves the current project.                                          |       |
| Save as           | Saves the current project as a different file.                      |       |
| Save as package   | Packs project into self-contained package                           |       |
| Save as default   | _(saves current as default scene)_                                  |       |
| Recent projects   | _(submenu)_                                                         |       |
| Save render state | Saves the current render state so rendering can be continued later. |       |
| Load render state | Loads a saved render state so it can be continued.                  |       |

## Menu Bar — Edit Menu

| Item       | Octane Official                                    | Notes  |
| ---------- | -------------------------------------------------- | ------ |
| Undo       | Undo the last user action.                         | Ctrl+Z |
| Redo       | Redo the last undone action.                       | Ctrl+Y |
| Cut        | Cuts the selected nodes to the system clipboard.   | Ctrl+X |
| Copy       | Copies the selected nodes to the system clipboard. | Ctrl+C |
| Paste      | Pastes the nodes from the system clipboard.        | Ctrl+V |
| Delete     | Deletes the selected nodes from the project.       | Del    |
| Select all | Select all node items.                             | Ctrl+A |
| Find       | Find nodes in the node graph, or scripts to run    | Ctrl+F |

## Menu Bar — Help Menu

| Item                 | Octane Official                                     | Notes |
| -------------------- | --------------------------------------------------- | ----- |
| Open online manual   | Opens online manual                                 |       |
| Preferences          | Displays a dialog with the application preferences. |       |
| Activation status    | _(shows license info)_                              |       |
| About                | About OCTANE_PRODUCT_NAME...                        |       |
| Manage crash reports | _(crash report dialog)_                             |       |

---

## Summary

- **17 buttons need tooltip text updates** to match Octane's official strings
- **2 buttons** have no official string (world-coordinate, decal-wireframe) — keep current text
- **9 buttons** already match or are close enough
- Key pattern: Octane uses "Toggles the X of the render viewport" for picker modes, not "X Mode - description"
