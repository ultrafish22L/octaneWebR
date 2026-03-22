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
 * - Staleness tracking: each entry records when it was last updated.
 *   Consumers can check age via `getAge()` and the snapshot includes
 *   `lastUpdatedMs` so the AI can judge data freshness.
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
  /** Timestamp (Date.now()) when this entry was created or last confirmed */
  updatedAt: number;
}

/** Default TTL: 5 minutes. Entries older than this are flagged as stale. */
const DEFAULT_STALE_MS = 5 * 60 * 1000;

export class SceneCache {
  /** handle → node metadata */
  private nodes = new Map<number, CachedNode>();

  /** "targetHandle:pinIndex" → sourceHandle */
  private connections = new Map<string, number>();

  /** graphHandle → child handles */
  private children = new Map<number, number[]>();

  /** Whether get_scene_tree has populated this cache at least once */
  private _populated = false;

  /** Timestamp of last full population (get_scene_tree) or clear */
  private _lastSyncMs = 0;

  /** Staleness threshold in ms. Entries older than this are flagged. */
  readonly staleTtlMs: number;

  /**
   * Every handle ever returned to the AI by any MCP tool response.
   * Includes node handles, pin child handles, connected handles — anything
   * the AI could legitimately use in a subsequent call.
   * Cleared on crash/load/reset (same as the rest of the cache).
   */
  private _knownHandles = new Set<number>();

  constructor(staleTtlMs: number = DEFAULT_STALE_MS) {
    this.staleTtlMs = staleTtlMs;
  }

  // ── Handle tracking (crash prevention) ─────────────────────────

  /** Register a handle as known-valid (returned by some tool response) */
  trackHandle(handle: number): void {
    if (handle > 0) {
      this._knownHandles.add(handle);
      clog(() => `TRACK ${handle} → size=${this._knownHandles.size}`);
    }
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
    clog(() => {
      const knownList =
        this._knownHandles.size <= 50
          ? [...this._knownHandles].join(',')
          : `${this._knownHandles.size} handles`;
      return `VALIDATE_REJECT ${handle} — known=[${knownList}] populated=${this._populated}`;
    });
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
    this.nodes.set(handle, { name, typeName, typeId, updatedAt: Date.now() });
    this._knownHandles.add(handle);
    clog(() => `ADD_NODE ${handle} "${name}" (${typeName}) → size=${this._knownHandles.size}`);
  }

  /** Touch/refresh a node's timestamp (e.g., after confirming it still exists via gRPC) */
  touchNode(handle: number): void {
    const node = this.nodes.get(handle);
    if (node) node.updatedAt = Date.now();
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
    this._knownHandles.delete(handle);

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
      node.updatedAt = Date.now();
      clog(() => `updateName(${handle}) → "${name}"`);
    }
  }

  hasNode(handle: number): boolean {
    return this.nodes.has(handle);
  }

  get nodeCount(): number {
    return this.nodes.size;
  }

  // ── Staleness queries ─────────────────────────────────────────────

  /** Age of a specific node entry in ms, or undefined if not cached */
  getNodeAge(handle: number): number | undefined {
    const node = this.nodes.get(handle);
    if (!node) return undefined;
    return Date.now() - node.updatedAt;
  }

  /** Check if a cached node is older than the stale threshold */
  isNodeStale(handle: number): boolean {
    const age = this.getNodeAge(handle);
    if (age === undefined) return true; // not in cache = stale
    return age > this.staleTtlMs;
  }

  /** Time since last full sync (get_scene_tree), or Infinity if never synced */
  get timeSinceLastSyncMs(): number {
    if (!this._lastSyncMs) return Infinity;
    return Date.now() - this._lastSyncMs;
  }

  /** Count of nodes whose entries are older than the stale threshold */
  get staleNodeCount(): number {
    const now = Date.now();
    let count = 0;
    for (const node of this.nodes.values()) {
      if (now - node.updatedAt > this.staleTtlMs) count++;
    }
    return count;
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
    this._lastSyncMs = Date.now();
    // Touch all nodes — they were just confirmed via get_scene_tree
    const now = Date.now();
    for (const node of this.nodes.values()) {
      node.updatedAt = now;
    }
  }

  clear(): void {
    clog(() => {
      const prevSize = this._knownHandles.size;
      const prevHandles =
        prevSize <= 50 ? [...this._knownHandles].join(',') : `${prevSize} handles`;
      return `CLEAR called! Was: ${prevHandles} — stack: ${new Error().stack?.split('\n').slice(1, 5).join(' | ')}`;
    });
    this.nodes.clear();
    this.connections.clear();
    this.children.clear();
    this._knownHandles.clear();
    this._populated = false;
    this._lastSyncMs = 0;
  }

  /** Serializable snapshot for debugging / responses / MCP resources */
  snapshot(): {
    nodeCount: number;
    connectionCount: number;
    populated: boolean;
    lastSyncMs: number;
    staleNodeCount: number;
    nodes: Array<{
      handle: number;
      name: string;
      typeName: string;
      typeId: number;
      ageMs: number;
      stale: boolean;
    }>;
    connections: Array<{ target: number; pinIndex: number; source: number }>;
    children: Array<{ graph: number; children: number[] }>;
  } {
    const now = Date.now();
    return {
      nodeCount: this.nodes.size,
      connectionCount: this.connections.size,
      populated: this._populated,
      lastSyncMs: this._lastSyncMs,
      staleNodeCount: this.staleNodeCount,
      nodes: [...this.nodes.entries()].map(([handle, n]) => ({
        handle,
        name: n.name,
        typeName: n.typeName,
        typeId: n.typeId,
        ageMs: now - n.updatedAt,
        stale: now - n.updatedAt > this.staleTtlMs,
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
