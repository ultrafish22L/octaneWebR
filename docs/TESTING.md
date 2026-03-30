# Testing

App-level testing for octaneWebR. For MCP tool testing (scene building), see [mcp/TESTING.md](mcp/TESTING.md).

## Unit Tests

```bash
npm test                    # 289 tests via Vitest
npm test -- --watch         # Watch mode
npm test -- --coverage      # Coverage report
```

Test suites cover: SceneCache, MCP tools, utils, constants, ArtDirectionState, geometric validation.

## Lint & Type Check

```bash
npm run lint                # ESLint
npm run build               # Includes TypeScript type check
```

Pre-commit hooks (Husky) run linting and type checks automatically.

## Manual UI Testing

1. Start octaneServGrpc + dev server (`npm run dev`)
2. Open http://localhost:43929
3. Load a scene — outliner should populate
4. Select a node — inspector shows properties
5. Render viewport shows live image
6. Node graph shows connections

## Browser Tests

Manual verification of UI components:

- Scene outliner (tree, selection, icons)
- Node graph editor (connections, drag, context menus)
- Inspector (parameter editing, type-specific inputs)
- Viewport (render streaming, picker tools, camera controls)
- Theming (3 themes, CSS variables)

## Pre-Push Checklist

```bash
npm test                    # All tests pass
npm run lint                # No lint errors
npm run build               # Builds clean (includes type check)
cd mcp && npm run build     # MCP builds clean
```
