# OctaneWebR — Improvement Backlog

Ordered easy → hard within each section. Done items purged.

## Easy

| #   | Item                  | Notes                                 |
| --- | --------------------- | ------------------------------------- |
| 1   | Panel title menu icon | Icon element left of each panel title |

## Medium

| #   | Item                                         | Notes                                                                                           |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 2   | Custom tooltip component                     | Native `title=` tooltips can't be styled. Need a `<Tooltip>` wrapper for Octane-style yellow bg |
| 3   | Extract VectorInput component                | Pull out of ParameterControl.tsx (1028 lines)                                                   |
| 4   | Split useMouseInteraction into focused hooks | 500+ line useEffect → orbit/pan/zoom/pick hooks                                                 |
| 5   | Extract shared constants to shared location  | Fix MCP cross-boundary imports from client/src                                                  |
| 6   | Add gRPC response interfaces                 | Top 10 response shapes, typed at service boundaries                                             |
| 8   | Inspector doesn't update on MCP changes      | Re-fetch on selected node changes                                                               |
| 9   | connect_nodes partial re-render              | notifyWebapp works but may need update_scene + set_camera for geometry changes                  |
| 10  | MCP-created nodes pile at (0,0)              | Auto-arrange or position hints in node graph                                                    |
| 11  | load_project wait-for-ready                  | Replace hardcoded 2s sleep with polling                                                         |
| 12  | Track auto-created children in cache         | node.ts:199 — children fall through to gRPC                                                     |
| 13  | Audit FILE_NODE_TYPES via offline API        | Determine which types actually need file paths                                                  |
| 14  | Export render passes dialog rework           | File name input instead of "select folder"                                                      |
| 15  | FileBrowserDialog file type filter dropdown  | User-facing dropdown for file types                                                             |
| 16  | Modal dialog stacking policy                 | Add modal manager or single-modal z-index                                                       |
| 17  | Toolbar button style unification             | Audit all toolbar buttons, unify styles                                                         |
| 18  | Suppress edits during sync                   | Disable user edits while scene is syncing                                                       |
| 19  | PreferencesDialog wiring                     | Connect stub to ApiProjectManager.applicationPreferences()                                      |
| 20  | Save render passes: multi-pass export        | Discover all passes, export with pass name + extension                                          |
| 21  | React 19 upgrade                             | @xyflow/react 12.x and react-error-boundary 6.x support R19                                     |

## Hard

| #   | Item                                      | Notes                                                       |
| --- | ----------------------------------------- | ----------------------------------------------------------- |
| 22  | Automated test suite                      | Vitest — estimateNodeWidth, CacheManager, services          |
| 23  | execute_batch tool                        | 30x speedup — batch gRPC calls (1.4s gRPC vs 300s thinking) |
| 24  | Multi-connect: connect all selected nodes | Rewrite edge connection logic                               |
| 25  | Node Inspector for grouped nodes          | Group-specific rendering                                    |
| 26  | Viewport axis rotation                    | Axis overlay must rotate with camera orientation (3D math)  |
| 27  | Animation bar below render bar            | Full new component + Octane API                             |
| 28  | Event queuing during load                 | Queue events from async loading, don't emit synchronously   |
| 29  | Progressive scene loading                 | Load first-level then connections                           |
| 30  | Better graph arranging                    | Sugiyama or force-directed layout                           |

## Octane API Bugs (not fixable by us)

| #   | Item                                    | Notes                                                       |
| --- | --------------------------------------- | ----------------------------------------------------------- |
| 31  | Quad primitive (type 18) crashes Octane | Workaround: use quad.obj or flat Box                        |
| 32  | Primitive type change crashes Octane    | Workaround: disconnect geo before changing, reconnect after |
