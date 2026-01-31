# Status Message Opportunities - octaneWebR

**Comprehensive list of logical places to add status messages**

This document catalogs all the places where status messages would improve user experience, organized by feature area with implementation priority and effort estimates.

---

## 🗂️ File Operations

**Priority**: HIGH | **Effort**: LOW (1-2 hours)

### Menu Bar → File

| Action | Start Message | Success Message | Duration | Event Source |
|--------|--------------|-----------------|----------|--------------|
| New Scene | "Creating new scene..." | "New scene created" | 2s | MenuBar |
| Open Scene | "Opening scene..." | "Opened: [filename]" | 3s | File dialog |
| Save Scene | "Saving scene..." | "Scene saved" | 2s | File operations |
| Save As | "Saving scene as..." | "Saved as: [filename]" | 3s | File operations |
| Save Package | "Packaging scene..." | "Package saved: [filename]" | 3s | File operations |
| Load Recent | "Loading [filename]..." | "Scene loaded" | 3s | Recent files |
| Import ORBX | "Importing ORBX file..." | "Imported: [filename]" | 3s | Import handler |
| Export ORBX | "Exporting scene..." | "Exported: [filename]" | 3s | Export handler |

**Implementation**:
```typescript
// In file operation handlers
setStatusMessage('Saving scene...');
await client.file.saveScene(path);
setTemporaryStatus(`Saved: ${filename}`, 3000);
```

---

## ✏️ Edit Operations

**Priority**: MEDIUM | **Effort**: LOW (1 hour)

### Menu Bar → Edit

| Action | Message | Duration | Event Source |
|--------|---------|----------|--------------|
| Undo | "Undone: [action name]" | 2s | CommandHistory |
| Redo | "Redone: [action name]" | 2s | CommandHistory |
| Cut | "Cut [N] node(s)" | 2s | EditActions |
| Copy | "Copied [N] node(s)" | 2s | EditActions |
| Paste | "Pasted [N] node(s)" | 2s | EditActions |
| Delete | "Deleted [N] node(s)" | 2s | EditActions |
| Select All | "Selected [N] nodes" | 2s | EditActions |
| Duplicate | "Duplicated [N] node(s)" | 2s | EditActions |

**Implementation**:
```typescript
// In EditActionsContext
const handleCopy = () => {
  // ... copy logic ...
  setTemporaryStatus(`Copied ${selectedNodes.length} node(s)`, 2000);
};
```

**Enhanced with Action Names**:
```typescript
// CommandHistory integration
const undo = () => {
  const command = history.undo();
  setTemporaryStatus(`Undone: ${command.description}`, 2000);
};
// Messages: "Undone: Create Diffuse Material", "Undone: Delete 3 nodes"
```

---

## 🎨 Render Operations

**Priority**: HIGH | **Effort**: MEDIUM (2-3 hours)

### Render Viewport & Render Service

| Action | Start Message | Progress Message | Success Message | Duration |
|--------|--------------|------------------|-----------------|----------|
| Start Render | "Starting render..." | "Rendering: [N] samples" | "Render complete" | 3s |
| Stop Render | "Stopping render..." | - | "Render stopped" | 2s |
| Pause Render | "Pausing render..." | - | "Render paused" | 2s |
| Resume Render | "Resuming render..." | - | "Render resumed" | 2s |
| Save Render | "Saving render..." | - | "Render saved: [filename]" | 3s |
| Copy to Clipboard | "Copying to clipboard..." | - | "Copied to clipboard" | 2s |
| Export Passes | "Exporting passes..." | "Exported [N]/[M] passes" | "All passes exported" | 3s |
| Set Render Region | - | - | "Render region set" | 2s |
| Clear Render Region | - | - | "Render region cleared" | 2s |
| Set Film Region | - | - | "Film region set" | 2s |

**Implementation**:
```typescript
// In RenderService
async startRender() {
  this.emit('render:start');
  // During render
  this.emit('render:progress', { samples: 100, total: 1000 });
  // On complete
  this.emit('render:complete');
}

// In App.tsx
client.on('render:start', () => setStatusMessage('Starting render...'));
client.on('render:progress', (data) => 
  setStatusMessage(`Rendering: ${data.samples}/${data.total} samples`)
);
client.on('render:complete', () => setTemporaryStatus('Render complete', 3000));
```

**Live Sample Progress**:
```typescript
// Real-time updates
"Rendering: 100/1000 samples (10%)"
"Rendering: 500/1000 samples (50%)"
"Rendering: 1000/1000 samples (100%)"
```

---

## 📦 Material Database

**Priority**: HIGH | **Effort**: LOW (1-2 hours)

### Material Database Component

| Action | Start Message | Progress Message | Success Message | Duration |
|--------|--------------|------------------|-----------------|----------|
| Load Categories | "Loading categories..." | - | "Loaded [N] categories" | 2s |
| Load Materials | "Loading materials..." | - | "Loaded [N] materials" | 2s |
| Download Material (LiveDB) | "Downloading material..." | "Downloading: [name]" | "Downloaded: [name]" | 3s |
| Apply Material | "Applying material..." | - | "Material applied" | 2s |
| Upload to LocalDB | "Uploading to LocalDB..." | - | "Uploaded: [name]" | 3s |
| Delete from LocalDB | "Deleting material..." | - | "Deleted: [name]" | 2s |
| Generate Preview | "Generating preview..." | - | "Preview generated" | 2s |
| Search Materials | - | - | "Found [N] materials" | 2s |

**Implementation**:
```typescript
// In MaterialDatabase hooks
const { mutate: downloadMaterial } = useDownloadMaterial({
  onMutate: (data) => {
    setStatusMessage(`Downloading: ${data.materialName}`);
  },
  onSuccess: (data) => {
    setTemporaryStatus(`Downloaded: ${data.materialName}`, 3000);
  },
  onError: () => {
    setTemporaryStatus('Download failed', 3000);
  }
});
```

---

## 🔗 Node Graph Operations

**Priority**: MEDIUM | **Effort**: LOW (1-2 hours)

### Node Graph Editor

| Action | Message | Duration | Event Source |
|--------|---------|----------|--------------|
| Group Nodes | "Grouped [N] nodes" | 2s | NodeService.groupNodes() |
| Ungroup Nodes | "Ungrouped node" | 2s | NodeService.ungroupNodes() |
| Replace Node | "Replaced with [NodeType]" | 2s | NodeService.replaceNode() |
| Duplicate Nodes | "Duplicated [N] node(s)" | 2s | NodeGraph |
| Search Nodes | "Found [N] matching nodes" | 2s | Search dialog |
| Connect Pins | "Connection created" | 1s | Edge creation |
| Disconnect Pin | "Connection removed" | 1s | Edge deletion |
| Cut Connections | "Cut [N] connections" | 2s | Connection cutter |
| Auto-arrange | "Nodes arranged" | 2s | Layout algorithm |
| Recenter View | "View recentered" | 1s | View controls |

**Implementation**:
```typescript
// In NodeService
async groupNodes(handles: number[]) {
  this.emit('nodes:groupStart', { count: handles.length });
  const groupHandle = await this.apiService.callApi(...);
  this.emit('nodes:groupComplete', { count: handles.length, groupHandle });
}

// In App.tsx
client.on('nodes:groupComplete', (data) => 
  setTemporaryStatus(`Grouped ${data.count} nodes`, 2000)
);
```

---

## 📷 Camera & Viewport Operations

**Priority**: MEDIUM | **Effort**: LOW (1 hour)

### Viewport Service & Camera Controls

| Action | Message | Duration | Event Source |
|--------|---------|----------|--------------|
| Reset Camera | "Camera reset" | 2s | Camera controls |
| Focus Picker (active) | "Click to set focus..." | Persistent | Picker tool |
| Focus Picker (set) | "Focus point set" | 2s | Picker result |
| Material Picker (active) | "Click to pick material..." | Persistent | Picker tool |
| Material Picker (result) | "Picked: [MaterialName]" | 2s | Picker result |
| Object Picker (active) | "Click to pick object..." | Persistent | Picker tool |
| Object Picker (result) | "Picked: [ObjectName]" | 2s | Picker result |
| Camera Target (active) | "Click to set camera target..." | Persistent | Picker tool |
| Camera Target (set) | "Camera target set" | 2s | Picker result |
| White Balance (active) | "Click to set white balance..." | Persistent | Picker tool |
| White Balance (set) | "White balance adjusted" | 2s | Picker result |
| Lock Viewport | "Viewport locked" | 2s | Lock toggle |
| Unlock Viewport | "Viewport unlocked" | 2s | Lock toggle |
| Save Camera Position | "Camera position saved" | 2s | Camera state |
| Restore Camera Position | "Camera position restored" | 2s | Camera state |

**Implementation**:
```typescript
// In ViewportService
setPickerMode(mode: PickerMode) {
  const messages = {
    focus: 'Click to set focus...',
    material: 'Click to pick material...',
    object: 'Click to pick object...',
    // ...
  };
  this.emit('picker:modeChanged', { mode, message: messages[mode] });
}

onPickerResult(result: PickerResult) {
  this.emit('picker:complete', { mode: this.mode, result });
}

// In App.tsx
client.on('picker:modeChanged', (data) => setStatusMessage(data.message));
client.on('picker:complete', (data) => 
  setTemporaryStatus(`Picked: ${data.result.name}`, 2000)
);
```

---

## 🎬 Script Operations

**Priority**: LOW | **Effort**: MEDIUM (2-3 hours)

### Menu Bar → Script

| Action | Start Message | Progress Message | Success Message | Duration |
|--------|--------------|------------------|-----------------|----------|
| Batch Render | "Starting batch render..." | "Rendering frame [N]/[M]" | "Batch render complete" | 5s |
| Daylight Animation | "Generating daylight animation..." | "Frame [N]/[M]" | "Daylight animation complete" | 5s |
| Turntable Animation | "Generating turntable..." | "Frame [N]/[M]" | "Turntable complete" | 5s |
| Animation Export | "Exporting animation..." | "Frame [N]/[M]" | "Animation exported" | 3s |

**Implementation**:
```typescript
// In Script handlers
async batchRender(config) {
  this.emit('batch:start', { totalFrames: config.frames });
  for (let i = 0; i < config.frames; i++) {
    this.emit('batch:progress', { current: i+1, total: config.frames });
    await renderFrame(i);
  }
  this.emit('batch:complete', { totalFrames: config.frames });
}

// App.tsx
client.on('batch:progress', (data) => 
  setStatusMessage(`Rendering frame ${data.current}/${data.total}`)
);
```

---

## 🔌 Connection & System Operations

**Priority**: HIGH | **Effort**: LOW (1 hour)

### Connection Service & System Events

| Event | Message | Duration | Type |
|-------|---------|----------|------|
| Connecting | "Connecting to Octane..." | Persistent | Info |
| Connected | "Connected to Octane" | 3s | Success |
| Disconnected | "Disconnected from Octane" | Persistent | Warning |
| Reconnecting | "Reconnecting to Octane..." | Persistent | Info |
| Connection Failed | "Connection failed - retry in 5s" | 5s | Error |
| WebSocket Error | "WebSocket error - reconnecting..." | 3s | Error |
| API Version Mismatch | "API version mismatch detected" | 5s | Warning |
| gRPC Error | "Communication error with Octane" | 3s | Error |

**Implementation**:
```typescript
// In ConnectionService
async connect() {
  this.emit('connection:connecting');
  try {
    await this.establishConnection();
    this.emit('connection:changed', { connected: true });
  } catch (error) {
    this.emit('connection:failed', { error });
  }
}

// App.tsx
client.on('connection:connecting', () => setStatusMessage('Connecting to Octane...'));
client.on('connection:failed', () => setTemporaryStatus('Connection failed', 5000));
```

---

## 📊 Node Inspector Operations

**Priority**: LOW | **Effort**: LOW (1 hour)

### Node Inspector Component

| Action | Message | Duration | Event Source |
|--------|---------|----------|--------------|
| Change Node Type | "Changed to [NodeType]" | 2s | Node type dropdown |
| Reset Parameter | "Parameter reset" | 1s | Parameter controls |
| Reset All Parameters | "All parameters reset" | 2s | Reset button |
| Load Preset | "Preset loaded: [name]" | 2s | Preset selector |
| Save Preset | "Preset saved: [name]" | 2s | Save preset |
| Batch Parameter Update | "Updated [N] parameters" | 2s | Bulk edit |

---

## 🖼️ Image & Export Operations

**Priority**: MEDIUM | **Effort**: LOW (1 hour)

### Export Dialogs & Handlers

| Action | Start Message | Success Message | Duration |
|--------|--------------|-----------------|----------|
| Export Image | "Exporting image..." | "Exported: [filename]" | 3s |
| Export EXR | "Exporting EXR..." | "Exported: [filename]" | 3s |
| Export PNG | "Exporting PNG..." | "Exported: [filename]" | 3s |
| Export JPG | "Exporting JPG..." | "Exported: [filename]" | 3s |
| Export All Passes | "Exporting passes..." | "Exported [N] passes" | 5s |
| Screenshot | "Saving screenshot..." | "Screenshot saved" | 2s |
| Copy Render | "Copying render..." | "Copied to clipboard" | 2s |

---

## ⚙️ Preferences & Settings

**Priority**: LOW | **Effort**: LOW (30 min)

### Preferences Dialog

| Action | Message | Duration |
|--------|---------|----------|
| Save Preferences | "Preferences saved" | 2s |
| Reset Preferences | "Preferences reset to default" | 2s |
| Import Settings | "Settings imported" | 2s |
| Export Settings | "Settings exported" | 2s |

---

## 🔍 Search & Filter Operations

**Priority**: LOW | **Effort**: LOW (30 min)

### Search Dialogs

| Action | Message | Duration |
|--------|---------|----------|
| Node Search | "Found [N] nodes" | 2s |
| Material Search | "Found [N] materials" | 2s |
| Filter Applied | "Showing [N] items" | 2s |
| Clear Filters | "Filters cleared" | 1s |

---

## 📐 Layout & Panel Operations

**Priority**: LOW | **Effort**: LOW (30 min)

### Window Management

| Action | Message | Duration |
|--------|---------|----------|
| Reset Layout | "Layout reset" | 2s |
| Save Layout | "Layout saved" | 2s |
| Load Layout | "Layout loaded" | 2s |
| Toggle Fullscreen | "Fullscreen [on/off]" | 1s |
| Panel Hidden | "[Panel] hidden" | 1s |
| Panel Shown | "[Panel] shown" | 1s |

---

## 🎯 Priority Matrix

### High Priority (Implement First)
1. **File Operations** - Users need feedback on save/load
2. **Render Operations** - Critical for render progress visibility
3. **Material Database** - Download progress important
4. **Connection Events** - System status awareness

### Medium Priority (Implement Second)
5. **Edit Operations** - Nice-to-have for clipboard operations
6. **Node Graph** - Feedback on group/ungroup helpful
7. **Camera/Viewport** - Picker mode feedback useful
8. **Export Operations** - Progress on exports important

### Low Priority (Implement Last)
9. **Script Operations** - Advanced feature, less frequent
10. **Node Inspector** - Less critical operations
11. **Preferences** - Infrequent operations
12. **Layout** - Visual feedback already exists

---

## 📈 Implementation Roadmap

### Phase 1: Core Operations (2-3 days)
- File operations (save/load/export)
- Render progress and control
- Material database downloads
- Connection status enhancements

### Phase 2: User Actions (1-2 days)
- Edit operations (undo/redo/copy/paste)
- Node graph operations (group/ungroup)
- Camera/viewport pickers
- Image exports

### Phase 3: Advanced Features (1-2 days)
- Script operations (batch render)
- Node inspector operations
- Preferences
- Layout management

---

## 💡 Implementation Pattern

**Standard Pattern**:
```typescript
// 1. In Service - Emit events
async myOperation() {
  this.emit('operation:start');
  try {
    const result = await doWork();
    this.emit('operation:complete', { result });
  } catch (error) {
    this.emit('operation:failed', { error });
  }
}

// 2. In App.tsx - Listen and update status
useEffect(() => {
  client.on('operation:start', () => 
    setStatusMessage('Processing...')
  );
  client.on('operation:complete', (data) => 
    setTemporaryStatus(`Completed: ${data.result}`, 3000)
  );
  client.on('operation:failed', () => 
    setTemporaryStatus('Operation failed', 3000)
  );
  return () => { /* cleanup */ };
}, [client]);
```

---

## 🎨 Message Style Guide

### Message Patterns

**Start**: `"[Action]ing..."` - "Saving...", "Loading...", "Exporting..."  
**Progress**: `"[Action]: [detail]"` - "Rendering: 100/1000 samples"  
**Success**: `"[Action] [result]"` - "Saved scene", "Loaded 42 nodes"  
**Error**: `"[Action] failed"` - "Save failed", "Connection failed"  
**Picker Active**: `"Click to [action]..."` - "Click to set focus..."  
**Picker Result**: `"[Action]: [result]"` - "Picked: Diffuse Material"  

### Duration Guidelines

- **Instant actions** (< 100ms): 1 second
- **Quick actions** (< 1s): 2 seconds
- **Normal actions** (1-3s): 3 seconds
- **Long actions** (3-10s): 5 seconds
- **Progress actions**: Persistent until complete
- **Error/Warning**: 5 seconds (give user time to read)
- **Picker modes**: Persistent until picker completes/cancels

### Capitalization

- Use sentence case: "Scene saved" (not "Scene Saved")
- Node types: Use proper names: "Diffuse Material" (not "diffuse material")
- File names: Preserve original: "myScene.orbx"

---

## 📊 Total Opportunity Count

**By Category**:
- File Operations: 8 messages
- Edit Operations: 8 messages
- Render Operations: 11 messages
- Material Database: 8 messages
- Node Graph: 10 messages
- Camera/Viewport: 14 messages
- Script Operations: 4 messages
- Connection/System: 8 messages
- Node Inspector: 6 messages
- Export Operations: 7 messages
- Preferences: 4 messages
- Search/Filter: 4 messages
- Layout/Panels: 6 messages

**Total**: ~98 potential status messages

**Estimated Implementation Time**:
- High Priority: 6-8 hours
- Medium Priority: 4-6 hours
- Low Priority: 3-4 hours
- **Total**: 13-18 hours for complete coverage

---

**Next Steps**: 
1. Review and prioritize based on user needs
2. Implement Phase 1 (core operations)
3. Gather user feedback
4. Iterate on message content and timing
5. Expand to Phase 2 and 3

---

**Created**: 2025-02-03  
**Status**: Ready for implementation planning
