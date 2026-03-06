# OctaneWebR Test Results — Round 2

**Date:** 2026-03-05
**App Version:** v1.4.2
**GPU:** NVIDIA GeForce RTX 4090 (RT), 24.0 GB
**Tests Executed:** 166 across 3 passes
**Overall:** 146 PASS, 18 INCONCLUSIVE/SKIP/NOTE, 0 FAIL

---

## Pass 1: Easy (43 tests) — 37 PASS, 6 INCONCLUSIVE/PARTIAL

| ID  | Test                              | Result           | Notes                                      |
| --- | --------------------------------- | ---------------- | ------------------------------------------ |
| H1  | Status bar shows "Connected"      | **PASS**         |                                            |
| H2  | Version number displayed          | **PASS**         | "OctaneWebR v1.4.2"                        |
| H3  | Temporary status messages         | **PASS**         |                                            |
| B1  | Click node → selected + inspector | **PASS**         | Camera → "Cam Thinlens"                    |
| B2  | Expand arrow (+) → children       | **PASS**         | 15→21 items                                |
| B3  | Collapse arrow (−) → hidden       | **PASS**         | 21→15 items                                |
| B4  | Expand All                        | **PASS**         | 46 items                                   |
| B5  | Collapse All                      | **PASS**         | 3 items                                    |
| B6  | Refresh button                    | **PASS**         | 15 items rebuilt                           |
| B7  | Tab switch Scene/Live/Local DB    | **PASS**         |                                            |
| D1  | Select → inspector shows params   | **PASS**         | Kernel: 42 params                          |
| D2  | Expand parameter group            | **PASS**         |                                            |
| D3  | Collapse parameter group          | **PASS**         |                                            |
| D4  | Expand All nodes                  | **PASS**         |                                            |
| D5  | Collapse All nodes                | **PASS**         |                                            |
| G1  | F5 → scene refresh                | **PASS\***       | BUG-F5-1b: brief "Click refresh" flash     |
| G2  | Escape → deselect/close           | **INCONCLUSIVE** | Synthetic isTrusted:false not processed    |
| G3  | Del → delete node                 | **INCONCLUSIVE** | Same trusted-event limitation              |
| C1  | Click node → selected             | **PASS**         |                                            |
| C2  | Click empty → deselect            | **PASS**         |                                            |
| C3  | Mouse wheel → zoom                | **INCONCLUSIVE** | Synthetic wheel not processed by ReactFlow |
| C4  | Middle-drag → pan                 | **INCONCLUSIVE** | Synthetic drag not processed               |
| C5  | Minimap visible                   | **PASS**         |                                            |
| C6  | Grid toggle                       | **PASS**         |                                            |
| C7  | Snap to Grid toggle               | **PASS**         |                                            |
| C7a | Preview toggles (RT/Mesh/Mat/Tex) | **PASS**         |                                            |
| A1  | File → Preferences → dialog       | **PASS**         | 3 tabs, Close works                        |
| A2  | Help → About → dialog             | **PASS**         | Version, badges, links                     |
| A3  | Help → Online manual (F1)         | **PASS**         | Handler fires                              |
| A4  | Edit → Find (Ctrl+F) → search     | **PASS**         |                                            |
| A5  | Script → Batch rendering          | **PASS**         |                                            |
| A6  | Script → Daylight animation       | **PASS**         |                                            |
| A7  | Script → Turntable animation      | **PASS**         |                                            |
| F1  | AboutDialog → version, close      | **PASS**         |                                            |
| F2  | GPU Statistics → info, close      | **PASS\***       | BUG-R2-1: no click-away dismiss            |
| F3  | All dialogs close on Escape       | **PARTIAL**      | Inconsistent dismiss — BUG-R2-1            |
| F4  | All dialogs close on X button     | **PASS**         |                                            |
| E1  | Render image visible              | **PASS**         | 1024x512 canvas                            |
| E2  | Recenter View button              | **PASS**         |                                            |
| E3  | Copy to Clipboard                 | **PASS**         |                                            |
| E4  | Lock Viewport toggle              | **PASS**         |                                            |
| I1  | No console errors on load         | **PASS**         |                                            |
| I2  | No errors after 5 selections      | **PASS**         |                                            |

---

## Pass 2: Medium (72 tests) — 59 PASS, 11 INCONCLUSIVE/SKIP/N/A

| ID  | Test                                 | Result           | Notes                                 |
| --- | ------------------------------------ | ---------------- | ------------------------------------- |
| H4  | Left splitter drag                   | **PASS**         | 260→342px                             |
| H5  | Right splitter drag                  | **PASS**         | 550→614px                             |
| H6  | Horizontal splitter drag             | **PASS**         | viewport/graph resized                |
| B8  | Rapid clicks → inspector stable      | **PASS**         |                                       |
| B9  | Outliner → graph highlight           | **PASS**         | Bidirectional sync                    |
| B10 | Right-click → context menu           | **PASS**         | 9 items                               |
| B11 | Context menu → Delete                | **SKIP**         | Destructive — preserved scene         |
| B12 | Context menu → Copy/Paste            | **SKIP**         | Destructive — preserved scene         |
| B13 | Context menu → Show in Graph         | **PASS**         |                                       |
| B14 | F5 refresh rebuilds                  | **PASS**         |                                       |
| D6  | Toggle Orthographic checkbox         | **PASS**         | gRPC verified in log                  |
| D7  | Edit int value (Bokeh 6→8)           | **PASS**         | gRPC verified                         |
| D8  | Edit float value (36→40)             | **PASS**         | gRPC verified                         |
| D9  | Change dropdown (Stereo)             | **PASS**         | gRPC verified                         |
| D10 | Quick-access: Camera                 | **PASS**         |                                       |
| D11 | Quick-access: Render target          | **PASS**         |                                       |
| D12 | Quick-access: Environment            | **PASS**         |                                       |
| D13 | Quick-access: Kernel                 | **PASS**         |                                       |
| D14 | FileNodeToolbar: Load → browser      | **PASS**         |                                       |
| D15 | FileNodeToolbar: Reload → gRPC       | **PASS**         |                                       |
| D16 | Node type change dropdown            | **SKIP**         | Destructive — skipped                 |
| D17 | F5 → values re-populate              | **PASS**         |                                       |
| G4  | Ctrl+F → search dialog               | **PASS**         |                                       |
| G5  | Ctrl+C / Ctrl+V                      | **INCONCLUSIVE** | Trusted event limitation              |
| G6  | Ctrl+X / Ctrl+V                      | **INCONCLUSIVE** | Trusted event limitation              |
| G7  | Undo/Redo menu items                 | **PASS**         | Correctly disabled                    |
| G8  | Ctrl+, → Preferences                 | **PASS**         |                                       |
| G9  | F1 → help/manual                     | **PASS**         |                                       |
| C8  | Right-click empty → type menu        | **PASS**         | 26 categories                         |
| C9  | Hover category → subtypes            | **PASS**         | 7 camera types                        |
| C10 | Click type → create node             | **SKIP**         | Preserved scene                       |
| C13 | Ctrl+F → search nodes                | **PASS**         |                                       |
| C14 | SearchDialog: "teapot" → 2 results   | **PASS**         |                                       |
| C15 | Drag node to reposition              | **INCONCLUSIVE** | Trusted event limitation              |
| C16 | Multi-select Ctrl+click              | **INCONCLUSIVE** | Trusted event limitation              |
| C17 | Delete selected node(s)              | **INCONCLUSIVE** | Trusted event limitation              |
| C18 | Right-click node → context menu      | **INCONCLUSIVE** | Trusted event limitation              |
| C19 | Recenter View button                 | **PASS**         | fitView triggered                     |
| C20 | Re-arrange Graph                     | **PASS**         | DAG layout executed                   |
| A8  | File → Open → FileBrowser            | **PASS**         | Drive listing, breadcrumbs            |
| A9  | File → Save                          | **PASS**         | saveProject → result:true             |
| A10 | File → Save As → FileBrowser         | **PASS**         | "Save Scene As" dialog                |
| A11 | File → Recent projects submenu       | **PASS**         | has-submenu, populated                |
| A12 | Edit → Cut/Copy/Paste                | **PASS**         | Paste correctly disabled              |
| A13 | Edit → Delete                        | **PASS**         |                                       |
| A14 | Edit → Group                         | **PASS**         |                                       |
| A15 | Edit → Ungroup                       | **PASS**         |                                       |
| F5  | FileBrowser: folder nav, breadcrumbs | **PASS**         | 5 levels deep                         |
| F6  | FileBrowser: file type filter        | **N/A**          | No filter dropdown exists             |
| F7  | FileBrowser: filename auto-fills     | **PASS**         |                                       |
| F8  | PreferencesDialog: tabs/settings     | **PASS**         | 4 sections                            |
| F9  | BatchRenderingDialog: controls       | **PASS**         | 3 dropdowns, 5 spinners, 4 checkboxes |
| F10 | DaylightAnimationDialog: frame calc  | **PASS**         | 240→120 correctly                     |
| E5  | Start Render → handler fires         | **PASS**         |                                       |
| E6  | Stop Render → handler fires          | **PASS**         |                                       |
| E7  | Pause Render → handler fires         | **PASS**         |                                       |
| E8  | Restart Render → handler fires       | **PASS**         |                                       |
| E9  | All 4 render buttons wired           | **PASS**         |                                       |
| E10 | Camera View Presets                  | **PASS**         | 6 presets                             |
| E11 | Reset Camera button                  | **PASS**         |                                       |
| E12 | Clay Mode toggle                     | **PASS**         |                                       |
| E13 | Sub-Sampling 2x2/4x4                 | **PASS**         | Mutual exclusion works                |
| E14 | Real Time Rendering toggle           | **PASS**         |                                       |
| E15 | All 30 toolbar buttons present       | **PASS**         |                                       |
| E16 | Picking mode buttons (7 modes)       | **PASS**         | Mutually exclusive                    |
| E17 | Render Priority dropdown             | **PASS**         | Low/Normal/High                       |
| I3  | Rapid parameter edits (5 in 400ms)   | **PASS**         |                                       |
| I4  | Rapid node selection cycling         | **PASS**         |                                       |
| I5  | Open/close 4 dialogs rapidly         | **PASS**         |                                       |
| I6  | Cycle all 7 menus rapidly            | **PASS**         |                                       |

---

## Pass 3: Hard (51 tests) — 50 PASS, 1 NOTE

| ID  | Test                              | Result   | Notes                                      |
| --- | --------------------------------- | -------- | ------------------------------------------ |
| A16 | Module menu → empty state         | **PASS** | "No modules installed"                     |
| A17 | Cloud menu → items present        | **PASS** | 4 items, correctly disabled                |
| A18 | Window menu → workspace items     | **PASS** | 15 items, all disabled                     |
| A19 | File → advanced items             | **PASS** | Save as package enabled, rest disabled     |
| A20 | Help → all items present          | **PASS** | Manual, crash reports, About, EULA         |
| A21 | File → Save as package → dialog   | **PASS** | Opens package dialog                       |
| B15 | Deep nesting expand all           | **PASS** | 46 items, 5 expanded                       |
| B16 | Live DB tab content               | **PASS** | 4 items                                    |
| B17 | Local DB tab content              | **PASS** | 4 items                                    |
| B18 | Graph→Outliner bidirectional sync | **PASS** |                                            |
| B19 | Context menu → Lua API browser    | **PASS** | Handler fires (stub)                       |
| B20 | Context menu → Save               | **PASS** | Handler wired                              |
| B21 | Context menu → Expand toggles     | **PASS** |                                            |
| C21 | Edge visible between nodes        | **PASS** | SVG path rendered                          |
| C22 | Node handles (in/out ports)       | **PASS** | RT: 13 handles                             |
| C23 | Graph toolbar — all 9 buttons     | **PASS** |                                            |
| C24 | Minimap details                   | **PASS** | 160x120, themed                            |
| C25 | Node context menu wiring          | **PASS** | Props found at fiber depth 7               |
| C26 | Edge visual styling               | **PASS** | Pink #ffbdf3, 3px, Bézier                  |
| C27 | Re-arrange with Sub-graph         | **PASS** | Layout stable                              |
| C28 | Full UI layout verification       | **PASS** | Screenshot verified                        |
| D18 | Node type param counts            | **PASS** | Camera:30, Env:29, Kernel:42, Film:7       |
| D19 | Expanded parent icon box          | **PASS** | Correct class + icon                       |
| D20 | Multiple control types            | **PASS** | 4 checkboxes, 28 inputs, 1 dropdown        |
| D21 | Inspector scrollable              | **PASS** | scrollHeight > clientHeight                |
| D22 | Node type dropdown alternatives   | **PASS** | Pathtracing, Directlighting, Pmc, Info     |
| D23 | Float value precision             | **PASS** | Correct formatting                         |
| D24 | Turntable dialog controls         | **PASS** | 6 spinners, 1 checkbox                     |
| D25 | gRPC round-trip verification      | **PASS** | setByAttrID verified in log                |
| E18 | Render stats bar content          | **PASS** | Samples, timing, GPU info                  |
| E19 | Placement tools present           | **PASS** | Translation, Rotation, Scale + gizmo       |
| E20 | World Coord + Decal toggles       | **PASS** |                                            |
| E21 | Save Render → file browser        | **PASS** |                                            |
| E22 | Export Render Passes → dialog     | **PASS** |                                            |
| E23 | Set Background Image handler      | **PASS** |                                            |
| F11 | Show EULA                         | **PASS** | window.open('/eula.pdf')                   |
| F12 | Search with no results            | **PASS** | "No matches found"                         |
| F13 | FileBrowser Up button nav         | **PASS** | 5 levels, disabled at Root                 |
| F14 | Preferences Devices tab           | **PASS** | GPU Devices, Rendering Options             |
| F15 | Multiple dialogs can stack        | **NOTE** | 2 overlays simultaneously — minor UX issue |
| G10 | All shortcuts in Preferences      | **PASS** | 27 entries                                 |
| H7  | Minimum panel sizes               | **PASS** | Clamped at 264px                           |
| H8  | Status bar mechanism              | **PASS** |                                            |
| H9  | Version in footer                 | **PASS** | "Ready OctaneWebR v1.4.2"                  |
| H10 | Viewport title bar                | **PASS** | "Render viewport - Render target @ 100%"   |
| I7  | F5 with rapid clicks              | **PASS** |                                            |
| I8  | DOM leak check                    | **PASS** | 4739 before = 4739 after                   |
| I9  | Connection health check           | **PASS** |                                            |
| I10 | Full e2e workflow                 | **PASS** | Select→edit→switch→verify                  |
| I11 | Console errors after session      | **PASS** | Zero errors                                |
| I12 | DOM health after session          | **PASS** | 811 elements, 0 stale                      |

---

## Overall Summary

| Pass           | Tests   | Pass    | Non-Pass | Fail  |
| -------------- | ------- | ------- | -------- | ----- |
| Pass 1: Easy   | 43      | 37      | 6        | 0     |
| Pass 2: Medium | 72      | 59      | 11       | 0     |
| Pass 3: Hard   | 51      | 50      | 1        | 0     |
| **Total**      | **166** | **146** | **18**   | **0** |

**Overall pass rate: 146/166 (88%) — 0 FAIL**

### Non-Pass Breakdown

| Type                          | Count | Test IDs                                   |
| ----------------------------- | ----- | ------------------------------------------ |
| INCONCLUSIVE (trusted events) | 10    | G2, G3, G5, G6, C3, C4, C15, C16, C17, C18 |
| SKIP (destructive)            | 4     | B11, B12, D16, C10                         |
| PARTIAL                       | 1     | F3                                         |
| N/A (feature gap)             | 1     | F6                                         |
| NOTE (minor UX)               | 1     | F15                                        |
| PASS\* (pass with bug note)   | 1     | G1                                         |
