# Octane MCP Crash Reference

All crashes = ECONNRESET → restart Octane → rebuild scene (handles invalidated).

## Confirmed Crashes

| #   | Trigger                                         | Timing       | Workaround                  |
| --- | ----------------------------------------------- | ------------ | --------------------------- |
| 1   | `set_attribute(primitive, 185, 3, 20)` — Sphere | Immediate    | NT_GEO_MESH + sphere.obj    |
| 2   | `set_attribute(primitive, 185, 3, 22)` — Torus  | ~500ms delay | NT_GEO_MESH + torus.obj     |
| 3   | `resetProject` without `suppressUI: true`       | Immediate    | Always pass suppressUI      |
| 4   | Destroy connected node / ungroup                | 5-9s delay   | Rebuild from scratch        |
| 5   | NT_GEO_MESH + batched ops + set_camera          | On eval      | Build in phases (see below) |

**#5 is not fully confirmed** — same pattern worked in SPICYOTOY, crashed in ARCTIC. May be non-deterministic or have a different root cause.

## Safe Primitives

Box (0), Cone (3), Cylinder (4) — tested heavily.

## Crashed Primitives

Sphere (20), Torus (22) — use NT_GEO_MESH + .obj instead.

## Untested Primitives

Pill(1), Capsule(2), Dreidel(5), Disc(6), Dodecahedron(7), Hemisphere(8), Ellipsoid(9), Torus-fat(10), Hourglass(11), Hyperboloid(12), Icosahedron(13), Octahedron(14), Plane(15), Pentagon(16), Prism(17), Quad(18), Saddle(19), Tetrahedron(21), TruncatedCone(23). Other curved shapes may also crash.

## Prevention

- No sphere/torus primitives — use NT_GEO_MESH + .obj
- Build mesh objects in phases: create + reload → `update_scene()` → connect material → connect to group → `set_camera()`
- Don't destroy connected nodes — rebuild from scratch
- `resetProject` needs `suppressUI: true`
- After heavy structural ops, don't assume success = safe

## General Note

Octane's gRPC API is not mature. Some crashes may be Octane-side bugs that don't occur through Lua scripting. Treat all crash patterns as potentially Octane bugs, not necessarily timing or data issues on our side.
