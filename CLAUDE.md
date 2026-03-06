# OctaneWebR

## Quick Start for New Sessions

- **Dev server**: `npm run dev` (or `preview_start` name "dev")
- **Test scene**: `teapot.orbx` — load via File→Open in the app (path: `C:\otoyla\GRPC\dev\octaneWebR\ORBX\teapot.orbx`)
- **Smoke test**: Toggle Orthographic checkbox on Camera node → verify `setByAttrID` in `grpc-debug.log`
- **Key docs**: `TEST_BUGS.md` (0 open bugs, 4 known Octane API limitations), `TEST_RESULTS.md` (R1-R3 results), `IMPROVEMENTS.md` (29-item backlog)

## Testing Rules

All testing and debugging rules are in `TEST_PLAN.md` — that is the gold standard. Key quick-reference items:

- **Smoke test**: Toggle Orthographic checkbox on Camera node → verify `setByAttrID` in `grpc-debug.log`
- **Logs**: `grpc-debug.log` (server, needs `DEBUG_FILE_LOG = true`), `octaneWebR_client.log` (client)
- **Test after every fix** — fix one, verify, then next. No batching.
- **Fresh state per test** — restart dev server and reload scene before each test.
- **Detect Octane crashes immediately** — check `grpc-debug.log` for `ECONNRESET`/`ECONNREFUSED` after risky actions. If crashed, STOP, report, and wait for user to restart.
- **Lint and build before push** — `npm run lint` + `npm run build` before declaring ready.

## Project Status

- **Version**: 1.4.3 (set in `package.json`)
- **Code review**: 8 passes completed (2026-03-04). All 24 findings fixed. Codebase is clean.
- **Testing**: R1+R2+R3 complete. 152 tests, 117 PASS. 16 bugs fixed and verified.
- **0 open bugs** — all 4 R3 crash bugs addressed. 4 known Octane API limitations in `TEST_BUGS.md` (R3-4, R3-9, R3-10, R3-11).
- **Backlog**: 29 improvements in `IMPROVEMENTS.md` (features, UI polish, architecture, large-scene UX).
