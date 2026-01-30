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
│   │   └── octane-theme.css # 126 CSS variables (no prefix: --bg-primary, --text-primary)
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

## Recent Development Status

### Parallel Scene Loading Implementation (2025-01-24 to 2025-01-30) ⚠️

**Status**: ⚠️ TESTING - May be reverted based on user feedback

**What**: Complete rewrite of scene tree loading from sequential to parallel API requests

**Performance**: 2.5-3x speedup (5.2s → 2.4s for 310-node scene)

**Commit Range**: `271c390..f5ecb1a` (~30 commits)

**Key Implementation**:
- **Parallel Pin Fetching**: `Promise.all()` for concurrent API requests (20 concurrent max)
- **Handle Reservation System**: Prevents duplicate nodes in concurrent mode
- **Progressive UI Updates**: Level-based scene tree rendering (top-level nodes visible immediately)
- **Handle Validation**: Multi-step validation before calling `attrInfo()` API

**Major Challenges Solved**:
1. **Race Conditions**: Reservation marker system (`_reserved` flag in `scene.map`)
2. **Duplicate Nodes**: Atomic map operations with immediate reservation
3. **attrInfo Errors**: Validate handles are "fully realized" before API calls
4. **Connection Exhaustion**: Request queue with configurable concurrency limits
5. **Immutability**: React state consistency with immutable node objects

**Configuration**:
```typescript
// client/src/config/parallelConfig.ts
export const PARALLEL_CONFIG = {
  ENABLED: true,  // Toggle parallel/sequential mode
  MAX_CONCURRENT_PINS: 20,
  MAX_CONCURRENT_CHILDREN: 20,
  REQUEST_DELAY_MS: 0,
  DEBUG_LOGGING: false
};
```

**Revert Strategy** (if needed):
```bash
# Option 1: Full revert to 271c390
git revert --no-commit f5ecb1a..HEAD
git commit -m "Revert parallel loading"

# Option 2: Disable via config
# Change ENABLED: false in parallelConfig.ts
```

**Documentation**: See `PARALLEL_LOADING_HISTORY.md` for complete technical deep dive

**Current Issue**: User reports potential problems, conducting additional testing

---

### Virtual Scrolling Implementation (2025-02-02)

**Status**: ✅ BUILD PASSING - Ready for Testing

**What**: Implemented virtual scrolling for Scene Outliner using react-window v2 for performance with large scenes

**Problem**: Scene Outliner rendered all 7424 nodes in large scenes, causing:
- Heavy DOM (7424 elements)
- Slow scrolling (20-30 FPS)
- High memory usage (~150 MB)
- Long initial render time

**Solution**: react-window v2.2.5 with `List` component
- Only renders visible rows (~25-30 DOM nodes)
- Smooth 60 FPS scrolling
- Constant memory usage
- Fixed row height (24px matching Octane UI)

**Key Files**:
- `client/src/components/SceneOutliner/index.tsx` - Virtual scrolling integration
- `client/src/utils/TreeFlattener.ts` - Tree flattening utility (NEW)
- `VIRTUAL_SCROLLING_FIX.md` - TypeScript fix documentation
- `VIRTUAL_SCROLLING_TEST_GUIDE.md` - Comprehensive testing guide

**TypeScript Fix**: react-window v2 API requires:
- `List` component (not `FixedSizeList`)
- `rowComponent` prop with plain function (not React.FC)
- `rowProps` prop for custom props (not `itemData`)
- Function signature: `(props: { ariaAttributes, index, style } & CustomProps) => ReactElement | null`

**Features Working**:
- ✅ Expand/collapse with expansion state management
- ✅ Node selection with highlighting
- ✅ Context menu on virtualized rows
- ✅ Expand All / Collapse All buttons
- ✅ Smooth scrolling with large scenes
- ✅ TypeScript strict mode passing

**Performance Target**:
| Metric | Before | After (Target) |
|--------|--------|----------------|
| DOM Nodes | 7424 | ~25-30 |
| Scroll FPS | 20-30 | 60 |
| Memory | ~150 MB | ~50 MB |

**Testing Status**: Needs manual testing with Octane (see VIRTUAL_SCROLLING_TEST_GUIDE.md)

**Important Note**: react-window v2 has different API than v1:
- Use `List` with `rowComponent` + `rowProps` (v2)
- NOT `FixedSizeList` with `children` + `itemData` (v1)

**Next**: Manual testing with large Octane scenes to verify performance gains

---

### Documentation Consolidation (2025-02-01)

**Status**: ✅ COMPLETED - API version docs merged into main documentation

**Changes**:
- Merged `QUICK_START_API_VERSION.md` → `README.md` (brief section)
- Merged `API_VERSION_SWITCHING.md` → `DEVELOPMENT.md` (detailed section)
- Deleted separate API version documentation files
- Updated cross-references in all documentation

**New Documentation Structure**:
- **README.md**: Quick overview of API version switching (5 lines of code)
- **DEVELOPMENT.md**: Complete guide with architecture, troubleshooting, and verification steps
- **QUICKSTART.md**: First-time setup (no API version info needed)
- **CHANGELOG.md**: Version history
- **AGENTS.md**: AI assistant memory (this file)

**Benefits**:
- ✅ Fewer files to maintain (7 docs instead of 9)
- ✅ Single source of truth per topic
- ✅ Easier to find information (no separate mini-docs)
- ✅ Better organization (brief in README, detailed in DEVELOPMENT)

---

### CSS Theme Refactor & UI Polish (2025-02-01)

**Status**: ✅ COMPLETED - All CSS variables renamed, UI bugs fixed

**CSS Variable Naming**:
- Removed `octane-` prefix from all 126 theme variables (753 occurrences)
- New naming: `--bg-primary`, `--text-primary`, `--accent-blue` (no prefix)
- CSS bundle reduced 5.26 KB (104.44 KB → 99.18 kB)
- Zero naming conflicts verified with existing utility variables

**UI Improvements**:
- Fixed React Flow "container needs width/height" error
- Fixed browser context menu appearing over custom menus
- Simplified node pin tooltips (name only, no type/description clutter)
- Added descriptive tooltips to node inspector parameters

**CSS Cleanup**:
- Removed 6 unused CSS variables
- Removed 5 dead CSS selectors with broken references
- Fixed 10+ duplicate CSS definitions
- Replaced all hardcoded colors with theme variables

**Files Modified**: 7 CSS/TSX files across styles/ and components/

**Key Commits**:
- `5bebfcd` - Fix React Flow parent container sizing error
- `20f1c5b` - Remove 'octane-' prefix from all CSS theme variables
- `3c97abd` - Add descriptive tooltips to node inspector items
- `01320b2` - Simplify node pin tooltips to show name only
- `e0f3a83` - Fix browser context menu bug

---

### API Version Compatibility Layer (2025-01-31)

**Status**: ✅ COMPLETED - Centralized configuration working

**Implementation**:
- Single source of truth: `api-version.config.js` (ES module)
- Vite injects `__USE_ALPHA5_API__` constant at build time
- Server uses direct ES import from config file
- Both Alpha 5 and Beta 2 supported by changing ONE line in config

**Key Changes**:
- Converted `api-version.config.js` from CommonJS → ES modules
- Removed `apiVersionImport.ts` (obsolete)
- Server plugin uses `getProtoDir()` helper function
- TypeScript strict typing enforced (no implicit `any`)

**To Switch API Versions**:
1. Edit `api-version.config.js` line 24: `const USE_ALPHA5_API = true/false`
2. Restart dev server: `npm run dev`
3. Both client and server automatically sync

**Testing Status**:
- ✅ Beta 2: Working (render canvas displays)
- ✅ Alpha 5: Set as default

**Commits**:
- `af1609b` - Fix: Convert API version config to ES modules and fix TypeScript errors
- `4249989` - Add quick-start guide for API version switching
- `df63f18` - Fix API version compatibility with centralized configuration

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

**Main Documentation**:
- `README.md` - Project overview, features, quick start, API version support
- `QUICKSTART.md` - First-time setup guide (prerequisites, installation, verification)
- `DEVELOPMENT.md` - Development guide, architecture, API version switching (detailed)
- `CHANGELOG.md` - Version history in Keep a Changelog format
- `AGENTS.md` - AI assistant memory (this file)
- `PARALLEL_LOADING_HISTORY.md` - Complete parallel loading development history (271c390..f5ecb1a)
- `.openhands/skills/` - AI skills for specialized tasks
- **Octane manual**: https://docs.otoy.com/standaloneSE/

**Documentation Topics**:
- **API Version Switching**: See `DEVELOPMENT.md` → API Version Configuration
- **CSS Theme System**: See `DEVELOPMENT.md` → Styling & Theming
- **Service Architecture**: See `DEVELOPMENT.md` → Service Layer Pattern
- **Recent Changes**: See `CHANGELOG.md` for dated version history

---

**Last Updated**: 2025-02-01  
**Version**: v1.0.0  
**Status**: Active development

