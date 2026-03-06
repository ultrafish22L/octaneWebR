# OctaneWebR — Bug Tracker

**Last Updated:** 2026-03-07
**Improvement backlog:** See `IMPROVEMENTS.md`

---

## Open Bugs

None — all 4 open bugs from R3 testing have been addressed.

---

## Known Octane API Limitations

| ID       | Description                                                                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BUG-R3-9 | **`ApiNodeGraph.ungroup` crashes Octane** (~5s after the call). The API itself is broken. Ungroup is disabled in the app until Octane fixes this.          |
| BUG-R3-4 | **`ApiItem.destroy` crashes Octane** for recently-disconnected nodes. `replaceNode` skips the destroy call; old nodes are left orphaned but harmless.      |
| R3-10    | **Render engine type change calls are ignored** by Octane (no error, no effect). `setKernelType` sends the API call but Octane does not switch the engine. |
| R3-11    | **Camera is not reset after File→Open**. Octane keeps the previous camera position/orientation after loading a new scene.                                  |

---

## Fixed Bugs

| ID            | Severity | Description                                               | Fix                                                                                                       |
| ------------- | -------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| BUG-R3-2      | High     | **Octane crash ~9s after F5/File→Open**                   | Clear request queue on scene refresh. Defer render target inspector selection until tree build completes. |
| BUG-R3-4      | High     | **Octane crash during `replaceNode` destroy**             | Skip `deleteNodeOptimized` call after `connectPinByIndex`. Old node left orphaned (harmless).             |
| BUG-R3-12     | High     | **Octane crash during edge reconnect**                    | Added pin type validation to `onReconnect`/`onReconnectEnd` matching `onConnect`.                         |
| BUG-R3-9      | High     | **Octane crash during ungroup**                           | Disabled `ApiNodeGraph.ungroup` call (Octane API limitation). Shows user-facing message.                  |
| BUG-R3-1      | High     | **Node max width too small for high-pin-count nodes**     | Pin-driven width is no longer clamped. Only label-driven width clamped to `NODE_MAX_WIDTH`.               |
| BUG-R3-3      | Low      | **Panel splitter lines render on top of modal dialogs**   | Set splitter z-index to 1 (below modal overlay).                                                          |
| BUG-R3-5      | Low      | **Ctrl+X (Cut) not bound in keyboard handler**            | Added `key === 'x'` case in the keydown handler.                                                          |
| BUG-R3-6      | Medium   | **File→Open scene tree sync incomplete**                  | Added 1.5s delay after `loadProject` + extended retry to `< 3` items with up to 4 retries.                |
| BUG-R3-7      | Medium   | **Node context menu clips off page edge**                 | Added viewport boundary detection with `Math.max(0, ...)` clamping.                                       |
| BUG-R3-8      | Medium   | **File-based node creation doesn't load the file**        | Added explicit `ApiItem.evaluate()` after `setValueByAttrID`. Fixed reload to use `A_RELOAD (124)`.       |
| BUG-R3-13     | Medium   | **File → New does not auto-resync app state**             | Extended timeout to 120s. Added full scene refresh after `resetProject`.                                  |
| BUG-R3-14     | Medium   | **SavePackageDialog is see-through (missing background)** | Added `modal-dialog` class to all dialog inner wrappers.                                                  |
| BUG-RT-SELECT | Medium   | **Render target not activated on click**                  | Added `setRenderTargetNode` call in `handleNodeSelect`.                                                   |
| BUG-R2-1      | Low      | **GPU Statistics dialog didn't close on click-away**      | Replaced with `modal-overlay` wrapper + `handleOverlayClick` guard.                                       |
| BUG-F5-1b     | Low      | **F5 refresh timing race**                                | Added retry logic (up to 2 retries, 500ms delay) in `useSceneTree.ts`.                                    |
| BUG-EDGE-DEL  | Medium   | **Edge deletion via Delete key was visual-only**          | Added `client.disconnectPin()` calls for each deleted edge.                                               |
