import { describe, it, expect } from 'vitest';
import {
  validateComposition,
  projectToScreen,
  vec3Dot,
  vec3Normalize,
  vec3Sub,
  vec3Distance,
} from '../tools/artdirection';
import type { CompositionSpec } from '../ArtDirectionState';

function makeSpec(overrides: Partial<CompositionSpec> = {}): CompositionSpec {
  return {
    name: 'test',
    description: 'test scene',
    camera: {
      position: { x: 0, y: 2, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      fovHorizontalDeg: 82,
      compositionRule: 'rule-of-thirds',
    },
    objects: [
      {
        id: 'hero',
        role: 'hero' as const,
        position: { x: 0, y: 0, z: 0 },
        depthLayer: 0,
        scale: { x: 4, y: 4, z: 4 },
      },
      { id: 'bg', role: 'secondary' as const, position: { x: 2, y: 0, z: -5 }, depthLayer: 1 },
    ],
    depthLayers: 2,
    focalPoint: 'hero',
    lightingMood: 'natural',
    sceneExtents: { min: { x: 0, y: 0, z: -5 }, max: { x: 2, y: 0, z: 0 } },
    ...overrides,
  };
}

describe('validateComposition', () => {
  it('passes a valid layout', () => {
    const result = validateComposition(makeSpec());
    expect(result.passed).toBe(true);
    expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0);
  });

  it('fails when object is behind camera', () => {
    const spec = makeSpec({
      objects: [
        { id: 'hero', role: 'hero', position: { x: 0, y: 0, z: 0 }, depthLayer: 0 },
        { id: 'behind', role: 'secondary', position: { x: 0, y: 0, z: 15 }, depthLayer: 1 },
      ],
    });
    const result = validateComposition(spec);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.severity === 'error' && i.message.includes('behind'))).toBe(
      true
    );
  });

  it('fails when object is outside frustum', () => {
    const spec = makeSpec({
      objects: [
        { id: 'hero', role: 'hero', position: { x: 0, y: 0, z: 0 }, depthLayer: 0 },
        { id: 'far_right', role: 'secondary', position: { x: 50, y: 0, z: 0 }, depthLayer: 0 },
      ],
    });
    const result = validateComposition(spec);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.severity === 'error' && i.message.includes('frustum'))).toBe(
      true
    );
  });

  it('warns on insufficient depth separation', () => {
    const spec = makeSpec({
      objects: [
        { id: 'a', role: 'hero', position: { x: 0, y: 0, z: 0 }, depthLayer: 0 },
        { id: 'b', role: 'secondary', position: { x: 1, y: 0, z: -0.1 }, depthLayer: 1 },
        { id: 'c', role: 'accent', position: { x: -1, y: 0, z: -10 }, depthLayer: 2 },
      ],
    });
    const result = validateComposition(spec);
    expect(result.issues.some(i => i.severity === 'warning' && i.message.includes('flat'))).toBe(
      true
    );
  });

  it('warns on object proximity', () => {
    const spec = makeSpec({
      objects: [
        { id: 'a', role: 'hero', position: { x: 0, y: 0, z: 0 }, depthLayer: 0 },
        { id: 'b', role: 'secondary', position: { x: 0.2, y: 0, z: 0.1 }, depthLayer: 0 },
      ],
    });
    const result = validateComposition(spec);
    expect(result.issues.some(i => i.severity === 'warning' && i.message.includes('clip'))).toBe(
      true
    );
  });

  it('warns on flat lighting angle', () => {
    const spec = makeSpec({
      objects: [
        { id: 'hero', role: 'hero', position: { x: 0, y: 0, z: 0 }, depthLayer: 0 },
        { id: 'light', role: 'light', position: { x: 0, y: 2, z: 9.5 }, depthLayer: 0 }, // near camera
      ],
    });
    const result = validateComposition(spec);
    expect(result.issues.some(i => i.severity === 'warning' && i.message.includes('flat'))).toBe(
      true
    );
  });

  it('warns when focal point not found', () => {
    const spec = makeSpec({ focalPoint: 'nonexistent' });
    const result = validateComposition(spec);
    expect(result.issues.some(i => i.message.includes('not found'))).toBe(true);
  });
});

describe('projectToScreen', () => {
  const cam = {
    position: { x: 0, y: 0, z: 10 },
    target: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    fovHorizontalDeg: 90,
    compositionRule: 'centered' as const,
  };

  it('projects center to (0.5, 0.5)', () => {
    const p = projectToScreen({ x: 0, y: 0, z: 0 }, cam);
    expect(p.u).toBeCloseTo(0.5, 1);
    expect(p.v).toBeCloseTo(0.5, 1);
  });

  it('projects point behind camera as negative', () => {
    const p = projectToScreen({ x: 0, y: 0, z: 15 }, cam);
    expect(p.u).toBe(-1);
    expect(p.v).toBe(-1);
  });

  it('projects right-of-center to u > 0.5', () => {
    const p = projectToScreen({ x: 3, y: 0, z: 0 }, cam);
    expect(p.u).toBeGreaterThan(0.5);
  });

  it('projects above-center to v < 0.5', () => {
    const p = projectToScreen({ x: 0, y: 3, z: 0 }, cam);
    expect(p.v).toBeLessThan(0.5);
  });

  it('wide aspect ratio compresses vertical range', () => {
    // Same point, but 16:9 aspect should push v further from center than 1:1
    const square = projectToScreen({ x: 0, y: 3, z: 0 }, cam, 1);
    const wide = projectToScreen({ x: 0, y: 3, z: 0 }, cam, 16 / 9);
    // Wide aspect has smaller halfHeight, so same Y offset produces larger v deviation
    expect(Math.abs(wide.v - 0.5)).toBeGreaterThan(Math.abs(square.v - 0.5));
  });

  it('aspect ratio does not affect u projection', () => {
    const square = projectToScreen({ x: 3, y: 0, z: 0 }, cam, 1);
    const wide = projectToScreen({ x: 3, y: 0, z: 0 }, cam, 16 / 9);
    expect(wide.u).toBeCloseTo(square.u, 5);
  });
});

describe('vector math', () => {
  it('vec3Normalize produces unit length', () => {
    const n = vec3Normalize({ x: 3, y: 4, z: 0 });
    const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
    expect(len).toBeCloseTo(1, 6);
  });

  it('vec3Dot of perpendicular vectors is 0', () => {
    expect(vec3Dot({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBe(0);
  });

  it('vec3Distance computes correctly', () => {
    expect(vec3Distance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBeCloseTo(5, 6);
  });

  it('vec3Sub computes correctly', () => {
    const r = vec3Sub({ x: 5, y: 3, z: 1 }, { x: 2, y: 1, z: 1 });
    expect(r).toEqual({ x: 3, y: 2, z: 0 });
  });
});
