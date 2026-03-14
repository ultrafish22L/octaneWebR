# Lua API vs C++ Plugin SDK Review

> Generated 2026-03-12, verified 2026-03-12. Cross-referenced 112 C++ SDK headers (`C:\otoyla\octane\sdk\enterprise\win\render\include\`) against the Lua API (30 modules, 470+ functions) via octane-docs MCP, web research, and per-function verification.

## Overview

The C++ Plugin SDK is a superset of the Lua scripting API. Everything the Lua API can do maps to SDK calls, but the SDK exposes low-level, host-integration, and UI-embedding capabilities that have no Lua equivalent. This document catalogs every SDK-only capability, with corrections noted where initial analysis was wrong.

**Methodology:** Every claim below was double-checked by searching the Lua API MCP for matching functions, modules, constants, and PROPS tables. Where the Lua API has partial coverage, both sides are documented.

---

## 1. Network Rendering — Daemon Farm (`ApiNetRenderManager`)

**SDK header:** `apinetrendermanager.h`

The traditional render-daemon farm subsystem is SDK-only.

| Capability                      | SDK Method                        | Lua Equivalent |
| ------------------------------- | --------------------------------- | -------------- |
| Discover render daemons on LAN  | `discoverDaemons()`               | None           |
| Bind/unbind daemon to engine    | `bindDaemon()` / `unbindDaemon()` | None           |
| Query daemon status             | `getDaemonInfo()`                 | None           |
| Monitor daemon GPU utilization  | `getDaemonDeviceInfo()`           | None           |
| Set daemon priority/weight      | `setDaemonPriority()`             | None           |
| Get farm-wide render statistics | `getFarmStatistics()`             | None           |

**Lua has cloud rendering instead:** `octane.rendercloudmanager` (4 functions) provides RNDR Network cloud rendering — `newRenderTask()`, `uploadCurrentProject()`, `uploadRootNodeGraph()`, `userSubscriptionInfo()`. This is cloud-based (RNDR tokens), not LAN daemon orchestration.

**Impact:** Lua can submit to RNDR cloud but cannot manage a local render farm with daemons.

---

## 2. Structured Logging (`ApiLogManager`)

**SDK header:** `apilogmanager.h`

| Capability              | SDK Method         | Lua Equivalent |
| ----------------------- | ------------------ | -------------- |
| Register log callback   | `setLogCallback()` | None           |
| Set log severity filter | `setLogFlags()`    | None           |
| Query current log level | `getLogFlags()`    | None           |
| Programmatic log output | `log()`            | None           |

**Lua workaround:** `print()` outputs to the scripting console. `octane.gui.updateStatus()` updates the status bar. `octane.gui.showDialog()` can show info/warning/error dialogs. But there is no log-level system, no file logging, and no way to intercept Octane's internal log stream.

**Impact:** Lua cannot do structured logging or capture Octane engine log output.

---

## 3. LiveDB Material Browser (`ApiDBMaterialManager`)

**SDK header:** `apidbmaterialmanager.h`

| Capability                  | SDK Method           | Lua Equivalent |
| --------------------------- | -------------------- | -------------- |
| Browse LiveDB categories    | `getCategories()`    | None           |
| Search materials by keyword | `searchMaterials()`  | None           |
| Download material to scene  | `downloadMaterial()` | None           |
| Get material thumbnail      | `getThumbnail()`     | None           |
| Check online status         | `isConnected()`      | None           |

**Lua has GUI-only access:** `octane.gui.browseForAsset()` opens a blocking browse dialog. Constants `octane.octane.octaneLiveCategory` (5 values) and `octane.octane.liveDbThumbnailView` (5 values) exist. But there is no programmatic query/search/download API.

**Impact:** Lua cannot script LiveDB material search or batch-download assets.

---

## 4. Scene Export — OCS for RNDR (`ApiSceneExporter`)

**SDK header:** `apisceneexporter.h`

| Capability                            | SDK Method       | Lua Equivalent |
| ------------------------------------- | ---------------- | -------------- |
| Get OCS string for RNDR submission    | `getOcsString()` | None           |
| Export with full scene + dependencies | `exportScene()`  | None           |

**~~Correction from initial analysis:~~** The initial review claimed animated export was SDK-only. This was **wrong**. Lua has full animated geometry export:

- `octane.geometryexporter` module with `create()`, `setTimeSampling()`, `writeFrame()`, `addItem()`, `close()`, `makeGraph()`
- Supports Alembic and FBX formats (`octane.geometryExportFormat`, 2 values)
- The `setTimeSampling()` + `writeFrame()` loop pattern enables animated sequences with motion blur

What remains SDK-only is the `ApiSceneExporter` class for generating RNDR-ready OCS payloads with full scene dependency bundling — a different pipeline from geometry export.

**Impact:** Lua can export animated geometry (Alembic/FBX) but cannot generate RNDR OCS scene bundles.

---

## 5. GPU Shared Surface (`ApiSharedSurface`)

**SDK header:** `apisharedsurface.h`

| Capability                       | SDK Method       | Lua Equivalent |
| -------------------------------- | ---------------- | -------------- |
| Create D3D11 shared texture      | `create()`       | None           |
| Map render output to GPU surface | `mapToSurface()` | None           |
| Zero-copy render compositing     | `composite()`    | None           |
| Query surface format/size        | `getInfo()`      | None           |

**Lua note:** `octane.octane.sharedSurfaceType` (2 values) exists as a constant but no functions use it.

**Impact:** Lua cannot do zero-copy GPU render output. Host apps (Unity, Unreal) use this for real-time viewport compositing. This is inherently a host-integration feature.

---

## 6. OCIO Color Management — Config Loading (`ApiOcioConfig`, `ApiOcioConfigLoader`, `ApiOcioContextManager`)

**SDK headers:** `apiocioconfig.h`, `apiocioconfigloader.h`, `apiociocontextmanager.h`

| Capability                   | SDK Method                     | Lua Equivalent |
| ---------------------------- | ------------------------------ | -------------- |
| Load OCIO config from file   | `loadConfig()`                 | None           |
| Query color spaces in config | `getColorSpaces()`             | None           |
| Set active OCIO context      | `setContext()`                 | None           |
| Get display/view transforms  | `getDisplays()` / `getViews()` | None           |
| Async config loading         | `loadConfigAsync()`            | None           |

**~~Correction from initial analysis:~~** The initial review understated Lua's OCIO support. Lua actually has substantial OCIO capabilities:

- **GUI widgets:** `createOcioColorSpaceComboBox()`, `createOcioLookComboBox()`, `createOcioViewComboBox()`
- **Render output:** `PROPS_RENDER_COLOR_SPACE_INFO` with writable fields: `type` (set to `OCIO_COLOR_SPACE` or `OCIO_VIEW`), `ocioColorSpaceName`, `ocioDisplayName`, `ocioViewName`, `ocioLookName`, `ocioUseViewLook`
- **Pin introspection:** `PROPS_OCIO_COLOR_SPACE_PIN_INFO`, `PROPS_OCIO_LOOK_PIN_INFO`, `PROPS_OCIO_VIEW_PIN_INFO`

What remains SDK-only is **loading/switching the OCIO config file itself** and **querying available color spaces programmatically** from the config.

**Impact:** Lua can use OCIO for render output (set color spaces, looks, views by name) but cannot load a different OCIO config or enumerate available spaces from the config file.

---

## 7. Reference Graph / Scene Bounds (`ApiReferenceGraph`)

**SDK header:** `apireferencegraph.h`

| Capability                     | SDK Method             | Lua Equivalent |
| ------------------------------ | ---------------------- | -------------- |
| Get AABB for referenced scenes | `getReferenceBounds()` | None           |
| Query reference hierarchy      | `getReferenceNodes()`  | None           |

**Lua note:** `octane.octane.referenceAABBDisplay` (3 values) is a UI display enum only — no bounds query API.

**Impact:** Lua cannot query world-space bounding boxes for referenced sub-scenes.

---

## 8. VDB Voxel Sampling (`VdbGridSampler`)

**SDK header:** `octanevolume.h`

| Capability                           | SDK Method       | Lua Equivalent |
| ------------------------------------ | ---------------- | -------------- |
| Sample VDB grid at world coordinates | `sample()`       | None           |
| Get grid metadata                    | `getGridInfo()`  | None           |
| Iterate voxels                       | `forEachVoxel()` | None           |

**Lua note:** Constants exist (`octane.octane.vdbGridIds` 8 values, `octane.octane.volumeSampling` 3 values, `octane.octane.volumeInterpolationType` 3 values) but no sampling functions.

**Impact:** Lua cannot read individual voxel values from VDB volumes.

---

## 9. AABB Math Utilities

**SDK header:** `octaneaabb.h`

| Capability                    | SDK Method           | Lua Equivalent |
| ----------------------------- | -------------------- | -------------- |
| Bounding box containment test | `AABB::contains()`   | None           |
| Box-box intersection          | `AABB::intersects()` | None           |
| Transform AABB by matrix      | `AABB::transform()`  | None           |
| Merge bounding boxes          | `AABB::merge()`      | None           |

**Impact:** Lua has no spatial math utilities. Scripts must implement their own.

---

## 10. Render Engine Advanced Controls (`ApiRenderEngine`)

**SDK header:** `apirender.h`

| Capability                     | SDK Method                                    | Lua Equivalent |
| ------------------------------ | --------------------------------------------- | -------------- |
| Scene picking (ray-cast)       | `pick()`                                      | None           |
| Cryptomatte picking            | `pickCryptomatte()`                           | None           |
| White balance picking          | `pickWhiteBalance()`                          | None           |
| Get scene world bounds         | `getSceneBounds()`                            | None           |
| Set render priority            | `setRenderPriority()` / `getRenderPriority()` | None           |
| Set FPS target                 | `setFps()` / `fps()`                          | None           |
| OOC memory limit configuration | `setOocMemoryLimit()`                         | None           |
| GPU headroom management        | `setGpuHeadroom()`                            | None           |
| NVLink peer-to-peer pairs      | `getAvailablePeerToPeerPairs()`               | None           |
| Shared surface compositor      | `createCompositor()`                          | None           |

**~~Correction from initial analysis:~~** Lua has **read-only** OOC memory reporting via `octane.render.getMemoryUsage()` → `PROPS_RENDER_MEM_USAGE` which includes `outOfCoreMemory` (MB), `freeMemory`, `usedMemory`, `totalMemory`, and `peerToPeer`. But there are no Lua functions to _configure_ OOC limits or GPU headroom.

**Lua overlap:** `octane.render` has 56 functions covering start/stop/pause, device management, render passes, image saving, statistics, and memory usage queries. Picking, scene bounds, FPS, priority, OOC configuration, and compositor are SDK-only.

**Impact:** Lua cannot do interactive scene picking, query scene bounds, set FPS targets, or configure OOC memory limits.

---

## 11. Node System Extensions (`ApiItem` / `ApiNode`)

**SDK header:** `apinodesystem.h`

| Capability                          | SDK Method              | Lua Equivalent |
| ----------------------------------- | ----------------------- | -------------- |
| Per-node plugin data (transient)    | `setPluginData()`       | None           |
| Per-node plugin data (persistent)   | `pluginDataStr()`       | None           |
| UI operation flags                  | `setUIOperationFlags()` | None           |
| Create node inside pin              | `createInternal()`      | None           |
| Open OSL editor for node            | `showOslWindow()`       | None           |
| Store node to LocalDB               | `storeToDb()`           | None           |
| ORBX import from streaming callback | `importOrbxStreaming()` | None           |

**~~Corrections from initial analysis:~~**

- **Dirty tracking:** Listed as SDK-only — **WRONG.** Lua has full change observation via `octane.changemanager` (11 functions): `createObserver()`, `observeItem()`, `observeTime()`, `stopItemObserver()`, `update()`. The observer callback receives `PROPS_ITEM_CHANGE_EVENT` with per-attribute/pin granularity and 12 event types (`octane.changeEventType`). This is actually _more flexible_ than the SDK's `attrAreDirty()` polling — it's event-driven.
- **Import from string:** `octane.nodegraph.importFromString()` exists in Lua. Only streaming ORBX import is SDK-only.

**Impact:** Lua cannot attach arbitrary metadata to nodes, create internal pin nodes, store to LocalDB, or stream ORBX imports.

---

## 12. Embeddable UI Panels

**SDK headers:** `apirenderview.h`, `apinodegrapheditor.h`, `apinodeinspector.h`, `apisceneoutliner.h`

| Panel                        | SDK Class            | Lua Equivalent |
| ---------------------------- | -------------------- | -------------- |
| Render viewport (embeddable) | `ApiRenderView`      | None           |
| Node graph editor            | `ApiNodeGraphEditor` | None           |
| Node inspector               | `ApiNodeInspector`   | None           |
| Scene outliner               | `ApiSceneOutliner`   | None           |

**Lua note:** `octane.gui` has 80+ functions for building custom dialogs (buttons, sliders, combo boxes, layouts, etc.) but cannot embed native Octane panels. Lua GUIs are custom-drawn script UIs, not embedded Octane widgets.

**Impact:** Lua scripts cannot embed native Octane viewport/editor panels in custom windows. By design — this is a host-integration feature for DCC plugins.

---

## ~~13. Selection Management~~ — REMOVED

**~~Original claim:~~** Selection was SDK-only.

**WRONG.** Lua has a complete selection API in `octane.project` (18 functions total):

- `octane.project.select()` — add node(s) to selection
- `octane.project.deselect()` — remove node(s) from selection
- `octane.project.getSelection()` — query current selection
- `octane.project.setSelection()` — replace entire selection
- `octane.project.clearSelection()` — clear all selection

The SDK's `ApiSelectionManager` adds **selection change listeners** (`addSelectionListener()`) and **pin-level selection** (`getSelectedPins()`), which Lua lacks. But the core query/set/clear selection workflow is fully available in Lua.

**Remaining SDK-only:** Selection change callbacks and pin-level selection queries.

---

## 13. Workspace Layout (`ApiProjectWorkspace`)

**SDK header:** `apiprojectworkspace.h`

| Capability                 | SDK Method          | Lua Equivalent |
| -------------------------- | ------------------- | -------------- |
| Serialize workspace layout | `saveLayout()`      | None           |
| Restore workspace layout   | `loadLayout()`      | None           |
| Reset to default layout    | `resetLayout()`     | None           |
| Get/set panel visibility   | `setPanelVisible()` | None           |

**Impact:** Lua cannot save/restore workspace layouts.

---

## 14. Threading (`ApiThread`)

**SDK header:** `apithread.h`

| Capability                  | SDK Method             | Lua Equivalent |
| --------------------------- | ---------------------- | -------------- |
| Create background thread    | `createThread()`       | None           |
| Wait/notify synchronization | `wait()` / `notify()`  | None           |
| Marshal to message thread   | `runOnMessageThread()` | None           |
| Thread-safe progress bar    | `setProgressState()`   | None           |

**Lua workaround:** `octane.timer` module provides scheduled callbacks, but they only fire during blocking calls (`octane.render.start()`, `window:showWindow()`). `octane.image.saveAsync()` is the sole async operation. Lua is fundamentally single-threaded.

**Impact:** Lua cannot do background work or thread synchronization.

---

## 15. Plugin Module System

**SDK headers:** `apimodule.h`, `apimoduledata.h`, `apimodulenodegraph.h`

| Capability                      | SDK Method                         | Lua Equivalent |
| ------------------------------- | ---------------------------------- | -------------- |
| Register DLL plugin module      | `registerModule()`                 | None           |
| Add keyboard shortcuts          | `addShortcut()`                    | None           |
| Create toolbar buttons          | `addToolbarButton()`               | None           |
| Persistent module data (binary) | `ApiModuleData::save()` / `load()` | None           |
| Thread-safe progress updates    | `setProgressState()`               | None           |
| Persistent graph save data      | `setSaveData()` / `getSaveData()`  | None           |

**Lua note:** Lua has `octane.scriptgraph` for script-graph assets and `octane.gui` for custom UIs, but cannot register as a native plugin module with keyboard shortcuts and toolbars.

**Impact:** Lua scripts cannot integrate as first-class plugin modules.

---

## 16. Licensing & Authentication

**SDK header:** `apistart.h`

| Capability                  | SDK Method                        | Lua Equivalent |
| --------------------------- | --------------------------------- | -------------- |
| Initialize Octane DLL       | `apiMode_Shared_start()`          | None           |
| Plugin HMAC-SHA256 auth     | `PluginAuthCallbackT`             | None           |
| Activate license            | `apiMode_activate()`              | None           |
| Check activation status     | `apiMode_isActivated()`           | None           |
| Query license expiry        | `apiMode_getExpiryTime()`         | None           |
| SDK build expiration check  | `apiMode_checkSdkExpiration()`    | None           |
| Deactivation callbacks      | `UpdateActivationStatusCallbackT` | None           |
| Open auth management dialog | `apiMode_openAuthManagementDlg()` | None           |
| Check offline mode          | `apiMode_isOffline()`             | None           |

**Impact:** Expected — Lua scripts run inside an already-authenticated Octane instance.

---

## ~~17. Image Buffer Manipulation~~ — REMOVED

**~~Original claim:~~** Per-pixel image access was SDK-only.

**WRONG.** Lua has a comprehensive image module (`octane.image`, 25 functions):

- `getPixel()` / `setPixel()` — per-pixel read/write
- `getRawPixels()` — bulk pixel data access
- `create()` — create new images
- `createFromNode()` — create from texture node
- `fillImageNode()` — write image data into a texture node
- `copyRegion()` — copy rectangular regions between images
- `fill()` — fill with solid color
- `load()` / `save()` / `saveAsync()` — disk I/O
- `applyBoxFilter()` / `applyGaussianFilter()` / `applyLevels()` — image processing
- `calculateMeanSquareError()` — image comparison
- `compress()` / `convert()` — format conversion
- `fromBase64()` — decode base64 to image
- `getImageInfo()` — query dimensions, channels, HDR status, etc.
- `getLayerInfo()` — layer metadata

Combined with `octane.render.grabRenderResult()`, Lua has full pixel-level access to render output.

**No gap here.** The Lua image API is feature-complete for pixel manipulation.

---

## 17. Base64 Encoding

**SDK header:** `apibase64.h`

| Capability                          | SDK Method       | Lua Equivalent                            |
| ----------------------------------- | ---------------- | ----------------------------------------- |
| Base64 encode arbitrary binary data | `base64Encode()` | None                                      |
| Base64 decode arbitrary binary data | `base64Decode()` | `octane.image.fromBase64()` (images only) |

**Lua note:** `octane.image.fromBase64()` decodes base64 strings into image objects specifically. There is no general-purpose base64 encode, and no base64 decode for non-image binary data.

**Impact:** Minor utility gap. Lua can decode base64 images but cannot encode to base64 or handle arbitrary binary data.

---

## Summary Table

| #   | Capability Domain             | SDK Class/Header         | Lua Coverage                                             |
| --- | ----------------------------- | ------------------------ | -------------------------------------------------------- |
| 1   | Network render farm (daemons) | `ApiNetRenderManager`    | **None** (cloud via `rendercloudmanager`)                |
| 2   | Structured logging            | `ApiLogManager`          | **None** (`print()` only)                                |
| 3   | LiveDB programmatic access    | `ApiDBMaterialManager`   | **Minimal** (GUI browse dialog only)                     |
| 4   | OCS scene bundle for RNDR     | `ApiSceneExporter`       | **None** (geometry export is full)                       |
| 5   | GPU shared surface            | `ApiSharedSurface`       | **None**                                                 |
| 6   | OCIO config loading/query     | `ApiOcio*` (3 classes)   | **Partial** (output color spaces yes, config loading no) |
| 7   | Reference graph / bounds      | `ApiReferenceGraph`      | **None**                                                 |
| 8   | VDB voxel sampling            | `VdbGridSampler`         | **None**                                                 |
| 9   | AABB math                     | `AABB`                   | **None**                                                 |
| 10  | Render engine advanced        | `ApiRenderEngine`        | **Partial** (no picking, bounds, FPS, OOC config)        |
| 11  | Node plugin data / internals  | `ApiItem` / `ApiNode`    | **Partial** (no plugin data, createInternal, storeToDb)  |
| 12  | Embeddable UI panels          | `ApiRenderView` + 3 more | **None** (by design)                                     |
| 13  | Workspace layout              | `ApiProjectWorkspace`    | **None**                                                 |
| 14  | Threading                     | `ApiThread`              | **None** (single-threaded Lua)                           |
| 15  | Plugin module system          | `ApiModule*` (3 classes) | **None** (by design)                                     |
| 16  | Licensing / auth              | `apistart.h`             | **None** (by design)                                     |
| 17  | Base64 (general purpose)      | `apibase64.h`            | **Minimal** (image decode only)                          |

### Corrections Log

These items were listed as SDK-only in the initial analysis but are **actually available in Lua**:

| Originally Claimed SDK-Only | Actual Lua API                                                                    | Status                                                    |
| --------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Selection management        | `octane.project.select/deselect/getSelection/setSelection/clearSelection`         | **Full** (SDK adds listeners + pin selection)             |
| Dirty / change tracking     | `octane.changemanager` observer system, 12 event types, per-attribute granularity | **Full** (event-driven, arguably better than SDK polling) |
| Per-pixel image access      | `octane.image.getPixel/setPixel/getRawPixels` + 20 more functions                 | **Full**                                                  |
| Animated geometry export    | `octane.geometryexporter.setTimeSampling/writeFrame` (Alembic/FBX)                | **Full**                                                  |
| OOC memory query            | `octane.render.getMemoryUsage()` → `outOfCoreMemory` field                        | **Read-only** (config is SDK-only)                        |
| OCIO render output          | `PROPS_RENDER_COLOR_SPACE_INFO` with OCIO fields                                  | **Partial** (use yes, config loading no)                  |
| Base64 decode (images)      | `octane.image.fromBase64()`                                                       | **Partial** (images only)                                 |

### By Severity (corrected)

**High impact (core rendering/pipeline gaps):**

- Scene picking (ray-cast, cryptomatte, white balance) — no Lua equivalent
- Scene world bounds query — no Lua equivalent
- Network render farm orchestration — Lua has cloud only, not LAN daemons
- OCS scene bundle generation for RNDR — no Lua equivalent

**Medium impact (integration/workflow gaps):**

- OCIO config loading/switching — Lua can use OCIO but not change configs
- LiveDB programmatic search/download — GUI dialog only
- OOC memory configuration — Lua can read but not set
- VDB voxel sampling — constants exist but no functions
- FPS / render priority controls — not exposed

**Low impact (host-plugin or utility gaps):**

- Threading (Lua is single-threaded by design)
- Plugin module registration (DLL plugins only)
- Workspace layout save/restore
- Embeddable UI panels (host integration)
- Licensing/auth (runs inside Octane)
- AABB math, base64 encode
- Node plugin data, createInternal, storeToDb

### What Lua Does Well (no SDK advantage)

These areas have **full parity** or are **Lua-only**:

- Node creation, connection, attribute get/set (40+ functions)
- Render start/stop/pause, device management, render passes (56 functions)
- Image pixel access, processing, format conversion (25 functions)
- Scene graph traversal and manipulation
- Selection query/set/clear (5 functions)
- Change observation with per-attribute callbacks (11 functions)
- Animated geometry export with time sampling (Alembic/FBX)
- Project load/save/reset (18 functions)
- GUI construction (80+ widget functions)
- MaterialX import/query
- Cloud rendering (RNDR upload + task creation)
- File system operations (`octane.file`)
- JSON encode/decode (`octane.json`)
- Script graph assets and settings groups
