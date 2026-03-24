# octaneWebR Architecture

Browser-based UI for Octane Render Studio. Communicates with Octane via gRPC LiveLink API for real-time scene editing, parameter control, and live render output.

## Three-Tier Architecture

```
React Client (browser)
    |
    v
Vite Plugin (gRPC proxy + WebSocket + file browser)     MCP Server (78 tools, stdio)
    |                                                         |
    +------- Shared: OctaneGrpcClientBase.ts ----------------+
                            |
                            v
                    Octane Render Studio (gRPC)
```

**Vite plugin** (`vite-plugin-octane-grpc.ts`) handles everything server-side: gRPC proxying, WebSocket callback streaming, REST endpoints for health and file operations. No separate Express server.

**MCP server** (`mcp/`) is a standalone Node.js process using stdio transport. 78 active tools (15 modules) for scene building, camera, render, nodes, attributes, animation, art direction, and color management. Built with esbuild, has its own `package.json`. Uses typed interface (`mcp/src/types/GrpcClientTypes.ts`) for the gRPC client instead of `any`.

**Shared gRPC client** (`server/src/grpc/OctaneGrpcClientBase.ts`) provides proto loading, service resolution, method invocation, API version compatibility translation, and gRPC debug file logging (mutating calls logged to `log_grpc.log`, on by default, `GRPC_DEBUG_LOG=0` to disable). All callers use Beta 2 method names; the base translates to the current API version automatically. Used by both the Vite plugin and MCP server via composition.

## Directory Structure

```
octaneWebR/
├── client/src/
│   ├── components/       React UI components
│   ├── services/         Business logic, gRPC wrappers
│   ├── hooks/            Custom React hooks
│   ├── utils/            Helpers, formatters, icon mappers
│   ├── constants/        Enums, icon mappings, node types (755+)
│   ├── config/           API version configuration
│   ├── types/            TypeScript definitions
│   ├── styles/           CSS themes and component styles
│   └── App.tsx           Root component
├── server/
│   ├── proto/            Beta 2 protobuf definitions (2026.1)
│   ├── proto_old/        Alpha 5 protobuf definitions (2026.1)
│   └── src/grpc/         Shared gRPC client base
├── shared/               Protocol constants shared by client + MCP
│   └── OctaneConstants.ts  AttrType, AttributeId, CRASH_TYPE_IDS, PIN_TYPE_NAMES, RT_PINS
├── mcp/                  MCP server (separate package)
│   ├── src/              Tool implementations
│   ├── src/types/        Typed interfaces (GrpcClientTypes.ts)
│   ├── src/__tests__/    Tests (281 tests via Vitest)
│   └── data/             API cache (octane-api-cache.json)
├── ORBX/assets_test/          3D meshes (.obj) and textures
├── temp/renders/         Render output
├── api-version.config.js API version switch (Alpha 5 vs Beta 2)
└── vite-plugin-octane-grpc.ts  Embedded proxy plugin
```

## Client Stack

- **React 18** with strict TypeScript
- **@tanstack/react-query** for data fetching
- **@xyflow/react** (ReactFlow v12) for the node graph editor
- **react-window** for virtualized scene outliner
- **State management**: React Context + custom hooks (no Redux)
- **Styling**: CSS variables with 3 themes (vibe, octane, debug)

## Service Layer

All services extend `BaseService` (event emitter + error handling). `OctaneClient` is the facade that aggregates them.

| Service                          | Purpose                                       |
| -------------------------------- | --------------------------------------------- |
| `ApiService`                     | Core gRPC wrapper, objectPtr handling         |
| `ConnectionService`              | WebSocket lifecycle, auto-reconnect           |
| `SceneService` / `SceneServiceP` | Scene tree building, progressive loading      |
| `NodeService`                    | Node CRUD, pin connections, group/ungroup     |
| `CameraService`                  | Camera position/target/up vectors             |
| `ViewportService`                | Viewport state, picker tools                  |
| `RenderService`                  | Render pipeline, film settings, render region |
| `MaterialDatabaseService`        | LocalDB (offline) + LiveDB (online)           |
| `DeviceService`                  | GPU statistics, device info                   |
| `RenderExportService`            | Image export                                  |
| `CommandHistory`                 | Undo/redo with branching (50-action history)  |

## Real-Time Communication

Render updates flow through a callback streaming pipeline:

```
Octane gRPC stream -> callbackManager -> WebSocket broadcast -> RenderService -> render:update event
```

Services emit events for UI sync: `connection:changed`, `scene:loaded`, `node:selected`, `node:created/deleted/updated`, `render:update`. Progressive loading adds: `scene:buildStart`, `scene:nodeAdded`, `scene:structureComplete`, `scene:buildComplete`.

## API Version Configuration

`api-version.config.js` is the single source of truth for switching between Alpha 5 and Beta 2 proto APIs.

```
api-version.config.js
  ├──> OctaneGrpcClientBase.ts (compat layer — method name + param translation)
  ├──> vite-plugin-octane-grpc.ts (server side, proto dir selection)
  └──> client/src/config/apiVersionConfig.ts (client side, UI display only)
```

**Unified compat layer (v2.1.0):** All callers use Beta 2 method names. `OctaneGrpcClientBase.callMethod()` handles API version translation before the gRPC wire call:

1. `transformRequestParams()` — adjusts param structure (e.g. `pin_id` → `id`, typed values → generic `value`)
2. `getCompatibleMethodName()` — translates method name (e.g. `setValueByAttrID` → `setByAttrID`)

Both the web UI (via HTTP → Vite plugin → base) and MCP (via OctaneMcpClient → base) share this single code path. No duplicate compat logic anywhere.

## Key Components

| Component                          | Purpose                                              |
| ---------------------------------- | ---------------------------------------------------- |
| `App.tsx`                          | Root, OctaneProvider context, resizable panel layout |
| `NodeGraphEditor.tsx`              | ReactFlow node graph, context menus, connections     |
| `SceneOutliner/index.tsx`          | Virtualized tree with Scene/LiveDB/LocalDB tabs      |
| `NodeInspector/index.tsx`          | Parameter editor with type-specific inputs           |
| `CallbackRenderViewport/index.tsx` | Render canvas, camera controls, HDR decoding         |

## Build

- **Dev**: `npm run dev` (Vite with HMR)
- **Prod**: `npm run build` (tsc + vite build, output in `dist/`)
- **Type check**: `npx tsc --noEmit`
- **Lint**: `npm run lint`
- **Test**: `npm test` (281 tests: SceneCache, tools, utils, constants, ArtDirectionState, geometric validation)
- **MCP**: `cd mcp && npm run build` (esbuild)

## gRPC Internals

**Proto loader**: `longs: String`, `enums: String`, `keepCase: true`, `defaults: true`. Enums come back as strings (`"PT_TEXTURE"` not `5`), longs as strings. Use string directly or look up in PIN_TYPE_NAMES.

**Deadline pattern**: `Date.now() + timeoutMs` (number), NOT `new Date()` objects.

**Thread safety**: Octane serializes all API calls on a single thread. MCP serializes via mutex. Two gRPC peers (MCP + Vite) can interleave — avoid simultaneous use.

**SDK headers**: Source of truth when something silently fails — `apinodesystem.h` in the Octane SDK `src/api/` directory.
