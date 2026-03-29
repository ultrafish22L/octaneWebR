/**
 * SceneCache — lightweight in-memory scene graph cache for MCP.
 *
 * Tracks which nodes exist, their types, and pin connections.
 * Pure hint layer for enriching AI responses — not a validator.
 * The gRPC server is the sole authority on handle validity.
 *
 * Design rules:
 * - Lazy population: starts empty, filled by get_scene_tree (full sync)
 *   and incrementally by mutation tools (create_node, delete_node, etc.)
 * - Hint layer, not source of truth: critical ops verify against live gRPC.
 * - Cleared on: load_project, reset_project.
 */

// DEBUG: cache mutation logger — lazy variant avoids string interpolation when log is off
let _cacheLog: ((msg: string) => void) | null = null;
export function setCacheLogger(fn: ((msg: string) => void) | null): void {
  _cacheLog = fn;
}
function clog(msgFn: string | (() => string)): void {
  if (_cacheLog) _cacheLog(typeof msgFn === 'function' ? msgFn() : msgFn);
}

export interface CachedNode {
  name: string;
  typeName: string;
  typeId: number;
}

export class SceneCache {
  /** handle → node metadata */
  private nodes = new Map<number, CachedNode>();

  /** "targetHandle:pinIndex" → sourceHandle */
  private connections = new Map<string, number>();

  /** graphHandle → child handles */
  private children = new Map<number, number[]>();

  // ── Node operations ──────────────────────────────────────────────

  addNode(handle: number, name: string, typeName: string, typeId: number): void {
    this.nodes.set(handle, { name, typeName, typeId });
    clog(() => `ADD_NODE ${handle} "${name}" (${typeName})`);
  }

  removeNode(handle: number): void {
    // Recursively remove cached children first
    const kids = this.children.get(handle);
    if (kids) {
      for (const child of kids) {
        this.removeNode(child);
      }
    }

    this.nodes.delete(handle);

    // Clean up connections involving this handle
    for (const [key, source] of this.connections) {
      const target = Number(key.split(':')[0]);
      if (target === handle || source === handle) {
        this.connections.delete(key);
      }
    }
    // Clean up children references
    this.children.delete(handle);
    for (const [parent, parentKids] of this.children) {
      const filtered = parentKids.filter(h => h !== handle);
      if (filtered.length !== parentKids.length) {
        this.children.set(parent, filtered);
      }
    }
  }

  getNode(handle: number): CachedNode | undefined {
    return this.nodes.get(handle);
  }

  /** Direct replacement for handleToTypeName.get() */
  getTypeName(handle: number): string | undefined {
    return this.nodes.get(handle)?.typeName;
  }

  /** Get type ID for a cached node */
  getTypeId(handle: number): number | undefined {
    return this.nodes.get(handle)?.typeId;
  }

  /** Update display name for a cached node */
  updateName(handle: number, name: string): void {
    const node = this.nodes.get(handle);
    if (node) {
      node.name = name;
      clog(() => `updateName(${handle}) → "${name}"`);
    }
  }

  hasNode(handle: number): boolean {
    return this.nodes.has(handle);
  }

  get nodeCount(): number {
    return this.nodes.size;
  }

  // ── Connection operations ────────────────────────────────────────

  private connKey(targetHandle: number, pinIndex: number): string {
    return `${targetHandle}:${pinIndex}`;
  }

  setConnection(targetHandle: number, pinIndex: number, sourceHandle: number): void {
    this.connections.set(this.connKey(targetHandle, pinIndex), sourceHandle);
  }

  removeConnection(targetHandle: number, pinIndex: number): void {
    this.connections.delete(this.connKey(targetHandle, pinIndex));
  }

  getConnection(targetHandle: number, pinIndex: number): number | undefined {
    return this.connections.get(this.connKey(targetHandle, pinIndex));
  }

  /** Find all cached connections involving this handle (as source or target) */
  getConnectionsInvolving(
    handle: number
  ): Array<{ target: number; pinIndex: number; source: number }> {
    const results: Array<{ target: number; pinIndex: number; source: number }> = [];
    for (const [key, source] of this.connections) {
      const [target, pinIndex] = key.split(':').map(Number);
      if (target === handle || source === handle) {
        results.push({ target, pinIndex, source });
      }
    }
    return results;
  }

  // ── Children operations ──────────────────────────────────────────

  setChildren(graphHandle: number, childHandles: number[]): void {
    this.children.set(graphHandle, childHandles);
  }

  getChildren(graphHandle: number): number[] | undefined {
    return this.children.get(graphHandle);
  }

  // ── Cache state ──────────────────────────────────────────────────

  clear(): void {
    clog('CLEAR called');
    this.nodes.clear();
    this.connections.clear();
    this.children.clear();
  }

  /** Serializable snapshot for debugging / responses / MCP resources */
  snapshot(): {
    nodeCount: number;
    connectionCount: number;
    nodes: Array<{
      handle: number;
      name: string;
      typeName: string;
      typeId: number;
    }>;
    connections: Array<{ target: number; pinIndex: number; source: number }>;
    children: Array<{ graph: number; children: number[] }>;
  } {
    return {
      nodeCount: this.nodes.size,
      connectionCount: this.connections.size,
      nodes: [...this.nodes.entries()].map(([handle, n]) => ({
        handle,
        name: n.name,
        typeName: n.typeName,
        typeId: n.typeId,
      })),
      connections: [...this.connections.entries()].map(([key, source]) => {
        const [target, pinIndex] = key.split(':').map(Number);
        return { target, pinIndex, source };
      }),
      children: [...this.children.entries()].map(([graph, kids]) => ({
        graph,
        children: kids,
      })),
    };
  }
}
