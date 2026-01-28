---
name: node-inspector
description: NodeInspector component architecture, node type dropdown feature, parameter editing patterns, and how to add new inspector features. Use when working with the properties panel or node parameters.
triggers:
  - node inspector
  - inspector
  - properties panel
  - parameters
  - node type dropdown
  - property editor
---

# NodeInspector Skill

Expert knowledge for working with the NodeInspector component - the properties panel for editing node parameters.

## Component Location

```
client/src/components/NodeInspector/
├── index.tsx           # Main component
├── ParameterEditor.tsx # Parameter input widgets
└── styles.css          # Inspector styles
```

## Architecture Overview

```typescript
const NodeInspector: React.FC = () => {
  // 1. Get selected node from global state
  const selectedNode = useStore(state => state.selectedNode);
  
  // 2. Fetch node parameters from Octane
  const [parameters, setParameters] = useState([]);
  useEffect(() => {
    if (selectedNode) {
      client.node.getParameters(selectedNode.handle)
        .then(setParameters);
    }
  }, [selectedNode]);
  
  // 3. Render node type dropdown (if applicable)
  // 4. Render parameters
  // 5. Handle parameter changes
};
```

## Node Type Dropdown Feature

**Implemented**: January 2025  
**Status**: ✅ Fully working

### Overview

Allows changing a node's type while preserving its position in the graph. Shows compatible node types based on the parent pin's type.

### Implementation

#### 1. Determine if Dropdown Should Show

```typescript
const shouldShowDropdown = (node: SceneNode): boolean => {
  // Only show for nodes that have parameters (non-end nodes)
  return node.parameters && node.parameters.length > 0;
};
```

**Logic**: 
- End nodes (leaf nodes with no children) don't need type changing
- Only nodes with parameters can be replaced meaningfully

#### 2. Get Compatible Node Types

```typescript
import { getCompatibleNodeTypes, PT_TO_NT } from '../../constants/PinTypes';
import { getNodeTypeInfo } from '../../constants/NodeTypes';

const compatibleTypes = getCompatibleNodeTypes(parentPinType);
```

**How it works**:
- `PT_TO_NT` mapping in `PinTypes.ts` defines pin-to-node-type compatibility
- Example: `PT_TEXTURE` pin accepts `['NT_RGB_IMAGE', 'NT_NOISE', 'NT_GRADIENT', ...]`

#### 3. Render Dropdown

```typescript
{shouldShowDropdown(selectedNode) && (
  <div className="node-type-selector">
    <label>Node Type:</label>
    <select 
      value={selectedNode.type}
      onChange={handleNodeTypeChange}
    >
      {compatibleTypes.map(type => {
        const info = getNodeTypeInfo(type);
        return (
          <option key={type} value={type}>
            {info?.displayName || type}
          </option>
        );
      })}
    </select>
  </div>
)}
```

#### 4. Handle Node Type Change

```typescript
const handleNodeTypeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
  const newType = e.target.value;
  
  if (!selectedNode || newType === selectedNode.type) return;
  
  try {
    // Replace node via gRPC
    const newHandle = await client.node.replaceNode(
      selectedNode.handle,
      newType
    );
    
    console.log(`Replaced node ${selectedNode.handle} with ${newHandle}`);
    
    // UI updates automatically via 'node:replaced' event
  } catch (error) {
    console.error('Failed to replace node:', error);
  }
};
```

### Node Replacement Flow

The `replaceNode` method in `NodeService.ts`:

```typescript
async replaceNode(oldHandle: number, newType: string): Promise<number> {
  // 1. Get parent connections (MUST BE FIRST)
  const parents = await this.getNodeParents(oldHandle);
  
  // 2. Create new node
  const newNode = await ApiNode.create(newType);
  
  // 3. Reconnect to parent pins
  for (const parent of parents) {
    await this.connectPinByIndex(
      parent.parentHandle,
      parent.pinIndex,
      newNode.handle
    );
  }
  
  // 4. Delete old node
  await this.deleteNodeOptimized(oldHandle);
  
  // 5. Emit event for UI sync
  this.emit('node:replaced', {
    oldHandle,
    newHandle: newNode.handle,
    newType
  });
  
  return newNode.handle;
}
```

**Critical**: Get parent connections BEFORE deleting the old node!

### UI State Preservation

When a node is replaced, the UI maintains:
- ✅ Selected node state (updates to new handle)
- ✅ Panel collapsed/expanded states
- ✅ Scroll position
- ✅ Graph zoom/pan position

This works because:
1. Event `node:replaced` is emitted
2. Components listen for the event
3. Components update their state with the new handle

```typescript
// In NodeGraph component
useEffect(() => {
  const handleNodeReplaced = ({ oldHandle, newHandle }) => {
    if (selectedNode?.handle === oldHandle) {
      setSelectedNode({ ...selectedNode, handle: newHandle });
    }
  };
  
  client.on('node:replaced', handleNodeReplaced);
  return () => client.off('node:replaced', handleNodeReplaced);
}, [selectedNode]);
```

## Parameter Editing Patterns

### Parameter Types

```typescript
interface NodeParameter {
  name: string;
  type: 'int' | 'float' | 'bool' | 'string' | 'enum' | 'color';
  value: any;
  min?: number;
  max?: number;
  options?: string[]; // For enums
}
```

### Rendering Parameter Inputs

```typescript
const renderParameter = (param: NodeParameter) => {
  switch (param.type) {
    case 'int':
    case 'float':
      return (
        <input
          type="number"
          value={param.value}
          min={param.min}
          max={param.max}
          step={param.type === 'float' ? 0.01 : 1}
          onChange={(e) => handleParameterChange(param.name, e.target.value)}
        />
      );
    
    case 'bool':
      return (
        <input
          type="checkbox"
          checked={param.value}
          onChange={(e) => handleParameterChange(param.name, e.target.checked)}
        />
      );
    
    case 'enum':
      return (
        <select
          value={param.value}
          onChange={(e) => handleParameterChange(param.name, e.target.value)}
        >
          {param.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    
    case 'color':
      return (
        <input
          type="color"
          value={param.value}
          onChange={(e) => handleParameterChange(param.name, e.target.value)}
        />
      );
    
    default:
      return (
        <input
          type="text"
          value={param.value}
          onChange={(e) => handleParameterChange(param.name, e.target.value)}
        />
      );
  }
};
```

### Handling Parameter Changes

```typescript
const handleParameterChange = async (paramName: string, value: any) => {
  if (!selectedNode) return;
  
  try {
    // Optimistic UI update
    setParameters(prev => 
      prev.map(p => p.name === paramName ? { ...p, value } : p)
    );
    
    // Send to Octane
    await client.node.setParameter(selectedNode.handle, paramName, value);
  } catch (error) {
    console.error('Failed to set parameter:', error);
    // Revert optimistic update
    await refreshParameters();
  }
};
```

## Adding New Inspector Features

### Step 1: Add UI Element

```typescript
// In NodeInspector/index.tsx
<div className="new-feature">
  <label>New Feature:</label>
  <button onClick={handleNewFeature}>Action</button>
</div>
```

### Step 2: Add Handler Logic

```typescript
const handleNewFeature = async () => {
  if (!selectedNode) return;
  
  try {
    await client.node.someNewMethod(selectedNode.handle);
    // Update UI state
  } catch (error) {
    console.error('Feature failed:', error);
  }
};
```

### Step 3: Add Service Method (if needed)

```typescript
// In NodeService.ts
async someNewMethod(handle: number): Promise<void> {
  const response = await fetch(`${this.serverUrl}/api/node/newmethod`, {
    method: 'POST',
    body: JSON.stringify({ handle })
  });
  
  if (!response.ok) throw new Error('Method failed');
  
  this.emit('node:updated', { handle });
}
```

### Step 4: Expose in OctaneClient

```typescript
// In OctaneClient.ts
public get node() {
  return {
    // ... existing methods
    someNewMethod: (handle: number) => this._nodeService.someNewMethod(handle)
  };
}
```

## Styling Guidelines

### Use CSS Variables

```css
/* ❌ Wrong */
.inspector-panel {
  background-color: #2a2a2a;
  color: #e0e0e0;
}

/* ✅ Correct */
.inspector-panel {
  background-color: var(--octane-panel-bg);
  color: var(--octane-text-primary);
}
```

### Inspector-Specific Variables

```css
/* Available in octane-theme.css */
--octane-inspector-bg
--octane-inspector-header-bg
--octane-inspector-border
--octane-input-bg
--octane-input-border
--octane-input-focus
--octane-label-color
```

## Common Gotchas

### 1. Parameter Updates Don't Reflect
**Problem**: Changed parameter value doesn't show in Octane

```typescript
// ❌ Wrong - parameter name typo
await client.node.setParameter(handle, 'roughnes', 0.5); // Typo!

// ✅ Correct - verify parameter name
const params = await client.node.getParameters(handle);
console.log('Available parameters:', params.map(p => p.name));
await client.node.setParameter(handle, 'roughness', 0.5);
```

### 2. Dropdown Shows Wrong Types
**Problem**: Incompatible node types appear in dropdown

```typescript
// ❌ Wrong - using wrong pin type
const compatibleTypes = getCompatibleNodeTypes('PT_MATERIAL'); // Wrong!

// ✅ Correct - get actual parent pin type
const parent = await client.node.getParent(selectedNode.handle);
const parentInfo = await client.node.getInfo(parent.handle);
const parentPin = parentInfo.pins[parent.pinIndex];
const compatibleTypes = getCompatibleNodeTypes(parentPin.type);
```

### 3. UI Doesn't Update After Node Replace
**Problem**: Inspector still shows old node

```typescript
// ❌ Wrong - not listening to events
const handleNodeTypeChange = async (newType: string) => {
  await client.node.replaceNode(handle, newType);
  // UI doesn't update!
};

// ✅ Correct - listen to 'node:replaced' event
useEffect(() => {
  const handleReplaced = ({ newHandle }) => {
    setSelectedNode(prev => ({ ...prev, handle: newHandle }));
  };
  client.on('node:replaced', handleReplaced);
  return () => client.off('node:replaced', handleReplaced);
}, []);
```

## Testing Checklist

When testing inspector changes:

1. ✅ Select different node types (camera, material, texture, geometry)
2. ✅ Edit parameters and verify changes in Octane
3. ✅ Change node type via dropdown (if applicable)
4. ✅ Verify UI updates immediately
5. ✅ Check console for errors
6. ✅ Test with nested nodes
7. ✅ Test with top-level render target nodes
8. ✅ Verify parameter validation (min/max values)

## Recent Discoveries

### Visual Debugging Session (Jan 2025)

**Problem**: Dropdown was only showing for top-level render target node, not for nested nodes.

**Debug approach**:
1. Added console.log in `shouldShowDropdown()` to see which nodes triggered it
2. Realized the condition was checking for `isRenderTarget` instead of checking for parameters
3. Changed logic to check `node.parameters && node.parameters.length > 0`
4. Tested with browser DevTools Elements tab to verify dropdown rendered
5. Success! Dropdowns now appear for all non-end nodes

**Key insight**: Use browser DevTools Elements inspector to visually verify components render when debugging UI issues.

### Node Type Info Mapping (Jan 2025)

Found that `NodeTypes.ts` has 755+ node type definitions with display names:

```typescript
export const getNodeTypeInfo = (type: string): NodeTypeInfo | undefined => {
  return NODE_TYPES_INFO[type];
};

// Usage in dropdown
const info = getNodeTypeInfo('NT_DIFFUSE_MAT');
console.log(info.displayName); // "Diffuse Material"
```

This makes dropdowns user-friendly by showing "Diffuse Material" instead of "NT_DIFFUSE_MAT".

## When to Update This Skill

Add new knowledge when you:
- Add a new inspector feature
- Discover a parameter editing pattern
- Debug a tricky inspector UI issue
- Learn about new node parameter types
- Find a clever way to optimize inspector performance
