# OctaneWebR vs Octane UI Differences

Compared against OctaneRender Studio 2026.1 Alpha 5 (Internal Build)

## Completed

1. ~~**Renderbar lock is a toggle, should default to unlocked**~~ ✅ Dynamic icon switching (lock/unlock) with unlocked default.
2. ~~**Remove zoom toolbar from render viewport title bar**~~ ✅ Removed from App.tsx viewport header.
3. ~~**Node graph nodes too bright / lack 3D effect**~~ ✅ Darkened bodies (saturation ×0.12, lightness capped at 28), stronger 3D gradient.
4. ~~**Mesh node icon wrong**~~ ✅ Changed to `MESH node.png`.
5. ~~**Node graph grey left cap too dark**~~ ✅ Lightened to `#909090` with matching 3D gradient.
6. ~~**Yellow highlight too bright + inconsistent app-wide**~~ ✅ Unified `#9a7b20` across all components. Shared CSS for all button bars.
7. ~~**Stats bar "(finished)" text is white in Octane**~~ ✅ White in Octane theme, blue preserved for vibe theme.
8. ~~**Node inspector colored caps are darker in Octane**~~ ✅ Added `brightness(0.7)` filter + 3D bevel gradient on full `.node-box` row.
9. ~~**Tooltips should have yellow background**~~ — Skipped. Native `title` tooltips can't be CSS-styled; custom tooltip component would be too much churn. White is fine.
10. ~~**Node graph toolbar: render target button default selected**~~ ✅ `renderTargetPreview` defaults to `true`.
11. **Tooltip text audit needed** — Go through all toolbar button tooltips interactively to verify they match Octane's actual descriptions. (Deferred — requires interactive session.)

## Medium Priority

12. **Status bar progress bars** — Octane has a progress bar on the left showing sample progress, and one on the right showing GPU memory usage. Our GPU memory stats don't seem to be working either.

13. **Scene outliner tree connectors** — Octane has a small dark box around the +/- expand icons and dark vertical lines connecting nodes at the same level. Our icons are fine but lack the tree connector lines.

## Low Priority / Nice-to-Have

14. **Numeric input increment/decrement arrows** — Octane uses ◄ ► arrow icons on either side of numeric inputs. Would be nice but bottom of the list.

15. **Parameter node expand/collapse** — Octane has small square icons next to attribute labels for expanding/collapsing parameter sub-nodes. A maybe — could be overkill.

16. **Activation status in footer** — Octane shows "Activated" at bottom-right, meaning credentials were verified with the Octane site. Bottom of list — may have API calls to get this info.

## Not Issues

- **Axis indicator in viewport** — Octane doesn't show one; that's actually a bug in Octane, not a missing feature in our app.
- **Button sizes** — Ours are fine as-is.
- **Node graph connection lines** — Already look good.
- **Status bar layout** — Looks good aside from the missing progress bars noted above.
