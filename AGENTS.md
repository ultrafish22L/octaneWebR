# AGENTS.md - octaneWebR Repository Memory

**OpenHands permanent agent context - Always loaded**

This file provides essential repository knowledge for AI assistants. For detailed domain-specific knowledge, see the `.openhands/skills/` directory.

---

## Project Overview

**octaneWebR** is a React/TypeScript web UI clone of Octane Render Studio Standalone Edition that communicates with a live instance of Octane via the gRPC LiveLink API.

### Core Principles
- **No Mocking**: All features use real Octane gRPC connections
- **UI Clone**: Interface matches [Octane SE Manual](https://docs.otoy.com/standaloneSE/)
- **Service Architecture**: Event-driven service layer + reactive UI
- **Theme System**: CSS variables for all styling (no inline styles, no hardcoded colors)

### Tech Stack
```
React 18 + TypeScript 5 + Vite 5
ReactFlow (node graph)
Zustand (state management)
gRPC-Web (Octane communication)
```

---

## Essential Commands

### Development
```bash
# Type check
npx tsc --noEmit

# Build production bundle
npm run build

# Start dev server (ports: 57341, 49019)
npm run dev

# Kill servers
lsof -ti:57341,49019 | xargs kill -9
```

### Health Check
```bash
curl -s http://localhost:57341/api/health | python3 -m json.tool
# Should return: { "status": "ok", "octane": "connected" }
```

### Quick Test Workflow
```bash
# 1. Stop servers
lsof -ti:57341,49019 | xargs kill -9

# 2. Type check + build
npx tsc --noEmit && npm run build

# 3. Start dev server
npm run dev &

# 4. Test in browser: http://localhost:57341
# 5. Check console: ✅ Connected to Octane, ✅ Scene tree loaded
```

---

## Repository Structure

```
octaneWebR/
├── client/src/
│   ├── components/          # React UI components
│   │   ├── NodeInspector/   # Properties panel (node type dropdown)
│   │   ├── NodeGraph/       # ReactFlow visual graph editor
│   │   ├── SceneOutliner/   # Scene tree hierarchy view
│   │   ├── CallbackRenderViewport/  # Live render output
│   │   └── ...
│   ├── services/octane/     # gRPC service layer
│   │   ├── NodeService.ts       # Node CRUD, connections
│   │   ├── SceneService.ts      # Scene graph queries
│   │   ├── ViewportService.ts   # Render operations
│   │   └── ...
│   ├── services/OctaneClient.ts  # Main API client
│   ├── constants/
│   │   ├── NodeTypes.ts     # 755+ node type definitions
│   │   ├── PinTypes.ts      # Pin-to-node-type compatibility (PT_TO_NT)
│   │   └── IconMapping.ts   # Icon path mappings
│   ├── styles/
│   │   └── octane-theme.css # 134 CSS variables (--octane-*)
│   └── App.tsx
├── server/proto/            # gRPC proto definitions
├── .openhands/skills/       # On-demand knowledge (see below)
├── DEVELOPMENT.md           # Human-readable dev guide
├── QUICKSTART.md            # Setup instructions
└── CHANGELOG.md             # Version history
```

---

## Architecture Patterns

### Service Layer
```typescript
export class MyService extends BaseService {
  async myMethod(param: Type): Promise<Result> {
    // 1. Make gRPC call
    const result = await this.grpcCall(param);
    
    // 2. Emit event for UI sync
    this.emit('event:name', { data: result });
    
    // 3. Return result
    return result;
  }
}
```

### Component Pattern
```typescript
const MyComponent: React.FC<Props> = ({ prop }) => {
  // 1. State
  const [state, setState] = useState<Type>(initial);
  
  // 2. Context/hooks
  const { client, connected } = useOctane();
  
  // 3. Effects (with cleanup!)
  useEffect(() => {
    const handler = (data) => setState(data);
    client.on('event:name', handler);
    return () => client.off('event:name', handler);
  }, [client]);
  
  // 4. Handlers
  const handleAction = async () => {
    if (!connected) return;
    await client.service.method();
  };
  
  // 5. Render
  return <div>{/* JSX */}</div>;
};
```

### Event-Driven Communication
```typescript
// Service emits:
this.emit('node:created', { handle, type });
this.emit('node:deleted', { handle });
this.emit('node:replaced', { oldHandle, newHandle });

// Components listen:
client.on('node:created', handler);
// Don't forget cleanup: client.off('node:created', handler);
```

---

## Code Conventions

### TypeScript
- ✅ Strict mode (no `any` types)
- ✅ Named exports for utilities, default for components
- ✅ Define interfaces before components
- ✅ Arrow functions everywhere

### Styling
- ✅ Use `var(--octane-*)` CSS variables (defined in `octane-theme.css`)
- ✅ No inline styles (except dynamic transforms, positions)
- ✅ CSS Modules for component styles
- ❌ Never hardcode colors or spacing values

### File Naming
- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Styles: `kebab-case.css`

### Import Order
```typescript
// 1. External deps
import React, { useState } from 'react';

// 2. Services
import { OctaneClient } from './services/OctaneClient';

// 3. Components
import { NodeGraph } from './components/NodeGraph';

// 4. Types
import type { SceneNode } from './types';

// 5. Styles
import styles from './MyComponent.module.css';
```

---

## Recent Features

### Logger System (Jan 2025) ✅
**What**: Centralized logging system replacing all console.* calls (670+ logs)  
**Where**: `client/src/utils/Logger.ts`  
**Methods**: `Logger.debug()`, `Logger.error()`, `Logger.warn()`, `Logger.info()`, `Logger.success()`, `Logger.network()`, `Logger.api()`  
**Usage**: 
- High-frequency operations → `Logger.debug()` (scene building, position updates)
- Errors → `Logger.error()` with descriptive messages
- User actions → `Logger.info()` or `Logger.success()`
- Network events → `Logger.network()` (connections, disconnects)
**Emoji Prefixes**: 🔍 (debug), ❌ (error), ⚠️ (warn), ✅ (success), 🌐 (network)  
**Status**: Complete (66% DEBUG, 24% ERROR, 9% WARN)

### Code Documentation (Jan 2025) ✅
**What**: Enhanced 7 core service files with architectural documentation  
**Where**: `services/octane/*.ts`, `services/CommandHistory.ts`  
**Key Additions**:
- gRPC conventions (objectPtr requirements, service mappings)
- WebSocket timing fixes (50ms delay rationale)
- Scene tree building strategy (NodeGraph vs Node traversal)
- Pin connection model (cycle checking, handle "0" = disconnect)
- Render pipeline structure (RenderEngine → RenderTarget → FilmSettings)
- Undo/redo branching behavior (new action discards redo stack)
**Status**: Complete (created DOCUMENTATION_IMPROVEMENTS.md)

### Tab Bar UI Refinements (Jan 2025) ✅
**What**: Added tab bars to Scene Outliner and Node Graph Editor matching Octane SE styling  
**Where**: `scene-outliner.css`, `node-graph.css`, `App.tsx`  
**Key Details**:
- Right-slanted trapezoid tabs using `clip-path: polygon()`
- Z-index stacking for proper left-to-right overlap effect
- Active tab: `--octane-bg-secondary`, Inactive: `--octane-bg-lighter`
- Node Graph: Vertical toolbar (26px width) on left, tabs to right in horizontal row
- Constrained tab width (max-width: 120px) matching reference screenshots
**Status**: Complete

### Node Type Dropdown (Jan 2025) ✅
**What**: Change a node's type via dropdown while preserving graph position  
**Where**: NodeInspector component (`client/src/components/NodeInspector/index.tsx`)  
**How**: Uses `PT_TO_NT` mapping to show compatible types, calls `replaceNode()` service method  
**Files Modified**: `NodeInspector/index.tsx`, `NodeService.ts`, `OctaneClient.ts`  
**Status**: Fully implemented and tested

**Key Implementation**:
```typescript
// NodeService.ts
async replaceNode(oldHandle: number, newType: string): Promise<number> {
  const parents = await this.getNodeParents(oldHandle);  // BEFORE delete!
  const newHandle = await this.createNode(newType);
  for (const p of parents) {
    await this.connectPinByIndex(p.parentHandle, p.pinIndex, newHandle);
  }
  await this.deleteNode(oldHandle);
  this.emit('node:replaced', { oldHandle, newHandle, newType });
  return newHandle;
}
```

### API Version Compatibility Layer (Jan 2025) ✅
**What**: Static code flag system to support both Beta 2 and Alpha 5 gRPC APIs  
**Where**: `client/src/config/apiVersionConfig.ts`, `vite-plugin-octane-grpc.ts`, `ApiService.ts`  
**How**: Synchronized flags in both client and server trigger automatic method name translation, parameter transformation, and proto file selection  
**Files Added**: `apiVersionConfig.ts`, `API_VERSION_COMPATIBILITY.md`  
**Files Modified**: `ApiService.ts`, `vite-plugin-octane-grpc.ts`  
**Status**: Complete and fully functional

**Key Differences**:
- **Method Names**: `getPinValueByPinID` (Beta 2) → `getPinValue` (Alpha 5)
- **ApiItem Methods**: `getValueByAttrID` (Beta 2) → `getByAttrID` (Alpha 5)
- **Parameters**: `pin_id` → `id`, `bool_value` → `value`, removes `expected_type`
- **Proto Files**: `server/proto/` (Beta 2) ↔ `server/proto_old/` (Alpha 5)
- **Logging**: Console shows `🔄 API Compatibility:` when transformations occur

**Usage** (Must sync BOTH files):
```typescript
// 1. In client/src/config/apiVersionConfig.ts
export const USE_ALPHA5_API = true;  // Change from false to true

// 2. In vite-plugin-octane-grpc.ts (line ~35)
const USE_ALPHA5_API = true;  // Must match client setting

// 3. Rebuild and restart
```

**Critical Fix #1 (Jan 2025)**: Added `USE_ALPHA5_API` flag to `vite-plugin-octane-grpc.ts` to ensure server loads correct proto files (`proto_old/` for Alpha 5). Without this, server was loading Beta 2 proto definitions while client was calling Alpha 5 methods, causing "Method getByAttrID not found" errors.

**Critical Fix #2 (Jan 2025)**: Fixed "Invalid object type for ApiItem" errors (558 occurrences) by implementing proper Alpha 5 parameter transformation. 
- **Root Cause**: Alpha 5's `getValueByIDRequest` expects `item_ref` field, not `objectPtr`
- **Solution**: Parameter transformation in `vite-plugin-octane-grpc.ts` (lines 689-695) converts `objectPtr` → `item_ref` for ApiItem methods
- **Critical Discovery**: App uses **vite-plugin-octane-grpc.ts** as server, NOT `server/src/index.ts`! Initial fix was applied to wrong file.
- **Actual Fix (commit e973c45)**: Added Alpha 5 method names (`getByAttrID`, `setByAttrID`) to existing transformation condition in vite plugin
- **Method Names**: Client conditionally uses `getByAttrID` (Alpha 5) vs `getValueByAttrID` (Beta 2)
- **Reference**: Based on old `vite-plugin-octane-grpc.ts` parameter remapping logic (lines 683-699)
- **Result**: Alpha 5 value fetching now works correctly for simple types (PT_BOOL, PT_INT, PT_FLOAT, PT_STRING, PT_ENUM)

**How It Works**:
1. `getCompatibleMethodName()` translates method names (Beta 2 → Alpha 5)
2. `transformRequestParams()` converts parameter structure
3. `ApiService.callApi()` applies both before making gRPC request
4. **Vite plugin proxy** transforms `objectPtr` → `item_ref` for Alpha 5 ApiItem methods (lines 689-695)
5. NodeInspector conditionally calls `getByAttrID` (Alpha 5) or `getValueByAttrID` (Beta 2)
6. NodeInspector filters nodes by `outType` to only fetch values for simple types
7. All existing code continues to use Beta 2 style (no changes needed)

**⚠️ IMPORTANT - Server Architecture**:
- The app uses **`vite-plugin-octane-grpc.ts`** as the gRPC proxy server (embedded in Vite dev server)
- The `server/` directory contains a separate Express server implementation, but it's **NOT USED** by `npm run dev`
- All API transformations and gRPC logic must be implemented in the **vite plugin**, not in `server/src/index.ts`

### Server Logging Control (Jan 2025) ✅
**What**: Debug flag to control server-side logging with clear tagging  
**Where**: `vite-plugin-octane-grpc.ts` (lines 22-42)  
**Flag**: `DEBUG_SERVER_LOGS` (default: `false`)  
**Tag**: All server logs prefixed with `[OCTANE-SERVER]`  
**Functions**: `serverLog()`, `serverError()`, `serverWarn()`, `serverInfo()`  
**Status**: Complete (63 server logs controlled, CLIENT logs always visible)

**Usage**:
```typescript
// In vite-plugin-octane-grpc.ts
const DEBUG_SERVER_LOGS = true;  // Change from false to enable logs
// Restart dev server to apply changes
```

**Key Benefits**:
- **Cleaner Console**: Server logs hidden by default, only client logs visible
- **Easy Toggle**: Single flag to enable/disable all server logs
- **Clear Tagging**: `[OCTANE-SERVER]` prefix makes source obvious when enabled
- **Preserved CLIENT Logs**: Client-side forwarded logs always visible regardless of flag

**Example Output (when enabled)**:
```
[OCTANE-SERVER] 📡 Vite gRPC Plugin: Connected to Octane at host.docker.internal:51022
[OCTANE-SERVER] 🐳 Using Docker networking (sandbox environment detected)
[OCTANE-SERVER] 📦 Proto files ready for lazy loading from: /workspace/project/octaneWebR/server/proto
```

---

## Skills System (On-Demand Knowledge)

For detailed domain knowledge, see `.openhands/skills/`:

### `.openhands/skills/octane-grpc/` 
**Triggers**: grpc, proto, api, service layer  
**Contains**: gRPC call patterns, proto file usage, service architecture, common operations

### `.openhands/skills/node-inspector/`
**Triggers**: node inspector, properties, parameters, dropdown  
**Contains**: NodeInspector architecture, node type dropdown details, parameter editing

### `.openhands/skills/scene-graph/`
**Triggers**: scene, outliner, tree, graph, hierarchy  
**Contains**: Scene graph structure, tree traversal, node relationships, outliner patterns

### `.openhands/skills/testing-workflow/`
**Triggers**: test, debug, workflow, build, verify  
**Contains**: Complete testing routine, debugging techniques, visual debugging, server management

### `.openhands/skills/react-patterns/`
**Triggers**: react, component, hook, state, zustand  
**Contains**: Component patterns, custom hooks, performance optimization, Zustand usage

---

## Common Quick Tasks

### Add gRPC Service Method
1. Find proto: `grep -r "MethodName" server/proto/`
2. Add to service: `services/octane/MyService.ts`
3. Expose in `OctaneClient.ts`
4. Use in component via `useOctane()`

### Add Icon
1. Check: `ls client/public/icons/ | grep "name"`
2. Map: `constants/IconMapping.ts` → `iconMap['KEY'] = '/icons/file.png'`
3. Use: `getNodeIconPath('KEY')`

### Debug Checklist
1. Browser console (errors?)
2. Network tab (gRPC calls?)
3. TypeScript check: `npx tsc --noEmit`
4. Server logs (connection status?)
5. Octane LiveLink enabled?

---

## Updating This File

**When to update AGENTS.md**:
- ✅ New major features (with concise summary)
- ✅ Changed architecture patterns
- ✅ New essential commands or workflows
- ✅ Important code conventions
- ✅ Clever debugging discoveries that apply broadly
- ✅ New dependencies or tech stack changes

**What NOT to put here** (use skills or docs instead):
- ❌ Detailed implementation steps (→ `.openhands/skills/`)
- ❌ Specific bug fixes (→ `CHANGELOG.md`)
- ❌ Complete testing workflows (→ `.openhands/skills/testing-workflow/`)
- ❌ Extensive code examples (→ `.openhands/skills/`)
- ❌ Human setup instructions (→ `QUICKSTART.md`, `DEVELOPMENT.md`)

**Before adding knowledge**:
1. **Ask yourself**: "Will this be useful for DIFFERENT future tasks?"
2. **Ask user**: "Should I add these items to AGENTS.md?" (list numbered items)
3. **Get approval**: User may want only a subset
4. **Integrate cleanly**: Reorganize if needed for clarity

**Example of good additions**:
- "When replacing nodes, ALWAYS get parent connections BEFORE deletion"
- "Use visual debugging with Elements tab to verify component renders"
- "Node handles are numbers, not strings"

---

## Reference Documentation

**For humans**: See `README.md`, `QUICKSTART.md`, `DEVELOPMENT.md`, `CHANGELOG.md`  
**For AI skills**: See `.openhands/skills/` directory  
**Octane manual**: https://docs.otoy.com/standaloneSE/

---

**Last Updated**: 2025-01-30  
**Version**: v1.0.0  
**Status**: Active development

