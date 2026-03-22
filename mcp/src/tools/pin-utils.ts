/**
 * Shared pin enumeration utilities.
 *
 * Three files (node.ts, scene.ts, import.ts) had near-identical pin-walking
 * loops. This module provides a single implementation to prevent code drift.
 */

import { OctaneMcpClient, mcpLog, mcpLogLazy } from '../OctaneMcpClient';
import { extractHandle, extractValue, OBJ_API_ITEM, OBJ_API_NODE } from './utils';
import { PIN_TYPE_NAMES } from '../shared/OctaneConstants';

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
      mcpLog(`enumeratePins: pinTypeIx failed for handle ${handle} pin ${i}: ${e.message}`, 'warn');
    }

    // Pin name
    try {
      const nameResult = await client.callMethod('ApiNode', 'pinNameIx', {
        objectPtr: { handle: String(handle), type: OBJ_API_NODE },
        index: i,
      });
      pinName = String(extractValue(nameResult) ?? '');
    } catch (e: any) {
      mcpLog(`enumeratePins: pinNameIx failed for handle ${handle} pin ${i}: ${e.message}`, 'warn');
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
