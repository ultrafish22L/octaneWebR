# OctaneWebR

## Testing Rules

When testing the app after code changes:

1. **Set log level to DEBUG** before testing: In `client/src/utils/Logger.ts`, ensure the dev default is `LogLevel.DEBUG` (not INFO).
2. **Enable server-side file logging**: In `vite-plugin-octane-grpc.ts`, set `DEBUG_FILE_LOG = true` so gRPC request/response pairs are written to `grpc-debug.log`.
3. **Read log files to verify behavior**: After testing interactions (e.g. toggling a checkbox), read `grpc-debug.log` (server gRPC calls) and `octaneWebR_client.log` (client Logger output) to confirm API calls reached Octane.
4. **Use the Orthographic checkbox** on the Camera node as the standard end-to-end test: select Camera in scene tree, toggle the Orthographic checkbox in the Node Inspector, and verify a `setPinValueByPinID` (or equivalent `set` call) appears in the log files.
5. **Don't wait too long between testing** — test incrementally after each batch of changes rather than accumulating many edits before verifying.

## Code Review Status

8 review passes completed (2026-03-04). Pass 8 found only 3 items. Codebase is clean.

## Version

Current version: **1.4.1** (set in `package.json`)
