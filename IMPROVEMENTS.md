# OctaneWebR — Improvement Backlog

Items extracted from user notes that haven't been fully addressed yet.

---

## Features

| #   | Item                                                    | Notes                                                                                                                                                                                                    |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **PreferencesDialog wiring**                            | UI stub exists but not connected to Octane. Use `ApiProjectManager.applicationPreferences()` for the prefs node handle, and the inverse setter functions.                                                |
| 2   | **Save render passes: multi-pass export**               | Currently hardcoded to beauty pass only (`RenderExportService.ts:204`). Should discover all render passes from protos and tack pass name + extension onto filename (e.g. `_beauty.exr`, `_diffuse.exr`). |
| 3   | **Export render passes dialog**                         | Should look like save render passes with a file name input field, not "select folder".                                                                                                                   |
| 4   | **Save render / save render passes shared path memory** | Both operations should share the same last-used path so the user doesn't re-navigate.                                                                                                                    |
| 5   | **FileBrowserDialog file type filter dropdown**         | Internal filtering by extension exists, but no user-facing dropdown to select file types (.orbx, .ocs, .png, etc.). (GAP-F6)                                                                             |
| 6   | **Multi-connect: connect all selected nodes**           | Ctrl+drag from selected nodes only connects the first. Should connect all to target pin. (`useConnectionOperations.ts:313`) (GAP-MULTICONNECT)                                                           |
| 7   | **Viewport axis rotation**                              | Axis overlay in render viewport should rotate with the camera orientation (if enabled). Currently static.                                                                                                |
| 8   | **Fix all icons in node-add context menu**              | Icons in the Add Node context menu (right-click graph → Add Node) need to be corrected to match each node type.                                                                                          |
| 9   | **Animation bar below render bar**                      | When the scene has animation, show an animation timeline/controls bar below the render bar. Low priority.                                                                                                |

## UI Polish

| #   | Item                                                | Notes                                                                                                                                                                               |
| --- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | **Panel title menu icon**                           | Black box left of each panel title. In Octane this is a panel menu — overkill for us, but the icon should be present for visual match.                                              |
| 11  | **Tooltip yellow background**                       | User wants tooltips to have yellow background like Octane. No `--tooltip` CSS var found — needs implementation.                                                                     |
| 12  | **Tooltip audit**                                   | Many elements show "Unknown type" or generic tooltips. Needs interactive session to identify and fix. (GAP-TOOLTIPS)                                                                |
| 13  | **Inspector: expanded vs collapsed icon box shape** | Expanded parent nodes should have rounded right side on icon box; collapsed/end nodes should have straight right side.                                                              |
| 14  | **Inspector: parameter bar 3D gradient**            | Parameter bar should get the 3D gradient effect to match Octane.                                                                                                                    |
| 15  | **GPU statistics dialog: remove "selected" border** | Dialog has an unneeded selected-state border.                                                                                                                                       |
| 16  | **GPU dialog on render bar right-click**            | GPU statistics dialog should pop when right-clicking anywhere in the render bar. Verify this works.                                                                                 |
| 17  | **Modal dialog stacking policy**                    | Multiple modals can stack (e.g. Batch Rendering + About). Most apps enforce single-modal. (NOTE-F15)                                                                                |
| 18  | **Dialog dimming**                                  | All modal-overlay dialogs dim the background. Consider whether dialogs should dim or not. (NOTE-DIALOG-DIM)                                                                         |
| 19  | **Node Inspector for grouped nodes**                | Inspector display for "Node graph" group nodes looks different from Octane. May need group-specific rendering. (NOTE-A14-INSPECTOR)                                                 |
| 20  | **Theme: create "vibe" theme**                      | Current theme should be copied to "vibe" (`theme-vibe.css` exists); "theme-octane" should match Octane as closely as possible. Verify separation is complete.                       |
| 21  | **Toolbar button style unification**                | Render bar "play" button doesn't have the same selected tint as the "axis" button. All toolbar/bar buttons should share identical style aspects (select tint, hover, border, etc.). |
| 22  | **CSS cleanup**                                     | Toolbar/bar button styles are scattered and inconsistent. Needs consolidation into shared classes, but tricky due to specificity and existing overrides.                            |

## Architecture / Code Quality

| #   | Item                                   | Notes                                                                                                                                                      |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 23  | **RequestQueue configurable max size** | Should have a configurable constant for max queue size. 0 = no queuing (default to 0). Not implemented — no `maxSize` constant found.                      |
| 24  | **Automated test suite**               | No tests yet. Vitest installed + configured (`npm run test`). Candidates: `estimateNodeWidth`, position conversion, `CacheManager`, service layer mocking. |
| 25  | **React 19 upgrade**                   | Safe per dependency check. `@xyflow/react` 12.x and `react-error-boundary` 6.x support R19.                                                                |

## Large-Scene UX (Deferred)

| #   | Item                           | Notes                                                                                                          |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| 26  | **Progressive scene loading**  | Load first-level nodes + display, then connections (second level). Preferentially load UI-visible items first. |
| 27  | **Event queuing during load**  | Events emitted synchronously from the async loading loop should be queued — don't block/slow the async load.   |
| 28  | **Suppress edits during sync** | Prevent user edits while scene is still syncing to avoid state conflicts.                                      |
| 29  | **Better graph arranging**     | Current DAG layout is basic. Investigate Sugiyama or force-directed algorithms for better node positioning.    |
