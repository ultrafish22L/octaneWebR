import { describe, it, expect, beforeEach } from 'vitest';
import { SceneCache } from '../SceneCache';

describe('SceneCache', () => {
  let cache: SceneCache;

  beforeEach(() => {
    cache = new SceneCache();
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

    it('removes nodes', () => {
      cache.addNode(10, 'Mat', 'NT_MAT', 130);
      cache.removeNode(10);
      expect(cache.hasNode(10)).toBe(false);
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

    it('updates display name', () => {
      cache.addNode(10, 'OldName', 'NT_MAT', 130);
      cache.updateName(10, 'NewName');
      expect(cache.getNode(10)!.name).toBe('NewName');
    });

    it('getTypeId returns correct value', () => {
      cache.addNode(10, 'Mat', 'NT_MAT_UNIVERSAL', 130);
      expect(cache.getTypeId(10)).toBe(130);
      expect(cache.getTypeId(999)).toBeUndefined();
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
    it('clear resets everything', () => {
      cache.addNode(10, 'Mat', 'NT_MAT', 130);
      cache.setConnection(10, 0, 20);
      cache.setChildren(10, [20]);

      cache.clear();
      expect(cache.nodeCount).toBe(0);
      expect(cache.getConnection(10, 0)).toBeUndefined();
      expect(cache.getChildren(10)).toBeUndefined();
    });
  });

  // ── Snapshot ──────────────────────────────────────────────────────

  describe('snapshot', () => {
    it('returns complete state', () => {
      cache.addNode(10, 'Mat', 'NT_MAT_UNIVERSAL', 130);
      cache.addNode(20, 'Mesh', 'NT_GEO_MESH', 30);
      cache.setConnection(20, 0, 10);
      cache.setChildren(1, [10, 20]);

      const snap = cache.snapshot();
      expect(snap.nodeCount).toBe(2);
      expect(snap.connectionCount).toBe(1);
      expect(snap.nodes).toHaveLength(2);
      expect(snap.connections).toHaveLength(1);
      expect(snap.children).toHaveLength(1);

      const matNode = snap.nodes.find(n => n.handle === 10)!;
      expect(matNode.typeName).toBe('NT_MAT_UNIVERSAL');
      expect(matNode.typeId).toBe(130);
    });
  });

  // ── getConnectionsInvolving ─────────────────────────────────────

  describe('getConnectionsInvolving', () => {
    it('returns connections where handle is source', () => {
      cache.addNode(100, 'RT', 'NT_RENDERTARGET', 113);
      cache.addNode(200, 'Camera', 'NT_CAM_THINLENS', 10);
      cache.setConnection(100, 0, 200); // camera → RT pin 0

      const conns = cache.getConnectionsInvolving(200);
      expect(conns).toHaveLength(1);
      expect(conns[0]).toEqual({ target: 100, pinIndex: 0, source: 200 });
    });

    it('returns connections where handle is target', () => {
      cache.addNode(100, 'RT', 'NT_RENDERTARGET', 113);
      cache.addNode(200, 'Camera', 'NT_CAM_THINLENS', 10);
      cache.setConnection(100, 0, 200);

      const conns = cache.getConnectionsInvolving(100);
      expect(conns).toHaveLength(1);
      expect(conns[0]).toEqual({ target: 100, pinIndex: 0, source: 200 });
    });

    it('returns empty for unconnected handles', () => {
      cache.addNode(100, 'RT', 'NT_RENDERTARGET', 113);
      cache.addNode(200, 'Camera', 'NT_CAM_THINLENS', 10);
      cache.addNode(300, 'Orphan', 'NT_MAT_UNIVERSAL', 130);
      cache.setConnection(100, 0, 200);

      expect(cache.getConnectionsInvolving(300)).toHaveLength(0);
    });

    it('returns empty after removeNode cleans up connections', () => {
      cache.addNode(100, 'RT', 'NT_RENDERTARGET', 113);
      cache.addNode(200, 'Camera', 'NT_CAM_THINLENS', 10);
      cache.setConnection(100, 0, 200);

      cache.removeNode(200);
      expect(cache.getConnectionsInvolving(200)).toHaveLength(0);
      // RT side also cleaned up
      expect(cache.getConnectionsInvolving(100)).toHaveLength(0);
    });

    it('returns empty after clear()', () => {
      cache.addNode(100, 'RT', 'NT_RENDERTARGET', 113);
      cache.addNode(200, 'Camera', 'NT_CAM_THINLENS', 10);
      cache.setConnection(100, 0, 200);

      cache.clear();
      expect(cache.getConnectionsInvolving(100)).toHaveLength(0);
      expect(cache.getConnectionsInvolving(200)).toHaveLength(0);
    });

    it('returns multiple connections when handle has several', () => {
      cache.addNode(100, 'RT', 'NT_RENDERTARGET', 113);
      cache.addNode(200, 'Camera', 'NT_CAM_THINLENS', 10);
      cache.addNode(300, 'Env', 'NT_ENV_DAYLIGHT', 37);
      cache.addNode(400, 'Geo', 'NT_GEO_GROUP', 27);
      cache.setConnection(100, 0, 200); // camera → RT pin 0
      cache.setConnection(100, 1, 300); // env → RT pin 1
      cache.setConnection(100, 3, 400); // geo → RT pin 3

      const conns = cache.getConnectionsInvolving(100);
      expect(conns).toHaveLength(3);
    });

    it('handles node that is both source and target', () => {
      cache.addNode(100, 'RT', 'NT_RENDERTARGET', 113);
      cache.addNode(200, 'Group', 'NT_GEO_GROUP', 27);
      cache.addNode(300, 'Placement', 'NT_GEO_PLACEMENT', 29);
      cache.setConnection(100, 3, 200); // group → RT pin 3
      cache.setConnection(200, 0, 300); // placement → group pin 0

      const conns = cache.getConnectionsInvolving(200);
      expect(conns).toHaveLength(2); // both as source (to RT) and target (from placement)
    });
  });

  // ── Drift scenarios ─────────────────────────────────────────────

  describe('drift scenarios', () => {
    it('overwriting a connection drops old source from getConnectionsInvolving', () => {
      cache.addNode(100, 'RT', 'NT_RENDERTARGET', 113);
      cache.addNode(200, 'OldCam', 'NT_CAM_THINLENS', 10);
      cache.addNode(300, 'NewCam', 'NT_CAM_THINLENS', 10);
      cache.setConnection(100, 0, 200); // old camera

      // Overwrite with new camera
      cache.setConnection(100, 0, 300);

      // Old camera should no longer appear
      expect(cache.getConnectionsInvolving(200)).toHaveLength(0);
      // New camera should be connected
      const conns = cache.getConnectionsInvolving(300);
      expect(conns).toHaveLength(1);
      expect(conns[0].source).toBe(300);
    });
  });
});
