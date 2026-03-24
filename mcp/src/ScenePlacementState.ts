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
  /** Mesh analysis from analyze_mesh sidecar, if available */
  meshInfo?: {
    category: string;
    naturalHeightM: number;
    suggestedRotation: Vec3;
    groundOffsetY: number;
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

  /** Add or update a placed object. */
  addEntry(entry: ScenePlacementEntry): void {
    this.entries.set(entry.handle, entry);
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
      rotation: { x: 0, y: 0, z: 0 }, // Rotation comes from analyze_mesh
      scale: { x: 1, y: 1, z: 1 }, // Scale comes from analyze_mesh
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
