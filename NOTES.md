# User Notes — Captured from Debug Sessions

All notes typed by the user during extended debugging/development sessions. Organized by topic for reference.

---

## Octane Behavior & Architecture

- Item handles are always unique and items don't change remotely.
- "Start render" button doesn't initiate render if it's already in that mode — this is correct Octane behavior.
- Any time a render target is selected, it should make the API call to select it in the render engine.
- Mesh is a file node — when you choose it from the create menu, it should pop a file dialog to pick the mesh file. Same for any node type that comes from a file (e.g. RGB texture).
- Octane doesn't have any way to select connections except at the ends (check docs.otoy.com/standaloneSE).
- There are protos to set preferences — the inverse functions used to get them.
- Octane's scene collapse button: the "Scene" level doesn't have connector lines, but all nodes below do.

## Scene Loading & Syncing

- "Don't rush, teapot scene should respond OK, but large scenes may take time for syncing."
- Scene sync for large scenes: load all first-level nodes and display them, then add all connections (second level). At that point UI is good for anything except digging deeper, which still happens. Preferentially load stuff visible in the UI first.
- Sequential scene tree built in 146s (448 items, 7424 nodes) vs Progressive at 702s — UI updates shouldn't slow down the load time that much.
- Events "emitted synchronously from the async loading loop" should be queued and not block/slow the async load.
- All panels should update as any new info arrives, just don't block the async load.
- `findNodeInTree()` — shouldn't those use the `scene.map`?
- Wait for full scene sync before passing judgment on test results.

## Testing Philosophy

- "I'm not sure the issue is concurrency, double check."
- "We're not checking your work enough — remember that."
- "You are hallucinating, there have never been visible progress bars in the stats bar."
- "Really look and ask me before declaring victory."
- "In the future you need to wait for full scene sync before passing judgment, note that."
- Test frequently — don't wait so long between testing the app.
- Orthographic checkbox toggle is the standard E2E test (tests parameter set propagation).
- When skipping tests, don't be concerned about changing the scene — that's the point. You can always reload teapot.orbx (requires user to click a dialog in Octane).
- Operations that make visible UI changes (delete, add, connect, change node type) should always take a screenshot with a good name for later debug analysis. Screenshot name should include the bug ID.
- Keep files for all info — info got lost during compaction before.
- Debug start should begin with asking user to restart Octane with a given scene, then waiting for go-ahead.

## UI Matching Octane

### Node Graph Editor

- Nodes should have a thin black border.
- Node pin colors are too bright — match Octane; pins are slightly translucent.
- Pin centers should sit exactly on the node border lines.
- Selection color brightness should be unified app-wide — node graph editor select was too bright.
- Node graph nodes: caps lighter, more desat on body (iterated several times to match).
- Standard fixed size for gaps on left and right side of the node name.
- Minimum node size should be 1/3 original.
- Node icon should be centered in the left cap box.
- Node name font bumped up.

### Scene Outliner

- Octane's tree connector lines: thicker, vertical lines go through center of +/- boxes.
- Scene's -/+ box has no vertical line; RenderTarget's +/- box has vertical line to its sibling.
- Camera's +/- box has vertical lines behind all sibling +/- boxes, each gets a horizontal stub.
- Horizontal stubs extend to end nodes; nodes slightly too far left.
- Selection: yellow highlight only on icon and label (to end of label text), with 3D effect. Not the whole line.
- Scene has its own icon.
- +/- boxes don't have white outline, are slightly larger and rounder.

### Render Bar & Stats Bar

- Render "play" button should be selected/highlighted by default.
- Lock is a toggle and should default to unlocked.
- Button selection style should match render bar style app-wide.
- All button bars should share CSS with render bar: no unlighted border, yellow select.
- Yellow highlight is not as bright in Octane.
- Octane doesn't have the little zoom toolbar in the render viewport title bar.
- Break lines from Octane's render bar should be added.
- Render target button should be selected by default.
- Sample text (left side of stats bar) should match right side text style brightness.
- "(rendering...)" text, and should say "(finished)" when samples match max.
- "(finished)" text is white in Octane (move blue to vibe theme).
- GPU memory progress bar on right side of stats bar.
- Progress bar: a bit wider, lighter color, has black and white border.

### Context Menus & Dialogs

- All context menus should have dark background (matching GPU stats dialog).
- File submenus are dark — match them in context menus.
- GPU statistics dialog: remove unneeded "selected" border; fix z-index behind panel resize line.
- Tooltips should have yellow background.
- GPU dialog pops on right-clicking anywhere in the render bar.

### Node Inspector

- Expanded parent nodes should have rounded right side on icon box; collapsed/end nodes have straight right side.
- Parameter bar gets the 3D gradient effect.

### Themes

- Copy current theme to "vibe" first; "theme-octane" should match Octane as closely as possible.
- Make only errors red in logs.

## File Operations

- When Octane is local, it should pop a native file dialog with browsing for the local filesystem. When remote, it calls an endpoint for possible files.
- This applies to all cases: file menu, file toolbar, creating nodes that take filename attributes.
- Cannot use API file chooser — stub out remote stuff with a file tree for now.
- File dialog should remember last path and start from there next open.
- Save render and save render passes should share the same path memory.
- Export render passes should look like save render passes with file name input (not "select folder").
- Save render passes: code should tack `_beauty` and extension on end of name (and name of other render passes). Protos should have render pass name-to-index somewhere.

## Code Quality / Review Notes

- "I'm still surprised that each new review keeps finding critical issues and more."
- "I'm curious why every review finds new stuff?" — Fair point: each pass goes deeper.
- "Each new review keeps finding stuff" — do strict reviews, check web if necessary.
- Logger calls need `this.level >=` or `<` to work correctly (enum ordering matters).
- `env.development` doesn't have any used values.
- RequestQueue: have a configurable constant for max size, 0 means no queuing. Default to 0.
- Dual-server concern: shared class (`OctaneGrpcClientBase`) already exists.
- App.tsx state concentration: decompose into custom hooks (done — 5 hooks).
- Replace node does happen when you pick a new node type in the dropdown (user initially said it didn't, then corrected).
- The ID should be built into the table that builds the dropdown list.

## Version History

- v1.2.3 was set at one point, then updated through subsequent versions.
- Version text moved to right side of footer; default status text is "Ready" (no period).
- Temp status messages last twice as long.
- Get rid of "Octane Live" on the right in the footer.

## Misc

- Update OTOY copyrights end year to 2026.
- Remove `.openhands` directory.
- Logger: no prefix tags like `[INFO]`, just use color for errors and warnings.
- Server terminal should only log server messages.
- Create proper log levels in server code with good info/debug/debugV balance.
- Connection line in node graph was missing at one point (turned out to be transient).
- Axis in render viewport should rotate with the camera (if enabled).
