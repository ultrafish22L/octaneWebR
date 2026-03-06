# OctaneWebR Test Results — Round 4

**Date:** 2026-03-07
**App Version:** v1.4.3
**Scene:** teapot.orbx
**Tests:** 181 total (43 Easy + 71 Medium + 47 Hard + 20 Round 3)

---

## Bugs Found

| ID       | Test | Severity | Description                                                                  | Status              |
| -------- | ---- | -------- | ---------------------------------------------------------------------------- | ------------------- |
| BUG-R4-1 | C6   | Low      | Grid lines invisible — stroke color #454545 matches background rgb(69,69,69) | **FIXED** → #555555 |

---

## Pass 1: Easy (43 tests)

| ID  | Test                              | Result   | Notes                                                                                              |
| --- | --------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| H1  | Status bar shows "Connected"      | **PASS** | Green "Connected" indicator visible top-right in screenshot                                        |
| H2  | Version number displayed          | **PASS** | "OctaneWebR v1.4.3" confirmed in status bar footer                                                 |
| H3  | Temporary status messages         | **PASS** | "Building scene: adding node..." during load → "Ready" after load                                  |
| B1  | Click node → selected + inspector | **PASS** | Kernel highlighted blue in outliner, inspector shows "Kernel: Kern DirectLighting" with 40+ params |
| B2  | Expand arrow (+) → children       | **PASS** | Camera expanded: 15→44 items, children visible in screenshot                                       |
| B3  | Collapse arrow (−) → hidden       | **PASS** | Camera collapsed: 44→15 items, children hidden in screenshot                                       |
| B4  | Expand All                        | **PASS** | 15→56 items, all nodes expanded visually confirmed                                                 |
| B5  | Collapse All                      | **PASS** | 56→3 items, only root nodes with "+" visible                                                       |
| B6  | Refresh button                    | **PASS** | Tree rebuilt (56→3→15), "Syncing" during rebuild, "Ready" after                                    |
| B7  | Tab switch Scene/Live/Local DB    | **PASS** | Each tab shows different content: Scene=15 items, Live DB/Local DB=empty DB view                   |
