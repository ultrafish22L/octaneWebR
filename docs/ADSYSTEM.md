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

3D meshes from external sources arrive with unknown orientation, scale, and proportions. The **Mugshot Protocol** (`analyze_mesh`) loads each mesh in isolation, renders diagnostic views (lean 2-pass: 3 diagnose + 2 verify + 1 hero), sends them to a VLM for upright verification, and caches the results in a sidecar file. Scene Placement maintains a spatial database for collision-free positioning via `suggest_placement` and `register_scene_object`.

> **Details:** [BUILD.md Pre-Phase](mcp/BUILD.md#pre-phase-analyze_mesh-blocking--before-any-placement)

---

### 3. SEGA — Semantic Artistic Guidance

A 15-dimension mixing board where each slider (-1.0 to +1.0) captures a perceptual aspect of the scene's look and feel. Together they form a semantic vector that maps to concrete render parameters via weighted linear interpolation.

```
"moody and warm"  →  { warmth: 0.7, contrast: 0.6 }  →  key_temp: 3200K, fill_ratio: 5:1  →  set_attribute(...)
```

25 named presets (mood, artist, film, genre) provide starting points. Natural language parsing handles absolute ("make it warm"), relative ("warmer"), and compound ("moody and warm") instructions.

> **Details:** [SEGA System Design](project/SEGA_SYSTEM_DESIGN.md) — full spec with dimension registry, mapping engine, convergence math, presets, per-object overrides.

---

### 4. Vision Critique Loop

Two independent critics evaluate each render:

- **Vision Critic** (`critique_render`) — external vision model scores framing, depth, composition, lighting, placement (1-5 each). Framing gates everything: < 3 = back to Phase 1.
- **Semantic Critic** (`semantic_critique`) — measures where the render sits in SEGA space vs target, outputs a gap vector showing exactly what's wrong and by how much.

The loop iterates: render → score → fix weakest → re-render → re-score. Stagnation detection (< 0.3 improvement over 2 iterations) triggers approach redesign.

> **Details:** [BUILD.md Critique Loop](mcp/BUILD.md#critique-loop--dual-perspective-run-after-every-save_render-in-phases-2-4)

---

### 5. Creative Knowledge

Two recipe tools work with or without AD: `suggest_lighting` (3-point setup for 7 moods, adapted to SEGA intent when active) and `suggest_material` (PBR values for 30+ surface types). Starting points, not final values — the critique loop may adjust.

> **Details:** [Creative Guide](mcp/CREATIVE.md)

---

## Asset Generation Pipeline

End-to-end from idea to rendered scene:

1. **Concept art** — `generate_image_pro` (OTOY Studio) from text description
2. **Reference analysis** — `analyze_reference` extracts composition into structured recipe
3. **3D mesh generation** — OTOY Studio image-to-3D → GLB files
4. **Format conversion** — trimesh: GLB → OBJ + textures
5. **Mesh analysis** — `analyze_mesh` mugshot protocol for orientation/scale
6. **Scene build** — Import, apply materials/lighting from SEGA intent, collision-free placement
7. **Critique and iterate** — Vision critique loop until render matches intent

Each step is optional. You can skip AI generation and import your own meshes, skip SEGA and light manually. Every piece works standalone.

> **Details:** [BUILD.md §8](mcp/BUILD.md#8-3d-asset-pipeline)

---

## How It All Fits Together

A full AD-enabled build flows through four gated phases: **Plan** (spatial math + SEGA intent + mesh analysis) → **Frame** (geometry + camera in clay, gate: framing ≥ 3) → **Dress** (materials + lighting + environment) → **Critique** (dual vision/semantic scoring, iterate until pass). AD can be disabled for quick tests — recipe tools still work with sensible defaults.

> **Details:** [BUILD.md §3](mcp/BUILD.md#3-dress-protocol) for the full phase-by-phase protocol.

---

## Further Reading

| Document                                            | What's In It                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| [BUILD.md](mcp/BUILD.md)                            | Step-by-step build workflow — tool calls, phases, verification gates    |
| [SEGA System Design](project/SEGA_SYSTEM_DESIGN.md) | Full SEGA spec — mapping engine, convergence math, per-object overrides |
| [Creative Guide](mcp/CREATIVE.md)                   | Lighting recipes, material values, composition rules, color theory      |
| [Reference](mcp/REFERENCE.md)                       | Pin layouts, node types, attribute IDs, material presets                |
| [MCP User Guide](mcp/README.md)                     | All 78 tools, setup, tips, troubleshooting                              |
