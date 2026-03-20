import { describe, it, expect, beforeEach } from 'vitest';
import { SceneCache } from '../SceneCache';

describe('SceneCache', () => {
  let cache: SceneCache;

  beforeEach(() => {
    cache = new SceneCache();
  });

  // ── Handle validation ─────────────────────────────────────────────

  describe('validateHandle', () => {
    it('rejects handle <= 0', () => {
      const result = cache.validateHandle(0);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toContain('must be > 0');
    });

    it('rejects negative handles', () => {
      const result = cache.validateHandle(-5);
      expect(result.valid).toBe(false);
    });

    it('allows unknown handles when cache is unpopulated and empty', () => {
      // Unpopulated bypass: fresh cache with no handles tracked
      const result = cache.validateHandle(42);
      expect(result.valid).toBe(true);
    });

    it('rejects unknown handles after tracking begins', () => {
      cache.trackHandle(100);
      const result = cache.validateHandle(42);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason).toContain('never returned');
    });

    it('accepts tracked handles', () => {
      cache.trackHandle(100);
      expect(cache.validateHandle(100).valid).toBe(true);
    });

    it('rejects unknown handles after population', () => {
      cache.addNode(100, 'Test', 'NT_MAT_UNIVERSAL', 130);
      cache.markPopulated();
      const result = cache.validateHandle(999);
      expect(result.valid).toBe(false);
    });

    it('accepts handles added via addNode', () => {
      cache.addNode(100, 'Test', 'NT_MAT_UNIVERSAL', 130);
      expect(cache.validateHandle(100).valid).toBe(true);
    });
  });

  // ── Node CRUD ─────────────────────────────────────────────────────

  describe('node operations', () => {
    it('adds and retrieves nodes', () => {
      cache.addNode(10, 'Material', 'NT_MAT_UNIVERSAL', 130);
      const node = cache.getNode(10);
      expect(node).toBeDefined();
      expect(node!.name).toBe('Material');
      expect(node!.typeName).toBe('NT_MAT_UNIVERSAL');
      expect(node!.typeId).toBe(130);
    });

    it('returns undefined for missing nodes', () => {
      expect(cache.getNode(999)).toBeUndefined();
      expect(cache.getTypeName(999)).toBeUndefined();
    });

    it('tracks nodeCount', () => {
      expect(cache.nodeCount).toBe(0);
      cache.addNode(1, 'A', 'NT_A', 1);
      cache.addNode(2, 'B', 'NT_B', 2);
      expect(cache.nodeCount).toBe(2);
    });

    it('removes nodes and cleans up handles', () => {
      cache.addNode(10, 'Mat', 'NT_MAT', 130);
      cache.addNode(20, 'Other', 'NT_OTHER', 99); // keep one so bypass doesn't kick in
      cache.removeNode(10);
      expect(cache.hasNode(10)).toBe(false);
      expect(cache.validateHandle(10).valid).toBe(false);
    });

    it('recursively removes children on removeNode', () => {
      cache.addNode(1, 'Parent', 'NT_GRAPH', 20);
      cache.addNode(2, 'Child1', 'NT_NODE', 17);
      cache.addNode(3, 'Child2', 'NT_NODE', 17);
      cache.setChildren(1, [2, 3]);

      cache.removeNode(1);
      expect(cache.hasNode(1)).toBe(false);
      expect(cache.hasNode(2)).toBe(false);
      expect(cache.hasNode(3)).toBe(false);
    });

    it('cleans up connections on removeNode', () => {
      cache.addNode(10, 'Target', 'NT_RT', 1);
      cache.addNode(20, 'Source', 'NT_MAT', 130);
      cache.setConnection(10, 0, 20);
      expect(cache.getConnection(10, 0)).toBe(20);

      cache.removeNode(20);
      expect(cache.getConnection(10, 0)).toBeUndefined();
    });
  });

  // ── Connections ───────────────────────────────────────────────────

  describe('connection operations', () => {
    it('sets and gets connections', () => {
      cache.setConnection(10, 3, 20);
      expect(cache.getConnection(10, 3)).toBe(20);
    });

    it('returns undefined for missing connections', () => {
      expect(cache.getConnection(10, 3)).toBeUndefined();
    });

    it('removes connections', () => {
      cache.setConnection(10, 3, 20);
      cache.removeConnection(10, 3);
      expect(cache.getConnection(10, 3)).toBeUndefined();
    });

    it('overwrites existing connections', () => {
      cache.setConnection(10, 3, 20);
      cache.setConnection(10, 3, 30);
      expect(cache.getConnection(10, 3)).toBe(30);
    });
  });

  // ── Children ──────────────────────────────────────────────────────

  describe('children operations', () => {
    it('sets and gets children', () => {
      cache.setChildren(1, [2, 3, 4]);
      expect(cache.getChildren(1)).toEqual([2, 3, 4]);
    });

    it('returns undefined for missing graphs', () => {
      expect(cache.getChildren(999)).toBeUndefined();
    });
  });

  // ── Cache state ───────────────────────────────────────────────────

  describe('cache lifecycle', () => {
    it('starts unpopulated', () => {
      expect(cache.isPopulated()).toBe(false);
    });

    it('becomes populated after markPopulated', () => {
      cache.markPopulated();
      expect(cache.isPopulated()).toBe(true);
    });

    it('clear resets everything', () => {
      cache.addNode(10, 'Mat', 'NT_MAT', 130);
      cache.setConnection(10, 0, 20);
      cache.setChildren(10, [20]);
      cache.trackHandle(30);
      cache.markPopulated();

      cache.clear();
      expect(cache.isPopulated()).toBe(false);
      expect(cache.nodeCount).toBe(0);
      expect(cache.knownHandleCount).toBe(0);
      expect(cache.getConnection(10, 0)).toBeUndefined();
      expect(cache.getChildren(10)).toBeUndefined();
    });
  });

  // ── Staleness ─────────────────────────────────────────────────────

  describe('staleness tracking', () => {
    it('new nodes have age close to 0', () => {
      cache.addNode(10, 'Mat', 'NT_MAT', 130);
      const age = cache.getNodeAge(10);
      expect(age).toBeDefined();
      expect(age!).toBeLessThan(100); // within 100ms
    });

    it('nodes are not stale when fresh', () => {
      cache.addNode(10, 'Mat', 'NT_MAT', 130);
      expect(cache.isNodeStale(10)).toBe(false);
    });

    it('missing nodes are considered stale', () => {
      expect(cache.isNodeStale(999)).toBe(true);
    });

    it('returns Infinity for timeSinceLastSync before any sync', () => {
      expect(cache.timeSinceLastSyncMs).toBe(Infinity);
    });

    it('tracks timeSinceLastSync after markPopulated', () => {
      cache.markPopulated();
      expect(cache.timeSinceLastSyncMs).toBeLessThan(100);
    });

    it('touchNode refreshes timestamp', () => {
      // Create node with a stale timestamp by using a short-TTL cache
      const shortCache = new SceneCache(10); // 10ms TTL
      shortCache.addNode(10, 'Mat', 'NT_MAT', 130);

      // Manually backdate the node
      const node = shortCache.getNode(10)!;
      node.updatedAt = Date.now() - 1000;
      expect(shortCache.isNodeStale(10)).toBe(true);

      shortCache.touchNode(10);
      expect(shortCache.isNodeStale(10)).toBe(false);
    });

    it('staleNodeCount reflects expired entries', () => {
      const shortCache = new SceneCache(10); // 10ms TTL
      shortCache.addNode(1, 'A', 'NT_A', 1);
      shortCache.addNode(2, 'B', 'NT_B', 2);

      // Backdate one node
      shortCache.getNode(1)!.updatedAt = Date.now() - 1000;
      expect(shortCache.staleNodeCount).toBe(1);
    });

    it('markPopulated refreshes all node timestamps', () => {
      const shortCache = new SceneCache(10);
      shortCache.addNode(1, 'A', 'NT_A', 1);
      shortCache.addNode(2, 'B', 'NT_B', 2);

      // Backdate all
      shortCache.getNode(1)!.updatedAt = Date.now() - 1000;
      shortCache.getNode(2)!.updatedAt = Date.now() - 1000;
      expect(shortCache.staleNodeCount).toBe(2);

      shortCache.markPopulated();
      expect(shortCache.staleNodeCount).toBe(0);
    });

    it('clear resets sync timestamp', () => {
      cache.markPopulated();
      cache.clear();
      expect(cache.timeSinceLastSyncMs).toBe(Infinity);
    });
  });

  // ── Snapshot ──────────────────────────────────────────────────────

  describe('snapshot', () => {
    it('returns complete state', () => {
      cache.addNode(10, 'Mat', 'NT_MAT_UNIVERSAL', 130);
      cache.addNode(20, 'Mesh', 'NT_GEO_MESH', 30);
      cache.setConnection(20, 0, 10);
      cache.setChildren(1, [10, 20]);
      cache.markPopulated();

      const snap = cache.snapshot();
      expect(snap.nodeCount).toBe(2);
      expect(snap.connectionCount).toBe(1);
      expect(snap.populated).toBe(true);
      expect(snap.lastSyncMs).toBeGreaterThan(0);
      expect(snap.nodes).toHaveLength(2);
      expect(snap.connections).toHaveLength(1);
      expect(snap.children).toHaveLength(1);

      // Each node has age/stale fields
      const matNode = snap.nodes.find(n => n.handle === 10)!;
      expect(matNode.typeName).toBe('NT_MAT_UNIVERSAL');
      expect(matNode.ageMs).toBeLessThan(100);
      expect(matNode.stale).toBe(false);
    });
  });
});
