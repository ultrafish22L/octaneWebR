# Wood Chips Display

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

> **Before building:** Read `CLAUDE.md` (Current Session + MCP Rules) and `docs/mcp/REFERENCE.md`. Don't improvise what's already documented. Don't improvise what's already documented.

## The Vision

Seven species of exotic hardwood, each a small block sitting on a pine plank — a luthier's sample board, a woodworker's palette. Red oak, white oak, purpleheart, ebony, maple, walnut, zebrawood. Each one tells you what it is by how it catches light.

The blocks are sanded smooth, finished with lacquer. They shouldn't look CG — they should look like you could reach in and pick one up. The lacquer coating gives each block a warm amber reflection. The grain is subtle, not stamped on — real wood has gentle color variation, not high-contrast stripes.

Behind the plank, a soft backdrop (glen landscape, studio gradient, or AI-generated scene). The lighting is studio — a large overhead panel light (warm, 4000K) with a neutral gray environment for fill. Not dramatic, not flat. Product photography.

**Composition**: Seven blocks in a row, evenly spaced, on a flat pine plank. Camera slightly above, looking down at ~25-30° elevation. All blocks visible, none clipped. The plank extends beyond the blocks on both sides — breathing room.

**Materials**: Every species is procedural. Turbulence drives the color mix (light grain vs dark grain). Marble drives the bump (surface relief along grain direction). The key to realism is: high turbulence gamma (soft color blending, not harsh stripes), moderate marble Z-scale (visible grain bump but not carved), warm-tinted coating (amber lacquer, not neutral gray), and low coating roughness (wet polish, not sanded matte).

**The trap**: It's easy to make these look like painted concrete blocks or CNC-carved wood. The difference is subtlety. Real sanded wood has gentle variation. Gamma > 2 on turbulence, bump height < 0.02, coating roughness < 0.01.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting  | Value                                                  |
| -------- | ------------------------------------------------------ |
| Position | {0, 4.2, 7.5}                                          |
| Target   | {0, 0, 0}                                              |
| DOF      | OFF (aperture = 0) — sharp focus across all blocks     |
| Angle    | ~29° elevation, slightly above looking down            |
| Framing  | All 7 blocks visible with breathing room on both sides |

### Environment

| Setting     | Value                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| Type        | Texture environment, neutral gray {0.3, 0.3, 0.3}                                                          |
| Power       | 0.5                                                                                                        |
| Panel light | Large box (30 x 20 x 0.01) at {0, 2, -5}, blackbody 350 power, 4000K, surface brightness ON                |
| Backdrop    | Optional: glen backdrop plane behind scene, emissive with AI-generated landscape texture, illumination OFF |

### Objects

**Plank (pine)**

- Box: 5 x 0.15 x 2, position {0, -0.075, 0} (top surface at Y=0)
- Diffuse material, Turbulence color mix

**Seven blocks**

- Box: 0.5 x 0.15 x 0.8 each
- Spaced 0.7 apart along X, centered at X=0
- Y position = 0.075 (sitting on plank)
- Y-rotation jitter per block: 3°, -5°, 7°, 0°, -2°, 4°, -3°
- X-position jitter: ±0.03-0.05 — they shouldn't look machine-placed

### Species Materials

All blocks use Universal material with GGX BRDF. Albedo = Mix texture (Turbulence drives mix between light and dark grain colors). Bump = Marble texture. Coating = warm-tinted lacquer.

**Red Oak** (reference material — other species follow the same pattern):
Albedo light {0.48, 0.3, 0.2} / dark {0.3, 0.17, 0.1}. Specular 0.2. Coating color {0.45, 0.3, 0.3}, coating roughness 0.005, coating amount 0.3. Anisotropy 0.4, roughness 0.063.

### Albedo Colors (Turbulence Mix)

| Species      | Light grain          | Dark grain            |
| ------------ | -------------------- | --------------------- |
| Plank (pine) | {0.72, 0.58, 0.38}   | {0.5, 0.35, 0.2}      |
| Red Oak      | {0.48, 0.3, 0.2}     | {0.3, 0.17, 0.1}      |
| White Oak    | {0.42, 0.33, 0.22}   | {0.28, 0.2, 0.13}     |
| Purpleheart  | {0.45, 0.18, 0.5}    | {0.25, 0.08, 0.3}     |
| Ebony        | {0.02, 0.018, 0.018} | {0.015, 0.012, 0.012} |
| Maple        | {0.75, 0.65, 0.5}    | {0.4, 0.28, 0.15}     |
| Walnut       | {0.22, 0.14, 0.08}   | {0.1, 0.06, 0.035}    |
| Zebrawood    | {0.85, 0.72, 0.45}   | {0.22, 0.12, 0.05}    |

### Turbulence (Color Grain)

Higher gamma = softer grain transitions. Don't go below 2.0 or it looks stamped on.

| Species     | Scale X,Y,Z    | Gamma | Omega |
| ----------- | -------------- | ----- | ----- |
| Plank       | {8, 8, 0.03}   | 3.5   | 0.5   |
| Red Oak     | {8, 9, 0.03}   | 4.0   | 0.5   |
| White Oak   | {6, 7, 0.025}  | 3.5   | 0.5   |
| Purpleheart | {5, 6, 0.02}   | 3.5   | 0.5   |
| Ebony       | {3, 4, 0.015}  | 20.0  | 0.5   |
| Maple       | {6, 7, 0.025}  | 3.0   | 0.5   |
| Walnut      | {7, 8, 0.025}  | 4.0   | 0.5   |
| Zebrawood   | {10, 12, 0.04} | 2.0   | 0.5   |

### Marble (Bump Grain)

Z-scale controls grain line frequency. Keep moderate — too high = CNC carved, too low = smooth plastic.

| Species     | Scale X,Y,Z    | Bump Height | Specular |
| ----------- | -------------- | ----------- | -------- |
| Red Oak     | {3, 3, 14}     | 0.01        | 0.2      |
| White Oak   | {2.5, 2.5, 11} | 0.01        | 0.2      |
| Purpleheart | {4, 4, 7}      | 0.01        | 0.2      |
| Ebony       | {1, 1, 2.5}    | 0.001       | 0.5      |
| Maple       | {1.5, 1.5, 6}  | 0.01        | 0.2      |
| Walnut      | {2, 2, 16}     | 0.01        | 0.2      |
| Zebrawood   | {1.5, 1.5, 28} | 0.01        | 0.2      |

### Coating (Lacquer)

Warm-tinted, not neutral gray. Low roughness = wet polish.

| Species     | Amount | Color              | Roughness | BRDF | Aniso |
| ----------- | ------ | ------------------ | --------- | ---- | ----- |
| Red Oak     | 0.3    | {0.45, 0.3, 0.3}   | 0.005     | GGX  | 0.4   |
| White Oak   | 0.3    | {0.4, 0.28, 0.28}  | 0.005     | GGX  | 0.35  |
| Purpleheart | 0.25   | {0.35, 0.25, 0.25} | 0.003     | GGX  | 0.3   |
| Ebony       | 0.45   | {0.35, 0.25, 0.25} | 0.001     | GGX  | 0.1   |
| Maple       | 0.25   | {0.35, 0.25, 0.25} | 0.005     | GGX  | 0.2   |
| Walnut      | 0.3    | {0.4, 0.28, 0.28}  | 0.008     | GGX  | 0.35  |
| Zebrawood   | 0.3    | {0.4, 0.28, 0.28}  | 0.006     | GGX  | 0.5   |

### Render

- Path Tracing kernel
- Connect kernel before starting render

---

## Critical Lessons (earned the hard way)

1. **Turbulence for color, Marble for bump.** Never use Marble for color mix — it creates plywood stripes. Turbulence gives organic color variation, Marble gives directional grain relief.

2. **Gamma > 2.0 on Turbulence.** Below 2.0, the color grain looks like it was printed by a laser. Real wood grain transitions are soft.

3. **Marble Z-scale sweet spot: 2-28.** Z=0.03 = smooth plastic. Z=45 = CNC carved. The right range depends on species: ebony ~2, zebrawood ~28.

4. **Warm coating color, not neutral.** Real lacquer has an amber tint. Use {0.35-0.45, 0.25-0.3, 0.25-0.3}, not {0.3, 0.3, 0.3}.

5. **Coating roughness < 0.01.** Wet lacquer finish. Above 0.01 looks like the block was sanded but not polished.

6. **Bump height ~0.01, specular ~0.2.** High specular + bump creates white hotspots on end grain (Marble bumps all faces equally). Keep specular low (0.2) so the coating layer does most of the sheen work. You get visible grain texture on top/side faces without harsh end grain artifacts.

7. **Block proportions matter.** 0.5 x 0.15 x 0.8 reads as real wood samples. Default cubes scream CG. Add Y-rotation jitter (3-7°) and X-position jitter (±0.03-0.05) to break the array.

## Scene Files

| Version | File                               | Notes                                                          |
| ------- | ---------------------------------- | -------------------------------------------------------------- |
| v5      | woodchips_demo_v5_mirror_ends.orbx | 100 nodes, full-featured (roughness-by-grain, falloff bump)    |
| v6      | woodchips_demo_v6_rebuild.orbx     | 64 nodes, clean rebuild post-crash                             |
| v7      | woodchips_demo_v7_hybrid.orbx      | v6 + v5 material values (too aggressive)                       |
| v8      | woodchips_demo_v8_tuned.orbx       | AA-tuned: reduced Z-scales, bump, increased gamma              |
| v9      | woodchips_demo_v9_punchup.orbx     | Flat blocks, rotation jitter, bump+no-spec, coating-only sheen |
