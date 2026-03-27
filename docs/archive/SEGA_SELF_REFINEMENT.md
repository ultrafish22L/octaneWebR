# SEGA Self-Refinement — Calibration & Learning Pipeline

## Overview

A multi-phase self-refinement system that improves SEGA's dimension→parameter mappings and VLM measurement accuracy **without human intervention**. Starts with zero-cost image generation calibration, graduates to full scene-building refinement.

---

## Phase A: Image Generation Calibration (No Octane Required)

### Goal

Calibrate VLM measurement accuracy and discover dimension correlations using generated concept images. No scenes are built — this is pure measurement calibration.

### Pipeline

```
1. GENERATE PROMPT
   Claude generates a scene description with:
   - A logical base scene ("still life with brass teapot on weathered wood table")
   - Randomly mixed SEGA dimensions at known values
     e.g. { warmth: 0.7, contrast: 0.4, intimacy: 0.6, atmosphere: 0.3 }
   - The prompt encodes these dimensions as artistic direction:
     "warm golden side-lighting, moderate contrast, close framing,
      slight atmospheric haze"

2. GENERATE CONCEPTS
   Send prompt to OTOY Studio (generate_image / generate_image_pro)
   → 2-4 concept shots per prompt
   Each image has a KNOWN target vector (what we asked for)

3. MULTI-PROVIDER VLM REVIEW
   Send each concept to ALL available vision backends:
   - Anthropic (Claude Haiku)
   - Gemini
   - Self-critique (Claude in conversation)
   Each provider gets the VLM estimation prompt from get_vlm_estimation_prompt
   Each returns a measured vector: { warmth: 0.5, contrast: 0.6, ... }

4. PIXEL ANALYSIS
   Run PixelAnalyzer on each concept image
   Get ground-truth for: contrast, warmth, saturation, atmosphere

5. COMPARE & LEARN
   For each image:
   a. Compare pixel measurements vs each VLM provider
      → Compute per-provider bias per dimension
      → e.g. "Anthropic consistently rates warmth 0.15 higher than pixel truth"
   b. Compare VLM providers against each other
      → Find consensus dimensions (all agree) vs contentious (disagree)
      → Consensus dimensions are more reliable for calibration
   c. Compare ALL measurements vs target vector (what we asked for)
      → How well does "warm golden side-lighting" actually produce warmth=0.7?
      → This calibrates the NL→dimension mapping, not just measurement

6. RECORD LESSONS
   Store as LearnedAdjustments:
   - Which VLM provider is most accurate per dimension
   - Systematic biases per provider per dimension
   - Which NL phrases reliably produce which dimension values
   - Observed dimension correlations (warmth requested → saturation increased)
   - Confidence updates on ParameterMappings
```

### What This Calibrates (Without Octane)

| Calibration Target       | Method                                           |
| ------------------------ | ------------------------------------------------ |
| VLM measurement accuracy | Pixel ground truth vs VLM estimates              |
| VLM provider bias        | Multi-provider comparison on same image          |
| NL→dimension mapping     | Target vector vs measured vector                 |
| Dimension correlations   | Request one dimension, measure what else changes |
| Prompt effectiveness     | Which phrasings produce most accurate results    |

### Cost Per Run

- 2-4 OTOY Studio image generations (fast, cheap)
- 2-3 VLM API calls per image (Haiku is very cheap)
- 1 pixel analysis per image (free, local)
- Total: ~$0.05-0.15 per calibration cycle

### Run Strategy

- **Cold start**: 20-30 cycles with diverse scene types and dimension combinations
- **Ongoing**: 2-3 cycles per session, focusing on dimensions with lowest confidence
- **Targeted**: When a specific dimension mapping seems wrong, generate 5 images varying only that dimension

---

## Phase B: Scene-Building Refinement (Requires Octane)

### Goal

Calibrate the actual dimension→Octane parameter mappings by building real scenes, rendering them, and comparing renders against concept targets.

### Pipeline

```
1. GENERATE TARGET CONCEPT
   Same as Phase A step 1-2:
   - Scene description + known SEGA vector
   - OTOY Studio generates concept images
   - Pick the best concept as the TARGET

2. BUILD SCENE IN OCTANE
   Use SEGA tools to build a matching scene:
   - set_artistic_intent with the target vector
   - Use resolved parameters to configure Octane
   - Build geometry, materials, lighting per DRESS protocol
   - Render

3. SEMANTIC CRITIQUE
   Compare Octane render vs concept target:
   - Pixel analysis on both images
   - VLM comparison (render vs concept side-by-side)
   - Compute semantic gap vector

4. ITERATE
   - Apply corrections from gap vector
   - Adjust parameters
   - Re-render
   - Repeat until converged or exhausted

5. RECORD LESSONS
   After convergence (or exhaustion):
   a. Which parameter mappings were accurate?
      → Dimension warmth=0.7 → key_temp=3200K: did 3200K actually look warm?
      → If VLM measured warmth=0.5, the mapping range may need shifting
   b. Which mappings needed manual override?
      → Record as LearnedAdjustment with full context
      → Future: regression to adjust mapping weights
   c. Which dimensions converged fastest?
      → These mappings are well-calibrated (increase confidence)
   d. Which dimensions stagnated?
      → These mappings may be wrong (decrease confidence)
   e. What unexpected correlations appeared?
      → Adjusting contrast also moved perceived warmth?
      → Update correlation table
```

### What This Calibrates (With Octane)

| Calibration Target         | Method                                                               |
| -------------------------- | -------------------------------------------------------------------- |
| Dimension→parameter ranges | Compare SEGA-computed values vs perceptual result                    |
| Parameter weights          | Which dimension dominates when multiple compete                      |
| Physical limits            | Whether extreme values actually produce extreme results              |
| Cross-parameter effects    | Changing one parameter's effect on other perceptual dimensions       |
| Preset accuracy            | Do named presets ("vermeer", "blade_runner") produce the right feel? |

### Cost Per Run

- 1-2 OTOY Studio generations ($)
- 3-10 Octane renders (GPU time)
- 2-5 VLM critique calls ($)
- Total: ~$0.20-0.50 + GPU time per cycle

---

## Phase C: Autonomous Preset Generation

### Goal

Auto-generate new presets from successful scene vectors.

### Pipeline

```
1. After a scene build is marked "passed" (converged):
   - Extract the final semantic vector
   - Ask VLM: "What artistic style/mood does this render represent?"
   - Auto-name and tag the preset

2. Cluster successful vectors:
   - Group similar vectors that produced good results
   - Generate "consensus presets" from cluster centroids
   - These are data-driven, not hand-tuned

3. Validate presets:
   - Generate concept images using preset descriptions
   - Compare concepts against actual renders using that preset
   - Keep presets where concept ≈ render, discard mismatches
```

---

## Implementation Status

Data structures in place (`LearnedAdjustment`, `ParameterMapping.confidence/source`, `SemanticPreset.source`). Remaining: calibration runner, bias tracker, confidence updater, preset generator.

---

## Implementation Priority

1. **Phase A first** — Cheapest, no Octane dependency, calibrates VLM reliability
2. **Phase B second** — The real payoff, but needs reliable VLM measurements from Phase A
3. **Phase C last** — Nice-to-have, depends on enough Phase B data

---

## Key Insight

Phase A can run **completely autonomously** as a background task:

- No user interaction needed
- No Octane needed
- Just OTOY Studio + VLM APIs
- Could run N cycles per session during idle time
- Results accumulate as LearnedAdjustments

Phase B needs Octane but could also be semi-autonomous:

- Pick a random preset + random scene type
- Build, render, critique, iterate
- Record what worked and what didn't
- Human reviews results periodically

This is how the system gets better over time without manual tuning of the 15×3+ parameter mappings.

---

## Multi-Provider Comparison

Comparing how different VLMs interpret the same image reveals systematic biases per provider and per dimension. Key signals: all providers agreeing = dimension is unambiguous; one consistently disagreeing = systematic bias; all missing a target dimension = ineffective prompt language; mentioning unexpected dimensions = hidden correlations. See `CalibrationRecord` type in code for data structure.
