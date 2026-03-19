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

## Why

When implementation details are duplicated into recipes, they go stale. The cheatsheet gets updated, the recipe doesn't, and the recipe's outdated instructions override the correct ones. This has caused crashes and wasted sessions — more than once.

## Template

```markdown
# Scene Name

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

> **Before building:** Read `CLAUDE.md` (Current Session + MCP Rules) and look up values in `docs/mcp/REFERENCE.md`. Don't improvise what's already documented.

## The Vision

[Prose describing the scene, composition, mood, lighting, materials. What it should feel like.]

---

## Ingredients

_Living values — refined each time the scene is built._

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
