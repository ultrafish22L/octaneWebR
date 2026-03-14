# UI Implementation Notes

Lessons learned and patterns established while building the octaneWebR node inspector and related UI components.

---

## Inspector Depth Shading

**Status: DONE** — Implemented across all 3 themes (octane, vibe, debug).

### Pattern

- Theme files define `--bg-depth-0` through `--bg-depth-5` CSS variables
- Depth classes applied via `ParameterGroup` `level` prop in TSX
- A node bar has a color + 3D gradient. When expanded, the bar's color fills behind all children (toggle-content matches bar color), but the 3D gradient stays only on the bar strip itself
- Child bars at the next depth are lighter

### Key CSS Lesson

`background:` shorthand overrides `background-color:` — use `background-color:` on base rules and `background:` on depth overrides to avoid clobbering gradient overlays.

### Implementation Details

- `.node-box` uses `background-color` (not shorthand) so gradient overlay is preserved
- `.node-toggle-content[data-depth=N]` gets the SAME color as the parent bar
- Indent wrappers are transparent; `overflow:hidden` on toggle-content prevents seam between bar and children
- Spread must be wide enough (~12+ units per step in octane theme)

### Files

- `client/src/styles/node-inspector.css` — depth shading rules
- `client/src/styles/theme-octane.css` — depth variables
- `client/src/styles/theme-vibe.css` — depth variables
- `client/src/styles/theme-octane-debug.css` — depth variables
- `client/src/components/NodeInspector/index.tsx` — `ParameterGroup` level prop

---

## Float Display Formatting

Octane uses `sliderStep` from pinInfo to determine display precision:

| sliderStep | Decimal places | Example                |
| ---------- | -------------- | ---------------------- |
| 0.1        | 1              | F-stop: "2.8"          |
| 0.001      | 3              | Sensor width: "36.000" |
| 0.000001   | 6              | Aperture: "0.892857"   |

Special cases:

- Values >= 1e9 → show "∞" (infinity symbol, e.g., Far clip depth)
- Trailing zeros kept up to precision from sliderStep
- Region start/size in Film settings display as percentages ("0.0%", "100.0%")

**Implementation:** In `formatFloatForDisplay`, calculate decimal places from `-log10(sliderStep)`. Fall back to 3 decimals if sliderStep is 0 or missing.

---

## Connected Leaf Node Detection

Some nodes (e.g., NT_TRANSFORM_VALUE) have a handle and pin type but no `attrInfo` and may or may not have children. These are "connected leaf" nodes — they need a dropdown to show/change their type, NOT flat parameter rows.

**Detection:** `isEndNode && node.handle && pinType !== null && !node.attrInfo`

**Special case:** Transform data (rotation + scale + translation = 9 values) can't fit on one line, so it expands into children when the scene service fetches them.

**Implementation:** The `isConnectedLeaf` check in `NodeParameter` ensures these get full node-box rendering with dropdown instead of the parameter-node early return.

---

## Movable Input Pins

23 node types support movable input pins (`A_PIN_COUNT=113`, `A_INPUT_ACTION=128`).

### UI Elements

- **"Add input" button** after the node header (calls `addMovableInput` → increments `A_PIN_COUNT`)
- **Per-pin "✕" delete and "≡" move** (up/down dropdown) buttons INLINE with the dropdown
- **Pin names** use "Input N:" prefix from `MOVABLE_INPUT_TYPES` inputName

### Layout

Buttons must be inside `.inspector-dropdown-inline` so they sit in the same grid column. The select width shrinks via CSS `:has(.movable-input-pin-actions)` rule.

File toolbar for mesh nodes goes INSIDE the collapsed section (only shows when expanded), matching Octane's layout.

### Files

- `client/src/types/OctaneTypes.ts` — `MOVABLE_INPUT_TYPES` maps all 23 types
- `client/src/components/NodeInspector/index.tsx` — `AddInputButton` and `MovableInputPinActions` components
