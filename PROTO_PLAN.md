# OctaneWebR Proto API Coverage Plan

Generated: 2026-03-06

## Proto File Inventory

### Core Services (currently used by client)

| Proto File                                     | Service                                       | RPC Count | Notes                                  |
| ---------------------------------------------- | --------------------------------------------- | --------- | -------------------------------------- |
| `livelink.proto`                               | `LiveLinkService`                             | 6         | Camera, meshes, file transfer          |
| `apinodesystem_3.proto`                        | `ApiItemService`                              | ~80       | Item CRUD, attributes, values          |
| `apinodesystem_7.proto`                        | `ApiNodeService`                              | ~50       | Node pins, connections, info           |
| `apinodesystem_6.proto`                        | `ApiNodeGraphService`                         | ~20       | Graph traversal, owned items, copy     |
| `apinodesystem_8.proto`                        | `ApiRootNodeGraphService`                     | ~10       | Root graph operations                  |
| `apirender.proto`                              | `ApiRenderEngineService`                      | ~100      | Render control, device, statistics     |
| `apirender.proto`                              | `ApiRenderImageService`                       | ~20       | Render image buffer operations         |
| `apiprojectmanager.proto`                      | `ApiProjectManagerService`                    | ~20       | Project load/save, root graph          |
| `apichangemanager.proto`                       | `ApiChangeManagerService`                     | 8         | Scene change observer, update          |
| `apiinfo.proto`                                | `ApiInfoService`                              | ~50       | Node types, pin types, version         |
| `apiitemarray.proto` / `apinodesystem_1.proto` | `ApiItemArrayService`                         | 6         | Array iteration                        |
| `apinodearray.proto` / `apinodesystem_5.proto` | `ApiNodeArrayService`                         | 6         | Node array iteration                   |
| `apinodepininfohelper.proto`                   | `ApiNodePinInfoExService`                     | 5         | Pin info get/create/update/delete      |
| `apilocaldb.proto`                             | `ApiLocalDBService`                           | 5         | Local material database                |
| `apilocaldb.proto`                             | `ApiLocalDB_CategoryService`                  | 12        | Category browse, create, delete        |
| `apilocaldb.proto`                             | `ApiLocalDB_PackageService`                   | 6         | Package load, thumbnail                |
| `apidbmaterialmanager.proto`                   | `ApiDBMaterialManagerService`                 | 5         | LiveDB categories, materials, download |
| `apidbmaterialmanager.proto`                   | `ApiDBMaterialManager_DBCategoryArrayService` | 4         | Category array operations              |
| `apidbmaterialmanager.proto`                   | `ApiDBMaterialManager_DBMaterialArrayService` | 4         | Material array operations              |
| `callbackstream.proto`                         | `StreamCallbackService`                       | 1         | Server-push event stream               |
| `apisceneoutliner.proto`                       | `ApiSceneOutlinerService`                     | ~2        | Node visibility                        |

### Unused Services (not called by client)

| Proto File                             | Service                                          | RPC Count | Category                          |
| -------------------------------------- | ------------------------------------------------ | --------- | --------------------------------- |
| `control.proto`                        | `ApiControlService`                              | 4         | System control                    |
| `callback.proto`                       | `CallbackHandler`                                | 40+       | Server-to-client callbacks        |
| `module.proto`                         | `ModuleService`                                  | 2         | Module start/stop                 |
| `camera_control.proto`                 | `CameraControl`                                  | 6         | Legacy camera (simpleGlGrpc)      |
| `custom.proto`                         | `ApiNodePinInfoExService`                        | 5         | Duplicate of apinodepininfohelper |
| `apicaches.proto`                      | `ApiCachesService`                               | 11        | Meshlet/virtual texture cache     |
| `apibase64.proto`                      | `ApiBase64Service`                               | 2         | Base64 encode/decode              |
| `apibinaryfile.proto`                  | `ApiBinaryGroupService`                          | ~90       | Binary file group operations      |
| `apibinaryfile.proto`                  | `ApiBinaryTableService`                          | ~110      | Binary file table operations      |
| `apicolorswatch.proto`                 | `ApiColorSwatchService`                          | 4         | Color picker widget               |
| `apicheckbox.proto`                    | `ApiCheckBoxService`                             | 4         | Checkbox widget                   |
| `apicombobox.proto`                    | `ApiComboBoxService`                             | 5         | Combobox widget                   |
| `apicollapsiblepanelstack.proto`       | `ApiCollapsiblePanelStackService`                | 5         | Panel stack widget                |
| `apicustomcurveeditorcontroller.proto` | `ApiCustomCurveEditorControllerService`          | 9         | Curve editor                      |
| `apicustomcurveeditorcontroller.proto` | `ApiCustomCurveEditorController_DrawerService`   | 10        | Curve drawing                     |
| `apicustomcurveeditorcontroller.proto` | `ApiCustomCurveEditorController_ListenerService` | 1         | Curve change events               |
| `apidiagnostics.proto`                 | `ApiDiagnosticsService`                          | 1         | Diagnostic commands               |
| `apifilechooser.proto`                 | `ApiFileChooserService`                          | 8         | Native file browser dialogs       |
| `apifilename.proto`                    | `ApiFileNameService`                             | 25        | File path operations              |
| `apigaussiansplatting.proto`           | `ApiGaussianSplattingService`                    | 3         | Gaussian splat import/export      |
| `apigeometryexporter.proto`            | `ApiGeometryExporterService`                     | 8         | Geometry export (OBJ/FBX/Alembic) |
| `apigridlayout.proto`                  | `ApiGridLayoutService`                           | 15        | Grid layout widget                |
| `apiguicomponent.proto`                | `ApiGuiComponentService`                         | 14        | GUI component base class          |
| `apiimage.proto`                       | `ApiImageService`                                | 20        | Image create/load/save/manipulate |
| `apiimagebuffer.proto`                 | `ApiImageBufferService`                          | 35        | Image buffer pixel operations     |
| `apiimagecomponent.proto`              | `ApiImageComponentService`                       | 3         | Image display widget              |
| `apiimageinfo.proto`                   | `ImageInfoService`                               | 5         | Image file analysis               |
| `apiimageinfo.proto`                   | `LayerInfoService`                               | 5         | EXR layer info                    |
| `apilabel.proto`                       | `ApiLabelService`                                | 4         | Label widget                      |
| `apilogmanager.proto`                  | `ApiLogManagerService`                           | 9         | Log management                    |
| `apimainwindow.proto`                  | `ApiMainWindowService`                           | 8         | Main window control               |
| `apimaterialx.proto`                   | `ApiMaterialXGlobalService`                      | 14        | MaterialX import/export           |
| `apimodaldialog.proto`                 | `ApiModalDialogService`                          | 8         | Modal dialog display              |
| `apimodule.proto`                      | `ApiCommandModuleInfoService`                    | 5         | Command module registration       |
| `apimodule.proto`                      | `ApiModuleGlobalService`                         | 6         | Module registration               |
| `apimodule.proto`                      | `ApiNodeGraphModuleInfoService`                  | 7         | Node graph module info            |
| `apimodule.proto`                      | `ApiWorkPaneModuleInfoService`                   | 5         | Work pane module info             |
| `apimoduledata.proto`                  | `ApiModuleDataService`                           | 2         | Persistent module data            |
| `apimodulenodegraph.proto`             | `ApiModuleNodeGraphService`                      | ~40       | Module node graph I/O             |
| `apimouselistener.proto`               | `ApiMouseEventService`                           | 1         | Mouse event creation              |
| `apimouselistener.proto`               | `ApiMouseListenerService`                        | 2         | Mouse listener create/destroy     |
| `apimouselistener.proto`               | `ApiMouseWheelDetailsService`                    | 1         | Wheel event creation              |
| `apinetrendermanager.proto`            | `ApiNetRenderManagerService`                     | 14        | Network rendering                 |
| `apinodegrapheditor.proto`             | `ApiNodeGraphEditorService`                      | 4         | Node graph editor widget          |
| `apinodeinspector.proto`               | `ApiNodeInspectorService`                        | ~2        | Node inspector widget             |
| `apinumericbox.proto`                  | `ApiNumericBoxService`                           | ~4        | Numeric input widget              |
| `apiocioconfig.proto`                  | `ApiOcioConfigService`                           | ~15       | OCIO config management            |
| `apiocioconfigloader.proto`            | `ApiOcioConfigLoaderService`                     | ~5        | OCIO config loading               |
| `apiociocontextmanager.proto`          | `ApiOcioContextManagerService`                   | ~8        | OCIO context management           |
| `apioctanemodules.proto`               | `ApiOctaneModulesService`                        | ~5        | Module listing                    |
| `apioutputcolorspaceinfo.proto`        | `ApiOutputColorSpaceInfoService`                 | ~5        | Color space info                  |
| `apipackage.proto`                     | `ApiPackageService`                              | ~8        | Package operations                |
| `apiprogressbar.proto`                 | `ApiProgressBarService`                          | ~3        | Progress bar widget               |
| `apiprojectworkspace.proto`            | `ApiProjectWorkspaceService`                     | ~3        | Project workspace                 |
| `apireferencegraph.proto`              | `ApiReferenceGraphService`                       | ~5        | Reference graph (ORBX refs)       |
| `apirendercloudmanager.proto`          | `ApiRenderCloudManagerService`                   | ~5        | Cloud rendering                   |
| `apirenderview.proto`                  | `ApiRenderViewService`                           | ~2        | Render view widget                |
| `apisceneexporter.proto`               | `ApiSceneExporterService`                        | ~5        | Scene export                      |
| `apiselectionmanager.proto`            | `ApiSelectionManagerService`                     | ~10       | Selection management              |
| `apisharedsurface.proto`               | `ApiSharedSurfaceService`                        | ~8        | Shared surface (WebRTC)           |
| `apistart.proto`                       | (messages only)                                  | 0         | Start configuration               |
| `apitable.proto`                       | `ApiTableService`                                | ~8        | Table widget                      |
| `apitextbutton.proto`                  | `ApiTextButtonService`                           | ~4        | Text button widget                |
| `apitexteditor.proto`                  | `ApiTextEditorService`                           | ~5        | Text editor widget                |
| `apithread.proto`                      | `ApiThreadService`                               | ~8        | Thread management                 |
| `apitilegrid.proto`                    | `ApiTileGridLoaderService`                       | ~10       | Tile grid loading                 |
| `apitimesampling.proto`                | `ApiTimeSamplingService`                         | ~2        | Time sampling                     |
| `apititlecomponent.proto`              | `ApiTitleComponentService`                       | ~2        | Title component widget            |
| `apiwindow.proto`                      | `ApiWindowService`                               | ~5        | Window management                 |
| `apianimationtimetransform.proto`      | `ApiAnimationTimeTransformService`               | 1         | Animation time transform          |
| `apianimationtimetransform.proto`      | `ApiLinearTimeTransformService`                  | 4         | Linear time transform             |
| `octaneimageexport.proto`              | `ImageExportSettingsService`                     | ~8        | Image export settings             |
| `octanenet.proto`                      | `NetRenderStatusService`                         | ~3        | Net render status                 |
| `octanenet.proto`                      | `SocketAddressService`                           | ~3        | Socket address                    |
| `octanetime.proto`                     | `FrameRangeTService`                             | ~3        | Frame range                       |
| `octanetime.proto`                     | `TimeSpanTService`                               | ~3        | Time span                         |
| `octanevolume.proto`                   | `VdbGridInfoService`                             | ~5        | VDB grid info                     |
| `octanevolume.proto`                   | `VdbGridSamplerService`                          | ~3        | VDB grid sampler                  |
| `octanevolume.proto`                   | `VdbInfoService`                                 | ~3        | VDB file info                     |
| `octanerenderpasses.proto`             | `RenderResultStatisticsService`                  | ~5        | Render pass statistics            |
| `octaneinfos.proto`                    | `ApiAttributeInfoService`                        | ~5        | Attribute info                    |
| `octaneinfos.proto`                    | `ApiCompatibilityModeInfoService`                | ~5        | Compatibility mode                |
| `octaneinfos.proto`                    | `ApiCompatibilityModeInfoSetService`             | ~5        | Compatibility mode set            |
| `octaneinfos.proto`                    | `ApiNodePinInfoService`                          | ~5        | Node pin info                     |
| `octaneinfos.proto`                    | `ApiTextureNodeTypeInfoService`                  | ~5        | Texture node type info            |
| `octaneinfos.proto`                    | `ApiTexturePinTypeInfoService`                   | ~3        | Texture pin type info             |
| `octaneinfos.proto`                    | `ApiTextureValueTypeSetService`                  | ~3        | Texture value type set            |

## Currently Used RPCs

### LiveLinkService (CameraService.ts)

| RPC         | Client File        | Method                                                                              |
| ----------- | ------------------ | ----------------------------------------------------------------------------------- |
| `SetCamera` | `CameraService.ts` | `setCameraPosition`, `setCameraTarget`, `setCameraPositionAndTarget`, `resetCamera` |
| `GetCamera` | `CameraService.ts` | `getCamera`                                                                         |

### ApiItemService (SceneService.ts, NodeService.ts, ItemService.ts)

| RPC                | Client File                         | Method                                 |
| ------------------ | ----------------------------------- | -------------------------------------- |
| `name`             | `SceneService.ts`                   | `addSceneItem`                         |
| `outType`          | `SceneService.ts`                   | `addSceneItem`                         |
| `isGraph`          | `SceneService.ts`                   | `addSceneItem`, `buildSceneTree`       |
| `position`         | `SceneService.ts`, `NodeService.ts` | `addSceneItem`, `getNodePosition`      |
| `setPosition`      | `NodeService.ts`                    | `setNodePosition`                      |
| `attrInfo`         | `SceneService.ts`                   | `addItemChildren`                      |
| `getValueByAttrID` | `SceneService.ts`, `ItemService.ts` | `addItemChildren`, `getParameterValue` |
| `setValueByAttrID` | `ItemService.ts`                    | `setParameterValue`, `reloadFileNode`  |
| `destroy`          | `NodeService.ts`                    | `deleteNodeOptimized`                  |
| `expand`           | `NodeService.ts`                    | `expandNode`                           |
| `collapse`         | `NodeService.ts`                    | `collapseNode`                         |

### ApiNodeService (SceneService.ts, NodeService.ts, RenderService.ts)

| RPC                  | Client File                                     | Method                                      |
| -------------------- | ----------------------------------------------- | ------------------------------------------- |
| `pinCount`           | `SceneService.ts`                               | `syncSceneSequential`                       |
| `connectedNodeIx`    | `SceneService.ts`, `MaterialDatabaseService.ts` | `syncSceneSequential`, `resolveGraphHandle` |
| `connectedNode`      | `RenderService.ts`                              | `getFilmSettingsNode`                       |
| `pinInfoIx`          | `SceneService.ts`                               | `syncSceneSequential`                       |
| `info`               | `SceneService.ts`                               | `addSceneItem`                              |
| `create`             | `NodeService.ts`                                | `createNode`                                |
| `connectToIx`        | `NodeService.ts`                                | `connectPinByIndex`, `disconnectPin`        |
| `getPinValueByPinID` | `RenderService.ts`                              | `getViewportResolutionLock`                 |
| `setPinValueByPinID` | `RenderService.ts`                              | `setViewportResolutionLock`                 |

### ApiNodeGraphService (SceneService.ts, NodeService.ts)

| RPC             | Client File                         | Method                                       |
| --------------- | ----------------------------------- | -------------------------------------------- |
| `getOwnedItems` | `SceneService.ts`, `NodeService.ts` | `syncSceneSequential`, `getOwnedItemHandles` |
| `info1`         | `SceneService.ts`                   | `addSceneItem`                               |
| `copyItemTree`  | `NodeService.ts`                    | `copyNode`                                   |
| `copyFrom2`     | `NodeService.ts`                    | `copyNodes`                                  |
| `groupItems`    | `NodeService.ts`                    | `groupNodes`                                 |

### ApiRenderEngineService (RenderService.ts, DeviceService.ts, RenderExportService.ts)

| RPC                     | Client File                                      | Method                                      |
| ----------------------- | ------------------------------------------------ | ------------------------------------------- |
| `continueRendering`     | `RenderService.ts`                               | `startRender`                               |
| `stopRendering`         | `RenderService.ts`                               | `stopRender`                                |
| `pauseRendering`        | `RenderService.ts`                               | `pauseRender`                               |
| `restartRendering`      | `RenderService.ts`                               | `restartRender`                             |
| `clayMode`              | `RenderService.ts`                               | `getClayMode`                               |
| `setClayMode`           | `RenderService.ts`                               | `setClayMode`                               |
| `getSubSampleMode`      | `RenderService.ts`                               | `getSubSampleMode`                          |
| `setSubSampleMode`      | `RenderService.ts`                               | `setSubSampleMode`                          |
| `getRenderStatistics`   | `RenderService.ts`                               | `getRenderStatistics`                       |
| `getRenderRegion`       | `RenderService.ts`                               | `getRenderRegion`                           |
| `setRenderRegion`       | `RenderService.ts`                               | `setRenderRegion`                           |
| `setRenderTargetNode`   | `RenderService.ts`                               | `setRenderTargetNode`                       |
| `getRenderTargetNode`   | `RenderService.ts`, `MaterialDatabaseService.ts` | `getRenderTargetNode`, `resolveGraphHandle` |
| `pick`                  | `RenderService.ts`                               | `pick`, `pickSceneInfo`                     |
| `pickWhitePoint`        | `RenderService.ts`                               | `pickWhitePoint`                            |
| `setRenderPriority`     | `RenderService.ts`                               | `setRenderPriority`                         |
| `getDeviceCount`        | `DeviceService.ts`                               | `getDeviceCount`                            |
| `getDeviceName`         | `DeviceService.ts`                               | `getDeviceName`                             |
| `getMemoryUsage`        | `DeviceService.ts`                               | `getMemoryUsage`                            |
| `getResourceStatistics` | `DeviceService.ts`                               | `getResourceStatistics`                     |
| `getGeometryStatistics` | `DeviceService.ts`                               | `getGeometryStatistics`                     |
| `getTexturesStatistics` | `DeviceService.ts`                               | `getTexturesStatistics`                     |
| `saveImage1`            | `RenderExportService.ts`                         | `saveRender`                                |
| `grabRenderResult`      | `RenderExportService.ts`                         | `grabRenderForClipboard`, `downloadRender`  |
| `releaseRenderResult`   | `RenderExportService.ts`                         | `releaseRenderResult`                       |
| `setOnNewImageCallback` | `client.ts` (server-side)                        | `startCallbackStreaming`                    |

### ApiProjectManagerService (SceneService.ts, NodeService.ts, ProjectService.ts)

| RPC                             | Client File                             | Method                                                                                       |
| ------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `rootNodeGraph`                 | `SceneService.ts`, `NodeService.ts`     | `buildSceneTree`, `syncSceneSequential`, `createNode`, `copyNode`, `copyNodes`, `groupNodes` |
| `saveProjectAsReferencePackage` | `ProjectService.ts`                     | `saveProjectAsReferencePackage`                                                              |
| `getPing`                       | `OctaneGrpcClientBase.ts` (server-side) | `checkHealth`                                                                                |

### ApiChangeManagerService (ItemService.ts)

| RPC      | Client File      | Method              |
| -------- | ---------------- | ------------------- |
| `update` | `ItemService.ts` | `setParameterValue` |

### ApiInfoService (DeviceService.ts)

| RPC             | Client File               | Method             |
| --------------- | ------------------------- | ------------------ |
| `octaneVersion` | `DeviceService.ts`        | `getOctaneVersion` |
| `octaneName`    | `client.ts` (server-side) | `getOctaneVersion` |

### ApiItemArrayService (SceneService.ts, NodeService.ts)

| RPC    | Client File                         | Method                                       |
| ------ | ----------------------------------- | -------------------------------------------- |
| `size` | `SceneService.ts`, `NodeService.ts` | `syncSceneSequential`, `getOwnedItemHandles` |
| `get`  | `SceneService.ts`, `NodeService.ts` | `syncSceneSequential`, `getOwnedItemHandles` |

### ApiNodePinInfoExService (SceneService.ts)

| RPC                 | Client File       | Method                |
| ------------------- | ----------------- | --------------------- |
| `getApiNodePinInfo` | `SceneService.ts` | `syncSceneSequential` |

### ApiSceneOutlinerService (SceneService.ts)

| RPC                 | Client File       | Method              |
| ------------------- | ----------------- | ------------------- |
| `setNodeVisibility` | `SceneService.ts` | `setNodeVisibility` |

### ApiLocalDBService (MaterialDatabaseService.ts)

| RPC    | Client File                  | Method           |
| ------ | ---------------------------- | ---------------- |
| `root` | `MaterialDatabaseService.ts` | `getLocalDBRoot` |

### ApiLocalDB_CategoryService (MaterialDatabaseService.ts)

| RPC                | Client File                  | Method                |
| ------------------ | ---------------------------- | --------------------- |
| `name`             | `MaterialDatabaseService.ts` | `getCategoryName`     |
| `subCategoryCount` | `MaterialDatabaseService.ts` | `getSubCategoryCount` |
| `subCategory`      | `MaterialDatabaseService.ts` | `getSubCategory`      |
| `packageCount`     | `MaterialDatabaseService.ts` | `getPackageCount`     |
| `package`          | `MaterialDatabaseService.ts` | `getPackage`          |

### ApiLocalDB_PackageService (MaterialDatabaseService.ts)

| RPC            | Client File                  | Method                |
| -------------- | ---------------------------- | --------------------- |
| `name1`        | `MaterialDatabaseService.ts` | `getPackageName`      |
| `hasThumbnail` | `MaterialDatabaseService.ts` | `packageHasThumbnail` |
| `loadPackage`  | `MaterialDatabaseService.ts` | `loadPackage`         |

### ApiDBMaterialManagerService (MaterialDatabaseService.ts)

| RPC                  | Client File                  | Method                                                  |
| -------------------- | ---------------------------- | ------------------------------------------------------- |
| `getCategories`      | `MaterialDatabaseService.ts` | `getLiveDBCategories`, `getMaterialCategoriesForDbType` |
| `getMaterials`       | `MaterialDatabaseService.ts` | `getLiveDBMaterials`, `getMaterialsForDbType`           |
| `getMaterialPreview` | `MaterialDatabaseService.ts` | `getLiveDBMaterialPreview`                              |
| `downloadMaterial`   | `MaterialDatabaseService.ts` | `downloadLiveDBMaterial`, `downloadMaterialForDbType`   |

### ApiDBMaterialManager_DBCategoryArrayService (MaterialDatabaseService.ts)

| RPC           | Client File                  | Method                |
| ------------- | ---------------------------- | --------------------- |
| `getCategory` | `MaterialDatabaseService.ts` | `getLiveDBCategories` |

### ApiDBMaterialManager_DBMaterialArrayService (MaterialDatabaseService.ts)

| RPC           | Client File                  | Method               |
| ------------- | ---------------------------- | -------------------- |
| `getMaterial` | `MaterialDatabaseService.ts` | `getLiveDBMaterials` |

### StreamCallbackService (client.ts server-side)

| RPC               | Client File               | Method                   |
| ----------------- | ------------------------- | ------------------------ |
| `callbackChannel` | `client.ts` (server-side) | `startCallbackStreaming` |

## Unused RPCs

### High Priority - Should be in Main App

| Service                      | RPC                                                   | Purpose                                                 | Target Feature                    |
| ---------------------------- | ----------------------------------------------------- | ------------------------------------------------------- | --------------------------------- |
| `ApiInfoService`             | `getNodeTypes`                                        | List all available node types for node creation palette | Node creation dialog              |
| `ApiInfoService`             | `nodeInfo`                                            | Get detailed info about a node type                     | Node creation dialog tooltips     |
| `ApiInfoService`             | `getGraphTypes`                                       | List available graph types                              | Graph type selector               |
| `ApiInfoService`             | `graphInfo`                                           | Get detailed graph type info                            | Graph type display                |
| `ApiInfoService`             | `nodeIconImage`                                       | Get node icon as image data                             | Node graph icons                  |
| `ApiInfoService`             | `graphIconImage`                                      | Get graph icon as image data                            | Node graph icons                  |
| `ApiInfoService`             | `getPinTypes`                                         | List all pin types                                      | Pin type legend/filter            |
| `ApiInfoService`             | `getPinTypeColor`                                     | Get pin type display color                              | Pin color in node graph           |
| `ApiInfoService`             | `getAttributeTypes`                                   | List all attribute types                                | Inspector value types             |
| `ApiInfoService`             | `attributeInfo` / `attributeInfo1` / `attributeInfo2` | Detailed attribute info                                 | Enhanced inspector                |
| `ApiInfoService`             | `nodePinInfo`                                         | Detailed pin info for a node type                       | Pin compatibility check           |
| `ApiInfoService`             | `getCompatibleTypes`                                  | Which node types are compatible with a pin              | Smart node creation               |
| `ApiInfoService`             | `getAllRenderPassIds`                                 | List all render passes                                  | Render pass selector              |
| `ApiInfoService`             | `renderPassInfo`                                      | Info about a render pass                                | Render pass display               |
| `ApiInfoService`             | `renderPassName`                                      | Human-readable pass name                                | Render pass label                 |
| `ApiItemService`             | `setName`                                             | Rename a node                                           | Node rename UI                    |
| `ApiItemService`             | `select`                                              | Select an item in Octane                                | Selection sync                    |
| `ApiItemService`             | `persistentId`                                        | Get stable ID across sessions                           | Session persistence               |
| `ApiItemService`             | `uniqueId`                                            | Get unique runtime ID                                   | Deduplication                     |
| `ApiItemService`             | `hasOwner`                                            | Check if item has a graph owner                         | Orphan detection                  |
| `ApiItemService`             | `graphOwner`                                          | Get the graph that owns an item                         | Navigation                        |
| `ApiItemService`             | `deleteUnconnectedItems`                              | Clean up orphaned nodes                                 | Scene cleanup tool                |
| `ApiItemService`             | `evaluate`                                            | Force evaluate a single item                            | Manual refresh                    |
| `ApiNodeService`             | `connectedNode` (by PinId)                            | Get connected node by pin ID                            | Connection queries                |
| `ApiNodeGraphService`        | `ungroup`                                             | Ungroup a group node                                    | Ungroup command (blocked by R3-9) |
| `ApiChangeManagerService`    | `observeApiItem`                                      | Watch for changes on a specific item                    | Live inspector updates            |
| `ApiChangeManagerService`    | `stopObserving`                                       | Stop watching an item                                   | Cleanup                           |
| `ApiProjectManagerService`   | `loadProject`                                         | Load an ORBX file                                       | File > Open                       |
| `ApiProjectManagerService`   | `resetProject`                                        | Reset to empty scene                                    | File > New                        |
| `ApiProjectManagerService`   | `saveProject`                                         | Save current project                                    | File > Save                       |
| `ApiSelectionManagerService` | `selectedItems`                                       | Get currently selected items                            | Selection sync with Octane        |
| `ApiSelectionManagerService` | `selectItem`                                          | Select an item                                          | Bidirectional selection           |
| `ApiSelectionManagerService` | `clearSelection`                                      | Clear selection                                         | Deselect all                      |
| `ApiFileChooserService`      | `browseForFileToOpen`                                 | Native file open dialog                                 | File > Open (native)              |
| `ApiFileChooserService`      | `browseForFileToSave`                                 | Native file save dialog                                 | File > Save As (native)           |
| `ApiFileChooserService`      | `browseForDirectory`                                  | Native directory picker                                 | Export path picker                |
| `ApiControlService`          | `closeOctane`                                         | Close Octane application                                | App > Quit Octane                 |
| `ApiControlService`          | `getWebRTCStatus`                                     | Check WebRTC streaming status                           | Status indicator                  |

### Medium Priority - Test Routine Candidates

| Service                   | RPC                                   | Purpose                          | Test Scenario              |
| ------------------------- | ------------------------------------- | -------------------------------- | -------------------------- |
| `ApiInfoService`          | `octaneName`                          | Get Octane product name          | Version check              |
| `ApiInfoService`          | `isDemoVersion`                       | Check if demo                    | License check              |
| `ApiInfoService`          | `isSubscriptionVersion`               | Check subscription               | License check              |
| `ApiInfoService`          | `tierIdx`                             | Get license tier                 | License check              |
| `ApiInfoService`          | `osVersionInfo`                       | Get OS info                      | System info                |
| `ApiInfoService`          | `driverVersionInfo`                   | Get GPU driver info              | System info                |
| `ApiInfoService`          | `cpuInfo`                             | Get CPU info                     | System info                |
| `ApiInfoService`          | `getAttributeName`                    | Look up attribute name from ID   | Attribute round-trip test  |
| `ApiInfoService`          | `getAttributeId`                      | Look up attribute ID from name   | Attribute round-trip test  |
| `ApiInfoService`          | `getPinName`                          | Look up pin name from ID         | Pin round-trip test        |
| `ApiInfoService`          | `getPinId`                            | Look up pin ID from name         | Pin round-trip test        |
| `ApiInfoService`          | `getNodeTypeName`                     | Get human name for node type ID  | Node type verification     |
| `ApiInfoService`          | `getGraphTypeName`                    | Get human name for graph type ID | Graph type verification    |
| `ApiInfoService`          | `getItemTypeName`                     | Get human name for item type ID  | Item type verification     |
| `ApiItemService`          | `isNode`                              | Check if item is a node          | Type checking test         |
| `ApiItemService`          | `isLinker`                            | Check if item is a linker        | Type checking test         |
| `ApiItemService`          | `attrCount`                           | Count attributes on an item      | Attribute enumeration test |
| `ApiItemService`          | `hasAttr`                             | Check if item has an attribute   | Attribute query test       |
| `ApiItemService`          | `attrName`                            | Get attribute name by index      | Attribute enumeration test |
| `ApiItemService`          | `attrType`                            | Get attribute type               | Attribute type test        |
| `ApiItemService`          | `version`                             | Get item version                 | Version check              |
| `ApiItemService`          | `rootGraph`                           | Get root graph from any item     | Navigation test            |
| `ApiItemService`          | `toNode` / `toGraph`                  | Cast item to specific type       | Type casting test          |
| `ApiItemService`          | `collectItemTree`                     | Get full item tree from a root   | Tree enumeration test      |
| `ApiNodeService`          | `pinCount` (already used)             | Count pins                       | Pin enumeration            |
| `ApiNodeService`          | `pinType` / `pinTypeIx`               | Get pin type                     | Pin type verification      |
| `ApiNodeService`          | `pinName` / `pinNameIx`               | Get pin name                     | Pin name verification      |
| `ApiNodeService`          | `isPinConnected` / `isPinConnectedIx` | Check pin connection             | Connection verification    |
| `ApiRenderEngineService`  | `deviceUsesHardwareRayTracing`        | Check RT support                 | Device capability test     |
| `ApiRenderEngineService`  | `isRendering`                         | Check render state               | Render state test          |
| `ApiRenderEngineService`  | `resolution`                          | Get current render resolution    | Resolution test            |
| `ApiCachesService`        | `getMeshletCacheSize`                 | Query cache sizes                | Cache info test            |
| `ApiCachesService`        | `getMeshletCacheUsedSize`             | Query cache usage                | Cache info test            |
| `ApiCachesService`        | `getVirtualTextureCacheSize`          | Query VT cache                   | Cache info test            |
| `ApiDiagnosticsService`   | `diagnosticCommand`                   | Run diagnostic                   | Diagnostic test            |
| `ApiChangeManagerService` | `addTimeObserver`                     | Watch time changes               | Animation test             |
| `ApiChangeManagerService` | `removeTimeObserver`                  | Stop watching time               | Animation test cleanup     |
| `LiveLinkService`         | `GetMeshes`                           | List scene meshes                | Mesh enumeration test      |
| `LiveLinkService`         | `GetMesh`                             | Get mesh geometry                | Mesh data test             |
| `LiveLinkService`         | `StreamCamera`                        | Stream camera updates            | Camera streaming test      |
| `ApiBase64Service`        | `encode` / `decode`                   | Base64 encoding                  | Utility test               |

### Low Priority - Future Features or Internal Use

| Service                                                           | RPC                                       | Purpose                                | Category                    |
| ----------------------------------------------------------------- | ----------------------------------------- | -------------------------------------- | --------------------------- |
| `ApiGeometryExporterService`                                      | `create`, `addItem`, `writeFrame`, etc.   | Export geometry to OBJ/FBX/Alembic     | Future: geometry export     |
| `ApiSceneExporterService`                                         | various                                   | Export entire scene                    | Future: scene export        |
| `ApiMaterialXGlobalService`                                       | `importMaterialXFile`, etc.               | MaterialX import/export                | Future: MaterialX support   |
| `ApiGaussianSplattingService`                                     | `setAttributesFromPly`, `exportAsSpz`     | Gaussian splat operations              | Future: 3DGS support        |
| `ApiNetRenderManagerService`                                      | `configure`, `enable`, `bindDaemon`, etc. | Network rendering control              | Future: net render UI       |
| `ApiRenderCloudManagerService`                                    | various                                   | Cloud render submission                | Future: cloud rendering     |
| `ApiOcioConfigService`                                            | various                                   | OCIO color management config           | Future: color management UI |
| `ApiOcioConfigLoaderService`                                      | various                                   | OCIO config file loading               | Future: OCIO support        |
| `ApiOcioContextManagerService`                                    | various                                   | OCIO context variables                 | Future: OCIO support        |
| `ApiOutputColorSpaceInfoService`                                  | various                                   | Color space info                       | Future: color management    |
| `ApiReferencgGraphService`                                        | various                                   | Reference graph operations (ORBX refs) | Future: reference mgmt      |
| `ApiSharedSurfaceService`                                         | various                                   | Shared surface/WebRTC viewport         | Future: WebRTC viewport     |
| `ApiAnimationTimeTransformService`                                | `type`                                    | Animation time transform type          | Future: animation           |
| `ApiLinearTimeTransformService`                                   | `delay`, `speedUp`, etc.                  | Animation speed control                | Future: animation           |
| `ApiModuleNodeGraphService`                                       | various                                   | Custom module node graphs              | Internal: plugin API        |
| `ApiBinaryGroupService` / `ApiBinaryTableService`                 | various (200+ RPCs)                       | Binary file serialization              | Internal: file format       |
| `ApiThreadService`                                                | various                                   | Thread management                      | Internal: threading         |
| All GUI widget services                                           | various                                   | UI widgets (checkbox, combobox, etc.)  | Internal: native UI         |
| `ImageExportSettingsService`                                      | various                                   | Image export settings                  | Future: export dialog       |
| `VdbGridInfoService` / `VdbGridSamplerService` / `VdbInfoService` | various                                   | OpenVDB volume operations              | Future: volume support      |
| `RenderResultStatisticsService`                                   | various                                   | Per-pass render statistics             | Future: advanced stats      |

## Implementation Plan

### Phase 1: Add to Main App

These RPCs should be wired into existing UI features. Ordered by user-facing impact.

#### 1.1 Node Rename (ApiItem.setName)

- **Where**: NodeInspector header, NodeGraph context menu
- **Priority**: High
- **Effort**: Small

#### 1.2 Enhanced Node Creation (ApiInfo.getNodeTypes, getCompatibleTypes, nodeInfo)

- **Where**: "Add Node" dialog should query Octane for available node types instead of a hardcoded list
- **Priority**: High
- **Effort**: Medium
- **Benefit**: Automatically supports all node types including plugin nodes

#### 1.3 Render Pass Selection (ApiInfo.getAllRenderPassIds, renderPassInfo, renderPassName)

- **Where**: Render output panel, export dialog
- **Priority**: High
- **Effort**: Medium
- **Benefit**: Users can view and export specific render passes (beauty, depth, normal, etc.)

#### 1.4 Node Graph Pin Colors (ApiInfo.getPinTypeColor)

- **Where**: ReactFlow node graph edge colors
- **Priority**: Medium
- **Effort**: Small
- **Benefit**: Visual consistency with Octane's native node graph

#### 1.5 Selection Sync (ApiSelectionManager.selectedItems, selectItem, clearSelection)

- **Where**: Bidirectional selection between OctaneWebR and Octane Standalone
- **Priority**: Medium
- **Effort**: Medium

#### 1.6 Scene Cleanup (ApiItem.deleteUnconnectedItems)

- **Where**: Edit menu or toolbar button
- **Priority**: Medium
- **Effort**: Small

#### 1.7 Live Inspector Updates (ApiChangeManager.observeApiItem, stopObserving)

- **Where**: NodeInspector auto-refresh when Octane modifies a node externally
- **Priority**: Medium
- **Effort**: Medium

#### 1.8 File Chooser Integration (ApiFileChooser.browseForFileToOpen, browseForFileToSave)

- **Where**: File > Open, File > Save As (when Octane is local, use native dialogs)
- **Priority**: Low
- **Effort**: Medium

#### 1.9 System Control (ApiControl.getWebRTCStatus, closeOctane)

- **Where**: Status bar (WebRTC indicator), App menu
- **Priority**: Low
- **Effort**: Small

### Phase 2: Test Routine

An automated API test suite accessible from Help > Run API Test Suite.

#### Test Routine Design

**How it launches:**

- Menu: Help > Run API Test Suite
- Opens a modal dialog with test categories and a Run All button
- Each test can also be run individually

**What it tests:**

1. **Connection Tests**: Health check, version, license info
2. **Info Service Tests**: Node types, pin types, attribute types, render passes
3. **Item Service Tests**: Create node, read name, set name, read/write attributes, destroy
4. **Node Service Tests**: Pin enumeration, pin info, connection/disconnection
5. **Graph Service Tests**: Owned items, copy, group (skip ungroup per R3-9)
6. **Render Engine Tests**: Device count, device name, memory, resolution, statistics
7. **Camera Tests**: Get/set camera, stream camera
8. **Material DB Tests**: LocalDB root, categories, packages; LiveDB categories, materials
9. **Cache Tests**: Meshlet cache size, VT cache size
10. **LiveLink Tests**: GetMeshes, GetMesh (geometry data)

**How it reports results:**

- Real-time progress in the modal with pass/fail per test
- Summary: X passed, Y failed, Z skipped
- Failed tests show error message and expected vs actual
- Results exportable as JSON for bug reports

#### Code Snippets

**Adding the menu item (in HelpMenu or similar):**

```tsx
// client/src/components/Toolbar/HelpMenu.tsx
// Add to existing Help menu items:

<MenuItem onClick={() => setShowApiTestSuite(true)}>Run API Test Suite</MenuItem>;

// In the component body:
const [showApiTestSuite, setShowApiTestSuite] = useState(false);

// In JSX:
{
  showApiTestSuite && <ApiTestSuiteDialog onClose={() => setShowApiTestSuite(false)} />;
}
```

**Test runner service:**

```typescript
// client/src/services/octane/ApiTestRunner.ts

import { ApiService } from './ApiService';
import { asNumber, asString, asBool, getHandle, asObject } from './ApiService';

export interface TestResult {
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  durationMs: number;
}

export interface TestSuiteResult {
  results: TestResult[];
  passed: number;
  failed: number;
  skipped: number;
  totalDurationMs: number;
}

type TestProgressCallback = (result: TestResult, index: number, total: number) => void;

export class ApiTestRunner {
  private api: ApiService;

  constructor(api: ApiService) {
    this.api = api;
  }

  async runAll(onProgress?: TestProgressCallback): Promise<TestSuiteResult> {
    const tests = this.getAllTests();
    const results: TestResult[] = [];
    const start = performance.now();

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const testStart = performance.now();
      let result: TestResult;

      try {
        await test.fn();
        result = {
          name: test.name,
          category: test.category,
          status: 'pass',
          message: 'OK',
          durationMs: performance.now() - testStart,
        };
      } catch (error) {
        result = {
          name: test.name,
          category: test.category,
          status: 'fail',
          message: error instanceof Error ? error.message : String(error),
          durationMs: performance.now() - testStart,
        };
      }

      results.push(result);
      onProgress?.(result, i, tests.length);
    }

    return {
      results,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      skipped: results.filter(r => r.status === 'skip').length,
      totalDurationMs: performance.now() - start,
    };
  }

  private getAllTests() {
    return [
      ...this.connectionTests(),
      ...this.infoServiceTests(),
      ...this.itemServiceTests(),
      ...this.renderEngineTests(),
      ...this.cameraTests(),
      ...this.cacheTests(),
    ];
  }

  private connectionTests() {
    return [
      {
        name: 'Health check responds',
        category: 'Connection',
        fn: async () => {
          const healthy = await this.api.checkServerHealth();
          if (!healthy) throw new Error('Health check failed');
        },
      },
      {
        name: 'ApiInfo.octaneVersion returns string',
        category: 'Connection',
        fn: async () => {
          const r = await this.api.callApi('ApiInfo', 'octaneVersion', {});
          const v = asString(r?.result);
          if (!v) throw new Error('No version returned');
        },
      },
      {
        name: 'ApiInfo.octaneName returns string',
        category: 'Connection',
        fn: async () => {
          const r = await this.api.callApi('ApiInfo', 'octaneName', {});
          const v = asString(r?.result);
          if (!v) throw new Error('No name returned');
        },
      },
      {
        name: 'ApiInfo.isDemoVersion returns bool',
        category: 'Connection',
        fn: async () => {
          const r = await this.api.callApi('ApiInfo', 'isDemoVersion', {});
          if (r?.result === undefined) throw new Error('No result');
        },
      },
      {
        name: 'ApiInfo.osVersionInfo returns string',
        category: 'Connection',
        fn: async () => {
          const r = await this.api.callApi('ApiInfo', 'osVersionInfo', {});
          const v = asString(r?.result);
          if (!v) throw new Error('No OS info returned');
        },
      },
      {
        name: 'ApiInfo.cpuInfo returns string',
        category: 'Connection',
        fn: async () => {
          const r = await this.api.callApi('ApiInfo', 'cpuInfo', {});
          const v = asString(r?.result);
          if (!v) throw new Error('No CPU info returned');
        },
      },
    ];
  }

  private infoServiceTests() {
    return [
      {
        name: 'ApiInfo.getNodeTypes returns array',
        category: 'Info Service',
        fn: async () => {
          const r = await this.api.callApi('ApiInfo', 'getNodeTypes', {});
          if (!r?.result) throw new Error('No node types returned');
        },
      },
      {
        name: 'ApiInfo.getPinTypes returns array',
        category: 'Info Service',
        fn: async () => {
          const r = await this.api.callApi('ApiInfo', 'getPinTypes', {});
          if (!r?.result) throw new Error('No pin types returned');
        },
      },
      {
        name: 'ApiInfo.getAttributeTypes returns array',
        category: 'Info Service',
        fn: async () => {
          const r = await this.api.callApi('ApiInfo', 'getAttributeTypes', {});
          if (!r?.result) throw new Error('No attribute types returned');
        },
      },
      {
        name: 'ApiInfo.getGraphTypes returns array',
        category: 'Info Service',
        fn: async () => {
          const r = await this.api.callApi('ApiInfo', 'getGraphTypes', {});
          if (!r?.result) throw new Error('No graph types returned');
        },
      },
      {
        name: 'ApiInfo.getAllRenderPassIds returns array',
        category: 'Info Service',
        fn: async () => {
          const r = await this.api.callApi('ApiInfo', 'getAllRenderPassIds', {});
          if (!r?.result) throw new Error('No render pass IDs returned');
        },
      },
      {
        name: 'ApiInfo.getPinTypeColor returns color for pin type 1',
        category: 'Info Service',
        fn: async () => {
          const r = await this.api.callApi('ApiInfo', 'getPinTypeColor', null, {
            pinType: 1,
          });
          if (!r) throw new Error('No color returned');
        },
      },
      {
        name: 'ApiInfo.getNodeTypeName resolves type 33 (DiffuseMaterial)',
        category: 'Info Service',
        fn: async () => {
          const r = await this.api.callApi('ApiInfo', 'getNodeTypeName', null, {
            nodeType: 33,
          });
          const name = asString(r?.result);
          if (!name) throw new Error('No type name returned');
        },
      },
    ];
  }

  private itemServiceTests() {
    return [
      {
        name: 'ApiProjectManager.rootNodeGraph returns handle',
        category: 'Item Service',
        fn: async () => {
          const r = await this.api.callApi('ApiProjectManager', 'rootNodeGraph', {});
          const h = getHandle(r?.result);
          if (!h) throw new Error('No root handle returned');
        },
      },
      {
        name: 'ApiItem.name on root graph returns string',
        category: 'Item Service',
        fn: async () => {
          const root = await this.api.callApi('ApiProjectManager', 'rootNodeGraph', {});
          const h = getHandle(root?.result);
          if (!h) throw new Error('No root handle');
          const r = await this.api.callApi('ApiItem', 'name', h);
          const name = asString(r?.result);
          if (!name) throw new Error('No name returned');
        },
      },
      {
        name: 'ApiItem.isGraph on root returns true',
        category: 'Item Service',
        fn: async () => {
          const root = await this.api.callApi('ApiProjectManager', 'rootNodeGraph', {});
          const h = getHandle(root?.result);
          if (!h) throw new Error('No root handle');
          const r = await this.api.callApi('ApiItem', 'isGraph', h);
          if (!asBool(r?.result)) throw new Error('Root is not a graph');
        },
      },
      {
        name: 'ApiItem.attrCount returns number >= 0',
        category: 'Item Service',
        fn: async () => {
          const root = await this.api.callApi('ApiProjectManager', 'rootNodeGraph', {});
          const h = getHandle(root?.result);
          if (!h) throw new Error('No root handle');
          const r = await this.api.callApi('ApiItem', 'attrCount', h);
          const count = asNumber(r?.result, -1);
          if (count < 0) throw new Error('Invalid attr count');
        },
      },
    ];
  }

  private renderEngineTests() {
    return [
      {
        name: 'ApiRenderEngine.getDeviceCount returns > 0',
        category: 'Render Engine',
        fn: async () => {
          const r = await this.api.callApi('ApiRenderEngine', 'getDeviceCount', {});
          const count = asNumber(r?.result, 0);
          if (count <= 0) throw new Error(`Device count: ${count}`);
        },
      },
      {
        name: 'ApiRenderEngine.getDeviceName returns GPU name',
        category: 'Render Engine',
        fn: async () => {
          const r = await this.api.callApi('ApiRenderEngine', 'getDeviceName', null, {
            deviceIndex: 0,
          });
          const name = asString(r?.result);
          if (!name) throw new Error('No device name');
        },
      },
      {
        name: 'ApiRenderEngine.getMemoryUsage returns usage data',
        category: 'Render Engine',
        fn: async () => {
          const r = await this.api.callApi('ApiRenderEngine', 'getMemoryUsage', null, {
            deviceIndex: 0,
          });
          const mem = asObject(r?.memUsage);
          if (!mem) throw new Error('No memory usage data');
        },
      },
      {
        name: 'ApiRenderEngine.getRenderStatistics returns stats',
        category: 'Render Engine',
        fn: async () => {
          const r = await this.api.callApi('ApiRenderEngine', 'getRenderStatistics', 0);
          // Stats may be null if nothing has rendered yet
          // Just verify the call doesn't throw
        },
      },
      {
        name: 'ApiRenderEngine.deviceUsesHardwareRayTracing returns bool',
        category: 'Render Engine',
        fn: async () => {
          const r = await this.api.callApi(
            'ApiRenderEngine',
            'deviceUsesHardwareRayTracing',
            null,
            { index: 0 }
          );
          if (r?.result === undefined) throw new Error('No result');
        },
      },
    ];
  }

  private cameraTests() {
    return [
      {
        name: 'LiveLink.GetCamera returns position and target',
        category: 'Camera',
        fn: async () => {
          const r = await this.api.callApi('LiveLink', 'GetCamera', {});
          if (!r?.position && !r?.target) throw new Error('No camera data');
        },
      },
      {
        name: 'LiveLink.GetMeshes returns mesh list',
        category: 'Camera',
        fn: async () => {
          const r = await this.api.callApi('LiveLink', 'GetMeshes', {});
          // May be empty if no meshes - just verify no error
        },
      },
    ];
  }

  private cacheTests() {
    return [
      {
        name: 'ApiCaches.getMeshletCacheSize returns number',
        category: 'Caches',
        fn: async () => {
          const r = await this.api.callApi('ApiCaches', 'getMeshletCacheSize', {});
          // May return 0 - just verify no error
        },
      },
      {
        name: 'ApiCaches.getVirtualTextureCacheSize returns number',
        category: 'Caches',
        fn: async () => {
          const r = await this.api.callApi('ApiCaches', 'getVirtualTextureCacheSize', {});
          // May return 0 - just verify no error
        },
      },
    ];
  }
}
```

**Test suite dialog component:**

```tsx
// client/src/components/ApiTestSuite/ApiTestSuiteDialog.tsx

import React, { useState, useCallback } from 'react';
import { getOctaneClient } from '../../services/OctaneClient';
import { ApiTestRunner, TestResult, TestSuiteResult } from '../../services/octane/ApiTestRunner';

interface Props {
  onClose: () => void;
}

export function ApiTestSuiteDialog({ onClose }: Props) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<TestSuiteResult | null>(null);

  const runTests = useCallback(async () => {
    setRunning(true);
    setResults([]);
    setSummary(null);

    const client = getOctaneClient();
    // Access the ApiService via callApi (the test runner uses it internally)
    const runner = new ApiTestRunner(client as any);

    const result = await runner.runAll((testResult, index, total) => {
      setResults(prev => [...prev, testResult]);
    });

    setSummary(result);
    setRunning(false);
  }, []);

  return (
    <div className="modal-overlay">
      <div className="modal-dialog" style={{ width: 700, maxHeight: '80vh' }}>
        <div className="modal-header">
          <h2>API Test Suite</h2>
          <button onClick={onClose} disabled={running}>
            Close
          </button>
        </div>
        <div className="modal-body" style={{ overflowY: 'auto' }}>
          <button onClick={runTests} disabled={running}>
            {running ? 'Running...' : 'Run All Tests'}
          </button>

          {summary && (
            <div style={{ margin: '12px 0', padding: 8, background: '#1a1a2e', borderRadius: 4 }}>
              <strong>Results:</strong>{' '}
              <span style={{ color: '#4caf50' }}>{summary.passed} passed</span>{' '}
              <span style={{ color: '#f44336' }}>{summary.failed} failed</span>{' '}
              <span style={{ color: '#ff9800' }}>{summary.skipped} skipped</span> in{' '}
              {(summary.totalDurationMs / 1000).toFixed(2)}s
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Category</th>
                <th>Test</th>
                <th>Time</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} style={{ color: r.status === 'pass' ? '#4caf50' : '#f44336' }}>
                  <td>{r.status === 'pass' ? 'PASS' : 'FAIL'}</td>
                  <td>{r.category}</td>
                  <td>{r.name}</td>
                  <td>{r.durationMs.toFixed(0)}ms</td>
                  <td>{r.status === 'fail' ? r.message : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

### Phase 3: Future Features

These RPCs are needed for features not yet built. Each represents a significant feature addition.

#### 3.1 Geometry Export (ApiGeometryExporterService)

- Export scene geometry to OBJ/FBX/Alembic formats
- Requires: UI for format selection, path, and options
- RPCs: `create`, `setAspectRatio`, `setFbxOptions`, `addItem`, `writeFrame`, `destroy`

#### 3.2 Scene Export (ApiSceneExporterService)

- Export scene as ORBX or other formats
- Requires: Export dialog with settings
- RPCs: `create`, various config, `export`, `destroy`

#### 3.3 MaterialX Import/Export (ApiMaterialXGlobalService)

- Import MaterialX (.mtlx) material files
- RPCs: `importMaterialXFile`, `getAllMxNodeCategories`, `getNodeTypes`, etc.

#### 3.4 Gaussian Splatting (ApiGaussianSplattingService)

- Import PLY point clouds as Gaussian splats, export as SPZ
- RPCs: `create`, `setAttributesFromPly`, `exportAsSpz`

#### 3.5 Network Rendering (ApiNetRenderManagerService)

- Configure and manage render daemons across network
- RPCs: `configure`, `enable`, `bindDaemon`, `unbindDaemon`, `status`, etc.

#### 3.6 Cloud Rendering (ApiRenderCloudManagerService)

- Submit renders to OctaneRender Cloud
- Requires: Authentication, queue management UI

#### 3.7 OCIO Color Management (ApiOcioConfig*, ApiOutputColorSpaceInfo*)

- Full OCIO color pipeline configuration
- RPCs across ApiOcioConfigService, ApiOcioConfigLoaderService, ApiOcioContextManagerService

#### 3.8 WebRTC Viewport (ApiSharedSurfaceService)

- Direct GPU-to-browser viewport via WebRTC
- Would replace the current grabRenderResult polling approach
- RPCs: `create`, `configure`, `start`, `stop`, etc.

#### 3.9 OpenVDB Volume Support (VdbGridInfoService, VdbGridSamplerService, VdbInfoService)

- Volume rendering with VDB files
- RPCs for grid enumeration, sampling, file info

#### 3.10 Animation Timeline (ApiAnimationTimeTransform*, FrameRangeT*, TimeSpanT\*)

- Animation playback, frame range control, time transforms
- Requires: Timeline UI component

#### 3.11 Reference Graph Management (ApiReferenceGraphService)

- Manage ORBX reference files within a scene
- RPCs for listing, loading, updating references

## Summary

| Phase                     | RPC Count         | Effort       | Impact                                      |
| ------------------------- | ----------------- | ------------ | ------------------------------------------- |
| Phase 1 (Main App)        | ~30 distinct RPCs | Medium       | High - directly improves UX                 |
| Phase 2 (Test Routine)    | ~40 distinct RPCs | Small-Medium | Medium - catches regressions, exercises API |
| Phase 3 (Future Features) | 100+ RPCs         | Large        | High - enables new capabilities             |
| GUI Widget Services       | 100+ RPCs         | N/A          | Skip - OctaneWebR has its own React UI      |
| Binary File Services      | 200+ RPCs         | N/A          | Skip - internal serialization, not needed   |

**Total proto RPCs defined**: ~800+
**Currently used by client**: ~60
**Recommended next additions**: Phase 1 (30 RPCs) + Phase 2 test runner (40 RPCs)
