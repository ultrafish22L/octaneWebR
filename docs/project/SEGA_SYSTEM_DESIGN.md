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

### 3.1 Structure

```typescript
interface DimensionDefinition {
  name: string; // canonical name: "warmth"
  aliases: string[]; // NL triggers: ["warm", "cozy", "golden", "cool", "cold", "icy"]
  negativeAliases: string[]; // words that push toward -1: ["cool", "cold", "icy", "clinical"]
  source: string; // "itten" | "pad" | "cinetech" | "asc" | "craft"
  description: string; // human-readable: "Color temperature tendency"
  negativeLabel: string; // "cool"
  positiveLabel: string; // "warm"
  parameterMappings: ParameterMapping[]; // how this dimension affects DCC parameters
  correlations: Correlation[]; // observed relationships with other dimensions
}

interface ParameterMapping {
  parameter: string; // "key_light_temperature" | "fill_ratio" | "roughness" etc.
  range: [number, number]; // parameter value at dimension = [-1, +1]
  weight: number; // 0-1, how strongly this dimension controls this parameter
  scope: 'global' | 'hero' | 'light' | 'environment'; // what it applies to
}

interface Correlation {
  dimension: string; // other dimension name
  coefficient: number; // -1 to +1, observed correlation strength
  note: string; // "warmth and pleasure correlate in most natural scenes"
}
```

### 3.2 Seed Dimensions (~15)

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

### 6.1 Structure

```typescript
interface SemanticPreset {
  name: string; // "vermeer", "blade_runner", "product_clean"
  category: 'artist' | 'film' | 'genre' | 'mood' | 'user';
  description: string; // "Warm side-lit intimacy with soft shadows"
  vector: SemanticVector; // the actual dimension values
  tags: string[]; // NL trigger words: ["dutch master", "old master", "golden age"]
  source: string; // "AI-derived from art analysis" | "user-created"
}
```

### 6.2 Seed Presets (20-30)

**Mood presets**: dramatic, ethereal, natural, studio, noir, golden_hour, moonlit (align with existing suggest_lighting moods)

**Artist presets**: Vermeer, Caravaggio, Hopper, Kubrick, Villeneuve, Fincher

**Genre presets**: product_clean, product_luxury, landscape_epic, portrait_editorial, still_life_dutch, architectural_modern

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

Global vector applies scene-wide. Per-object overrides for exceptions:

```typescript
interface SceneSemanticState {
  global: SemanticVector; // { warmth: 0.7, contrast: 0.6 }
  overrides: Map<string, SemanticVector>; // "hero" → { surface_detail: 0.8 }
}
```

Effective vector for an object = `global + override`. Most scenes use global only. Override is for "the hero should be more textured than the background."

---

## 10. Locked-In Design Decisions

| Decision              | Choice                                | Rationale                                        |
| --------------------- | ------------------------------------- | ------------------------------------------------ | ------ | ----------------- |
| Preset seeding        | LLM-generated + human review          | Fast cold start, labeled as AI-derived           |
| Measurement           | Pixel math + VLM hybrid               | Pixel provides ground truth calibration for VLM  |
| Orthogonality         | No enforcement, document correlations | Fighting natural perception is counterproductive |
| Active dimensions     | 6-12 per scene, rest dormant          | Registry holds 50+, only active ones shown       |
| Scoping               | Global default + per-object overrides | Most scenes stay global-only                     |
| Extreme values        | Berlyne warning at                    | value                                            | > 0.85 | Warn, never block |
| Existing spatial math | Stays as-is, separate concern         | SEGA = intent, spatial = correctness             |
| Old critique scores   | Replaced by semantic gap vector       | Meaningful vectors instead of arbitrary 1-5      |

---

## 11. Implementation Plan

### Phase 1: Foundation (registry + vector engine)

| Step | What                                                                                                   | Depends On |
| ---- | ------------------------------------------------------------------------------------------------------ | ---------- |
| 1.1  | Dimension registry data file (~15 dimensions with aliases + parameter mappings)                        | Nothing    |
| 1.2  | `SemanticVector` type + `SemanticState` class (state management, delta application, undo stack, clamp) | 1.1        |
| 1.3  | Parameter mapping engine (weighted linear interpolation, multi-dimension resolution, clamping)         | 1.1, 1.2   |
| 1.4  | Unit tests for mapping engine                                                                          | 1.3        |

### Phase 2: NL Interface + Presets

| Step | What                                                                         | Depends On    |
| ---- | ---------------------------------------------------------------------------- | ------------- |
| 2.1  | NL parser prompt (LLM parses speech against registry, returns deltas)        | 1.1           |
| 2.2  | Preset data file (20-30 mood/genre/artist vectors, LLM-generated + reviewed) | 1.1           |
| 2.3  | Preset loader (exact match, fuzzy match, tag search)                         | 2.2           |
| 2.4  | MCP tool: `set_artistic_intent` (accepts NL or preset name or raw vector)    | 1.2, 2.1, 2.3 |

### Phase 3: Measurement + Critique

| Step | What                                                                               | Depends On         |
| ---- | ---------------------------------------------------------------------------------- | ------------------ |
| 3.1  | Pixel measurement module (histogram contrast, white point temp, chroma saturation) | Nothing            |
| 3.2  | VLM semantic estimation prompt (extend existing vision critic)                     | Existing VLM infra |
| 3.3  | Calibration logic (pixel vs VLM bias correction)                                   | 3.1, 3.2           |
| 3.4  | Semantic gap vector computation + convergence detection                            | 1.2, 3.1, 3.2      |
| 3.5  | Replace old `critique_render` with semantic critique                               | 3.4                |

### Phase 4: Polish

| Step | What                                                                  | Depends On |
| ---- | --------------------------------------------------------------------- | ---------- |
| 4.1  | Berlyne warnings                                                      | 1.2        |
| 4.2  | Per-object override support                                           | 1.2        |
| 4.3  | Preset save/load (user creates presets from current vector)           | 2.2        |
| 4.4  | Correlation documentation (observed relationships between dimensions) | Usage data |

### Key Risk

Getting the parameter mappings right. The dimension-to-parameter values (e.g., contrast 0.7 → key:fill 5.6:1) need to produce good-looking results on first pass. Plan: generate initial mappings from industry standards (ASC Manual ratios, CineTechBench measurements), test empirically with real Octane renders, tune.

---

## 12. File Structure

```
mcp/src/
  sega/
    registry.ts          # DimensionDefinition[], seed dimensions
    presets.ts           # SemanticPreset[], mood/genre/artist vectors
    SemanticState.ts     # SemanticVector ops, delta, undo, clamp, per-object
    MappingEngine.ts     # Dimension → parameter resolution
    NLParser.ts          # Prompt builder for NL → delta vector
    PixelAnalyzer.ts     # Histogram, white point, chroma measurement
    SemanticCritic.ts    # Gap vector, convergence, Berlyne warnings
    index.ts             # Public API
  sega/__tests__/
    registry.test.ts
    MappingEngine.test.ts
    SemanticState.test.ts
    PixelAnalyzer.test.ts
```
