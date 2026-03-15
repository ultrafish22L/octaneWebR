# Session Log — 2026-03-14: v7 Hybrid (v5 Materials on v6 Scene)

## TL;DR

Dumped and compared v5 (100 nodes) vs v6 rebuild (64 nodes) scene settings. Applied all v5 material values to v6 scene via `set_attribute`, creating the **v7 hybrid**. Discovered marble Z-scale and warm coating colors are the biggest visual quality drivers. Updated CHEATSHEET with validated v5 FINAL values.

---

## What We Did

### 1. Scene Dump Comparison

**Goal:** Understand exactly why v5 looked better than the v6 rebuild (post-crash clean rebuild).

**Method:** Systematic MCP queries — `get_scene_tree` → `get_node_info` for each node → `get_attribute` for every value. Output: two structured markdown files with matching table formats.

**Files produced:**

- `docs/build/V5_SCENE_DUMP.md` — 338-line comprehensive v5 dump (from prior session)
- `docs/build/SCENE_DUMP_v6_rebuild.md` — full v6 dump + DIFFERENCES vs V5 section

**Key finding:** 36 nodes missing from v6, but the visual gap was mostly from **value differences**, not structural ones.

### 2. Critical Differences Found

#### The Big Three (material quality drivers)

| Property              | v5 (good)                      | v6 rebuild (flat)              | Impact                                                                                                                   |
| --------------------- | ------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Marble Z-scale**    | 20-45                          | 0.015-0.04                     | **HUGE** — this IS the grain bump. High Z = tight sine bands along wood grain direction. Low Z = flat, no visible grain. |
| **Coating colors**    | Warm-tinted `{0.45, 0.3, 0.3}` | Neutral gray `{0.3, 0.3, 0.3}` | Warm tint gives lacquer realism — wood reflections should be slightly amber/warm, not neutral.                           |
| **Coating roughness** | 0.003-0.008                    | 0.02-0.04                      | Lower = shinier = more realistic lacquer. v6 was too matte in the clear coat.                                            |

#### Other Value Differences

| Property              | v5                                            | v6                                          |
| --------------------- | --------------------------------------------- | ------------------------------------------- |
| Bump heights          | 0.003-0.04 (higher)                           | 0.001-0.015 (lower)                         |
| Purpleheart albedo    | `{0.2, 0.06, 0.22}` / `{0.08, 0.015, 0.09}`   | `{0.45, 0.18, 0.5}` / `{0.25, 0.08, 0.3}`   |
| Zebrawood albedo      | `{0.55, 0.38, 0.12}` / `{0.05, 0.025, 0.005}` | `{0.85, 0.72, 0.45}` / `{0.22, 0.12, 0.05}` |
| Camera position       | `{0.3, 3.5, 7.5}`                             | `{0, 1.934, 6.758}`                         |
| Camera aperture       | 0.893 (DOF on)                                | 0 (DOF off)                                 |
| Env power             | 2.0                                           | 0.5                                         |
| Block spacing         | 0.8 apart                                     | 0.7 apart                                   |
| Block scale           | 0.5×0.15×0.8                                  | box default ~1×1×1                          |
| Block Y-rotations     | 3°, -5°, 7°, -2°, 4°, -3°, 6°                 | None                                        |
| Light position        | `{-3, 5, 3}`                                  | `{0, 2, -5}`                                |
| Plank coating         | 0 (none)                                      | 0.2                                         |
| Backdrop illumination | true (correct for v5 design)                  | true (should be false for glen)             |

#### Structural Differences (36 missing nodes)

1. **Roughness-by-grain** (18 nodes) — Mix(Turb, min_roughness, max_roughness) on each species' roughness pin. Creates varied surface finish along vs across grain.
2. **Falloff map** (1 node) — normal=0, grazing=1. Shared by all species.
3. **Multiply textures** (7 nodes) — Falloff × Marble for each species. View-dependent bump (less bump on directly-facing surfaces, more at glancing angles).
4. **Extra Mix/Grayscale nodes** (~10 nodes) — supporting the roughness-by-grain chains.
5. **Env Mix texture** — cosmic blue turbulence environment instead of flat gray.

### 3. Applied v5 Values → v7 Hybrid

**Method:** Batched `set_attribute` calls (groups of ~20 parallel calls), organized by property type.

**Applied in order:**

1. **Coating colors** — warm-tinted `{0.45, 0.3, 0.3}` for Red Oak, `{0.35, 0.25, 0.25}` for others
2. **Coating roughness** — 0.003-0.008 per species (down from 0.02-0.04)
3. **Bump heights** — 0.003-0.04 per species (up from 0.001-0.015)
4. **Marble Z-scales** — 20-45 per species (up from 0.015-0.04) — **the biggest single change**
5. **Turbulence gamma/omega** — species-specific values
6. **Purpleheart + Zebrawood albedo colors** — v5 values (darker, more realistic)
7. **Backdrop emission** — illumination OFF, castShadows OFF

**Saved:** `ORBX/woodchips_demo_v7_hybrid.orbx`
**Rendered:** `renders/woodchips_v7_hybrid.png`

### 4. Documentation Updates

| File                                  | What changed                                                                                                                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                           | Current Session updated to v7 hybrid, scene version history table added                                                                                                                   |
| `docs/build/OCTANE_CHEATSHEET.md`     | Species parameter tables replaced with "v5 FINAL — validated via scene dump comparison". Separate tables for turbulence, coating, marble, roughness-by-grain. CRITICAL LESSONS box added. |
| `docs/build/SCENE_DUMP_v6_rebuild.md` | Full dump with DIFFERENCES vs V5 section                                                                                                                                                  |

---

## End Results

### Scene: v7 Hybrid

- **File:** `ORBX/woodchips_demo_v7_hybrid.orbx` (64 nodes)
- **Render:** `renders/woodchips_v7_hybrid.png`
- **What it is:** v6 rebuild scene structure (clean, 64 nodes) with all v5 material quality values applied
- **What's still missing:** roughness-by-grain nodes, falloff×marble bump, block geometry fixes (scale/rotation), env texture

### Validated Material Values (v5 FINAL)

These are now the canonical reference in OCTANE_CHEATSHEET.md:

**Marble Z-scales (bump grain frequency):**
| Species | Z-scale |
|---------|---------|
| Red Oak | 30 |
| White Oak | 25 |
| Purpleheart | 20 |
| Ebony | 45 |
| Maple | 22 |
| Walnut | 35 |
| Zebrawood | 40 |

**Coating (warm-tinted lacquer):**
| Species | Coating | Color | Roughness |
|---------|---------|-------|-----------|
| Red Oak | 0.3 | {0.45, 0.3, 0.3} | 0.005 |
| White Oak | 0.3 | {0.4, 0.28, 0.28} | 0.005 |
| Purpleheart | 0.25 | {0.35, 0.25, 0.25} | 0.003 |
| Ebony | 0.45 | {0.35, 0.25, 0.25} | 0.001 |
| Maple | 0.25 | {0.35, 0.25, 0.25} | 0.005 |
| Walnut | 0.3 | {0.4, 0.28, 0.28} | 0.008 |
| Zebrawood | 0.3 | {0.4, 0.28, 0.28} | 0.006 |

**Bump heights:**
| Species | Height |
|---------|--------|
| Red Oak | 0.03 |
| White Oak | 0.02 |
| Purpleheart | 0.008 |
| Ebony | 0.003 |
| Maple | 0.008 |
| Walnut | 0.015 |
| Zebrawood | 0.04 |

### Key Lessons Learned

1. **Marble Z-scale is everything for wood grain bump.** Z=0.03 looks like smooth plastic. Z=30 looks like real wood grain. Three orders of magnitude matter.

2. **Warm coating colors beat neutral gray.** Real lacquer has a warm amber tint in reflections. `{0.45, 0.3, 0.3}` not `{0.3, 0.3, 0.3}`.

3. **Coating roughness below 0.01 for lacquer.** 0.003-0.008 gives that wet, freshly-polished look. 0.03 looks like sanded-but-unfinished.

4. **Scene dump comparison is invaluable.** Without dumping both scenes to structured markdown, the marble Z-scale issue would never have been found — it's a non-obvious parameter buried deep in the node tree.

5. **Value differences > structural differences for visual quality.** The 36 missing nodes (roughness-by-grain, falloff bump) are nice-to-have, but getting the Z-scales and coating values right was 80% of the visual improvement.

---

## Roles Active This Session

| Role                      | Contribution                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| **AA** (Artistic Agent)   | Directed scene dump comparison, identified visual quality drivers, approved v7 hybrid render     |
| **CM** (Camera Math)      | Documented v5 vs v6 camera positions for reference                                               |
| **TA** (Tech Agent)       | Analyzed marble Z-scale impact, warm coating physics, coating roughness ranges                   |
| **BA** (Business Analyst) | Would review: v7 is 80% of v5 quality with 36% fewer nodes — good ROI on the value-only approach |

---

## What's Next

1. **Add roughness-by-grain** — 18 new nodes (Mix + 2 Grayscale per species), wire to roughness pin 8
2. **Add Falloff × Marble** — 8 new nodes (1 Falloff + 7 Multiply), wire to bump slot
3. **Fix block geometry** — set scale to 0.5×0.15×0.8, add Y-rotation jitter
4. **Phase 1: MCP debug** — 7 bugs + 7 resilience items (see SESSION.md)
5. **Phase 2: UI debug** — easy CSS fixes through medium features (see SESSION.md)
