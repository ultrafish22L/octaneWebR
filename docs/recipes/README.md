# Recipe Style Guide

Recipes are **creative briefs**, not build scripts.

## What belongs in a recipe

- **The Vision** — what the final render should look and feel like. Composition, mood, lighting intent, material character. Written as prose, not instructions.
- **Ingredients** — suggested values: positions, colors, material properties, camera, environment settings. Tables of numbers, no API calls or pin indices.

## What does NOT belong in a recipe

- Node types, pin indices, pin paths, handle references
- API calls (`set_attribute`, `connect_nodes`, `update_scene`, etc.)
- Build order / step-by-step instructions
- Implementation workarounds or crash prevention notes
- Handle maps or wiring diagrams

All of that lives in `docs/mcp/REFERENCE.md` (pin layouts, values) and `docs/mcp/BUILD.md` (build workflow). Recipes say **what** to build, not **how**.

## Where recipes live

- **Template recipes** (reusable starting points): `docs/recipes/` — e.g., `glass_metal_RECIPE.md`, `space_cat_RECIPE.md`
- **Scene recipes** (specific builds): `aigenerated/{scene-name}/recipe.md` — e.g., `aigenerated/mycelium-court/recipe.md`

Template recipes are generic. Scene recipes are specific to one build and contain calibrated values from iteration.

## Why

When implementation details are duplicated into recipes, they go stale. The cheatsheet gets updated, the recipe doesn't, and the recipe's outdated instructions override the correct ones. This has caused crashes and wasted sessions — more than once.

## Template

```markdown
# Scene Name

> Values below are a starting point — deviate, experiment, improve.

> **Before building:** Read `CLAUDE.md`, `docs/mcp/REFERENCE.md`, `docs/mcp/BUILD.md`.

## The Vision

[Prose describing the scene, composition, mood, lighting, materials. What it should feel like.]

---

## Ingredients

_Living values — refined as discovered._

### Camera

| Setting | Value |
| ------- | ----- |

### Environment

| Setting | Value | Notes |
| ------- | ----- | ----- |

### [Object Name]

| Setting | Value |
| ------- | ----- |

### Render

| Setting | Value |
| ------- | ----- |
```
