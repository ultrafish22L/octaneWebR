# SEGA User Guide — Research, Gemini Analysis, and How It Works

## Part 1: Research Foundations

### 1.1 What Is SEGA?

SEGA (Semantic Guidance) originates from Brack et al. (2023) — a technique for steering diffusion models by manipulating the latent space along named semantic directions. The key properties:

- **Monotonic**: Increasing a guidance value monotonically increases that quality
- **Isolated**: Changing one concept doesn't disturb others
- **Composable**: Multiple concepts combine without conflict
- **Reversible**: Negative guidance removes a concept

We adapt these principles from pixel generation to DCC parameter control. Instead of steering a diffusion process, we steer Octane's lighting, materials, and camera through a semantic vector.

### 1.2 Academic Sources

| Source                                                                         | What It Provides                                                                                    | How We Use It                                              |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Mehrabian & Russell (1974)** — PAD model                                     | Pleasure, Arousal, Dominance as core emotional dimensions                                           | 3 foundational dimensions for emotional intent             |
| **Berlyne (1971)** — Aesthetics and Psychobiology                              | Inverted-U relationship between complexity/arousal and aesthetic pleasure                           | Extreme value warnings                                     |
| **CineTechBench (Wu et al. 2025)** — arXiv:2505.15145                          | 7 cinematographic dimensions with structured sub-categories, built by professional cinematographers | Shot scale, angle, lighting style, color scheme vocabulary |
| **Itten (1961)** — The Art of Color                                            | Warm/cool, complementary tension, saturation as compositional tools                                 | Color-related dimensions                                   |
| **ASC Manual** — American Society of Cinematographers                          | Key:fill ratios, color temperature standards, shadow quality metrics                                | Parameter mapping ranges for lighting dimensions           |
| **Brack et al. (2023)** — SEGA paper                                           | Monotonic, isolated, composable semantic guidance                                                   | Core architectural principle                               |
| **DARCI (BYU)** — Digital Artist Communicating Intention                       | AI self-evaluation against semantic intent (perceptual grounding)                                   | Critique loop: measure render against intent vector        |
| **3D Scene Graphs (Stanford)** — object-level semantics + relationship mapping | Structured scene representation with typed relationships                                            | Relationship edges between objects                         |

### 1.3 Industry Standards Used

- **Rembrandt, butterfly, split, loop lighting** — named lighting setups from portrait photography and film (ASC standard terminology)
- **Key:fill ratios** — measured in stops or numeric ratios (ASC Manual: 2:1 = natural, 4:1 = moderate drama, 8:1+ = noir)
- **Color temperature** — Kelvin scale (1800K candle → 5500K daylight → 10000K+ overcast sky)
- **Rule of thirds, golden ratio, diagonal** — composition grids from visual art tradition
- **Shot scale taxonomy** — extreme close-up through extreme wide shot (CineTechBench, industry standard)

---

## Part 2: Gemini Analysis — What We Adopted, Skipped, Deferred

Gemini suggested 6 capabilities for AI driving a DCC with semantic models. Here's what we did with each:

### Adopted

| Gemini Suggestion                                                            | Our Implementation                                                                              |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **3D Scene Graph with object-level semantics**                               | Relationship edges: `sits_on`, `illuminates`, `behind` etc. between typed objects               |
| **Relationship mapping** ("chair in front of desk")                          | Structural relationships auto-derived from roles + manually overridden                          |
| **Style as constraints** ("gloom" = series of parameter constraints)         | Dimension registry: each mood/style maps to parameter ranges via weighted mappings              |
| **Mood boarding** (user defines concept, AI maps to lighting/camera/texture) | Presets: named vectors (Vermeer, cyberpunk, product_clean) that set multiple dimensions at once |
| **Evaluation against semantic intent** (DARCI-style)                         | Semantic gap vector: measure where render sits in S-space, compute distance from target         |
| **Feedback loops** (adjust if scene doesn't match goal)                      | Convergence detection on gap magnitude, stagnation warning, Berlyne extreme-value warning       |

### Skipped

| Gemini Suggestion                                                    | Why Skipped                                                                                                                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **SEGA latent space manipulation** (diffusion-specific)              | We don't have a diffusion model — we have a DCC with explicit parameters. We use the SEGA _principles_ (monotonic, composable) but not the latent-space mechanism. |
| **Style transfer from portfolio analysis**                           | Too complex for initial system. Would require analyzing multiple renders to extract a style vector. Deferred to Phase 5+.                                          |
| **Procedural generation rules** ("if city, add road, then building") | Out of scope — we're an art direction layer, not a scene generation system. The LLM handles procedural logic.                                                      |

### Deferred

| Gemini Suggestion                                      | Deferred To                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| **Visual sketch steering** (user draws, AI interprets) | Phase 5+ — requires sketch-to-intent pipeline                       |
| **Interactive co-creation via DCC API**                | Already have this (MCP tools). SEGA sits above it.                  |
| **Learning from user's portfolio**                     | Phase 5+ — requires multi-render analysis and user style extraction |

---

## Part 3: How a Human Uses the System

### 3.1 Starting a Scene

**What you say:**

> "I want to build a product shot of a gold sphere. Dramatic lighting, like Caravaggio."

**What happens inside:**

1. NL parser identifies: genre = `product_shot`, mood = `dramatic`, preset = `caravaggio`
2. System loads `caravaggio` preset: `{ warmth: 0.5, contrast: 0.8, key_direction: 0.4, intimacy: 0.3, atmosphere: 0.2 }`
3. System loads `product_shot` genre defaults: `{ shot_scale: -0.2, camera_angle: 0.0, groundedness: 0.6 }`
4. Merges them (preset wins on conflicts): active vector has ~8 dimensions set
5. Parameter mapping resolves: key temp 3000K, fill ratio 6:1, environment power 0.1, camera elevation 5 deg, etc.
6. System shows you the resolved intent + parameters before building anything

**What you see:**

```
Intent: Caravaggio product shot
Active dimensions: warmth=0.5, contrast=0.8, key_direction=0.4,
                   intimacy=0.3, atmosphere=0.2, groundedness=0.6
                   shot_scale=-0.2, camera_angle=0.0

Resolved parameters:
  Key light: 3000K, power 180, 40deg from camera axis
  Fill: power 30 (ratio 6:1)
  Environment: 0.1 power
  Camera: 12 units back, 5deg elevation, 72deg FOV

Proceed with build?
```

### 3.2 Adjusting During Build

**What you say:**

> "Warmer. And less contrast, it's too harsh."

**What happens inside:**

1. NL parser returns: `{ warmth: +0.15, contrast: -0.25 }` (relative deltas)
2. System applies deltas: warmth 0.5 → 0.65, contrast 0.8 → 0.55
3. Parameter mapping re-resolves: key temp shifts from 3000K → 2900K, fill ratio drops from 6:1 → 4:1
4. System applies only the changed parameters to the scene (delta application, not full rebuild)

**What you see:**

```
Adjusted: warmth 0.5→0.65, contrast 0.8→0.55
Changed: key_temp 3000K→2900K, fill_ratio 6:1→4:1
[Re-render in progress...]
```

### 3.3 Using Presets

**What you say:**

> "Try Blade Runner on this."

**What happens inside:**

1. Preset lookup: `blade_runner` → `{ warmth: -0.3, contrast: 0.7, saturation: 0.6, atmosphere: 0.5, arousal: 0.6 }`
2. System shows the delta from current vector to proposed vector
3. On confirmation, applies the delta

**What you see:**

```
Preset "blade_runner" would change:
  warmth:     0.65 → -0.3  (large shift to cool)
  contrast:   0.55 →  0.7  (more dramatic)
  saturation: 0.0  →  0.6  (vivid colors)
  atmosphere: 0.2  →  0.5  (more haze)
  arousal:    0.0  →  0.6  (more intense)

Apply? Or blend 50/50 with current?
```

### 3.4 After Rendering — Critique

**What you say:**

> "How's it looking?"

**What happens inside:**

1. System saves current render
2. Pixel analyzer measures: contrast ratio = 4.8 (maps to contrast ~0.65), color temp = 3100K (maps to warmth ~0.55), chroma = moderate (saturation ~0.3)
3. VLM critic estimates: arousal ~0.5, atmosphere ~0.3, pleasure ~0.6
4. Calibration adjusts VLM estimates based on pixel ground truth
5. System computes gap vector: target vs measured

**What you see:**

```
Semantic gap analysis:
  warmth:     target -0.30, measured -0.25  (gap: 0.05 — close)
  contrast:   target  0.70, measured  0.65  (gap: 0.05 — close)
  saturation: target  0.60, measured  0.30  (gap: 0.30 — FIX: increase material saturation)
  atmosphere: target  0.50, measured  0.30  (gap: 0.20 — FIX: add fog or reduce environment clarity)
  arousal:    target  0.60, measured  0.50  (gap: 0.10 — acceptable)

Overall gap: 0.38 (threshold: 0.15)
Priority: saturation (+0.30), atmosphere (+0.20)
```

### 3.5 Per-Object Override

**What you say:**

> "The hero sphere should be more textured than everything else."

**What happens inside:**

1. NL parser identifies: object = "hero sphere", dimension = `surface_detail`, direction = positive
2. System creates per-object override: `hero → { surface_detail: 0.7 }` (global is 0.0)
3. Parameter mapping for hero's material: roughness variation increases, bump strength increases
4. Other objects keep global value

**What you see:**

```
Override: hero sphere surface_detail = 0.7 (global: 0.0)
Changed hero material: roughness_variation 0.0→0.15, bump_strength 0.0→0.4
```

### 3.6 Saving Your Own Preset

**What you say:**

> "Save this look as 'my_moody_gold'."

**What happens inside:**

1. System snapshots current semantic vector (global + overrides)
2. Saves as user preset with category "user"
3. Available in future sessions via name or tags

**What you see:**

```
Saved preset "my_moody_gold" (user):
  warmth=-0.30, contrast=0.70, saturation=0.60, atmosphere=0.50, arousal=0.60
  Override: hero → surface_detail=0.70
```

### 3.7 Berlyne Warning

**What you say:**

> "Crank the contrast to maximum."

**What happens inside:**

1. NL parser: `{ contrast: 1.0 }` (absolute)
2. Berlyne check: |1.0| > 0.85 threshold

**What you see:**

```
WARNING: contrast = 1.00 — extreme values often reduce aesthetic appeal
(Berlyne inverted-U). Most professional work sits in 0.5–0.8 range.
Intentional? [Proceed / Reduce to 0.8]
```

### 3.8 Undo

**What you say:**

> "Go back, that was better before."

**What happens inside:**

1. System pops undo stack — reverts to previous semantic vector
2. Re-resolves parameters from restored vector
3. Applies parameter deltas to scene

**What you see:**

```
Reverted to previous state:
  contrast: 1.00 → 0.70
  Changed: fill_ratio 10:1 → 5:1, environment_power 0.02 → 0.1
```

---

## Part 4: What Stays the Same

The SEGA system **does not replace**:

| Existing System                                      | Still Does                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `plan_composition`                                   | Spatial layout: object positions, depth layers, camera placement       |
| `validate_layout`                                    | Geometric checks: frustum, proximity, depth separation, grid alignment |
| `suggest_lighting`                                   | Gets called BY the mapping engine with SEGA-derived parameters         |
| `suggest_material`                                   | Gets called BY the mapping engine with SEGA-derived parameters         |
| Spatial math (`projectToScreen`, vector ops)         | Unchanged — spatial correctness is a separate concern                  |
| Scene building (create_node, connect, set_attribute) | Unchanged — SEGA produces parameter values, existing tools apply them  |

**SEGA replaces:**

- The old 1-5 score critique system → semantic gap vector
- Ad-hoc "mood" strings → structured dimension vectors
- LLM guessing parameter values → mapping engine computing them from intent
