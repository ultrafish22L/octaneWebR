# OctaneWebR — Improvement Backlog

Ordered easy → hard within each section. Done items purged.

## Easy

| #   | Item                                    | Notes                                                                                 |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Lazy logging (Logger accepts callbacks) | 463 calls across 52 files. Biggest perf win — avoids JSON.stringify when debug is off |
| 2   | Inspector incomplete after MCP add      | buildNewNode depth issue — deferred loadSceneTree or deeper recursion                 |
| 3   | Panel title menu icon                   | Icon element left of each panel title                                                 |

## Medium

| #   | Item                                         | Notes                                                                                                     |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 6   | Custom tooltip component                     | Native `title=` tooltips can't be styled. Need a `<Tooltip>` wrapper for Octane-style yellow bg           |
| 7   | Extract VectorInput component                | Pull out of ParameterControl.tsx (1028 lines)                                                             |
| 8   | Split useMouseInteraction into focused hooks | 500+ line useEffect → orbit/pan/zoom/pick hooks                                                           |
| 9   | Extract shared constants to shared location  | Fix MCP cross-boundary imports from client/src                                                            |
| 10  | Add gRPC response interfaces                 | Top 10 response shapes, typed at service boundaries                                                       |
| 11  | Camera framing from bounds                   | Use centroid for target, zoom from extents                                                                |
| 12  | Inspector doesn't update on MCP changes      | Re-fetch on selected node changes                                                                         |
| 13  | connect_nodes partial re-render              | notifyWebapp works but may need update_scene + set_camera for geometry changes                            |
| 14  | MCP-created nodes pile at (0,0)              | Auto-arrange or position hints in node graph                                                              |
| 15  | load_project wait-for-ready                  | Replace hardcoded 2s sleep with polling                                                                   |
| 16  | Track auto-created children in cache         | node.ts:199 — children fall through to gRPC                                                               |
| 17  | Audit FILE_NODE_TYPES via offline API        | Determine which types actually need file paths                                                            |
| 18  | Fix all icons in node-add context menu       | Map each node type to correct icon. Reference: `screenshots/octane_allitems1.png`, `octane_allitems2.png` |
| 19  | Export render passes dialog rework           | File name input instead of "select folder"                                                                |
| 20  | FileBrowserDialog file type filter dropdown  | User-facing dropdown for file types                                                                       |
| 21  | Modal dialog stacking policy                 | Add modal manager or single-modal z-index                                                                 |
| 22  | Toolbar button style unification             | Audit all toolbar buttons, unify styles                                                                   |
| 23  | Suppress edits during sync                   | Disable user edits while scene is syncing                                                                 |
| 24  | PreferencesDialog wiring                     | Connect stub to ApiProjectManager.applicationPreferences()                                                |
| 25  | Save render passes: multi-pass export        | Discover all passes, export with pass name + extension                                                    |
| 26  | React 19 upgrade                             | @xyflow/react 12.x and react-error-boundary 6.x support R19                                               |

## Hard

| #   | Item                                      | Notes                                                       |
| --- | ----------------------------------------- | ----------------------------------------------------------- |
| 27  | Automated test suite                      | Vitest — estimateNodeWidth, CacheManager, services          |
| 28  | execute_batch tool                        | 30x speedup — batch gRPC calls (1.4s gRPC vs 300s thinking) |
| 29  | Multi-connect: connect all selected nodes | Rewrite edge connection logic                               |
| 30  | Node Inspector for grouped nodes          | Group-specific rendering                                    |
| 31  | Viewport axis rotation                    | Axis overlay must rotate with camera orientation (3D math)  |
| 32  | Animation bar below render bar            | Full new component + Octane API                             |
| 33  | Event queuing during load                 | Queue events from async loading, don't emit synchronously   |
| 34  | Progressive scene loading                 | Load first-level then connections                           |
| 35  | Better graph arranging                    | Sugiyama or force-directed layout                           |

## Octane API Bugs (not fixable by us)

| #   | Item                                    | Notes                                                       |
| --- | --------------------------------------- | ----------------------------------------------------------- |
| 36  | Quad primitive (type 18) crashes Octane | Workaround: use quad.obj or flat Box                        |
| 37  | Primitive type change crashes Octane    | Workaround: disconnect geo before changing, reconnect after |
