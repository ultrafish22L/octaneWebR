# OctaneWebR

## Quick Start for New Sessions

- **Dev server**: `npm run dev` (or `preview_start` name "dev")
- **Test scene**: `teapot.orbx` — load via File→Open in the app (path: `C:\otoyla\GRPC\dev\octaneWebR\ORBX\teapot.orbx`)
- **Smoke test**: Toggle Orthographic checkbox on Camera node → verify `setByAttrID` in `grpc-debug.log`
- **Key docs**: `TEST_BUGS.md` (open bugs), `TEST_RESULTS.md` (R2+R3 results), `TEST_PLAN.md` (181 tests), `NOTES.md` (user design notes)

## Testing Rules

When testing the app after code changes:

1. **Set log level to DEBUG** before testing: In `client/src/utils/Logger.ts`, ensure the dev default is `LogLevel.DEBUG` (not INFO).
2. **Enable server-side file logging**: In `vite-plugin-octane-grpc.ts`, set `DEBUG_FILE_LOG = true` so gRPC request/response pairs are written to `grpc-debug.log`.
3. **Read log files to verify behavior**: After testing interactions (e.g. toggling a checkbox), read `grpc-debug.log` (server gRPC calls) and `octaneWebR_client.log` (client Logger output) to confirm API calls reached Octane.
4. **Use the Orthographic checkbox** on the Camera node as the standard end-to-end test: select Camera in scene tree, toggle the Orthographic checkbox in the Node Inspector, and verify a `setByAttrID` (or equivalent `set` call) appears in the log files.
5. **Don't wait too long between testing** — test incrementally after each batch of changes rather than accumulating many edits before verifying.
6. **Test as a human would** — click, drag, type, hover. Don't call internal app functions directly for testing app operation. Synthetic events DO work through preview tools and React fiber props.
7. **Test after every fix** — do NOT batch multiple bug fixes before testing. Fix one bug, start the dev server, verify the fix works, then move to the next bug. This catches regressions early and avoids debugging multiple changes at once.
8. **Test-fix loop** — when a test fails, fix the issue and re-test immediately. Keep iterating until the fix is verified, or stop and ask the user if stuck. Never move on from a failing test.
9. **Fresh state per test** — restart the dev server and reload the scene before each bug test. Stale state from a previous test can mask or cause false results.
10. **Verify → fix → report** — after a batch of fixes, do a clean verification test run of all items. If any fail, fix and re-test immediately. Then report results and wait for the user to push.

## Project Status

- **Version**: 1.4.2 (set in `package.json`)
- **Code review**: 8 passes completed (2026-03-04). All 24 findings fixed. Codebase is clean.
- **Testing**: Round 3 complete (2026-03-06). 152 tests, 117 PASS. 14 open bugs in `TEST_BUGS.md` (5 are Octane-side crashes, 2 remaining app-fixable).
- **4 bug fixes shipped (R2)**: BUG-R2-1, BUG-F5-1b, BUG-EDGE-DEL, BUG-RT-SELECT (all verified in R3).
- **6 bug fixes verified (R3)**: BUG-R3-1 (node width), BUG-R3-3 (splitter z-index), BUG-R3-5 (Ctrl+X), BUG-R3-7 (menu clamping), BUG-R3-13 (File→New resync), BUG-R3-14 (dialog backgrounds). All verified 2026-03-06.
- **2 remaining app bugs**: BUG-R3-6 (File→Open async timing), BUG-R3-8 (file node load).
