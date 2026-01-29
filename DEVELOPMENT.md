# octaneWebR - Development Guide

**Comprehensive development guide and architecture documentation**

This document provides detailed context for developers and AI assistants working on octaneWebR, including architecture patterns, conventions, and implementation guidelines.

---

## Project Summary

**octaneWebR** is a React/TypeScript web application that provides a browser-based UI for Octane Render Studio. It communicates with Octane via the gRPC LiveLink API to provide real-time scene editing, parameter control, and live render output.

### Key Points
- **No Mocking**: All features connect to real Octane via gRPC (no simulations)
- **Type Safety**: Strict TypeScript throughout
- **UI Clone**: Interface matches Octane SE Manual specifications
- **Real-time Sync**: Bidirectional synchronization between UI and Octane
- **Service Architecture**: Modular services extending BaseService

---

## Architecture Overview

### Technology Stack
```
Frontend:
- React 18 (functional components, hooks)
- TypeScript (strict mode, no 'any' types)
- Vite (build tool, dev server)
- ReactFlow v12 (node graph editor)
- Zustand (state management)
- CSS Modules + CSS Variables (theming)

Backend:
- Vite Plugin (embedded gRPC-Web proxy)
- gRPC-Web (protocol buffers)
- WebSocket (callback streaming)

Communication:
- gRPC LiveLink API (Octane → octaneWebR)
- REST API (health checks, file operations)
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
│   └── App.tsx           - Root component
├── server/
│   ├── proto/            - Beta 2 protobuf definitions (2026.1)
│   ├── proto_old/        - Alpha 5 protobuf definitions (2026.1)
│   └── src/              - gRPC proxy server
├── api-version.config.js - API version configuration (Alpha 5/Beta 2)
└── vite-plugin-octane-grpc.ts - Embedded proxy plugin
```

---

## Service Layer Architecture

### BaseService Pattern
All services extend `BaseService` for consistent patterns:

```typescript
// services/octane/BaseService.ts
export abstract class BaseService {
  protected emitter: EventEmitter;
  protected serverUrl: string;

  protected emit(event: string, data?: unknown): void;
  protected on(event: string, handler: (...args: unknown[]) => void): void;
  protected off(event: string, handler: (...args: unknown[]) => void): void;
}
```

**Key Services**:
- `ApiService` - Core gRPC wrapper with objectPtr handling, service-to-ObjectType mapping
- `ConnectionService` - WebSocket lifecycle, auto-reconnect (5s delay), browser timing fixes
- `SceneService` - Recursive scene tree building (NodeGraphs → items, Nodes → pins)
- `NodeService` - Node CRUD, pin connections, group/ungroup, collapsed node cleanup
- `CameraService` - Camera position/target/up vectors, original state capture
- `ViewportService` - Viewport state, picker tools
- `RenderService` - Render pipeline (RenderEngine → RenderTarget → FilmSettings), render region
- `MaterialDatabaseService` - LocalDB (offline library) + LiveDB (online marketplace)
- `DeviceService` - GPU statistics, device info
- `RenderExportService` - Image export, render output
- `CommandHistory` - Undo/redo with branching behavior (50-action history)

**Main Facade**:
- `OctaneClient` - Aggregates all services, single entry point, event coordination

### Event-Driven Architecture
Services emit events for UI synchronization:
```typescript
// Service emits event
this.emit('node:created', { node });

// Component subscribes
client.on('node:created', ({ node }) => {
  setSceneTree(prev => [...prev, node]);
});
```

**Common Events**:
- `connection:changed` - Connection state updated
- `scene:loaded` - Scene tree loaded from Octane
- `node:selected` - Node selected in UI
- `node:created`, `node:deleted`, `node:updated` - Node operations
- `render:update` - New render frame received

---

## Component Architecture

### React Patterns
```typescript
// Functional components with hooks
const MyComponent: React.FC<Props> = ({ prop1, prop2 }) => {
  // State
  const [state, setState] = useState<Type>(initialValue);
  
  // Context
  const { client, connected } = useOctane();
  
  // Effects
  useEffect(() => {
    // Setup
    return () => {
      // Cleanup
    };
  }, [dependencies]);
  
  // Render
  return <div>...</div>;
};
```

### Key Components

#### **App.tsx**
- Root component
- Provides OctaneProvider context
- Manages panel layout with resizable splitters
- Coordinates communication between components

#### **NodeGraphEditor.tsx** (~1500 lines)
- ReactFlow-based node graph
- Custom node rendering via `OctaneNode.tsx`
- Context menus (node, canvas, edge)
- Connection logic and validation
- Search dialog (Ctrl+F)

#### **SceneOutliner/index.tsx**
- Recursive tree rendering
- Expand/collapse state management
- Icon mapping via `OctaneIconMapper`
- Tabs: Scene, LiveDB, LocalDB

#### **NodeInspector/index.tsx**
- Parameter editor for selected node
- Type-specific input components
- Real-time sync to Octane via `client.node.setPinValue()`

#### **CallbackRenderViewport/index.tsx**
- Render output display (canvas-based)
- Camera controls (orbit, pan, zoom)
- Picker tools integration
- HDR image decoding

---

## gRPC Integration

### Proto Files
Located in `server/proto/` (Beta 2) and `server/proto_old/` (Alpha 5):
```
apinodesystem_3.proto  - Node operations (create, delete, connect)
scenetree.proto        - Scene tree queries
viewport.proto         - Camera controls
render.proto           - Render control
callback.proto         - Streaming callbacks
```

### API Version Configuration

octaneWebR supports two Octane gRPC API versions with automatic compatibility:
- **Alpha 5 (2026.1)**: Proto files in `server/proto_old/`
- **Beta 2 (2026.1)**: Proto files in `server/proto/` (default)

#### Quick Switch Guide

**Edit ONE file**: `api-version.config.js` (line 22)
```javascript
const USE_ALPHA5_API = true;   // Alpha 5 (2026.1)
const USE_ALPHA5_API = false;  // Beta 2 (2026.1) - default
```

**Then rebuild and restart**:
```bash
npm run build && npm run dev
```

**That's it!** ✅ Both client and server automatically sync to the same version.

#### Architecture

```
api-version.config.js (ROOT - Single Source of Truth)
        ├──> vite-plugin-octane-grpc.ts (Server - CommonJS require)
        └──> client/src/config/apiVersionImport.ts (Bridge - ES module import)
                  └──> client/src/config/apiVersionConfig.ts (Client functions)
```

**Build Time**:
- Vite injects `__USE_ALPHA5_API__` constant into client bundle
- Server uses CommonJS `require()` to load config directly

**Runtime**:
- **Server**: Loads correct proto directory based on config
- **Client**: Transforms method names/parameters if needed (Alpha 5 mode)
- **Guaranteed Sync**: Impossible to mismatch versions

#### What Happens When You Switch

**When `USE_ALPHA5_API = true` (Alpha 5)**:
- ✅ Server loads proto files from `server/proto_old/`
- ✅ Client transforms Beta 2 method names → Alpha 5 method names
  - `getPinValueByPinID` → `getPinValue`
  - `getValueByAttrID` → `getByAttrID`
  - `setPinValueByPinID` → `setPinValue`
  - `setValueByAttrID` → `setByAttrID`
- ✅ Client transforms Beta 2 parameters → Alpha 5 parameters
  - `pin_id` → `id`
  - Removes `expected_type` field
  - `bool_value`, `int_value`, etc. → `value` (generic)

**When `USE_ALPHA5_API = false` (Beta 2)**:
- ✅ Server loads proto files from `server/proto/`
- ✅ Client uses Beta 2 method names directly (no transformation)
- ✅ Client uses Beta 2 parameters directly (no transformation)

#### Key API Differences

**Method Names**:
| Feature | Beta 2 Method | Alpha 5 Method |
|---------|---------------|----------------|
| Get pin value | `getPinValueByPinID` | `getPinValue` |
| Set pin value | `setPinValueByPinID` | `setPinValue` |
| Get item value | `getValueByAttrID` | `getByAttrID` |
| Set item value | `setValueByAttrID` | `setByAttrID` |

**Parameter Structure**:
| Parameter | Beta 2 | Alpha 5 |
|-----------|--------|---------|
| Pin ID | `pin_id` | `id` |
| Type validation | `expected_type` (required) | Not used |
| Value field | `bool_value`, `int_value`, `float_value`, etc. | `value` (generic) |

#### Verification

After switching, check console logs to confirm:

**Server Console (Terminal)**:
```
[OCTANE-SERVER] API Version: Alpha 5 (2026.1)
[OCTANE-SERVER] Proto directory: /workspace/project/octaneWebR/server/proto_old
```
or
```
[OCTANE-SERVER] API Version: Beta 2 (2026.1)
[OCTANE-SERVER] Proto directory: /workspace/project/octaneWebR/server/proto
```

**Client Console (Browser)**:
```
[DEBUG] 🔄 API Compatibility: getPinValueByPinID → getPinValue (Alpha 5)
```
or
```
[DEBUG] 🔄 API Compatibility: Using Beta 2 (no transformation)
```

#### Troubleshooting

**Error: "Method not found in service"**

**Cause**: Server loaded wrong proto files (doesn't have the method client is requesting)

**Fix**:
1. Verify you edited `api-version.config.js` (NOT individual config files)
2. Clear build cache: `rm -rf dist node_modules/.vite`
3. Rebuild: `npm run build`
4. Restart: `npm run dev`
5. Check console logs match expected version

**Error: "INVALID_ARGUMENT" or parameter errors**

**Cause**: Client sent wrong parameter structure for the API version

**Fix**: Same as above - ensure config is correct and rebuild

**Files You Should NOT Edit Directly**:
- ❌ `vite-plugin-octane-grpc.ts` - Now imports from centralized config
- ❌ `client/src/config/apiVersionConfig.ts` - Now imports from centralized config

These files **read** from `api-version.config.js`. Editing them has no effect.

### API Call Pattern
```typescript
// In service class
async myMethod(param: Type): Promise<ResultType> {
  try {
    const response = await this.apiService.callApi('ApiService', 'method', handle, {
      param1: value1,
      param2: value2
    });
    
    if (!response?.result) {
      Logger.error('❌ Method failed - no result');
      return null;
    }
    
    Logger.debug('✅ Method succeeded:', response.result);
    return response.result;
  } catch (error: any) {
    Logger.error('❌ Method error:', error.message);
    throw error;
  }
}
```

**Logging Conventions**:
- Use `Logger.*` instead of `console.*` (centralized, filterable)
- High-frequency operations → `Logger.debug()` (network checks, polling)
- Errors → `Logger.error()` with descriptive messages
- Warnings → `Logger.warn()` for non-critical issues
- User actions → `Logger.info()` or `Logger.success()`
- Network events → `Logger.network()` (connections, disconnects)
- API calls → `Logger.api(service, method, handle)` (optional, debug mode)

**gRPC Conventions**:
- Some services need objectPtr: `{ objectPtr: { handle: "123", type: ObjectType.NODE } }`
- Others use handle directly: `{ handle: 123 }`
- Check `OctaneTypes.ts` for service-to-ObjectType mapping
- Handle "0" means disconnected/null
- Always use `doCycleCheck: true` for pin connections (prevents crashes)

### Callback Streaming
Real-time render updates use WebSocket:
```typescript
// Server: callbackManager.ts
callbackManager.on('callback:triggered', (data) => {
  wsServer.broadcast({ type: 'callback', data });
});

// Client: RenderService.ts
this.socket.on('callback', (data) => {
  this.emit('render:update', data);
});
```

---

## Icon System

### Icon Mapping
Icons are mapped in several files:

```
constants/IconMapping.ts         - Node type icons (755+ mappings)
utils/UIIconMapping.ts           - UI control icons (buttons, menus)
utils/MenuIconMapping.ts         - Menu item icons
constants/ToolbarIconMapping.ts  - Toolbar button icons
```

### Icon Loader
```typescript
// utils/IconLoader.tsx
export const OctaneIcon: React.FC<{ type: string }> = ({ type }) => {
  const iconPath = getNodeIconPath(type);
  return <img src={iconPath} alt={type} />;
};
```

**Icon Files**: PNG files in `client/public/icons/`

### OctaneIconMapper
Utility class for icon and color mapping:
```typescript
// utils/OctaneIconMapper.ts
export class OctaneIconMapper {
  static getNodeIcon(type: string, name: string): string;
  static getPinGroupIcon(groupName: string): string;
  static formatNodeColor(color: { r, g, b }): string;
  static formatColorValue(value: any): string;
}
```

---

## Styling and Theming

### CSS Architecture
```
- CSS Modules for component isolation
- CSS Variables for theming
- No inline styles (except dynamic values)
- No hardcoded colors (use CSS variables)
```

### Theme System
Themes defined in `App.tsx`:
```typescript
const themes = {
  dark: {
    '--color-bg-primary': '#1e1e1e',
    '--color-text-primary': '#ffffff',
    // ... 50+ variables
  },
  light: {
    '--color-bg-primary': '#ffffff',
    '--color-text-primary': '#000000',
    // ...
  }
};
```

**Switching Themes**:
```typescript
const toggleTheme = () => {
  const newTheme = theme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
  applyTheme(newTheme);
  localStorage.setItem('theme', newTheme);
};
```

---

## Development Conventions

### Code Style
```typescript
// File naming: PascalCase for components, camelCase for utilities
MyComponent.tsx
myUtility.ts

// Imports: Group by type, alphabetically
import React, { useEffect, useState } from 'react';
import { OctaneClient } from './services/OctaneClient';
import { formatColor } from './utils/formatters';

// Types: Define interfaces before component
interface Props {
  prop1: string;
  prop2?: number; // Optional with ?
}

// Functions: Arrow functions for components and handlers
const MyComponent: React.FC<Props> = ({ prop1, prop2 = 0 }) => {
  const handleClick = () => {
    // Handler logic
  };
  
  return <button onClick={handleClick}>{prop1}</button>;
};

// Exports: Named exports for utilities, default for components
export default MyComponent;
export { myUtility };
```

### Error Handling
```typescript
// Service methods
async myMethod() {
  try {
    const result = await this.apiCall();
    return result;
  } catch (error) {
    console.error('[ServiceName] myMethod failed:', error);
    throw error; // Re-throw for caller to handle
  }
}

// Component error handling
const handleAction = async () => {
  try {
    await client.service.method();
  } catch (error) {
    console.error('Action failed:', error);
    // Show user-facing error message
  }
};
```

### Type Safety
```typescript
// Avoid 'any' - use specific types
const myFunc = (param: string): number => { /* ... */ };

// Use type guards for unknown data
function isNode(obj: unknown): obj is SceneNode {
  return typeof obj === 'object' && obj !== null && 'id' in obj;
}

// Leverage TypeScript inference
const data = await client.fetchData(); // Type inferred from return type
```

---

## Common Development Tasks

### Adding a New Service Method

1. **Check Proto File**
   ```bash
   grep -r "methodName" server/proto/
   ```

2. **Add Method to Service**
   ```typescript
   // services/octane/MyService.ts
   async myNewMethod(param: Type): Promise<ResultType> {
     try {
       const response = await fetch(`${this.serverUrl}/api/method`, {
         method: 'POST',
         body: JSON.stringify({ param })
       });
       const data = await response.json();
       return data;
     } catch (error) {
       console.error('[MyService] myNewMethod failed:', error);
       throw error;
     }
   }
   ```

3. **Expose in OctaneClient**
   ```typescript
   // services/OctaneClient.ts
   public get myService() {
     return {
       myNewMethod: (param: Type) => this._myService.myNewMethod(param)
     };
   }
   ```

4. **Use in Component**
   ```typescript
   const { client } = useOctane();
   const result = await client.myService.myNewMethod(param);
   ```

### Adding a New Component

1. **Create Component File**
   ```bash
   mkdir -p client/src/components/MyComponent
   touch client/src/components/MyComponent/index.tsx
   ```

2. **Implement Component**
   ```typescript
   // MyComponent/index.tsx
   import React from 'react';
   import { useOctane } from '../../hooks/useOctane';
   import styles from './MyComponent.module.css';
   
   export const MyComponent: React.FC = () => {
     const { client, connected } = useOctane();
     
     return (
       <div className={styles.container}>
         {/* Component content */}
       </div>
     );
   };
   ```

3. **Create Styles**
   ```css
   /* MyComponent.module.css */
   .container {
     background: var(--color-bg-primary);
     color: var(--color-text-primary);
   }
   ```

4. **Import in Parent**
   ```typescript
   import { MyComponent } from './components/MyComponent';
   ```

### Adding an Icon Mapping

1. **Verify Icon Exists**
   ```bash
   ls client/public/icons/ | grep "ICON_NAME"
   ```

2. **Add Mapping**
   ```typescript
   // constants/IconMapping.ts or utils/UIIconMapping.ts
   export const iconMap: Record<string, string> = {
     'MY_ICON_KEY': '/icons/MY_ICON_FILE.png',
     // ...
   };
   ```

3. **Use in Component**
   ```typescript
   import { getNodeIconPath } from '../constants/IconMapping';
   const iconPath = getNodeIconPath('MY_ICON_KEY');
   ```

---

## Testing and Debugging

### Standard Development & Testing Workflow

This is the proven workflow for making changes and testing them. Follow this routine for all development work.

#### 1. Stop Running Servers
```bash
# Kill any processes on dev ports
lsof -ti:57341,49019 2>/dev/null | xargs kill -9 2>/dev/null
echo "✅ Stopped all servers"
```

#### 2. Build Client
```bash
# Type check first (catches errors early)
npx tsc --noEmit
echo "✅ TypeScript compilation passed"

# Build production bundle
npm run build
echo "✅ Client build completed"

# Verify build output
ls -lh dist/client/assets/ | head -10
```

**Expected Output**:
```
dist/client/
├── assets/
│   ├── index-[hash].js      (~800KB)
│   ├── index-[hash].css     (~50KB)
│   └── vendor-[hash].js     (~600KB)
└── index.html
```

#### 3. Start Development Server
```bash
# Start fresh dev server
npm run dev &
DEV_PID=$!

# Wait for server to be ready
sleep 5

# Verify server is running
curl -s http://localhost:57341/api/health | python3 -m json.tool
```

**Expected Response**:
```json
{
  "status": "ok",
  "octane": "connected",
  "timestamp": 1737504000000
}
```

#### 4. Test in Browser
```bash
# Check server logs (should show):
# ✅ Vite dev server running at http://localhost:57341
# ✅ Connected to Octane at host.docker.internal:51022
# ✅ Callback registration successful
# ✅ WebSocket server listening
```

**Browser Checklist**:
1. Open `http://localhost:57341` in browser
2. Check browser console for connection logs:
   - ✅ "Connected to Octane"
   - ✅ "Scene tree loaded"
   - ✅ No errors
3. Test UI components:
   - Scene Outliner: Expand/collapse nodes
   - Node Graph Editor: Create/connect/delete nodes
   - Node Inspector: Edit parameters, test dropdowns
   - Viewport: Camera controls, render output

**Visual Verification**:
- Take screenshot for documentation if needed
- Check component rendering
- Verify icons load correctly
- Test interaction (click, hover, select)

#### 5. Test Feature-Specific Functionality

Example for **Node Type Dropdown** feature:
```javascript
// In browser console:
1. Select a node in Node Graph
2. Check Node Inspector shows dropdown
3. Open dropdown → verify compatible types shown
4. Select different type → verify node replacement
5. Check scene tree updated
6. Verify no console errors
```

#### 6. Review Logs
```bash
# Check for errors in terminal
# Look for:
# ✅ No TypeScript errors
# ✅ No gRPC connection errors
# ✅ No WebSocket disconnections
# ✅ No render callback failures
```

#### 7. Stop Servers (When Done Testing)
```bash
# Clean shutdown
kill $DEV_PID 2>/dev/null
lsof -ti:57341,49019 2>/dev/null | xargs kill -9 2>/dev/null
echo "✅ Stopped all servers"
```

### Quick Test Script

Save this as `test-dev.sh` in project root:

```bash
#!/bin/bash
set -e

echo "🧪 Starting development test routine..."

# 1. Stop servers
echo "1️⃣ Stopping existing servers..."
lsof -ti:57341,49019 2>/dev/null | xargs kill -9 2>/dev/null || true

# 2. Type check
echo "2️⃣ Running TypeScript check..."
npx tsc --noEmit

# 3. Build
echo "3️⃣ Building client..."
npm run build

# 4. Start server
echo "4️⃣ Starting dev server..."
npm run dev &
DEV_PID=$!

# 5. Wait and test
echo "5️⃣ Waiting for server..."
sleep 5
curl -s http://localhost:57341/api/health | python3 -m json.tool

echo ""
echo "✅ Dev server ready at http://localhost:57341"
echo "📋 Manual testing checklist:"
echo "   1. Open http://localhost:57341 in browser"
echo "   2. Check browser console for connection"
echo "   3. Test UI components"
echo "   4. Verify feature functionality"
echo ""
echo "⏹️  To stop: kill $DEV_PID"
```

Make executable: `chmod +x test-dev.sh`

### Manual Testing Checklist
```
✓ Start Octane with LiveLink enabled
✓ Start octaneWebR: npm run dev
✓ Open browser, check console for "Connected to Octane"
✓ Test node creation (right-click in Node Graph)
✓ Test node connection (drag pin to pin)
✓ Test parameter editing (Node Inspector)
✓ Test node type dropdown (select different compatible types)
✓ Test scene outliner (expand/collapse)
✓ Test camera controls (orbit, pan, zoom)
✓ Test picker tools (material, object, focus)
```

### Debugging Tools

#### Logger System
octaneWebR uses a centralized logging system with multiple levels:

```typescript
// utils/Logger.ts - Multi-level logger
import { Logger } from '../utils/Logger';

// Debug logs (development, high-frequency operations)
Logger.debug('🔍 Scene tree building:', nodeCount);

// Info logs (user actions, important events)
Logger.info('ℹ️ User saved scene:', filename);

// Success logs (positive confirmations)
Logger.success('✅ Connection established');

// Warning logs (non-critical issues)
Logger.warn('⚠️ No Film Settings found - using defaults');

// Error logs (failures requiring attention)
Logger.error('❌ Failed to load scene:', error.message);

// Network logs (connection events)
Logger.network('🌐 WebSocket connected');

// API logs (gRPC calls, debug only)
Logger.api('ApiNode', 'create', nodeHandle);
```

**Logger Distribution** (670+ calls):
- 66% DEBUG - Development/high-frequency (scene building, position updates)
- 24% ERROR - Failures and exceptions
- 9% WARN - Non-critical issues
- <1% INFO/SUCCESS/NETWORK/API - Special events

**Console Filtering**:
```javascript
// In browser console, filter by emoji prefix:
// 🔍 - Debug
// ❌ - Errors
// ⚠️ - Warnings
// ✅ - Success
// 🌐 - Network
```

#### Component Lifecycle Logging
```typescript
useEffect(() => {
  Logger.debug('[ComponentName] Mounted');
  return () => Logger.debug('[ComponentName] Unmounted');
}, []);

// Event logging
client.on('*', (event, data) => {
  Logger.debug('[Event]', event, data);
});
```

### Common Issues

**Issue**: gRPC call returns 500 error  
**Fix**: Check proto file has the method, verify parameter types

**Issue**: Scene tree not loading  
**Fix**: Check Octane has a scene loaded, click Refresh Scene (F5)

**Issue**: Parameter changes not syncing  
**Fix**: Verify `setPinValue()` is called with correct handle and attribute ID

**Issue**: Icons not showing  
**Fix**: Check icon file exists in `client/public/icons/`, verify mapping

**Issue**: TypeScript build fails  
**Fix**: Run `npx tsc --noEmit` to see specific errors, check for unused variables or incorrect types

---

## Build and Deployment

### Development Build
```bash
npm run dev
```
- Starts Vite dev server on port `58407`
- Hot module replacement enabled
- Source maps included

### Production Build
```bash
npm run build
```
- Output: `dist/client/`
- Minified and optimized
- Tree-shaking applied
- Source maps excluded

### Type Checking
```bash
npx tsc --noEmit
```
- Checks TypeScript types without building
- Fails on any type errors

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `client/src/App.tsx` | Root component, layout, panel management |
| `client/src/services/OctaneClient.ts` | Main API facade |
| `client/src/services/octane/SceneService.ts` | Scene operations |
| `client/src/components/NodeGraph/NodeGraphEditor.tsx` | Node graph editor |
| `client/src/components/NodeGraph/OctaneNode.tsx` | Custom ReactFlow node |
| `client/src/components/NodeInspector/index.tsx` | Parameter editor |
| `client/src/utils/OctaneIconMapper.ts` | Icon and color mapping |
| `client/src/constants/NodeTypes.ts` | Node type definitions (755+) |
| `vite-plugin-octane-grpc.ts` | Embedded gRPC proxy |
| `server/src/services/callbackManager.ts` | Callback streaming manager |

---

## External References

- **[Octane SE Manual](https://docs.otoy.com/standaloneSE/)** - Official UI reference
- **[ReactFlow Docs](https://reactflow.dev/)** - Node graph library
- **[gRPC Web](https://github.com/grpc/grpc-web)** - gRPC-Web protocol

---

## Working with This Project

### When Making Changes
1. **Check existing patterns** - Look at similar components/services
2. **Follow conventions** - Use established naming, structure, style
3. **Type everything** - No `any` types
4. **Test manually** - Verify with real Octane connection
5. **Check console** - Ensure no errors or warnings

### When Adding Features
1. **Verify in Manual** - Check [Octane SE Manual](https://docs.otoy.com/standaloneSE/)
2. **Check proto files** - Ensure gRPC API exists
3. **Follow service pattern** - Extend BaseService if needed
4. **Update UI** - Match Octane SE styling
5. **Document** - Add comments for complex logic

### When Debugging
1. **Check browser console** - Look for errors/warnings
2. **Check network tab** - Verify gRPC calls
3. **Check Octane** - Ensure LiveLink enabled, scene loaded
4. **Check types** - Run `npx tsc --noEmit`
5. **Check logs** - Look at service method logs

---

**This document is maintained to help AI assistants quickly understand octaneWebR architecture and development patterns.**
