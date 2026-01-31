# AGENTS.md - octaneWebR Repository Memory

**Repository skill for AI assistants - Always loaded**

This file provides essential context about the octaneWebR project. For specialized knowledge, see `.openhands/skills/`.

---

## Project Overview

**octaneWebR** is a React/TypeScript web UI clone of Octane Render Studio that communicates with Octane via gRPC LiveLink API.

### Core Principles

- **No Mocking**: All features use real Octane gRPC connections
- **UI Clone**: Interface matches [Octane SE Manual](https://docs.otoy.com/standaloneSE/)
- **Modern React**: Functional components, hooks, Context API
- **Theme System**: CSS variables (no inline styles, no hardcoded colors)

### Tech Stack

```
React 18 + TypeScript 5 + Vite 5
ReactFlow v12 (node graph)
React Context API (state management)
gRPC-Web (Octane communication)
CSS Variables (theming)
```

---

## Essential Commands

### Development

```bash
# Type check
npx tsc --noEmit

# Build production
npm run build

# Dev server (ports: 57341, 49019)
npm run dev

# Kill servers
lsof -ti:57341,49019 | xargs kill -9
```

### Health Check

```bash
curl -s http://localhost:57341/api/health | python3 -m json.tool
# Expected: { "status": "ok", "octane": "connected" }
```

---

## Repository Structure

```
octaneWebR/
├── client/src/
│   ├── components/               # React UI components
│   │   ├── NodeInspector/        # Parameter editor panel
│   │   ├── NodeGraph/            # ReactFlow node graph
│   │   ├── SceneOutliner/        # Scene tree (virtual scrolling)
│   │   └── CallbackRenderViewport/  # Live render display
│   ├── services/octane/          # gRPC service wrappers
│   │   ├── NodeService.ts        # Node CRUD, connections
│   │   ├── SceneService.ts       # Scene tree building
│   │   ├── RenderService.ts      # Render pipeline
│   │   └── ...
│   ├── services/
│   │   ├── OctaneClient.ts       # Main API facade
│   │   └── CommandHistory.ts     # Undo/redo system
│   ├── constants/
│   │   ├── NodeTypes.ts          # 755+ node definitions
│   │   ├── PinTypes.ts           # Pin-to-node compatibility
│   │   └── IconMapping.ts        # Icon paths
│   ├── styles/
│   │   ├── octane-theme.css      # 134 CSS variables
│   │   └── *.css                 # Component styles
│   └── App.tsx
├── server/proto/                 # gRPC proto files
├── .openhands/skills/            # On-demand AI knowledge
├── README.md                     # Project overview
├── QUICKSTART.md                 # Setup guide
├── DEVELOPMENT.md                # Dev guide & architecture
├── MODERNIZATION_GUIDE.md        # Future improvements
└── CHANGELOG.md                  # Version history
```

---

## Architecture Patterns

### Service Layer

```typescript
export class MyService extends BaseService {
  async myMethod(param: Type): Promise<Result> {
    // 1. Make gRPC call
    const result = await this.apiService.callApi(...);

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

  // 2. Context
  const { client, connected } = useOctane();

  // 3. Effects (with cleanup!)
  useEffect(() => {
    const handler = (data: DataType) => setState(data);
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

### Custom Hooks Pattern

Extract logic into reusable hooks:

```typescript
// hooks/useMyFeature.ts
export function useMyFeature(props: Props) {
  const [state, setState] = useState<State>(initial);

  const handleAction = useCallback(() => {
    // Logic here
  }, [deps]);

  return { state, handleAction };
}

// Component.tsx
const { state, handleAction } = useMyFeature({ ... });
```

---

## Code Conventions

### TypeScript

- ✅ Strict mode (no `any` except documented cases)
- ✅ Named exports for utilities, default for components
- ✅ Define interfaces before components
- ✅ Arrow functions everywhere
- ✅ Explicit return types for exported functions

### Styling

- ✅ Use CSS variables: `var(--bg-primary)`, `var(--accent-blue)`
- ✅ No inline styles (except dynamic transforms/positions)
- ✅ CSS files per component/feature area
- ❌ Never hardcode colors or spacing

### File Naming

- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
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

// 5. Styles (last)
import './MyComponent.css';
```

---

## Recent Major Changes

### 2025-02-01: Refactoring Completion ✅

**SceneOutliner Hook Extraction**

- Extracted 786 lines into 5 custom hooks
- Main component: 996 → 268 lines (73% reduction)
- Added keyboard navigation and ARIA roles

**ParameterControl Component**

- Extracted parameter rendering from NodeInspector
- Clean separation: data fetching vs rendering
- Fixed color picker regressions (AT_FLOAT3 texture pins)

**Virtual Scrolling**

- React-window for scene tree performance
- TreeFlattener utility for expansion state
- Auto-expansion of scene root at startup

**Bug Fixes**

- Fixed color pickers not showing for stereo filters
- Fixed scene outliner not expanding at startup
- Fixed AT_FLOAT3 parameters with PT_TEXTURE outType

### 2025-01-31: API Version System ✅

**Centralized Configuration**

- Single file: `api-version.config.js`
- Vite injects build-time constants
- Both Alpha 5 and Beta 2 supported

**To Switch Versions**:

1. Edit `api-version.config.js` line 24
2. Restart: `npm run dev`

### 2025-01-31: CSS Theme Refactor ✅

**CSS Variable Cleanup**

- Removed `octane-` prefix (753 occurrences)
- Bundle size: 104.44 KB → 99.18 KB (-5%)
- 134 semantic variables: `--bg-primary`, `--text-primary`, etc.

**CSS Optimization**

- Removed 6 unused variables
- Removed 5 dead selectors
- Fixed 10+ duplicate definitions
- Replaced all hardcoded colors

---

## Common Patterns

### Event-Driven Communication

```typescript
// Service emits:
this.emit('node:created', { handle, type });
this.emit('node:deleted', { handle });

// Component listens:
useEffect(() => {
  const handler = data => {
    /* update state */
  };
  client.on('node:created', handler);
  return () => client.off('node:created', handler); // CLEANUP!
}, [client]);
```

### Value Fetching Pattern

```typescript
// useParameterValue.ts
export function useParameterValue(node, client, isEndNode) {
  const [paramValue, setParamValue] = useState(null);

  useEffect(() => {
    const fetchValue = async () => {
      if (!isEndNode) return;
      const value = await client.getByAttrID(...);
      setParamValue(value);
    };
    fetchValue();
  }, [node, isEndNode]);

  return { paramValue, handleValueChange };
}
```

### Tree Expansion State

```typescript
// useTreeExpansion.ts
export function useTreeExpansion({ sceneTree, ... }) {
  const [expansionMap, setExpansionMap] = useState(new Map());

  // Auto-initialize when tree loads
  useEffect(() => {
    if (sceneTree.length > 0 && expansionMap.size === 0) {
      setExpansionMap(initializeExpansionMap(sceneTree));
    }
  }, [sceneTree, expansionMap.size]);

  return { flattenedNodes, handleToggleExpansion, ... };
}
```

---

## Critical Implementation Details

### Color Parameter Detection

AT_FLOAT3 parameters can have different outTypes:

- `PT_FLOAT` → Regular float3, may be color
- `PT_TEXTURE` → Hybrid texture pin that can hold RGB values
- Check `floatInfo.isColor` OR `nodeType === 'NT_TEX_RGB'`
- **MUST fetch values even for PT_TEXTURE pins!**

### Scene Outliner Expansion

- Only ONE `useTreeExpansion` instance per component
- Auto-initializes when `sceneTree.length > 0`
- Scene root (`type: 'SceneRoot'`) expands by default

### Node Handle Types

- Handles are **numbers** from Octane API
- Handle `0` = disconnect/empty
- Handle `-1` = synthetic root node

### Service Initialization

```typescript
// Services extend BaseService for events
class MyService extends BaseService {
  constructor(apiService: ApiService) {
    super(); // Initialize event emitter
    this.apiService = apiService;
  }
}
```

---

## Debugging Checklist

When investigating issues:

1. **Browser Console** - Errors, warnings, network calls
2. **React DevTools** - Component state, props, hooks
3. **Network Tab** - gRPC calls, WebSocket connection
4. **TypeScript** - `npx tsc --noEmit` for type errors
5. **Octane** - LiveLink enabled? Port 51022 open?
6. **Logs** - Check `Logger.debug()` output (INFO level default)

### Common Issues

- **Empty UI controls** → Value fetch logic skipping parameter
- **Tree collapsed** → Expansion map not initialized
- **Connection errors** → Check API version match
- **TypeScript errors** → Missing types, wrong imports
- **Style not applying** → Use CSS variable, check specificity

---

## Documentation

### Main Docs

- **README.md** - Project overview, features, quick start
- **QUICKSTART.md** - First-time setup
- **DEVELOPMENT.md** - Dev guide, architecture, API switching
- **MODERNIZATION_GUIDE.md** - Future improvements (React Query, testing, etc.)
- **CHANGELOG.md** - Version history
- **AGENTS.md** - This file (AI assistant context)

### External Resources

- [Octane SE Manual](https://docs.otoy.com/standaloneSE/) - UI reference
- [React 18 Docs](https://react.dev/) - Component patterns
- [ReactFlow v12](https://reactflow.dev/) - Node graph library
- [Vite](https://vitejs.dev/) - Build tool

---

## Current Status

**Version**: 1.0.0  
**Status**: P1 Modernization Complete (Error Boundaries + Code Splitting)  
**Next**: P2 - Suspense Boundaries + React Query (2-3 days estimate)

**Key Stats**:

- ~17,000 lines of TypeScript
- 35+ React components
- 11 gRPC service wrappers
- 755+ Octane node types
- 134 CSS variables

**Recent Milestone** (2025-02-03):

- ✅ Error Boundaries implemented (react-error-boundary)
- ✅ Code Splitting complete (lazy load NodeGraph + MaterialDatabase)
- ✅ Suspense boundaries with loading states
- ✅ Bundle size reduction: 587KB → ~150-200KB initial
- 📦 Next: React Query for data fetching

---

**Last Updated**: 2025-02-03
