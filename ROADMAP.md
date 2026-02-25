# octaneWebR Feature Roadmap

**Date:** 2026-02-24
**Scope:** Functionality gap analysis — what Octane SE offers vs what octaneWebR currently implements.

Sources consulted: Octane SE online manual (`docs.otoy.com/standaloneSE`), full codebase survey, `grep` of all TODO/disabled markers.

---

## What Is Already Working

Before listing gaps, a summary of what is fully functional:

| Feature                                                           | Status  |
| ----------------------------------------------------------------- | ------- |
| Progressive scene loading (SceneServiceP)                         | ✅ Done |
| Scene Outliner — tree, virtual scroll, search, context menu       | ✅ Done |
| Node Graph Editor — ReactFlow, edge management, node search       | ✅ Done |
| Node Inspector — parameter read/write, dropdowns, color pickers   | ✅ Done |
| Render Viewport — live image display via WebSocket callback       | ✅ Done |
| Material Database — LocalDB browse and load, LiveDB browse        | ✅ Done |
| Render Export — save single image (PNG/JPG/EXR/TIFF)              | ✅ Done |
| Export Render Passes — multi-pass export dialog                   | ✅ Done |
| Save as Package — full dialog with API integration                | ✅ Done |
| File operations — New, Open, Save, Save As, Recent Files          | ✅ Done |
| Node operations — Create, Delete (optimized), Copy                | ✅ Done |
| Connection management — WebSocket, health check, auto-reconnect   | ✅ Done |
| Keyboard shortcuts — Ctrl+N/O/S/F/C/X/Del/F5/F11                  | ✅ Done |
| Dialogs — About, Preferences (partial), GPU Statistics, Shortcuts | ✅ Done |

---

## Priority 1 — UI Exists, API Not Wired

These features have complete UI (dialogs, buttons, menu items) but the API integration is a stub or missing. They are the fastest path to increased functionality.

### 1.1 Toast Notification System

**Current state:** `showNotification()` in MenuBar logs to console only. All user-facing success/error feedback is silent.

**What to build:** A lightweight toast component (already has `StatusMessageContext` as a foundation). Wire `showNotification` calls throughout the app to render dismissible toasts.

**Files:** `client/src/components/MenuBar/index.tsx:239`, `client/src/App.tsx:317`

---

### 1.2 Paste (Nodes)

**Current state:** Paste is disabled in the MenuBar (`enabled: false`), all context menus, and `EditCommands.paste()` is a stub. Copy works (node handles are captured). `EditCommands.ts` has a TODO for clipboard serialization.

**What to build:** Serialize copied node handles to the clipboard. On paste, call the Octane duplicate/clone node API to recreate nodes at an offset position.

**Files:** `client/src/services/EditCommands.ts`, context menus in `NodeGraph`, `NodeInspector`, `SceneOutliner`

---

### 1.3 Undo / Redo

**Current state:** `CommandHistory` service exists. MenuBar has Undo/Redo menu items and handlers that call `commandHistory.undo()`/`redo()`. However, the keyboard shortcuts are commented out (`// Undo/Redo disabled - not yet integrated with Octane`) and the menu items are `enabled: false`.

**What Octane SE has:** Full change history with Ctrl+Z/Ctrl+Y.

**What to build:** Integrate existing `CommandHistory` with Octane's change notification callbacks (`OnProjectManagerChanged`). Wire Ctrl+Z/Ctrl+Y. Enable the menu items.

**Files:** `client/src/services/CommandHistory.ts`, `client/src/components/MenuBar/index.tsx:662-674`

---

### 1.4 Batch Rendering API

**Current state:** `BatchRenderingDialog` is a fully functional form (output folder, format, samples, filename pattern). The menu item works and opens the dialog. But the submit handler has:

```
// TODO: Implement actual batch rendering via Octane API
```

**What Octane SE has:** Batch render from a script list (multiple `.orbx` files), configurable samples and output format per file.

**What to build:** Wire the dialog submit to the relevant Octane API (`ApiRenderEngine` or `ApiSceneExporter` batch methods). Add file-list management to the dialog.

**Files:** `client/src/components/dialogs/BatchRenderingDialog.tsx:59`

---

### 1.5 Daylight Animation API

**Current state:** `DaylightAnimationDialog` is a complete form (time range, frame count, output folder). Submit is a stub.

**What Octane SE has:** Animate the sun position across a day range and render each frame.

**What to build:** Call the daylight animation API from the dialog submit handler. The `ApiMainWindow` or animation API likely exposes this.

**Files:** `client/src/components/dialogs/DaylightAnimationDialog.tsx:58`

---

### 1.6 Turntable Animation API

**Current state:** `TurntableAnimationDialog` is a complete form (frame count, rotation axis, output folder). Submit is a stub.

**What Octane SE has:** Rotate an object or camera 360° and render each frame.

**What to build:** Wire to Octane's turntable animation API.

**Files:** `client/src/components/dialogs/TurntableAnimationDialog.tsx:56`

---

### 1.7 Script Menu: Batch Render / Daylight / Turntable

**Current state:** Script menu items are `enabled: false` even though the dialogs exist and work. The menu items should enable the dialogs, not remain disabled.

**What to build:** Remove `enabled: false` from the three script menu items (`script.batchRender`, `script.daylightAnimation`, `script.turntableAnimation`). The handlers already call `setIsXxxDialogOpen(true)`.

**Files:** `client/src/components/MenuBar/index.tsx:107-109`

---

### 1.8 NodeGraph Auto-Layout

**Current state:** Two auto-layout buttons exist in `NodeGraphToolbar` with TODO stubs:

- "Auto-layout including sub-graphs"
- "Auto-layout algorithm"

**What Octane SE has:** Automatic node positioning to reduce visual clutter in the node graph.

**What to build:** Implement a layout algorithm (e.g., a left-to-right DAG layout using ReactFlow's `dagre` or `elkjs` adapter). This can be done entirely client-side without an API call.

**Files:** `client/src/components/NodeGraph/NodeGraphToolbar.tsx:54-100`

---

### 1.9 NodeGraph Preview Toggles

**Current state:** Four toolbar buttons exist (render target preview, mesh preview, material preview, texture preview) — all TODO stubs.

**What Octane SE has:** Quick-toggle overlays in the node graph showing thumbnail previews on nodes.

**What to build:** Wire these to the appropriate Octane API calls that control per-node preview rendering. Alternatively, implement client-side toggle of thumbnail images already available for nodes.

**Files:** `client/src/components/NodeGraph/NodeGraphToolbar.tsx:70-100`

---

### 1.10 FileNodeToolbar: Load and Reload

**Current state:** The FileNodeToolbar shows a filename and has "Load" and "Reload" buttons. Both are stubs:

```
// TODO: Open file chooser (ApiFileChooser) and call the appropriate load API
// TODO: Reload from node.filePath via the geometry reload API
```

**What Octane SE has:** Click a geometry/texture node → load a new file or reload from disk.

**What to build:** Wire "Load" to `ApiFileChooser` to get a path, then call the node's load API. Wire "Reload" to the geometry/texture reload API using `node.filePath`.

**Files:** `client/src/components/NodeInspector/FileNodeToolbar.tsx`

---

### 1.11 NodeInspector Context Menu Actions

**Current state:** The NodeInspector context menu has 9 stub actions:

| Action               | Status                     |
| -------------------- | -------------------------- |
| Save                 | TODO                       |
| Cut                  | TODO                       |
| Copy                 | TODO                       |
| Paste                | TODO (also disabled in UI) |
| Fill Empty Pins      | TODO                       |
| Expand All Children  | TODO                       |
| Show in Outliner     | TODO                       |
| Show in Graph Editor | TODO                       |
| Open Lua Browser     | TODO                       |

**What to build:** Implement each in turn. "Show in Outliner" and "Show in Graph Editor" are navigation operations that emit an event; the target panel scrolls to and highlights the node. "Fill Empty Pins" calls an Octane API to auto-connect default nodes to unconnected input pins.

**Files:** `client/src/components/NodeInspector/index.tsx:471-527`

---

### 1.12 Viewport: White Point, Background Image, Camera Focus

**Current state:** Three viewport actions are stubs in `useViewportActions.ts`:

- Apply white point to camera/renderer settings
- Set background image (file picker + API call)
- Set camera focus distance

**Files:** `client/src/components/CallbackRenderViewport/` (useViewportActions hook), `client/src/App.tsx:198-199`

---

### 1.13 Object Control Alignment (World / Local)

**Current state:** Toolbar has a World/Local toggle with a TODO:

```
// TODO: API call to set object control alignment
```

**Files:** `client/src/components/CallbackRenderViewport/` (toolbar)

---

### 1.14 Node Save / Render to LocalDB (Node Context Menu)

**Current state:** NodeGraph context menu has disabled "Render" and "Save" buttons for selected nodes.

**What to build:** "Save" should call the API to save the selected node/material to LocalDB. "Render" should trigger a thumbnail render of the selected node.

**Files:** `client/src/components/NodeGraph/NodeContextMenu.tsx:171-176`

---

### 1.15 Material Preview Thumbnails (LocalDB)

**Current state:** LocalDB browser shows `"No Preview"` placeholder for all materials. `LiveDB` has a `getLiveDBMaterialPreview()` implementation but LocalDB doesn't use it.

**What to build:** Call `ApiLocalDB_Package.hasThumbnail` / thumbnail fetch API and display thumbnails in the LocalDB tree. The `MaterialDatabaseService` already has `packageHasThumbnail()` but nothing calls it.

**Files:** `client/src/components/SceneOutliner/LocalDBTreeItem.tsx`, `client/src/services/octane/MaterialDatabaseService.ts`

---

## Priority 2 — New Features (Significant Effort)

These require new UI components, services, or subsystems.

### 2.1 GPU Devices Tab

**Current state:** Preferences Dialog has a "GPU Devices" tab with a `<div className="devices-placeholder">` placeholder.

**What Octane SE has:** A dedicated Devices tab showing all GPUs, enabling/disabling per device, RTX acceleration toggle, denoiser assignment, headroom memory settings.

**What to build:**

- A `DevicesService` wrapping the Octane GPU/device API
- Replace the placeholder with a device list component with toggles
- Wire to `ApiRenderEngine` device management methods

**Files:** `client/src/components/dialogs/PreferencesDialog.tsx:244`

---

### 2.2 Render Target Switcher

**Current state:** App.tsx has `// TODO: Implement render target switching`. The viewport always uses whatever render target was auto-selected during load.

**What Octane SE has:** A dropdown or panel to switch between multiple render targets in the scene.

**What to build:** A dropdown in the render toolbar or viewport header that lists all `PT_RENDERTARGET` nodes from the scene tree and calls `client.setRenderTargetNode()` on selection.

**Files:** `client/src/App.tsx`

---

### 2.3 Save to LocalDB

**Current state:** App.tsx has `// TODO: Implement save to LocalDB`.

**What Octane SE has:** Right-click a material node → "Save to local database" → saves the material with a user-specified name.

**What to build:** Dialog to enter category/name + call `ApiLocalDB.savePackage` or equivalent.

**Files:** `client/src/App.tsx`

---

### 2.4 Workspace Layout Save / Load

**Current state:** All Window menu items for workspace management are `enabled: false`.

**What Octane SE has:** Save the current panel layout (sizes, open panels) and reload named layouts.

**What to build:** Serialize panel sizes/visibility to localStorage or a server-side endpoint. Implement load/save dialogs and wire the Window menu items.

**Files:** `client/src/components/MenuBar/index.tsx:123-145`

---

### 2.5 Scene File Loading (Open with Upload)

**Current state:** File > Open uses `client.callApi('ApiProjectManager', 'loadProject', { path: file.name })` passing only the filename. In a browser context, the file bytes need to be uploaded to the server first.

**What to build:** Upload the file binary to a server endpoint (e.g., `/api/upload`), then call `loadProject` with the server-side path. Alternatively, stream the file contents directly over gRPC if the API supports it.

**Files:** `client/src/components/MenuBar/index.tsx:292-308`

---

### 2.6 Load Render State / Save Render State

**Current state:** Both menu items are `enabled: false`. No service methods exist.

**What Octane SE has:** Save and restore the current render state (kernel settings, current frame buffer) to resume a render session.

**What to build:** Service methods wrapping the `ApiRender` save/load state API. Wire to menu actions.

**Files:** `client/src/components/MenuBar/index.tsx:72-73`

---

### 2.7 Node Inspector: `handleToggle` Expansion State

**Current state:** `handleToggle` is a no-op placeholder. Expanding/collapsing group nodes in the NodeInspector has no persistent state.

**What to build:** Either a `useReducer` or a `Map<handle, boolean>` in `NodeInspector` to track expansion per-node, fed into `NodeParameter` via `isExpanded` prop.

**Files:** `client/src/components/NodeInspector/index.tsx:453`

---

### 2.8 Unpack Package

**Current state:** File > "Unpack package..." is `enabled: false`.

**What Octane SE has:** Extract an `.orbx` package back to loose files.

**What to build:** Wire to `ApiProjectManager.unpackPackage` or equivalent.

---

### 2.9 `getNodeTypeId` Implementation or Removal

**Current state:** `NodeService.getNodeTypeId()` always returns `1`. It is called from `createNodeForPin` but may never reach that path in practice.

**What to build:** Either query the Octane API for the type ID by node name, or determine that the API accepts type strings directly (making this method unnecessary) and remove it and its call site.

**Files:** `client/src/services/octane/NodeService.ts`

---

## Priority 3 — Long-Term / New Subsystems

These require building significant new infrastructure and/or depend on Octane SE features that may have limited API surface.

### 3.1 Lua Scripting

**What Octane SE has:** A Lua script editor, script folder management, Lua API browser, and the ability to run scripts that automate scene manipulation and rendering.

**Octane SE window menu items (all disabled):**

- Create script editor
- Rescan script folder
- Run last script (Ctrl+Shift+R)
- Lua API browser

**What to build:** A code editor panel (e.g., `monaco-editor`) wired to an `ApiLuaScript` gRPC service that executes scripts and returns results. The API browser would introspect available Lua bindings.

---

### 3.2 OSL Shader Editor

**What Octane SE has:** An Open Shading Language editor for authoring custom shaders directly in the application.

**Octane SE window menu:** Create OSL editor (disabled).

**What to build:** A `monaco-editor` panel with OSL syntax highlighting, connected to the Octane OSL compilation API. Wire the OSL editor window menu item.

---

### 3.3 USD Stage Editor

**What Octane SE has:** A USD (Universal Scene Description) stage editor for importing and working with USD scenes.

**Octane SE window menu:** Create USD stage editor (disabled).

**What to build:** A stage hierarchy viewer connected to the USD API surface. This likely depends on `ApiSceneExporter` or a dedicated USD service.

---

### 3.4 Network / Cloud Rendering

**What Octane SE has:**

- Network rendering across multiple machines on a LAN
- OTOY cloud rendering network upload and submission

**What to build:** A `NetworkRenderService` wrapping `ApiNetRenderManager`. UI for managing network nodes, job submission, and status. Cloud rendering would require OTOY account integration.

**Files:** All Cloud menu items are `enabled: false`

---

### 3.5 Activation / License Management

**What Octane SE has:** License status display, standalone activation flow.

**Current state:** "Activation status..." is `enabled: false` with no handler.

**What to build:** A dialog that calls Octane's license/activation API and displays the current license state. This is typically a read-only status view in a web context.

---

### 3.6 Module / Plugin System

**What Octane SE has:** Third-party modules that extend Octane's functionality (e.g., importers, generators).

**Current state:** Module menu always shows "No modules installed".

**What to build:** Query Octane's module list API and populate the Module menu dynamically. Individual modules would expose their own UI.

---

### 3.7 Object Gizmos (Viewport Transform)

**What Octane SE has:** Translate, rotate, scale gizmos in the 3D viewport for direct object manipulation.

**Current state:** The render viewport is a passive image display with right-click context menu. No 3D interaction gizmos.

**What to build:** Overlay SVG or canvas gizmos on the viewport. Requires Octane to provide object-space coordinates and accept transform updates via API. This is a major undertaking that depends heavily on what `ApiRender` exposes for hit-testing and object manipulation.

---

### 3.8 Secondary / Detachable Windows

**What Octane SE has:** Multiple detachable panel windows (multiple graph editors, multiple scene viewports, log window).

**Current state:** All "Create X" window menu items are `enabled: false`.

**What to build:** A window management system that can render panels in separate `<div>` overlays or browser popout windows. Lower priority — the single-layout model works well for web.

---

### 3.9 Log Window

**What Octane SE has:** A dedicated panel that streams Octane's internal log in real time.

**Current state:** `window.createLogWindow` is `enabled: false`. The browser console and `/api/log` endpoint receive log data but there is no UI panel.

**What to build:** A log panel component that subscribes to `ApiLogManager` stream events and displays them with severity coloring. This is relatively self-contained.

---

## Out of Scope

These Octane SE features either don't apply in a web browser context or require desktop-level OS access:

| Feature                                            | Reason                                                 |
| -------------------------------------------------- | ------------------------------------------------------ |
| Quit (File > Quit)                                 | Not meaningful in a browser tab                        |
| Activation via desktop license server              | Handled by Octane SE itself, not the web UI            |
| Command-line rendering (`--no-gui`, `--gpu`, etc.) | Server-side; the web UI wraps a running Octane process |
| OS-native file dialogs                             | Web uses `<input type="file">`; already handled        |
| Crash report management                            | OS/server-level concern                                |

---

## Summary Table

| Feature                                       | Priority | Effort       | Status                        |
| --------------------------------------------- | -------- | ------------ | ----------------------------- |
| Toast notifications                           | 1        | Small        | UI infra missing              |
| Paste nodes                                   | 1        | Small        | Clipboard serialization TODO  |
| Script menu enable (batch/daylight/turntable) | 1        | Trivial      | Remove `enabled: false`       |
| Batch rendering API                           | 1        | Medium       | Dialog done, API needed       |
| Daylight animation API                        | 1        | Medium       | Dialog done, API needed       |
| Turntable animation API                       | 1        | Medium       | Dialog done, API needed       |
| NodeGraph auto-layout                         | 1        | Medium       | Client-side only (dagre/elk)  |
| NodeGraph preview toggles                     | 1        | Small-Medium | API wiring needed             |
| FileNodeToolbar load/reload                   | 1        | Small        | ApiFileChooser + reload API   |
| NodeInspector context menu actions            | 1        | Medium       | 9 stubs to implement          |
| Viewport white point / bg image / focus       | 1        | Small        | API wiring needed             |
| Object control alignment                      | 1        | Small        | API wiring needed             |
| Node save/render to LocalDB                   | 1        | Small        | API wiring needed             |
| LocalDB material thumbnails                   | 1        | Small        | hasThumbnail API exists       |
| Undo / Redo                                   | 1        | Medium       | CommandHistory exists         |
| GPU Devices tab                               | 2        | Medium       | Placeholder UI exists         |
| Render target switcher                        | 2        | Small        | API exists                    |
| Save to LocalDB                               | 2        | Small        | API to identify               |
| Workspace layout save/load                    | 2        | Medium       | Serialization design needed   |
| Scene file upload (Open)                      | 2        | Medium       | Server upload endpoint needed |
| Load / Save render state                      | 2        | Small        | API to identify               |
| NodeInspector expansion state                 | 2        | Small        | State management              |
| Unpack package                                | 2        | Small        | API to identify               |
| Lua scripting                                 | 3        | Large        | New subsystem                 |
| OSL editor                                    | 3        | Large        | New subsystem                 |
| USD stage editor                              | 3        | Large        | New subsystem                 |
| Network / cloud rendering                     | 3        | Large        | New subsystem + auth          |
| Activation/license UI                         | 3        | Small        | API to identify               |
| Module/plugin system                          | 3        | Medium       | Dynamic menu population       |
| Object gizmos in viewport                     | 3        | Large        | Requires 3D picking API       |
| Detachable windows                            | 3        | Large        | Window management system      |
| Log window panel                              | 3        | Small        | Stream subscriber             |

---

_Analysis completed 2026-02-24. Based on Octane SE documentation and full codebase inspection._
