# octaneWebR Quick Start Guide

**Get up and running with octaneWebR in 10 minutes**

---

## Prerequisites

Before starting, ensure you have:

1. **Octane Render** installed on your machine
2. **Node.js 18+** installed ([Download](https://nodejs.org/))
3. **npm** (comes with Node.js)
4. A modern web browser (Chrome, Firefox, Edge, Safari)

---

## Step 1: Enable Octane LiveLink

octaneWebR communicates with Octane via the LiveLink gRPC API.

1. Launch **Octane Render**
2. Open the menu: **Help → LiveLink**
3. Confirm LiveLink is enabled (you should see a confirmation message)

**Default Port**: Octane LiveLink listens on `localhost:51022`

---

## Step 2: Install octaneWebR

Open a terminal in the octaneWebR directory and install dependencies:

```bash
# Make sure you're in the octaneWebR directory
# Then install all dependencies
npm install
```

**What this does**:
- Installs React, TypeScript, Vite
- Installs ReactFlow for node graph editor
- Installs gRPC-Web libraries
- Sets up development tools

**Time**: ~2-3 minutes (depending on internet speed)

---

## Step 3: Start Development Server

```bash
npm run dev
```

**Expected output**:
```
VITE v5.x.x  ready in XXX ms

➜  Local:   http://localhost:57341/
➜  Network: http://192.168.x.x:57341/
```

**What's happening**:
- Vite dev server starts on port `57341`
- Embedded gRPC proxy connects to Octane at `localhost:51022`
- Hot module replacement (HMR) enabled for instant updates

---

## Step 4: Open in Browser

1. Open your browser to **http://localhost:57341**
2. You should see the octaneWebR interface
3. Check the browser console (F12) for connection logs:
   - ✅ `"Connected to Octane"`
   - ✅ `"Scene tree loaded"`
   - ✅ No red errors

**If you see errors**: See [Troubleshooting](#troubleshooting) below

---

## Step 5: Explore the Interface

octaneWebR has a 5-panel layout:

```
┌─────────────────────────────────────────────────────────┐
│ Menu Bar                                                 │
├─────────┬───┬──────────────────┬───┬───────────────────┤
│         │   │                  │   │                   │
│ Scene   │ ▐ │  Render Viewport │ ▐ │  Node Inspector   │
│ Outliner│ ▐ │                  │ ▐ │                   │
│         │ ▐ ├──────────────────┤ ▐ │                   │
│         │ ▐ │                  │ ▐ │                   │
│         │ ▐ │  Node Graph      │ ▐ │                   │
│         │ ▐ │  Editor          │ ▐ │                   │
└─────────┴───┴──────────────────┴───┴───────────────────┘
```

### Scene Outliner (Left Panel)
- **Scene Tab**: Hierarchical tree of all nodes in Octane scene
- **LiveDB Tab**: Browse online materials from OTOY library
- **LocalDB Tab**: Access locally saved materials

**Try it**:
- Click the expand/collapse arrows to navigate the scene tree
- Click a node to select it (syncs with Node Graph)
- Click the eye icon to toggle visibility

### Render Viewport (Top Center)
- Live render output from Octane
- Interactive camera controls

**Try it**:
- **Left-click + drag**: Orbit camera
- **Right-click + drag**: Pan camera
- **Scroll wheel**: Zoom camera
- **Picker tools**: Click toolbar icons, then click in viewport

### Node Graph Editor (Bottom Center)
- Visual node-based editing using ReactFlow

**Try it**:
- **Right-click** on empty canvas → Select a node type → Click to create
- **Drag** from output pin (right side) to input pin (left side) to connect
- **Click** a node to select it (syncs with Scene Outliner and Node Inspector)
- **Ctrl+C, Ctrl+V**: Copy and paste nodes
- **Ctrl+F**: Open search dialog

### Node Inspector (Right Panel)
- Edit parameters for the selected node

**Try it**:
- Select a node in the Node Graph or Scene Outliner
- Edit parameter values in the Node Inspector
- Changes sync to Octane in real-time

---

## Step 6: Test Core Features

### Create a New Node

1. **Right-click** in the Node Graph (bottom center panel)
2. Navigate to a category (e.g., **Material → Diffuse Material**)
3. Click to create the node
4. The node appears in the Node Graph and Scene Outliner

### Connect Two Nodes

1. Create two nodes (e.g., a Material and a Texture)
2. **Click and drag** from the output pin (right side of first node)
3. **Drop** onto the input pin (left side of second node)
4. The connection appears as a colored edge
5. The connection syncs to Octane immediately

### Edit a Parameter

1. Select a node (click in Node Graph or Scene Outliner)
2. In the **Node Inspector** (right panel), find a parameter
3. Change the value (e.g., edit a number, check a checkbox, pick a color)
4. The change syncs to Octane in real-time
5. The render viewport updates automatically

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New scene |
| `Ctrl+O` | Open scene |
| `Ctrl+S` | Save scene |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+C` | Copy selected node(s) |
| `Ctrl+V` | Paste node(s) |
| `Ctrl+F` | Search nodes |
| `Delete` | Delete selected node(s) |
| `F5` | Refresh scene |
| `F11` | Toggle fullscreen |

**macOS**: Replace `Ctrl` with `Cmd`

---

## Menu System

### File Menu
- **New** - Clear scene and start fresh
- **Open** - Load a scene file
- **Save** - Save current scene
- **Save As** - Save with new name
- **Save Package** - Save scene with all dependencies
- **Preferences** - Application settings

### Edit Menu
- **Undo / Redo** - Undo or redo last action
- **Cut / Copy / Paste** - Node clipboard operations
- **Delete** - Delete selected nodes

### Script Menu
- **Batch Rendering** - Render multiple frames/scenes
- **Daylight Animation** - Animate sun position
- **Turntable Animation** - Rotate camera around object

### View Menu
- **Show/Hide Panels** - Toggle panel visibility
- **Refresh Scene** (F5) - Reload scene tree from Octane

### Window Menu
- **Material Database** - Open LiveDB/LocalDB browser
- **Reset Layout** - Restore default panel sizes
- **Fullscreen** (F11) - Toggle fullscreen mode

### Help Menu
- **Documentation** - Open Octane SE Manual
- **Keyboard Shortcuts** - Show shortcuts reference
- **About** - Application info

---

## Troubleshooting

### ❌ "Cannot connect to Octane"

**Possible causes**:
1. Octane is not running
2. LiveLink is not enabled
3. Firewall blocking port `51022`

**Solutions**:
1. Launch Octane
2. Enable LiveLink: **Help → LiveLink** in Octane menu
3. Check firewall settings (allow port `51022`)
4. Verify Octane is listening on `51022`:
   ```bash
   # Windows
   netstat -an | findstr 51022
   
   # macOS/Linux
   lsof -i :51022
   ```

### ❌ "npm install" fails

**Common causes**:
1. Node.js version too old
2. Network issues
3. Permissions errors

**Solutions**:
1. Update Node.js to 18+ ([Download](https://nodejs.org/))
2. Check internet connection
3. Try with sudo (Linux/macOS): `sudo npm install`
4. Clear npm cache: `npm cache clean --force`

### ❌ Browser shows blank page

**Possible causes**:
1. JavaScript error in console
2. Dev server not running
3. Wrong port

**Solutions**:
1. Open browser console (F12) and check for errors
2. Ensure `npm run dev` is running
3. Verify you're going to the correct URL: `http://localhost:57341`
4. Try a different browser

### ❌ Scene tree is empty

**Possible causes**:
1. No scene loaded in Octane
2. Scene loaded but not synced

**Solutions**:
1. Load a scene in Octane
2. Click **View → Refresh Scene** (or press F5)
3. Check browser console for errors

### ❌ Changes not syncing to Octane

**Possible causes**:
1. Octane scene is locked
2. gRPC connection dropped

**Solutions**:
1. Check Octane for locked nodes/parameters
2. Refresh the page (F5)
3. Restart Octane
4. Check browser console for errors

---

## Development Tips

### Hot Reload
Vite provides instant hot module replacement (HMR):
- Edit any `.tsx` or `.ts` file
- Save the file
- Changes appear immediately in browser (no page refresh)

### Browser DevTools
Use browser DevTools (F12) for debugging:
- **Console**: View logs and errors
- **Network**: Monitor gRPC API calls
- **Performance**: Profile rendering performance
- **React DevTools**: Inspect React component tree

### Type Checking
Run TypeScript type checking without building:
```bash
npx tsc --noEmit
```

### Production Build
Build for production deployment:
```bash
npm run build
```
Output in `dist/client/` directory.

---

## Next Steps

Now that you're up and running:

1. **Explore the Node Graph**: Create different node types, connect them
2. **Test Picker Tools**: Material picker, object picker, focus picker
3. **Try LiveDB**: Browse and download materials from OTOY library
4. **Edit Parameters**: Modify node parameters and see real-time updates
5. **Read the Manual**: [Octane SE Manual](https://docs.otoy.com/standaloneSE/)

For more details, see:
- **[README.md](./README.md)** - Complete feature list and architecture overview
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Development guide with code patterns

---

## Getting Help

- **Browser Console**: Check for errors (F12)
- **Octane Forums**: [render.otoy.com/forum](https://render.otoy.com/forum/)
- **Project Issues**: Check repository issues page

---

**Happy Rendering!** 🎨✨
