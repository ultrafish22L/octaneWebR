# CSS Consolidation Report

## Summary
Consolidated 8 duplicate CSS selectors + 3 duplicate @keyframes definitions across 5 files.

**Impact**: Removed 71 net lines of conflicting CSS (82 deletions, 11 comment insertions)

## Strategy
- **Domain-specific selectors** → Keep in specific file (viewport.css, scene-outliner.css)
- **Shared components** → Keep in app.css
- **Animations** → Keep in app.css

## Duplicates Removed

### 1. Viewport Components (domain-specific → viewport.css)
- `.render-viewport` - Removed from app.css
  - CONFLICTING: app.css had flex layout, viewport.css had proper sizing
- `.viewport-overlay` - Removed from app.css
  - CONFLICTING: Different background and display properties

### 2. Scene Tree Components (domain-specific → scene-outliner.css)
- `.scene-tree` - Removed TWO definitions from app.css (lines 100, 251)
  - CONFLICTING: app.css had generic styles, scene-outliner.css had detailed layout
- `.tree-node:hover` - Removed from app.css
  - CONFLICTING: Different background colors
- `.tree-node.selected` - Removed from app.css
  - CONFLICTING: Different selection styling approach

### 3. Shared Components (consolidated → app.css)
- `.modal-dialog` - Removed from node-graph.css
  - CONFLICTING: Different dimensions, border-radius, shadows
- `.control-btn:hover` - Removed from viewport.css
  - SIMILAR: app.css version more complete (includes border-color)
- `.loading-spinner` - Removed from node-inspector.css
  - CONFLICTING: Different sizes (32px vs 24px)

### 4. Animations (consolidated → app.css)
- `@keyframes spin` - Removed from:
  - node-inspector.css (1 definition)
  - scene-outliner.css (2 definitions!)
  - Total: 3 duplicate animations removed

## Files Modified
1. `app.css` - 44 lines removed (viewport & scene duplicates)
2. `node-graph.css` - 11 lines removed (.modal-dialog)
3. `node-inspector.css` - 15 lines removed (.loading-spinner + @keyframes)
4. `scene-outliner.css` - 15 lines removed (2x @keyframes spin)
5. `viewport.css` - 4 lines removed (.control-btn:hover)

## Bugs Fixed
These weren't just duplicates - they were **CONFLICTING definitions**!
- CSS cascade meant "last loaded wins" → unpredictable styling
- Consolidated to single source of truth per selector
- Domain-specific files now own their components
