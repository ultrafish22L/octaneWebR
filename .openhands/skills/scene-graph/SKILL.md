---
name: scene-graph
description: Scene graph architecture, node relationships, tree manipulation, selection state management, and outliner patterns. Use when working with scene hierarchy, node connections, or the SceneOutliner component.
triggers:
  - scene graph
  - scene tree
  - outliner
  - hierarchy
  - node connections
  - parent child
  - pin connections
---

# Scene Graph Skill

Expert knowledge for working with Octane's scene graph, node relationships, and tree-based UI components.

## Scene Graph Structure

Octane's scene is a **directed acyclic graph (DAG)** where:
- **Nodes** represent scene elements (cameras, materials, geometry, etc.)
- **Pins** are connection points on nodes
- **Edges** connect parent pins to child nodes

```
RenderTarget (node handle: 1)
├─ Pin 0: Camera
│  └─ Camera Node (handle: 2)
│     ├─ Pin 0: Position
│     │  └─ Transform Node (handle: 5)
│     └─ Pin 1: Target
│        └─ Transform Node (handle: 6)
├─ Pin 1: Environment
│  └─ Daylight Node (handle: 3)
└─ Pin 2: Film Settings
   └─ Film Node (handle: 4)
```

## Data Structures

### SceneNode

```typescript
interface SceneNode {
  handle: number;           // Unique node identifier
  type: string;             // e.g., 'NT_CAMERA', 'NT_DIFFUSE_MAT'
  name: string;             // Display name
  pins: Pin[];              // Input pins
  children?: SceneNode[];   // Child nodes (for tree view)
  expanded?: boolean;       // UI state for tree expansion
}
```

### Pin

```typescript
interface Pin {
  index: number;            // Pin position (0-based)
  name: string;             // e.g., 'Diffuse', 'Specular'
  type: string;             // e.g., 'PT_TEXTURE', 'PT_MATERIAL'
  connectedNode?: number;   // Handle of connected child node
}
```

### Example Node

```json
{
  "handle": 42,
  "type": "NT_DIFFUSE_MAT",
  "name": "My Material",
  "pins": [
    {
      "index": 0,
      "name": "Diffuse",
      "type": "PT_TEXTURE",
      "connectedNode": 43
    },
    {
      "index": 1,
      "name": "Opacity",
      "type": "PT_TEXTURE",
      "connectedNode": null
    }
  ],
  "children": [
    {
      "handle": 43,
      "type": "NT_RGB_IMAGE",
      "name": "Texture.png",
      "pins": [],
      "children": []
    }
  ]
}
```

## Fetching Scene Graph

### Get Full Scene Tree

```typescript
const tree = await client.scene.getTree();

// Returns:
{
  renderTarget: SceneNode,  // Root node
  allNodes: SceneNode[]     // Flat array of all nodes
}
```

### Get Single Node Info

```typescript
const nodeInfo = await client.node.getInfo(handle);

// Returns:
{
  handle: number,
  type: string,
  name: string,
  pins: Pin[],
  parameters: Parameter[]
}
```

### Get Node Connections

```typescript
// Get parent nodes
const parents = await client.node.getParents(handle);
// Returns: [{ parentHandle: 10, pinIndex: 0 }, ...]

// Get child nodes
const children = await client.node.getChildren(handle);
// Returns: [{ childHandle: 20, pinIndex: 1 }, ...]
```

## Scene Outliner Component

**Location**: `client/src/components/SceneOutliner/`

### Architecture

```typescript
const SceneOutliner: React.FC = () => {
  const [sceneTree, setSceneTree] = useState<SceneNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const { client, connected } = useOctane();
  
  // Load scene on mount
  useEffect(() => {
    if (connected) {
      loadScene();
    }
  }, [connected]);
  
  const loadScene = async () => {
    const tree = await client.scene.getTree();
    setSceneTree(tree.renderTarget);
  };
  
  // Render tree recursively
  const renderNode = (node: SceneNode, depth: number) => {
    const isExpanded = expandedNodes.has(node.handle);
    const hasChildren = node.children && node.children.length > 0;
    
    return (
      <div style={{ paddingLeft: depth * 20 }}>
        <div onClick={() => handleNodeClick(node)}>
          {hasChildren && (
            <span onClick={() => toggleExpand(node.handle)}>
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          <img src={getNodeIcon(node.type)} />
          <span>{node.name}</span>
        </div>
        
        {isExpanded && hasChildren && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };
  
  return <div className="scene-outliner">
    {sceneTree && renderNode(sceneTree, 0)}
  </div>;
};
```

### Expand/Collapse State

```typescript
const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

const toggleExpand = (handle: number) => {
  setExpandedNodes(prev => {
    const next = new Set(prev);
    if (next.has(handle)) {
      next.delete(handle); // Collapse
    } else {
      next.add(handle);    // Expand
    }
    return next;
  });
};

// Expand all nodes
const expandAll = () => {
  const allHandles = flattenTree(sceneTree).map(n => n.handle);
  setExpandedNodes(new Set(allHandles));
};

// Collapse all nodes
const collapseAll = () => {
  setExpandedNodes(new Set());
};
```

### Selection State

```typescript
const [selectedNode, setSelectedNode] = useState<SceneNode | null>(null);

const handleNodeClick = (node: SceneNode) => {
  setSelectedNode(node);
  
  // Notify other components via event
  client.emit('node:selected', { handle: node.handle });
};

// Listen for external selection changes
useEffect(() => {
  const handleExternalSelection = ({ handle }: { handle: number }) => {
    const node = findNodeByHandle(sceneTree, handle);
    if (node) {
      setSelectedNode(node);
      // Auto-expand to show selected node
      expandToNode(handle);
    }
  };
  
  client.on('node:selected', handleExternalSelection);
  return () => client.off('node:selected', handleExternalSelection);
}, [sceneTree]);
```

## Node Graph Component

**Location**: `client/src/components/NodeGraph/`

The Node Graph uses **ReactFlow** to display the scene as a visual graph.

### Converting Tree to Graph

```typescript
import { Node, Edge } from '@xyflow/react';

const convertToGraphNodes = (sceneTree: SceneNode): { nodes: Node[], edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  const traverse = (node: SceneNode, x: number, y: number) => {
    // Add node
    nodes.push({
      id: node.handle.toString(),
      type: 'octaneNode',
      position: { x, y },
      data: {
        label: node.name,
        type: node.type,
        handle: node.handle,
        pins: node.pins
      }
    });
    
    // Add edges for each pin connection
    node.pins.forEach((pin, index) => {
      if (pin.connectedNode) {
        edges.push({
          id: `${node.handle}-${index}-${pin.connectedNode}`,
          source: node.handle.toString(),
          target: pin.connectedNode.toString(),
          sourceHandle: `pin-${index}`,
          label: pin.name
        });
      }
    });
    
    // Traverse children
    node.children?.forEach((child, i) => {
      traverse(child, x + 200, y + i * 100);
    });
  };
  
  traverse(sceneTree, 0, 0);
  return { nodes, edges };
};
```

### Custom Node Component

```typescript
const OctaneNode: React.FC<{ data: any }> = ({ data }) => {
  return (
    <div className="octane-node">
      <div className="node-header">
        <img src={getNodeIcon(data.type)} />
        <span>{data.label}</span>
      </div>
      
      <div className="node-pins">
        {data.pins.map((pin, index) => (
          <div key={index} className="pin">
            <Handle
              type="target"
              position={Position.Left}
              id={`pin-${index}`}
            />
            <span>{pin.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Node Manipulation

### Creating Nodes

```typescript
// Create node
const handle = await client.node.create('NT_DIFFUSE_MAT');

// Refresh scene to see new node
await client.scene.refresh();
```

### Deleting Nodes

```typescript
// Delete single node
await client.node.delete(handle);

// Delete with children (cascade)
const deleteNodeAndChildren = async (handle: number) => {
  const children = await client.node.getChildren(handle);
  
  // Delete children first
  for (const child of children) {
    await deleteNodeAndChildren(child.childHandle);
  }
  
  // Delete parent
  await client.node.delete(handle);
};
```

### Connecting Nodes

```typescript
// Connect child to parent's pin
await client.node.connectPinByIndex(
  parentHandle,  // Parent node
  pinIndex,      // Which pin (0-based)
  childHandle    // Child node to connect
);

// Example: Connect texture to material's diffuse pin
await client.node.connectPinByIndex(
  materialHandle,  // Parent
  0,               // Diffuse pin
  textureHandle    // Child
);
```

### Disconnecting Nodes

```typescript
// Disconnect a pin
await client.node.disconnectPin(parentHandle, pinIndex);

// Example: Remove texture from material
await client.node.disconnectPin(materialHandle, 0);
```

## Tree Traversal Utilities

### Flatten Tree

```typescript
const flattenTree = (node: SceneNode): SceneNode[] => {
  const result: SceneNode[] = [node];
  
  if (node.children) {
    node.children.forEach(child => {
      result.push(...flattenTree(child));
    });
  }
  
  return result;
};

// Usage
const allNodes = flattenTree(sceneTree);
console.log(`Scene has ${allNodes.length} nodes`);
```

### Find Node by Handle

```typescript
const findNodeByHandle = (
  tree: SceneNode, 
  handle: number
): SceneNode | null => {
  if (tree.handle === handle) return tree;
  
  if (tree.children) {
    for (const child of tree.children) {
      const found = findNodeByHandle(child, handle);
      if (found) return found;
    }
  }
  
  return null;
};

// Usage
const node = findNodeByHandle(sceneTree, 42);
```

### Find Path to Node

```typescript
const findPathToNode = (
  tree: SceneNode,
  targetHandle: number,
  currentPath: number[] = []
): number[] | null => {
  const path = [...currentPath, tree.handle];
  
  if (tree.handle === targetHandle) {
    return path;
  }
  
  if (tree.children) {
    for (const child of tree.children) {
      const found = findPathToNode(child, targetHandle, path);
      if (found) return found;
    }
  }
  
  return null;
};

// Usage - get path from root to node
const path = findPathToNode(sceneTree, 42);
// Returns: [1, 10, 20, 42] (handles from root to target)

// Expand all nodes in path
path?.forEach(handle => expandedNodes.add(handle));
```

## Common Patterns

### Auto-expand to Selected Node

```typescript
const expandToNode = (handle: number) => {
  const path = findPathToNode(sceneTree, handle);
  
  if (path) {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      // Expand all nodes in path except the target
      path.slice(0, -1).forEach(h => next.add(h));
      return next;
    });
  }
};
```

### Sync Selection Between Outliner and Graph

```typescript
// In SceneOutliner
const handleNodeClick = (node: SceneNode) => {
  setSelectedNode(node);
  client.emit('node:selected', { handle: node.handle });
};

// In NodeGraph
const handleNodeClick = (nodeId: string) => {
  const handle = parseInt(nodeId);
  client.emit('node:selected', { handle });
};

// Both listen to the same event
useEffect(() => {
  const handler = ({ handle }: { handle: number }) => {
    setSelectedNode(findNodeByHandle(sceneTree, handle));
  };
  
  client.on('node:selected', handler);
  return () => client.off('node:selected', handler);
}, [sceneTree]);
```

### Batch Operations

```typescript
// Select multiple nodes
const selectedHandles = new Set<number>();

const toggleSelection = (handle: number) => {
  setSelectedHandles(prev => {
    const next = new Set(prev);
    if (next.has(handle)) {
      next.delete(handle);
    } else {
      next.add(handle);
    }
    return next;
  });
};

// Delete multiple nodes
const deleteSelected = async () => {
  for (const handle of selectedHandles) {
    await client.node.delete(handle);
  }
  await client.scene.refresh();
  setSelectedHandles(new Set());
};
```

## Common Gotchas

### 1. Tree State After Modifications

**Problem**: Created a node but it doesn't appear in tree

```typescript
// ❌ Wrong - tree not refreshed
await client.node.create('NT_CAMERA');
// Tree still shows old state

// ✅ Correct - refresh after modifications
await client.node.create('NT_CAMERA');
await client.scene.refresh();
// Tree updates
```

### 2. Stale Node Handles

**Problem**: Node handle becomes invalid after deletion

```typescript
// ❌ Wrong - using deleted node
await client.node.delete(handle);
await client.node.getInfo(handle); // Error! Node doesn't exist

// ✅ Correct - track deleted nodes
const deletedHandles = new Set<number>();
await client.node.delete(handle);
deletedHandles.add(handle);

if (!deletedHandles.has(handle)) {
  await client.node.getInfo(handle);
}
```

### 3. Infinite Re-renders

**Problem**: Updating scene tree causes infinite loop

```typescript
// ❌ Wrong - effect runs on every tree change
useEffect(() => {
  loadScene();
}, [sceneTree]); // Tree changes → load → tree changes → ...

// ✅ Correct - only load on connection change
useEffect(() => {
  if (connected) {
    loadScene();
  }
}, [connected]);
```

## Performance Tips

### Virtualize Large Trees

For scenes with 1000+ nodes:

```typescript
import { FixedSizeTree } from 'react-vtree';

const VirtualizedOutliner: React.FC = () => {
  const treeData = useMemo(() => flattenTree(sceneTree), [sceneTree]);
  
  return (
    <FixedSizeTree
      height={600}
      itemSize={30}
      itemCount={treeData.length}
      itemData={treeData}
    >
      {({ data, index, style }) => (
        <div style={style}>
          {renderNode(data[index])}
        </div>
      )}
    </FixedSizeTree>
  );
};
```

### Memoize Node Rendering

```typescript
const NodeItem = React.memo(({ node, depth }: Props) => {
  return (
    <div style={{ paddingLeft: depth * 20 }}>
      {/* Node content */}
    </div>
  );
}, (prev, next) => {
  // Only re-render if node or depth changed
  return prev.node.handle === next.node.handle && prev.depth === next.depth;
});
```

## When to Update This Skill

Add new knowledge when you:
- Discover new scene graph patterns
- Learn about node relationship edge cases
- Find performance optimizations for large scenes
- Debug complex tree traversal issues
- Implement new tree UI features
