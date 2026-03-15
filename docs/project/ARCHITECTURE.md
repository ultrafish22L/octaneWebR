# octaneWebR - Architecture

Architecture, patterns, and conventions for the octaneWebR codebase.

---

## Project Summary

**octaneWebR** is a React/TypeScript web application that provides a browser-based UI for Octane Render Studio. It communicates with Octane via the gRPC LiveLink API to provide real-time scene editing, parameter control, and live render output.

- **No Mocking**: All features connect to real Octane via gRPC
- **Type Safety**: Strict TypeScript throughout
- **UI Clone**: Interface matches Octane SE Manual
- **Real-time Sync**: Bidirectional synchronization between UI and Octane
- **Service Architecture**: Modular services extending BaseService

---

## Technology Stack

```
Frontend: React 18, TypeScript (strict), Vite, ReactFlow v12, React Context API, CSS Variables
Backend:  Vite Plugin (embedded gRPC-Web proxy), WebSocket (callback streaming)
Comms:    gRPC LiveLink API (Octane ↔ octaneWebR), REST (health checks, file ops)
MCP:      Model Context Protocol server (28 tools, stdio transport, esbuild + tsx)
```

### Directory Structure

```
octaneWebR/
├── client/src/
│   ├── components/       - React UI components
│   ├── services/         - Business logic, gRPC wrappers
│   ├── hooks/            - Custom React hooks
│   ├── utils/            - Helper functions, formatters
│   ├── constants/        - Enums, icon mappings, node types
│   ├── config/           - Application configuration (API version, etc.)
│   ├── types/            - TypeScript type definitions
│   ├── styles/           - CSS files (themes, components)
│   └── App.tsx           - Root component
├── server/
│   ├── proto/            - Beta 2 protobuf definitions (2026.1)
│   ├── proto_old/        - Alpha 5 protobuf definitions (2026.1)
│   └── src/              - gRPC proxy server
├── mcp/                  - MCP server source (28 tools)
│   ├── src/
│   ├── data/             - API cache (octane-api-cache.json)
│   ├── OCTANE_MCP.md     - MCP technical reference
│   └── OCTANE_CREATIVE.md - Creative guide
├── recipes/              - 6 scene recipes
├── ORBX/assets/          - 3D meshes (.obj) and textures
├── renders/              - Render output images (PNG, EXR)
├── api-version.config.js - API version configuration (Alpha 5/Beta 2)
└── vite-plugin-octane-grpc.ts - Embedded proxy plugin
```

---

## Service Layer

All services extend `BaseService` (event emitter + error handling).

**Services** (`client/src/services/octane/`):

| Service                   | Purpose                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `ApiService`              | Core gRPC wrapper, objectPtr handling, service→ObjectType mapping       |
| `ConnectionService`       | WebSocket lifecycle, auto-reconnect (5s delay), browser timing fixes    |
| `SceneService`            | Recursive scene tree building (NodeGraphs→items, Nodes→pins)            |
| `SceneServiceP`           | Two-pass progressive scene loading with per-pin emission                |
| `NodeService`             | Node CRUD, pin connections, group/ungroup, collapsed node cleanup       |
| `CameraService`           | Camera position/target/up vectors, original state capture               |
| `ViewportService`         | Viewport state, picker tools                                            |
| `RenderService`           | Render pipeline (RenderEngine→RenderTarget→FilmSettings), render region |
| `MaterialDatabaseService` | LocalDB (offline) + LiveDB (online marketplace)                         |
| `DeviceService`           | GPU statistics, device info                                             |
| `RenderExportService`     | Image export, render output                                             |
| `CommandHistory`          | Undo/redo with branching (50-action history)                            |

**Facade**: `OctaneClient` aggregates all services, single entry point, event coordination.

### Events

Services emit events for UI sync: `connection:changed`, `scene:loaded`, `node:selected`, `node:created/deleted/updated`, `render:update`.

Progressive loading: `scene:buildStart`, `scene:nodeAdded`, `scene:level0Complete`, `scene:pinAdded`, `scene:childrenLoaded`, `scene:structureComplete`, `scene:buildComplete`.

---

## Key Components

| Component                           | Purpose                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `App.tsx`                           | Root, OctaneProvider context, panel layout with resizable splitters      |
| `NodeGraphEditor.tsx` (~1500 lines) | ReactFlow-based node graph, context menus, connection logic, search      |
| `SceneOutliner/index.tsx`           | Recursive tree, expand/collapse, icon mapping, Scene/LiveDB/LocalDB tabs |
| `NodeInspector/index.tsx`           | Parameter editor, type-specific inputs, real-time sync                   |
| `CallbackRenderViewport/index.tsx`  | Render output (canvas), camera controls, picker tools, HDR decoding      |

---

## gRPC Integration

### Proto Files

Located in `server/proto/` (Beta 2) and `server/proto_old/` (Alpha 5).

### API Version Configuration

**Single config file**: `api-version.config.js` (line 22)

```javascript
const USE_ALPHA5_API = true; // Alpha 5
const USE_ALPHA5_API = false; // Beta 2 (default)
```

Then `npm run build && npm run dev`.

```
api-version.config.js (Single Source of Truth)
  ├──> vite-plugin-octane-grpc.ts (Server - CommonJS require)
  └──> client/src/config/apiVersionImport.ts → apiVersionConfig.ts (Client)
```

**Alpha 5 transforms**: `getPinValueByPinID`→`getPinValue`, `pin_id`→`id`, typed values→generic `value`.

### API Call Pattern

```typescript
const response = await this.apiService.callApi('ApiService', 'method', handle, { params });
```

**Conventions**:

- Some services need objectPtr: `{ objectPtr: { handle: "123", type: ObjectType.NODE } }`
- Others use handle directly: `{ handle: 123 }`
- Handle "0" = disconnected/null
- Always use `doCycleCheck: true` for pin connections

### Callback Streaming

Render updates: gRPC stream → `callbackManager` → WebSocket broadcast → `RenderService` → `render:update` event.

---

## Styling

- CSS Variables for theming (3 themes: vibe, octane, debug)
- No inline styles, no hardcoded colors — all `var(--*)` references
- Theme switch: change import in `client/src/main.tsx`

**Theme files**: `theme-vibe.css` (default), `theme-octane.css`, `theme-octane-debug.css`

**Style files**: `app.css`, `scene-outliner.css`, `render-viewport.css`, `node-graph.css`, `node-inspector.css`, `error-boundary.css`

### Icons

```
constants/IconMapping.ts        - Node type icons (755+ mappings)
utils/UIIconMapping.ts          - UI control icons
utils/MenuIconMapping.ts        - Menu icons
constants/ToolbarIconMapping.ts - Toolbar icons
```

Icon files: PNG in `client/public/icons/`. Utility: `OctaneIconMapper` class.

---

## Logging

`utils/Logger.ts`: `Logger.debug()`, `.info()`, `.warn()`, `.error()`, `.network()`, `.api()`. Use instead of `console.*`.

---

## Build

- **Dev**: `npm run dev` (Vite on port 57341, HMR, source maps)
- **Prod**: `npm run build` (output: `dist/client/`, minified, tree-shaken)
- **Type check**: `npx tsc --noEmit`

---

## Key Files

| File                                                  | Purpose                                     |
| ----------------------------------------------------- | ------------------------------------------- |
| `client/src/App.tsx`                                  | Root component, layout, panel management    |
| `client/src/services/OctaneClient.ts`                 | Main API facade                             |
| `client/src/services/octane/`                         | Service layer                               |
| `client/src/components/NodeGraph/NodeGraphEditor.tsx` | Node graph editor                           |
| `client/src/components/NodeInspector/index.tsx`       | Parameter editor                            |
| `client/src/utils/OctaneIconMapper.ts`                | Icon and color mapping                      |
| `client/src/constants/NodeTypes.ts`                   | Node type definitions (755+)                |
| `vite-plugin-octane-grpc.ts`                          | Embedded gRPC proxy + WebSocket + callbacks |

## External References

- [Octane SE Manual](https://docs.otoy.com/standaloneSE/)
- [ReactFlow Docs](https://reactflow.dev/)
- [gRPC Web](https://github.com/grpc/grpc-web)
