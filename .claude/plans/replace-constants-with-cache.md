# Plan: Replace Constants with Cache System

## Goal

Eliminate hardcoded node/pin type data. Single source of truth = API cache from Octane.

## What Changes

### 1. Create `OctaneProtocol.ts` (from OctaneTypes.ts)

Keep only protocol-level enums + helpers that CANNOT come from API:

- `AttrType` (16 values) — used by 6 files
- `AttributeId` (~11 values) — used by 5 files
- `ObjectType` + `createObjectPtr()` + `getObjectTypeForService()` — used by 2 files
- `PinId` (2 values) — used by 1 file
- `PinTypeId` (14 values) — used by 1 file
- `InputAction` (5 values) — used by 1 file
- `NodeType` — still needed by context menu (`useNodeOperations.ts`) and MCP (`node.ts`) as fallback

Delete from OctaneTypes: `MOVABLE_INPUT_TYPES`, `FILE_NODE_TYPES` → move to cache service

### 2. Enhance `OctaneCacheService`

Add methods to replace NodeTypes.ts and PinTypes.ts lookups:

- `getNodeTypeInfo(key)` — already exists, keep
- `getNodeTypeHierarchy()` — already exists, keep
- `getCompatibleNodeTypes(pinType)` — already exists, fix Number() bug
- `getIconForType(type)` — move from PinTypes.ts
- `getPinTypeInfo(pinType)` — move from PinTypes.ts
- `getNodeIconPath(nodeType)` — move from NodeTypes.ts
- `isFileNodeType(nodeType)` — new, replaces FILE_NODE_TYPES
- `getMovableInputInfo(nodeType)` — new, replaces MOVABLE_INPUT_TYPES
- `getNodeTypeId(key)` — new, from nodeTypesByName

### 3. Delete files

- `OctaneTypes.ts` → replaced by `OctaneProtocol.ts`
- `NodeTypes.ts` → replaced by cache service
- `PinTypes.ts` → replaced by cache service

### 4. Keep files (not API data)

- `UIIconMapping.ts` — maps our UI button IDs to local icon files (our design choices, not Octane metadata)
- `ToolbarIconMapping.ts` — same, toolbar layout constants

### 5. Fix Number() bug in Vite plugin

`vite-plugin-octane-grpc.ts:117` — already fixed, just needs server restart to verify

### 6. Unify context menu + inspector dropdown

Both should call `cacheService.getCompatibleNodeTypes(pinType)` with numeric IDs.
Context menu currently uses `NodeType[key]` (hardcoded enum). Change to `cacheService.getNodeTypeId(key)`.

## Files Modified (13)

- `client/src/constants/OctaneProtocol.ts` — NEW (from OctaneTypes.ts)
- `client/src/services/OctaneCacheService.ts` — enhanced
- `client/src/services/octane/NodeService.ts` — import change
- `client/src/services/octane/SceneService.ts` — import change
- `client/src/services/octane/ApiService.ts` — import change
- `client/src/services/octane/RenderService.ts` — import change
- `client/src/services/octane/ItemService.ts` — import change
- `client/src/components/NodeInspector/hooks/useParameterValue.ts` — import change
- `client/src/components/NodeInspector/index.tsx` — use cache service
- `client/src/components/NodeInspector/ParameterControl.tsx` — import change
- `client/src/components/NodeInspector/FileNodeToolbar.tsx` — import change
- `client/src/components/NodeGraph/hooks/useNodeOperations.ts` — use cache service
- `client/src/components/NodeGraph/OctaneNode.tsx` — use cache service
- `client/src/components/SceneOutliner/VirtualTreeRow.tsx` — use cache service
- `client/src/utils/PinColorUtils.ts` — use cache service
- `mcp/src/tools/node.ts` — import change
- `mcp/src/tools/info.ts` — import change

## Files Deleted (3)

- `client/src/constants/OctaneTypes.ts`
- `client/src/constants/NodeTypes.ts`
- `client/src/constants/PinTypes.ts`

## Risk

Medium — touching 13+ files. Mitigated by:

- Build + lint catch type errors
- Protocol enums are unchanged (just moved)
- Cache service already provides most lookups
- Fallback to hardcoded names if cache isn't loaded (graceful degradation)
