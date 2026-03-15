# Camera Math Reference (CM)

**CM learns from live renders. This file caches what works.**

## Octane Thin Lens — ACTUAL FOV (Live-Calibrated)

**The default FOV assumptions were WRONG.** Multiple calibration rounds:

| Parameter | Originally Assumed | Calibrated (v2) | How measured |
|-----------|-------------------|-----------------|--------------|
| Horizontal half-FOV | 45.75° | ~41° | Plank (12 units) just fits at Z=7.5 with small margin → half-HFOV ≈ atan(6.5/7.5) ≈ 41° |
| Vertical half-FOV | 30° | ~24° | Back-calculated from HFOV and 16:9 aspect |
| Horizontal FOV | 91.5° | ~82° | 2 × 41° |
| Vertical FOV | 60° | ~48° | 2 × 24° |

**v1 calibration (25° HFOV) was too pessimistic** — clipping was from aspect ratio mismatch and camera offset, not FOV. v2 from pullback-and-inch-forward method is more reliable.

### Formula (v2)
```
half_HFOV ≈ 41°
half_VFOV ≈ 24°
visible_half_width_at_Z = Z * tan(41°) = Z * 0.869
visible_half_height_at_Z = Z * tan(24°) = Z * 0.445
```

**RULE:** When in doubt, start at 1.5× the computed distance and inch forward. Theory has failed us repeatedly — always verify with a render.

## Proven Frames

### Wood Chips Demo — 7 chips on plank
**Scene:** Plank X=[-6,6] Y=[-0.15,0.15] Z=[-3,3]. 7 chips X=[-2.4,2.4] Y≈0.25.
Chip footprint with rotation: ≈ 0.72 wide, X extent ≈ [-2.76, +2.76].

| Attempt | Position | Target | Elevation | Result |
|---------|----------|--------|-----------|--------|
| 1 (55°) | {1.3, 6.3, 4.15} | {0.2, 0.15, 0} | 55° | Too overhead — catalog swatches |
| 2 (30°, X offset) | {1.3, 4.15, 6.93} | {0.3, 0.15, 0} | 30° | Left chips clipped — X offset too large |
| 3 (32°, CM v1) | {0.3, 3.39, 5.02} | {0, 0.25, 0} | 32° | Clipped — FOV math wrong |
| 4 (19°, Z=8) | {0, 2.8, 8} | {0, 0.2, 0} | 19° | All visible but too far, too low angle |
| 5 (28°, Z=6.5) | {0, 3.5, 6.5} | {0, 0.2, 0} | 28° | Still clipping on edges |
| 6 (31°, Z=10) | {0, 6, 10} | {0, 0, 0} | 31° | All visible, too far back |
| 7 (30°, Z=8.5) | {0, 5, 8.5} | {0, 0, 0} | 30° | All visible, still small |
| **8 (29°, Z=7.5)** | **{0, 4.2, 7.5}** | **{0, 0, 0}** | **29°** | **WINNER. All 7 visible, plank front edge shows, chips fill frame, plank bleeds L/R, warm bg fills upper frame.** |

### Key Learnings
- **29° elevation is the sweet spot for tabletop product shots** — shows surface AND edge
- **55° is too overhead** — spreadsheet look
- **Center the camera (X=0)** for symmetric subjects — ANY X offset causes asymmetric clipping at tight frames
- **Start far, inch forward** — never trust pure math for final framing
- **Plank bleeding off left/right is GOOD** — makes it feel like a real surface, not a floating tile
- **Target at origin** works better than target at chip height — keeps perspective more natural

## Formulas (v2 calibrated)

### Distance from scene width (conservative)
```
D_z = (half_visible_width_needed) / tan(41°)
D_z = (6.5) / 0.869 ≈ 7.5 (for 13-unit visible width)
```

### Position from elevation + distance
```
Y = target_Y + D_z * tan(elevation)
Z = D_z
X = 0  (center for symmetric subjects)
```

### Quick reference
```
For a subject W units wide, all objects visible with 15% margin:
D_z = (W/2 * 1.15) / tan(41°) = W * 0.662

For the FULL plank (12 units) in frame:
D_z = 12 * 0.662 ≈ 8.0 (confirmed: Z=7.5 shows plank with slight bleed)
```
