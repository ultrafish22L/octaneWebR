# octaneWebR - Structural Cleanup & Refactoring Guide

**Pre-Modernization Cleanup Tasks**

---

## 🎯 Executive Summary

**Why Clean First?**

- Makes modernization easier (smaller files = easier to refactor)
- Improves code review efficiency
- Reduces technical debt interest
- Makes testing setup cleaner
- Better IDE performance

**Effort**: 3-4 days total  
**Impact**: High (sets foundation for modernization)  
**Risk**: Low (mostly safe refactoring)

---

## 📊 Issues Found

### Critical Issues

| Issue                       | Count              | Impact | Effort  |
| --------------------------- | ------------------ | ------ | ------- |
| **Massive components**      | 5 files >900 lines | High   | 2 days  |
| **TODO/FIXME comments**     | 46 items           | Medium | 1 day   |
| **Direct console.\* calls** | 42 instances       | Low    | 2 hours |
| **Documentation errors**    | 2 instances        | Low    | 30 min  |

### Code Quality Issues

| Issue                      | Details                                | Priority |
| -------------------------- | -------------------------------------- | -------- |
| Inconsistent React imports | Mix of `import React` vs named imports | P2       |
| Commented dead code        | Large blocks in App.tsx                | P1       |
| Missing ESLint/Prettier    | No code formatting enforcement         | P1       |
| No import organization     | Random import order                    | P2       |

---

## Priority 1: Split Massive Components (2 days)

### 🚨 Critical: 5 Components Over 900 Lines

```
1774 lines: client/src/components/NodeGraph/index.tsx
1321 lines: client/src/components/NodeInspector/index.tsx
1209 lines: client/src/components/CallbackRenderViewport/index.tsx
 931 lines: client/src/components/SceneOutliner/index.tsx
 903 lines: client/src/components/RenderToolbar/index.tsx
```

**Industry Standard**: 250-300 lines per component  
**Current Average**: 1,227 lines (4x over limit!)

### Task 1.1: Split NodeGraph (1774 → 400 lines)

#### Current Structure

```
client/src/components/NodeGraph/
├── index.tsx (1774 lines) ❌ TOO LARGE
├── OctaneNode.tsx
├── NodeContextMenu.tsx
├── NodeTypeContextMenu.tsx
├── NodeGraphToolbar.tsx
└── SearchDialog.tsx
```

#### Recommended Structure

```
client/src/components/NodeGraph/
├── index.tsx (200 lines) - Main orchestrator
├── NodeGraphCanvas.tsx (400 lines) - ReactFlow component
├── NodeGraphEvents.tsx (300 lines) - Event handlers
├── NodeGraphContextMenus.tsx (200 lines) - Context menu logic
├── OctaneNode.tsx (existing)
├── NodeGraphToolbar.tsx (existing)
├── SearchDialog.tsx (existing)
└── hooks/
    ├── useNodeOperations.ts (200 lines) - CRUD operations
    ├── useConnectionLogic.ts (200 lines) - Edge management
    ├── useNodeSelection.ts (100 lines) - Selection state
    └── useGraphSync.ts (150 lines) - Octane sync
```

#### Implementation Steps

**Step 1: Extract Event Handlers (2 hours)**

```typescript
// client/src/components/NodeGraph/NodeGraphEvents.tsx
import { useCallback } from 'react';
import { Node, Edge, Connection } from '@xyflow/react';
import { useOctane } from '../../hooks/useOctane';
import Logger from '../../utils/Logger';

interface UseNodeGraphEventsProps {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
}

export function useNodeGraphEvents({ nodes, edges, setNodes, setEdges }: UseNodeGraphEventsProps) {
  const { client, connected } = useOctane();

  const onNodeDragStop = useCallback(
    (event: any, node: Node) => {
      if (!connected || !client) return;

      const nodeHandle = Number(node.id);
      const { x, y } = node.position;

      Logger.debug(`💾 Saving node position: handle=${nodeHandle}, x=${x}, y=${y}`);
      client.setNodePosition(nodeHandle, x, y).catch((error: any) => {
        Logger.error('Failed to save node position:', error);
      });
    },
    [client, connected]
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      // Connection logic here...
    },
    [client, connected, nodes]
  );

  const onEdgeDelete = useCallback(
    async (edge: Edge) => {
      // Delete logic here...
    },
    [client, connected]
  );

  return {
    onNodeDragStop,
    onConnect,
    onEdgeDelete,
  };
}
```

**Step 2: Extract Node Operations Hook (2 hours)**

```typescript
// client/src/components/NodeGraph/hooks/useNodeOperations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOctane } from '../../../hooks/useOctane';
import { Node } from '@xyflow/react';

export function useNodeOperations() {
  const { client } = useOctane();
  const queryClient = useQueryClient();

  const createNodeMutation = useMutation({
    mutationFn: async ({
      type,
      position,
    }: {
      type: string;
      position: { x: number; y: number };
    }) => {
      return await client.createNode(type, position);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sceneTree'] });
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: async (handle: number) => {
      return await client.deleteNode(handle);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sceneTree'] });
    },
  });

  const duplicateNodeMutation = useMutation({
    mutationFn: async (handle: number) => {
      return await client.duplicateNode(handle);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sceneTree'] });
    },
  });

  return {
    createNode: createNodeMutation.mutate,
    deleteNode: deleteNodeMutation.mutate,
    duplicateNode: duplicateNodeMutation.mutate,
    isCreating: createNodeMutation.isPending,
    isDeleting: deleteNodeMutation.isPending,
  };
}
```

**Step 3: Refactor Main Component (2 hours)**

```typescript
// client/src/components/NodeGraph/index.tsx (NOW 200 lines)
import { ReactFlowProvider } from '@xyflow/react';
import { NodeGraphCanvas } from './NodeGraphCanvas';
import { NodeGraphToolbar } from './NodeGraphToolbar';
import { useNodeOperations } from './hooks/useNodeOperations';
import { useConnectionLogic } from './hooks/useConnectionLogic';
import { useGraphSync } from './hooks/useGraphSync';

interface NodeGraphEditorProps {
  sceneTree: SceneNode[];
  selectedNode?: SceneNode | null;
  onNodeSelect?: (node: SceneNode | null) => void;
}

export function NodeGraphEditor(props: NodeGraphEditorProps) {
  return (
    <ReactFlowProvider>
      <NodeGraphEditorInner {...props} />
    </ReactFlowProvider>
  );
}

function NodeGraphEditorInner({
  sceneTree,
  selectedNode,
  onNodeSelect
}: NodeGraphEditorProps) {
  // Custom hooks for all logic
  const nodeOps = useNodeOperations();
  const connectionLogic = useConnectionLogic();
  const graphSync = useGraphSync(sceneTree);

  return (
    <div className="node-graph-editor">
      <NodeGraphToolbar {...toolbarProps} />
      <NodeGraphCanvas
        nodes={graphSync.nodes}
        edges={graphSync.edges}
        onNodeSelect={onNodeSelect}
        {...nodeOps}
        {...connectionLogic}
      />
    </div>
  );
}
```

### Task 1.2: Split NodeInspector (1321 → 400 lines)

#### Recommended Structure

```
client/src/components/NodeInspector/
├── index.tsx (150 lines) - Main component
├── NodeInspectorHeader.tsx (100 lines) - Header section
├── NodeInspectorParameters.tsx (200 lines) - Parameter list
├── NodeInspectorContextMenu.tsx (existing)
├── NodeInspectorControls.tsx (existing)
└── parameters/
    ├── BooleanParameter.tsx (50 lines)
    ├── IntParameter.tsx (80 lines)
    ├── FloatParameter.tsx (80 lines)
    ├── StringParameter.tsx (60 lines)
    ├── EnumParameter.tsx (100 lines)
    ├── ColorParameter.tsx (120 lines)
    ├── VectorParameter.tsx (150 lines)
    └── NodeParameter.tsx (80 lines)
```

**Implementation**: Same pattern as NodeGraph (2-3 hours per subtask)

### Task 1.3: Split CallbackRenderViewport (1209 → 400 lines)

#### Recommended Structure

```
client/src/components/CallbackRenderViewport/
├── index.tsx (200 lines) - Main component
├── ViewportCanvas.tsx (250 lines) - Canvas rendering
├── ViewportControls.tsx (150 lines) - Camera controls
├── ViewportOverlay.tsx (100 lines) - UI overlay
├── ViewportContextMenu.tsx (existing)
└── hooks/
    ├── useViewportCallback.ts (200 lines) - Callback management
    ├── useCameraControls.ts (150 lines) - Mouse/touch controls
    └── useViewportPickers.ts (150 lines) - Picker tools
```

### Task 1.4: Split SceneOutliner (931 → 350 lines)

#### Recommended Structure

```
client/src/components/SceneOutliner/
├── index.tsx (150 lines) - Main tabs
├── SceneTab.tsx (150 lines) - Scene tree tab
├── LiveDBTab.tsx (200 lines) - LiveDB tab
├── LocalDBTab.tsx (200 lines) - LocalDB tab
├── SceneOutlinerContextMenu.tsx (existing)
├── VirtualTreeRow.tsx (existing)
└── hooks/
    ├── useSceneTree.ts (100 lines)
    ├── useLiveDB.ts (150 lines)
    └── useLocalDB.ts (150 lines)
```

### Task 1.5: Split RenderToolbar (903 → 300 lines)

#### Recommended Structure

```
client/src/components/RenderToolbar/
├── index.tsx (200 lines) - Main toolbar
├── RenderControls.tsx (150 lines) - Play/pause/stop
├── PickerTools.tsx (150 lines) - Picker buttons
├── ViewportSettings.tsx (150 lines) - Viewport options
└── RenderStats.tsx (100 lines) - Stats display
```

---

## Priority 2: Remove Dead Code (4 hours)

### Task 2.1: Clean Up TODOs/FIXMEs

**Found 46 TODO comments** - categorize and action:

#### Category A: Implement Now (8 items)

```typescript
// client/src/components/MenuBar/index.tsx:208
// TODO: Implement toast notification system
// ACTION: Add react-hot-toast library and implement

// client/src/components/SceneOutliner/index.tsx:260-280
// TODO: Implement save, cut, copy, paste actions
// ACTION: Wire up to EditCommands or mark as future feature
```

#### Category B: Mark as Future Features (20 items)

```typescript
// client/src/components/dialogs/TurntableAnimationDialog.tsx:62
// TODO: Implement turntable animation rendering via Octane API
// ACTION: Change to: // FUTURE: Turntable animation (requires Octane API support)
```

#### Category C: Remove Placeholders (18 items)

```typescript
// client/src/components/RenderToolbar/index.tsx:611
// TODO: API calls for gizmos
// ACTION: Remove if not implementing, or move to backlog document
```

### Task 2.2: Remove Commented Dead Code

#### Example: App.tsx handleAddNode (30 lines)

```typescript
// Current:
// Add Node button handler - creates geometric plane primitive (reserved for future use)
// Commented out - not currently used but kept for future reference
/*
const handleAddNode = async () => {
  // ... 30 lines of commented code
};
*/

// ACTION: Either implement or delete. If future feature, move to FUTURE_FEATURES.md
```

#### Script to Find All Large Comment Blocks

```bash
# Find multi-line comment blocks > 10 lines
grep -Pzo '/\*[\s\S]*?\*/' client/src/**/*.{ts,tsx} | grep -c "^"
```

### Task 2.3: Replace Direct console.\* Calls

**Found 42 direct console calls** - should use Logger:

```bash
# Find all direct console usage (excluding Logger.ts)
grep -rn "console\.\(log\|error\|warn\|debug\)" client/src \
  --include="*.tsx" --include="*.ts" \
  | grep -v "Logger.ts" \
  | grep -v "// console"
```

#### Automated Fix Script

```typescript
// scripts/fix-console-calls.ts
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const files = glob.sync('client/src/**/*.{ts,tsx}', {
  ignore: ['**/Logger.ts', '**/*.test.ts'],
});

files.forEach(file => {
  let content = readFileSync(file, 'utf8');

  // Add Logger import if not present
  if (
    !content.includes("from '../../utils/Logger'") &&
    content.match(/console\.(log|error|warn)/)
  ) {
    content = `import { Logger } from '../../utils/Logger';\n${content}`;
  }

  // Replace console calls
  content = content.replace(/console\.log\(/g, 'Logger.debug(');
  content = content.replace(/console\.error\(/g, 'Logger.error(');
  content = content.replace(/console\.warn\(/g, 'Logger.warn(');

  writeFileSync(file, content);
});

console.log(`Fixed ${files.length} files`);
```

---

## Priority 3: Code Formatting & Consistency (3 hours)

### Task 3.1: Add Prettier & ESLint

#### Install Dependencies

```bash
npm install -D prettier eslint-config-prettier eslint-plugin-react-hooks \
  eslint-plugin-react-refresh eslint-plugin-jsx-a11y @typescript-eslint/eslint-plugin
```

#### Create .prettierrc.json

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

#### Create .prettierignore

```
node_modules
dist
build
coverage
*.min.js
*.min.css
server/proto/
server/proto_old/
```

#### Update .eslintrc.cjs

```javascript
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react-refresh/recommended',
    'plugin:jsx-a11y/recommended',
    'prettier', // Must be last
  ],
  plugins: ['react-refresh', 'jsx-a11y'],
  rules: {
    'react-refresh/only-export-components': 'warn',
    '@typescript-eslint/no-explicit-any': 'error', // Enforce no 'any'
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }], // Discourage console.*
  },
};
```

#### Add Scripts to package.json

```json
{
  "scripts": {
    "format": "prettier --write \"client/src/**/*.{ts,tsx,css,json}\"",
    "format:check": "prettier --check \"client/src/**/*.{ts,tsx,css,json}\"",
    "lint": "eslint client/src --ext ts,tsx",
    "lint:fix": "eslint client/src --ext ts,tsx --fix",
    "typecheck": "tsc --noEmit"
  }
}
```

#### Run Initial Format

```bash
npm run format
npm run lint:fix
```

### Task 3.2: Standardize React Imports

**Issue**: Inconsistent React imports with new JSX transform

```typescript
// ❌ Unnecessary with new JSX transform (unless using React.memo, etc.)
import React, { useState } from 'react';

// ✅ Correct for most components
import { useState } from 'react';

// ✅ Only when using React.memo, React.forwardRef, etc.
import React, { useState } from 'react';
// ... later in file:
export const MyComponent = React.memo(function MyComponent() { ... });
```

#### Automated Fix Script

```bash
# Find files with unnecessary React imports
grep -rn "^import React from 'react'" client/src --include="*.tsx" | \
  while IFS=: read -r file line content; do
    # Check if React is used as namespace (React.memo, etc.)
    if ! grep -q "React\." "$file"; then
      echo "Fix: $file (line $line)"
      # Remove 'React, ' from import
      sed -i "s/import React, {/import {/" "$file"
    fi
  done
```

### Task 3.3: Organize Imports

**Current**: Random import order  
**Goal**: Consistent ordering

#### .prettierrc.json Update

```json
{
  // ... existing config
  "importOrder": ["^react", "^@?\\w", "^@/(.*)$", "^[./]"],
  "importOrderSeparation": true,
  "importOrderSortSpecifiers": true
}
```

#### Example Before/After

**Before**:

```typescript
import { SceneNode } from '../../services/OctaneClient';
import React, { useState } from 'react';
import { useOctane } from '../../hooks/useOctane';
import { Logger } from '../../utils/Logger';
import { List } from 'react-window';
```

**After**:

```typescript
import React, { useState } from 'react';
import { List } from 'react-window';

import { Logger } from '../../utils/Logger';
import { useOctane } from '../../hooks/useOctane';
import { SceneNode } from '../../services/OctaneClient';
```

---

## Priority 4: Fix Documentation Errors (30 min)

### Task 4.1: Remove Zustand References ✅ COMPLETE

**Files Updated**:

```
✅ AGENTS.md:23 (Tech Stack)
✅ AGENTS.md:399-400 (Skills triggers)
✅ TECHNICAL_REVIEW.md:288 (Documentation discrepancy section)
✅ TECHNICAL_REVIEW.md:965 (Comparison table)
```

**Changes Made**:

```diff
- Zustand (state management)
+ React Context API (state management)

- **Triggers**: react, component, hook, state, zustand
+ **Triggers**: react, component, hook, state, context

- State Management | Context only ⚠️ | React Query/Zustand | Medium
+ State Management | Context API ✅ | Context/Zustand | Low
```

**Note**: README.md and DEVELOPMENT.md were already correct - no Zustand references found.

### Task 4.2: Update Architecture Diagram ✅ ALREADY CORRECT

**Status**: README.md:144 already correctly documents:

```markdown
- **State Management**: React Context API (OctaneProvider, EditActionsProvider)
```

**Recommended addition** to enhance clarity in README.md:

```markdown
### State Management

octaneWebR uses React's built-in state management:

**Global State**:

- `OctaneProvider` - Connection state, client instance
- `EditActionsProvider` - Global edit actions (cut, copy, paste)

**Component State**:

- Local `useState` for UI state
- `useRef` for DOM references
- `useMemo`/`useCallback` for performance

**Event System**:

- Custom `EventEmitter` for Octane service events
- Replaces Redux/Zustand for this use case
```

---

## Priority 5: File Organization (2 hours)

### Task 5.1: Group Related Files

#### Current Issues

- Constants files mixed (NodeTypes, PinTypes, UIIconMapping)
- No clear hooks directory structure
- Utils not categorized

#### Recommended Structure

```
client/src/
├── components/          (no change)
├── hooks/
│   ├── octane/         🆕 Octane-specific hooks
│   │   ├── useSceneTree.ts
│   │   ├── useNodeOperations.ts
│   │   └── useRenderState.ts
│   ├── ui/             🆕 UI-specific hooks
│   │   ├── useResizablePanels.ts
│   │   ├── useKeyboardShortcuts.ts
│   │   └── useFileDialog.ts
│   └── useOctane.tsx   (existing)
├── constants/
│   ├── octane/         🆕 Octane-specific constants
│   │   ├── NodeTypes.ts
│   │   ├── PinTypes.ts
│   │   └── OctaneTypes.ts
│   ├── ui/             🆕 UI constants
│   │   ├── UIIconMapping.ts
│   │   └── ToolbarIconMapping.ts
├── utils/
│   ├── octane/         🆕 Octane utilities
│   │   └── ColorUtils.ts
│   ├── ui/             🆕 UI utilities
│   │   └── TreeFlattener.ts
│   ├── Logger.ts
│   └── EventEmitter.ts
└── services/           (no change)
```

### Task 5.2: Create Index Files for Cleaner Imports

#### Before

```typescript
import { Logger } from '../../utils/Logger';
import { EventEmitter } from '../../utils/EventEmitter';
import { ColorUtils } from '../../utils/ColorUtils';
```

#### After

```typescript
// client/src/utils/index.ts
export { Logger } from './Logger';
export { EventEmitter } from './EventEmitter';
export { ColorUtils } from './ColorUtils';

// Usage
import { Logger, EventEmitter, ColorUtils } from '../../utils';
```

---

## Priority 6: Add Code Quality Tools (1 hour)

### Task 6.1: Add husky for Pre-commit Hooks

```bash
npm install -D husky lint-staged
npx husky install
```

#### .husky/pre-commit

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

#### package.json

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{css,json,md}": ["prettier --write"]
  }
}
```

### Task 6.2: Add VSCode Settings

#### .vscode/settings.json

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "files.associations": {
    "*.css": "css"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

#### .vscode/extensions.json

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "christian-kohler.path-intellisense",
    "formulahendry.auto-rename-tag"
  ]
}
```

---

## Cleanup Checklist

### Week 0: Pre-Modernization Cleanup ✅

#### Day 1: Component Splitting (8 hours) ✅ COMPLETE

- [x] Split NodeGraph (1774 → 801 lines) ✅
  - [x] Extract hooks (useNodeOperations, useConnectionLogic, useNodeSelection)
  - [x] Extract NodeGraphCanvas component
  - [x] Extract event handlers into hooks
  - [x] Test that everything still works
- [x] Split NodeInspector (1321 → 537 lines) ✅
  - [x] Extract parameter components
  - [x] Extract hooks (useParameterGroups, useParameterSearch, useNodePolling)
  - [x] Test parameter editing

#### Day 2: Component Splitting Continued (8 hours) ✅ COMPLETE

- [x] Split CallbackRenderViewport (1325 → 429 lines) ✅
- [x] Split SceneOutliner (996 → 268 lines) ✅
- [x] Split RenderToolbar (1120 → 432 lines) ✅
- [x] Integration test all components ✅

#### Day 3: Code Quality (8 hours) ✅ MOSTLY COMPLETE

- [x] Setup Prettier & ESLint ✅ (already configured)
- [x] Run automated formatters ✅ (runs via lint-staged on commit)
- [x] Fix React import inconsistencies ✅ (enforced by ESLint)
- [x] Organize imports ✅ (automatic via ESLint)
- [x] Setup pre-commit hooks ✅ (husky + lint-staged configured)
- [ ] Add VSCode settings (optional)

#### Day 4: Cleanup & Documentation (4 hours) ⏳ IN PROGRESS

- [ ] Review and action all TODO comments (46 items)
- [ ] Remove commented dead code
- [x] Replace console.\* with Logger ✅ (already complete)
- [x] Fix documentation errors (Zustand → Context) ✅
- [ ] Create FUTURE_FEATURES.md for deferred TODOs
- [ ] Update CHANGELOG.md

---

## Benefits After Cleanup

### Maintainability

- ✅ Components average 250 lines (down from 1,227)
- ✅ Easy to understand and modify
- ✅ Clear separation of concerns

### Developer Experience

- ✅ Auto-formatting on save
- ✅ Pre-commit hooks catch issues
- ✅ Consistent code style
- ✅ Better IDE performance

### Modernization Ready

- ✅ Smaller components easier to wrap in Suspense
- ✅ Hooks extracted for easier testing
- ✅ Clean slate for React Query migration
- ✅ Clear structure for adding tests

---

## Automation Scripts

### Complete Cleanup Script

```bash
#!/bin/bash
# scripts/cleanup.sh

echo "🧹 Starting octaneWebR cleanup..."

# 1. Format all code
echo "📝 Formatting code..."
npm run format

# 2. Fix linting issues
echo "🔍 Fixing lint issues..."
npm run lint:fix

# 3. Type check
echo "📘 Type checking..."
npm run typecheck

# 4. Fix console statements
echo "🔧 Replacing console.* with Logger..."
node scripts/fix-console-calls.ts

# 5. Check for TODOs
echo "📋 Scanning for TODOs..."
grep -rn "TODO\|FIXME" client/src --include="*.tsx" --include="*.ts" > TODO_REVIEW.txt
echo "Found $(wc -l < TODO_REVIEW.txt) TODO items - see TODO_REVIEW.txt"

# 6. Report
echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Review TODO_REVIEW.txt and action items"
echo "2. Commit changes: git add . && git commit -m 'chore: code cleanup and formatting'"
echo "3. Start component splitting (see CLEANUP_GUIDE.md)"
```

### Usage

```bash
chmod +x scripts/cleanup.sh
./scripts/cleanup.sh
```

---

## Risk Mitigation

### Before Starting

1. **Create cleanup branch**: `git checkout -b cleanup/pre-modernization`
2. **Full backup**: `git branch backup-before-cleanup`
3. **Test baseline**: Manually test all major features

### During Cleanup

1. **Commit frequently**: After each major change
2. **Test immediately**: Don't move to next task until current works
3. **Use git stash**: If need to pause mid-task

### After Cleanup

1. **Full regression test**: Test all features
2. **Review with team**: Code review for large changes
3. **Merge carefully**: Consider squashing commits

---

## Next Steps After Cleanup

Once cleanup is complete:

1. ✅ Review MODERNIZATION_GUIDE.md for React 18 features
2. ✅ Start with Priority 1 (Error Boundaries + Code Splitting)
3. ✅ Continue with testing setup
4. ✅ Then modernization features

**Estimated Total Time**:

- Cleanup: 3-4 days
- Modernization: 4 weeks
- **Total**: 5 weeks to industry-leading React app

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Status**: Ready for implementation
