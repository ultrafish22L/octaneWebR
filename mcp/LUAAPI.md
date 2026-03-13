# Octane X Lua API Reference

**API Version:** 2026.1
**Lua Version:** 5.3
**Exported:** 2025-12-17

Octane X exposes a comprehensive Lua scripting API for automating rendering, building node graphs, creating UIs, and managing projects. Scripts can run in three contexts: standalone Lua scripts, scripted node graphs (script graphs), and render job graphs.

---

## Table of Contents

1. [Modules Overview](#modules-overview)
2. [octane.node — Node Manipulation](#octanenode)
3. [octane.nodegraph — Graph Manipulation](#octanenodegraph)
4. [octane.render — Rendering](#octanerender)
5. [octane.project — Project Management](#octaneproject)
6. [octane.changemanager — Change Observation](#octanechangemanager)
7. [octane.image — Image Processing](#octaneimage)
8. [octane.gui — User Interfaces](#octanegui)
9. [octane.gridlayout — Grid Layouts](#octanegridlayout)
10. [octane.settingsgroup — Settings Dialogs](#octanesettingsgroup)
11. [octane.file — File System](#octanefile)
12. [octane.apiinfo — API Introspection](#octaneapiinfo)
13. [octane.apimaterialx — MaterialX Support](#octaneapimaterialx)
14. [octane.scriptgraph — Scripted Node Graphs](#octanescriptgraph)
15. [octane.renderjobgraph — Render Job Graphs](#octanerenderjobgraph)
16. [octane.matrix — 3x4 Matrices](#octanematrix)
17. [octane.vec — 3D Vectors](#octanevec)
18. [octane.package — Package Inspection](#octanepackage)
19. [octane.packagefile — Package File I/O](#octanepackagefile)
20. [octane.caches — File Caches](#octanecaches)
21. [octane.modules — External Modules](#octanemodules)
22. [octane.json — JSON Read/Write](#octanejson)
23. [octane.common — Common Utilities](#octanecommon)
24. [octane.timer — Timers](#octanetimer)
25. [octane.mt19937 — Random Numbers](#octanemt19937)
26. [octane.util — Utility Functions](#octaneutil)
27. [octane.storage — Persistent Storage](#octanestorage)
28. [octane.help — API Help](#octanehelp)
29. [octane.geometryexporter — Geometry Export](#octanegeometryexporter)
30. [octane.rendercloudmanager — Cloud Rendering](#octanerendercloudmanager)
31. [Constants](#constants)
32. [Properties Tables Reference](#properties-tables-reference)
33. [Script Examples](#script-examples)
34. [Script Metadata](#script-metadata)

---

## Modules Overview

| Module                      | Functions | Constants | Properties | Description                            |
| --------------------------- | --------- | --------- | ---------- | -------------------------------------- |
| `octane.node`               | 74        | 0         | 17         | Node creation, connections, attributes |
| `octane.nodegraph`          | 71        | 0         | 4          | Graph manipulation, import/export      |
| `octane.render`             | 56        | 0         | 11         | Rendering, devices, image saving       |
| `octane.project`            | 18        | 0         | 1          | Project load/save/reset                |
| `octane.changemanager`      | 11        | 0         | 3          | Node change observation                |
| `octane.image`              | 25        | 0         | 6          | Image creation/manipulation            |
| `octane.gui`                | 30        | 4         | 22         | UI components and dialogs              |
| `octane.gridlayout`         | 17        | 0         | 1          | Grid-based UI layout                   |
| `octane.settingsgroup`      | 5         | 0         | 0          | Settings dialog builder                |
| `octane.file`               | 28        | 0         | 2          | Portable file system ops               |
| `octane.apiinfo`            | 23        | 0         | 21         | API introspection                      |
| `octane.apimaterialx`       | 13        | 0         | 0          | MaterialX support                      |
| `octane.scriptgraph`        | 21        | 0         | 12         | Scripted graph callbacks               |
| `octane.renderjobgraph`     | 4         | 0         | 0          | Render job callbacks                   |
| `octane.matrix`             | 23        | 1         | 0          | 3x4 matrix operations                  |
| `octane.vec`                | 9         | 0         | 0          | 3D vector operations                   |
| `octane.package`            | 9         | 0         | 0          | ORBX package inspection                |
| `octane.packagefile`        | 9         | 0         | 0          | File I/O within packages               |
| `octane.caches`             | 13        | 0         | 0          | Meshlet/virtual texture caches         |
| `octane.modules`            | 6         | 0         | 1          | External module access                 |
| `octane.json`               | 2         | 0         | 0          | JSON encode/decode                     |
| `octane.common`             | 2         | 0         | 0          | print, time                            |
| `octane.timer`              | 5         | 0         | 0          | Timed callbacks                        |
| `octane.mt19937`            | 4         | 0         | 0          | Mersenne Twister RNG                   |
| `octane.util`               | 7         | 0         | 1          | Misc utility functions                 |
| `octane.storage`            | 0         | 0         | 0          | Persistent script storage              |
| `octane.help`               | 13        | 0         | 0          | API documentation browser              |
| `octane.geometryexporter`   | 8         | 0         | 1          | Alembic/FBX export                     |
| `octane.rendercloudmanager` | 4         | 0         | 2          | Cloud render services                  |
| `octane.octane`             | 0         | 203       | 0          | Global constants namespace             |

---

## octane.node

Manipulate Octane's node system — create nodes, connect pins, read/write attributes.

### Functions

#### Node Creation & Destruction

| Function     | Description                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------- |
| `create`     | Create a new node: `octane.node.create{ type=octane.NT_TEX_RGB, name="myTex", graphOwner=graph }` |
| `destroy`    | Delete a node from the scene                                                                      |
| `copyFrom`   | Copy node data from another node (by pin name)                                                    |
| `copyFromIx` | Copy node data from another node (by pin index)                                                   |

#### Pin Connections

| Function              | Description                                                           |
| --------------------- | --------------------------------------------------------------------- |
| `connectTo`           | Connect to a target pin by name: `node:connectTo("diffuse", srcNode)` |
| `connectToIx`         | Connect to a target pin by index: `node:connectToIx(0, srcNode)`      |
| `canConnectTo`        | Check if connection is valid (by name)                                |
| `canConnectToIx`      | Check if connection is valid (by index)                               |
| `disconnect`          | Disconnect a pin by name                                              |
| `disconnectIx`        | Disconnect a pin by index                                             |
| `getConnectedNode`    | Get node connected to a pin (by name)                                 |
| `getConnectedNodeIx`  | Get node connected to a pin (by index)                                |
| `getInputNode`        | Get input node connected to pin (by name)                             |
| `getInputNodeIx`      | Get input node connected to pin (by index)                            |
| `getDestinationNodes` | Get all nodes this node connects to                                   |
| `configureEmptyPins`  | Configure empty/unused pins                                           |

#### Attributes

| Function                 | Description                                                     |
| ------------------------ | --------------------------------------------------------------- |
| `setAttribute`           | Set attribute by name: `node:setAttribute("value", {1, 0, 0})`  |
| `setAttributeIx`         | Set attribute by index                                          |
| `getAttribute`           | Get attribute by name: `local val = node:getAttribute("value")` |
| `getAttributeIx`         | Get attribute by index                                          |
| `clearAttribute`         | Clear/reset attribute by name                                   |
| `clearAttributeIx`       | Clear/reset attribute by index                                  |
| `hasAttribute`           | Check if node has an attribute                                  |
| `copyAttributeFrom`      | Copy attribute value from another node (by name)                |
| `copyAttributeFromIx`    | Copy attribute value from another node (by index)               |
| `dumpAttributes`         | Dump all attributes (for debugging)                             |
| `getAttributeCount`      | Get number of attributes                                        |
| `getAttributeInfo`       | Get attribute metadata (by name) → `PROPS_ATTRIBUTE_INFO`       |
| `getAttributeInfoIx`     | Get attribute metadata (by index) → `PROPS_ATTRIBUTE_INFO`      |
| `getRawArrayAttribute`   | Get raw array attribute data (by name)                          |
| `getRawArrayAttributeIx` | Get raw array attribute data (by index)                         |
| `setRawArrayAttribute`   | Set raw array attribute data (by name)                          |
| `setRawArrayAttributeIx` | Set raw array attribute data (by index)                         |

#### Pin Info

| Function                       | Description                                  |
| ------------------------------ | -------------------------------------------- |
| `getPinCount`                  | Get number of pins                           |
| `getPinInfo`                   | Get pin metadata by name → `PROPS_PIN_INFO`  |
| `getPinInfoIx`                 | Get pin metadata by index → `PROPS_PIN_INFO` |
| `getPinValue`                  | Get pin default value by name                |
| `getPinValueIx`                | Get pin default value by index               |
| `setPinValue`                  | Set pin default value by name                |
| `setPinValueIx`                | Set pin default value by index               |
| `hasPin`                       | Check if a pin exists                        |
| `getPinTextureValueType`       | Get texture value type of pin (by name)      |
| `getPinTextureValueTypeIx`     | Get texture value type of pin (by index)     |
| `getPinTextureValueTypeName`   | Get texture value type name (by name)        |
| `getPinTextureValueTypeNameIx` | Get texture value type name (by index)       |

#### Animation

| Function             | Description                               |
| -------------------- | ----------------------------------------- |
| `setAnimator`        | Set animator on attribute (by name)       |
| `setAnimatorIx`      | Set animator on attribute (by index)      |
| `getAnimator`        | Get animator from attribute (by name)     |
| `getAnimatorIx`      | Get animator from attribute (by index)    |
| `clearAnimator`      | Remove animator (by name)                 |
| `clearAnimatorIx`    | Remove animator (by index)                |
| `setArrayAnimator`   | Set array animator (by name)              |
| `setArrayAnimatorIx` | Set array animator (by index)             |
| `isAnimated`         | Check if attribute is animated (by name)  |
| `isAnimatedIx`       | Check if attribute is animated (by index) |

#### Node Info & Utility

| Function                        | Description                                     |
| ------------------------------- | ----------------------------------------------- |
| `getNodeInfo`                   | Get static node type info → `PROPS_NODE_INFO`   |
| `getProperties`                 | Get dynamic node properties → `PROPS_NODE_ITEM` |
| `getOwnedItem`                  | Get child item owned by pin (by name)           |
| `getOwnedItemIx`                | Get child item owned by pin (by index)          |
| `getOutputTextureValueTypeId`   | Get output texture value type ID                |
| `getOutputTextureValueTypeName` | Get output texture value type name              |
| `getTextureTypeConfiguration`   | Get texture type configuration                  |
| `setTextureTypeConfiguration`   | Set texture type configuration                  |
| `evaluate`                      | Force node evaluation                           |
| `collapse`                      | Collapse node into parent graph                 |
| `expand`                        | Expand node to show contents                    |
| `expandOutOfPin`                | Expand out of a specific pin                    |
| `exportToFile`                  | Export node to file                             |
| `deleteUnconnectedItems`        | Delete orphaned child items                     |
| `updateProperties`              | Update node properties                          |

### Properties Tables

| Table                  | Description                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `PROPS_NODE_ITEM`      | Dynamic info: name, type, pinCount, pinNames, pinIds, attributeCount, attributeNames, attributeIds, graphOwner, position, time, rootGraph |
| `PROPS_ATTRIBUTE_INFO` | Attribute metadata: id, type, description, isArray, defaults, version info                                                                |
| `PROPS_PIN_INFO`       | Pin metadata: id, name, label, type, description, groupName, isDynamic, colour                                                            |
| `PROPS_NODE_INFO`      | Static node type info: type, category, defaultName, description, pinInfoCount, attributeInfoCount, outputType                             |

---

## octane.nodegraph

Manipulate node graphs — create, find nodes, import/export, manage linkers.

### Functions

#### Graph Creation & Destruction

| Function          | Description                          |
| ----------------- | ------------------------------------ |
| `create`          | Create a new node graph              |
| `createRootGraph` | Create a new root-level graph        |
| `destroy`         | Delete a graph                       |
| `group`           | Group selected nodes into a subgraph |
| `ungroup`         | Ungroup a node graph                 |

#### Finding Nodes

| Function              | Description                      |
| --------------------- | -------------------------------- |
| `findFirstNode`       | Find first node by type          |
| `findFirstOutputNode` | Find first output node           |
| `findNodes`           | Find all nodes matching criteria |
| `findItemsByName`     | Find items by name string        |
| `getInputNodes`       | Get all input nodes              |
| `getOutputNodes`      | Get all output nodes             |
| `getOwnedItems`       | Get all owned items              |

#### Import / Export

| Function           | Description                       |
| ------------------ | --------------------------------- |
| `importFromFile`   | Import graph from .ocs/.orbx file |
| `importFromString` | Import graph from string data     |
| `exportToFile`     | Export graph to file              |
| `exportToString`   | Export graph to string data       |

#### Linkers (Script Graph I/O)

| Function             | Description                     |
| -------------------- | ------------------------------- |
| `setInputLinkers`    | Set up input linker pins        |
| `setOutputLinkers`   | Set up output linker pins       |
| `insertInputLinkers` | Insert additional input linkers |
| `removeInputLinkers` | Remove input linkers            |

#### Attributes & Animation

| Function                                  | Description               |
| ----------------------------------------- | ------------------------- |
| `setAttribute` / `setAttributeIx`         | Set graph attribute       |
| `getAttribute` / `getAttributeIx`         | Get graph attribute       |
| `clearAttribute` / `clearAttributeIx`     | Clear graph attribute     |
| `hasAttribute`                            | Check if attribute exists |
| `getAttributeCount`                       | Get attribute count       |
| `getAttributeInfo` / `getAttributeInfoIx` | Get attribute metadata    |
| `setAnimator` / `setAnimatorIx`           | Set attribute animator    |
| `getAnimator` / `getAnimatorIx`           | Get attribute animator    |
| `clearAnimator` / `clearAnimatorIx`       | Clear attribute animator  |
| `isAnimated` / `isAnimatedIx`             | Check if animated         |

#### Time & Evaluation

| Function                 | Description                            |
| ------------------------ | -------------------------------------- |
| `updateTime`             | Update time for the graph and children |
| `getAnimationTimeSpan`   | Get animation start/end times          |
| `setLinearTimeTransform` | Set linear time transform              |
| `getTimeTransform`       | Get current time transform             |
| `clearTimeTransform`     | Clear time transform                   |
| `evaluate`               | Force graph evaluation                 |

#### Utility

| Function                                 | Description                         |
| ---------------------------------------- | ----------------------------------- |
| `copyFrom`                               | Copy from another graph             |
| `copyFromGraph`                          | Copy from graph with options        |
| `copyItemTree`                           | Copy an item subtree                |
| `deleteOwnedItems`                       | Delete all owned items              |
| `deleteUnconnectedItems`                 | Delete orphaned items               |
| `unfold`                                 | Unfold graph hierarchy              |
| `collapse` / `expand` / `expandOutOfPin` | View management                     |
| `loadAllReferences`                      | Load all reference packages         |
| `unloadAllReferences`                    | Unload all references               |
| `referenceGraphCount`                    | Count reference graphs              |
| `getNodeGraphInfo`                       | Get graph info → `PROPS_GRAPH_INFO` |
| `getProperties`                          | Get graph properties                |
| `updateProperties`                       | Update properties                   |

### Properties Tables

| Table                        | Description                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `PROPS_GRAPH_INFO`           | Graph type info: type, category, defaultName, description, outputType, attributeInfoCount |
| `PROPS_NODE_ITEM`            | Same as `octane.node.PROPS_NODE_ITEM`                                                     |
| `PROPS_TIMETRANSFORM_LINEAR` | Linear time transform: offset, scale                                                      |

---

## octane.render

Configure GPUs, start/stop rendering, save images, manage render passes and AOVs.

### Functions

#### Render Control

| Function       | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| `start`        | Start rendering (blocking). Takes `PROPS_RENDER_START` table |
| `continue`     | Continue rendering after pause                               |
| `pause`        | Pause the current render                                     |
| `isPaused`     | Check if render is paused                                    |
| `restart`      | Restart render (reset sample count)                          |
| `reset`        | Reset the render engine                                      |
| `clear`        | Clear render buffers                                         |
| `callbackStop` | Stop from within a render callback                           |

#### Image Saving

| Function                    | Description                         |
| --------------------------- | ----------------------------------- |
| `saveImage`                 | Save beauty pass to file            |
| `saveImage2`                | Save beauty pass (extended options) |
| `saveImage3`                | Save beauty pass (latest API)       |
| `saveRenderPass`            | Save specific render pass           |
| `saveRenderPass2`           | Save render pass (extended)         |
| `saveRenderPass3`           | Save render pass (latest)           |
| `saveRenderPasses`          | Save all enabled render passes      |
| `saveRenderPasses2`         | Save all passes (extended)          |
| `saveRenderPasses3`         | Save all passes (latest)            |
| `saveRenderPassesMultiExr`  | Save passes as multi-layer EXR      |
| `saveRenderPassesMultiExr2` | Multi-layer EXR (extended)          |
| `saveRenderPassesMultiExr3` | Multi-layer EXR (latest)            |
| `saveDeepImage`             | Save deep image                     |
| `saveDeepImage2`            | Save deep image (extended)          |
| `saveRenderPassesDeepExr`   | Save passes as deep EXR             |
| `saveRenderPassesDeepExr2`  | Deep EXR (extended)                 |

#### Render State & Info

| Function                     | Description                                         |
| ---------------------------- | --------------------------------------------------- |
| `grabRenderResult`           | Grab current render result as image                 |
| `getRenderResultStatistics`  | Get render stats → `PROPS_RENDER_RESULT_STATISTICS` |
| `getChangeLevel`             | Get current change level                            |
| `getRenderTargetNode`        | Get active render target node                       |
| `getPreviewRenderTargetNode` | Get preview render target                           |
| `getDisplayRenderPassId`     | Get displayed pass ID                               |
| `setDisplayRenderPassId`     | Set displayed pass ID                               |
| `getAllRenderPassIds`        | Get all available pass IDs                          |
| `getRenderPassInfo`          | Get pass info → `PROPS_RENDER_PASS_INFO`            |
| `getEnabledAovs`             | Get enabled AOV list                                |
| `canSaveDeepImage`           | Check if deep image save is supported               |
| `deepImageEnabled`           | Check if deep image is enabled                      |
| `deepPassesEnabled`          | Check if deep passes enabled                        |
| `loadRenderState`            | Load saved render state                             |
| `saveRenderState`            | Save current render state                           |

#### Render Region

| Function          | Description                               |
| ----------------- | ----------------------------------------- |
| `getRenderRegion` | Get render region → `PROPS_RENDER_REGION` |
| `setRenderRegion` | Set render region                         |

#### Sub-Sampling

| Function           | Description         |
| ------------------ | ------------------- |
| `getSubSampleMode` | Get sub-sample mode |
| `setSubSampleMode` | Set sub-sample mode |

#### Clay Mode

| Function      | Description         |
| ------------- | ------------------- |
| `getClayMode` | Get clay mode state |
| `setClayMode` | Set clay mode       |

#### Devices

| Function                | Description                               |
| ----------------------- | ----------------------------------------- |
| `getDeviceCount`        | Get number of GPUs                        |
| `getDeviceProperties`   | Get GPU info → `PROPS_RENDER_DEVICE`      |
| `setDevicesActivity`    | Enable/disable specific GPUs              |
| `getMemoryUsage`        | Get VRAM usage → `PROPS_RENDER_MEM_USAGE` |
| `getGeometryStatistics` | Get geo stats → `PROPS_RENDER_GEOM_STATS` |

#### Preview & Tonemap

| Function              | Description                      |
| --------------------- | -------------------------------- |
| `preview`             | Render material preview (LDR)    |
| `previewHdr`          | Render material preview (HDR)    |
| `previewHdr2`         | Render material preview (HDR v2) |
| `synchronousTonemap`  | Synchronous tonemap              |
| `synchronousTonemap2` | Synchronous tonemap v2           |
| `synchronousTonemap3` | Synchronous tonemap v3           |

### Properties Tables

| Table                            | Fields                                                                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROPS_RENDER_START`             | renderTargetNode, maxRenderTime, restart, doUpdate, callback, statisticsCallback, bufferType, premultipliedAlphaType                                                             |
| `PROPS_RENDER_RESULT`            | image, samples, maxSamples, blendedSamples, renderTime, samplesSec, changeLevel, renderPassId, hasPendingUpdates                                                                 |
| `PROPS_RENDER_RESULT_STATISTICS` | beautySamplesPerPixel, beautyMaxSamplesPerPixel, beautySamplesPerSecond, renderTime, estimatedRenderTime, size, renderState, renderPasses, bufferType, colorSpace, subsampleMode |
| `PROPS_RENDER_DEVICE`            | name, index, active, supported, computeModel, usedForRendering, usedForDenoising, supportsHardwareRayTracing, geometryDataSize, imageTexturesSize, filmSize, etc.                |
| `PROPS_RENDER_MEM_USAGE`         | totalMemory, usedMemory, freeMemory, outOfCoreMemory, peerToPeer (all in MB)                                                                                                     |
| `PROPS_RENDER_GEOM_STATS`        | meshCount, triangleCount, displTriangleCount, hairCount, sphereCount, voxelCount, gaussianSplatCount, analyticLightCount, emittingTriangleCount, emittingInstanceCount           |
| `PROPS_RENDER_REGION`            | active, regionMin, regionMax, featherWidth                                                                                                                                       |
| `PROPS_RENDER_PASS_INFO`         | renderPassId, name, shortName, description, exrLayerName, nodeType, isGreyscale, isInfo                                                                                          |
| `PROPS_RENDER_PREVIEW`           | materialNode, size, maxSamples, objectType, objectSize, crop                                                                                                                     |

---

## octane.project

Load, save, and manage Octane projects.

### Functions

| Function                 | Description                        |
| ------------------------ | ---------------------------------- |
| `load`                   | Load a project file (.ocs / .orbx) |
| `save`                   | Save current project               |
| `saveAs`                 | Save project to new path           |
| `saveAsReferencePackage` | Save as reference package          |
| `reset`                  | Reset to blank project             |
| `getCurrentProject`      | Get current project path           |
| `loadedFromPackage`      | Check if loaded from package       |
| `unpackPackage`          | Unpack a package file              |
| `getSceneGraph`          | Get the scene's root graph         |
| `getPreviewRenderTarget` | Get preview render target          |
| `getProjectSettings`     | Get project settings node          |
| `getPreferences`         | Get application preferences        |
| `getMaterialBall`        | Get material ball node             |
| `getSelection`           | Get currently selected items       |
| `setSelection`           | Set selection                      |
| `select`                 | Add item to selection              |
| `deselect`               | Remove item from selection         |
| `clearSelection`         | Clear all selection                |

---

## octane.changemanager

Observe changes in the node system and force evaluation updates.

### Functions

| Function           | Description                                                                            |
| ------------------ | -------------------------------------------------------------------------------------- |
| `createObserver`   | Create a change observer: `createObserver({ itemChangeCallback=fn })`                  |
| `observeItem`      | Start observing an item for changes                                                    |
| `observeTime`      | Start observing time changes                                                           |
| `stopItemObserver` | Stop observing an item (or all items)                                                  |
| `stopTimeObserver` | Stop observing time                                                                    |
| `update`           | Force evaluation of all pending changes. **Call after batching `setAttribute` calls.** |

### Properties Tables

| Table                          | Fields                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `PROPS_CHANGEMANAGER_OBSERVER` | itemChangeCallback, timeChangeCallback                                                                    |
| `PROPS_ITEM_CHANGE_EVENT`      | type (octane.changeEventType), changedItem, changedOwner, changedOwnerPinIx, changedPinIx, changedIndices |
| `PROPS_TIME_CHANGE_EVENT`      | type (octane.timeEventType), rootGraph                                                                    |

### Usage Pattern

```lua
local function onNodeChanged(event)
    if event.type == octane.changeEventType.ITEM_VALUE_CHANGED then
        print("Node changed: " .. tostring(event.changedItem))
    end
end

local observer = octane.changemanager.createObserver({
    itemChangeCallback = onNodeChanged
})
octane.changemanager.observeItem(myNode, observer, octane.changeEventType.ITEM_VALUE_CHANGED)

-- Later: stop observing
octane.changemanager.stopItemObserver(observer)
```

---

## octane.image

Create and manipulate images — load, save, filter, pixel access.

### Functions

| Function                   | Description                          |
| -------------------------- | ------------------------------------ |
| `create`                   | Create a blank image                 |
| `createFromNode`           | Create image from render node output |
| `load`                     | Load image from file                 |
| `save`                     | Save image to file                   |
| `saveAsync`                | Save image asynchronously            |
| `fill`                     | Fill image with solid color          |
| `fillImageNode`            | Fill an image texture node           |
| `getPixel`                 | Get pixel value at (x, y)            |
| `setPixel`                 | Set pixel value at (x, y)            |
| `getRawPixels`             | Get raw pixel data buffer            |
| `getImageInfo`             | Get image info → `INFOS_IMAGE`       |
| `getLayerInfo`             | Get layer info → `INFOS_LAYER`       |
| `getProperties`            | Get image properties → `PROPS_IMAGE` |
| `copyRegion`               | Copy a rectangular region            |
| `convert`                  | Convert image format/type            |
| `compress`                 | Compress image data                  |
| `applyBoxFilter`           | Apply box blur filter                |
| `applyGaussianFilter`      | Apply Gaussian blur filter           |
| `applyLevels`              | Apply levels adjustment              |
| `calculateMeanSquareError` | Calculate MSE between two images     |
| `compareValues`            | Compare pixel values                 |
| `fromBase64`               | Load image from Base64 string        |

### Properties Tables

| Table             | Key Fields                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `PROPS_IMAGE`     | size, type, channelCount, bytesPerPixel, bytesPerChannel, byteSize, isHdr, isCompressed, hasColour, hasTransparency |
| `PROPS_JPEG_SAVE` | Quality and format options for JPEG                                                                                 |
| `PROPS_EXR_SAVE`  | Compression and format options for EXR                                                                              |
| `PROPS_TIFF_SAVE` | Format options for TIFF                                                                                             |

---

## octane.gui

Build user interfaces — windows, buttons, sliders, dialogs. **Not available in scripted graphs.**

### Functions

#### Component Creation

| Function                       | Description                                                     |
| ------------------------------ | --------------------------------------------------------------- |
| `create`                       | General component factory: `octane.gui.create{ type=..., ... }` |
| `createWindow`                 | Create a window                                                 |
| `createButton`                 | Create a button                                                 |
| `createCheckBox`               | Create a checkbox                                               |
| `createComboBox`               | Create a dropdown                                               |
| `createSlider`                 | Create a slider                                                 |
| `createNumericBox`             | Create a numeric input                                          |
| `createLabel`                  | Create a text label                                             |
| `createTextEditor`             | Create a text editor                                            |
| `createGroup`                  | Create a group container                                        |
| `createProgressBar`            | Create a progress bar                                           |
| `createParameter`              | Create a parameter widget                                       |
| `createPropertyTable`          | Create a property table                                         |
| `createOcioColorSpaceComboBox` | OCIO color space picker                                         |
| `createOcioLookComboBox`       | OCIO look picker                                                |
| `createOcioViewComboBox`       | OCIO view picker                                                |

#### Window & Dialog Management

| Function            | Description                          |
| ------------------- | ------------------------------------ |
| `showWindow`        | Show a window (blocking)             |
| `closeWindow`       | Close a window                       |
| `showDialog`        | Show a modal dialog                  |
| `showError`         | Show an error dialog                 |
| `dispatchGuiEvents` | Process pending GUI events           |
| `updateStatus`      | Update status bar text               |
| `bind`              | Bind a callback to a component event |
| `browseForAsset`    | Open asset browser dialog            |

### Constants

| Constant        | Values                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `componentType` | WINDOW, BUTTON, CHECK_BOX, COMBO_BOX, SLIDER, LABEL, GROUP, TEXT_EDITOR, PROGRESS_BAR, TABS, PANEL_STACK, TABLE, BITMAP, COLOUR_SWATCH, PARAMETER, TITLE_COMPONENT (16 values) |
| `dialogIcon`    | INFO, WARNING, ERROR, QUESTION (4 values)                                                                                                                                      |
| `dialogType`    | OK, OK_CANCEL (2 values)                                                                                                                                                       |
| `eventType`     | BUTTON_CLICKED, CHECK_BOX_TOGGLED, COMBO_BOX_CHANGED, SLIDER_CHANGED, TEXT_CHANGED, WINDOW_CLOSED, TABLE_ROW_SELECTED, etc. (16 values)                                        |

### Key Properties Tables

| Table                 | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| `PROPS_GUI_WINDOW`    | Window: text, width, height, gridLayout, resizable, closable |
| `PROPS_GUI_BUTTON`    | Button: text, width, height, enabled                         |
| `PROPS_GUI_SLIDER`    | Slider: value, min, max, step, text                          |
| `PROPS_GUI_COMBO_BOX` | ComboBox: items, selectedIx, text                            |
| `PROPS_DIALOG`        | Dialog: type, icon, text, message                            |
| `PROPS_FILE_DIALOG`   | File dialog: title, filters, path                            |
| `PROPS_NUMERIC_BOX`   | Numeric input: value, min, max, step, label                  |
| `PROPS_TEXT_EDITOR`   | Text editor: text, readOnly, multiLine                       |

---

## octane.gridlayout

Arrange GUI components in a resizable grid. Used as the layout for `octane.gui` windows.

### Functions

| Function                  | Description                           |
| ------------------------- | ------------------------------------- |
| `create`                  | Create a new grid layout              |
| `startSetup`              | Begin layout definition               |
| `endSetup`                | End layout definition                 |
| `add`                     | Add component at (col, row)           |
| `addEmpty`                | Add empty cell                        |
| `addSpan`                 | Add component spanning multiple cells |
| `setColElasticity`        | Set column stretch weight             |
| `setRowElasticity`        | Set row stretch weight                |
| `setElasticityForAllCols` | Set all columns' stretch              |
| `setElasticityForAllRows` | Set all rows' stretch                 |
| `startNestedGrid`         | Begin nested grid                     |
| `endNestedGrid`           | End nested grid                       |
| `getWidth` / `getHeight`  | Get layout dimensions                 |
| `inSetupPhase`            | Check if in setup phase               |

### Usage Example

```lua
local layout = octane.gridlayout.create()
layout:startSetup()
    local label = octane.gui.create{ type=octane.componentType.LABEL, text="Name:" }
    layout:add(label, 1, 1)
    local input = octane.gui.create{ type=octane.componentType.TEXT_EDITOR, text="" }
    layout:add(input, 2, 1)
    layout:setElasticityForAllRows(0)
layout:endSetup()

local win = octane.gui.create{
    type       = octane.gui.componentType.WINDOW,
    text       = "My Dialog",
    gridLayout = layout,
    width      = 400,
    height     = 200,
}
win:showWindow()
```

---

## octane.settingsgroup

Build settings dialogs with labeled rows — a simpler alternative to grid layouts.

### Functions

| Function      | Description                 |
| ------------- | --------------------------- |
| `create`      | Create a settings group     |
| `beginGroup`  | Start a named section       |
| `addRow`      | Add a label + component row |
| `showDialog`  | Show as modal dialog        |
| `toComponent` | Convert to GUI component    |

---

## octane.file

Portable file system operations — paths, directories, file I/O.

### Functions

| Function                      | Description                                     |
| ----------------------------- | ----------------------------------------------- |
| `exists`                      | Check if path exists                            |
| `isFile`                      | Check if path is a file                         |
| `isDirectory`                 | Check if path is a directory                    |
| `isHidden`                    | Check if file is hidden                         |
| `isAbsolute`                  | Check if path is absolute                       |
| `createDirectory`             | Create a directory                              |
| `createFile`                  | Create an empty file                            |
| `copy`                        | Copy a file                                     |
| `copyDirectory`               | Copy a directory recursively                    |
| `move`                        | Move/rename a file                              |
| `remove`                      | Delete a file or directory                      |
| `listDirectory`               | List directory contents                         |
| `join`                        | Join path components                            |
| `getFileName`                 | Extract filename from path                      |
| `getFileNameWithoutExtension` | Filename without extension                      |
| `getFileExtension`            | Get file extension                              |
| `getParentDirectory`          | Get parent directory                            |
| `getCurrentWorkingDirectory`  | Get CWD                                         |
| `getSpecialDirectories`       | Get special paths → `PROPS_SPECIAL_DIRECTORIES` |
| `getFileSize`                 | Get file size in bytes                          |
| `getCreationTime`             | Get file creation time                          |
| `getModifiedTime`             | Get file modification time                      |
| `hasWriteAccess`              | Check write permissions                         |
| `makeRelativeTo`              | Make path relative to base                      |
| `resolveTemplate`             | Resolve path template variables                 |
| `getLinkTarget`               | Resolve symlink target                          |
| `checksum`                    | Calculate file checksum                         |
| `fopen`                       | Open file for I/O                               |

### Special Directories (`PROPS_SPECIAL_DIRECTORIES`)

| Field                          | Description              |
| ------------------------------ | ------------------------ |
| `userHomeDirectory`            | User's home directory    |
| `userDesktopDirectory`         | Desktop directory        |
| `userDocumentsDirectory`       | Documents directory      |
| `userScriptDirectory`          | Octane scripts directory |
| `userApplicationDataDirectory` | App data directory       |
| `tempDirectory`                | Temporary directory      |
| `currentExecutableFile`        | Octane executable path   |
| `currentApplicationFile`       | Octane app path          |

---

## octane.apiinfo

Introspect the API — query node types, pin types, attribute types at runtime.

### Functions

| Function                        | Description                                  |
| ------------------------------- | -------------------------------------------- |
| `getNodeTypes`                  | Get all registered node types                |
| `getNodeTypeName`               | Get name for a node type ID                  |
| `getNodeInfo`                   | Get node type metadata → `PROPS_NODE_INFO`   |
| `getNodeAttributeInfo`          | Get attribute info for a node type           |
| `getGraphTypes`                 | Get all graph types                          |
| `getGraphTypeName`              | Get name for a graph type                    |
| `getGraphInfo`                  | Get graph type metadata → `PROPS_GRAPH_INFO` |
| `getGraphAttributeInfo`         | Get attribute info for a graph type          |
| `getPinId`                      | Get pin ID by name                           |
| `getPinIdName`                  | Get pin ID name                              |
| `getPinName`                    | Get display name for pin                     |
| `getPinTypeName`                | Get pin type name                            |
| `getPinInfo`                    | Get pin metadata → `PROPS_PIN_INFO`          |
| `getAttributeId`                | Get attribute ID by name                     |
| `getAttributeIdName`            | Get attribute ID name                        |
| `getAttributeName`              | Get attribute display name                   |
| `getAttributeTypeName`          | Get attribute type name                      |
| `getCompatibleTypes`            | Get compatible node types for a pin          |
| `getSystemInfo`                 | Get system info → `PROPS_SYSTEM_INFO`        |
| `getTextureValueTypeName`       | Get texture value type name                  |
| `isDeprecated`                  | Check if a type/attribute is deprecated      |
| `findConfigurationByInterface`  | Find node config by interface                |
| `findConfigurationByParameters` | Find node config by parameters               |

### System Info (`PROPS_SYSTEM_INFO`)

| Field                        | Description              |
| ---------------------------- | ------------------------ |
| `octaneVersion`              | e.g. "2026.1"            |
| `octaneVersionName`          | Full version string      |
| `octaneVersionNumber`        | Numeric version          |
| `os`                         | Operating system         |
| `cpuModel` / `cpuVendor`     | CPU info                 |
| `cpuNbCores` / `cpuClockMHz` | CPU specs                |
| `driverVersion`              | GPU driver (NVIDIA only) |
| `hash`                       | Build commit hash        |

---

## octane.apimaterialx

MaterialX support — import MaterialX files, query MaterialX node mappings.

### Functions

| Function                       | Description                         |
| ------------------------------ | ----------------------------------- |
| `importMaterialXFile`          | Import a .mtlx file                 |
| `getNodeTypes`                 | Get MaterialX-compatible node types |
| `getAllMxNodeCategories`       | List all MX node categories         |
| `getMxNodeCategory`            | Get MX category for a node type     |
| `getMxNodeCategoryOfGraphType` | Get MX category for a graph type    |
| `getMxValueType`               | Get MX value type                   |
| `getTextureValueType`          | Get texture value type for MX type  |
| `getGraphType`                 | Get graph type for MX category      |
| `getGraphMxInputNames`         | Get MX input names for a graph      |
| `getGraphMxOutputNames`        | Get MX output names for a graph     |
| `getMxInputNamesAndPinIds`     | Map MX input names to pin IDs       |
| `findConfiguration`            | Find MaterialX configuration        |
| `findConfigurationByNames`     | Find config by MX names             |

---

## octane.scriptgraph

Functions for scripted node graphs. Only available inside script graph Lua code.

### Callbacks (define in returned table)

| Callback                  | Description                               |
| ------------------------- | ----------------------------------------- |
| `onInit(self, graph)`     | Called once when graph initializes        |
| `onEvaluate(self, graph)` | Called when inputs change or time updates |
| `onShutdown(self, graph)` | Called when graph is destroyed            |
| `onTrigger(self, graph)`  | Called on manual trigger                  |

### Functions

| Function                 | Description                                 |
| ------------------------ | ------------------------------------------- |
| `setInputLinkers`        | Define input pins                           |
| `setOutputLinkers`       | Define output pins (via `onInit`)           |
| `insertInputLinkers`     | Add more input linkers                      |
| `removeInputLinkers`     | Remove input linkers                        |
| `getInputValue`          | Read input pin value                        |
| `setInputValue`          | Write input pin value                       |
| `inputWasChanged`        | Check if input was modified since last eval |
| `timeWasChanged`         | Check if time changed                       |
| `setEvaluateTimeChanges` | Enable/disable time-based re-evaluation     |
| `setInputInfo`           | Update input pin info                       |
| `setIcon`                | Set custom icon for graph                   |
| `reset`                  | Reset script graph state                    |
| `appendAsset`            | Add an asset to the graph                   |
| `getAsset`               | Get asset by index                          |
| `getAssetCount`          | Get number of assets                        |
| `removeAsset`            | Remove an asset                             |
| `removeAllAssets`        | Remove all assets                           |

### Pin Info Definition

Two ways to define pin infos:

```lua
-- Direct type specification:
{ type=octane.PT_TEXTURE, label="Albedo", defaultNodeType=octane.NT_TEX_RGB }

-- From existing node type:
{ label="Albedo", fromNodeType=octane.NT_MAT_UNIVERSAL, fromPinId=octane.P_ALBEDO }
```

### Minimal Script Graph Example

```lua
local MyScript = {}
local inputs, outputs

function MyScript.onInit(self, graph)
    inputs = graph:setInputLinkers({
        { type=octane.PT_TEXTURE, label="Color", defaultNodeType=octane.NT_TEX_RGB }
    })
    outputs = graph:setOutputLinkers({
        { type=octane.PT_TEXTURE, label="Result" }
    })
end

function MyScript.onEvaluate(self, graph)
    local rgb = self:getInputValue(inputs[1])
    -- Process and output...
end

MyScript._name = "My Script"
return MyScript
```

---

## octane.renderjobgraph

Extended script graph for render jobs. Inherits all script graph callbacks plus:

### Additional Callbacks

| Callback              | Description                              |
| --------------------- | ---------------------------------------- |
| `onStartIteration`    | Called at start of each render iteration |
| `onIterate`           | Called for each frame/step               |
| `onSaveRenderedFrame` | Called to save each rendered frame       |
| `onFinishIteration`   | Called at end of each iteration          |

### Key Attributes

| Attribute            | Access | Description                    |
| -------------------- | ------ | ------------------------------ |
| `A_TOTAL_FRAMES`     | Write  | Total frames in render job     |
| `A_OUTPUT_DIRECTORY` | Read   | Output directory (set from UI) |

---

## octane.matrix

3x4 matrix operations. Matrices stored as row-major tables of 3 rows × 4 columns.

### Functions

| Function               | Description                           |
| ---------------------- | ------------------------------------- |
| `getIdentity`          | Get 3x4 identity matrix               |
| `makeTranslation`      | Translation matrix from {x,y,z}       |
| `makeScale`            | Scale matrix from {x,y,z}             |
| `makeRotX`             | Rotation around X axis                |
| `makeRotY`             | Rotation around Y axis                |
| `makeRotZ`             | Rotation around Z axis                |
| `makeRotation`         | Rotation from Euler angles + order    |
| `make2dTransformation` | 2D transform matrix                   |
| `make3dTransformation` | 3D transform matrix                   |
| `mul`                  | Multiply two matrices                 |
| `mulP`                 | Transform a point                     |
| `mulV`                 | Transform a vector (no translation)   |
| `mulScalar`            | Scalar multiplication                 |
| `divScalar`            | Scalar division                       |
| `add`                  | Add two matrices                      |
| `sub`                  | Subtract two matrices                 |
| `scale`                | Scale matrix by factor                |
| `translate`            | Apply translation                     |
| `transpose`            | Transpose matrix                      |
| `inverse`              | Invert matrix                         |
| `isSingular`           | Check if matrix is singular           |
| `split`                | Decompose into rotation + translation |
| `lerp`                 | Linearly interpolate two matrices     |

### Constants

| Constant        | Values                                  |
| --------------- | --------------------------------------- |
| `rotationOrder` | XYZ, XZY, YXZ, YZX, ZXY, ZYX (6 values) |

---

## octane.vec

3D vector operations. Vectors stored as `{x, y, z}` tables.

### Functions

| Function     | Description            |
| ------------ | ---------------------- |
| `add`        | Add two vectors        |
| `sub`        | Subtract two vectors   |
| `scale`      | Scale vector by scalar |
| `dot`        | Dot product            |
| `cross`      | Cross product          |
| `length`     | Vector magnitude       |
| `normalized` | Unit vector            |
| `lerp`       | Linear interpolation   |
| `rotate`     | Rotate vector          |

---

## octane.package

Inspect contents of .orbx package files.

### Functions

| Function       | Description                     |
| -------------- | ------------------------------- |
| `open`         | Open a package for reading      |
| `close`        | Close a package                 |
| `fopen`        | Open a file within the package  |
| `fexists`      | Check if file exists in package |
| `getFileList`  | List all files in package       |
| `getChildFile` | Get child file path             |
| `createPath`   | Create path within package      |

---

## octane.packagefile

File I/O for files inside packages. Same interface as Lua `io.open()` objects.

### Functions

| Function  | Description        |
| --------- | ------------------ |
| `read`    | Read data          |
| `write`   | Write data         |
| `seek`    | Seek to position   |
| `close`   | Close file         |
| `flush`   | Flush write buffer |
| `lines`   | Iterate lines      |
| `setvbuf` | Set buffering mode |

---

## octane.caches

Manage Octane file caches (meshlet cache, virtual texture cache).

### Functions

| Function                          | Description                    |
| --------------------------------- | ------------------------------ |
| `getMeshletCacheSize`             | Get meshlet cache max size     |
| `getMeshletCacheUsedSize`         | Get meshlet cache used size    |
| `getMeshletCacheFileName`         | Get cache file for a node      |
| `hasMeshletCacheFile`             | Check if cache file exists     |
| `clearMeshletCache`               | Clear entire meshlet cache     |
| `clearMeshletCacheFileForNode`    | Clear cache for specific node  |
| `clearMeshletCacheFilesForId`     | Clear cache by ID              |
| `checkMeshletBuildStatus`         | Check if meshlet build is done |
| `getVirtualTextureCacheSize`      | Get VT cache max size          |
| `getVirtualTextureCacheUsedSize`  | Get VT cache used size         |
| `clearVirtualTextureCacheForNode` | Clear VT cache for node        |
| `checkVirtualTextureStatus`       | Check VT cache status          |
| `pruneVirtualTextureCache`        | Prune unused VT cache entries  |

---

## octane.modules

Access Octane external modules (plugins).

### Functions

| Function              | Description                           |
| --------------------- | ------------------------------------- |
| `getDirectory`        | Get modules directory                 |
| `setDirectory`        | Set modules directory                 |
| `getCommandModules`   | List command modules                  |
| `getNodegraphModules` | List node graph modules               |
| `getModuleInfo`       | Get module info → `PROPS_MODULE_INFO` |
| `runCommandModule`    | Execute a command module              |

---

## octane.json

JSON encode/decode.

### Functions

| Function | Description                     |
| -------- | ------------------------------- |
| `encode` | Encode Lua table to JSON string |
| `decode` | Decode JSON string to Lua table |

---

## octane.common

Common utilities available in all scripts.

### Functions

| Function | Description                      |
| -------- | -------------------------------- |
| `print`  | Print to Octane's script console |
| `time`   | Get current time                 |

---

## octane.timer

Call functions on timers. Timers fire during blocking calls (`render.start`, `showWindow`).

### Functions

| Function | Description                                                         |
| -------- | ------------------------------------------------------------------- |
| `create` | Create a timer: `octane.timer.create{ callback=fn, interval=1000 }` |
| `start`  | Start a timer                                                       |
| `stop`   | Stop a timer                                                        |

---

## octane.mt19937

Mersenne Twister 19937 PRNG — consistent cross-platform random numbers.

### Functions

| Function   | Description                     |
| ---------- | ------------------------------- |
| `seed`     | Set random seed                 |
| `random`   | Generate random integer         |
| `random01` | Generate random float in [0, 1) |
| `max`      | Get maximum value               |

---

## octane.util

Miscellaneous utility functions.

### Functions

| Function           | Description                           |
| ------------------ | ------------------------------------- |
| `generateUid`      | Generate a unique ID string           |
| `getCurrentMillis` | Get current time in milliseconds      |
| `floatRange`       | Generate a range of float values      |
| `intRange`         | Generate a range of integer values    |
| `updateFlag`       | Update a bit flag value               |
| `boxPointer`       | Box a C pointer for Lua               |
| `crashMe`          | Debug: trigger a crash (testing only) |

---

## octane.storage

Persistent key-value storage for scripts. Requires `@script-id` metadata header.

Storage tables persist between script executions. Supported value types: numbers, booleans, strings, and nested tables.

```lua
-- @script-id my-unique-script-id

-- Access persistent storage:
octane.storage["lastRun"] = os.time()
local prev = octane.storage["lastRun"]
```

---

## octane.help

Interactive API documentation browser (used within Octane's script editor).

### Functions

| Function         | Description                           |
| ---------------- | ------------------------------------- |
| `help`           | Show general help                     |
| `modules`        | List all modules                      |
| `functions`      | List functions in a module            |
| `constants`      | List constants                        |
| `variables`      | List variables                        |
| `properties`     | List properties tables                |
| `functionDoc`    | Get function documentation            |
| `constantDoc`    | Get constant documentation            |
| `variableDoc`    | Get variable documentation            |
| `propertiesDoc`  | Get properties documentation          |
| `addModule`      | Register a custom module              |
| `addFunction`    | Register a custom function            |
| `addFunctionDoc` | Add documentation for custom function |

---

## octane.geometryexporter

Export animated geometry to Alembic (.abc) or FBX files.

### Functions

| Function          | Description                                    |
| ----------------- | ---------------------------------------------- |
| `create`          | Create exporter with `PROPS_GEOMETRY_EXPORTER` |
| `addItem`         | Add node items to export                       |
| `setTimeSampling` | Configure time sampling                        |
| `writeFrame`      | Write a single frame                           |
| `close`           | Finalize and close file                        |
| `makeGraph`       | Create graph from exported data                |

### Properties (`PROPS_GEOMETRY_EXPORTER`)

| Field                         | Description                          |
| ----------------------------- | ------------------------------------ |
| `filename`                    | Output file path                     |
| `exportFormat`                | Format (octane.geometryExportFormat) |
| `items`                       | Node items to export                 |
| `exportMaterial`              | Export materials (FBX only)          |
| `exportAsStingRayMat`         | Use Stingray material format (FBX)   |
| `fastScatterExport`           | Fast scatter export mode (FBX)       |
| `description`                 | File description                     |
| `writeOcsData`                | Embed OCS data (FBX)                 |
| `cameraAspectRatio`           | Camera aspect ratio                  |
| `renderSizeX` / `renderSizeY` | Texture render dimensions (FBX)      |

---

## octane.rendercloudmanager

Cloud rendering services.

### Functions

| Function               | Description                     |
| ---------------------- | ------------------------------- |
| `uploadCurrentProject` | Upload current project to cloud |
| `uploadRootNodeGraph`  | Upload root graph to cloud      |
| `newRenderTask`        | Create a new cloud render task  |
| `userSubscriptionInfo` | Get user subscription info      |

---

## Constants

All constants live under the `octane` global namespace. Major constant tables:

### Node Types (`octane.nodeType`) — 749 values

Node type IDs used with `octane.node.create`. Key categories:

| Prefix        | Category     | Examples                                                                                              |
| ------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| `NT_GEO_*`    | Geometry     | `NT_GEO_MESH`, `NT_GEO_GROUP`, `NT_GEO_PLACEMENT`, `NT_GEO_SCATTER`, `NT_GEO_VOLUME`, `NT_GEO_OBJECT` |
| `NT_MAT_*`    | Materials    | `NT_MAT_DIFFUSE`, `NT_MAT_GLOSSY`, `NT_MAT_SPECULAR`, `NT_MAT_MIX`, `NT_MAT_UNIVERSAL`, `NT_MAT_TOON` |
| `NT_TEX_*`    | Textures     | `NT_TEX_RGB`, `NT_TEX_FLOAT`, `NT_TEX_IMAGE`, `NT_TEX_CHECKS`, `NT_TEX_NOISE`, `NT_TEX_DIRT`          |
| `NT_CAM_*`    | Cameras      | `NT_CAM_THINLENS`, `NT_CAM_PANORAMIC`, `NT_CAM_OSL`, `NT_CAM_UNIVERSAL`                               |
| `NT_KERN_*`   | Kernels      | `NT_KERN_DIRECTLIGHTING`, `NT_KERN_PATHTRACING`, `NT_KERN_PMC`, `NT_KERN_INFO`                        |
| `NT_ENV_*`    | Environments | `NT_ENV_DAYLIGHT`, `NT_ENV_TEXTURE`, `NT_ENV_PLANETARY`                                               |
| `NT_LIGHT_*`  | Lights       | `NT_LIGHT_TOON_DIRECTIONAL`, `NT_LIGHT_TOON_POINT`, `NT_LIGHT_ANALYTIC`                               |
| `NT_PROJ_*`   | Projections  | `NT_PROJ_BOX`, `NT_PROJ_CYLINDRICAL`, `NT_PROJ_PERSPECTIVE`, `NT_PROJ_SPHERICAL`, `NT_PROJ_UVW`       |
| `NT_TRSF_*`   | Transforms   | `NT_TRSF_ROTATION`, `NT_TRSF_SCALE`, `NT_TRSF_2D`, `NT_TRSF_3D`, `NT_TRSF_VALUE`                      |
| `NT_RENDER_*` | Render       | `NT_RENDER_TARGET`, `NT_RENDER_PASS`, `NT_RENDER_AOV`                                                 |
| `NT_MEDIUM_*` | Media        | `NT_MEDIUM_ABSORPTION`, `NT_MEDIUM_SCATTERING`, `NT_MEDIUM_VOLUME`                                    |
| `NT_DISP_*`   | Displacement | `NT_DISP_DISPLACEMENT`, `NT_DISP_VERTEX`                                                              |
| `NT_ANIM_*`   | Animation    | `NT_ANIM_FLOAT`, `NT_ANIM_VALUE`                                                                      |
| `NT_POST_*`   | Post-process | `NT_POST_BLOOM`, `NT_POST_GLARE`, `NT_POST_VOLUME`                                                    |

### Graph Types (`octane.graphType`) — 107 values

Graph type IDs for `octane.nodegraph.create`. Prefix: `GT_*`

### Pin Types (`octane.pinType`) — 45 values

Pin type IDs. Key values:

| Constant             | Description         |
| -------------------- | ------------------- |
| `PT_TEXTURE`         | Texture pin         |
| `PT_MATERIAL`        | Material pin        |
| `PT_GEOMETRY`        | Geometry pin        |
| `PT_CAMERA`          | Camera pin          |
| `PT_ENVIRONMENT`     | Environment pin     |
| `PT_KERNEL`          | Kernel pin          |
| `PT_MEDIUM`          | Medium pin          |
| `PT_TRANSFORM`       | Transform pin       |
| `PT_PROJECTION`      | Projection pin      |
| `PT_DISPLACEMENT`    | Displacement pin    |
| `PT_EMISSION`        | Emission pin        |
| `PT_PHASE_FUNCTION`  | Phase function pin  |
| `PT_RENDER_TARGET`   | Render target pin   |
| `PT_POST_PROCESSING` | Post-processing pin |
| `PT_RENDER_PASS`     | Render pass pin     |
| `PT_BOOL`            | Boolean value pin   |
| `PT_INT`             | Integer value pin   |
| `PT_FLOAT`           | Float value pin     |
| `PT_STRING`          | String value pin    |
| `PT_ENUM`            | Enum value pin      |

### Attribute IDs (`octane.attributeId`) — 621 values

Attribute IDs for `setAttribute`/`getAttribute`. Key values:

| Constant             | Description               |
| -------------------- | ------------------------- |
| `A_VALUE`            | Generic value attribute   |
| `A_FILENAME`         | File path attribute       |
| `A_RELOAD`           | Trigger reload            |
| `A_POSITION`         | Position                  |
| `A_TARGET`           | Camera target             |
| `A_UP`               | Up vector                 |
| `A_ROTATION`         | Rotation (degrees)        |
| `A_SCALE`            | Scale                     |
| `A_TRANSFORM`        | Transform matrix          |
| `A_POWER`            | Light power               |
| `A_TEMPERATURE`      | Color temperature         |
| `A_GAMMA`            | Gamma value               |
| `A_EXPOSURE`         | Exposure                  |
| `A_FOV`              | Field of view             |
| `A_APERTURE`         | Lens aperture             |
| `A_FOCAL_DEPTH`      | Focal depth               |
| `A_RESOLUTION`       | Resolution                |
| `A_MAX_SAMPLES`      | Max render samples        |
| `A_GI_MODE`          | Global illumination mode  |
| `A_SPECULAR_DEPTH`   | Specular bounce depth     |
| `A_GLOSSY_DEPTH`     | Glossy bounce depth       |
| `A_DIFFUSE_DEPTH`    | Diffuse bounce depth      |
| `A_OUTPUT_DIRECTORY` | Output directory path     |
| `A_TOTAL_FRAMES`     | Total animation frames    |
| `A_UNKNOWN`          | Invalid/unknown attribute |

### Attribute Types (`octane.attributeType`) — 16 values

| Constant      | Description             |
| ------------- | ----------------------- |
| `AT_BOOL`     | Boolean                 |
| `AT_INT`      | Integer                 |
| `AT_INT2`     | 2D integer              |
| `AT_INT3`     | 3D integer              |
| `AT_FLOAT`    | Float                   |
| `AT_FLOAT2`   | 2D float                |
| `AT_FLOAT3`   | 3D float (color/vector) |
| `AT_FLOAT4`   | 4D float                |
| `AT_STRING`   | String                  |
| `AT_FILENAME` | File path               |
| `AT_MATRIX`   | Matrix                  |
| `AT_ENUM`     | Enumeration             |
| `AT_BYTE`     | Byte                    |
| `AT_INT4`     | 4D integer              |
| `AT_DOUBLE`   | Double precision float  |
| `AT_UNKNOWN`  | Unknown type            |

### Image Save Formats (`octane.imageSaveFormat`) — 8 values

PNG, PNG16, EXR, EXR_TONEMAP, HDR, TGA, TIFF, TIFF16

### Image Save Types (`octane.imageSaveType`) — 13 values

Extended save format options including JPEG and OpenEXR variants.

### EXR Compression (`octane.exrCompressionType`) — 10 values

NONE, RLE, ZIPS, ZIP, PIZ, PXR24, B44, B44A, DWAA, DWAB

### Change Event Types (`octane.changeEventType`) — 12 values

| Constant             | Description             |
| -------------------- | ----------------------- |
| `ITEM_ADDED`         | Item was added to graph |
| `ITEM_DELETE`        | Item was deleted        |
| `ITEM_RENAMED`       | Item was renamed        |
| `ITEM_VALUE_CHANGED` | Attribute value changed |
| `ITEM_INPUT_CHANGED` | Pin input changed       |
| `CONNECTION_CHANGED` | Pin connection changed  |

### Pin IDs (`octane.pinId`) — 1131 values

Pin IDs used with `connectTo`, `disconnect`, `getPinInfo`. Key values:

| Constant            | Value | Description           |
| ------------------- | ----- | --------------------- |
| `P_GEOMETRY`        | 59    | Geometry input        |
| `P_KERNEL`          | 89    | Kernel input          |
| `P_ENVIRONMENT`     | 43    | Environment input     |
| `P_CAMERA`          | 20    | Camera input          |
| `P_MATERIAL`        | 96    | Material input        |
| `P_EMISSION`        | 41    | Emission input        |
| `P_MEDIUM`          | 98    | Medium input          |
| `P_DISPLACEMENT`    | 33    | Displacement input    |
| `P_TRANSFORM`       | 174   | Transform input       |
| `P_PROJECTION`      | 131   | Projection input      |
| `P_TEXTURE`         | 163   | Texture input         |
| `P_OPACITY`         | 115   | Opacity input         |
| `P_BUMP`            | 18    | Bump input            |
| `P_NORMAL`          | 109   | Normal input          |
| `P_ROUGHNESS`       | 144   | Roughness input       |
| `P_SPECULAR`        | 155   | Specular input        |
| `P_ALBEDO`          | 3     | Albedo/diffuse color  |
| `P_POWER`           | 129   | Light power           |
| `P_DISTRIBUTION`    | 37    | Light distribution    |
| `P_INPUT`           | 78    | Generic input         |
| `P_INPUT1`          | —     | First numbered input  |
| `P_INPUT2`          | —     | Second numbered input |
| `P_RENDER_PASS`     | 138   | Render pass input     |
| `P_IMAGER`          | 75    | Imager input          |
| `P_POST_PROCESSING` | 128   | Post-processing input |
| `P_RENDER_TARGET`   | 140   | Render target         |
| `P_SUB_TYPE`        | 158   | Sub-type enum pin     |
| `P_UNKNOWN`         | —     | Invalid/unknown pin   |

> 1131 total pin IDs cover every connectable pin across all node types. Use `octane.apiinfo.getPinId(name)` to look up by name.

### Render Pass IDs (`octane.renderPassId`) — 215 values

Render pass/AOV identifiers for `setDisplayRenderPassId`, `saveRenderPass`, etc. Key passes:

| Category            | Examples                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Beauty              | `RENDER_PASS_BEAUTY`, `RENDER_PASS_BEAUTY_DIRECT`, `RENDER_PASS_BEAUTY_INDIRECT`                                                                                                                                   |
| Diffuse             | `RENDER_PASS_DIFFUSE`, `RENDER_PASS_DIFFUSE_DIRECT`, `RENDER_PASS_DIFFUSE_INDIRECT`, `RENDER_PASS_DIFFUSE_FILTER`                                                                                                  |
| Reflection          | `RENDER_PASS_REFLECTION`, `RENDER_PASS_REFLECTION_DIRECT`, `RENDER_PASS_REFLECTION_INDIRECT`                                                                                                                       |
| Refraction          | `RENDER_PASS_REFRACTION`                                                                                                                                                                                           |
| Emission            | `RENDER_PASS_EMISSION`, `RENDER_PASS_EMISSIVE_LIGHT`                                                                                                                                                               |
| SSS                 | `RENDER_PASS_SSS`                                                                                                                                                                                                  |
| Info channels       | `RENDER_PASS_GEOMETRIC_NORMAL`, `RENDER_PASS_SHADING_NORMAL`, `RENDER_PASS_POSITION`, `RENDER_PASS_Z_DEPTH`, `RENDER_PASS_UV_COORD`, `RENDER_PASS_TANGENT_U`, `RENDER_PASS_MOTION_VECTOR`, `RENDER_PASS_WIREFRAME` |
| Material/Object IDs | `RENDER_PASS_MATERIAL_ID`, `RENDER_PASS_OBJECT_ID`, `RENDER_PASS_OBJECT_LAYER_COLOR`                                                                                                                               |
| Shadow              | `RENDER_PASS_SHADOW`, `RENDER_PASS_SHADOW_AMBIENT`                                                                                                                                                                 |
| AO                  | `RENDER_PASS_AMBIENT_OCCLUSION`                                                                                                                                                                                    |
| Light               | `RENDER_PASS_LIGHT_DIRECTION`, `RENDER_PASS_LIGHT_ID`                                                                                                                                                              |
| Cryptomatte         | `RENDER_PASS_CRYPTO_MATERIAL`, `RENDER_PASS_CRYPTO_OBJECT`, `RENDER_PASS_CRYPTO_ASSET`                                                                                                                             |
| Denoiser            | `RENDER_PASS_DENOISER_BEAUTY`, `RENDER_PASS_DENOISER_DIFFUSE`                                                                                                                                                      |
| Post FX             | `RENDER_PASS_POST_FX`, `RENDER_PASS_POST_FX_BLOOM`, `RENDER_PASS_POST_FX_GLARE`                                                                                                                                    |
| Volume              | `RENDER_PASS_VOLUME`, `RENDER_PASS_VOLUME_EMISSION`, `RENDER_PASS_VOLUME_MASK`                                                                                                                                     |
| Custom AOV          | `RENDER_PASS_GLOBAL_TEX_AOV_*` (1–20)                                                                                                                                                                              |

### Primitive Types (`octane.primitiveType`) — 15 values

Used with `NT_GEO_OBJECT` pin 0 enum to set primitive shape:

| Constant           | Description   |
| ------------------ | ------------- |
| `PRIM_NONE`        | No primitive  |
| `PRIM_BOX`         | Box (default) |
| `PRIM_CYLINDER`    | Cylinder      |
| `PRIM_SPHERE`      | Sphere        |
| `PRIM_DISK`        | Disk          |
| `PRIM_PLANE`       | Plane         |
| `PRIM_TORUS`       | Torus         |
| `PRIM_CAPSULE`     | Capsule       |
| `PRIM_CONE`        | Cone          |
| `PRIM_QUAD_SPHERE` | Quad sphere   |

### Render State (`octane.renderState`) — 5 values

| Constant                   | Description        |
| -------------------------- | ------------------ |
| `RENDER_STATE_NOT_RUNNING` | Engine not active  |
| `RENDER_STATE_RENDERING`   | Actively rendering |
| `RENDER_STATE_RESTARTING`  | Restarting render  |
| `RENDER_STATE_PAUSED`      | Render paused      |
| `RENDER_STATE_ERROR`       | Error state        |

### Render Device State (`octane.renderDeviceState`) — 6 values

| Constant                     | Description       |
| ---------------------------- | ----------------- |
| `DEVICE_STATE_IDLE`          | Not in use        |
| `DEVICE_STATE_RENDERING`     | Rendering         |
| `DEVICE_STATE_LOADING`       | Loading data      |
| `DEVICE_STATE_COMPILING`     | Compiling shaders |
| `DEVICE_STATE_OUT_OF_MEMORY` | Out of GPU memory |
| `DEVICE_STATE_ERROR`         | Device error      |

### Render Error (`octane.renderError`) — 12 values

Codes returned in `PROPS_RENDER_DEVICE.errorCode`.

### Render Job (`octane.renderJobAction`, `octane.renderJobStatus`)

- `renderJobAction` — 4 values: Start, stop, pause, resume
- `renderJobStatus` — 6 values: Idle, running, paused, done, error, cancelled

### Response Curves (`octane.responseCurveId`) — 58 values

Camera response curve presets (Agfacolor, Kodachrome, linear, custom, etc.).

### All Constant Tables (203 total in `octane.octane`)

#### Materials & Shading

| Table                       | Count | Description                    |
| --------------------------- | ----- | ------------------------------ |
| `blendMode`                 | 72    | Blend/compositing modes        |
| `bxDFUniversalModel`        | 7     | Universal material BRDF models |
| `bxDFSpecularModel`         | 6     | Specular BRDF models           |
| `bxDFDiffuseModel`          | 4     | Diffuse BRDF models            |
| `bxDFSheenModel`            | 2     | Sheen BRDF models              |
| `bxDFTranmissionType`       | 4     | Transmission types             |
| `brdfModel`                 | 4     | Legacy BRDF models             |
| `metallicReflectionMode`    | 4     | Metallic reflection modes      |
| `dispersionModel`           | 2     | Dispersion models              |
| `hairMaterialBaseColorMode` | 3     | Hair material color modes      |
| `hairInterpolationType`     | 3     | Hair interpolation types       |
| `decalTextureIndex`         | 10    | Decal texture indices          |
| `sharedSurfaceType`         | 2     | Shared surface types           |

#### Textures & Noise

| Table                      | Count | Description                  |
| -------------------------- | ----- | ---------------------------- |
| `noiseType`                | 5     | Octane noise types           |
| `noiseTypeOsl`             | 4     | OSL noise types              |
| `cinema4dNoiseType`        | 32    | C4D noise types              |
| `fractalNoiseMode`         | 2     | Fractal noise modes          |
| `textureNodeTypeMode`      | 4     | Texture node type modes      |
| `texturePinValueTypeMode`  | 4     | Texture pin value type modes |
| `textureValueType`         | 14    | Texture value types          |
| `falloffTextureMode`       | 3     | Falloff texture modes        |
| `gradientGeneratorType`    | 5     | Gradient generator types     |
| `gradientInterpType`       | 5     | Gradient interpolation types |
| `gradientInterpColorSpace` | 2     | Gradient color space interp  |
| `customCurveMode`          | 6     | Custom curve modes           |
| `proceduralEffectType`     | 21    | Procedural effect types      |
| `colorChannelType`         | 3     | Color channel extraction     |
| `binaryOperation`          | 13    | Binary math operations       |
| `comparisonOperation`      | 6     | Comparison operations        |
| `interpolationType`        | 5     | Interpolation types          |
| `imageType`                | 16    | Image storage types          |
| `imageChannelType`         | 11    | Image channel types          |
| `imageColorType`           | 4     | Image color types            |
| `imageFilterType`          | 2     | Image filter types           |
| `imageMaskSource`          | 12    | Image mask sources           |

#### Geometry & Displacement

| Table                           | Count | Description                     |
| ------------------------------- | ----- | ------------------------------- |
| `primitiveType`                 | 15    | Geo primitive shapes            |
| `displacementDirection`         | 3     | Displacement directions         |
| `displacementLod`               | 7     | Displacement LOD levels         |
| `displacementMapType`           | 2     | Displacement map types          |
| `displacementQuality`           | 2     | Displacement quality            |
| `displacementTextureAxes`       | 3     | Displacement texture axes       |
| `displacementTextureSpace`      | 2     | Displacement texture space      |
| `normalType`                    | 3     | Normal map types                |
| `curvatureModes`                | 3     | Curvature modes                 |
| `geometryImportScale`           | 14    | Import scale presets            |
| `geometryImportObjectLayers`    | 3     | Import object layers            |
| `geometryExportFormat`          | 2     | Export formats (Alembic/FBX)    |
| `gaussianSplatClipMode`         | 3     | Gaussian splat clip modes       |
| `gaussianSplatLightingMode`     | 3     | Gaussian splat lighting         |
| `subDivFVarInterpolateBoundary` | 5     | SubD face-varying interpolation |

#### Scatter

| Table                               | Count | Description                    |
| ----------------------------------- | ----- | ------------------------------ |
| `scatterSurfacePolygonMode`         | 7     | Surface scatter polygon modes  |
| `scatterSurfaceParticleMode`        | 2     | Surface scatter particle modes |
| `scatterSurfaceHairMode`            | 4     | Surface scatter hair modes     |
| `scatterSurfaceReferenceType`       | 2     | Surface scatter reference      |
| `scatterSurfaceTransformType`       | 4     | Surface scatter transform      |
| `scatterSurfaceSelectionMode`       | 3     | Surface scatter selection      |
| `scatterSurfaceOrientationPriority` | 2     | Surface scatter orientation    |
| `scatterVolumeShape`                | 4     | Volume scatter shapes          |
| `scatterVolumeReferenceType`        | 2     | Volume scatter reference       |
| `scatterVolumeTransformType`        | 4     | Volume scatter transform       |
| `scatterVolumeSelectionMode`        | 3     | Volume scatter selection       |
| `scatterVolumeOrientationPriority`  | 2     | Volume scatter orientation     |

#### Volumes

| Table                     | Count | Description           |
| ------------------------- | ----- | --------------------- |
| `volumeInterpolationType` | 3     | Volume interpolation  |
| `volumeSampling`          | 3     | Volume sampling modes |
| `volumeEmissionType`      | 4     | Volume emission types |

#### Rendering & Kernels

| Table                     | Count | Description             |
| ------------------------- | ----- | ----------------------- |
| `renderState`             | 5     | Render engine states    |
| `renderDeviceState`       | 6     | GPU device states       |
| `renderError`             | 12    | Render error codes      |
| `renderJobAction`         | 4     | Render job actions      |
| `renderJobStatus`         | 6     | Render job statuses     |
| `renderLayerMode`         | 4     | Render layer modes      |
| `renderPassId`            | 215   | Render pass/AOV IDs     |
| `renderPassGroupId`       | 12    | Render pass groups      |
| `directLightMode`         | 5     | Direct lighting modes   |
| `lightSampler`            | 3     | Light sampler types     |
| `filterType`              | 3     | Image filter types      |
| `prePassType`             | 2     | Pre-pass types          |
| `infoChannelType`         | 27    | Info channel types      |
| `infoChannelSamplingMode` | 3     | Info sampling modes     |
| `denoiserType`            | 2     | Denoiser types          |
| `denoiserQuality`         | 4     | Denoiser quality levels |

#### Camera & Projection

| Table                           | Count | Description              |
| ------------------------------- | ----- | ------------------------ |
| `universalCamFisheyeProjection` | 4     | Fisheye projection types |
| `stereoMode`                    | 2     | Stereo rendering modes   |
| `iesPhotometryMode`             | 3     | IES photometry modes     |
| `analyticLightType`             | 5     | Analytic light types     |

#### Compositing & Post

| Table                      | Count | Description          |
| -------------------------- | ----- | -------------------- |
| `compositeOperation`       | 17    | Composite operations |
| `compositeAlphaOperation`  | 7     | Composite alpha ops  |
| `blendRegionMask`          | 8     | Blend region masks   |
| `componentPickerOperation` | 6     | Component picker ops |
| `componentType`            | 19    | Component types      |

#### Color & Image Output

| Table                    | Count | Description               |
| ------------------------ | ----- | ------------------------- |
| `colorSpaceConversion`   | 11    | Color space conversions   |
| `colorSpaceCurveType`    | 3     | Color space curve types   |
| `colorPickerSpace`       | 2     | Color picker spaces       |
| `colorPickerBoxDisplay`  | 3     | Color picker display      |
| `outputColorSpaceType`   | 4     | Output color space types  |
| `imageSaveFormat`        | 8     | Image save formats        |
| `imageSaveType`          | 13    | Extended save types       |
| `exrCompressionType`     | 10    | EXR compression modes     |
| `premultipliedAlphaType` | 3     | Premultiplied alpha types |
| `expandContractRgbMode`  | 2     | RGB expand/contract       |
| `responseCurveId`        | 58    | Camera response curves    |

#### AOVs & Passes

| Table                             | Count | Description                 |
| --------------------------------- | ----- | --------------------------- |
| `customAov`                       | 22    | Custom AOV types            |
| `customAovChannel`                | 4     | Custom AOV channels         |
| `customAovSecondaryRayVisibility` | 4     | Custom AOV ray visibility   |
| `globalTexAvo`                    | 21    | Global texture AOV channels |
| `lightAov`                        | 22    | Light AOV types             |
| `cryptomatteType`                 | 10    | Cryptomatte types           |
| `exportAovsType`                  | 3     | AOV export types            |

#### Environment & Daylight

| Table           | Count | Description     |
| --------------- | ----- | --------------- |
| `daylightModel` | 4     | Daylight models |
| `distanceMode`  | 4     | Distance modes  |

#### Transform & Coordinates

| Table                   | Count | Description           |
| ----------------------- | ----- | --------------------- |
| `coordinateAxis`        | 3     | Coordinate axes       |
| `coordinateSystem`      | 4     | Coordinate systems    |
| `borderMode`            | 5     | Texture border modes  |
| `wCoordinateBorderMode` | 4     | W-coordinate border   |
| `channelMapping`        | 10    | Channel mapping modes |
| `channels`              | 2     | Channel types         |
| `channelGroups`         | 3     | Channel groups        |

#### Animation

| Table                        | Count | Description          |
| ---------------------------- | ----- | -------------------- |
| `animationType`              | 3     | Animation types      |
| `animationTimeTransformType` | 1     | Time transform types |

#### Export & Baking

| Table               | Count | Description          |
| ------------------- | ----- | -------------------- |
| `exportState`       | 5     | Export state flags   |
| `bakingTextureType` | 2     | Baking texture types |
| `clayMode`          | 3     | Clay render modes    |
| `asPixelGroupMode`  | 3     | Pixel group modes    |

#### GUI & Events

| Table             | Count | Description             |
| ----------------- | ----- | ----------------------- |
| `eventType`       | 16    | GUI/node event types    |
| `mouseButton`     | 12    | Mouse button IDs        |
| `inputAction`     | 5     | Input action types      |
| `dialogIconType`  | 4     | Dialog icon types       |
| `dialogType`      | 2     | Dialog types            |
| `changeEventType` | 12    | Node change event types |

#### System & Misc

| Table                      | Count | Description                 |
| -------------------------- | ----- | --------------------------- |
| `cacheStatus`              | 4     | Cache status values         |
| `compilationResult`        | 4     | Shader compilation results  |
| `luaScriptType`            | 2     | Lua script types            |
| `moduleType`               | 4     | External module types       |
| `itemDbOrigin`             | 2     | Item database origins       |
| `liveDbThumbnailView`      | 5     | LiveDB thumbnail views      |
| `resourceCategory`         | 8     | Resource categories         |
| `movableInputFormat`       | 14    | Movable input formats       |
| `importRestAttributesMode` | 4     | Import rest attribute modes |

#### GUI Module Constants (`octane.gui.*`)

| Table               | Count | Description                                                                            |
| ------------------- | ----- | -------------------------------------------------------------------------------------- |
| `gui.componentType` | 16    | GUI component types (WINDOW, BUTTON, CHECK_BOX, COMBO_BOX, SLIDER, LABEL, GROUP, etc.) |
| `gui.dialogIcon`    | 4     | Dialog icons (INFO, WARNING, ERROR, QUESTION)                                          |
| `gui.dialogType`    | 2     | Dialog types (OK, OK_CANCEL)                                                           |
| `gui.eventType`     | 16    | GUI events (BUTTON_CLICKED, VALUE_CHANGED, WINDOW_CLOSED, etc.)                        |

#### Matrix Module Constants (`octane.matrix.*`)

| Table                  | Count | Description                                    |
| ---------------------- | ----- | ---------------------------------------------- |
| `matrix.rotationOrder` | 6     | Rotation orders (XYZ, XZY, YXZ, YZX, ZXY, ZYX) |

---

## Properties Tables Reference

Quick lookup for all PROPS\_\* tables by module:

### octane.node

- `PROPS_NODE_ITEM` — name, type, pinCount, pinNames, pinIds, attributeCount, attributeNames, attributeIds, graphOwner, position, time
- `PROPS_ATTRIBUTE_INFO` — id, type, description, isArray, defaultFloats, defaultInts, defaultString, minVersion, endVersion
- `PROPS_PIN_INFO` — id, name, label, type, description, groupName, isDynamic, colour, defaultNodeType, minVersion, endVersion
- `PROPS_NODE_INFO` — type, category, defaultName, description, outputType, pinInfoCount, attributeInfoCount, isLinker, isOutputLinker
- `PROPS_PIN_IDENTIFIER` — Pin identification
- `PROPS_BOOL_PIN_INFO` — Boolean pin properties
- `PROPS_INT_PIN_INFO` — Integer pin properties
- `PROPS_FLOAT_PIN_INFO` — Float pin properties
- `PROPS_ENUM_PIN_INFO` — Enum pin properties
- `PROPS_STRING_PIN_INFO` — String pin properties
- `PROPS_TEXTURE_PIN_INFO` — Texture pin properties
- `PROPS_TRANSFORM_PIN_INFO` — Transform pin properties
- `PROPS_PROJECTION_PIN_INFO` — Projection pin properties
- `PROPS_BIT_MASK_PIN_INFO` — Bit mask pin properties
- `PROPS_OCIO_COLOR_SPACE_PIN_INFO` — OCIO color space pin
- `PROPS_OCIO_LOOK_PIN_INFO` — OCIO look pin
- `PROPS_OCIO_VIEW_PIN_INFO` — OCIO view pin

### octane.nodegraph

- `PROPS_GRAPH_INFO` — type, category, defaultName, description, outputType, attributeInfoCount, isInspectable
- `PROPS_NODE_ITEM` — (same as octane.node)
- `PROPS_ATTRIBUTE_INFO` — (same as octane.node)
- `PROPS_TIMETRANSFORM_LINEAR` — type, delay, speedUp, customIntervalEnabled, customIntervalBegin, customIntervalEnd

### octane.render

- `PROPS_RENDER_START` — renderTargetNode, maxRenderTime, restart, doUpdate, callback, statisticsCallback, bufferType, premultipliedAlphaType
- `PROPS_RENDER_RESULT` — image, samples, maxSamples, blendedSamples, renderTime, samplesSec, changeLevel, renderPassId, hasPendingUpdates
- `PROPS_RENDER_RESULT_STATISTICS` — beautySamplesPerPixel, beautyMaxSamplesPerPixel, beautySamplesPerSecond, renderTime, estimatedRenderTime, size, renderState, bufferType, colorSpace
- `PROPS_RENDER_DEVICE` — name, index, active, supported, computeModel, usedForRendering, usedForDenoising, memory breakdown fields
- `PROPS_RENDER_MEM_USAGE` — totalMemory, usedMemory, freeMemory, outOfCoreMemory, peerToPeer
- `PROPS_RENDER_GEOM_STATS` — meshCount, triangleCount, hairCount, sphereCount, voxelCount, gaussianSplatCount
- `PROPS_RENDER_REGION` — active, regionMin, regionMax, featherWidth
- `PROPS_RENDER_PASS_INFO` — renderPassId, name, shortName, description, exrLayerName, nodeType, isGreyscale, isInfo
- `PROPS_RENDER_PREVIEW` — materialNode, size, maxSamples, objectType, objectSize, crop
- `PROPS_RENDER_PASS_EXPORT` — Render pass export settings
- `PROPS_RENDER_COLOR_SPACE_INFO` — Color space information

### octane.changemanager

- `PROPS_CHANGEMANAGER_OBSERVER` — itemChangeCallback, timeChangeCallback
- `PROPS_ITEM_CHANGE_EVENT` — type, changedItem, changedOwner, changedOwnerPinIx, changedPinIx, changedIndices
- `PROPS_TIME_CHANGE_EVENT` — type, rootGraph

### octane.image

- `PROPS_IMAGE` — size, type, channelCount, bytesPerPixel, bytesPerChannel, byteSize, isHdr, isCompressed, hasColour, hasTransparency
- `INFOS_IMAGE` — Image information
- `INFOS_LAYER` — Layer information
- `PROPS_JPEG_SAVE` — JPEG save options
- `PROPS_EXR_SAVE` — EXR save options
- `PROPS_TIFF_SAVE` — TIFF save options

### octane.gui

- `PROPS_GUI_WINDOW` — Window properties
- `PROPS_GUI_BUTTON` — Button properties
- `PROPS_GUI_CHECK_BOX` — Checkbox properties
- `PROPS_GUI_COMBO_BOX` — ComboBox properties
- `PROPS_GUI_SLIDER` — Slider properties
- `PROPS_GUI_LABEL` — Label properties
- `PROPS_GUI_GROUP` — Group properties
- `PROPS_GUI_TABLE` — Table properties
- `PROPS_GUI_TABS` — Tab container properties
- `PROPS_GUI_PANEL_STACK` — Panel stack properties
- `PROPS_GUI_PROGRESS_BAR` — Progress bar properties
- `PROPS_GUI_BITMAP` — Bitmap properties
- `PROPS_GUI_COLOUR_SWATCH` — Color swatch properties
- `PROPS_GUI_COMPONENT` — Base component properties
- `PROPS_NUMERIC_BOX` — Numeric input properties
- `PROPS_TEXT_EDITOR` — Text editor properties
- `PROPS_DIALOG` — Dialog properties
- `PROPS_FILE_DIALOG` — File dialog properties
- `PROPS_BUTTON_DIALOG` — Button dialog properties

### octane.apiinfo

- `PROPS_NODE_INFO` — type, category, defaultName, description, outputType, pinInfoCount, attributeInfoCount
- `PROPS_GRAPH_INFO` — type, category, defaultName, description, outputType
- `PROPS_PIN_INFO` — id, name, label, type, description, colour, defaultNodeType
- `PROPS_ATTR_INFO` — Attribute metadata
- `PROPS_SYSTEM_INFO` — octaneVersion, os, cpuModel, cpuVendor, cpuNbCores, cpuClockMHz, driverVersion
- `PROPS_NODE_CONFIGURATION` — Node configuration
- `PROPS_NODE_CONFIGURATION_INTERFACE` — Configuration interface
- `PROPS_NODE_CONFIGURATION_PARAMETERS` — Configuration parameters
- `PROPS_TEXTURE_NODE_TYPE_INFO` — Texture node type metadata

### octane.scriptgraph

- `PROPS_BOOL_PIN_INFO` — Boolean scripted graph pin
- `PROPS_INT_PIN_INFO` — Integer scripted graph pin
- `PROPS_FLOAT_PIN_INFO` — Float scripted graph pin
- `PROPS_ENUM_PIN_INFO` — Enum scripted graph pin
- `PROPS_STRING_PIN_INFO` — String scripted graph pin
- `PROPS_TEXTURE_PIN_INFO` — Texture scripted graph pin
- `PROPS_TRANSFORM_PIN_INFO` — Transform scripted graph pin
- `PROPS_PROJECTION_PIN_INFO` — Projection scripted graph pin
- `PROPS_BIT_MASK_PIN_INFO` — Bit mask scripted graph pin
- `PROPS_OCIO_COLOR_SPACE_PIN_INFO` — OCIO color space scripted graph pin
- `PROPS_OCIO_LOOK_PIN_INFO` — OCIO look scripted graph pin
- `PROPS_OCIO_VIEW_PIN_INFO` — OCIO view scripted graph pin

### octane.gridlayout

- `PROPS_GRID_LAYOUT` — Grid layout properties

### octane.file

- `PROPS_SPECIAL_DIRECTORIES` — userHomeDirectory, userDesktopDirectory, userDocumentsDirectory, userScriptDirectory, tempDirectory, currentExecutableFile
- `PROPS_PACKAGE_PATH` — Package path info

### octane.geometryexporter

- `PROPS_GEOMETRY_EXPORTER` — filename, exportFormat, items, exportMaterial, exportAsStingRayMat, fastScatterExport, writeOcsData

### octane.rendercloudmanager

- `PROPS_RENDER_CLOUD_UPLOAD_RESULTS` — Upload results
- `PROPS_RENDER_CLOUD_USER_SUBSCRIPTION_INFO_RESULTS` — Subscription info

### octane.modules

- `PROPS_MODULE_INFO` — Module metadata

### octane.util

- `PROPS_C_ARRAY` — C array wrapper

---

## Script Examples

26 example scripts ship with Octane X, organized by category:

### Animation (5)

| Script                 | ID                       | Description                                       |
| ---------------------- | ------------------------ | ------------------------------------------------- |
| Animated Texture       | `anim-texture`           | Image sequence texture via scripted graph         |
| Animate Value          | `animate-value-sg`       | Float value interpolation scripted graph          |
| Animate Value Stations | `animate-value-stations` | Multi-waypoint float animation (up to 9 stations) |
| Colour Blend           | `colour-blend`           | RGB texture color blend animation with GUI        |
| Yaw Pitch Roll         | `yaw-pitch-roll`         | Camera rotation animation with full GUI           |

### Camera (2)

| Script           | ID             | Description                               |
| ---------------- | -------------- | ----------------------------------------- |
| ABC to Panoramic | `abc-to-pano`  | Convert Alembic camera to panoramic       |
| Ol' Ready Cam    | `ol-ready-cam` | Keyframe camera animation system with GUI |

### Geometry (5)

| Script               | ID                  | Description                     |
| -------------------- | ------------------- | ------------------------------- |
| Connect Group        | `connect-group`     | Group selected meshes           |
| Place Mesh at Camera | `place-mesh`        | Place mesh at camera target     |
| Create Fog Volume    | `create-fog-volume` | Fog cube with GUI               |
| Create Plane         | `create-plane`      | Plane mesh with GUI             |
| Load Instances       | `load-instances`    | Load scatter instances from CSV |

### Environment (4)

| Script               | ID                   | Description                       |
| -------------------- | -------------------- | --------------------------------- |
| Change HDR Per Frame | `change-hdr`         | Animated HDRI per frame           |
| sIBL Loader          | `sibl-loader`        | Load sun+sky from .ibl            |
| sIBL Sun+Sky         | `sibl-sun-sky`       | Load sun+sky settings from sIBL   |
| Visible Background   | `visible-background` | Visible background scripted graph |

### Materials (2)

| Script              | ID                    | Description                 |
| ------------------- | --------------------- | --------------------------- |
| Create Mix Material | `create-mix-material` | Diffuse+glossy mix with GUI |
| Mandelbrot Texture  | `mandelbrot`          | Procedural fractal texture  |

### Batch Render (2)

| Script             | ID                 | Description                  |
| ------------------ | ------------------ | ---------------------------- |
| Batch Render (CLI) | `batch-render-cmd` | Command-line batch rendering |
| Batch Render (GUI) | `batch-render-gui` | GUI batch rendering          |

### Other

| Script                  | ID                    | Category     | Description                   |
| ----------------------- | --------------------- | ------------ | ----------------------------- |
| Merge ABC Materials     | `merge-abc-materials` | Alembic      | Merge duplicate ABC materials |
| Baking Graph Creator    | `baking-graph`        | Baking       | Auto-setup baking workflow    |
| Save Incremental        | `save-incremental`    | File         | Incremental project saves     |
| Application Preferences | `application-prefs`   | General      | Access/modify preferences     |
| Live Texture Painting   | `live-paint`          | Experimental | Interactive texture painting  |
| Simulated Annealing     | `simulated-annealing` | Experimental | Optimization algorithm        |

---

## Script Metadata

Add metadata headers to Lua scripts for integration with Octane's UI:

```lua
-- @author       Your Name
-- @description  What this script does
-- @version      1.0
-- @script-id    unique-script-identifier
-- @shortcut     ALT + S
-- @node-registry-category  |My Scripts|Category|Script Name
```

| Field                     | Usage                              | Context            |
| ------------------------- | ---------------------------------- | ------------------ |
| `@author`                 | Author name(s)                     | All                |
| `@description`            | Short description                  | All                |
| `@version`                | Script version                     | All                |
| `@script-id`              | Unique ID for persistent storage   | Scripts only       |
| `@shortcut`               | Keyboard shortcut (e.g. `ALT + S`) | Scripts only       |
| `@node-registry-category` | Menu path for script graph         | Script graphs only |

---

## Resources

- **Lua 5.3 Reference:** https://www.lua.org/manual/5.3
- **Octane Scripting Forum:** https://render.otoy.com/forum/viewforum.php?f=73
- **Lua Documentation Portal:** https://www.lua.org/docs.html
