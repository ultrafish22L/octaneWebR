# Wood Chips Demo — Scene Settings Dump (v6 rebuild)

**Generated:** 2026-03-14 (live query from Octane)
**ORBX:** `ORBX/woodchips_demo_v6_rebuild.orbx`
**Node count: 64** (vs v5's 100)

---

## Camera (Thin Lens)

| Property | Value |
|----------|-------|
| Position | {0, 1.934, 6.758} |
| Target | {0, 0.1, 0} |
| Aperture | 0 (DOF off) |

## Environment (Texture Environment)

| Property | Value |
|----------|-------|
| Texture | RGB color {0.3, 0.3, 0.3} (neutral gray — flat, no mix) |
| Power | 0.5 |
| cameraEnvironment | **NOT CONNECTED** |
| visibleEnvironmentBackplate | NOT CONNECTED |

---

## Geometry Group (10 inputs)

| Pin | Species | Position | Scale |
|-----|---------|----------|-------|
| 0 | Plank | {0, -0.075, 0} | {5, 0.15, 2} |
| 1 | Red Oak | {-2.1, 0.175, 0} | (box default) |
| 2 | White Oak | {-1.4, 0.175, 0} | (box default) |
| 3 | Purpleheart | {-0.7, 0.175, 0} | (box default) |
| 4 | Ebony | {0, 0.175, 0} | (box default) |
| 5 | Maple | {0.7, 0.175, 0} | (box default) |
| 6 | Walnut | {1.4, 0.175, 0} | (box default) |
| 7 | Zebrawood | {2.1, 0.175, 0} | (box default) |
| 8 | Backdrop | {0, 3, -1} | {8, 0.05, 5} |
| 9 | Light | {0, 2, -5} | {30, 20, 0.01} |

---

## Materials — Key Properties

| Species | Coating | CoatRough | Roughness | Aniso | BRDF | BumpH |
|---------|---------|-----------|-----------|-------|------|-------|
| Plank | 0.2 | 0.04 | 0.063 | 0 | 0 (Beck) | 0.001 |
| Red Oak | 0.3 | 0.03 | 0.063 | 0.4 | 2 (GGX) | 0.015 |
| White Oak | 0.3 | 0.03 | 0.063 | 0.35 | 2 (GGX) | 0.01 |
| Purpleheart | 0.25 | 0.02 | 0.063 | 0.3 | 2 (GGX) | 0.005 |
| Ebony | 0.45 | 0.001 | 0.15 | 0.1 | 2 (GGX) | 0.002 |
| Maple | 0.25 | 0.02 | 0.063 | 0.2 | 2 (GGX) | 0.005 |
| Walnut | 0.3 | 0.03 | 0.063 | 0.35 | 2 (GGX) | 0.008 |
| Zebrawood | 0.3 | 0.04 | 0.063 | 0.5 | 2 (GGX) | 0.015 |

---

## Albedo Colors

| Species | Color 1 (light) | Color 2 (dark) |
|---------|----------------|---------------|
| Plank | {0.72, 0.58, 0.38} | {0.5, 0.35, 0.2} |
| Red Oak | {0.48, 0.3, 0.2} | {0.3, 0.17, 0.1} |
| White Oak | {0.42, 0.33, 0.22} | {0.28, 0.2, 0.13} |
| Purpleheart | {0.45, 0.18, 0.5} | {0.25, 0.08, 0.3} |
| Ebony | {0.02, 0.018, 0.018} | {0.015, 0.012, 0.012} |
| Maple | {0.75, 0.65, 0.5} | {0.4, 0.28, 0.15} |
| Walnut | {0.22, 0.14, 0.08} | {0.1, 0.06, 0.035} |
| Zebrawood | {0.85, 0.72, 0.45} | {0.22, 0.12, 0.05} |

---

## Turbulence Textures (color grain)

| Species | Scale X,Y,Z | Gamma | Omega |
|---------|------------|-------|-------|
| Plank | {8, 8, 0.03} | 1.2 | 0.5 |
| Red Oak | {8, 9, 0.03} | 1.5 | 0.5 |
| White Oak | {6, 7, 0.025} | 1.8 | 0.5 |
| Purpleheart | {5, 6, 0.02} | 2.8 | 0.5 |
| Ebony | {3, 4, 0.015} | 20.0 | 0.5 |
| Maple | {6, 7, 0.025} | 1.1 | 0.5 |
| Walnut | {7, 8, 0.025} | 2.1 | 0.5 |
| Zebrawood | {10, 12, 0.04} | 0.9 | 0.5 |

## Marble Textures (bump only)

| Species | Scale X,Y,Z |
|---------|------------|
| Red Oak | {6, 6, 0.03} |
| White Oak | {5, 5, 0.025} |
| Purpleheart | {4, 4, 0.02} |
| Ebony | {3, 3, 0.015} |
| Maple | {5, 5, 0.025} |
| Walnut | {6, 6, 0.03} |
| Zebrawood | {8, 8, 0.04} |

---

## Lighting

### Panel Light (geo pin 9)
| Property | Value |
|----------|-------|
| Position | {0, 2, -5} |
| Scale | {30, 20, 0.01} |
| Diffuse color | {0.7, 0.7, 0.7} |
| Power | 350 |
| Temperature | 4000K |
| Surface brightness | true |
| Illumination | true |
| Cast shadows | true |

### Glen Backdrop (geo pin 8)
| Property | Value |
|----------|-------|
| Position | {0, 3, -1} |
| Scale | {8, 0.05, 5} |
| Diffuse color | {0.7, 0.7, 0.7} |
| Power | 4 |
| Temperature | 6500K |
| Surface brightness | true |
| Illumination | true |
| Cast shadows | true |
| Texture | `assets\bg_glen_eq_c.jpg` |

---

## DIFFERENCES vs V5

### Structural (36 missing nodes):
1. **No roughness-by-grain** — v5 had Mix(Turb, min_rough, max_rough) on roughness pin for 6 species. Rebuild uses flat 0.063 for all (except ebony 0.15).
2. **No Falloff map** — v5 had Falloff x Marble for view-dependent bump. Rebuild uses raw marble.
3. **No Multiply textures** (7) — v5 used these for Falloff x Marble bump chains.
4. **No env Mix texture** — v5 had cosmic blue turbulence env (dark blue mix). Rebuild has flat gray.
5. **cameraEnvironment disconnected** — v5 connected same env to both pins.

### Value differences:

| Property | V5 | V6 Rebuild |
|----------|-----|-----------|
| **Camera pos** | {0.3, 3.5, 7.5} | {0, 1.934, 6.758} |
| **Camera target** | {0, 0, -0.3} | {0, 0.1, 0} |
| **Camera aperture** | 0.893 (DOF on) | 0 (DOF off) |
| **Env power** | 2.0 | 0.5 |
| **Env texture** | Mix(Turb, blue, deep_blue) | Flat gray {0.3} |
| **Plank scale** | {6, 0.12, 1.8} | {5, 0.15, 2} |
| **Plank pos** | {0, 0, 0} | {0, -0.075, 0} |
| **Block Y pos** | 0.195 | 0.175 |
| **Block spacing** | 0.8 apart | 0.7 apart |
| **Block scale** | 0.5x0.15x0.8 | (box default ~1x1x1) |
| **Block rotations** | Y rotations (3,-5,7,-2,4,-3,6 deg) | None |
| **Light pos** | {-3, 5, 3} | {0, 2, -5} |
| **Light scale** | {3, 0.01, 3} | {30, 20, 0.01} |
| **Light rotation** | {-45, 30, 0} | None |
| **Backdrop** | NOT in geo group | In geo group pin 8 |
| **Backdrop illumination** | true | true (should be false) |
| **Backdrop castShadows** | true | true (should be false) |
| **Pine coating** | 0 (none) | 0.2 |
| **Pine roughness** | 0.5 | 0.063 |
| **Red Oak coating** | {0.45,0.3,0.3} | {0.3,0.3,0.3} |
| **Red Oak coatRough** | 0.005 | 0.03 |
| **All coat colors** | Warm tint {R,G,B} | Neutral gray {x,x,x} |
| **All bump heights** | Higher (0.003-0.04) | Lower (0.001-0.015) |
| **Marble Z-scale** | 20-45 (high freq) | 0.015-0.04 (low freq) |
| **Turb Z-scale** | 0.01-0.1 | 0.015-0.04 |
| **Purpleheart colors** | {0.2,0.06,0.22}/{0.08,0.015,0.09} | {0.45,0.18,0.5}/{0.25,0.08,0.3} |
| **Zebrawood colors** | {0.55,0.38,0.12}/{0.05,0.025,0.005} | {0.85,0.72,0.45}/{0.22,0.12,0.05} |
