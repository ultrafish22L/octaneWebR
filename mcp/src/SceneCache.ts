/**
 * SceneCache — lightweight in-memory scene graph cache for MCP.
 *
 * Tracks which nodes exist, their types, and pin connections.
 * Replaces the old `handleToTypeName` Map with a richer cache.
 *
 * Design rules:
 * - Lazy population: starts empty, filled by get_scene_tree (full sync)
 *   and incrementally by mutation tools (create_node, delete_node, etc.)
 * - Hint layer, not source of truth: critical ops verify against live gRPC.
 * - Cleared on: crash detection, load_project, reset_project.
 */

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

  /** Whether get_scene_tree has populated this cache at least once */
  private _populated = false;

  /**
   * Every handle ever returned to the AI by any MCP tool response.
   * Includes node handles, pin child handles, connected handles — anything
   * the AI could legitimately use in a subsequent call.
   * Cleared on crash/load/reset (same as the rest of the cache).
   */
  private _knownHandles = new Set<number>();

  // ── Handle tracking (crash prevention) ─────────────────────────

  /** Register a handle as known-valid (returned by some tool response) */
  trackHandle(handle: number): void {
    if (handle > 0) this._knownHandles.add(handle);
  }

  /** Register multiple handles at once */
  trackHandles(handles: number[]): void {
    for (const h of handles) {
      if (h > 0) this._knownHandles.add(h);
    }
  }

  /**
   * Check if a handle has been seen before.
   * Returns { valid: true } or { valid: false, reason: string }.
   * Reason string includes the handle value for log searchability.
   */
  validateHandle(handle: number): { valid: true } | { valid: false; reason: string } {
    if (handle <= 0) {
      return { valid: false, reason: `Handle ${handle} is invalid (must be > 0)` };
    }
    if (!this._populated && this._knownHandles.size === 0) {
      // Cache not yet populated — can't validate, allow through
      return { valid: true };
    }
    if (this._knownHandles.has(handle)) {
      return { valid: true };
    }
    return {
      valid: false,
      reason:
        `Handle ${handle} was never returned by any MCP tool. ` +
        `Known handles: ${this._knownHandles.size}. ` +
        `Use get_scene_tree or get_node_info to discover valid handles. ` +
        `Passing unknown handles to Octane can crash it.`,
    };
  }

  get knownHandleCount(): number {
    return this._knownHandles.size;
  }

  // ── Node operations ──────────────────────────────────────────────

  addNode(handle: number, name: string, typeName: string, typeId: number): void {
    this.nodes.set(handle, { name, typeName, typeId });
    this._knownHandles.add(handle);
  }

  removeNode(handle: number): void {
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
    for (const [parent, kids] of this.children) {
      const filtered = kids.filter(h => h !== handle);
      if (filtered.length !== kids.length) {
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

  // ── Children operations ──────────────────────────────────────────

  setChildren(graphHandle: number, childHandles: number[]): void {
    this.children.set(graphHandle, childHandles);
  }

  getChildren(graphHandle: number): number[] | undefined {
    return this.children.get(graphHandle);
  }

  // ── Cache state ──────────────────────────────────────────────────

  isPopulated(): boolean {
    return this._populated;
  }

  markPopulated(): void {
    this._populated = true;
  }

  clear(): void {
    this.nodes.clear();
    this.connections.clear();
    this.children.clear();
    this._knownHandles.clear();
    this._populated = false;
  }

  /** Serializable snapshot for debugging / responses / MCP resources */
  snapshot(): {
    nodeCount: number;
    connectionCount: number;
    populated: boolean;
    nodes: Array<{ handle: number; name: string; typeName: string; typeId: number }>;
    connections: Array<{ target: number; pinIndex: number; source: number }>;
    children: Array<{ graph: number; children: number[] }>;
  } {
    return {
      nodeCount: this.nodes.size,
      connectionCount: this.connections.size,
      populated: this._populated,
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
