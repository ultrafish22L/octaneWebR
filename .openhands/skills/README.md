# octaneWebR Skills

**On-demand knowledge for OpenHands AI assistants**

This directory contains specialized skills that provide deep domain-specific knowledge. Skills are loaded when specific keywords appear in conversations or when the AI needs detailed information.

---

## How Skills Work

### Automatic Loading

OpenHands loads these skills based on **trigger keywords**. When you mention a trigger word in your message, the relevant skill is loaded into the AI's context.

**Example**:
- You say: "I need to debug the gRPC connection"
- OpenHands loads: `octane-grpc/SKILL.md` (triggered by "grpc")
- The AI now has deep knowledge of gRPC patterns in this project

### Skill Format

Each skill is a markdown file (`SKILL.md`) with YAML frontmatter:

```markdown
---
name: skill-name
description: What this skill contains
triggers:
  - keyword1
  - keyword2
  - phrase with spaces
---

# Skill Content

Deep domain knowledge here...
```

---

## Available Skills

### 🔌 octane-grpc/
**Focus**: Octane gRPC API integration  
**Triggers**: `grpc`, `proto`, `api`, `service layer`, `node service`

**Contains**:
- gRPC call patterns (proto → service → client → component)
- Proto file locations and usage
- Service layer architecture
- Common gRPC operations (create, delete, connect nodes)
- Event-driven communication patterns
- Proxy server pattern
- Debugging gRPC calls
- Recent discoveries (e.g., node replacement pattern)

**When to use**: Adding new API calls, debugging gRPC issues, understanding service layer

---

### 📋 node-inspector/
**Focus**: NodeInspector component and parameter editing  
**Triggers**: `node inspector`, `inspector`, `properties`, `parameters`, `dropdown`

**Contains**:
- NodeInspector component architecture
- Node type dropdown feature (complete implementation)
- Parameter editing patterns (int, float, bool, enum, color)
- Adding new inspector features
- UI state preservation
- Styling guidelines for inspector
- Common gotchas (parameter name typos, wrong pin types)
- Visual debugging session notes

**When to use**: Working on properties panel, adding inspector features, debugging parameter editing

---

### 🌳 scene-graph/
**Focus**: Scene graph structure and tree manipulation  
**Triggers**: `scene`, `outliner`, `tree`, `graph`, `hierarchy`, `node connections`

**Contains**:
- Scene graph data structures (SceneNode, Pin)
- Fetching scene graph (tree, node info, connections)
- SceneOutliner component architecture
- NodeGraph component (ReactFlow integration)
- Tree traversal utilities (flatten, find by handle, find path)
- Expand/collapse state management
- Selection synchronization between components
- Batch operations
- Performance tips (virtualization, memoization)

**When to use**: Working with scene hierarchy, node relationships, outliner/graph components

---

### 🧪 testing-workflow/
**Focus**: Development testing and debugging  
**Triggers**: `test`, `debug`, `workflow`, `build`, `verify`, `server`

**Contains**:
- Complete 9-step testing routine (stop → typecheck → build → start → test → review → stop)
- Server management (ports 57341, 49019)
- Health check procedures
- Browser testing checklist
- Feature-specific testing (dropdown, parameters, scene ops)
- Debugging techniques (console logs, network tab, React DevTools, visual debugging)
- Common issues & solutions (blank page, hot reload, gRPC failures)
- Performance testing (bundle size, load time, memory)
- Quick test script (`test-dev.sh`)

**When to use**: Testing features, debugging issues, verifying builds, learning the workflow

---

### ⚛️ react-patterns/
**Focus**: React component patterns and best practices  
**Triggers**: `react`, `component`, `hook`, `state`, `zustand`, `useEffect`

**Contains**:
- Component architecture (structure, patterns)
- State management with Zustand
- Custom hooks (`useOctane`, `useNodeData`, `useOctaneEvent`)
- Event-driven architecture patterns
- Performance optimization (memo, useMemo, useCallback, virtualization)
- Common patterns (loading states, form handling, controlled inputs)
- Common pitfalls (missing deps, infinite loops, stale closures, event cleanup)
- TypeScript patterns (typed props, state, events)
- Styling patterns (CSS Modules, conditional classes)

**When to use**: Building components, managing state, optimizing performance, debugging React issues

---

## When to Update Skills

Add knowledge to a skill when you:
- ✅ Discover a new pattern or technique in that domain
- ✅ Debug a tricky issue and learn something valuable
- ✅ Find a performance optimization
- ✅ Learn about undocumented behavior
- ✅ Create a useful helper or utility
- ✅ Have an "aha!" debugging moment worth sharing

**Before updating**:
1. Choose the right skill (or create a new one if needed)
2. Ensure the knowledge is **reusable** (applies to future tasks)
3. Write **clear examples** with code snippets
4. Add **context** about when/why to use the pattern

---

## Creating New Skills

When you discover a new domain that needs its own skill:

### 1. Create Directory and File
```bash
mkdir -p .openhands/skills/my-new-skill
touch .openhands/skills/my-new-skill/SKILL.md
```

### 2. Add Frontmatter
```markdown
---
name: my-new-skill
description: What this skill provides
triggers:
  - relevant
  - keywords
  - or phrases
---
```

### 3. Write Content
- **Focus**: One specific domain
- **Structure**: Clear sections with examples
- **Examples**: Real code from this project
- **Gotchas**: Common mistakes to avoid
- **When to use**: Guidance on when this skill is relevant

### 4. Update This README
Add a section describing the new skill.

---

## Skill vs AGENTS.md

**AGENTS.md** (Always loaded):
- Essential repository knowledge
- Common commands
- High-level architecture
- Code conventions
- Recent major features (concise)

**Skills** (Loaded on demand):
- Deep domain knowledge
- Detailed implementation patterns
- Complete workflows
- Extensive code examples
- Debugging techniques

**Rule of thumb**: If it's essential for EVERY session → AGENTS.md. If it's needed for specific tasks → Skills.

---

## File Sizes

```
octane-grpc/SKILL.md      ~9KB   (gRPC patterns)
node-inspector/SKILL.md   ~12KB  (Inspector component)
scene-graph/SKILL.md      ~15KB  (Scene/graph manipulation)
testing-workflow/SKILL.md ~13KB  (Testing/debugging)
react-patterns/SKILL.md   ~17KB  (React best practices)
```

**Total skills**: ~66KB of specialized knowledge  
**AGENTS.md**: ~8KB (concise essentials)

This keeps AGENTS.md focused while providing deep knowledge on demand.

---

## Examples of Good Skill Content

### ✅ Good: Specific Pattern with Example
```markdown
### Node Replacement Pattern (Jan 2025)
When replacing a node while maintaining connections:

```typescript
async replaceNode(oldHandle: number, newType: string): Promise<number> {
  // 1. Get parent connections FIRST (before deleting)
  const parents = await this.getNodeParents(oldHandle);
  
  // 2. Create new node
  const newHandle = await this.createNode(newType);
  
  // 3. Reconnect to parents
  for (const p of parents) {
    await this.connectPinByIndex(p.parentHandle, p.pinIndex, newHandle);
  }
  
  // 4. Delete old node LAST
  await this.deleteNode(oldHandle);
  
  return newHandle;
}
```

**Key insight**: Get parent connections before deletion, or they're lost!
```

### ❌ Bad: Too Vague
```markdown
Make sure to handle connections properly when replacing nodes.
```

### ✅ Good: Debugging Story
```markdown
### Visual Debugging Session (Jan 2025)

**Problem**: Dropdown only showing for top-level node, not nested nodes.

**Debug approach**:
1. Added console.log to shouldShowDropdown()
2. Realized condition checked isRenderTarget instead of parameters
3. Changed to: `node.parameters && node.parameters.length > 0`
4. Used DevTools Elements tab to verify dropdown rendered
5. Success!

**Key insight**: Use browser Elements inspector to visually verify components render.
```

---

**Last Updated**: 2025-01-28  
**Maintained By**: AI assistants and human developers working on octaneWebR
