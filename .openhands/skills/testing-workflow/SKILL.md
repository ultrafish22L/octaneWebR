---
name: testing-workflow
description: Complete development and testing workflow, server management, debugging techniques, and visual debugging strategies. Use when testing features, debugging issues, or verifying builds.
triggers:
  - test
  - testing
  - debug
  - debugging
  - workflow
  - server
  - build
  - verify
---

# Testing Workflow Skill

Complete guide for development testing, debugging, and verification workflows in octaneWebR.

## Standard Development & Testing Routine

This is the **proven workflow** for making changes and testing them safely.

### Step 1: Stop Running Servers

```bash
# Kill any processes on dev ports (57341, 49019)
lsof -ti:57341,49019 2>/dev/null | xargs kill -9 2>/dev/null
echo "✅ Stopped all servers"
```

**Why**: Ensures clean state, prevents port conflicts, clears any stuck processes.

**Common issue**: If you see `EADDRINUSE` errors, this step wasn't done.

### Step 2: TypeScript Type Check

```bash
cd /workspace/project/grpcSamples/octaneWebR

# Run type check without emitting files
npx tsc --noEmit
```

**Expected output**:
```
(no output means success)
```

**If errors appear**:
```typescript
// Example error:
// src/components/NodeInspector/index.tsx:42:5
// Property 'handleChange' does not exist on type 'NodeInspector'

// Fix: Add the missing method or fix the typo
```

**Pro tip**: Fix ALL TypeScript errors before proceeding. Don't skip this step!

### Step 3: Build Production Bundle

```bash
npm run build
```

**Expected output**:
```
vite v5.0.0 building for production...
✓ 1234 modules transformed.
dist/client/index.html                   0.45 kB │ gzip:  0.30 kB
dist/client/assets/index-CcXTfaRB.js   648.23 kB │ gzip: 185.45 kB
dist/client/assets/index-B2kQ3rL9.css  112.45 kB │ gzip:  15.32 kB
✓ built in 3.45s
```

**Verify build artifacts**:
```bash
ls -lh dist/client/assets/ | head -10
```

Should see:
- `index-[hash].js` (~600-800KB)
- `index-[hash].css` (~50-150KB)
- `vendor-[hash].js` (optional, if code splitting enabled)

**If build fails**:
1. Check the error message
2. Common causes: TypeScript errors (run step 2), missing imports, syntax errors
3. Fix errors and retry

### Step 4: Start Development Server

```bash
# Start server in background
npm run dev &
DEV_PID=$!

# Wait for server initialization
sleep 5

echo "✅ Dev server started (PID: $DEV_PID)"
```

**What `npm run dev` does**:
1. Starts Vite dev server on port 57341
2. Starts Express proxy server
3. Connects to Octane via gRPC (host.docker.internal:51022)
4. Registers callbacks for render updates
5. Starts WebSocket server for live updates

**Check server logs**:
```
VITE v5.0.0  ready in 543 ms

  ➜  Local:   http://localhost:57341/
  ➜  Network: use --host to expose

[Octane Client] Connecting to host.docker.internal:51022
[Octane Client] Connected successfully
[Octane Client] Callback registration successful
[WebSocket] Server listening on port 49019
```

### Step 5: Health Check

```bash
# Test health endpoint
curl -s http://localhost:57341/api/health | python3 -m json.tool
```

**Expected response**:
```json
{
  "status": "ok",
  "octane": "connected",
  "timestamp": 1737504000000
}
```

**If status is not "ok"**:
```json
{
  "status": "error",
  "octane": "disconnected",
  "error": "Connection refused"
}
```

**Troubleshooting**:
1. Check Octane is running
2. Check LiveLink is enabled in Octane
3. Check port 51022 is accessible
4. Check Docker networking (host.docker.internal resolves correctly)

### Step 6: Browser Testing

#### Open Application
```
http://localhost:57341
```

#### Check Browser Console

**Good connection logs**:
```
[OctaneClient] Connecting to server...
[OctaneClient] Connected successfully
[SceneService] Loading scene tree...
[SceneService] Scene tree loaded: 42 nodes
[WebSocket] Connected to ws://localhost:49019
[Viewport] Render callback registered
```

**Bad connection logs**:
```
❌ Failed to connect to Octane
❌ WebSocket connection failed
❌ gRPC call failed: UNAVAILABLE
```

#### Visual Component Checklist

1. **Scene Outliner** (left panel)
   - ✅ Scene tree loads
   - ✅ Nodes expand/collapse
   - ✅ Icons display correctly
   - ✅ Selection works

2. **Node Graph Editor** (center)
   - ✅ Graph renders
   - ✅ Nodes are draggable
   - ✅ Connections show
   - ✅ Zoom/pan works

3. **Node Inspector** (right panel)
   - ✅ Shows selected node info
   - ✅ Parameters are editable
   - ✅ Dropdown renders (if applicable)
   - ✅ Changes reflect in Octane

4. **Viewport** (bottom right)
   - ✅ Render output displays
   - ✅ Live updates work
   - ✅ No WebSocket errors

5. **Menu Bar** (top)
   - ✅ Menus open correctly
   - ✅ Icons load
   - ✅ Actions work

#### Interactive Testing

```javascript
// In browser console:

// Test node creation
window.octaneClient.node.create('NT_CAMERA')
  .then(handle => console.log('Created node:', handle));

// Test scene refresh
window.octaneClient.scene.refresh()
  .then(() => console.log('Scene refreshed'));

// Check connection state
console.log('Connected:', window.octaneClient.connected);
```

### Step 7: Feature-Specific Testing

#### Testing Node Type Dropdown

1. Open Node Graph
2. Select a node with parameters (e.g., Material, Texture, Camera)
3. Check Node Inspector panel
4. Verify dropdown appears with label "Node Type:"
5. Open dropdown → should show compatible node types
6. Select different type
7. Verify:
   - ✅ Node replaced in graph
   - ✅ Scene tree updates
   - ✅ Inspector shows new node's parameters
   - ✅ No console errors

#### Testing Parameter Editing

1. Select a node
2. Change a parameter value
3. Verify:
   - ✅ Change reflects in Octane immediately
   - ✅ No console errors
   - ✅ Render updates (if applicable)

#### Testing Scene Operations

1. Click "Refresh Scene" (F5)
2. Verify scene tree reloads
3. Create a new node in Octane
4. Refresh scene
5. Verify new node appears in octaneWebR

### Step 8: Review Logs

Check terminal for any errors:

**Good logs**:
```
✅ No TypeScript errors
✅ Vite compiled successfully
✅ gRPC connection active
✅ WebSocket connected
✅ No callback failures
```

**Bad logs**:
```
❌ TypeError: Cannot read property 'handle' of undefined
❌ gRPC error: UNAVAILABLE
❌ WebSocket disconnected
❌ Callback registration failed
```

### Step 9: Stop Servers

```bash
# Clean shutdown
kill $DEV_PID 2>/dev/null

# Force kill if needed
lsof -ti:57341,49019 2>/dev/null | xargs kill -9 2>/dev/null

echo "✅ Stopped all servers"
```

## Quick Test Script

Save as `test-dev.sh` in project root:

```bash
#!/bin/bash
set -e

echo "🧪 Starting development test routine..."

# 1. Stop servers
echo "1️⃣ Stopping existing servers..."
lsof -ti:57341,49019 2>/dev/null | xargs kill -9 2>/dev/null || true

# 2. Type check
echo "2️⃣ Running TypeScript check..."
npx tsc --noEmit

# 3. Build
echo "3️⃣ Building client..."
npm run build

# 4. Start server
echo "4️⃣ Starting dev server..."
npm run dev &
DEV_PID=$!

# 5. Wait and test
echo "5️⃣ Waiting for server..."
sleep 5
curl -s http://localhost:57341/api/health | python3 -m json.tool

echo ""
echo "✅ Dev server ready at http://localhost:57341"
echo "📋 Manual testing checklist:"
echo "   1. Open http://localhost:57341 in browser"
echo "   2. Check browser console for connection"
echo "   3. Test UI components"
echo "   4. Verify feature functionality"
echo ""
echo "⏹️  To stop: kill $DEV_PID"
```

**Usage**:
```bash
chmod +x test-dev.sh
./test-dev.sh
```

## Debugging Techniques

### 1. Visual Debugging with Browser DevTools

**Problem**: UI component not rendering

**Solution**:
1. Open DevTools → Elements tab
2. Use element picker to inspect component area
3. Check if element exists in DOM but is hidden
4. Check CSS styles (display, visibility, opacity)
5. Check parent container overflow/clipping

**Example**: Dropdown wasn't showing for nested nodes
- Inspected with Elements tab
- Found dropdown div wasn't in DOM at all
- Added console.log to shouldShowDropdown()
- Discovered condition was wrong
- Fixed condition, dropdown appeared

### 2. Console Logging Strategy

**Strategic logging**:
```typescript
// ❌ Not helpful
console.log('here');

// ✅ Helpful
console.log('[NodeInspector] shouldShowDropdown:', {
  nodeType: node.type,
  hasParameters: node.parameters?.length > 0,
  result: shouldShow
});
```

**Log categories**:
```typescript
// Service layer
console.log('[NodeService] createNode:', { type, handle });

// Component
console.log('[NodeInspector] render:', { selectedNode, parametersCount });

// Event handlers
console.log('[NodeGraph] handleNodeClick:', { nodeId, event });

// gRPC calls
console.log('[OctaneClient] API call:', { method, params, response });
```

### 3. Network Tab Debugging

1. Open DevTools → Network
2. Filter for `/api/`
3. Click on a request
4. Check:
   - Request payload (what we sent)
   - Response data (what we got back)
   - Status code (200 OK, 400 Bad Request, 500 Error)
   - Timing (how long it took)

**Example**: Node creation failing
- Checked Network tab
- Saw 400 Bad Request
- Looked at response: `{"error": "Invalid node type: NT_DIFUSE_MAT"}`
- Found typo: `NT_DIFUSE_MAT` → `NT_DIFFUSE_MAT`

### 4. React DevTools

**Installation**: Chrome/Firefox extension

**Usage**:
1. Open React DevTools → Components
2. Find your component in tree
3. Inspect props and state
4. Edit values live to test behavior
5. Check hooks and their values

**Example**: State not updating
- Opened React DevTools
- Found NodeInspector component
- Saw `selectedNode` was null
- Checked parent component's state
- Found selection event wasn't firing

### 5. Server-Side Debugging

**Check server logs**:
```bash
# See what the server is doing
npm run dev

# Look for:
[Octane Client] Method called: createNode
[Octane Client] gRPC response: { handle: 42 }
[Express] POST /api/node/create → 200
```

**Test endpoints directly**:
```bash
# Bypass frontend, test API
curl -X POST http://localhost:57341/api/node/create \
  -H "Content-Type: application/json" \
  -d '{"nodeType": "NT_CAMERA"}' | jq
```

### 6. TypeScript Type Debugging

```typescript
// ❌ Not helpful
const result = await client.node.create('NT_CAMERA');

// ✅ Helpful - hover in VSCode shows type
const result: number = await client.node.create('NT_CAMERA');

// ✅ Even better - assert types to catch errors early
const result = await client.node.create('NT_CAMERA');
if (typeof result !== 'number') {
  throw new Error(`Expected number, got ${typeof result}`);
}
```

## Common Issues & Solutions

### Issue: Build Succeeds but Browser Shows Blank Page

**Symptoms**:
- Build completes successfully
- Browser loads but shows white screen
- Console shows errors

**Debug steps**:
1. Open browser console
2. Look for JavaScript errors
3. Common causes:
   - Import path errors
   - Undefined variable references
   - Missing dependencies

**Solution**:
```bash
# Clear build cache
rm -rf dist/
npm run build

# Check for runtime errors in console
```

### Issue: Hot Reload Not Working

**Symptoms**:
- Make code changes
- Browser doesn't update
- Have to manually refresh

**Solution**:
```bash
# Stop dev server
kill $DEV_PID

# Clear Vite cache
rm -rf node_modules/.vite

# Restart
npm run dev
```

### Issue: gRPC Calls Failing

**Symptoms**:
- Console shows "UNAVAILABLE" errors
- Health endpoint shows disconnected

**Debug steps**:
1. Check Octane is running: `ps aux | grep Octane`
2. Check LiveLink port: `lsof -i :51022`
3. Check Docker networking: `ping host.docker.internal`
4. Check proxy server logs

**Solution**:
- Restart Octane with LiveLink enabled
- Verify port 51022 is open
- Check firewall settings

### Issue: WebSocket Connection Lost

**Symptoms**:
- Live render stops updating
- Console shows WebSocket disconnect

**Solution**:
```bash
# Restart dev server
lsof -ti:49019 | xargs kill -9
npm run dev
```

## Performance Testing

### Check Bundle Size

```bash
npm run build
ls -lh dist/client/assets/

# Look for:
# - JS bundle < 1MB (uncompressed)
# - CSS bundle < 200KB
# - Gzipped size is ~30% of original
```

### Check Load Time

1. Open DevTools → Network
2. Disable cache
3. Refresh page
4. Check:
   - DOMContentLoaded: < 1s
   - Load: < 2s
   - First Contentful Paint: < 500ms

### Check Memory Usage

1. Open DevTools → Performance
2. Click Record
3. Use the app for 30 seconds
4. Stop recording
5. Check:
   - No memory leaks (sawtooth pattern)
   - Heap size stays reasonable (< 50MB)

## When to Update This Skill

Add new knowledge when you:
- Discover a new debugging technique
- Find a clever way to test a feature
- Debug a tricky issue with an interesting approach
- Learn about a new testing tool
- Create a useful testing script or helper
- Successfully fix a bug using visual debugging
