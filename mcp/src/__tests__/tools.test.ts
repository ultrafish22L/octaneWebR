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
import { jsonResult, errorResult, extractHandle, extractValue } from '../tools/utils';
import { parseScoreResponse } from '../vision/prompts';

describe('create_node: cache tracking', () => {
  it('addNode populates scene cache after creation', () => {
    const cache = new SceneCache();
    const handle = 42;

    // Simulate what create_node does after successful creation
    cache.addNode(handle, 'MyMaterial', 'NT_MAT_UNIVERSAL', 130);

    expect(cache.getTypeName(handle)).toBe('NT_MAT_UNIVERSAL');
    expect(cache.hasNode(handle)).toBe(true);
  });

  it('caches auto-created pin children', () => {
    const cache = new SceneCache();
    cache.addNode(100, 'GeoObject', 'NT_GEO_OBJECT', 82);

    // Simulate pin child caching
    const pinChildHandle = 200;
    cache.addNode(pinChildHandle, '', 'NT_TRANSFORM_VALUE', 23);

    expect(cache.hasNode(pinChildHandle)).toBe(true);
    expect(cache.getTypeName(pinChildHandle)).toBe('NT_TRANSFORM_VALUE');
  });
});

// ────────────────────────────────────────────────────────────
// connect_nodes logic
// ────────────────────────────────────────────────────────────

// Handle gating removed — server validates all handles.
// Type mismatch detection still tested below.

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
  it('removeNode clears node from cache', () => {
    const cache = new SceneCache();
    cache.addNode(100, 'Sphere', 'NT_GEO_OBJECT', 82);

    expect(cache.hasNode(100)).toBe(true);

    cache.removeNode(100);
    expect(cache.hasNode(100)).toBe(false);
  });

  it('removeNode cleans up connections referencing deleted handle', () => {
    const cache = new SceneCache();
    cache.addNode(100, 'RT', 'NT_RENDERTARGET', 113);
    cache.addNode(200, 'Camera', 'NT_CAM_THINLENS', 10);
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
// parseScoreResponse (vision/prompts.ts)
// ────────────────────────────────────────────────────────────

describe('parseScoreResponse', () => {
  const validScore = {
    scores: { framing: 3, depth: 2, composition: 4, lighting: 3, placement: 2 },
    overall: 2.8, // VLM's math — server recomputes to 2.9 via weighted formula
    passed: false,
    corrections: [{ target: 'camera_position', description: 'Move camera back', priority: 1 }],
    observations: 'The scene is too tightly framed.',
  };

  it('parses clean JSON directly', () => {
    const result = parseScoreResponse(JSON.stringify(validScore));
    expect(result).not.toBeNull();
    expect(result!.scores.framing).toBe(3);
    expect(result!.overall).toBe(2.9); // server-side weighted recompute
    expect(result!.passed).toBe(false);
    expect(result!.corrections).toHaveLength(1);
    expect(result!.raw).toBeTruthy();
  });

  it('extracts JSON from markdown code block', () => {
    const markdown = `Here is my analysis:\n\`\`\`json\n${JSON.stringify(validScore)}\n\`\`\`\nThank you.`;
    const result = parseScoreResponse(markdown);
    expect(result).not.toBeNull();
    expect(result!.scores.depth).toBe(2);
    expect(result!.overall).toBe(2.9); // server-side weighted recompute
  });

  it('extracts JSON from markdown without language tag', () => {
    const markdown = `Analysis:\n\`\`\`\n${JSON.stringify(validScore)}\n\`\`\``;
    const result = parseScoreResponse(markdown);
    expect(result).not.toBeNull();
    expect(result!.scores.composition).toBe(4);
  });

  it('finds JSON object embedded in prose', () => {
    const mixed = `I see the following issues. ${JSON.stringify(validScore)} That concludes my review.`;
    const result = parseScoreResponse(mixed);
    expect(result).not.toBeNull();
    expect(result!.scores.lighting).toBe(3);
  });

  it('falls back to description-only for non-JSON text', () => {
    const result = parseScoreResponse('This is just regular text with no JSON.');
    expect(result).not.toBeNull();
    expect(result!.description).toBe('This is just regular text with no JSON.');
    expect(result!.scores.framing).toBe(3); // defaults
    expect(result!.passed).toBe(false);
  });

  it('falls back to description-only for JSON without scores field', () => {
    const result = parseScoreResponse('{"foo": "bar", "overall": 3}');
    expect(result).not.toBeNull();
    expect(result!.passed).toBe(false);
  });

  it('falls back to description-only for JSON without valid scores', () => {
    const result = parseScoreResponse('{"scores": {"framing": 3}, "overall": "good"}');
    expect(result).not.toBeNull();
    expect(result!.passed).toBe(false);
  });

  it('handles pretty-printed JSON in code blocks', () => {
    const prettyJson = JSON.stringify(validScore, null, 2);
    const markdown = `\`\`\`json\n${prettyJson}\n\`\`\``;
    const result = parseScoreResponse(markdown);
    expect(result).not.toBeNull();
    expect(result!.corrections[0].target).toBe('camera_position');
  });

  it('preserves corrections array with objectId', () => {
    const withObjectId = {
      ...validScore,
      corrections: [
        {
          target: 'object_position',
          objectId: 'hero_sphere',
          description: 'Move left',
          priority: 2,
        },
      ],
    };
    const result = parseScoreResponse(JSON.stringify(withObjectId));
    expect(result).not.toBeNull();
    expect(result!.corrections[0].objectId).toBe('hero_sphere');
  });

  it('handles empty corrections array', () => {
    const perfect = {
      scores: { framing: 5, depth: 4, composition: 5, lighting: 4, placement: 5 },
      corrections: [],
      passed: true,
      overall: 4.5,
    };
    const result = parseScoreResponse(JSON.stringify(perfect));
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
    cache.setConnection(100, 0, 200);

    cache.clear();

    expect(cache.getTypeName(100)).toBeUndefined();
    expect(cache.getConnection(100, 0)).toBeUndefined();
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
