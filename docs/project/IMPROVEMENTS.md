# OctaneWebR — Improvement Backlog

Ordered easy → hard within each section. Done items purged.

## Easy

| #   | Item                                            | Notes                                                                                 |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Lazy logging (Logger accepts callbacks)         | 463 calls across 52 files. Biggest perf win — avoids JSON.stringify when debug is off |
| 2   | Improve MCP connect_nodes tool descriptions     | Guide LLM to pick correct pin param type on first try                                 |
| 3   | Add `up` param to set_camera                    | mcp/src/tools/camera.ts — prevents up-vector resets                                   |
| 4   | Guard reset_project with warning                | suppressUI:true helps but no user-facing warning before destructive action            |
| 5   | save_render path validation                     | Check parent dir exists, warn on bad paths                                            |
| 6   | MCP RT auto-select doesn't expand outliner      | Expand tree node on auto-select                                                       |
| 7   | Empty nodes not selectable in outliner          | Show and make clickable                                                               |
| 8   | Inspector incomplete after MCP add              | buildNewNode depth issue — deferred loadSceneTree or deeper recursion                 |
| 9   | Save render shared path memory                  | Single state variable between save/export                                             |
| 10  | GPU statistics dialog: remove "selected" border | Delete one CSS rule                                                                   |
| 11  | Tooltip yellow background                       | Add --tooltip-bg/--tooltip-text CSS vars                                              |
| 12  | Panel title menu icon                           | Icon element left of each panel title                                                 |
| 13  | Inspector: expanded vs collapsed icon box shape | Conditional border-radius                                                             |
| 14  | GPU dialog on render bar right-click            | Add onContextMenu handler                                                             |

## Medium

| #   | Item                                         | Notes                                                                                                     |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 15  | Extract VectorInput component                | Pull out of ParameterControl.tsx (1028 lines)                                                             |
| 16  | Split useMouseInteraction into focused hooks | 500+ line useEffect → orbit/pan/zoom/pick hooks                                                           |
| 17  | Extract shared constants to shared location  | Fix MCP cross-boundary imports from client/src                                                            |
| 18  | Add gRPC response interfaces                 | Top 10 response shapes, typed at service boundaries                                                       |
| 19  | Camera framing from bounds                   | Use centroid for target, zoom from extents                                                                |
| 20  | Inspector doesn't update on MCP changes      | Re-fetch on selected node changes                                                                         |
| 21  | connect_nodes doesn't trigger re-render      | Need explicit update_scene after connect                                                                  |
| 22  | MCP-created nodes pile at (0,0)              | Auto-arrange or position hints in node graph                                                              |
| 23  | load_project wait-for-ready                  | Replace hardcoded 2s sleep with polling                                                                   |
| 24  | Track auto-created children in cache         | node.ts:199 — children fall through to gRPC                                                               |
| 25  | Context menu fails on empty scene            | Right-click should work with no nodes                                                                     |
| 26  | Audit FILE_NODE_TYPES via offline API        | Determine which types actually need file paths                                                            |
| 27  | Mesh material pin_id:30 silently fails       | Must use pin_index:0 instead. Document in MCP docs                                                        |
| 28  | Fix all icons in node-add context menu       | Map each node type to correct icon. Reference: `screenshots/octane_allitems1.png`, `octane_allitems2.png` |
| 29  | Export render passes dialog rework           | File name input instead of "select folder"                                                                |
| 30  | FileBrowserDialog file type filter dropdown  | User-facing dropdown for file types                                                                       |
| 31  | Modal dialog stacking policy                 | Add modal manager or single-modal z-index                                                                 |
| 32  | Toolbar button style unification             | Audit all toolbar buttons, unify styles                                                                   |
| 33  | Suppress edits during sync                   | Disable user edits while scene is syncing                                                                 |
| 34  | PreferencesDialog wiring                     | Connect stub to ApiProjectManager.applicationPreferences()                                                |
| 35  | Save render passes: multi-pass export        | Discover all passes, export with pass name + extension                                                    |
| 36  | React 19 upgrade                             | @xyflow/react 12.x and react-error-boundary 6.x support R19                                               |

## Hard

| #   | Item                                      | Notes                                                       |
| --- | ----------------------------------------- | ----------------------------------------------------------- |
| 37  | Automated test suite                      | Vitest — estimateNodeWidth, CacheManager, services          |
| 38  | execute_batch tool                        | 30x speedup — batch gRPC calls (1.4s gRPC vs 300s thinking) |
| 39  | Multi-connect: connect all selected nodes | Rewrite edge connection logic                               |
| 40  | Node Inspector for grouped nodes          | Group-specific rendering                                    |
| 41  | Viewport axis rotation                    | Axis overlay must rotate with camera orientation (3D math)  |
| 42  | Animation bar below render bar            | Full new component + Octane API                             |
| 43  | Event queuing during load                 | Queue events from async loading, don't emit synchronously   |
| 44  | Progressive scene loading                 | Load first-level then connections                           |
| 45  | Better graph arranging                    | Sugiyama or force-directed layout                           |

## Octane API Bugs (not fixable by us)

| #   | Item                                    | Notes                                                       |
| --- | --------------------------------------- | ----------------------------------------------------------- |
| 46  | Quad primitive (type 18) crashes Octane | Workaround: use quad.obj or flat Box                        |
| 47  | Primitive type change crashes Octane    | Workaround: disconnect geo before changing, reconnect after |
