# octaneWebR Modernization Guide
**Step-by-Step Implementation Guide for React 18 Features**

---

## Quick Reference

| Priority | Feature | Time | Impact | Difficulty |
|----------|---------|------|--------|------------|
| 🚨 P1 | Error Boundaries | 2 hours | High | Easy |
| 🚨 P1 | Code Splitting | 4 hours | High | Easy |
| ⚡ P2 | Suspense Boundaries | 1 day | High | Medium |
| ⚡ P2 | React Query | 2-3 days | High | Medium |
| 📊 P2 | Testing Setup | 1 week | Critical | Medium |
| 🎨 P3 | Transitions | 2 days | Medium | Medium |
| 🎨 P3 | Accessibility | 1 week | High | Hard |

---

## Priority 1: Critical Stability (1 day)

### 1.1 Add Error Boundaries

#### Install Dependencies
```bash
npm install react-error-boundary
```

#### Create ErrorBoundary Component
```typescript
// client/src/components/ErrorBoundary/index.tsx
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { Logger } from '../../utils/Logger';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="error-boundary-fallback">
      <div className="error-content">
        <h2>⚠️ Something went wrong</h2>
        <details>
          <summary>Error details</summary>
          <pre>{error.message}</pre>
          <pre>{error.stack}</pre>
        </details>
        <button onClick={resetErrorBoundary}>
          Try again
        </button>
      </div>
    </div>
  );
}

function onError(error: Error, info: { componentStack: string }) {
  Logger.error('Error Boundary caught error:', error);
  Logger.error('Component Stack:', info.componentStack);
  
  // Optional: Send to error tracking service (Sentry, LogRocket, etc.)
  // sendToErrorTracking(error, info);
}

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
}

export function ErrorBoundary({ children, fallback }: Props) {
  return (
    <ReactErrorBoundary
      FallbackComponent={fallback || ErrorFallback}
      onError={onError}
      onReset={() => {
        // Reset app state if needed
        window.location.href = '/';
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
```

#### Add CSS
```css
/* client/src/styles/error-boundary.css */
.error-boundary-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: var(--spacing-lg);
}

.error-content {
  max-width: 600px;
  padding: var(--spacing-xl);
  background: var(--bg-secondary);
  border: 1px solid var(--border-error);
  border-radius: var(--border-radius-lg);
}

.error-content h2 {
  color: var(--text-error);
  margin-bottom: var(--spacing-md);
}

.error-content details {
  margin: var(--spacing-md) 0;
  padding: var(--spacing-sm);
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-sm);
}

.error-content pre {
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.error-content button {
  margin-top: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--accent-blue);
  color: white;
  border: none;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
}

.error-content button:hover {
  background: var(--accent-blue-hover);
}
```

#### Update App.tsx
```typescript
// client/src/App.tsx
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/error-boundary.css';

function App() {
  return (
    <OctaneProvider>
      <EditActionsProvider>
        {/* Wrap entire app */}
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </EditActionsProvider>
    </OctaneProvider>
  );
}

// OR wrap individual sections for better isolation
function AppContent() {
  return (
    <div className="octane-app">
      <MenuBar />
      
      <main>
        <ErrorBoundary>
          <SceneOutliner />
        </ErrorBoundary>
        
        <ErrorBoundary>
          <CallbackRenderViewport />
        </ErrorBoundary>
        
        <ErrorBoundary>
          <NodeGraphEditor />
        </ErrorBoundary>
        
        <ErrorBoundary>
          <NodeInspector />
        </ErrorBoundary>
      </main>
    </div>
  );
}
```

**Testing**:
```typescript
// Trigger error to test
<button onClick={() => { throw new Error('Test error!'); }}>
  Test Error Boundary
</button>
```

---

### 1.2 Add Code Splitting

#### Update main.tsx
```typescript
// client/src/main.tsx
import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/theme-octane.css';
import './styles/app.css';

// Import App immediately (small, needed for layout)
import App from './App';

// Lazy load heavy components
const NodeGraphEditor = lazy(() => import('./components/NodeGraph'));
const MaterialDatabase = lazy(() => import('./components/MaterialDatabase'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

#### Update App.tsx with Suspense
```typescript
// client/src/App.tsx
import { Suspense, lazy } from 'react';

// Lazy imports
const NodeGraphEditor = lazy(() => import('./components/NodeGraph'));
const MaterialDatabase = lazy(() => import('./components/MaterialDatabase'));

// Loading fallback component
function LoadingFallback({ name }: { name: string }) {
  return (
    <div className="component-loading">
      <div className="loading-spinner"></div>
      <p>Loading {name}...</p>
    </div>
  );
}

function AppContent() {
  return (
    <div className="octane-app">
      <MenuBar />
      
      <main>
        {/* Already loaded components */}
        <SceneOutliner />
        <CallbackRenderViewport />
        
        {/* Lazy loaded - heavy component */}
        <Suspense fallback={<LoadingFallback name="Node Graph" />}>
          <NodeGraphEditor 
            sceneTree={sceneTree}
            selectedNode={selectedNode}
            onNodeSelect={setSelectedNode}
          />
        </Suspense>
        
        <NodeInspector />
      </main>
      
      {/* Lazy loaded - modal dialog */}
      {materialDatabaseVisible && (
        <Suspense fallback={<LoadingFallback name="Material Database" />}>
          <MaterialDatabase
            visible={materialDatabaseVisible}
            onClose={handleMaterialDatabaseClose}
          />
        </Suspense>
      )}
    </div>
  );
}
```

#### Update Component Exports
```typescript
// client/src/components/NodeGraph/index.tsx
// Change default export to named export for better tree-shaking
export { NodeGraphEditor } from './NodeGraphEditor';

// OR keep default export but ensure it's the only export
export default NodeGraphEditor;
```

#### Add Loading CSS
```css
/* client/src/styles/app.css */
.component-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: var(--spacing-xl);
  color: var(--text-secondary);
}

.component-loading p {
  margin-top: var(--spacing-md);
  font-size: 14px;
}
```

**Expected Results**:
- Initial bundle: 587 KB → ~150-200 KB
- Node Graph: Loads on-demand (~250 KB)
- Material Database: Loads on-demand (~100 KB)

---

## Priority 2: Modern Data Fetching (3 days)

### 2.1 Install React Query

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

### 2.2 Setup Query Client

```typescript
// client/src/providers/QueryProvider.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,           // Data fresh for 5 seconds
      gcTime: 10 * 60 * 1000,    // Cache for 10 minutes
      retry: 1,                   // Retry failed requests once
      refetchOnWindowFocus: true, // Sync when window regains focus
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools - only in development */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
```

### 2.3 Update App.tsx

```typescript
// client/src/App.tsx
import { QueryProvider } from './providers/QueryProvider';

function App() {
  return (
    <QueryProvider>
      <OctaneProvider>
        <EditActionsProvider>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </EditActionsProvider>
      </OctaneProvider>
    </QueryProvider>
  );
}
```

### 2.4 Migrate SceneOutliner to useQuery

```typescript
// client/src/components/SceneOutliner/index.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function SceneOutliner({ selectedNode, onNodeSelect }: Props) {
  const { client, connected } = useOctane();
  const queryClient = useQueryClient();
  
  // Replace manual loading state with useQuery
  const { 
    data: sceneTree = [], 
    isLoading,
    error,
    refetch 
  } = useQuery({
    queryKey: ['sceneTree'],
    queryFn: async () => {
      if (!connected) return [];
      return await client.buildSceneTree();
    },
    enabled: connected, // Only run when connected
    staleTime: 10000,   // Scene tree fresh for 10 seconds
  });
  
  // Mutation for node visibility toggle
  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ handle, visible }: { handle: number; visible: boolean }) => {
      await client.setNodeVisibility(handle, visible);
    },
    onSuccess: () => {
      // Invalidate and refetch scene tree
      queryClient.invalidateQueries({ queryKey: ['sceneTree'] });
    },
  });
  
  const handleToggleVisibility = (node: SceneNode) => {
    toggleVisibilityMutation.mutate({
      handle: node.handle,
      visible: !node.visible,
    });
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="scene-outliner-loading">
        <div className="loading-spinner" />
        <p>Loading scene...</p>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="scene-outliner-error">
        <p>Failed to load scene</p>
        <button onClick={() => refetch()}>Retry</button>
      </div>
    );
  }
  
  // Render tree...
  return <div>...</div>;
}
```

### 2.5 Add Suspense Support

```typescript
// client/src/components/SceneOutliner/index.tsx
import { useSuspenseQuery } from '@tanstack/react-query';

export function SceneOutliner({ selectedNode, onNodeSelect }: Props) {
  const { client, connected } = useOctane();
  
  // Suspense version - throws promise while loading
  const { data: sceneTree } = useSuspenseQuery({
    queryKey: ['sceneTree'],
    queryFn: () => client.buildSceneTree(),
  });
  
  // No loading/error checks needed - Suspense handles it!
  return <div>...</div>;
}

// Usage in App.tsx
<Suspense fallback={<SceneOutlinerSkeleton />}>
  <ErrorBoundary>
    <SceneOutliner />
  </ErrorBoundary>
</Suspense>
```

### 2.6 Create Custom Query Hooks

```typescript
// client/src/hooks/queries/useSceneTree.ts
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useOctane } from '../useOctane';

export function useSceneTree() {
  const { client, connected } = useOctane();
  
  return useQuery({
    queryKey: ['sceneTree'],
    queryFn: () => client.buildSceneTree(),
    enabled: connected,
    staleTime: 10000,
  });
}

export function useSceneTreeSuspense() {
  const { client } = useOctane();
  
  return useSuspenseQuery({
    queryKey: ['sceneTree'],
    queryFn: () => client.buildSceneTree(),
  });
}

// Usage
function SceneOutliner() {
  const { data: sceneTree, isLoading } = useSceneTree();
  // ...
}
```

### 2.7 Optimistic Updates Example

```typescript
// client/src/hooks/queries/useNodeVisibility.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOctane } from '../useOctane';

export function useNodeVisibilityMutation() {
  const { client } = useOctane();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ handle, visible }: { handle: number; visible: boolean }) => {
      return await client.setNodeVisibility(handle, visible);
    },
    
    // Optimistic update - update UI immediately
    onMutate: async ({ handle, visible }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['sceneTree'] });
      
      // Snapshot previous value
      const previousTree = queryClient.getQueryData(['sceneTree']);
      
      // Optimistically update
      queryClient.setQueryData(['sceneTree'], (old: SceneNode[]) => {
        return updateNodeVisibility(old, handle, visible);
      });
      
      // Return snapshot for rollback
      return { previousTree };
    },
    
    // Rollback on error
    onError: (_err, _vars, context) => {
      if (context?.previousTree) {
        queryClient.setQueryData(['sceneTree'], context.previousTree);
      }
    },
    
    // Refetch on success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['sceneTree'] });
    },
  });
}

// Helper function
function updateNodeVisibility(
  tree: SceneNode[], 
  handle: number, 
  visible: boolean
): SceneNode[] {
  return tree.map(node => 
    node.handle === handle 
      ? { ...node, visible } 
      : { ...node, children: updateNodeVisibility(node.children || [], handle, visible) }
  );
}
```

---

## Priority 3: React 18 Concurrent Features (3 days)

### 3.1 Add Transitions for Heavy Updates

```typescript
// client/src/App.tsx
import { useTransition, useDeferredValue } from 'react';

function AppContent() {
  const [sceneTree, setSceneTree] = useState<SceneNode[]>([]);
  const [isPending, startTransition] = useTransition();
  
  // Defer heavy scene tree for rendering
  const deferredSceneTree = useDeferredValue(sceneTree);
  
  const handleSceneSync = async () => {
    const newTree = await client.buildSceneTree();
    
    // Wrap heavy update in transition
    startTransition(() => {
      setSceneTree(newTree);
    });
  };
  
  return (
    <div>
      {isPending && (
        <div className="sync-indicator">
          🔄 Syncing scene...
        </div>
      )}
      
      {/* Use deferred value - won't block UI */}
      <SceneOutliner sceneTree={deferredSceneTree} />
      
      {/* User can still interact with other components */}
      <NodeInspector />
      <RenderViewport />
    </div>
  );
}
```

### 3.2 Search with useDeferredValue

```typescript
// client/src/components/NodeGraph/SearchDialog.tsx
import { useState, useDeferredValue, useMemo } from 'react';

export function SearchDialog({ nodes }: { nodes: Node[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Defer expensive search filtering
  const deferredSearchTerm = useDeferredValue(searchTerm);
  
  // Expensive filtering operation
  const filteredNodes = useMemo(() => {
    if (!deferredSearchTerm) return nodes;
    
    return nodes.filter(node => 
      node.data.label?.toLowerCase().includes(deferredSearchTerm.toLowerCase())
    );
  }, [nodes, deferredSearchTerm]);
  
  const isPending = searchTerm !== deferredSearchTerm;
  
  return (
    <div className="search-dialog">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search nodes..."
        // Input stays responsive even during heavy filtering
      />
      
      {isPending && <span className="search-pending">Searching...</span>}
      
      <div className="search-results">
        {filteredNodes.map(node => (
          <SearchResultItem key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}
```

### 3.3 Priority Updates Pattern

```typescript
// client/src/components/SceneOutliner/index.tsx
import { useTransition } from 'react';

export function SceneOutliner() {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  
  const handleExpandAll = () => {
    // Expanding 1000+ nodes is low priority
    startTransition(() => {
      const allHandles = getAllNodeHandles(sceneTree);
      setExpandedNodes(new Set(allHandles));
    });
  };
  
  const handleCollapseAll = () => {
    // Collapsing is urgent - no transition
    setExpandedNodes(new Set());
  };
  
  return (
    <div>
      <button onClick={handleExpandAll} disabled={isPending}>
        {isPending ? 'Expanding...' : 'Expand All'}
      </button>
      <button onClick={handleCollapseAll}>
        Collapse All
      </button>
      
      {/* Tree rendering uses expandedNodes */}
      <TreeView expanded={expandedNodes} />
    </div>
  );
}
```

---

## Testing Setup (1 week)

### 4.1 Install Vitest

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event @vitest/ui jsdom
```

### 4.2 Configure Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './client/src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'client/src/test/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
      ],
    },
  },
});
```

### 4.3 Setup File

```typescript
// client/src/test/setup.ts
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

### 4.4 Example Component Test

```typescript
// client/src/components/ConnectionStatus/index.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionStatus } from './index';

describe('ConnectionStatus', () => {
  it('renders connected state', () => {
    render(<ConnectionStatus connected={true} />);
    
    expect(screen.getByText(/connected/i)).toBeInTheDocument();
    expect(screen.getByText(/connected/i)).toHaveClass('status-connected');
  });
  
  it('renders disconnected state', () => {
    render(<ConnectionStatus connected={false} />);
    
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
    expect(screen.getByText(/disconnected/i)).toHaveClass('status-disconnected');
  });
});
```

### 4.5 Example Hook Test

```typescript
// client/src/hooks/useRecentFiles.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecentFiles } from './useRecentFiles';

describe('useRecentFiles', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  
  it('starts with empty list', () => {
    const { result } = renderHook(() => useRecentFiles());
    expect(result.current.recentFiles).toEqual([]);
  });
  
  it('adds file to recent list', () => {
    const { result } = renderHook(() => useRecentFiles());
    
    act(() => {
      result.current.addRecentFile('/path/to/scene.orbx');
    });
    
    expect(result.current.recentFiles).toHaveLength(1);
    expect(result.current.recentFiles[0]).toBe('/path/to/scene.orbx');
  });
  
  it('limits recent files to 10', () => {
    const { result } = renderHook(() => useRecentFiles());
    
    act(() => {
      for (let i = 0; i < 15; i++) {
        result.current.addRecentFile(`/file${i}.orbx`);
      }
    });
    
    expect(result.current.recentFiles).toHaveLength(10);
  });
});
```

### 4.6 Example Service Test

```typescript
// client/src/services/octane/SceneService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SceneService } from './SceneService';

describe('SceneService', () => {
  let service: SceneService;
  
  beforeEach(() => {
    service = new SceneService(mockEmitter, 'http://localhost', mockApiService);
  });
  
  it('builds scene tree', async () => {
    const mockTree = [
      { handle: 1, name: 'Root', type: 'NT_ROOT', children: [] }
    ];
    
    vi.spyOn(mockApiService, 'callApi').mockResolvedValue(mockTree);
    
    const result = await service.buildSceneTree();
    
    expect(result).toEqual(mockTree);
    expect(mockApiService.callApi).toHaveBeenCalledWith('scene', 'getRoot');
  });
});
```

### 4.7 Add Scripts to package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## Summary Checklist

### Week 1: Foundation ✅
- [ ] Add error boundaries (2 hours)
- [ ] Add code splitting with lazy() (4 hours)
- [ ] Test bundle size reduction
- [ ] Deploy and verify stability

### Week 2: Data Fetching ✅
- [ ] Install React Query (30 min)
- [ ] Setup QueryProvider (1 hour)
- [ ] Migrate SceneOutliner to useQuery (4 hours)
- [ ] Migrate NodeInspector mutations (4 hours)
- [ ] Add custom query hooks (4 hours)

### Week 3: Concurrent Features ✅
- [ ] Add Suspense boundaries (1 day)
- [ ] Add useTransition for scene sync (1 day)
- [ ] Add useDeferredValue for search (4 hours)
- [ ] Test performance improvements

### Week 4: Quality ✅
- [ ] Setup Vitest (2 hours)
- [ ] Write service tests (2 days)
- [ ] Write component tests (2 days)
- [ ] Setup CI/CD for tests (4 hours)

---

**Next Steps**: Start with Priority 1 (Error Boundaries + Code Splitting) - highest ROI, lowest effort!

