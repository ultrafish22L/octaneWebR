# Procedural Hardwood Material

> Values below are a starting point — deviate, experiment, improve.

> **Before building:** Read `CLAUDE.md`, `docs/mcp/REFERENCE.md`, `docs/mcp/BUILD.md`.

## The Vision

Good procedural hardwood is about restraint. Real sanded wood has gentle color variation, not high-contrast stripes. The grain is felt more than seen — a soft undulation of warm and cool tones, not a laser-printed pattern.

The technique: **Turbulence for color, Marble for bump.** Turbulence stretched along one axis creates organic, flowing grain patterns for the albedo mix. Marble creates directional sine-wave relief for the surface bump. Never use Marble for color — it produces plywood stripes. Never use Turbulence for bump — it creates random noise instead of directional grain.

The three pillars of realism:

1. **Coating** — warm-tinted lacquer (amber, not neutral gray) with very low roughness. This is what makes wood look finished, not painted.
2. **Anisotropy** — stretches reflections along the grain direction. Without it, the surface reads as plastic.
3. **Roughness-by-grain** — dark grain is rougher than light grain. A Mix texture driven by the same Turbulence as the albedo, blending between two grayscale roughness values, creates subtle per-grain variation.

All species use Universal material with GGX BRDF. The same node structure applies to every species — only the parameter values change.

---

## Ingredients

_Living values — refined as discovered._

### Core Technique

- **Albedo**: Mix texture — Turbulence drives the mix amount between two RGB colors (light grain, dark grain)
- **Bump**: Marble texture — surface relief only, stretched along grain direction (high Z-scale)
- **Turbulence transform**: Z scale very small (0.01-0.05), X/Y larger (2-10) — creates the grain stretch
- **Coating**: white or partial gray for lacquer. Coating roughness 0.01-0.04. Coating IOR 1.5 (polyurethane).
- **Anisotropy**: 0.1 (ebony) to 0.5 (zebrawood) — stretches reflections along grain
- **Roughness-by-grain**: Mix texture with same Turbulence as albedo driving the amount, two grayscale floats as min/max roughness. Dark grain = rougher, light = smoother.

### Pore Structure (determines polish level)

| Pore Type              | Species     | Max Polish    | Coating Rough | Base Roughness           | Bump      |
| ---------------------- | ----------- | ------------- | ------------- | ------------------------ | --------- |
| Ring-porous (open)     | Red Oak     | Satin         | 0.03          | 0.25-0.45 (grain-driven) | 0.06-0.10 |
| Ring-porous (tyloses)  | White Oak   | Semi-gloss    | 0.03          | 0.20-0.38 (grain-driven) | 0.04-0.07 |
| Diffuse-porous (fine)  | Purpleheart | High gloss    | 0.02          | 0.12                     | 0.015     |
| Diffuse-porous (ultra) | Ebony       | Mirror        | 0.03          | 0.25                     | 0.005     |
| Diffuse-porous (small) | Maple       | Very smooth   | 0.02          | 0.10                     | 0.01-0.05 |
| Semi-ring-porous       | Walnut      | Moderate-good | 0.03          | 0.15-0.32 (grain-driven) | 0.03-0.06 |
| Diffuse-porous (HUGE)  | Zebrawood   | Satin         | 0.04          | 0.20-0.45 (grain-driven) | 0.07-0.08 |

### Turbulence (Color Grain)

| Species     | Light RGB            | Dark RGB              | Scale X,Y,Z   | Gamma | Omega | Octaves | Aniso |
| ----------- | -------------------- | --------------------- | ------------- | ----- | ----- | ------- | ----- |
| Red Oak     | {0.48, 0.30, 0.20}   | {0.30, 0.17, 0.10}    | {7, 9, 0.08}  | 1.2   | 0.6   | 10      | 0.4   |
| White Oak   | {0.42, 0.33, 0.22}   | {0.28, 0.20, 0.13}    | {5, 7, 0.07}  | 1.5   | 0.55  | 10      | 0.35  |
| Purpleheart | {0.20, 0.06, 0.22}   | {0.08, 0.015, 0.09}   | {5, 5, 0.015} | 1.5   | 0.45  | 8       | 0.3   |
| Ebony       | {0.02, 0.018, 0.018} | {0.015, 0.012, 0.012} | {3, 3, 0.01}  | 20.0  | 0.5   | 12      | 0.1   |
| Maple       | {0.75, 0.65, 0.50}   | {0.40, 0.28, 0.15}    | {5, 7, 0.06}  | 0.8   | 0.5   | 10      | 0.2   |
| Walnut      | {0.22, 0.14, 0.08}   | {0.10, 0.06, 0.035}   | {6, 8, 0.07}  | 1.0   | 0.6   | 10      | 0.35  |
| Zebrawood   | {0.55, 0.38, 0.12}   | {0.05, 0.025, 0.005}  | {8, 12, 0.1}  | 0.6   | 0.35  | 6       | 0.5   |

### Coating (Warm-Tinted Lacquer)

| Species     | Coating RGB        | Coat Rough | Bump Height |
| ----------- | ------------------ | ---------- | ----------- |
| Red Oak     | {0.45, 0.3, 0.3}   | 0.005      | 0.04        |
| White Oak   | {0.45, 0.3, 0.3}   | 0.005      | 0.03        |
| Purpleheart | {0.4, 0.25, 0.25}  | 0.003      | 0.008       |
| Ebony       | {0.25, 0.15, 0.15} | 0.003      | 0.003       |
| Maple       | {0.4, 0.25, 0.25}  | 0.003      | 0.02        |
| Walnut      | {0.45, 0.3, 0.3}   | 0.005      | 0.025       |
| Zebrawood   | {0.45, 0.3, 0.3}   | 0.008      | 0.03        |

### Marble (Bump Only)

High Z-scale for grain direction.

| Species     | Scale X,Y,Z    |
| ----------- | -------------- |
| Red Oak     | {3, 3, 30}     |
| White Oak   | {2, 2, 35}     |
| Purpleheart | {1.5, 1.5, 40} |
| Ebony       | {1, 1, 45}     |
| Maple       | {1.5, 1.5, 35} |
| Walnut      | {2.5, 2.5, 30} |
| Zebrawood   | {4, 4, 20}     |

### Roughness-by-Grain

| Species     | Rough Min (light grain) | Rough Max (dark grain) |
| ----------- | ----------------------- | ---------------------- |
| Red Oak     | 0.25                    | 0.45                   |
| White Oak   | 0.20                    | 0.38                   |
| Purpleheart | 0.08                    | 0.15                   |
| Maple       | 0.06                    | 0.14                   |
| Walnut      | 0.15                    | 0.32                   |
| Zebrawood   | 0.20                    | 0.45                   |

---

## Critical Lessons

- **Marble Z-scale must be 20-45** (not 0.015-0.04!) — sine band frequency along grain
- **Coating colors must be WARM-TINTED** `{0.45, 0.3, 0.3}` not neutral `{0.3, 0.3, 0.3}`
- **Coating roughness 0.003-0.008** (not 0.02-0.04) — lower = shinier = realistic lacquer
- **Purpleheart colors are DEEP** — {0.2, 0.06, 0.22} not {0.45, 0.18, 0.5}
- **Zebrawood colors need contrast** — light {0.55, 0.38, 0.12} dark {0.05, 0.025, 0.005}
- **Turbulence X/Y must be ASYMMETRIC** — e.g., {7,9} not {8,8}

## Advanced Techniques

**Falloff x Marble bump:** Shared Falloff map (normal=0, grazing=1, index=3) multiplied with Marble via Multiply texture, connected to bump. Gives bump=0 on top faces (flat), bump=1 on side/end faces (grain texture).

**Ebony special:** Gamma 20 crushes grain nearly flat. Coating {0.25, 0.15, 0.15}. Base roughness 0.25. Under dark studio env reads jet black. Under bright env coating reflection makes it gray — use darker env or lower coating.

**Turbulence offsets:** Each species needs dramatically different offsets (50+ apart per axis) to prevent identical noise patterns. E.g., {0,0,0}, {50,30,10}, {100,70,25}, {150,120,40}, {200,160,55}, {250,200,70}, {300,250,85}.

**Pine plank (base surface):** No coating (RGB 0,0,0), coating roughness 0.6, base roughness 0.5 (matte unfinished), bump height 0.3. Uses Marble for BOTH color mix and bump (not Turbulence). Colors: {0.68, 0.56, 0.4} / {0.58, 0.46, 0.32}.
