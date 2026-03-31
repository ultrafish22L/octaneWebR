# Art Direction System

OctaneWebR's Art Direction (AD) system plans compositions mathematically, sets artistic mood through semantic vectors, places assets collision-free, then iterates with external vision critics until the render matches the intent. It runs automatically during scene builds or can be used piece by piece.

---

## Why Art Direction Exists

When you say "I want moody Caravaggio lighting," a dozen parameters need to change: color temperature, fill ratio, environment power, atmosphere density, and more. Without a system, that intent gets lost the moment it's translated to numbers.

AD keeps three concerns separate:

1. **Spatial correctness** — Are objects in frame? Do depth layers separate properly? Any collisions?
2. **Artistic intent** — What mood, style, and atmosphere are we targeting? (Stored as a measurable vector, not just words.)
3. **Visual validation** — Does the actual render match the intent? Where are the gaps?

Each concern has its own subsystem. They share data but don't overlap.

---

## The Five Subsystems

### 1. Composition Planning

Before any 3D node exists, the composition planner works out spatial layout using pure math: object positions with depth layering, camera position and orientation, focal point hierarchy. It validates frustum, depth separation, proximity, grid alignment, lighting angle, and hero coverage automatically.

If you have a reference image, `analyze_reference` extracts composition from it to bootstrap the plan.

> **Details:** [BUILD.md Phase 0](mcp/BUILD.md#phase-0-composition-planning-before-any-octane-calls)

---

### 2. Mesh Analysis & Scene Placement

3D meshes from external sources arrive with unknown orientation, scale, and proportions. The **Mugshot Protocol** (`analyze_geo`) loads each mesh in isolation, renders diagnostic views (lean 2-pass: 3 diagnose + 2 verify + 1 hero), sends them to a VLM for upright verification, and caches the results in a sidecar file. Scene Placement maintains a spatial database for collision-free positioning via `suggest_placement` and `register_scene_object`.

> **Details:** [BUILD.md Pre-Phase](mcp/BUILD.md#pre-phase-analyze_geo-blocking--before-any-placement)

---

### 3. SEGA — Semantic Artistic Guidance

A 15-dimension mixing board where each slider (-1.0 to +1.0) captures a perceptual aspect of the scene's look and feel. Together they form a semantic vector that maps to concrete render parameters via weighted linear interpolation.

```
"moody and warm"  →  { warmth: 0.7, contrast: 0.6 }  →  key_temp: 3200K, fill_ratio: 5:1  →  set_attribute(...)
```

25 named presets (mood, artist, film, genre) provide starting points. Natural language parsing handles absolute ("make it warm"), relative ("warmer"), and compound ("moody and warm") instructions.

> **Details:** [SEGA System Design](archive/SEGA_SYSTEM_DESIGN.md) — full spec with dimension registry, mapping engine, convergence math, presets, per-object overrides.

---

### 4. Vision Score Loop — Sonnet + Orchestrator

Two critics evaluate each render:

- **Sonnet Comparison** (Anthropic API, two images) — concept art + render side-by-side. Holistic A-F grade with mood/density/composition match. **Sole automated critic.** Grade A or B = pass.
- **Orchestrator** (main Claude context) — reviews both images and Sonnet's assessment, adds build context, flags disagreements. Backup check against the primary VLM call.

Additionally:

- **Semantic Critic** (`score_sega`) — measures where the render sits in SEGA space vs target, outputs a gap vector showing exactly what's wrong and by how much.

The loop iterates: render → score → fix weakest → re-render → re-score. Stagnation detection (< 0.3 improvement over 2 iterations) triggers approach redesign. All assessments logged to `score_stats.jsonl` per scene.

**⛔ Never self-grade.** If `score_render` returns a self-score prompt instead of a Sonnet comparison, the call was made without `reference_image_path`. Fix the call — do not answer the prompt yourself and treat it as a grade. Self-assessment inflates scores and masks problems that Sonnet would catch.

### Model Selection Strategy

| Role                 | Model                    | Why                                                                           |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| Render scoring       | Sonnet (Anthropic API)   | Two-image comparison, strong holistic judgment, independent evaluator         |
| Reference analysis   | Sonnet (Anthropic API)   | Single-image composition extraction, needs real understanding                 |
| Calibration          | Sonnet (Anthropic API)   | Concept art description for keyword caching                                   |
| Orchestrator review  | Opus (main context)      | Best model, full build context, catches what API calls miss                   |
| Mugshot verification | moondream3 (otoy-studio) | `analyze_geo` pre-pass only — checks orientation/scale, not aesthetic quality |

> **Details:** [BUILD.md Score Loop](mcp/BUILD.md#score-loop--dual-perspective-run-after-every-save_render-in-phases-2-4)

---

### 5. Creative Knowledge

Two recipe tools work with or without AD: `suggest_lighting` (3-point setup for 7 moods, adapted to SEGA intent when active) and `suggest_material` (PBR values for 30+ surface types). Starting points, not final values — the score loop may adjust.

> **Details:** [Creative Guide](mcp/CREATIVE.md)

---

## Asset Generation Pipeline

End-to-end from idea to rendered scene:

1. **Concept art** — `generate_image_pro` (OTOY Studio MCP) from text description
2. **Reference analysis** — `analyze_reference` extracts composition into structured recipe
3. **3D mesh generation** — `que.otoy.studio` API (Hunyuan-3D v3.1 Pro) → OBJ + PBR textures
4. **Mesh analysis** — `analyze_geo` mugshot protocol for orientation/scale
5. **Scene build** — Import, apply materials/lighting from SEGA intent, collision-free placement
6. **Score and iterate** — Vision score loop until render matches intent

Each step is optional. You can skip AI generation and import your own meshes, skip SEGA and light manually. Every piece works standalone.

**In DRESS mode, steps 1-6 are NOT optional.** Skip steps only when the input doesn't exist (e.g., no concept art = skip step 2). For autonomous runs, every available step must execute — cutting corners produces primitive-heavy scenes with no artistic direction.

> **Details:** [BUILD.md §8](mcp/BUILD.md#8-3d-asset-pipeline)

---

## How It All Fits Together

A full AD-enabled build flows through four gated phases: **Plan** (spatial math + SEGA intent + mesh analysis) → **Frame** (geometry + camera in clay, gate: Sonnet grade ≥ C) → **Dress** (materials + lighting + environment) → **Score** (Sonnet + orchestrator scoring, iterate until pass). AD can be disabled for quick tests — recipe tools still work with sensible defaults.

> **Details:** [BUILD.md §3](mcp/BUILD.md#3-dress-protocol) for the full phase-by-phase protocol.

---

## ⚠️ AD Transparency Requirement — MANDATORY

**Every AI/VLM call in the AD system MUST show its full input and output in the tool response.** No silent calls. The user sees everything the AI sees.

### What must be visible in chat for EVERY VLM call:

1. **Prompt sent** — the full text prompt, in a labeled `--- PROMPT ---` block
2. **Images sent** — file paths of all images passed to the VLM
3. **Raw response** — the full unedited VLM response text, in a labeled `--- RESPONSE ---` block
4. **Parsed result** — the structured JSON extracted from the response

### Tool-by-tool requirements:

| Tool                        | VLM Calls                                                                     | Transparency                                                                    |
| --------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `analyze_geo` (mugshot)     | Pass 1 diagnosis (3 images), Pass 2 verification (2 images, up to 4 attempts) | Each pass: prompt, image paths, raw response in labeled blocks                  |
| `analyze_reference`         | 1 analysis call + 1 calibration call                                          | Prompt + response + calibration in labeled blocks                               |
| `score_render`              | 1 Sonnet comparison (concept+render, two images)                              | Prompt + image paths + response in labeled blocks.                              |
| `score_sega`                | Pixel measurement (local) + optional VLM estimation                           | Gap vector, pixel measurements, worst dimensions, corrections — all in response |
| `get_vlm_estimation_prompt` | Returns prompt for caller                                                     | Full prompt text returned                                                       |

### Why this matters:

- VLM outputs are probabilistic — the user needs to see what the model said to catch hallucinations
- Prompt quality directly affects results — visible prompts can be debugged and improved
- Image inputs determine what the VLM "sees" — the user must verify the right views were sent
- Same transparency standard as mugshot protocol: if it talks to an AI, the conversation is visible

### Implementation pattern:

All VLM-calling tools return multi-content responses with labeled blocks:

```
--- MUGSHOT PASS 1 PROMPT ---
{full prompt text}
--- END PROMPT ---
--- MUGSHOT PASS 1 IMAGES ---
diag_front.png, diag_side.png, diag_top.png
--- END IMAGES ---
--- MUGSHOT PASS 1 RESPONSE ---
{full VLM response}
--- END RESPONSE ---
```

**This is not optional.** Any new tool that makes VLM/AI calls MUST follow this pattern.

---

## Further Reading

| Document                                            | What's In It                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| [BUILD.md](mcp/BUILD.md)                            | Step-by-step build workflow — tool calls, phases, verification gates    |
| [SEGA System Design](archive/SEGA_SYSTEM_DESIGN.md) | Full SEGA spec — mapping engine, convergence math, per-object overrides |
| [Creative Guide](mcp/CREATIVE.md)                   | Lighting recipes, material values, composition rules, color theory      |
| [Reference](mcp/REFERENCE.md)                       | Pin layouts, node types, attribute IDs, material presets                |
| [MCP User Guide](mcp/README.md)                     | All 65 tools, setup, tips, troubleshooting                              |
