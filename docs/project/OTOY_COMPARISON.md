# OctaneWebR vs Octane Standalone SE — Feature Gap Summary

**Estimated coverage: ~40-45%** of Octane SE's full feature surface.

Date: 2026-03-06 | OctaneWebR v1.5.3

---

## What's Implemented (core workflow complete)

- Full node graph editor (755 types, connections, groups, copy/paste, auto-layout)
- Real-time viewport (orbit/pan/zoom, all picking modes, clay, sub-sampling)
- Node Inspector (recursive parameter editing, all value types)
- Scene Outliner (virtual scrolling, LiveDB/LocalDB material browsing)
- File operations (New/Open/Save/SaveAs/Package, recent files)
- All render settings (6 kernels, film, imager, post-processing)
- All 16 material types, 7 camera types, 3 environment types
- GPU/render statistics, keyboard shortcuts

## High Priority Gaps (6)

| Feature                           | Complexity | Notes                                        |
| --------------------------------- | ---------- | -------------------------------------------- |
| Object placement/transform gizmos | Hard       | Buttons exist, no viewport gizmos            |
| Undo/Redo integration             | Hard       | CommandHistory exists, not wired to Octane   |
| AOV/Render pass viewer            | Medium     | 60+ AOV types defined, no viewport switching |
| Multi-pass render export          | Medium     | Beauty-only, no pass selection               |
| Batch rendering backend           | Medium     | Dialog exists, doesn't execute               |
| Paste operations                  | Medium     | Copy works, paste not implemented            |

## Medium Priority Gaps (9)

Animation timeline, Light Mixer, Material preview scenes, Sub-graph navigation, Denoiser toggle, Viewport resolution lock, Real-time rendering mode, Preferences wiring, AI upsampling UI

## Low Priority Gaps (24)

Lua editor, OSL editor, AOV compositor, Connection cutter, Multi-connect, Geometry exporter, Decal wireframe, Background image, Workspace layouts, Log window, Multi-viewport, USD stage editor, OCIO UI, VR rendering, Cloud rendering, MaterialX, Scene graph export, Toon light setup, Import preferences, Save as macro, Render from context menu, Out-of-core settings, Render layers UI, Deep render AOVs

---

**Key insight:** Most "not implemented" features actually work through the Node Inspector's generic parameter editing. The gap is dedicated, purpose-built UI panels and workflows, not missing backend capability.
