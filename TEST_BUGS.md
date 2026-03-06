# OctaneWebR — Bug & Issue Tracker

**Last Updated:** 2026-03-05
**Source:** Round 1 + Round 2 testing (166 tests)

---

## Confirmed Bugs

| ID           | Severity | Status | Description                                                                                                                                                                                                                |
| ------------ | -------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BUG-R2-1     | Low      | OPEN   | **Inconsistent dialog dismiss behavior**: Modal dialogs (About, Prefs, Batch, etc.) close on click-away but NOT on Escape. GPU Stats popup closes on Escape but NOT on click-away. All dialogs should support both.        |
| BUG-F5-1b    | Low      | OPEN   | **F5 refresh timing race**: Outliner briefly shows "Click refresh" because `loadSceneTree` returns empty data before the server rebuild completes. Race condition between client fetch and server proto re-initialization. |
| BUG-EDGE-DEL | Medium   | OPEN   | **Edge deletion via Delete key is visual-only**: `onEdgesDelete` handler in NodeGraph removes edges from ReactFlow state but does NOT sync to Octane backend (TODO in code at line 554-562). Edges reappear on refresh.    |
| BUG-TEST-KB  | Medium   | OPEN   | **Keyboard shortcuts undertested in R2**: G2/G3/G5/G6/C17 were marked INCONCLUSIVE due to "trusted event" assumption, but app uses `document.addEventListener('keydown')` which accepts all events. Re-test in R3.         |

---

## Fixed Bugs

| ID            | Severity | Status | Description                                                                                                                                                                                                                            | Fix                                                                                                                            |
| ------------- | -------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| BUG-RT-SELECT | Medium   | FIXED  | **Render target not activated on click**: Clicking a `PT_RENDERTARGET` node in the Scene Outliner did not call `setRenderTargetNode` to activate it in the render engine. Only fired on initial load and context menu "Render" action. | Added `client.setRenderTargetNode(node.handle)` call in `handleNodeSelect` in `App.tsx` when `node.type === 'PT_RENDERTARGET'` |

---

## Feature Gaps

| ID               | Priority | Description                                                                                                                                                                                       |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-F6           | Low      | **FileBrowserDialog has no file type filter**: No dropdown to filter by file extension (.orbx, .ocs, .png, etc.)                                                                                  |
| GAP-TOOLTIPS     | Low      | **Tooltip audit needed**: Many UI elements show "Unknown type" or generic tooltips. Affects Node Inspector parameter type labels, graph toolbar icons, context menu items.                        |
| GAP-MULTICONNECT | Low      | **Multi-connect only connects first node**: Ctrl+drag from selected nodes should connect all to target pin, but currently breaks after first connection (line 313 in useConnectionOperations.ts). |

---

## UX Notes (Minor)

| ID                | Description                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| NOTE-F15          | **Multiple modal dialogs can stack**: Opening Batch Rendering then About creates 2 overlays simultaneously. Most apps enforce single-modal policy. |
| NOTE-START-RENDER | **Start Render when already finished does nothing**: This is correct Octane behavior (confirmed by user), not a bug.                               |

---

## Pending Improvements

| Item                     | Priority | Description                                                                                                                                  |
| ------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Better graph arranging   | Medium   | Current Re-arrange Graph uses basic DAG layout. Investigate improved algorithms (Sugiyama, force-directed) for better node positioning.      |
| Automated test suite     | Medium   | No unit/integration tests exist. Good candidates: `estimateNodeWidth`, position conversion functions, `CacheManager`, service layer mocking. |
| PreferencesDialog wiring | Low      | UI stub exists but not connected to Octane prefs. Use `ApiProjectManager.applicationPreferences()` for prefs node handle.                    |
