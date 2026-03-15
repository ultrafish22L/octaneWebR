# V5 Scene Dump — woodchips_demo_v5_mirror_ends.orbx

Complete node settings dump for scene comparison.

---

## Camera (Thin Lens — handle 1001012)

| Property | Value |
|----------|-------|
| Position | (0.3, 3.5, 7.5) |
| Target | (0, 0, -0.3) |
| Up | (0, 0, 0) |
| FOV | 39.6 deg |
| Focal Length | 50.0 mm |
| Sensor Width | 36 mm |
| Aperture | 0.893 (effectively ~f/0.9 — DOF enabled) |

---

## Environment

### Texture Environment (handle 1000953) — connected to RT env + cameraEnv
- **Texture**: Mix texture (1001011) — env color mix
- **Power**: 2.0 (handle 1001020)
- Connected to both `environment` and `cameraEnvironment` pins on RT

### Env Mix Texture (handle 1001011)
- **Type**: NT_TEX_MIX
- **Amount**: Turbulence texture (1001010) — env turbulence
- **Texture1** (RGB 1001008): (0.02, 0.04, 0.15) — dark blue
- **Texture2** (RGB 1001009): (0.005, 0.015, 0.06) — deeper blue

### Env Turbulence (handle 1001010)
- **Scale**: (1, 1, 1)
- **Gamma**: 1.5
- **Power**: 1.0
- **Omega**: 0.5
- **Octaves**: (not queried, default)

### Daylight Env 1 (handle 1000935) — NOT connected to RT
### Daylight Env 2 (handle 1000978) — NOT connected to RT

---

## Render Target (handle 1000922)

| Pin | Connected |
|-----|-----------|
| camera | Thin lens camera (1001012) |
| environment | Texture environment (1000953) |
| cameraEnvironment | Texture environment (1000953) |
| mesh | Geometry group (1000924) |
| kernel | Direct lighting kernel (1001014) |

---

## Geometry Group (handle 1000924) — 9 inputs

| Slot | Handle | Material | Species ID |
|------|--------|----------|------------|
| Input 1 | 1000760 | Universal 1000926 | **Pine Plank** (base plank) |
| Input 2 | 1000927 | Universal 1000939 | **Red Oak** |
| Input 3 | 1000931 | Universal 1000941 | **White Oak** |
| Input 4 | 1000749 | Universal 1000942 | **Purpleheart** |
| Input 5 | 1000928 | Universal 1000822 | **Ebony** |
| Input 6 | 1000933 | Universal 1000943 | **Maple** |
| Input 7 | 1000936 | Universal 1000945 | **Walnut** |
| Input 8 | 1000762 | Universal 1000948 | **Zebrawood** |
| Input 9 | 1000837 | Diffuse 1000970 | **Light Panel** (overhead) |

*Note: Geo 1001002 (Diffuse 1000972) exists but is NOT connected to geo group (second light panel / backdrop)*

---

## Geometry Transforms

All primitives are **Box** (type 1).

### Pine Plank (1000760) — base surface
| Property | Value |
|----------|-------|
| Translation | (0, 0, 0) |
| Scale | (6, 0.12, 1.8) |
| Rotation | (0, 0, 0) |

### Wood Chip Samples (all same scale: 0.5 x 0.15 x 0.8)

| Species | Handle | Translation | Rotation Y | X Position |
|---------|--------|-------------|-----------|------------|
| Red Oak | 1000927 | (-2.4, 0.195, 0) | 3 deg | leftmost |
| White Oak | 1000931 | (-1.6, 0.195, 0) | -5 deg | |
| Purpleheart | 1000749 | (-0.8, 0.195, 0) | 7 deg | |
| Ebony | 1000928 | (0, 0.195, 0) | -2 deg | center |
| Maple | 1000933 | (0.8, 0.195, 0) | 4 deg | |
| Walnut | 1000936 | (1.6, 0.195, 0) | -3 deg | |
| Zebrawood | 1000762 | (2.4, 0.195, 0) | 6 deg | rightmost |

### Light Panel (1000837) — overhead area light
| Property | Value |
|----------|-------|
| Translation | (-3, 5, 3) |
| Scale | (3, 0.01, 3) — thin flat panel |
| Rotation | (-45, 30, 0) |

### Backdrop Panel (1001002) — NOT in geo group
| Property | Value |
|----------|-------|
| Translation | (3, 3, 6) |
| Scale | (2, 0.01, 2) |
| Rotation | (-35, -20, 0) |

---

## Black Body Emissions

### Light Panel Emission (handle 1000962) — on Diffuse 1000970
| Property | Value |
|----------|-------|
| Power | 350 |
| Temperature | 4000 K |
| Surface Brightness | false |
| Illumination | true |

### Backdrop Emission (handle 1001003) — on Diffuse 1000972
| Property | Value |
|----------|-------|
| Power | 30 |
| Temperature | 5500 K |
| Surface Brightness | false |
| Illumination | true |

### Diffuse Material Colors
- Light Panel (1000970) diffuse: (0.7, 0.7, 0.7) — neutral gray
- Backdrop (1000972) diffuse: (0.7, 0.7, 0.7) — neutral gray

---

## Shared Bump Pipeline

All 7 wood chip materials use: **Multiply texture (Falloff map x Marble texture)** for bump.

### Falloff Map (handle 1000982) — shared by ALL multiply textures
| Property | Value |
|----------|-------|
| Normal | 0 |
| Grazing | 1 |
| Falloff Index | 3 |
| Mode | (default — normal vs grazing) |

This gives bump=0 on faces pointing toward camera (top faces), bump=1 on side/end faces.

### Multiply Texture Assignments (Falloff x Marble)
| Material | Multiply Handle | Marble Handle |
|----------|----------------|---------------|
| Pine Plank (1000926) | — | Marble 1000934 (direct, no multiply) |
| Red Oak (1000939) | 1000983 | Marble 1000950 |
| White Oak (1000941) | 1000984 | Marble 1000947 |
| Purpleheart (1000942) | 1000938 | Marble 1000930 |
| Ebony (1000822) | 1000985 | Marble 1000952 |
| Maple (1000943) | 1000986 | Marble 1000769 |
| Walnut (1000945) | 1000987 | Marble 1000955 |
| Zebrawood (1000948) | 1000988 | Marble 1000949 |

*Note: Pine plank uses marble directly on bump (no falloff multiply).*

---

## Universal Materials — Summary Table

| Species | Handle | Coating RGB | Coat Rough | Roughness | Bump Height | Anisotropy |
|---------|--------|------------|------------|-----------|-------------|------------|
| Pine Plank | 1000926 | (0, 0, 0) — none | 0.6 | 0.5 (flat) | 0.3 | 0 |
| Red Oak | 1000939 | (0.45, 0.3, 0.3) | 0.005 | Mix tex | 0.04 | 0.4 |
| White Oak | 1000941 | (0.45, 0.3, 0.3) | 0.005 | Mix tex | 0.03 | 0.35 |
| Purpleheart | 1000942 | (0.4, 0.25, 0.25) | 0.003 | Mix tex | 0.008 | 0.3 |
| Ebony | 1000822 | (0.25, 0.15, 0.15) | 0.003 | 0.25 (flat) | 0.003 | 0.1 |
| Maple | 1000943 | (0.4, 0.25, 0.25) | 0.003 | Mix tex | 0.02 | 0.2 |
| Walnut | 1000945 | (0.45, 0.3, 0.3) | 0.005 | Mix tex | 0.025 | 0.35 |
| Zebrawood | 1000948 | (0.45, 0.3, 0.3) | 0.008 | Mix tex | 0.03 | 0.5 |

---

## Albedo Mix Textures (Turbulence-driven color)

Each material's albedo = Mix(Turbulence, Color1, Color2)

| Species | Mix Handle | Turbulence | Color1 (light grain) | Color2 (dark grain) |
|---------|-----------|------------|---------------------|---------------------|
| Pine Plank | 1000957 | Marble 1000934 | (0.68, 0.56, 0.4) | (0.58, 0.46, 0.32) |
| Red Oak | 1000925 | Turb 1000979 | (0.48, 0.3, 0.2) | (0.3, 0.17, 0.1) |
| White Oak | 1000958 | Turb 1000775 | (0.42, 0.33, 0.22) | (0.28, 0.2, 0.13) |
| Purpleheart | 1000959 | Turb 1000980 | (0.2, 0.06, 0.22) | (0.08, 0.015, 0.09) |
| Ebony | 1000946 | Turb 1000956 | (0.02, 0.018, 0.018) | (0.015, 0.012, 0.012) |
| Maple | 1000944 | Turb 1000923 | (0.75, 0.65, 0.5) | (0.4, 0.28, 0.15) |
| Walnut | 1000961 | Turb 1000975 | (0.22, 0.14, 0.08) | (0.1, 0.06, 0.035) |
| Zebrawood | 1000963 | Turb 1000981 | (0.55, 0.38, 0.12) | (0.05, 0.025, 0.005) |

*Note: Pine plank uses Marble (not Turbulence) as its mix amount — gives sine-wave wood grain pattern.*

---

## Turbulence Textures — Parameters

| Turbulence | For Species | Scale (X, Y, Z) | Gamma | Octaves | Power | Omega |
|------------|------------|-----------------|-------|---------|-------|-------|
| 1000923 | Maple | (5, 7, 0.06) | 0.8 | 10 | 1.0 | 0.5 |
| 1000956 | Ebony | (3, 3, 0.01) | 20.0 | 12 | 1.0 | 0.5 |
| 1000975 | Walnut | (6, 8, 0.07) | 1.0 | (default) | 1.0 | 0.6 |
| 1000979 | Red Oak | (7, 9, 0.08) | 1.2 | (default) | 1.0 | 0.6 |
| 1000775 | White Oak | (5, 7, 0.07) | 1.5 | (default) | 1.0 | 0.55 |
| 1000980 | Purpleheart | (5, 5, 0.015) | 1.5 | (default) | 1.0 | 0.45 |
| 1000981 | Zebrawood | (8, 12, 0.1) | 0.6 | (default) | 1.0 | 0.35 |
| 1001010 | Env | (1, 1, 1) | 1.5 | (default) | 1.0 | 0.5 |

**Key patterns:**
- Z-scale 0.01-0.1 = flat grain on ends (Z is along the chip length)
- X/Y asymmetric = breaks up perfectly straight grain
- Ebony gamma=20 flattens contrast (near-black uniform)
- Zebrawood X=8,Y=12 = widest stripes

---

## Marble Textures — Parameters (for bump)

| Marble | For Material | Scale (X, Y, Z) | Power | Omega | Variance |
|--------|-------------|-----------------|-------|-------|----------|
| 1000934 | Pine Plank (albedo + bump) | (0.06, 0.5, 0.5) | 0.6 | 0.4 | 0.5 |
| 1000930 | Purpleheart (bump via multiply) | (1.5, 1.5, 40) | 2.0 | 0.25 | 0.6 |
| 1000947 | White Oak (bump via multiply) | (2, 2, 35) | 2.5 | 0.3 | 0.8 |
| 1000949 | Zebrawood (bump via multiply) | (4, 4, 20) | 3.0 | 0.35 | 1.5 |
| 1000950 | Red Oak (bump via multiply) | (3, 3, 30) | 3.0 | 0.3 | 1.0 |
| 1000952 | Ebony (bump via multiply) | (1, 1, 45) | 0.1 | 0.5 | 0.4 |
| 1000769 | Maple (bump via multiply) | (1.5, 1.5, 35) | 1.5 | 0.5 | 0.5 |
| 1000955 | Walnut (bump via multiply) | (2.5, 2.5, 30) | 2.5 | 0.6 | 1.0 |

**Key patterns:**
- Z-scale 20-45 = high frequency along grain direction (sine bands for wood lines)
- X/Y scale 1-4 = cross-grain variation
- Pine plank marble has inverted scale: Z=0.5 (gentle), X=0.06 (tight across grain)
- Ebony power=0.1 = barely visible bump (polished surface)

---

## Roughness Mix Textures (grain-dependent roughness)

Materials with Mix texture roughness = open-pore species with roughness varying by grain.

| Species | Mix Handle | Turbulence | Roughness1 (light) | Roughness2 (dark) |
|---------|-----------|------------|--------------------|--------------------|
| Red Oak | 1000990 | 1000979 | 0.25 | 0.45 |
| White Oak | 1000994 | 1000775 | 0.20 | 0.38 |
| Purpleheart | 1001005 | 1000980 | 0.08 | 0.15 |
| Maple | 1001007 | 1000923 | 0.06 | 0.14 |
| Walnut | 1001000 | 1000975 | 0.15 | 0.32 |
| Zebrawood | 1000997 | 1000981 | 0.20 | 0.45 |

**Flat roughness species:**
- Pine Plank: 0.5 (matte, no coating)
- Ebony: 0.25 (smooth, high polish)

---

## Scene Hierarchy Summary

```
Render Target (1000922)
  +-- Thin Lens Camera (1001012)
  +-- Texture Environment (1000953)
  |     +-- Mix Texture (1001011) [env color]
  |           +-- Turbulence (1001010)
  |           +-- RGB (0.02, 0.04, 0.15)
  |           +-- RGB (0.005, 0.015, 0.06)
  +-- Geometry Group (1000924)
        +-- [0] Pine Plank (1000760)
        |     +-- Universal Mat (1000926)
        |           +-- albedo: Mix(Marble 1000934, RGB, RGB)
        |           +-- bump: Marble 1000934
        |           +-- roughness: 0.5 (flat)
        +-- [1] Red Oak (1000927)
        |     +-- Universal Mat (1000939)
        |           +-- albedo: Mix(Turb 1000979, RGB, RGB)
        |           +-- bump: Multiply(Falloff, Marble 1000950)
        |           +-- roughness: Mix(Turb 1000979, 0.25, 0.45)
        +-- [2] White Oak (1000931)
        |     +-- Universal Mat (1000941)
        |           +-- albedo: Mix(Turb 1000775, RGB, RGB)
        |           +-- bump: Multiply(Falloff, Marble 1000947)
        |           +-- roughness: Mix(Turb 1000775, 0.20, 0.38)
        +-- [3] Purpleheart (1000749)
        |     +-- Universal Mat (1000942)
        |           +-- albedo: Mix(Turb 1000980, RGB, RGB)
        |           +-- bump: Multiply(Falloff, Marble 1000930)
        |           +-- roughness: Mix(Turb 1000980, 0.08, 0.15)
        +-- [4] Ebony (1000928)
        |     +-- Universal Mat (1000822)
        |           +-- albedo: Mix(Turb 1000956, RGB, RGB)
        |           +-- bump: Multiply(Falloff, Marble 1000952)
        |           +-- roughness: 0.25 (flat)
        +-- [5] Maple (1000933)
        |     +-- Universal Mat (1000943)
        |           +-- albedo: Mix(Turb 1000923, RGB, RGB)
        |           +-- bump: Multiply(Falloff, Marble 1000769)
        |           +-- roughness: Mix(Turb 1000923, 0.06, 0.14)
        +-- [6] Walnut (1000936)
        |     +-- Universal Mat (1000945)
        |           +-- albedo: Mix(Turb 1000975, RGB, RGB)
        |           +-- bump: Multiply(Falloff, Marble 1000955)
        |           +-- roughness: Mix(Turb 1000975, 0.15, 0.32)
        +-- [7] Zebrawood (1000762)
        |     +-- Universal Mat (1000948)
        |           +-- albedo: Mix(Turb 1000981, RGB, RGB)
        |           +-- bump: Multiply(Falloff, Marble 1000949)
        |           +-- roughness: Mix(Turb 1000981, 0.20, 0.45)
        +-- [8] Light Panel (1000837)
              +-- Diffuse Mat (1000970)
                    +-- diffuse: (0.7, 0.7, 0.7)
                    +-- emission: BB 350W @ 4000K, illumination ON
```

---

## Handle Cross-Reference

### Geo -> Material -> Albedo Turbulence -> Bump Marble
| Geo | Mat | Turb (color) | Marble (bump) |
|-----|-----|-------------|---------------|
| 1000760 | 1000926 | Marble 1000934* | 1000934 |
| 1000927 | 1000939 | 1000979 | 1000950 |
| 1000931 | 1000941 | 1000775 | 1000947 |
| 1000749 | 1000942 | 1000980 | 1000930 |
| 1000928 | 1000822 | 1000956 | 1000952 |
| 1000933 | 1000943 | 1000923 | 1000769 |
| 1000936 | 1000945 | 1000975 | 1000955 |
| 1000762 | 1000948 | 1000981 | 1000949 |

*Pine plank uses marble for both color mix and bump (not turbulence for color)
