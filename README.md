# octaneWebR

**Modern web-based UI for Octane Render Studio with real-time gRPC integration**

A React/TypeScript application that provides a browser-based interface for Octane Render, communicating with Octane via the gRPC LiveLink API.

---

## 🎯 Overview

octaneWebR is a web application that replicates the Octane Render Studio Standalone Edition interface, allowing users to:

- Edit Octane scenes through an interactive node graph
- Inspect and modify node parameters in real-time
- View live render output with interactive viewport
- Browse and manage scene hierarchies
- Access LiveDB and LocalDB material libraries

All operations communicate directly with Octane Render via the LiveLink gRPC API—no mocking or simulation.

---

## 🚀 Quick Start

See **[QUICKSTART.md](./QUICKSTART.md)** for detailed setup instructions.

### Prerequisites

- **Octane Render gRPC build** installed and running (https://filedrop.otoy.com/f/393752)
- **LiveLink enabled** in Octane (Help → LiveLink menu)
- **Node.js 18+** installed

### Octane setup

1. Launch **Octane Render gRPC 2026.1 Alpha 5** - (https://filedrop.otoy.com/f/393752)
2. Open the menu File/Preferences:
3. Set **GRPC API/Enable GRPC Server : true**
4. Set **GRPC API/GRPC Server Address: 127.0.0.1:51022** and OK
5. Restart Octane
6. Load sample scene (teapot.orbx), click on the Render Target

### Launch Application

```bash
npm install              # First time only
npm run dev              # Start development server
```

Open **http://localhost:57341** in your browser.

**Connection**: Application connects to Octane at `localhost:51022` (LiveLink default port).

### API Version Support

octaneWebR supports both **Alpha 5 (2026.1)** and **Beta 2 (2026.1)** Octane gRPC APIs with automatic compatibility.

**Quick Switch**: Edit `api-version.config.js` (line 22):

```javascript
const USE_ALPHA5_API = true; // false = Beta 2, true = Alpha 5 (default)
```

Then rebuild and restart:

```bash
npm run build && npm run dev
```

**What's Included**:

- ✅ Automatic method name translation (Beta 2 ↔ Alpha 5)
- ✅ Automatic parameter structure transformation
- ✅ Single config file for both client and server
- ✅ Console logs show active API version

See **[DEVELOPMENT.md](./DEVELOPMENT.md#api-version-configuration)** for detailed information on switching, verification, and troubleshooting.

---

## ✨ Features

### Core Components

#### **Node Graph Editor**

ReactFlow-based node graph editor with real-time Octane synchronization:

- Create nodes via right-click context menu (755+ node types, 25 categories)
- Connect pins with drag-and-drop (automatic edge coloring by pin type)
- Multi-select, copy/paste, duplicate, delete operations
- Connection cutter tool (Ctrl+Drag to cut multiple connections)
- Node search dialog (Ctrl+F for instant search)
- Minimap navigation and context menus

#### **Scene Outliner**

Hierarchical tree view of the Octane scene:

- Expandable/collapsible scene tree with type-specific icons
- Visibility toggles and bidirectional selection sync
- LiveDB tab: Browse/download materials from OTOY library
- LocalDB tab: Access locally saved materials and node groups

#### **Node Inspector**

Real-time parameter editor with complete type support:

- Boolean checkboxes, numeric inputs (int/float), vector inputs
- Color pickers (RGB/RGBA), enum dropdowns, text fields
- **Node type dropdown** for non-end nodes (replace current node with compatible type)
- Collapsible parameter groups for organized UI
- Instant synchronization with Octane

#### **Render Viewport**

Live render output with interactive controls:

- Real-time image streaming via Octane callback API
- Camera controls (orbit, pan, zoom) synced to Octane
- HDR display support, resolution and render mode controls
- Interactive picker tools: Material, Object, Focus, Camera Target, White Balance

### Application Features

#### **Menu System**

Complete menu bar matching Octane SE:

- **File**: New, Open, Save, Package, Render State, Preferences
- **Edit**: Undo, Redo, Cut, Copy, Paste, Delete, Select All
- **Script**: Batch Rendering, Daylight/Turntable Animation
- **View**: Panel visibility, Refresh Scene (F5)
- **Window**: Material Database, Reset Layout, Fullscreen (F11)
- **Help**: Documentation, Shortcuts, Report Bug, About

#### **Keyboard Shortcuts**

Platform-aware shortcuts (Ctrl on Windows/Linux, Cmd on macOS):

- `Ctrl+N` - New scene
- `Ctrl+O` - Open scene
- `Ctrl+S` - Save scene
- `Ctrl+Shift+S` - Save As
- `F5` - Refresh scene
- `F11` - Fullscreen

#### **Infrastructure**

- **TypeScript**: Strict type checking with full gRPC type coverage
- **Embedded gRPC Proxy**: Vite plugin provides transparent proxy (no separate server)
- **Logging System**: Multi-level logger (DEBUG/INFO/WARN/ERROR/NETWORK/API) with console filtering
- **Command History**: Full undo/redo support (50-command history, branching behavior)
- **Theme System**: Pure CSS custom properties (134 variables, Octane SE dark theme)
- **HMR**: Hot module replacement for instant development feedback
- **Cross-browser**: Tested on Chrome, Firefox, Edge, Safari

---

## 🏗️ Architecture

### Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Node Graph**: ReactFlow v12 (custom nodes and edges)
- **State Management**: React Context API (OctaneProvider, EditActionsProvider)
- **Communication**: gRPC-Web via embedded proxy
- **Styling**: CSS Modules + CSS Variables (theme system)

### Service Layer

octaneWebR uses a modular service architecture that wraps Octane's gRPC API:

```
services/
├── octane/
│   ├── ApiService.ts               - Core gRPC API wrapper with objectPtr handling
│   ├── BaseService.ts              - Shared event emitter and error handling
│   ├── CameraService.ts            - Camera position/target/up vector controls
│   ├── ConnectionService.ts        - WebSocket lifecycle + reconnection logic
│   ├── DeviceService.ts            - GPU statistics and device info
│   ├── MaterialDatabaseService.ts  - LocalDB (offline) + LiveDB (online marketplace)
│   ├── NodeService.ts              - Node CRUD, pin connections, group/ungroup
│   ├── ProgressiveSceneServiceV3.ts - Two-pass progressive scene loading
│   ├── RenderService.ts            - Render pipeline, film settings, render region
│   ├── RenderExportService.ts      - Image export and render output
│   ├── SceneService.ts             - Scene tree building (recursive + incremental)
│   ├── ViewportService.ts          - Viewport state and picker tools
│   ├── index.ts                    - Service exports
│   └── types.ts                    - Shared TypeScript interfaces
├── CommandHistory.ts               - Undo/redo command pattern implementation
└── OctaneClient.ts                 - Main API facade (single entry point)
```

**Service Architecture**:

- All services extend `BaseService` for consistent event emission and error handling
- **ApiService** handles gRPC conventions (objectPtr wrapping, service-to-ObjectType mapping)
- **SceneService** builds scene tree recursively (NodeGraphs → owned items, Nodes → pins)
- **ConnectionService** manages WebSocket with automatic reconnection (5s delay, browser timing fixes)
- **CommandHistory** enables full undo/redo with branching behavior (discards redo stack on new action)

**Key Design Patterns**:

- **Incremental Updates**: SceneService can rebuild single nodes instead of full tree
- **Collapsed Node Cleanup**: NodeService removes orphaned nodes from scene.map after rewiring
- **Depth Limiting**: Scene recursion limited to 5 levels (prevents circular graph loops)
- **Level 1 Optimization**: Only top-level nodes build deep children (avoids exponential API calls)

### gRPC Integration

octaneWebR communicates with Octane via gRPC-Web with a custom Vite plugin:

**Architecture**:

- **Vite Plugin** (`vite-plugin-octane-grpc.ts`): Embedded proxy server, no separate backend needed
- **Proto Files**: 30+ .proto definitions in `server/proto/` (Beta 2) and `server/proto_old/` (Alpha 5)
- **API Version Config** (`api-version.config.js`): Centralized configuration for Alpha 5/Beta 2 compatibility
- **Callback Streaming**: WebSocket-based streaming for render updates and scene changes
- **ObjectPtr Convention**: Some gRPC services require `{ objectPtr: { handle, type } }` wrapper
- **Type Safety**: Full TypeScript coverage—no 'any' types in service layer

**Connection Flow**:

1. Browser → `http://localhost:57341/api/grpc/{service}/{method}` (HTTP/2)
2. Vite plugin proxies to `localhost:51022` (Octane LiveLink gRPC server)
3. WebSocket separate channel for callbacks (`ws://localhost:57341/ws`)
4. Automatic reconnection with 5s delay on disconnect

**API Conventions**:

- **Handle "0"**: Represents disconnected pins or null nodes
- **Cycle Checking**: All pin connections use `doCycleCheck: true` to prevent crashes
- **Evaluate Flag**: Most operations trigger scene evaluation (`evaluate: true`)
- **Pin Indexing**: 0-based pin indices (e.g., pin 15 = P_FILM_SETTINGS on RenderTarget)

### Styling & Theming

octaneWebR uses a pure CSS variable-based theme system:

```
client/src/styles/
├── octane-theme.css      # Theme variables only (:root)
├── app.css               # App-level UI (menu, panels, status bar)
├── scene-outliner.css    # Scene outliner and tree view
├── viewport.css          # Viewport, canvas, render toolbar
├── node-graph.css        # Node graph editor and context menus
└── node-inspector.css    # Node inspector and parameter controls
```

**Theme System**:

- `octane-theme.css` contains **only** CSS custom properties (134 variables)
- All colors, spacing, typography defined as `--octane-*` variables
- Matches official Octane SE dark theme
- Component CSS files use `var(--octane-*)` references
- Alternative themes can be created by copying and modifying theme variables

---

## 📂 Project Structure

```
octaneWebR/
├── client/                           # React frontend
│   ├── src/
│   │   ├── components/               # React components
│   │   │   ├── CallbackRenderViewport/ # Live render viewport
│   │   │   ├── NodeGraph/            # Node graph editor (ReactFlow)
│   │   │   ├── SceneOutliner/        # Scene tree viewer
│   │   │   ├── NodeInspector/        # Parameter editor
│   │   │   ├── RenderToolbar/        # Render controls
│   │   │   ├── MenuBar/              # Top menu bar
│   │   │   ├── MaterialDatabase/     # LiveDB/LocalDB browser
│   │   │   ├── dialogs/              # Modal dialogs
│   │   │   └── UI/                   # Shared UI components
│   │   ├── services/                 # Business logic layer
│   │   │   ├── octane/               # Octane gRPC services
│   │   │   └── OctaneClient.ts       # Main API facade
│   │   ├── hooks/                    # React hooks
│   │   ├── utils/                    # Helper functions
│   │   ├── constants/                # Enums and constants (NodeTypes, etc.)
│   │   ├── config/                   # Application configuration
│   │   ├── types/                    # TypeScript type definitions
│   │   ├── commands/                 # Command handlers
│   │   ├── styles/                   # CSS stylesheets (theme + components)
│   │   ├── App.tsx                   # Root component
│   │   └── main.tsx                  # Application entry point
│   ├── public/                       # Static assets
│   │   └── icons/                    # Node type icons (PNG)
│   └── index.html                    # HTML template
├── server/                           # gRPC proxy server
│   ├── proto/                        # Beta 2 proto files (2026.1)
│   ├── proto_old/                    # Alpha 5 proto files (2026.1)
│   └── src/
│       ├── grpc/client.ts            # gRPC client wrapper
│       ├── api/websocket.ts          # WebSocket server
│       ├── services/callbackManager.ts # Callback streaming
│       └── index.ts                  # Server entry point
├── scripts/                          # Build and utility scripts
├── package-for-dist/                 # Distribution packaging scripts
├── api-version.config.js             # API version configuration (Alpha 5/Beta 2)
├── vite-plugin-octane-grpc.ts        # Vite plugin (embedded proxy)
├── vite.config.mts                   # Vite configuration
├── tsconfig.json                     # TypeScript configuration
├── package.json                      # Dependencies and scripts
├── README.md                         # This file
├── QUICKSTART.md                     # Setup guide
├── DEVELOPMENT.md                    # Development guide & architecture
└── CHANGELOG.md                      # Version history
```

---

## 🛠️ Development

### Build Commands

```bash
# Development server with hot reload
npm run dev

# Production build
npm run build

# Type check only (no build)
npx tsc --noEmit

# View build output
ls -lh dist/client/
```

### Key Files

- **`client/src/services/OctaneClient.ts`** - Main gRPC API wrapper
- **`client/src/components/NodeGraph/NodeGraphEditor.tsx`** - Node graph editor (1500+ lines)
- **`client/src/components/NodeGraph/OctaneNode.tsx`** - Custom ReactFlow node component
- **`vite-plugin-octane-grpc.ts`** - Vite plugin providing embedded gRPC proxy

### Code Organization

- **Services**: Business logic separated from UI components
- **Components**: React components with clear single responsibility
- **Hooks**: Reusable React hooks for common patterns
- **Utils**: Pure functions for data transformation and formatting
- **Constants**: Centralized enums, icon mappings, node types

---

## 🧪 Testing

### Manual Testing

```bash
# 1. Start Octane with LiveLink enabled (Help → LiveLink menu)
# 2. Start octaneWebR
npm run dev

# 3. Open http://localhost:57341 in browser
# 4. Check browser console for connection logs:
#    ✅ "Connected to Octane"
#    ✅ "Scene tree loaded"
#    ✅ No errors

# 5. Test core features:
#    - Node Graph: Right-click → Create node
#    - Connections: Drag from output pin to input pin
#    - Selection: Click nodes, Shift-click for multi-select
#    - Scene Outliner: Expand/collapse tree
#    - Node Inspector: Edit parameter values
#    - Viewport: Camera orbit/pan/zoom
```

### Health Check

```bash
curl http://localhost:57341/api/health | python -m json.tool
```

**Expected Response**:

```json
{
  "status": "ok",
  "octane": "connected",
  "timestamp": 1737504000000
}
```

---

## 🆘 Troubleshooting

### Connection Issues

**Symptom**: "Cannot connect to Octane" error

**Solutions**:

1. Ensure Octane is running
2. Enable LiveLink: **Help → LiveLink** in Octane menu
3. Check Octane LiveLink port (default: `51022`)
4. Verify no firewall blocking port `51022`
5. Try restarting Octane

### Build Errors

**Symptom**: `npm run build` fails with TypeScript errors

**Solutions**:

1. Check error messages for specific file/line
2. Ensure all imports are correct
3. Verify proto files exist: `ls -la server/proto/`
4. Clear cache: `rm -rf node_modules dist && npm install`

### Runtime Errors

**Common Issues**:

- **"Cannot read property of undefined"** → Scene not loaded, click Refresh
- **"API call failed"** → Check method name in proto files
- **"WebSocket closed"** → Octane disconnected, restart Octane
- **"Invalid handle"** → Node deleted, refresh scene tree

### WebSocket Connection

**Symptom**: WebSocket warnings in browser console on page refresh

**Fix**: octaneWebR includes a 50ms delay in the WebSocket onopen handler to handle browser timing edge cases. Connection should be automatic and silent.

**Debug**:

1. Check browser console for `✅ WebSocket connected` message
2. Verify `readyState: 1 (OPEN)` in debug logs
3. Confirm `Sent subscribe message to WebSocket` appears

---

## 📚 Documentation

### Core Documentation

- **[README.md](./README.md)** - This file (project overview and features)
- **[QUICKSTART.md](./QUICKSTART.md)** - First-time setup guide
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Development guide and architecture
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history

### External Resources

- [Octane SE Manual](https://docs.otoy.com/standaloneSE/) - Complete UI reference
- [React 18 Docs](https://react.dev/) - Component patterns
- [ReactFlow v12 Docs](https://reactflow.dev/) - Node graph library
- [Vite Guide](https://vitejs.dev/guide/) - Build tool

---

## 📊 Project Statistics

- **Code**: ~17,000 lines of TypeScript/TSX (strict typing)
- **Components**: 35+ React components (functional with hooks)
- **Services**: 11 modular gRPC service wrappers
- **Node Types**: 755+ Octane node types (25 categories)
- **Proto Files**: 30+ gRPC API service definitions
- **CSS Variables**: 134 theme variables (semantic naming, no prefix)
- **Commands**: Full undo/redo with 50-action history

---

## 📅 Recent Development

- **SceneServiceP** - New progressive scene loader (replaces V1/V2/V3 iterations), integrated with SyncIndicator
- **SyncIndicator** - Visual spinner shown during scene builds
- **File Node Toolbar** - FileNodeToolbar component for image/geometry nodes (load/reload/save/clear + filename display)
- **Lint & Accessibility** - Large cleanup pass across ~70 files (jsx-a11y, react-hooks, type safety)
- **Progressive Scene Loading (V3)** - Two-pass progressive loading with per-pin emission
- **Viewport Canvas Optimization** - RAF-based rendering, input throttling, progressive flush
- **React 18 Modernization** - Error boundaries, code splitting, Suspense, React Query, React.memo
- **API Version Compatibility** - Centralized Alpha 5/Beta 2 configuration
- **Material Database** - LiveDB and LocalDB integration
- **Command History** - Full undo/redo with 50-action branching history

See **[CHANGELOG.md](./CHANGELOG.md)** for full version history.

---

## 📄 License

OTOY © 2026 - All rights reserved.

Octane Render® and OTOY® are registered trademarks of OTOY Inc.

---

**Last Updated**: 2026-02-24
**Version**: 1.1.0-dev
**Status**: Active Development (SceneServiceP + File Node Toolbar)
