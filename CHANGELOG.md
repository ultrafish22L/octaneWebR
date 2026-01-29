# Changelog

All notable changes to octaneWebR will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added - Parallel Scene Loading Optimization (2025-02-01)
- **Phase 1: Parallel Fetching**: Massive performance improvement for scene synchronization
  - Created `parallelAsync.ts` utility with controlled concurrency functions
  - Refactored `SceneService.ts` to fetch data in parallel instead of sequentially
  - **Performance**: Expected 10-100x speedup for scene loading
    - 100-node scene: 30s → ~1.5s (20x faster)
    - 500-node scene: 150s → ~7s (21x faster)
  - **Features**:
    - Parallel metadata fetching (name, type, position, info)
    - Parallel owned items loading (50 concurrent max)
    - Parallel pin data fetching (50 concurrent max)
    - Parallel children building (removed artificial delays)
    - Error resilience with `Promise.allSettled()`
    - Performance logging with timing metrics
  - **Configuration**: `PARALLEL_CONFIG` in SceneService (tunable concurrency limits)
  - **Documentation**: See `PARALLEL_OPTIMIZATION.md` for complete details

### Changed - CSS Theme System (2025-02-01)
- **CSS Variable Naming Refactor**: Removed `octane-` prefix from all theme variables
  - Updated 753 occurrences across 7 files
  - Cleaner naming: `--bg-primary` instead of `--octane-bg-primary`
  - Zero naming conflicts with existing utility variables
  - CSS bundle size reduced 5.26 KB (104.44 KB → 99.18 kB)
  - Files affected:
    - `client/src/styles/octane-theme.css` - Variable definitions
    - `client/src/styles/app.css` - App-level styles
    - `client/src/styles/node-graph.css` - Node graph styles
    - `client/src/styles/node-inspector.css` - Inspector styles
    - `client/src/styles/scene-outliner.css` - Outliner styles
    - `client/src/styles/viewport.css` - Viewport styles
    - `client/src/components/MenuBar/MenuDropdown.tsx` - Dynamic variable access

### Fixed - UI Issues (2025-02-01)
- **React Flow Container Error**: Fixed "React Flow parent container needs width/height" console warning
  - Added explicit `width: 100%` and `height: 100%` to ReactFlow component style
  - React Flow requires dimensions on component itself, not just parent container
- **Browser Context Menu**: Fixed native context menu appearing over custom menus
  - Added `event.stopPropagation()` to NodeGraph and Viewport components
  - Prevents browser context menu from overlaying custom menus

### Changed - Tooltip Behavior (2025-02-01)
- **Node Pin Tooltips**: Simplified to show only pin name
  - Removed type, description, and connection status info (was too verbose)
  - Cleaner, less cluttered hover experience
  - Modified `client/src/components/NodeGraph/OctaneNode.tsx`
- **Node Inspector Tooltips**: Added descriptive tooltips to parameter items
  - Shows full descriptions from pinInfo/attrInfo/nodeInfo
  - Priority: pinInfo.description > attrInfo.description > nodeInfo.description
  - Modified `client/src/components/NodeInspector/index.tsx`

### Changed - CSS Optimization (2025-02-01)
- **Dead Code Removal**: Cleaned up CSS files
  - Removed 6 unused CSS variables
  - Removed 5 dead CSS selectors with broken variable references
  - Fixed 10+ duplicate CSS definitions across files
  - Replaced all hardcoded colors with CSS variables
  - All colors now use theme system for consistency

### Commits (2025-02-01)
- `5bebfcd` - Fix React Flow parent container sizing error
- `20f1c5b` - Remove 'octane-' prefix from all CSS theme variables
- `05b4e52` - Set Alpha 5 as default API version
- `3c97abd` - Add descriptive tooltips to node inspector items
- `01320b2` - Simplify node pin tooltips to show name only
- `e0f3a83` - Fix browser context menu appearing on node graph and viewport backgrounds
- `c896f10` - Remove redundant CSS variables and add node-bg aliasing
- `08b3f1c` - Complete CSS hardcoded values to theme variables conversion
- `4cd9a4b` - Add CSS variable for minimap background
- `7edb265` - Replace hardcoded background colors with CSS variables
- `f78ea98` - Fix dropdown and context menu background color
- `ed8bd8d` - Phase 4E: CSS variable cleanup - Remove 6 unused variables
- `fb4d0a1` - Phase 4D: Remove 5 dead CSS selectors with broken variable references
- `acfd485` - Phase 4C: Remove 10 dead CSS definitions overridden by load order
- `10a1bf1` - Phase 4B: Fix same-file CSS duplicate definitions
- `d66e418` - Phase 4A: Fix obvious CSS duplicate definitions
- `46003ea` - Phase 3: Remove redundant octane- prefix from CSS classes
- `487867e` - Remove temporary CSS analysis scripts

---

### Added - API Version Compatibility (2025-01-31)
- **Centralized API Configuration**: Single source of truth for Alpha 5/Beta 2 API versions
  - `api-version.config.js` - ES module configuration file
  - Switch between Alpha 5 (proto_old) and Beta 2 (proto) by editing one line
  - Vite `define` feature injects `__USE_ALPHA5_API__` constant at build time
  - Server uses direct ES imports, client uses injected constant
  - Guaranteed sync between client and server configurations
- **API Version Documentation**:
  - `QUICK_START_API_VERSION.md` - Quick reference for switching versions
  - `API_VERSION_SWITCHING.md` - Detailed technical documentation
  - Updated `AGENTS.md` with Recent Development Status section
  - Updated `README.md` with API Version Support section

### Changed - Module System (2025-01-31)
- **ES Module Conversion**: Fixed browser compatibility issues
  - Converted `api-version.config.js` from CommonJS to ES modules
  - Removed `apiVersionImport.ts` bridge (obsolete with Vite define approach)
  - Server plugin (`vite-plugin-octane-grpc.ts`) uses ES imports
  - Client code (`apiVersionConfig.ts`) uses Vite-injected global constant
- **TypeScript Strict Typing**: Fixed implicit `any` type errors
  - Explicitly typed `forEach` callback parameter: `(callback, index: number) => ...`
  - All code passes strict TypeScript compilation

### Fixed - Browser Errors (2025-01-31)
- **Module Error**: Fixed `module is not defined` error in browser
  - Root cause: CommonJS `module.exports` not supported in browser
  - Solution: Convert to ES module `export` statements
- **API Version Desync**: Fixed client/server configuration mismatch
  - Previous: Separate configs could get out of sync causing "Method not found" errors
  - Current: Single config file ensures both client and server use same settings

### Commits (2025-01-31)
- `bcf7574` - Docs: Update AGENTS.md with API version configuration status
- `af1609b` - Fix: Convert API version config to ES modules and fix TypeScript errors
- `4249989` - Add quick-start guide for API version switching
- `df63f18` - Fix API version compatibility with centralized configuration

---

### Added - Code Quality (2025-01-30)
- **Logger System**: Centralized multi-level logging (670+ calls)
  - `Logger.debug()`, `Logger.error()`, `Logger.warn()`, `Logger.info()`, `Logger.success()`
  - `Logger.network()`, `Logger.api()` for specialized logging
  - Distribution: 66% DEBUG, 24% ERROR, 9% WARN, <1% other
  - Emoji prefixes for easy console filtering (🔍 ❌ ⚠️ ✅ 🌐)
- **Command History**: Full undo/redo implementation
  - 50-action history with branching behavior
  - Discards redo stack on new action (prevents complex tree history)
  - Command pattern implementation in `services/CommandHistory.ts`
- **Architectural Documentation**: Enhanced 7 core service files
  - Added design rationale comments (why, not what)
  - Documented gRPC conventions, API quirks, edge cases
  - Explained scene tree building strategy, pin connection model
  - Added render pipeline documentation (RenderEngine → RenderTarget → FilmSettings)
  - Created `DOCUMENTATION_IMPROVEMENTS.md` summary

### Changed - Code Review (2025-01-30)
- **Logging Conversion**: Replaced 400+ `console.*` calls with `Logger.*`
  - High-frequency operations → `Logger.debug()` (connection checks, position updates)
  - Errors → `Logger.error()` with descriptive messages
  - User actions → `Logger.info()` or `Logger.success()`
  - Network events → `Logger.network()` (connections, disconnects)
- **Comment Cleanup**: Removed redundant comments across 33 files
  - Eliminated obvious "what" comments (code is self-documenting)
  - Kept non-obvious "why" comments (design decisions, edge cases)
  - Added architectural context where missing
- **Service Documentation**:
  - `ApiService.ts`: Documented objectPtr wrapper requirements
  - `ConnectionService.ts`: Explained WebSocket timing race condition fix
  - `SceneService.ts`: Added tree building strategy docs (NodeGraph vs Node)
  - `NodeService.ts`: Documented pin connection model and cleanup logic
  - `RenderService.ts`: Explained render pipeline structure
  - `MaterialDatabaseService.ts`: Clarified LocalDB vs LiveDB differences
  - `CommandHistory.ts`: Documented undo/redo branching with examples

### Commits (2025-01-30)
- `56179eaf` - Improve code documentation for experienced programmers (+87 lines)
- `83e67eb5` - Convert high-frequency network/success logs to DEBUG (pass 2)
- `32a834e1` - Code review: Convert console.* to Logger.* with appropriate log levels (+899/-666)

---

## [1.0.1] - 2025-01-29

### Added
- OpenHands skills system in `.openhands/skills/` directory
  - `octane-grpc/SKILL.md` - gRPC patterns and troubleshooting
  - `node-inspector/SKILL.md` - NodeInspector architecture and dropdown feature
  - `testing-workflow/SKILL.md` - Complete testing routine and debugging
  - `scene-graph/SKILL.md` - Scene graph structure and patterns
  - `react-patterns/SKILL.md` - React/TypeScript conventions
- Skills README.md documenting the on-demand knowledge system

### Changed
- Refactored `AGENTS.md` from 595 lines to 315 lines (47% reduction)
- Moved domain-specific knowledge from AGENTS.md to specialized skill files
- Updated all core documentation files (README, QUICKSTART, DEVELOPMENT, CHANGELOG)
- Removed external path references from documentation
- Fixed port numbers throughout documentation (58407 → 57341)
- Cleaned up 24 temporary markdown documentation files (icon extraction working docs, session reports, etc.)

### UI Refinements
- **Scene Outliner Tabs**: Added tab bar with right-slanted overlap effect matching Octane SE
  - Black outline (1px solid) with 3px padding
  - Active tab: `--octane-bg-secondary`, Inactive: `--octane-bg-lighter`
  - Z-index stacking for proper left-to-right overlap
- **Node Graph Editor Tabs**: Added matching tab bar with single "Scene" tab
  - Vertical toolbar on left (26px width) extending to top
  - Tab bar positioned to right of toolbar in horizontal row
  - Tabs aligned to bottom of row for proper integration
  - Constrained tab width (max-width: 120px) matching Octane SE reference

---

## [1.0.0] - 2025-01-22

### Added - Core Features

#### Node Graph Editor
- ReactFlow-based node graph with 755+ node types
- Right-click context menu with 25 categories
- Drag-and-drop pin connections with automatic type-based coloring
- Multi-select, copy/paste, duplicate, delete operations
- Connection cutter tool (Ctrl+Drag)
- Node search dialog (Ctrl+F)
- Minimap navigation
- Bidirectional sync with Octane scene

#### Scene Outliner
- Hierarchical tree view with expand/collapse
- Type-specific icons (300+ PNG icons)
- Visibility toggles
- Selection synchronization with Node Graph
- LiveDB tab for OTOY material library
- LocalDB tab for local materials and node groups

#### Node Inspector
- Real-time parameter editor with full type support:
  - Boolean checkboxes
  - Numeric inputs (int/float with range validation)
  - Vector inputs (float2/float3/float4)
  - Color pickers (RGB/RGBA with hex input)
  - Enum dropdowns
  - Text fields
- Collapsible parameter groups
- Instant synchronization with Octane
- **Node type dropdown** for non-end nodes (replacing current node)

#### Render Viewport
- Real-time render output streaming
- Interactive camera controls (orbit, pan, zoom)
- HDR display support
- Resolution and render mode controls
- Picker tools: Material, Object, Focus, Camera Target, White Balance
- Canvas-based display with WebGL support

#### Menu System
- Complete menu bar matching Octane SE:
  - **File**: New, Open, Save, Package, Render State, Preferences
  - **Edit**: Undo, Redo, Cut, Copy, Paste, Delete, Select All
  - **Script**: Batch Rendering, Daylight Animation, Turntable Animation
  - **View**: Panel visibility, Refresh Scene (F5)
  - **Window**: Material Database, Reset Layout, Fullscreen (F11)
  - **Help**: Documentation, Shortcuts, Report Bug, About
- Platform-aware keyboard shortcuts (Ctrl/Cmd)

### Added - Infrastructure

#### Service Layer
- `BaseService` - Abstract base class with event emitter
- `ConnectionService` - WebSocket connection management
- `SceneService` - Scene tree and node operations
- `NodeService` - Node CRUD operations with `replaceNode()` method
- `ViewportService` - Camera and viewport state
- `RenderService` - Render control and streaming
- `MaterialDatabaseService` - LiveDB/LocalDB access
- `DeviceService` - Device and system operations
- `OctaneClient` - Main API facade

#### gRPC Integration
- Vite plugin for embedded gRPC-Web proxy
- TypeScript types auto-generated from proto files
- WebSocket-based callback streaming
- Full type safety across gRPC API
- Connection health monitoring

#### Styling & Theming
- CSS Variables theme system (134 variables)
- `octane-theme.css` - Theme definitions
- Component-scoped CSS files:
  - `app.css` - Menu, panels, status bar
  - `scene-outliner.css` - Tree view
  - `viewport.css` - Render viewport
  - `node-graph.css` - Node editor
  - `node-inspector.css` - Parameter controls
- Dark theme matching Octane SE
- No inline styles, no hardcoded colors

### Added - Build System
- Vite 5 with HMR (Hot Module Replacement)
- TypeScript strict mode with zero `any` types
- Proto file compilation with `grpc-tools`
- Concurrent dev server (client + proxy)
- Production build with tree-shaking and minification

### Added - Documentation
- `README.md` - Project overview and features
- `QUICKSTART.md` - Setup guide
- `DEVELOPMENT.md` - Architecture and patterns
- `AGENTS.md` - AI assistant memory and workflows
- `CHANGELOG.md` - Version history (this file)

---

## [0.9.0] - 2025-01-20

### Added - Beta Features
- Initial UI layout with resizable panels
- Basic node graph with limited node types
- Scene tree viewer (read-only)
- Simple parameter editor
- Static render display
- Menu bar structure

### Changed
- Migrated from REST to gRPC-Web for Octane communication
- Switched from Redux to Zustand for state management
- Refactored from class components to functional components + hooks

---

## [0.5.0] - 2025-01-15

### Added - Alpha Features
- Proof-of-concept React app
- Basic gRPC connection to Octane
- Simple node creation test
- WebSocket streaming prototype

---

## [0.1.0] - 2025-01-10

### Added - Initial Setup
- Project structure
- Dependencies (React, TypeScript, Vite)
- gRPC proto files
- Basic build configuration

---

## Version History Summary

| Version | Date | Milestone |
|---------|------|-----------|
| **1.0.0** | 2025-01-22 | Production-ready release |
| 0.9.0 | 2025-01-20 | Beta with core features |
| 0.5.0 | 2025-01-15 | Alpha prototype |
| 0.1.0 | 2025-01-10 | Initial setup |

---

## Feature Categories

### ✅ Complete
- Node Graph Editor
- Scene Outliner
- Node Inspector
- Render Viewport
- Menu System
- Service Layer
- gRPC Integration
- Theme System
- Build Pipeline

### 🚧 In Progress
- Material Database (LiveDB/LocalDB browsing working, drag-and-drop pending)
- Picker Tools (UI complete, some tools pending)
- Animation Scripts (menu items added, scripts pending)

### 📋 Planned
- Keyboard shortcut customization
- Custom themes (light theme, high contrast)
- Plugin system
- Advanced render settings dialog
- Batch render queue management
- Node library favorites
- Recent files menu
- Scene comparison view

---

## Breaking Changes

None yet (version 1.0.0 is first stable release).

---

## Migration Guide

### From 0.9.x to 1.0.0

**API Changes:**
- `NodeService.createNode()` now returns `Promise<number>` (node handle) instead of full node object
- `SceneService.loadTree()` renamed to `SceneService.loadSceneTree()` for clarity
- Event names standardized: `node-created` → `node:created`, `scene-loaded` → `scene:loaded`

**UI Changes:**
- Node Inspector now shows dropdown for compatible node types
- Scene Outliner icons updated to match Octane SE 2023
- Viewport controls repositioned to match Octane SE layout

**Build Changes:**
- Vite upgraded from 4.x to 5.x
- TypeScript upgraded from 5.0 to 5.2
- ReactFlow upgraded from 11.x to 12.x

**Migration Steps:**
1. Update imports: `import { loadTree }` → `import { loadSceneTree }`
2. Update event listeners: `.on('node-created')` → `.on('node:created')`
3. Update API calls: Handle `createNode()` returns number instead of object
4. Run `npm install` to update dependencies
5. Run `npx tsc --noEmit` to check for type errors
6. Run `npm run build` to verify build succeeds

---

## Credits

- **OTOY Inc.** - Octane Render and gRPC LiveLink API
- **ReactFlow** - Node graph editor library
- **Vite** - Build tool and dev server
- **React** - UI framework

---

**Maintained by**: OTOY Development Team  
**Last Updated**: 2025-01-29  
**Status**: Active Development
