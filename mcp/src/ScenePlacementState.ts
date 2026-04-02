/**
 * ScenePlacementState — running spatial awareness database for scene object placement.
 *
 * Tracks every placed object's position, bounds, role, and mesh analysis.
 * Used by suggest_placement to propose collision-free, well-composed positions
 * for new objects, and by validate_layout to check physical correctness.
 *
 * Advisory only — suggestions can be overridden by the artist/Claude.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface AABB {
  min: Vec3;
  max: Vec3;
}

export type PlacementRole = 'hero' | 'secondary' | 'accent' | 'ground' | 'light' | 'prop';

export interface ScenePlacementEntry {
  handle: number;
  name: string;
  role: PlacementRole;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  /** World-space axis-aligned bounding box (after transform) */
  boundsWorld: AABB;
  /** Local-space mesh bounds (before transform). Stored so refreshFromOctane can recompute
   *  boundsWorld correctly via computeWorldAABB when position/scale change. */
  localMin?: Vec3;
  localMax?: Vec3;
  /** Mesh analysis from analyze_geo sidecar, if available */
  meshInfo?: {
    category: string;
    naturalHeightM: number;
    suggestedRotation: Vec3;
    groundOffsetY: number;
    /** VLM-derived fields (present when Tier 3 visual analysis succeeded) */
    confidence?: string; // 'low' | 'medium' | 'high'
    frontDirection?: string; // 'front' | 'back' | 'left' | 'right'
    orientationMatters?: boolean; // false for symmetric objects like spheres
    analysisMethod?: string; // 'geometric+semantic' | 'geometric+semantic+vlm'
    mugshotDir?: string; // directory containing mugshot PNGs
  };
}

export interface PlacementSuggestion {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  reasoning: string;
  clearances: { object: string; distance: number }[];
  warnings: string[];
}

export interface CollisionResult {
  collides: boolean;
  overlapping: string[];
  penetrationDepth: number;
}

export class ScenePlacementState {
  private entries = new Map<number, ScenePlacementEntry>();
  private _groundY = 0;

  get groundY(): number {
    return this._groundY;
  }
  set groundY(y: number) {
    this._groundY = y;
  }

  /** Clear all entries (on scene reset). */
  clear(): void {
    this.entries.clear();
    this._groundY = 0;
  }

  /** Add or update a placed object. Updates groundY when ground objects are added. */
  addEntry(entry: ScenePlacementEntry): void {
    this.entries.set(entry.handle, entry);
    // Update groundY from all ground objects' top surfaces
    if (entry.role === 'ground') {
      this._updateGroundY();
    }
  }

  /** Recompute _groundY from the max top-surface of all ground-role objects. */
  private _updateGroundY(): void {
    let maxY = 0;
    for (const entry of this.entries.values()) {
      if (entry.role === 'ground' && entry.boundsWorld.max.y > maxY) {
        maxY = entry.boundsWorld.max.y;
      }
    }
    this._groundY = maxY;
  }

  /** Remove a placed object. */
  removeEntry(handle: number): void {
    this.entries.delete(handle);
  }

  /** Get all current entries. */
  getEntries(): ScenePlacementEntry[] {
    return [...this.entries.values()];
  }

  /** Get entry by name (case-insensitive partial match). */
  findByName(name: string): ScenePlacementEntry | undefined {
    const lower = name.toLowerCase();
    return [...this.entries.values()].find(e => e.name.toLowerCase().includes(lower));
  }

  /** Get the hero object if one exists. */
  getHero(): ScenePlacementEntry | undefined {
    return [...this.entries.values()].find(e => e.role === 'hero');
  }

  /** Check if a proposed AABB collides with any existing entry. */
  checkCollisions(proposedBounds: AABB, excludeHandle?: number): CollisionResult {
    const overlapping: string[] = [];
    let maxPenetration = 0;

    for (const entry of this.entries.values()) {
      if (entry.handle === excludeHandle) continue;
      if (entry.role === 'ground') continue; // Ground plane doesn't count as collision

      if (aabbOverlap(proposedBounds, entry.boundsWorld)) {
        overlapping.push(entry.name);
        const pen = aabbPenetrationDepth(proposedBounds, entry.boundsWorld);
        if (pen > maxPenetration) maxPenetration = pen;
      }
    }

    return {
      collides: overlapping.length > 0,
      overlapping,
      penetrationDepth: maxPenetration,
    };
  }

  /** Find a clear position for a new object with the given bounds extents. */
  suggestPlacement(
    meshExtents: Vec3,
    role: PlacementRole,
    minClearance: number,
    relationship?: string
  ): PlacementSuggestion {
    const warnings: string[] = [];
    const halfExtent = { x: meshExtents.x / 2, y: meshExtents.y / 2, z: meshExtents.z / 2 };

    // Start with a base position depending on role
    let basePos: Vec3;
    const hero = this.getHero();

    if (relationship) {
      // Parse relationship: "next to X", "behind X", "in front of X", "on top of X"
      const parsed = parseRelationship(relationship, this);
      if (parsed) {
        basePos = parsed;
      } else {
        warnings.push(
          `Could not parse relationship "${relationship}" — using role-based placement`
        );
        basePos = this.roleBasedPosition(role, hero);
      }
    } else {
      basePos = this.roleBasedPosition(role, hero);
    }

    // Ensure above ground
    const yMin = basePos.y - halfExtent.y;
    if (yMin < this._groundY) {
      basePos.y = this._groundY + halfExtent.y;
    }

    // Collision avoidance — nudge outward if overlapping
    const maxAttempts = 8;
    let attempt = 0;
    let position = { ...basePos };

    while (attempt < maxAttempts) {
      const proposedBounds: AABB = {
        min: {
          x: position.x - halfExtent.x - minClearance,
          y: position.y - halfExtent.y,
          z: position.z - halfExtent.z - minClearance,
        },
        max: {
          x: position.x + halfExtent.x + minClearance,
          y: position.y + halfExtent.y,
          z: position.z + halfExtent.z + minClearance,
        },
      };

      const collision = this.checkCollisions(proposedBounds);
      if (!collision.collides) break;

      // Nudge away from the first collider
      const colliderName = collision.overlapping[0];
      const collider = this.findByName(colliderName);
      if (collider) {
        const dx = position.x - collider.position.x;
        const dz = position.z - collider.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
        const nudge = collision.penetrationDepth + minClearance + 0.5;
        position.x += (dx / dist) * nudge;
        position.z += (dz / dist) * nudge;
      } else {
        // Random nudge
        position.x += (attempt % 2 === 0 ? 1 : -1) * (minClearance + 0.5);
        position.z += attempt % 2 === 0 ? 0.5 : -0.5;
      }
      attempt++;
    }

    if (attempt >= maxAttempts) {
      warnings.push(
        'Could not find collision-free position after 8 attempts — suggestion may overlap'
      );
    }

    // Compute clearances to all neighbors
    const clearances: { object: string; distance: number }[] = [];
    for (const entry of this.entries.values()) {
      if (entry.role === 'ground') continue;
      const dist = vec3Distance(position, entry.position);
      clearances.push({ object: entry.name, distance: Math.round(dist * 100) / 100 });
    }
    clearances.sort((a, b) => a.distance - b.distance);

    const reasoning = buildReasoning(position, role, clearances, hero, relationship);

    return {
      position,
      rotation: { x: 0, y: 0, z: 0 }, // Rotation comes from analyze_geo
      scale: { x: 1, y: 1, z: 1 }, // Scale comes from analyze_geo
      reasoning,
      clearances,
      warnings,
    };
  }

  /** Role-based default position when no relationship is specified. */
  private roleBasedPosition(role: PlacementRole, hero?: ScenePlacementEntry): Vec3 {
    const heroPos = hero?.position ?? { x: 0, y: 0, z: 0 };

    switch (role) {
      case 'hero':
        return { x: 0, y: 0, z: 0 };
      case 'secondary':
        return { x: heroPos.x - 2.5, y: 0, z: heroPos.z + 0.5 };
      case 'accent':
        return { x: heroPos.x + 2.0, y: 0, z: heroPos.z - 0.5 };
      case 'ground':
        return { x: 0, y: this._groundY, z: 0 };
      case 'light':
        return { x: heroPos.x - 3, y: 5, z: heroPos.z + 3 };
      case 'prop':
        return { x: heroPos.x + 1.5, y: 0, z: heroPos.z + 1.5 };
      default:
        return { x: 0, y: 0, z: 0 };
    }
  }

  /** Combined AABB of frameable objects (hero + secondary + accent + prop), excluding ground & light. */
  getFramingBounds(excludeHandles?: Set<number>): AABB | null {
    // Only frame hero + secondary + accent — exclude ground, light, prop (walls/backdrops)
    const FRAMEABLE_ROLES = new Set(['hero', 'secondary', 'accent']);
    const frameable = [...this.entries.values()].filter(
      e => FRAMEABLE_ROLES.has(e.role) && !excludeHandles?.has(e.handle)
    );
    if (frameable.length === 0) return null;
    let min = { ...frameable[0].boundsWorld.min };
    let max = { ...frameable[0].boundsWorld.max };
    for (let i = 1; i < frameable.length; i++) {
      const b = frameable[i].boundsWorld;
      min = {
        x: Math.min(min.x, b.min.x),
        y: Math.min(min.y, b.min.y),
        z: Math.min(min.z, b.min.z),
      };
      max = {
        x: Math.max(max.x, b.max.x),
        y: Math.max(max.y, b.max.y),
        z: Math.max(max.z, b.max.z),
      };
    }
    return { min, max };
  }

  /** AABB of the hero object only. Returns null if no hero registered. */
  getHeroBounds(): AABB | null {
    const hero = this.getHero();
    return hero ? hero.boundsWorld : null;
  }

  /**
   * Refresh all entries from Octane live state. Returns set of camera-invisible handles.
   * Prunes entries whose handles no longer exist in Octane (dead handles).
   * @param queryFn — async function that queries a single entry's live state from Octane.
   */
  async refreshFromOctane(
    queryFn: (handle: number) => Promise<{
      alive: boolean;
      cameraVisible: boolean;
      position?: Vec3;
      scale?: Vec3;
    }>
  ): Promise<Set<number>> {
    const invisible = new Set<number>();
    const dead: number[] = [];

    for (const entry of this.entries.values()) {
      try {
        const live = await queryFn(entry.handle);
        if (!live.alive) {
          dead.push(entry.handle);
          continue;
        }
        if (!live.cameraVisible) {
          invisible.add(entry.handle);
        }
        if (live.position && live.scale) {
          entry.position = live.position;
          entry.scale = live.scale;
          if (entry.localMin && entry.localMax) {
            // Recompute using stored local bounds + current rotation — preserves asymmetric AABBs
            // (e.g. Z-up meshes rotated 90° X whose geometry extends entirely above the origin).
            entry.boundsWorld = computeWorldAABBLocal(
              entry.localMin,
              entry.localMax,
              live.position,
              entry.rotation,
              live.scale
            );
          } else {
            // Fallback for entries registered without localMin/localMax (legacy / manual).
            // Approximation: centered symmetric AABB scaled by ratio. Asymmetric meshes
            // will still be wrong here, but this path should rarely occur going forward.
            const oldExt = {
              x: entry.boundsWorld.max.x - entry.boundsWorld.min.x,
              y: entry.boundsWorld.max.y - entry.boundsWorld.min.y,
              z: entry.boundsWorld.max.z - entry.boundsWorld.min.z,
            };
            const sx = live.scale.x / (entry.scale.x || 1);
            const sy = live.scale.y / (entry.scale.y || 1);
            const sz = live.scale.z / (entry.scale.z || 1);
            const halfX = (oldExt.x * sx) / 2;
            const halfY = (oldExt.y * sy) / 2;
            const halfZ = (oldExt.z * sz) / 2;
            entry.boundsWorld = {
              min: {
                x: live.position.x - halfX,
                y: live.position.y - halfY,
                z: live.position.z - halfZ,
              },
              max: {
                x: live.position.x + halfX,
                y: live.position.y + halfY,
                z: live.position.z + halfZ,
              },
            };
          }
        }
      } catch {
        dead.push(entry.handle);
      }
    }

    // Prune dead handles
    for (const h of dead) {
      this.entries.delete(h);
    }

    return invisible;
  }

  /** Snapshot for debugging. */
  snapshot(): any {
    return {
      entryCount: this.entries.size,
      groundY: this._groundY,
      entries: [...this.entries.values()].map(e => ({
        handle: e.handle,
        name: e.name,
        role: e.role,
        position: e.position,
        boundsWorld: e.boundsWorld,
      })),
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Compute world-space AABB from local bounds + placement transform (pure math, no deps).
 * Mirrors computeWorldAABB in tools/pin-utils.ts — kept here to avoid pulling in gRPC deps.
 */
function computeWorldAABBLocal(
  localMin: Vec3,
  localMax: Vec3,
  position: Vec3,
  rotationDeg: Vec3,
  scale: Vec3
): AABB {
  const sMin = { x: localMin.x * scale.x, y: localMin.y * scale.y, z: localMin.z * scale.z };
  const sMax = { x: localMax.x * scale.x, y: localMax.y * scale.y, z: localMax.z * scale.z };
  const rx = (rotationDeg.x * Math.PI) / 180;
  const ry = (rotationDeg.y * Math.PI) / 180;
  const rz = (rotationDeg.z * Math.PI) / 180;
  const cx = Math.cos(rx),
    sx = Math.sin(rx);
  const cy = Math.cos(ry),
    sy = Math.sin(ry);
  const cz = Math.cos(rz),
    sz = Math.sin(rz);
  const R = [
    [cy * cz, sx * sy * cz - cx * sz, cx * sy * cz + sx * sz],
    [cy * sz, sx * sy * sz + cx * cz, cx * sy * sz - sx * cz],
    [-sy, sx * cy, cx * cy],
  ];
  const corners = [
    { x: sMin.x, y: sMin.y, z: sMin.z },
    { x: sMax.x, y: sMin.y, z: sMin.z },
    { x: sMin.x, y: sMax.y, z: sMin.z },
    { x: sMax.x, y: sMax.y, z: sMin.z },
    { x: sMin.x, y: sMin.y, z: sMax.z },
    { x: sMax.x, y: sMin.y, z: sMax.z },
    { x: sMin.x, y: sMax.y, z: sMax.z },
    { x: sMax.x, y: sMax.y, z: sMax.z },
  ];
  let rMin = { x: Infinity, y: Infinity, z: Infinity };
  let rMax = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const c of corners) {
    const px = R[0][0] * c.x + R[0][1] * c.y + R[0][2] * c.z;
    const py = R[1][0] * c.x + R[1][1] * c.y + R[1][2] * c.z;
    const pz = R[2][0] * c.x + R[2][1] * c.y + R[2][2] * c.z;
    rMin = { x: Math.min(rMin.x, px), y: Math.min(rMin.y, py), z: Math.min(rMin.z, pz) };
    rMax = { x: Math.max(rMax.x, px), y: Math.max(rMax.y, py), z: Math.max(rMax.z, pz) };
  }
  return {
    min: { x: position.x + rMin.x, y: position.y + rMin.y, z: position.z + rMin.z },
    max: { x: position.x + rMax.x, y: position.y + rMax.y, z: position.z + rMax.z },
  };
}

function vec3Distance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function aabbOverlap(a: AABB, b: AABB): boolean {
  return (
    a.min.x <= b.max.x &&
    a.max.x >= b.min.x &&
    a.min.y <= b.max.y &&
    a.max.y >= b.min.y &&
    a.min.z <= b.max.z &&
    a.max.z >= b.min.z
  );
}

function aabbPenetrationDepth(a: AABB, b: AABB): number {
  const overlapX = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
  const overlapY = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
  const overlapZ = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
  if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) return 0;
  return Math.min(overlapX, overlapY, overlapZ);
}

function parseRelationship(relationship: string, state: ScenePlacementState): Vec3 | null {
  const lower = relationship.toLowerCase();

  // Extract object name: "next to fairy" → "fairy"
  const nameMatch = lower.match(
    /(?:next to|beside|near|behind|in front of|left of|right of|on top of)\s+(.+)/
  );
  if (!nameMatch) return null;
  const targetName = nameMatch[1].trim();
  const target = state.findByName(targetName);
  if (!target) return null;

  const offset = 2.0; // Default offset distance
  const pos = { ...target.position };

  if (lower.includes('next to') || lower.includes('beside')) {
    pos.x += offset;
  } else if (lower.includes('behind')) {
    pos.z -= offset;
  } else if (lower.includes('in front of')) {
    pos.z += offset;
  } else if (lower.includes('left of')) {
    pos.x -= offset;
  } else if (lower.includes('right of')) {
    pos.x += offset;
  } else if (lower.includes('on top of')) {
    const targetHeight = target.boundsWorld.max.y - target.boundsWorld.min.y;
    pos.y = target.boundsWorld.max.y + targetHeight * 0.1;
  } else if (lower.includes('near')) {
    pos.x += offset * 0.7;
    pos.z += offset * 0.5;
  }

  return pos;
}

function buildReasoning(
  position: Vec3,
  role: PlacementRole,
  clearances: { object: string; distance: number }[],
  hero: ScenePlacementEntry | undefined,
  relationship?: string
): string {
  const parts: string[] = [];

  if (relationship) {
    parts.push(`Placed ${role} ${relationship}.`);
  } else if (hero && role !== 'hero') {
    const dist = vec3Distance(position, hero.position);
    parts.push(`Placed ${role} ${dist.toFixed(1)} units from hero "${hero.name}".`);
  } else {
    parts.push(`Placed ${role} at origin.`);
  }

  parts.push(
    `Position: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}).`
  );

  if (clearances.length > 0) {
    const nearest = clearances[0];
    parts.push(`Nearest neighbor: "${nearest.object}" at ${nearest.distance} units.`);
  }

  return parts.join(' ');
}
