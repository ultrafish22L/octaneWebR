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

### API Version Compatibility Layer (Jan 2025) ✅ COMPLETE
**What**: Static code flag system to support both Beta 2 and Alpha 5 gRPC APIs  
**Where**: `client/src/config/apiVersionConfig.ts`, `vite-plugin-octane-grpc.ts`, `ApiService.ts`  
**Current Config**: `USE_ALPHA5_API = true` (using Alpha 5 / proto_old)  
**Files Added**: `apiVersionConfig.ts`, `API_VERSION_COMPATIBILITY.md`, `COMPATIBILITY_ANALYSIS.md`, `COMPATIBILITY_VERIFICATION.md`  
**Status**: **FULLY VERIFIED - All transformations complete, zero errors**

**Architecture (3 Layers)**:
```
CLIENT CODE (Beta 2 style) 
  → CLIENT COMPATIBILITY LAYER (method name mapping, parameter transforms)
  → HTTP/JSON TRANSPORT
  → SERVER COMPATIBILITY LAYER (objectPtr → item_ref remapping)
  → GRPC CLIENT (native Alpha 5 or Beta 2 calls)
  → OCTANE LIVELINK SERVER
```

**Key Method Transformations**:
| Beta 2 | Alpha 5 | Client Transform | Server Transform |
|--------|---------|------------------|------------------|
| `getPinValueByPinID` | `getPinValue` | Method + params | objectPtr→item_ref |
| `setPinValueByPinID` | `setPinValue` | Method + params | objectPtr→item_ref |
| `getValueByAttrID` | `getByAttrID` | Method only | objectPtr→item_ref |
| `setValueByAttrID` | `setByAttrID` | Method only | objectPtr→item_ref |

**Parameter Transformations (getPinValue/setPinValue)**:
- `pin_id` → `id`
- `bool_value`/`int_value`/`float_value` → `value`
- `expected_type` → removed

**Proto Verification (2025-01-31)**:
✅ Verified `getByAttrID`/`setByAttrID` use IDENTICAL parameter structures in both versions
✅ No additional client-side transformations needed (only method name mapping)
✅ See `COMPATIBILITY_VERIFICATION.md` for full proto structure analysis

**Critical Fixes Applied**:
1. **Fix #1 (getByAttrID method not found)**: Added `USE_ALPHA5_API` flag to vite plugin to load correct proto files
2. **Fix #2 (558 "Invalid object type" errors)**: Added Alpha 5 method names (`getByAttrID`, `setByAttrID`) to server-side transformation condition (lines 689-690)
   - Root Cause: Server transformation only checked Beta 2 method names
   - Solution: Extended condition to include Alpha 5 method names
   - Commit: `e973c45`
   - Result: ✅ All errors eliminated
3. **Fix #3 (No images in render viewport)**: Changed callback handler to use images directly from stream instead of calling `grabRenderResult`
   - Root Cause: `OnNewImageRequest` already contains `render_images` field, but code was ignoring it and calling `grabRenderResult` separately
   - Solution: Extract images from `callbackRequest.newImage.render_images` directly
   - Proto: Both Alpha 5 and Beta 2 have identical `render_images` field in `OnNewImageRequest`
   - Result: ✅ Real-time image updates working, lower latency, more reliable
   - See: `CALLBACK_FIX.md` for detailed analysis

**Callback Compatibility**:
✅ Callbacks use IDENTICAL method names and signatures in both versions:
- `setOnNewImageCallback` (same in Alpha 5 and Beta 2)
- `setOnNewStatisticsCallback` (same in Alpha 5 and Beta 2)
- StreamCallbackService streaming: same in both versions
- **No transformations needed for callbacks**

⚠️ **Don't use `grabRenderResult` for real-time callbacks**:
- `grabRenderResult()` is for manual polling, not callback-based streaming
- Callback stream already contains image data in `callbackRequest.newImage.render_images`
- Using `grabRenderResult` with callbacks adds latency and can cause timing issues

**Currently Used Methods Audit (75+ methods)**:
- ✅ All 27 ApiRenderEngine methods: Compatible (same names in both versions)
- ✅ All 11 ApiNode methods: Compatible (2 transformed, 9 same)
- ✅ All 8 ApiItem methods: Compatible (same names)
- ✅ All 6 ApiNodeGraph methods: Compatible (same names)
- ✅ All 7 ApiProjectManager methods: Compatible (same names)
- ✅ 16 more services: All compatible
- See `COMPATIBILITY_ANALYSIS.md` for full method matrix

**⚠️ CRITICAL - Server Architecture**:
- Vite plugin (`vite-plugin-octane-grpc.ts`) IS the server (embedded in Vite dev server)
- `server/` directory contains separate Express server - **NOT USED** by `npm run dev`
- All transformations MUST be in vite plugin, not `server/src/index.ts`

**Usage** (switching versions):
```typescript
// In client/src/config/apiVersionConfig.ts
export const USE_ALPHA5_API = true;  // false for Beta 2, true for Alpha 5
// Rebuild and restart
```

**Debug Logging**:
```javascript
// Browser console shows transformations when enabled:
🔄 API Compatibility: getPinValueByPinID → getPinValue (Alpha 5)
🔄 API Compatibility: Parameter transformation applied
```

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

## Recent Important Fixes

### Centralized API Version Config (2025-01-31) ⭐ LATEST
**Problem**: When switching between Alpha 5 and Beta 2, users had to edit TWO config files. Mismatched configs caused "Method not found" errors.  
**Root Cause**: Client and server had separate `USE_ALPHA5_API` constants that could get out of sync.  
**Solution**: Created single source of truth in `api-version.config.js` at project root.

**Files Changed**:
- **NEW**: `api-version.config.js` - Single source of truth (line 22)
- **NEW**: `client/src/config/apiVersionImport.ts` - ES module bridge
- **UPDATED**: `vite-plugin-octane-grpc.ts` (line 40) - Now imports from centralized config
- **UPDATED**: `client/src/config/apiVersionConfig.ts` (line 50) - Now imports from centralized config
- **NEW**: `API_VERSION_SWITCHING.md` - Complete switching guide

**How to Switch API Versions** (Old Way ❌ vs New Way ✅):

```bash
# ❌ OLD WAY - Error prone, had to edit 2 files
# Edit vite-plugin-octane-grpc.ts line 35
# Edit client/src/config/apiVersionConfig.ts line 46
# Easy to forget one, causing version mismatch

# ✅ NEW WAY - Edit ONE file only!
# Edit api-version.config.js line 22:
const USE_ALPHA5_API = true;   // Alpha 5
const USE_ALPHA5_API = false;  // Beta 2

# Then rebuild and restart
npm run build && npm run dev
```

**Architecture**:
```
api-version.config.js (ROOT - Single Source)
     ├──> Server (vite-plugin-octane-grpc.ts)
     └──> Client (apiVersionImport.ts → apiVersionConfig.ts)
```

**What Gets Synchronized**:
- ✅ Proto file directory selection (server/proto vs server/proto_old)
- ✅ Method name transformation (getPinValueByPinID → getPinValue)
- ✅ Parameter transformation (pin_id → id, expected_type removal)

**Previous Bug Pattern** (Now Impossible):
- Alpha 5 in client + Beta 2 in server = "Method getPinValue not found" ❌
- Beta 2 in client + Alpha 5 in server = "Method getPinValueByPinID not found" ❌
- Now: Always synchronized automatically ✅

**Verification**: After switching, check logs:
```
[OCTANE-SERVER] API Version: Alpha 5 (2026.1)
[OCTANE-SERVER] Proto directory: /workspace/project/octaneWebR/server/proto_old
```

**Documentation**: See `API_VERSION_SWITCHING.md` for complete guide.

---

### Beta 2 API Configuration (2025-01-31) [SUPERSEDED BY CENTRALIZED CONFIG]
**Problem**: "Method not found" errors when testing Beta 2 Octane (`getPinValueByPinID`, `getValueByAttrID`)  
**Root Cause**: Both client and server configured for Alpha 5 while testing Beta 2  
**Files**: `vite-plugin-octane-grpc.ts` line 35, `client/src/config/apiVersionConfig.ts` line 46

**Critical Rule**: `USE_ALPHA5_API` must match in BOTH files!

```typescript
// ❌ MISMATCH - causes method resolution failures
// Server: USE_ALPHA5_API = true   (Alpha 5 protos)
// Client: USE_ALPHA5_API = false  (Beta 2 method names)

// ✅ CORRECT - both must be the same
// Alpha 5: Set BOTH to true
// Beta 2:  Set BOTH to false
```

**API Differences**:
- Beta 2: `getPinValueByPinID`, `getValueByAttrID`
- Alpha 5: `getPinValue`, `getByAttrID`

**Documentation**: See `BETA2_ANALYSIS.md` for full compatibility details.

---

### Callback Streaming Fix (2025-01-31)
**Problem**: Render callback images weren't displaying; mouse camera controls not working  
**Root Cause**: `StreamCallbackService` mapped to non-existent `callbackstream.proto` instead of `callback.proto`  
**Location**: `vite-plugin-octane-grpc.ts` line 139

```typescript
// ❌ WRONG - file doesn't exist
'StreamCallbackService': 'callbackstream.proto',

// ✅ CORRECT - service defined in callback.proto
'StreamCallbackService': 'callback.proto',
```

**Key Discovery**: Canvas visibility controlled by `frameCount > 0`
- No callbacks → frameCount stays 0 → canvas hidden (`display: 'none'`)
- Hidden canvas = no mouse interactions
- Fix proto mapping → callbacks flow → frameCount increments → canvas visible

**Lesson**: Always verify proto file mappings match actual service definitions in `.proto` files.

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

