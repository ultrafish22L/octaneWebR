# Status Message System Architecture

## Component Hierarchy

```
App
├── QueryClientProvider
│   └── OctaneProvider
│       └── StatusMessageProvider ← NEW PROVIDER
│           └── EditActionsProvider
│               └── AppContent
│                   ├── MenuBar
│                   ├── SceneOutliner
│                   ├── CallbackRenderViewport
│                   ├── NodeGraphEditor
│                   ├── NodeInspector
│                   └── StatusBar ← DISPLAYS MESSAGE
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     StatusMessageContext                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ State:                                                     │  │
│  │   - statusMessage: string                                 │  │
│  │   - timeoutId: NodeJS.Timeout | null                      │  │
│  │                                                            │  │
│  │ Methods:                                                   │  │
│  │   - setStatusMessage(message)     [Persistent]            │  │
│  │   - setTemporaryStatus(msg, ms)   [Auto-clear]            │  │
│  │   - clearStatusMessage()          [Reset to default]      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ provides
                    ┌─────────────────────┐
                    │   useStatusMessage  │
                    │       (hook)        │
                    └─────────────────────┘
                              ↓ used by
        ┌────────────────────────────────────────────┐
        │              AppContent                    │
        │                                            │
        │  useEffect(() => {                         │
        │    client.on('scene:buildStart', ...)      │
        │    client.on('scene:buildProgress', ...)   │
        │    client.on('scene:buildComplete', ...)   │
        │    client.on('nodeAdded', ...)             │
        │    client.on('nodeDeleted', ...)           │
        │    client.on('connection:changed', ...)    │
        │  }, [client])                              │
        └────────────────────────────────────────────┘
                              ↑ listens to
        ┌─────────────────────────────────────────────┐
        │           OctaneClient / Services           │
        │                                             │
        │  SceneService.buildSceneTree()              │
        │    ├─ emit('scene:buildStart')              │
        │    ├─ emit('scene:buildProgress', data)     │
        │    └─ emit('scene:buildComplete', data)     │
        │                                             │
        │  NodeService.createNode()                   │
        │    └─ emit('nodeAdded', data)               │
        │                                             │
        │  NodeService.deleteNode()                   │
        │    └─ emit('nodeDeleted', data)             │
        │                                             │
        │  ConnectionService.connect()                │
        │    └─ emit('connection:changed', data)      │
        └─────────────────────────────────────────────┘
```

## Event Flow Timeline

```
Time  │ Event                      │ Status Message
──────┼────────────────────────────┼────────────────────────────────────
0.0s  │ scene:buildStart           │ "Building scene tree..."
0.1s  │ scene:buildProgress (1)    │ "Building scene: Getting root node graph"
0.2s  │ scene:buildProgress (2)    │ "Building scene: Checking root node"
0.3s  │ scene:buildProgress (3)    │ "Building scene: Building scene tree"
0.5s  │ scene:buildComplete        │ "Scene loaded: 42 nodes (3 top-level) in 0.45s"
      │                            │ [5-second timer starts]
5.5s  │ [timeout]                  │ "OctaneWebR - React TypeScript + Node.js gRPC"
      │                            │
10.0s │ nodeAdded                  │ "Node created"
      │                            │ [2-second timer starts]
12.0s │ [timeout]                  │ "OctaneWebR - React TypeScript + Node.js gRPC"
      │                            │
15.0s │ nodeDeleted                │ "Node deleted"
      │                            │ [2-second timer starts]
17.0s │ [timeout]                  │ "OctaneWebR - React TypeScript + Node.js gRPC"
```

## State Transitions

```
┌─────────────────────────────────────────────────────────────┐
│                     Default State                           │
│  "OctaneWebR - React TypeScript + Node.js gRPC"             │
└─────────────────────────────────────────────────────────────┘
                    ↓                           ↑
          setStatusMessage()          clearStatusMessage()
                    ↓                           ↑
┌─────────────────────────────────────────────────────────────┐
│                 Persistent Message                          │
│  "Building scene tree..."                                   │
│  (stays until changed or cleared)                           │
└─────────────────────────────────────────────────────────────┘
                    ↓                           ↑
       setTemporaryStatus(msg, duration)       │
                    ↓                           │
┌─────────────────────────────────────────────────────────────┐
│                 Temporary Message                           │
│  "Scene loaded: 42 nodes in 0.45s"                          │
│  [Auto-clear after duration] ──────────────────────────────→│
└─────────────────────────────────────────────────────────────┘
```

## Code Flow Example

### 1. User Opens Scene

```
User clicks "Refresh Scene" (F5)
           ↓
App.tsx: handleSceneRefresh()
           ↓
SceneOutliner: triggers buildSceneTree()
           ↓
┌──────────────────────────────────────────────────────────┐
│ SceneService.buildSceneTree()                            │
│   ├─ emit('scene:buildStart')                            │
│   │     └→ AppContent listener → setStatusMessage(...)   │
│   │           └→ StatusBar displays "Building..."        │
│   │                                                       │
│   ├─ [Step 1: Get root]                                  │
│   │  emit('scene:buildProgress', {step: '...'})          │
│   │     └→ setStatusMessage("Building scene: ...")       │
│   │                                                       │
│   ├─ [Step 2: Check root]                                │
│   │  emit('scene:buildProgress', {step: '...'})          │
│   │                                                       │
│   ├─ [Step 3: Build tree]                                │
│   │  emit('scene:buildProgress', {step: '...'})          │
│   │                                                       │
│   └─ emit('scene:buildComplete', {nodeCount, time})      │
│         └→ setTemporaryStatus("Scene loaded...", 5000)   │
│               └→ StatusBar displays completion msg       │
│                     └→ [5s timer] → auto-clear           │
└──────────────────────────────────────────────────────────┘
```

### 2. User Creates Node

```
User right-clicks → "Create Node" → selects type
           ↓
NodeGraphEditor: handleCreateNode()
           ↓
NodeService.createNode()
           ↓
emit('nodeAdded', {node, handle})
           ↓
AppContent listener → setTemporaryStatus("Node created", 2000)
           ↓
StatusBar displays "Node created"
           ↓
[2 seconds later]
           ↓
Auto-clear to default message
```

## File Structure

```
octaneWebR/
├── client/src/
│   ├── contexts/
│   │   └── StatusMessageContext.tsx     ← NEW: Provider + Hook
│   │
│   ├── App.tsx                          ← MODIFIED: Add provider + listeners
│   │
│   ├── services/octane/
│   │   └── SceneService.ts              ← MODIFIED: Add emit() calls
│   │
│   └── components/
│       └── [StatusBar is part of App.tsx footer]
│
└── [Documentation]
    ├── STATUS_MESSAGE_FEATURE.md        ← Feature documentation
    ├── STATUS_MESSAGE_SUMMARY.md        ← Implementation summary
    ├── STATUS_MESSAGE_ARCHITECTURE.md   ← This file
    └── CHANGELOG.md                     ← Version history
```

## Message Timeout Management

```typescript
// StatusMessageContext.tsx

┌─────────────────────────────────────────────────────┐
│  setTemporaryStatus(message, duration)              │
│    │                                                 │
│    ├─ Clear existing timeout (if any)               │
│    │    └─ clearTimeout(timeoutId)                  │
│    │                                                 │
│    ├─ Set new message                               │
│    │    └─ setStatusMessageState(message)           │
│    │                                                 │
│    └─ Create new timeout                            │
│         └─ setTimeout(() => {                       │
│              setStatusMessageState(DEFAULT_MESSAGE) │
│              setTimeoutId(null)                     │
│            }, duration)                             │
└─────────────────────────────────────────────────────┘

Prevents message overlap:
  - If new message arrives before timeout
  - Old timeout is cleared
  - New message + new timeout set
  - Ensures only one active timeout at a time
```

## UI Layout

```
┌────────────────────────────────────────────────────────────────┐
│  File  Edit  Script  View  Window  Help     [Status] [Connect] │ ← MenuBar
├────┬───┬──────────────────────────────┬───┬────────────────────┤
│    │   │                              │   │                    │
│    │   │      Viewport                │   │   Node Inspector   │
│    │ ▌ │                              │ ▌ │                    │
│ Sc │   ├──────────────────────────────┤   │                    │
│ en │   │                              │   │                    │
│ e  │   │    Node Graph Editor         │   │                    │
│    │   │                              │   │                    │
├────┴───┴──────────────────────────────┴───┴────────────────────┤
│ Building scene: Getting root node graph      OctaneLive: conn…│ ← StatusBar
│  ↑                                                        ↑     │
│  statusMessage (dynamic)                  connection status    │
└────────────────────────────────────────────────────────────────┘
```

## Integration Points

### Current Integration

- ✅ SceneService (scene building)
- ✅ NodeService (node add/delete via events)
- ✅ ConnectionService (via connection:changed event)

### Future Integration Opportunities

- [ ] **File Operations**: "Opening scene...", "Saving...", "Exported to X"
- [ ] **Render Service**: "Render started", "Samples: 100/1000"
- [ ] **Material Database**: "Downloading material...", "Material downloaded"
- [ ] **Clipboard Operations**: "Copied 3 nodes", "Pasted from clipboard"
- [ ] **Undo/Redo**: "Undone: Node creation", "Redone: Node deletion"
- [ ] **Node Graph**: "Grouped 5 nodes", "Ungrouped node"
- [ ] **Viewport**: "Camera reset", "Screenshot saved"

---

**Architecture Pattern**: Event-driven with React Context  
**Complexity**: Low (single context, simple state)  
**Performance**: Negligible (status updates are infrequent)  
**Maintainability**: High (centralized, well-documented)  
**Extensibility**: Excellent (add events from any service)
