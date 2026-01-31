# Status Message Feature

**Live status updates in the status bar**

## Overview

Added a centralized status message system that displays real-time application events and progress in the status bar. The status bar now shows:

- Scene tree building progress
- Node creation/deletion notifications
- Connection status changes
- Temporary success messages with auto-clear

## Implementation

### 1. StatusMessageContext (`client/src/contexts/StatusMessageContext.tsx`)

Created a new React Context to manage global status messages with three methods:

- **`setStatusMessage(message: string)`** - Set a persistent status message
- **`clearStatusMessage()`** - Reset to default message
- **`setTemporaryStatus(message: string, duration?: number)`** - Show temporary message (auto-clears after duration, default 3s)

**Features**:
- Timeout management (prevents overlapping messages)
- Default message: "OctaneWebR - React TypeScript + Node.js gRPC"
- Type-safe context with error handling

### 2. App.tsx Updates

**Provider Hierarchy**:
```typescript
<QueryClientProvider>
  <OctaneProvider>
    <StatusMessageProvider>  // ← NEW
      <EditActionsProvider>
        <AppContent />
      </EditActionsProvider>
    </StatusMessageProvider>
  </OctaneProvider>
</QueryClientProvider>
```

**Status Bar**:
```typescript
<footer className="status-bar">
  <div className="status-left">
    <span className="status-item">{statusMessage}</span>  // ← Dynamic
  </div>
  <div className="status-center"></div>
  <div className="status-right">
    <span className="status-item">
      OctaneLive: <span>{connected ? 'connected' : 'disconnected'}</span>
    </span>
  </div>
</footer>
```

**Event Listeners**:
Added useEffect hook to listen for scene and app events:

```typescript
useEffect(() => {
  const handleBuildStart = () => {
    setStatusMessage('Building scene tree...');
  };

  const handleBuildProgress = (data: { step: string }) => {
    setStatusMessage(`Building scene: ${data.step}`);
  };

  const handleBuildComplete = (data: { nodeCount, topLevelCount, elapsedTime }) => {
    setTemporaryStatus(
      `Scene loaded: ${nodeCount} nodes (${topLevelCount} top-level) in ${elapsedTime}s`,
      5000
    );
  };

  const handleNodeCreated = () => {
    setTemporaryStatus('Node created', 2000);
  };

  const handleNodeDeletedStatus = () => {
    setTemporaryStatus('Node deleted', 2000);
  };

  const handleConnectionChanged = (data: { connected: boolean }) => {
    if (data.connected) {
      setTemporaryStatus('Connected to Octane', 3000);
    } else {
      setStatusMessage('Disconnected from Octane');
    }
  };

  client.on('scene:buildStart', handleBuildStart);
  client.on('scene:buildProgress', handleBuildProgress);
  client.on('scene:buildComplete', handleBuildComplete);
  client.on('node:created', handleNodeCreated);
  client.on('nodeDeleted', handleNodeDeletedStatus);
  client.on('connection:changed', handleConnectionChanged);

  return () => { /* cleanup */ };
}, [client, setStatusMessage, setTemporaryStatus]);
```

### 3. SceneService Updates (`client/src/services/octane/SceneService.ts`)

Added event emissions during scene tree building:

**Events Emitted**:

1. **`scene:buildStart`** - Emitted when scene tree build begins
2. **`scene:buildProgress`** - Emitted at each major step
   - Data: `{ step: string }` - Description of current step
   - Examples: "Getting root node graph", "Checking root node", "Building scene tree"
3. **`scene:buildComplete`** - Emitted when build finishes
   - Data: `{ nodeCount: number, topLevelCount: number, elapsedTime: string }`

**Code Changes**:
```typescript
// Start
Logger.info('🌳 Building scene tree...');
this.emit('scene:buildStart');

// Progress
this.emit('scene:buildProgress', { step: 'Getting root node graph' });
this.emit('scene:buildProgress', { step: 'Checking root node' });
this.emit('scene:buildProgress', { step: 'Building scene tree' });

// Complete
this.emit('scene:buildComplete', { 
  nodeCount: this.scene.map.size, 
  topLevelCount: this.scene.tree.length,
  elapsedTime 
});
```

## Status Messages

### Scene Building
- **"Building scene tree..."** - Initial build start
- **"Building scene: Getting root node graph"** - Step 1
- **"Building scene: Checking root node"** - Step 2
- **"Building scene: Building scene tree"** - Step 3
- **"Scene loaded: 42 nodes (3 top-level) in 0.45s"** - Success (5s duration)

### Node Operations
- **"Node created"** - When node is created (2s duration)
- **"Node deleted"** - When node is deleted (2s duration)

### Connection Status
- **"Connected to Octane"** - On successful connection (3s duration)
- **"Disconnected from Octane"** - On disconnect (persistent)

### Default
- **"OctaneWebR - React TypeScript + Node.js gRPC"** - Default idle state

## Usage Example

Any component can update the status bar by using the hook:

```typescript
import { useStatusMessage } from '../contexts/StatusMessageContext';

function MyComponent() {
  const { setStatusMessage, setTemporaryStatus } = useStatusMessage();

  const handleAction = async () => {
    setStatusMessage('Processing...');
    
    try {
      await doSomething();
      setTemporaryStatus('Action completed successfully!', 3000);
    } catch (error) {
      setTemporaryStatus('Action failed', 3000);
    }
  };

  return <button onClick={handleAction}>Do Action</button>;
}
```

## Future Enhancements

Potential additions:
- Progress bars for long operations
- Status message queue (multiple messages)
- Status message types (info, warning, error, success) with colors
- Click-to-dismiss for persistent messages
- Message history/log viewer
- Integration with more events:
  - File operations (open, save, export)
  - Render progress
  - Material database downloads
  - Node graph operations (copy, paste, group)

## Files Modified

1. **`client/src/contexts/StatusMessageContext.tsx`** - NEW
   - Context provider for status messages
   - Hook for easy access

2. **`client/src/App.tsx`**
   - Added StatusMessageProvider to provider hierarchy
   - Added useStatusMessage hook
   - Updated status bar to use dynamic message
   - Added event listeners for status updates

3. **`client/src/services/octane/SceneService.ts`**
   - Added scene:buildStart event
   - Added scene:buildProgress events (3 steps)
   - Added scene:buildComplete event with statistics

## Testing

To test the feature:

1. Start Octane with gRPC enabled
2. Start octaneWebR: `npm run dev`
3. Open browser to http://localhost:57341
4. Watch status bar during initial connection and scene load
5. Create/delete nodes to see notifications
6. Refresh scene (F5) to see build progress

Expected behavior:
- Status updates appear in left section of status bar
- Messages auto-clear after specified duration
- Build progress shows each step in real-time
- Completion message shows node count and timing

---

**Created**: 2025-02-03  
**Author**: AI Assistant  
**Status**: Ready for testing
