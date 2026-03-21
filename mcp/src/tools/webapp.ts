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
import { jsonResult, errorResult } from './utils';

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
      signal: AbortSignal.timeout(2000),
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

export function registerWebappTools(server: McpServer) {
  server.tool(
    'refresh_webapp',
    'Force octaneWebR to refresh its scene tree. Auto-sync happens after MCP changes, but use this if the web UI gets out of sync.',
    {},
    async () => {
      try {
        const response = await fetch(`${WEBAPP_URL}/api/scene-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'nodeAdded' }),
        });
        if (!response.ok) return errorResult(`HTTP ${response.status}: ${response.statusText}`);
        const result = await response.json();
        return jsonResult({
          success: true,
          clients: result.clients ?? 0,
          message:
            result.clients > 0
              ? `Refresh sent to ${result.clients} client(s)`
              : 'No browser clients connected',
        });
      } catch (error: any) {
        if (error?.cause?.code === 'ECONNREFUSED') {
          return jsonResult({ success: false, message: 'octaneWebR not running' });
        }
        return errorResult(error);
      }
    }
  );
}
