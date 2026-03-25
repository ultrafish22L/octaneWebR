# SEGA System Design — Semantic Artistic Guidance for Octane MCP

## 1. Overview

A semantic vector layer (S-space) between natural language and DCC tool commands. Uses SEGA principles: monotonic scaling, dimension isolation, arbitrary combination of aesthetic concepts.

**Problem**: Current system jumps from free text to parameter values in one step, relying on the LLM to remember all artistic associations. The semantic layer makes intent explicit, persistent, and measurable.

**Architecture**: 4 layers:

```
Natural Language  -->  Semantic Vector (S-space)  -->  Parameters  -->  DCC Commands
"moody and warm"      { warmth: 0.7, contrast: 0.6 }   key_temp: 3200K    set_attribute(...)
                                                         fill_ratio: 5:1
```

**Sits alongside** existing spatial math (frustum, depth, grid alignment) — no replacement, no overlap. SEGA decides **what values** to use. Existing validation checks **whether those values produce a good layout**.

---

## 2. Core Concepts

### 2.1 Semantic Vector (S-space)

A scene's artistic intent expressed as a vector of named dimensions, each in [-1, +1]:

```typescript
interface SemanticVector {
  [dimensionName: string]: number; // -1.0 to +1.0
}

// Example
const sceneIntent: SemanticVector = {
  warmth: 0.7, // warm color palette
  contrast: 0.6, // moderately dramatic
  arousal: 0.3, // slightly energized
  complexity: -0.4, // simplified, clean
};
```

Inactive (zero) dimensions are omitted — only 6-12 are typically active per scene.

### 2.2 SEGA Principles Applied

From Brack et al. (2023) "SEGA: Instructing Text-to-Image Models using Semantic Guidance":

| Principle      | In Diffusion Models                           | In Our System                                                        |
| -------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| **Monotonic**  | Guidance scale linearly steers generation     | Dimension value linearly maps to parameter range                     |
| **Isolation**  | One concept changes without disturbing others | Changing `warmth` doesn't affect `complexity` (unless correlated)    |
| **Composable** | Multiple concepts combine additively          | Multiple dimensions resolve simultaneously via weighted mapping      |
| **Reversible** | Negative guidance removes a concept           | Negative values invert the dimension (warm → cool, complex → simple) |

### 2.3 Dimension Sources

Dimensions come from established academic and industry standards:

| Source                 | Dimensions                                                                   | Citation                                    |
| ---------------------- | ---------------------------------------------------------------------------- | ------------------------------------------- |
| **PAD (Psychology)**   | Pleasure, Arousal, Dominance                                                 | Mehrabian & Russell 1974                    |
| **CineTechBench**      | Shot scale, angle, lighting style, color scheme, composition, movement, lens | Wu et al. 2025, arXiv:2505.15145            |
| **Itten Color Theory** | Warm/cool, complementary tension, saturation                                 | Itten "The Art of Color" 1961               |
| **ASC Manual**         | Key:fill ratio, color temperature, shadow quality                            | American Society of Cinematographers        |
| **CG Craft**           | Surface detail, grounding, atmospheric depth                                 | Production CG practice                      |
| **Berlyne Aesthetics** | Complexity, novelty, conflict, ambiguity                                     | Berlyne "Aesthetics and Psychobiology" 1971 |

---

## 3. Dimension Registry

Each dimension has: name, aliases (NL triggers), negative/positive labels, source, parameter mappings (with ranges and weights), and observed correlations. See `mcp/src/sega/registry.ts` for full definitions.

### 3.1 Seed Dimensions (15)

| #   | Name             | Source        | Negative (-1)          | Positive (+1)         | Key Parameters Affected                 |
| --- | ---------------- | ------------- | ---------------------- | --------------------- | --------------------------------------- |
| 1   | `pleasure`       | PAD           | Unpleasant, harsh      | Pleasant, beautiful   | Saturation, harmony, roughness          |
| 2   | `arousal`        | PAD           | Calm, serene           | Energized, intense    | Contrast, saturation, edge sharpness    |
| 3   | `dominance`      | PAD           | Intimate, enclosed     | Vast, powerful        | Camera distance, FOV, environment scale |
| 4   | `warmth`         | Itten         | Cool/blue bias         | Warm/amber bias       | Color temperature, environment tint     |
| 5   | `contrast`       | ASC           | Flat, even lighting    | Hard shadows, drama   | Key:fill ratio, environment power       |
| 6   | `complexity`     | Berlyne       | Minimal, clean         | Dense, detailed       | Object count, texture detail, pattern   |
| 7   | `atmosphere`     | CG Craft      | Clear, crisp           | Hazy, foggy, diffused | Fog density, environment scatter        |
| 8   | `surface_detail` | CG Craft      | Smooth, pristine       | Weathered, textured   | Roughness variation, bump strength      |
| 9   | `saturation`     | Itten         | Muted, desaturated     | Vivid, punchy         | Albedo saturation, environment color    |
| 10  | `shot_scale`     | CineTechBench | Extreme close-up       | Extreme wide          | Camera distance, FOV                    |
| 11  | `camera_angle`   | CineTechBench | Low angle (worm)       | High angle (bird)     | Camera elevation                        |
| 12  | `depth_spread`   | CG Craft      | Flat, compressed       | Deep, layered         | Depth layer separation, fog gradient    |
| 13  | `key_direction`  | ASC           | Front-lit              | Back/rim-lit          | Key light azimuth relative to camera    |
| 14  | `groundedness`   | CG Craft      | Floating, abstract     | Grounded, physical    | Contact shadows, floor texture, gravity |
| 15  | `intimacy`       | PAD/CineTech  | Distant, observational | Close, personal       | Camera distance, DOF, aperture          |

Registry is open — new dimensions can be added at any time. The system handles arbitrary dimension count.

---

## 4. Parameter Mapping Engine

### 4.1 Resolution Algorithm

When multiple active dimensions affect the same parameter:

```
final_value = base_value + SUM(dimension_value * mapping_weight * mapping_range_delta)
```

Weighted linear interpolation. Weights resolve conflicts — if `warmth` and `arousal` both affect color temperature, their weights determine relative influence.

### 4.2 Example: Key Light Temperature

```
Dimension: warmth = 0.7, weight 0.8, range [2800K, 7500K] (midpoint 5150K)
Dimension: arousal = 0.3, weight 0.2, range [3500K, 6500K] (midpoint 5000K)

warmth contribution:  0.7 * 0.8 * (7500-2800)/2 = 0.56 * 2350 = 1316K above midpoint
arousal contribution: 0.3 * 0.2 * (6500-3500)/2 = 0.06 * 1500 = 90K above midpoint

final = 5150 + 1316 + 90 = ~3200K  (warm, slightly above candlelight — correct for intent)
```

### 4.3 Clamping

All parameters clamp to their physical valid range after resolution. A dimension can't push color temp below 1800K or above 12000K.

---

## 5. Natural Language Parser

### 5.1 Approach

LLM prompt-based parsing — no custom NLP. The dimension registry (names + aliases) is injected into the system prompt. The LLM maps speech to delta vectors.

**Two-call pattern:** When `set_artistic_intent(natural_language: "...")` is called, it returns an NL parse prompt (not a resolved vector). The AI reads the prompt, parses the intent into a delta vector, then calls `set_artistic_intent(vector: {...})` with the parsed result. This keeps the LLM in the loop for ambiguity resolution.

### 5.2 NL Parse Prompt Template

```
You have these active semantic dimensions:
{dimension_list_with_aliases}

The user said: "{user_input}"

Parse into a delta vector. Each dimension you want to change gets a value from -1.0 to +1.0.
- Absolute: "make it warm" → { warmth: 0.7 }
- Relative: "warmer" → { warmth: +0.2 }  (delta from current)
- Negation: "less contrast" → { contrast: -0.3 }
- Compound: "moody and warm" → { warmth: 0.6, contrast: 0.5, arousal: 0.3 }

Return JSON: { "deltas": {...}, "mode": "absolute"|"relative", "confidence": 0-1 }
```

### 5.3 Examples

| User Says                          | Parsed Vector                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| "make it dramatic"                 | `{ contrast: 0.7, arousal: 0.5, warmth: -0.2 }`                                                |
| "warmer"                           | `{ warmth: +0.2 }` (relative)                                                                  |
| "Vermeer lighting"                 | Load preset: `{ warmth: 0.6, contrast: 0.5, intimacy: 0.4, key_direction: 0.3 }`               |
| "too dark, pull it back"           | `{ contrast: -0.3, arousal: -0.2 }` (relative)                                                 |
| "cyberpunk"                        | Load preset: `{ saturation: 0.7, contrast: 0.6, warmth: -0.5, arousal: 0.8, complexity: 0.6 }` |
| "I want it to feel calm but grand" | `{ arousal: -0.6, dominance: 0.7, pleasure: 0.4 }`                                             |

---

## 6. Presets

### 6.1 Seed Presets (25)

**Mood presets**: dramatic, ethereal, natural, studio, noir, golden_hour, moonlit (align with existing suggest_lighting moods)

**Artist presets**: Vermeer, Caravaggio, Hopper, Kubrick, Villeneuve, Fincher

**Genre presets**: product_clean, product_luxury, landscape_epic, portrait_editorial, still_life_dutch, architectural_modern, macro_nature

**Film presets**: blade_runner, moonlight, grand_budapest, mad_max, her

All LLM-generated from published art analysis, labeled "AI-derived, review suggested." Users can add their own.

---

## 7. Critique Loop (Replaces Old Score System)

### 7.1 Semantic Gap Vector

Old system: 5 scores (framing, depth, composition, lighting, placement) on 1-5 scale.

New system: measure where the render actually sits in S-space, compute the gap from target.

```
target_vector:    { warmth: 0.7, contrast: 0.6, atmosphere: 0.3 }
measured_vector:  { warmth: 0.4, contrast: 0.7, atmosphere: 0.1 }
gap_vector:       { warmth: -0.3, contrast: +0.1, atmosphere: -0.2 }
```

Gap vector tells you exactly what's wrong and by how much. No vague "lighting: 3/5."

### 7.2 Measurement

Hybrid approach:

**Pixel-computable** (ground truth):

- Contrast → histogram analysis (standard deviation of luminance)
- Warmth → white point / average color temperature from RGB
- Saturation → mean chroma in Lab space
- Atmosphere → frequency analysis (high-frequency loss = haze)

**VLM-estimated** (perceptual):

- Pleasure, arousal, dominance → VLM rates on Likert scale
- Complexity → VLM counts objects/details
- Groundedness → VLM checks contact shadows, floor texture

**Calibration**: Compare VLM estimates against pixel ground truth on the computable dimensions. Compute systematic bias. Apply correction to VLM-only dimensions.

### 7.3 Convergence

Gap magnitude = `sqrt(sum(gap[i]^2))`. Converged when gap < threshold (0.15). Stagnation when gap doesn't shrink by > 0.05 over 2 iterations. Same logic as current system, but on meaningful vectors instead of arbitrary scores.

---

## 8. Berlyne Warnings

Berlyne's inverted-U: aesthetic pleasure peaks at moderate complexity/arousal and drops at extremes. When any dimension exceeds |0.85|, the system warns:

```
WARNING: contrast = 0.92 — extreme values often reduce aesthetic appeal (Berlyne inverted-U).
Intentional? Proceed or reduce to 0.7-0.8 range.
```

Warn, never block. The user might genuinely want |0.95| for a specific effect.

---

## 9. Per-Object Overrides

Global vector applies scene-wide. Per-object overrides add to global for specific objects (e.g. "hero should be more textured"). Effective vector = `global + override`. Most scenes use global only.

---

## 10. Locked-In Design Decisions

| Decision              | Choice                                | Rationale                                        |
| --------------------- | ------------------------------------- | ------------------------------------------------ |
| Preset seeding        | LLM-generated + human review          | Fast cold start, labeled as AI-derived           |
| Measurement           | Pixel math + VLM hybrid               | Pixel provides ground truth calibration for VLM  |
| Orthogonality         | No enforcement, document correlations | Fighting natural perception is counterproductive |
| Active dimensions     | 6-12 per scene, rest dormant          | Registry holds 50+, only active ones shown       |
| Scoping               | Global default + per-object overrides | Most scenes stay global-only                     |
| Extreme values        | Berlyne warning at \|value\| > 0.85   | Warn, never block                                |
| Existing spatial math | Stays as-is, separate concern         | SEGA = intent, spatial = correctness             |
| Old critique scores   | Replaced by semantic gap vector       | Meaningful vectors instead of arbitrary 1-5      |

Implementation complete — see `mcp/src/sega/` for code. File structure derivable from the directory.

---

## 11. Usage Examples

### 11.1 Starting a Scene

**What you say:**

> "I want to build a product shot of a gold sphere. Dramatic lighting, like Caravaggio."

**What happens inside:**

1. You call `set_artistic_intent(preset: "caravaggio")` — loads preset vector directly
2. Preset resolves: `{ warmth: 0.5, contrast: 0.8, key_direction: 0.4, intimacy: 0.3, atmosphere: 0.2 }`
3. Parameter mapping resolves: key temp 3000K, fill ratio 6:1, environment power 0.1, camera elevation 5 deg, etc.
4. System shows you the resolved intent + parameters before building anything

Alternatively, `set_artistic_intent(natural_language: "dramatic, like Caravaggio")` returns a parse prompt — you extract the vector, then call back with the parsed result (two-call NL pattern).

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

### 11.2 Adjusting During Build

**What you say:**

> "Warmer. And less contrast, it's too harsh."

**What happens inside:**

1. NL parser returns: `{ warmth: +0.15, contrast: -0.25 }` (relative deltas)
2. System applies deltas: warmth 0.5 → 0.65, contrast 0.8 → 0.55
3. Parameter mapping re-resolves: key temp shifts from 3000K → 2900K, fill ratio drops from 6:1 → 4:1
4. System applies only the changed parameters to the scene (delta application, not full rebuild)

Other interactions (presets, critique, per-object overrides, Berlyne warnings, undo, saving presets) follow the same pattern: user speaks naturally → NL parser extracts deltas → system resolves parameters → scene updates.
