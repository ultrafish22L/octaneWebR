# OctaneWebR — Improvement Backlog

Ordered easy → hard. Done items removed.

---

## Priority

| #   | Item                                                                        | Difficulty | Source     |
| --- | --------------------------------------------------------------------------- | ---------- | ---------- |
| P1  | Camera framing from bounds — use centroid for target, zoom based on extents | Medium     | BUGLIST #5 |
| P1  | "Materials from geo 1" rule — every geo gets at least a color variant       | Easy       | BUGLIST #6 |
| P2  | Node create context dialog: set all node type icons                         | Medium     | —          |

## Easy — CSS / one-file

| #   | Item                                       | Notes                               |
| --- | ------------------------------------------ | ----------------------------------- |
| 1   | GPU stats dialog: remove "selected" border | Delete one CSS rule                 |
| 2   | Dialog dimming                             | Toggle CSS for modal background dim |
| 3   | Tooltip yellow background                  | Add CSS vars                        |
| 4   | Panel title menu icon                      | Add icon element + CSS              |
| 6   | Inspector expanded/collapsed icon shape    | Conditional border-radius           |
| 7   | Save render shared path memory             | Single state variable               |
| 8   | RequestQueue configurable max size         | Add MAX_QUEUE_SIZE constant         |
| 9   | GPU dialog on render bar right-click       | Add onContextMenu handler           |

## Medium

| #   | Item                                   | Notes                                   |
| --- | -------------------------------------- | --------------------------------------- |
| 10  | Modal dialog stacking policy           | Enforce single-modal z-index            |
| 11  | Toolbar button style unification       | Audit + unify select/hover/border       |
| 12  | CSS cleanup                            | Consolidate scattered toolbar styles    |
| 13  | Fix all icons in node-add context menu | Map each type to correct icon           |
| 14  | Export render passes dialog            | Rework to include file name input       |
| 15  | FileBrowserDialog file type filter     | User-facing dropdown                    |
| 16  | Tooltip audit                          | Fix "Unknown type" / generic tooltips   |
| 17  | Suppress edits during sync             | Disable user edits while syncing        |
| 18  | PreferencesDialog wiring               | Connect to Octane via ApiProjectManager |
| 19  | React 19 upgrade                       | @xyflow/react 12.x supports R19         |
| 20  | Multi-pass render export               | Export all passes with name+extension   |

## Hard

| #   | Item                                      | Notes                                              |
| --- | ----------------------------------------- | -------------------------------------------------- |
| 21  | Multi-connect: connect all selected nodes | Rewrite edge connection logic                      |
| 22  | Viewport axis rotation                    | 3D matrix transforms                               |
| 23  | Automated test suite                      | Vitest — estimateNodeWidth, CacheManager, services |
| 24  | Event queuing during load                 | Queue events from async loading loop               |
| 25  | Node Inspector for grouped nodes          | Group-specific rendering                           |
| 26  | Animation bar below render bar            | Full new component + Octane API                    |
| 27  | Progressive scene loading                 | Load first-level then connections                  |
| 28  | Better graph arranging                    | Sugiyama or force-directed layout                  |

## MCP Server

| #   | Item                                      | Difficulty | Notes                                               |
| --- | ----------------------------------------- | ---------- | --------------------------------------------------- |
| 31  | Crash detection + recovery guidance       | Medium     | Structured ECONNRESET/ECONNREFUSED errors           |
| 32  | Quad primitive (type 18) crashes Octane   | N/A        | **Confirmed Octane bug** — workaround: use quad.obj |
| 36  | Add `up` param to set_camera              | Easy       | mcp/src/tools/camera.ts:57                          |
| 37  | Add timeout to notifyWebapp fetch         | Easy       | 3-5s AbortController                                |
| 38  | Remove or guard reset_project             | Easy       | Crash trigger, add warning                          |
| 39  | save_render path validation               | Easy       | Check parent dir exists                             |
| 40  | load_project wait-for-ready               | Medium     | Replace hardcoded 2s sleep                          |
| 41  | Track auto-created children in cache      | Medium     | node.ts:199                                         |
| 42  | execute_batch tool                        | Hard       | **30x speedup** — batch gRPC calls                  |
| 49  | Test rig: connection refresh requirements | Medium     | Map what needs update_scene + set_camera            |
| 50  | Cache invalidation after MCP updates      | High       | CacheManager doesn't invalidate on set_attribute    |

## Bugs

| #   | Item                                       | Difficulty | Notes                                    |
| --- | ------------------------------------------ | ---------- | ---------------------------------------- |
| 29  | Context menu fails on empty scene          | Medium     | Right-click should work with no nodes    |
| 30  | Audit FILE_NODE_TYPES via offline API      | Medium     | Determine which types need file paths    |
| 34  | MCP RT auto-select doesn't expand outliner | Easy       | Expand tree on select                    |
| 35  | MCP-created nodes pile at (0,0)            | Medium     | Need auto-arrange or position hints      |
| 43  | Inspector incomplete after MCP add         | Easy       | buildNewNode depth issue                 |
| 45  | Inspector doesn't update on MCP changes    | Medium     | Need re-fetch on selected node changes   |
| 46  | Empty nodes not selectable in outliner     | Easy       | Show and make clickable                  |
| 47  | connect_nodes doesn't trigger re-render    | Medium     | Need explicit update_scene after connect |
