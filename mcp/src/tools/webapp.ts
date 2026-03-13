/**
 * Webapp Tools — refresh_webapp + live sync
 *
 * Bridges MCP ↔ octaneWebR by sending targeted WebSocket events to the web app.
 * MCP modifies Octane directly via gRPC, but octaneWebR has its own connection
 * and doesn't know about external changes. This module provides:
 *
 * - notifyWebapp(): Auto-sends incremental events (nodeAdded, nodeDeleted, nodeChanged)
 *   after MCP tools modify the scene. Called automatically by node/scene/project tools.
 * - refresh_webapp tool: Manual full scene tree rebuild (fallback).
 * - Live sync flag: Toggle auto-notifications on/off.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const WEBAPP_URL = process.env.OCTANE_WEBAPP_URL || 'http://127.0.0.1:43929';

let liveSyncEnabled = true;

/**
 * Send a targeted scene event to octaneWebR for incremental UI updates.
 * Called automatically by MCP tools after structural changes.
 * Silent on failure (webapp may not be running).
 */
export async function notifyWebapp(event: { type: string; handle?: number }): Promise<void> {
  if (!liveSyncEnabled) return;
  try {
    await fetch(`${WEBAPP_URL}/api/scene-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch {
    // Silent — webapp may not be running
  }
}

export function setLiveSync(enabled: boolean): void {
  liveSyncEnabled = enabled;
}

export function isLiveSyncEnabled(): boolean {
  return liveSyncEnabled;
}

import { jsonResult, errorResult } from './utils';

export function registerWebappTools(server: McpServer) {
  server.tool(
    'refresh_webapp',
    'Trigger octaneWebR to refresh its scene tree. Also controls live_sync (auto-updates on/off). Call without params for a full refresh. Set live_sync to toggle automatic UI updates after MCP changes.',
    {
      live_sync: z
        .boolean()
        .optional()
        .describe(
          'Toggle automatic UI sync after MCP changes. true=on (default), false=off. Omit to just refresh.'
        ),
    },
    async ({ live_sync }) => {
      // Handle live_sync toggle
      if (live_sync !== undefined) {
        setLiveSync(live_sync);
        if (!live_sync) {
          return jsonResult({
            success: true,
            message: 'Live sync disabled — UI will not auto-update after MCP changes',
          });
        }
        // If enabling, also do a refresh to sync current state
      }

      try {
        const response = await fetch(`${WEBAPP_URL}/api/scene-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'nodeAdded' }),
        });

        if (!response.ok) {
          return errorResult(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        return jsonResult({
          success: true,
          clients: result.clients ?? 0,
          live_sync: liveSyncEnabled,
          message:
            result.clients > 0
              ? `Scene refresh sent to ${result.clients} browser client(s)${live_sync === true ? ' — live sync enabled' : ''}`
              : 'No browser clients connected — octaneWebR may not be open',
        });
      } catch (error: any) {
        if (error?.cause?.code === 'ECONNREFUSED') {
          return jsonResult({
            success: false,
            message: 'octaneWebR dev server not running (ECONNREFUSED). Start with: npm run dev',
          });
        }
        return errorResult(error);
      }
    }
  );
}
