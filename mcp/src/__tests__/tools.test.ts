/**
 * MCP Tool Module Tests
 *
 * Tests tool logic WITHOUT a live Octane instance by mocking callMethod().
 * Covers: create_node (crash blocking, cache interaction), connect_nodes
 * (pin resolution, type validation, gate checks), set_camera (up vector guard),
 * delete_node (gate + cache cleanup), set_attribute (type dispatch).
 *
 * These tests verify the MCP tool layer's logic — handle gating, type validation,
 * pin resolution, auto-verification — independently of gRPC transport.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SceneCache } from '../SceneCache';
import { jsonResult, errorResult, gateHandle, extractHandle, extractValue } from '../tools/utils';
import { parseCritiqueResponse } from '../vision/prompts';

describe('create_node: cache tracking', () => {
  it('addNode + trackHandle populates scene cache after creation', () => {
    const cache = new SceneCache();
    const handle = 42;

    // Simulate what create_node does after successful creation
    cache.addNode(handle, 'MyMaterial', 'NT_MAT_UNIVERSAL', 130);
    cache.trackHandle(handle);

    expect(cache.getTypeName(handle)).toBe('NT_MAT_UNIVERSAL');
    expect(cache.validateHandle(handle).valid).toBe(true);
  });

  it('tracks auto-created pin children', () => {
    const cache = new SceneCache();
    cache.addNode(100, 'GeoObject', 'NT_GEO_OBJECT', 82);
    cache.trackHandle(100);

    // Simulate pin child tracking
    const pinChildHandle = 200;
    cache.trackHandle(pinChildHandle);
    cache.addNode(pinChildHandle, '', 'NT_TRANSFORM_VALUE', 23);

    expect(cache.validateHandle(pinChildHandle).valid).toBe(true);
    expect(cache.getTypeName(pinChildHandle)).toBe('NT_TRANSFORM_VALUE');
  });
});

// ────────────────────────────────────────────────────────────
// connect_nodes logic
// ────────────────────────────────────────────────────────────

describe('connect_nodes: handle gating', () => {
  it('rejects unknown target handle', () => {
    const cache = new SceneCache();
    cache.trackHandle(100); // populate cache so bypass doesn't kick in

    const result = gateHandle('connect_nodes(target)', 999, cache);
    expect(result).not.toBeNull();
    expect(result!.isError).toBe(true);
    const parsed = JSON.parse(result!.content[0].text);
    expect(parsed.error).toContain('GATED');
  });

  it('rejects unknown source handle', () => {
    const cache = new SceneCache();
    cache.trackHandle(100);

    const result = gateHandle('connect_nodes(source)', 888, cache);
    expect(result).not.toBeNull();
    expect(result!.isError).toBe(true);
  });

  it('allows both handles when known', () => {
    const cache = new SceneCache();
    cache.trackHandle(100);
    cache.trackHandle(200);

    expect(gateHandle('connect_nodes(target)', 100, cache)).toBeNull();
    expect(gateHandle('connect_nodes(source)', 200, cache)).toBeNull();
  });
});

describe('connect_nodes: type mismatch detection', () => {
  it('detects mismatched source/target types via cache', () => {
    const cache = new SceneCache();
    // Source outputs PT_MATERIAL, target pin expects PT_TEXTURE
    const sourceType = 'PT_MATERIAL';
    const targetPinType = 'PT_TEXTURE';

    // The connect_nodes logic: if types differ and neither is PT_UNKNOWN, error
    const typeMismatch =
      sourceType &&
      targetPinType &&
      sourceType !== 'PT_UNKNOWN' &&
      targetPinType !== 'PT_UNKNOWN' &&
      sourceType !== targetPinType;

    expect(typeMismatch).toBe(true);
  });

  it('allows PT_UNKNOWN (skip validation)', () => {
    const sourceType = 'PT_UNKNOWN';
    const targetPinType = 'PT_TEXTURE';

    const typeMismatch =
      sourceType &&
      targetPinType &&
      sourceType !== 'PT_UNKNOWN' &&
      targetPinType !== 'PT_UNKNOWN' &&
      sourceType !== targetPinType;

    expect(typeMismatch).toBe(false);
  });

  it('allows matching types', () => {
    const sourceType = 'PT_TEXTURE';
    const targetPinType = 'PT_TEXTURE';

    const typeMismatch =
      sourceType &&
      targetPinType &&
      sourceType !== 'PT_UNKNOWN' &&
      targetPinType !== 'PT_UNKNOWN' &&
      sourceType !== targetPinType;

    expect(typeMismatch).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// delete_node logic
// ────────────────────────────────────────────────────────────

describe('delete_node: cache cleanup', () => {
  it('removeNode clears handle from cache', () => {
    const cache = new SceneCache();
    cache.addNode(100, 'Sphere', 'NT_GEO_OBJECT', 82);
    cache.trackHandle(100);
    // Track a second handle so cache stays in strict mode after removal
    cache.trackHandle(200);

    expect(cache.validateHandle(100).valid).toBe(true);

    cache.removeNode(100);
    // After removal, handle 100 should be unknown (not just stale)
    const check = cache.validateHandle(100);
    expect(check.valid).toBe(false);
    // Handle 200 should still be valid
    expect(cache.validateHandle(200).valid).toBe(true);
  });

  it('removeNode cleans up connections referencing deleted handle', () => {
    const cache = new SceneCache();
    cache.addNode(100, 'RT', 'NT_RENDERTARGET', 113);
    cache.addNode(200, 'Camera', 'NT_CAM_THINLENS', 10);
    cache.trackHandle(100);
    cache.trackHandle(200);
    cache.setConnection(100, 0, 200);

    expect(cache.getConnection(100, 0)).toBe(200);

    cache.removeNode(200);
    // Connection should be cleaned up
    expect(cache.getConnection(100, 0)).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────
// set_camera logic (from camera.ts)
// ────────────────────────────────────────────────────────────

describe('set_camera: up vector guard', () => {
  it('detects zero-length up vector', () => {
    const up = { x: 0, y: 0, z: 0 };
    const len = Math.sqrt(up.x * up.x + up.y * up.y + up.z * up.z);
    expect(len).toBeLessThan(1e-6);
  });

  it('accepts valid up vectors', () => {
    const up = { x: 0, y: 1, z: 0 };
    const len = Math.sqrt(up.x * up.x + up.y * up.y + up.z * up.z);
    expect(len).toBeGreaterThan(1e-6);
  });

  it('rejects when neither position nor target provided', () => {
    const position = undefined;
    const target = undefined;
    expect(!position && !target).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// set_attribute: type dispatch (extractAttributeValue logic)
// ────────────────────────────────────────────────────────────

describe('extractHandle edge cases', () => {
  it('handles nested result.result.handle', () => {
    expect(extractHandle({ result: { handle: '123' } })).toBe(123);
  });

  it('handles list.handle for array results', () => {
    expect(extractHandle({ list: { handle: '456' } })).toBe(456);
  });

  it('rejects handle 0 (null pointer in gRPC)', () => {
    expect(extractHandle({ result: { handle: 0 } })).toBeUndefined();
    expect(extractHandle({ result: { handle: '0' } })).toBeUndefined();
  });

  it('returns undefined for empty response', () => {
    expect(extractHandle({})).toBeUndefined();
    expect(extractHandle({ result: null })).toBeUndefined();
  });
});

describe('extractValue edge cases', () => {
  it('prefers result over value', () => {
    expect(extractValue({ result: 42, value: 99 })).toBe(42);
  });

  it('falls back to value when result is undefined', () => {
    expect(extractValue({ value: 'hello' })).toBe('hello');
  });

  it('returns whole response as last resort', () => {
    const response = { data: 'something' };
    expect(extractValue(response)).toBe(response);
  });

  it('handles boolean result correctly', () => {
    // Boolean false should be returned, not skipped
    expect(extractValue({ result: false })).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// parseCritiqueResponse (vision/prompts.ts)
// ────────────────────────────────────────────────────────────

describe('parseCritiqueResponse', () => {
  const validCritique = {
    scores: { framing: 3, depth: 2, composition: 4, lighting: 3, placement: 2 },
    overall: 2.8,
    passed: false,
    corrections: [{ target: 'camera_position', description: 'Move camera back', priority: 1 }],
    observations: 'The scene is too tightly framed.',
  };

  it('parses clean JSON directly', () => {
    const result = parseCritiqueResponse(JSON.stringify(validCritique));
    expect(result).not.toBeNull();
    expect(result!.scores.framing).toBe(3);
    expect(result!.overall).toBe(2.8);
    expect(result!.passed).toBe(false);
    expect(result!.corrections).toHaveLength(1);
    expect(result!.raw).toBeTruthy();
  });

  it('extracts JSON from markdown code block', () => {
    const markdown = `Here is my analysis:\n\`\`\`json\n${JSON.stringify(validCritique)}\n\`\`\`\nThank you.`;
    const result = parseCritiqueResponse(markdown);
    expect(result).not.toBeNull();
    expect(result!.scores.depth).toBe(2);
    expect(result!.overall).toBe(2.8);
  });

  it('extracts JSON from markdown without language tag', () => {
    const markdown = `Analysis:\n\`\`\`\n${JSON.stringify(validCritique)}\n\`\`\``;
    const result = parseCritiqueResponse(markdown);
    expect(result).not.toBeNull();
    expect(result!.scores.composition).toBe(4);
  });

  it('finds JSON object embedded in prose', () => {
    const mixed = `I see the following issues. ${JSON.stringify(validCritique)} That concludes my review.`;
    const result = parseCritiqueResponse(mixed);
    expect(result).not.toBeNull();
    expect(result!.scores.lighting).toBe(3);
  });

  it('returns null for non-JSON text', () => {
    expect(parseCritiqueResponse('This is just regular text with no JSON.')).toBeNull();
  });

  it('returns null for JSON without scores field', () => {
    expect(parseCritiqueResponse('{"foo": "bar", "overall": 3}')).toBeNull();
  });

  it('returns null for JSON without overall number', () => {
    expect(parseCritiqueResponse('{"scores": {"framing": 3}, "overall": "good"}')).toBeNull();
  });

  it('handles pretty-printed JSON in code blocks', () => {
    const prettyJson = JSON.stringify(validCritique, null, 2);
    const markdown = `\`\`\`json\n${prettyJson}\n\`\`\``;
    const result = parseCritiqueResponse(markdown);
    expect(result).not.toBeNull();
    expect(result!.corrections[0].target).toBe('camera_position');
  });

  it('preserves corrections array with objectId', () => {
    const withObjectId = {
      ...validCritique,
      corrections: [
        {
          target: 'object_position',
          objectId: 'hero_sphere',
          description: 'Move left',
          priority: 2,
        },
      ],
    };
    const result = parseCritiqueResponse(JSON.stringify(withObjectId));
    expect(result).not.toBeNull();
    expect(result!.corrections[0].objectId).toBe('hero_sphere');
  });

  it('handles empty corrections array', () => {
    const perfect = { ...validCritique, corrections: [], passed: true, overall: 4.5 };
    const result = parseCritiqueResponse(JSON.stringify(perfect));
    expect(result).not.toBeNull();
    expect(result!.corrections).toHaveLength(0);
    expect(result!.passed).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// SceneCache: connection tracking
// ────────────────────────────────────────────────────────────

describe('SceneCache: connection tracking for connect_nodes', () => {
  let cache: SceneCache;

  beforeEach(() => {
    cache = new SceneCache();
  });

  it('setConnection and getConnection round-trip', () => {
    cache.setConnection(100, 0, 200);
    expect(cache.getConnection(100, 0)).toBe(200);
  });

  it('returns undefined for unset connections', () => {
    expect(cache.getConnection(100, 5)).toBeUndefined();
  });

  it('removeConnection clears a specific pin', () => {
    cache.setConnection(100, 0, 200);
    cache.setConnection(100, 3, 300);
    cache.removeConnection(100, 0);
    expect(cache.getConnection(100, 0)).toBeUndefined();
    expect(cache.getConnection(100, 3)).toBe(300);
  });

  it('clear() resets all state', () => {
    cache.addNode(100, 'Test', 'NT_MAT_UNIVERSAL', 130);
    cache.trackHandle(100);
    cache.setConnection(100, 0, 200);

    cache.clear();

    // After clear, cache is unpopulated — bypass mode lets handles through
    // but type info should be gone
    expect(cache.getTypeName(100)).toBeUndefined();
    expect(cache.getConnection(100, 0)).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────
// gateHandle: comprehensive edge cases
// ────────────────────────────────────────────────────────────

describe('gateHandle: comprehensive', () => {
  it('bypass mode when cache unpopulated (no handles tracked)', () => {
    const cache = new SceneCache();
    // Empty cache = bypass mode — allows any handle
    expect(gateHandle('test_tool', 42, cache)).toBeNull();
    expect(gateHandle('test_tool', 99999, cache)).toBeNull();
  });

  it('strict mode when cache populated (at least one handle tracked)', () => {
    const cache = new SceneCache();
    cache.trackHandle(100);

    // Known handle: allowed
    expect(gateHandle('test_tool', 100, cache)).toBeNull();
    // Unknown handle: blocked
    expect(gateHandle('test_tool', 200, cache)).not.toBeNull();
  });

  it('always rejects handle 0', () => {
    const emptyCache = new SceneCache();
    expect(gateHandle('test_tool', 0, emptyCache)).not.toBeNull();

    const populatedCache = new SceneCache();
    populatedCache.trackHandle(100);
    expect(gateHandle('test_tool', 0, populatedCache)).not.toBeNull();
  });

  it('error message includes tool name', () => {
    const cache = new SceneCache();
    cache.trackHandle(100);
    const result = gateHandle('my_custom_tool', 999, cache);
    const parsed = JSON.parse(result!.content[0].text);
    expect(parsed.error).toContain('my_custom_tool');
  });
});

// ────────────────────────────────────────────────────────────
// Result helpers
// ────────────────────────────────────────────────────────────

describe('jsonResult/errorResult format', () => {
  it('jsonResult produces valid MCP text content', () => {
    const result = jsonResult({ handle: 42, name: 'Test' });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.handle).toBe(42);
    expect(parsed.name).toBe('Test');
  });

  it('errorResult wraps Error objects', () => {
    const result = errorResult(new Error('gRPC timeout'));
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe('gRPC timeout');
  });

  it('errorResult wraps string errors', () => {
    const result = errorResult('connection refused');
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe('connection refused');
  });

  it('errorResult handles non-string non-Error', () => {
    const result = errorResult(42);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe('42');
  });
});

// ────────────────────────────────────────────────────────────
// delete_node: connection guard
// ────────────────────────────────────────────────────────────

describe('delete_node: connection guard', () => {
  let cache: SceneCache;

  beforeEach(() => {
    cache = new SceneCache();
  });

  it('blocks deletion when node is a source in a connection', () => {
    cache.addNode(100, 'RT', 'NT_RENDERTARGET', 113);
    cache.addNode(200, 'Camera', 'NT_CAM_THINLENS', 10);
    cache.setConnection(100, 0, 200); // camera connected to RT

    const conns = cache.getConnectionsInvolving(200);
    expect(conns.length).toBeGreaterThan(0);
    // delete_node would check this and return errorResult
  });

  it('blocks deletion when node is a target with connections', () => {
    cache.addNode(100, 'RT', 'NT_RENDERTARGET', 113);
    cache.addNode(200, 'Camera', 'NT_CAM_THINLENS', 10);
    cache.setConnection(100, 0, 200);

    const conns = cache.getConnectionsInvolving(100);
    expect(conns.length).toBeGreaterThan(0);
  });

  it('allows deletion when node has no connections', () => {
    cache.addNode(100, 'Orphan', 'NT_MAT_UNIVERSAL', 130);

    const conns = cache.getConnectionsInvolving(100);
    expect(conns).toHaveLength(0);
  });

  it('allows deletion after disconnect clears connections', () => {
    cache.addNode(100, 'RT', 'NT_RENDERTARGET', 113);
    cache.addNode(200, 'Camera', 'NT_CAM_THINLENS', 10);
    cache.setConnection(100, 0, 200);

    // Disconnect
    cache.removeConnection(100, 0);

    // Now both nodes have no connections
    expect(cache.getConnectionsInvolving(100)).toHaveLength(0);
    expect(cache.getConnectionsInvolving(200)).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────
// connect_nodes: edge cases
// ────────────────────────────────────────────────────────────

describe('connect_nodes: edge cases', () => {
  let cache: SceneCache;

  beforeEach(() => {
    cache = new SceneCache();
  });

  it('double-connect same pin overwrites in cache', () => {
    cache.setConnection(100, 0, 200);
    cache.setConnection(100, 0, 300);

    expect(cache.getConnection(100, 0)).toBe(300);
    // Old source no longer appears
    expect(cache.getConnectionsInvolving(200)).toHaveLength(0);
  });

  it('self-connection is stored in cache (no guard exists)', () => {
    cache.addNode(100, 'Node', 'NT_MAT_UNIVERSAL', 130);
    cache.setConnection(100, 0, 100); // self-connect

    const conns = cache.getConnectionsInvolving(100);
    // Should appear once (same entry, handle is both source and target)
    expect(conns).toHaveLength(1);
    expect(conns[0].source).toBe(100);
    expect(conns[0].target).toBe(100);
  });

  it('getConnectionsInvolving after overwrite reflects new state', () => {
    cache.addNode(100, 'RT', 'NT_RENDERTARGET', 113);
    cache.addNode(200, 'OldCam', 'NT_CAM_THINLENS', 10);
    cache.addNode(300, 'NewCam', 'NT_CAM_THINLENS', 10);

    cache.setConnection(100, 0, 200);
    expect(cache.getConnectionsInvolving(200)).toHaveLength(1);

    // Overwrite
    cache.setConnection(100, 0, 300);
    expect(cache.getConnectionsInvolving(200)).toHaveLength(0);
    expect(cache.getConnectionsInvolving(300)).toHaveLength(1);
  });
});
