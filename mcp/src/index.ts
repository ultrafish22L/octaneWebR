/**
 * Octane MCP Server
 *
 * Exposes the Octane gRPC API as MCP tools for AI agents.
 * Connects directly to Octane at 127.0.0.1:51022 via gRPC.
 * octaneWebR visualizes changes in real time (both are independent gRPC peers).
 *
 * Transport: stdio (works with Claude Code and Claude Desktop)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { OctaneMcpClient } from './OctaneMcpClient';
import { ApiCache } from './ApiCache';
import { registerInfoTools } from './tools/info';
import { registerProjectTools } from './tools/project';
import { registerCameraTools } from './tools/camera';
import { registerRenderTools } from './tools/render';
import { registerSceneTools } from './tools/scene';
import { registerNodeTools } from './tools/node';
import { registerAttributeTools } from './tools/attribute';
import { registerWebappTools } from './tools/webapp';

async function main() {
  // Connect to Octane via gRPC
  const client = new OctaneMcpClient();
  await client.initialize();

  const healthy = await client.checkHealth();
  if (!healthy) {
    console.error('WARNING: Octane is not responding at 127.0.0.1:51022');
    console.error('The MCP server will start, but tools will fail until Octane is running.');
  } else {
    console.error('Connected to Octane at 127.0.0.1:51022');
  }

  // Create MCP server
  const server = new McpServer({
    name: 'octane-mcp',
    version: '1.0.0',
  });

  // Load static API cache (graceful fallback if missing)
  const cache = ApiCache.load();
  if (cache) {
    console.error(
      `API cache loaded: ${cache.nodeTypeCount} node types, ${cache.totalPins} pins (${cache.version})`
    );
  } else {
    console.error('WARNING: No API cache found at mcp/data/octane-api-cache.json');
    console.error(
      'Run "node scripts/fetch-api-cache.js" to generate it. Falling back to gRPC queries.'
    );
  }

  // Register all tool groups
  registerInfoTools(server, client);
  registerProjectTools(server, client);
  registerCameraTools(server, client);
  registerRenderTools(server, client);
  registerSceneTools(server, client, cache);
  registerNodeTools(server, client, cache);
  registerAttributeTools(server, client);
  registerWebappTools(server);

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Octane MCP server running on stdio (24 tools registered)');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
