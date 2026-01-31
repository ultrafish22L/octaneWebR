# Node Inspector Regression Fix Plan

## 🎯 Issues Identified

### 1. ❌ Float Formatting (ParameterControl.tsx:24-26)

**Current:**

```typescript
function formatFloat(value: number): number {
  return parseFloat(value.toFixed(6));
}
```

**Problem:** Returns a `number`, which displays as "36" instead of "36.000"

**Fix:** Return a formatted string with 3-6 decimals

```typescript
function formatFloat(value: number): string {
  const str = value.toFixed(6);
  const match = str.match(/^-?\d+\.(\d{3})(\d*)$/);
  if (match) {
    const trailing = match[2].replace(/0+$/, '');
    return `${str.slice(0, -match[2].length)}${trailing}`;
  }
  return value.toFixed(3);
}
```

### 2. ❌ Missing Colons (NodeInspector/index.tsx:188-189)

**Current:**

```tsx
<span className="node-title" title={buildTooltip()}>
  {name}
</span>
```

**Fix:** Add colon suffix

```tsx
<span className="node-title" title={buildTooltip()}>
  {name}:
</span>
```

### 3. ❌ Label/Input Alignment (node-inspector.css:809-854)

**Current layout:**

```css
.node-inspector .node-label {
  display: flex;
  gap: var(--spacing-none); /* No gap! */
}

.node-inspector .node-title {
  width: 120px; /* Fixed width - causes misalignment */
  flex-shrink: 2;
}

.node-inspector .node-parameter-controls {
  margin-left: auto; /* Pushes to right */
  min-width: 160px;
}
```

**Problem:**

- Fixed 120px width doesn't allow proper alignment
- No gap between label and controls
- Flex layout with `margin-left: auto` doesn't create vertical alignment line

**Fix:** Use CSS Grid or remove fixed width + add gap

```css
.node-inspector .node-label {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: center;
}

.node-inspector .node-title {
  /* Remove width: 120px */
  text-align: left;
  white-space: nowrap;
}

.node-inspector .node-parameter-controls {
  /* Remove margin-left: auto */
  justify-self: start; /* Align inputs to left edge */
}
```

## 📝 Implementation Steps

1. ✅ Fix `formatFloat()` in `ParameterControl.tsx` (return string, 3-6 decimals)
2. ✅ Update all float input `value` props to use string format
3. ✅ Add colon to label in `NodeInspector/index.tsx`
4. ✅ Update CSS layout in `node-inspector.css` for proper alignment
5. ✅ Test visual appearance matches reference image
6. ✅ Verify TypeScript compiles
7. ✅ Verify no functionality broken
