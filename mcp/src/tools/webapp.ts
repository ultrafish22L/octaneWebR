/**
 * Webapp Tools — refresh_webapp
 *
 * Bridges MCP ↔ octaneWebR by triggering the web app to refresh its scene tree.
 * MCP modifies Octane directly via gRPC, but octaneWebR has its own connection
 * and doesn't know about external changes. This tool sends a WebSocket broadcast
 * via the Vite dev server to trigger a scene tree rebuild in the browser.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const WEBAPP_URL = process.env.OCTANE_WEBAPP_URL || 'http://localhost:43929';

function jsonResult(data: any) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(error: any) {
  return {
    content: [
      { type: 'text' as const, text: JSON.stringify({ error: String(error?.message || error) }) },
    ],
    isError: true as const,
  };
}

export function registerWebappTools(server: McpServer) {
  server.tool(
    'refresh_webapp',
    'Trigger octaneWebR to refresh its scene tree. Call this after making changes via MCP so the web UI reflects the current Octane state. Only needed when the user is watching live in octaneWebR.',
    {},
    async () => {
      try {
        const response = await fetch(`${WEBAPP_URL}/api/refresh-scene`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          return errorResult(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        return jsonResult({
          success: true,
          clients: result.clients ?? 0,
          message:
            result.clients > 0
              ? `Scene refresh sent to ${result.clients} browser client(s)`
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
