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

  // Register all tool groups
  registerInfoTools(server, client);
  registerProjectTools(server, client);
  registerCameraTools(server, client);
  registerRenderTools(server, client);
  registerSceneTools(server, client);
  registerNodeTools(server, client);
  registerAttributeTools(server, client);
  registerWebappTools(server);

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Octane MCP server running on stdio (23 tools registered)');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
