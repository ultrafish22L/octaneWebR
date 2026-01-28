---
name: react-patterns
description: React component patterns, state management with Zustand, custom hooks, event-driven architecture, and performance optimization patterns specific to octaneWebR. Use when building components or managing state.
triggers:
  - react
  - component
  - hook
  - state
  - zustand
  - useEffect
  - useState
  - context
---

# React Patterns Skill

Expert knowledge for React patterns and best practices specific to octaneWebR.

## Component Architecture

### Functional Components

octaneWebR uses **functional components with hooks** exclusively.

```typescript
// ✅ Correct pattern
const MyComponent: React.FC<Props> = ({ prop }) => {
  return <div>{prop}</div>;
};

// ❌ Don't use class components
class MyComponent extends React.Component {
  // Not used in this project
}
```

### Component Structure

```typescript
import React, { useState, useEffect } from 'react';
import { useOctane } from '../../hooks/useOctane';
import type { SceneNode } from '../../types';
import styles from './MyComponent.module.css';

interface MyComponentProps {
  nodeHandle: number;
  onUpdate?: (data: any) => void;
}

const MyComponent: React.FC<MyComponentProps> = ({ nodeHandle, onUpdate }) => {
  // 1. State declarations
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // 2. Context/hooks
  const { client, connected } = useOctane();
  
  // 3. Effects
  useEffect(() => {
    if (connected && nodeHandle) {
      loadData();
    }
  }, [connected, nodeHandle]);
  
  // 4. Event handlers
  const loadData = async () => {
    setLoading(true);
    try {
      const result = await client.node.getInfo(nodeHandle);
      setData(result);
      onUpdate?.(result);
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleChange = (value: any) => {
    setData(value);
    // Additional logic
  };
  
  // 5. Render helpers
  const renderContent = () => {
    if (loading) return <div>Loading...</div>;
    if (!data) return <div>No data</div>;
    return <div>{data.name}</div>;
  };
  
  // 6. Main render
  return (
    <div className={styles.container}>
      {renderContent()}
    </div>
  );
};

export default MyComponent;
```

## State Management with Zustand

octaneWebR uses **Zustand** for global state management.

### Store Definition

```typescript
// stores/appStore.ts
import { create } from 'zustand';

interface AppState {
  selectedNode: SceneNode | null;
  expandedNodes: Set<number>;
  
  // Actions
  setSelectedNode: (node: SceneNode | null) => void;
  toggleNodeExpansion: (handle: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedNode: null,
  expandedNodes: new Set(),
  
  setSelectedNode: (node) => set({ selectedNode: node }),
  
  toggleNodeExpansion: (handle) => set((state) => {
    const next = new Set(state.expandedNodes);
    if (next.has(handle)) {
      next.delete(handle);
    } else {
      next.add(handle);
    }
    return { expandedNodes: next };
  }),
}));
```

### Using Store in Components

```typescript
import { useAppStore } from '../../stores/appStore';

const MyComponent: React.FC = () => {
  // Select specific state slices
  const selectedNode = useAppStore(state => state.selectedNode);
  const setSelectedNode = useAppStore(state => state.setSelectedNode);
  
  // Or select multiple
  const { expandedNodes, toggleNodeExpansion } = useAppStore(state => ({
    expandedNodes: state.expandedNodes,
    toggleNodeExpansion: state.toggleNodeExpansion
  }));
  
  return <div onClick={() => setSelectedNode(node)}>
    {selectedNode?.name}
  </div>;
};
```

### Zustand Performance Tip

```typescript
// ❌ Wrong - re-renders on ANY state change
const state = useAppStore();

// ✅ Correct - only re-renders when selectedNode changes
const selectedNode = useAppStore(state => state.selectedNode);

// ✅ Best - shallow equality check for objects
const { selectedNode, expandedNodes } = useAppStore(
  state => ({
    selectedNode: state.selectedNode,
    expandedNodes: state.expandedNodes
  }),
  shallow // Import from 'zustand/shallow'
);
```

## Custom Hooks

### useOctane Hook

```typescript
// hooks/useOctane.ts
import { useContext } from 'react';
import { OctaneContext } from '../contexts/OctaneContext';

export const useOctane = () => {
  const context = useContext(OctaneContext);
  
  if (!context) {
    throw new Error('useOctane must be used within OctaneProvider');
  }
  
  return context;
};

// Usage
const { client, connected } = useOctane();
```

### Custom Data Fetching Hook

```typescript
// hooks/useNodeData.ts
import { useState, useEffect } from 'react';
import { useOctane } from './useOctane';

export const useNodeData = (handle: number | null) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { client, connected } = useOctane();
  
  useEffect(() => {
    if (!connected || !handle) {
      setData(null);
      return;
    }
    
    let cancelled = false;
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await client.node.getInfo(handle);
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      cancelled = true;
    };
  }, [handle, connected, client]);
  
  return { data, loading, error };
};

// Usage
const NodeViewer: React.FC<{ handle: number }> = ({ handle }) => {
  const { data, loading, error } = useNodeData(handle);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return <div>No data</div>;
  
  return <div>{data.name}</div>;
};
```

### Custom Event Listener Hook

```typescript
// hooks/useOctaneEvent.ts
import { useEffect } from 'react';
import { useOctane } from './useOctane';

export const useOctaneEvent = <T = any>(
  eventName: string,
  handler: (data: T) => void,
  deps: any[] = []
) => {
  const { client } = useOctane();
  
  useEffect(() => {
    client.on(eventName, handler);
    return () => client.off(eventName, handler);
  }, [client, eventName, handler, ...deps]);
};

// Usage
const NodeList: React.FC = () => {
  const [nodes, setNodes] = useState<SceneNode[]>([]);
  
  useOctaneEvent('node:created', (data: { handle: number }) => {
    console.log('Node created:', data.handle);
    // Refresh node list
  });
  
  useOctaneEvent('node:deleted', (data: { handle: number }) => {
    setNodes(prev => prev.filter(n => n.handle !== data.handle));
  });
  
  return <div>{/* ... */}</div>;
};
```

## Event-Driven Architecture

### Event Emitter Pattern

```typescript
// In service
export class NodeService extends BaseService {
  async createNode(type: string): Promise<number> {
    const handle = await this.api.create(type);
    
    // Emit event
    this.emit('node:created', {
      handle,
      type,
      timestamp: Date.now()
    });
    
    return handle;
  }
}

// In component
useEffect(() => {
  const handleNodeCreated = (data: { handle: number, type: string }) => {
    console.log('New node:', data);
    // Update UI
  };
  
  client.on('node:created', handleNodeCreated);
  
  return () => {
    client.off('node:created', handleNodeCreated);
  };
}, [client]);
```

### Common Events

```typescript
// Node events
'node:created'    // { handle, type }
'node:deleted'    // { handle }
'node:replaced'   // { oldHandle, newHandle, newType }
'node:updated'    // { handle, changes }
'node:selected'   // { handle }

// Scene events
'scene:loaded'    // { tree }
'scene:updated'   // { tree }
'scene:refreshed' // {}

// Render events
'render:started'  // {}
'render:stopped'  // {}
'render:updated'  // { progress, samples }

// Connection events
'connection:established'  // {}
'connection:lost'         // {}
```

### Cross-Component Communication

```typescript
// Component A - emits event
const ComponentA: React.FC = () => {
  const { client } = useOctane();
  
  const handleClick = () => {
    client.emit('custom:event', { data: 'hello' });
  };
  
  return <button onClick={handleClick}>Send</button>;
};

// Component B - listens for event
const ComponentB: React.FC = () => {
  const { client } = useOctane();
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    const handler = ({ data }: { data: string }) => {
      setMessage(data);
    };
    
    client.on('custom:event', handler);
    return () => client.off('custom:event', handler);
  }, [client]);
  
  return <div>Message: {message}</div>;
};
```

## Performance Optimization

### React.memo for Expensive Components

```typescript
const ExpensiveComponent = React.memo<Props>(
  ({ data }) => {
    // Expensive rendering logic
    return <div>{/* ... */}</div>;
  },
  (prevProps, nextProps) => {
    // Custom comparison - return true to skip re-render
    return prevProps.data.id === nextProps.data.id;
  }
);
```

### useMemo for Expensive Calculations

```typescript
const MyComponent: React.FC = () => {
  const [nodes, setNodes] = useState<SceneNode[]>([]);
  
  // ❌ Wrong - recalculates on every render
  const sortedNodes = nodes.sort((a, b) => a.name.localeCompare(b.name));
  
  // ✅ Correct - only recalculates when nodes change
  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => a.name.localeCompare(b.name));
  }, [nodes]);
  
  return <div>{/* ... */}</div>;
};
```

### useCallback for Event Handlers

```typescript
const MyComponent: React.FC = () => {
  const [count, setCount] = useState(0);
  
  // ❌ Wrong - creates new function on every render
  const handleClick = () => {
    setCount(c => c + 1);
  };
  
  // ✅ Correct - stable function reference
  const handleClick = useCallback(() => {
    setCount(c => c + 1);
  }, []); // Empty deps - function never changes
  
  return <ExpensiveChild onClick={handleClick} />;
};
```

### Virtualization for Large Lists

```typescript
import { FixedSizeList } from 'react-window';

const LargeNodeList: React.FC<{ nodes: SceneNode[] }> = ({ nodes }) => {
  const Row = ({ index, style }: { index: number, style: any }) => (
    <div style={style}>
      {nodes[index].name}
    </div>
  );
  
  return (
    <FixedSizeList
      height={600}
      itemCount={nodes.length}
      itemSize={30}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
};
```

## Common Patterns

### Loading States

```typescript
const MyComponent: React.FC = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await client.fetchData();
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!data) return <EmptyState />;
  
  return <div>{/* Render data */}</div>;
};
```

### Form Handling

```typescript
const MyForm: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    value: 0
  });
  
  const handleChange = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await client.submitData(formData);
      // Reset form
      setFormData({ name: '', value: 0 });
    } catch (error) {
      console.error('Submit failed:', error);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        value={formData.name}
        onChange={handleChange('name')}
      />
      <input
        type="number"
        value={formData.value}
        onChange={handleChange('value')}
      />
      <button type="submit">Submit</button>
    </form>
  );
};
```

### Controlled vs Uncontrolled Components

```typescript
// ✅ Controlled - React owns the state
const ControlledInput: React.FC = () => {
  const [value, setValue] = useState('');
  
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
};

// ❌ Uncontrolled - DOM owns the state (avoid in this project)
const UncontrolledInput: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleClick = () => {
    console.log(inputRef.current?.value);
  };
  
  return (
    <>
      <input ref={inputRef} />
      <button onClick={handleClick}>Get Value</button>
    </>
  );
};
```

## Common Pitfalls

### 1. Missing Dependency in useEffect

```typescript
// ❌ Wrong - missing dependency
useEffect(() => {
  fetchData(nodeHandle); // nodeHandle not in deps!
}, []);

// ✅ Correct
useEffect(() => {
  fetchData(nodeHandle);
}, [nodeHandle]);
```

### 2. Infinite Loop

```typescript
// ❌ Wrong - creates infinite loop
useEffect(() => {
  setData({ ...data, updated: true });
}, [data]); // data changes → effect runs → data changes → ...

// ✅ Correct - use functional update
useEffect(() => {
  setData(prev => ({ ...prev, updated: true }));
}, []); // Runs once

// ✅ Or be specific about what triggers the effect
useEffect(() => {
  setData({ ...data, updated: true });
}, [data.id]); // Only when id changes
```

### 3. Stale Closure

```typescript
// ❌ Wrong - count is stale
const MyComponent: React.FC = () => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCount(count + 1); // count is always 0!
    }, 1000);
    
    return () => clearInterval(interval);
  }, []); // Empty deps
  
  return <div>{count}</div>;
};

// ✅ Correct - use functional update
useEffect(() => {
  const interval = setInterval(() => {
    setCount(c => c + 1); // c is current value
  }, 1000);
  
  return () => clearInterval(interval);
}, []);
```

### 4. Not Cleaning Up Event Listeners

```typescript
// ❌ Wrong - memory leak
useEffect(() => {
  client.on('event', handler);
  // No cleanup!
}, []);

// ✅ Correct - cleanup function
useEffect(() => {
  client.on('event', handler);
  
  return () => {
    client.off('event', handler);
  };
}, []);
```

## TypeScript Patterns

### Typed Props

```typescript
interface ComponentProps {
  title: string;
  count?: number;          // Optional
  onClick: () => void;     // Required function
  onUpdate?: (val: number) => void; // Optional function
  children?: React.ReactNode;
}

const MyComponent: React.FC<ComponentProps> = ({
  title,
  count = 0,  // Default value
  onClick,
  onUpdate,
  children
}) => {
  return <div>{title}</div>;
};
```

### Typed State

```typescript
interface NodeState {
  handle: number;
  name: string;
  selected: boolean;
}

const [node, setNode] = useState<NodeState>({
  handle: 0,
  name: '',
  selected: false
});

// Update specific fields
setNode(prev => ({
  ...prev,
  selected: !prev.selected
}));
```

### Typed Events

```typescript
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
};

const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
};

const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
};
```

## Styling Patterns

### CSS Modules

```typescript
// MyComponent.module.css
.container {
  background-color: var(--octane-panel-bg);
  padding: var(--octane-spacing-md);
}

.title {
  color: var(--octane-text-primary);
  font-size: var(--octane-font-size-lg);
}

// MyComponent.tsx
import styles from './MyComponent.module.css';

const MyComponent: React.FC = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Title</h1>
    </div>
  );
};
```

### Conditional Classes

```typescript
const MyComponent: React.FC<{ active: boolean }> = ({ active }) => {
  return (
    <div className={`
      ${styles.container}
      ${active ? styles.active : styles.inactive}
    `}>
      Content
    </div>
  );
};

// Or use classnames library
import cn from 'classnames';

const MyComponent: React.FC<{ active: boolean }> = ({ active }) => {
  return (
    <div className={cn(styles.container, {
      [styles.active]: active,
      [styles.inactive]: !active
    })}>
      Content
    </div>
  );
};
```

## When to Update This Skill

Add new knowledge when you:
- Discover a new React pattern
- Find a performance optimization
- Learn about a useful custom hook
- Debug a tricky React issue
- Create a reusable component pattern
- Find a better way to handle state or events
