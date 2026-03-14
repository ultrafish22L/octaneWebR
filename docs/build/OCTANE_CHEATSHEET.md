# Octane Quick-Reference Values

**This file is a living cheat sheet. Update it every time you discover or refine a value.**

## Daylight Environment — Sunset

**IMPORTANT:** Setting A_VALUE on sundir handle directly does NOT work (T17 confirmed). Must use hour child.

| Property | Handle path | Value | Notes |
|----------|-------------|-------|-------|
| **Hour** | env → pin 0 (sundir) → pin 4 (hour) → child | `17.5` | 5:30 PM = golden hour sunset |
| Turbidity | env → pin 1 (turbidity) → child | `4.0` | Warmer, hazier. Default 2.4 too clean |
| Power | env → pin 2 | `1.0` | Default is fine |
| Sun intensity | env → pin 3 | `1.0` | Default is fine |

Sundir node (NT_SUN_DIRECTION) children: latitude(0), longitude(1), month(2), day(3), **hour(4)**, gmtoffset(5)

## Daylight Environment — Noon (bright, flat)

| Property | Handle path | Value | Notes |
|----------|-------------|-------|-------|
| Hour | sundir → pin 4 (hour) → child | `12.0` | Noon, high sun |
| Turbidity | env → pin 1 → child | `2.4` | Default, clean sky |

## Materials — Presets

### Glass (specular transmission)
| Property | Pin | Handle path | Value |
|----------|-----|-------------|-------|
| Transmission type | pin 1 (transmissionType) | enum child | `1` (specular) |
| IOR | pin 15 (index) | float child | `1.5` (glass) |
| Albedo | pin 2 | RGB child | `{0.85, 0.95, 1.0}` light blue tint |

### Gold Metal
| Property | Pin | Handle path | Value |
|----------|-----|-------------|-------|
| Metallic | pin 4 | float child | `1.0` |
| Roughness | pin 8 | float child | `0.15` |
| Albedo | pin 2 | RGB child | `{1.0, 0.78, 0.34}` warm gold |

### Chrome
| Property | Pin | Handle path | Value |
|----------|-----|-------------|-------|
| Metallic | pin 4 | float child | `1.0` |
| Roughness | pin 8 | float child | `0.02` |
| Albedo | pin 2 | RGB child | `{0.9, 0.9, 0.9}` near-white |

### Loud Red (debugging/test)
| Property | Pin | Value |
|----------|-----|-------|
| Albedo | pin 2 | `{1.0, 0.1, 0.05}` saturated red |

## Camera

| Scenario | Position | Target | Notes |
|----------|----------|--------|-------|
| Hero 3-object | `{1.25, 1.5, 8}` | `{1.25, 0, 0}` | 3 objects spread on X axis |
| Single object | `{0, 0.5, 4}` | `{0, 0, 0}` | Centered, slightly above |
| Pull-back debug | `{0, 5, 20}` | `{0, 0, 0}` | Way back, see everything |

**DOF off:** camera → pin 14 (aperture) → child handle → `set_attribute(handle, 185, AT_FLOAT=9, 0)`

## Transforms (on Placement or NT_TRANSFORM_VALUE)

| Attribute | ID | Type | Notes |
|-----------|----|------|-------|
| A_TRANSLATION | 172 | AT_FLOAT3 (11) | World units |
| A_ROTATION | 137 | AT_FLOAT3 (11) | DEGREES not radians |
| A_SCALE | 139 | AT_FLOAT3 (11) | Uniform = {1,1,1} |

## Render Refresh

**CRITICAL (T3 confirmed):** `start_render` does NOT refresh the geometry tree. It only starts/continues sampling on the already-evaluated tree.

| Method | Refreshes geometry? | Notes |
|--------|-------------------|-------|
| **`set_camera`** | **YES** | The ONLY way to force geometry re-evaluation. Even same position works. |
| `start_render` | NO | Only starts sampling. New objects won't appear. |
| `restart_render` | **NEVER USE** | Crashes Octane (ECONNRESET). |
| `set_attribute` | Partial | Triggers re-render of existing objects but doesn't add new geometry to tree. |

**After connecting new geometry to RT:** always call `set_camera` to make it visible.

## Pin Connection Gotchas

| Target | What works | What silently fails |
|--------|-----------|-------------------|
| RT geometry | `pin_index: 3` | `pin_id: 59` |
| Mesh material | `pin_index: 0` | `pin_id: 30` |
| RT kernel | `pin_id: 89` | — |
| RT environment | `pin_id: 43` | — |

## .obj Assets (absolute path prefix: `C:/otoyla/GRPC/dev/octaneWebR/ORBX/assets/`)

sphere.obj, sphere_hd.obj, sphere_uv.obj, cube.obj, torus.obj, teapot.obj, diamond.obj, ring.obj, monolith.obj, prism.obj, pillar.obj, floor.obj, quad.obj
