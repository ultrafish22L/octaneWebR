# OctaneWebR — Test Plan

**App:** OctaneWebR v1.4.2
**Scene:** `teapot.orbx` (reload via File → Open to restore after destructive tests; requires clicking confirm in Octane)
**Tests:** 161 base + 20 Round 3 new = 181 total

---

## Test Tools

| Action            | Use For                                                       |
| ----------------- | ------------------------------------------------------------- |
| `left_click`      | Buttons, nodes, toggles, checkboxes, menu items               |
| `right_click`     | Context menus on nodes, outliner items, viewport              |
| `double_click`    | Double-click interactions                                     |
| `left_click_drag` | Drag nodes, connect pins, box-select, resize splitters        |
| `key`             | Keyboard shortcuts — Del, Escape, Ctrl+C/V/X/D/G, F1, F5, F11 |
| `type`            | Text input into fields                                        |
| `scroll`          | Scroll within panels, zoom/pan via mouse wheel                |
| `screenshot`      | Visual verification                                           |

All keyboard shortcuts work — the app uses `document.addEventListener('keydown')` which accepts all events.
All drag operations work — `left_click_drag` generates trusted mouse events.
Only limitation: no middle-click tool (C4 pan workaround: use `scroll`).

---

## Screenshot Rule

Any test that makes a **visible change** to the UI must take before/after screenshots:
delete, add, connect, disconnect, change node type, copy/paste, group/ungroup, drag reposition.

**Filename format:** `R<round>_<testID>_<description>_<before|after>.png`
If verifying a bug fix, include the bug ID: `R3_I11_BUG-RT-SELECT_rt-select_after.png`

---

## Rules & Procedures

### Before Testing

1. **Set log level to DEBUG**: In `client/src/utils/Logger.ts`, ensure the dev default is `LogLevel.DEBUG` (not INFO).
2. **Enable server-side file logging**: In `vite-plugin-octane-grpc.ts`, set `DEBUG_FILE_LOG = true` so gRPC request/response pairs are written to `grpc-debug.log`.
3. **Verify Octane is running**: Status bar should show "Connected". If not, wait for Octane to start before proceeding.
4. **Start the dev server**: `npm run dev` (or use `preview_start`). Confirm the app loads and renders.
5. **Take a baseline screenshot** before starting each pass.

### During Testing

- **Verify gRPC calls** for any test that changes a value (checkbox, spinner, dropdown, color, etc.): read `grpc-debug.log` to confirm `setPinValueByPinID` or equivalent call appeared.
- **Check console for errors** after each category block (use `preview_console_logs` or browser console). Zero errors expected unless specifically testing error scenarios.
- **Test incrementally** — don't accumulate many tests before checking for regressions.
- **Run destructive tests last** within each pass (delete, create, change type). Reload `teapot.orbx` after each one.

### Scene Restoration

The scene can always be restored by reloading `teapot.orbx`:

1. File → Open → navigate to `teapot.orbx` → Open
2. Octane shows a confirm dialog — **user must click confirm** (cannot be automated)
3. Wait for scene to fully load (outliner populates, render image appears)
4. Continue testing

### If Octane Crashes

1. **Stop testing immediately** — do not continue clicking or sending gRPC calls.
2. **Log the crash**: note which test was running, what action triggered it, and take a screenshot if the app is still visible.
3. **Wait for Octane to restart** — the user will restart it manually.
4. **Refresh the page** (F5 or reload) after Octane is back up.
5. **Verify connection**: status bar shows "Connected", render image appears.
6. **Re-run the test that caused the crash** to confirm whether it's reproducible.
7. If reproducible, file as a bug with severity **High** and mark the test as **FAIL**.

### If the App (Web UI) Crashes or Freezes

1. **Refresh the page** (F5 or hard reload).
2. If the page won't load, restart the dev server.
3. **Log what happened**: test ID, action, any console errors before the crash.
4. Re-run the test. If reproducible, file as a bug.

### If a Test Fails

1. **Take a screenshot** immediately showing the failure state.
2. **Check console logs** for errors — copy relevant output.
3. **Check `grpc-debug.log`** if the failure involves a missing or wrong gRPC call.
4. **Log the failure** in `TEST_RESULTS.md` with result **FAIL** and a clear description of what went wrong.
5. **File a bug** in `TEST_BUGS.md` with a new ID (e.g. `BUG-R3-1`).
6. **Continue testing** — don't stop the pass for a single failure unless it blocks subsequent tests.

### If a Test Is Blocked

If a test cannot run because of a prerequisite failure (e.g. can't test delete if node creation failed):

1. Mark the test as **BLOCKED** with the blocking test ID noted.
2. Move on to the next test.
3. Revisit blocked tests after the blocker is resolved.

### New Bug Discovery

If you discover a bug while running an unrelated test:

1. Note it immediately — don't lose the observation.
2. Add it to `TEST_BUGS.md` with the next available bug ID.
3. If it doesn't block the current test, continue testing and investigate later.

### Result Recording

After each pass, update `TEST_RESULTS.md` with:

- Test ID, result (PASS / FAIL / BLOCKED / N/A), and notes
- Summary counts at the bottom
- Any new bugs discovered

### Keep Everything in Files

All test state, results, bugs, and observations **must be written to files** — never kept only in conversation memory. Conversation context can be lost during compaction. The files are the source of truth:

- `TEST_RESULTS.md` — all test results and pass/fail counts
- `TEST_BUGS.md` — all bugs, gaps, and UX notes
- `TEST_PLAN.md` — this file, the master test plan
- `screenshots/` — all screenshots taken during testing

If you discover something important, write it to a file immediately. If it's not in a file, it doesn't exist.

### Clear Logs Between Passes

`grpc-debug.log` and `octaneWebR_client.log` grow large and make it hard to identify which calls belong to the current test. Before each pass:

1. Delete or truncate `grpc-debug.log`
2. Or note a timestamp marker so you know where to look

### New Session / After Compaction

When starting a new conversation or after context compaction:

1. **Read all test files first**: `TEST_PLAN.md`, `TEST_RESULTS.md`, `TEST_BUGS.md`
2. Check which pass/test was last completed
3. Resume from where you left off — don't restart from the beginning
4. Run the smoke test to verify the environment is working

### Coordinate Workflow

Before clicking any UI element:

1. Take a `screenshot` first to see the current state
2. Identify the element's pixel coordinates from the screenshot
3. Click at the identified coordinates
4. Don't guess coordinates — always screenshot first

### gRPC Log Verification

These tests specifically require checking `grpc-debug.log`:
D6, D7, D8, D9, D15, D16, D18, D19, D20, D21, I4, I11

### End-to-End Smoke Test

Use the **Orthographic checkbox** on the Camera node as the standard quick check:

1. Select Camera in Scene Outliner
2. Toggle Orthographic checkbox in Node Inspector
3. Verify `setPinValueByPinID` appears in `grpc-debug.log`
4. Verify render image updates

Run this smoke test at the start of each session and after any crash/restart.

---

## Category A: Menu Bar (21 tests)

### Easy (A1–A7)

| ID  | Test                           | Pass Criteria                                 |
| --- | ------------------------------ | --------------------------------------------- |
| A1  | File → Preferences             | PreferencesDialog opens, Escape closes        |
| A2  | Help → About OctaneRender      | AboutDialog shows version string, Close works |
| A3  | Help → Open online manual (F1) | Handler fires (external link)                 |
| A4  | Edit → Find (Ctrl+F)           | SearchDialog opens in Node Graph panel        |
| A5  | Script → Batch rendering       | BatchRenderingDialog opens, Cancel closes     |
| A6  | Script → Daylight animation    | DaylightAnimationDialog opens, Cancel closes  |
| A7  | Script → Turntable animation   | TurntableAnimationDialog opens, Cancel closes |

### Medium (A8–A15)

| ID  | Test                      | Pass Criteria                                           |
| --- | ------------------------- | ------------------------------------------------------- |
| A8  | File → Open               | FileBrowserDialog opens, can navigate folders           |
| A9  | File → Save               | saveProject fires, result: true in log                  |
| A10 | File → Save As            | FileBrowserDialog opens with "Save Scene As" title      |
| A11 | File → Recent projects    | Submenu populates with entries                          |
| A12 | Edit → Cut / Copy / Paste | Menu items present; Paste disabled when clipboard empty |
| A13 | Edit → Delete             | Fires with node selected                                |
| A14 | Edit → Group items        | Fires with 2+ nodes selected                            |
| A15 | Edit → Ungroup items      | Fires on grouped node                                   |

### Hard (A16–A21)

| ID  | Test                        | Pass Criteria                                                     |
| --- | --------------------------- | ----------------------------------------------------------------- |
| A16 | File → New                  | Creates empty scene (reload teapot.orbx after)                    |
| A17 | File → Save as package      | PackageDialog opens                                               |
| A18 | Disabled menu items audit   | Module, Cloud, Window stubs are disabled                          |
| A19 | Keyboard accelerator labels | Menu labels match actual shortcuts (Ctrl+N, Ctrl+O, Ctrl+S, etc.) |
| A20 | Menu arrow-key navigation   | Arrow keys move focus within open menus                           |
| A21 | Menu dismiss behavior       | Escape closes menu; click-away closes menu                        |

---

## Category B: Scene Outliner (18 tests)

### Easy (B1–B7)

| ID  | Test                                   | Pass Criteria                                    |
| --- | -------------------------------------- | ------------------------------------------------ |
| B1  | Click node                             | Highlighted in outliner + Node Inspector updates |
| B2  | Click expand arrow (+)                 | Children appear below node                       |
| B3  | Click collapse arrow (−)               | Children hidden                                  |
| B4  | Expand All button                      | All nodes expanded (count increases)             |
| B5  | Collapse All button                    | Only root nodes visible (count decreases)        |
| B6  | Refresh button                         | Scene tree reloads from Octane                   |
| B7  | Tab switch: Scene / Live DB / Local DB | Each tab shows different content                 |

### Medium (B8–B14)

| ID  | Test                                | Pass Criteria                                                                      |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| B8  | Rapid node clicks (5+)              | Inspector keeps up, no stale data                                                  |
| B9  | Outliner ↔ Graph sync               | Selecting in outliner highlights in graph (and vice versa)                         |
| B10 | Right-click node → context menu     | Menu appears with correct items (9 expected)                                       |
| B11 | Context menu → Delete               | Node removed from tree + graph. Screenshot before/after. Reload teapot.orbx after. |
| B12 | Context menu → Copy → Paste         | Duplicate node appears. Screenshot. Reload teapot.orbx after.                      |
| B13 | Context menu → Show in Graph Editor | Graph pans/zooms to the node                                                       |
| B14 | F5 refresh → outliner rebuilds      | Tree repopulates (check for BUG-F5-1b flash)                                       |

### Hard (B15–B18)

| ID  | Test                        | Pass Criteria                                                                        |
| --- | --------------------------- | ------------------------------------------------------------------------------------ |
| B15 | Deep hierarchy expand       | All children load at 5+ nesting levels                                               |
| B16 | Rapid selection (10+ nodes) | No crashes, no stale inspector data                                                  |
| B17 | Context menu → Render       | Triggers render of selected RT node (verify gRPC log)                                |
| B18 | Bidirectional graph sync    | Select in graph → outliner scrolls/highlights; select in outliner → graph highlights |

---

## Category C: Node Graph (29 tests)

### Easy (C1–C7a)

| ID  | Test                                       | Pass Criteria                                                   |
| --- | ------------------------------------------ | --------------------------------------------------------------- |
| C1  | Click node                                 | Blue selection highlight appears                                |
| C2  | Click empty area                           | All nodes deselected                                            |
| C3  | Mouse wheel zoom                           | `scroll` on graph container → zoom in/out                       |
| C4  | Pan graph viewport                         | `scroll` to pan (middle-drag untestable — no middle-click tool) |
| C5  | Minimap visible                            | Minimap reflects node positions                                 |
| C6  | Grid toggle                                | Grid shows/hides on toggle                                      |
| C7  | Snap to Grid toggle                        | Visual indicator changes                                        |
| C7a | Preview toggles (RT/Mesh/Material/Texture) | Each button toggles active state                                |

### Medium (C8–C20)

| ID  | Test                            | Pass Criteria                                                             |
| --- | ------------------------------- | ------------------------------------------------------------------------- |
| C8  | Right-click empty area          | NodeTypeContextMenu opens with all categories (26 expected)               |
| C9  | Hover category                  | Subtypes appear (e.g. 7 camera types)                                     |
| C10 | Click type → create node        | Node appears in graph. Screenshot before/after. Reload teapot.orbx after. |
| C11 | Geometry → Mesh                 | File browser opens for mesh import                                        |
| C12 | Textures → Image Texture        | File browser opens for texture import                                     |
| C13 | Ctrl+F → search                 | SearchDialog opens, type query → results appear → click selects node      |
| C14 | Search → Select All             | All matching nodes selected                                               |
| C15 | Drag node to reposition         | `left_click_drag` from node center → node moves                           |
| C16 | Multi-select with Ctrl+click    | `left_click` with modifier → multiple nodes selected                      |
| C17 | Delete selected node(s)         | `key "Delete"` → node removed. Screenshot. Reload teapot.orbx after.      |
| C18 | Right-click node → context menu | `right_click` on node → NodeContextMenu appears                           |
| C19 | Recenter View button            | fitView triggered, all nodes visible                                      |
| C20 | Re-arrange Graph button         | DAG layout applied, nodes repositioned                                    |

### Hard (C21–C28)

| ID  | Test                       | Pass Criteria                                                                    |
| --- | -------------------------- | -------------------------------------------------------------------------------- |
| C21 | Connect pins               | `left_click_drag` from output handle to input handle → edge created. Screenshot. |
| C22 | Incompatible pin rejection | Drag to wrong type → no connection made                                          |
| C23 | Delete connection          | Right-click edge or select + Delete → edge removed. Screenshot.                  |
| C24 | Reconnect edge             | Drag existing connection to different pin → edge moves                           |
| C25 | Ctrl+D → duplicate node(s) | Node count increases; connections preserved on duplicate                         |
| C26 | Ctrl+G → group nodes       | 2+ selected nodes grouped (verify group node appears)                            |
| C27 | Ctrl+A → select all        | All nodes in graph selected                                                      |
| C28 | Node drag + grid snap      | `left_click_drag` with snap enabled → node position aligns to grid               |

---

## Category D: Node Inspector (24 tests)

### Easy (D1–D5)

| ID  | Test                              | Pass Criteria                    |
| --- | --------------------------------- | -------------------------------- |
| D1  | Select node → inspector populates | Node name + parameter list shown |
| D2  | Expand parameter group            | Click ▶ → children visible       |
| D3  | Collapse parameter group          | Click ▼ → children hidden        |
| D4  | Expand All button                 | All groups expanded              |
| D5  | Collapse All button               | All groups collapsed             |

### Medium (D6–D17)

| ID  | Test                             | Pass Criteria                                                                            |
| --- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| D6  | Toggle boolean (Orthographic)    | Checkbox toggles; gRPC `setPinValueByPinID` in log                                       |
| D7  | Edit integer (Bokeh power 6→8)   | Spinner changes value; gRPC call in log                                                  |
| D8  | Edit float (FOV 36→40)           | Value changes; gRPC call in log                                                          |
| D9  | Change dropdown (Stereo output)  | Selection changes; gRPC call in log                                                      |
| D10 | Quick-access: Camera             | Inspector jumps to Camera node                                                           |
| D11 | Quick-access: Render Target      | Inspector jumps to Render Target node                                                    |
| D12 | Quick-access: Environment        | Inspector jumps to Environment node                                                      |
| D13 | Quick-access: Kernel             | Inspector jumps to Kernel node                                                           |
| D14 | FileNodeToolbar → Load           | File browser opens (requires file-type node selected)                                    |
| D15 | FileNodeToolbar → Reload         | Reloads file; gRPC call in log                                                           |
| D16 | Node type dropdown → change type | Connected node changes type in-place. Screenshot before/after. Reload teapot.orbx after. |
| D17 | F5 → inspector re-populates      | Values match pre-refresh state                                                           |

### Hard (D18–D24)

| ID  | Test                                 | Pass Criteria                                                        |
| --- | ------------------------------------ | -------------------------------------------------------------------- |
| D18 | Edit float3 (vector x, y, z)         | Each component updates independently; gRPC call per change           |
| D19 | Color parameter                      | Click swatch → color picker → change color → gRPC call               |
| D20 | String parameter                     | Edit text → Enter commits → gRPC call                                |
| D21 | Rapid parameter toggling             | 10 toggles in 2 seconds → no dropped updates (all gRPC calls logged) |
| D22 | Node with 50+ parameters             | All values populate (Kernel node: 42 params)                         |
| D23 | Right-click parameter → context menu | Menu appears with Reset/Copy/Paste value options                     |
| D24 | Tab/Shift+Tab navigation             | Focus moves between parameter inputs                                 |

---

## Category E: Render Viewport (26 tests)

### Easy (E1–E4)

| ID  | Test                 | Pass Criteria                      |
| --- | -------------------- | ---------------------------------- |
| E1  | Render image visible | Canvas rendered after scene load   |
| E2  | Recenter View        | Render centers in viewport         |
| E3  | Copy to Clipboard    | Copies current render to clipboard |
| E4  | Lock Viewport toggle | Lock/unlock indicator changes      |

### Medium (E5–E17)

| ID  | Test                       | Pass Criteria                                              |
| --- | -------------------------- | ---------------------------------------------------------- |
| E5  | Start Render               | Rendering begins (sample counter increments)               |
| E6  | Pause Render               | Counter stops incrementing                                 |
| E7  | Resume Render              | Counter resumes from paused value                          |
| E8  | Stop Render                | Counter stops, resources freed                             |
| E9  | Restart Render             | Counter resets to 0, rendering restarts                    |
| E10 | Camera View Presets        | Each of 6 presets (Front/Back/Left/Right/Top/Bottom) fires |
| E11 | Reset Camera               | Camera returns to original position                        |
| E12 | Clay Mode toggle           | Mode changes (visual difference in render)                 |
| E13 | Sub-Sampling 2x2           | Resolution changes; mutually exclusive with 4x4            |
| E14 | Sub-Sampling 4x4           | Resolution changes; mutually exclusive with 2x2            |
| E15 | Real Time Rendering toggle | Mode change fires                                          |
| E16 | Save Render → file browser | FileBrowserDialog opens for saving image                   |
| E17 | Render Priority dropdown   | Low / Normal / High options work                           |

### Hard (E18–E26)

| ID  | Test                                | Pass Criteria                                    |
| --- | ----------------------------------- | ------------------------------------------------ |
| E18 | Left-drag on render → camera orbits | Render updates with new camera angle             |
| E19 | Right-drag on render → camera pans  | Render updates with panned view                  |
| E20 | Mouse wheel → camera zoom           | Render updates with zoomed view                  |
| E21 | Auto Focus Picker                   | Click picker button, click on render → focus set |
| E22 | Material Picker                     | Click on object → inspector shows material node  |
| E23 | Object Picker                       | Click on object → inspector shows object node    |
| E24 | Render Region Picker                | Drag region → only region renders                |
| E25 | Export Render Passes                | Dialog opens for EXR export                      |
| E26 | GPU Statistics dialog               | Right-click stats bar → GPU info dialog          |

---

## Category F: Dialogs (13 tests)

### Easy (F1–F4)

| ID  | Test                          | Pass Criteria                        |
| --- | ----------------------------- | ------------------------------------ |
| F1  | AboutDialog                   | Shows version string, Close/OK works |
| F2  | GPU Statistics Dialog         | Shows GPU info, close works          |
| F3  | All dialogs close on Escape   | Test each dialog type (see BUG-R2-1) |
| F4  | All dialogs close on X button | X button closes every dialog         |

### Medium (F5, F7–F10)

| ID  | Test                           | Pass Criteria                                              |
| --- | ------------------------------ | ---------------------------------------------------------- |
| F5  | FileBrowser navigation         | Double-click folders, breadcrumb nav, Up button (5 levels) |
| F7  | FileBrowser filename auto-fill | Click file → filename input populates                      |
| F8  | PreferencesDialog              | Opens, shows tabs (Application, Shortcuts, Devices)        |
| F9  | BatchRenderingDialog           | 3 dropdowns, 5 spinners, 4 checkboxes all interactive      |
| F10 | DaylightAnimationDialog        | All controls interactive, frame count calculates correctly |

### Hard (F11–F14)

| ID  | Test                         | Pass Criteria                             |
| --- | ---------------------------- | ----------------------------------------- |
| F11 | TurntableAnimationDialog     | 6 spinners, 1 checkbox all interactive    |
| F12 | BatchRenderingDialog → Start | Actual batch render begins                |
| F13 | FileBrowser → Open .orbx     | Scene loads in app                        |
| F14 | FileBrowser → Save flow      | File written to disk (verify via re-open) |

> **Note:** F6 (file type filter) removed — feature does not exist (see GAP-F6 in TEST_BUGS.md).

---

## Category G: Keyboard Shortcuts (12 tests)

### Easy (G1–G3)

| ID  | Test   | Pass Criteria                                                             |
| --- | ------ | ------------------------------------------------------------------------- |
| G1  | F5     | Scene refreshes (outliner + graph + inspector rebuild)                    |
| G2  | Escape | Deselects nodes / closes open menu / closes dialog                        |
| G3  | Delete | Deletes selected node. Screenshot before/after. Reload teapot.orbx after. |

### Medium (G4–G9)

| ID  | Test            | Pass Criteria                                                        |
| --- | --------------- | -------------------------------------------------------------------- |
| G4  | Ctrl+F          | Search dialog opens in Node Graph                                    |
| G5  | Ctrl+C / Ctrl+V | Node copied then pasted. Screenshot. Reload teapot.orbx after.       |
| G6  | Ctrl+X / Ctrl+V | Node cut then pasted. Screenshot. Reload teapot.orbx after.          |
| G7  | Ctrl+Z / Ctrl+Y | Undo/redo menu items present (correctly disabled if not implemented) |
| G8  | Ctrl+,          | Preferences dialog opens                                             |
| G9  | F1              | Help/documentation handler fires                                     |

### Hard (G10–G12)

| ID  | Test                  | Pass Criteria                                |
| --- | --------------------- | -------------------------------------------- |
| G10 | Ctrl+D                | Duplicate node(s) with connections preserved |
| G11 | Ctrl+G / Ctrl+Shift+G | Group / ungroup nodes                        |
| G12 | Ctrl+A                | Select all nodes in graph                    |

---

## Category H: Layout & Status (8 tests)

### Easy (H1–H3)

| ID  | Test                      | Pass Criteria                                        |
| --- | ------------------------- | ---------------------------------------------------- |
| H1  | Status bar: "Connected"   | Shows when Octane is running                         |
| H2  | Version number            | Displayed in bottom-right (e.g. "OctaneWebR v1.4.2") |
| H3  | Temporary status messages | Appear on actions and auto-dismiss after timeout     |

### Medium (H4–H6)

| ID  | Test                     | Pass Criteria                  |
| --- | ------------------------ | ------------------------------ |
| H4  | Left splitter drag       | Scene Outliner panel resizes   |
| H5  | Right splitter drag      | Node Inspector panel resizes   |
| H6  | Horizontal splitter drag | Viewport / Graph Editor resize |

### Hard (H7–H8)

| ID  | Test                | Pass Criteria                            |
| --- | ------------------- | ---------------------------------------- |
| H7  | Panel minimum sizes | Dragging below minimum → clamped (264px) |
| H8  | Extreme resize      | Panel to minimum → no layout breaking    |

---

## Category I: Stress & Cross-Cutting (10 tests)

### Easy (I1–I2)

| ID  | Test                               | Pass Criteria                                 |
| --- | ---------------------------------- | --------------------------------------------- |
| I1  | No console errors on load          | Zero errors after fresh page load             |
| I2  | No console errors after selections | Zero errors after selecting 5 different nodes |

### Medium (I3–I6)

| ID  | Test                        | Pass Criteria                                                       |
| --- | --------------------------- | ------------------------------------------------------------------- |
| I3  | F5 full pipeline recovery   | Outliner + graph + inspector + render all recover correctly         |
| I4  | gRPC roundtrip verification | Toggle Orthographic → verify `setPinValueByPinID` in grpc-debug.log |
| I5  | Create → delete cleanup     | Create node, delete it, verify no orphans in graph or outliner      |
| I6  | WebSocket connection idle   | Connection stays alive during 60-second idle period                 |

### Hard (I7–I10)

| ID  | Test                         | Pass Criteria                                             |
| --- | ---------------------------- | --------------------------------------------------------- |
| I7  | Large scene F5 refresh       | All nodes reload, inspector values populate               |
| I8  | Large scene rapid selection  | 20 node selections → no ERR_INSUFFICIENT_RESOURCES        |
| I9  | Large scene parameter groups | Open/close all groups → no performance degradation        |
| I10 | Memory leak check            | Heap size before vs after 50 selections (no major growth) |

---

## Execution Order

Tests are executed in 3 passes by difficulty. Complete each pass fully before starting the next.

| Pass               | Tests                                                                        | Order |
| ------------------ | ---------------------------------------------------------------------------- | ----- |
| **1: Easy** (43)   | H1–H3, B1–B7, D1–D5, G1–G3, C1–C7a, A1–A7, F1–F4, E1–E4, I1–I2               |
| **2: Medium** (71) | H4–H6, B8–B14, D6–D17, G4–G9, C8–C20, A8–A15, F5+F7–F10, E5–E17, I3–I6       |
| **3: Hard** (47)   | H7–H8, B15–B18, D18–D24, G10–G12, C21–C28, A16–A21, F11–F14, E18–E26, I7–I10 |

> **Destructive tests** (delete, create, change type) should be run last within their pass. Reload `teapot.orbx` via File → Open after each destructive test (requires clicking confirm dialog in Octane).

---

## Round 3 Additional Tests (20 tests)

These tests fill coverage gaps found during plan review. Execute after completing the 3 base passes.

### Node Graph (C29–C31)

| ID  | Test               | Pass Criteria                                              |
| --- | ------------------ | ---------------------------------------------------------- |
| C29 | Double-click node  | Focus/zoom to that node                                    |
| C30 | Click minimap area | Viewport navigates to that region                          |
| C31 | Box-select drag    | `left_click_drag` in empty space → multiple nodes selected |

### Render Viewport (E27–E33)

| ID  | Test                                | Pass Criteria                                     |
| --- | ----------------------------------- | ------------------------------------------------- |
| E27 | Right-click viewport → context menu | Menu appears with Copy/Save/Export/Lock options   |
| E28 | Ctrl+Left drag → 2D pan             | Pan image without moving camera                   |
| E29 | Camera Target Picker                | Click picker, click on render → sets orbit center |
| E30 | Film Region Picker                  | Drag region → sets film crop                      |
| E31 | Gizmo Translate tool                | Drag object → moves in scene                      |
| E32 | Gizmo Rotate tool                   | Drag object → rotates in scene                    |
| E33 | Gizmo Scale tool                    | Drag object → scales in scene                     |

### Dialogs (F15–F16)

| ID  | Test                    | Pass Criteria                                                  |
| --- | ----------------------- | -------------------------------------------------------------- |
| F15 | GPU Statistics sections | Geometry stats, texture stats, memory per device all populated |
| F16 | Preferences Dialog tabs | Application, Shortcuts, Devices tabs each show content         |

### Keyboard Shortcuts (G13–G16)

| ID  | Test                           | Pass Criteria                                |
| --- | ------------------------------ | -------------------------------------------- |
| G13 | F11 → fullscreen               | Fullscreen toggles                           |
| G14 | Ctrl+N → new scene             | New scene created (reload teapot.orbx after) |
| G15 | Ctrl+Shift+S → Save As         | Save As dialog opens                         |
| G16 | Ctrl+Shift+R → run last script | Script handler fires                         |

### Layout & Status (H9–H10)

| ID  | Test             | Pass Criteria                                                                  |
| --- | ---------------- | ------------------------------------------------------------------------------ |
| H9  | Loading skeleton | Skeleton UI shown during scene tree load (reload page, screenshot immediately) |
| H10 | Error boundary   | Component crash → error screen with "Try Again" button                         |

### Stress (I11–I12)

| ID  | Test                                          | Pass Criteria                                                               |
| --- | --------------------------------------------- | --------------------------------------------------------------------------- |
| I11 | Render target selection → setRenderTargetNode | Click RT in outliner → verify gRPC call in log (BUG-RT-SELECT fix)          |
| I12 | Edge delete → backend sync                    | Select edge, Delete key, F5 refresh → check if edge persists (BUG-EDGE-DEL) |

---

## Summary

| Category                  | Base    | R3 New | Total   |
| ------------------------- | ------- | ------ | ------- |
| A: Menu Bar               | 21      | —      | 21      |
| B: Scene Outliner         | 18      | —      | 18      |
| C: Node Graph             | 29      | 3      | 32      |
| D: Node Inspector         | 24      | —      | 24      |
| E: Render Viewport        | 26      | 7      | 33      |
| F: Dialogs                | 13      | 2      | 15      |
| G: Keyboard Shortcuts     | 12      | 4      | 16      |
| H: Layout & Status        | 8       | 2      | 10      |
| I: Stress & Cross-Cutting | 10      | 2      | 12      |
| **Total**                 | **161** | **20** | **181** |

### Deferred (later round)

- Material Database browsing (categories, thumbnails, download)
- Save Package Dialog controls
- Batch Rendering start → actual render execution
- Animation Dialogs start → actual animation execution
- Connection loss → reconnect behavior (requires disconnecting Octane)

---

## Known Bugs Under Test

See `TEST_BUGS.md` for full details. These bugs should be actively checked during testing:

| Bug ID        | Tests          | What to Check                                   |
| ------------- | -------------- | ----------------------------------------------- |
| BUG-R2-1      | F3             | Do all dialogs close on Escape AND click-away?  |
| BUG-F5-1b     | B14, G1        | Does "Click refresh" flash briefly after F5?    |
| BUG-EDGE-DEL  | I12            | Does deleting an edge sync to Octane backend?   |
| BUG-RT-SELECT | I11            | Does clicking RT node call setRenderTargetNode? |
| BUG-TEST-KB   | G2, G3, G5, G6 | Do keyboard shortcuts work properly?            |
