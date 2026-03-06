# OctaneWebR — Bug Tracker

**Last Updated:** 2026-03-07
**Improvement backlog:** See `IMPROVEMENTS.md`

---

## Open Bugs

| ID        | Severity | Description                                                                                                                                                                                                                                                                                                             |
| --------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BUG-R3-2  | High     | **Octane crash ~9s after F5 refresh following File→Open**: F5 scene rebuild completes OK; crash happens 9s later during inspector `getByAttrID` calls. App is querying attributes too aggressively after scene reload — need to throttle or delay inspector queries after F5.                                           |
| BUG-R3-4  | High     | **Octane crash during `replaceNode` → `ApiItem.destroy` of old camera**: After replacing camera type (Thin Lens → Panoramic), destroying the old camera crashes Octane ~8s later. App needs to delay or sequence the destroy call — don't destroy a node that was just disconnected from the render pipeline.           |
| BUG-R3-9  | High     | **Octane crash during `ApiNodeGraph.ungroup`**: Reproduced twice (~7s delay between ungroup request and crash). App's ungroup call sequence may be incorrect — investigate proper API usage for ungrouping.                                                                                                             |
| BUG-R3-12 | High     | **Octane crash during edge reconnect (disconnect geometry pin)**: Disconnecting a geometry pin via `connectToIx` handle 0 crashes Octane ~4.6s later. App should validate pin type compatibility BEFORE disconnecting the old pin. `onReconnect`/`onReconnectEnd` handlers bypass the type check that `onConnect` uses. |

---

## Fixed Bugs

| ID            | Severity | Description                                               | Fix                                                                                                 |
| ------------- | -------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| BUG-R3-1      | High     | **Node max width too small for high-pin-count nodes**     | Pin-driven width is no longer clamped. Only label-driven width clamped to `NODE_MAX_WIDTH`.         |
| BUG-R3-3      | Low      | **Panel splitter lines render on top of modal dialogs**   | Set splitter z-index to 1 (below modal overlay).                                                    |
| BUG-R3-5      | Low      | **Ctrl+X (Cut) not bound in keyboard handler**            | Added `key === 'x'` case in the keydown handler.                                                    |
| BUG-R3-6      | Medium   | **File→Open scene tree sync incomplete**                  | Added 1.5s delay after `loadProject` + extended retry to `< 3` items with up to 4 retries.          |
| BUG-R3-7      | Medium   | **Node context menu clips off page edge**                 | Added viewport boundary detection with `Math.max(0, ...)` clamping.                                 |
| BUG-R3-8      | Medium   | **File-based node creation doesn't load the file**        | Added explicit `ApiItem.evaluate()` after `setValueByAttrID`. Fixed reload to use `A_RELOAD (124)`. |
| BUG-R3-13     | Medium   | **File → New does not auto-resync app state**             | Extended timeout to 120s. Added full scene refresh after `resetProject`.                            |
| BUG-R3-14     | Medium   | **SavePackageDialog is see-through (missing background)** | Added `modal-dialog` class to all dialog inner wrappers.                                            |
| BUG-RT-SELECT | Medium   | **Render target not activated on click**                  | Added `setRenderTargetNode` call in `handleNodeSelect`.                                             |
| BUG-R2-1      | Low      | **GPU Statistics dialog didn't close on click-away**      | Replaced with `modal-overlay` wrapper + `handleOverlayClick` guard.                                 |
| BUG-F5-1b     | Low      | **F5 refresh timing race**                                | Added retry logic (up to 2 retries, 500ms delay) in `useSceneTree.ts`.                              |
| BUG-EDGE-DEL  | Medium   | **Edge deletion via Delete key was visual-only**          | Added `client.disconnectPin()` calls for each deleted edge.                                         |
