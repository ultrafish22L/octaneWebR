# Node Inspector Parameter Formatting Regression

## 📋 Issue Summary

After NodeInspector refactoring, parameter formatting has regressed. Labels and values no longer match the original octaneSE styling.

## 🔍 Identified Differences

### **Before (Image 2 - Correct)** vs **After (Image 1 - Current/Broken)**

| Aspect              | Expected (Image 2)              | Current (Image 1)              | Status          |
| ------------------- | ------------------------------- | ------------------------------ | --------------- |
| **Label format**    | `"Sensor width:"` (with colon)  | `"Sensor width"` (no colon)    | ❌ Missing      |
| **Label alignment** | Colons vertically aligned       | Left-aligned, no alignment     | ❌ Broken       |
| **Float decimals**  | Min 3, max 6 decimals           | Inconsistent (0, 43.45, 8.284) | ❌ Broken       |
| **Float examples**  | `36.000`, `43.455845`, `1000.0` | `36`, `43.45`, `1000`          | ❌ Wrong format |
| **Input styling**   | Arrow steppers (◄ ►) visible    | Plain inputs, no steppers      | ⚠️ Needs check  |
| **Visual spacing**  | Consistent, comfortable         | Appears cramped                | ⚠️ Needs review |
| **Field widths**    | Consistent across parameters    | May vary                       | ⚠️ Needs review |

## 📝 Detailed Examples

### Float Formatting Issues

```
Expected:  36.000     43.455845   1000.0    45.000    8.284271   0.000
Current:   36         43.45       1000      45        8.284      0
           ❌         ❌          ❌        ❌        ❌         ❌ (should be 0.000)
```

### Label Formatting Issues

```
Expected:  "Sensor width:"   "Focal length:"   "F-stop:"
           │ (colon at end, creates vertical alignment line)
Current:   "Sensor width"    "Focal length"    "F-stop"
           ❌ Missing colons, no alignment
```

## ✅ Fix Task List

### Task 1: Fix Float Number Formatting ⚠️ HIGH PRIORITY

**Files to check:**

- `client/src/components/NodeInspector/parameters/NumberParameter.tsx`
- `client/src/components/NodeInspector/parameters/FloatParameter.tsx` (if separate)
- Any utility functions formatting numbers

**Requirements:**

- [ ] Enforce minimum 3 decimal places for floats
- [ ] Show up to 6 decimal places (remove trailing zeros beyond 3)
- [ ] Examples:
  - `36` → `36.000`
  - `43.45` → `43.450`
  - `43.455845` → `43.455845` (keep 6)
  - `1000` → `1000.0` (may be integer, but show at least 1 decimal)
  - `0` → `0.000`
  - `8.284` → `8.284` (3 decimals OK)
  - `8.284271` → `8.284271` (6 decimals OK)

**Implementation approach:**

```typescript
// Utility function for float formatting
function formatFloat(value: number, min = 3, max = 6): string {
  // Use toFixed(max) then remove trailing zeros beyond min decimals
  const fixed = value.toFixed(max);
  const [integer, decimals] = fixed.split('.');

  // Keep at least 'min' decimals, remove trailing zeros beyond that
  let trimmedDecimals = decimals.slice(0, min);
  const remaining = decimals.slice(min);
  const trimmedRemaining = remaining.replace(/0+$/, '');

  return `${integer}.${trimmedDecimals}${trimmedRemaining}`;
}

// Examples:
formatFloat(36); // "36.000"
formatFloat(43.45); // "43.450"
formatFloat(43.455845); // "43.455845"
formatFloat(8.284); // "8.284"
formatFloat(0); // "0.000"
```

### Task 2: Fix Label Formatting (Add Colons) ⚠️ HIGH PRIORITY

**Files to check:**

- `client/src/components/NodeInspector/ParameterGroup.tsx`
- `client/src/components/NodeInspector/parameters/*Parameter.tsx`
- Where parameter labels are rendered

**Requirements:**

- [ ] Add colon suffix to all parameter labels
- [ ] Format: `label + ":"` → `"Sensor width:"`, `"Focal length:"`, etc.
- [ ] Ensure consistent across ALL parameter types (float, int, bool, enum, etc.)

**Implementation approach:**

```typescript
// In parameter component or utility
const formattedLabel = parameter.name + ':';
// or
<label>{parameterName}:</label>
```

### Task 3: Fix Label/Value Alignment ⚠️ HIGH PRIORITY

**Files to check:**

- CSS files for parameter styling
- `client/src/components/NodeInspector/ParameterGroup.module.css` (or similar)
- Grid/flexbox layout in parameter components

**Requirements:**

- [ ] Labels should be LEFT-aligned with colons at the end
- [ ] All input fields should align on their LEFT edge (forming a vertical line)
- [ ] Input fields should start just to the right of the widest label
- [ ] Visual result: All inputs start at the same horizontal position

**Visual Example:**

```
Sensor width:              [36.000]
Focal length:              [43.455845]
F-stop:                    [1000.0]
Field of view:             [45.000]
Perspective correction:    [checkbox]
                          ↑ All inputs align here (vertical line)
```

**Implementation approach:**

```css
/* CSS Grid approach - ensures all inputs align */
.parameterRow {
  display: grid;
  grid-template-columns: auto 1fr; /* label auto-sizes to widest, input takes remaining */
  gap: 8px;
  align-items: center;
}

.parameterLabel {
  text-align: left; /* Labels are left-aligned */
  white-space: nowrap;
}

.parameterInput {
  /* All inputs start at same position due to grid */
  width: 100%;
}
```

**Note:** The CSS Grid with `auto 1fr` columns automatically creates the vertical alignment because all rows share the same column widths - the first column expands to fit the widest label, making all inputs in the second column start at the same position.

### Task 4: Verify Input Styling (Steppers) 📋 MEDIUM PRIORITY

**Files to check:**

- Parameter component input rendering
- CSS for `<input type="number">` or custom input components

**Requirements:**

- [ ] Check if stepper controls (◄ ►) are present
- [ ] Verify they appear on hover/focus if they're browser native
- [ ] Ensure consistent styling across all numeric inputs

**Note:** The stepper controls might be:

1. Browser-native (input[type="number"]) - may vary by browser
2. Custom React components
3. Hidden in current screenshot due to different focus/hover state

### Task 5: Review Spacing and Visual Consistency 📋 LOW PRIORITY

**Files to check:**

- CSS spacing/padding in parameter components
- Group header spacing

**Requirements:**

- [ ] Verify consistent padding/spacing between parameters
- [ ] Check that it matches the original octaneSE spacing
- [ ] Ensure groups are properly separated

## 🔧 Implementation Order

1. **Task 2** (Labels + colons) - Quick fix, high impact
2. **Task 1** (Float formatting) - Critical for data display accuracy
3. **Task 3** (Alignment) - Visual polish, important for usability
4. **Task 4** (Steppers) - Verify, may already be correct
5. **Task 5** (Spacing) - Polish pass

## 🎯 Definition of Done

- [ ] All parameter labels have colons
- [ ] All float values show minimum 3 decimal places, up to 6
- [ ] Colons form a vertical alignment line (labels right-aligned)
- [ ] Visual appearance matches Image 2 (expected/correct version)
- [ ] TypeScript compilation passes
- [ ] No ESLint errors
- [ ] Build succeeds
- [ ] Visual testing confirms fix

## 📸 Reference Images

- **Image 1** (Current/Broken): See attached - missing colons, wrong float format
- **Image 2** (Expected/Correct): See attached - proper formatting and alignment
