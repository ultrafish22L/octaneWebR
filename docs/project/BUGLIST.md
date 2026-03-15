# Debug List — Tonight

Items from CA review (2026-03-13).

---

## To Investigate

| #     | Item                                                      | Source           | Notes                                                                                                              |
| ----- | --------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| ~~1~~ | ~~**Gold material: CHEATSHEET vs OCTANE_MCP disagree**~~  | ~~CA HIGH #1~~   | **RESOLVED** — Universal Material is the default for everything. CREATIVE aligned to match CHEATSHEET.             |
| ~~2~~ | ~~**Glass material: CHEATSHEET vs OCTANE_MCP disagree**~~ | ~~CA HIGH #2~~   | **RESOLVED** — Universal Material for glass too. CREATIVE aligned.                                                 |
| 3     | **P_DIFFUSE=30 "silent fail" on mesh — misdiagnosed**     | IMPROVEMENTS #48 | User says not a real issue. Retest pin_id:30 on mesh material connections. If works, remove #48 from IMPROVEMENTS. |
| ~~4~~ | ~~**Fresh start wait time: 15s vs 30s**~~                 | ~~CA MEDIUM #2~~ | **RESOLVED** — both docs now say "typically ~5s, use 15s if unsure, experiment."                                   |
| 5     | **Camera framing from bounds**                            | CA LOW #1        | Use centroid for target pos, set zoom based on bounds extents + camera settings. Add to DRESS_BUILD_PROTOCOL.      |
| 6     | **"Materials from geo 1" rule**                           | CA MEDIUM #4     | Every geo should get at least a color variant from the start. Add to OCTANE_MCP source of truth.                   |

## Fixed

| #     | Item                                | Fix                                                                    |
| ----- | ----------------------------------- | ---------------------------------------------------------------------- |
| ~~7~~ | ~~Chrome roughness 0.02 vs 0~~      | Aligned OCTANE_MCP to 0.02 + albedo {0.9,0.9,0.9} to match CHEATSHEET. |
| ~~8~~ | ~~ARCHITECTURE.md stale paths~~     | Fixed `mcp/` tree structure, "5 recipes" → "6 recipes".                |
| ~~9~~ | ~~Placement pin comment ambiguous~~ | Clarified: "pin_index 1, not 0 — pin 0 is transform".                  |
