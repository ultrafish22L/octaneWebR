# Geometry Toolbar Implementation - octaneWebR

**Complete implementation guide for geometry/mesh node embedded toolbar**

---

## Overview

Implemented an embedded toolbar for geometry/mesh nodes in the Node Inspector, matching the Octane Standalone Edition UI exactly. The toolbar provides quick access to file operations and displays mesh information.

### Visual Reference

Based on Octane SE Manual: https://docs.otoy.com/standaloneSE/Mesh.html

```
┌───────────────────────────────────────────────────┐
│ [🟢] Geometry: Octane Benchmark Trench  [Mesh ▼] │
├───────────────────────────────────────────────────┤
│ Toolbar                                           │
│ [📁] [🔄] [💾] [🗑️]                               │
│ C:\0z\BU\Scenes\benchmark_trench\...\trench.obj  │
│ 69599 polygons                                    │
├───────────────────────────────────────────────────┤
│ 📘 File: (parameter...)                           │
│ 📘 Material: Diffuse material              [▼]    │
│ ... other parameters ...                          │
└───────────────────────────────────────────────────┘
```

---

## Files Created/Modified

### Created Files

1. **`client/src/components/NodeInspector/GeometryToolbar.tsx`** (155 lines)
   - React component for geometry toolbar
   - Displays toolbar buttons, file path, polygon count
   - Extracts mesh info from node parameters
   - Placeholder handlers for load/reload/save/clear operations

### Modified Files

2. **`client/src/components/NodeInspector/index.tsx`**
   - Added `GeometryToolbar` import (line 26)
   - Added geometry node detection logic (lines 222-227)
   - Integrated toolbar rendering for geometry nodes (line 296)

3. **`client/src/styles/node-inspector.css`**
   - Added geometry toolbar styles (lines 1189-1260)
   - Toolbar button styles with hover/active/disabled states
   - File path display with monospace font
   - Polygon count info styling

4. **`CHANGELOG.md`**
   - Added "Geometry Node Toolbar" entry with visual structure

5. **`AGENTS.md`**
   - Added implementation details to "Recent Major Changes"

---

## Implementation Details

### 1. Component Architecture

**GeometryToolbar Component**

```typescript
interface GeometryToolbarProps {
  node: SceneNode;
}

interface MeshInfo {
  filePath?: string;
  polygonCount?: number;
}
```

**Key Features:**
- Extracts file path from node parameters (searches for 'File'/'file'/'filename' parameters)
- Displays polygon count (placeholder for gRPC call)
- Four toolbar buttons: Load, Reload, Save, Clear
- Monospace file path display with ellipsis overflow
- Formatted polygon count with thousands separator

### 2. Geometry Node Detection

**Detection Logic** (NodeInspector/index.tsx):

```typescript
const isGeometryNode = currentNodeType.startsWith('NT_GEO_MESH') || 
                       currentNodeType.startsWith('NT_GEO_OBJECT') ||
                       currentNodeType.startsWith('NT_GEO_PLANE') ||
                       currentNodeType.startsWith('NT_GEO_SCATTER') ||
                       currentNodeType === 'NT_GEO_MESH';
```

**Supported Node Types:**
- `NT_GEO_MESH` - Mesh geometry
- `NT_GEO_OBJECT` - Scene objects
- `NT_GEO_PLANE` - Plane geometry
- `NT_GEO_SCATTER` - Scatter objects
- Any node type starting with `NT_GEO_MESH*`

### 3. Toolbar Buttons

**Button Icons** (from `client/public/icons/`):

| Button | Icon File | Function | Status |
|--------|-----------|----------|--------|
| Load | `load geometry.png` | Load mesh file | Placeholder |
| Reload | `RELOAD general.png` | Reload from file | Placeholder |
| Save | `save-general.png` | Export mesh | Placeholder |
| Clear | `UNLOAD_all.png` | Clear/unload mesh | Placeholder |

**Button States:**
- Normal: Dark background, subtle border
- Hover: Lighter background, blue border
- Active: Darkest background
- Disabled: 50% opacity, no pointer (Reload disabled when no file loaded)

### 4. Styling Details

**CSS Classes:**

```css
.geometry-toolbar               /* Container */
.geometry-toolbar-buttons       /* Button row */
.geometry-toolbar-btn           /* Individual button */
.geometry-file-path             /* File path display */
.geometry-polygon-count         /* Polygon count info */
```

**Design Tokens Used:**
- `--bg-primary` - Button background
- `--bg-secondary` - Toolbar background
- `--bg-hover` - Hover state
- `--bg-active` - Active state
- `--border` - Border color
- `--accent-blue` - Hover border
- `--text-primary` - Polygon count text
- `--text-secondary` - File path text

---

## Usage Example

### How It Appears

When a user selects a mesh geometry node in the Node Inspector:

1. **Node Header** displays: "Geometry: [Node Name]" with type dropdown
2. **Toolbar** appears immediately below with 4 buttons
3. **File Path** shows full path to mesh file (if loaded)
4. **Polygon Count** displays number of polygons (if available)
5. **Parameters** follow below as normal

### Code Flow

```typescript
// 1. User selects mesh node in scene
selectedNode = { type: 'NT_GEO_MESH', name: 'Benchmark Trench', ... }

// 2. NodeInspector detects geometry node
isGeometryNode = true  // NT_GEO_MESH matches condition

// 3. GeometryToolbar renders
<GeometryToolbar node={selectedNode} />

// 4. Component extracts mesh info
findFileParam(node) → filePath = "C:\...\trench.obj"
// (polygon count would come from gRPC in future)

// 5. Display updates
Toolbar buttons: [Load] [Reload] [Save] [Clear]
File path: "C:\0z\BU\Scenes\benchmark_trench\trench.obj"
Polygon count: "69,599 polygons"
```

---

## Next Steps / TODO

### 1. gRPC Integration (HIGH PRIORITY)

**Load Mesh Operation:**
```typescript
const handleLoadMesh = async () => {
  // 1. Open file picker dialog
  const filePath = await showFileDialog({
    filters: ['.obj', '.fbx', '.alembic', '.usd'],
    title: 'Load Mesh File'
  });
  
  // 2. Call gRPC API
  await client.geometry.loadMesh(node.handle, filePath);
  
  // 3. Update status bar
  setTemporaryStatus(`Loaded: ${filename}`, 3000);
};
```

**Reload Mesh Operation:**
```typescript
const handleReloadMesh = async () => {
  if (!meshInfo.filePath) return;
  
  await client.geometry.reloadMesh(node.handle);
  setTemporaryStatus('Mesh reloaded', 2000);
};
```

**Save/Export Mesh:**
```typescript
const handleSaveMesh = async () => {
  const savePath = await showSaveDialog({
    defaultPath: meshInfo.filePath,
    filters: ['.obj', '.fbx']
  });
  
  await client.geometry.exportMesh(node.handle, savePath);
  setTemporaryStatus(`Exported: ${filename}`, 3000);
};
```

**Clear Mesh:**
```typescript
const handleClearMesh = async () => {
  await client.geometry.clearMesh(node.handle);
  setTemporaryStatus('Mesh cleared', 2000);
};
```

### 2. Polygon Count Fetching (MEDIUM PRIORITY)

**Get Mesh Statistics:**
```typescript
useEffect(() => {
  if (!node || !isGeometryNode) return;
  
  const fetchMeshStats = async () => {
    const stats = await client.geometry.getMeshStatistics(node.handle);
    setMeshInfo({
      filePath: stats.filePath,
      polygonCount: stats.polygonCount
    });
  };
  
  fetchMeshStats();
}, [node]);
```

**gRPC Call Required:**
- API method: `getMeshStatistics(nodeHandle: number)`
- Returns: `{ filePath: string, polygonCount: number, vertexCount: number }`

### 3. File Picker Dialog (MEDIUM PRIORITY)

**File Dialog Component:**
```typescript
// Create client/src/components/dialogs/FilePickerDialog.tsx
interface FilePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onFileSelected: (filePath: string) => void;
  filters?: string[];
  title?: string;
}
```

**Integration with Electron:**
- For desktop builds, use Electron file dialog
- For web builds, use HTML5 file input
- Store recent directories for UX

### 4. Error Handling (MEDIUM PRIORITY)

**Error States:**
```typescript
try {
  await client.geometry.loadMesh(node.handle, filePath);
} catch (error) {
  setTemporaryStatus(`Load failed: ${error.message}`, 5000);
  Logger.error('Mesh load error:', error);
}
```

**Validation:**
- Check file exists before loading
- Validate file format (obj, fbx, alembic, etc.)
- Show error if mesh is corrupted
- Disable buttons during operations

### 5. Enhanced Features (LOW PRIORITY)

**Additional Info Display:**
- Vertex count
- Triangle count vs quad count
- UV channel info
- Material count
- Bounding box dimensions

**Additional Operations:**
- Optimize mesh
- Recalculate normals
- Triangulate mesh
- Convert format

**Toolbar Extensions:**
- Mesh preview thumbnail
- LOD (Level of Detail) controls
- Instance count display
- Memory usage indicator

---

## Testing Checklist

### Visual Testing
- [ ] Toolbar appears for NT_GEO_MESH nodes
- [ ] Toolbar appears for NT_GEO_OBJECT nodes
- [ ] Toolbar appears for NT_GEO_PLANE nodes
- [ ] Toolbar does NOT appear for material nodes
- [ ] Toolbar does NOT appear for texture nodes
- [ ] File path displays correctly with ellipsis
- [ ] Polygon count formats with commas (e.g., "69,599")
- [ ] Buttons have hover effect
- [ ] Reload button disables when no file loaded

### Functional Testing
- [ ] Load button logs click event
- [ ] Reload button logs click event
- [ ] Save button logs click event
- [ ] Clear button logs click event
- [ ] File path extraction works from node parameters
- [ ] Component updates when node changes

### Integration Testing (After gRPC Implementation)
- [ ] Load mesh operation completes successfully
- [ ] Reload updates mesh without re-selecting node
- [ ] Save exports mesh to chosen location
- [ ] Clear removes mesh from scene
- [ ] Polygon count updates after load
- [ ] Status bar shows operation messages
- [ ] Error handling works for invalid files

---

## Code Snippets

### Render Flow in NodeInspector

```typescript
// NodeParameter component (index.tsx)

// 1. Detect geometry node
const isGeometryNode = currentNodeType.startsWith('NT_GEO_MESH') || 
                       currentNodeType.startsWith('NT_GEO_OBJECT') ||
                       // ... other checks

// 2. Render structure
return (
  <div className={indentClass}>
    {/* Node header with icon and dropdown */}
    <div className="node-box">...</div>
    
    {/* Geometry Toolbar - NEW */}
    {isGeometryNode && <GeometryToolbar node={node} />}
    
    {/* Child parameters */}
    {hasChildren && (
      <div className="node-toggle-content">
        {/* parameters... */}
      </div>
    )}
  </div>
);
```

### File Path Extraction Logic

```typescript
// GeometryToolbar.tsx

const findFileParam = (n: SceneNode): void => {
  // Check if this node is a file parameter
  if (n.pinInfo?.name === 'File' || 
      n.pinInfo?.name === 'file' || 
      n.pinInfo?.name === 'filename') {
    if (n.value && typeof n.value === 'string') {
      filePath = n.value;
    }
  }
  
  // Recursively search children
  if (n.children) {
    n.children.forEach(findFileParam);
  }
};
```

### Polygon Count Formatting

```typescript
const formatPolygonCount = (count: number | undefined): string => {
  if (count === undefined) return '';
  return count.toLocaleString(); // "69599" → "69,599"
};
```

---

## Performance Considerations

### Rendering Optimization

- **React.memo**: GeometryToolbar should be memoized if parent re-renders frequently
- **Conditional Rendering**: Toolbar only renders for geometry nodes (minimal overhead)
- **File Path Extraction**: Runs only on node change, not every render

### Future Optimizations

```typescript
// Memoize expensive operations
const meshInfo = useMemo(() => {
  return extractMeshInfo(node);
}, [node.handle, node.children]);

// Debounce polygon count updates
const debouncedFetchStats = useMemo(
  () => debounce(fetchMeshStatistics, 500),
  []
);
```

---

## Design Decisions

### Why Embedded Toolbar?

**Pros:**
✅ Context-aware - appears only for geometry nodes  
✅ Space-efficient - no separate panel needed  
✅ Matches Octane SE exactly - consistent UX  
✅ Quick access - operations right where needed  

**Cons:**
❌ Limited space for many buttons (4 is max)  
❌ Requires scroll if many parameters below  

**Alternative Considered:**
- Separate geometry panel (rejected - too many panels)
- Context menu only (rejected - less discoverable)
- Floating toolbar (rejected - inconsistent with Octane SE)

### Why These 4 Operations?

**Load** - Most common operation (loading mesh files)  
**Reload** - Useful when mesh file updated externally  
**Save** - Export modified mesh for other apps  
**Clear** - Quick way to remove mesh without deleting node  

**Not Included (yet):**
- Browse location - can be added to Load button
- Mesh properties - separate dialog if needed
- Optimization tools - advanced feature for later

---

## Related Documentation

- **Octane SE Manual**: https://docs.otoy.com/standaloneSE/Mesh.html
- **Node Inspector Component**: `client/src/components/NodeInspector/index.tsx`
- **Node Types Constants**: `client/src/constants/NodeTypes.ts`
- **Scene Node Structure**: `client/src/services/OctaneClient.ts`

---

## Summary

✅ **Implemented**: Geometry toolbar UI component  
✅ **Integrated**: Toolbar renders for geometry nodes  
✅ **Styled**: Matches Octane SE visual design  
✅ **Documented**: Complete changelog and agent memory  

🔄 **Pending**: gRPC operations implementation  
🔄 **Pending**: File picker dialog integration  
🔄 **Pending**: Real polygon count fetching  

**Total Implementation Time**: ~2 hours  
**Lines of Code**: ~230 (component + styles + integration)  
**Files Modified**: 5  

---

**Created**: 2025-02-03  
**Status**: UI Complete - Backend Integration Pending  
**Next Milestone**: Implement gRPC mesh operations
