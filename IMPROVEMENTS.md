# OctaneWebR — Improvement Backlog

Ordered easy → hard within each section. #0 (MCP server) and #20 (vibe theme) completed.

---

render save dialogs need all functionality of octane's look for screenshots
add to doc files for ai to reference https://render.otoy.com/forum/index.php login creds upon request

---

## Major

| #   | Item                                                  | Notes                                                                                       |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 0   | ~~**MCP server layer for AI-driven scene creation**~~ | **DONE** — 21 tools in `mcp/`, stdio transport, esbuild + tsx. `.mcp.json` for Claude Code. |

---

## Easy — CSS / one-file changes

| #   | Item                                                    | Difficulty | Notes                                                                                        |
| --- | ------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| 1   | **GPU statistics dialog: remove "selected" border**     | Trivial    | Delete one CSS rule.                                                                         |
| 2   | **Dialog dimming**                                      | Trivial    | Decide whether modals dim background, toggle CSS. (NOTE-DIALOG-DIM)                          |
| 3   | **Tooltip yellow background**                           | Easy       | Add `--tooltip-bg` / `--tooltip-text` CSS vars + styles.                                     |
| 4   | **Panel title menu icon**                               | Easy       | Add icon element left of each panel title + CSS. Visual match only, no menu behavior needed. |
| 5   | **Inspector: parameter bar 3D gradient**                | Easy       | Apply existing 3D gradient pattern to parameter bars.                                        |
| 6   | **Inspector: expanded vs collapsed icon box shape**     | Easy       | Conditional `border-radius` — rounded right side when expanded, straight when collapsed.     |
| 7   | **Save render / save render passes shared path memory** | Easy       | Share a single last-used-path state variable between both operations.                        |
| 8   | **RequestQueue configurable max size**                  | Easy       | Add a `MAX_QUEUE_SIZE` constant. 0 = no queuing (default).                                   |
| 9   | **GPU dialog on render bar right-click**                | Easy       | Add `onContextMenu` handler to render bar that opens GPU stats dialog.                       |

## Medium — multi-file or new components

| #   | Item                                            | Difficulty | Notes                                                                                                                                                                 |
| --- | ----------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | **Modal dialog stacking policy**                | Medium     | Add modal manager or enforce single-modal z-index policy. (NOTE-F15)                                                                                                  |
| 11  | **Toolbar button style unification**            | Medium     | Audit all toolbar/bar buttons, unify select tint, hover, border styles.                                                                                               |
| 12  | **CSS cleanup**                                 | Medium     | Consolidate scattered toolbar/bar button styles into shared classes. Tricky due to specificity.                                                                       |
| 13  | **Fix all icons in node-add context menu**      | Medium     | Map each node type to correct icon in the Add Node context menu.                                                                                                      |
| 14  | **Export render passes dialog**                 | Medium     | Rework dialog to include file name input field instead of "select folder".                                                                                            |
| 15  | **FileBrowserDialog file type filter dropdown** | Medium     | Add user-facing dropdown to select file types (.orbx, .ocs, .png, etc.). Internal filtering exists. (GAP-F6)                                                          |
| 16  | **Tooltip audit**                               | Medium     | Interactive session to find and fix all "Unknown type" / generic tooltips. (GAP-TOOLTIPS)                                                                             |
| 17  | **Suppress edits during sync**                  | Medium     | Disable user edits while scene is syncing to avoid state conflicts.                                                                                                   |
| 18  | **PreferencesDialog wiring**                    | Medium     | Connect existing UI stub to Octane via `ApiProjectManager.applicationPreferences()`.                                                                                  |
| 19  | **React 19 upgrade**                            | Medium     | `@xyflow/react` 12.x and `react-error-boundary` 6.x support R19. Needs testing.                                                                                       |
| 20  | **Save render passes: multi-pass export**       | Medium     | Discover all render passes from protos, export with pass name + extension (e.g. `_beauty.exr`, `_diffuse.exr`). Currently beauty only (`RenderExportService.ts:204`). |

## Hard — significant new logic or architecture

| #   | Item                                          | Difficulty | Notes                                                                                                                        |
| --- | --------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 21  | **Multi-connect: connect all selected nodes** | Hard       | Ctrl+drag from selected nodes only connects first. Rewrite edge connection logic. (`useConnectionOperations.ts:313`)         |
| 22  | **Viewport axis rotation**                    | Hard       | Axis overlay must rotate with camera orientation. Requires 3D math / matrix transforms.                                      |
| 23  | **Automated test suite**                      | Hard       | Vitest configured but no tests. Candidates: `estimateNodeWidth`, position conversion, `CacheManager`, service layer mocking. |
| 24  | **Event queuing during load**                 | Hard       | Events from async loading loop should be queued, not emitted synchronously.                                                  |
| 25  | **Node Inspector for grouped nodes**          | Hard       | Group-specific rendering for "Node graph" group nodes. (NOTE-A14-INSPECTOR)                                                  |
| 26  | **Animation bar below render bar**            | Hard       | Full new UI component + Octane animation API integration. Low priority.                                                      |
| 27  | **Progressive scene loading**                 | Hard       | Load first-level nodes + display, then connections. Preferentially load UI-visible items first.                              |
| 28  | **Better graph arranging**                    | Hard       | Current DAG layout is basic. Investigate Sugiyama or force-directed algorithms.                                              |

## Bugs

| #   | Item                                                    | Difficulty | Notes                                                                                                                                                          |
| --- | ------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 29  | **Node graph editor context menu fails on empty scene** | Medium     | Right-click context menu should work even when the scene is empty (no nodes loaded).                                                                           |
| 30  | **Audit FILE_NODE_TYPES via offline API run**           | Medium     | Query all node types via API to determine which actually require a file path. Current list was hand-curated and had NT_GEO_OBJECT wrong. Need definitive list. |
