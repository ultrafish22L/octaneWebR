# Octane gRPC Crash Reference

Octane's gRPC API is **pre-alpha** — we are the engineering team testing it. **Assume crashes are our fault until proven otherwise.** This file tracks observed crash patterns and current workarounds. API updates may change any of this.

All crashes = ECONNRESET → restart Octane → rebuild scene (handles invalidated).

## Confirmed Crashes

| #   | Trigger                                         | Timing       | Workaround                                   |
| --- | ----------------------------------------------- | ------------ | -------------------------------------------- |
| 1   | `set_attribute(primitive, 185, 3, 20)` — Sphere | Immediate    | NT_GEO_MESH + sphere.obj                     |
| 2   | `set_attribute(primitive, 185, 3, 22)` — Torus  | ~500ms delay | NT_GEO_MESH + torus.obj                      |
| 3   | `resetProject` without `suppressUI: true`       | Immediate    | Always pass suppressUI                       |
| 4   | Destroy connected node / ungroup                | 5-9s delay   | Rebuild from scratch                         |
| 5   | NT_GEO_MESH + batched ops + set_camera          | On eval      | Build in phases (see below)                  |
| 6   | `update_scene()` in complex emissive scene      | Immediate    | Never use update_scene — use set_camera only |

**#5 is not fully confirmed** — same pattern worked in SPICYOTOY, crashed in ARCTIC. May be non-deterministic or have a different root cause.

**#6 details**: "The Summoning" scene, 2026-03-08. 10 geo objects (5 walls + 5 emissive totems), PT kernel, near-black room (0.03 albedo). Pattern: 3 `connect_nodes(evaluate:false)` → `update_scene()`. Worked 4 times (totems on Input 6-9), crashed on 5th (Input 10). Root cause: batching deferred changes via `evaluate:false` then flushing all at once with `update_scene()` forces a heavy synchronous evaluation on the gRPC message thread. With 5 emissive objects + PT, the evaluation overwhelmed the thread. **Fix: don't defer — use `evaluate:true` (default) so each call evaluates incrementally. Then `set_camera()` to refresh the render. No `update_scene()` needed.**

## Safe Primitives

Box (0), Cone (3), Cylinder (4) — tested heavily.

## Crashed Primitives

Sphere (20), Torus (22) — use NT_GEO_MESH + .obj instead.

## Untested Primitives

Pill(1), Capsule(2), Dreidel(5), Disc(6), Dodecahedron(7), Hemisphere(8), Ellipsoid(9), Torus-fat(10), Hourglass(11), Hyperboloid(12), Icosahedron(13), Octahedron(14), Plane(15), Pentagon(16), Prism(17), Quad(18), Saddle(19), Tetrahedron(21), TruncatedCone(23). Other curved shapes may also crash.

## Prevention

- **Don't defer evaluation** — use `connect_nodes(evaluate:true)` (default) so each call evaluates incrementally. Batching with `evaluate:false` + `update_scene()` forces heavy synchronous evaluation that can crash in complex scenes.
- No sphere/torus primitives — use NT_GEO_MESH + .obj
- Build mesh objects in phases: create + reload → `set_camera()` → connect material → connect to group → `set_camera()`
- Don't destroy connected nodes — rebuild from scratch
- `resetProject` needs `suppressUI: true` (and triggers Save dialog — use delete-all-nodes for autonomous work)
- After heavy structural ops, don't assume success = safe
- Complex emissive scenes (5+ light sources + PT) are higher crash risk — always use `evaluate:true` (default) so each connection evaluates incrementally
- `update_scene()` is safe for small flushes but dangerous for large batched structural changes — avoid it when possible

## General Note

This is a **pre-alpha gRPC API** — we are the test engineers. **Default assumption: we're misusing the API.** Only after exhausting all other explanations should we suspect an Octane bug. Every crash is a data point. Workarounds are current best practice — the API will evolve and these patterns may change with updates.
