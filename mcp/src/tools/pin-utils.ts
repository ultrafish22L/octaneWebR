/**
 * Shared pin and geometry utilities.
 *
 * Pin enumeration: Three files (node.ts, scene.ts, import.ts) had near-identical
 * pin-walking loops. This module provides a single implementation.
 *
 * Dynamic pins: ensureDynamicPin handles geo group pin expansion.
 *
 * AABB: computeWorldAABB transforms local mesh bounds to world space with
 * full Euler rotation support. Used by place_geo and register_object.
 */

import { OctaneMcpClient, mcpLog, mcpLogLazy } from '../OctaneMcpClient';
import { extractHandle, extractValue, OBJ_API_ITEM, OBJ_API_NODE } from './utils';
import { PIN_TYPE_NAMES, AttributeId } from '../shared/OctaneConstants';

export interface PinInfo {
  index: number;
  name: string;
  typeName: string;
  connectedHandle: number;
  /** Name of the connected node (if any). Only populated when withConnectedNames is true. */
  connectedName?: string;
}

/** Resolve a gRPC pin-type value to a human-readable PT_* string. */
function resolvePinType(raw: unknown): string {
  if (typeof raw === 'string' && raw.startsWith('PT_')) return raw;
  const num = Number(raw ?? 0);
  return PIN_TYPE_NAMES[num] ?? `PT_${num}`;
}

/**
 * Enumerate all pins on a node via gRPC (no cache).
 *
 * For each pin: queries name, type, and connected handle.
 * Optionally also tries `ownedItemIx` when `connectedNodeIx` returns nothing
 * (internal/auto-created children are owned, not graph-connected).
 */
export async function enumeratePins(
  client: OctaneMcpClient,
  handle: number,
  opts?: {
    /** Also try ownedItemIx for pins with no graph connection (default false) */
    includeOwned?: boolean;
    /** Also fetch the name of connected nodes (default false) */
    withConnectedNames?: boolean;
  }
): Promise<PinInfo[]> {
  const pins: PinInfo[] = [];
  const includeOwned = opts?.includeOwned ?? false;
  const withNames = opts?.withConnectedNames ?? false;

  let count = 0;
  try {
    const countResult = await client.callMethod('ApiNode', 'pinCount', {
      objectPtr: { handle: String(handle), type: OBJ_API_NODE },
    });
    count = Number(extractValue(countResult) ?? 0);
  } catch (e: any) {
    mcpLog(`enumeratePins: pinCount failed for handle ${handle}: ${e.message}`, 'warn');
    return pins;
  }

  for (let i = 0; i < count; i++) {
    let typeName = 'PT_UNKNOWN';
    let pinName = '';
    let connectedHandle = 0;
    let connectedName: string | undefined;

    // Pin type
    try {
      const typeResult = await client.callMethod('ApiNode', 'pinTypeIx', {
        objectPtr: { handle: String(handle), type: OBJ_API_NODE },
        index: i,
      });
      typeName = resolvePinType(extractValue(typeResult));
    } catch (e: any) {
      mcpLogLazy(
        'verbose',
        () => `enumeratePins: pinTypeIx failed for handle ${handle} pin ${i}: ${e.message}`
      );
    }

    // Pin name
    try {
      const nameResult = await client.callMethod('ApiNode', 'pinNameIx', {
        objectPtr: { handle: String(handle), type: OBJ_API_NODE },
        index: i,
      });
      pinName = String(extractValue(nameResult) ?? '');
    } catch (e: any) {
      mcpLogLazy(
        'verbose',
        () => `enumeratePins: pinNameIx failed for handle ${handle} pin ${i}: ${e.message}`
      );
    }

    // Connected node (graph connection)
    try {
      const connResult = await client.callMethod('ApiNode', 'connectedNodeIx', {
        objectPtr: { handle: String(handle), type: OBJ_API_NODE },
        pinIx: i,
        enterWrapperNode: true,
      });
      connectedHandle = extractHandle(connResult) ?? 0;
    } catch (e: any) {
      mcpLogLazy('verbose', () => `[pin-utils:enumerate:connectedNode:${i}] ${e?.message ?? e}`);
      // Not graph-connected
    }

    // Owned node (internal child) — only if requested and no graph connection found
    if (!connectedHandle && includeOwned) {
      try {
        const ownedResult = await client.callMethod('ApiNode', 'ownedItemIx', {
          objectPtr: { handle: String(handle), type: OBJ_API_NODE },
          pinIx: i,
        });
        connectedHandle = extractHandle(ownedResult) ?? 0;
      } catch (e: any) {
        mcpLogLazy('verbose', () => `[pin-utils:enumerate:ownedItem:${i}] ${e?.message ?? e}`);
        // Pin has no node
      }
    }

    // Connected node name
    if (connectedHandle && withNames) {
      try {
        const nameRes = await client.callMethod('ApiItem', 'name', {
          objectPtr: { handle: String(connectedHandle), type: OBJ_API_ITEM },
        });
        connectedName = String(extractValue(nameRes) ?? '');
      } catch (e: any) {
        mcpLogLazy(
          'verbose',
          () => `[pin-utils:enumerate:connName:${connectedHandle}] ${e?.message ?? e}`
        );
        // Skip if name lookup fails
      }
    }

    pins.push({ index: i, name: pinName, typeName, connectedHandle, connectedName });
  }

  return pins;
}

/**
 * Find a pin by name on a node. Returns the first match or undefined.
 */
export async function getPinByName(
  client: OctaneMcpClient,
  handle: number,
  name: string
): Promise<PinInfo | undefined> {
  const pins = await enumeratePins(client, handle);
  return pins.find(p => p.name === name);
}

/**
 * Get the connected handle for a specific pin index.
 * Tries graph connection first, then owned item.
 */
export async function getConnectedHandle(
  client: OctaneMcpClient,
  handle: number,
  pinIndex: number
): Promise<number> {
  try {
    const connResult = await client.callMethod('ApiNode', 'connectedNodeIx', {
      objectPtr: { handle: String(handle), type: OBJ_API_NODE },
      pinIx: pinIndex,
      enterWrapperNode: true,
    });
    const h = extractHandle(connResult);
    if (h) return h;
  } catch (e: any) {
    mcpLogLazy('verbose', () => `[pin-utils:getConnected:graph:${pinIndex}] ${e?.message ?? e}`);
    // Not graph-connected
  }
  try {
    const ownedResult = await client.callMethod('ApiNode', 'ownedItemIx', {
      objectPtr: { handle: String(handle), type: OBJ_API_NODE },
      pinIx: pinIndex,
    });
    return extractHandle(ownedResult) ?? 0;
  } catch (e: any) {
    mcpLogLazy('verbose', () => `[pin-utils:getConnected:owned:${pinIndex}] ${e?.message ?? e}`);
    return 0;
  }
}

const MAX_DYNAMIC_PINS = 32;

/**
 * Resolve a pin index on a dynamic-pin node (e.g. NT_GEO_GROUP), expanding
 * pin count as needed. Does NOT perform the connection — caller does that.
 *
 * Handles:
 *  1. Query current pinCount
 *  2. If pinIndex specified: expand pins if needed
 *  3. If pinIndex omitted: find first empty slot or append
 *
 * Shared by connect_nodes (node.ts) and place_geo (import.ts) to prevent
 * code drift. Previously place_geo had a broken reimplementation that
 * crashed on fresh geo groups with 0 pins.
 *
 * @returns The pin index to use for the connection.
 */
export async function ensureDynamicPin(
  client: OctaneMcpClient,
  targetHandle: number,
  pinIndex?: number
): Promise<number> {
  // 1. Get current pin count
  let curCount = 0;
  try {
    const curResult = await client.callMethod('ApiNode', 'pinCount', {
      objectPtr: { handle: String(targetHandle), type: OBJ_API_NODE },
    });
    curCount = Number(extractValue(curResult) ?? 0);
  } catch (e: any) {
    mcpLog(`ensureDynamicPin: pinCount failed for ${targetHandle}: ${e.message}`, 'warn');
  }

  if (pinIndex !== undefined) {
    // 2a. Caller specified a pin — expand if needed
    if (pinIndex >= MAX_DYNAMIC_PINS) {
      throw new Error(`pin_index ${pinIndex} exceeds max dynamic pins (${MAX_DYNAMIC_PINS}).`);
    }
    if (curCount <= pinIndex) {
      await client.callMethod('ApiItem', 'setValueByAttrID', {
        objectPtr: { handle: String(targetHandle), type: OBJ_API_ITEM },
        attribute_id: AttributeId.A_PIN_COUNT,
        int_value: pinIndex + 1,
        evaluate: false,
      });
      await client.callMethod('ApiChangeManager', 'update', {});
    }
    return pinIndex;
  }

  // 2b. Auto-find first empty slot (scan from end for efficiency)
  let freePin = -1;
  for (let i = curCount - 1; i >= 0; i--) {
    try {
      const conn = await client.callMethod('ApiNode', 'connectedNodeIx', {
        objectPtr: { handle: String(targetHandle), type: OBJ_API_NODE },
        pinIx: i,
        enterWrapperNode: false,
      });
      const connHandle = extractHandle(conn) ?? 0;
      if (connHandle === 0) {
        freePin = i;
      } else {
        break; // Hit occupied pin — all before it are likely full
      }
    } catch {
      // Pin doesn't exist or error — skip
      break;
    }
  }

  if (freePin >= 0) {
    return freePin;
  }

  if (curCount < MAX_DYNAMIC_PINS) {
    // All full (or 0 pins) — expand by 1
    const newCount = curCount + 1;
    await client.callMethod('ApiItem', 'setValueByAttrID', {
      objectPtr: { handle: String(targetHandle), type: OBJ_API_ITEM },
      attribute_id: AttributeId.A_PIN_COUNT,
      int_value: newCount,
      evaluate: false,
    });
    await client.callMethod('ApiChangeManager', 'update', {});
    return curCount; // new slot at end
  }

  throw new Error(
    `Dynamic node ${targetHandle} already has ${curCount} children (max ${MAX_DYNAMIC_PINS}).`
  );
}

// ── Geometry utilities ──────────────────────────────────────────────

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Compute world-space AABB from local mesh bounds + placement transform.
 *
 * Steps: scale local bounds → build Euler XYZ rotation matrix → project
 * all 8 corners through rotation → find min/max → translate to world position.
 *
 * Shared by place_geo (import.ts) and register_object (artdirection.ts).
 * Previously each had its own implementation; place_geo's was broken
 * (no rotation, wrong field names).
 */
export function computeWorldAABB(
  localMin: Vec3,
  localMax: Vec3,
  position: Vec3,
  rotationDeg: Vec3,
  scale: Vec3
): { min: Vec3; max: Vec3 } {
  // Step 1: Scale local bounds
  const sMin = {
    x: localMin.x * scale.x,
    y: localMin.y * scale.y,
    z: localMin.z * scale.z,
  };
  const sMax = {
    x: localMax.x * scale.x,
    y: localMax.y * scale.y,
    z: localMax.z * scale.z,
  };

  // Step 2: Build rotation matrix from Euler XYZ (degrees)
  const rx = (rotationDeg.x * Math.PI) / 180;
  const ry = (rotationDeg.y * Math.PI) / 180;
  const rz = (rotationDeg.z * Math.PI) / 180;
  const cx = Math.cos(rx),
    sx = Math.sin(rx);
  const cy = Math.cos(ry),
    sy = Math.sin(ry);
  const cz = Math.cos(rz),
    sz = Math.sin(rz);
  // R = Rz * Ry * Rx (standard Euler XYZ)
  const R = [
    [cy * cz, sx * sy * cz - cx * sz, cx * sy * cz + sx * sz],
    [cy * sz, sx * sy * sz + cx * cz, cx * sy * sz - sx * cz],
    [-sy, sx * cy, cx * cy],
  ];

  // Step 3: Project all 8 corners through rotation, find AABB
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

  // Step 4: Translate to world position
  return {
    min: {
      x: position.x + rMin.x,
      y: position.y + rMin.y,
      z: position.z + rMin.z,
    },
    max: {
      x: position.x + rMax.x,
      y: position.y + rMax.y,
      z: position.z + rMax.z,
    },
  };
}
