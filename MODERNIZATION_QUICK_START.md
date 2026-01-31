# React 18+ Modernization - Quick Start Guide

**📋 Full Plan:** See `REACT_18_MODERNIZATION_PLAN.md`  
**🎯 Current Phase:** Phase 1 - Error Boundaries  
**⏱️ Estimated Time:** 3 weeks total, ~2-3 days per phase

---

## 🚀 Phase 1: Error Boundaries (START HERE)

**Goal:** Prevent component crashes from breaking the entire app

### Step 1: Create ErrorBoundary Component (30 min)

```bash
mkdir -p client/src/components/ErrorBoundary
```

**Create `client/src/components/ErrorBoundary/index.tsx`:**

```typescript
import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Logger } from '../../utils/Logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { componentName = 'Unknown Component' } = this.props;
    Logger.error(`❌ Error in ${componentName}:`, error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: '20px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          color: 'var(--text-color)',
        }}>
          <h3 style={{ color: '#ff4444' }}>⚠️ Component Error</h3>
          <p>Something went wrong in {this.props.componentName || 'this component'}.</p>
          <details style={{ marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer' }}>Error Details</summary>
            <pre style={{
              marginTop: '10px',
              padding: '10px',
              background: '#1a1a1a',
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto',
              maxHeight: '200px',
            }}>
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <button
            onClick={this.handleReset}
            style={{
              marginTop: '10px',
              padding: '6px 12px',
              background: 'var(--btn-bg)',
              color: 'var(--btn-text)',
              border: '1px solid var(--btn-border)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Step 2: Wrap Critical Components (20 min)

**Update `client/src/App.tsx`:**

```typescript
import { ErrorBoundary } from './components/ErrorBoundary';

// In the JSX, wrap major components:

{/* Scene Outliner with error boundary */}
<ErrorBoundary componentName="SceneOutliner">
  <SceneOutliner
    key={sceneRefreshTrigger}
    selectedNode={selectedNode}
    onNodeSelect={setSelectedNode}
    onSceneTreeChange={handleSceneTreeChange}
    onSyncStateChange={handleSyncStateChange}
  />
</ErrorBoundary>

{/* Render Viewport with error boundary */}
<ErrorBoundary componentName="CallbackRenderViewport">
  <CallbackRenderViewport
    ref={viewportRef}
    showWorldCoord={showWorldCoord}
    viewportLocked={viewportLocked}
    pickingMode={pickingMode}
    onExportPasses={handleExportPasses}
    onSetBackgroundImage={handleSetBackgroundImage}
    onToggleLockViewport={handleToggleLockViewport}
  />
</ErrorBoundary>

{/* Node Inspector with error boundary */}
<ErrorBoundary componentName="NodeInspector">
  <NodeInspector node={selectedNode} />
</ErrorBoundary>

{/* Node Graph Editor with error boundary */}
<ErrorBoundary componentName="NodeGraphEditor">
  <NodeGraphEditor
    sceneTree={sceneTree}
    selectedNode={selectedNode}
    onNodeSelect={setSelectedNode}
    gridVisible={gridVisible}
    setGridVisible={setGridVisible}
    snapToGrid={snapToGrid}
    setSnapToGrid={setSnapToGrid}
    onRecenterViewReady={callback => setRecenterViewCallback(() => callback)}
  />
</ErrorBoundary>

{/* Material Database with error boundary */}
<ErrorBoundary componentName="MaterialDatabase">
  <MaterialDatabase
    visible={materialDatabaseVisible}
    onClose={handleMaterialDatabaseClose}
  />
</ErrorBoundary>
```

### Step 3: Add Global Error Boundary (10 min)

**Update `client/src/App.tsx` - wrap AppContent:**

```typescript
function App() {
  return (
    <ErrorBoundary componentName="Application">
      <OctaneProvider>
        <EditActionsProvider>
          <AppContent />
        </EditActionsProvider>
      </OctaneProvider>
    </ErrorBoundary>
  );
}
```

### Step 4: Test & Verify (10 min)

```bash
# TypeScript check
npm run typecheck

# Build check
npm run build

# Run dev server
npm run dev

# Test error boundary:
# - Temporarily throw error in a component
# - Verify error UI appears
# - Verify "Try Again" button works
# - Verify other components still function
```

**✅ Phase 1 Complete!** Time: ~1-2 hours

---

## 📦 Phase 2: Code Splitting & Lazy Loading

### Step 1: Install Dependencies (if needed)

```bash
# Check if already installed
npm list react react-dom
# Should show: react@18.2.0, react-dom@18.2.0
```

### Step 2: Create Loading Components (30 min)

**Create `client/src/components/LoadingSpinner.tsx`:**

```typescript
export const LoadingSpinner = ({ size = 'medium' }: { size?: 'small' | 'medium' | 'large' }) => {
  const sizeMap = { small: '16px', medium: '32px', large: '48px' };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
    }}>
      <div style={{
        width: sizeMap[size],
        height: sizeMap[size],
        border: '3px solid var(--border-color)',
        borderTop: '3px solid var(--accent-color)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
    </div>
  );
};
```

**Add to `client/src/styles/app.css`:**

```css
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
```

### Step 3: Lazy Load Components (20 min)

**Update `client/src/App.tsx`:**

```typescript
import { lazy, Suspense } from 'react';
import { LoadingSpinner } from './components/LoadingSpinner';

// Lazy load heavy components
const NodeGraphEditor = lazy(() => import('./components/NodeGraph'));
const MaterialDatabase = lazy(() => import('./components/MaterialDatabase'));
const NodeInspector = lazy(() => import('./components/NodeInspector'));

// In JSX, wrap with Suspense:
<Suspense fallback={<LoadingSpinner />}>
  <ErrorBoundary componentName="NodeGraphEditor">
    <NodeGraphEditor {...props} />
  </ErrorBoundary>
</Suspense>

<Suspense fallback={<LoadingSpinner size="small" />}>
  <ErrorBoundary componentName="MaterialDatabase">
    <MaterialDatabase {...props} />
  </ErrorBoundary>
</Suspense>

<Suspense fallback={<LoadingSpinner />}>
  <ErrorBoundary componentName="NodeInspector">
    <NodeInspector node={selectedNode} />
  </ErrorBoundary>
</Suspense>
```

### Step 4: Verify Bundle Reduction (10 min)

```bash
# Build and check bundle sizes
npm run build

# Look for:
# - Reduced initial chunk size
# - New lazy-loaded chunks created
# - Check dist/assets/*.js file sizes
```

**✅ Phase 2 Complete!** Time: ~1-2 hours

---

## 🔄 Phase 3: React Query Integration

### Step 1: Install React Query (5 min)

```bash
npm install @tanstack/react-query@^5.0.0
npm install @tanstack/react-query-devtools --save-dev
```

### Step 2: Setup QueryClient (10 min)

**Update `client/src/main.tsx`:**

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 1000, // 5 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);
```

### Step 3: Create Query Hooks (45 min)

**Create `client/src/hooks/useSceneQuery.ts`:**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOctane } from './useOctane';
import { SceneNode } from '../services/OctaneClient';

export const useSceneNodes = () => {
  const { client, connected } = useOctane();

  return useQuery({
    queryKey: ['sceneNodes'],
    queryFn: async () => {
      if (!client || !connected) {
        throw new Error('Not connected to Octane');
      }
      return client.getSceneGraphNodes();
    },
    enabled: connected,
    staleTime: 5000,
  });
};

export const useNodeParameters = (nodeHandle: bigint | null) => {
  const { client, connected } = useOctane();

  return useQuery({
    queryKey: ['nodeParams', nodeHandle?.toString()],
    queryFn: async () => {
      if (!client || !connected || !nodeHandle) {
        throw new Error('Invalid state');
      }
      return client.getNodeParameters(nodeHandle);
    },
    enabled: connected && nodeHandle !== null,
  });
};
```

**Create `client/src/hooks/useNodeMutations.ts`:**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOctane } from './useOctane';
import { Logger } from '../utils/Logger';

export const useUpdateParameter = (nodeHandle: bigint) => {
  const { client } = useOctane();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ attributeName, value }: { attributeName: string; value: any }) => {
      if (!client) throw new Error('No client');
      return client.setNodeAttribute(nodeHandle, attributeName, value);
    },
    onMutate: async ({ attributeName, value }) => {
      // Optimistic update
      const queryKey = ['nodeParams', nodeHandle.toString()];
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => ({
        ...old,
        [attributeName]: value,
      }));

      Logger.debug('🔄 Optimistic update:', attributeName, value);
      return { previous };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(['nodeParams', nodeHandle.toString()], context?.previous);
      Logger.error('❌ Parameter update failed, rolled back:', err);
    },
    onSuccess: () => {
      Logger.debug('✅ Parameter update confirmed');
    },
  });
};
```

### Step 4: Use Hooks in Components (30 min)

**Update `client/src/components/NodeInspector/index.tsx`:**

```typescript
import { useNodeParameters } from '../../hooks/useSceneQuery';
import { useUpdateParameter } from '../../hooks/useNodeMutations';

export const NodeInspector = ({ node }: { node: SceneNode | null }) => {
  const { data: parameters, isLoading, error } = useNodeParameters(node?.handle || null);
  const mutation = useUpdateParameter(node?.handle || 0n);

  if (!node) return <div>No node selected</div>;
  if (isLoading) return <LoadingSpinner />;
  if (error) return <div>Error loading parameters</div>;

  const handleParameterChange = (attributeName: string, value: any) => {
    mutation.mutate({ attributeName, value });
  };

  // Render parameters...
};
```

**✅ Phase 3 Complete!** Time: ~1.5-2 hours

---

## 🚀 Phase 4: Concurrent Features

### Step 1: Add startTransition (30 min)

**Update `client/src/App.tsx`:**

```typescript
import { startTransition } from 'react';

// Scene tree updates (non-urgent)
const handleSceneTreeChange = (tree: SceneNode[]) => {
  Logger.debug('🔄 App.tsx: handleSceneTreeChange called with', tree.length, 'nodes');
  startTransition(() => {
    setSceneTree(tree);
  });
};

// Scene refresh (non-urgent)
const handleSceneRefresh = () => {
  startTransition(() => {
    setSceneRefreshTrigger(prev => prev + 1);
  });
};
```

### Step 2: Add useDeferredValue (20 min)

**Update `client/src/components/SceneOutliner/index.tsx`:**

```typescript
import { useDeferredValue, useMemo } from 'react';

export const SceneOutliner = ({ ... }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  // Use deferred value for filtering
  const filteredNodes = useMemo(
    () => filterSceneTree(sceneTree, deferredSearchTerm),
    [sceneTree, deferredSearchTerm]
  );

  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="Search nodes..."
      />
      {/* Render filteredNodes */}
    </div>
  );
};
```

### Step 3: Add useTransition Indicators (15 min)

**Update `client/src/App.tsx`:**

```typescript
import { useTransition } from 'react';

const [isPending, startTransition] = useTransition();

// Show loading indicator
{isPending && (
  <div className="loading-bar" style={{
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '2px',
    background: 'var(--accent-color)',
    animation: 'progress 1s ease-in-out infinite',
  }} />
)}
```

**✅ Phase 4 Complete!** Time: ~1 hour

---

## 🎨 Phase 5: Enhanced Loading States

### Step 1: Install Toast Library (5 min)

```bash
npm install react-hot-toast
```

### Step 2: Replace alert() (15 min)

**Update `client/src/App.tsx`:**

```typescript
import toast, { Toaster } from 'react-hot-toast';

// Replace line 282:
// Before:
// alert('Render Failed: Octane encountered an error...');

// After:
toast.error('Render failed', {
  description: 'Octane encountered an error during rendering. Check console for details.',
  duration: 5000,
});

// Add Toaster component in JSX:
<Toaster
  position="top-right"
  toastOptions={{
    style: {
      background: 'var(--bg-panel)',
      color: 'var(--text-color)',
      border: '1px solid var(--border-color)',
    },
  }}
/>
```

### Step 3: Create Skeleton Components (30 min)

**Create `client/src/components/skeletons/NodeInspectorSkeleton.tsx`:**

```typescript
export const NodeInspectorSkeleton = () => {
  return (
    <div style={{ padding: '10px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          height: '32px',
          background: 'var(--bg-input)',
          marginBottom: '8px',
          borderRadius: '4px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
    </div>
  );
};
```

**Add pulse animation to `client/src/styles/app.css`:**

```css
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
```

**✅ Phase 5 Complete!** Time: ~1 hour

---

## 📊 Phase 6: Performance Optimization

### Step 1: Add React.memo (30 min)

**Update `client/src/components/NodeInspector/ParameterControl.tsx`:**

```typescript
import { memo } from 'react';

export const ParameterControl = memo(
  ({ parameter, onChange }) => {
    // Component logic
  },
  (prevProps, nextProps) => {
    // Custom comparison
    return prevProps.parameter.value === nextProps.parameter.value;
  }
);
```

### Step 2: Optimize Callbacks (20 min)

**Update `client/src/App.tsx`:**

```typescript
import { useCallback } from 'react';

const handleNodeSelect = useCallback((node: SceneNode | null) => {
  setSelectedNode(node);
}, []);

const handleTogglePanelVisibility = useCallback(
  (panel: 'renderViewport' | 'nodeInspector' | 'graphEditor' | 'sceneOutliner') => {
    setPanelVisibility(prev => ({
      ...prev,
      [panel]: !prev[panel],
    }));
  },
  []
);
```

### Step 3: Memoize Computations (15 min)

```typescript
import { useMemo } from 'react';

const visibleNodes = useMemo(() => sceneTree.filter(node => node.visible), [sceneTree]);

const sortedNodes = useMemo(
  () => [...sceneTree].sort((a, b) => a.name.localeCompare(b.name)),
  [sceneTree]
);
```

**✅ Phase 6 Complete!** Time: ~1 hour

---

## ✅ Testing Checklist

After each phase:

```bash
# 1. TypeScript check
npm run typecheck

# 2. Linting
npm run lint

# 3. Build
npm run build

# 4. Dev server
npm run dev

# 5. Manual testing:
- Open app in browser
- Connect to Octane
- Load a scene with 100+ nodes
- Test all major features
- Check console for errors
- Verify no warnings
```

---

## 📊 Performance Benchmarking

**Before starting:**

```bash
npm run build
# Note bundle sizes in dist/assets/
```

**After Phase 2 (Code Splitting):**

```bash
npm run build
# Compare bundle sizes - expect >30% reduction
```

**After Phase 6 (Optimization):**

```bash
# Open React DevTools Profiler
# Record interaction
# Check:
- Render times
- Number of renders
- Component re-render frequency
```

---

## 🆘 Troubleshooting

### Issue: TypeScript errors after adding lazy()

**Solution:** Ensure all components have proper default exports:

```typescript
export default function NodeGraphEditor() { ... }
// or
export { NodeGraphEditor as default };
```

### Issue: Suspense boundary not working

**Solution:** Check that lazy component is default export and wrapped correctly:

```typescript
const Component = lazy(() => import('./Component')); // Must be default export
<Suspense fallback={<Loading />}>
  <Component />
</Suspense>
```

### Issue: React Query not refetching

**Solution:** Check query keys and enabled flag:

```typescript
useQuery({
  queryKey: ['data', id], // Include dynamic values
  queryFn: fetchData,
  enabled: !!id, // Only run when ready
});
```

### Issue: Optimistic updates not working

**Solution:** Verify query key matches and mutation has onMutate:

```typescript
useMutation({
  mutationFn: updateData,
  onMutate: async newData => {
    await queryClient.cancelQueries({ queryKey: ['data'] });
    const previous = queryClient.getQueryData(['data']);
    queryClient.setQueryData(['data'], newData);
    return { previous };
  },
});
```

---

## 📚 Resources

- [React 18 Docs](https://react.dev/)
- [React Query Docs](https://tanstack.com/query/latest)
- [React Concurrent Features](https://react.dev/reference/react/startTransition)
- [Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)

---

**Ready to start?** Begin with Phase 1 - Error Boundaries! 🚀
