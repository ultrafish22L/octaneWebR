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
import { OctaneMcpClient, MCP_LOG_PATH, mcpLog, mcpLogReset } from './OctaneMcpClient';
import { ApiCache } from './ApiCache';
import { registerInfoTools } from './tools/info';
import { registerProjectTools } from './tools/project';
import { registerCameraTools } from './tools/camera';
import { registerRenderTools } from './tools/render';
import { registerSceneTools } from './tools/scene';
import { registerNodeTools } from './tools/node';
import { registerAttributeTools } from './tools/attribute';
import { registerWebappTools } from './tools/webapp';
import { registerImportTools } from './tools/import';
import { registerRenderControlTools } from './tools/render-control';
import { registerStatsTools } from './tools/stats';
import { registerMaterialDbTools } from './tools/materials-db';
import { registerArtDirectionTools } from './tools/artdirection';
import { ArtDirectionState } from './ArtDirectionState';
import { registerCreativeTools } from './creative/index';
import { registerResources } from './resources';
import { registerPrompts } from './prompts';

async function main() {
  // Clear MCP log at startup — fresh log each session
  // Only clears log_mcp.log (MCP's own log). log_grpc.log is owned by Vite.
  const fs = await import('fs');
  try {
    if (fs.existsSync(MCP_LOG_PATH)) {
      fs.unlinkSync(MCP_LOG_PATH);
    }
  } catch {
    /* ignore */
  }
  // Reset stream after delete — eager init in OctaneMcpClient may have already
  // opened a stream to the now-deleted file. This ensures the next mcpLog() recreates it.
  mcpLogReset();

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

  // Wrap server.tool to auto-log tool invocations at info/debug level.
  // info: "TOOL create_node" (name only)
  // debug: "TOOL create_node {type_id: 117, ...}" (name + args)
  const origTool = server.tool.bind(server);
  server.tool = function (...args: any[]) {
    // server.tool(name, description, schema, handler) — handler is last arg
    const toolName = args[0] as string;
    const handlerIdx = args.length - 1;
    const origHandler = args[handlerIdx] as (...a: any[]) => any;
    args[handlerIdx] = async (...handlerArgs: any[]) => {
      const toolArgs = handlerArgs[0]; // first arg is the parsed params object
      const hasArgs = toolArgs && Object.keys(toolArgs).length > 0;
      // Single TOOL line: at debug show args, at info show name only
      if (hasArgs) {
        mcpLog(`TOOL ${toolName} ${JSON.stringify(toolArgs).substring(0, 300)}`, 'info');
      } else {
        mcpLog(`TOOL ${toolName}`, 'info');
      }
      const startMs = Date.now();
      try {
        const result = await origHandler(...handlerArgs);
        const elapsed = Date.now() - startMs;
        mcpLog(`TOOL ${toolName} done ${elapsed}ms`, 'debug');
        return result;
      } catch (err: any) {
        const elapsed = Date.now() - startMs;
        mcpLog(`TOOL ${toolName} FAILED ${elapsed}ms: ${err.message}`, 'error');
        throw err;
      }
    };
    return (origTool as any)(...args);
  } as any;

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
  registerInfoTools(server, client, cache);
  registerProjectTools(server, client, cache);
  registerCameraTools(server, client);
  registerRenderTools(server, client);
  registerSceneTools(server, client, cache);
  registerNodeTools(server, client, cache);
  registerAttributeTools(server, client);
  registerWebappTools(server);
  registerImportTools(server, client, cache);
  registerRenderControlTools(server, client);
  registerStatsTools(server, client);
  registerMaterialDbTools(server, client);

  // Register Art Direction tools (composition planning, critique loop)
  const artState = new ArtDirectionState();
  registerArtDirectionTools(server, client, artState);

  // Register Creative tools (lighting, materials knowledge)
  registerCreativeTools(server, client);

  // Register MCP Resources (read-only type system + scene state)
  registerResources(server, client, cache);

  // Register MCP Prompts (workflow knowledge templates)
  registerPrompts(server);

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Octane MCP server running on stdio');

  // Graceful shutdown — close gRPC channels, log stream, and MCP transport
  const shutdown = async (signal: string) => {
    console.error(`${signal} received, shutting down...`);
    await server.close();
    client.close();
    mcpLogReset();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
